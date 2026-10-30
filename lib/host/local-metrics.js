"use strict";
const os = require("os");
const fs = require("fs");

function clampPercent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
}

// Le collecteur est instancié par application : le calcul CPU n'est donc pas
// partagé entre deux serveurs hébergés dans le même processus.
function createLocalMetrics({ sanitizeText, system = os, filesystem = fs }) {
  function readCpuTimes() {
    return system.cpus().reduce(
      (acc, cpu) => {
        const times = cpu.times || {};
        acc.idle += Number(times.idle || 0);
        acc.total += Object.values(times).reduce((sum, value) => sum + Number(value || 0), 0);
        return acc;
      },
      { idle: 0, total: 0 }
    );
  }
  let previousCpuTimes = readCpuTimes();
  function localCpuPercent() {
    const current = readCpuTimes();
    const idleDelta = current.idle - previousCpuTimes.idle;
    const totalDelta = current.total - previousCpuTimes.total;
    previousCpuTimes = current;
    return totalDelta > 0 ? clampPercent((1 - idleDelta / totalDelta) * 100) : null;
  }
  function localRamPercent() {
    const total = system.totalmem();
    return total > 0 ? clampPercent(((total - system.freemem()) / total) * 100) : null;
  }
  function localSystemDetails() {
    const cpus = system.cpus();
    return {
      os: sanitizeText(`${system.type()} ${system.release()} (${system.arch()})`, 200),
      cpuModel: sanitizeText(cpus[0]?.model || "", 200),
      cpuCores: cpus.length || null,
      ramTotal: system.totalmem() || null
    };
  }
  function localTemperature() {
    const readings = [];
    const readDir = dir => {
      try {
        return filesystem.readdirSync(dir);
      } catch (_error) {
        return [];
      }
    };
    const push = file => {
      try {
        const raw = Number(filesystem.readFileSync(file, "utf8").trim());
        if (!Number.isFinite(raw)) return;
        const celsius = Math.abs(raw) > 200 ? raw / 1000 : raw;
        if (celsius > 0 && celsius < 150) readings.push(celsius);
      } catch (_error) {}
    };
    for (const zone of readDir("/sys/class/thermal")) {
      if (/^thermal_zone\d+$/.test(zone)) push(`/sys/class/thermal/${zone}/temp`);
    }
    for (const hw of readDir("/sys/class/hwmon")) {
      for (const entry of readDir(`/sys/class/hwmon/${hw}`)) {
        if (/^temp\d+_input$/.test(entry)) push(`/sys/class/hwmon/${hw}/${entry}`);
      }
    }
    return readings.length ? Math.round(Math.max(...readings) * 10) / 10 : null;
  }
  function localDiskPercent(target) {
    const value = String(target || "").trim() || "/";
    try {
      const stats = filesystem.statfsSync(value);
      const total = Number(stats.blocks);
      const available = Number(stats.bavail);
      return total > 0 ? clampPercent(((total - available) / total) * 100) : null;
    } catch (_error) {
      return null;
    }
  }
  return {
    localCpuPercent,
    localRamPercent,
    localSystemDetails,
    localTemperature,
    localDiskPercent
  };
}

module.exports = { createLocalMetrics, clampPercent };
