#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cts artifact validation "));
const target = path.join(tempRoot, "target with spaces");
const caseStudyPath = path.join(target, ".token-stack", "reports", "case-studies", "safe-rollout.json");

function writeJson(rel, value) {
  const filePath = path.join(target, rel);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(rel, value) {
  const filePath = path.join(target, rel);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function validate(extraArgs = ["--json", "--no-write"]) {
  return spawnSync(
    process.execPath,
    [path.join(repoRoot, "bin", "cts.js"), "validate-artifacts", "--target", target, ...extraArgs],
    { encoding: "utf8" }
  );
}

function writeMetricsSummary(overrides = {}) {
  writeJson(".token-stack/reports/metrics-summary.json", {
    schema_version: 1,
    totals: {
      baseline: { input_tokens: 100, raw_large_output_events: 1, blocked_commands: 0, cost_usd: 1 },
      post: { input_tokens: 80, raw_large_output_events: 0, blocked_commands: 1, cost_usd: 0.8 },
    },
    evidence_types: ["real"],
    recommend_enter_block: true,
    ...overrides,
  });
}

function writeFalsePositiveReview() {
  writeJson(".token-stack/reports/false-positive-review.json", {
    schema_version: 1,
    reviewed_at: "2026-06-24T00:00:00Z",
    reviewed_log_paths: [".claude/logs/token-guard.log"],
    reviewed_entries: 1,
    true_positive_count: 1,
    false_positive_count: 0,
    unclear_count: 0,
    reviewer: "artifact-smoke",
    notes: "Local smoke fixture; no real rollout claim.",
  });
}

const completeArtifacts = [
  ".token-stack/reports/verify-report.json",
  ".token-stack/reports/baseline/safe-rollout.json",
  ".token-stack/reports/post/safe-rollout.json",
  ".token-stack/reports/metrics-summary.json",
  ".token-stack/reports/false-positive-review.json",
  ".claude/logs/token-guard.log",
];

function writeCaseStudy(artifacts = completeArtifacts, metrics = {}) {
  writeJson(".token-stack/reports/case-studies/safe-rollout.json", {
    schema_version: 1,
    project: "artifact validation target",
    evidence_type: "real",
    summary: "Representative artifact validation fixture.",
    metrics: {
      baseline_input_tokens: 100,
      post_input_tokens: 80,
      baseline_cost_usd: 1,
      post_cost_usd: 0.8,
      raw_large_output_events_before: 1,
      raw_large_output_events_after: 0,
      ...metrics,
    },
    artifacts,
    limitations: ["Synthetic local fixture for smoke coverage."],
  });
}

writeJson(".token-stack/benchmark.config.json", {
  schema_version: 1,
  tasks: [{ id: "safe-rollout", prompt: "Representative rollout task." }],
});
for (const phase of ["baseline", "post"]) {
  writeJson(`.token-stack/reports/${phase}/safe-rollout.json`, {
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
  });
}
writeJson(".token-stack/reports/verify-report.json", {
  schema_version: 1,
  checks: [{ status: "PASS", name: "target exists" }],
});
writeText(".claude/logs/token-guard.log", `${JSON.stringify({ mode: "warn", tool_name: "Bash", violations: ["tree"] })}\n`);
writeMetricsSummary();
writeFalsePositiveReview();
writeCaseStudy();

const validResult = validate();
assert.strictEqual(
  validResult.status,
  0,
  `valid artifact validation failed\nstdout:\n${validResult.stdout}\nstderr:\n${validResult.stderr}`
);
assert.strictEqual(validResult.stderr, "", "validate-artifacts --json should keep diagnostics out of stderr");
const validReport = JSON.parse(validResult.stdout);
assert.strictEqual(validReport.dry_run, true);
assert.strictEqual(validReport.totals.FAIL || 0, 0);
assert.ok(validReport.groups.case_studies.PASS >= 1, "validate-artifacts should group case-study findings");
assert.ok(validReport.groups.metrics_summary.PASS >= 1, "validate-artifacts should group metrics-summary findings");
assert.ok(validReport.groups.references.PASS >= 1, "validate-artifacts should group artifact reference findings");
assert.ok(
  validReport.findings.some(
    (finding) =>
      finding.status === "PASS" &&
      finding.code === "schema_valid" &&
      finding.file.endsWith(".token-stack/reports/case-studies/safe-rollout.json")
  ),
  "validate-artifacts should discover case-study JSON files in normal report folders"
);
assert.ok(
  validReport.findings.some(
    (finding) =>
      finding.status === "PASS" &&
      finding.code === "evidence_bundle_present" &&
      finding.file.endsWith(".token-stack/reports/case-studies/safe-rollout.json")
  ),
  "validate-artifacts should confirm real case studies cite baseline, post, and metrics-summary evidence"
);
assert.ok(
  validReport.findings.some(
    (finding) =>
      finding.status === "PASS" &&
      finding.code === "case_study_metrics_match" &&
      finding.file.endsWith(".token-stack/reports/case-studies/safe-rollout.json")
  ),
  "validate-artifacts should confirm case-study metrics match referenced metric artifacts"
);
assert.ok(
  validReport.findings.some(
    (finding) =>
      finding.status === "PASS" &&
      finding.code === "schema_valid" &&
      finding.file.endsWith(".token-stack/reports/metrics-summary.json")
  ),
  "validate-artifacts should validate metrics-summary.json against its schema"
);
assert.ok(
  validReport.findings.some(
    (finding) =>
      finding.status === "PASS" &&
      finding.code === "metrics_summary_match" &&
      finding.file.endsWith(".token-stack/reports/metrics-summary.json")
  ),
  "validate-artifacts should confirm metrics-summary totals match referenced metric artifacts"
);
assert.ok(
  validReport.findings.some(
    (finding) =>
      finding.status === "PASS" &&
      finding.code === "metrics_summary_evidence_type_match" &&
      finding.file.endsWith(".token-stack/reports/metrics-summary.json")
  ),
  "validate-artifacts should confirm metrics-summary evidence_types include the case-study evidence_type"
);
assert.ok(
  !validReport.findings.some(
    (finding) => finding.status === "WARN" && finding.file.endsWith(".token-stack/reports/case-study.json")
  ),
  "validate-artifacts should not warn about the legacy fixed case-study path when discovered case studies exist"
);
assert.ok(
  !fs.existsSync(path.join(target, ".token-stack", "reports", "artifact-validation.json")),
  "validate-artifacts --no-write should not create report files"
);

writeMetricsSummary({ evidence_types: ["demo"] });
const invalidMetricsSummaryResult = validate();
assert.strictEqual(invalidMetricsSummaryResult.status, 1, "invalid metrics-summary.json should fail artifact validation");
assert.strictEqual(invalidMetricsSummaryResult.stderr, "", "invalid metrics-summary diagnostics should stay in stdout JSON");
assert.ok(
  JSON.parse(invalidMetricsSummaryResult.stdout).findings.some(
    (finding) =>
      finding.status === "FAIL" &&
      finding.code === "schema_invalid" &&
      finding.file.endsWith(".token-stack/reports/metrics-summary.json")
  ),
  "invalid artifact validation should report metrics-summary schema failures"
);
writeMetricsSummary();

writeCaseStudy(completeArtifacts.map((artifact) => artifact.replace(/\//g, "\\")));
const windowsStyleReferenceResult = validate();
assert.strictEqual(windowsStyleReferenceResult.status, 0, "Windows-style relative artifact separators should pass validation");
assert.strictEqual(windowsStyleReferenceResult.stderr, "", "Windows-style relative reference diagnostics should stay in stdout JSON");
assert.ok(
  JSON.parse(windowsStyleReferenceResult.stdout).findings.some(
    (finding) =>
      finding.status === "PASS" &&
      finding.code === "artifact_reference_present" &&
      finding.file.endsWith(".token-stack/reports/metrics-summary.json")
  ),
  "Windows-style relative artifact references should resolve to target-local files"
);

writeJson(".token-stack/reports/false-positive-review.json", { schema_version: 1, false_positive_count: 0 });
const invalidReviewResult = validate();
assert.strictEqual(invalidReviewResult.status, 1, "invalid false-positive-review.json should fail artifact validation");
assert.strictEqual(invalidReviewResult.stderr, "", "failing validate-artifacts --json should keep diagnostics in stdout JSON");
const invalidReviewReport = JSON.parse(invalidReviewResult.stdout);
assert.ok(
  invalidReviewReport.findings.some(
    (finding) => finding.status === "FAIL" && finding.code === "schema_invalid" && finding.file.endsWith("false-positive-review.json")
  ),
  "invalid artifact validation should report the failing file"
);
assert.notStrictEqual(
  invalidReviewReport.findings[0].status,
  "FAIL",
  "validate-artifacts JSON findings should preserve collection order rather than severity order"
);

const writeResult = validate([]);
assert.strictEqual(writeResult.status, 1, "invalid artifact validation should fail when writing Markdown and HTML reports");
const artifactValidationMdPath = path.join(target, ".token-stack", "reports", "artifact-validation.md");
assert.ok(fs.existsSync(artifactValidationMdPath), "validate-artifacts should write artifact-validation.md without --no-write");
const artifactValidationMd = fs.readFileSync(artifactValidationMdPath, "utf8").split(/\r?\n/);
const findingsHeadingIndex = artifactValidationMd.indexOf("## Findings");
assert.ok(findingsHeadingIndex >= 0, "artifact-validation.md should include a Findings section");
const firstMarkdownFinding = artifactValidationMd.slice(findingsHeadingIndex + 1).find((line) => line.startsWith("- ["));
assert.ok(firstMarkdownFinding && firstMarkdownFinding.startsWith("- [FAIL]"), "Markdown findings should list failures before passes");
const artifactValidationHtmlPath = path.join(target, ".token-stack", "reports", "artifact-validation.html");
assert.ok(fs.existsSync(artifactValidationHtmlPath), "validate-artifacts should write artifact-validation.html without --no-write");
const artifactValidationHtml = fs.readFileSync(artifactValidationHtmlPath, "utf8");
assert.match(artifactValidationHtml, /<title>Artifact Validation<\/title>/);
assert.match(artifactValidationHtml, /<nav aria-label="Artifact validation sections">/);
assert.match(artifactValidationHtml, /href="#groups"/);
assert.match(artifactValidationHtml, /href="#findings"/);
assert.match(artifactValidationHtml, /<section id="groups">/);
assert.match(artifactValidationHtml, /<section id="findings">/);
assert.match(artifactValidationHtml, /\[FAIL\]/, "HTML report should include failing findings");

writeFalsePositiveReview();
writeCaseStudy([".token-stack/reports/missing-evidence.json"]);
const missingReferenceResult = validate();
assert.strictEqual(missingReferenceResult.status, 1, "missing case-study artifact references should fail validation");
assert.strictEqual(missingReferenceResult.stderr, "", "missing reference diagnostics should stay in stdout JSON");
assert.ok(
  JSON.parse(missingReferenceResult.stdout).findings.some(
    (finding) =>
      finding.status === "FAIL" &&
      finding.code === "artifact_reference_missing" &&
      finding.file.endsWith(".token-stack/reports/missing-evidence.json")
  ),
  "missing artifact validation should identify the referenced local artifact"
);

writeCaseStudy([
  ".token-stack/reports/verify-report.json",
  ".token-stack/reports/metrics-summary.json",
  ".token-stack/reports/false-positive-review.json",
]);
const incompleteBundleResult = validate();
assert.strictEqual(incompleteBundleResult.status, 1, "real case studies without baseline/post evidence should fail validation");
assert.strictEqual(incompleteBundleResult.stderr, "", "incomplete bundle diagnostics should stay in stdout JSON");
assert.ok(
  JSON.parse(incompleteBundleResult.stdout).findings.some(
    (finding) =>
      finding.status === "FAIL" &&
      finding.code === "evidence_bundle_incomplete" &&
      finding.file.endsWith(".token-stack/reports/case-studies/safe-rollout.json")
  ),
  "incomplete bundle validation should identify the case-study file"
);

writeCaseStudy(completeArtifacts, { baseline_input_tokens: 999 });
const mismatchedMetricsResult = validate();
assert.strictEqual(mismatchedMetricsResult.status, 1, "case-study metrics that contradict referenced records should fail validation");
assert.strictEqual(mismatchedMetricsResult.stderr, "", "mismatched metric diagnostics should stay in stdout JSON");
assert.ok(
  JSON.parse(mismatchedMetricsResult.stdout).findings.some(
    (finding) =>
      finding.status === "FAIL" &&
      finding.code === "case_study_metrics_mismatch" &&
      finding.file.endsWith(".token-stack/reports/case-studies/safe-rollout.json")
  ),
  "mismatched metric validation should identify the case-study file"
);

writeCaseStudy(completeArtifacts, { raw_large_output_events_after: 3 });
const mismatchedRawEventsResult = validate();
assert.strictEqual(
  mismatchedRawEventsResult.status,
  1,
  "case-study raw_large_output_events that contradict referenced records should fail validation"
);
assert.strictEqual(mismatchedRawEventsResult.stderr, "", "mismatched raw-event diagnostics should stay in stdout JSON");
assert.ok(
  JSON.parse(mismatchedRawEventsResult.stdout).findings.some(
    (finding) =>
      finding.status === "FAIL" &&
      finding.code === "case_study_metrics_mismatch" &&
      finding.file.endsWith(".token-stack/reports/case-studies/safe-rollout.json")
  ),
  "mismatched raw-event validation should identify the case-study file"
);

writeCaseStudy();
writeMetricsSummary({
  totals: {
    baseline: { input_tokens: 999, raw_large_output_events: 1, blocked_commands: 0, cost_usd: 1 },
    post: { input_tokens: 80, raw_large_output_events: 0, blocked_commands: 1, cost_usd: 0.8 },
  },
});
const mismatchedSummaryResult = validate();
assert.strictEqual(mismatchedSummaryResult.status, 1, "metrics-summary totals that contradict referenced records should fail validation");
assert.strictEqual(mismatchedSummaryResult.stderr, "", "mismatched metrics-summary diagnostics should stay in stdout JSON");
assert.ok(
  JSON.parse(mismatchedSummaryResult.stdout).findings.some(
    (finding) =>
      finding.status === "FAIL" &&
      finding.code === "metrics_summary_mismatch" &&
      finding.file.endsWith(".token-stack/reports/metrics-summary.json")
  ),
  "mismatched metrics-summary validation should identify metrics-summary.json"
);

writeMetricsSummary({ evidence_types: ["synthetic"] });
const mismatchedEvidenceTypeResult = validate();
assert.strictEqual(
  mismatchedEvidenceTypeResult.status,
  1,
  "metrics-summary evidence_types that contradict the case study should fail validation"
);
assert.strictEqual(mismatchedEvidenceTypeResult.stderr, "", "mismatched evidence_type diagnostics should stay in stdout JSON");
assert.ok(
  JSON.parse(mismatchedEvidenceTypeResult.stdout).findings.some(
    (finding) =>
      finding.status === "FAIL" &&
      finding.code === "metrics_summary_evidence_type_mismatch" &&
      finding.file.endsWith(".token-stack/reports/metrics-summary.json")
  ),
  "mismatched metrics-summary evidence_type validation should identify metrics-summary.json"
);

writeMetricsSummary();
writeCaseStudy(["../outside-evidence.json"]);
const unsafeReferenceResult = validate();
assert.strictEqual(unsafeReferenceResult.status, 1, "escaping case-study artifact references should fail validation");
assert.strictEqual(unsafeReferenceResult.stderr, "", "unsafe reference diagnostics should stay in stdout JSON");
assert.ok(
  JSON.parse(unsafeReferenceResult.stdout).findings.some(
    (finding) =>
      finding.status === "FAIL" &&
      finding.code === "artifact_reference_unsafe" &&
      finding.file.endsWith(".token-stack/reports/case-studies/safe-rollout.json")
  ),
  "unsafe artifact validation should identify the case-study file with the escaping reference"
);

writeCaseStudy(["C:outside\\evidence.json"]);
const driveRelativeReferenceResult = validate();
assert.strictEqual(driveRelativeReferenceResult.status, 1, "Windows drive-relative artifact references should fail validation");
assert.strictEqual(driveRelativeReferenceResult.stderr, "", "drive-relative reference diagnostics should stay in stdout JSON");
assert.ok(
  JSON.parse(driveRelativeReferenceResult.stdout).findings.some(
    (finding) =>
      finding.status === "FAIL" &&
      finding.code === "artifact_reference_unsafe" &&
      finding.file.endsWith(".token-stack/reports/case-studies/safe-rollout.json")
  ),
  "drive-relative artifact validation should identify the case-study file with the unsafe reference"
);

writeMetricsSummary();
writeFalsePositiveReview();
writeCaseStudy();
const outsideArtifactDir = path.join(tempRoot, "outside artifacts");
fs.mkdirSync(outsideArtifactDir, { recursive: true });
fs.writeFileSync(
  path.join(outsideArtifactDir, "baseline.json"),
  `${JSON.stringify({
    schema_version: 1,
    phase: "baseline",
    task: "safe-rollout",
    metrics: { input_tokens: 100, raw_large_output_events: 1, blocked_commands: 0, cost_usd: 1 },
  })}\n`,
  "utf8"
);
fs.writeFileSync(
  path.join(outsideArtifactDir, "post.json"),
  `${JSON.stringify({
    schema_version: 1,
    phase: "post",
    task: "safe-rollout",
    metrics: { input_tokens: 80, raw_large_output_events: 0, blocked_commands: 1, cost_usd: 0.8 },
  })}\n`,
  "utf8"
);
let artifactSymlinkCreated = false;
try {
  fs.rmSync(path.join(target, ".token-stack", "reports", "baseline", "safe-rollout.json"), { force: true });
  fs.rmSync(path.join(target, ".token-stack", "reports", "post", "safe-rollout.json"), { force: true });
  fs.symlinkSync(
    path.join(outsideArtifactDir, "baseline.json"),
    path.join(target, ".token-stack", "reports", "baseline", "safe-rollout.json")
  );
  fs.symlinkSync(
    path.join(outsideArtifactDir, "post.json"),
    path.join(target, ".token-stack", "reports", "post", "safe-rollout.json")
  );
  artifactSymlinkCreated = true;
} catch {
  artifactSymlinkCreated = false;
}
if (artifactSymlinkCreated) {
  const symlinkReferenceResult = validate();
  assert.strictEqual(symlinkReferenceResult.status, 1, "symlinked artifact references resolving outside target should fail validation");
  assert.ok(
    JSON.parse(symlinkReferenceResult.stdout).findings.some(
      (finding) =>
        finding.status === "FAIL" &&
        finding.code === "artifact_reference_unsafe" &&
        finding.file.endsWith(".token-stack/reports/case-studies/safe-rollout.json")
    ),
    "symlink artifact validation should identify the case-study file with the unsafe reference"
  );
}
for (const phase of ["baseline", "post"]) {
  fs.rmSync(path.join(target, ".token-stack", "reports", phase, "safe-rollout.json"), { force: true });
  writeJson(`.token-stack/reports/${phase}/safe-rollout.json`, {
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
  });
}

writeJson(".token-stack/reports/false-positive-review.json", {
  schema_version: 1,
  reviewed_at: "2026-06-24T00:00:00Z",
  reviewed_log_paths: [".claude/logs/token-guard.log"],
  reviewed_entries: 1,
  true_positive_count: 2,
  false_positive_count: 0,
  unclear_count: 0,
});
const invalidClassifiedCountsResult = validate();
assert.strictEqual(
  invalidClassifiedCountsResult.status,
  1,
  "false-positive review classified counts exceeding reviewed_entries should fail validation"
);
assert.ok(
  JSON.parse(invalidClassifiedCountsResult.stdout).findings.some(
    (finding) =>
      finding.status === "FAIL" &&
      finding.code === "false_positive_review_invalid" &&
      finding.file.endsWith(".token-stack/reports/false-positive-review.json")
  ),
  "false-positive review semantic validation should identify classified count overflow"
);

assert.ok(fs.existsSync(caseStudyPath), "fixture should keep the case-study artifact local to the test target");
console.log("artifact validation smoke tests passed");
