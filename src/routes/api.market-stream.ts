import { createFileRoute } from "@tanstack/react-router";
import { kisRealtimeHub } from "@/server/kis-realtime";
import { isDigitTicker, normalizeKrTicker } from "@/lib/infer-sector";

const encoder = new TextEncoder();

function sse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** F8.6: close well inside the serverless limit; EventSource reconnects after `retry`. */
const MAX_STREAM_MS = 240_000;
const RETRY_MS = 3_000;

export const Route = createFileRoute("/api/market-stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const codes = [...new Set((url.searchParams.get("codes") ?? "")
          .split(",")
          .map((x) => normalizeKrTicker(x))
          .filter((x) => isDigitTicker(x)))]
          .slice(0, 40);

        if (!codes.length) {
          return Response.json({ error: "codes_required" }, { status: 400 });
        }
        // Optional shorter lifetime (QA / tuning), clamped to [5 s, 240 s].
        const maxParam = Number(url.searchParams.get("maxMs"));
        const lifetimeMs = Number.isFinite(maxParam) && maxParam > 0 ? Math.min(Math.max(maxParam, 5_000), MAX_STREAM_MS) : MAX_STREAM_MS;

        const cleanup: Array<() => void> = [];
        let heartbeat: ReturnType<typeof setInterval> | null = null;
        let lifetime: ReturnType<typeof setTimeout> | null = null;
        const stop = () => {
          if (heartbeat) clearInterval(heartbeat);
          if (lifetime) clearTimeout(lifetime);
          heartbeat = null;
          lifetime = null;
          for (const off of cleanup.splice(0)) off();
        };

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(`retry: ${RETRY_MS}\n\n`));
            controller.enqueue(sse("status", kisRealtimeHub.getStatus()));

            const offStatus = kisRealtimeHub.onStatus((status) => {
              try { controller.enqueue(sse("status", status)); } catch { /* closed */ }
            });
            cleanup.push(offStatus);

            void Promise.all(
              codes.map((code) =>
                kisRealtimeHub.subscribe(code, (trade) => {
                  try { controller.enqueue(sse("trade", trade)); } catch { /* closed */ }
                }),
              ),
            ).then((offs) => cleanup.push(...offs)).catch((error) => {
              try {
                controller.enqueue(sse("status", {
                  ...kisRealtimeHub.getStatus(),
                  connected: false,
                  message: error instanceof Error ? error.message : "KIS stream error",
                }));
              } catch { /* closed */ }
            });

            heartbeat = setInterval(() => {
              try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { /* closed */ }
            }, 15_000);

            lifetime = setTimeout(() => {
              try { controller.enqueue(sse("reconnect", { afterMs: RETRY_MS, reason: "lifetime" })); } catch { /* closed */ }
              stop();
              try { controller.close(); } catch { /* already closed */ }
            }, lifetimeMs);

            request.signal.addEventListener("abort", () => {
              stop();
              try { controller.close(); } catch { /* already closed */ }
            }, { once: true });
          },
          cancel() {
            stop();
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "x-accel-buffering": "no",
          },
        });
      },
    },
  },
});
