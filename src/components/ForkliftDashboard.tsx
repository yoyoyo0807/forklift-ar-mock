"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, CheckCircle, Info, ShieldAlert, Users, Box, Warehouse, Construction } from "lucide-react";
import { useSimulation } from "@/hooks/useSimulation";
import { CameraView } from "./CameraView";
import { GuidancePanel } from "./GuidancePanel";
import { AlertLog } from "./AlertLog";
import type { AlertEntry, GuidanceResult, RiskLevel } from "@/types";

const RISK_CONFIG: Record<RiskLevel, { label: string; labelJa: string; color: string; bg: string; icon: React.ReactNode }> = {
  critical: { label: "CRITICAL", labelJa: "緊急停止",  color: "#ef4444", bg: "bg-red-950/60 border-red-700",     icon: <ShieldAlert size={20} className="text-red-400" /> },
  warning:  { label: "WARNING",  labelJa: "要注意",    color: "#f59e0b", bg: "bg-amber-950/50 border-amber-700", icon: <AlertTriangle size={20} className="text-amber-400" /> },
  safe:     { label: "SAFE",     labelJa: "安全運行",  color: "#10b981", bg: "bg-emerald-950/40 border-emerald-800", icon: <CheckCircle size={20} className="text-emerald-400" /> },
  info:     { label: "INFO",     labelJa: "情報",      color: "#6366f1", bg: "bg-indigo-950/40 border-indigo-700", icon: <Info size={20} className="text-indigo-400" /> },
};

const DETECT_ICONS: Record<string, React.ReactNode> = {
  person:   <Users size={12} />,
  forklift: <Construction size={12} />,
  pallet:   <Box size={12} />,
  obstacle: <Warehouse size={12} />,
};

const DETECT_LABELS: Record<string, string> = {
  person: "人物", forklift: "フォークリフト", pallet: "パレット", obstacle: "障害物",
};

function now() {
  return new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ForkliftDashboard() {
  const scene = useSimulation();
  const [guidance, setGuidance] = useState<GuidanceResult | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const alertIdRef = useRef(0);
  const lastRiskRef = useRef<RiskLevel>("safe");
  const lastCallRef = useRef(0);

  // Add alert when risk level changes
  useEffect(() => {
    if (scene.risk !== lastRiskRef.current) {
      const newAlert: AlertEntry = {
        id: ++alertIdRef.current,
        time: now(),
        message: scene.detections.length > 0
          ? `${DETECT_LABELS[scene.detections[0].type]}を検出（${scene.detections[0].distance}m）`
          : "エリアクリア",
        level: scene.risk,
      };
      setAlerts(prev => [newAlert, ...prev.slice(0, 9)]);
      lastRiskRef.current = scene.risk;
    }
  }, [scene.risk, scene.detections]);

  // Call Gemini every 5s
  const fetchGuidance = useCallback(async () => {
    const now = Date.now();
    if (now - lastCallRef.current < 5000) return;
    lastCallRef.current = now;
    setGuidanceLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detections: scene.detections, risk: scene.risk }),
      });
      if (res.ok) {
        const data: GuidanceResult = await res.json();
        setGuidance(data);
        setUpdatedAt(new Date());
      }
    } finally {
      setGuidanceLoading(false);
    }
  }, [scene.detections, scene.risk]);

  useEffect(() => {
    fetchGuidance();
  }, [fetchGuidance]);

  const cfg = RISK_CONFIG[scene.risk];

  return (
    <div className="flex flex-col h-screen bg-bg text-gray-100 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-5 h-12 bg-surface border-b border-border-default">
        <div className="flex items-center gap-3">
          <span className="text-lg">🚛</span>
          <span className="font-bold text-sm tracking-wider text-gray-200">FORKLIFT AR ASSIST</span>
          <span className="text-gray-700 text-xs hidden sm:block">— 操作支援システム v0.1</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-semibold transition-all duration-300 ${cfg.bg}`}>
            {cfg.icon}
            <span style={{ color: cfg.color }}>{cfg.labelJa}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 p-4">
        {/* Left: Camera */}
        <div className="flex flex-col gap-3 min-h-0">
          <CameraView
            detections={scene.detections}
            frame={scene.frame}
            fps={scene.fps}
            risk={scene.risk}
          />

          {/* Stat row */}
          <div className="grid grid-cols-4 gap-3">
            {([
              { label: "危険度",   value: cfg.label,                   color: cfg.color },
              { label: "検出物体", value: `${scene.detections.length}件`, color: "#94a3b8" },
              { label: "フレーム", value: String(scene.frame),          color: "#94a3b8" },
              { label: "FPS",      value: `${scene.fps} fps`,          color: scene.fps >= 28 ? "#10b981" : "#f59e0b" },
            ] as const).map(({ label, value, color }) => (
              <div key={label} className="bg-surface rounded-lg px-3 py-2 border border-border-default">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-sm font-mono font-semibold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Panels */}
        <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">
          {/* Guidance */}
          <GuidancePanel guidance={guidance} loading={guidanceLoading} updatedAt={updatedAt} />

          {/* Detections */}
          <div className="bg-surface rounded-xl border border-border-default p-4">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">現在の検出</p>
            {scene.detections.length === 0 ? (
              <p className="text-xs text-gray-700 text-center py-4">検出なし</p>
            ) : (
              <div className="space-y-2">
                {scene.detections.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-xs animate-fade-in">
                    <span className="text-gray-600">{DETECT_ICONS[d.type]}</span>
                    <span className="text-gray-300 font-medium">{DETECT_LABELS[d.type]}</span>
                    <span className="ml-auto font-mono text-gray-400">{d.distance}m</span>
                    <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${d.confidence * 100}%`,
                          background: d.type === "person" ? "#ef4444" : d.type === "obstacle" ? "#f59e0b" : "#10b981",
                        }}
                      />
                    </div>
                    <span className="font-mono text-gray-600 text-[10px]">{Math.round(d.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alert log */}
          <div className="bg-surface rounded-xl border border-border-default p-4 flex flex-col min-h-[120px]">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3 shrink-0">
              アラートログ
            </p>
            <AlertLog alerts={alerts} />
          </div>
        </div>
      </main>
    </div>
  );
}
