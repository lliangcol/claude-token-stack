#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { readJson, validate } = require("./schema-validator");

const repoRoot = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

function option(name, fallback) {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const target = path.resolve(option("--target", process.env.CTS_TARGET_DIR || process.cwd()));
const jsonOutput = args.includes("--json");
const noWrite = args.includes("--no-write") || args.includes("--dry-run") || args.includes("dry-run");

function rel(filePath) {
  return path.relative(target, filePath).replace(/\\/g, "/");
}

function add(findings, status, code, filePath, detail, errors = []) {
  findings.push({
    status,
    code,
    file: filePath ? rel(filePath) : "",
    detail,
    errors,
  });
}

function validateJsonFile(findings, filePath, schema, label) {
  if (!fs.existsSync(filePath)) {
    add(findings, "WARN", "artifact_missing", filePath, `${label} not found`);
    return;
  }
  let data;
  try {
    data = readJson(filePath);
  } catch (exc) {
    add(findings, "FAIL", "json_invalid", filePath, `${label} is not valid JSON: ${exc.message}`);
    return;
  }
  const errors = validate(schema, data);
  add(
    findings,
    errors.length === 0 ? "PASS" : "FAIL",
    errors.length === 0 ? "schema_valid" : "schema_invalid",
    filePath,
    errors.length === 0 ? `${label} matches schema` : `${label} does not match schema`,
    errors
  );
}

function parseJsonOnly(findings, filePath, label) {
  if (!fs.existsSync(filePath)) {
    add(findings, "WARN", "artifact_missing", filePath, `${label} not found`);
    return;
  }
  try {
    readJson(filePath);
    add(findings, "PASS", "json_valid", filePath, `${label} is valid JSON`);
  } catch (exc) {
    add(findings, "FAIL", "json_invalid", filePath, `${label} is not valid JSON: ${exc.message}`);
  }
}

function isInsideTarget(filePath) {
  const relative = path.relative(target, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isWindowsDriveRelative(artifact) {
  return /^[A-Za-z]:/.test(artifact) && !path.win32.isAbsolute(artifact);
}

function normalizeArtifactReference(artifact) {
  return artifact.replace(/\\/g, "/");
}

function resolveSafeArtifact(artifact) {
  if (artifact.includes("\0")) {
    return { error: "contains null byte" };
  }
  if (path.isAbsolute(artifact) || path.posix.isAbsolute(artifact) || path.win32.isAbsolute(artifact)) {
    return { error: "must be relative to target" };
  }
  if (isWindowsDriveRelative(artifact)) {
    return { error: "uses a Windows drive-relative path" };
  }
  const artifactPath = path.resolve(target, normalizeArtifactReference(artifact));
  if (!isInsideTarget(artifactPath)) {
    return { error: "escapes target" };
  }
  return { artifactPath };
}

function validateCaseStudyReferences(findings, caseStudyPath, caseStudy) {
  if (!Array.isArray(caseStudy.artifacts)) return;
  for (const artifact of caseStudy.artifacts) {
    if (typeof artifact !== "string") continue;
    const resolved = resolveSafeArtifact(artifact);
    if (!resolved.artifactPath) {
      add(
        findings,
        "FAIL",
        "artifact_reference_unsafe",
        caseStudyPath,
        `case-study artifact reference ${resolved.error}: ${artifact}`
      );
      continue;
    }
    const artifactPath = resolved.artifactPath;
    if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
      add(
        findings,
        "FAIL",
        "artifact_reference_missing",
        artifactPath,
        `case-study artifact referenced by ${rel(caseStudyPath)} not found`
      );
      continue;
    }
    add(
      findings,
      "PASS",
      "artifact_reference_present",
      artifactPath,
      `case-study artifact referenced by ${rel(caseStudyPath)} exists`
    );
  }
}

function validateCaseStudyEvidenceBundle(findings, caseStudyPath, caseStudy) {
  if (!["real", "mixed"].includes(caseStudy.evidence_type) || !Array.isArray(caseStudy.artifacts)) return;
  const artifacts = caseStudy.artifacts
    .filter((artifact) => typeof artifact === "string")
    .map((artifact) => normalizeArtifactReference(artifact));
  const evidence = {
    baseline: artifacts.some((artifact) => /^\.token-stack\/reports\/baseline\/[^/]+\.json$/.test(artifact)),
    post: artifacts.some((artifact) => /^\.token-stack\/reports\/post\/[^/]+\.json$/.test(artifact)),
    metricsSummary: artifacts.includes(".token-stack/reports/metrics-summary.json"),
  };
  const missing = Object.entries(evidence)
    .filter(([, present]) => !present)
    .map(([name]) => name);
  if (missing.length > 0) {
    add(
      findings,
      "FAIL",
      "evidence_bundle_incomplete",
      caseStudyPath,
      `real/mixed case study must cite baseline, post, and metrics-summary evidence; missing: ${missing.join(", ")}`
    );
    return;
  }
  add(
    findings,
    "PASS",
    "evidence_bundle_present",
    caseStudyPath,
    "real/mixed case study cites baseline, post, and metrics-summary evidence"
  );
}

function metricValue(record, metric) {
  if (!record || typeof record !== "object" || !record.metrics || typeof record.metrics !== "object") return null;
  if (metric === "cost_usd") {
    if (typeof record.metrics.cost_usd === "number") return record.metrics.cost_usd;
    if (typeof record.metrics.total_cost_usd === "number") return record.metrics.total_cost_usd;
    return null;
  }
  return typeof record.metrics[metric] === "number" ? record.metrics[metric] : null;
}

function sumReferencedMetric(artifacts, phase, metric) {
  let total = 0;
  let count = 0;
  for (const artifact of artifacts) {
    if (typeof artifact !== "string") continue;
    const normalized = normalizeArtifactReference(artifact);
    if (!new RegExp(`^\\.token-stack/reports/${phase}/[^/]+\\.json$`).test(normalized)) continue;
    const resolved = resolveSafeArtifact(artifact);
    if (!resolved.artifactPath || !fs.existsSync(resolved.artifactPath) || !fs.statSync(resolved.artifactPath).isFile()) continue;
    let record;
    try {
      record = readJson(resolved.artifactPath);
    } catch {
      continue;
    }
    const value = metricValue(record, metric);
    if (typeof value === "number") {
      total += value;
      count += 1;
    }
  }
  return count > 0 ? total : null;
}

function summaryMetricValue(summary, phase, metric) {
  if (!summary || typeof summary !== "object" || !summary.totals || typeof summary.totals !== "object") return null;
  const phaseTotals = summary.totals[phase];
  if (!phaseTotals || typeof phaseTotals !== "object") return null;
  if (metric === "cost_usd") {
    if (typeof phaseTotals.cost_usd === "number") return phaseTotals.cost_usd;
    if (typeof phaseTotals.total_cost_usd === "number") return phaseTotals.total_cost_usd;
    return null;
  }
  return typeof phaseTotals[metric] === "number" ? phaseTotals[metric] : null;
}

function numbersMatch(left, right) {
  return Math.abs(left - right) <= 1e-9;
}

function validateCaseStudyMetricConsistency(findings, caseStudyPath, caseStudy) {
  if (!["real", "mixed"].includes(caseStudy.evidence_type) || !Array.isArray(caseStudy.artifacts)) return;
  const required = {
    baseline_input_tokens: ["baseline", "input_tokens"],
    post_input_tokens: ["post", "input_tokens"],
    baseline_cost_usd: ["baseline", "cost_usd"],
    post_cost_usd: ["post", "cost_usd"],
    raw_large_output_events_before: ["baseline", "raw_large_output_events"],
    raw_large_output_events_after: ["post", "raw_large_output_events"],
  };
  if (!caseStudy.metrics || typeof caseStudy.metrics !== "object" || Array.isArray(caseStudy.metrics)) {
    add(
      findings,
      "FAIL",
      "case_study_metrics_missing",
      caseStudyPath,
      `real/mixed case study metrics must include: ${Object.keys(required).join(", ")}`
    );
    return;
  }
  const missing = Object.keys(required).filter((field) => typeof caseStudy.metrics[field] !== "number");
  if (missing.length > 0) {
    add(
      findings,
      "FAIL",
      "case_study_metrics_missing",
      caseStudyPath,
      `real/mixed case study metrics missing numeric fields: ${missing.join(", ")}`
    );
    return;
  }
  const mismatches = [];
  const sourceMissing = [];
  for (const [field, [phase, metric]] of Object.entries(required)) {
    const referenced = sumReferencedMetric(caseStudy.artifacts, phase, metric);
    if (referenced === null) {
      sourceMissing.push(`${field} from ${phase} ${metric}`);
      continue;
    }
    if (!numbersMatch(caseStudy.metrics[field], referenced)) {
      mismatches.push(`${field} expected ${referenced} from ${phase} artifacts, found ${caseStudy.metrics[field]}`);
    }
  }
  if (sourceMissing.length > 0) {
    add(
      findings,
      "FAIL",
      "case_study_metrics_source_missing",
      caseStudyPath,
      `referenced metric artifacts do not provide: ${sourceMissing.join(", ")}`
    );
    return;
  }
  if (mismatches.length > 0) {
    add(findings, "FAIL", "case_study_metrics_mismatch", caseStudyPath, mismatches.join("; "));
    return;
  }
  add(
    findings,
    "PASS",
    "case_study_metrics_match",
    caseStudyPath,
    "case-study metrics match referenced baseline/post metric artifacts"
  );
}

function validateMetricsSummaryConsistency(findings, caseStudy, caseStudyPath) {
  if (!["real", "mixed"].includes(caseStudy.evidence_type) || !Array.isArray(caseStudy.artifacts)) return;
  const summaryArtifact = caseStudy.artifacts.find(
    (artifact) => typeof artifact === "string" && normalizeArtifactReference(artifact) === ".token-stack/reports/metrics-summary.json"
  );
  if (!summaryArtifact) return;
  const resolved = resolveSafeArtifact(summaryArtifact);
  if (!resolved.artifactPath || !fs.existsSync(resolved.artifactPath) || !fs.statSync(resolved.artifactPath).isFile()) return;
  let summary;
  try {
    summary = readJson(resolved.artifactPath);
  } catch (exc) {
    add(findings, "FAIL", "metrics_summary_json_invalid", resolved.artifactPath, `metrics-summary is not valid JSON: ${exc.message}`);
    return;
  }
  if (!Array.isArray(summary.evidence_types) || !summary.evidence_types.includes(caseStudy.evidence_type)) {
    add(
      findings,
      "FAIL",
      "metrics_summary_evidence_type_mismatch",
      resolved.artifactPath,
      `metrics-summary evidence_types must include case-study evidence_type ${caseStudy.evidence_type}`
    );
    return;
  }
  add(
    findings,
    "PASS",
    "metrics_summary_evidence_type_match",
    resolved.artifactPath,
    `metrics-summary evidence_types include case-study evidence_type ${caseStudy.evidence_type}`
  );
  const metrics = ["input_tokens", "cost_usd", "raw_large_output_events", "blocked_commands"];
  const missing = [];
  const mismatches = [];
  let compared = 0;
  for (const phase of ["baseline", "post"]) {
    for (const metric of metrics) {
      const referenced = sumReferencedMetric(caseStudy.artifacts, phase, metric);
      if (referenced === null) continue;
      const summaryValue = summaryMetricValue(summary, phase, metric);
      if (summaryValue === null) {
        missing.push(`${phase}.${metric}`);
        continue;
      }
      compared += 1;
      if (!numbersMatch(summaryValue, referenced)) {
        mismatches.push(`${phase}.${metric} expected ${referenced} from metric artifacts, found ${summaryValue}`);
      }
    }
  }
  if (missing.length > 0 || compared === 0) {
    add(
      findings,
      "FAIL",
      "metrics_summary_totals_missing",
      resolved.artifactPath,
      missing.length > 0
        ? `metrics-summary totals missing fields: ${missing.join(", ")}`
        : `metrics-summary totals could not be compared for ${rel(caseStudyPath)}`
    );
    return;
  }
  if (mismatches.length > 0) {
    add(findings, "FAIL", "metrics_summary_mismatch", resolved.artifactPath, mismatches.join("; "));
    return;
  }
  add(
    findings,
    "PASS",
    "metrics_summary_match",
    resolved.artifactPath,
    `metrics-summary totals match baseline/post metric artifacts referenced by ${rel(caseStudyPath)}`
  );
}

function validateCaseStudyFile(findings, filePath, schema) {
  let data;
  if (!fs.existsSync(filePath)) {
    add(findings, "WARN", "artifact_missing", filePath, "case study not found");
    return;
  }
  try {
    data = readJson(filePath);
  } catch (exc) {
    add(findings, "FAIL", "json_invalid", filePath, `case study is not valid JSON: ${exc.message}`);
    return;
  }
  const errors = validate(schema, data);
  add(
    findings,
    errors.length === 0 ? "PASS" : "FAIL",
    errors.length === 0 ? "schema_valid" : "schema_invalid",
    filePath,
    errors.length === 0 ? "case study matches schema" : "case study does not match schema",
    errors
  );
  if (errors.length === 0) {
    validateCaseStudyEvidenceBundle(findings, filePath, data);
    validateCaseStudyMetricConsistency(findings, filePath, data);
    validateMetricsSummaryConsistency(findings, data, filePath);
    validateCaseStudyReferences(findings, filePath, data);
  }
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function listJsonFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFilesRecursive(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(entryPath);
    }
  }
  return files;
}

function uniqueExistingFiles(files) {
  return [...new Set(files)].filter((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).isFile());
}

if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
  console.error(`Target directory does not exist: ${target}`);
  process.exit(2);
}

const schemas = {
  metrics: readJson(path.join(repoRoot, "schemas", "metrics.schema.json")),
  metricsSummary: readJson(path.join(repoRoot, "schemas", "metrics-summary.schema.json")),
  benchmarkConfig: readJson(path.join(repoRoot, "schemas", "benchmark.config.schema.json")),
  caseStudy: readJson(path.join(repoRoot, "schemas", "case-study.schema.json")),
  falsePositiveReview: readJson(path.join(repoRoot, "schemas", "false-positive-review.schema.json")),
};

const reportsDir = path.join(target, ".token-stack", "reports");
const findings = [];

validateJsonFile(findings, path.join(target, ".token-stack", "benchmark.config.json"), schemas.benchmarkConfig, "benchmark config");
parseJsonOnly(findings, path.join(reportsDir, "verify-report.json"), "verify report");
validateJsonFile(findings, path.join(reportsDir, "false-positive-review.json"), schemas.falsePositiveReview, "false-positive review");
validateJsonFile(findings, path.join(reportsDir, "metrics-summary.json"), schemas.metricsSummary, "metrics summary");

const metricFiles = [
  ...listJsonFiles(path.join(reportsDir, "baseline")),
  ...listJsonFiles(path.join(reportsDir, "post")),
].filter((filePath) => !["metrics-summary.json", "metrics-collected.json"].includes(path.basename(filePath)));

if (metricFiles.length === 0) {
  add(findings, "WARN", "artifact_missing", reportsDir, "baseline/post metric records not found");
} else {
  for (const filePath of metricFiles) {
    validateJsonFile(findings, filePath, schemas.metrics, "metric record");
  }
}

const caseStudyFiles = uniqueExistingFiles([
  path.join(reportsDir, "case-study.json"),
  ...listJsonFilesRecursive(path.join(reportsDir, "case-studies")),
  ...listJsonFilesRecursive(path.join(target, ".token-stack", "case-studies")),
  ...listJsonFilesRecursive(path.join(target, "docs", "case-studies")),
]);

if (caseStudyFiles.length === 0) {
  add(findings, "WARN", "artifact_missing", path.join(reportsDir, "case-studies"), "case-study JSON artifacts not found");
} else {
  for (const filePath of caseStudyFiles) {
    validateCaseStudyFile(findings, filePath, schemas.caseStudy);
  }
}

const totals = findings.reduce((acc, finding) => {
  acc[finding.status] = (acc[finding.status] || 0) + 1;
  return acc;
}, {});

function findingGroup(finding) {
  const code = finding.code || "";
  const file = finding.file || "";
  const detail = finding.detail || "";
  if (code.startsWith("metrics_summary_")) return "metrics_summary";
  if (code.startsWith("artifact_reference_")) return "references";
  if (code.startsWith("case_study_") || code.startsWith("evidence_bundle_") || file.includes("case-studies")) {
    return "case_studies";
  }
  if (file.endsWith(".token-stack/benchmark.config.json")) return "benchmark_config";
  if (file.includes(".token-stack/reports/baseline/") || file.includes(".token-stack/reports/post/")) return "metric_records";
  if (file.endsWith(".token-stack/reports/false-positive-review.json")) return "false_positive_review";
  if (file.endsWith(".token-stack/reports/verify-report.json")) return "verify_report";
  if (detail.includes("baseline/post metric records")) return "metric_records";
  if (detail.includes("case-study JSON")) return "case_studies";
  return "artifacts";
}

function groupFindings(findingsToGroup) {
  return findingsToGroup.reduce((acc, finding) => {
    const group = findingGroup(finding);
    acc[group] = acc[group] || { total: 0 };
    acc[group].total += 1;
    acc[group][finding.status] = (acc[group][finding.status] || 0) + 1;
    return acc;
  }, {});
}

const groups = groupFindings(findings);

function presentFindings(findingsToPresent) {
  const severityOrder = { FAIL: 0, WARN: 1, PASS: 2 };
  return findingsToPresent
    .map((finding, index) => ({ finding, index }))
    .sort((left, right) => {
      const leftSeverity = severityOrder[left.finding.status] ?? 3;
      const rightSeverity = severityOrder[right.finding.status] ?? 3;
      return leftSeverity - rightSeverity || left.index - right.index;
    })
    .map((entry) => entry.finding);
}

const displayedFindings = presentFindings(findings);

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(status) {
  return String(status || "").toLowerCase();
}

function renderHtmlReport(reportData, displayedFindingsData) {
  const groupRows = Object.entries(reportData.groups)
    .map(
      ([group, groupTotals]) =>
        `<tr><th>${htmlEscape(group)}</th><td>${groupTotals.PASS || 0}</td><td>${groupTotals.WARN || 0}</td><td>${
          groupTotals.FAIL || 0
        }</td></tr>`
    )
    .join("\n");
  const findingRows = displayedFindingsData
    .map(
      (finding) =>
        `<tr class="${htmlEscape(statusClass(finding.status))}"><td>[${htmlEscape(finding.status)}]</td><td>${htmlEscape(
          finding.code
        )}</td><td><code>${htmlEscape(finding.file)}</code></td><td>${htmlEscape(finding.detail)}</td></tr>`
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Artifact Validation</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #1f2328; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0 2rem; }
    th, td { border: 1px solid #d0d7de; padding: 0.45rem 0.6rem; text-align: left; vertical-align: top; }
    th { background: #f6f8fa; }
    .fail td:first-child { color: #b42318; font-weight: 700; }
    .warn td:first-child { color: #9a6700; font-weight: 700; }
    .pass td:first-child { color: #1a7f37; font-weight: 700; }
    code { white-space: pre-wrap; overflow-wrap: anywhere; }
    nav a { margin-right: 1rem; }
  </style>
</head>
<body>
  <h1>Artifact Validation</h1>
  <nav aria-label="Artifact validation sections">
    <a href="#summary">Summary</a>
    <a href="#groups">Groups</a>
    <a href="#findings">Findings</a>
  </nav>
  <section id="summary">
  <h2>Summary</h2>
  <ul>
    <li>Target: <code>${htmlEscape(reportData.target)}</code></li>
    <li>PASS: ${reportData.totals.PASS || 0}</li>
    <li>WARN: ${reportData.totals.WARN || 0}</li>
    <li>FAIL: ${reportData.totals.FAIL || 0}</li>
  </ul>
  </section>
  <section id="groups">
    <h2>Groups</h2>
    <table>
      <thead><tr><th>Group</th><th>PASS</th><th>WARN</th><th>FAIL</th></tr></thead>
      <tbody>
${groupRows}
      </tbody>
    </table>
  </section>
  <section id="findings">
    <h2>Findings</h2>
    <table>
      <thead><tr><th>Status</th><th>Code</th><th>File</th><th>Detail</th></tr></thead>
      <tbody>
${findingRows}
      </tbody>
    </table>
  </section>
</body>
</html>
`;
}

const report = {
  schema_version: 1,
  command: "validate-artifacts",
  target,
  dry_run: noWrite,
  findings,
  totals,
  groups,
};

const outJson = path.join(reportsDir, "artifact-validation.json");
const outMd = path.join(reportsDir, "artifact-validation.md");
const outHtml = path.join(reportsDir, "artifact-validation.html");
if (!noWrite) {
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const lines = [
    "# Artifact Validation",
    "",
    `- Target: ${target}`,
    `- PASS: ${totals.PASS || 0}`,
    `- WARN: ${totals.WARN || 0}`,
    `- FAIL: ${totals.FAIL || 0}`,
    "",
    "## Groups",
    "",
    ...Object.entries(groups).map(
      ([group, groupTotals]) =>
        `- ${group}: PASS ${groupTotals.PASS || 0}, WARN ${groupTotals.WARN || 0}, FAIL ${groupTotals.FAIL || 0}`
    ),
    "",
    "## Findings",
    "",
    ...displayedFindings.map((finding) => `- [${finding.status}] ${finding.code} ${finding.file} - ${finding.detail}`),
  ];
  fs.writeFileSync(outMd, `${lines.join("\n")}\n`, "utf8");
  fs.writeFileSync(outHtml, renderHtmlReport(report, displayedFindings), "utf8");
}

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("# Artifact Validation");
  console.log("");
  console.log(`- Target: ${target}`);
  console.log(`- PASS: ${totals.PASS || 0}`);
  console.log(`- WARN: ${totals.WARN || 0}`);
  console.log(`- FAIL: ${totals.FAIL || 0}`);
  console.log("");
  console.log("## Groups");
  console.log("");
  for (const [group, groupTotals] of Object.entries(groups)) {
    console.log(`- ${group}: PASS ${groupTotals.PASS || 0}, WARN ${groupTotals.WARN || 0}, FAIL ${groupTotals.FAIL || 0}`);
  }
  console.log("");
  console.log("## Findings");
  console.log("");
  for (const finding of displayedFindings) {
    console.log(`- [${finding.status}] ${finding.code} ${finding.file} - ${finding.detail}`);
  }
  if (!noWrite) {
    console.log(`- JSON: ${outJson}`);
    console.log(`- HTML: ${outHtml}`);
  }
}

process.exit((totals.FAIL || 0) > 0 ? 1 : 0);
