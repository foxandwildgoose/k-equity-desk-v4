/**
 * AI provider interface (F9.3) with `anthropic` and `xai` adapters.
 * Server-only: keys never leave the server and never use a VITE_ prefix.
 * Model IDs are never hard-coded — `AI_MODEL` is required.
 *
 * Env: AI_BRIEFING_ENABLED=true, AI_MODEL, AI_PROVIDER (anthropic|xai,
 * default anthropic), ANTHROPIC_API_KEY or XAI_API_KEY, optional
 * AI_DAILY_CAP (default 50) and AI_EFFORT (low|medium|high; Anthropic only).
 */
import Anthropic from "@anthropic-ai/sdk";

import type { AiConfig } from "@/lib/ai/config";

export { readAiConfig, type AiConfig, type AiProviderId } from "@/lib/ai/config";

export interface AiCompletion {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
  stopReason: string | null;
}

export class AiRefusalError extends Error {}

/** Outbound timeout (A6: ≤ 8 s) — keeps the server function inside the platform limit. */
const TIMEOUT_MS = 8_000;

async function anthropicComplete(cfg: AiConfig, req: { system: string; user: string; maxTokens: number }): Promise<AiCompletion> {
  // No retries: a retry would exceed the serverless time budget.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: TIMEOUT_MS });
  const res = await client.messages.create({
    model: cfg.model,
    max_tokens: req.maxTokens,
    system: req.system,
    messages: [{ role: "user", content: req.user }],
    ...(cfg.effort ? { output_config: { effort: cfg.effort } } : {}),
  });
  if (res.stop_reason === "refusal") throw new AiRefusalError("모델이 요청을 처리하지 않았습니다 (refusal).");
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, stopReason: res.stop_reason };
}

/** xAI chat completions (docs.x.ai REST shape; not re-verified here — egress blocked). */
async function xaiComplete(cfg: AiConfig, req: { system: string; user: string; maxTokens: number }): Promise<AiCompletion> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.XAI_API_KEY ?? ""}` },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: req.maxTokens,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`xAI HTTP ${res.status}`);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choice = json.choices?.[0];
  return {
    text: choice?.message?.content ?? "",
    inputTokens: json.usage?.prompt_tokens ?? null,
    outputTokens: json.usage?.completion_tokens ?? null,
    stopReason: choice?.finish_reason ?? null,
  };
}

export async function aiComplete(cfg: AiConfig, req: { system: string; user: string; maxTokens: number }): Promise<AiCompletion> {
  return cfg.provider === "xai" ? xaiComplete(cfg, req) : anthropicComplete(cfg, req);
}
