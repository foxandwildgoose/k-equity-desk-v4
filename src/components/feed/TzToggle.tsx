import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/** KST/ET display toggle for US pages (A3.5 / F3.3), persisted in newsPrefs. */
export function TzToggle() {
  const tz = useAppStore((s) => s.newsPrefs.tz);
  const setNewsPrefs = useAppStore((s) => s.setNewsPrefs);
  return (
    <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="시간대">
      {(["KST", "ET"] as const).map((z) => (
        <button
          key={z}
          type="button"
          onClick={() => setNewsPrefs({ tz: z })}
          aria-pressed={tz === z}
          className={cn(
            "min-h-8 rounded px-2 text-[11px] font-semibold",
            tz === z ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {z}
        </button>
      ))}
    </div>
  );
}

