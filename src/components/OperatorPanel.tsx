"use client";
import type { OperatorState } from "@/types";

interface Props {
  operator: OperatorState | null;
  streaming: boolean;
  /** 新動画（操作者が写らない映像）の区間中はモニタリングを停止表示する */
  paused?: boolean;
}

function AttentionRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score > 70 ? "#10b981" : score > 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#1f2937" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.4s ease" }}
        />
      </svg>
      <div className="text-center">
        <p className="text-xl font-bold font-mono leading-none" style={{ color }}>{score}</p>
        <p className="text-[9px] text-gray-500 leading-none mt-0.5">ATTENTION</p>
      </div>
    </div>
  );
}

function HeadDirectionIcon({ angle }: { angle: OperatorState["head_angle"] }) {
  const arrows: Record<OperatorState["head_angle"], string> = {
    forward:  "↑",
    nodding:  "↓",
    left:     "←",
    right:    "→",
  };
  const colors: Record<OperatorState["head_angle"], string> = {
    forward:  "text-emerald-400",
    nodding:  "text-red-400",
    left:     "text-amber-400",
    right:    "text-amber-400",
  };
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-2xl font-bold ${colors[angle]}`}>{arrows[angle]}</span>
      <span className="text-[9px] text-gray-500 uppercase tracking-wider">HEAD</span>
    </div>
  );
}

function StatusBadge({ label, active, alertColor }: { label: string; active: boolean; alertColor: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-300 ${
      active
        ? `${alertColor} animate-pulse`
        : "bg-gray-900/50 border-gray-800 text-gray-600"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-current" : "bg-gray-700"}`} />
      {label}
    </div>
  );
}

export function OperatorPanel({ operator, streaming, paused }: Props) {
  if (paused) {
    return (
      <div className="bg-surface rounded-xl border border-border-default p-4">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">操作者モニタリング</p>
        <div className="flex flex-col items-center gap-1.5 py-4">
          <span className="text-xs font-semibold text-gray-500">停止中</span>
          <span className="text-[10px] text-gray-600">操作者がフレームに写っていません</span>
        </div>
      </div>
    );
  }

  if (!streaming) {
    return (
      <div className="bg-surface rounded-xl border border-border-default p-4">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">操作者モニタリング</p>
        <p className="text-xs text-gray-700 text-center py-4">接続待ち</p>
      </div>
    );
  }

  if (!operator) {
    return (
      <div className="bg-surface rounded-xl border border-border-default p-4">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">操作者モニタリング</p>
        <p className="text-xs text-gray-600 text-center py-4">操作者を検出できません</p>
      </div>
    );
  }

  const alertBorder = operator.fatigue || operator.distracted || operator.pose_warning
    ? "border-red-800"
    : "border-border-default";

  return (
    <div className={`bg-surface rounded-xl border p-4 transition-colors duration-300 ${alertBorder}`}>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">操作者モニタリング</p>

      {/* メインメトリクス行 */}
      <div className="flex items-center gap-4 mb-4">
        <AttentionRing score={operator.attention_score} />

        <div className="flex-1 space-y-2">
          {/* 距離 */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">距離</span>
            <span className="font-mono text-gray-300">{operator.distance}m</span>
          </div>
          {/* 頭部下垂率 */}
          <div>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-gray-500">頭部下垂</span>
              <span className="font-mono text-gray-400">{Math.round(operator.head_drop * 100)}%</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-400"
                style={{
                  width: `${Math.min(operator.head_drop * 300, 100)}%`,
                  background: operator.fatigue ? "#ef4444" : "#6366f1",
                }}
              />
            </div>
          </div>
          {/* 顔向き偏差 */}
          <div>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-gray-500">顔向き偏差</span>
              <span className="font-mono text-gray-400">{Math.round(operator.face_turn * 100)}%</span>
            </div>
            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-400"
                style={{
                  width: `${Math.min(operator.face_turn * 200, 100)}%`,
                  background: operator.distracted ? "#f59e0b" : "#6366f1",
                }}
              />
            </div>
          </div>
        </div>

        <HeadDirectionIcon angle={operator.head_angle} />
      </div>

      {/* ステータスバッジ行 */}
      <div className="flex gap-2 flex-wrap">
        <StatusBadge
          label="居眠り"
          active={operator.fatigue || (operator.gemini_fatigue ?? false)}
          alertColor="bg-red-950/70 border-red-700 text-red-400"
        />
        <StatusBadge
          label="脇見"
          active={operator.distracted}
          alertColor="bg-amber-950/70 border-amber-700 text-amber-400"
        />
        <StatusBadge
          label="転倒"
          active={operator.pose_warning}
          alertColor="bg-red-950/70 border-red-700 text-red-400"
        />
        <StatusBadge
          label="PPE未装着"
          active={!(operator.gemini_ppe ?? true)}
          alertColor="bg-yellow-950/70 border-yellow-600 text-yellow-400"
        />
      </div>

      {/* Gemini AI 判定ソース表示 */}
      {(operator.gemini_fatigue !== undefined) && (
        <div className="mt-2 pt-2 border-t border-gray-800 flex items-center gap-1.5">
          <span className="text-[9px] text-indigo-500 font-semibold uppercase tracking-wider">Gemini AI</span>
          <span className="text-[9px] text-gray-600">|</span>
          <span className={`text-[9px] font-semibold ${operator.gemini_ppe === false ? "text-yellow-400" : "text-emerald-500"}`}>
            {operator.gemini_ppe === false ? "⚠ PPE未装着" : "✓ PPE装着"}
          </span>
          {operator.gemini_fatigue && (
            <>
              <span className="text-[9px] text-gray-600">|</span>
              <span className="text-[9px] font-semibold text-red-400">⚠ 疲労検出</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
