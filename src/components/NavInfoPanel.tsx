"use client";
import { Package, MapPin, ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { MastInfo, NavInfo } from "@/types";

interface Props {
  navInfo: NavInfo | null;
  mastInfo: MastInfo | null;
}

const LOAD_STATE_CONFIG = {
  unknown: { label: "確認中",   color: "#94a3b8", bg: "bg-gray-800" },
  empty:   { label: "空荷",     color: "#10b981", bg: "bg-emerald-950/50" },
  loaded:  { label: "積載中",   color: "#ef4444", bg: "bg-red-950/50" },
} as const;

const MAST_DIR_CONFIG = {
  up:    { label: "上昇中", icon: <ArrowUp size={12} />,    color: "#10b981" },
  down:  { label: "下降中", icon: <ArrowDown size={12} />,  color: "#f59e0b" },
  still: { label: "静止",   icon: <Minus size={12} />,      color: "#4b5563" },
} as const;

export function NavInfoPanel({ navInfo, mastInfo }: Props) {
  const loadCfg = LOAD_STATE_CONFIG[navInfo?.load_state ?? "unknown"];
  const mastCfg = MAST_DIR_CONFIG[mastInfo?.direction ?? "still"];
  const isNavigating = navInfo?.nav_phase === "navigating";
  const phase = isNavigating ? "ナビ中" : "学習中";

  return (
    <div className="bg-surface rounded-xl border border-border-default p-4 space-y-3">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
        積載ナビ
      </p>

      {/* 積載状態 + フェーズ */}
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${loadCfg.bg}`}
          style={{ color: loadCfg.color }}>
          <Package size={11} />
          {loadCfg.label}
        </span>
        <span className={`px-2 py-1 rounded-md text-[10px] font-medium ${
          isNavigating ? "bg-indigo-950/50 text-indigo-400" : "bg-amber-950/40 text-amber-500"
        }`}>
          {phase}
        </span>
      </div>

      {/* マスト動作 */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-600 w-16 shrink-0">マスト</span>
        <span className="flex items-center gap-1" style={{ color: mastCfg.color }}>
          {mastCfg.icon}
          {mastCfg.label}
          {mastInfo?.moving && (
            <span className="font-mono text-[10px] text-gray-500 ml-1">
              {mastInfo.magnitude.toFixed(1)}px
            </span>
          )}
        </span>
      </div>

      {/* ゾーン登録状況 */}
      <div className="space-y-1.5">
        <ZoneRow
          label="ピック場"
          registered={navInfo?.pickup_zone != null}
          active={isNavigating && navInfo?.load_state === "empty"}
        />
        <ZoneRow
          label="置き場"
          registered={navInfo?.dropoff_zone != null}
          active={isNavigating && navInfo?.load_state === "loaded"}
        />
      </div>

      {/* ターゲット表示 */}
      {isNavigating && navInfo?.target_zone && (
        <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-950/30 rounded-lg px-3 py-2">
          <MapPin size={11} />
          <span>
            目標: ({Math.round(navInfo.target_zone.cx)}%,{" "}
            {Math.round(navInfo.target_zone.cy)}%)
          </span>
        </div>
      )}
    </div>
  );
}

function ZoneRow({
  label,
  registered,
  active,
}: {
  label: string;
  registered: boolean;
  active: boolean;
}) {
  return (
    <div className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
      active ? "bg-indigo-950/40" : ""
    }`}>
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${
        registered
          ? active ? "text-indigo-400" : "text-emerald-500"
          : "text-gray-700"
      }`}>
        {registered ? (active ? "▶ 誘導中" : "✓ 登録済") : "未登録"}
      </span>
    </div>
  );
}
