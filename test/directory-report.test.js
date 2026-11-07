"use strict";
const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { readDirectoryReport } = require("../lib/host/directory-report");

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "dashmon-directories-"));
try {
  const directory = path.join(temporary, "files with spaces");
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, "sample"), "hello");
  const output = path.join(temporary, "report.json");
  execFileSync("python3", [
    path.join(__dirname, "../deploy/directory-sizes.py"),
    "--output",
    output,
    directory,
    path.join(temporary, "missing")
  ]);
  const report = readDirectoryReport(output);
  assert.equal(report.directories[0].path, directory);
  assert.ok(report.directories[0].bytes >= 5);
  assert.equal(report.directories[1].bytes, null);
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
    { path: "/srv/media", bytes: null },
    { path: "/srv/empty", bytes: 0 }
  ]);
  fs.writeFileSync(output, "invalid");
  assert.equal(readDirectoryReport(output), null);
  assert.equal(readDirectoryReport(path.join(temporary, "absent")), null);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
console.log("PASS repertoires : mesure, chemins espaces, erreurs et validation");
