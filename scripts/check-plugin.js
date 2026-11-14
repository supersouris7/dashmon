"use strict";
// Checks a plugin folder the way Dashmon loads it, without starting the
// server: manifest, server module, client module. A supervision plugin also
// runs collect() once and prints its report.
//
//   npm run plugin:check -- widgets/my-widget
//   npm run plugin:check -- supervisions/my-card
//
// The kind comes from the parent folder (widgets/ or supervisions/); pass
// --kind=widget or --kind=supervision for a folder elsewhere. Exit code 0
// when the plugin would load.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { Registry } = require("../lib/widgets/registry");
const { SupervisionCore, MAX_REPORT_BYTES } = require("../lib/supervisions/core");
const { sanitizeText } = require("../lib/sanitize");

function usage(message) {
  if (message) console.error(message);
  console.error("Usage: npm run plugin:check -- <plugin folder> [--kind=widget|supervision]");
  process.exit(2);
}

function kindOf(dir, flag) {
  if (flag) return flag;
  const parent = path.basename(path.dirname(dir));
  if (parent === "widgets") return "widget";
  if (parent === "supervisions") return "supervision";
  return usage(`Cannot tell the kind of ${dir}: add --kind=widget or --kind=supervision.`);
}

async function checkClient(item, kind) {
  if (!item.client) return;
  const module = await import(pathToFileURL(path.join(item.dir, item.client)).href);
  const names = kind === "widget" ? ["render", "element"] : ["card", "element"];
  if (!names.some(name => typeof module[name] === "function"))
    throw new Error(`${item.client} must export ${names.join("(ctx) or ")}(ctx)`);
  console.log(`  client  ${item.client}: exports ${names.filter(n => module[n]).join(", ")}`);
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.find(arg => !arg.startsWith("--"));
  const flag = (args.find(arg => arg.startsWith("--kind=")) || "").slice(7);
  if (!target) usage();
  if (flag && flag !== "widget" && flag !== "supervision") usage(`Unknown kind: ${flag}`);
  const dir = path.resolve(target);
  if (!fs.existsSync(path.join(dir, "manifest.json"))) usage(`No manifest.json in ${dir}`);
  const kind = kindOf(dir, flag);
  const id = path.basename(dir);

  const failures = [];
  const registry = new Registry({
    kind,
    entry: kind === "widget" ? "check" : "collect",
    roots: [],
    logger: line => console.log("  " + line)
  });
  await registry.loadOne(dir, id);
  for (const failure of registry.failures) failures.push(failure.reason);
  const item = registry.get(id);

  if (item) {
    try {
      await checkClient(item, kind);
    } catch (error) {
      failures.push(`client module: ${error.message}`);
    }
  }

  if (item && kind === "supervision" && item.collect) {
    // A throwaway data folder: the check never touches a real installation.
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-plugin-check-"));
    const core = new SupervisionCore({
      roots: [],
      dataDir,
      sanitizeText,
      env: {},
      log: line => console.log("  " + line)
    });
    core.prepare(item);
    const host = { id: "local", name: "Local", monitoring: { enabled: true, type: "local" } };
    const reports = await core.collect(host);
    if (id in reports) {
      const size = Buffer.byteLength(JSON.stringify(reports[id]));
      console.log(`  collect(): ${size} bytes (max ${MAX_REPORT_BYTES})`);
      console.log(JSON.stringify(reports[id], null, 2).replace(/^/gm, "    "));
    } else {
      console.log("  collect(): no report (null, failure or timeout: see the lines above)");
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }

  if (failures.length) {
    console.error(`\n✗ ${kind} "${id}" would NOT load:`);
    for (const failure of failures) console.error("  - " + failure);
    process.exit(1);
  }
  console.log(`\n✓ ${kind} "${id}" loads.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
