#!/usr/bin/env node
const assert = require("assert");
const path = require("path");
const { readJson, validate } = require("../../bin/schema-validator");

const repoRoot = path.resolve(__dirname, "..", "..");

function assertValid(schema, value, label) {
  const errors = validate(schema, value);
  assert.deepStrictEqual(errors, [], `${label} should be valid\n${errors.join("\n")}`);
}

function assertInvalid(schema, value, label) {
  const errors = validate(schema, value);
  assert.ok(errors.length > 0, `${label} should be invalid`);
}

function readRepoJson(rel) {
  return readJson(path.join(repoRoot, rel));
}

const metricsSchema = readRepoJson("schemas/metrics.schema.json");
const metricsSummarySchema = readRepoJson("schemas/metrics-summary.schema.json");
const benchmarkConfigSchema = readRepoJson("schemas/benchmark.config.schema.json");
const caseStudySchema = readRepoJson("schemas/case-study.schema.json");
const falsePositiveReviewSchema = readRepoJson("schemas/false-positive-review.schema.json");

for (const [schema, name] of [
  [metricsSchema, "metrics"],
  [metricsSummarySchema, "metrics summary"],
  [benchmarkConfigSchema, "benchmark config"],
  [caseStudySchema, "case study"],
  [falsePositiveReviewSchema, "false-positive review"],
]) {
  assert.strictEqual(schema.$schema, "https://json-schema.org/draft/2020-12/schema", `${name} schema should declare draft`);
  assert.strictEqual(schema.properties.schema_version.const, 1, `${name} schema should use schema_version 1`);
}

assertValid(metricsSchema, {
  schema_version: 1,
  mode: "ai-enabled",
  evidence_type: "real",
  phase: "baseline",
  task: "safe-rollout",
  task_success: true,
  metrics: { input_tokens: 100, cost_usd: 1.25 },
}, "valid metrics record");
assertInvalid(metricsSchema, { schema_version: 2, phase: "baseline", task: "x", metrics: {} }, "metrics schema_version");
assertInvalid(metricsSchema, { schema_version: 1, evidence_type: "demo", phase: "baseline", task: "x", metrics: {} }, "metrics evidence_type");
assertInvalid(metricsSchema, { schema_version: 1, phase: "during", task: "x", metrics: {} }, "metrics phase");
assertInvalid(metricsSchema, { schema_version: 1, phase: "baseline", task: "", metrics: {} }, "metrics empty task");

assertValid(metricsSummarySchema, {
  schema_version: 1,
  totals: {
    baseline: { input_tokens: 100, cost_usd: 1.25 },
    post: { input_tokens: 80, cost_usd: 1.0 },
  },
  evidence_types: ["real"],
  recommend_enter_block: false,
}, "valid metrics summary");
assertInvalid(metricsSummarySchema, { schema_version: 1, evidence_types: ["real"], recommend_enter_block: false }, "metrics summary missing totals");
assertInvalid(metricsSummarySchema, {
  schema_version: 1,
  totals: { baseline: {}, post: {} },
  evidence_types: ["demo"],
  recommend_enter_block: false,
}, "metrics summary invalid evidence_type");
assertInvalid(metricsSummarySchema, {
  schema_version: 1,
  totals: { baseline: {}, post: {} },
  evidence_types: ["real"],
  recommend_enter_block: "false",
}, "metrics summary recommend_enter_block boolean");

assertValid(benchmarkConfigSchema, readRepoJson("docs/examples/benchmark.config.example.json"), "benchmark config example");
assertInvalid(benchmarkConfigSchema, { tasks: [{ id: "x" }] }, "benchmark missing schema_version");
assertInvalid(benchmarkConfigSchema, { schema_version: 1 }, "benchmark missing tasks");
assertInvalid(benchmarkConfigSchema, { schema_version: 1, tasks: [] }, "benchmark empty tasks");
assertInvalid(benchmarkConfigSchema, { schema_version: 1, tasks: [{ prompt: "missing id" }] }, "benchmark task missing id");
assertInvalid(benchmarkConfigSchema, { schema_version: 1, tasks: [{ id: "x", evidence_type: "demo" }] }, "benchmark invalid evidence_type");

assertValid(caseStudySchema, {
  schema_version: 1,
  project: "example-service",
  evidence_type: "mixed",
  summary: "Representative baseline/post comparison.",
  artifacts: [".token-stack/reports/metrics-summary.json"],
}, "case study");
assertInvalid(caseStudySchema, { schema_version: 1, project: "x", evidence_type: "real", summary: "missing artifacts" }, "case study missing artifacts");
assertInvalid(caseStudySchema, { schema_version: 1, project: "", evidence_type: "real", summary: "x", artifacts: ["x"] }, "case study empty project");
assertInvalid(caseStudySchema, { schema_version: 1, project: "x", evidence_type: "demo", summary: "x", artifacts: ["x"] }, "case study invalid evidence_type");

assertValid(falsePositiveReviewSchema, {
  schema_version: 1,
  reviewed_at: "2026-06-24T00:00:00Z",
  reviewed_log_paths: [".claude/logs/token-guard.log"],
  reviewed_entries: 3,
  true_positive_count: 2,
  false_positive_count: 1,
  unclear_count: 0,
  reviewer: "local reviewer",
  notes: "Reviewed before block promotion.",
}, "false-positive review");
assertInvalid(falsePositiveReviewSchema, { schema_version: 1 }, "false-positive review missing fields");
assertInvalid(falsePositiveReviewSchema, {
  schema_version: 1,
  reviewed_at: "",
  reviewed_log_paths: [],
  reviewed_entries: -1,
  true_positive_count: 0,
  false_positive_count: 0,
  unclear_count: 0,
}, "false-positive review invalid values");
assertInvalid(falsePositiveReviewSchema, {
  schema_version: 1,
  reviewed_at: "2026-06-24T00:00:00Z",
  reviewed_log_paths: [".claude/logs/token-guard.log"],
  reviewed_entries: 1.5,
  true_positive_count: 0,
  false_positive_count: 0,
  unclear_count: 0,
}, "false-positive review integer fields");

console.log("schema fixture smoke tests passed");
