import { queryGemini } from "@/lib/ai/gemini";
import { moderateCommentPrompt } from "@/lib/ai/prompts";

export interface ModerationResult {
  flagged: boolean;
  category: "toxicity" | "harassment" | "spam" | "scam" | "none";
  reason: string;
}

/**
 * Classifies a comment body with Gemini for toxicity/harassment/spam/scam.
 * Never throws — moderation is a best-effort enhancement, not a gate on
 * comment creation. Returns { flagged: false } on any failure.
 */
export async function classifyComment(body: string): Promise<ModerationResult> {
  try {
    const prompt = moderateCommentPrompt(body);
    const systemPrompt = "You are a content moderation classifier. You output only raw, valid JSON.";
    const responseText = await queryGemini(prompt, systemPrompt);

    const tryParse = (raw: string): ModerationResult | null => {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.flagged === "boolean" && typeof parsed.category === "string") {
          return parsed as ModerationResult;
        }
      } catch {
        // fall through
      }
      return null;
    };

    const parsed = tryParse(responseText) ?? (() => {
      const match = responseText.match(/\{[\s\S]*\}/);
      return match ? tryParse(match[0]) : null;
    })();

    return parsed || { flagged: false, category: "none", reason: "" };
  } catch {
    return { flagged: false, category: "none", reason: "" };
  }
}
