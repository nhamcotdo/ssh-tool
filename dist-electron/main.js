import { ipcMain, dialog, app, BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Store from "electron-store";
import { randomFillSync, randomUUID } from "node:crypto";
import { Client } from "ssh2";
import { readFileSync } from "node:fs";
const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
const rnds8Pool = new Uint8Array(256);
let poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}
const native = { randomUUID };
function _v4(options, buf, offset) {
  var _a;
  options = options || {};
  const rnds = options.random ?? ((_a = options.rng) == null ? void 0 : _a.call(options)) ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  return unsafeStringify(rnds);
}
function v4(options, buf, offset) {
  if (native.randomUUID && true && !options) {
    return native.randomUUID();
  }
  return _v4(options);
}
const store = new Store({
  defaults: {
    connections: [],
    workspaces: [
      {
        id: "default",
        name: "All Connections",
        icon: "🏠",
        color: "#3b82f6",
        order: 0,
        createdAt: Date.now()
      }
    ],
    folders: [],
    tags: [],
    sshKeys: [],
    settings: {
      terminalFontSize: 14,
      terminalFontFamily: 'Menlo, Monaco, "Courier New", monospace',
      defaultPort: 22,
      defaultUsername: "root"
    }
  }
});
function getConnections() {
  return store.get("connections");
}
function getConnectionById(id) {
  return store.get("connections").find((c) => c.id === id);
}
function createConnection(data) {
  const now = Date.now();
  const connection = {
    ...data,
    id: v4(),
    createdAt: now,
    updatedAt: now
  };
  const connections = store.get("connections");
  connections.push(connection);
  store.set("connections", connections);
  return connection;
}
function updateConnection(id, data) {
  const connections = store.get("connections");
  const index = connections.findIndex((c) => c.id === id);
  if (index === -1) return null;
  connections[index] = { ...connections[index], ...data, updatedAt: Date.now() };
  store.set("connections", connections);
  return connections[index];
}
function deleteConnection(id) {
  const connections = store.get("connections");
  const filtered = connections.filter((c) => c.id !== id);
  if (filtered.length === connections.length) return false;
  store.set("connections", filtered);
  return true;
}
function duplicateConnection(id) {
  const conn = getConnectionById(id);
  if (!conn) return null;
  const { id: _id, createdAt: _c, updatedAt: _u, ...data } = conn;
  return createConnection({ ...data, name: `${conn.name} (copy)` });
}
function touchConnection(id) {
  updateConnection(id, { lastConnected: Date.now() });
}
function getWorkspaces() {
  return store.get("workspaces").sort((a, b) => a.order - b.order);
}
function createWorkspace(data) {
  const workspaces = store.get("workspaces");
  const workspace = {
    ...data,
    id: v4(),
    order: workspaces.length,
    createdAt: Date.now()
  };
  workspaces.push(workspace);
  store.set("workspaces", workspaces);
  return workspace;
}
function updateWorkspace(id, data) {
  const workspaces = store.get("workspaces");
  const index = workspaces.findIndex((w) => w.id === id);
  if (index === -1) return null;
  workspaces[index] = { ...workspaces[index], ...data };
  store.set("workspaces", workspaces);
  return workspaces[index];
}
function deleteWorkspace(id) {
  if (id === "default") return false;
  const workspaces = store.get("workspaces");
  store.set("workspaces", workspaces.filter((w) => w.id !== id));
  const connections = store.get("connections");
  connections.forEach((c) => {
    if (c.workspaceId === id) c.workspaceId = "default";
  });
  store.set("connections", connections);
  return true;
}
function getFolders() {
  return store.get("folders").sort((a, b) => a.order - b.order);
}
function getFoldersByWorkspace(workspaceId) {
  return getFolders().filter((f) => f.workspaceId === workspaceId);
}
function createFolder(data) {
  const folders = store.get("folders");
  const folder = {
    ...data,
    id: v4(),
    parentId: data.parentId || void 0,
    order: folders.filter((f) => f.workspaceId === data.workspaceId).length,
    createdAt: Date.now()
  };
  folders.push(folder);
  store.set("folders", folders);
  return folder;
}
function updateFolder(id, data) {
  const folders = store.get("folders");
  const idx = folders.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  folders[idx] = { ...folders[idx], ...data };
  store.set("folders", folders);
  return folders[idx];
}
function deleteFolder(id) {
  const folders = store.get("folders");
  const toDelete = /* @__PURE__ */ new Set();
  function collectChildren(parentId) {
    toDelete.add(parentId);
    folders.filter((f) => f.parentId === parentId).forEach((f) => collectChildren(f.id));
  }
  collectChildren(id);
  store.set("folders", folders.filter((f) => !toDelete.has(f.id)));
  const connections = store.get("connections");
  connections.forEach((c) => {
    if (c.folderId && toDelete.has(c.folderId)) {
      c.folderId = void 0;
    }
  });
  store.set("connections", connections);
  return true;
}
function getTags() {
  return store.get("tags");
}
function createTag(data) {
  const tag = { ...data, id: v4() };
  const tags = store.get("tags");
  tags.push(tag);
  store.set("tags", tags);
  return tag;
}
function updateTag(id, data) {
  const tags = store.get("tags");
  const idx = tags.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tags[idx] = { ...tags[idx], ...data };
  store.set("tags", tags);
  return tags[idx];
}
function deleteTag(id) {
  const tags = store.get("tags");
  store.set("tags", tags.filter((t) => t.id !== id));
  const connections = store.get("connections");
  connections.forEach((c) => {
    c.tags = c.tags.filter((t) => t !== id);
  });
  store.set("connections", connections);
  return true;
}
function getSettings() {
  return store.get("settings");
}
function updateSettings(data) {
  const settings = { ...store.get("settings"), ...data };
  store.set("settings", settings);
  return settings;
}
function getSSHKeys() {
  return store.get("sshKeys") || [];
}
function createSSHKey(data) {
  const key = {
    ...data,
    id: v4(),
    createdAt: Date.now()
  };
  const keys = getSSHKeys();
  keys.push(key);
  store.set("sshKeys", keys);
  return key;
}
function updateSSHKey(id, data) {
  const keys = getSSHKeys();
  const idx = keys.findIndex((k) => k.id === id);
  if (idx === -1) return null;
  keys[idx] = { ...keys[idx], ...data };
  store.set("sshKeys", keys);
  return keys[idx];
}
function deleteSSHKey(id) {
  const keys = getSSHKeys();
  const filtered = keys.filter((k) => k.id !== id);
  if (filtered.length === keys.length) return false;
  store.set("sshKeys", filtered);
  return true;
}
const activeSessions = /* @__PURE__ */ new Map();
function buildConfig(conn) {
  const config = {
    host: conn.host,
    port: conn.port,
    username: conn.username,
    readyTimeout: 1e4,
    keepaliveInterval: 3e4
  };
  switch (conn.authType) {
    case "password":
      config.password = conn.password;
      break;
    case "key":
      if (conn.privateKeyPath) {
        config.privateKey = readFileSync(conn.privateKeyPath);
      }
      break;
    case "key+passphrase":
      if (conn.privateKeyPath) {
        config.privateKey = readFileSync(conn.privateKeyPath);
        config.passphrase = conn.passphrase;
      }
      break;
  }
  return config;
}
function connectViaProxy(conn, onReady, onError, onData, onClose) {
  const proxy = conn.proxyJump;
  const jumpClient = new Client();
  const jumpConfig = {
    host: proxy.host,
    port: proxy.port,
    username: proxy.username,
    readyTimeout: 1e4
  };
  if (proxy.authType === "password") {
    jumpConfig.password = proxy.password;
  } else if (proxy.privateKeyPath) {
    jumpConfig.privateKey = readFileSync(proxy.privateKeyPath);
  }
  jumpClient.on("ready", () => {
    jumpClient.forwardOut(
      "127.0.0.1",
      0,
      conn.host,
      conn.port,
      (err, stream) => {
        if (err) {
          jumpClient.end();
          onError(err);
          return;
        }
        const targetClient = new Client();
        const targetConfig = buildConfig(conn);
        targetConfig.sock = stream;
        targetClient.on("ready", () => {
          targetClient.shell({ term: "xterm-256color" }, (err2, shellStream) => {
            if (err2) {
              targetClient.end();
              jumpClient.end();
              onError(err2);
              return;
            }
            const sessionId = `${conn.id}-${Date.now()}`;
            const session = {
              id: sessionId,
              connectionId: conn.id,
              client: targetClient,
              stream: shellStream,
              jumpClient
            };
            activeSessions.set(sessionId, session);
            shellStream.on("data", (data) => onData(data.toString("utf-8")));
            shellStream.on("close", () => {
              activeSessions.delete(sessionId);
              targetClient.end();
              jumpClient.end();
              onClose();
            });
            onReady(session);
          });
        });
        targetClient.on("error", (err2) => {
          jumpClient.end();
          onError(err2);
        });
        targetClient.connect(targetConfig);
      }
    );
  });
  jumpClient.on("error", onError);
  jumpClient.connect(jumpConfig);
}
function connectDirect(conn, onReady, onError, onData, onClose) {
  const client = new Client();
  const config = buildConfig(conn);
  client.on("ready", () => {
    client.shell({ term: "xterm-256color" }, (err, stream) => {
      if (err) {
        client.end();
        onError(err);
        return;
      }
      const sessionId = `${conn.id}-${Date.now()}`;
      const session = {
        id: sessionId,
        connectionId: conn.id,
        client,
        stream
      };
      activeSessions.set(sessionId, session);
      stream.on("data", (data) => onData(data.toString("utf-8")));
      stream.on("close", () => {
        activeSessions.delete(sessionId);
        client.end();
        onClose();
      });
      onReady(session);
    });
  });
  client.on("error", onError);
  client.connect(config);
}
function connect(conn, onReady, onError, onData, onClose) {
  var _a;
  if ((_a = conn.proxyJump) == null ? void 0 : _a.enabled) {
    connectViaProxy(conn, onReady, onError, onData, onClose);
  } else {
    connectDirect(conn, onReady, onError, onData, onClose);
  }
}
function disconnect(sessionId) {
  var _a, _b;
  const session = activeSessions.get(sessionId);
  if (!session) return;
  (_a = session.stream) == null ? void 0 : _a.end();
  session.client.end();
  (_b = session.jumpClient) == null ? void 0 : _b.end();
  activeSessions.delete(sessionId);
}
function sendInput(sessionId, data) {
  var _a;
  const session = activeSessions.get(sessionId);
  (_a = session == null ? void 0 : session.stream) == null ? void 0 : _a.write(data);
}
function resizeTerminal(sessionId, cols, rows) {
  var _a;
  const session = activeSessions.get(sessionId);
  (_a = session == null ? void 0 : session.stream) == null ? void 0 : _a.setWindow(rows, cols, 0, 0);
}
function getActiveSessions() {
  return Array.from(activeSessions.keys());
}
function disconnectAll() {
  for (const [id] of activeSessions) {
    disconnect(id);
  }
}
async function testConnection(conn) {
  return new Promise((resolve) => {
    const start = Date.now();
    const onReady = (session) => {
      const latency = Date.now() - start;
      disconnect(session.id);
      resolve({ success: true, message: `Connected in ${latency}ms`, latency });
    };
    const onError = (err) => {
      resolve({ success: false, message: err.message });
    };
    const onData = () => {
    };
    const onClose = () => {
    };
    connect(conn, onReady, onError, onData, onClose);
    setTimeout(() => {
      resolve({ success: false, message: "Connection timed out (15s)" });
    }, 15e3);
  });
}
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0a",
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
ipcMain.handle("connections:list", () => getConnections());
ipcMain.handle("connections:get", (_e, id) => getConnectionById(id));
ipcMain.handle("connections:create", (_e, data) => {
  return createConnection(data);
});
ipcMain.handle("connections:update", (_e, id, data) => {
  return updateConnection(id, data);
});
ipcMain.handle("connections:delete", (_e, id) => deleteConnection(id));
ipcMain.handle("connections:duplicate", (_e, id) => duplicateConnection(id));
ipcMain.handle("ssh:connect", (_e, connectionId) => {
  const conn = getConnectionById(connectionId);
  if (!conn) return { success: false, message: "Connection not found" };
  return new Promise((resolve) => {
    connect(
      conn,
      (session) => {
        touchConnection(connectionId);
        resolve({ success: true, sessionId: session.id });
      },
      (err) => {
        resolve({ success: false, message: err.message });
      },
      (data) => {
        win == null ? void 0 : win.webContents.send("ssh:data", connectionId, data);
      },
      () => {
        win == null ? void 0 : win.webContents.send("ssh:closed", connectionId);
      }
    );
  });
});
ipcMain.handle("ssh:disconnect", (_e, sessionId) => {
  disconnect(sessionId);
});
ipcMain.on("ssh:input", (_e, sessionId, data) => {
  sendInput(sessionId, data);
});
ipcMain.on("ssh:resize", (_e, sessionId, cols, rows) => {
  resizeTerminal(sessionId, cols, rows);
});
ipcMain.handle("ssh:test", async (_e, connData) => {
  return testConnection(connData);
});
ipcMain.handle("ssh:active-sessions", () => getActiveSessions());
ipcMain.handle("workspaces:list", () => getWorkspaces());
ipcMain.handle("workspaces:create", (_e, data) => {
  return createWorkspace(data);
});
ipcMain.handle("workspaces:update", (_e, id, data) => {
  return updateWorkspace(id, data);
});
ipcMain.handle("workspaces:delete", (_e, id) => deleteWorkspace(id));
ipcMain.handle("folders:list", () => getFolders());
ipcMain.handle("folders:list-by-workspace", (_e, workspaceId) => getFoldersByWorkspace(workspaceId));
ipcMain.handle("folders:create", (_e, data) => {
  return createFolder(data);
});
ipcMain.handle("folders:update", (_e, id, data) => {
  return updateFolder(id, data);
});
ipcMain.handle("folders:delete", (_e, id) => deleteFolder(id));
ipcMain.handle("tags:list", () => getTags());
ipcMain.handle("tags:create", (_e, data) => {
  return createTag(data);
});
ipcMain.handle("tags:update", (_e, id, data) => {
  return updateTag(id, data);
});
ipcMain.handle("tags:delete", (_e, id) => deleteTag(id));
ipcMain.handle("settings:get", () => getSettings());
ipcMain.handle("settings:update", (_e, data) => updateSettings(data));
ipcMain.handle("ssh-keys:list", () => getSSHKeys());
ipcMain.handle("ssh-keys:create", (_e, data) => {
  return createSSHKey(data);
});
ipcMain.handle("ssh-keys:update", (_e, id, data) => {
  return updateSSHKey(id, data);
});
ipcMain.handle("ssh-keys:delete", (_e, id) => deleteSSHKey(id));
ipcMain.handle("dialog:select-file", async (_e, options) => {
  const result = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    title: "Select SSH Private Key",
    filters: [{ name: "All Files", extensions: ["*"] }],
    ...options
  });
  return result.canceled ? null : result.filePaths[0];
});
app.on("window-all-closed", () => {
  disconnectAll();
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
