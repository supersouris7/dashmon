"use strict";
const assert = require("assert");
const { readSmartDump, normalizeSmartDisk } = require("../lib/host/smart-report");
const disk = normalizeSmartDisk({
  device: { name: "/dev/test" },
  smart_status: { passed: true },
  temperature: { current: 35 },
  serial_number: "hidden"
});
assert.equal(disk.device, "/dev/test");
assert.equal(disk.temperature, 35);
assert.equal(disk.passed, true);
assert.equal("serial_number" in disk, false);
assert.equal(normalizeSmartDisk({}), null);
const filesystem = {
  statSync: () => ({ isFile: () => true, size: 100, mtimeMs: 100000 }),
  readFileSync: () => JSON.stringify({ disks: [{ name: "/dev/test" }] })
};
assert.equal(readSmartDump("report", { filesystem }).fetchedAt, 100);
assert.equal(
  readSmartDump("missing", {
    filesystem: {
      statSync: () => {
        throw new Error();
      }
    }
  }),
  null
);
console.log("PASS SMART : lecture et filtrage du rapport");
