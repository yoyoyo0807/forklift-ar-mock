"use client";
import { useRef, useState, useEffect } from "react";
import type { NavPhase, RiskLevel } from "@/types";
import type { FlowSignal } from "./useVideoStream";

export interface MovementPoint {
  x: number;
  y: number;
  risk: RiskLevel;
  navPhase: NavPhase | undefined;
  frameNumber: number;
  isPhaseChange: boolean;
}

export const MAP_SIZE = 200;

// ── ビークルモデル定数 ────────────────────────────────────────────────────
// TRUCK ゾーン(165,22) が右上、STORAGE(38,168) が左下の 200×200 マップ。
// SVG は y 下向きなので "上向き前進" = y 減少。
// theta=0 → y 減少方向（上向き）。theta 増加 → 時計回り。
// INITIAL_THETA: center(100,100) → TRUCK(165,22) の方位角
//   dx=+65, dy=-78 (SVG) → atan2(+65, +78) ≈ 0.69 rad
const INITIAL_X     = 100.0;  // 初期 X（マップ中央）
const INITIAL_Y     = 100.0;  // 初期 Y（マップ中央）
const INITIAL_THETA = 0.69;   // 初期進行方向（右上 = TRUCK 方向）
const YAW_SCALE     = 0.04;   // ヨー係数（光学フロー差 px → ラジアン）
const FORWARD_SCALE = 0.15;   // 前進係数（光学フロー px → マップ px）
const MIN_STEP      = 0.3;    // 記録最小移動量（px）
// ─────────────────────────────────────────────────────────────────────────

/**
 * 走行軌跡フック（ビークルモデル版）
 *
 * バックエンドが計算した光学フロー信号（yaw / forward）を
 * 1フレームごとに受け取り、ビークルモデルで位置を積分する。
 *
 *   theta += -yaw * YAW_SCALE          // 右旋回 = theta 減少（時計回り）
 *   x     += forward * sin(theta) * FORWARD_SCALE
 *   y     -= forward * cos(theta) * FORWARD_SCALE  // SVG y 下向き補正
 */
export function useMovementLog(
  flowSignal: FlowSignal | null,
  risk: RiskLevel,
  navPhase: NavPhase | undefined,
  frameNumber: number,
): MovementPoint[] {
  const [log, setLog] = useState<MovementPoint[]>([]);
  const lastFrameRef = useRef(-1);
  const lastPhaseRef = useRef<NavPhase | undefined>(undefined);

  // ── ビークルモデル状態 ──
  const thetaRef = useRef(INITIAL_THETA);
  const posXRef  = useRef(INITIAL_X);
  const posYRef  = useRef(INITIAL_Y);

  // frameNumber が 1 に戻ったとき（再接続）はモデルをリセット
  useEffect(() => {
    if (frameNumber === 1 && lastFrameRef.current > 10) {
      thetaRef.current = INITIAL_THETA;
      posXRef.current  = INITIAL_X;
      posYRef.current  = INITIAL_Y;
      setLog([]);
      lastFrameRef.current = -1;
      lastPhaseRef.current = undefined;
    }
  }, [frameNumber]);

  useEffect(() => {
    if (frameNumber === lastFrameRef.current) return;
    if (!flowSignal) return;
    lastFrameRef.current = frameNumber;

    const isPhaseChange = navPhase !== undefined && navPhase !== lastPhaseRef.current;
    if (isPhaseChange) lastPhaseRef.current = navPhase;

    const { yaw, forward } = flowSignal;

    // ── ビークルモデル積分 ──
    // 右旋回(yaw>0) → theta 減少（時計回り）
    thetaRef.current -= yaw * YAW_SCALE;

    // SVG 座標系: y は下向き正。theta=0 で上方向（y 減少）に前進。
    posXRef.current += forward * Math.sin(thetaRef.current) * FORWARD_SCALE;
    posYRef.current -= forward * Math.cos(thetaRef.current) * FORWARD_SCALE;

    // 内部状態もマップ周囲に緩くクランプ（無限ドリフト防止）
    posXRef.current = Math.max(-50, Math.min(MAP_SIZE + 50, posXRef.current));
    posYRef.current = Math.max(-50, Math.min(MAP_SIZE + 50, posYRef.current));

    // 表示用クランプ（マップ内に収める）
    const cx = Math.max(5, Math.min(MAP_SIZE - 5, posXRef.current));
    const cy = Math.max(5, Math.min(MAP_SIZE - 5, posYRef.current));

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
  }, [frameNumber, flowSignal, risk, navPhase]);

  return log;
}
