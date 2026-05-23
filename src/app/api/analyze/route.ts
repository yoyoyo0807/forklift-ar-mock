import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Detection, GuidanceResult, RiskLevel } from "@/types";

const DETECTION_LABELS: Record<string, string> = {
  person: "人物",
  forklift: "フォークリフト",
  pallet: "パレット",
  obstacle: "障害物",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  critical: "緊急",
  warning: "要注意",
  safe: "安全",
  info: "情報",
};

// Fallback responses when API key is not set
const FALLBACKS: Record<RiskLevel, GuidanceResult> = {
  critical: { guidance: "緊急停止！",        detail: "前方に人物を検出。直ちに停車してください。",     risk: "critical" },
  warning:  { guidance: "速度を落とせ",      detail: "付近に人物・障害物を検出。注意して進んでください。", risk: "warning"  },
  safe:     { guidance: "安全運行中",        detail: "前方に障害物はありません。安全に走行できます。",   risk: "safe"     },
  info:     { guidance: "パレット確認",       detail: "前方にパレットを検出。位置を確認してください。",   risk: "info"     },
};

export async function POST(req: Request) {
  const { detections, risk }: { detections: Detection[]; risk: RiskLevel } = await req.json();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(FALLBACKS[risk]);
  }

  const detectionText = detections.length === 0
    ? "検出なし"
    : detections
        .map(d => `${DETECTION_LABELS[d.type]}（距離 ${d.distance}m、信頼度 ${Math.round(d.confidence * 100)}%）`)
        .join("、");

  const prompt = `あなたはフォークリフト安全管理AIです。
検出状況: ${detectionText}
危険度: ${RISK_LABELS[risk]}

以下のJSON形式のみで返答してください（他のテキスト不要）:
{
  "guidance": "オペレーターへの主要指示（15文字以内）",
  "detail": "詳細説明（50文字以内）",
  "risk": "${risk}"
}`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as GuidanceResult;
      return Response.json(parsed);
    }
  } catch {
    // fall through to fallback
  }

  return Response.json(FALLBACKS[risk]);
}
