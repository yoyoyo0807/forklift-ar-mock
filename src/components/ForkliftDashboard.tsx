"use client";
import { useState, useEffect } from "react";
import { Users, Construction, Box, Warehouse, ShieldAlert, AlertTriangle, CheckCircle, Info, Wifi, WifiOff, Glasses, LayoutDashboard } from "lucide-react";
import { useVideoStream } from "@/hooks/useVideoStream";
import { CameraView } from "./CameraView";
import { GuidancePanel } from "./GuidancePanel";
import { AlertLog } from "./AlertLog";
import { OperatorPanel } from "./OperatorPanel";
import { SmartGlassHUD } from "./SmartGlassHUD";
import { NavInfoPanel } from "./NavInfoPanel";
import type { RiskLevel } from "@/types";

const RISK_CONFIG: Record<RiskLevel, { labelJa: string; color: string; bg: string; icon: React.ReactNode }> = {
  critical: { labelJa: "緊急停止",  color: "#ef4444", bg: "bg-red-950/60 border-red-700",         icon: <ShieldAlert size={18} className="text-red-400" /> },
  warning:  { labelJa: "要注意",    color: "#f59e0b", bg: "bg-amber-950/50 border-amber-700",     icon: <AlertTriangle size={18} className="text-amber-400" /> },
  safe:     { labelJa: "安全運行",  color: "#10b981", bg: "bg-emerald-950/40 border-emerald-800", icon: <CheckCircle size={18} className="text-emerald-400" /> },
  info:     { labelJa: "情報",      color: "#6366f1", bg: "bg-indigo-950/40 border-indigo-700",   icon: <Info size={18} className="text-indigo-400" /> },
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

const DETECT_COLORS: Record<string, string> = {
  person: "#ef4444", forklift: "#6366f1", pallet: "#10b981", obstacle: "#f59e0b",
};

type ViewMode = "dashboard" | "smartglass";

export function ForkliftDashboard() {
  const stream = useVideoStream();
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const cfg = RISK_CONFIG[stream.risk];
  const isConnected = stream.status === "streaming" || stream.status === "downloading" || stream.status === "connecting" || stream.status === "analyzing";

  // ページロード時に自動接続
  useEffect(() => {
    stream.connect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-screen bg-bg text-gray-100 overflow-hidden">
      {/* ヘッダー */}
      <header className="shrink-0 flex items-center justify-between px-5 h-12 bg-surface border-b border-border-default">
        <div className="flex items-center gap-3">
          <span className="text-lg">🚛</span>
          <span className="font-bold text-sm tracking-wider text-gray-200">FORKLIFT AR ASSIST</span>
          <span className="text-gray-700 text-xs hidden sm:block">— YOLO11 + Gemini 2.0 Flash</span>
        </div>
        <div className="flex items-center gap-3">
          {/* リスクインジケーター */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-semibold transition-all duration-300 ${cfg.bg}`}>
            {cfg.icon}
            <span style={{ color: cfg.color }}>{cfg.labelJa}</span>
          </div>

          {/* ビュー切り替えトグル */}
          <div className="flex items-center bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <button
              onClick={() => setViewMode("dashboard")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "dashboard"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              title="ダッシュボード"
            >
              <LayoutDashboard size={12} />
              <span className="hidden sm:block">ダッシュボード</span>
            </button>
            <button
              onClick={() => setViewMode("smartglass")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === "smartglass"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              title="スマートグラス HUD"
            >
              <Glasses size={12} />
              <span className="hidden sm:block">スマートグラス</span>
            </button>
          </div>

          {/* 接続ボタン */}
          <button
            onClick={isConnected ? stream.disconnect : stream.connect}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isConnected
                ? "bg-red-950/50 border-red-800 text-red-400 hover:bg-red-900/50"
                : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500"
            }`}
          >
            {isConnected ? <WifiOff size={12} /> : <Wifi size={12} />}
            {isConnected ? "切断" : "解析開始"}
          </button>
        </div>
      </header>

      {/* ── スマートグラスモード ── */}
      {viewMode === "smartglass" ? (
        <main className="flex-1 min-h-0 p-4 flex flex-col gap-3">
          <SmartGlassHUD
            frame={stream.frame}
            risk={stream.risk}
            operator={stream.operatorState}
            detections={stream.detections}
            guidance={stream.guidance}
            frameNumber={stream.frameNumber}
            fps={stream.fps}
          />
          {stream.guidance && (
            <div className="shrink-0 bg-surface rounded-xl border border-border-default px-4 py-3 flex items-center gap-3">
              {cfg.icon}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-200 truncate">{stream.guidance.guidance}</p>
                <p className="text-xs text-gray-500 truncate">{stream.guidance.detail}</p>
              </div>
            </div>
          )}
        </main>
      ) : (
        /* ── ダッシュボードモード ── */
        <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 p-4">
          {/* 左: カメラビュー */}
          <div className="flex flex-col gap-3 min-h-0">
            <CameraView
              frame={stream.frame}
              frameNumber={stream.frameNumber}
              fps={stream.fps}
              risk={stream.risk}
              status={stream.status}
              statusMessage={stream.statusMessage}
              detectionCount={stream.detections.length}
            />

            {/* スタット行 */}
            <div className="grid grid-cols-4 gap-3">
              {([
                { label: "危険度",   value: cfg.labelJa,                             color: cfg.color   },
                { label: "検出物体", value: `${stream.detections.length}件`,          color: "#94a3b8"   },
                { label: "フレーム", value: String(stream.frameNumber),               color: "#94a3b8"   },
                { label: "FPS",      value: stream.fps > 0 ? `${stream.fps}` : "-",  color: stream.fps >= 8 ? "#10b981" : "#f59e0b" },
              ] as const).map(({ label, value, color }) => (
                <div key={label} className="bg-surface rounded-lg px-3 py-2 border border-border-default">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-sm font-mono font-semibold" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 右: パネル群 */}
          <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">
            {/* AI ガイダンス */}
            <GuidancePanel
              guidance={stream.guidance}
              loading={stream.status === "connecting"}
              updatedAt={stream.guidance ? new Date() : null}
            />

            {/* 操作者モニタリング */}
            <OperatorPanel
              operator={stream.operatorState}
              streaming={isConnected}
            />

            {/* 検出リスト */}
            <div className="bg-surface rounded-xl border border-border-default p-4">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">現在の検出物体</p>
              {stream.detections.length === 0 ? (
                <p className="text-xs text-gray-700 text-center py-4">検出なし</p>
              ) : (
                <div className="space-y-2.5">
                  {stream.detections.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 text-xs animate-fade-in">
                      <span className="text-gray-600 shrink-0">{DETECT_ICONS[d.type]}</span>
                      <span className="text-gray-300 font-medium">{DETECT_LABELS[d.type] ?? d.type}</span>
                      {(d as { pose_warning?: boolean }).pose_warning && (
                        <span className="text-red-400 text-[10px] font-bold">転倒</span>
                      )}
                      <span className="ml-auto font-mono text-gray-400">{d.distance}m</span>
                      <div className="w-14 h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${d.confidence * 100}%`, background: DETECT_COLORS[d.type] ?? "#94a3b8" }}
                        />
                      </div>
                      <span className="font-mono text-gray-600 text-[10px]">{Math.round(d.confidence * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 積載ナビ */}
            <NavInfoPanel navInfo={stream.navInfo} mastInfo={stream.mastInfo} />

            {/* アラートログ */}
            <div className="bg-surface rounded-xl border border-border-default p-4 flex flex-col min-h-[120px]">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3 shrink-0">アラートログ</p>
              <AlertLog alerts={stream.alerts} />
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
