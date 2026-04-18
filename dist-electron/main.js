import { ipcMain as u, app as K, dialog as R, BrowserWindow as J, powerMonitor as $ } from "electron";
import { createRequire as ne } from "node:module";
import { fileURLToPath as se } from "node:url";
import _ from "node:path";
import v, { randomFillSync as re, randomUUID as ae, randomBytes as oe, scryptSync as H, timingSafeEqual as ie } from "node:crypto";
import W from "node:fs/promises";
import V from "electron-store";
import { Client as x } from "ssh2";
import { readFileSync as U } from "node:fs";
import ce from "node:readline";
const w = [];
for (let e = 0; e < 256; ++e)
  w.push((e + 256).toString(16).slice(1));
function ue(e, t = 0) {
  return (w[e[t + 0]] + w[e[t + 1]] + w[e[t + 2]] + w[e[t + 3]] + "-" + w[e[t + 4]] + w[e[t + 5]] + "-" + w[e[t + 6]] + w[e[t + 7]] + "-" + w[e[t + 8]] + w[e[t + 9]] + "-" + w[e[t + 10]] + w[e[t + 11]] + w[e[t + 12]] + w[e[t + 13]] + w[e[t + 14]] + w[e[t + 15]]).toLowerCase();
}
const E = new Uint8Array(256);
let F = E.length;
function de() {
  return F > E.length - 16 && (re(E), F = 0), E.slice(F, F += 16);
}
const B = { randomUUID: ae };
function le(e, t, n) {
  var a;
  e = e || {};
  const s = e.random ?? ((a = e.rng) == null ? void 0 : a.call(e)) ?? de();
  if (s.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return s[6] = s[6] & 15 | 64, s[8] = s[8] & 63 | 128, ue(s);
}
function I(e, t, n) {
  return B.randomUUID && !e ? B.randomUUID() : le(e);
}
const fe = {
  terminalFontSize: 14,
  terminalFontFamily: 'Menlo, Monaco, "Courier New", monospace',
  defaultPort: 22,
  defaultUsername: "root"
}, pe = {
  id: "default",
  name: "All Connections",
  icon: "🏠",
  color: "#3b82f6",
  order: 0,
  createdAt: Date.now()
}, N = new V({
  defaults: {
    userData: {}
  }
});
function p(e) {
  const t = N.get("userData");
  if (!t[e]) {
    const n = {
      connections: [],
      workspaces: [{ ...pe, createdAt: Date.now() }],
      folders: [],
      tags: [],
      sshKeys: [],
      settings: { ...fe }
    };
    t[e] = n, N.set("userData", t);
  }
  return t[e];
}
function D(e, t) {
  const n = N.get("userData");
  n[e] = t, N.set("userData", n);
}
function he(e) {
  return p(e);
}
function me(e, t) {
  D(e, t);
}
function ge(e) {
  return p(e).connections;
}
function O(e, t) {
  return p(e).connections.find((n) => n.id === t);
}
function q(e, t) {
  const n = Date.now(), s = {
    ...t,
    id: I(),
    createdAt: n,
    updatedAt: n
  }, a = p(e);
  return a.connections.push(s), D(e, a), s;
}
function z(e, t, n) {
  const s = p(e), a = s.connections.findIndex((r) => r.id === t);
  return a === -1 ? null : (s.connections[a] = { ...s.connections[a], ...n, updatedAt: Date.now() }, D(e, s), s.connections[a]);
}
function ye(e, t) {
  const n = p(e), s = n.connections.length;
  return n.connections = n.connections.filter((a) => a.id !== t), n.connections.length === s ? !1 : (D(e, n), !0);
}
function we(e, t) {
  const n = O(e, t);
  if (!n) return null;
  const { id: s, createdAt: a, updatedAt: r, ...o } = n;
  return q(e, { ...o, name: `${n.name} (copy)` });
}
function De(e, t) {
  z(e, t, { lastConnected: Date.now() });
}
function Se(e) {
  return p(e).workspaces.sort((t, n) => t.order - n.order);
}
function ke(e, t) {
  const n = p(e), s = {
    ...t,
    id: I(),
    order: n.workspaces.length,
    createdAt: Date.now()
  };
  return n.workspaces.push(s), D(e, n), s;
}
function _e(e, t, n) {
  const s = p(e), a = s.workspaces.findIndex((r) => r.id === t);
  return a === -1 ? null : (s.workspaces[a] = { ...s.workspaces[a], ...n }, D(e, s), s.workspaces[a]);
}
function xe(e, t) {
  if (t === "default") return !1;
  const n = p(e);
  return n.workspaces = n.workspaces.filter((s) => s.id !== t), n.connections.forEach((s) => {
    s.workspaceId === t && (s.workspaceId = "default");
  }), D(e, n), !0;
}
function j(e) {
  return p(e).folders.sort((t, n) => t.order - n.order);
}
function Ce(e, t) {
  return j(e).filter((n) => n.workspaceId === t);
}
function Te(e, t) {
  const n = p(e), s = {
    ...t,
    id: I(),
    parentId: t.parentId || void 0,
    order: n.folders.filter((a) => a.workspaceId === t.workspaceId).length,
    createdAt: Date.now()
  };
  return n.folders.push(s), D(e, n), s;
}
function be(e, t, n) {
  const s = p(e), a = s.folders.findIndex((r) => r.id === t);
  return a === -1 ? null : (s.folders[a] = { ...s.folders[a], ...n }, D(e, s), s.folders[a]);
}
function ve(e, t) {
  const n = p(e), s = /* @__PURE__ */ new Set();
  function a(r) {
    s.add(r), n.folders.filter((o) => o.parentId === r).forEach((o) => a(o.id));
  }
  return a(t), n.folders = n.folders.filter((r) => !s.has(r.id)), n.connections.forEach((r) => {
    r.folderId && s.has(r.folderId) && (r.folderId = void 0);
  }), D(e, n), !0;
}
function Ae(e) {
  return p(e).tags;
}
function Ie(e, t) {
  const n = { ...t, id: I() }, s = p(e);
  return s.tags.push(n), D(e, s), n;
}
function Ke(e, t, n) {
  const s = p(e), a = s.tags.findIndex((r) => r.id === t);
  return a === -1 ? null : (s.tags[a] = { ...s.tags[a], ...n }, D(e, s), s.tags[a]);
}
function Ue(e, t) {
  const n = p(e);
  return n.tags = n.tags.filter((s) => s.id !== t), n.connections.forEach((s) => {
    s.tags = s.tags.filter((a) => a !== t);
  }), D(e, n), !0;
}
function Fe(e) {
  return p(e).settings;
}
function Ee(e, t) {
  const n = p(e);
  return n.settings = { ...n.settings, ...t }, D(e, n), n.settings;
}
function Ne(e) {
  return p(e).sshKeys || [];
}
function Pe(e, t) {
  const n = {
    ...t,
    id: I(),
    createdAt: Date.now()
  }, s = p(e);
  return s.sshKeys || (s.sshKeys = []), s.sshKeys.push(n), D(e, s), n;
}
function Re(e, t, n) {
  const s = p(e);
  if (!s.sshKeys) return null;
  const a = s.sshKeys.findIndex((r) => r.id === t);
  return a === -1 ? null : (s.sshKeys[a] = { ...s.sshKeys[a], ...n }, D(e, s), s.sshKeys[a]);
}
function Oe(e, t) {
  const n = p(e);
  if (!n.sshKeys) return !1;
  const s = n.sshKeys.filter((a) => a.id !== t);
  return s.length === n.sshKeys.length ? !1 : (n.sshKeys = s, D(e, n), !0);
}
const C = new V({
  name: "auth",
  defaults: {
    users: [],
    currentUserId: null
  }
});
function Le(e, t) {
  return H(e, t, 64).toString("hex");
}
function Me(e, t, n) {
  const s = Buffer.from(n, "hex"), a = H(e, t, 64);
  return ie(s, a);
}
function L() {
  const e = C.get("currentUserId");
  if (!e) return null;
  const t = C.get("users").find((n) => n.id === e);
  return t ? { id: t.id, username: t.username } : null;
}
function $e(e, t) {
  const n = C.get("users");
  if (n.find((o) => o.username.toLowerCase() === e.toLowerCase()))
    return { success: !1, message: "Username already exists" };
  if (!e || e.length < 2)
    return { success: !1, message: "Username must be at least 2 characters" };
  if (!t || t.length < 4)
    return { success: !1, message: "Password must be at least 4 characters" };
  const s = oe(16).toString("hex"), a = Le(t, s), r = {
    id: I(),
    username: e,
    passwordHash: a,
    salt: s,
    createdAt: Date.now()
  };
  return n.push(r), C.set("users", n), C.set("currentUserId", r.id), { success: !0, message: "Account created", user: { id: r.id, username: r.username } };
}
function Be(e, t) {
  const s = C.get("users").find((a) => a.username.toLowerCase() === e.toLowerCase());
  return s ? Me(t, s.salt, s.passwordHash) ? (C.set("currentUserId", s.id), { success: !0, message: "Logged in", user: { id: s.id, username: s.username } }) : { success: !1, message: "Invalid username or password" } : { success: !1, message: "Invalid username or password" };
}
function G() {
  C.set("currentUserId", null);
}
const k = /* @__PURE__ */ new Map();
function A(e) {
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
      e.privateKeyPath && (t.privateKey = U(e.privateKeyPath));
      break;
    case "key+passphrase":
      e.privateKeyPath && (t.privateKey = U(e.privateKeyPath), t.passphrase = e.passphrase);
      break;
  }
  return t;
}
function Je(e, t, n, s, a) {
  const r = e.proxyJump, o = new x(), i = {
    host: r.host,
    port: r.port,
    username: r.username,
    readyTimeout: 1e4
  };
  r.authType === "password" ? i.password = r.password : r.privateKeyPath && (i.privateKey = U(r.privateKeyPath)), o.on("ready", () => {
    o.forwardOut(
      "127.0.0.1",
      0,
      e.host,
      e.port,
      (l, c) => {
        if (l) {
          o.end(), n(l);
          return;
        }
        const d = new x(), y = A(e);
        y.sock = c, d.on("ready", () => {
          d.shell({ term: "xterm-256color" }, (h, m) => {
            if (h) {
              d.end(), o.end(), n(h);
              return;
            }
            const g = `${e.id}-${Date.now()}`, T = {
              id: g,
              connectionId: e.id,
              client: d,
              stream: m,
              jumpClient: o
            };
            k.set(g, T), m.on("data", (b) => s(b.toString("utf-8"))), m.on("close", () => {
              k.delete(g), d.end(), o.end(), a();
            }), t(T);
          });
        }), d.on("error", (h) => {
          o.end(), n(h);
        }), d.connect(y);
      }
    );
  }), o.on("error", n), o.connect(i);
}
function He(e, t, n, s, a) {
  const r = new x(), o = A(e);
  r.on("ready", () => {
    r.shell({ term: "xterm-256color" }, (i, l) => {
      if (i) {
        r.end(), n(i);
        return;
      }
      const c = `${e.id}-${Date.now()}`, d = {
        id: c,
        connectionId: e.id,
        client: r,
        stream: l
      };
      k.set(c, d), l.on("data", (y) => s(y.toString("utf-8"))), l.on("close", () => {
        k.delete(c), r.end(), a();
      }), t(d);
    });
  }), r.on("error", n), r.connect(o);
}
function Y(e, t, n, s, a) {
  var r;
  (r = e.proxyJump) != null && r.enabled ? Je(e, t, n, s, a) : He(e, t, n, s, a);
}
function M(e) {
  var n, s;
  const t = k.get(e);
  t && ((n = t.stream) == null || n.end(), t.client.end(), (s = t.jumpClient) == null || s.end(), k.delete(e));
}
function We(e, t) {
  var s;
  const n = k.get(e);
  (s = n == null ? void 0 : n.stream) == null || s.write(t);
}
function Ve(e, t, n) {
  var a;
  const s = k.get(e);
  (a = s == null ? void 0 : s.stream) == null || a.setWindow(n, t, 0, 0);
}
function qe() {
  return Array.from(k.keys());
}
function ze() {
  for (const [e] of k)
    M(e);
}
async function je(e) {
  return new Promise((t) => {
    const n = Date.now();
    Y(e, (i) => {
      const l = Date.now() - n;
      M(i.id), t({ success: !0, message: `Connected in ${l}ms`, latency: l });
    }, (i) => {
      t({ success: !1, message: i.message });
    }, () => {
    }, () => {
    }), setTimeout(() => {
      t({ success: !1, message: "Connection timed out (15s)" });
    }, 15e3);
  });
}
async function Ge(e, t) {
  return new Promise((n, s) => {
    var o;
    let a = "";
    const r = (i, l, c) => {
      l.on("data", (d) => {
        a += d.toString("utf-8");
      }), l.stderr.on("data", (d) => {
        a += d.toString("utf-8");
      }), l.on("close", () => {
        i.end(), c && c.end(), n(a);
      });
    };
    if ((o = e.proxyJump) != null && o.enabled) {
      const i = e.proxyJump, l = new x(), c = {
        host: i.host,
        port: i.port,
        username: i.username,
        readyTimeout: 1e4
      };
      i.authType === "password" ? c.password = i.password : i.privateKeyPath && (c.privateKey = U(i.privateKeyPath)), l.on("ready", () => {
        l.forwardOut("127.0.0.1", 0, e.host, e.port, (d, y) => {
          if (d)
            return l.end(), s(d);
          const h = new x(), m = A(e);
          m.sock = y, h.on("ready", () => {
            h.exec(t, (g, T) => {
              if (g)
                return h.end(), l.end(), s(g);
              r(h, T, l);
            });
          }), h.on("error", (g) => {
            l.end(), s(g);
          }), h.connect(m);
        });
      }), l.on("error", s), l.connect(c);
    } else {
      const i = new x(), l = A(e);
      i.on("ready", () => {
        i.exec(t, (c, d) => {
          if (c)
            return i.end(), s(c);
          r(i, d);
        });
      }), i.on("error", s), i.connect(l);
    }
  });
}
const Ye = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d+)\s+(\d+|-)\s+"([^"]*)"\s+"([^"]*)"/;
function Xe(e) {
  const t = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], n = (r) => `${r.getDate().toString().padStart(2, "0")}/${t[r.getMonth()]}/${r.getFullYear()}`;
  if (e.dateFilter === "this_month") {
    const r = /* @__PURE__ */ new Date();
    return `${t[r.getMonth()]}/${r.getFullYear()}`;
  }
  const s = [], a = /* @__PURE__ */ new Date();
  if (e.dateFilter === "today")
    s.push(a);
  else if (e.dateFilter === "7days")
    for (let r = 0; r < 7; r++) {
      const o = /* @__PURE__ */ new Date();
      o.setDate(o.getDate() - r), s.push(o);
    }
  else if (e.dateFilter === "specific" && e.startDate) {
    const [r, o, i] = e.startDate.split("-").map(Number);
    isNaN(r) || s.push(new Date(r, o - 1, i));
  } else if (e.dateFilter === "range" && e.startDate && e.endDate) {
    let [r, o, i] = e.startDate.split("-").map(Number), [l, c, d] = e.endDate.split("-").map(Number);
    if (!isNaN(r) && !isNaN(l)) {
      const y = new Date(r, o - 1, i), h = new Date(l, c - 1, d);
      let m = new Date(y), g = 0;
      for (; m <= h && g < 32; )
        s.push(new Date(m)), m.setDate(m.getDate() + 1), g++;
    }
  }
  return s.length > 0 ? s.map((r) => n(r)).join("|") : "";
}
async function Qe(e, t, n, s) {
  return s == null || s("Đang khởi tạo kết nối SSH..."), new Promise((a, r) => {
    var l;
    let o = `tail -n 200000 "${t}"`;
    if (n) {
      const c = Xe(n);
      c && c.includes("|") ? o = `grep -E "${c}" "${t}" | tail -n 200000` : c && (o = `grep "${c}" "${t}" | tail -n 200000`);
    }
    const i = (c, d, y) => {
      let h = !1;
      const m = () => {
        h || (h = !0, c.end(), y && y.end());
      };
      s == null || s("Đang bắt đầu đọc luồng dữ liệu..."), Ze(d).then((g) => {
        m(), a(g);
      }).catch((g) => {
        m(), r(g);
      }), d.on("close", () => {
        m();
      });
    };
    if ((l = e.proxyJump) != null && l.enabled) {
      const c = e.proxyJump, d = new x(), y = {
        host: c.host,
        port: c.port,
        username: c.username,
        readyTimeout: 1e4
      };
      c.authType === "password" ? y.password = c.password : c.privateKeyPath && (y.privateKey = U(c.privateKeyPath)), s == null || s("Đang kết nối qua Proxy Jump..."), d.on("ready", () => {
        s == null || s("Đang khởi tạo chuyển tiếp cổng..."), d.forwardOut("127.0.0.1", 0, e.host, e.port || 22, (h, m) => {
          if (h)
            return d.end(), r(h);
          const g = new x(), T = A(e);
          T.sock = m, g.on("ready", () => {
            g.exec(o, (b, te) => {
              if (b)
                return g.end(), d.end(), r(b);
              i(g, te, d);
            });
          }), g.on("error", (b) => {
            d.end(), r(b);
          }), g.connect(T);
        });
      }), d.on("error", r), d.connect(y);
    } else {
      const c = new x(), d = A(e);
      c.on("ready", () => {
        c.exec(o, (y, h) => {
          if (y)
            return c.end(), r(y);
          i(c, h);
        });
      }), c.on("error", r), c.connect(d);
    }
  });
}
async function Ze(e) {
  const t = ce.createInterface({ input: e, crlfDelay: 1 / 0 }), n = [], s = 30 * 24 * 60 * 60 * 1e3;
  for await (const a of t) {
    if (!a.trim()) continue;
    const r = Ye.exec(a);
    if (r)
      try {
        const i = r[2].replace(":", " "), l = new Date(i).getTime();
        if (!isNaN(l)) {
          const c = r[3].split(" ");
          let d = parseInt(r[5], 10);
          if (isNaN(d) && (d = 0), n.push({
            raw: a,
            ip: r[1],
            timestamp: new Date(l).toISOString(),
            method: c[0],
            path: c[1] || "",
            status: parseInt(r[4], 10),
            bytes: d,
            referer: r[6],
            userAgent: r[7]
          }), n.length % 5e4 === 0) {
            const h = l - s;
            let m = 0;
            for (; m < n.length && new Date(n[m].timestamp).getTime() < h; )
              m++;
            m > 0 && n.splice(0, m);
          }
        }
      } catch {
      }
  }
  if (n.length > 0) {
    const r = new Date(n[n.length - 1].timestamp).getTime() - s;
    let o = 0;
    for (; o < n.length && new Date(n[o].timestamp).getTime() < r; )
      o++;
    o > 0 && n.splice(0, o);
  }
  return n;
}
ne(import.meta.url);
const X = _.dirname(se(import.meta.url));
process.env.APP_ROOT = _.join(X, "..");
const P = process.env.VITE_DEV_SERVER_URL, ft = _.join(process.env.APP_ROOT, "dist-electron"), Q = _.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = P ? _.join(process.env.APP_ROOT, "public") : Q;
let S;
function Z() {
  S = new J({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0a",
    icon: _.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: _.join(X, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), P ? S.loadURL(P) : S.loadFile(_.join(Q, "index.html"));
}
function f() {
  const e = L();
  if (!e) throw new Error("Not authenticated");
  return e.id;
}
u.handle("auth:register", (e, t, n) => $e(t, n));
u.handle("auth:login", (e, t, n) => Be(t, n));
u.handle("auth:logout", () => (G(), { success: !0 }));
u.handle("auth:current-user", () => L());
const ee = "aes-256-gcm";
function et(e, t) {
  if (!t) return JSON.stringify({ encrypted: !1, data: e });
  const n = v.randomBytes(16), s = v.pbkdf2Sync(t, n, 1e5, 32, "sha256"), a = v.randomBytes(12), r = v.createCipheriv(ee, s, a);
  let o = r.update(e, "utf8", "base64");
  o += r.final("base64");
  const i = r.getAuthTag();
  return JSON.stringify({
    encrypted: !0,
    salt: n.toString("base64"),
    iv: a.toString("base64"),
    authTag: i.toString("base64"),
    data: o
  });
}
function tt(e, t) {
  const n = JSON.parse(e);
  if (!n.encrypted) return n.data;
  if (!t) throw new Error("A password is required to decrypt this backup");
  const s = Buffer.from(n.salt, "base64"), a = Buffer.from(n.iv, "base64"), r = Buffer.from(n.authTag, "base64"), o = v.pbkdf2Sync(t, s, 1e5, 32, "sha256"), i = v.createDecipheriv(ee, o, a);
  i.setAuthTag(r);
  let l = i.update(n.data, "base64", "utf8");
  return l += i.final("utf8"), l;
}
u.handle("data:export", async (e, t) => {
  const n = f(), s = he(n), a = JSON.stringify(s), r = _.join(K.getPath("documents"), `ssh-tool-backup-${Date.now()}.mmo-backup`), o = await R.showSaveDialog(S, {
    title: "Export Data",
    defaultPath: r,
    filters: [{ name: "MMO Backup", extensions: ["mmo-backup"] }, { name: "All Files", extensions: ["*"] }]
  });
  if (o.canceled || !o.filePath) return { success: !1, message: "Canceled" };
  try {
    const i = et(a, t);
    return await W.writeFile(o.filePath, i, "utf8"), { success: !0 };
  } catch (i) {
    return { success: !1, message: i.message };
  }
});
u.handle("data:import", async (e, t) => {
  const n = f(), s = await R.showOpenDialog(S, {
    title: "Import Data",
    properties: ["openFile"],
    filters: [{ name: "MMO Backup", extensions: ["mmo-backup"] }, { name: "All Files", extensions: ["*"] }]
  });
  if (s.canceled || s.filePaths.length === 0) return { success: !1, message: "Canceled" };
  try {
    const a = await W.readFile(s.filePaths[0], "utf8"), r = tt(a, t), o = JSON.parse(r);
    if (!o.settings || !Array.isArray(o.connections))
      throw new Error("Invalid backup file format");
    return me(n, o), { success: !0 };
  } catch (a) {
    return { success: !1, message: a.message };
  }
});
u.handle("connections:list", () => ge(f()));
u.handle("connections:get", (e, t) => O(f(), t));
u.handle("connections:create", (e, t) => q(f(), t));
u.handle("connections:update", (e, t, n) => z(f(), t, n));
u.handle("connections:delete", (e, t) => ye(f(), t));
u.handle("connections:duplicate", (e, t) => we(f(), t));
u.handle("ssh:connect", (e, t) => {
  const n = f(), s = O(n, t);
  return s ? new Promise((a) => {
    Y(
      s,
      (r) => {
        De(n, t), a({ success: !0, sessionId: r.id });
      },
      (r) => {
        a({ success: !1, message: r.message });
      },
      (r) => {
        S == null || S.webContents.send("ssh:data", t, r);
      },
      () => {
        S == null || S.webContents.send("ssh:closed", t);
      }
    );
  }) : { success: !1, message: "Connection not found" };
});
u.handle("ssh:disconnect", (e, t) => {
  M(t);
});
u.on("ssh:input", (e, t, n) => {
  We(t, n);
});
u.on("ssh:resize", (e, t, n, s) => {
  Ve(t, n, s);
});
u.handle("ssh:test", async (e, t) => je(t));
u.handle("ssh:exec", async (e, t, n) => Ge(t, n));
u.handle("ssh:analyze-log", async (e, t, n, s) => Qe(t, n, s, (a) => {
  e.sender.send("ssh:analyze-status", a);
}));
u.handle("ssh:active-sessions", () => qe());
u.handle("workspaces:list", () => Se(f()));
u.handle("workspaces:create", (e, t) => ke(f(), t));
u.handle("workspaces:update", (e, t, n) => _e(f(), t, n));
u.handle("workspaces:delete", (e, t) => xe(f(), t));
u.handle("folders:list", () => j(f()));
u.handle("folders:list-by-workspace", (e, t) => Ce(f(), t));
u.handle("folders:create", (e, t) => Te(f(), t));
u.handle("folders:update", (e, t, n) => be(f(), t, n));
u.handle("folders:delete", (e, t) => ve(f(), t));
u.handle("tags:list", () => Ae(f()));
u.handle("tags:create", (e, t) => Ie(f(), t));
u.handle("tags:update", (e, t, n) => Ke(f(), t, n));
u.handle("tags:delete", (e, t) => Ue(f(), t));
u.handle("settings:get", () => Fe(f()));
u.handle("settings:update", (e, t) => Ee(f(), t));
u.handle("ssh-keys:list", () => Ne(f()));
u.handle("ssh-keys:create", (e, t) => Pe(f(), t));
u.handle("ssh-keys:update", (e, t, n) => Re(f(), t, n));
u.handle("ssh-keys:delete", (e, t) => Oe(f(), t));
u.handle("dialog:select-file", async (e, t) => {
  const n = await R.showOpenDialog(S, {
    properties: ["openFile"],
    title: "Select SSH Private Key",
    filters: [{ name: "All Files", extensions: ["*"] }],
    ...t
  });
  return n.canceled ? null : n.filePaths[0];
});
K.on("window-all-closed", () => {
  ze(), process.platform !== "darwin" && (K.quit(), S = null);
});
K.on("activate", () => {
  J.getAllWindows().length === 0 && Z();
});
K.whenReady().then(() => {
  Z();
  function e() {
    L() && (G(), S && !S.isDestroyed() && S.webContents.send("app:lock-screen"));
  }
  $.on("suspend", e), $.on("lock-screen", e);
});
export {
  ft as MAIN_DIST,
  Q as RENDERER_DIST,
  P as VITE_DEV_SERVER_URL
};
