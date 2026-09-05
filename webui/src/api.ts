// API 客户端 - 通过 bridge 调用后端 Web API
import { apiGet, apiPost, uploadFile } from "./bridge";

export type GroupInfo = {
  group_id: string;
  count: number;
  size_bytes: number;
};

export type ImageInfo = {
  name: string;
  size: number;
  mtime: number;
  ctime: number;
};

export type ImageListResp = {
  total: number;
  page: number;
  page_size: number;
  items: ImageInfo[];
};

export type OverviewResp = {
  group_count: number;
  total_images: number;
  total_size_bytes: number;
  has_pillow: boolean;
};

export type GroupSettings = {
  mode: number;
  coldown: number;
  poke_probability?: number;
  [k: string]: any;
};

export const API = {
  groups: () => apiGet<{ groups: GroupInfo[] }>("groups"),
  overview: () => apiGet<OverviewResp>("overview"),
  images: (group_id: string, page = 1, page_size = 24, query = "") =>
    apiGet<ImageListResp>("images", { group_id, page, page_size, query }),
  rawImage: (group_id: string, name: string) =>
    apiGet<{ __binary__: true; mime: string; filename: string; b64: string }>("images/raw", { group_id, name }),
  thumb: (group_id: string, name: string, size = 320) =>
    apiGet<{ __binary__: true; mime: string; filename: string; b64: string }>("images/thumb", { group_id, name, size }),
  getSettings: (group_id: string) =>
    apiGet<{ group_id: string; settings: GroupSettings }>("settings", { group_id }),
  updateSettings: (group_id: string, payload: Partial<GroupSettings>) =>
    apiPost<{ settings: GroupSettings }>("settings", { group_id, ...payload }),
  deleteImages: (group_id: string, names: string[]) =>
    apiPost<{ deleted: string[]; missing: string[] }>("images/delete", { group_id, names }),
  moveImages: (src_group_id: string, dst_group_id: string, names: string[]) =>
    apiPost<{ moved: string[]; failed: any[] }>("images/move", { src_group_id, dst_group_id, names }),
  renameImage: (group_id: string, old_name: string, new_name: string) =>
    apiPost<{ new_name: string }>("images/rename", { group_id, old_name, new_name }),
  upload: async (group_id: string, file: File) => {
    // 通过 bridge.upload -> dashboard 转成 multipart/form-data 'file' 字段
    return uploadFile("images/upload", file);
  },
};

// 缩略图缓存
const thumbCache = new Map<string, string>();
const MAX_CACHE = 240;

export function getThumbDataUrl(group_id: string, name: string): string | null {
  return thumbCache.get(`${group_id}/${name}`) || null;
}

export async function loadThumb(group_id: string, name: string, size = 320): Promise<string | null> {
  const key = `${group_id}/${name}@${size}`;
  if (thumbCache.has(key)) return thumbCache.get(key)!;
  try {
    const data = await API.thumb(group_id, name, size);
    if (!data || !data.b64 || !data.mime) return null;
    const url = `data:${data.mime};base64,${data.b64}`;
    if (thumbCache.size >= MAX_CACHE) {
      const firstKey = thumbCache.keys().next().value;
      if (firstKey) thumbCache.delete(firstKey);
    }
    thumbCache.set(key, url);
    return url;
  } catch (e) {
    return null;
  }
}

export function clearThumbCache() {
  thumbCache.clear();
}
