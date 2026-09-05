// App 根组件
import React, { useEffect } from "react";
import { App as AntApp, ConfigProvider, theme as antdTheme } from "antd";
import zhCN from "antd/locale/zh_CN";
import enUS from "antd/locale/en_US";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";
import { StatsCards } from "./StatsCards";
import { ImageGrid } from "./ImageGrid";
import { PreviewModal, SettingsModal, MoveModal, UploadModal } from "./Modals";
import { useBridge } from "./bridge";
import { useUI, persistStorage } from "./store";
import { t } from "./i18n";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <AntApp>
        <Root />
      </AntApp>
    </QueryClientProvider>
  );
}

function Root() {
  const ctx = useBridge();
  const theme = useUI((s) => s.theme);
  const setSelectedGroup = useUI((s) => s.setSelectedGroup);
  const setTheme = useUI((s) => s.setTheme);

  // 还原 localStorage 中保存的偏好
  useEffect(() => {
    const savedGroup = persistStorage.get<string | null>("selectedGroup", null);
    if (savedGroup) setSelectedGroup(savedGroup);
    const savedTheme = persistStorage.get<"light" | "dark" | null>("theme", null);
    if (savedTheme) setTheme(savedTheme);
  }, [setSelectedGroup, setTheme]);

  // 当主题变化同步到 data-theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // 当 bridge 上下文变化时, 把它的 isDark 应用为初始
  useEffect(() => {
    if (ctx && persistStorage.get<"light" | "dark" | null>("theme", null) === null) {
      setTheme(ctx.isDark ? "dark" : "light");
    }
  }, [ctx, setTheme]);

  const locale = ctx?.locale === "en-US" ? enUS : zhCN;
  const isDark = theme === "dark";

  return (
    <ConfigProvider
      locale={locale}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#722ed1",
          colorLink: "#722ed1",
          borderRadius: 8,
        },
      }}
    >
      <div className="qg-app">
        <Sidebar />
        <main className="qg-main">
          <div className="qg-header">
            <h1>
              {t(ctx, "app.title")}
              <span style={{ marginLeft: 12, color: "var(--qg-muted)", fontSize: 13, fontWeight: 400 }}>
                {t(ctx, "app.subtitle")}
              </span>
            </h1>
          </div>
          <StatsCards />
          <ImageGrid />
          <div className="qg-footer">{t(ctx, "footer")}</div>
        </main>
        <PreviewModal />
        <SettingsModal />
        <MoveModal />
        <UploadModal />
      </div>
    </ConfigProvider>
  );
}
