"use strict";
const electron = require("electron");
const api = {
  // ── Auth ─────────────────────────────────────────────────────
  register: (username, password) => electron.ipcRenderer.invoke("auth:register", username, password),
  login: (username, password) => electron.ipcRenderer.invoke("auth:login", username, password),
  logout: () => electron.ipcRenderer.invoke("auth:logout"),
  getCurrentUser: () => electron.ipcRenderer.invoke("auth:current-user"),
  // ── Connections ──────────────────────────────────────────────
  listConnections: () => electron.ipcRenderer.invoke("connections:list"),
  getConnection: (id) => electron.ipcRenderer.invoke("connections:get", id),
  createConnection: (data) => electron.ipcRenderer.invoke("connections:create", data),
  updateConnection: (id, data) => electron.ipcRenderer.invoke("connections:update", id, data),
  deleteConnection: (id) => electron.ipcRenderer.invoke("connections:delete", id),
  duplicateConnection: (id) => electron.ipcRenderer.invoke("connections:duplicate", id),
  // ── SSH Sessions ────────────────────────────────────────────
  sshConnect: (connectionId) => electron.ipcRenderer.invoke("ssh:connect", connectionId),
  sshDisconnect: (sessionId) => electron.ipcRenderer.invoke("ssh:disconnect", sessionId),
  sshInput: (sessionId, data) => electron.ipcRenderer.send("ssh:input", sessionId, data),
  sshResize: (sessionId, cols, rows) => electron.ipcRenderer.send("ssh:resize", sessionId, cols, rows),
  sshTest: (connData) => electron.ipcRenderer.invoke("ssh:test", connData),
  sshExec: (connData, cmd) => electron.ipcRenderer.invoke("ssh:exec", connData, cmd),
  sshAnalyzeLog: (connData, logPath, filters) => electron.ipcRenderer.invoke("ssh:analyze-log", connData, logPath, filters),
  sshDetectNginxLogs: (connData) => electron.ipcRenderer.invoke("ssh:detect-nginx-logs", connData),
  onSshAnalyzeStatus: (callback) => {
    const handler = (_e, status) => callback(status);
    electron.ipcRenderer.on("ssh:analyze-status", handler);
    return () => electron.ipcRenderer.removeListener("ssh:analyze-status", handler);
  },
  sshActiveSessions: () => electron.ipcRenderer.invoke("ssh:active-sessions"),
  onSshData: (callback) => {
    const handler = (_e, connectionId, data) => callback(connectionId, data);
    electron.ipcRenderer.on("ssh:data", handler);
    return () => electron.ipcRenderer.removeListener("ssh:data", handler);
  },
  onSshClosed: (callback) => {
    const handler = (_e, connectionId) => callback(connectionId);
    electron.ipcRenderer.on("ssh:closed", handler);
    return () => electron.ipcRenderer.removeListener("ssh:closed", handler);
  },
  // ── Import / Export Data ─────────────────────────────────────
  exportData: (password) => electron.ipcRenderer.invoke("data:export", password),
  importData: (password) => electron.ipcRenderer.invoke("data:import", password),
  // ── Workspaces ──────────────────────────────────────────────
  listWorkspaces: () => electron.ipcRenderer.invoke("workspaces:list"),
  createWorkspace: (data) => electron.ipcRenderer.invoke("workspaces:create", data),
  updateWorkspace: (id, data) => electron.ipcRenderer.invoke("workspaces:update", id, data),
  deleteWorkspace: (id) => electron.ipcRenderer.invoke("workspaces:delete", id),
  // ── Folders ────────────────────────────────────────────────
  listFolders: () => electron.ipcRenderer.invoke("folders:list"),
  listFoldersByWorkspace: (workspaceId) => electron.ipcRenderer.invoke("folders:list-by-workspace", workspaceId),
  createFolder: (data) => electron.ipcRenderer.invoke("folders:create", data),
  updateFolder: (id, data) => electron.ipcRenderer.invoke("folders:update", id, data),
  deleteFolder: (id) => electron.ipcRenderer.invoke("folders:delete", id),
  // ── Tags ────────────────────────────────────────────────────
  listTags: () => electron.ipcRenderer.invoke("tags:list"),
  createTag: (data) => electron.ipcRenderer.invoke("tags:create", data),
  updateTag: (id, data) => electron.ipcRenderer.invoke("tags:update", id, data),
  deleteTag: (id) => electron.ipcRenderer.invoke("tags:delete", id),
  // ── Settings ────────────────────────────────────────────────
  getSettings: () => electron.ipcRenderer.invoke("settings:get"),
  updateSettings: (data) => electron.ipcRenderer.invoke("settings:update", data),
  // ── SSH Keys ────────────────────────────────────────────────
  listSSHKeys: () => electron.ipcRenderer.invoke("ssh-keys:list"),
  createSSHKey: (data) => electron.ipcRenderer.invoke("ssh-keys:create", data),
  updateSSHKey: (id, data) => electron.ipcRenderer.invoke("ssh-keys:update", id, data),
  deleteSSHKey: (id) => electron.ipcRenderer.invoke("ssh-keys:delete", id),
  // ── File Dialog ─────────────────────────────────────────────
  selectFile: (options) => electron.ipcRenderer.invoke("dialog:select-file", options),
  // ── Events ──────────────────────────────────────────────────
  onLockScreen: (callback) => {
    const handler = () => callback();
    electron.ipcRenderer.on("app:lock-screen", handler);
    return () => electron.ipcRenderer.removeListener("app:lock-screen", handler);
  }
};
electron.contextBridge.exposeInMainWorld("sshTool", api);
