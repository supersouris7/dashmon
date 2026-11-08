// Host script commands shown in the app (card notices, settings help), with
// no DOM so they can be tested in Node. The same names and schedules live in
// deploy/setup.sh (test/setup-script.test.js keeps them in step).

const RAW = "https://raw.githubusercontent.com/supersouris7/dashmon/main/deploy";
const BIN = "/usr/local/bin";

export const SCRIPT_NAMES = Object.freeze([
  "apt-updates",
  "smart-dump",
  "wireguard-dump",
  "opencode-stats",
  "claude-stats",
  "directory-sizes"
]);

// Installs the setup tool; it then installs the others with their cron line.
export const SETUP_INSTALL_COMMAND =
  `sudo curl -fsSL ${RAW}/setup.sh -o ${BIN}/dashmon-setup.sh` +
  ` && sudo chmod 755 ${BIN}/dashmon-setup.sh`;

// Updates every Dashmon script installed on the machine, the setup tool
// included: no new script, no cron change. "-all" works too.
export const UPDATE_COMMAND = "sudo dashmon-setup.sh --all";

// The same update from cron (root), at the frequency chosen in the tool.
export const AUTO_UPDATE_COMMAND = "sudo dashmon-setup.sh auto";

export function installCommand(name) {
  return `sudo dashmon-setup.sh install ${name}`;
}

// Three cron schedules per script; `recommended` is the default of the setup
// tool. The text keys are in the i18n files (cronEvery...).
export const SCRIPT_FREQUENCIES = Object.freeze({
  "apt-updates": [
    { cron: "0 3 * * *", key: "cronDaily3" },
    { cron: "0 3 * * 3", key: "cronWednesday3", recommended: true },
    { cron: "0 3 1 * *", key: "cronMonthly3" }
  ],
  "smart-dump": [
    { cron: "*/5 * * * *", key: "cronEvery5" },
    { cron: "*/15 * * * *", key: "cronEvery15", recommended: true },
    { cron: "0 * * * *", key: "cronHourly" }
  ],
  "wireguard-dump": [
    { cron: "* * * * *", key: "cronEveryMinute", recommended: true },
    { cron: "*/5 * * * *", key: "cronEvery5" },
    { cron: "*/15 * * * *", key: "cronEvery15" }
  ],
  "opencode-stats": [
    { cron: "*/5 * * * *", key: "cronEvery5" },
    { cron: "*/15 * * * *", key: "cronEvery15", recommended: true },
    { cron: "0 * * * *", key: "cronHourly" }
  ],
  "claude-stats": [
    { cron: "*/5 * * * *", key: "cronEvery5" },
    { cron: "*/15 * * * *", key: "cronEvery15", recommended: true },
    { cron: "0 * * * *", key: "cronHourly" }
  ],
  // The automatic update (dashmon-setup.sh auto).
  setup: [
    { cron: "0 */6 * * *", key: "cronEvery6Hours" },
    { cron: "30 4 * * *", key: "cronNightly430", recommended: true },
    { cron: "30 4 * * 0", key: "cronSunday430" }
  ],
  "directory-sizes": [
    { cron: "0 * * * *", key: "cronHourly" },
    { cron: "0 */6 * * *", key: "cronEvery6Hours" },
    { cron: "30 3 * * *", key: "cronNightly330", recommended: true }
  ]
});
