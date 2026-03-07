import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const workerDir = path.join(rootDir, "worker");
const envPath = path.join(rootDir, ".env.local");

function parseDotEnv(content) {
  const out = {};
  const cleanContent = content.replace(/^\uFEFF/, "");

  for (const rawLine of cleanContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }
  return out;
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  return parseDotEnv(content);
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const extraEnv = loadEnv(envPath);

const appProc = spawn(npmCmd, ["run", "dev"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

const workerProc = spawn(npmCmd, ["run", "dev"], {
  cwd: workerDir,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    ...extraEnv,
  },
});

let shuttingDown = false;

function killTree(proc, signal = "SIGTERM") {
  if (!proc?.pid) return;

  if (process.platform === "win32") {
    try {
      execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: "ignore" });
      return;
    } catch {
      // fall through
    }
  }

  try {
    proc.kill(signal);
  } catch {
    // ignore
  }
}

function shutdown(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;

  killTree(appProc, signal);
  killTree(workerProc, signal);

  setTimeout(() => process.exit(), 150);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

appProc.on("exit", (code) => {
  if (!shuttingDown) {
    console.error(`[dev:all] app exited with code ${code ?? "null"}`);
    shutdown();
  }
});

workerProc.on("exit", (code) => {
  if (!shuttingDown) {
    console.error(`[dev:all] worker exited with code ${code ?? "null"}`);
    shutdown();
  }
});
