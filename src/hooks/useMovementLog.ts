"use client";
import { useRef, useState, useEffect } from "react";
import type { NavPhase, RiskLevel } from "@/types";
import type { FlowPos } from "./useVideoStream";

export interface MovementPoint {
  x: number;
  y: number;
  risk: RiskLevel;
  navPhase: NavPhase | undefined;
  frameNumber: number;
  isPhaseChange: boolean;
}

export const MAP_SIZE = 200;

/**
 * 走行軌跡フック
 *
 * バックエンドがGeminiタイムライン + コサイン補間で構築した位置を
 * flowPos として直接受け取り、軌跡ログに追記する。
 * フロントでのLERPや座標計算は行わない（バックエンドが単一責務）。
 */

const MIN_STEP = 0.3;  // 記録最小ステップ(px)

export function useMovementLog(
  flowPos: FlowPos | null,
  risk: RiskLevel,
  navPhase: NavPhase | undefined,
  frameNumber: number,
): MovementPoint[] {
  const [log, setLog] = useState<MovementPoint[]>([]);
  const lastFrameRef = useRef(-1);
  const lastPhaseRef = useRef<NavPhase | undefined>(undefined);

  useEffect(() => {
    if (frameNumber === lastFrameRef.current) return;
    if (!flowPos) return;
    lastFrameRef.current = frameNumber;

    const isPhaseChange = navPhase !== undefined && navPhase !== lastPhaseRef.current;
    if (isPhaseChange) lastPhaseRef.current = navPhase;

    const { x, y } = flowPos;

    // マップ範囲内クランプ
    const cx = Math.max(5, Math.min(MAP_SIZE - 5, x));
    const cy = Math.max(5, Math.min(MAP_SIZE - 5, y));

    setLog(prev => {
      const last = prev[prev.length - 1];
      if (last && Math.abs(cx - last.x) < MIN_STEP && Math.abs(cy - last.y) < MIN_STEP) {
        return prev;
      }
      const next: MovementPoint = {
        x: cx, y: cy, risk, navPhase, frameNumber,
        isPhaseChange,
      };
      const trimmed = prev.length >= 800 ? prev.slice(-799) : prev;
      return [...trimmed, next];
    });
  }, [frameNumber, flowPos, risk, navPhase]);

  return log;
}
