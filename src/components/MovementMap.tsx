"use client";
import { useMemo } from "react";
import { Navigation } from "lucide-react";
import { useMovementLog, MAP_SIZE, type MovementPoint } from "@/hooks/useMovementLog";
import type { GuidanceResult, NavDirection, NavPhase, RiskLevel } from "@/types";

const RISK_COLOR: Record<RiskLevel, string> = {
  safe:     "#10b981",
  warning:  "#f59e0b",
  critical: "#ef4444",
  info:     "#6366f1",
};

const PHASE_LABEL: Partial<Record<NavPhase, string>> = {
  approach: "接近",
  pickup:   "荷取",
  carry:    "搬送",
  deliver:  "荷降",
  return:   "帰還",
  idle:     "待機",
};

const PHASE_COLOR: Partial<Record<NavPhase, string>> = {
  approach: "#6366f1",
  pickup:   "#10b981",
  carry:    "#3b82f6",
  deliver:  "#f59e0b",
  return:   "#8b5cf6",
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

/** リスクカラーで色分けされたセグメント群 */
function TrajectorySegments({ points }: { points: MovementPoint[] }) {
  if (points.length < 2) return null;
  return (
    <>
      {points.slice(1).map((p, i) => {
        const prev = points[i];
        return (
          <line
            key={i}
            x1={prev.x} y1={prev.y}
            x2={p.x}    y2={p.y}
            stroke={RISK_COLOR[p.risk]}
            strokeWidth={1.8}
            strokeLinecap="round"
            opacity={0.75}
          />
        );
      })}
    </>
  );
}

/** フェーズ変化マーカー */
function PhaseMarkers({ points }: { points: MovementPoint[] }) {
  const markers = useMemo(
    () => points.filter(p => p.isPhaseChange && p.navPhase),
    [points],
  );
  return (
    <>
      {markers.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill={PHASE_COLOR[p.navPhase!] ?? "#94a3b8"} opacity={0.9} />
          <text
            x={p.x + 5} y={p.y + 3}
            fontSize={4.5}
            fill={PHASE_COLOR[p.navPhase!] ?? "#94a3b8"}
            fontFamily="system-ui"
          >
            {PHASE_LABEL[p.navPhase!] ?? p.navPhase}
          </text>
        </g>
      ))}
    </>
  );
}

/** 現在地パルスアニメーション */
function CurrentPosition({ point }: { point: MovementPoint }) {
  const color = RISK_COLOR[point.risk];
  return (
    <g>
      <circle cx={point.x} cy={point.y} r={7} fill={color} opacity={0.15}>
        <animate attributeName="r"       values="7;14;7"       dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.15;0;0.15"  dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={point.x} cy={point.y} r={4} fill={color} />
      <circle cx={point.x} cy={point.y} r={2} fill="white"  />
    </g>
  );
}

/** 入口マーカー */
function EntryMarker() {
  const cx = MAP_SIZE / 2;
  const cy = MAP_SIZE - 16;
  return (
    <g>
      <polygon
        points={`${cx},${cy - 6} ${cx - 4},${cy + 2} ${cx + 4},${cy + 2}`}
        fill="#6366f1"
        opacity={0.6}
      />
      <text x={cx + 6} y={cy + 2} fontSize={4} fill="#6366f1" fontFamily="system-ui">入口</text>
    </g>
  );
}

/** 倉庫グリッド背景 */
function WarehouseGrid() {
  const gridStep = 25;
  const lines: React.ReactNode[] = [];
  for (let i = gridStep; i < MAP_SIZE; i += gridStep) {
    lines.push(
      <line key={`h${i}`} x1={0} y1={i} x2={MAP_SIZE} y2={i} stroke="#1f2937" strokeWidth={0.4} />,
      <line key={`v${i}`} x1={i} y1={0} x2={i} y2={MAP_SIZE} stroke="#1f2937" strokeWidth={0.4} />,
    );
  }
  return (
    <g>
      {lines}
      {/* 棚エリア */}
      {[
        { x: 8,   y: 8,   label: "棚A" },
        { x: 8,   y: 168, label: "棚B" },
        { x: 152, y: 8,   label: "棚C" },
        { x: 152, y: 168, label: "棚D" },
      ].map(({ x, y, label }) => (
        <g key={label}>
          <rect x={x} y={y} width={40} height={20} rx={2} fill="#161d29" stroke="#2d3748" strokeWidth={0.6} />
          <text x={x + 20} y={y + 12} fontSize={5} fill="#4b5563" textAnchor="middle" fontFamily="system-ui">{label}</text>
        </g>
      ))}
      {/* 中央通路ライン */}
      <line x1={MAP_SIZE / 2} y1={0} x2={MAP_SIZE / 2} y2={MAP_SIZE} stroke="#1a2535" strokeWidth={1} strokeDasharray="3,4" />
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
  const log     = useMovementLog(guidance, risk, frameNumber);
  const current = log[log.length - 1];
  const dir     = guidance?.nav_direction ?? "stop";

  const dangerCount = useMemo(() => log.filter(p => p.risk === "critical").length, [log]);
  const warnCount   = useMemo(() => log.filter(p => p.risk === "warning").length,  [log]);
  const stopCount   = 0; // 停止中は点を追加しないため集計外

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
      <div className="rounded-lg overflow-hidden border border-gray-800 bg-[#0a0f1a]">
        <svg
          viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
          className="w-full aspect-square"
          xmlns="http://www.w3.org/2000/svg"
        >
          <WarehouseGrid />
          <EntryMarker />
          <TrajectorySegments points={log} />
          <PhaseMarkers points={log} />
          {streaming && current && <CurrentPosition point={current} />}
        </svg>
      </div>

      {/* 方向 & フェーズ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">動き</span>
          <span className="text-xs font-semibold text-gray-200">{DIR_LABELS[dir] ?? dir}</span>
        </div>
        {guidance?.nav_phase && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
            style={{
              color:            PHASE_COLOR[guidance.nav_phase] ?? "#94a3b8",
              borderColor:      PHASE_COLOR[guidance.nav_phase] ?? "#374151",
              backgroundColor: `${PHASE_COLOR[guidance.nav_phase] ?? "#374151"}20`,
            }}
          >
            {PHASE_LABEL[guidance.nav_phase] ?? guidance.nav_phase}
          </span>
        )}
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "記録",   value: log.length,  color: "#6366f1" },
          { label: "注意",   value: warnCount,   color: "#f59e0b" },
          { label: "危険",   value: dangerCount, color: "#ef4444" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900/50 rounded-lg py-1.5 px-2 border border-gray-800">
            <p className="text-[10px] text-gray-600">{label}</p>
            <p className="text-sm font-mono font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-600">
        {(["safe", "warning", "critical"] as RiskLevel[]).map(r => (
          <span key={r} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: RISK_COLOR[r] }} />
            {r === "safe" ? "安全" : r === "warning" ? "注意" : "危険"}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" />
          フェーズ変化
        </span>
      </div>
    </div>
  );
}
