const storage = chrome.storage.local;
const sessionStore = chrome.storage.session || chrome.storage.local;
const SCHEMA_VERSION = 2;

const DEFAULTS = {
  schemaVersion: SCHEMA_VERSION,
  themeMode: 'light',
  searchEngine: 'google',
  primaryColor: '#dfe8ff',
  accentColor: '#6f72e8',
  glassIntensity: 72,
  backgroundDim: 16,
  backgroundImage: '',
  googleClientId: '',
  selectedTaskListId: '',
  taskFilter: 'today',
  notes: '',
  mix: { rain:70, wind:30, cafe:50, thunder:20, forest:25, white:15 },
  currentPreset: 'rainy',
  timerMinutes: 25
};

let state = structuredClone(DEFAULTS);
let notesTimer;
const $ = id => document.getElementById(id);

const els = {
  pageBg: $('pageBg'), clockText: $('clockText'), dateText: $('dateText'),
  searchForm: $('searchForm'), searchInput: $('searchInput'),
  soundGrid: $('soundGrid'), presetGrid: $('presetGrid'), mainPlay: $('mainPlay'),
  resetMix: $('resetMix'), prevPreset: $('prevPreset'), nextPreset: $('nextPreset'),
  favoritePreset: $('favoritePreset'), sceneTitle: $('sceneTitle'), sceneSubtitle: $('sceneSubtitle'),
  syncState: $('syncState'), taskStatus: $('taskStatus'), taskList: $('taskList'),
  taskListSelect: $('taskListSelect'), addTaskForm: $('addTaskForm'), newTaskInput: $('newTaskInput'),
  connectTasksButton: $('connectTasksButton'), timerText: $('timerText'), timerStart: $('timerStart'),
  timerReset: $('timerReset'), notes: $('notes'), notesSaved: $('notesSaved'),
  settingsButton: $('settingsButton'), settingsNav: $('settingsNav'), settingsDialog: $('settingsDialog'),
  settingsForm: $('settingsForm'), closeSettingsButton: $('closeSettingsButton'), themeMode: $('themeMode'),
  searchEngine: $('searchEngine'), primaryColor: $('primaryColor'), accentColor: $('accentColor'),
  glassIntensity: $('glassIntensity'), backgroundDim: $('backgroundDim'), backgroundFile: $('backgroundFile'),
  clearBackgroundButton: $('clearBackgroundButton'), googleClientId: $('googleClientId'),
  redirectUri: $('redirectUri'), copyRedirectButton: $('copyRedirectButton'), testGoogleButton: $('testGoogleButton'),
  disconnectGoogleButton: $('disconnectGoogleButton'), googleSetupHint: $('googleSetupHint'),
  googleSetupSection: $('googleSetupSection'), resetSettingsButton: $('resetSettingsButton')
};

function hexToRgb(hex) {
  const v = hex.replace('#','');
  const n = parseInt(v.length === 3 ? v.split('').map(x=>x+x).join('') : v, 16);
  return `${(n>>16)&255}, ${(n>>8)&255}, ${n&255}`;
}

function applyTheme() {
  const mode = state.themeMode === 'auto'
    ? (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light')
    : state.themeMode;
  document.body.classList.toggle('dark', mode === 'dark');
  document.documentElement.style.setProperty('--primary', state.primaryColor);
  document.documentElement.style.setProperty('--accent', state.accentColor);
  document.documentElement.style.setProperty('--primary-rgb', hexToRgb(state.primaryColor));
  document.documentElement.style.setProperty('--accent-rgb', hexToRgb(state.accentColor));
  document.documentElement.style.setProperty('--glass-alpha', String(Number(state.glassIntensity)/100));
  document.documentElement.style.setProperty('--dim', String(Number(state.backgroundDim)/100));
  els.pageBg.style.backgroundImage = state.backgroundImage
    ? `url("${state.backgroundImage.replaceAll('"','%22')}")` : '';
  els.pageBg.style.backgroundSize = 'cover';
  els.pageBg.style.backgroundPosition = 'center';
}

function updateClock() {
  const now = new Date();
  els.clockText.textContent = new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(now);
  els.dateText.textContent = new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(now);
}

function searchUrl(q) {
  const value = encodeURIComponent(q);
  if (state.searchEngine === 'bing') return `https://www.bing.com/search?q=${value}`;
  if (state.searchEngine === 'duckduckgo') return `https://duckduckgo.com/?q=${value}`;
  return `https://www.google.com/search?q=${value}`;
}

function populateSettings() {
  els.themeMode.value = state.themeMode;
  els.searchEngine.value = state.searchEngine;
  els.primaryColor.value = state.primaryColor;
  els.accentColor.value = state.accentColor;
  els.glassIntensity.value = state.glassIntensity;
  els.backgroundDim.value = state.backgroundDim;
  els.googleClientId.value = state.googleClientId;
  els.redirectUri.value = chrome.identity.getRedirectURL('google');
}

function openSettings(scrollGoogle=false) {
  populateSettings();
  els.settingsDialog.showModal();
  if (scrollGoogle) setTimeout(()=>els.googleSetupSection.scrollIntoView({behavior:'smooth',block:'center'}),60);
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
    themeMode: state.themeMode, searchEngine: state.searchEngine,
    primaryColor: state.primaryColor, accentColor: state.accentColor,
    glassIntensity: state.glassIntensity, backgroundDim: state.backgroundDim,
    googleClientId: state.googleClientId
  });
  applyTheme();
}

async function setBackground(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) return alert('Choose an image file.');
  if (file.size > 4*1024*1024) return alert('Please use an image smaller than 4 MB.');
  const data = await new Promise((resolve,reject)=>{
    const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file);
  });
  state.backgroundImage = data;
  await storage.set({backgroundImage:data});
  applyTheme();
}
