"use client";
import { useState, useEffect, useRef } from "react";
import type { Detection, RiskLevel, SceneState } from "../types";

type PhaseDetection = Omit<Detection, "id">;

const PHASES: Array<{ duration: number; risk: RiskLevel; detections: PhaseDetection[] }> = [
  { duration: 5000, risk: "safe", detections: [] },
  {
    duration: 5000,
    risk: "info",
    detections: [
      { type: "pallet", x: 33, y: 47, w: 22, h: 28, distance: 2.5, confidence: 0.97 },
    ],
  },
  {
    duration: 6000,
    risk: "warning",
    detections: [
      { type: "person",   x: 56, y: 28, w: 14, h: 32, distance: 4.2, confidence: 0.91 },
      { type: "pallet",   x: 22, y: 50, w: 20, h: 24, distance: 3.0, confidence: 0.95 },
    ],
  },
  {
    duration: 5000,
    risk: "critical",
    detections: [
      { type: "person", x: 38, y: 22, w: 22, h: 42, distance: 1.2, confidence: 0.98 },
    ],
  },
  {
    duration: 6000,
    risk: "warning",
    detections: [
      { type: "person",   x: 64, y: 33, w: 13, h: 28, distance: 3.8, confidence: 0.88 },
      { type: "obstacle", x: 24, y: 42, w: 24, h: 30, distance: 2.1, confidence: 0.92 },
      { type: "forklift", x: 68, y: 44, w: 26, h: 32, distance: 5.5, confidence: 0.85 },
    ],
  },
  {
    duration: 4000,
    risk: "info",
    detections: [
      { type: "pallet", x: 40, y: 48, w: 18, h: 22, distance: 1.8, confidence: 0.99 },
      { type: "pallet", x: 62, y: 50, w: 18, h: 20, distance: 2.2, confidence: 0.96 },
    ],
  },
];

function noise(val: number, amount: number) {
  return val + (Math.random() - 0.5) * amount;
}

export function useSimulation(): SceneState {
  const [scene, setScene] = useState<SceneState>({ frame: 0, fps: 30, detections: [], risk: "safe" });
  const frameRef = useRef(0);
  const phaseRef = useRef(0);
  const phaseStartRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const phase = PHASES[phaseRef.current];

      if (now - phaseStartRef.current > phase.duration) {
        phaseRef.current = (phaseRef.current + 1) % PHASES.length;
        phaseStartRef.current = now;
      }

      const current = PHASES[phaseRef.current];
      frameRef.current += 1;

      const detections: Detection[] = current.detections.map((d, i) => ({
        ...d,
        id: `${i}`,
        x: noise(d.x, 1.5),
        y: noise(d.y, 1.0),
        distance: parseFloat(Math.max(0.5, noise(d.distance, 0.1)).toFixed(1)),
        confidence: Math.min(0.99, Math.max(0.6, noise(d.confidence, 0.02))),
      }));

      setScene({ frame: frameRef.current, fps: 28 + Math.floor(Math.random() * 4), detections, risk: current.risk });
    }, 500);

    return () => clearInterval(id);
  }, []);

  return scene;
}
