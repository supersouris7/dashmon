// State shown by the APT updates card, without DOM.
//
// deploy/apt-updates.sh installs the updates itself: "updated" counts the
// packages a successful run installed, so the host is up to date afterwards,
// whatever that number. Only a failed run, or a reboot still required to load
// what was installed, needs attention.
export function aptHealth(report) {
  if (!report)
    return { level: "unknown", label: "aptUpdatesNoReport", icon: "fa-solid fa-circle-question" };
  if (report.status === "failed")
    return {
      level: "critical",
      label: "aptUpdatesFailed",
      icon: "fa-solid fa-triangle-exclamation"
    };
  if (report.rebootRequired === true)
    return {
      level: "warning",
      label: "aptUpdatesRebootRequired",
      icon: "fa-solid fa-circle-exclamation"
    };
  return { level: "healthy", label: "aptUpdatesUpToDate", icon: "fa-solid fa-circle-check" };
}
