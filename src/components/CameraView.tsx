"use client";
import type { Detection, RiskLevel } from "@/types";

const STYLES: Record<string, { color: string; label: string; bg: string }> = {
  person:   { color: "#ef4444", label: "人物",             bg: "#ef444420" },
  forklift: { color: "#6366f1", label: "フォークリフト",   bg: "#6366f120" },
  pallet:   { color: "#10b981", label: "パレット",         bg: "#10b98120" },
  obstacle: { color: "#f59e0b", label: "障害物",           bg: "#f59e0b20" },
};

interface Props {
  detections: Detection[];
  frame: number;
  fps: number;
  risk: RiskLevel;
}

export function CameraView({ detections, frame, fps, risk }: Props) {
  const isCritical = risk === "critical";

  return (
    <div className={`relative bg-gray-950 rounded-xl overflow-hidden scanline ${isCritical ? "ar-glow-critical" : ""}`} style={{ aspectRatio: "16/9" }}>
      {/* Grid overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.07]" aria-hidden>
        <defs>
          <pattern id="cam-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#6366f1" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cam-grid)" />
      </svg>

      {/* Corner brackets */}
      {(["top-3 left-3", "top-3 right-3 rotate-90", "bottom-3 right-3 rotate-180", "bottom-3 left-3 -rotate-90"] as const).map((cls, i) => (
        <div key={i} className={`absolute ${cls} w-5 h-5 border-l-2 border-t-2 border-indigo-500/50`} />
      ))}

      {/* Center crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-10 h-10">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-emerald-500/30 -translate-x-1/2" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-emerald-500/30 -translate-y-1/2" />
          <div className="absolute inset-3 border border-emerald-500/30 rounded-full" />
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
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2" style={{ borderColor: s.color }} />
              <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2" style={{ borderColor: s.color }} />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2" style={{ borderColor: s.color }} />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2" style={{ borderColor: s.color }} />
              <div className="absolute inset-0" style={{ background: s.bg }} />
            </div>
            <div
              className="absolute -top-6 left-0 text-[10px] px-1.5 py-0.5 font-mono font-bold whitespace-nowrap rounded leading-none"
              style={{ background: s.color + "dd", color: "#fff" }}
            >
              {s.label} {d.distance}m · {Math.round(d.confidence * 100)}%
            </div>
          </div>
        );
      })}

      {/* HUD - top left */}
      <div className="absolute top-3 left-8 font-mono text-[10px] space-y-1 text-emerald-400">
        <div className="bg-black/70 px-2 py-0.5 rounded">FRAME {String(frame).padStart(6, "0")}</div>
        <div className="bg-black/70 px-2 py-0.5 rounded">{fps} FPS · {detections.length} 物体検出</div>
      </div>

      {/* REC - top right */}
      <div className="absolute top-3 right-8">
        <div className="flex items-center gap-1.5 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono text-red-400">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          REC
        </div>
      </div>

      {/* Critical border flash */}
      {isCritical && (
        <div className="absolute inset-0 border-2 border-red-500/80 animate-pulse rounded-xl pointer-events-none" />
      )}

      {/* Empty state */}
      {detections.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-3 opacity-30">🚛</div>
            <p className="text-gray-700 text-xs font-mono tracking-widest">AREA CLEAR</p>
          </div>
        </div>
      )}
    </div>
  );
}
