const { spawnSync } = require("child_process");
const path = require("path");

const candidates = process.platform === "win32" ? ["python", "py"] : ["python3", "python"];
const req = path.resolve(__dirname, "..", "requirements.txt");

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function versionOf(cmd) {
  const result = run(cmd, ["-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"]);
  if (result.status !== 0) return null;
  const raw = String(result.stdout || "").trim();
  const [major, minor] = raw.split(".").map(Number);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
  return { raw, major, minor };
}

let selected = null;
for (const cmd of candidates) {
  const version = versionOf(cmd);
  if (!version) continue;
  if (version.major === 3 && version.minor >= 8 && version.minor <= 13) {
    selected = { cmd, version };
    break;
  }
  console.warn(`[webull-sdk] Skipping ${cmd} ${version.raw}; Webull SDK supports Python 3.8-3.13.`);
}

if (!selected) {
  console.warn("[webull-sdk] No supported Python found. Skipping install; set WEBULL_PYTHON_BIN to Python 3.8-3.13 on the server.");
  process.exit(0);
}

const install = run(selected.cmd, ["-m", "pip", "install", "-r", req]);
if (install.status !== 0) {
  console.warn(`[webull-sdk] Install failed on ${selected.cmd} ${selected.version.raw}.`);
  if (install.stderr) console.warn(install.stderr.trim());
  process.exit(0);
}

console.log(`[webull-sdk] Installed official Webull SDK with ${selected.cmd} ${selected.version.raw}.`);
