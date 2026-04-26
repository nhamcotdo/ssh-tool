import { ipcMain as d, app as K, dialog as N, BrowserWindow as J, powerMonitor as B } from "electron";
import { createRequire as se } from "node:module";
import { fileURLToPath as oe } from "node:url";
import _ from "node:path";
import T, { randomFillSync as ae, randomUUID as re, randomBytes as ie, scryptSync as W, timingSafeEqual as ce } from "node:crypto";
import z from "node:fs/promises";
import H from "electron-store";
import { Client as v } from "ssh2";
import { readFileSync as $ } from "node:fs";
import le from "node:readline";
const y = [];
for (let e = 0; e < 256; ++e)
  y.push((e + 256).toString(16).slice(1));
function ue(e, t = 0) {
  return (y[e[t + 0]] + y[e[t + 1]] + y[e[t + 2]] + y[e[t + 3]] + "-" + y[e[t + 4]] + y[e[t + 5]] + "-" + y[e[t + 6]] + y[e[t + 7]] + "-" + y[e[t + 8]] + y[e[t + 9]] + "-" + y[e[t + 10]] + y[e[t + 11]] + y[e[t + 12]] + y[e[t + 13]] + y[e[t + 14]] + y[e[t + 15]]).toLowerCase();
}
const P = new Uint8Array(256);
let F = P.length;
function de() {
  return F > P.length - 16 && (ae(P), F = 0), P.slice(F, F += 16);
}
const M = { randomUUID: re };
function fe(e, t, n) {
  var a;
  e = e || {};
  const s = e.random ?? ((a = e.rng) == null ? void 0 : a.call(e)) ?? de();
  if (s.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return s[6] = s[6] & 15 | 64, s[8] = s[8] & 63 | 128, ue(s);
}
function I(e, t, n) {
  return M.randomUUID && !e ? M.randomUUID() : fe(e);
}
const pe = {
  terminalFontSize: 14,
  terminalFontFamily: 'Menlo, Monaco, "Courier New", monospace',
  defaultPort: 22,
  defaultUsername: "root"
}, he = {
  id: "default",
  name: "All Connections",
  icon: "🏠",
  color: "#3b82f6",
  order: 0,
  createdAt: Date.now()
}, E = new H({
  defaults: {
    userData: {}
  }
});
function p(e) {
  const t = E.get("userData");
  if (!t[e]) {
    const n = {
      connections: [],
      workspaces: [{ ...he, createdAt: Date.now() }],
      folders: [],
      tags: [],
      sshKeys: [],
      settings: { ...pe }
    };
    t[e] = n, E.set("userData", t);
  }
  return t[e];
}
function x(e, t) {
  const n = E.get("userData");
  n[e] = t, E.set("userData", n);
}
function ge(e) {
  return p(e);
}
function me(e, t) {
  x(e, t);
}
function we(e) {
  return p(e).connections;
}
function O(e, t) {
  return p(e).connections.find((n) => n.id === t);
}
function V(e, t) {
  const n = Date.now(), s = {
    ...t,
    id: I(),
    createdAt: n,
    updatedAt: n
  }, a = p(e);
  return a.connections.push(s), x(e, a), s;
}
function q(e, t, n) {
  const s = p(e), a = s.connections.findIndex((o) => o.id === t);
  return a === -1 ? null : (s.connections[a] = { ...s.connections[a], ...n, updatedAt: Date.now() }, x(e, s), s.connections[a]);
}
function ye(e, t) {
  const n = p(e), s = n.connections.length;
  return n.connections = n.connections.filter((a) => a.id !== t), n.connections.length === s ? !1 : (x(e, n), !0);
}
function xe(e, t) {
  const n = O(e, t);
  if (!n) return null;
  const { id: s, createdAt: a, updatedAt: o, ...r } = n;
  return V(e, { ...r, name: `${n.name} (copy)` });
}
function De(e, t) {
  q(e, t, { lastConnected: Date.now() });
}
function Se(e) {
  return p(e).workspaces.sort((t, n) => t.order - n.order);
}
function _e(e, t) {
  const n = p(e), s = {
    ...t,
    id: I(),
    order: n.workspaces.length,
    createdAt: Date.now()
  };
  return n.workspaces.push(s), x(e, n), s;
}
function ve(e, t, n) {
  const s = p(e), a = s.workspaces.findIndex((o) => o.id === t);
  return a === -1 ? null : (s.workspaces[a] = { ...s.workspaces[a], ...n }, x(e, s), s.workspaces[a]);
}
function ke(e, t) {
  if (t === "default") return !1;
  const n = p(e);
  return n.workspaces = n.workspaces.filter((s) => s.id !== t), n.connections.forEach((s) => {
    s.workspaceId === t && (s.workspaceId = "default");
  }), x(e, n), !0;
}
function j(e) {
  return p(e).folders.sort((t, n) => t.order - n.order);
}
function Ce(e, t) {
  return j(e).filter((n) => n.workspaceId === t);
}
function be(e, t) {
  const n = p(e), s = {
    ...t,
    id: I(),
    parentId: t.parentId || void 0,
    order: n.folders.filter((a) => a.workspaceId === t.workspaceId).length,
    createdAt: Date.now()
  };
  return n.folders.push(s), x(e, n), s;
}
function Te(e, t, n) {
  const s = p(e), a = s.folders.findIndex((o) => o.id === t);
  return a === -1 ? null : (s.folders[a] = { ...s.folders[a], ...n }, x(e, s), s.folders[a]);
}
function Ae(e, t) {
  const n = p(e), s = /* @__PURE__ */ new Set();
  function a(o) {
    s.add(o), n.folders.filter((r) => r.parentId === o).forEach((r) => a(r.id));
  }
  return a(t), n.folders = n.folders.filter((o) => !s.has(o.id)), n.connections.forEach((o) => {
    o.folderId && s.has(o.folderId) && (o.folderId = void 0);
  }), x(e, n), !0;
}
function Ie(e) {
  return p(e).tags;
}
function Ke(e, t) {
  const n = { ...t, id: I() }, s = p(e);
  return s.tags.push(n), x(e, s), n;
}
function $e(e, t, n) {
  const s = p(e), a = s.tags.findIndex((o) => o.id === t);
  return a === -1 ? null : (s.tags[a] = { ...s.tags[a], ...n }, x(e, s), s.tags[a]);
}
function Fe(e, t) {
  const n = p(e);
  return n.tags = n.tags.filter((s) => s.id !== t), n.connections.forEach((s) => {
    s.tags = s.tags.filter((a) => a !== t);
  }), x(e, n), !0;
}
function Pe(e) {
  return p(e).settings;
}
function Ee(e, t) {
  const n = p(e);
  return n.settings = { ...n.settings, ...t }, x(e, n), n.settings;
}
function Ue(e) {
  return p(e).sshKeys || [];
}
function Ne(e, t) {
  const n = {
    ...t,
    id: I(),
    createdAt: Date.now()
  }, s = p(e);
  return s.sshKeys || (s.sshKeys = []), s.sshKeys.push(n), x(e, s), n;
}
function Oe(e, t, n) {
  const s = p(e);
  if (!s.sshKeys) return null;
  const a = s.sshKeys.findIndex((o) => o.id === t);
  return a === -1 ? null : (s.sshKeys[a] = { ...s.sshKeys[a], ...n }, x(e, s), s.sshKeys[a]);
}
function Re(e, t) {
  const n = p(e);
  if (!n.sshKeys) return !1;
  const s = n.sshKeys.filter((a) => a.id !== t);
  return s.length === n.sshKeys.length ? !1 : (n.sshKeys = s, x(e, n), !0);
}
const k = new H({
  name: "auth",
  defaults: {
    users: [],
    currentUserId: null
  }
});
function Le(e, t) {
  return W(e, t, 64).toString("hex");
}
function Be(e, t, n) {
  const s = Buffer.from(n, "hex"), a = W(e, t, 64);
  return ce(s, a);
}
function R() {
  const e = k.get("currentUserId");
  if (!e) return null;
  const t = k.get("users").find((n) => n.id === e);
  return t ? { id: t.id, username: t.username } : null;
}
function Me(e, t) {
  const n = k.get("users");
  if (n.find((r) => r.username.toLowerCase() === e.toLowerCase()))
    return { success: !1, message: "Username already exists" };
  if (!e || e.length < 2)
    return { success: !1, message: "Username must be at least 2 characters" };
  if (!t || t.length < 4)
    return { success: !1, message: "Password must be at least 4 characters" };
  const s = ie(16).toString("hex"), a = Le(t, s), o = {
    id: I(),
    username: e,
    passwordHash: a,
    salt: s,
    createdAt: Date.now()
  };
  return n.push(o), k.set("users", n), k.set("currentUserId", o.id), { success: !0, message: "Account created", user: { id: o.id, username: o.username } };
}
function Je(e, t) {
  const s = k.get("users").find((a) => a.username.toLowerCase() === e.toLowerCase());
  return s ? Be(t, s.salt, s.passwordHash) ? (k.set("currentUserId", s.id), { success: !0, message: "Logged in", user: { id: s.id, username: s.username } }) : { success: !1, message: "Invalid username or password" } : { success: !1, message: "Invalid username or password" };
}
function G() {
  k.set("currentUserId", null);
}
const S = /* @__PURE__ */ new Map();
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
      e.privateKeyPath && (t.privateKey = $(e.privateKeyPath));
      break;
    case "key+passphrase":
      e.privateKeyPath && (t.privateKey = $(e.privateKeyPath), t.passphrase = e.passphrase);
      break;
  }
  return t;
}
function We(e, t, n, s, a) {
  const o = e.proxyJump, r = new v(), i = {
    host: o.host,
    port: o.port,
    username: o.username,
    readyTimeout: 1e4
  };
  o.authType === "password" ? i.password = o.password : o.privateKeyPath && (i.privateKey = $(o.privateKeyPath)), r.on("ready", () => {
    r.forwardOut(
      "127.0.0.1",
      0,
      e.host,
      e.port,
      (l, c) => {
        if (l) {
          r.end(), n(l);
          return;
        }
        const u = new v(), w = A(e);
        w.sock = c, u.on("ready", () => {
          u.shell({ term: "xterm-256color" }, (h, g) => {
            if (h) {
              u.end(), r.end(), n(h);
              return;
            }
            const m = `${e.id}-${Date.now()}`, C = {
              id: m,
              connectionId: e.id,
              client: u,
              stream: g,
              jumpClient: r
            };
            S.set(m, C), g.on("data", (b) => s(b.toString("utf-8"))), g.on("close", () => {
              S.delete(m), u.end(), r.end(), a();
            }), t(C);
          });
        }), u.on("error", (h) => {
          r.end(), n(h);
        }), u.connect(w);
      }
    );
  }), r.on("error", n), r.connect(i);
}
function ze(e, t, n, s, a) {
  const o = new v(), r = A(e);
  o.on("ready", () => {
    o.shell({ term: "xterm-256color" }, (i, l) => {
      if (i) {
        o.end(), n(i);
        return;
      }
      const c = `${e.id}-${Date.now()}`, u = {
        id: c,
        connectionId: e.id,
        client: o,
        stream: l
      };
      S.set(c, u), l.on("data", (w) => s(w.toString("utf-8"))), l.on("close", () => {
        S.delete(c), o.end(), a();
      }), t(u);
    });
  }), o.on("error", n), o.connect(r);
}
function Y(e, t, n, s, a) {
  var o;
  (o = e.proxyJump) != null && o.enabled ? We(e, t, n, s, a) : ze(e, t, n, s, a);
}
function L(e) {
  var n, s;
  const t = S.get(e);
  t && ((n = t.stream) == null || n.end(), t.client.end(), (s = t.jumpClient) == null || s.end(), S.delete(e));
}
function He(e, t) {
  var s;
  const n = S.get(e);
  (s = n == null ? void 0 : n.stream) == null || s.write(t);
}
function Ve(e, t, n) {
  var a;
  const s = S.get(e);
  (a = s == null ? void 0 : s.stream) == null || a.setWindow(n, t, 0, 0);
}
function qe() {
  return Array.from(S.keys());
}
function je() {
  for (const [e] of S)
    L(e);
}
async function Ge(e) {
  return new Promise((t) => {
    const n = Date.now();
    Y(e, (i) => {
      const l = Date.now() - n;
      L(i.id), t({ success: !0, message: `Connected in ${l}ms`, latency: l });
    }, (i) => {
      t({ success: !1, message: i.message });
    }, () => {
    }, () => {
    }), setTimeout(() => {
      t({ success: !1, message: "Connection timed out (15s)" });
    }, 15e3);
  });
}
async function X(e, t) {
  return new Promise((n, s) => {
    var r;
    let a = "";
    const o = (i, l, c) => {
      l.on("data", (u) => {
        a += u.toString("utf-8");
      }), l.stderr.on("data", (u) => {
        a += u.toString("utf-8");
      }), l.on("close", () => {
        i.end(), c && c.end(), n(a);
      });
    };
    if ((r = e.proxyJump) != null && r.enabled) {
      const i = e.proxyJump, l = new v(), c = {
        host: i.host,
        port: i.port,
        username: i.username,
        readyTimeout: 1e4
      };
      i.authType === "password" ? c.password = i.password : i.privateKeyPath && (c.privateKey = $(i.privateKeyPath)), l.on("ready", () => {
        l.forwardOut("127.0.0.1", 0, e.host, e.port, (u, w) => {
          if (u)
            return l.end(), s(u);
          const h = new v(), g = A(e);
          g.sock = w, h.on("ready", () => {
            h.exec(t, (m, C) => {
              if (m)
                return h.end(), l.end(), s(m);
              o(h, C, l);
            });
          }), h.on("error", (m) => {
            l.end(), s(m);
          }), h.connect(g);
        });
      }), l.on("error", s), l.connect(c);
    } else {
      const i = new v(), l = A(e);
      i.on("ready", () => {
        i.exec(t, (c, u) => {
          if (c)
            return i.end(), s(c);
          o(i, u);
        });
      }), i.on("error", s), i.connect(l);
    }
  });
}
async function Ye(e) {
  const t = `
    set -o pipefail 2>/dev/null || true

    # 1. Check nginx config for log paths (standard + aaPanel/BT Panel)
    config_logs=$(
      (nginx -T 2>/dev/null || cat         /etc/nginx/nginx.conf         /etc/nginx/conf.d/*.conf         /etc/nginx/sites-enabled/*         /www/server/nginx/conf/nginx.conf         /www/server/nginx/conf/vhost/*.conf         /www/server/panel/vhost/nginx/*.conf         2>/dev/null)       | grep -E 'access_log|error_log'       | grep -v '#'       | grep -oE '/[^ ;]+\\.log'       | sort -u
    ) 2>/dev/null

    # 2. Known default paths (standard + aaPanel /www/wwwlogs)
    default_paths=(
      /var/log/nginx/access.log
      /var/log/nginx/error.log
      /var/log/nginx/access.log.1
      /usr/local/nginx/logs/access.log
      /usr/local/nginx/logs/error.log
      /opt/nginx/logs/access.log
      /www/wwwlogs/access.log
      /www/wwwlogs/nginx_error.log
      /home/*/logs/nginx/access.log
      /home/*/logs/access.log
    )

    # Combine and deduplicate all candidates
    all_candidates="$config_logs"$'\\n'"$(printf '%s\\n' "\${default_paths[@]}")"

    # Also find any *.log under common nginx log dirs (including aaPanel)
    extra=$(find /var/log/nginx /usr/local/nginx/logs /opt/nginx/logs /www/wwwlogs -name "*.log" -type f 2>/dev/null)
    all_candidates="$all_candidates"$'\\n'"$extra"

    # Output stat info for each existing file
    echo "$all_candidates" | sort -u | while IFS= read -r p; do
      [ -z "$p" ] && continue
      if [ -f "$p" ] && [ -r "$p" ]; then
        size=$(stat -c%s "$p" 2>/dev/null || stat -f%z "$p" 2>/dev/null || echo 0)
        echo "$size $p"
      fi
    done
  `.trim(), n = await X(e, `bash -c '${t.replace(/'/g, "'\\''")}'`), s = [], a = /* @__PURE__ */ new Set();
  for (const o of n.split(`
`)) {
    const r = o.trim();
    if (!r) continue;
    const i = r.indexOf(" ");
    if (i === -1) continue;
    const l = r.substring(0, i), c = r.substring(i + 1).trim();
    if (!c || a.has(c)) continue;
    a.add(c);
    const u = parseInt(l, 10) || 0;
    s.push({
      path: c,
      name: c.split("/").pop() || c,
      sizeBytes: u
    });
  }
  return s.sort((o, r) => {
    const i = o.name.startsWith("access") ? 0 : 1, l = r.name.startsWith("access") ? 0 : 1;
    return i !== l ? i - l : o.path.localeCompare(r.path);
  }), s;
}
const Xe = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d+)\s+(\d+|-)\s+"([^"]*)"\s+"([^"]*)"/;
function Qe(e) {
  const t = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], n = (o) => `${o.getDate().toString().padStart(2, "0")}/${t[o.getMonth()]}/${o.getFullYear()}`;
  if (e.dateFilter === "this_month") {
    const o = /* @__PURE__ */ new Date();
    return `${t[o.getMonth()]}/${o.getFullYear()}`;
  }
  const s = [], a = /* @__PURE__ */ new Date();
  if (e.dateFilter === "today")
    s.push(a);
  else if (e.dateFilter === "7days")
    for (let o = 0; o < 7; o++) {
      const r = /* @__PURE__ */ new Date();
      r.setDate(r.getDate() - o), s.push(r);
    }
  else if (e.dateFilter === "specific" && e.startDate) {
    const [o, r, i] = e.startDate.split("-").map(Number);
    isNaN(o) || s.push(new Date(o, r - 1, i));
  } else if (e.dateFilter === "range" && e.startDate && e.endDate) {
    let [o, r, i] = e.startDate.split("-").map(Number), [l, c, u] = e.endDate.split("-").map(Number);
    if (!isNaN(o) && !isNaN(l)) {
      const w = new Date(o, r - 1, i), h = new Date(l, c - 1, u);
      let g = new Date(w), m = 0;
      for (; g <= h && m < 32; )
        s.push(new Date(g)), g.setDate(g.getDate() + 1), m++;
    }
  }
  return s.length > 0 ? s.map((o) => n(o)).join("|") : "";
}
async function Ze(e, t, n, s) {
  return s == null || s("Đang khởi tạo kết nối SSH..."), new Promise((a, o) => {
    var l;
    let r = `tail -n 200000 "${t}"`;
    if (n) {
      const c = Qe(n);
      c && c.includes("|") ? r = `grep -E "${c}" "${t}" | tail -n 200000` : c && (r = `grep "${c}" "${t}" | tail -n 200000`);
    }
    const i = (c, u, w) => {
      let h = !1;
      const g = () => {
        h || (h = !0, c.end(), w && w.end());
      };
      s == null || s("Đang bắt đầu đọc luồng dữ liệu..."), et(u).then((m) => {
        g(), a(m);
      }).catch((m) => {
        g(), o(m);
      }), u.on("close", () => {
        g();
      });
    };
    if ((l = e.proxyJump) != null && l.enabled) {
      const c = e.proxyJump, u = new v(), w = {
        host: c.host,
        port: c.port,
        username: c.username,
        readyTimeout: 1e4
      };
      c.authType === "password" ? w.password = c.password : c.privateKeyPath && (w.privateKey = $(c.privateKeyPath)), s == null || s("Đang kết nối qua Proxy Jump..."), u.on("ready", () => {
        s == null || s("Đang khởi tạo chuyển tiếp cổng..."), u.forwardOut("127.0.0.1", 0, e.host, e.port || 22, (h, g) => {
          if (h)
            return u.end(), o(h);
          const m = new v(), C = A(e);
          C.sock = g, m.on("ready", () => {
            m.exec(r, (b, ne) => {
              if (b)
                return m.end(), u.end(), o(b);
              i(m, ne, u);
            });
          }), m.on("error", (b) => {
            u.end(), o(b);
          }), m.connect(C);
        });
      }), u.on("error", o), u.connect(w);
    } else {
      const c = new v(), u = A(e);
      c.on("ready", () => {
        c.exec(r, (w, h) => {
          if (w)
            return c.end(), o(w);
          i(c, h);
        });
      }), c.on("error", o), c.connect(u);
    }
  });
}
async function et(e) {
  const t = le.createInterface({ input: e, crlfDelay: 1 / 0 }), n = [], s = 30 * 24 * 60 * 60 * 1e3;
  for await (const a of t) {
    if (!a.trim()) continue;
    const o = Xe.exec(a);
    if (o)
      try {
        const i = o[2].replace(":", " "), l = new Date(i).getTime();
        if (!isNaN(l)) {
          const c = o[3].split(" ");
          let u = parseInt(o[5], 10);
          if (isNaN(u) && (u = 0), n.push({
            raw: a,
            ip: o[1],
            timestamp: new Date(l).toISOString(),
            method: c[0],
            path: c[1] || "",
            status: parseInt(o[4], 10),
            bytes: u,
            referer: o[6],
            userAgent: o[7]
          }), n.length % 5e4 === 0) {
            const h = l - s;
            let g = 0;
            for (; g < n.length && new Date(n[g].timestamp).getTime() < h; )
              g++;
            g > 0 && n.splice(0, g);
          }
        }
      } catch {
      }
  }
  if (n.length > 0) {
    const o = new Date(n[n.length - 1].timestamp).getTime() - s;
    let r = 0;
    for (; r < n.length && new Date(n[r].timestamp).getTime() < o; )
      r++;
    r > 0 && n.splice(0, r);
  }
  return n;
}
se(import.meta.url);
const Q = _.dirname(oe(import.meta.url));
process.env.APP_ROOT = _.join(Q, "..");
const U = process.env.VITE_DEV_SERVER_URL, pt = _.join(process.env.APP_ROOT, "dist-electron"), Z = _.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = U ? _.join(process.env.APP_ROOT, "public") : Z;
let D;
function ee() {
  D = new J({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0a",
    icon: _.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: _.join(Q, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), U ? D.loadURL(U) : D.loadFile(_.join(Z, "index.html"));
}
function f() {
  const e = R();
  if (!e) throw new Error("Not authenticated");
  return e.id;
}
d.handle("auth:register", (e, t, n) => Me(t, n));
d.handle("auth:login", (e, t, n) => Je(t, n));
d.handle("auth:logout", () => (G(), { success: !0 }));
d.handle("auth:current-user", () => R());
const te = "aes-256-gcm";
function tt(e, t) {
  if (!t) return JSON.stringify({ encrypted: !1, data: e });
  const n = T.randomBytes(16), s = T.pbkdf2Sync(t, n, 1e5, 32, "sha256"), a = T.randomBytes(12), o = T.createCipheriv(te, s, a);
  let r = o.update(e, "utf8", "base64");
  r += o.final("base64");
  const i = o.getAuthTag();
  return JSON.stringify({
    encrypted: !0,
    salt: n.toString("base64"),
    iv: a.toString("base64"),
    authTag: i.toString("base64"),
    data: r
  });
}
function nt(e, t) {
  const n = JSON.parse(e);
  if (!n.encrypted) return n.data;
  if (!t) throw new Error("A password is required to decrypt this backup");
  const s = Buffer.from(n.salt, "base64"), a = Buffer.from(n.iv, "base64"), o = Buffer.from(n.authTag, "base64"), r = T.pbkdf2Sync(t, s, 1e5, 32, "sha256"), i = T.createDecipheriv(te, r, a);
  i.setAuthTag(o);
  let l = i.update(n.data, "base64", "utf8");
  return l += i.final("utf8"), l;
}
d.handle("data:export", async (e, t) => {
  const n = f(), s = ge(n), a = JSON.stringify(s), o = _.join(K.getPath("documents"), `ssh-tool-backup-${Date.now()}.mmo-backup`), r = await N.showSaveDialog(D, {
    title: "Export Data",
    defaultPath: o,
    filters: [{ name: "MMO Backup", extensions: ["mmo-backup"] }, { name: "All Files", extensions: ["*"] }]
  });
  if (r.canceled || !r.filePath) return { success: !1, message: "Canceled" };
  try {
    const i = tt(a, t);
    return await z.writeFile(r.filePath, i, "utf8"), { success: !0 };
  } catch (i) {
    return { success: !1, message: i.message };
  }
});
d.handle("data:import", async (e, t) => {
  const n = f(), s = await N.showOpenDialog(D, {
    title: "Import Data",
    properties: ["openFile"],
    filters: [{ name: "MMO Backup", extensions: ["mmo-backup"] }, { name: "All Files", extensions: ["*"] }]
  });
  if (s.canceled || s.filePaths.length === 0) return { success: !1, message: "Canceled" };
  try {
    const a = await z.readFile(s.filePaths[0], "utf8"), o = nt(a, t), r = JSON.parse(o);
    if (!r.settings || !Array.isArray(r.connections))
      throw new Error("Invalid backup file format");
    return me(n, r), { success: !0 };
  } catch (a) {
    return { success: !1, message: a.message };
  }
});
d.handle("connections:list", () => we(f()));
d.handle("connections:get", (e, t) => O(f(), t));
d.handle("connections:create", (e, t) => V(f(), t));
d.handle("connections:update", (e, t, n) => q(f(), t, n));
d.handle("connections:delete", (e, t) => ye(f(), t));
d.handle("connections:duplicate", (e, t) => xe(f(), t));
d.handle("ssh:connect", (e, t) => {
  const n = f(), s = O(n, t);
  return s ? new Promise((a) => {
    Y(
      s,
      (o) => {
        De(n, t), a({ success: !0, sessionId: o.id });
      },
      (o) => {
        a({ success: !1, message: o.message });
      },
      (o) => {
        D == null || D.webContents.send("ssh:data", t, o);
      },
      () => {
        D == null || D.webContents.send("ssh:closed", t);
      }
    );
  }) : { success: !1, message: "Connection not found" };
});
d.handle("ssh:disconnect", (e, t) => {
  L(t);
});
d.on("ssh:input", (e, t, n) => {
  He(t, n);
});
d.on("ssh:resize", (e, t, n, s) => {
  Ve(t, n, s);
});
d.handle("ssh:test", async (e, t) => Ge(t));
d.handle("ssh:exec", async (e, t, n) => X(t, n));
d.handle("ssh:analyze-log", async (e, t, n, s) => Ze(t, n, s, (a) => {
  e.sender.send("ssh:analyze-status", a);
}));
d.handle("ssh:detect-nginx-logs", async (e, t) => Ye(t));
d.handle("ssh:active-sessions", () => qe());
d.handle("workspaces:list", () => Se(f()));
d.handle("workspaces:create", (e, t) => _e(f(), t));
d.handle("workspaces:update", (e, t, n) => ve(f(), t, n));
d.handle("workspaces:delete", (e, t) => ke(f(), t));
d.handle("folders:list", () => j(f()));
d.handle("folders:list-by-workspace", (e, t) => Ce(f(), t));
d.handle("folders:create", (e, t) => be(f(), t));
d.handle("folders:update", (e, t, n) => Te(f(), t, n));
d.handle("folders:delete", (e, t) => Ae(f(), t));
d.handle("tags:list", () => Ie(f()));
d.handle("tags:create", (e, t) => Ke(f(), t));
d.handle("tags:update", (e, t, n) => $e(f(), t, n));
d.handle("tags:delete", (e, t) => Fe(f(), t));
d.handle("settings:get", () => Pe(f()));
d.handle("settings:update", (e, t) => Ee(f(), t));
d.handle("ssh-keys:list", () => Ue(f()));
d.handle("ssh-keys:create", (e, t) => Ne(f(), t));
d.handle("ssh-keys:update", (e, t, n) => Oe(f(), t, n));
d.handle("ssh-keys:delete", (e, t) => Re(f(), t));
d.handle("dialog:select-file", async (e, t) => {
  const n = await N.showOpenDialog(D, {
    properties: ["openFile"],
    title: "Select SSH Private Key",
    filters: [{ name: "All Files", extensions: ["*"] }],
    ...t
  });
  return n.canceled ? null : n.filePaths[0];
});
K.on("window-all-closed", () => {
  je(), process.platform !== "darwin" && (K.quit(), D = null);
});
K.on("activate", () => {
  J.getAllWindows().length === 0 && ee();
});
K.whenReady().then(() => {
  ee();
  function e() {
    R() && (G(), D && !D.isDestroyed() && D.webContents.send("app:lock-screen"));
  }
  B.on("suspend", e), B.on("lock-screen", e);
});
export {
  pt as MAIN_DIST,
  Z as RENDERER_DIST,
  U as VITE_DEV_SERVER_URL
};
