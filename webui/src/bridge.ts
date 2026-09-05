// Bridge 封装 & 通用类型
import { useEffect, useState } from "react";

export type BridgeContext = {
  pluginName: string;
  displayName: string;
  pageName: string;
  pageTitle: string;
  locale: string;
  isDark: boolean;
  i18n: Record<string, any>;
};

declare global {
  interface Window {
    AstrBotPluginPage?: {
      ready: () => Promise<BridgeContext>;
      getContext: () => BridgeContext | null;
      getLocale: () => string;
      getI18n: () => Record<string, any>;
      t: (key: string, fallback?: string) => string;
      onContext: (handler: (ctx: BridgeContext) => void) => () => void;
      apiGet: (endpoint: string, params?: Record<string, any>) => Promise<any>;
      apiPost: (endpoint: string, body?: Record<string, any>) => Promise<any>;
      upload: (endpoint: string, file: File) => Promise<any>;
      download: (endpoint: string, params?: Record<string, any>, filename?: string) => Promise<any>;
      subscribeSSE: (endpoint: string, handlers: any, params?: any) => Promise<string>;
      unsubscribeSSE: (subscriptionId: string) => Promise<any>;
    };
  }
}

let bridgeReady: Promise<BridgeContext> | null = null;

export function getBridge() {
  if (typeof window === "undefined") return null;
  return window.AstrBotPluginPage || null;
}

export function useBridge() {
  const [ctx, setCtx] = useState<BridgeContext | null>(null);
  useEffect(() => {
    const b = getBridge();
    if (!b) return;
    if (!bridgeReady) bridgeReady = b.ready();
    bridgeReady.then(setCtx);
    const off = b.onContext((c) => setCtx(c));
    return () => off();
  }, []);
  return ctx;
}

export function tFromCtx(ctx: BridgeContext | null, key: string, fallback: string = ""): string {
  if (!ctx) return fallback;
  const bridge = getBridge();
  if (bridge) return bridge.t(key, fallback);
  // fallback: traverse i18n object manually
  const cur = ctx.locale;
  const locales = [cur, "zh-CN", "en-US"].filter(Boolean);
  const get = (obj: any, k: string) =>
    k.split(".").reduce((o, p) => (o && typeof o === "object" ? o[p] : undefined), obj);
  for (const loc of locales) {
    const v = get(ctx.i18n?.[loc], key);
    if (typeof v === "string") return v;
  }
  return fallback;
}

/**
 * Wrap a raw bridge call. The dashboard's `handleBridgeRequest` already
 * unwraps the backend envelope and resolves with `data` only, but it ALSO
 * rejects with `Error(message)` when backend status is "error". So we just
 * return the raw data and let the caller treat it as T. If the backend
 * returns an error, the bridge promise rejects and React Query catches it.
 */
export async function apiGet<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
  const b = getBridge();
  if (!b) throw new Error("Bridge not available - this page must be opened via AstrBot dashboard");
  return (await b.apiGet(endpoint, params)) as T;
}

export async function apiPost<T = any>(endpoint: string, body?: Record<string, any>): Promise<T> {
  const b = getBridge();
  if (!b) throw new Error("Bridge not available");
  return (await b.apiPost(endpoint, body)) as T;
}

export async function uploadFile(endpoint: string, file: File): Promise<any> {
  const b = getBridge();
  if (!b) throw new Error("Bridge not available");
  return b.upload(endpoint, file);
}
