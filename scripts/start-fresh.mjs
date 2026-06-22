import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const port = process.env.PORT || "3000";
const nextBin =
  process.platform === "win32"
    ? "node_modules\\.bin\\next.cmd"
    : "./node_modules/.bin/next";

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

stopExistingServer();
rmSync(".next", { recursive: true, force: true });
run(nextBin, ["build"]);
run(nextBin, ["start"]);
