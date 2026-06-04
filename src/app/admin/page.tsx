"use client";
import { useEffect, useRef, useState } from "react";
import { Activity, ClipboardList, RefreshCw, Sparkles, Star } from "lucide-react";
import Link from "next/link";

// admin ページはローカル専用 — localhost では常にバックエンド直接接続
const API_BASE: string = (() => {
  if (typeof window === "undefined") return "http://localhost:8000";
  if (window.location.hostname === "localhost") return "http://localhost:8000";
  const ws = process.env.NEXT_PUBLIC_WS_URL;
  if (ws) return ws.replace(/^ws/, "http").replace(/\/ws\/.*/, "");
  return "";
})();

// バックエンド未設定（Vercel等のホスト型環境で localhost:8000 に到達不可）
const BACKEND_CONFIGURED = API_BASE !== "";

interface TrajectoryPoint {
  frame: number;
  x: number;
  y: number;
}

interface ForkliftTrajectory {
  id: string;
  color: string;
  samples: TrajectoryPoint[];
}

interface MapTransform {
  x_min: number;
  y_min: number;
  scale: number;
  margin: number;
  map_size: number;
}

interface MultiTrajectoryResponse {
  ready: boolean;
  message?: string;
  model?: string;
  generated_at?: string;
  forklift_count?: number;
  frame_w?: number;
  frame_h?: number;
  map_transform?: MapTransform;
  forklifts: ForkliftTrajectory[];
}

// マップ座標 → ピクセル座標の逆変換
function mapToPixel(mx: number, my: number, t: MapTransform): [number, number] {
  const px = (mx - t.margin) / t.scale + t.x_min;
  const py = (my - t.margin) / t.scale + t.y_min;
  return [px, py];
}

function ForkliftOverlay({
  forklifts,
  transform,
  frameW,
  frameH,
  currentFrame,
}: {
  forklifts: ForkliftTrajectory[];
  transform: MapTransform;
  frameW: number;
  frameH: number;
  currentFrame: number;
}) {
  // 再生中: 現在フレームまでのサンプルを使用、停止中: 全サンプル
  const RECENT_FRAMES = 600;  // 直近20秒分の軌跡をハイライト
  const MARKER_TIMEOUT = 300;

  function toPts(samples: TrajectoryPoint[]): string {
    return samples
      .map((s) => {
        const [px, py] = mapToPixel(s.x, s.y, transform);
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <svg
      viewBox={`0 0 ${frameW} ${frameH}`}
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {forklifts.map((fk) => {
        // 現在フレームまでのサンプル（再生中）or 全サンプル（停止中）
        const visible = currentFrame > 0
          ? fk.samples.filter((s) => s.frame <= currentFrame)
          : fk.samples;
        if (visible.length < 2) return null;

        // 全軌跡（背景に薄く表示）
        const allPts = toPts(visible);

        // 直近 RECENT_FRAMES の軌跡（太くハイライト）
        const recentSamples = currentFrame > 0
          ? visible.filter((s) => s.frame >= currentFrame - RECENT_FRAMES)
          : visible;
        const recentPts = toPts(recentSamples.length >= 2 ? recentSamples : visible);

        const last = visible[visible.length - 1];
        const [lx, ly] = mapToPixel(last.x, last.y, transform);
        const first = visible[0];
        const [fx, fy] = mapToPixel(first.x, first.y, transform);

        const isActive = currentFrame === 0 || (currentFrame - last.frame) < MARKER_TIMEOUT;

        return (
          <g key={fk.id}>
            {/* ① 全軌跡 — 薄いライン（全体の動線を常時表示） */}
            <polyline
              points={allPts}
              fill="none"
              stroke={fk.color}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.3}
            />
            {/* ② 直近軌跡 — 太いライン（最近の動きをハイライト） */}
            {recentSamples.length >= 2 && (
              <polyline
                points={recentPts}
                fill="none"
                stroke={fk.color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            )}
            {/* ③ スタートマーカー（静止表示のみ） */}
            {currentFrame === 0 && (
              <rect x={fx - 5} y={fy - 5} width={10} height={10} rx={2} fill={fk.color} opacity={0.9} />
            )}
            {/* ④ 現在位置マーカー */}
            {isActive && (
              <>
                <circle cx={lx} cy={ly} r={8} fill={fk.color} opacity={0.9} />
                <circle cx={lx} cy={ly} r={4} fill="white" opacity={0.9} />
                <text
                  x={lx + 12}
                  y={ly + 4}
                  fontSize={14}
                  fill={fk.color}
                  fontFamily="system-ui"
                  fontWeight="700"
                  stroke="#000"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {fk.id}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function AdminPage() {
  const [data, setData] = useState<MultiTrajectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const load = async () => {
    if (!BACKEND_CONFIGURED) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/trajectory`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MultiTrajectoryResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  // 動画の再生位置に合わせてフレーム番号を更新
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !data?.ready) return;

    const fps = 30;
    const onTimeUpdate = () => {
      setCurrentFrame(Math.floor(video.currentTime * fps));
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [data]);

  const frameW = data?.frame_w ?? 1280;
  const frameH = data?.frame_h ?? 720;
  const transform = data?.map_transform;

  return (
    <div className="min-h-screen bg-[#050a14] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="text-indigo-400" size={20} />
            <div>
              <h1 className="text-lg font-bold text-white">作業全体モニター</h1>
              <p className="text-xs text-gray-500">管理者向け — フォークリフト軌跡ビュー</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/evaluate"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-900/50 hover:bg-indigo-800/60 rounded-lg border border-indigo-700/50 text-indigo-300 transition-colors"
            >
              <Star size={11} />
              評価
            </Link>
            <Link
              href="/admin/instructions"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-900/50 hover:bg-indigo-800/60 rounded-lg border border-indigo-700/50 text-indigo-300 transition-colors"
            >
              <ClipboardList size={11} />
              指示
            </Link>
            <Link
              href="/admin/optimization"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-900/50 hover:bg-indigo-800/60 rounded-lg border border-indigo-700/50 text-indigo-300 transition-colors"
            >
              <Sparkles size={11} />
              最適化
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
        {data?.ready && (
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span>生成日時: <span className="text-gray-300">{data.generated_at}</span></span>
            <span>検出台数: <span className="text-emerald-400 font-bold">{data.forklift_count} 台</span></span>
            <span>フレーム: <span className="text-gray-300">{currentFrame}</span></span>
          </div>
        )}

        {/* バックエンド未接続（ホスト型環境）— 親切な案内 */}
        {!BACKEND_CONFIGURED && (
          <div className="rounded-xl border border-indigo-800/50 bg-indigo-950/20 p-6 space-y-3">
            <p className="text-sm font-semibold text-indigo-200">
              このビューはローカルのバックエンドが必要です
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              軌跡モニター・指示・評価はリアルタイム解析バックエンド（<code className="text-indigo-300">localhost:8000</code>）に接続して動作します。
              この公開環境ではバックエンドが稼働していないため表示できません。
              <br />
              最適化シミュレーションの結果は、バックエンド不要で「最適化」タブからご覧いただけます。
            </p>
            <Link
              href="/admin/optimization"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-700 hover:bg-indigo-600 rounded-lg text-white transition-colors"
            >
              <Sparkles size={12} />
              最適化シミュレーションを見る
            </Link>
          </div>
        )}

        {/* 動画 + SVG 重ねエリア */}
        {data?.ready && transform && (
          <div className="rounded-xl overflow-hidden border border-gray-800 bg-black">
            <div className="relative" style={{ aspectRatio: `${frameW} / ${frameH}` }}>
              {/* 動画 */}
              <video
                ref={videoRef}
                src="/forklift_video.mp4"
                controls
                autoPlay
                muted
                loop
                className="w-full h-full object-contain"
                playsInline
              />
              {/* 軌跡オーバーレイ */}
              <ForkliftOverlay
                forklifts={data.forklifts}
                transform={transform}
                frameW={frameW}
                frameH={frameH}
                currentFrame={currentFrame}
              />
            </div>
          </div>
        )}

        {/* ローディング */}
        {BACKEND_CONFIGURED && loading && (
          <div className="text-center text-sm text-gray-500 py-12">読み込み中...</div>
        )}

        {/* エラー */}
        {BACKEND_CONFIGURED && !loading && error && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-400">
            バックエンドに接続できません: {error}
          </div>
        )}

        {/* 未生成 */}
        {!loading && data && !data.ready && (
          <div className="rounded-xl border border-yellow-900/50 bg-yellow-950/20 p-4 text-sm text-yellow-400">
            <p className="font-semibold mb-1">軌跡データが未生成です</p>
            <pre className="mt-2 text-xs text-yellow-500 bg-black/30 rounded p-2 overflow-x-auto">
              python3 track_forklifts.py /path/to/forklift_video.mp4
            </pre>
          </div>
        )}

        {/* フォークリフト凡例 */}
        {data?.ready && data.forklifts.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-[#0a0f1a] p-4">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
              フォークリフト一覧
            </p>
            <div className="flex flex-wrap gap-3">
              {data.forklifts.map((fk) => (
                <div key={fk.id} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: fk.color }}
                  />
                  <span className="font-bold" style={{ color: fk.color }}>{fk.id}</span>
                  <span className="text-gray-600">{fk.samples.length}pt</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
