const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const fs = require("fs");

let mainWindow;
let nextServer;
const PORT = 3000;
const isDev = !app.isPackaged;

function getAppPath() {
  if (isDev) return process.cwd();
  return path.join(process.resourcesPath, "app");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1516,
    height: 726,
    minWidth: 900,
    minHeight: 600,
    title: "PA",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = `http://localhost:${PORT}`;

  const waitForServer = () => {
    fetch(url)
      .then(() => mainWindow.loadURL(url))
      .catch(() => setTimeout(waitForServer, 500));
  };

  waitForServer();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

function ensureDataDirs() {
  const appPath = getAppPath();
  const dirs = ["data/emails/attachments", "data/uploads", "data/screenshots", "downloads"];
  for (const dir of dirs) {
    const fullPath = path.join(appPath, dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
  }
}

function startNextServer() {
  if (isDev) return;

  const appPath = getAppPath();
  ensureDataDirs();

  // Find node executable
  const nodePath = process.execPath.includes("Electron")
    ? "node"
    : process.execPath;

  // Use the standalone server that Next.js builds
  const standaloneServer = path.join(appPath, ".next", "standalone", "server.js");
  const nextBin = path.join(appPath, "node_modules", ".bin", "next");

  let cmd, args, cwd;
  if (fs.existsSync(standaloneServer)) {
    cmd = nodePath;
    args = [standaloneServer];
    cwd = path.join(appPath, ".next", "standalone");
  } else {
    cmd = nextBin;
    args = ["start", "-p", String(PORT)];
    cwd = appPath;
  }

  console.log(`Starting Next.js: ${cmd} ${args.join(" ")} in ${cwd}`);

  nextServer = spawn(cmd, args, {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
    },
    stdio: "pipe",
  });

  nextServer.stdout.on("data", (d) => console.log(`Next: ${d}`));
  nextServer.stderr.on("data", (d) => console.error(`Next err: ${d}`));
  nextServer.on("error", (e) => console.error("Next spawn error:", e));
}

app.whenReady().then(() => {
  startNextServer();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (nextServer) nextServer.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (nextServer) nextServer.kill();
});
