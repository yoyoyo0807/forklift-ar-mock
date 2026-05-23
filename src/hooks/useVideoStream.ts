"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { AlertEntry, GuidanceResult, MastInfo, NavInfo, OperatorState, RiskLevel } from "@/types";

export interface StreamState {
  frame: string | null;        // base64 JPEG
  detections: Detection[];
  operatorState: OperatorState | null;
  risk: RiskLevel;
  guidance: GuidanceResult | null;
  frameNumber: number;
  fps: number;
  status: "connecting" | "downloading" | "streaming" | "error" | "disconnected";
  statusMessage: string;
  alerts: AlertEntry[];
  navInfo: NavInfo | null;
  mastInfo: MastInfo | null;
}

interface Detection {
  id: string;
  type: string;
  x: number; y: number; w: number; h: number;
  distance: number;
  confidence: number;
  pose_warning: boolean;
}

const WS_URL =
  (typeof window !== "undefined" &&
    (process.env.NEXT_PUBLIC_WS_URL ||
      (window.location.hostname === "localhost"
        ? "ws://localhost:8000/ws/analyze"
        : null))) ||
  null;

export function useVideoStream(): StreamState & { connect: () => void; disconnect: () => void } {
  const [state, setState] = useState<StreamState>({
    frame: null,
    detections: [],
    operatorState: null,
    risk: "safe",
    guidance: null,
    frameNumber: 0,
    fps: 0,
    status: "disconnected",
    statusMessage: "接続待ち",
    alerts: [],
    navInfo: null,
    mastInfo: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const alertIdRef = useRef(0);
  const lastRiskRef = useRef<RiskLevel>("safe");

  const connect = useCallback(() => {
    if (!WS_URL) {
      setState(s => ({ ...s, status: "error", statusMessage: "NEXT_PUBLIC_WS_URL が設定されていません" }));
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setState(s => ({ ...s, status: "connecting", statusMessage: "バックエンドに接続中..." }));

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string);

      if (msg.type === "status") {
        const isDownloading = (msg.message as string).includes("ダウンロード");
        setState(s => ({
          ...s,
          status: isDownloading ? "downloading" : "streaming",
          statusMessage: msg.message,
        }));
        return;
      }

      if (msg.type === "error") {
        setState(s => ({ ...s, status: "error", statusMessage: msg.message }));
        return;
      }

      if (msg.type === "frame") {
        const risk = msg.risk as RiskLevel;

        setState(s => {
          let newAlerts = s.alerts;
          if (risk !== lastRiskRef.current) {
            lastRiskRef.current = risk;
            const firstDet = msg.detections?.[0];
            const message = firstDet
              ? `${firstDet.type}を検出（${firstDet.distance}m）`
              : "エリアクリア";
            const entry: AlertEntry = {
              id: ++alertIdRef.current,
              time: new Date().toLocaleTimeString("ja-JP"),
              message,
              level: risk,
            };
            newAlerts = [entry, ...s.alerts.slice(0, 9)];
          }
          return {
            ...s,
            frame: msg.frame,
            detections: msg.detections ?? [],
            operatorState: msg.operator_state ?? s.operatorState,
            risk,
            guidance: msg.guidance ?? s.guidance,
            frameNumber: msg.frame_number ?? s.frameNumber,
            fps: msg.fps ?? s.fps,
            status: "streaming",
            statusMessage: "解析中",
            alerts: newAlerts,
            navInfo: msg.nav_info ?? s.navInfo,
            mastInfo: msg.mast_info ?? s.mastInfo,
          };
        });
      }
    };

    ws.onopen = () => setState(s => ({ ...s, status: "connecting", statusMessage: "接続完了。解析開始を待機中..." }));
    ws.onerror = () => setState(s => ({ ...s, status: "error", statusMessage: "接続エラー" }));
    ws.onclose = () => setState(s => ({ ...s, status: "disconnected", statusMessage: "切断されました" }));
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setState(s => ({ ...s, status: "disconnected", frame: null }));
  }, []);

  useEffect(() => () => { wsRef.current?.close(); }, []);

  return { ...state, connect, disconnect };
}
