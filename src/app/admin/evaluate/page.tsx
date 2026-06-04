"use client";
import { useEffect, useState } from "react";
import {
  Star, TrendingUp, TrendingDown, RefreshCw, ArrowLeft, AlertCircle, ClipboardList,
} from "lucide-react";
import Link from "next/link";

const API_BASE: string = (() => {
  if (typeof window === "undefined") return "http://localhost:8000";
  if (window.location.hostname === "localhost") return "http://localhost:8000";
  const ws = process.env.NEXT_PUBLIC_WS_URL;
  if (ws) return ws.replace(/^ws/, "http").replace(/\/ws\/.*/, "");
  return "";
})();

// ---- 型定義 ----------------------------------------------------------------

interface Evaluation {
  forklift_id: string;
  score: number;
  grade: string;
  good_points: string[];
  bad_points: string[];
  summary: string;
  recommendations: string[];
}

interface CycleSummary {
  forklift_id: string;
  cycle_count: number;
  avg_cycle_sec?: number;
  avg_route_efficiency?: number;
  idle_ratio: number;
  flags: Record<string, boolean>;
}

interface TrajectoryPoint { frame: number; x: number; y: number }
interface ForkliftTrajectory { id: string; color: string; samples: TrajectoryPoint[] }

// ---- 定数 ------------------------------------------------------------------

const GRADE_COLORS: Record<string, { border: string; text: string; bg: string }> = {
  S: { border: "border-yellow-400/40",  text: "text-yellow-300",  bg: "bg-yellow-400/10"  },
  A: { border: "border-emerald-400/40", text: "text-emerald-400", bg: "bg-emerald-400/10" },
  B: { border: "border-blue-400/40",    text: "text-blue-400",    bg: "bg-blue-400/10"    },
  C: { border: "border-orange-400/40",  text: "text-orange-400",  bg: "bg-orange-400/10"  },
  D: { border: "border-red-400/40",     text: "text-red-400",     bg: "bg-red-400/10"     },
};

// ゾーン境界（ピクセル座標 1280×720）
const FRAME_W = 1280;
const FRAME_H = 720;
const MINIMAP_W = 256;
const MINIMAP_H = Math.round(FRAME_H / FRAME_W * MINIMAP_W); // 144
const SCALE = MINIMAP_W / FRAME_W;
const ZONE_Y_LOADING = Math.round(220 * SCALE); // 44px
const ZONE_Y_DEPOT   = Math.round(500 * SCALE); // 100px

// ---- コンポーネント ---------------------------------------------------------

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${i <= score ? "bg-indigo-400" : "bg-gray-700"}`}
        />
      ))}
    </div>
  );
}

/** ランキングバー — スコア順横並び */
function RankingBar({
  sorted,
  colors,
}: {
  sorted: Evaluation[];
  colors: Record<string, string>;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0a0f1a] p-4">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
        ランキング
      </p>
      <div className="flex gap-3">
        {sorted.map((ev, rank) => {
          const gc = GRADE_COLORS[ev.grade] ?? GRADE_COLORS["B"];
          const color = colors[ev.forklift_id] ?? "#888";
          return (
            <div
              key={ev.forklift_id}
              className={`flex-1 rounded-lg border ${gc.border} ${gc.bg} p-3 flex flex-col items-center gap-1.5`}
            >
              <span className="text-[10px] text-gray-500 font-medium">#{rank + 1}</span>
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: color }}
              />
              <span className="text-xs font-bold text-white">{ev.forklift_id}</span>
              <span className={`text-lg font-black ${gc.text}`}>{ev.grade}</span>
              <ScoreDots score={ev.score} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** メトリクスグリッド（4項目） */
function MetricsGrid({ summary }: { summary: CycleSummary | undefined }) {
  if (!summary) return null;

  const metrics = [
    {
      label: "サイクル数",
      value: summary.cycle_count.toString(),
      unit: "回",
      flag: summary.flags.no_cycles,
    },
    {
      label: "平均時間",
      value: summary.avg_cycle_sec?.toFixed(1) ?? "—",
      unit: "s",
      flag: summary.flags.slow_cycles,
    },
    {
      label: "経路効率",
      value: summary.avg_route_efficiency
        ? `${Math.round(summary.avg_route_efficiency * 100)}`
        : "—",
      unit: "%",
      flag: summary.flags.low_efficiency,
    },
    {
      label: "アイドル率",
      value: `${Math.round(summary.idle_ratio * 100)}`,
      unit: "%",
      flag: summary.flags.high_idle,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {metrics.map(m => (
        <div
          key={m.label}
          className={`rounded-lg p-2.5 text-center ${
            m.flag
              ? "bg-orange-950/30 border border-orange-800/40"
              : "bg-gray-900/60 border border-gray-800/60"
          }`}
        >
          <p className="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">{m.label}</p>
          <p className={`text-base font-black ${m.flag ? "text-orange-400" : "text-white"}`}>
            {m.value}
            <span className="text-[10px] font-normal text-gray-500 ml-0.5">{m.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

/** 軌跡ミニマップ SVG — 動画最終フレームを背景に軌跡を重ねる */
function Minimap({
  trajectory,
}: {
  trajectory: ForkliftTrajectory | undefined;
}) {
  const snapshotUrl = `${API_BASE}/admin/snapshot`;

  if (!trajectory || trajectory.samples.length < 2) {
    return (
      <div
        className="rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center text-[10px] text-gray-600"
        style={{ width: MINIMAP_W, height: MINIMAP_H }}
      >
        軌跡なし
      </div>
    );
  }

  // 5点おきにサンプリング（805点 → ~160点）
  const pts = trajectory.samples
    .filter((_, i) => i % 5 === 0)
    .map(s => `${(s.x * SCALE).toFixed(1)},${(s.y * SCALE).toFixed(1)}`)
    .join(" ");

  const first = trajectory.samples[0];
  const last  = trajectory.samples[trajectory.samples.length - 1];
  const fx = first.x * SCALE;
  const fy = first.y * SCALE;
  const lx = last.x * SCALE;
  const ly = last.y * SCALE;

  return (
    <svg
      width={MINIMAP_W}
      height={MINIMAP_H}
      viewBox={`0 0 ${MINIMAP_W} ${MINIMAP_H}`}
      className="rounded-lg border border-gray-700"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 背景: 動画最終フレーム（コンテナ・棚の実際のレイアウト） */}
      <image
        href={snapshotUrl}
        x={0} y={0}
        width={MINIMAP_W}
        height={MINIMAP_H}
        preserveAspectRatio="xMidYMid slice"
      />

      {/* 暗幕（軌跡を見やすくする半透明オーバーレイ） */}
      <rect x={0} y={0} width={MINIMAP_W} height={MINIMAP_H} fill="#000" opacity={0.35} />

      {/* ゾーン境界線 */}
      <line x1={0} y1={ZONE_Y_LOADING} x2={MINIMAP_W} y2={ZONE_Y_LOADING}
        stroke="#3b82f6" strokeWidth={0.8} strokeDasharray="4 3" opacity={0.7} />
      <line x1={0} y1={ZONE_Y_DEPOT} x2={MINIMAP_W} y2={ZONE_Y_DEPOT}
        stroke="#f97316" strokeWidth={0.8} strokeDasharray="4 3" opacity={0.7} />

      {/* ゾーンラベル */}
      <text x={3} y={ZONE_Y_LOADING - 2} fontSize={6} fill="#93c5fd" opacity={0.9} fontFamily="system-ui">LOADING</text>
      <text x={3} y={ZONE_Y_DEPOT + 8}   fontSize={6} fill="#fdba74" opacity={0.9} fontFamily="system-ui">DEPOT</text>

      {/* 全軌跡ライン */}
      <polyline
        points={pts}
        fill="none"
        stroke={trajectory.color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />

      {/* スタートマーカー（四角） */}
      <rect x={fx - 3} y={fy - 3} width={6} height={6}
        fill={trajectory.color} opacity={0.95} />

      {/* エンドマーカー（ひし形） */}
      <polygon
        points={`${lx},${ly - 4.5} ${lx + 4},${ly} ${lx},${ly + 4.5} ${lx - 4},${ly}`}
        fill={trajectory.color}
        opacity={0.95}
      />
    </svg>
  );
}

/** 評価カード1台分 */
function EvalCard({
  ev,
  summary,
  trajectory,
  rank,
}: {
  ev: Evaluation;
  summary: CycleSummary | undefined;
  trajectory: ForkliftTrajectory | undefined;
  rank: number;
}) {
  const gc = GRADE_COLORS[ev.grade] ?? GRADE_COLORS["B"];
  const color = trajectory?.color ?? "#888";

  return (
    <div className={`rounded-xl border ${gc.border} bg-[#0a0f1a] p-5 space-y-4`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600 font-medium">#{rank}</span>
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          <span className="text-base font-bold text-white">{ev.forklift_id}</span>
          <ScoreDots score={ev.score} />
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-sm font-black border ${gc.border} ${gc.text} ${gc.bg}`}>
          {ev.grade}
        </span>
      </div>

      {/* メトリクスグリッド */}
      <MetricsGrid summary={summary} />

      {/* サマリ */}
      <p className="text-xs text-gray-400 leading-relaxed">{ev.summary}</p>

      {/* 良い点 */}
      {ev.good_points.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] font-semibold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp size={10} /> 良い点
          </p>
          <ul className="space-y-0.5">
            {ev.good_points.map((pt, i) => (
              <li key={i} className="text-xs text-emerald-300 flex gap-2">
                <span className="text-emerald-600 flex-shrink-0">✓</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 改善点 */}
      {ev.bad_points.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] font-semibold text-orange-500 uppercase tracking-wider flex items-center gap-1">
            <TrendingDown size={10} /> 改善点
          </p>
          <ul className="space-y-0.5">
            {ev.bad_points.map((pt, i) => (
              <li key={i} className="text-xs text-orange-300 flex gap-2">
                <span className="text-orange-600 flex-shrink-0">!</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 推奨アクション */}
      {ev.recommendations.length > 0 && (
        <div className="pt-2 border-t border-gray-800/60 space-y-1">
          <p className="text-[9px] font-semibold text-indigo-400 uppercase tracking-wider">推奨アクション</p>
          <ul className="space-y-0.5">
            {ev.recommendations.map((rec, i) => (
              <li key={i} className="text-xs text-indigo-300 flex gap-2">
                <span className="text-indigo-600 flex-shrink-0">→</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ミニマップ */}
      <div className="pt-2 border-t border-gray-800/60">
        <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-2">全体経路</p>
        <Minimap trajectory={trajectory} />
      </div>
    </div>
  );
}

// ---- メインページ -----------------------------------------------------------

export default function EvaluatePage() {
  const [evalData,  setEvalData]  = useState<{ ready: boolean; message?: string; generated_at?: string; model?: string; global_benchmark?: { avg_cycle_sec: number; total_cycles: number }; evaluations: Evaluation[] } | null>(null);
  const [cycleData, setCycleData] = useState<{ ready: boolean; forklifts: { id: string; summary: CycleSummary }[] } | null>(null);
  const [trajData,  setTrajData]  = useState<{ forklifts: ForkliftTrajectory[] } | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [evalRes, cycleRes, trajRes] = await Promise.all([
        fetch(`${API_BASE}/admin/evaluate`),
        fetch(`${API_BASE}/admin/cycles`),
        fetch(`${API_BASE}/admin/trajectory`),
      ]);
      if (!evalRes.ok) throw new Error(`evaluate: HTTP ${evalRes.status}`);
      setEvalData(await evalRes.json());
      if (cycleRes.ok) setCycleData(await cycleRes.json());
      if (trajRes.ok)  setTrajData(await trajRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // globals.css の overflow:hidden をこのページでは解除
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => { load().catch(() => {}); }, []);

  // スコア降順でソート
  const sorted = evalData?.evaluations.slice().sort((a, b) => b.score - a.score) ?? [];

  // IDをキーにしたルックアップ
  const cycleMap: Record<string, CycleSummary> = {};
  cycleData?.forklifts.forEach(fk => { cycleMap[fk.id] = fk.summary; });

  const trajMap: Record<string, ForkliftTrajectory> = {};
  trajData?.forklifts.forEach(fk => { trajMap[fk.id] = fk; });

  const colorMap: Record<string, string> = {};
  trajData?.forklifts.forEach(fk => { colorMap[fk.id] = fk.color; });

  return (
    <div className="min-h-screen bg-[#050a14] text-white p-6" style={{ overflowY: "auto" }}>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-gray-500 hover:text-gray-300 transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <Star className="text-yellow-400" size={20} />
            <div>
              <h1 className="text-lg font-bold text-white">オペレーター評価</h1>
              <p className="text-xs text-gray-500">Gemini AI によるパフォーマンス分析</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/instructions"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-900/50 hover:bg-indigo-800/60 rounded-lg border border-indigo-700/50 text-indigo-300 transition-colors"
            >
              <ClipboardList size={11} />
              指示
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

        {/* メタ情報 */}
        {evalData?.ready && (
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span>モデル: <span className="text-gray-300">{evalData.model}</span></span>
            <span>生成日時: <span className="text-gray-300">{evalData.generated_at}</span></span>
            {evalData.global_benchmark && (
              <>
                <span>平均サイクル: <span className="text-emerald-400 font-bold">{evalData.global_benchmark.avg_cycle_sec}秒</span></span>
                <span>総サイクル数: <span className="text-gray-300">{evalData.global_benchmark.total_cycles}</span></span>
              </>
            )}
          </div>
        )}

        {/* ローディング */}
        {loading && (
          <div className="text-center text-sm text-gray-500 py-12">評価データを取得中...</div>
        )}

        {/* エラー */}
        {!loading && error && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-400">
            バックエンドに接続できません: {error}
          </div>
        )}

        {/* 未生成 */}
        {!loading && evalData && !evalData.ready && (
          <div className="rounded-xl border border-yellow-900/50 bg-yellow-950/20 p-4 text-sm text-yellow-400">
            <p className="font-semibold mb-1 flex items-center gap-2">
              <AlertCircle size={14} /> 評価データが未生成です
            </p>
            <pre className="text-xs text-yellow-500 bg-black/30 rounded p-2 overflow-x-auto">
              {`python3 analyze_cycles.py\nGEMINI_API_KEY=xxx python3 evaluate_performance.py`}
            </pre>
          </div>
        )}

        {/* ランキングバー */}
        {!loading && evalData?.ready && sorted.length > 0 && (
          <RankingBar sorted={sorted} colors={colorMap} />
        )}

        {/* 評価カード一覧（スコア降順） */}
        {evalData?.ready && sorted.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {sorted.map((ev, i) => (
              <EvalCard
                key={ev.forklift_id}
                ev={ev}
                summary={cycleMap[ev.forklift_id]}
                trajectory={trajMap[ev.forklift_id]}
                rank={i + 1}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
