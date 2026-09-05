// 全局 UI 状态 (zustand) - 选中的群, 选中图片, 主题等
import { create } from "zustand";
import { persistStorage } from "./persist";

export type Theme = "light" | "dark";

type UIState = {
  selectedGroup: string | null;
  selectedImages: Set<string>;
  theme: Theme;
  pageSize: number;
  search: string;
  previewImage: { group: string; name: string } | null;
  showSettings: boolean;
  showMove: boolean;
  showUpload: boolean;

  setSelectedGroup: (g: string | null) => void;
  toggleImage: (name: string) => void;
  selectAll: (names: string[]) => void;
  clearSelection: () => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setPageSize: (n: number) => void;
  setSearch: (s: string) => void;
  setPreview: (p: { group: string; name: string } | null) => void;
  setShowSettings: (b: boolean) => void;
  setShowMove: (b: boolean) => void;
  setShowUpload: (b: boolean) => void;
};

export const useUI = create<UIState>((set, get) => ({
  selectedGroup: null,
  selectedImages: new Set(),
  theme: (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark") ? "dark" : "light",
  pageSize: 24,
  search: "",
  previewImage: null,
  showSettings: false,
  showMove: false,
  showUpload: false,

  setSelectedGroup: (g) => {
    set({ selectedGroup: g, selectedImages: new Set() });
    persistStorage.set("selectedGroup", g);
  },
  toggleImage: (name) => {
    const next = new Set(get().selectedImages);
    if (next.has(name)) next.delete(name); else next.add(name);
    set({ selectedImages: next });
  },
  selectAll: (names) => set({ selectedImages: new Set(names) }),
  clearSelection: () => set({ selectedImages: new Set() }),
  setTheme: (t) => {
    set({ theme: t });
    if (typeof document !== "undefined") document.documentElement.setAttribute("data-theme", t);
    persistStorage.set("theme", t);
  },
  toggleTheme: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
  setPageSize: (n) => { set({ pageSize: n }); persistStorage.set("pageSize", n); },
  setSearch: (s) => set({ search: s }),
  setPreview: (p) => set({ previewImage: p }),
  setShowSettings: (b) => set({ showSettings: b }),
  setShowMove: (b) => set({ showMove: b }),
  setShowUpload: (b) => set({ showUpload: b }),
}));

// 把选中群和主题写回 localStorage (bridge 上下文之外持久化用户偏好)
export const persistStorage = {
  get<T = any>(k: string, d: T = null as any): T {
    try { const v = localStorage.getItem("qg:" + k); return v ? JSON.parse(v) : d; } catch { return d; }
  },
  set(k: string, v: any) { try { localStorage.setItem("qg:" + k, JSON.stringify(v)); } catch {} },
};
