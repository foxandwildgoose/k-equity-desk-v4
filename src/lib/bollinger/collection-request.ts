import { z } from "zod";

/** Browser choices only. Runtime targets, secrets, URLs and time budgets cannot be supplied. */
export const selectedBollingerRequestSchema = z.object({
  universeId: z.string().min(1).max(160),
  configVersion: z.string().min(1).max(1500),
  selection: z.object({
    top: z.union([z.literal("ALL"), z.literal(10), z.literal(20), z.literal(50), z.literal(100), z.literal(200)]),
    minWeight: z.number().min(0).max(100),
    sectors: z.array(z.string().min(1).max(80)).max(30),
  }).strict(),
  symbols: z.array(z.string().regex(/^(KR:[0-9A-Z]{6}|US:[A-Z][A-Z0-9.-]{0,14})$/)).max(2000).optional(),
}).strict();
export type SelectedBollingerInput = z.infer<typeof selectedBollingerRequestSchema>;
