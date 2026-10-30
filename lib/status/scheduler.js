"use strict";
// Runs one cycle at a time: concurrent calls share the running cycle, and a
// forced request arriving meanwhile runs one more cycle right after.
function createScheduler({ runCycle }) {
  let inflight = null;
  let pendingForce = false;
  return async function refresh(force = false) {
    if (inflight) {
      if (force) pendingForce = true;
      return inflight;
    }
    const task = (async () => {
      let next = force;
      do {
        pendingForce = false;
        await runCycle(next);
        next = pendingForce;
      } while (next);
    })();
    inflight = task;
    try {
      await task;
    } finally {
      if (inflight === task) inflight = null;
    }
  };
}
module.exports = { createScheduler };
