/**
 * F9.1 switch: the optional AI layer is on only when AI_BRIEFING_ENABLED=true
 * AND AI_MODEL AND the selected provider's key are set on the server.
 * Pure (env passed in) so the gate is unit-tested; keys are never returned.
 */

export type AiProviderId = "anthropic" | "xai";

export interface AiConfig {
  provider: AiProviderId;
  model: string;
  dailyCap: number;
  effort: "low" | "medium" | "high" | null;
}

/** Enabled only when switched on AND a model + the provider's key exist; otherwise null (no UI). */
export function readAiConfig(env: Record<string, string | undefined>): AiConfig | null {
  if (env.AI_BRIEFING_ENABLED?.trim().toLowerCase() !== "true") return null;
  const model = env.AI_MODEL?.trim();
  if (!model) return null;
  const provider: AiProviderId = env.AI_PROVIDER?.trim().toLowerCase() === "xai" ? "xai" : "anthropic";
  const key = provider === "xai" ? env.XAI_API_KEY : env.ANTHROPIC_API_KEY;
  if (!key?.trim()) return null;
  const cap = Number(env.AI_DAILY_CAP);
  const effort = env.AI_EFFORT?.trim().toLowerCase();
  return {
    provider,
    model,
    dailyCap: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 50,
    effort: effort === "low" || effort === "medium" || effort === "high" ? effort : null,
  };
}
