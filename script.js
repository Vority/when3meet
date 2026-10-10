const DAYS = 7;

const state = {
  eventName: "Team meeting",
  weekStart: "",
  startHour: 9,
  endHour: 18,
  participants: {},
  currentParticipant: "",
};

const eventNameInput = document.getElementById("eventName");
const weekStartInput = document.getElementById("weekStart");
const startHourInput = document.getElementById("startHour");
const endHourInput = document.getElementById("endHour");
const participantNameInput = document.getElementById("participantName");
const participantColorInput = document.getElementById("participantColor");
const statusNode = document.getElementById("status");
const table = document.getElementById("availabilityTable");
const gridTitle = document.getElementById("gridTitle");

document.getElementById("buildGrid").addEventListener("click", () => {
  updateConfigFromInputs();
  sanitizeHours();
  renderGrid();
  writeStateToHash();
  announce("Grid updated.");
});

document.getElementById("join").addEventListener("click", () => {
  const name = participantNameInput.value.trim();
  if (!name) {
    announce("Please enter your name first.");
    return;
  }
  if (!state.participants[name]) {
    state.participants[name] = {
      color: participantColorInput.value,
      slots: {},
    };
  } else {
    state.participants[name].color = participantColorInput.value;
  }
  state.currentParticipant = name;
  renderGrid();
  writeStateToHash();
  announce(`${name} is now active. Click cells to mark availability.`);
});

document.getElementById("copyLink").addEventListener("click", async () => {
  writeStateToHash();
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    announce("Shareable link copied.");
  } catch {
    announce("Could not copy link. Copy it manually from your address bar.");
  }
});

function defaultWeekStart() {
  const now = new Date();
  const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  return iso;
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
  state.eventName = eventNameInput.value.trim() || "Team meeting";
  state.weekStart = weekStartInput.value || defaultWeekStart();
  state.startHour = Number(startHourInput.value);
  state.endHour = Number(endHourInput.value);
}

function getSlotKey(dayIndex, hour) {
  return `${dayIndex}-${hour}`;
}

function getDayLabel(date, dayOffset) {
  const d = new Date(date);
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function blend(participants) {
  if (!participants.length) return "#ffffff";
  let r = 0;
  let g = 0;
  let b = 0;
  for (const hex of participants) {
    const value = hex.replace("#", "");
    r += parseInt(value.slice(0, 2), 16);
    g += parseInt(value.slice(2, 4), 16);
    b += parseInt(value.slice(4, 6), 16);
  }
  r = Math.round(r / participants.length);
  g = Math.round(g / participants.length);
  b = Math.round(b / participants.length);
  return `rgb(${r}, ${g}, ${b})`;
}

function renderGrid() {
  gridTitle.textContent = `${state.eventName} availability`;
  table.innerHTML = "";

  const header = document.createElement("tr");
  const topLeft = document.createElement("th");
  topLeft.textContent = "Time";
  header.appendChild(topLeft);

  for (let d = 0; d < DAYS; d += 1) {
    const th = document.createElement("th");
    th.textContent = getDayLabel(state.weekStart, d);
    header.appendChild(th);
  }
  table.appendChild(header);

  for (let hour = state.startHour; hour < state.endHour; hour += 1) {
    const row = document.createElement("tr");
    const time = document.createElement("th");
    time.textContent = `${String(hour).padStart(2, "0")}:00`;
    row.appendChild(time);

    for (let day = 0; day < DAYS; day += 1) {
      const td = document.createElement("td");
      td.className = "slot";
      const slotKey = getSlotKey(day, hour);
      const availableNames = [];
      const colors = [];

      for (const [name, data] of Object.entries(state.participants)) {
        if (data.slots[slotKey]) {
          availableNames.push(name);
          colors.push(data.color);
        }
      }

      td.style.background = blend(colors);
      td.textContent = availableNames.length ? String(availableNames.length) : "";
      td.title = availableNames.length
        ? `Available: ${availableNames.join(", ")}`
        : "No one available";
      td.addEventListener("click", () => toggleSlot(slotKey));
      row.appendChild(td);
    }

    table.appendChild(row);
  }
}

function toggleSlot(slotKey) {
  const name = state.currentParticipant;
  if (!name || !state.participants[name]) {
    announce("Join first, then click slots.");
    return;
  }
  state.participants[name].slots[slotKey] = !state.participants[name].slots[slotKey];
  renderGrid();
  writeStateToHash();
}

function announce(text) {
  statusNode.textContent = text;
}

function writeStateToHash() {
  const compactState = {
    eventName: state.eventName,
    weekStart: state.weekStart,
    startHour: state.startHour,
    endHour: state.endHour,
    participants: state.participants,
  };
  const json = JSON.stringify(compactState);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  window.location.hash = encoded;
}

function loadStateFromHash() {
  if (!window.location.hash.slice(1)) return false;
  try {
    const decoded = decodeURIComponent(escape(atob(window.location.hash.slice(1))));
    const parsed = JSON.parse(decoded);
    state.eventName = parsed.eventName || state.eventName;
    state.weekStart = parsed.weekStart || state.weekStart;
    state.startHour = Number(parsed.startHour ?? state.startHour);
    state.endHour = Number(parsed.endHour ?? state.endHour);
    state.participants = parsed.participants && typeof parsed.participants === "object" ? parsed.participants : {};
    return true;
  } catch {
    return false;
  }
}

function bootstrap() {
  state.weekStart = defaultWeekStart();
  loadStateFromHash();
  sanitizeHours();

  eventNameInput.value = state.eventName;
  weekStartInput.value = state.weekStart;
  startHourInput.value = String(state.startHour);
  endHourInput.value = String(state.endHour);

  renderGrid();
}

bootstrap();
