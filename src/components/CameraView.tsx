"use client";
import type { RiskLevel } from "@/types";

interface Props {
  frame: string | null;         // base64 JPEG（バックエンドが YOLO 描画済み）
  frameNumber: number;
  fps: number;
  risk: RiskLevel;
  status: string;
  statusMessage: string;
  detectionCount: number;
}

export function CameraView({ frame, frameNumber, fps, risk, status, statusMessage, detectionCount }: Props) {
  const isCritical = risk === "critical";
  const isStreaming = status === "streaming";

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-gray-950 ${isCritical ? "ar-glow-critical" : ""}`}
      style={{ aspectRatio: "16/9" }}
    >
      {/* YOLO11 アノテーション済みフレーム（バックエンドで描画） */}
      {frame ? (
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
        {isStreaming && (
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
          {isStreaming ? (
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
