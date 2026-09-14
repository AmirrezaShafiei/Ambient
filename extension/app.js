const storage = chrome.storage.local;
const sessionStorageArea = chrome.storage.session || chrome.storage.local;
const TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
const TASKS_API = "https://tasks.googleapis.com/tasks/v1";

const DEFAULTS = {
  themeMode: "auto",
  searchEngine: "google",
  primaryColor: "#6f87d8",
  accentColor: "#8d7cf6",
  glassIntensity: 68,
  backgroundDim: 28,
  backgroundImage: "",
  googleClientId: "",
  selectedTaskListId: "",
  notes: "",
  taskFilter: "today",
  shortcuts: [
    { id: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com" },
    { id: "gmail", name: "Gmail", url: "https://mail.google.com" },
    { id: "github", name: "GitHub", url: "https://github.com" },
    { id: "drive", name: "Drive", url: "https://drive.google.com" }
  ]
};

let state = structuredClone(DEFAULTS);
let taskLists = [];
let tasks = [];
let notesTimer;

const $ = (id) => document.getElementById(id);
const els = {
  background: $("background"),
  clockText: $("clockText"),
  dateText: $("dateText"),
  searchForm: $("searchForm"),
  searchInput: $("searchInput"),
  shortcuts: $("shortcuts"),
  addShortcutButton: $("addShortcutButton"),
  notes: $("notes"),
  notesSaved: $("notesSaved"),
  settingsButton: $("settingsButton"),
  settingsDialog: $("settingsDialog"),
  settingsForm: $("settingsForm"),
  closeSettingsButton: $("closeSettingsButton"),
  themeMode: $("themeMode"),
  searchEngine: $("searchEngine"),
  primaryColor: $("primaryColor"),
  accentColor: $("accentColor"),
  glassIntensity: $("glassIntensity"),
  backgroundDim: $("backgroundDim"),
  backgroundFile: $("backgroundFile"),
  clearBackgroundButton: $("clearBackgroundButton"),
  googleClientId: $("googleClientId"),
  redirectUri: $("redirectUri"),
  copyRedirectButton: $("copyRedirectButton"),
  resetSettingsButton: $("resetSettingsButton"),
  shortcutSettings: $("shortcutSettings"),
  connectTasksButton: $("connectTasksButton"),
  refreshTasksButton: $("refreshTasksButton"),
  taskListSelect: $("taskListSelect"),
  taskStatus: $("taskStatus"),
  taskList: $("taskList"),
  addTaskForm: $("addTaskForm"),
  newTaskInput: $("newTaskInput")
};

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value.length === 3 ? value.split("").map((x) => x + x).join("") : value, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function applyTheme() {
  const mode = state.themeMode === "auto"
    ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : state.themeMode;
  document.body.classList.toggle("light", mode === "light");
  document.documentElement.style.setProperty("--primary", state.primaryColor);
  document.documentElement.style.setProperty("--accent", state.accentColor);
  document.documentElement.style.setProperty("--primary-rgb", hexToRgb(state.primaryColor));
  document.documentElement.style.setProperty("--accent-rgb", hexToRgb(state.accentColor));
  document.documentElement.style.setProperty("--glass-alpha", String(Number(state.glassIntensity) / 100));
  document.documentElement.style.setProperty("--dim", String(Number(state.backgroundDim) / 100));
  if (state.backgroundImage) {
    els.background.style.backgroundImage = `url("${state.backgroundImage.replaceAll('"', '%22')}")`;
  } else {
    els.background.style.backgroundImage = "";
  }
}

function updateClock() {
  const now = new Date();
  els.clockText.textContent = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(now);
  els.dateText.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(now);
}

function searchUrl(query) {
  const q = encodeURIComponent(query);
  if (state.searchEngine === "bing") return `https://www.bing.com/search?q=${q}`;
  if (state.searchEngine === "duckduckgo") return `https://duckduckgo.com/?q=${q}`;
  return `https://www.google.com/search?q=${q}`;
}

function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try { return new URL(trimmed).href; } catch {}
  try { return new URL(`https://${trimmed}`).href; } catch { return ""; }
}

function shortcutLetter(name) {
  return name.trim().slice(0, 1).toUpperCase() || "•";
}

function renderShortcuts() {
  els.shortcuts.replaceChildren();
  for (const item of state.shortcuts) {
    const a = document.createElement("a");
    a.className = "shortcut";
    a.href = item.url;
    a.title = `${item.name} · right-click to remove`;
    const icon = document.createElement("span");
    icon.className = "shortcut-icon";
    icon.textContent = shortcutLetter(item.name);
    const name = document.createElement("span");
    name.textContent = item.name;
    a.append(icon, name);
    a.addEventListener("contextmenu", async (event) => {
      event.preventDefault();
      if (!confirm(`Remove ${item.name} from shortcuts?`)) return;
      state.shortcuts = state.shortcuts.filter((x) => x.id !== item.id);
      await storage.set({ shortcuts: state.shortcuts });
      renderShortcuts();
      renderShortcutSettings();
    });
    els.shortcuts.append(a);
  }
  renderShortcutSettings();
}

function renderShortcutSettings() {
  els.shortcutSettings.replaceChildren();
  if (!state.shortcuts.length) {
    const empty = document.createElement("span");
    empty.className = "hint";
    empty.textContent = "No shortcuts yet.";
    els.shortcutSettings.append(empty);
    return;
  }
  for (const item of state.shortcuts) {
    const chip = document.createElement("span");
    chip.className = "shortcut-chip";
    chip.append(document.createTextNode(item.name));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = `Remove ${item.name}`;
    remove.addEventListener("click", async () => {
      state.shortcuts = state.shortcuts.filter((x) => x.id !== item.id);
      await storage.set({ shortcuts: state.shortcuts });
      renderShortcuts();
    });
    chip.append(remove);
    els.shortcutSettings.append(chip);
  }
}

async function addShortcut() {
  const name = prompt("Shortcut name:");
  if (!name?.trim()) return;
  const url = normalizeUrl(prompt("Shortcut URL:") || "");
  if (!url) return alert("That URL does not look valid.");
  state.shortcuts.push({ id: crypto.randomUUID(), name: name.trim().slice(0, 32), url });
  await storage.set({ shortcuts: state.shortcuts });
  renderShortcuts();
}

function populateSettings() {
  els.themeMode.value = state.themeMode;
  els.searchEngine.value = state.searchEngine;
  els.primaryColor.value = state.primaryColor;
  els.accentColor.value = state.accentColor;
  els.glassIntensity.value = state.glassIntensity;
  els.backgroundDim.value = state.backgroundDim;
  els.googleClientId.value = state.googleClientId;
  els.redirectUri.value = chrome.identity.getRedirectURL("google");
  renderShortcutSettings();
}

async function saveSettings() {
  Object.assign(state, {
    themeMode: els.themeMode.value,
    searchEngine: els.searchEngine.value,
    primaryColor: els.primaryColor.value,
    accentColor: els.accentColor.value,
    glassIntensity: Number(els.glassIntensity.value),
    backgroundDim: Number(els.backgroundDim.value),
    googleClientId: els.googleClientId.value.trim()
  });
  await storage.set({
    themeMode: state.themeMode,
    searchEngine: state.searchEngine,
    primaryColor: state.primaryColor,
    accentColor: state.accentColor,
    glassIntensity: state.glassIntensity,
    backgroundDim: state.backgroundDim,
    googleClientId: state.googleClientId
  });
  applyTheme();
}

async function setBackgroundFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return alert("Choose an image file.");
  if (file.size > 4 * 1024 * 1024) return alert("Please use an image smaller than 4 MB.");
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  state.backgroundImage = dataUrl;
  await storage.set({ backgroundImage: dataUrl });
  applyTheme();
}

async function clearBackground() {
  state.backgroundImage = "";
  await storage.set({ backgroundImage: "" });
  els.backgroundFile.value = "";
  applyTheme();
}

async function clearGoogleSession() {
  await sessionStorageArea.remove(["googleAccessToken", "googleTokenExpiresAt"]);
}

async function getGoogleToken(interactive = false) {
  const cached = await sessionStorageArea.get(["googleAccessToken", "googleTokenExpiresAt"]);
  if (cached.googleAccessToken && Number(cached.googleTokenExpiresAt) > Date.now() + 60_000) {
    return cached.googleAccessToken;
  }
  if (!interactive) return "";
  if (!state.googleClientId) throw new Error("Add your Google OAuth Client ID in Settings first.");

  const redirectUri = chrome.identity.getRedirectURL("google");
  const authState = crypto.randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", state.googleClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "token");
  url.searchParams.set("scope", TASKS_SCOPE);
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", authState);
  url.searchParams.set("prompt", "select_account");

  const resultUrl = await chrome.identity.launchWebAuthFlow({ url: url.toString(), interactive: true });
  if (!resultUrl) throw new Error("Google sign-in was cancelled.");
  const parsed = new URL(resultUrl);
  const params = new URLSearchParams(parsed.hash.slice(1));
  if (params.get("state") !== authState) throw new Error("Google sign-in returned an invalid state.");
  if (params.get("error")) throw new Error(params.get("error_description") || params.get("error"));
  const token = params.get("access_token");
  if (!token) throw new Error("Google did not return an access token.");
  const expiresIn = Number(params.get("expires_in") || 3600);
  await sessionStorageArea.set({ googleAccessToken: token, googleTokenExpiresAt: Date.now() + expiresIn * 1000 });
  return token;
}

async function tasksFetch(path, options = {}) {
  const token = await getGoogleToken(false);
  if (!token) throw new Error("REAUTH_REQUIRED");
  const response = await fetch(`${TASKS_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
  if (response.status === 401) {
    await clearGoogleSession();
    throw new Error("REAUTH_REQUIRED");
  }
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try { detail = (await response.json())?.error?.message || detail; } catch {}
    throw new Error(detail);
  }
  if (response.status === 204) return null;
  return response.json();
}

function setTaskUiConnected(connected) {
  els.connectTasksButton.textContent = connected ? "Reconnect" : "Connect";
  els.refreshTasksButton.hidden = !connected;
  els.taskListSelect.hidden = !connected || taskLists.length < 2;
  els.addTaskForm.hidden = !connected;
}

function setTaskMessage(message) {
  els.taskStatus.textContent = message;
  els.taskStatus.hidden = false;
  els.taskList.hidden = true;
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function taskDueKey(task) {
  return task.due ? task.due.slice(0, 10) : "";
}

function filteredTasks() {
  const today = localDateKey();
  return tasks
    .filter((task) => !task.deleted && !task.hidden)
    .filter((task) => {
      const due = taskDueKey(task);
      if (state.taskFilter === "upcoming") return due && due > today && task.status !== "completed";
      return (!due || due <= today) && task.status !== "completed";
    })
    .sort((a, b) => {
      const aDue = taskDueKey(a) || "9999-12-31";
      const bDue = taskDueKey(b) || "9999-12-31";
      return aDue.localeCompare(bDue) || String(a.position || "").localeCompare(String(b.position || ""));
    });
}

function formatDue(task) {
  const key = taskDueKey(task);
  if (!key) return "";
  const date = new Date(`${key}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function renderTasks() {
  const visible = filteredTasks();
  els.taskList.replaceChildren();
  if (!visible.length) {
    setTaskMessage(state.taskFilter === "today" ? "Nothing pressing. Enjoy the space." : "No upcoming tasks with a due date.");
    return;
  }
  els.taskStatus.hidden = true;
  els.taskList.hidden = false;

  for (const task of visible) {
    const row = document.createElement("div");
    row.className = `task-row${task.status === "completed" ? " completed" : ""}`;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = task.status === "completed";
    check.ariaLabel = `Complete ${task.title}`;
    check.addEventListener("change", () => toggleTask(task, check.checked));

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title || "Untitled task";
    title.title = task.title || "Untitled task";

    const due = document.createElement("span");
    due.className = "task-due";
    due.textContent = formatDue(task);

    const edit = document.createElement("button");
    edit.className = "task-action";
    edit.type = "button";
    edit.textContent = "✎";
    edit.title = "Edit task";
    edit.addEventListener("click", () => editTask(task));

    const remove = document.createElement("button");
    remove.className = "task-action";
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Delete task";
    remove.addEventListener("click", () => deleteTask(task));

    row.append(check, title, due, edit, remove);
    els.taskList.append(row);
  }
}

async function loadTaskLists() {
  const data = await tasksFetch("/users/@me/lists?maxResults=100");
  taskLists = data.items || [];
  if (!taskLists.length) throw new Error("No Google task lists were found.");
  if (!taskLists.some((list) => list.id === state.selectedTaskListId)) {
    state.selectedTaskListId = taskLists[0].id;
    await storage.set({ selectedTaskListId: state.selectedTaskListId });
  }
  els.taskListSelect.replaceChildren();
  for (const list of taskLists) {
    const option = document.createElement("option");
    option.value = list.id;
    option.textContent = list.title;
    els.taskListSelect.append(option);
  }
  els.taskListSelect.value = state.selectedTaskListId;
}

async function loadTasks({ interactive = false } = {}) {
  try {
    if (interactive) await getGoogleToken(true);
    const token = await getGoogleToken(false);
    if (!token) {
      setTaskUiConnected(false);
      setTaskMessage("Connect Google Tasks to see and manage your list here.");
      return;
    }
    setTaskMessage("Loading tasks…");
    await loadTaskLists();
    const data = await tasksFetch(`/lists/${encodeURIComponent(state.selectedTaskListId)}/tasks?maxResults=100&showCompleted=true&showHidden=false`);
    tasks = data.items || [];
    setTaskUiConnected(true);
    renderTasks();
  } catch (error) {
    if (error.message === "REAUTH_REQUIRED") {
      setTaskUiConnected(false);
      setTaskMessage("Google session expired. Reconnect to refresh your tasks.");
      return;
    }
    setTaskUiConnected(false);
    setTaskMessage(error.message || "Could not load Google Tasks.");
  }
}

async function addTask(title) {
  const clean = title.trim();
  if (!clean || !state.selectedTaskListId) return;
  try {
    await tasksFetch(`/lists/${encodeURIComponent(state.selectedTaskListId)}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title: clean })
    });
    els.newTaskInput.value = "";
    await loadTasks();
  } catch (error) { setTaskMessage(error.message); }
}

async function toggleTask(task, completed) {
  try {
    await tasksFetch(`/lists/${encodeURIComponent(state.selectedTaskListId)}/tasks/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: completed ? "completed" : "needsAction" })
    });
    await loadTasks();
  } catch (error) { setTaskMessage(error.message); }
}

async function editTask(task) {
  const next = prompt("Edit task:", task.title || "");
  if (next === null || !next.trim() || next.trim() === task.title) return;
  try {
    await tasksFetch(`/lists/${encodeURIComponent(state.selectedTaskListId)}/tasks/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ title: next.trim() })
    });
    await loadTasks();
  } catch (error) { setTaskMessage(error.message); }
}

async function deleteTask(task) {
  if (!confirm(`Delete “${task.title || "Untitled task"}”?`)) return;
  try {
    await tasksFetch(`/lists/${encodeURIComponent(state.selectedTaskListId)}/tasks/${encodeURIComponent(task.id)}`, { method: "DELETE" });
    await loadTasks();
  } catch (error) { setTaskMessage(error.message); }
}

function bindEvents() {
  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = els.searchInput.value.trim();
    if (query) location.href = searchUrl(query);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
      event.preventDefault(); els.searchInput.focus();
    }
    if (event.key === "Escape" && els.settingsDialog.open) els.settingsDialog.close();
  });
  els.addShortcutButton.addEventListener("click", addShortcut);
  els.settingsButton.addEventListener("click", () => { populateSettings(); els.settingsDialog.showModal(); });
  els.closeSettingsButton.addEventListener("click", () => els.settingsDialog.close());
  els.settingsForm.addEventListener("submit", async (event) => { event.preventDefault(); await saveSettings(); els.settingsDialog.close(); await loadTasks(); });
  els.primaryColor.addEventListener("input", () => { state.primaryColor = els.primaryColor.value; applyTheme(); });
  els.accentColor.addEventListener("input", () => { state.accentColor = els.accentColor.value; applyTheme(); });
  els.glassIntensity.addEventListener("input", () => { state.glassIntensity = Number(els.glassIntensity.value); applyTheme(); });
  els.backgroundDim.addEventListener("input", () => { state.backgroundDim = Number(els.backgroundDim.value); applyTheme(); });
  els.themeMode.addEventListener("change", () => { state.themeMode = els.themeMode.value; applyTheme(); });
  els.backgroundFile.addEventListener("change", () => setBackgroundFile(els.backgroundFile.files?.[0]));
  els.clearBackgroundButton.addEventListener("click", clearBackground);
  els.copyRedirectButton.addEventListener("click", async () => { await navigator.clipboard.writeText(els.redirectUri.value); els.copyRedirectButton.textContent = "Copied"; setTimeout(() => els.copyRedirectButton.textContent = "Copy", 1200); });
  els.resetSettingsButton.addEventListener("click", () => {
    Object.assign(state, {
      themeMode: DEFAULTS.themeMode,
      primaryColor: DEFAULTS.primaryColor,
      accentColor: DEFAULTS.accentColor,
      glassIntensity: DEFAULTS.glassIntensity,
      backgroundDim: DEFAULTS.backgroundDim
    });
    populateSettings(); applyTheme();
  });
  els.notes.addEventListener("input", () => {
    els.notesSaved.textContent = "Saving…";
    clearTimeout(notesTimer);
    notesTimer = setTimeout(async () => {
      state.notes = els.notes.value;
      await storage.set({ notes: state.notes });
      els.notesSaved.textContent = "Saved locally";
    }, 350);
  });
  els.connectTasksButton.addEventListener("click", async () => {
    try { await getGoogleToken(true); await loadTasks(); }
    catch (error) { setTaskMessage(error.message || "Could not connect Google Tasks."); }
  });
  els.refreshTasksButton.addEventListener("click", () => loadTasks());
  els.taskListSelect.addEventListener("change", async () => {
    state.selectedTaskListId = els.taskListSelect.value;
    await storage.set({ selectedTaskListId: state.selectedTaskListId });
    await loadTasks();
  });
  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", async () => {
    state.taskFilter = tab.dataset.filter;
    await storage.set({ taskFilter: state.taskFilter });
    document.querySelectorAll(".tab").forEach((x) => {
      const active = x === tab;
      x.classList.toggle("active", active);
      x.setAttribute("aria-selected", String(active));
    });
    renderTasks();
  }));
  els.addTaskForm.addEventListener("submit", async (event) => { event.preventDefault(); await addTask(els.newTaskInput.value); });
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => { if (state.themeMode === "auto") applyTheme(); });
}

async function init() {
  const saved = await storage.get(Object.keys(DEFAULTS));
  state = { ...structuredClone(DEFAULTS), ...saved };
  if (!Array.isArray(state.shortcuts)) state.shortcuts = structuredClone(DEFAULTS.shortcuts);
  applyTheme();
  updateClock();
  setInterval(updateClock, 15_000);
  els.notes.value = state.notes || "";
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.filter === state.taskFilter;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  renderShortcuts();
  bindEvents();
  populateSettings();
  await loadTasks();
}

init();
