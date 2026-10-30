"use strict";
// Explicit agent entry point; the image still supports DASHMON_MODE=agent.
process.env.DASHMON_MODE = "agent";
require("./server")
  .createApp()
  .start()
  .catch(error => {
    console.error("Agent start-up failed:", error);
    process.exit(1);
  });
