import { ipcMain as a, dialog as X, app as x, BrowserWindow as O, powerMonitor as L } from "electron";
import { createRequire as Y } from "node:module";
import { fileURLToPath as Z } from "node:url";
import w from "node:path";
import W from "electron-store";
import { randomFillSync as ee, randomUUID as te, randomBytes as ne, scryptSync as B, timingSafeEqual as se } from "node:crypto";
import { Client as U } from "ssh2";
import { readFileSync as I } from "node:fs";
const d = [];
for (let e = 0; e < 256; ++e)
  d.push((e + 256).toString(16).slice(1));
function re(e, t = 0) {
  return (d[e[t + 0]] + d[e[t + 1]] + d[e[t + 2]] + d[e[t + 3]] + "-" + d[e[t + 4]] + d[e[t + 5]] + "-" + d[e[t + 6]] + d[e[t + 7]] + "-" + d[e[t + 8]] + d[e[t + 9]] + "-" + d[e[t + 10]] + d[e[t + 11]] + d[e[t + 12]] + d[e[t + 13]] + d[e[t + 14]] + d[e[t + 15]]).toLowerCase();
}
const v = new Uint8Array(256);
let D = v.length;
function oe() {
  return D > v.length - 16 && (ee(v), D = 0), v.slice(D, D += 16);
}
const j = { randomUUID: te };
function ae(e, t, n) {
  var r;
  e = e || {};
  const s = e.random ?? ((r = e.rng) == null ? void 0 : r.call(e)) ?? oe();
  if (s.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return s[6] = s[6] & 15 | 64, s[8] = s[8] & 63 | 128, re(s);
}
function _(e, t, n) {
  return j.randomUUID && !e ? j.randomUUID() : ae(e);
}
const ce = {
  terminalFontSize: 14,
  terminalFontFamily: 'Menlo, Monaco, "Courier New", monospace',
  defaultPort: 22,
  defaultUsername: "root"
}, ie = {
  id: "default",
  name: "All Connections",
  icon: "🏠",
  color: "#3b82f6",
  order: 0,
  createdAt: Date.now()
}, K = new W({
  defaults: {
    userData: {}
  }
});
function i(e) {
  const t = K.get("userData");
  if (!t[e]) {
    const n = {
      connections: [],
      workspaces: [{ ...ie, createdAt: Date.now() }],
      folders: [],
      tags: [],
      sshKeys: [],
      settings: { ...ce }
    };
    t[e] = n, K.set("userData", t);
  }
  return t[e];
}
function l(e, t) {
  const n = K.get("userData");
  n[e] = t, K.set("userData", n);
}
function ue(e) {
  return i(e).connections;
}
function E(e, t) {
  return i(e).connections.find((n) => n.id === t);
}
function H(e, t) {
  const n = Date.now(), s = {
    ...t,
    id: _(),
    createdAt: n,
    updatedAt: n
  }, r = i(e);
  return r.connections.push(s), l(e, r), s;
}
function V(e, t, n) {
  const s = i(e), r = s.connections.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.connections[r] = { ...s.connections[r], ...n, updatedAt: Date.now() }, l(e, s), s.connections[r]);
}
function de(e, t) {
  const n = i(e), s = n.connections.length;
  return n.connections = n.connections.filter((r) => r.id !== t), n.connections.length === s ? !1 : (l(e, n), !0);
}
function le(e, t) {
  const n = E(e, t);
  if (!n) return null;
  const { id: s, createdAt: r, updatedAt: o, ...u } = n;
  return H(e, { ...u, name: `${n.name} (copy)` });
}
function fe(e, t) {
  V(e, t, { lastConnected: Date.now() });
}
function he(e) {
  return i(e).workspaces.sort((t, n) => t.order - n.order);
}
function pe(e, t) {
  const n = i(e), s = {
    ...t,
    id: _(),
    order: n.workspaces.length,
    createdAt: Date.now()
  };
  return n.workspaces.push(s), l(e, n), s;
}
function ge(e, t, n) {
  const s = i(e), r = s.workspaces.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.workspaces[r] = { ...s.workspaces[r], ...n }, l(e, s), s.workspaces[r]);
}
function me(e, t) {
  if (t === "default") return !1;
  const n = i(e);
  return n.workspaces = n.workspaces.filter((s) => s.id !== t), n.connections.forEach((s) => {
    s.workspaceId === t && (s.workspaceId = "default");
  }), l(e, n), !0;
}
function $(e) {
  return i(e).folders.sort((t, n) => t.order - n.order);
}
function we(e, t) {
  return $(e).filter((n) => n.workspaceId === t);
}
function ye(e, t) {
  const n = i(e), s = {
    ...t,
    id: _(),
    parentId: t.parentId || void 0,
    order: n.folders.filter((r) => r.workspaceId === t.workspaceId).length,
    createdAt: Date.now()
  };
  return n.folders.push(s), l(e, n), s;
}
function _e(e, t, n) {
  const s = i(e), r = s.folders.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.folders[r] = { ...s.folders[r], ...n }, l(e, s), s.folders[r]);
}
function ke(e, t) {
  const n = i(e), s = /* @__PURE__ */ new Set();
  function r(o) {
    s.add(o), n.folders.filter((u) => u.parentId === o).forEach((u) => r(u.id));
  }
  return r(t), n.folders = n.folders.filter((o) => !s.has(o.id)), n.connections.forEach((o) => {
    o.folderId && s.has(o.folderId) && (o.folderId = void 0);
  }), l(e, n), !0;
}
function Ce(e) {
  return i(e).tags;
}
function Se(e, t) {
  const n = { ...t, id: _() }, s = i(e);
  return s.tags.push(n), l(e, s), n;
}
function De(e, t, n) {
  const s = i(e), r = s.tags.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.tags[r] = { ...s.tags[r], ...n }, l(e, s), s.tags[r]);
}
function ve(e, t) {
  const n = i(e);
  return n.tags = n.tags.filter((s) => s.id !== t), n.connections.forEach((s) => {
    s.tags = s.tags.filter((r) => r !== t);
  }), l(e, n), !0;
}
function xe(e) {
  return i(e).settings;
}
function Ke(e, t) {
  const n = i(e);
  return n.settings = { ...n.settings, ...t }, l(e, n), n.settings;
}
function Pe(e) {
  return i(e).sshKeys || [];
}
function Ae(e, t) {
  const n = {
    ...t,
    id: _(),
    createdAt: Date.now()
  }, s = i(e);
  return s.sshKeys || (s.sshKeys = []), s.sshKeys.push(n), l(e, s), n;
}
function Ue(e, t, n) {
  const s = i(e);
  if (!s.sshKeys) return null;
  const r = s.sshKeys.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.sshKeys[r] = { ...s.sshKeys[r], ...n }, l(e, s), s.sshKeys[r]);
}
function Ie(e, t) {
  const n = i(e);
  if (!n.sshKeys) return !1;
  const s = n.sshKeys.filter((r) => r.id !== t);
  return s.length === n.sshKeys.length ? !1 : (n.sshKeys = s, l(e, n), !0);
}
const y = new W({
  name: "auth",
  defaults: {
    users: [],
    currentUserId: null
  }
});
function Te(e, t) {
  return B(e, t, 64).toString("hex");
}
function Ee(e, t, n) {
  const s = Buffer.from(n, "hex"), r = B(e, t, 64);
  return se(s, r);
}
function b() {
  const e = y.get("currentUserId");
  if (!e) return null;
  const t = y.get("users").find((n) => n.id === e);
  return t ? { id: t.id, username: t.username } : null;
}
function be(e, t) {
  const n = y.get("users");
  if (n.find((u) => u.username.toLowerCase() === e.toLowerCase()))
    return { success: !1, message: "Username already exists" };
  if (!e || e.length < 2)
    return { success: !1, message: "Username must be at least 2 characters" };
  if (!t || t.length < 4)
    return { success: !1, message: "Password must be at least 4 characters" };
  const s = ne(16).toString("hex"), r = Te(t, s), o = {
    id: _(),
    username: e,
    passwordHash: r,
    salt: s,
    createdAt: Date.now()
  };
  return n.push(o), y.set("users", n), y.set("currentUserId", o.id), { success: !0, message: "Account created", user: { id: o.id, username: o.username } };
}
function Re(e, t) {
  const s = y.get("users").find((r) => r.username.toLowerCase() === e.toLowerCase());
  return s ? Ee(t, s.salt, s.passwordHash) ? (y.set("currentUserId", s.id), { success: !0, message: "Logged in", user: { id: s.id, username: s.username } }) : { success: !1, message: "Invalid username or password" } : { success: !1, message: "Invalid username or password" };
}
function M() {
  y.set("currentUserId", null);
}
const g = /* @__PURE__ */ new Map();
function N(e) {
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
      e.privateKeyPath && (t.privateKey = I(e.privateKeyPath));
      break;
    case "key+passphrase":
      e.privateKeyPath && (t.privateKey = I(e.privateKeyPath), t.passphrase = e.passphrase);
      break;
  }
  return t;
}
function Fe(e, t, n, s, r) {
  const o = e.proxyJump, u = new U(), h = {
    host: o.host,
    port: o.port,
    username: o.username,
    readyTimeout: 1e4
  };
  o.authType === "password" ? h.password = o.password : o.privateKeyPath && (h.privateKey = I(o.privateKeyPath)), u.on("ready", () => {
    u.forwardOut(
      "127.0.0.1",
      0,
      e.host,
      e.port,
      (m, k) => {
        if (m) {
          u.end(), n(m);
          return;
        }
        const p = new U(), C = N(e);
        C.sock = k, p.on("ready", () => {
          p.shell({ term: "xterm-256color" }, (S, P) => {
            if (S) {
              p.end(), u.end(), n(S);
              return;
            }
            const A = `${e.id}-${Date.now()}`, F = {
              id: A,
              connectionId: e.id,
              client: p,
              stream: P,
              jumpClient: u
            };
            g.set(A, F), P.on("data", (Q) => s(Q.toString("utf-8"))), P.on("close", () => {
              g.delete(A), p.end(), u.end(), r();
            }), t(F);
          });
        }), p.on("error", (S) => {
          u.end(), n(S);
        }), p.connect(C);
      }
    );
  }), u.on("error", n), u.connect(h);
}
function Le(e, t, n, s, r) {
  const o = new U(), u = N(e);
  o.on("ready", () => {
    o.shell({ term: "xterm-256color" }, (h, m) => {
      if (h) {
        o.end(), n(h);
        return;
      }
      const k = `${e.id}-${Date.now()}`, p = {
        id: k,
        connectionId: e.id,
        client: o,
        stream: m
      };
      g.set(k, p), m.on("data", (C) => s(C.toString("utf-8"))), m.on("close", () => {
        g.delete(k), o.end(), r();
      }), t(p);
    });
  }), o.on("error", n), o.connect(u);
}
function q(e, t, n, s, r) {
  var o;
  (o = e.proxyJump) != null && o.enabled ? Fe(e, t, n, s, r) : Le(e, t, n, s, r);
}
function R(e) {
  var n, s;
  const t = g.get(e);
  t && ((n = t.stream) == null || n.end(), t.client.end(), (s = t.jumpClient) == null || s.end(), g.delete(e));
}
function je(e, t) {
  var s;
  const n = g.get(e);
  (s = n == null ? void 0 : n.stream) == null || s.write(t);
}
function Oe(e, t, n) {
  var r;
  const s = g.get(e);
  (r = s == null ? void 0 : s.stream) == null || r.setWindow(n, t, 0, 0);
}
function We() {
  return Array.from(g.keys());
}
function Be() {
  for (const [e] of g)
    R(e);
}
async function He(e) {
  return new Promise((t) => {
    const n = Date.now();
    q(e, (h) => {
      const m = Date.now() - n;
      R(h.id), t({ success: !0, message: `Connected in ${m}ms`, latency: m });
    }, (h) => {
      t({ success: !1, message: h.message });
    }, () => {
    }, () => {
    }), setTimeout(() => {
      t({ success: !1, message: "Connection timed out (15s)" });
    }, 15e3);
  });
}
Y(import.meta.url);
const z = w.dirname(Z(import.meta.url));
process.env.APP_ROOT = w.join(z, "..");
const T = process.env.VITE_DEV_SERVER_URL, Qe = w.join(process.env.APP_ROOT, "dist-electron"), J = w.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = T ? w.join(process.env.APP_ROOT, "public") : J;
let f;
function G() {
  f = new O({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0a",
    icon: w.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: w.join(z, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), T ? f.loadURL(T) : f.loadFile(w.join(J, "index.html"));
}
function c() {
  const e = b();
  if (!e) throw new Error("Not authenticated");
  return e.id;
}
a.handle("auth:register", (e, t, n) => be(t, n));
a.handle("auth:login", (e, t, n) => Re(t, n));
a.handle("auth:logout", () => (M(), { success: !0 }));
a.handle("auth:current-user", () => b());
a.handle("connections:list", () => ue(c()));
a.handle("connections:get", (e, t) => E(c(), t));
a.handle("connections:create", (e, t) => H(c(), t));
a.handle("connections:update", (e, t, n) => V(c(), t, n));
a.handle("connections:delete", (e, t) => de(c(), t));
a.handle("connections:duplicate", (e, t) => le(c(), t));
a.handle("ssh:connect", (e, t) => {
  const n = c(), s = E(n, t);
  return s ? new Promise((r) => {
    q(
      s,
      (o) => {
        fe(n, t), r({ success: !0, sessionId: o.id });
      },
      (o) => {
        r({ success: !1, message: o.message });
      },
      (o) => {
        f == null || f.webContents.send("ssh:data", t, o);
      },
      () => {
        f == null || f.webContents.send("ssh:closed", t);
      }
    );
  }) : { success: !1, message: "Connection not found" };
});
a.handle("ssh:disconnect", (e, t) => {
  R(t);
});
a.on("ssh:input", (e, t, n) => {
  je(t, n);
});
a.on("ssh:resize", (e, t, n, s) => {
  Oe(t, n, s);
});
a.handle("ssh:test", async (e, t) => He(t));
a.handle("ssh:active-sessions", () => We());
a.handle("workspaces:list", () => he(c()));
a.handle("workspaces:create", (e, t) => pe(c(), t));
a.handle("workspaces:update", (e, t, n) => ge(c(), t, n));
a.handle("workspaces:delete", (e, t) => me(c(), t));
a.handle("folders:list", () => $(c()));
a.handle("folders:list-by-workspace", (e, t) => we(c(), t));
a.handle("folders:create", (e, t) => ye(c(), t));
a.handle("folders:update", (e, t, n) => _e(c(), t, n));
a.handle("folders:delete", (e, t) => ke(c(), t));
a.handle("tags:list", () => Ce(c()));
a.handle("tags:create", (e, t) => Se(c(), t));
a.handle("tags:update", (e, t, n) => De(c(), t, n));
a.handle("tags:delete", (e, t) => ve(c(), t));
a.handle("settings:get", () => xe(c()));
a.handle("settings:update", (e, t) => Ke(c(), t));
a.handle("ssh-keys:list", () => Pe(c()));
a.handle("ssh-keys:create", (e, t) => Ae(c(), t));
a.handle("ssh-keys:update", (e, t, n) => Ue(c(), t, n));
a.handle("ssh-keys:delete", (e, t) => Ie(c(), t));
a.handle("dialog:select-file", async (e, t) => {
  const n = await X.showOpenDialog(f, {
    properties: ["openFile"],
    title: "Select SSH Private Key",
    filters: [{ name: "All Files", extensions: ["*"] }],
    ...t
  });
  return n.canceled ? null : n.filePaths[0];
});
x.on("window-all-closed", () => {
  Be(), process.platform !== "darwin" && (x.quit(), f = null);
});
x.on("activate", () => {
  O.getAllWindows().length === 0 && G();
});
x.whenReady().then(() => {
  G();
  function e() {
    b() && (M(), f && !f.isDestroyed() && f.webContents.send("app:lock-screen"));
  }
  L.on("suspend", e), L.on("lock-screen", e);
});
export {
  Qe as MAIN_DIST,
  J as RENDERER_DIST,
  T as VITE_DEV_SERVER_URL
};
