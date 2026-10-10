const DAYS = 7;
const HOVER_DELAY = 700; // ms før navneboksen vises

const state = {
  eventName: "Team meeting",
  weekStart: "",
  startHour: 9,
  endHour: 18,
  participants: {},
  currentParticipant: "",
};

const IS_HOST = new URLSearchParams(window.location.search).has("host");
const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const LOCAL_STORAGE_KEY = "when3meet.currentParticipant";
const STATE_KEY = "when3meet.state";
const SHORTEN_KEY = "when3meet.shorten";

const weekStartInput = document.getElementById("weekStart");
const startHourInput = document.getElementById("startHour");
const endHourInput = document.getElementById("endHour");
const eventNameInput = document.getElementById("eventNameInput");
const hostPanel = document.getElementById("hostPanel");
const loginScreen = document.getElementById("loginScreen");
const loginForm = document.getElementById("loginForm");
const loginNameInput = document.getElementById("loginName");
const loginError = document.getElementById("loginError");
const appShell = document.getElementById("appShell");
const currentUserNode = document.getElementById("currentUser");
const toastNode = document.getElementById("toast");
const tipNode = document.getElementById("tip");
const table = document.getElementById("availabilityTable");
const eventTitle = document.getElementById("eventTitle");
const peopleNode = document.getElementById("people");
const bestList = document.getElementById("bestList");
const saveStatusNode = document.getElementById("saveStatus");
const copyButton = document.getElementById("copyLink");
const copyLabel = document.getElementById("copyLabel");
const shortenToggle = document.getElementById("shortenToggle");

// ---- Varsel ----
let toastTimer = null;
function showToast(text, sub, opts = {}) {
  if (!text) return;
  toastNode.textContent = "";
  toastNode.classList.toggle("error", Boolean(opts.error));
  toastNode.classList.toggle("has-action", Boolean(opts.action));

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = opts.error ? "!" : "✓";
  const box = document.createElement("span");
  box.className = "toast-text";
  const main = document.createElement("span");
  main.textContent = text;
  box.appendChild(main);
  if (sub) {
    const s = document.createElement("small");
    s.textContent = sub;
    box.appendChild(s);
  }
  toastNode.append(icon, box);

  if (opts.action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "toast-action";
    b.textContent = opts.action.label;
    b.addEventListener("click", () => {
      opts.action.fn();
      toastNode.classList.remove("show");
    });
    toastNode.appendChild(b);
  }

  toastNode.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => toastNode.classList.remove("show"),
    opts.action ? 5500 : 3200
  );
}

// ---- Lagringsstatus ----
let saveTimer = null;
function setSaveStatus(kind) {
  clearTimeout(saveTimer);
  saveStatusNode.className = `save-status ${kind}`;
  if (kind === "saving") {
    saveStatusNode.textContent = "Lagrer…";
  } else if (kind === "saved") {
    saveStatusNode.textContent = "✓ Lagret – du kan lukke siden";
  } else {
    saveStatusNode.textContent =
      "⚠ Kunne ikke lagre på denne enheten. Ikke lukk siden ennå.";
  }
}

// ---- Navn ----
function capitalizeWord(word) {
  return word
    .toLocaleLowerCase("nb-NO")
    .replace(/(^|[-'’])(\p{L})/gu, (m, sep, ch) => sep + ch.toLocaleUpperCase("nb-NO"));
}

// Returnerer formatert navn, eller null hvis det ikke er både fornavn og etternavn
function formatFullName(raw) {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  if (!parts.every((p) => /\p{L}/u.test(p))) return null;
  return parts.map(capitalizeWord).join(" ");
}

function showLoginError(text) {
  loginError.textContent = text;
  loginError.hidden = !text;
  loginNameInput.classList.toggle("invalid", Boolean(text));
  if (text) {
    loginForm.classList.remove("shake");
    void loginForm.offsetWidth; // start animasjonen på nytt
    loginForm.classList.add("shake");
  }
}

loginNameInput.addEventListener("input", () => {
  loginError.hidden = true;
  loginNameInput.classList.remove("invalid");
});
loginNameInput.addEventListener("blur", () => {
  const formatted = formatFullName(loginNameInput.value);
  if (formatted) loginNameInput.value = formatted;
});

// ---- Lenkenavn ----
function cleanSlug(value) {
  return value
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function finalSlug() {
  return cleanSlug(state.eventName) || "event";
}

// ---- Kompakt koding av delt data ----
const textEnc = new TextEncoder();
const textDec = new TextDecoder();

function bytesToB64Url(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlToBytes(str) {
  const b = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b + "=".repeat((4 - (b.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pipeBytes(bytes, stream) {
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

function fitBytes(str, max = 255) {
  let s = str;
  let b = textEnc.encode(s);
  while (b.length > max) {
    s = s.slice(0, -1);
    b = textEnc.encode(s);
  }
  return b;
}

function dateToDays(iso) {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y || !m || !d) return 0;
  return Math.max(
    0,
    Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2000, 0, 1)) / 86400000)
  );
}

function daysToDate(n) {
  return new Date(Date.UTC(2000, 0, 1) + n * 86400000).toISOString().slice(0, 10);
}

// Format: [versjon, dager(2), start, slutt, navnlengde, navn, antall,
//          (navnlengde, navn, 21 byte bitmaske) per deltaker]
function packState() {
  const names = Object.keys(state.participants).slice(0, 255);
  const out = [];
  const days = dateToDays(state.weekStart);
  out.push(1, (days >> 8) & 255, days & 255, state.startHour, state.endHour);

  const ev = fitBytes(state.eventName);
  out.push(ev.length, ...ev);
  out.push(names.length);

  for (const name of names) {
    const nb = fitBytes(name);
    out.push(nb.length, ...nb);
    const mask = new Uint8Array(21);
    for (const [key, on] of Object.entries(state.participants[name].slots)) {
      if (!on) continue;
      const [d, h] = key.split("-").map(Number);
      if (d >= 0 && d < DAYS && h >= 0 && h < 24) {
        const bit = d * 24 + h;
        mask[bit >> 3] |= 1 << (bit & 7);
      }
    }
    out.push(...mask);
  }
  return new Uint8Array(out);
}

function unpackState(bytes) {
  let i = 0;
  if (bytes[i++] !== 1) throw new Error("ukjent versjon");
  const days = (bytes[i++] << 8) | bytes[i++];
  const startHour = bytes[i++];
  const endHour = bytes[i++];
  const evLen = bytes[i++];
  const eventName = textDec.decode(bytes.subarray(i, i + evLen));
  i += evLen;
  const count = bytes[i++];

  const participants = {};
  for (let p = 0; p < count; p += 1) {
    const len = bytes[i++];
    const name = textDec.decode(bytes.subarray(i, i + len));
    i += len;
    const slots = {};
    for (let bit = 0; bit < DAYS * 24; bit += 1) {
      if (bytes[i + (bit >> 3)] & (1 << (bit & 7))) {
        slots[`${Math.floor(bit / 24)}-${bit % 24}`] = true;
      }
    }
    i += 21;
    participants[name] = { slots };
  }
  return { eventName, weekStart: daysToDate(days), startHour, endHour, participants };
}

async function encodeState() {
  const bin = packState();
  if (typeof CompressionStream !== "undefined") {
    try {
      const z = await pipeBytes(bin, new CompressionStream("deflate-raw"));
      if (z.length < bin.length) return "c." + bytesToB64Url(z);
    } catch {
      // faller tilbake til ukomprimert
    }
  }
  return "d." + bytesToB64Url(bin);
}

async function decodeHash(raw) {
  if (raw[1] === ".") {
    const bytes = b64UrlToBytes(raw.slice(2));
    const kind = raw[0];
    if (kind === "c") {
      const unz = await pipeBytes(bytes, new DecompressionStream("deflate-raw"));
      applyParsedState(unpackState(unz));
    } else if (kind === "d") {
      applyParsedState(unpackState(bytes));
    } else if (kind === "z") {
      const json = textDec.decode(
        await pipeBytes(bytes, new DecompressionStream("deflate-raw"))
      );
      applyParsedState(JSON.parse(json));
    } else {
      applyParsedState(JSON.parse(textDec.decode(bytes)));
    }
  } else {
    // eldste lenker
    applyParsedState(JSON.parse(decodeURIComponent(escape(atob(raw)))));
  }
}

// ---- Lagring på enheten (JSON) ----
function buildPayload() {
  const p = {};
  for (const [name, data] of Object.entries(state.participants)) {
    p[name] = Object.keys(data.slots).filter((k) => data.slots[k]);
  }
  return {
    n: state.eventName,
    w: state.weekStart,
    s: state.startHour,
    e: state.endHour,
    p,
  };
}

function applyParsedState(parsed) {
  state.eventName = parsed.n ?? parsed.eventName ?? state.eventName;
  state.weekStart = parsed.w ?? parsed.weekStart ?? state.weekStart;
  state.startHour = Number(parsed.s ?? parsed.startHour ?? state.startHour);
  state.endHour = Number(parsed.e ?? parsed.endHour ?? state.endHour);

  const participants = {};
  if (parsed.p && typeof parsed.p === "object") {
    for (const [name, keys] of Object.entries(parsed.p)) {
      const slots = {};
      for (const k of Array.isArray(keys) ? keys : []) slots[k] = true;
      participants[name] = { slots };
    }
  } else if (parsed.participants && typeof parsed.participants === "object") {
    for (const [name, data] of Object.entries(parsed.participants)) {
      participants[name] = { slots: { ...(data && data.slots) } };
    }
  }
  state.participants = participants;
}

function saveState() {
  setSaveStatus("saving");
  let ok = true;
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(buildPayload()));
  } catch {
    ok = false;
  }
  saveTimer = setTimeout(() => setSaveStatus(ok ? "saved" : "error"), 450);
}

function loadStateFromStorage() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return false;
    applyParsedState(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

// ---- Diverse hjelpefunksjoner ----
function defaultWeekStart() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function sanitizeHours() {
  state.startHour = Math.max(0, Math.min(23, Number(state.startHour) || 9));
  state.endHour = Math.max(1, Math.min(24, Number(state.endHour) || 18));
  if (state.endHour <= state.startHour) {
    state.endHour = Math.min(24, state.startHour + 1);
  }
  startHourInput.value = String(state.startHour);
  endHourInput.value = String(state.endHour);
}

function updateConfigFromInputs() {
  state.weekStart = weekStartInput.value || defaultWeekStart();
  state.startHour = Number(startHourInput.value);
  state.endHour = Number(endHourInput.value);
}

function getSlotKey(dayIndex, hour) {
  return `${dayIndex}-${hour}`;
}

function getDayDate(date, dayOffset) {
  const d = new Date(date);
  d.setDate(d.getDate() + dayOffset);
  return d;
}

function pad(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function namesForSlot(slotKey) {
  return Object.entries(state.participants)
    .filter(([, data]) => data.slots[slotKey])
    .map(([name]) => name);
}

function allSlotKeys() {
  const keys = [];
  for (let d = 0; d < DAYS; d += 1) {
    for (let h = state.startHour; h < state.endHour; h += 1) keys.push(getSlotKey(d, h));
  }
  return keys;
}

// ---- Rutenett ----
function updateCell(td) {
  const slotKey = getSlotKey(td.dataset.day, td.dataset.hour);
  const total = Object.keys(state.participants).length;
  const count = namesForSlot(slotKey).length;

  const ratio = total ? count / total : 0;
  // Fra svak grønn (én person) til full, mørk grønn (alle kan)
  const alpha = count ? 0.15 + ratio * 0.85 : 0;
  td.style.backgroundColor = count ? `rgba(21, 128, 61, ${alpha.toFixed(2)})` : "";
  td.classList.toggle("dark", alpha > 0.5);
  td.classList.toggle("empty", count === 0);

  td.textContent = "";
  const cnt = document.createElement("span");
  cnt.className = "cnt";
  cnt.textContent = `${count}/${total}`;
  td.appendChild(cnt);

  const me = state.currentParticipant;
  td.classList.toggle("mine", Boolean(me && state.participants[me]?.slots[slotKey]));
}

function renderPeople() {
  peopleNode.innerHTML = "";
  for (const name of Object.keys(state.participants)) {
    const chip = document.createElement("span");
    chip.className = "chip" + (name === state.currentParticipant ? " chip-me" : "");
    chip.textContent = name;
    peopleNode.appendChild(chip);
  }
}

function renderBest() {
  const total = Object.keys(state.participants).length;
  const slots = [];

  for (let day = 0; day < DAYS; day += 1) {
    for (let hour = state.startHour; hour < state.endHour; hour += 1) {
      const names = namesForSlot(getSlotKey(day, hour));
      if (names.length) slots.push({ day, hour, names });
    }
  }

  slots.sort((a, b) => b.names.length - a.names.length || a.day - b.day || a.hour - b.hour);

  bestList.innerHTML = "";
  if (!slots.length) {
    const li = document.createElement("li");
    li.className = "best-empty";
    li.textContent = "Ingen har valgt tider ennå.";
    bestList.appendChild(li);
    return;
  }

  for (const slot of slots.slice(0, 3)) {
    const date = getDayDate(state.weekStart, slot.day);
    const label = date.toLocaleDateString("nb-NO", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
    const li = document.createElement("li");
    li.innerHTML = `
      <strong></strong>
      <span class="best-count">${slot.names.length} / ${total}</span>
      <span class="best-names"></span>
    `;
    li.querySelector("strong").textContent = `${label}, ${pad(slot.hour)}`;
    li.querySelector(".best-names").textContent = slot.names.join(", ");
    bestList.appendChild(li);
  }
}

// Oppdaterer eksisterende ruter uten å bygge tabellen på nytt
function refreshCells() {
  table.querySelectorAll("td.slot").forEach((td) => {
    td.classList.remove("sel");
    updateCell(td);
  });
  renderPeople();
  renderBest();
}

function renderGrid() {
  cancelHover();
  eventTitle.textContent = state.eventName;
  document.title = `${state.eventName} · when3meet`;
  table.innerHTML = "";

  const header = document.createElement("tr");
  const topLeft = document.createElement("th");
  topLeft.className = "time-head";
  header.appendChild(topLeft);

  for (let d = 0; d < DAYS; d += 1) {
    const date = getDayDate(state.weekStart, d);
    const weekday = date.toLocaleDateString("nb-NO", { weekday: "short" });
    const dayMonth = date.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });

    const th = document.createElement("th");
    th.className = "day-head";
    th.innerHTML = `
      <span class="day-name">${weekday}</span>
      <span class="day-date">${dayMonth}</span>
    `;
    header.appendChild(th);
  }
  table.appendChild(header);

  for (let hour = state.startHour; hour < state.endHour; hour += 1) {
    const row = document.createElement("tr");
    const time = document.createElement("th");
    time.className = "time-head";
    time.textContent = pad(hour);
    row.appendChild(time);

    for (let day = 0; day < DAYS; day += 1) {
      const td = document.createElement("td");
      td.className = "slot";
      td.dataset.day = String(day);
      td.dataset.hour = String(hour);
      updateCell(td);
      row.appendChild(td);
    }

    table.appendChild(row);
  }

  renderPeople();
  renderBest();
}

// ---- Hover-boks med navn (kun mus, med forsinkelse) ----
let hoverTimer = null;
let hoverTd = null;
let hoverPos = { x: 0, y: 0 };

function hideTip() {
  tipNode.hidden = true;
}

function cancelHover() {
  clearTimeout(hoverTimer);
  hoverTimer = null;
  hoverTd = null;
  hideTip();
}

function showTip(td) {
  const names = namesForSlot(getSlotKey(td.dataset.day, td.dataset.hour));
  const total = Object.keys(state.participants).length;

  tipNode.textContent = "";
  const head = document.createElement("strong");
  head.textContent = names.length
    ? `Kan (${names.length}/${total})`
    : "Ingen har valgt denne";
  tipNode.appendChild(head);
  for (const n of names) {
    const line = document.createElement("div");
    line.textContent = n;
    tipNode.appendChild(line);
  }

  tipNode.hidden = false;
  const gap = 14;
  const rect = tipNode.getBoundingClientRect();
  let x = hoverPos.x + gap;
  let y = hoverPos.y + gap;
  if (x + rect.width > window.innerWidth - 8) x = hoverPos.x - rect.width - gap;
  if (y + rect.height > window.innerHeight - 8) y = hoverPos.y - rect.height - gap;
  tipNode.style.left = `${Math.max(8, x)}px`;
  tipNode.style.top = `${Math.max(8, y)}px`;
}

table.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse" || dragging) {
    cancelHover();
    return;
  }
  const td = event.target.closest("td.slot");
  if (!td) {
    cancelHover();
    return;
  }
  hoverPos = { x: event.clientX, y: event.clientY };

  if (td !== hoverTd) {
    hideTip();
    hoverTd = td;
  }
  // Vises først når musen har ligget stille en liten stund
  if (tipNode.hidden) {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (hoverTd) showTip(hoverTd);
    }, HOVER_DELAY);
  }
});
table.addEventListener("pointerleave", cancelHover);

// ---- Rektangel-drag: legg til / fjern ----
let dragging = false;
let dragMode = true; // true = legg til, false = fjern
let dragStart = null;
let dragEnd = null;
let snapshot = null; // mine valg før draget startet

function cellPos(td) {
  return { day: Number(td.dataset.day), hour: Number(td.dataset.hour) };
}

function applyRect() {
  const name = state.currentParticipant;
  if (!dragStart || !dragEnd || !name || !state.participants[name]) return;

  const d1 = Math.min(dragStart.day, dragEnd.day);
  const d2 = Math.max(dragStart.day, dragEnd.day);
  const h1 = Math.min(dragStart.hour, dragEnd.hour);
  const h2 = Math.max(dragStart.hour, dragEnd.hour);
  const slots = state.participants[name].slots;

  for (const td of table.querySelectorAll("td.slot")) {
    const { day, hour } = cellPos(td);
    const key = getSlotKey(day, hour);
    const inRect = day >= d1 && day <= d2 && hour >= h1 && hour <= h2;
    const want = inRect ? dragMode : Boolean(snapshot[key]);

    if (want) {
      slots[key] = true;
    } else {
      delete slots[key];
    }
    td.classList.toggle("sel", inRect);
    updateCell(td);
  }
}

function endDrag() {
  if (!dragging) return;
  dragging = false;
  dragStart = null;
  dragEnd = null;
  snapshot = null;
  refreshCells();
  saveState();
}

table.addEventListener("pointerdown", (event) => {
  const td = event.target.closest("td.slot");
  if (!td) return;
  const name = state.currentParticipant;
  if (!name || !state.participants[name]) {
    showToast("Logg inn først.", null, { error: true });
    return;
  }
  event.preventDefault();
  cancelHover();
  const pos = cellPos(td);
  const slots = state.participants[name].slots;
  snapshot = { ...slots };
  dragMode = !slots[getSlotKey(pos.day, pos.hour)];
  dragging = true;
  dragStart = pos;
  dragEnd = pos;
  applyRect();
});

window.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const el = document.elementFromPoint(event.clientX, event.clientY);
  const td = el && el.closest ? el.closest("td.slot") : null;
  if (!td) return;
  const pos = cellPos(td);
  if (pos.day === dragEnd.day && pos.hour === dragEnd.hour) return;
  dragEnd = pos;
  applyRect();
});

window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", endDrag);
table.addEventListener("contextmenu", (event) => event.preventDefault());

// ---- Alle tider passer / Tøm (uten bekreftelse, men med «Angre») ----
document.getElementById("selectAll").addEventListener("click", () => {
  const name = state.currentParticipant;
  if (!name || !state.participants[name]) return;
  const keys = allSlotKeys();
  const slots = state.participants[name].slots;
  if (keys.every((k) => slots[k])) {
    showToast("Du har allerede valgt alle tider.");
    return;
  }
  const before = { ...slots };
  for (const k of keys) slots[k] = true;
  refreshCells();
  saveState();
  showToast("Alle tider er valgt", "Dra over rutene hvis du vil fjerne noen.", {
    action: {
      label: "Angre",
      fn: () => {
        state.participants[name].slots = before;
        refreshCells();
        saveState();
      },
    },
  });
});

document.getElementById("clearMine").addEventListener("click", () => {
  const name = state.currentParticipant;
  if (!name || !state.participants[name]) return;
  const before = { ...state.participants[name].slots };
  if (!Object.keys(before).length) {
    showToast("Du har ingen valg å tømme.");
    return;
  }
  state.participants[name].slots = {};
  refreshCells();
  saveState();
  showToast("Valgene dine er tømt", null, {
    action: {
      label: "Angre",
      fn: () => {
        state.participants[name].slots = before;
        refreshCells();
        saveState();
      },
    },
  });
});

document.getElementById("clearAll").addEventListener("click", () => {
  if (!IS_HOST) return;
  const before = {};
  for (const [n, d] of Object.entries(state.participants)) before[n] = { ...d.slots };
  for (const data of Object.values(state.participants)) data.slots = {};
  refreshCells();
  saveState();
  showToast("Alle svar er tømt", null, {
    action: {
      label: "Angre",
      fn: () => {
        for (const [n, slots] of Object.entries(before)) {
          if (state.participants[n]) state.participants[n].slots = { ...slots };
        }
        refreshCells();
        saveState();
      },
    },
  });
});

// ---- Kopier lenke ----
async function buildLongUrl() {
  const base = window.location.href.split(/[?#]/)[0];
  return `${base}?join=${encodeURIComponent(finalSlug())}#${await encodeState()}`;
}

let shortCache = { long: "", short: "" };
async function shortenUrl(long) {
  if (shortCache.long === long) return shortCache.short;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(
      `https://is.gd/create.php?format=json&url=${encodeURIComponent(long)}`,
      { signal: ctrl.signal }
    );
    const data = await res.json();
    if (data && data.shorturl) {
      shortCache = { long, short: data.shorturl };
      return data.shorturl;
    }
  } catch {
    // feilet: bruker den vanlige lenken
  } finally {
    clearTimeout(timer);
  }
  return null;
}

function legacyCopy(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

// Tar imot tekst eller et løfte om tekst (beholder klikket som «brukerhandling» i Safari)
async function copyText(textOrPromise) {
  if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
    try {
      const blob = Promise.resolve(textOrPromise).then(
        (t) => new Blob([t], { type: "text/plain" })
      );
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      return true;
    } catch {
      // prøver neste metode
    }
  }
  const text = await textOrPromise;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
}

try {
  shortenToggle.checked = localStorage.getItem(SHORTEN_KEY) === "1";
} catch {
  shortenToggle.checked = false;
}
shortenToggle.addEventListener("change", () => {
  try {
    localStorage.setItem(SHORTEN_KEY, shortenToggle.checked ? "1" : "0");
  } catch {
    // ignorer
  }
});

let copyTimer = null;
copyButton.addEventListener("click", async () => {
  const wantShort = shortenToggle.checked;
  const result = { shortened: false };
  if (wantShort) copyLabel.textContent = "Forkorter…";

  const textPromise = (async () => {
    const long = await buildLongUrl();
    let url = long;
    if (wantShort) {
      const short = await shortenUrl(long);
      if (short) {
        url = short;
        result.shortened = true;
      }
    }
    return `Here's my invitation: ${state.eventName} 💥\n${url}`;
  })();

  let ok = false;
  try {
    ok = await copyText(textPromise);
  } catch {
    ok = false;
  }

  clearTimeout(copyTimer);
  if (!ok) {
    copyLabel.textContent = "Kopier lenke";
    showToast("Kunne ikke kopiere lenken", "Prøv igjen.", { error: true });
    return;
  }

  showToast(
    "Lenken er kopiert",
    wantShort && !result.shortened
      ? "Kunne ikke forkorte, så hele lenken ble kopiert."
      : "Lim den inn i en melding for å dele den."
  );
  copyButton.classList.add("copied");
  copyLabel.textContent = "Kopiert ✓";
  copyTimer = setTimeout(() => {
    copyButton.classList.remove("copied");
    copyLabel.textContent = "Kopier lenke";
  }, 2200);
});

// ---- Vert-innstillinger, innlogging ----
document.getElementById("buildGrid").addEventListener("click", () => {
  if (!IS_HOST) return;
  const newName = eventNameInput.value.trim();
  if (newName) state.eventName = newName;
  updateConfigFromInputs();
  sanitizeHours();
  renderGrid();
  saveState();
  showToast("Oppdatert!");
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (loginScreen.classList.contains("leaving")) return;
  const raw = loginNameInput.value;
  const formatted = formatFullName(raw);
  if (!formatted) {
    showLoginError(
      raw.trim()
        ? "Skriv både fornavn og etternavn, for eksempel Ola Nordmann."
        : "Skriv inn fornavn og etternavn."
    );
    loginNameInput.focus();
    return;
  }
  loginNameInput.value = formatted;
  showLoginError("");
  activateParticipant(formatted);
});

document.getElementById("logout").addEventListener("click", () => {
  state.currentParticipant = "";
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  appShell.hidden = true;
  loginScreen.hidden = false; // innloggingskortet animeres inn av CSS
  loginNameInput.value = "";
  showLoginError("");
  loginNameInput.focus();
});

function activateParticipant(name) {
  if (!name) return;
  if (!state.participants[name]) {
    state.participants[name] = { slots: {} };
  }
  state.currentParticipant = name;
  currentUserNode.textContent = name;
  eventNameInput.value = state.eventName;
  localStorage.setItem(LOCAL_STORAGE_KEY, name);

  const showApp = () => {
    loginScreen.classList.remove("leaving");
    loginScreen.hidden = true;
    appShell.hidden = false; // appen animeres inn av CSS
    renderGrid();
    saveState();
  };

  if (!loginScreen.hidden && !REDUCE_MOTION) {
    loginScreen.classList.add("leaving");
    setTimeout(showApp, 300);
  } else {
    showApp();
  }
}

async function bootstrap() {
  state.weekStart = defaultWeekStart();

  // Delt lenke har forrang. Ellers brukes det enheten husker.
  const rawHash = window.location.hash.slice(1);
  let loadedFromHash = false;
  if (rawHash) {
    try {
      await decodeHash(rawHash);
      loadedFromHash = true;
    } catch {
      loadedFromHash = false;
    }
  }
  if (!loadedFromHash) loadStateFromStorage();

  if (loadedFromHash) {
    // Rydd adresselinjen: fjern dataene etter #
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  sanitizeHours();

  hostPanel.hidden = !IS_HOST;
  weekStartInput.value = state.weekStart;
  eventNameInput.value = state.eventName;

  // Enheten husker deg: gå rett inn hvis du er logget inn fra før
  const savedUser = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedUser) {
    activateParticipant(savedUser);
    return;
  }

  appShell.hidden = true;
  loginScreen.hidden = false;
  loginNameInput.focus();
  renderGrid();
}

bootstrap();