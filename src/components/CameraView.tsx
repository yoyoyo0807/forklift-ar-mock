"use client";
import { useState } from "react";
import { PlayCircle } from "lucide-react";
import type { Detection, RiskLevel } from "@/types";

const STYLES: Record<string, { color: string; label: string; bg: string }> = {
  person:   { color: "#ef4444", label: "人物",           bg: "#ef444425" },
  forklift: { color: "#6366f1", label: "フォークリフト", bg: "#6366f125" },
  pallet:   { color: "#10b981", label: "パレット",       bg: "#10b98125" },
  obstacle: { color: "#f59e0b", label: "障害物",         bg: "#f59e0b25" },
};

const VIDEO_ID = "v8smZPFKH10";

interface Props {
  detections: Detection[];
  frame: number;
  fps: number;
  risk: RiskLevel;
}

export function CameraView({ detections, frame, fps, risk }: Props) {
  const [started, setStarted] = useState(false);
  const isCritical = risk === "critical";

  return (
    <div
      className={`relative rounded-xl overflow-hidden bg-gray-950 ${isCritical ? "ar-glow-critical" : ""}`}
      style={{ aspectRatio: "16/9" }}
    >
      {/* YouTube embed */}
      {started ? (
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${VIDEO_ID}&controls=1&rel=0&modestbranding=1`}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          title="フォークリフト操作映像"
        />
      ) : (
        /* Thumbnail with play button */
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
          <img
            src={`https://img.youtube.com/vi/${VIDEO_ID}/hqdefault.jpg`}
            alt="動画サムネイル"
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
          <button
            onClick={() => setStarted(true)}
            className="relative z-10 flex flex-col items-center gap-2 group"
          >
            <PlayCircle size={64} className="text-white/80 group-hover:text-white transition-colors drop-shadow-lg" />
            <span className="text-white/70 text-xs font-mono bg-black/50 px-3 py-1 rounded group-hover:text-white">
              クリックして解析開始
            </span>
          </button>
        </div>
      )}

      {/* AR Overlay — pointer-events:none でビデオ操作を妨げない */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {/* Scanline grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.05]" aria-hidden>
          <defs>
            <pattern id="cam-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#6366f1" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cam-grid)" />
        </svg>

        {/* Corner brackets */}
        {(["top-3 left-3", "top-3 right-3 rotate-90", "bottom-3 right-3 rotate-180", "bottom-3 left-3 -rotate-90"] as const).map((cls, i) => (
          <div key={i} className={`absolute ${cls} w-5 h-5 border-l-2 border-t-2 border-indigo-400/60`} />
        ))}

        {/* Center crosshair */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-10 h-10">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-emerald-400/25 -translate-x-1/2" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-emerald-400/25 -translate-y-1/2" />
            <div className="absolute inset-3 border border-emerald-400/25 rounded-full" />
          </div>
        </div>

        {/* Bounding boxes */}
        {detections.map((d) => {
          const s = STYLES[d.type];
          const pulse = d.type === "person" && isCritical;
          return (
            <div
              key={d.id}
              className="absolute transition-all duration-300 animate-fade-in"
              style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%` }}
            >
              <div className={`absolute inset-0 ${pulse ? "animate-pulse" : ""}`}>
                <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2" style={{ borderColor: s.color }} />
                <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2" style={{ borderColor: s.color }} />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2" style={{ borderColor: s.color }} />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2" style={{ borderColor: s.color }} />
                <div className="absolute inset-0" style={{ background: s.bg }} />
              </div>
              <div
                className="absolute -top-6 left-0 text-[10px] px-1.5 py-0.5 font-mono font-bold whitespace-nowrap rounded leading-none"
                style={{ background: s.color + "ee", color: "#fff", textShadow: "0 1px 2px #0008" }}
              >
                {s.label} {d.distance}m · {Math.round(d.confidence * 100)}%
              </div>
            </div>
          );
        })}

        {/* HUD top-left */}
        <div className="absolute top-3 left-8 font-mono text-[10px] space-y-1 text-emerald-300">
          <div className="bg-black/75 px-2 py-0.5 rounded backdrop-blur-sm">FRAME {String(frame).padStart(6, "0")}</div>
          <div className="bg-black/75 px-2 py-0.5 rounded backdrop-blur-sm">{fps} FPS · YOLO11 · {detections.length} 検出</div>
        </div>

        {/* REC top-right */}
        <div className="absolute top-3 right-8">
          <div className="flex items-center gap-1.5 bg-black/75 px-2 py-0.5 rounded text-[10px] font-mono text-red-400 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            ANALYZE
          </div>
        </div>

        {/* Critical border */}
        {isCritical && (
          <div className="absolute inset-0 border-2 border-red-500/90 animate-pulse rounded-xl" />
        )}
      </div>
    </div>
  );
}
