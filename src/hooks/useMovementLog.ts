"use client";
import { useRef, useState, useEffect } from "react";
import type { GuidanceResult, NavDirection, RiskLevel } from "@/types";

export interface MovementPoint {
  x: number;
  y: number;
  risk: RiskLevel;
  frameNumber: number;
}

/** nav_direction → (dx, dy) 変換テーブル。y は下向き正 */
const DIR_VECTOR: Record<NavDirection, [number, number]> = {
  forward:       [ 0,   -1  ],
  forward_left:  [-0.7, -0.7],
  forward_right: [ 0.7, -0.7],
  left:          [-1,    0  ],
  right:         [ 1,    0  ],
  reverse:       [ 0,    1  ],
  reverse_left:  [-0.7,  0.7],
  reverse_right: [ 0.7,  0.7],
  stop:          [ 0,    0  ],
};

/** 1フレームあたりの移動ピクセル数 */
const STEP = 4;

/** マップの論理サイズ（SVG viewBox と合わせる） */
const MAP_SIZE = 200;

/** Dead Reckoning でフォークリフトの移動ログを蓄積するフック */
export function useMovementLog(
  guidance: GuidanceResult | null,
  risk: RiskLevel,
  frameNumber: number,
): MovementPoint[] {
  const [log, setLog] = useState<MovementPoint[]>(() => [
    { x: MAP_SIZE / 2, y: MAP_SIZE / 2, risk: "safe", frameNumber: 0 },
  ]);
  const lastFrameRef = useRef(-1);

  useEffect(() => {
    if (frameNumber === lastFrameRef.current) return;
    lastFrameRef.current = frameNumber;

    const dir = guidance?.nav_direction ?? "stop";
    const [dx, dy] = DIR_VECTOR[dir] ?? [0, 0];

    setLog(prev => {
      const last = prev[prev.length - 1];
      const nx = Math.max(4, Math.min(MAP_SIZE - 4, last.x + dx * STEP));
      const ny = Math.max(4, Math.min(MAP_SIZE - 4, last.y + dy * STEP));
      const next: MovementPoint = { x: nx, y: ny, risk, frameNumber };
      // 直近300点まで保持
      const trimmed = prev.length >= 300 ? prev.slice(-299) : prev;
      return [...trimmed, next];
    });
  }, [frameNumber, guidance, risk]);

  return log;
}
