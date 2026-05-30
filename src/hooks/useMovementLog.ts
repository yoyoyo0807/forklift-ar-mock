"use client";
import { useRef, useState, useEffect } from "react";
import type { GuidanceResult, NavDirection, NavPhase, RiskLevel } from "@/types";

export interface MovementPoint {
  x: number;
  y: number;
  risk: RiskLevel;
  navPhase: NavPhase | undefined;
  frameNumber: number;
  isPhaseChange: boolean;
}

/** nav_direction → (dx, dy) 変換テーブル。y は下向き正 */
const DIR_VECTOR: Record<NavDirection, [number, number]> = {
  forward:       [ 0,    -1   ],
  forward_left:  [-0.707,-0.707],
  forward_right: [ 0.707,-0.707],
  left:          [-1,     0   ],
  right:         [ 1,     0   ],
  reverse:       [ 0,     1   ],
  reverse_left:  [-0.707, 0.707],
  reverse_right: [ 0.707, 0.707],
  stop:          [ 0,     0   ],
};

/** 1フレームあたりの移動ピクセル数（10fps × 1.2px ≒ 12px/秒） */
const STEP = 1.2;
/** N フレームごとに1点記録（10fps → 実効3.3fps のサンプリング） */
const LOG_EVERY = 3;
/** マップの論理サイズ（SVG viewBox と合わせる） */
export const MAP_SIZE = 200;
/** 開始位置：下中央（倉庫入口を想定） */
const START_X = MAP_SIZE / 2;
const START_Y = MAP_SIZE - 16;

export function useMovementLog(
  guidance: GuidanceResult | null,
  risk: RiskLevel,
  frameNumber: number,
): MovementPoint[] {
  const [log, setLog] = useState<MovementPoint[]>(() => [
    { x: START_X, y: START_Y, risk: "safe", navPhase: undefined, frameNumber: 0, isPhaseChange: false },
  ]);

  const lastFrameRef    = useRef(-1);
  const logCounterRef   = useRef(0);
  const lastPhaseRef    = useRef<NavPhase | undefined>(undefined);

  useEffect(() => {
    if (frameNumber === lastFrameRef.current) return;
    lastFrameRef.current = frameNumber;

    // スロットリング：LOG_EVERY フレームに1回だけ記録
    logCounterRef.current++;
    if (logCounterRef.current % LOG_EVERY !== 0) return;

    const dir   = guidance?.nav_direction ?? "stop";
    const phase = guidance?.nav_phase;

    // 停止中は点を追加しない（同一座標の重複を防ぐ）
    if (dir === "stop") return;

    const [dx, dy] = DIR_VECTOR[dir];
    const isPhaseChange = phase !== lastPhaseRef.current;
    lastPhaseRef.current = phase;

    setLog(prev => {
      const last = prev[prev.length - 1];
      const nx = Math.max(6, Math.min(MAP_SIZE - 6, last.x + dx * STEP));
      const ny = Math.max(6, Math.min(MAP_SIZE - 6, last.y + dy * STEP));

      // 座標が変わらない場合（壁に当たっている）はスキップ
      if (Math.abs(nx - last.x) < 0.1 && Math.abs(ny - last.y) < 0.1) return prev;

      const next: MovementPoint = { x: nx, y: ny, risk, navPhase: phase, frameNumber, isPhaseChange };
      const trimmed = prev.length >= 500 ? prev.slice(-499) : prev;
      return [...trimmed, next];
    });
  }, [frameNumber, guidance, risk]);

  return log;
}
