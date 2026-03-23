import { ipcMain as a, app as S, dialog as E, BrowserWindow as M, powerMonitor as L } from "electron";
import { createRequire as te } from "node:module";
import { fileURLToPath as ne } from "node:url";
import y from "node:path";
import k, { randomFillSync as se, randomUUID as re, randomBytes as oe, scryptSync as W, timingSafeEqual as ae } from "node:crypto";
import H from "node:fs/promises";
import N from "electron-store";
import { Client as I } from "ssh2";
import { readFileSync as K } from "node:fs";
const l = [];
for (let e = 0; e < 256; ++e)
  l.push((e + 256).toString(16).slice(1));
function ce(e, t = 0) {
  return (l[e[t + 0]] + l[e[t + 1]] + l[e[t + 2]] + l[e[t + 3]] + "-" + l[e[t + 4]] + l[e[t + 5]] + "-" + l[e[t + 6]] + l[e[t + 7]] + "-" + l[e[t + 8]] + l[e[t + 9]] + "-" + l[e[t + 10]] + l[e[t + 11]] + l[e[t + 12]] + l[e[t + 13]] + l[e[t + 14]] + l[e[t + 15]]).toLowerCase();
}
const P = new Uint8Array(256);
let b = P.length;
function ie() {
  return b > P.length - 16 && (se(P), b = 0), P.slice(b, b += 16);
}
const j = { randomUUID: re };
function ue(e, t, n) {
  var r;
  e = e || {};
  const s = e.random ?? ((r = e.rng) == null ? void 0 : r.call(e)) ?? ie();
  if (s.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return s[6] = s[6] & 15 | 64, s[8] = s[8] & 63 | 128, ce(s);
}
function _(e, t, n) {
  return j.randomUUID && !e ? j.randomUUID() : ue(e);
}
const de = {
  terminalFontSize: 14,
  terminalFontFamily: 'Menlo, Monaco, "Courier New", monospace',
  defaultPort: 22,
  defaultUsername: "root"
}, le = {
  id: "default",
  name: "All Connections",
  icon: "🏠",
  color: "#3b82f6",
  order: 0,
  createdAt: Date.now()
}, x = new N({
  defaults: {
    userData: {}
  }
});
function u(e) {
  const t = x.get("userData");
  if (!t[e]) {
    const n = {
      connections: [],
      workspaces: [{ ...le, createdAt: Date.now() }],
      folders: [],
      tags: [],
      sshKeys: [],
      settings: { ...de }
    };
    t[e] = n, x.set("userData", t);
  }
  return t[e];
}
function f(e, t) {
  const n = x.get("userData");
  n[e] = t, x.set("userData", n);
}
function fe(e) {
  return u(e);
}
function he(e, t) {
  f(e, t);
}
function pe(e) {
  return u(e).connections;
}
function R(e, t) {
  return u(e).connections.find((n) => n.id === t);
}
function V(e, t) {
  const n = Date.now(), s = {
    ...t,
    id: _(),
    createdAt: n,
    updatedAt: n
  }, r = u(e);
  return r.connections.push(s), f(e, r), s;
}
function $(e, t, n) {
  const s = u(e), r = s.connections.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.connections[r] = { ...s.connections[r], ...n, updatedAt: Date.now() }, f(e, s), s.connections[r]);
}
function ge(e, t) {
  const n = u(e), s = n.connections.length;
  return n.connections = n.connections.filter((r) => r.id !== t), n.connections.length === s ? !1 : (f(e, n), !0);
}
function me(e, t) {
  const n = R(e, t);
  if (!n) return null;
  const { id: s, createdAt: r, updatedAt: o, ...c } = n;
  return V(e, { ...c, name: `${n.name} (copy)` });
}
function ye(e, t) {
  $(e, t, { lastConnected: Date.now() });
}
function we(e) {
  return u(e).workspaces.sort((t, n) => t.order - n.order);
}
function ke(e, t) {
  const n = u(e), s = {
    ...t,
    id: _(),
    order: n.workspaces.length,
    createdAt: Date.now()
  };
  return n.workspaces.push(s), f(e, n), s;
}
function _e(e, t, n) {
  const s = u(e), r = s.workspaces.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.workspaces[r] = { ...s.workspaces[r], ...n }, f(e, s), s.workspaces[r]);
}
function De(e, t) {
  if (t === "default") return !1;
  const n = u(e);
  return n.workspaces = n.workspaces.filter((s) => s.id !== t), n.connections.forEach((s) => {
    s.workspaceId === t && (s.workspaceId = "default");
  }), f(e, n), !0;
}
function J(e) {
  return u(e).folders.sort((t, n) => t.order - n.order);
}
function Se(e, t) {
  return J(e).filter((n) => n.workspaceId === t);
}
function ve(e, t) {
  const n = u(e), s = {
    ...t,
    id: _(),
    parentId: t.parentId || void 0,
    order: n.folders.filter((r) => r.workspaceId === t.workspaceId).length,
    createdAt: Date.now()
  };
  return n.folders.push(s), f(e, n), s;
}
function Ce(e, t, n) {
  const s = u(e), r = s.folders.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.folders[r] = { ...s.folders[r], ...n }, f(e, s), s.folders[r]);
}
function be(e, t) {
  const n = u(e), s = /* @__PURE__ */ new Set();
  function r(o) {
    s.add(o), n.folders.filter((c) => c.parentId === o).forEach((c) => r(c.id));
  }
  return r(t), n.folders = n.folders.filter((o) => !s.has(o.id)), n.connections.forEach((o) => {
    o.folderId && s.has(o.folderId) && (o.folderId = void 0);
  }), f(e, n), !0;
}
function Pe(e) {
  return u(e).tags;
}
function xe(e, t) {
  const n = { ...t, id: _() }, s = u(e);
  return s.tags.push(n), f(e, s), n;
}
function Ae(e, t, n) {
  const s = u(e), r = s.tags.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.tags[r] = { ...s.tags[r], ...n }, f(e, s), s.tags[r]);
}
function Te(e, t) {
  const n = u(e);
  return n.tags = n.tags.filter((s) => s.id !== t), n.connections.forEach((s) => {
    s.tags = s.tags.filter((r) => r !== t);
  }), f(e, n), !0;
}
function Ie(e) {
  return u(e).settings;
}
function Ke(e, t) {
  const n = u(e);
  return n.settings = { ...n.settings, ...t }, f(e, n), n.settings;
}
function Ue(e) {
  return u(e).sshKeys || [];
}
function Ee(e, t) {
  const n = {
    ...t,
    id: _(),
    createdAt: Date.now()
  }, s = u(e);
  return s.sshKeys || (s.sshKeys = []), s.sshKeys.push(n), f(e, s), n;
}
function Re(e, t, n) {
  const s = u(e);
  if (!s.sshKeys) return null;
  const r = s.sshKeys.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.sshKeys[r] = { ...s.sshKeys[r], ...n }, f(e, s), s.sshKeys[r]);
}
function Fe(e, t) {
  const n = u(e);
  if (!n.sshKeys) return !1;
  const s = n.sshKeys.filter((r) => r.id !== t);
  return s.length === n.sshKeys.length ? !1 : (n.sshKeys = s, f(e, n), !0);
}
const w = new N({
  name: "auth",
  defaults: {
    users: [],
    currentUserId: null
  }
});
function Oe(e, t) {
  return W(e, t, 64).toString("hex");
}
function Be(e, t, n) {
  const s = Buffer.from(n, "hex"), r = W(e, t, 64);
  return ae(s, r);
}
function F() {
  const e = w.get("currentUserId");
  if (!e) return null;
  const t = w.get("users").find((n) => n.id === e);
  return t ? { id: t.id, username: t.username } : null;
}
function Le(e, t) {
  const n = w.get("users");
  if (n.find((c) => c.username.toLowerCase() === e.toLowerCase()))
    return { success: !1, message: "Username already exists" };
  if (!e || e.length < 2)
    return { success: !1, message: "Username must be at least 2 characters" };
  if (!t || t.length < 4)
    return { success: !1, message: "Password must be at least 4 characters" };
  const s = oe(16).toString("hex"), r = Oe(t, s), o = {
    id: _(),
    username: e,
    passwordHash: r,
    salt: s,
    createdAt: Date.now()
  };
  return n.push(o), w.set("users", n), w.set("currentUserId", o.id), { success: !0, message: "Account created", user: { id: o.id, username: o.username } };
}
function je(e, t) {
  const s = w.get("users").find((r) => r.username.toLowerCase() === e.toLowerCase());
  return s ? Be(t, s.salt, s.passwordHash) ? (w.set("currentUserId", s.id), { success: !0, message: "Logged in", user: { id: s.id, username: s.username } }) : { success: !1, message: "Invalid username or password" } : { success: !1, message: "Invalid username or password" };
}
function q() {
  w.set("currentUserId", null);
}
const m = /* @__PURE__ */ new Map();
function z(e) {
  const t = {
    host: e.host,
    port: e.port,
    username: e.username,
    readyTimeout: 1e4,
    keepaliveInterval: 3e4
  };
  switch (e.authType) {
    case "password":
      t.password = e.password;
      break;
    case "key":
      e.privateKeyPath && (t.privateKey = K(e.privateKeyPath));
      break;
    case "key+passphrase":
      e.privateKeyPath && (t.privateKey = K(e.privateKeyPath), t.passphrase = e.passphrase);
      break;
  }
  return t;
}
function Me(e, t, n, s, r) {
  const o = e.proxyJump, c = new I(), d = {
    host: o.host,
    port: o.port,
    username: o.username,
    readyTimeout: 1e4
  };
  o.authType === "password" ? d.password = o.password : o.privateKeyPath && (d.privateKey = K(o.privateKeyPath)), c.on("ready", () => {
    c.forwardOut(
      "127.0.0.1",
      0,
      e.host,
      e.port,
      (p, D) => {
        if (p) {
          c.end(), n(p);
          return;
        }
        const g = new I(), v = z(e);
        v.sock = D, g.on("ready", () => {
          g.shell({ term: "xterm-256color" }, (C, A) => {
            if (C) {
              g.end(), c.end(), n(C);
              return;
            }
            const T = `${e.id}-${Date.now()}`, B = {
              id: T,
              connectionId: e.id,
              client: g,
              stream: A,
              jumpClient: c
            };
            m.set(T, B), A.on("data", (ee) => s(ee.toString("utf-8"))), A.on("close", () => {
              m.delete(T), g.end(), c.end(), r();
            }), t(B);
          });
        }), g.on("error", (C) => {
          c.end(), n(C);
        }), g.connect(v);
      }
    );
  }), c.on("error", n), c.connect(d);
}
function We(e, t, n, s, r) {
  const o = new I(), c = z(e);
  o.on("ready", () => {
    o.shell({ term: "xterm-256color" }, (d, p) => {
      if (d) {
        o.end(), n(d);
        return;
      }
      const D = `${e.id}-${Date.now()}`, g = {
        id: D,
        connectionId: e.id,
        client: o,
        stream: p
      };
      m.set(D, g), p.on("data", (v) => s(v.toString("utf-8"))), p.on("close", () => {
        m.delete(D), o.end(), r();
      }), t(g);
    });
  }), o.on("error", n), o.connect(c);
}
function G(e, t, n, s, r) {
  var o;
  (o = e.proxyJump) != null && o.enabled ? Me(e, t, n, s, r) : We(e, t, n, s, r);
}
function O(e) {
  var n, s;
  const t = m.get(e);
  t && ((n = t.stream) == null || n.end(), t.client.end(), (s = t.jumpClient) == null || s.end(), m.delete(e));
}
function He(e, t) {
  var s;
  const n = m.get(e);
  (s = n == null ? void 0 : n.stream) == null || s.write(t);
}
function Ne(e, t, n) {
  var r;
  const s = m.get(e);
  (r = s == null ? void 0 : s.stream) == null || r.setWindow(n, t, 0, 0);
}
function Ve() {
  return Array.from(m.keys());
}
function $e() {
  for (const [e] of m)
    O(e);
}
async function Je(e) {
  return new Promise((t) => {
    const n = Date.now();
    G(e, (d) => {
      const p = Date.now() - n;
      O(d.id), t({ success: !0, message: `Connected in ${p}ms`, latency: p });
    }, (d) => {
      t({ success: !1, message: d.message });
    }, () => {
    }, () => {
    }), setTimeout(() => {
      t({ success: !1, message: "Connection timed out (15s)" });
    }, 15e3);
  });
}
te(import.meta.url);
const Q = y.dirname(ne(import.meta.url));
process.env.APP_ROOT = y.join(Q, "..");
const U = process.env.VITE_DEV_SERVER_URL, rt = y.join(process.env.APP_ROOT, "dist-electron"), X = y.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = U ? y.join(process.env.APP_ROOT, "public") : X;
let h;
function Y() {
  h = new M({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0a",
    icon: y.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: y.join(Q, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), U ? h.loadURL(U) : h.loadFile(y.join(X, "index.html"));
}
function i() {
  const e = F();
  if (!e) throw new Error("Not authenticated");
  return e.id;
}
a.handle("auth:register", (e, t, n) => Le(t, n));
a.handle("auth:login", (e, t, n) => je(t, n));
a.handle("auth:logout", () => (q(), { success: !0 }));
a.handle("auth:current-user", () => F());
const Z = "aes-256-gcm";
function qe(e, t) {
  if (!t) return JSON.stringify({ encrypted: !1, data: e });
  const n = k.randomBytes(16), s = k.pbkdf2Sync(t, n, 1e5, 32, "sha256"), r = k.randomBytes(12), o = k.createCipheriv(Z, s, r);
  let c = o.update(e, "utf8", "base64");
  c += o.final("base64");
  const d = o.getAuthTag();
  return JSON.stringify({
    encrypted: !0,
    salt: n.toString("base64"),
    iv: r.toString("base64"),
    authTag: d.toString("base64"),
    data: c
  });
}
function ze(e, t) {
  const n = JSON.parse(e);
  if (!n.encrypted) return n.data;
  if (!t) throw new Error("A password is required to decrypt this backup");
  const s = Buffer.from(n.salt, "base64"), r = Buffer.from(n.iv, "base64"), o = Buffer.from(n.authTag, "base64"), c = k.pbkdf2Sync(t, s, 1e5, 32, "sha256"), d = k.createDecipheriv(Z, c, r);
  d.setAuthTag(o);
  let p = d.update(n.data, "base64", "utf8");
  return p += d.final("utf8"), p;
}
a.handle("data:export", async (e, t) => {
  const n = i(), s = fe(n), r = JSON.stringify(s), o = y.join(S.getPath("documents"), `ssh-tool-backup-${Date.now()}.mmo-backup`), c = await E.showSaveDialog(h, {
    title: "Export Data",
    defaultPath: o,
    filters: [{ name: "MMO Backup", extensions: ["mmo-backup"] }, { name: "All Files", extensions: ["*"] }]
  });
  if (c.canceled || !c.filePath) return { success: !1, message: "Canceled" };
  try {
    const d = qe(r, t);
    return await H.writeFile(c.filePath, d, "utf8"), { success: !0 };
  } catch (d) {
    return { success: !1, message: d.message };
  }
});
a.handle("data:import", async (e, t) => {
  const n = i(), s = await E.showOpenDialog(h, {
    title: "Import Data",
    properties: ["openFile"],
    filters: [{ name: "MMO Backup", extensions: ["mmo-backup"] }, { name: "All Files", extensions: ["*"] }]
  });
  if (s.canceled || s.filePaths.length === 0) return { success: !1, message: "Canceled" };
  try {
    const r = await H.readFile(s.filePaths[0], "utf8"), o = ze(r, t), c = JSON.parse(o);
    if (!c.settings || !Array.isArray(c.connections))
      throw new Error("Invalid backup file format");
    return he(n, c), { success: !0 };
  } catch (r) {
    return { success: !1, message: r.message };
  }
});
a.handle("connections:list", () => pe(i()));
a.handle("connections:get", (e, t) => R(i(), t));
a.handle("connections:create", (e, t) => V(i(), t));
a.handle("connections:update", (e, t, n) => $(i(), t, n));
a.handle("connections:delete", (e, t) => ge(i(), t));
a.handle("connections:duplicate", (e, t) => me(i(), t));
a.handle("ssh:connect", (e, t) => {
  const n = i(), s = R(n, t);
  return s ? new Promise((r) => {
    G(
      s,
      (o) => {
        ye(n, t), r({ success: !0, sessionId: o.id });
      },
      (o) => {
        r({ success: !1, message: o.message });
      },
      (o) => {
        h == null || h.webContents.send("ssh:data", t, o);
      },
      () => {
        h == null || h.webContents.send("ssh:closed", t);
      }
    );
  }) : { success: !1, message: "Connection not found" };
});
a.handle("ssh:disconnect", (e, t) => {
  O(t);
});
a.on("ssh:input", (e, t, n) => {
  He(t, n);
});
a.on("ssh:resize", (e, t, n, s) => {
  Ne(t, n, s);
});
a.handle("ssh:test", async (e, t) => Je(t));
a.handle("ssh:active-sessions", () => Ve());
a.handle("workspaces:list", () => we(i()));
a.handle("workspaces:create", (e, t) => ke(i(), t));
a.handle("workspaces:update", (e, t, n) => _e(i(), t, n));
a.handle("workspaces:delete", (e, t) => De(i(), t));
a.handle("folders:list", () => J(i()));
a.handle("folders:list-by-workspace", (e, t) => Se(i(), t));
a.handle("folders:create", (e, t) => ve(i(), t));
a.handle("folders:update", (e, t, n) => Ce(i(), t, n));
a.handle("folders:delete", (e, t) => be(i(), t));
a.handle("tags:list", () => Pe(i()));
a.handle("tags:create", (e, t) => xe(i(), t));
a.handle("tags:update", (e, t, n) => Ae(i(), t, n));
a.handle("tags:delete", (e, t) => Te(i(), t));
a.handle("settings:get", () => Ie(i()));
a.handle("settings:update", (e, t) => Ke(i(), t));
a.handle("ssh-keys:list", () => Ue(i()));
a.handle("ssh-keys:create", (e, t) => Ee(i(), t));
a.handle("ssh-keys:update", (e, t, n) => Re(i(), t, n));
a.handle("ssh-keys:delete", (e, t) => Fe(i(), t));
a.handle("dialog:select-file", async (e, t) => {
  const n = await E.showOpenDialog(h, {
    properties: ["openFile"],
    title: "Select SSH Private Key",
    filters: [{ name: "All Files", extensions: ["*"] }],
    ...t
  });
  return n.canceled ? null : n.filePaths[0];
});
S.on("window-all-closed", () => {
  $e(), process.platform !== "darwin" && (S.quit(), h = null);
});
S.on("activate", () => {
  M.getAllWindows().length === 0 && Y();
});
S.whenReady().then(() => {
  Y();
  function e() {
    F() && (q(), h && !h.isDestroyed() && h.webContents.send("app:lock-screen"));
  }
  L.on("suspend", e), L.on("lock-screen", e);
});
export {
  rt as MAIN_DIST,
  X as RENDERER_DIST,
  U as VITE_DEV_SERVER_URL
};
