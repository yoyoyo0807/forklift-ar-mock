"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { AlertEntry, GuidanceResult, MastInfo, NavInfo, OperatorState, RiskLevel } from "@/types";

/** 切断後の自動再接続待機時間 */
const RECONNECT_DELAY_MS = 4000;

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

  const wsRef              = useRef<WebSocket | null>(null);
  const alertIdRef         = useRef(0);
  const lastRiskRef        = useRef<RiskLevel>("safe");
  const reconnectTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(false); // ユーザーが明示的に切断した場合は false

  /** WebSocket にハンドラーを設定する共通関数（初回接続 & 再接続で使い回す） */
  const attachHandlers = useCallback((ws: WebSocket) => {
    ws.onopen = () => {
      setState(s => ({ ...s, status: "connecting", statusMessage: "接続完了。解析開始を待機中..." }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string);

      if (msg.type === "superseded") {
        // 新しい接続に置き換えられた → 自動再接続しない
        shouldReconnectRef.current = false;
        setState(s => ({ ...s, status: "disconnected", statusMessage: "別の接続に切り替わりました", frame: null, fps: 0 }));
        return;
      }

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
        setState(s => ({ ...s, status: "error", statusMessage: msg.message as string }));
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
            frame:         msg.frame,
            detections:    msg.detections ?? [],
            operatorState: msg.operator_state
              ? {
                  ...msg.operator_state,
                  gemini_fatigue: msg.operator_fatigue ?? false,
                  gemini_ppe:     msg.operator_ppe     ?? true,
                }
              : s.operatorState
                ? {
                    ...s.operatorState,
                    gemini_fatigue: msg.operator_fatigue ?? s.operatorState.gemini_fatigue ?? false,
                    gemini_ppe:     msg.operator_ppe     ?? s.operatorState.gemini_ppe     ?? true,
                  }
                : null,
            risk,
            guidance:      msg.guidance ?? s.guidance,
            frameNumber:   msg.frame_number ?? s.frameNumber,
            fps:           msg.fps ?? s.fps,
            status:        "streaming",
            statusMessage: "解析中",
            alerts:        newAlerts,
            navInfo:       msg.nav_info  ?? s.navInfo,
            mastInfo:      msg.mast_info ?? s.mastInfo,
          };
        });
      }
    };

    ws.onerror = () => {
      setState(s => ({ ...s, status: "error", statusMessage: "接続エラー" }));
    };

    ws.onclose = () => {
      // フレームをリセット — 最後の静止フレームが「凍結」して見えるのを防ぐ
      setState(s => ({
        ...s,
        status:        "disconnected",
        statusMessage: "切断されました",
        frame:         null,
        fps:           0,
      }));

      // 自動再接続（ユーザーが明示的に disconnect() した場合は除く）
      if (shouldReconnectRef.current && WS_URL) {
        reconnectTimerRef.current = setTimeout(() => {
          if (!shouldReconnectRef.current) return;
          setState(s => ({ ...s, status: "connecting", statusMessage: "再接続中..." }));
          const wsNew = new WebSocket(WS_URL);
          wsRef.current = wsNew;
          attachHandlers(wsNew);
        }, RECONNECT_DELAY_MS);
      }
    };
  }, []); // attachHandlers は再作成しない（setState は安定した参照）

  const connect = useCallback(() => {
    if (!WS_URL) {
      setState(s => ({ ...s, status: "error", statusMessage: "NEXT_PUBLIC_WS_URL が設定されていません" }));
      return;
    }
    // OPEN・CONNECTING 両方でスキップ（React StrictMode の二重マウント対策）
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) return;

    // 既存の再接続タイマーをクリア
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    shouldReconnectRef.current = true;
    setState(s => ({ ...s, status: "connecting", statusMessage: "バックエンドに接続中..." }));

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    attachHandlers(ws);
  }, [attachHandlers]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false; // 自動再接続を止める
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setState(s => ({ ...s, status: "disconnected", frame: null, fps: 0 }));
  }, []);

  // アンマウント時にクリーンアップ
  useEffect(() => () => {
    shouldReconnectRef.current = false;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close();
  }, []);

  return { ...state, connect, disconnect };
}
