import { createFileRoute } from "@tanstack/react-router";
import { disclosureResponse } from "@/server/disclosure-api";

export const Route = createFileRoute("/api/disclosures")({
  server: { handlers: { GET: ({ request }) => disclosureResponse(request) } },
});
