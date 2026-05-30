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
 * ハイブリッド走行軌跡フック（コンテキスト対応版）
 *
 * 精度向上の核心:
 *   Gemini は「倉庫エリアでのフォーク挿入」を "pickup" と誤分類する。
 *   前フェーズが "carry" の場合の "pickup" は実際には倉庫での荷降ろし。
 *   これをコンテキストで検出して storage zone に正しくルーティングする。
 *
 * フェーズ→ゾーン マッピング:
 *   approach/pickup(from idle/return/approach) → TRUCK  (右上)
 *   carry                                      → CENTER (中央)
 *   pickup(from carry)                         → STORAGE(左下)  ← 重要
 *   return                                     → TRANSIT(中央上)
 *   idle                                       → CENTER
 */

const TRUCK:   { x: number; y: number } = { x: 165, y: 22  };
const STORAGE: { x: number; y: number } = { x: 38,  y: 168 };
const CENTER:  { x: number; y: number } = { x: 90,  y: 108 };
const TRANSIT: { x: number; y: number } = { x: 85,  y: 88  };
const APPROACH:{ x: number; y: number } = { x: 150, y: 42  };

const LERP_BOOST  = 0.06;  // フェーズ切替後の加速LERP
const LERP_BASE   = 0.025; // 通常LERP
const BOOST_FRAMES = 30;   // フェーズ切替後のブースト継続フレーム数

const FLOW_SCALE = 0.06;   // 光学フローdeltaの寄与率
const MIN_STEP   = 0.2;    // 記録最小ステップ(px)

export function useMovementLog(
  flowPos: FlowPos | null,
  risk: RiskLevel,
  navPhase: NavPhase | undefined,
  frameNumber: number,
): MovementPoint[] {
  const [log, setLog] = useState<MovementPoint[]>([]);

  const posRef             = useRef({ x: 100.0, y: 100.0 });
  const lastFlowRef        = useRef<FlowPos | null>(null);
  const lastFrameRef       = useRef(-1);
  const lastPhaseRef       = useRef<NavPhase | undefined>(undefined);
  const phaseBoostRef      = useRef(0);
  // "倉庫でのpickup"状態を追跡:
  //   carry→pickup 遷移で true、pickup以外に遷移したら false
  const pickupAtStorageRef = useRef(false);

  useEffect(() => {
    if (frameNumber === lastFrameRef.current) return;
    lastFrameRef.current = frameNumber;

    const prevPhase = lastPhaseRef.current;
    const isPhaseChange = navPhase !== undefined && navPhase !== prevPhase;
    if (isPhaseChange) {
      lastPhaseRef.current = navPhase;
      phaseBoostRef.current = BOOST_FRAMES;
    } else if (phaseBoostRef.current > 0) {
      phaseBoostRef.current--;
    }

    // ── carry→pickup 状態管理 ────────────────────────────────
    if (navPhase === 'pickup') {
      if (prevPhase === 'carry') {
        // carry→pickup: 倉庫でのフォーク挿入（Geminiの誤分類）
        pickupAtStorageRef.current = true;
      } else if (prevPhase !== 'pickup') {
        // pickup以外から来た（approach/idle/returnなど）→ トラック
        pickupAtStorageRef.current = false;
      }
      // prevPhase==='pickup'の場合は前回の状態を引き継ぐ
    } else {
      // pickup以外のフェーズに遷移したらリセット
      pickupAtStorageRef.current = false;
    }

    // ── ターゲットゾーン決定 ─────────────────────────────────
    let target: { x: number; y: number };
    switch (navPhase) {
      case 'pickup':
        target = pickupAtStorageRef.current ? STORAGE : TRUCK;
        break;
      case 'approach':
        target = APPROACH;
        break;
      case 'carry':
        target = CENTER;
        break;
      case 'return':
        target = TRANSIT;
        break;
      case 'idle':
      default:
        target = { x: 100, y: 100 };
        break;
    }

    // ── LERP 移動 ────────────────────────────────────────────
    const lerpSpeed = phaseBoostRef.current > 0 ? LERP_BOOST : LERP_BASE;
    let { x, y } = posRef.current;
    x = x + (target.x - x) * lerpSpeed;
    y = y + (target.y - y) * lerpSpeed;

    // ── 光学フローdeltaで微細な揺らぎを付加 ─────────────────
    if (flowPos && lastFlowRef.current) {
      x += (flowPos.x - lastFlowRef.current.x) * FLOW_SCALE;
      y += (flowPos.y - lastFlowRef.current.y) * FLOW_SCALE;
    }
    lastFlowRef.current = flowPos;

    // マップ範囲内クランプ
    x = Math.max(5, Math.min(MAP_SIZE - 5, x));
    y = Math.max(5, Math.min(MAP_SIZE - 5, y));

    posRef.current = { x, y };

    // ── ログ記録 ─────────────────────────────────────────────
    setLog(prev => {
      const last = prev[prev.length - 1];
      if (last && Math.abs(x - last.x) < MIN_STEP && Math.abs(y - last.y) < MIN_STEP) {
        return prev;
      }
      const next: MovementPoint = {
        x, y, risk, navPhase, frameNumber,
        isPhaseChange: isPhaseChange ?? false,
      };
      const trimmed = prev.length >= 800 ? prev.slice(-799) : prev;
      return [...trimmed, next];
    });
  }, [frameNumber, flowPos, risk, navPhase]);

  return log;
}
