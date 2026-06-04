"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ClipboardList, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";

const API_BASE: string = (() => {
  if (typeof window === "undefined") return "http://localhost:8000";
  if (window.location.hostname === "localhost") return "http://localhost:8000";
  const ws = process.env.NEXT_PUBLIC_WS_URL;
  if (ws) return ws.replace(/^ws/, "http").replace(/\/ws\/.*/, "");
  return "";
})();

// バックエンド未設定（Vercel等のホスト型環境で localhost:8000 に到達不可）
const BACKEND_CONFIGURED = API_BASE !== "";

// バックエンド接続時は API、未接続時は同梱の静的JSON（/data/*.json）を読む
const adminUrl = (path: string): string =>
  BACKEND_CONFIGURED ? `${API_BASE}${path}` : `/data${path.replace("/admin", "")}.json`;

// ---- 型定義 ----------------------------------------------------------------

interface Waypoint {
  x: number;
  y: number;
  action: "start" | "move" | "pick" | "drop";
}

interface Task {
  step: number;
  slot: number;
  color: string;
  source_row: number;
  source_col: number;
  instruction_ja: string;
  reason: string;
  route_waypoints?: Waypoint[];
  estimated_distance_px?: number;
  start_t?: number;
  end_t?: number;
  duration_sec?: number;
}

interface ForkliftInstruction {
  forklift_id: string;
  grade: string;
  priority_order: Task[];
  total_estimated_distance_px?: number;
  initial_delay_sec?: number;
  delay_reason?: string | null;
}

interface Alert {
  type: string;
  color: string;
  affected_slots: number[];
  message: string;
}

interface InstructionsResponse {
  ready: boolean;
  message?: string;
  generated_at?: string;
  instructions: ForkliftInstruction[];
  alerts: Alert[];
  summary?: string;
  execution_note?: string;
}

interface ForkliftTrajectory {
  id: string;
  color: string;
}

// ---- 定数 ------------------------------------------------------------------

const TOTAL_SLOTS = 15;

const CONTAINER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  red:    { bg: "#ef4444", text: "#fff",     label: "RED" },
  green:  { bg: "#22c55e", text: "#fff",     label: "GRN" },
  gray:   { bg: "#9ca3af", text: "#fff",     label: "GRY" },
  blue:   { bg: "#3b82f6", text: "#fff",     label: "BLU" },
  orange: { bg: "#f97316", text: "#fff",     label: "ORG" },
  cyan:   { bg: "#06b6d4", text: "#fff",     label: "CYN" },
  yellow: { bg: "#eab308", text: "#1a1a1a",  label: "YLW" },
};

const GRADE_COLORS: Record<string, { border: string; text: string; accent: string }> = {
  A: { border: "border-emerald-500/40", text: "text-emerald-400", accent: "#10b981" },
  B: { border: "border-blue-500/40",    text: "text-blue-400",    accent: "#3b82f6" },
  C: { border: "border-orange-500/40",  text: "text-orange-400",  accent: "#f97316" },
  D: { border: "border-red-500/40",     text: "text-red-400",     accent: "#ef4444" },
};

// ---- サブコンポーネント -----------------------------------------------------

/** 列車スロット帯 */
function TrainStrip({
  instructions,
  alerts,
  fkColors,
}: {
  instructions: ForkliftInstruction[];
  alerts: Alert[];
  fkColors: Record<string, string>;
}) {
  // slot番号 → {color, forklift_id} のマップ
  const slotMap = new Map<number, { color: string; forklift_id: string }>();
  for (const fk of instructions) {
    for (const task of fk.priority_order) {
      slotMap.set(task.slot, { color: task.color, forklift_id: fk.forklift_id });
    }
  }

  // アラートスロットセット
  const alertSlots = new Set<number>(alerts.flatMap((a) => a.affected_slots));

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0a0f1a] p-4">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
        列車スロット配置（15両）
      </p>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
          const assigned  = slotMap.get(i);
          const isAlert   = alertSlots.has(i);
          const cc        = assigned ? CONTAINER_COLORS[assigned.color] : null;
          const fkColor   = assigned ? (fkColors[assigned.forklift_id] ?? "#6b7280") : null;

          return (
            <div
              key={i}
              className={`flex-shrink-0 flex flex-col items-center rounded-lg border-2 overflow-hidden
                ${isAlert ? "border-red-500/70" : cc ? "border-transparent" : "border-gray-700/50"}`}
              style={{ width: 56 }}
            >
              {/* カラーブロック */}
              <div
                className="w-full flex items-center justify-center font-bold text-[10px] py-2"
                style={{
                  background: isAlert ? "#7f1d1d" : (cc?.bg ?? "#1f2937"),
                  color:      isAlert ? "#fca5a5"  : (cc?.text ?? "#4b5563"),
                }}
              >
                {isAlert ? "✗" : (cc?.label ?? "—")}
              </div>
              {/* スロット番号 */}
              <div className="w-full text-center text-[9px] text-gray-500 py-0.5 bg-[#111827]">
                {i}
              </div>
              {/* FK バッジ */}
              <div
                className="w-full text-center text-[9px] font-bold py-0.5 bg-[#0d1117]"
                style={{ color: fkColor ?? (isAlert ? "#ef4444" : "#374151") }}
              >
                {isAlert ? "在庫切" : (assigned?.forklift_id ?? "未定")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- 経路ミニマップ --------------------------------------------------------

// 実座標 → ミニマップ座標変換
const MAP_W = 120;
const MAP_H = 68;
const FRAME_W = 1280;
const FRAME_H = 720;
const SX = MAP_W / FRAME_W;
const SY = MAP_H / FRAME_H;

function toMap(x: number, y: number): [number, number] {
  return [Math.round(x * SX * 10) / 10, Math.round(y * SY * 10) / 10];
}

function RouteMap({ waypoints, color }: { waypoints: Waypoint[]; color: string }) {
  if (waypoints.length < 2) return null;

  const pts = waypoints.map((w) => toMap(w.x, w.y));
  const polyline = pts.map(([x, y]) => `${x},${y}`).join(" ");

  const pick = waypoints.find((w) => w.action === "pick");
  const drop = waypoints.find((w) => w.action === "drop");
  const pickPt = pick ? toMap(pick.x, pick.y) : null;
  const dropPt = drop ? toMap(drop.x, drop.y) : null;

  // グリッドエリアとトレインエリアの境界線 (y=95 → map_y)
  const trainLineY = toMap(0, 95)[1];
  const gridTopY   = toMap(0, 174)[1];
  const gridBotY   = toMap(0, 570)[1];

  return (
    <svg
      width={MAP_W}
      height={MAP_H}
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      className="flex-shrink-0 rounded border border-gray-700/50"
      style={{ background: "#080d18" }}
    >
      {/* 列車エリア */}
      <rect x={0} y={0} width={MAP_W} height={trainLineY} fill="#1e3a5f" opacity={0.4} />
      {/* グリッドエリア */}
      <rect x={0} y={gridTopY} width={MAP_W} height={gridBotY - gridTopY} fill="#1a2a1a" opacity={0.4} />
      {/* 境界線 */}
      <line x1={0} y1={trainLineY} x2={MAP_W} y2={trainLineY} stroke="#3b82f6" strokeWidth={0.5} opacity={0.5} />
      <line x1={0} y1={gridTopY}   x2={MAP_W} y2={gridTopY}   stroke="#22c55e" strokeWidth={0.5} opacity={0.4} />

      {/* 経路ライン */}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />

      {/* PICK マーカー（■） */}
      {pickPt && (
        <rect
          x={pickPt[0] - 2.5}
          y={pickPt[1] - 2.5}
          width={5}
          height={5}
          fill={color}
          opacity={0.9}
        />
      )}

      {/* DROP マーカー（◆） */}
      {dropPt && (
        <polygon
          points={`${dropPt[0]},${dropPt[1] - 3} ${dropPt[0] + 3},${dropPt[1]} ${dropPt[0]},${dropPt[1] + 3} ${dropPt[0] - 3},${dropPt[1]}`}
          fill="#facc15"
          opacity={0.9}
        />
      )}
    </svg>
  );
}

/** タスク行 */
function TaskRow({ task, fkColor }: { task: Task; fkColor: string }) {
  const cc = CONTAINER_COLORS[task.color] ?? { bg: "#6b7280", text: "#fff", label: task.color.toUpperCase() };
  return (
    <div className="py-2 border-b border-gray-800/50 last:border-0">
      <div className="flex items-start gap-2">
        {/* Step番号 */}
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-800 text-[10px] text-gray-400 flex items-center justify-center font-bold">
          {task.step}
        </span>
        {/* カラーバッジ */}
        <span
          className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold"
          style={{ background: cc.bg, color: cc.text }}
        >
          {cc.label}
        </span>
        {/* 指示 */}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-200 leading-snug">
            <span className="text-gray-500">row{task.source_row}-col{task.source_col}</span>
            <span className="text-gray-600 mx-1">→</span>
            <span className="font-semibold text-white">slot{task.slot}</span>
            {task.start_t != null && task.end_t != null && (
              <span className="ml-2 text-[10px] text-gray-600">
                {task.start_t.toFixed(0)}s〜{task.end_t.toFixed(0)}s
              </span>
            )}
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5 truncate" title={task.reason}>
            {task.reason}
          </p>
        </div>
      </div>
      {/* 経路ミニマップ */}
      {task.route_waypoints && task.route_waypoints.length > 1 && (
        <div className="mt-1.5 ml-7">
          <RouteMap waypoints={task.route_waypoints} color={fkColor} />
        </div>
      )}
    </div>
  );
}

/** フォークリフト指示カード */
function FkCard({
  fk,
  fkColor,
}: {
  fk: ForkliftInstruction;
  fkColor: string;
}) {
  const gc = GRADE_COLORS[fk.grade] ?? GRADE_COLORS["D"];

  return (
    <div
      className={`rounded-xl border ${gc.border} bg-[#0a0f1a] overflow-hidden`}
      style={{ borderLeftColor: fkColor, borderLeftWidth: 3 }}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: fkColor }}
          />
          <span className="font-bold text-sm text-white">{fk.forklift_id}</span>
          <span className={`text-xs font-bold ${gc.text}`}>グレード {fk.grade}</span>
          {(fk.initial_delay_sec ?? 0) > 0 && (
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-900/50 text-yellow-300 border border-yellow-700/50"
              title={fk.delay_reason ?? ""}
            >
              ⏱ {fk.initial_delay_sec}s 待機
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-500">
          {fk.priority_order.length} タスク
        </span>
      </div>
      {/* 衝突理由 */}
      {fk.delay_reason && (
        <div className="px-3 py-1.5 bg-yellow-950/30 border-b border-yellow-900/30 text-[10px] text-yellow-500">
          {fk.delay_reason}
        </div>
      )}
      {/* タスクリスト */}
      <div className="px-3 py-1">
        {fk.priority_order.length === 0 ? (
          <p className="text-xs text-gray-600 py-2">タスクなし</p>
        ) : (
          fk.priority_order.map((task) => (
            <TaskRow key={task.step} task={task} fkColor={fkColor} />
          ))
        )}
        {fk.total_estimated_distance_px != null && (
          <p className="text-[10px] text-gray-600 py-1.5 text-right border-t border-gray-800/50">
            合計移動距離: <span className="text-gray-400 font-semibold">{Math.round(fk.total_estimated_distance_px).toLocaleString()} px</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ---- メインページ -----------------------------------------------------------

export default function InstructionsPage() {
  const [data, setData]       = useState<InstructionsResponse | null>(null);
  const [fkColors, setFkColors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [instRes, trajRes] = await Promise.all([
        fetch(adminUrl("/admin/instructions")),
        fetch(adminUrl("/admin/trajectory")),
      ]);
      if (!instRes.ok) throw new Error(`HTTP ${instRes.status}`);
      const inst: InstructionsResponse = await instRes.json();
      setData(inst);

      if (trajRes.ok) {
        const traj = await trajRes.json();
        const map: Record<string, string> = {};
        for (const fk of traj.forklifts ?? []) map[fk.id] = fk.color;
        setFkColors(map);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
    // scrollable override (globals.css has overflow: hidden)
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="min-h-screen bg-[#050a14] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="text-indigo-400" size={20} />
            <div>
              <h1 className="text-lg font-bold text-white">作業指示</h1>
              <p className="text-xs text-gray-500">Gemini A 生成 — フォークリフト別作業手順</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 text-gray-300 transition-colors"
            >
              <ArrowLeft size={11} />
              モニター
            </Link>
            <Link
              href="/admin/optimization"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-900/50 hover:bg-indigo-800/60 rounded-lg border border-indigo-700/50 text-indigo-300 transition-colors"
            >
              <Sparkles size={11} />
              最適化
            </Link>
            <Link
              href="/admin/evaluate"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 text-gray-300 transition-colors"
            >
              評価
            </Link>
            <button
              onClick={() => load().catch(() => {})}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              更新
            </button>
          </div>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="text-center text-sm text-gray-500 py-12">読み込み中...</div>
        )}

        {/* エラー */}
        {!loading && error && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-400">
            バックエンドに接続できません: {error}
          </div>
        )}

        {/* 未生成 */}
        {!loading && data && !data.ready && (
          <div className="rounded-xl border border-yellow-900/50 bg-yellow-950/20 p-4 text-sm text-yellow-400">
            <p className="font-semibold mb-1">作業指示データが未生成です</p>
            <pre className="mt-2 text-xs text-yellow-500 bg-black/30 rounded p-2">
              GEMINI_API_KEY=xxx python3 instruct_forklift.py
            </pre>
            {data.message && <p className="mt-1 text-xs text-yellow-600">{data.message}</p>}
          </div>
        )}

        {data?.ready && (
          <>
            {/* メタ情報 */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span>生成: <span className="text-gray-300">{data.generated_at}</span></span>
              {data.summary && <span className="text-gray-400">{data.summary}</span>}
            </div>

            {/* アラートバナー */}
            {data.alerts.length > 0 && (
              <div className="space-y-2">
                {data.alerts.map((alert, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-red-700/50 bg-red-950/20 px-4 py-3">
                    <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                    <div>
                      <p className="text-sm font-semibold text-red-300">{alert.message}</p>
                      <p className="text-xs text-red-500 mt-0.5">
                        対象スロット: {alert.affected_slots.map((s) => `slot${s}`).join("・")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 列車スロット帯 */}
            <TrainStrip instructions={data.instructions} alerts={data.alerts} fkColors={fkColors} />

            {/* フォークリフト作業指示 */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
                フォークリフト作業指示
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.instructions.map((fk) => (
                  <FkCard
                    key={fk.forklift_id}
                    fk={fk}
                    fkColor={fkColors[fk.forklift_id] ?? "#6b7280"}
                  />
                ))}
              </div>
              {data.execution_note && (
                <div className="rounded-xl border border-gray-800 bg-[#0a0f1a] px-4 py-3 mt-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">実行メモ</p>
                  <p className="text-xs text-gray-400">{data.execution_note}</p>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
