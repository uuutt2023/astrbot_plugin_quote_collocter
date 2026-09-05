// 图片网格 + 工具栏 + 分页
import React, { useEffect, useMemo, useState } from "react";
import {
  Button, Input, Pagination, Spin, Empty, Checkbox, Space, Tooltip, Dropdown, message, Modal,
} from "antd";
import {
  ReloadOutlined, DeleteOutlined, SwapOutlined, SettingOutlined, CloudUploadOutlined,
  CheckSquareOutlined, BorderOutlined, BulbOutlined, BulbFilled, GlobalOutlined, AppstoreOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API, loadThumb, type ImageInfo } from "./api";
import { useUI } from "./store";
import { useBridge } from "./bridge";
import { t, formatBytes } from "./i18n";
import dayjs from "dayjs";

export function ImageGrid() {
  const ctx = useBridge();
  const selectedGroup = useUI((s) => s.selectedGroup);
  const setSelectedGroup = useUI((s) => s.setSelectedGroup);
  const selectedImages = useUI((s) => s.selectedImages);
  const toggleImage = useUI((s) => s.toggleImage);
  const selectAll = useUI((s) => s.selectAll);
  const clearSelection = useUI((s) => s.clearSelection);
  const pageSize = useUI((s) => s.pageSize);
  const setPageSize = useUI((s) => s.setPageSize);
  const search = useUI((s) => s.search);
  const setSearch = useUI((s) => s.setSearch);
  const setPreview = useUI((s) => s.setPreview);
  const setShowSettings = useUI((s) => s.setShowSettings);
  const setShowMove = useUI((s) => s.setShowMove);
  const setShowUpload = useUI((s) => s.setShowUpload);
  const theme = useUI((s) => s.theme);
  const toggleTheme = useUI((s) => s.toggleTheme);
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const listQuery = useQuery({
    queryKey: ["images", selectedGroup, page, pageSize, search],
    queryFn: async () => {
      if (!selectedGroup) return null;
      return await API.images(selectedGroup, page, pageSize, search);
    },
    enabled: !!selectedGroup,
  });

  useEffect(() => { setPage(1); }, [selectedGroup, search]);

  // 加载可见缩略图
  useEffect(() => {
    if (!selectedGroup || !listQuery.data) return;
    const items = listQuery.data.items;
    let cancelled = false;
    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        items.map(async (it) => {
          if (thumbs[`${selectedGroup}/${it.name}`]) return;
          const url = await loadThumb(selectedGroup, it.name);
          if (url) updates[it.name] = url;
        }),
      );
      if (!cancelled && Object.keys(updates).length) {
        setThumbs((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQuery.data, selectedGroup]);

  const items = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;
  const allOnPage = items.length > 0 && items.every((it) => selectedImages.has(it.name));

  async function handleDelete() {
    if (!selectedGroup) return;
    const names = Array.from(selectedImages);
    if (!names.length) return;
    Modal.confirm({
      title: t(ctx, "confirm.delete", "", { n: names.length }),
      okText: t(ctx, "toolbar.delete"),
      okType: "danger",
      cancelText: t(ctx, "preview.close"),
      onOk: async () => {
        try {
          const res = await API.deleteImages(selectedGroup, names);
          message.success(t(ctx, "settings.saved") + ` (${res.deleted.length}/${names.length})`);
          clearSelection();
          qc.invalidateQueries({ queryKey: ["images", selectedGroup] });
          qc.invalidateQueries({ queryKey: ["groups"] });
          qc.invalidateQueries({ queryKey: ["overview"] });
        } catch (e: any) {
          message.error(e?.message || t(ctx, "error.delete"));
        }
      },
    });
  }

  function renderToolbar() {
    return (
      <div className="qg-toolbar">
        <Input.Search
          placeholder={t(ctx, "toolbar.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 220 }}
        />
        <Button icon={<CloudUploadOutlined />} type="primary" onClick={() => setShowUpload(true)}>
          {t(ctx, "toolbar.upload")}
        </Button>
        <Button
          icon={<DeleteOutlined />}
          danger
          disabled={selectedImages.size === 0}
          onClick={handleDelete}
        >
          {t(ctx, "toolbar.delete")}
        </Button>
        <Button
          icon={<SwapOutlined />}
          disabled={selectedImages.size === 0}
          onClick={() => setShowMove(true)}
        >
          {t(ctx, "toolbar.move")}
        </Button>
        <Button
          icon={allOnPage ? <CheckSquareOutlined /> : <BorderOutlined />}
          disabled={items.length === 0}
          onClick={() => {
            if (allOnPage) clearSelection();
            else selectAll(items.map((i) => i.name));
          }}
        >
          {allOnPage ? t(ctx, "toolbar.deselect") : t(ctx, "toolbar.selectAll")}
        </Button>
        <span style={{ color: "var(--qg-muted)", fontSize: 12 }}>
          {t(ctx, "toolbar.selected", "", { n: selectedImages.size })}
        </span>
        <span style={{ flex: 1 }} />
        <Tooltip title={t(ctx, "toolbar.settings")}>
          <Button icon={<SettingOutlined />} onClick={() => setShowSettings(true)} />
        </Tooltip>
        <Tooltip title={t(ctx, "toolbar.theme")}>
          <Button icon={theme === "dark" ? <BulbFilled /> : <BulbOutlined />} onClick={toggleTheme}>
            {theme === "dark" ? t(ctx, "toolbar.themeDark") : t(ctx, "toolbar.themeLight")}
          </Button>
        </Tooltip>
        <Tooltip title={t(ctx, "toolbar.refresh")}>
          <Button icon={<ReloadOutlined />} onClick={() => listQuery.refetch()} />
        </Tooltip>
      </div>
    );
  }

  if (!selectedGroup) {
    return (
      <>
        {renderToolbar()}
        <div className="qg-empty">
          <AppstoreOutlined style={{ fontSize: 32, marginBottom: 8 }} />
          <div>{t(ctx, "empty.noGroup")}</div>
        </div>
      </>
    );
  }

  return (
    <>
      {renderToolbar()}
      {listQuery.isLoading ? (
        <div className="qg-spin-wrap"><Spin size="large" /></div>
      ) : listQuery.isError ? (
        <div className="qg-empty">{t(ctx, "error.loadImages")}</div>
      ) : items.length === 0 ? (
        <div className="qg-empty">{t(ctx, "empty.noData")}</div>
      ) : (
        <>
          <div className="qg-grid">
            {items.map((img) => {
              const selected = selectedImages.has(img.name);
              const dataUrl = thumbs[img.name];
              return (
                <div
                  key={img.name}
                  className={`qg-card ${selected ? "selected" : ""}`}
                  onClick={() => setPreview({ group: selectedGroup, name: img.name })}
                >
                  <div className="qg-card-checkbox" onClick={(e) => { e.stopPropagation(); toggleImage(img.name); }}>
                    <Checkbox checked={selected} />
                  </div>
                  <div className="qg-card-name" title={img.name}>{img.name}</div>
                  {dataUrl ? (
                    <img src={dataUrl} alt={img.name} loading="lazy" />
                  ) : (
                    <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Spin />
                    </div>
                  )}
                  <div className="qg-card-meta">
                    <span>{formatBytes(img.size, ctx?.locale)}</span>
                    <span>{dayjs(img.mtime * 1000).format("MM-DD HH:mm")}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
            <Pagination
              current={page}
              total={total}
              pageSize={pageSize}
              onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
              showSizeChanger
              pageSizeOptions={["12", "24", "48", "96", "200"]}
              showTotal={(tt) => `${tt} items`}
            />
          </div>
        </>
      )}
    </>
  );
}
