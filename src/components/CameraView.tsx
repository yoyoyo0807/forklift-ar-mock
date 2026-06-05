"use client";
import { useRef, useState } from "react";
import type { RiskLevel } from "@/types";

interface Props {
  frame: string | null;
  frameNumber: number;
  fps: number;
  risk: RiskLevel;
  status: string;
  statusMessage: string;
  detectionCount: number;
  /** イントロ（新動画）を再生中か */
  introActive?: boolean;
  /** イントロ動画のソースパス */
  introSrc?: string;
  /** イントロ動画のフレーム番号を親へ通知（後でパネル連動に使う） */
  onIntroFrame?: (frameNumber: number) => void;
  /** イントロ動画の再生終了 */
  onIntroEnded?: () => void;
}

/** 新動画は 30fps 想定でフレーム番号を算出する */
const INTRO_FPS = 30;

function parseAnalysisProgress(msg: string): { pct: number; done: number; total: number } | null {
  const m = msg.match(/(\d+)\/(\d+)[^\d]*\((\d+)%\)/);
  if (!m) return null;
  return { done: parseInt(m[1]), total: parseInt(m[2]), pct: parseInt(m[3]) };
}

export function CameraView({
  frame, frameNumber, fps, risk, status, statusMessage, detectionCount,
  introActive, introSrc, onIntroFrame, onIntroEnded,
}: Props) {
  const isCritical  = risk === "critical";
  const isAnalyzing = !introActive && status === "analyzing";
  const isStreaming  = !introActive && (status === "streaming" || frame !== null) && !isAnalyzing;
  const progress     = isAnalyzing ? parseAnalysisProgress(statusMessage) : null;

  const introVideoRef = useRef<HTMLVideoElement>(null);
  const [introFrame, setIntroFrame] = useState(0);

  const handleIntroTimeUpdate = () => {
    const v = introVideoRef.current;
    if (!v) return;
    const f = Math.floor(v.currentTime * INTRO_FPS);
    setIntroFrame(f);
    onIntroFrame?.(f);
  };

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-gray-950 ${isCritical ? "ar-glow-critical" : ""}`}
      style={{ aspectRatio: "16/9" }}
    >
      {/* イントロ（新動画・AR焼き込み済み） */}
      {introActive && introSrc ? (
        <video
          ref={introVideoRef}
          src={introSrc}
          autoPlay
          muted
          playsInline
          onTimeUpdate={handleIntroTimeUpdate}
          onEnded={() => onIntroEnded?.()}
          className="absolute inset-0 w-full h-full object-contain bg-black"
        />
      ) : /* YOLO11 アノテーション済みフレーム（バックエンドで描画） */
      frame ? (
        <img
          src={`data:image/jpeg;base64,${frame}`}
          className="absolute inset-0 w-full h-full object-cover"
          alt="YOLO解析フレーム"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {status === "downloading" ? (
            <>
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500 font-mono">{statusMessage}</p>
            </>
          ) : status === "connecting" ? (
            <>
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500 font-mono">{statusMessage}</p>
            </>
          ) : status === "error" ? (
            <>
              <p className="text-red-400 text-sm font-mono">⚠ {statusMessage}</p>
              <p className="text-gray-600 text-xs">バックエンドが起動しているか確認してください</p>
            </>
          ) : (
            <>
              <span className="text-5xl opacity-20">🚛</span>
              <p className="text-gray-700 text-xs font-mono tracking-widest">AWAITING STREAM</p>
            </>
          )}
        </div>
      )}

      {/* 事前解析中オーバーレイ */}
      {isAnalyzing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gray-950/95 z-20">
          <div className="text-indigo-400 text-xs font-mono tracking-widest uppercase mb-1">
            Gemini Vision 解析中
          </div>
          {/* パーセント */}
          <div className="text-5xl font-bold font-mono text-white tabular-nums">
            {progress ? `${progress.pct}` : "0"}
            <span className="text-2xl text-gray-400">%</span>
          </div>
          {/* プログレスバー */}
          <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progress?.pct ?? 0}%` }}
            />
          </div>
          {/* フレーム数 */}
          <div className="text-gray-500 text-xs font-mono">
            {progress ? `${progress.done} / ${progress.total} フレーム解析済み` : "初期化中..."}
          </div>
          {/* スピナー */}
          <div className="mt-2 w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* AR HUD オーバーレイ（pointer-events:none） */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {/* グリッド */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" aria-hidden>
          <defs>
            <pattern id="cam-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#6366f1" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cam-grid)" />
        </svg>

        {/* コーナーブラケット */}
        {(["top-3 left-3","top-3 right-3 rotate-90","bottom-3 right-3 rotate-180","bottom-3 left-3 -rotate-90"] as const).map((cls, i) => (
          <div key={i} className={`absolute ${cls} w-5 h-5 border-l-2 border-t-2 border-indigo-400/50`} />
        ))}

        {/* HUD 左上 */}
        {introActive ? (
          <div className="absolute top-3 left-8 font-mono text-[10px] space-y-1 text-indigo-300">
            <div className="bg-black/75 px-2 py-0.5 rounded backdrop-blur-sm">
              FRAME {String(introFrame).padStart(6, "0")}
            </div>
            <div className="bg-black/75 px-2 py-0.5 rounded backdrop-blur-sm">
              荷物認識デモ
            </div>
          </div>
        ) : isStreaming && (
          <div className="absolute top-3 left-8 font-mono text-[10px] space-y-1 text-emerald-300">
            <div className="bg-black/75 px-2 py-0.5 rounded backdrop-blur-sm">
              FRAME {String(frameNumber).padStart(6, "0")}
            </div>
            <div className="bg-black/75 px-2 py-0.5 rounded backdrop-blur-sm">
              YOLO11 · {fps}fps · {detectionCount}件検出
            </div>
          </div>
        )}

        {/* REC / LIVE 右上 */}
        <div className="absolute top-3 right-8">
          {introActive ? (
            <div className="flex items-center gap-1.5 bg-black/75 px-2 py-0.5 rounded text-[10px] font-mono text-indigo-400 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              AR DEMO
            </div>
          ) : isStreaming ? (
            <div className="flex items-center gap-1.5 bg-black/75 px-2 py-0.5 rounded text-[10px] font-mono text-red-400 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE ANALYSIS
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-black/75 px-2 py-0.5 rounded text-[10px] font-mono text-gray-600 backdrop-blur-sm">
              OFFLINE
            </div>
          )}
        </div>

        {/* CRITICAL 点滅ボーダー */}
        {isCritical && (
          <div className="absolute inset-0 border-2 border-red-500/90 animate-pulse rounded-xl" />
        )}
      </div>
    </div>
  );
}
