#!/usr/bin/env node
// Read-only packaging guard: never builds, migrates, deploys, or reads secrets.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isMainModule, projectRoot } from "./with-app-env.mjs";

export const DEPLOY_DEPENDENCY_FLOORS = Object.freeze({
  "@tanstack/react-start": "1.168.60",
  "@tanstack/start-server-core": "1.169.39",
  tslib: "2.8.1",
});

function versionParts(value) {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/.test(value)) return null;
  const parts = value.split(".").map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

// Explicit stable exact/caret/tilde ranges keep a verifiable patched lower
// bound. Broad ranges, prereleases, and major upgrades require operator review.
function supportedRange(value, floor) {
  if (typeof value !== "string") return null;
  const match = /^(\^|~)?(\d+\.\d+\.\d+)$/.exec(value);
  if (!match) return null;
  const base = versionParts(match[2]);
  if (!base || base[0] !== floor[0] || compareVersions(base, floor) < 0) return null;
  return { prefix: match[1] ?? "", base };
}

function versionSatisfiesRange(version, range) {
  if (compareVersions(version, range.base) < 0) return false;
  if (range.prefix === "^") return version[0] === range.base[0];
  if (range.prefix === "~") return version[0] === range.base[0] && version[1] === range.base[1];
  return compareVersions(version, range.base) === 0;
}

/** Pure fixture-testable assessment. Results contain fixed codes, never values from environment. */
export function inspectDeployInvariant({ manifest, lock, outputIgnored, trackedOutput }) {
  const issues = [];
  if (outputIgnored !== true) issues.push("VERCEL_OUTPUT_NOT_IGNORED");
  if (!Array.isArray(trackedOutput)) issues.push("GIT_TRACKING_CHECK_FAILED");
  else if (trackedOutput.length) issues.push("VERCEL_OUTPUT_TRACKED");
  if (!lock?.packages || typeof lock.packages !== "object") issues.push("LOCK_PACKAGES_MISSING");

  for (const [name, minimum] of Object.entries(DEPLOY_DEPENDENCY_FLOORS)) {
    const label = name === "tslib" ? "TSLIB" : name === "@tanstack/react-start" ? "REACT_START" : "START_SERVER_CORE";
    const floor = versionParts(minimum);
    const dependency = manifest?.dependencies?.[name];
    const range = supportedRange(dependency, floor);
    if (!range) issues.push(`${label}_PRODUCTION_RANGE_UNSAFE`);
    if (lock?.packages?.[""]?.dependencies?.[name] !== dependency || !dependency)
      issues.push(`${label}_LOCK_MANIFEST_MISMATCH`);

    const path = `node_modules/${name}`;
    const direct = lock?.packages?.[path];
    const version = versionParts(direct?.version);
    if (!version || version[0] !== floor[0] || compareVersions(version, floor) < 0)
      issues.push(`${label}_LOCK_VERSION_UNSAFE`);
    else if (range && !versionSatisfiesRange(version, range))
      issues.push(`${label}_LOCK_OUTSIDE_MANIFEST_RANGE`);
    if (direct?.dev === true) issues.push(`${label}_LOCK_DEV_ONLY`);

    for (const [entryPath, entry] of Object.entries(lock?.packages ?? {})) {
      if (!entryPath.endsWith(`/${path}`)) continue;
      const nested = versionParts(entry?.version);
      if (!nested || nested[0] !== floor[0] || compareVersions(nested, floor) < 0) {
        issues.push(`${label}_NESTED_LOCK_VERSION_UNSAFE`);
        break;
      }
    }
  }
  return { status: issues.length ? "FAIL" : "PASS", issues: [...new Set(issues)] };
}

export function checkDeploy(root = projectRoot()) {
  try {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
    const ignored = spawnSync("git", ["check-ignore", "--no-index", "--quiet", "--", ".vercel/output/__deploy_guard__"], { cwd: root });
    const tracked = spawnSync("git", ["ls-files", "-z", "--", ".vercel/output"], { cwd: root, encoding: "utf8" });
    return inspectDeployInvariant({
      manifest,
      lock,
      outputIgnored: ignored.status === 0,
      trackedOutput: tracked.status === 0 ? tracked.stdout.split("\0").filter(Boolean) : null,
    });
  } catch {
    return { status: "FAIL", issues: ["DEPLOY_INPUT_READ_FAILED"] };
  }
}

if (isMainModule(import.meta.url)) {
  const result = checkDeploy();
  console.log(JSON.stringify(result));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}
