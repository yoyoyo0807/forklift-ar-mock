export type RiskLevel = "critical" | "warning" | "safe" | "info";

export interface Detection {
  id: string;
  type: "person" | "forklift" | "pallet" | "obstacle";
  x: number;
  y: number;
  w: number;
  h: number;
  distance: number;
  confidence: number;
}

export interface SceneState {
  frame: number;
  fps: number;
  detections: Detection[];
  risk: RiskLevel;
}

export interface GuidanceResult {
  guidance: string;
  detail: string;
  risk: RiskLevel;
}

export interface AlertEntry {
  id: number;
  time: string;
  message: string;
  level: RiskLevel;
}

export interface OperatorState {
  distance: number;
  attention_score: number;   // 0-100
  fatigue: boolean;
  distracted: boolean;
  head_angle: "forward" | "nodding" | "left" | "right";
  head_drop: number;
  face_turn: number;
  pose_warning: boolean;
  /** Gemini Vision による疲労検出（居眠り・目閉じなど） */
  gemini_fatigue?: boolean;
  /** Gemini Vision による PPE 装着確認（ヘルメット・安全ベスト） */
  gemini_ppe?: boolean;
}

export interface NavZone {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface NavInfo {
  load_state: "unknown" | "empty" | "loaded";
  nav_phase: "learning" | "navigating";
  pickup_zone: NavZone | null;
  dropoff_zone: NavZone | null;
  target_zone: NavZone | null;
}

export interface MastInfo {
  moving: boolean;
  direction: "up" | "down" | "still";
  magnitude: number;
}
