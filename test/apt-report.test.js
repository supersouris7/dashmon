"use strict";
const assert = require("assert");
const { readAptUpdatesReport } = require("../lib/host/apt-report");

function read(raw, size = 100) {
  const filesystem = {
    statSync: () => ({ isFile: () => true, size, mtimeMs: 100000 }),
    readFileSync: () => JSON.stringify(raw)
  };
  return readAptUpdatesReport("report", { filesystem });
}
const report = read({ status: "success", updated: 3, finishedAt: 100, nextRunAt: 200 });
assert.equal(report.updated, 3);
assert.equal(report.nextRunAt, 200);
assert.equal(read({ status: "success", finishedAt: 100, nextRunAt: 99 }).nextRunAt, null);
assert.equal(read({ status: "failed", failedStep: "upgrade", exitCode: 2 }).failedStep, "upgrade");
assert.equal(read({ status: "invalid" }), null);
assert.equal(read({ status: "success" }, 100001), null);
assert.equal(
  readAptUpdatesReport("missing", {
    filesystem: {
      statSync: () => {
        throw new Error();
      }
    }
  }),
  null
);
console.log("PASS APT : lecture et validation du rapport");
