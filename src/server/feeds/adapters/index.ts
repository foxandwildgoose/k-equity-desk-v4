/**
 * Adapter registration entry point. Importing this module registers every
 * implemented source adapter with the runner.
 */
import "./news.ts";
import "./themes.ts";
export { hasAdapter, registerAdapter, runSource, runSources, type RunResult } from "../runner.ts";
