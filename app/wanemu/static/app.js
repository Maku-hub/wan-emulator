"use strict";
// WAN emulator web panel. UI strings live in i18n.js (see t()).

// ---------- Form definition ----------
const DEFAULTS = {
  delay_ms: 0, jitter_ms: 0, jitter_correlation_pct: 0, distribution: "none", keep_order: false,
  loss_mode: "none", loss_pct: 0, loss_correlation_pct: 0, loss_burst_len: 5,
  rate_kbit: 0, limit: 10000,
  reorder_pct: 0, reorder_correlation_pct: 0, duplicate_pct: 0, corrupt_pct: 0,
  mtu: null,
};

// Field label: t("f.<key>"), tooltip: t("f.<key>.info"). Units starting with "unit." are translated.
const SECTIONS = [
  { title: "sec.delay", fields: [
    { key: "delay_ms", unit: "ms", step: 0.1, max: 60000 },
    { key: "jitter_ms", unit: "ms", step: 0.1, max: 60000 },
    { key: "jitter_correlation_pct", unit: "%", step: 0.1, max: 100, show: p => p.jitter_ms > 0 },
    { key: "distribution", type: "select", show: p => p.jitter_ms > 0,
      options: [["none", "opt.none"], ["normal", "opt.normal"], ["pareto", "opt.pareto"], ["paretonormal", "opt.paretonormal"]] },
    { key: "keep_order", type: "checkbox", show: p => p.jitter_ms > 0 },
  ]},
  { title: "sec.loss", fields: [
    { key: "loss_mode", type: "select",
      options: [["none", "opt.loss.none"], ["random", "opt.loss.random"], ["burst", "opt.loss.burst"]] },
    { key: "loss_pct", unit: "%", step: 0.01, max: 100, show: p => p.loss_mode !== "none" },
    { key: "loss_correlation_pct", unit: "%", step: 0.1, max: 100, show: p => p.loss_mode === "random" },
    { key: "loss_burst_len", unit: "unit.packets", step: 0.1, min: 1, max: 10000, show: p => p.loss_mode === "burst" },
  ]},
  { title: "sec.rate", fields: [
    { key: "rate_kbit", unit: "kbit/s", step: 1, max: 100000000 },
    { key: "limit", unit: "unit.packets", step: 1, min: 1, max: 1000000 },
  ]},
  { title: "sec.other", fields: [
    { key: "reorder_pct", unit: "%", step: 0.1, max: 100 },
    { key: "reorder_correlation_pct", unit: "%", step: 0.1, max: 100, show: p => p.reorder_pct > 0 },
    { key: "duplicate_pct", unit: "%", step: 0.01, max: 100 },
    { key: "corrupt_pct", unit: "%", step: 0.01, max: 100 },
    { key: "mtu", unit: "unit.bytes", step: 1, min: 68, max: 9000, nullable: true },
  ]},
];
const FIELDS = SECTIONS.flatMap(s => s.fields);
const DIRS = ["a_to_b", "b_to_a"];

// ---------- State ----------
let currentProfile = null;   // key of the profile loaded into the form
let loadedJson = null;       // loaded profile params (JSON), to detect form edits
let runningProfile = null;   // key of the running profile (null = manual config)
let runningModified = false; // running profile was started with edited params
let appliedJson = null;      // running config (JSON), to detect unapplied changes
let running = false;
let profileList = [];        // [{name, description, translations}]

const $ = id => document.getElementById(id);

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// Key-order independent JSON, used to compare configs
function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

// Profile name / description in the current language ("translations" field, if present)
function profileInfo(name) { return profileList.find(p => p.name === name); }
function displayName(name) {
  const p = profileInfo(name);
  return (p && p.translations && p.translations[LANG] && p.translations[LANG].name) || name;
}
function displayDesc(p) {
  return (p.translations && p.translations[LANG] && p.translations[LANG].description) || p.description || "";
}

// ---------- API ----------
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new Error(errorText(data) || `HTTP ${res.status}`);
  return data;
}

// Server validation messages (English) -> current language; field names -> form labels
function errorText(data) {
  if (!data || !data.detail) return null;
  if (typeof data.detail === "string") return data.detail;
  return data.detail.map(d => {
    const loc = (d.loc || []).filter(x => x !== "body" && x !== "config");
    const where = loc.map(x => DIRS.includes(x) ? x.replace("a_to_b", "A → B").replace("b_to_a", "B → A")
      : I18N.en["f." + x] ? t("f." + x) : x).join(" › ");
    const msg = d.msg.replace(/^Value error, /, "");
    const key = Object.keys(I18N.en).find(k => k.startsWith("err.") && I18N.en[k] === msg);
    return (where ? where + ": " : "") + (key ? t(key) : msg);
  }).join("\n");
}

let toastTimer;
function toast(msg, isError = false) {
  const el = $("toast");
  el.textContent = msg;
  el.className = isError ? "error" : "";
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), isError ? 8000 : 2500);
}

// ---------- Form ----------
function infoIcon(text) {
  return `<span class="info" tabindex="0" data-tip="${esc(text)}" aria-label="${esc(text)}">i</span>`;
}

function buildForm(dir) {
  const form = $("form-" + dir);
  form.innerHTML = "";
  for (const sec of SECTIONS) {
    const fs = document.createElement("fieldset");
    fs.innerHTML = `<legend>${esc(t(sec.title))}</legend>`;
    for (const f of sec.fields) {
      const id = `${dir}-${f.key}`;
      const row = document.createElement("div");
      row.className = "field" + (f.type === "checkbox" ? " checkbox" : "");
      row.dataset.key = f.key;
      const label = `<label for="${id}">${esc(t("f." + f.key))}</label>${infoIcon(t("f." + f.key + ".info"))}`;
      const unit = f.unit && f.unit.startsWith("unit.") ? t(f.unit) : f.unit;
      if (f.type === "checkbox") {
        row.innerHTML = `<input type="checkbox" id="${id}" name="${f.key}"><span class="name">${label}</span>`;
      } else if (f.type === "select") {
        const opts = f.options.map(([v, l]) => `<option value="${v}">${esc(t(l))}</option>`).join("");
        row.innerHTML = `<span class="name">${label}</span><select id="${id}" name="${f.key}">${opts}</select><span></span>`;
      } else {
        row.innerHTML = `<span class="name">${label}</span>` +
          `<input type="number" id="${id}" name="${f.key}" step="${f.step}" min="${f.min ?? 0}" max="${f.max}"` +
          `${f.nullable ? ` placeholder="${esc(t("field.default"))}"` : ""}>` +
          `<span class="unit">${esc(unit)}</span>`;
      }
      fs.appendChild(row);
    }
    form.appendChild(fs);
  }
}

function readDir(dir) {
  const form = $("form-" + dir);
  const p = {};
  for (const f of FIELDS) {
    const el = form.elements[f.key];
    if (f.type === "checkbox") p[f.key] = el.checked;
    else if (f.type === "select") p[f.key] = el.value;
    else if (el.value === "") p[f.key] = f.nullable ? null : 0;
    else p[f.key] = Number(el.value);
  }
  return p;
}

function writeDir(dir, params) {
  const form = $("form-" + dir);
  const p = { ...DEFAULTS, ...(params || {}) };
  for (const f of FIELDS) {
    const el = form.elements[f.key];
    if (f.type === "checkbox") el.checked = !!p[f.key];
    else el.value = p[f.key] ?? "";
  }
  updateVisibility(dir);
}

function updateVisibility(dir) {
  const p = readDir(dir);
  for (const row of $("form-" + dir).querySelectorAll(".field")) {
    const f = FIELDS.find(x => x.key === row.dataset.key);
    row.hidden = f.show ? !f.show(p) : false;
  }
}

function readConfig() {
  const a = readDir("a_to_b");
  return { a_to_b: a, b_to_a: $("symmetric").checked ? { ...a } : readDir("b_to_a") };
}

function writeConfig(cfg) {
  writeDir("a_to_b", cfg.a_to_b);
  writeDir("b_to_a", cfg.b_to_a);
  $("symmetric").checked = canon(cfg.a_to_b) === canon(cfg.b_to_a);
  applySymmetric();
}

function applySymmetric() {
  const sym = $("symmetric").checked;
  $("dir-b_to_a").classList.toggle("disabled", sym);
  if (sym) writeDir("b_to_a", readDir("a_to_b"));
}

function onFormChange(dir) {
  updateVisibility(dir);
  if (dir === "a_to_b" && $("symmetric").checked) writeDir("b_to_a", readDir("a_to_b"));
  schedulePreview();
  renderState();
}

// ---------- tc command preview ----------
let previewTimer;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    try {
      const r = await api("POST", "/api/preview", readConfig());
      $("preview").textContent = r.commands.join("\n");
    } catch (e) {
      $("preview").textContent = t("preview.error", { msg: e.message });
    }
  }, 250);
}

// ---------- Start / Stop ----------
async function start() {
  try {
    const cfg = readConfig();
    // Send the profile name only if the form came from a profile; flag edited params
    const modified = !!currentProfile && canon(cfg) !== loadedJson;
    const st = await api("POST", "/api/start", { config: cfg, profile: currentProfile, modified });
    applyStatus(st);
    toast(t("toast.started"));
  } catch (e) { toast(e.message, true); }
}

async function stop() {
  try {
    applyStatus(await api("POST", "/api/stop"));
    toast(t("toast.stopped"));
  } catch (e) { toast(e.message, true); }
}

function applyStatus(st) {
  running = st.running;
  appliedJson = st.running && st.config ? canon(st.config) : null;
  const prev = runningProfile + "|" + runningModified;
  runningProfile = st.running ? (st.profile || null) : null;
  runningModified = st.running && !!st.modified;
  if (prev !== runningProfile + "|" + runningModified) renderProfiles();
  $("lbl-a_to_b").textContent = `(${st.iface_a} → ${st.iface_b})`;
  $("lbl-b_to_a").textContent = `(${st.iface_b} → ${st.iface_a})`;
  if (st.version) $("version").textContent = "v" + st.version;
  renderState();
}

function runningLabel() {
  if (!runningProfile) return t("status.manual");
  const name = displayName(runningProfile);
  return runningModified ? t("status.modified", { name }) : name;
}

function renderState() {
  const dirty = running && appliedJson !== null && appliedJson !== canon(readConfig());
  const b = $("status");
  b.className = "badge " + (running ? "running" : "stopped") + (dirty ? " dirty" : "");
  b.textContent = running
    ? t("status.running", { profile: runningLabel() }) + (dirty ? t("status.dirty") : "")
    : t("status.stopped");
  b.title = b.textContent;
  $("btn-start").textContent = running ? t("btn.apply") : t("btn.start");
  $("btn-start").disabled = running && !dirty;
  $("btn-stop").disabled = !running;
}

// ---------- Profile ----------
async function loadProfiles() {
  try {
    profileList = await api("GET", "/api/profiles");
  } catch (e) { toast(e.message, true); }
  renderProfiles();
  renderState();
}

function renderProfiles() {
  const ul = $("profiles");
  ul.innerHTML = "";
  for (const p of profileList) {
    const li = document.createElement("li");
    const isRunning = runningProfile === p.name;
    li.className = (p.name === currentProfile ? "selected" : "") + (isRunning ? " running" : "");
    li.innerHTML = `<span class="pname"></span><span class="desc"></span>`;
    li.firstChild.textContent = displayName(p.name);
    if (isRunning) li.firstChild.insertAdjacentHTML("afterend",
      `<span class="run-tag">${esc(t(runningModified ? "profiles.runningModified" : "profiles.running"))}</span>`);
    li.lastChild.textContent = displayDesc(p);
    li.title = t("profiles.clickToLoad");
    li.onclick = () => openProfile(p.name);
    ul.appendChild(li);
  }
  $("current-profile").textContent = currentProfile ? displayName(currentProfile) : "—";
}

async function openProfile(name) {
  try {
    const p = await api("GET", "/api/profiles/" + encodeURIComponent(name));
    writeConfig(p);
    setCurrentProfile(p.name);
    loadedJson = canon(readConfig());
    schedulePreview();
    renderState();
    toast(t("toast.loaded", { name: displayName(p.name), button: running ? t("btn.apply") : t("btn.start") }));
  } catch (e) { toast(e.message, true); }
}

function setCurrentProfile(name) {
  if (name !== currentProfile) loadedJson = null;
  currentProfile = name;
  $("btn-save").disabled = !name;
  $("btn-delete").disabled = !name;
  renderProfiles();
}

async function saveProfile(name, description, translations) {
  const body = { name, description, translations: translations || {}, ...readConfig() };
  await api("PUT", "/api/profiles/" + encodeURIComponent(name), body);
  await loadProfiles();
  setCurrentProfile(name);
  loadedJson = canon(readConfig());
  toast(t("toast.saved", { name: displayName(name) }));
}

async function onSave() {
  if (!currentProfile) return onSaveAs();
  try {
    const old = await api("GET", "/api/profiles/" + encodeURIComponent(currentProfile));
    await saveProfile(currentProfile, old.description, old.translations);
  } catch (e) { toast(e.message, true); }
}

async function onSaveAs() {
  const suggested = currentProfile ? t("prompt.copy", { name: displayName(currentProfile) }) : "";
  const name = prompt(t("prompt.name"), suggested);
  if (!name || !name.trim()) return;
  const description = prompt(t("prompt.description"), "") || "";
  try {
    const exists = (await api("GET", "/api/profiles")).some(p => p.name === name.trim());
    if (exists && !confirm(t("confirm.overwrite", { name: name.trim() }))) return;
    await saveProfile(name.trim(), description, {});
  } catch (e) { toast(e.message, true); }
}

async function onDelete() {
  if (!currentProfile) return;
  const shown = displayName(currentProfile);
  if (!confirm(t("confirm.delete", { name: shown }))) return;
  try {
    await api("DELETE", "/api/profiles/" + encodeURIComponent(currentProfile));
    toast(t("toast.deleted", { name: shown }));
    setCurrentProfile(null);
    await loadProfiles();
  } catch (e) { toast(e.message, true); }
}

// ---------- Live statistics ----------
const HISTORY = 120;
const history = { a_to_b: [], b_to_a: [] };
let lastStats = null;

function fmtRate(bps) {
  if (bps >= 1e6) return (bps / 1e6).toFixed(2) + " Mbit/s";
  if (bps >= 1e3) return (bps / 1e3).toFixed(1) + " kbit/s";
  return Math.round(bps) + " bit/s";
}

async function pollStats() {
  try {
    const s = await api("GET", "/api/stats");
    if (s.running !== running) applyStatus(await api("GET", "/api/status"));
    for (const dir of DIRS) {
      const d = s[dir];
      let bps = 0, pps = 0;
      if (lastStats) {
        const prev = lastStats[dir].iface, dt = s.time - lastStats.time;
        if (dt > 0 && prev.tx_bytes != null && d.iface.tx_bytes != null) {
          bps = Math.max(0, (d.iface.tx_bytes - prev.tx_bytes) * 8 / dt);
          pps = Math.max(0, (d.iface.tx_packets - prev.tx_packets) / dt);
        }
      }
      history[dir].push(bps);
      if (history[dir].length > HISTORY) history[dir].shift();
      drawChart(dir);
      const link = !d.iface.exists ? t("live.noIface")
        : d.iface.carrier ? t("live.link", { speed: d.iface.speed > 0 ? d.iface.speed + " Mbit/s" : "UP" }) : t("live.noLink");
      const n = d.netem;
      $("live-" + dir).innerHTML =
        `<b>${fmtRate(bps)}</b><br>${Math.round(pps)} ${esc(t("live.pps"))}<br>` +
        `${esc(d.iface.name)}: ${esc(link)}, MTU ${d.iface.mtu ?? "?"}<br>` +
        esc(n ? t("live.drops", { drops: n.drops, qlen: n.qlen ?? 0 }) : t("live.off"));
    }
    lastStats = s;
  } catch { /* server temporarily unavailable */ }
}

function drawChart(dir) {
  const c = $("chart-" + dir);
  const w = c.width = c.clientWidth * devicePixelRatio;
  const h = c.height = c.clientHeight * devicePixelRatio;
  const ctx = c.getContext("2d");
  const data = history[dir];
  const max = Math.max(1000, ...data) * 1.1;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--chart");
  ctx.lineWidth = 1.5 * devicePixelRatio;
  ctx.beginPath();
  data.forEach((v, i) => {
    const x = w - (data.length - 1 - i) * (w / (HISTORY - 1));
    const y = h - (v / max) * h;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
}

// ---------- Language ----------
function applyLanguage() {
  const cfg = readConfig();
  const sym = $("symmetric").checked;
  DIRS.forEach(buildForm);
  writeConfig(cfg);
  $("symmetric").checked = sym;
  applySymmetric();
  translateStatic();
  document.title = t("app.title");
  document.querySelectorAll("[data-lang]").forEach(b => b.classList.toggle("active", b.dataset.lang === LANG));
  renderProfiles();
  renderState();
  schedulePreview();
  pollStats();
}

// ---------- Init ----------
async function init() {
  DIRS.forEach(dir => {
    buildForm(dir);
    $("form-" + dir).addEventListener("input", () => onFormChange(dir));
    $("form-" + dir).addEventListener("change", () => onFormChange(dir));
  });
  DIRS.forEach(d => writeDir(d, DEFAULTS));
  $("symmetric").addEventListener("change", () => { applySymmetric(); schedulePreview(); renderState(); });
  $("btn-start").onclick = start;
  $("btn-stop").onclick = stop;
  $("btn-save").onclick = onSave;
  $("btn-save-as").onclick = onSaveAs;
  $("btn-delete").onclick = onDelete;
  $("btn-reset").onclick = () => { writeConfig({ a_to_b: DEFAULTS, b_to_a: DEFAULTS }); setCurrentProfile(null); schedulePreview(); renderState(); };
  document.querySelectorAll("[data-lang]").forEach(b => (b.onclick = () => { setLang(b.dataset.lang); applyLanguage(); }));
  applyLanguage();

  await loadProfiles();
  try {
    const st = await api("GET", "/api/status");
    if (st.running && st.config) writeConfig(st.config);
    applyStatus(st);
    const base = st.running && st.profile && profileInfo(st.profile) ? st.profile : null;
    setCurrentProfile(base);
    if (base) {
      const p = await api("GET", "/api/profiles/" + encodeURIComponent(base));
      loadedJson = canon({ a_to_b: p.a_to_b, b_to_a: p.b_to_a });
    }
  } catch (e) { toast(e.message, true); }

  schedulePreview();
  pollStats();
  setInterval(pollStats, 1000);
}

init();
