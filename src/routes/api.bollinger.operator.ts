import { createFileRoute } from "@tanstack/react-router";
import { handleBollingerOperator } from "../server/bollinger-operator";

export const Route = createFileRoute("/api/bollinger/operator")({
  server: { handlers: {
    GET: ({ request }) => handleBollingerOperator(request),
    POST: ({ request }) => handleBollingerOperator(request),
    DELETE: ({ request }) => handleBollingerOperator(request),
  } },
});
