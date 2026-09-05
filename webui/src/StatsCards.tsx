// 顶部统计卡片
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { API, type OverviewResp } from "./api";
import { useBridge } from "./bridge";
import { t, formatBytes } from "./i18n";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="qg-stat">
      <div className="qg-stat-value">{value}</div>
      <div className="qg-stat-label">{label}</div>
    </div>
  );
}

export function StatsCards() {
  const ctx = useBridge();
  const { data, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const data = await API.overview();
      return data as OverviewResp;
    },
    refetchOnWindowFocus: false,
  });
  return (
    <div className="qg-stats">
      <Stat
        label={t(ctx, "stats.groups")}
        value={data ? String(data.group_count) : (isLoading ? "…" : "0")}
      />
      <Stat
        label={t(ctx, "stats.images")}
        value={data ? String(data.total_images) : (isLoading ? "…" : "0")}
      />
      <Stat
        label={t(ctx, "stats.size")}
        value={data ? formatBytes(data.total_size_bytes, ctx?.locale) : "0 B"}
      />
      <Stat
        label={t(ctx, "stats.pillow")}
        value={data ? (data.has_pillow ? t(ctx, "stats.pillowOn") : t(ctx, "stats.pillowOff")) : "…"}
      />
    </div>
  );
}
