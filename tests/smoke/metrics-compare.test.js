#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { readJson, validate } = require("../../bin/schema-validator");

const repoRoot = path.resolve(__dirname, "..", "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cts metrics compare "));
const metricsSummarySchema = readJson(path.join(repoRoot, "schemas", "metrics-summary.schema.json"));

const missingTarget = path.join(tempRoot, "missing metrics target");
const missingTargetResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "collect-metrics", "--target", missingTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(missingTargetResult.status, 2, "missing target should fail before Python lookup");
assert.match(missingTargetResult.stderr, /Target directory does not exist/);
assert.ok(!missingTargetResult.stderr.includes("Python not found"), "missing target should not be reported as missing Python");

const metricsTarget = path.join(tempRoot, "metrics target");
const baselineDir = path.join(metricsTarget, ".token-stack", "reports", "baseline");
const postDir = path.join(metricsTarget, ".token-stack", "reports", "post");
fs.mkdirSync(baselineDir, { recursive: true });
fs.mkdirSync(postDir, { recursive: true });
fs.writeFileSync(
  path.join(baselineDir, "code-discovery.json"),
  JSON.stringify({ phase: "baseline", task: "code-discovery", metrics: { input_tokens: 100, task_success: true } }),
  "utf8"
);
fs.writeFileSync(
  path.join(postDir, "code-discovery.json"),
  JSON.stringify({ phase: "post", task: "code-discovery", metrics: { input_tokens: 50, task_success: true } }),
  "utf8"
);
const collectResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "collect-metrics", "--target", metricsTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(
  collectResult.status,
  0,
  `collect-metrics with --target failed\nstdout:\n${collectResult.stdout}\nstderr:\n${collectResult.stderr}`
);
const collected = JSON.parse(collectResult.stdout);
assert.strictEqual(collected.root.replace(/\\/g, "/"), ".token-stack/reports");
assert.ok(collected.files.length >= 2, "collect-metrics should scan the target report directory, not --target");

const compareResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "compare-metrics", "--target", metricsTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(
  compareResult.status,
  0,
  `compare-metrics with --target failed\nstdout:\n${compareResult.stdout}\nstderr:\n${compareResult.stderr}`
);
const compared = JSON.parse(compareResult.stdout);
assert.strictEqual(compared.tasks["code-discovery"].baseline.input_tokens, 100);
assert.strictEqual(compared.tasks["code-discovery"].post.input_tokens, 50);
assert.deepStrictEqual(
  validate(metricsSummarySchema, compared),
  [],
  "compare-metrics JSON output should match metrics-summary schema"
);

const syntheticMetricsTarget = path.join(tempRoot, "synthetic metrics target");
for (const phase of ["baseline", "post"]) {
  fs.mkdirSync(path.join(syntheticMetricsTarget, ".token-stack", "reports", phase), { recursive: true });
}
for (const task of ["code-discovery", "test-failure", "long-log"]) {
  fs.writeFileSync(
    path.join(syntheticMetricsTarget, ".token-stack", "reports", "baseline", `${task}.json`),
    JSON.stringify({
      mode: "synthetic-only",
      phase: "baseline",
      task,
      task_success: true,
      metrics: { raw_large_output_events: 1, blocked_commands: 0, cost_usd: 1 },
    }),
    "utf8"
  );
  fs.writeFileSync(
    path.join(syntheticMetricsTarget, ".token-stack", "reports", "post", `${task}.json`),
    JSON.stringify({
      mode: "synthetic-only",
      phase: "post",
      task,
      task_success: true,
      metrics: { raw_large_output_events: 0, blocked_commands: 1, cost_usd: 0.5 },
    }),
    "utf8"
  );
}
const syntheticCompareResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "compare-metrics", "--target", syntheticMetricsTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(
  syntheticCompareResult.status,
  0,
  `synthetic compare-metrics failed\nstdout:\n${syntheticCompareResult.stdout}\nstderr:\n${syntheticCompareResult.stderr}`
);
const syntheticCompared = JSON.parse(syntheticCompareResult.stdout);
assert.strictEqual(syntheticCompared.recommend_enter_block, false, "synthetic-only evidence must not recommend block mode");
assert.deepStrictEqual(syntheticCompared.evidence_modes, ["synthetic-only"]);
assert.strictEqual(syntheticCompared.recommendation_reason.representative_evidence, false);

const syntheticEvidenceTypeTarget = path.join(tempRoot, "synthetic evidence type target");
for (const phase of ["baseline", "post"]) {
  fs.mkdirSync(path.join(syntheticEvidenceTypeTarget, ".token-stack", "reports", phase), { recursive: true });
}
for (const task of ["code-discovery", "test-failure", "long-log"]) {
  fs.writeFileSync(
    path.join(syntheticEvidenceTypeTarget, ".token-stack", "reports", "baseline", `${task}.json`),
    JSON.stringify({
      schema_version: 1,
      evidence_type: "synthetic",
      phase: "baseline",
      task,
      task_success: true,
      metrics: { raw_large_output_events: 1, blocked_commands: 0, cost_usd: 1 },
    }),
    "utf8"
  );
  fs.writeFileSync(
    path.join(syntheticEvidenceTypeTarget, ".token-stack", "reports", "post", `${task}.json`),
    JSON.stringify({
      schema_version: 1,
      evidence_type: "synthetic",
      phase: "post",
      task,
      task_success: true,
      metrics: { raw_large_output_events: 0, blocked_commands: 1, cost_usd: 0.5 },
    }),
    "utf8"
  );
}
const syntheticEvidenceTypeCompareResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "compare-metrics", "--target", syntheticEvidenceTypeTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(
  syntheticEvidenceTypeCompareResult.status,
  0,
  `synthetic evidence_type compare-metrics failed\nstdout:\n${syntheticEvidenceTypeCompareResult.stdout}\nstderr:\n${syntheticEvidenceTypeCompareResult.stderr}`
);
const syntheticEvidenceTypeCompared = JSON.parse(syntheticEvidenceTypeCompareResult.stdout);
assert.strictEqual(
  syntheticEvidenceTypeCompared.recommend_enter_block,
  false,
  "synthetic evidence_type must not recommend block mode"
);
assert.deepStrictEqual(syntheticEvidenceTypeCompared.evidence_types, ["synthetic"]);
assert.strictEqual(syntheticEvidenceTypeCompared.recommendation_reason.representative_evidence, false);

const promotionEvidenceTarget = path.join(tempRoot, "promotion evidence target");
fs.mkdirSync(path.join(promotionEvidenceTarget, ".token-stack", "reports", "baseline"), { recursive: true });
fs.mkdirSync(path.join(promotionEvidenceTarget, ".token-stack", "reports", "post"), { recursive: true });
fs.writeFileSync(
  path.join(promotionEvidenceTarget, ".token-stack", "benchmark.config.json"),
  JSON.stringify({ schema_version: 1, tasks: [{ id: "safe-rollout", prompt: "Representative rollout task." }] }),
  "utf8"
);
for (const phase of ["baseline", "post"]) {
  fs.writeFileSync(
    path.join(promotionEvidenceTarget, ".token-stack", "reports", phase, "safe-rollout.json"),
    JSON.stringify({
      schema_version: 1,
      mode: "ai-enabled",
      evidence_type: "real",
      phase,
      task: "safe-rollout",
      task_success: true,
      metrics: {
        input_tokens: phase === "baseline" ? 100 : 80,
        raw_large_output_events: phase === "baseline" ? 1 : 0,
        blocked_commands: phase === "baseline" ? 0 : 1,
        cost_usd: phase === "baseline" ? 1 : 0.8,
      },
    }),
    "utf8"
  );
}
const missingPromotionEvidenceCompare = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "compare-metrics", "--target", promotionEvidenceTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(
  missingPromotionEvidenceCompare.status,
  0,
  `missing promotion evidence compare-metrics failed\nstdout:\n${missingPromotionEvidenceCompare.stdout}\nstderr:\n${missingPromotionEvidenceCompare.stderr}`
);
const missingPromotionEvidence = JSON.parse(missingPromotionEvidenceCompare.stdout);
assert.strictEqual(
  missingPromotionEvidence.recommend_enter_block,
  false,
  "real metrics alone must not recommend block mode without promotion evidence"
);
assert.strictEqual(missingPromotionEvidence.recommendation_reason.promotion_evidence_present, false);

fs.mkdirSync(path.join(promotionEvidenceTarget, ".claude", "logs"), { recursive: true });
fs.writeFileSync(
  path.join(promotionEvidenceTarget, ".token-stack", "reports", "verify-report.json"),
  JSON.stringify({ schema_version: 1, checks: [{ status: "PASS", name: "target exists" }] }),
  "utf8"
);
fs.writeFileSync(
  path.join(promotionEvidenceTarget, ".claude", "logs", "token-guard.log"),
  `${JSON.stringify({ mode: "warn", tool_name: "Bash", violations: ["tree"] })}\n`,
  "utf8"
);
function writePromotionMetricsSummary(overrides = {}) {
  const summary = {
    schema_version: 1,
    totals: {
      baseline: { input_tokens: 100, raw_large_output_events: 1, blocked_commands: 0, cost_usd: 1 },
      post: { input_tokens: 80, raw_large_output_events: 0, blocked_commands: 1, cost_usd: 0.8 },
    },
    evidence_types: ["real"],
    recommend_enter_block: true,
    ...overrides,
  };
  fs.writeFileSync(
    path.join(promotionEvidenceTarget, ".token-stack", "reports", "metrics-summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
}
writePromotionMetricsSummary();
fs.writeFileSync(
  path.join(promotionEvidenceTarget, ".token-stack", "reports", "false-positive-review.md"),
  "# False Positive Review\n\n- false positives reviewed: 0\n",
  "utf8"
);
const unstructuredPromotionEvidenceCompare = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "compare-metrics", "--target", promotionEvidenceTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(
  unstructuredPromotionEvidenceCompare.status,
  0,
  `unstructured promotion evidence compare-metrics failed\nstdout:\n${unstructuredPromotionEvidenceCompare.stdout}\nstderr:\n${unstructuredPromotionEvidenceCompare.stderr}`
);
const unstructuredPromotionEvidence = JSON.parse(unstructuredPromotionEvidenceCompare.stdout);
assert.strictEqual(
  unstructuredPromotionEvidence.recommend_enter_block,
  false,
  "unstructured false-positive review evidence must not unlock a machine block recommendation"
);
assert.strictEqual(unstructuredPromotionEvidence.promotion_evidence.false_positive_review_artifact, true);
assert.strictEqual(unstructuredPromotionEvidence.promotion_evidence.false_positive_review_json_valid, false);
assert.ok(
  unstructuredPromotionEvidence.promotion_evidence.warnings.some(
    (warning) => warning.code === "false_positive_review_json_missing"
  ),
  "unstructured review should warn that structured JSON is missing"
);

fs.writeFileSync(
  path.join(promotionEvidenceTarget, ".token-stack", "reports", "false-positive-review.json"),
  JSON.stringify({ schema_version: 1, false_positive_count: 0 }),
  "utf8"
);
const invalidReviewJsonCompare = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "compare-metrics", "--target", promotionEvidenceTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(
  invalidReviewJsonCompare.status,
  0,
  `invalid false-positive review JSON compare-metrics failed\nstdout:\n${invalidReviewJsonCompare.stdout}\nstderr:\n${invalidReviewJsonCompare.stderr}`
);
const invalidReviewJson = JSON.parse(invalidReviewJsonCompare.stdout);
assert.strictEqual(invalidReviewJson.recommend_enter_block, false, "invalid false-positive review JSON must not recommend block");
assert.strictEqual(invalidReviewJson.promotion_evidence.false_positive_review_json_valid, false);
assert.ok(
  invalidReviewJson.promotion_evidence.warnings.some(
    (warning) => warning.code === "false_positive_review_json_invalid"
  ),
  "invalid review JSON should report validation warnings"
);

function writeCompleteFalsePositiveReview(targetDir) {
  fs.writeFileSync(
    path.join(targetDir, ".token-stack", "reports", "false-positive-review.json"),
    JSON.stringify(
      {
        schema_version: 1,
        reviewed_at: "2026-06-24T00:00:00Z",
        reviewed_log_paths: [".claude/logs/token-guard.log"],
        reviewed_entries: 1,
        true_positive_count: 1,
        false_positive_count: 0,
        unclear_count: 0,
        reviewer: "local-smoke",
        notes: "Synthetic promotion fixture; no real rollout claim.",
      },
      null,
      2
    ),
    "utf8"
  );
}

writeCompleteFalsePositiveReview(promotionEvidenceTarget);
const completePromotionEvidenceCompare = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "compare-metrics", "--target", promotionEvidenceTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(
  completePromotionEvidenceCompare.status,
  0,
  `complete promotion evidence compare-metrics failed\nstdout:\n${completePromotionEvidenceCompare.stdout}\nstderr:\n${completePromotionEvidenceCompare.stderr}`
);
const completePromotionEvidence = JSON.parse(completePromotionEvidenceCompare.stdout);
assert.strictEqual(
  completePromotionEvidence.recommend_enter_block,
  true,
  "real metrics can recommend block mode only when structured promotion evidence is present"
);
assert.strictEqual(completePromotionEvidence.promotion_evidence.false_positive_review_json_valid, true);
assert.strictEqual(completePromotionEvidence.recommendation_reason.promotion_evidence_present, true);

const customMetricsTarget = path.join(tempRoot, "custom metrics target");
fs.mkdirSync(path.join(customMetricsTarget, ".token-stack", "reports", "baseline"), { recursive: true });
fs.mkdirSync(path.join(customMetricsTarget, ".token-stack", "reports", "post"), { recursive: true });
fs.writeFileSync(
  path.join(customMetricsTarget, ".token-stack", "benchmark.config.json"),
  JSON.stringify({ schema_version: 1, tasks: [{ id: "targeted-test", prompt: "Run targeted test." }] }),
  "utf8"
);
for (const phase of ["baseline", "post"]) {
  fs.writeFileSync(
    path.join(customMetricsTarget, ".token-stack", "reports", phase, "targeted-test.json"),
    JSON.stringify({
      schema_version: 1,
      mode: "ai-enabled",
      evidence_type: "real",
      phase,
      task: "targeted-test",
      task_success: true,
      metrics: { input_tokens: phase === "baseline" ? 100 : 80, cost_usd: phase === "baseline" ? 1 : 0.8 },
    }),
    "utf8"
  );
}
const customCompareResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "compare-metrics", "--target", customMetricsTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(
  customCompareResult.status,
  0,
  `custom compare-metrics failed\nstdout:\n${customCompareResult.stdout}\nstderr:\n${customCompareResult.stderr}`
);
const customCompared = JSON.parse(customCompareResult.stdout);
assert.ok(customCompared.tasks["targeted-test"], "compare-metrics should follow benchmark.config.json tasks");
assert.ok(!customCompared.tasks["code-discovery"], "configured tasks should not force built-in task rows");

console.log("metrics compare smoke tests passed");
