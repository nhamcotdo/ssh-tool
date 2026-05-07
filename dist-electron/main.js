import { ipcMain, app, dialog, BrowserWindow, powerMonitor } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto, { randomFillSync, randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import Store from "electron-store";
import { Client } from "ssh2";
import { readFileSync } from "node:fs";
import readline from "node:readline";
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
const DEFAULT_SETTINGS = {
  terminalFontSize: 14,
  terminalFontFamily: 'Menlo, Monaco, "Courier New", monospace',
  defaultPort: 22,
  defaultUsername: "root"
};
const DEFAULT_WORKSPACE = {
  id: "default",
  name: "All Connections",
  icon: "🏠",
  color: "#3b82f6",
  order: 0,
  createdAt: Date.now()
};
const store = new Store({
  defaults: {
    userData: {}
  }
});
function getUserData(userId) {
  const all = store.get("userData");
  if (!all[userId]) {
    const data = {
      connections: [],
      workspaces: [{ ...DEFAULT_WORKSPACE, createdAt: Date.now() }],
      folders: [],
      tags: [],
      sshKeys: [],
      settings: { ...DEFAULT_SETTINGS }
    };
    all[userId] = data;
    store.set("userData", all);
  }
  return all[userId];
}
function setUserData(userId, data) {
  const all = store.get("userData");
  all[userId] = data;
  store.set("userData", all);
}
function getUserDataRaw(userId) {
  return getUserData(userId);
}
function setUserDataRaw(userId, data) {
  setUserData(userId, data);
}
function getConnections(userId) {
  return getUserData(userId).connections;
}
function getConnectionById(userId, id) {
  return getUserData(userId).connections.find((c) => c.id === id);
}
function createConnection(userId, data) {
  const now = Date.now();
  const connection = {
    ...data,
    id: v4(),
    createdAt: now,
    updatedAt: now
  };
  const ud = getUserData(userId);
  ud.connections.push(connection);
  setUserData(userId, ud);
  return connection;
}
function updateConnection(userId, id, data) {
  const ud = getUserData(userId);
  const index = ud.connections.findIndex((c) => c.id === id);
  if (index === -1) return null;
  ud.connections[index] = { ...ud.connections[index], ...data, updatedAt: Date.now() };
  setUserData(userId, ud);
  return ud.connections[index];
}
function deleteConnection(userId, id) {
  const ud = getUserData(userId);
  const len = ud.connections.length;
  ud.connections = ud.connections.filter((c) => c.id !== id);
  if (ud.connections.length === len) return false;
  setUserData(userId, ud);
  return true;
}
function duplicateConnection(userId, id) {
  const conn = getConnectionById(userId, id);
  if (!conn) return null;
  const { id: _id, createdAt: _c, updatedAt: _u, ...data } = conn;
  return createConnection(userId, { ...data, name: `${conn.name} (copy)` });
}
function touchConnection(userId, id) {
  updateConnection(userId, id, { lastConnected: Date.now() });
}
function getWorkspaces(userId) {
  return getUserData(userId).workspaces.sort((a, b) => a.order - b.order);
}
function createWorkspace(userId, data) {
  const ud = getUserData(userId);
  const workspace = {
    ...data,
    id: v4(),
    order: ud.workspaces.length,
    createdAt: Date.now()
  };
  ud.workspaces.push(workspace);
  setUserData(userId, ud);
  return workspace;
}
function updateWorkspace(userId, id, data) {
  const ud = getUserData(userId);
  const index = ud.workspaces.findIndex((w) => w.id === id);
  if (index === -1) return null;
  ud.workspaces[index] = { ...ud.workspaces[index], ...data };
  setUserData(userId, ud);
  return ud.workspaces[index];
}
function deleteWorkspace(userId, id) {
  if (id === "default") return false;
  const ud = getUserData(userId);
  ud.workspaces = ud.workspaces.filter((w) => w.id !== id);
  ud.connections.forEach((c) => {
    if (c.workspaceId === id) c.workspaceId = "default";
  });
  setUserData(userId, ud);
  return true;
}
function getFolders(userId) {
  return getUserData(userId).folders.sort((a, b) => a.order - b.order);
}
function getFoldersByWorkspace(userId, workspaceId) {
  return getFolders(userId).filter((f) => f.workspaceId === workspaceId);
}
function createFolder(userId, data) {
  const ud = getUserData(userId);
  const folder = {
    ...data,
    id: v4(),
    parentId: data.parentId || void 0,
    order: ud.folders.filter((f) => f.workspaceId === data.workspaceId).length,
    createdAt: Date.now()
  };
  ud.folders.push(folder);
  setUserData(userId, ud);
  return folder;
}
function updateFolder(userId, id, data) {
  const ud = getUserData(userId);
  const idx = ud.folders.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  ud.folders[idx] = { ...ud.folders[idx], ...data };
  setUserData(userId, ud);
  return ud.folders[idx];
}
function deleteFolder(userId, id) {
  const ud = getUserData(userId);
  const toDelete = /* @__PURE__ */ new Set();
  function collectChildren(parentId) {
    toDelete.add(parentId);
    ud.folders.filter((f) => f.parentId === parentId).forEach((f) => collectChildren(f.id));
  }
  collectChildren(id);
  ud.folders = ud.folders.filter((f) => !toDelete.has(f.id));
  ud.connections.forEach((c) => {
    if (c.folderId && toDelete.has(c.folderId)) {
      c.folderId = void 0;
    }
  });
  setUserData(userId, ud);
  return true;
}
function getTags(userId) {
  return getUserData(userId).tags;
}
function createTag(userId, data) {
  const tag = { ...data, id: v4() };
  const ud = getUserData(userId);
  ud.tags.push(tag);
  setUserData(userId, ud);
  return tag;
}
function updateTag(userId, id, data) {
  const ud = getUserData(userId);
  const idx = ud.tags.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  ud.tags[idx] = { ...ud.tags[idx], ...data };
  setUserData(userId, ud);
  return ud.tags[idx];
}
function deleteTag(userId, id) {
  const ud = getUserData(userId);
  ud.tags = ud.tags.filter((t) => t.id !== id);
  ud.connections.forEach((c) => {
    c.tags = c.tags.filter((t) => t !== id);
  });
  setUserData(userId, ud);
  return true;
}
function getSettings(userId) {
  return getUserData(userId).settings;
}
function updateSettings(userId, data) {
  const ud = getUserData(userId);
  ud.settings = { ...ud.settings, ...data };
  setUserData(userId, ud);
  return ud.settings;
}
function getSSHKeys(userId) {
  return getUserData(userId).sshKeys || [];
}
function createSSHKey(userId, data) {
  const key = {
    ...data,
    id: v4(),
    createdAt: Date.now()
  };
  const ud = getUserData(userId);
  if (!ud.sshKeys) ud.sshKeys = [];
  ud.sshKeys.push(key);
  setUserData(userId, ud);
  return key;
}
function updateSSHKey(userId, id, data) {
  const ud = getUserData(userId);
  if (!ud.sshKeys) return null;
  const idx = ud.sshKeys.findIndex((k) => k.id === id);
  if (idx === -1) return null;
  ud.sshKeys[idx] = { ...ud.sshKeys[idx], ...data };
  setUserData(userId, ud);
  return ud.sshKeys[idx];
}
function deleteSSHKey(userId, id) {
  const ud = getUserData(userId);
  if (!ud.sshKeys) return false;
  const filtered = ud.sshKeys.filter((k) => k.id !== id);
  if (filtered.length === ud.sshKeys.length) return false;
  ud.sshKeys = filtered;
  setUserData(userId, ud);
  return true;
}
const authStore = new Store({
  name: "auth",
  defaults: {
    users: [],
    currentUserId: null
  }
});
function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}
function verifyPassword(password, salt, hash) {
  const hashBuffer = Buffer.from(hash, "hex");
  const derivedKey = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuffer, derivedKey);
}
function getCurrentUser() {
  const userId = authStore.get("currentUserId");
  if (!userId) return null;
  const user = authStore.get("users").find((u) => u.id === userId);
  if (!user) return null;
  return { id: user.id, username: user.username };
}
function register(username, password) {
  const users = authStore.get("users");
  if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, message: "Username already exists" };
  }
  if (!username || username.length < 2) {
    return { success: false, message: "Username must be at least 2 characters" };
  }
  if (!password || password.length < 4) {
    return { success: false, message: "Password must be at least 4 characters" };
  }
  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const user = {
    id: v4(),
    username,
    passwordHash,
    salt,
    createdAt: Date.now()
  };
  users.push(user);
  authStore.set("users", users);
  authStore.set("currentUserId", user.id);
  return { success: true, message: "Account created", user: { id: user.id, username: user.username } };
}
function login(username, password) {
  const users = authStore.get("users");
  const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    return { success: false, message: "Invalid username or password" };
  }
  if (!verifyPassword(password, user.salt, user.passwordHash)) {
    return { success: false, message: "Invalid username or password" };
  }
  authStore.set("currentUserId", user.id);
  return { success: true, message: "Logged in", user: { id: user.id, username: user.username } };
}
function logout() {
  authStore.set("currentUserId", null);
}
const activeSessions = /* @__PURE__ */ new Map();
const sessionJumpClients = /* @__PURE__ */ new Map();
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
      if (conn.privateKeyPath) config.privateKey = readFileSync(conn.privateKeyPath);
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
function buildHopConfig(hop, sock) {
  const cfg = { host: hop.host, port: hop.port, username: hop.username, readyTimeout: 1e4 };
  if (hop.authType === "password") cfg.password = hop.password;
  else if (hop.privateKeyPath) cfg.privateKey = readFileSync(hop.privateKeyPath);
  if (sock) cfg.sock = sock;
  return cfg;
}
function resolveProxyChain(conn, allConns, visited = /* @__PURE__ */ new Set()) {
  var _a;
  const pj = conn.proxyJump;
  if (!(pj == null ? void 0 : pj.enabled)) return [];
  if (visited.has(conn.id)) return [];
  visited.add(conn.id);
  const hop = {
    host: pj.host,
    port: pj.port,
    username: pj.username,
    authType: pj.authType || "password",
    password: pj.password,
    privateKeyPath: pj.privateKeyPath
  };
  if (pj.sourceConnectionId) {
    const srcConn = allConns.find((c) => c.id === pj.sourceConnectionId);
    if (srcConn && ((_a = srcConn.proxyJump) == null ? void 0 : _a.enabled)) {
      return [...resolveProxyChain(srcConn, allConns, visited), hop];
    }
  }
  return [hop];
}
function buildProxyChain(chain, targetHost, targetPort) {
  return new Promise((resolve, reject) => {
    const hopClients = [];
    function connectHop(index, sock) {
      const hop = chain[index];
      const client = new Client();
      hopClients.push(client);
      client.on("ready", () => {
        const nextHost = index + 1 < chain.length ? chain[index + 1].host : targetHost;
        const nextPort = index + 1 < chain.length ? chain[index + 1].port : targetPort;
        client.forwardOut("127.0.0.1", 0, nextHost, nextPort, (err, fwdStream) => {
          if (err) {
            hopClients.forEach((c) => c.end());
            reject(err);
            return;
          }
          if (index + 1 < chain.length) {
            connectHop(index + 1, fwdStream);
          } else {
            resolve({ stream: fwdStream, hopClients });
          }
        });
      });
      client.on("error", (err) => {
        hopClients.forEach((c) => c.end());
        reject(err);
      });
      client.connect(buildHopConfig(hop, sock));
    }
    connectHop(0);
  });
}
async function connectViaProxy(conn, allConns, onReady, onError, onData, onClose) {
  const chain = resolveProxyChain(conn, allConns);
  try {
    const { stream: proxyStream, hopClients } = await buildProxyChain(chain, conn.host, conn.port);
    const targetClient = new Client();
    const targetConfig = buildConfig(conn);
    targetConfig.sock = proxyStream;
    targetClient.on("ready", () => {
      targetClient.shell({ term: "xterm-256color" }, (err, shellStream) => {
        if (err) {
          targetClient.end();
          hopClients.forEach((c) => c.end());
          onError(err);
          return;
        }
        const sessionId = `${conn.id}-${Date.now()}`;
        activeSessions.set(sessionId, { id: sessionId, connectionId: conn.id, client: targetClient, stream: shellStream });
        sessionJumpClients.set(sessionId, hopClients);
        shellStream.on("data", (data) => onData(data.toString("utf-8")));
        shellStream.on("close", () => {
          activeSessions.delete(sessionId);
          sessionJumpClients.delete(sessionId);
          targetClient.end();
          hopClients.forEach((c) => c.end());
          onClose();
        });
        onReady(activeSessions.get(sessionId));
      });
    });
    targetClient.on("error", (err) => {
      hopClients.forEach((c) => c.end());
      onError(err);
    });
    targetClient.connect(targetConfig);
  } catch (err) {
    onError(err);
  }
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
      activeSessions.set(sessionId, { id: sessionId, connectionId: conn.id, client, stream });
      stream.on("data", (data) => onData(data.toString("utf-8")));
      stream.on("close", () => {
        activeSessions.delete(sessionId);
        client.end();
        onClose();
      });
      onReady(activeSessions.get(sessionId));
    });
  });
  client.on("error", onError);
  client.connect(config);
}
function connect(conn, allConns, onReady, onError, onData, onClose) {
  var _a;
  if ((_a = conn.proxyJump) == null ? void 0 : _a.enabled) {
    connectViaProxy(conn, allConns, onReady, onError, onData, onClose);
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
  (_b = sessionJumpClients.get(sessionId)) == null ? void 0 : _b.forEach((c) => c.end());
  sessionJumpClients.delete(sessionId);
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
async function testConnection(conn, allConns = []) {
  return new Promise((resolve) => {
    const start = Date.now();
    const onReady = (session) => {
      const latency = Date.now() - start;
      disconnect(session.id);
      resolve({ success: true, message: `Connected in ${latency}ms`, latency });
    };
    const onError = (err) => resolve({ success: false, message: err.message });
    connect(conn, allConns, onReady, onError, () => {
    }, () => {
    });
    setTimeout(() => resolve({ success: false, message: "Connection timed out (15s)" }), 15e3);
  });
}
async function execCommand(conn, command, allConns = []) {
  var _a;
  let output = "";
  const runExec = (client, hopClients = []) => new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) {
        client.end();
        hopClients.forEach((c) => c.end());
        return reject(err);
      }
      stream.on("data", (d) => {
        output += d.toString("utf-8");
      });
      stream.stderr.on("data", (d) => {
        output += d.toString("utf-8");
      });
      stream.on("close", () => {
        client.end();
        hopClients.forEach((c) => c.end());
        resolve(output);
      });
    });
  });
  if ((_a = conn.proxyJump) == null ? void 0 : _a.enabled) {
    const chain = resolveProxyChain(conn, allConns);
    const { stream, hopClients } = await buildProxyChain(chain, conn.host, conn.port);
    const targetClient = new Client();
    targetClient.connect({ ...buildConfig(conn), sock: stream });
    return new Promise((resolve, reject) => {
      targetClient.on("ready", () => runExec(targetClient, hopClients).then(resolve).catch(reject));
      targetClient.on("error", (err) => {
        hopClients.forEach((c) => c.end());
        reject(err);
      });
    });
  } else {
    const client = new Client();
    client.connect(buildConfig(conn));
    return new Promise((resolve, reject) => {
      client.on("ready", () => runExec(client).then(resolve).catch(reject));
      client.on("error", reject);
    });
  }
}
async function detectNginxLogFiles(conn, allConns = []) {
  const command = `
    set -o pipefail 2>/dev/null || true
    config_logs=$(
      (nginx -T 2>/dev/null || cat         /etc/nginx/nginx.conf         /etc/nginx/conf.d/*.conf         /etc/nginx/sites-enabled/*         /www/server/nginx/conf/nginx.conf         /www/server/nginx/conf/vhost/*.conf         /www/server/panel/vhost/nginx/*.conf         2>/dev/null)       | grep -E 'access_log|error_log'       | grep -v '#'       | grep -oE '/[^ ;]+\\.log'       | sort -u
    ) 2>/dev/null
    default_paths=(
      /var/log/nginx/access.log /var/log/nginx/error.log /var/log/nginx/access.log.1
      /usr/local/nginx/logs/access.log /usr/local/nginx/logs/error.log
      /opt/nginx/logs/access.log /www/wwwlogs/access.log /www/wwwlogs/nginx_error.log
      /home/*/logs/nginx/access.log /home/*/logs/access.log
    )
    all_candidates="$config_logs"$'\\n'"$(printf '%s\\n' "\${default_paths[@]}")"
    extra=$(find /var/log/nginx /usr/local/nginx/logs /opt/nginx/logs /www/wwwlogs -name "*.log" -type f 2>/dev/null)
    all_candidates="$all_candidates"$'\\n'"$extra"
    echo "$all_candidates" | sort -u | while IFS= read -r p; do
      [ -z "$p" ] && continue
      if [ -f "$p" ] && [ -r "$p" ]; then
        size=$(stat -c%s "$p" 2>/dev/null || stat -f%z "$p" 2>/dev/null || echo 0)
        echo "$size $p"
      fi
    done
  `.trim();
  const output = await execCommand(conn, `bash -c '${command.replace(/'/g, "'\\''")}'`, allConns);
  const results = [];
  const seen = /* @__PURE__ */ new Set();
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx === -1) continue;
    const filePath = trimmed.substring(spaceIdx + 1).trim();
    if (!filePath || seen.has(filePath)) continue;
    seen.add(filePath);
    results.push({ path: filePath, name: filePath.split("/").pop() || filePath, sizeBytes: parseInt(trimmed.substring(0, spaceIdx), 10) || 0 });
  }
  results.sort((a, b) => {
    const aIsAccess = a.name.startsWith("access") ? 0 : 1;
    const bIsAccess = b.name.startsWith("access") ? 0 : 1;
    return aIsAccess !== bIsAccess ? aIsAccess - bIsAccess : a.path.localeCompare(b.path);
  });
  return results;
}
const NGINX_REGEX = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d+)\s+(\d+|-)\s+"([^"]*)"\s+"([^"]*)"/;
function buildDatePattern(filters) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formatDate = (d) => `${d.getDate().toString().padStart(2, "0")}/${months[d.getMonth()]}/${d.getFullYear()}`;
  if (filters.dateFilter === "this_month") {
    const d = /* @__PURE__ */ new Date();
    return `${months[d.getMonth()]}/${d.getFullYear()}`;
  }
  const targetDates = [];
  if (filters.dateFilter === "today") {
    targetDates.push(/* @__PURE__ */ new Date());
  } else if (filters.dateFilter === "7days") {
    for (let i = 0; i < 7; i++) {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() - i);
      targetDates.push(d);
    }
  } else if (filters.dateFilter === "specific" && filters.startDate) {
    const [y, m, d] = filters.startDate.split("-").map(Number);
    if (!isNaN(y)) targetDates.push(new Date(y, m - 1, d));
  } else if (filters.dateFilter === "range" && filters.startDate && filters.endDate) {
    const [sy, sm, sd] = filters.startDate.split("-").map(Number);
    const [ey, em, ed] = filters.endDate.split("-").map(Number);
    if (!isNaN(sy) && !isNaN(ey)) {
      let iter = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);
      let g = 0;
      while (iter <= end && g++ < 32) {
        targetDates.push(new Date(iter));
        iter.setDate(iter.getDate() + 1);
      }
    }
  }
  return targetDates.length > 0 ? targetDates.map((d) => formatDate(d)).join("|") : "";
}
async function downloadAndParseLog(conn, remotePath, filters, onProgress, allConns = []) {
  var _a;
  onProgress == null ? void 0 : onProgress("Đang khởi tạo kết nối SSH...");
  let command = `tail -n 200000 "${remotePath}"`;
  if (filters) {
    const pattern = buildDatePattern(filters);
    if (pattern && pattern.includes("|")) command = `grep -E "${pattern}" "${remotePath}" | tail -n 200000`;
    else if (pattern) command = `grep "${pattern}" "${remotePath}" | tail -n 200000`;
  }
  const runAndParse = (client, hopClients = []) => new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) {
        client.end();
        hopClients.forEach((c) => c.end());
        return reject(err);
      }
      onProgress == null ? void 0 : onProgress("Đang đọc dữ liệu log...");
      parseLogStream(stream).then((logs) => {
        client.end();
        hopClients.forEach((c) => c.end());
        resolve(logs);
      }).catch((err2) => {
        client.end();
        hopClients.forEach((c) => c.end());
        reject(err2);
      });
      stream.on("close", () => {
      });
    });
  });
  if ((_a = conn.proxyJump) == null ? void 0 : _a.enabled) {
    const chain = resolveProxyChain(conn, allConns);
    onProgress == null ? void 0 : onProgress(`Đang kết nối qua ${chain.length} hop(s)...`);
    const { stream, hopClients } = await buildProxyChain(chain, conn.host, conn.port || 22);
    const targetClient = new Client();
    targetClient.connect({ ...buildConfig(conn), sock: stream });
    return new Promise((resolve, reject) => {
      targetClient.on("ready", () => runAndParse(targetClient, hopClients).then(resolve).catch(reject));
      targetClient.on("error", (err) => {
        hopClients.forEach((c) => c.end());
        reject(err);
      });
    });
  } else {
    const client = new Client();
    client.connect(buildConfig(conn));
    return new Promise((resolve, reject) => {
      client.on("ready", () => runAndParse(client).then(resolve).catch(reject));
      client.on("error", reject);
    });
  }
}
async function parseLogStream(inputStream) {
  const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });
  const entries = [];
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1e3;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const match = NGINX_REGEX.exec(line);
    if (match) {
      try {
        const ts = new Date(match[2].replace(":", " ")).getTime();
        if (!isNaN(ts)) {
          const reqParts = match[3].split(" ");
          let bytes = parseInt(match[5], 10);
          if (isNaN(bytes)) bytes = 0;
          entries.push({ raw: line, ip: match[1], timestamp: new Date(ts).toISOString(), method: reqParts[0], path: reqParts[1] || "", status: parseInt(match[4], 10), bytes, referer: match[6], userAgent: match[7] });
          if (entries.length % 5e4 === 0) {
            const limit = ts - THIRTY_DAYS_MS;
            let drop = 0;
            while (drop < entries.length && new Date(entries[drop].timestamp).getTime() < limit) drop++;
            if (drop > 0) entries.splice(0, drop);
          }
        }
      } catch {
      }
    }
  }
  if (entries.length > 0) {
    const latestTs = new Date(entries[entries.length - 1].timestamp).getTime();
    const limit = latestTs - THIRTY_DAYS_MS;
    let drop = 0;
    while (drop < entries.length && new Date(entries[drop].timestamp).getTime() < limit) drop++;
    if (drop > 0) entries.splice(0, drop);
  }
  return entries;
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
function requireUserId() {
  const user = getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}
ipcMain.handle("auth:register", (_e, username, password) => {
  return register(username, password);
});
ipcMain.handle("auth:login", (_e, username, password) => {
  return login(username, password);
});
ipcMain.handle("auth:logout", () => {
  logout();
  return { success: true };
});
ipcMain.handle("auth:current-user", () => {
  return getCurrentUser();
});
const ALGORITHM = "aes-256-gcm";
function encryptData(text, password) {
  if (!password) return JSON.stringify({ encrypted: false, data: text });
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 1e5, 32, "sha256");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    encrypted: true,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    data: encrypted
  });
}
function decryptData(jsonString, password) {
  const parsed = JSON.parse(jsonString);
  if (!parsed.encrypted) return parsed.data;
  if (!password) throw new Error("A password is required to decrypt this backup");
  const salt = Buffer.from(parsed.salt, "base64");
  const iv = Buffer.from(parsed.iv, "base64");
  const authTag = Buffer.from(parsed.authTag, "base64");
  const key = crypto.pbkdf2Sync(password, salt, 1e5, 32, "sha256");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(parsed.data, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
ipcMain.handle("data:export", async (_e, password) => {
  const userId = requireUserId();
  const data = getUserDataRaw(userId);
  const jsonString = JSON.stringify(data);
  const defaultPath = path.join(app.getPath("documents"), `ssh-tool-backup-${Date.now()}.mmo-backup`);
  const result = await dialog.showSaveDialog(win, {
    title: "Export Data",
    defaultPath,
    filters: [{ name: "MMO Backup", extensions: ["mmo-backup"] }, { name: "All Files", extensions: ["*"] }]
  });
  if (result.canceled || !result.filePath) return { success: false, message: "Canceled" };
  try {
    const fileData = encryptData(jsonString, password);
    await fs.writeFile(result.filePath, fileData, "utf8");
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});
ipcMain.handle("data:import", async (_e, password) => {
  const userId = requireUserId();
  const result = await dialog.showOpenDialog(win, {
    title: "Import Data",
    properties: ["openFile"],
    filters: [{ name: "MMO Backup", extensions: ["mmo-backup"] }, { name: "All Files", extensions: ["*"] }]
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, message: "Canceled" };
  try {
    const fileData = await fs.readFile(result.filePaths[0], "utf8");
    const decryptedData = decryptData(fileData, password);
    const userData = JSON.parse(decryptedData);
    if (!userData.settings || !Array.isArray(userData.connections)) {
      throw new Error("Invalid backup file format");
    }
    setUserDataRaw(userId, userData);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});
ipcMain.handle("connections:list", () => getConnections(requireUserId()));
ipcMain.handle("connections:get", (_e, id) => getConnectionById(requireUserId(), id));
ipcMain.handle("connections:create", (_e, data) => {
  return createConnection(requireUserId(), data);
});
ipcMain.handle("connections:update", (_e, id, data) => {
  return updateConnection(requireUserId(), id, data);
});
ipcMain.handle("connections:delete", (_e, id) => deleteConnection(requireUserId(), id));
ipcMain.handle("connections:duplicate", (_e, id) => duplicateConnection(requireUserId(), id));
ipcMain.handle("ssh:connect", (_e, connectionId) => {
  const userId = requireUserId();
  const conn = getConnectionById(userId, connectionId);
  if (!conn) return { success: false, message: "Connection not found" };
  const allConns = getConnections(userId);
  return new Promise((resolve) => {
    connect(
      conn,
      allConns,
      (session) => {
        touchConnection(userId, connectionId);
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
  const userId = requireUserId();
  const allConns = getConnections(userId);
  return testConnection(connData, allConns);
});
ipcMain.handle("ssh:exec", async (_e, connData, command) => {
  const userId = requireUserId();
  const allConns = getConnections(userId);
  return execCommand(connData, command, allConns);
});
ipcMain.handle("ssh:analyze-log", async (event, connData, logPath, filters) => {
  const userId = requireUserId();
  const allConns = getConnections(userId);
  return downloadAndParseLog(connData, logPath, filters, (status) => {
    event.sender.send("ssh:analyze-status", status);
  }, allConns);
});
ipcMain.handle("ssh:detect-nginx-logs", async (_e, connData) => {
  const userId = requireUserId();
  const allConns = getConnections(userId);
  return detectNginxLogFiles(connData, allConns);
});
ipcMain.handle("ssh:active-sessions", () => getActiveSessions());
ipcMain.handle("workspaces:list", () => getWorkspaces(requireUserId()));
ipcMain.handle("workspaces:create", (_e, data) => {
  return createWorkspace(requireUserId(), data);
});
ipcMain.handle("workspaces:update", (_e, id, data) => {
  return updateWorkspace(requireUserId(), id, data);
});
ipcMain.handle("workspaces:delete", (_e, id) => deleteWorkspace(requireUserId(), id));
ipcMain.handle("folders:list", () => getFolders(requireUserId()));
ipcMain.handle("folders:list-by-workspace", (_e, workspaceId) => getFoldersByWorkspace(requireUserId(), workspaceId));
ipcMain.handle("folders:create", (_e, data) => {
  return createFolder(requireUserId(), data);
});
ipcMain.handle("folders:update", (_e, id, data) => {
  return updateFolder(requireUserId(), id, data);
});
ipcMain.handle("folders:delete", (_e, id) => deleteFolder(requireUserId(), id));
ipcMain.handle("tags:list", () => getTags(requireUserId()));
ipcMain.handle("tags:create", (_e, data) => {
  return createTag(requireUserId(), data);
});
ipcMain.handle("tags:update", (_e, id, data) => {
  return updateTag(requireUserId(), id, data);
});
ipcMain.handle("tags:delete", (_e, id) => deleteTag(requireUserId(), id));
ipcMain.handle("settings:get", () => getSettings(requireUserId()));
ipcMain.handle("settings:update", (_e, data) => updateSettings(requireUserId(), data));
ipcMain.handle("ssh-keys:list", () => getSSHKeys(requireUserId()));
ipcMain.handle("ssh-keys:create", (_e, data) => {
  return createSSHKey(requireUserId(), data);
});
ipcMain.handle("ssh-keys:update", (_e, id, data) => {
  return updateSSHKey(requireUserId(), id, data);
});
ipcMain.handle("ssh-keys:delete", (_e, id) => deleteSSHKey(requireUserId(), id));
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
app.whenReady().then(() => {
  createWindow();
  function handleScreenLock() {
    if (getCurrentUser()) {
      logout();
      if (win && !win.isDestroyed()) {
        win.webContents.send("app:lock-screen");
      }
    }
  }
  powerMonitor.on("suspend", handleScreenLock);
  powerMonitor.on("lock-screen", handleScreenLock);
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
