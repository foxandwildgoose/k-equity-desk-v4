import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkDeploy, DEPLOY_DEPENDENCY_FLOORS, inspectDeployInvariant } from "./check-deploy.mjs";

function fixture() {
  const dependencies = Object.fromEntries(Object.entries(DEPLOY_DEPENDENCY_FLOORS).map(([name, version]) => [name, `^${version}`]));
  return {
    manifest: { dependencies },
    lock: {
      lockfileVersion: 3,
      packages: {
        "": { dependencies: { ...dependencies } },
        ...Object.fromEntries(Object.entries(DEPLOY_DEPENDENCY_FLOORS).map(([name, version]) => [`node_modules/${name}`, { version }])),
      },
    },
    outputIgnored: true,
    trackedOutput: [],
  };
}

function assertIssue(input, code) {
  const result = inspectDeployInvariant(input);
  assert.equal(result.status, "FAIL");
  assert.ok(result.issues.includes(code), JSON.stringify(result));
}

test("deploy invariant accepts the patched production dependency floors and stable bounded ranges", () => {
  for (const prefix of ["", "^", "~"]) {
    const input = fixture();
    for (const [name, floor] of Object.entries(DEPLOY_DEPENDENCY_FLOORS)) {
      input.manifest.dependencies[name] = `${prefix}${floor}`;
      input.lock.packages[""].dependencies[name] = `${prefix}${floor}`;
    }
    assert.deepEqual(inspectDeployInvariant(input), { status: "PASS", issues: [] });
  }
  const newer = fixture();
  newer.lock.packages["node_modules/@tanstack/react-start"].version = "1.168.61";
  assert.equal(inspectDeployInvariant(newer).status, "PASS");
});

test("deploy invariant rejects manifest downgrades, broad ranges, prereleases, and undeclared runtime tslib", () => {
  for (const range of ["^1.168.59", "*", "^1", ">=1.168.60", "1.x", "^1.168.60-beta.1", "^2.0.0"]) {
    const input = fixture();
    input.manifest.dependencies["@tanstack/react-start"] = range;
    assertIssue(input, "REACT_START_PRODUCTION_RANGE_UNSAFE");
  }
  const core = fixture();
  core.manifest.dependencies["@tanstack/start-server-core"] = "~1.169.38";
  assertIssue(core, "START_SERVER_CORE_PRODUCTION_RANGE_UNSAFE");
  const tslib = fixture();
  delete tslib.manifest.dependencies.tslib;
  tslib.manifest.devDependencies = { tslib: "^2.8.1" };
  assertIssue(tslib, "TSLIB_PRODUCTION_RANGE_UNSAFE");
});

test("deploy invariant inspects actual direct and nested lock versions, not only package.json", () => {
  for (const [name, version, code] of [
    ["@tanstack/react-start", "1.168.59", "REACT_START_LOCK_VERSION_UNSAFE"],
    ["@tanstack/start-server-core", "1.169.38", "START_SERVER_CORE_LOCK_VERSION_UNSAFE"],
    ["tslib", "2.8.0", "TSLIB_LOCK_VERSION_UNSAFE"],
    ["tslib", "2.8.1-beta", "TSLIB_LOCK_VERSION_UNSAFE"],
  ]) {
    const input = fixture();
    input.lock.packages[`node_modules/${name}`].version = version;
    assertIssue(input, code);
  }
  const nested = fixture();
  nested.lock.packages["node_modules/fixture/node_modules/@tanstack/start-server-core"] = { version: "1.169.38" };
  assertIssue(nested, "START_SERVER_CORE_NESTED_LOCK_VERSION_UNSAFE");
  const missing = fixture();
  delete missing.lock.packages["node_modules/tslib"];
  assertIssue(missing, "TSLIB_LOCK_VERSION_UNSAFE");
  const dev = fixture();
  dev.lock.packages["node_modules/tslib"].dev = true;
  assertIssue(dev, "TSLIB_LOCK_DEV_ONLY");
});

test("deploy invariant rejects manifest/lock drift and resolved versions outside a supported range", () => {
  const mismatch = fixture();
  mismatch.lock.packages[""].dependencies.tslib = "^2.8.0";
  assertIssue(mismatch, "TSLIB_LOCK_MANIFEST_MISMATCH");
  for (const [range, version] of [["2.8.1", "2.8.2"], ["~2.8.1", "2.9.0"], ["^2.9.0", "2.8.1"]]) {
    const input = fixture();
    input.manifest.dependencies.tslib = range;
    input.lock.packages[""].dependencies.tslib = range;
    input.lock.packages["node_modules/tslib"].version = version;
    assertIssue(input, "TSLIB_LOCK_OUTSIDE_MANIFEST_RANGE");
  }
  assertIssue({ ...fixture(), lock: {} }, "LOCK_PACKAGES_MISSING");
});

test("ignored output and untracked output are separate required invariants", () => {
  assertIssue({ ...fixture(), outputIgnored: false }, "VERCEL_OUTPUT_NOT_IGNORED");
  assertIssue({ ...fixture(), trackedOutput: [".vercel/output/config.json"] }, "VERCEL_OUTPUT_TRACKED");
  assertIssue({ ...fixture(), trackedOutput: null }, "GIT_TRACKING_CHECK_FAILED");
});

test("read-only Git integration catches force-tracked ignored artifacts without modifying them", () => {
  const dir = mkdtempSync(join(tmpdir(), "deploy-guard-test-"));
  const git = (args) => {
    const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  try {
    git(["init", "--quiet"]);
    const input = fixture();
    writeFileSync(join(dir, "package.json"), JSON.stringify(input.manifest));
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify(input.lock));
    writeFileSync(join(dir, ".gitignore"), ".vercel/output/\n");
    mkdirSync(join(dir, ".vercel/output"), { recursive: true });
    writeFileSync(join(dir, ".vercel/output/config.json"), "fixture-only");
    assert.deepEqual(checkDeploy(dir), { status: "PASS", issues: [] });
    git(["add", "-f", ".vercel/output/config.json"]);
    const before = git(["ls-files", "--stage"]);
    assert.deepEqual(checkDeploy(dir), { status: "FAIL", issues: ["VERCEL_OUTPUT_TRACKED"] });
    assert.equal(git(["ls-files", "--stage"]), before);
    writeFileSync(join(dir, ".gitignore"), "");
    assert.ok(checkDeploy(dir).issues.includes("VERCEL_OUTPUT_NOT_IGNORED"));
    writeFileSync(join(dir, "package.json"), "not JSON");
    assert.deepEqual(checkDeploy(dir), { status: "FAIL", issues: ["DEPLOY_INPUT_READ_FAILED"] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
