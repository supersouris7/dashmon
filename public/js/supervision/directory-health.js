// State of the Directories card, without DOM (testable in Node): text keys and
// numbers, translated by directory-card.js.
import { state } from "../state.js";

// The script runs once a day: two days without a report means it stopped.
export const STALE_SECONDS = 2 * 24 * 3600;

const ERROR_KEYS = {
  invalid_directory: "directorySizesErrorMissing",
  not_measured: "directorySizesNotMeasured",
  measurement_failed: "directorySizesError"
};

export const measured = directory => Number.isSafeInteger(directory?.bytes) && directory.bytes >= 0;

// Why a directory has no size.
export function directoryErrorKey(directory) {
  return ERROR_KEYS[directory?.error] || "directorySizesError";
}

// "47,5 %" in French, "47.5 %" in English, like the other percentages.
export function sharePercentText(percent) {
  return (
    new Intl.NumberFormat(state.language === "fr" ? "fr-FR" : "en-US", {
      maximumFractionDigits: 1
    }).format(percent) + " %"
  );
}

// Status line: old report first, then directories without a size, otherwise
// the number of directories and their total.
export function directoryHealth(report, nowSeconds = Math.floor(Date.now() / 1000)) {
  const directories = Array.isArray(report?.directories) ? report.directories : [];
  const age = report?.updatedAt ? nowSeconds - report.updatedAt : null;
  if (age !== null && age > STALE_SECONDS) {
    return { level: "warning", key: "directorySizesStale", age };
  }
  const missing = directories.filter(item => !measured(item)).length;
  if (missing) return { level: "warning", key: "directorySizesUnmeasured", count: missing };
  return {
    level: "healthy",
    key: directories.length === 1 ? "directorySizesSummaryOne" : "directorySizesSummary",
    count: directories.length,
    total: directories.reduce((sum, item) => sum + item.bytes, 0)
  };
}
