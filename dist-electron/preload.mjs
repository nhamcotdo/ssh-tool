"use strict";
const electron = require("electron");
const api = {
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
  selectFile: (options) => electron.ipcRenderer.invoke("dialog:select-file", options)
};
electron.contextBridge.exposeInMainWorld("sshTool", api);
