const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const cwd = process.cwd();
const ownPid = process.pid;
let killed = 0;

function processCwd(pid) {
  try {
    return fs.realpathSync(`/proc/${pid}/cwd`);
  } catch {
    return "";
  }
}

function isActualNextDev(args) {
  if (args.includes("scripts/stop-next-dev.js")) return false;
  if (args.includes(" && ")) return false;
  return (
    /\bnext\b\s+dev\b/.test(args) ||
    /next\/dist\/bin\/next\s+dev\b/.test(args)
  );
}

try {
  const output = execFileSync("ps", ["-eo", "pid=,args="], {
    encoding: "utf8",
  });

  for (const line of output.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const args = match[2];

    if (!Number.isFinite(pid) || pid === ownPid) continue;
    if (!isActualNextDev(args)) continue;

    const procCwd = processCwd(pid);
    if (procCwd && path.resolve(procCwd) !== path.resolve(cwd)) continue;

    try {
      process.kill(pid, "SIGTERM");
      killed += 1;
    } catch {
      // Process may have exited between ps and kill.
    }
  }
} catch {
  // If ps is unavailable, skip gracefully.
}

console.log(killed > 0 ? `Stopped ${killed} Next dev process(es)` : "No Next dev process found");
