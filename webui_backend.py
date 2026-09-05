"""AstrBot Quote Collector - 黑历史语录管理 WebUI 后端 API.

注册到 AstrBot 上下文的 Web API 路由。前端通过 Bridge 调用:
  GET  /quote_collocter/groups             - 列出所有有语录的群 (含每群统计)
  GET  /quote_collocter/images             - 分页列出某群的语录 (group_id 必填)
  GET  /quote_collocter/settings           - 读取某群 admin_settings
  POST /quote_collocter/settings           - 修改某群 admin_settings
  POST /quote_collocter/images/delete      - 批量删除
  POST /quote_collocter/images/move        - 批量移动到另一群
  POST /quote_collocter/images/rename      - 重命名单张
  GET  /quote_collocter/images/raw         - 返回图片原始字节 (需 token, 受 dashboard 鉴权保护)
  GET  /quote_collocter/images/thumb       - 返回缩略图
  POST /quote_collocter/images/upload      - multipart 上传 (用 bridge.upload)
"""
from __future__ import annotations

import base64
import io
import mimetypes
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote

import yaml

# Bridge 返回 {"status": "ok"|"error", "data": ..., "message": ...} 由 dashboard 包装;
# 我们直接返回 dict, dashboard 端点把整个返回值塞到 message.data.ok=true 分支.
try:
    from PIL import Image as PILImage
    _HAS_PIL = True
except Exception:  # pragma: no cover - PIL optional
    _HAS_PIL = False

PLUGIN_NAME = "quote_collocter"
DATA_ROOT = Path("data") / "quotes_data"            # 复用 main.py 中的目录约定
THUMB_ROOT = Path("data") / "quotes_data" / ".thumbs"
ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"}

_SAFE_ID = re.compile(r"^[A-Za-z0-9_\-:]{1,64}$")
_SAFE_NAME = re.compile(r"^[A-Za-z0-9_\-\u4e00-\u9fa5 .]{1,128}$")


def _ok(data: Any = None, message: str = "ok") -> dict:
    return {"status": "ok", "message": message, "data": data if data is not None else {}}


def _err(message: str, status: int = 400) -> dict:
    return {"status": "error", "message": message, "data": {}, "_status": status}


def _ensure_data_root() -> Path:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    THUMB_ROOT.mkdir(parents=True, exist_ok=True)
    return DATA_ROOT


def _validate_group_id(group_id: str) -> str | None:
    if not isinstance(group_id, str) or not _SAFE_ID.match(group_id):
        return None
    return group_id


def _validate_filename(name: str) -> str | None:
    if not isinstance(name, str):
        return None
    base = os.path.basename(name)
    if not base or base != name:
        return None
    ext = os.path.splitext(base)[1].lower()
    if ext not in ALLOWED_EXTS:
        return None
    if not _SAFE_NAME.match(os.path.splitext(base)[0]):
        return None
    return base


def _list_groups() -> list[dict]:
    root = _ensure_data_root()
    out: list[dict] = []
    if not root.exists():
        return out
    for entry in sorted(root.iterdir(), key=lambda p: p.name):
        if not entry.is_dir() or entry.name.startswith("."):
            continue
        images = [
            f for f in entry.iterdir()
            if f.is_file() and f.suffix.lower() in ALLOWED_EXTS
        ]
        size = sum((f.stat().st_size for f in images), 0)
        out.append({
            "group_id": entry.name,
            "count": len(images),
            "size_bytes": size,
        })
    out.sort(key=lambda g: g["count"], reverse=True)
    return out


def _list_images(group_id: str, page: int, page_size: int, query: str = "") -> dict:
    folder = _ensure_data_root() / group_id
    if not folder.exists():
        return {"total": 0, "items": [], "page": page, "page_size": page_size}
    images: list[dict] = []
    q = (query or "").strip().lower()
    for f in folder.iterdir():
        if not f.is_file() or f.suffix.lower() not in ALLOWED_EXTS:
            continue
        if q and q not in f.name.lower():
            continue
        st = f.stat()
        images.append({
            "name": f.name,
            "size": st.st_size,
            "mtime": int(st.st_mtime),
            "ctime": int(st.st_ctime),
        })
    images.sort(key=lambda i: i["mtime"], reverse=True)
    total = len(images)
    start = max(0, (page - 1) * page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": images[start:start + page_size],
    }


def _delete_images(group_id: str, names: Iterable[str]) -> dict:
    folder = _ensure_data_root() / group_id
    deleted: list[str] = []
    missing: list[str] = []
    for name in names:
        safe = _validate_filename(name)
        if not safe:
            continue
        f = folder / safe
        if f.is_file():
            f.unlink()
            deleted.append(safe)
        else:
            missing.append(safe)
    return {"deleted": deleted, "missing": missing}


def _move_images(src_group: str, dst_group: str, names: Iterable[str]) -> dict:
    src = _ensure_data_root() / src_group
    dst = _ensure_data_root() / dst_group
    moved: list[str] = []
    failed: list[dict] = []
    if not _validate_group_id(dst_group):
        return {"moved": [], "failed": [{"reason": "invalid dst group_id"}]}
    dst.mkdir(parents=True, exist_ok=True)
    for name in names:
        safe = _validate_filename(name)
        if not safe:
            failed.append({"name": name, "reason": "invalid name"})
            continue
        s = src / safe
        if not s.is_file():
            failed.append({"name": safe, "reason": "not found"})
            continue
        target = dst / safe
        if target.exists():
            stem, ext = os.path.splitext(safe)
            target = dst / f"{stem}_{int(time.time() * 1000)}{ext}"
        s.rename(target)
        moved.append(target.name)
    return {"moved": moved, "failed": failed}


def _rename_image(group_id: str, old_name: str, new_name: str) -> dict:
    folder = _ensure_data_root() / group_id
    old_safe = _validate_filename(old_name)
    new_safe = _validate_filename(new_name)
    if not old_safe or not new_safe:
        return _err("invalid name")
    if not (folder / old_safe).is_file():
        return _err("not found", 404)
    target = folder / new_safe
    if target.exists() and target != (folder / old_safe):
        stem, ext = os.path.splitext(new_safe)
        target = folder / f"{stem}_{int(time.time() * 1000)}{ext}"
    (folder / old_safe).rename(target)
    return _ok({"new_name": target.name})


def _settings_path(group_id: str) -> Path:
    return _ensure_data_root() / group_id / "admin_settings.yml"


def _load_settings(group_id: str) -> dict:
    p = _settings_path(group_id)
    if not p.exists():
        return {"mode": 0, "coldown": 10}
    try:
        with p.open("r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return {"mode": 0, "coldown": 10}


def _save_settings(group_id: str, data: dict) -> None:
    p = _settings_path(group_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True)


def _make_thumb(src: Path, thumb_size: int = 320) -> bytes | None:
    if not _HAS_PIL:
        return None
    try:
        with PILImage.open(src) as im:
            im.thumbnail((thumb_size, thumb_size))
            buf = io.BytesIO()
            fmt = (im.format or "JPEG").upper()
            if fmt == "PNG" and im.mode in ("RGBA", "P"):
                im.save(buf, format="PNG", optimize=True)
            else:
                if im.mode not in ("RGB", "L"):
                    im = im.convert("RGB")
                im.save(buf, format="JPEG", quality=78, optimize=True)
            return buf.getvalue()
    except Exception:
        return None


def _raw_image(group_id: str, name: str) -> tuple[bytes | None, str, str | None]:
    safe = _validate_filename(name)
    if not safe:
        return None, "image/jpeg", None
    folder = _ensure_data_root() / group_id
    p = folder / safe
    if not p.is_file():
        return None, "image/jpeg", None
    mime, _ = mimetypes.guess_type(p.name)
    return p.read_bytes(), mime or "image/jpeg", p.name


def _b64_image(group_id: str, name: str, max_w: int = 480) -> dict:
    safe = _validate_filename(name)
    if not safe:
        return _err("invalid name")
    folder = _ensure_data_root() / group_id
    p = folder / safe
    if not p.is_file():
        return _err("not found", 404)
    raw = p.read_bytes()
    mime, _ = mimetypes.guess_type(p.name)
    mime = mime or "image/jpeg"
    if _HAS_PIL:
        try:
            with PILImage.open(io.BytesIO(raw)) as im:
                im.thumbnail((max_w, max_w))
                if im.mode not in ("RGB", "L"):
                    im = im.convert("RGB")
                buf = io.BytesIO()
                im.save(buf, format="JPEG", quality=70, optimize=True)
                raw = buf.getvalue()
                mime = "image/jpeg"
        except Exception:
            pass
    return _ok({
        "name": p.name,
        "size": len(raw),
        "mime": mime,
        "data": base64.b64encode(raw).decode("ascii"),
    })


def _save_uploaded(group_id: str, name: str, data: bytes) -> dict:
    safe = _validate_filename(name)
    if not safe:
        # 自动选择扩展名
        ext = os.path.splitext(name)[1].lower() or ".jpg"
        if ext not in ALLOWED_EXTS:
            return _err(f"unsupported file type: {ext}")
        stem = uuid.uuid4().hex
        safe = f"{stem}{ext}"
        if not _SAFE_NAME.match(stem):
            return _err("invalid filename")
    folder = _ensure_data_root() / group_id
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / safe
    if target.exists():
        stem, ext = os.path.splitext(safe)
        target = folder / f"{stem}_{int(time.time() * 1000)}{ext}"
    target.write_bytes(data)
    return _ok({"name": target.name, "size": target.stat().st_size})


# ---------------------------------------------------------------------------
# 下面是真正的 handler —— 通过 self.context.register_web_api 注册。
# 由于本插件使用 main.py 风格，我们以一个类来组织，方便单元测试。
# ---------------------------------------------------------------------------


class WebUIHandlers:
    """集中管理所有 Web API 路由, 由 Quote_Plugin 持有并在 initialize() 注册."""

    def __init__(self, plugin_name: str = PLUGIN_NAME) -> None:
        self.plugin_name = plugin_name
        self.registered_prefix = f"/{plugin_name}"

    # -- 注册 (插件初始化时调用) -----------------------------------------
    def register(self, context) -> None:
        context.register_web_api(
            f"{self.registered_prefix}/groups",
            self.list_groups,
            ["GET"],
            "列出所有语录群",
        )
        context.register_web_api(
            f"{self.registered_prefix}/overview",
            self.overview,
            ["GET"],
            "总体统计",
        )
        context.register_web_api(
            f"{self.registered_prefix}/images",
            self.list_images,
            ["GET"],
            "分页列出某群语录",
        )
        context.register_web_api(
            f"{self.registered_prefix}/images/raw",
            self.serve_raw,
            ["GET"],
            "返回图片原始字节 (仅供同源 dashboard iframe 使用)",
        )
        context.register_web_api(
            f"{self.registered_prefix}/images/thumb",
            self.serve_thumb,
            ["GET"],
            "返回 320px 缩略图字节",
        )
        context.register_web_api(
            f"{self.registered_prefix}/images/upload",
            self.upload_image,
            ["POST"],
            "上传一张图片 (form-data 字段名: file)",
        )
        context.register_web_api(
            f"{self.registered_prefix}/images/delete",
            self.delete_images,
            ["POST"],
            "批量删除图片 (JSON: {group_id, names:[]})",
        )
        context.register_web_api(
            f"{self.registered_prefix}/images/move",
            self.move_images,
            ["POST"],
            "批量移动 (JSON: {src_group_id, dst_group_id, names:[]})",
        )
        context.register_web_api(
            f"{self.registered_prefix}/images/rename",
            self.rename_image,
            ["POST"],
            "重命名 (JSON: {group_id, old_name, new_name})",
        )
        context.register_web_api(
            f"{self.registered_prefix}/settings",
            self.get_settings,
            ["GET"],
            "读取某群 admin_settings",
        )
        context.register_web_api(
            f"{self.registered_prefix}/settings",
            self.update_settings,
            ["POST"],
            "更新某群 admin_settings",
        )

    # -- handler --------------------------------------------------------
    # -- 内部: 读取当前请求 body / query ----------------------------------
    @staticmethod
    async def _read_json_body() -> dict:
        try:
            from astrbot.api.web import request as plugin_request
        except Exception as e:
            raise RuntimeError(f"request proxy unavailable: {e}")
        try:
            return await plugin_request.json(default={}) or {}
        except Exception:
            return {}

    @staticmethod
    async def _read_query() -> dict:
        try:
            from astrbot.api.web import request as plugin_request
        except Exception:
            return {}
        try:
            q = plugin_request.query
            return dict(q) if q else {}
        except Exception:
            return {}

    @classmethod
    async def _collect_params(cls, expected: list[str]) -> dict:
        """合并 query + JSON body (body 覆盖 query)."""
        out: dict = {}
        try:
            out.update(await cls._read_query())
        except Exception:
            pass
        try:
            out.update(await cls._read_json_body())
        except Exception:
            pass
        # 只保留 expected 字段
        return {k: out.get(k, "") for k in expected}

    # -- handler --------------------------------------------------------
    async def list_groups(self) -> dict:
        return _ok({"groups": _list_groups()})

    async def overview(self) -> dict:
        groups = _list_groups()
        total_images = sum(g["count"] for g in groups)
        total_size = sum(g["size_bytes"] for g in groups)
        return _ok({
            "group_count": len(groups),
            "total_images": total_images,
            "total_size_bytes": total_size,
            "has_pillow": _HAS_PIL,
        })

    async def list_images(self, **kwargs):
        params = await self._collect_params(["group_id", "page", "page_size", "query"])
        gid = _validate_group_id(params.get("group_id", ""))
        if not gid:
            return _err("invalid group_id")
        try:
            p = max(1, int(params.get("page") or 1))
            ps = max(1, min(200, int(params.get("page_size") or 24)))
        except Exception:
            p, ps = 1, 24
        return _ok(_list_images(gid, p, ps, params.get("query", "")))

    async def serve_raw(self, **kwargs):
        params = await self._collect_params(["group_id", "name"])
        gid = _validate_group_id(params.get("group_id", ""))
        if not gid:
            return _err("invalid group_id")
        raw, mime, fname = _raw_image(gid, params.get("name", ""))
        if raw is None:
            return _err("not found", 404)
        return {
            "status": "ok",
            "message": "ok",
            "data": {
                "__binary__": True,
                "mime": mime,
                "filename": fname,
                "b64": base64.b64encode(raw).decode("ascii"),
            },
        }

    async def serve_thumb(self, **kwargs):
        params = await self._collect_params(["group_id", "name", "size"])
        gid = _validate_group_id(params.get("group_id", ""))
        if not gid:
            return _err("invalid group_id")
        try:
            ts = max(64, min(1024, int(params.get("size") or 320)))
        except Exception:
            ts = 320
        safe = _validate_filename(params.get("name", ""))
        if not safe:
            return _err("invalid name")
        src = _ensure_data_root() / gid / safe
        if not src.is_file():
            return _err("not found", 404)
        thumb = _make_thumb(src, ts)
        if thumb is None:
            thumb = src.read_bytes()
            mime = mimetypes.guess_type(src.name)[0] or "image/jpeg"
        else:
            mime = "image/jpeg"
        return {
            "status": "ok",
            "message": "ok",
            "data": {
                "__binary__": True,
                "mime": mime,
                "filename": src.name,
                "b64": base64.b64encode(thumb).decode("ascii"),
            },
        }

    async def upload_image(self, **kwargs):
        params = await self._collect_params(["group_id", "name"])
        gid = _validate_group_id(params.get("group_id", ""))
        if not gid:
            return _err("invalid group_id")
        try:
            from astrbot.api.web import request as plugin_request
        except Exception as e:  # pragma: no cover
            return _err(f"request proxy unavailable: {e}")
        try:
            files = await plugin_request.files()
        except Exception as e:
            return _err(f"failed to read multipart: {e}")
        f = files.get("file") if files else None
        if f is None and files:
            f = files.get("files")
        if f is None:
            return _err("missing 'file' field in multipart body")
        data = await f.read() if hasattr(f, "read") else getattr(f, "body", b"")
        if not data:
            return _err("empty file")
        filename = params.get("name") or getattr(f, "filename", None) or "upload.bin"
        return _save_uploaded(gid, filename, data)

    async def delete_images(self, **kwargs):
        params = await self._collect_params(["group_id", "names"])
        gid = _validate_group_id(params.get("group_id", ""))
        if not gid:
            return _err("invalid group_id")
        names = params.get("names")
        if not isinstance(names, list):
            return _err("names must be a list")
        return _ok(_delete_images(gid, names))

    async def move_images(self, **kwargs):
        params = await self._collect_params(["src_group_id", "dst_group_id", "names"])
        sgid = _validate_group_id(params.get("src_group_id", ""))
        dgid = _validate_group_id(params.get("dst_group_id", ""))
        if not sgid or not dgid:
            return _err("invalid group_id")
        names = params.get("names")
        if not isinstance(names, list):
            return _err("names must be a list")
        return _ok(_move_images(sgid, dgid, names))

    async def rename_image(self, **kwargs):
        params = await self._collect_params(["group_id", "old_name", "new_name"])
        gid = _validate_group_id(params.get("group_id", ""))
        if not gid:
            return _err("invalid group_id")
        return _rename_image(gid, params.get("old_name", ""), params.get("new_name", ""))

    async def get_settings(self, **kwargs):
        params = await self._collect_params(["group_id"])
        gid = _validate_group_id(params.get("group_id", ""))
        if not gid:
            return _err("invalid group_id")
        return _ok({"group_id": gid, "settings": _load_settings(gid)})

    async def update_settings(self, **kwargs):
        params = await self._collect_params(["group_id", "mode", "coldown", "poke_probability"])
        gid = _validate_group_id(params.get("group_id", ""))
        if not gid:
            return _err("invalid group_id")
        data = _load_settings(gid)
        mode = params.get("mode")
        coldown = params.get("coldown")
        poke_probability = params.get("poke_probability")
        if mode not in (None, ""):
            try:
                mode_int = int(mode)
            except Exception:
                return _err("mode must be int 0/1/2")
            if mode_int not in (0, 1, 2):
                return _err("mode must be 0/1/2")
            data["mode"] = mode_int
        if coldown not in (None, ""):
            try:
                c = int(coldown)
            except Exception:
                return _err("coldown must be int seconds")
            if c < 0 or c > 86400:
                return _err("coldown out of range 0..86400")
            data["coldown"] = c
        if poke_probability not in (None, ""):
            try:
                p = float(poke_probability)
            except Exception:
                return _err("poke_probability must be a float 0..1")
            if p < 0.0 or p > 1.0:
                return _err("poke_probability out of range 0..1")
            data["poke_probability"] = p
        _save_settings(gid, data)
        return _ok({"settings": data})


def quote_image_url(plugin_name: str, group_id: str, name: str) -> str:
    """前端在 fetch 失败时可借助此 URL 直接拿二进制 (依赖 dashboard 同源)."""
    return f"/api/plug/{plugin_name}/images/raw?group_id={quote(group_id)}&name={quote(name)}"
