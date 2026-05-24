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

export interface ForkAlign {
  visible: boolean;
  x: "left" | "center" | "right";
  y: "too_high" | "correct" | "too_low";
  action: string;
  ready: boolean;
}

export type NavDirection =
  | "forward" | "forward_left" | "forward_right"
  | "left" | "right"
  | "reverse" | "reverse_left" | "reverse_right"
  | "stop";
export type NavPhase = "approach" | "pickup" | "carry" | "deliver" | "return" | "idle";

export interface GuidanceResult {
  guidance: string;
  detail: string;
  risk: RiskLevel;
  nav_phase?: NavPhase;
  nav_direction?: NavDirection;
  is_fork_loaded?: boolean;
  fork_align?: ForkAlign;
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
