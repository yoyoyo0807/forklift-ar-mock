"use client";
import { useMemo, useEffect, useState } from "react";
import { Navigation } from "lucide-react";
import { MAP_SIZE } from "@/hooks/useMovementLog";
import type { FlowPos, FlowSignal } from "@/hooks/useVideoStream";
import type { GuidanceResult, NavPhase, RiskLevel } from "@/types";

const RISK_COLOR: Record<RiskLevel, string> = {
  safe:     "#10b981",
  warning:  "#f59e0b",
  critical: "#ef4444",
  info:     "#6366f1",
};

const PHASE_LABEL: Partial<Record<NavPhase, string>> = {
  approach: "接近", pickup: "荷取", carry: "搬送",
  deliver:  "荷降", return: "帰還", idle:   "待機",
};
const PHASE_COLOR: Partial<Record<NavPhase, string>> = {
  approach: "#6366f1", pickup: "#10b981", carry: "#3b82f6",
  deliver:  "#f59e0b", return: "#8b5cf6", idle:  "#6b7280",
};

// バックエンド REST URL
const API_BASE: string = (() => {
  if (typeof window === "undefined") return "http://localhost:8000";
  const ws = process.env.NEXT_PUBLIC_WS_URL;
  if (ws) return ws.replace(/^ws/, "http").replace(/\/ws\/.*/, "");
  return window.location.hostname === "localhost" ? "http://localhost:8000" : "";
})();

interface FlowPoint { frame: number; x: number; y: number; }
type TrajectorySource = "ai" | "lk" | "none";

function usePreloadedTrajectory(): { pts: FlowPoint[]; source: TrajectorySource } {
  const [pts, setPts] = useState<FlowPoint[]>([]);
  const [source, setSource] = useState<TrajectorySource>("none");

  useEffect(() => {
    if (!API_BASE) return;

    // AI軌跡を優先取得。未生成なら LK オプティカルフローにフォールバック
    const loadTrajectory = async () => {
      try {
        const aiRes = await fetch(`${API_BASE}/debug/ai_trajectory`);
        const aiData: { ready?: boolean; samples?: FlowPoint[] } = await aiRes.json();
        if (aiData.ready && Array.isArray(aiData.samples) && aiData.samples.length > 0) {
          setPts(aiData.samples);
          setSource("ai");
          return;
        }
      } catch {
        // AI軌跡取得失敗 → LKにフォールバック
      }
      try {
        const lkRes = await fetch(`${API_BASE}/debug/flow`);
        const lkData: { samples?: FlowPoint[] } = await lkRes.json();
        if (Array.isArray(lkData.samples) && lkData.samples.length > 0) {
          setPts(lkData.samples);
          setSource("lk");
        }
      } catch {
        // 両方失敗
      }
    };

    loadTrajectory().catch(() => {});
  }, []);

  return { pts, source };
}

/**
 * 距離ベースで矢印位置をサンプリング。
 * minDist px 以上離れた箇所にのみ矢印を置く → 密集ゾーンでの重複を防ぐ。
 */
function sampleArrows(pts: FlowPoint[], minDist: number): { x: number; y: number; angle: number }[] {
  const result: { x: number; y: number; angle: number }[] = [];
  let lastX = pts[0]?.x ?? 0;
  let lastY = pts[0]?.y ?? 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const dist = Math.hypot(p.x - lastX, p.y - lastY);
    if (dist < minDist) continue;
    const next  = pts[i + 1];
    const angle = (Math.atan2(next.y - p.y, next.x - p.x) * 180) / Math.PI;
    result.push({ x: p.x, y: p.y, angle });
    lastX = p.x;
    lastY = p.y;
  }
  return result;
}

function WarehouseGrid() {
  const lines: React.ReactNode[] = [];
  for (let i = 25; i < MAP_SIZE; i += 25) {
    lines.push(
      <line key={`h${i}`} x1={0} y1={i} x2={MAP_SIZE} y2={i} stroke="#1f2937" strokeWidth={0.4} />,
      <line key={`v${i}`} x1={i} y1={0} x2={i} y2={MAP_SIZE} stroke="#1f2937" strokeWidth={0.4} />,
    );
  }
  return (
    <g>
      <rect x={87} y={10} width={35} height={55} rx={4}
        fill="#6366f1" fillOpacity={0.10} stroke="#6366f1" strokeOpacity={0.35} strokeWidth={0.8} />
      <text x={104} y={22} fontSize={5.5} fill="#818cf8" fillOpacity={0.9} textAnchor="middle" fontFamily="system-ui" fontWeight="600">TRUCK</text>
      <rect x={80} y={155} width={38} height={38} rx={4}
        fill="#10b981" fillOpacity={0.10} stroke="#10b981" strokeOpacity={0.35} strokeWidth={0.8} />
      <text x={99} y={168} fontSize={5.5} fill="#34d399" fillOpacity={0.9} textAnchor="middle" fontFamily="system-ui" fontWeight="600">STORAGE</text>
      {lines}
    </g>
  );
}

interface Props {
  guidance:    GuidanceResult | null;
  risk:        RiskLevel;
  frameNumber: number;
  streaming:   boolean;
  flowSignal:  FlowSignal | null;
  opticalPos?: FlowPos | null;
}

export function MovementMap({ guidance, risk, frameNumber, streaming, opticalPos }: Props) {
  const navPhase = guidance?.nav_phase;
  const { pts: allPts, source: trajectorySource } = usePreloadedTrajectory();

  // 動画フレーム位置推定（WS frameNumber → 動画フレーム番号）
  const VIDEO_FPS = 58.96, VIDEO_SPEED = 0.8, SEND_FPS = 10, TOTAL_VFRAMES = 9186;
  const vFramesPerSend = VIDEO_FPS * VIDEO_SPEED / SEND_FPS;
  const curVFrame = Math.round((frameNumber * vFramesPerSend) % TOTAL_VFRAMES);

  // 走行済みインデックス
  const traveledIdx = useMemo(
    () => allPts.findIndex(p => p.frame > curVFrame) - 1,
    [allPts, curVFrame],
  );
  const splitIdx = traveledIdx < 1 ? 1 : Math.min(traveledIdx + 1, allPts.length - 1);

  // 走行済み / 未走行 ポイント列
  const traveled = useMemo(() => allPts.slice(0, splitIdx + 1), [allPts, splitIdx]);
  const pending  = useMemo(() => allPts.slice(splitIdx),        [allPts, splitIdx]);

  // 距離ベース矢印（最低 10px 間隔）
  const arrows = useMemo(() => (allPts.length > 2 ? sampleArrows(allPts, 10) : []), [allPts]);

  // 現在位置
  const currentPos = useMemo((): { x: number; y: number } | null => {
    if (opticalPos) return opticalPos;
    if (!allPts.length) return null;
    const idx = allPts.findIndex(p => p.frame >= curVFrame);
    return idx < 0 ? allPts[allPts.length - 1] : allPts[idx];
  }, [opticalPos, allPts, curVFrame]);

  const isLoaded = allPts.length > 0;

  return (
    <div className="bg-surface rounded-xl border border-border-default p-4 flex flex-col gap-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Navigation size={10} />
          走行軌跡マップ
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
            !isLoaded
              ? "bg-gray-900 text-gray-600 border border-gray-800"
              : trajectorySource === "ai"
              ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800"
              : "bg-indigo-950/50 text-indigo-400 border border-indigo-800"
          }`}>
            {!isLoaded ? "読込中" : trajectorySource === "ai" ? "AI軌跡" : "LKFlow"}
          </span>
        </p>
        <span className="text-[10px] text-gray-600">{allPts.length}pt</span>
      </div>

      {/* SVG マップ */}
      <div className="rounded-lg overflow-hidden border border-gray-800 bg-[#0a0f1a]">
        <svg viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`} className="w-full aspect-square"
             xmlns="http://www.w3.org/2000/svg">
          <WarehouseGrid />

          {!isLoaded && (
            <text x={MAP_SIZE / 2} y={MAP_SIZE / 2} fontSize={8}
                  fill="#4b5563" textAnchor="middle" fontFamily="system-ui">
              軌跡データ読み込み中...
            </text>
          )}

          {isLoaded && (
            <>
              {/* ① 未走行（破線） */}
              {pending.length >= 2 && (
                <polyline
                  points={pending.map(p => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke="#6366f1" strokeWidth={2.5}
                  strokeLinecap="round" strokeLinejoin="round"
                  opacity={0.6} strokeDasharray="5 4"
                />
              )}

              {/* ② 走行済み（明るい実線） */}
              {traveled.length >= 2 && (
                <polyline
                  points={traveled.map(p => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke="#c7d2fe" strokeWidth={3}
                  strokeLinecap="round" strokeLinejoin="round"
                  opacity={1}
                />
              )}

              {/* ③ 進行方向矢印（距離ベース間引き） */}
              {arrows.map((a, i) => (
                <path
                  key={i}
                  d="M-4,-2.5 L4,0 L-4,2.5 Z"
                  transform={`translate(${a.x},${a.y}) rotate(${a.angle})`}
                  fill="#a5b4fc"
                  opacity={0.7}
                />
              ))}

              {/* ④ スタートマーカー（オレンジ■） */}
              {allPts[0] && (
                <rect
                  x={allPts[0].x - 3} y={allPts[0].y - 3}
                  width={6} height={6} rx={1}
                  fill="#f59e0b" opacity={0.9}
                />
              )}

              {/* ⑤ 現在位置（リスク色パルス） */}
              {streaming && currentPos && (() => {
                const color = RISK_COLOR[risk];
                return (
                  <g>
                    <circle cx={currentPos.x} cy={currentPos.y} r={7} fill={color} opacity={0.15}>
                      <animate attributeName="r"       values="7;13;7"      dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.15;0;0.15" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={currentPos.x} cy={currentPos.y} r={4} fill={color} />
                    <circle cx={currentPos.x} cy={currentPos.y} r={2} fill="white" />
                  </g>
                );
              })()}
            </>
          )}
        </svg>
      </div>

      {/* フェーズ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">フェーズ</span>
          {navPhase ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
              style={{
                color:           PHASE_COLOR[navPhase] ?? "#94a3b8",
                borderColor:     PHASE_COLOR[navPhase] ?? "#374151",
                backgroundColor: `${PHASE_COLOR[navPhase] ?? "#374151"}20`,
              }}>
              {PHASE_LABEL[navPhase] ?? navPhase}
            </span>
          ) : (
            <span className="text-[10px] text-gray-700">—</span>
          )}
        </div>
        <span className="text-[10px] text-gray-700 truncate max-w-[140px]">{guidance?.guidance ?? ""}</span>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-600">
        <span className="flex items-center gap-1">
          <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke="#818cf8" strokeWidth="2"/></svg>
          走行済
        </span>
        <span className="flex items-center gap-1">
          <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke="#4338ca" strokeWidth="1.5" strokeDasharray="3 3"/></svg>
          未走行
        </span>
        <span className="flex items-center gap-1">
          <svg width="10" height="8"><path d="M0,4 L10,0 L10,8 Z" fill="#a5b4fc" opacity="0.7"/></svg>
          進行方向
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />
          出発点
        </span>
        {(["safe", "warning", "critical"] as RiskLevel[]).map(r => (
          <span key={r} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: RISK_COLOR[r] }} />
            {r === "safe" ? "安全" : r === "warning" ? "注意" : "危険"}
          </span>
        ))}
      </div>
    </div>
  );
}
