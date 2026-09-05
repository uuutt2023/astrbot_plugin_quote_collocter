// 侧边栏: 群列表 + 概览入口
import React from "react";
import { Card, List, Spin, Button, Tooltip, Badge } from "antd";
import { ReloadOutlined, TeamOutlined, RightOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { API, type GroupInfo } from "./api";
import { useUI } from "./store";
import { t, formatBytes } from "./i18n";
import { useBridge } from "./bridge";

export function Sidebar() {
  const ctx = useBridge();
  const selectedGroup = useUI((s) => s.selectedGroup);
  const setSelectedGroup = useUI((s) => s.setSelectedGroup);
  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const env = await API.groups();
      if (env.status !== "ok") throw new Error(env.message || "load failed");
      return env.data.groups as GroupInfo[];
    },
    refetchOnWindowFocus: false,
  });

  return (
    <aside className="qg-sidebar">
      <div className="qg-sidebar-header">
        <TeamOutlined style={{ color: "var(--qg-primary)", fontSize: 20 }} />
        <span className="qg-sidebar-title">{t(ctx, "app.title")}</span>
        <Tooltip title={t(ctx, "sidebar.refresh")}>
          <Button
            size="small"
            type="text"
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => refetch()}
            style={{ marginLeft: "auto" }}
          />
        </Tooltip>
      </div>
      <div className="qg-sidebar-body">
        {error ? (
          <div style={{ padding: 16, color: "var(--qg-muted)" }}>{t(ctx, "error.loadGroups")}</div>
        ) : isLoading ? (
          <div className="qg-spin-wrap"><Spin /></div>
        ) : !data || data.length === 0 ? (
          <div style={{ padding: 24, color: "var(--qg-muted)", textAlign: "center" }}>
            {t(ctx, "sidebar.noGroups")}
          </div>
        ) : (
          <List
            dataSource={data}
            renderItem={(g) => {
              const active = selectedGroup === g.group_id;
              return (
                <div
                  className={`qg-group-item ${active ? "active" : ""}`}
                  onClick={() => setSelectedGroup(g.group_id)}
                  title={g.group_id}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                    <Badge color={active ? "var(--qg-primary)" : "var(--qg-muted)"} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {g.group_id}
                    </span>
                    {active && <RightOutlined style={{ fontSize: 10 }} />}
                  </div>
                  <span className="qg-group-meta">
                    {g.count} · {formatBytes(g.size_bytes, ctx?.locale)}
                  </span>
                </div>
              );
            }}
          />
        )}
      </div>
    </aside>
  );
}
