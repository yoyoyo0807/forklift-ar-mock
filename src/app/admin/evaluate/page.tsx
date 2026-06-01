"use client";
import { useEffect, useState } from "react";
import { Star, TrendingUp, TrendingDown, RefreshCw, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

const API_BASE: string = (() => {
  if (typeof window === "undefined") return "http://localhost:8000";
  const ws = process.env.NEXT_PUBLIC_WS_URL;
  if (ws) return ws.replace(/^ws/, "http").replace(/\/ws\/.*/, "");
  return window.location.hostname === "localhost" ? "http://localhost:8000" : "";
})();

interface Evaluation {
  forklift_id: string;
  score: number;
  grade: string;
  good_points: string[];
  bad_points: string[];
  summary: string;
  recommendations: string[];
}

interface EvaluationResponse {
  ready: boolean;
  message?: string;
  generated_at?: string;
  model?: string;
  global_benchmark?: { avg_cycle_sec: number; total_cycles: number };
  evaluations: Evaluation[];
}

const GRADE_COLORS: Record<string, string> = {
  S: "text-yellow-300 bg-yellow-400/10 border-yellow-400/30",
  A: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  B: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  C: "text-orange-400 bg-orange-400/10 border-orange-400/30",
  D: "text-red-400 bg-red-400/10 border-red-400/30",
};

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${i <= score ? "bg-indigo-400" : "bg-gray-700"}`}
        />
      ))}
    </div>
  );
}

function EvalCard({ ev }: { ev: Evaluation }) {
  const gradeStyle = GRADE_COLORS[ev.grade] ?? "text-gray-400 bg-gray-400/10 border-gray-400/30";
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0a0f1a] p-5 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">{ev.forklift_id}</span>
          <ScoreDots score={ev.score} />
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold border ${gradeStyle}`}>
          {ev.grade}
        </span>
      </div>

      {/* サマリ */}
      <p className="text-sm text-gray-300 leading-relaxed">{ev.summary}</p>

      {/* 良い点 */}
      {ev.good_points.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp size={11} /> 良い点
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
          <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wider flex items-center gap-1">
            <TrendingDown size={11} /> 改善点
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
        <div className="pt-2 border-t border-gray-800 space-y-1">
          <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">推奨アクション</p>
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
    </div>
  );
}

export default function EvaluatePage() {
  const [data, setData] = useState<EvaluationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/evaluate`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: EvaluationResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const sorted = data?.evaluations.slice().sort((a, b) => b.score - a.score) ?? [];

  return (
    <div className="min-h-screen bg-[#050a14] text-white p-6">
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
          <button
            onClick={() => load().catch(() => {})}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            更新
          </button>
        </div>

        {/* メタ情報 */}
        {data?.ready && (
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span>モデル: <span className="text-gray-300">{data.model}</span></span>
            <span>生成日時: <span className="text-gray-300">{data.generated_at}</span></span>
            {data.global_benchmark && (
              <>
                <span>平均サイクル: <span className="text-emerald-400 font-bold">{data.global_benchmark.avg_cycle_sec}秒</span></span>
                <span>総サイクル数: <span className="text-gray-300">{data.global_benchmark.total_cycles}</span></span>
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
        {!loading && data && !data.ready && (
          <div className="rounded-xl border border-yellow-900/50 bg-yellow-950/20 p-4 text-sm text-yellow-400">
            <p className="font-semibold mb-1 flex items-center gap-2">
              <AlertCircle size={14} /> 評価データが未生成です
            </p>
            <p className="text-xs text-yellow-600 mb-2">バックエンドで以下を順番に実行してください:</p>
            <pre className="text-xs text-yellow-500 bg-black/30 rounded p-2 overflow-x-auto space-y-1">
              {`# 1. フォークリフト軌跡トラッキング（未実行の場合）
python3 track_forklifts.py /path/to/forklift_video.mp4

# 2. サイクル検出
python3 analyze_cycles.py

# 3. Gemini パフォーマンス評価
GEMINI_API_KEY=xxx python3 evaluate_performance.py`}
            </pre>
          </div>
        )}

        {/* 評価カード一覧 */}
        {!loading && data?.ready && sorted.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">評価データがありません</p>
        )}

        {data?.ready && sorted.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sorted.map(ev => (
              <EvalCard key={ev.forklift_id} ev={ev} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
