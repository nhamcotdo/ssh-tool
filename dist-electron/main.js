import { ipcMain as u, app as A, dialog as L, BrowserWindow as V, powerMonitor as W } from "electron";
import { createRequire as oe } from "node:module";
import { fileURLToPath as ae } from "node:url";
import S from "node:path";
import C, { randomFillSync as ce, randomUUID as ie, randomBytes as le, scryptSync as q, timingSafeEqual as ue } from "node:crypto";
import j from "node:fs/promises";
import G from "electron-store";
import { Client as b } from "ssh2";
import { readFileSync as R } from "node:fs";
import de from "node:readline";
const w = [];
for (let e = 0; e < 256; ++e)
  w.push((e + 256).toString(16).slice(1));
function fe(e, t = 0) {
  return (w[e[t + 0]] + w[e[t + 1]] + w[e[t + 2]] + w[e[t + 3]] + "-" + w[e[t + 4]] + w[e[t + 5]] + "-" + w[e[t + 6]] + w[e[t + 7]] + "-" + w[e[t + 8]] + w[e[t + 9]] + "-" + w[e[t + 10]] + w[e[t + 11]] + w[e[t + 12]] + w[e[t + 13]] + w[e[t + 14]] + w[e[t + 15]]).toLowerCase();
}
const P = new Uint8Array(256);
let $ = P.length;
function he() {
  return $ > P.length - 16 && (ce(P), $ = 0), P.slice($, $ += 16);
}
const z = { randomUUID: ie };
function pe(e, t, n) {
  var r;
  e = e || {};
  const s = e.random ?? ((r = e.rng) == null ? void 0 : r.call(e)) ?? he();
  if (s.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return s[6] = s[6] & 15 | 64, s[8] = s[8] & 63 | 128, fe(s);
}
function E(e, t, n) {
  return z.randomUUID && !e ? z.randomUUID() : pe(e);
}
const ge = {
  terminalFontSize: 14,
  terminalFontFamily: 'Menlo, Monaco, "Courier New", monospace',
  defaultPort: 22,
  defaultUsername: "root"
}, me = {
  id: "default",
  name: "All Connections",
  icon: "🏠",
  color: "#3b82f6",
  order: 0,
  createdAt: Date.now()
}, K = new G({
  defaults: {
    userData: {}
  }
});
function g(e) {
  const t = K.get("userData");
  if (!t[e]) {
    const n = {
      connections: [],
      workspaces: [{ ...me, createdAt: Date.now() }],
      folders: [],
      tags: [],
      sshKeys: [],
      settings: { ...ge }
    };
    t[e] = n, K.set("userData", t);
  }
  return t[e];
}
function y(e, t) {
  const n = K.get("userData");
  n[e] = t, K.set("userData", n);
}
function we(e) {
  return g(e);
}
function ye(e, t) {
  y(e, t);
}
function T(e) {
  return g(e).connections;
}
function B(e, t) {
  return g(e).connections.find((n) => n.id === t);
}
function Y(e, t) {
  const n = Date.now(), s = {
    ...t,
    id: E(),
    createdAt: n,
    updatedAt: n
  }, r = g(e);
  return r.connections.push(s), y(e, r), s;
}
function X(e, t, n) {
  const s = g(e), r = s.connections.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.connections[r] = { ...s.connections[r], ...n, updatedAt: Date.now() }, y(e, s), s.connections[r]);
}
function De(e, t) {
  const n = g(e), s = n.connections.length;
  return n.connections = n.connections.filter((r) => r.id !== t), n.connections.length === s ? !1 : (y(e, n), !0);
}
function xe(e, t) {
  const n = B(e, t);
  if (!n) return null;
  const { id: s, createdAt: r, updatedAt: o, ...a } = n;
  return Y(e, { ...a, name: `${n.name} (copy)` });
}
function _e(e, t) {
  X(e, t, { lastConnected: Date.now() });
}
function Se(e) {
  return g(e).workspaces.sort((t, n) => t.order - n.order);
}
function ke(e, t) {
  const n = g(e), s = {
    ...t,
    id: E(),
    order: n.workspaces.length,
    createdAt: Date.now()
  };
  return n.workspaces.push(s), y(e, n), s;
}
function ve(e, t, n) {
  const s = g(e), r = s.workspaces.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.workspaces[r] = { ...s.workspaces[r], ...n }, y(e, s), s.workspaces[r]);
}
function be(e, t) {
  if (t === "default") return !1;
  const n = g(e);
  return n.workspaces = n.workspaces.filter((s) => s.id !== t), n.connections.forEach((s) => {
    s.workspaceId === t && (s.workspaceId = "default");
  }), y(e, n), !0;
}
function Q(e) {
  return g(e).folders.sort((t, n) => t.order - n.order);
}
function Ce(e, t) {
  return Q(e).filter((n) => n.workspaceId === t);
}
function Ie(e, t) {
  const n = g(e), s = {
    ...t,
    id: E(),
    parentId: t.parentId || void 0,
    order: n.folders.filter((r) => r.workspaceId === t.workspaceId).length,
    createdAt: Date.now()
  };
  return n.folders.push(s), y(e, n), s;
}
function Ee(e, t, n) {
  const s = g(e), r = s.folders.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.folders[r] = { ...s.folders[r], ...n }, y(e, s), s.folders[r]);
}
function Te(e, t) {
  const n = g(e), s = /* @__PURE__ */ new Set();
  function r(o) {
    s.add(o), n.folders.filter((a) => a.parentId === o).forEach((a) => r(a.id));
  }
  return r(t), n.folders = n.folders.filter((o) => !s.has(o.id)), n.connections.forEach((o) => {
    o.folderId && s.has(o.folderId) && (o.folderId = void 0);
  }), y(e, n), !0;
}
function Ae(e) {
  return g(e).tags;
}
function $e(e, t) {
  const n = { ...t, id: E() }, s = g(e);
  return s.tags.push(n), y(e, s), n;
}
function Pe(e, t, n) {
  const s = g(e), r = s.tags.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.tags[r] = { ...s.tags[r], ...n }, y(e, s), s.tags[r]);
}
function Ke(e, t) {
  const n = g(e);
  return n.tags = n.tags.filter((s) => s.id !== t), n.connections.forEach((s) => {
    s.tags = s.tags.filter((r) => r !== t);
  }), y(e, n), !0;
}
function Fe(e) {
  return g(e).settings;
}
function Ue(e, t) {
  const n = g(e);
  return n.settings = { ...n.settings, ...t }, y(e, n), n.settings;
}
function Ne(e) {
  return g(e).sshKeys || [];
}
function Re(e, t) {
  const n = {
    ...t,
    id: E(),
    createdAt: Date.now()
  }, s = g(e);
  return s.sshKeys || (s.sshKeys = []), s.sshKeys.push(n), y(e, s), n;
}
function Oe(e, t, n) {
  const s = g(e);
  if (!s.sshKeys) return null;
  const r = s.sshKeys.findIndex((o) => o.id === t);
  return r === -1 ? null : (s.sshKeys[r] = { ...s.sshKeys[r], ...n }, y(e, s), s.sshKeys[r]);
}
function Le(e, t) {
  const n = g(e);
  if (!n.sshKeys) return !1;
  const s = n.sshKeys.filter((r) => r.id !== t);
  return s.length === n.sshKeys.length ? !1 : (n.sshKeys = s, y(e, n), !0);
}
const k = new G({
  name: "auth",
  defaults: {
    users: [],
    currentUserId: null
  }
});
function Be(e, t) {
  return q(e, t, 64).toString("hex");
}
function Me(e, t, n) {
  const s = Buffer.from(n, "hex"), r = q(e, t, 64);
  return ue(s, r);
}
function M() {
  const e = k.get("currentUserId");
  if (!e) return null;
  const t = k.get("users").find((n) => n.id === e);
  return t ? { id: t.id, username: t.username } : null;
}
function He(e, t) {
  const n = k.get("users");
  if (n.find((a) => a.username.toLowerCase() === e.toLowerCase()))
    return { success: !1, message: "Username already exists" };
  if (!e || e.length < 2)
    return { success: !1, message: "Username must be at least 2 characters" };
  if (!t || t.length < 4)
    return { success: !1, message: "Password must be at least 4 characters" };
  const s = le(16).toString("hex"), r = Be(t, s), o = {
    id: E(),
    username: e,
    passwordHash: r,
    salt: s,
    createdAt: Date.now()
  };
  return n.push(o), k.set("users", n), k.set("currentUserId", o.id), { success: !0, message: "Account created", user: { id: o.id, username: o.username } };
}
function Je(e, t) {
  const s = k.get("users").find((r) => r.username.toLowerCase() === e.toLowerCase());
  return s ? Me(t, s.salt, s.passwordHash) ? (k.set("currentUserId", s.id), { success: !0, message: "Logged in", user: { id: s.id, username: s.username } }) : { success: !1, message: "Invalid username or password" } : { success: !1, message: "Invalid username or password" };
}
function F() {
  k.set("currentUserId", null);
}
const _ = /* @__PURE__ */ new Map(), U = /* @__PURE__ */ new Map();
function I(e) {
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
      e.privateKeyPath && (t.privateKey = R(e.privateKeyPath));
      break;
    case "key+passphrase":
      e.privateKeyPath && (t.privateKey = R(e.privateKeyPath), t.passphrase = e.passphrase);
      break;
  }
  return t;
}
function We(e, t) {
  const n = { host: e.host, port: e.port, username: e.username, readyTimeout: 1e4 };
  return e.authType === "password" ? n.password = e.password : e.privateKeyPath && (n.privateKey = R(e.privateKeyPath)), t && (n.sock = t), n;
}
function N(e, t, n = /* @__PURE__ */ new Set()) {
  var o;
  const s = e.proxyJump;
  if (!(s != null && s.enabled)) return [];
  if (n.has(e.id)) return [];
  n.add(e.id);
  const r = {
    host: s.host,
    port: s.port,
    username: s.username,
    authType: s.authType || "password",
    password: s.password,
    privateKeyPath: s.privateKeyPath
  };
  if (s.sourceConnectionId) {
    const a = t.find((c) => c.id === s.sourceConnectionId);
    if (a && ((o = a.proxyJump) != null && o.enabled))
      return [...N(a, t, n), r];
  }
  return [r];
}
function H(e, t, n) {
  return new Promise((s, r) => {
    const o = [];
    function a(c, i) {
      const l = e[c], d = new b();
      o.push(d), d.on("ready", () => {
        const p = c + 1 < e.length ? e[c + 1].host : t, h = c + 1 < e.length ? e[c + 1].port : n;
        d.forwardOut("127.0.0.1", 0, p, h, (m, D) => {
          if (m) {
            o.forEach((v) => v.end()), r(m);
            return;
          }
          c + 1 < e.length ? a(c + 1, D) : s({ stream: D, hopClients: o });
        });
      }), d.on("error", (p) => {
        o.forEach((h) => h.end()), r(p);
      }), d.connect(We(l, i));
    }
    a(0);
  });
}
async function ze(e, t, n, s, r, o) {
  const a = N(e, t);
  try {
    const { stream: c, hopClients: i } = await H(a, e.host, e.port), l = new b(), d = I(e);
    d.sock = c, l.on("ready", () => {
      l.shell({ term: "xterm-256color" }, (p, h) => {
        if (p) {
          l.end(), i.forEach((D) => D.end()), s(p);
          return;
        }
        const m = `${e.id}-${Date.now()}`;
        _.set(m, { id: m, connectionId: e.id, client: l, stream: h }), U.set(m, i), h.on("data", (D) => r(m, D.toString("utf-8"))), h.on("close", () => {
          _.delete(m), U.delete(m), l.end(), i.forEach((D) => D.end()), o(m);
        }), n(_.get(m));
      });
    }), l.on("error", (p) => {
      i.forEach((h) => h.end()), s(p);
    }), l.connect(d);
  } catch (c) {
    s(c);
  }
}
function Ve(e, t, n, s, r) {
  const o = new b(), a = I(e);
  o.on("ready", () => {
    o.shell({ term: "xterm-256color" }, (c, i) => {
      if (c) {
        o.end(), n(c);
        return;
      }
      const l = `${e.id}-${Date.now()}`;
      _.set(l, { id: l, connectionId: e.id, client: o, stream: i }), i.on("data", (d) => s(l, d.toString("utf-8"))), i.on("close", () => {
        _.delete(l), o.end(), r(l);
      }), t(_.get(l));
    });
  }), o.on("error", n), o.connect(a);
}
function Z(e, t, n, s, r, o) {
  var a;
  (a = e.proxyJump) != null && a.enabled ? ze(e, t, n, s, r, o) : Ve(e, n, s, r, o);
}
function J(e) {
  var n, s;
  const t = _.get(e);
  t && ((n = t.stream) == null || n.end(), t.client.end(), (s = U.get(e)) == null || s.forEach((r) => r.end()), U.delete(e), _.delete(e));
}
function qe(e, t) {
  var s;
  const n = _.get(e);
  (s = n == null ? void 0 : n.stream) == null || s.write(t);
}
function je(e, t, n) {
  var r;
  const s = _.get(e);
  (r = s == null ? void 0 : s.stream) == null || r.setWindow(n, t, 0, 0);
}
function Ge() {
  return Array.from(_.keys());
}
function Ye() {
  for (const [e] of _)
    J(e);
}
async function Xe(e, t = []) {
  return new Promise((n) => {
    const s = Date.now();
    Z(e, t, (a) => {
      const c = Date.now() - s;
      J(a.id), n({ success: !0, message: `Connected in ${c}ms`, latency: c });
    }, (a) => n({ success: !1, message: a.message }), () => {
    }, () => {
    }), setTimeout(() => n({ success: !1, message: "Connection timed out (15s)" }), 15e3);
  });
}
async function ee(e, t, n = []) {
  var o;
  let s = "";
  const r = (a, c = []) => new Promise((i, l) => {
    a.exec(t, (d, p) => {
      if (d)
        return a.end(), c.forEach((h) => h.end()), l(d);
      p.on("data", (h) => {
        s += h.toString("utf-8");
      }), p.stderr.on("data", (h) => {
        s += h.toString("utf-8");
      }), p.on("close", () => {
        a.end(), c.forEach((h) => h.end()), i(s);
      });
    });
  });
  if ((o = e.proxyJump) != null && o.enabled) {
    const a = N(e, n), { stream: c, hopClients: i } = await H(a, e.host, e.port), l = new b();
    return l.connect({ ...I(e), sock: c }), new Promise((d, p) => {
      l.on("ready", () => r(l, i).then(d).catch(p)), l.on("error", (h) => {
        i.forEach((m) => m.end()), p(h);
      });
    });
  } else {
    const a = new b();
    return a.connect(I(e)), new Promise((c, i) => {
      a.on("ready", () => r(a).then(c).catch(i)), a.on("error", i);
    });
  }
}
async function Qe(e, t = []) {
  const n = `
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
  `.trim(), s = await ee(e, `bash -c '${n.replace(/'/g, "'\\''")}'`, t), r = [], o = /* @__PURE__ */ new Set();
  for (const a of s.split(`
`)) {
    const c = a.trim();
    if (!c) continue;
    const i = c.indexOf(" ");
    if (i === -1) continue;
    const l = c.substring(i + 1).trim();
    !l || o.has(l) || (o.add(l), r.push({ path: l, name: l.split("/").pop() || l, sizeBytes: parseInt(c.substring(0, i), 10) || 0 }));
  }
  return r.sort((a, c) => {
    const i = a.name.startsWith("access") ? 0 : 1, l = c.name.startsWith("access") ? 0 : 1;
    return i !== l ? i - l : a.path.localeCompare(c.path);
  }), r;
}
const Ze = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d+)\s+(\d+|-)\s+"([^"]*)"\s+"([^"]*)"/;
function et(e) {
  const t = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], n = (r) => `${r.getDate().toString().padStart(2, "0")}/${t[r.getMonth()]}/${r.getFullYear()}`;
  if (e.dateFilter === "this_month") {
    const r = /* @__PURE__ */ new Date();
    return `${t[r.getMonth()]}/${r.getFullYear()}`;
  }
  const s = [];
  if (e.dateFilter === "today")
    s.push(/* @__PURE__ */ new Date());
  else if (e.dateFilter === "7days")
    for (let r = 0; r < 7; r++) {
      const o = /* @__PURE__ */ new Date();
      o.setDate(o.getDate() - r), s.push(o);
    }
  else if (e.dateFilter === "specific" && e.startDate) {
    const [r, o, a] = e.startDate.split("-").map(Number);
    isNaN(r) || s.push(new Date(r, o - 1, a));
  } else if (e.dateFilter === "range" && e.startDate && e.endDate) {
    const [r, o, a] = e.startDate.split("-").map(Number), [c, i, l] = e.endDate.split("-").map(Number);
    if (!isNaN(r) && !isNaN(c)) {
      let d = new Date(r, o - 1, a);
      const p = new Date(c, i - 1, l);
      let h = 0;
      for (; d <= p && h++ < 32; )
        s.push(new Date(d)), d.setDate(d.getDate() + 1);
    }
  }
  return s.length > 0 ? s.map((r) => n(r)).join("|") : "";
}
async function tt(e, t, n, s, r = []) {
  var c;
  s == null || s("Đang khởi tạo kết nối SSH...");
  let o = `tail -n 200000 "${t}"`;
  if (n) {
    const i = et(n);
    i && i.includes("|") ? o = `grep -E "${i}" "${t}" | tail -n 200000` : i && (o = `grep "${i}" "${t}" | tail -n 200000`);
  }
  const a = (i, l = []) => new Promise((d, p) => {
    i.exec(o, (h, m) => {
      if (h)
        return i.end(), l.forEach((D) => D.end()), p(h);
      s == null || s("Đang đọc dữ liệu log..."), nt(m).then((D) => {
        i.end(), l.forEach((v) => v.end()), d(D);
      }).catch((D) => {
        i.end(), l.forEach((v) => v.end()), p(D);
      }), m.on("close", () => {
      });
    });
  });
  if ((c = e.proxyJump) != null && c.enabled) {
    const i = N(e, r);
    s == null || s(`Đang kết nối qua ${i.length} hop(s)...`);
    const { stream: l, hopClients: d } = await H(i, e.host, e.port || 22), p = new b();
    return p.connect({ ...I(e), sock: l }), new Promise((h, m) => {
      p.on("ready", () => a(p, d).then(h).catch(m)), p.on("error", (D) => {
        d.forEach((v) => v.end()), m(D);
      });
    });
  } else {
    const i = new b();
    return i.connect(I(e)), new Promise((l, d) => {
      i.on("ready", () => a(i).then(l).catch(d)), i.on("error", d);
    });
  }
}
async function nt(e) {
  const t = de.createInterface({ input: e, crlfDelay: 1 / 0 }), n = [], s = 30 * 24 * 60 * 60 * 1e3;
  for await (const r of t) {
    if (!r.trim()) continue;
    const o = Ze.exec(r);
    if (o)
      try {
        const a = new Date(o[2].replace(":", " ")).getTime();
        if (!isNaN(a)) {
          const c = o[3].split(" ");
          let i = parseInt(o[5], 10);
          if (isNaN(i) && (i = 0), n.push({ raw: r, ip: o[1], timestamp: new Date(a).toISOString(), method: c[0], path: c[1] || "", status: parseInt(o[4], 10), bytes: i, referer: o[6], userAgent: o[7] }), n.length % 5e4 === 0) {
            const l = a - s;
            let d = 0;
            for (; d < n.length && new Date(n[d].timestamp).getTime() < l; ) d++;
            d > 0 && n.splice(0, d);
          }
        }
      } catch {
      }
  }
  if (n.length > 0) {
    const o = new Date(n[n.length - 1].timestamp).getTime() - s;
    let a = 0;
    for (; a < n.length && new Date(n[a].timestamp).getTime() < o; ) a++;
    a > 0 && n.splice(0, a);
  }
  return n;
}
oe(import.meta.url);
const te = S.dirname(ae(import.meta.url));
process.env.APP_ROOT = S.join(te, "..");
const O = process.env.VITE_DEV_SERVER_URL, gt = S.join(process.env.APP_ROOT, "dist-electron"), ne = S.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = O ? S.join(process.env.APP_ROOT, "public") : ne;
let x;
function se() {
  x = new V({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0a",
    icon: S.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: S.join(te, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), O ? x.loadURL(O) : x.loadFile(S.join(ne, "index.html"));
}
function f() {
  const e = M();
  if (!e) throw new Error("Not authenticated");
  return e.id;
}
u.handle("auth:register", (e, t, n) => He(t, n));
u.handle("auth:login", (e, t, n) => Je(t, n));
u.handle("auth:logout", () => (F(), { success: !0 }));
u.handle("auth:current-user", () => M());
const re = "aes-256-gcm";
function st(e, t) {
  if (!t) return JSON.stringify({ encrypted: !1, data: e });
  const n = C.randomBytes(16), s = C.pbkdf2Sync(t, n, 1e5, 32, "sha256"), r = C.randomBytes(12), o = C.createCipheriv(re, s, r);
  let a = o.update(e, "utf8", "base64");
  a += o.final("base64");
  const c = o.getAuthTag();
  return JSON.stringify({
    encrypted: !0,
    salt: n.toString("base64"),
    iv: r.toString("base64"),
    authTag: c.toString("base64"),
    data: a
  });
}
function rt(e, t) {
  const n = JSON.parse(e);
  if (!n.encrypted) return n.data;
  if (!t) throw new Error("A password is required to decrypt this backup");
  const s = Buffer.from(n.salt, "base64"), r = Buffer.from(n.iv, "base64"), o = Buffer.from(n.authTag, "base64"), a = C.pbkdf2Sync(t, s, 1e5, 32, "sha256"), c = C.createDecipheriv(re, a, r);
  c.setAuthTag(o);
  let i = c.update(n.data, "base64", "utf8");
  return i += c.final("utf8"), i;
}
u.handle("data:export", async (e, t) => {
  const n = f(), s = we(n), r = JSON.stringify(s), o = S.join(A.getPath("documents"), `ssh-tool-backup-${Date.now()}.mmo-backup`), a = await L.showSaveDialog(x, {
    title: "Export Data",
    defaultPath: o,
    filters: [{ name: "MMO Backup", extensions: ["mmo-backup"] }, { name: "All Files", extensions: ["*"] }]
  });
  if (a.canceled || !a.filePath) return { success: !1, message: "Canceled" };
  try {
    const c = st(r, t);
    return await j.writeFile(a.filePath, c, "utf8"), { success: !0 };
  } catch (c) {
    return { success: !1, message: c.message };
  }
});
u.handle("data:import", async (e, t) => {
  const n = f(), s = await L.showOpenDialog(x, {
    title: "Import Data",
    properties: ["openFile"],
    filters: [{ name: "MMO Backup", extensions: ["mmo-backup"] }, { name: "All Files", extensions: ["*"] }]
  });
  if (s.canceled || s.filePaths.length === 0) return { success: !1, message: "Canceled" };
  try {
    const r = await j.readFile(s.filePaths[0], "utf8"), o = rt(r, t), a = JSON.parse(o);
    if (!a.settings || !Array.isArray(a.connections))
      throw new Error("Invalid backup file format");
    return ye(n, a), { success: !0 };
  } catch (r) {
    return { success: !1, message: r.message };
  }
});
u.handle("connections:list", () => T(f()));
u.handle("connections:get", (e, t) => B(f(), t));
u.handle("connections:create", (e, t) => Y(f(), t));
u.handle("connections:update", (e, t, n) => X(f(), t, n));
u.handle("connections:delete", (e, t) => De(f(), t));
u.handle("connections:duplicate", (e, t) => xe(f(), t));
u.handle("ssh:connect", (e, t) => {
  const n = f(), s = B(n, t);
  if (!s) return { success: !1, message: "Connection not found" };
  const r = T(n);
  return new Promise((o) => {
    Z(
      s,
      r,
      (a) => {
        _e(n, t), o({ success: !0, sessionId: a.id });
      },
      (a) => {
        o({ success: !1, message: a.message });
      },
      (a, c) => {
        x == null || x.webContents.send("ssh:data", a, c);
      },
      (a) => {
        x == null || x.webContents.send("ssh:closed", a);
      }
    );
  });
});
u.handle("ssh:disconnect", (e, t) => {
  J(t);
});
u.on("ssh:input", (e, t, n) => {
  qe(t, n);
});
u.on("ssh:resize", (e, t, n, s) => {
  je(t, n, s);
});
u.handle("ssh:test", async (e, t) => {
  const n = f(), s = T(n);
  return Xe(t, s);
});
u.handle("ssh:exec", async (e, t, n) => {
  const s = f(), r = T(s);
  return ee(t, n, r);
});
u.handle("ssh:analyze-log", async (e, t, n, s) => {
  const r = f(), o = T(r);
  return tt(t, n, s, (a) => {
    e.sender.send("ssh:analyze-status", a);
  }, o);
});
u.handle("ssh:detect-nginx-logs", async (e, t) => {
  const n = f(), s = T(n);
  return Qe(t, s);
});
u.handle("ssh:active-sessions", () => Ge());
u.handle("workspaces:list", () => Se(f()));
u.handle("workspaces:create", (e, t) => ke(f(), t));
u.handle("workspaces:update", (e, t, n) => ve(f(), t, n));
u.handle("workspaces:delete", (e, t) => be(f(), t));
u.handle("folders:list", () => Q(f()));
u.handle("folders:list-by-workspace", (e, t) => Ce(f(), t));
u.handle("folders:create", (e, t) => Ie(f(), t));
u.handle("folders:update", (e, t, n) => Ee(f(), t, n));
u.handle("folders:delete", (e, t) => Te(f(), t));
u.handle("tags:list", () => Ae(f()));
u.handle("tags:create", (e, t) => $e(f(), t));
u.handle("tags:update", (e, t, n) => Pe(f(), t, n));
u.handle("tags:delete", (e, t) => Ke(f(), t));
u.handle("settings:get", () => Fe(f()));
u.handle("settings:update", (e, t) => Ue(f(), t));
u.handle("ssh-keys:list", () => Ne(f()));
u.handle("ssh-keys:create", (e, t) => Re(f(), t));
u.handle("ssh-keys:update", (e, t, n) => Oe(f(), t, n));
u.handle("ssh-keys:delete", (e, t) => Le(f(), t));
u.handle("dialog:select-file", async (e, t) => {
  const n = await L.showOpenDialog(x, {
    properties: ["openFile"],
    title: "Select SSH Private Key",
    filters: [{ name: "All Files", extensions: ["*"] }],
    ...t
  });
  return n.canceled ? null : n.filePaths[0];
});
A.on("window-all-closed", () => {
  Ye(), process.platform !== "darwin" && (A.quit(), x = null);
});
A.on("activate", () => {
  V.getAllWindows().length === 0 && (F(), se());
});
A.whenReady().then(() => {
  F(), se();
  function e() {
    M() && (F(), x && !x.isDestroyed() && x.webContents.send("app:lock-screen"));
  }
  W.on("suspend", e), W.on("lock-screen", e);
});
export {
  gt as MAIN_DIST,
  ne as RENDERER_DIST,
  O as VITE_DEV_SERVER_URL
};
