import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const port = process.env.PORT || "3000";
const lockFile = ".start-fresh.lock";
const nextBin =
  process.platform === "win32"
    ? "node_modules\\.bin\\next.cmd"
    : "./node_modules/.bin/next";

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireStartLock() {
  if (existsSync(lockFile)) {
    const existingPid = Number(readFileSync(lockFile, "utf8").trim());

    if (Number.isInteger(existingPid) && processExists(existingPid)) {
      console.error(
        `A LegacyLinks start process is already running as PID ${existingPid}.`
      );
      console.error(
        "Use the existing http://localhost:3000 server, or stop it with Ctrl+C before starting again."
      );
      process.exit(0);
    }

    rmSync(lockFile, { force: true });
  }

  writeFileSync(lockFile, String(process.pid));
}

function releaseStartLock() {
  try {
    const existingPid = Number(readFileSync(lockFile, "utf8").trim());

    if (existingPid === process.pid) {
      unlinkSync(lockFile);
    }
  } catch {
    // Nothing to clean up.
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function stopExistingServer() {
  if (process.platform === "win32") {
    return;
  }

  const result = spawnSync("lsof", ["-ti", `tcp:${port}`], {
    encoding: "utf8",
  });
  const pids = result.stdout
    .split(/\s+/)
    .map((pid) => Number(pid))
    .filter((pid) => Number.isInteger(pid) && pid > 0);

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // The process may have already exited.
    }
  }
}

acquireStartLock();
process.on("exit", releaseStartLock);
process.on("SIGINT", () => {
  releaseStartLock();
  process.exit(130);
});
process.on("SIGTERM", () => {
  releaseStartLock();
  process.exit(143);
});

stopExistingServer();
rmSync(".next", { recursive: true, force: true });
run(nextBin, ["build"]);
run(nextBin, ["start"]);
