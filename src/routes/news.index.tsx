import { createFileRoute, redirect } from "@tanstack/react-router";

/** `/news` → `/news/kr` (F10.1). */
export const Route = createFileRoute("/news/")({
  beforeLoad: () => {
    throw redirect({ to: "/news/kr", replace: true });
  },
});
