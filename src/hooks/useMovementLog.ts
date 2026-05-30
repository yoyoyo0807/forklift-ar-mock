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
 * オプティカルフロー座標をそのままログに蓄積するフック。
 *
 * バックエンドが Lucas-Kanade フローで計算した正規化済み (x, y) を受け取り、
 * 軌跡ポイントとして記録する。Dead Reckoning / ウェイポイント方式は廃止。
 */
export function useMovementLog(
  flowPos: FlowPos | null,
  risk: RiskLevel,
  navPhase: NavPhase | undefined,
  frameNumber: number,
): MovementPoint[] {
  const [log, setLog] = useState<MovementPoint[]>(() => []);

  const lastFrameRef  = useRef(-1);
  const lastPhaseRef  = useRef<NavPhase | undefined>(undefined);

  useEffect(() => {
    if (!flowPos) return;
    if (frameNumber === lastFrameRef.current) return;
    lastFrameRef.current = frameNumber;

    const isPhaseChange = navPhase !== undefined && navPhase !== lastPhaseRef.current;
    if (isPhaseChange) lastPhaseRef.current = navPhase;

    setLog(prev => {
      // 位置が前回とほぼ同じならスキップ（停止中の重複点を除去）
      const last = prev[prev.length - 1];
      if (last && Math.abs(flowPos.x - last.x) < 0.5 && Math.abs(flowPos.y - last.y) < 0.5) {
        return prev;
      }

      const next: MovementPoint = {
        x: flowPos.x,
        y: flowPos.y,
        risk,
        navPhase,
        frameNumber,
        isPhaseChange,
      };
      // 直近 800 点を保持
      const trimmed = prev.length >= 800 ? prev.slice(-799) : prev;
      return [...trimmed, next];
    });
  }, [frameNumber, flowPos, risk, navPhase]);

  return log;
}
