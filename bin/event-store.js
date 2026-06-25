#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const action = args[0] || "summary";

function option(name, fallback) {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const target = path.resolve(option("--target", process.cwd()));
const jsonOutput = args.includes("--json");
const noWrite = args.includes("--no-write") || args.includes("--dry-run") || args.includes("dry-run");
const storePath = path.join(target, ".token-stack", "events", "events.jsonl");

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function errorPayload(code, message) {
  return {
    schema_version: 1,
    command: "events",
    action,
    target,
    store: storePath,
    error: { code, message }
  };
}

function readEvents() {
  if (!fs.existsSync(storePath)) return [];
  return fs.readFileSync(storePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

if (action === "record") {
  const event = {
    schema_version: 1,
    ts: new Date().toISOString(),
    type: option("--type", "note"),
    message: option("--message", ""),
    source: "cts events"
  };
  if (!event.message) {
    if (jsonOutput) {
      printJson(errorPayload("message_missing", "events record requires --message"));
    } else {
      console.error("events record requires --message");
    }
    process.exit(2);
  }
  if (!noWrite) {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.appendFileSync(storePath, `${JSON.stringify(event)}\n`, "utf8");
  }
  if (jsonOutput) {
    printJson({
      schema_version: 1,
      command: "events",
      action: "record",
      target,
      store: storePath,
      dry_run: noWrite,
      event
    });
  } else {
    printJson(Object.assign({}, event, { dry_run: noWrite }));
  }
  process.exit(0);
}

const events = readEvents();
const byType = {};
for (const event of events) {
  byType[event.type || "unknown"] = (byType[event.type || "unknown"] || 0) + 1;
}
const summary = {
  schema_version: 1,
  command: "events",
  target,
  store: storePath,
  count: events.length,
  by_type: byType,
  latest: events.slice(-10)
};

if (jsonOutput) {
  printJson(summary);
} else {
  console.log("# Event Store");
  console.log("");
  console.log(`- Store: ${storePath}`);
  console.log(`- Events: ${events.length}`);
  for (const [type, count] of Object.entries(byType)) {
    console.log(`- ${type}: ${count}`);
  }
}
