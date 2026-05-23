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
}
