"use client";
import { Brain, Loader2, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, CheckCircle2, CircleDot } from "lucide-react";
import type { ForkAlign, GuidanceResult, NavDirection, NavPhase, RiskLevel } from "@/types";

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: "border-red-700 bg-red-950/40",
  warning:  "border-amber-700 bg-amber-950/30",
  safe:     "border-emerald-800 bg-emerald-950/30",
  info:     "border-indigo-700 bg-indigo-950/30",
};

const GUIDANCE_COLORS: Record<RiskLevel, string> = {
  critical: "text-red-400",
  warning:  "text-amber-400",
  safe:     "text-emerald-400",
  info:     "text-indigo-400",
};

interface Props {
  guidance: GuidanceResult | null;
  loading: boolean;
  updatedAt: Date | null;
}

function secondsAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 5) return "今";
  if (s < 60) return `${s}秒前`;
  return `${Math.floor(s / 60)}分前`;
}

function NavDirectionArrow({ direction, phase }: { direction: NavDirection; phase?: NavPhase }) {
  const isActionPhase = phase === "pickup" || phase === "deliver";

  const arrowMap: Record<NavDirection, { icon: React.ReactNode; label: string; color: string }> = {
    forward: {
      icon:  <ArrowUp size={28} strokeWidth={2.5} />,
      label: "前進",
      color: "text-emerald-400",
    },
    left: {
      icon:  <ArrowLeft size={28} strokeWidth={2.5} />,
      label: "左折",
      color: "text-amber-400",
    },
    right: {
      icon:  <ArrowRight size={28} strokeWidth={2.5} />,
      label: "右折",
      color: "text-amber-400",
    },
    reverse: {
      icon:  <ArrowDown size={28} strokeWidth={2.5} />,
      label: "後退",
      color: "text-orange-400",
    },
    stop: {
      icon:  <CircleDot size={28} strokeWidth={2.5} />,
      label: isActionPhase ? (phase === "pickup" ? "ピックアップ" : "降ろす") : "停止",
      color: isActionPhase ? "text-indigo-400" : "text-gray-400",
    },
  };

  const { icon, label, color } = arrowMap[direction] ?? arrowMap.forward;

  return (
    <div className="flex flex-col items-center justify-center gap-1 min-w-[56px]">
      <div className={`${color} drop-shadow-lg`}>{icon}</div>
      <span className={`text-[10px] font-bold tracking-wide ${color}`}>{label}</span>
    </div>
  );
}

function ForkAlignGuide({ fa }: { fa: ForkAlign }) {
  if (!fa.visible) return null;

  const xArrow = fa.x === "left"
    ? <ArrowLeft size={18} className="text-amber-400" />
    : fa.x === "right"
    ? <ArrowRight size={18} className="text-amber-400" />
    : null;

  const yArrow = fa.y === "too_high"
    ? <ArrowDown size={18} className="text-amber-400" />
    : fa.y === "too_low"
    ? <ArrowUp size={18} className="text-amber-400" />
    : null;

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider mb-2">
        フォーク位置ガイダンス
      </div>

      {fa.ready ? (
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
          <CheckCircle2 size={16} />
          ピック可能！
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {xArrow}
          {yArrow}
          {!xArrow && !yArrow && (
            <span className="text-emerald-400 text-xs">位置OK</span>
          )}
          {fa.action ? (
            <span className="text-amber-300 text-sm font-medium">{fa.action}</span>
          ) : null}
        </div>
      )}

      {/* X / Y ステータスドット */}
      <div className="flex gap-3 mt-1.5">
        <span className={`text-[10px] ${fa.x === "center" ? "text-emerald-500" : "text-amber-500"}`}>
          横: {fa.x === "left" ? "左にずれ" : fa.x === "right" ? "右にずれ" : "中央 ✓"}
        </span>
        <span className={`text-[10px] ${fa.y === "correct" ? "text-emerald-500" : "text-amber-500"}`}>
          高さ: {fa.y === "too_high" ? "高すぎ" : fa.y === "too_low" ? "低すぎ" : "適正 ✓"}
        </span>
      </div>
    </div>
  );
}

export function GuidancePanel({ guidance, loading, updatedAt }: Props) {
  const risk = guidance?.risk ?? "safe";

  return (
    <div className={`rounded-xl border p-4 transition-all duration-500 ${RISK_COLORS[risk]}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <Brain size={14} className="text-indigo-400" />
          AI ガイダンス
        </div>
        {loading ? (
          <Loader2 size={12} className="text-gray-600 animate-spin" />
        ) : updatedAt ? (
          <span className="text-[10px] text-gray-600 font-mono">{secondsAgo(updatedAt)}</span>
        ) : null}
      </div>

      {guidance ? (
        <div className="animate-fade-in space-y-2">
          {/* ガイダンス文 + 進行方向矢印 */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className={`text-xl font-bold tracking-tight ${GUIDANCE_COLORS[risk]}`}>
                {guidance.guidance}
              </p>
              <p className="text-xs text-gray-400 leading-relaxed mt-1">
                {guidance.detail}
              </p>
            </div>
            {guidance.nav_direction && (
              <div className="border-l border-white/10 pl-3">
                <NavDirectionArrow
                  direction={guidance.nav_direction}
                  phase={guidance.nav_phase}
                />
              </div>
            )}
          </div>
          {guidance.fork_align && (
            <ForkAlignGuide fa={guidance.fork_align} />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="h-6 w-3/4 bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-full bg-gray-800 rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-gray-800 rounded animate-pulse" />
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-gray-700">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
        Powered by Gemini 2.5 Flash
      </div>
    </div>
  );
}
