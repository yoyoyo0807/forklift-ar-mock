"use client";
import { useRef, useState, useEffect } from "react";
import type { GuidanceResult, NavPhase, RiskLevel } from "@/types";

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
 * フェーズに対応する倉庫ゾーン座標（ウェイポイント）
 *
 * 倉庫レイアウト:
 *   棚A(25,25)  ----  棚C(175,25)
 *      ↑ approach/pickup   ↑
 *         CENTER(100,90)
 *            carry 通過
 *   BASE(70,170) --- TRUCK(150,170)
 *      ↑ idle/return    ↑ deliver
 */
const WAYPOINTS: Record<string, readonly { x: number; y: number }[]> = {
  idle:     [{ x: 90,  y: 170 }],
  return:   [{ x: 90,  y: 170 }],
  approach: [{ x: 35,  y: 30  }, { x: 165, y: 30  }], // 棚A / 棚C を交互
  pickup:   [{ x: 25,  y: 22  }, { x: 175, y: 22  }],
  carry:    [{ x: 120, y: 100 }],                       // 中央通過
  deliver:  [{ x: 155, y: 170 }],                       // トラック荷台
};

/** フェーズ変化ごとに approach/pickup の棚を A⇔C で交互に切り替え */
const APPROACH_CYCLE_PHASES: Set<string> = new Set(["approach", "pickup"]);

/** 1フレームあたりの移動ピクセル数（ウェイポイント方向へ） */
const STEP = 2.0;

export function useMovementLog(
  guidance: GuidanceResult | null,
  risk: RiskLevel,
  frameNumber: number,
): MovementPoint[] {
  const [log, setLog] = useState<MovementPoint[]>(() => [
    { x: 90, y: 170, risk: "safe", navPhase: undefined, frameNumber: 0, isPhaseChange: false },
  ]);

  const lastFrameRef    = useRef(-1);
  const lastPhaseRef    = useRef<NavPhase | undefined>(undefined);
  const shelfCycleRef   = useRef(0); // approach/pickup の棚インデックス（0=棚A, 1=棚C）
  const currentTargetRef = useRef<{ x: number; y: number }>({ x: 90, y: 170 });

  useEffect(() => {
    if (frameNumber === lastFrameRef.current) return;
    lastFrameRef.current = frameNumber;

    const phase = guidance?.nav_phase;
    const isPhaseChange = phase !== lastPhaseRef.current && phase !== undefined;

    // フェーズ変化時: ウェイポイントを更新
    if (isPhaseChange && phase) {
      // approach/pickup に入るたびに棚を交互に切り替え
      if (APPROACH_CYCLE_PHASES.has(phase) && lastPhaseRef.current &&
          !APPROACH_CYCLE_PHASES.has(lastPhaseRef.current)) {
        shelfCycleRef.current = (shelfCycleRef.current + 1) % 2;
      }
      const zones = WAYPOINTS[phase] ?? WAYPOINTS["idle"];
      const idx = APPROACH_CYCLE_PHASES.has(phase) ? shelfCycleRef.current : 0;
      currentTargetRef.current = zones[Math.min(idx, zones.length - 1)];
      lastPhaseRef.current = phase;
    }

    const target = currentTargetRef.current;

    setLog(prev => {
      const last = prev[prev.length - 1];
      const dx = target.x - last.x;
      const dy = target.y - last.y;
      const dist = Math.hypot(dx, dy);

      // ウェイポイントに到達済み（3px以内）かつ停止フェーズ → 追加しない
      if (dist < 3 && (phase === "pickup" || phase === "deliver" ||
                       phase === "idle" || phase === "return" )) {
        return prev;
      }

      // ウェイポイントへの方向に STEP 移動（到達後はその場でわずかにランダム揺動）
      const ratio = dist > STEP ? STEP / dist : 1;
      const nx = parseFloat((last.x + dx * ratio).toFixed(2));
      const ny = parseFloat((last.y + dy * ratio).toFixed(2));

      // 位置が変わらない場合はスキップ
      if (Math.abs(nx - last.x) < 0.05 && Math.abs(ny - last.y) < 0.05) return prev;

      const next: MovementPoint = {
        x: nx, y: ny, risk, navPhase: phase, frameNumber, isPhaseChange,
      };
      const trimmed = prev.length >= 800 ? prev.slice(-799) : prev;
      return [...trimmed, next];
    });
  }, [frameNumber, guidance, risk]);

  return log;
}
