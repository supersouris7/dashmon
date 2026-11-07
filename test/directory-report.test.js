"use strict";
const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { readDirectoryReport } = require("../lib/host/directory-report");
const { sanitizeHostMonitoring } = require("../lib/config/fields");

assert.deepEqual(
  sanitizeHostMonitoring({ enabled: true, directorySizes: { enabled: false } }).directorySizes,
  { enabled: false, entries: [] }
);
assert.equal(
  sanitizeHostMonitoring({ enabled: true, directorySizes: { enabled: true } }).directorySizes,
  undefined
);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-directories-"));
try {
  const directory = path.join(temporary, 'files with spaces "quotes" \\ accents é');
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, "sample"), "hello");
  const output = path.join(temporary, "report.json");
  execFileSync("sh", [
    path.join(__dirname, "../deploy/directory-sizes.sh"),
    "--output",
    output,
    directory,
    path.join(temporary, "missing")
  ]);
  const report = readDirectoryReport(output);
  assert.equal(report.directories[0].path, directory);
  assert.ok(report.directories[0].bytes >= 5);
  assert.ok(report.directories[0].capacity > 0);
  const selected = readDirectoryReport(output, { entries: [{ name: "Medias", path: directory }] });
  assert.equal(selected.directories.length, 1);
  assert.equal(selected.directories[0].name, "Medias");
  assert.equal(report.directories[1].bytes, null);
  const mockBin = path.join(temporary, "bin");
  fs.mkdirSync(mockBin);
  fs.writeFileSync(
    path.join(mockBin, "docker"),
    `#!/bin/sh
if [ "$3" = node ]; then
  shift 3
  exec "$DASHMON_TEST_NODE" "$@"
fi
cat > "$DASHMON_TEST_REPORT"
`,
    { mode: 0o755 }
  );
  const configFile = path.join(temporary, "config.json");
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      hosts: [
        {
          monitoring: {
            enabled: true,
            type: "local",
            directorySizes: { entries: [{ name: "Medias", path: directory }] }
          }
        }
      ]
    })
  );
  execFileSync("sh", [path.join(__dirname, "../deploy/directory-sizes.sh")], {
    env: {
      ...process.env,
      PATH: mockBin + path.delimiter + process.env.PATH,
      CONFIG_FILE: configFile,
      DASHMON_TEST_NODE: process.execPath,
      DASHMON_TEST_REPORT: output
    }
  });
  assert.equal(
    readDirectoryReport(output).directories[0].path,
    directory,
    "le collecteur utilise les chemins enregistres dans Dashmon sans arguments"
  );
  fs.writeFileSync(
    output,
    JSON.stringify({
      directories: [
        { path: "relative", bytes: 42 },
        { path: "/srv/media", bytes: -1 },
        { path: "/srv/empty", bytes: 0 }
      ]
    })
  );
  assert.deepEqual(readDirectoryReport(output).directories, [
    { path: "/srv/media", bytes: null, capacity: null },
    { path: "/srv/empty", bytes: 0, capacity: null }
  ]);
  fs.writeFileSync(output, "invalid");
  assert.equal(readDirectoryReport(output), null);
  assert.equal(readDirectoryReport(path.join(temporary, "absent")), null);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
console.log("PASS repertoires : mesure, chemins espaces, erreurs et validation");
