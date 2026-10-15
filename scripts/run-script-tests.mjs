// Explicit enumeration: Node 22/Windows can report zero tests for a quoted shell glob.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const tests = readdirSync(new URL("./", import.meta.url), { recursive: true })
  .filter(path => path.endsWith(".test.mjs")).map(path => join("scripts", path)).sort();
if (!tests.length) throw new Error("No script tests discovered");
// Tests also launch CLI subprocesses. Bound workers so a shared cloud runner
// does not starve those children and report fixture timeouts as product errors.
const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...tests], { stdio: "inherit" });
process.exit(result.status ?? 1);
