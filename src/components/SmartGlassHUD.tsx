"use client";
import type { OperatorState, RiskLevel, GuidanceResult } from "@/types";

interface Detection {
  id: string;
  type: string;
  distance: number;
  confidence: number;
  pose_warning?: boolean;
}

interface Props {
  frame: string | null;
  risk: RiskLevel;
  operator: OperatorState | null;
  detections: Detection[];
  guidance: GuidanceResult | null;
  frameNumber: number;
  fps: number;
}

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: "#ef4444",
  warning:  "#f59e0b",
  safe:     "#10b981",
  info:     "#6366f1",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  critical: "⚠ 緊急停止",
  warning:  "⚠ 要注意",
  safe:     "● 安全",
  info:     "○ 情報",
};

/** スマートグラス風フルスクリーン AR HUD */
export function SmartGlassHUD({ frame, risk, operator, detections, guidance, frameNumber, fps }: Props) {
  const isCritical = risk === "critical";
  const riskColor  = RISK_COLORS[risk];

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
      {/* ベース映像 */}
      {frame ? (
        <img
          src={`data:image/jpeg;base64,${frame}`}
          className="absolute inset-0 w-full h-full object-cover"
          alt="AR view"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-gray-700 text-xs font-mono tracking-widest">AWAITING STREAM</span>
        </div>
      )}

      {/* HUD レイヤー（pointer-events:none） */}
      <div className="absolute inset-0 pointer-events-none">

        {/* ── 走査線エフェクト（薄い横ライン） ── */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,150,0.3) 3px, rgba(0,255,150,0.3) 4px)",
          }}
        />

        {/* ── コーナーブラケット ── */}
        {[
          "top-3 left-3 border-l-2 border-t-2",
          "top-3 right-3 border-r-2 border-t-2",
          "bottom-3 left-3 border-l-2 border-b-2",
          "bottom-3 right-3 border-r-2 border-b-2",
        ].map((cls, i) => (
          <div key={i} className={`absolute ${cls} w-6 h-6`} style={{ borderColor: `${riskColor}80` }} />
        ))}

        {/* ── 左上: システム情報 ── */}
        <div className="absolute top-4 left-8 flex flex-col gap-1 font-mono text-[10px]">
          <div className="bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm text-emerald-400">
            FRAME {String(frameNumber).padStart(6, "0")} · {fps}FPS
          </div>
          <div className="bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm text-emerald-400">
            YOLO11 POSE · {detections.length}件検出
          </div>
        </div>

        {/* ── 右上: リスク状態 ── */}
        <div className="absolute top-4 right-8">
          <div
            className={`px-3 py-1 rounded text-xs font-bold font-mono bg-black/70 backdrop-blur-sm ${isCritical ? "animate-pulse" : ""}`}
            style={{ color: riskColor, border: `1px solid ${riskColor}60` }}
          >
            {RISK_LABELS[risk]}
          </div>
        </div>

        {/* ── 左下: 操作者ステータス ── */}
        {operator && (
          <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
            {/* 注意度バー */}
            <div className="flex items-center gap-2 bg-black/70 px-2.5 py-1.5 rounded backdrop-blur-sm">
              <span className="text-[9px] text-gray-400 font-mono uppercase tracking-wider w-14">ATTENTION</span>
              <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${operator.attention_score}%`,
                    background: operator.attention_score > 70
                      ? "#10b981" : operator.attention_score > 40
                      ? "#f59e0b" : "#ef4444",
                  }}
                />
              </div>
              <span
                className="text-[10px] font-bold font-mono"
                style={{
                  color: operator.attention_score > 70 ? "#10b981"
                    : operator.attention_score > 40 ? "#f59e0b" : "#ef4444",
                }}
              >
                {operator.attention_score}%
              </span>
            </div>

            {/* 頭部方向 */}
            <div className="flex items-center gap-2 bg-black/70 px-2.5 py-1.5 rounded backdrop-blur-sm">
              <span className="text-[9px] text-gray-400 font-mono uppercase tracking-wider w-14">HEAD DIR</span>
              <span className={`text-xs font-bold ${
                operator.head_angle === "forward" ? "text-emerald-400"
                : operator.head_angle === "nodding" ? "text-red-400"
                : "text-amber-400"
              }`}>
                {operator.head_angle === "forward" ? "▲ 正面"
                : operator.head_angle === "nodding" ? "▼ 低下"
                : operator.head_angle === "left" ? "◀ 左"
                : "▶ 右"}
              </span>
            </div>

            {/* 警告バッジ */}
            {(operator.fatigue || operator.distracted || operator.pose_warning) && (
              <div className="flex gap-1.5">
                {operator.fatigue && (
                  <span className="bg-red-950/80 border border-red-700 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                    居眠り
                  </span>
                )}
                {operator.distracted && (
                  <span className="bg-amber-950/80 border border-amber-700 text-amber-400 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                    脇見
                  </span>
                )}
                {operator.pose_warning && (
                  <span className="bg-red-950/80 border border-red-700 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                    転倒
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 右下: 検出物体リスト ── */}
        {detections.length > 0 && (
          <div className="absolute bottom-4 right-4 flex flex-col gap-1 items-end">
            {detections.slice(0, 5).map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-1.5 bg-black/70 px-2 py-0.5 rounded backdrop-blur-sm text-[10px] font-mono"
              >
                {d.pose_warning && <span className="text-red-400">⚠</span>}
                <span className="text-gray-300">{d.type}</span>
                <span className="text-gray-500">{d.distance}m</span>
                <div className="w-8 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${d.confidence * 100}%`, background: riskColor }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 中央: CRITICAL アラート ── */}
        {isCritical && guidance && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-red-950/90 border-2 border-red-500 rounded-xl px-6 py-4 text-center max-w-xs backdrop-blur-sm animate-pulse">
              <p className="text-red-400 text-lg font-bold mb-1">{guidance.guidance}</p>
              <p className="text-red-300 text-xs leading-snug">{guidance.detail}</p>
            </div>
          </div>
        )}

        {/* ── ボーダーフラッシュ（CRITICAL時） ── */}
        {isCritical && (
          <div className="absolute inset-0 border-2 border-red-500/80 rounded-xl animate-pulse" />
        )}

        {/* ── 中央十字マーカー（照準） ── */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-8 h-8 opacity-30">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-emerald-400 -translate-y-px" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-emerald-400 -translate-x-px" />
            <div className="absolute inset-2 rounded-full border border-emerald-400" />
          </div>
        </div>

      </div>
    </div>
  );
}
