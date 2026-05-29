"use client";
import { useMemo } from "react";
import { Navigation } from "lucide-react";
import { useMovementLog, type MovementPoint } from "@/hooks/useMovementLog";
import type { GuidanceResult, NavDirection, RiskLevel } from "@/types";

const MAP_SIZE = 200;

const RISK_COLOR: Record<RiskLevel, string> = {
  safe:     "#10b981",
  warning:  "#f59e0b",
  critical: "#ef4444",
  info:     "#6366f1",
};

const DIR_LABELS: Partial<Record<NavDirection, string>> = {
  forward:       "前進",
  reverse:       "後退",
  left:          "左",
  right:         "右",
  forward_left:  "左前",
  forward_right: "右前",
  reverse_left:  "左後",
  reverse_right: "右後",
  stop:          "停止",
};

/** リスク別のドット群をまとめてレンダリング */
function RiskDots({ points }: { points: MovementPoint[] }) {
  return (
    <>
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={2.5}
          fill={RISK_COLOR[p.risk]}
          opacity={0.7}
        />
      ))}
    </>
  );
}

/** 軌跡ポリライン */
function TrajectoryLine({ points }: { points: MovementPoint[] }) {
  const d = useMemo(
    () => points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" "),
    [points],
  );
  if (points.length < 2) return null;
  return (
    <path
      d={d}
      stroke="#6366f1"
      strokeWidth={1.5}
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
      opacity={0.5}
    />
  );
}

/** 現在地パルスアニメーション */
function CurrentPosition({ point }: { point: MovementPoint }) {
  return (
    <g>
      <circle cx={point.x} cy={point.y} r={6} fill={RISK_COLOR[point.risk]} opacity={0.2}>
        <animate attributeName="r" values="6;12;6" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.2;0;0.2" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={point.x} cy={point.y} r={4} fill={RISK_COLOR[point.risk]} />
      <circle cx={point.x} cy={point.y} r={2} fill="white" />
    </g>
  );
}

/** 倉庫グリッド背景 */
function WarehouseGrid() {
  const lines: React.ReactNode[] = [];
  const step = 25;
  for (let i = step; i < MAP_SIZE; i += step) {
    lines.push(
      <line key={`h${i}`} x1={0} y1={i} x2={MAP_SIZE} y2={i} stroke="#1f2937" strokeWidth={0.5} />,
      <line key={`v${i}`} x1={i} y1={0} x2={i} y2={MAP_SIZE} stroke="#1f2937" strokeWidth={0.5} />,
    );
  }
  // 棚エリアを点線で示す（デコレーション）
  return (
    <g>
      {lines}
      <rect x={10} y={10} width={40} height={18} rx={2} fill="#1f2937" stroke="#374151" strokeWidth={0.5} />
      <rect x={10} y={172} width={40} height={18} rx={2} fill="#1f2937" stroke="#374151" strokeWidth={0.5} />
      <rect x={150} y={10} width={40} height={18} rx={2} fill="#1f2937" stroke="#374151" strokeWidth={0.5} />
      <rect x={150} y={172} width={40} height={18} rx={2} fill="#1f2937" stroke="#374151" strokeWidth={0.5} />
      <text x={30} y={21} fontSize={4} fill="#4b5563" textAnchor="middle">棚A</text>
      <text x={30} y={183} fontSize={4} fill="#4b5563" textAnchor="middle">棚B</text>
      <text x={170} y={21} fontSize={4} fill="#4b5563" textAnchor="middle">棚C</text>
      <text x={170} y={183} fontSize={4} fill="#4b5563" textAnchor="middle">棚D</text>
    </g>
  );
}

interface Props {
  guidance: GuidanceResult | null;
  risk: RiskLevel;
  frameNumber: number;
  streaming: boolean;
}

export function MovementMap({ guidance, risk, frameNumber, streaming }: Props) {
  const log = useMovementLog(guidance, risk, frameNumber);
  const current = log[log.length - 1];
  const dir = guidance?.nav_direction ?? "stop";

  // 統計
  const dangerCount = log.filter(p => p.risk === "critical").length;
  const warnCount   = log.filter(p => p.risk === "warning").length;

  return (
    <div className="bg-surface rounded-xl border border-border-default p-4 flex flex-col gap-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Navigation size={10} />
          走行軌跡マップ
        </p>
        <span className="text-[10px] text-gray-600">{log.length}pt</span>
      </div>

      {/* SVG マップ */}
      <div className="rounded-lg overflow-hidden border border-gray-800 bg-[#0d1117]">
        <svg
          viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
          className="w-full aspect-square"
          xmlns="http://www.w3.org/2000/svg"
        >
          <WarehouseGrid />
          <TrajectoryLine points={log} />
          <RiskDots points={log.filter(p => p.risk !== "safe")} />
          {streaming && current && <CurrentPosition point={current} />}
        </svg>
      </div>

      {/* 方向インジケーター */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">現在の動き</span>
          <span className="text-xs font-semibold text-gray-200">
            {DIR_LABELS[dir] ?? dir}
          </span>
        </div>
        {guidance?.nav_phase && (
          <span className="text-[10px] bg-indigo-950/50 border border-indigo-800 text-indigo-300 px-2 py-0.5 rounded-full">
            {guidance.nav_phase}
          </span>
        )}
      </div>

      {/* 統計バー */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "走行", value: log.length, color: "#6366f1" },
          { label: "注意", value: warnCount,  color: "#f59e0b" },
          { label: "危険", value: dangerCount, color: "#ef4444" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900/50 rounded-lg py-1.5 px-2 border border-gray-800">
            <p className="text-[10px] text-gray-600">{label}</p>
            <p className="text-sm font-mono font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-3 text-[10px] text-gray-600">
        {(["safe", "warning", "critical"] as RiskLevel[]).map(r => (
          <span key={r} className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: RISK_COLOR[r] }}
            />
            {r === "safe" ? "安全" : r === "warning" ? "注意" : "危険"}
          </span>
        ))}
      </div>
    </div>
  );
}
