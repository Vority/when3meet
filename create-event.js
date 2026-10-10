const state = {
  step: 0,
  eventName: "",
  startDate: null,
  endDate: null,
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedSlots: new Set(),
  isDragging: false,
  dragValue: false,
  blockLength: "60",
};

const track = document.getElementById("flowTrack");
const stepCount = document.getElementById("stepCount");
const eventName = document.getElementById("eventName");
const datePickerButton = document.getElementById("datePickerButton");
const dateSummary = document.getElementById("dateSummary");
const calendarPopover = document.getElementById("calendarPopover");
const calendarGrid = document.getElementById("calendarGrid");
const calendarTitle = document.getElementById("calendarTitle");
const toast = document.getElementById("toast");

document.getElementById("nameNext").addEventListener("click", goToTime);
eventName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") goToTime();
});
document.getElementById("timeBack").addEventListener("click", () => moveTo(0));
document.getElementById("timeNext").addEventListener("click", goToSettings);
datePickerButton.addEventListener("click", toggleCalendar);
document.getElementById("calendarDone").addEventListener("click", closeCalendar);
document.getElementById("previousMonth").addEventListener("click", () => changeMonth(-1));
document.getElementById("nextMonth").addEventListener("click", () => changeMonth(1));
document.getElementById("copyButton").addEventListener("click", copyLink);
document.getElementById("shareButton").addEventListener("click", shareLink);
document.getElementById("tableToggle").addEventListener("click", toggleTable);
document.getElementById("closeTable").addEventListener("click", closeTable);
document.getElementById("clearTable").addEventListener("click", clearTable);
document.getElementById("readyBack").addEventListener("click", () => moveTo(2));
document.getElementById("settingsBack").addEventListener("click", () => moveTo(1));
document.getElementById("settingsDone").addEventListener("click", saveSettings);
document.getElementById("blockLength").addEventListener("change", (event) => {
  state.blockLength = event.target.value;
});
document.addEventListener("pointerup", () => {
  state.isDragging = false;
});

function moveTo(step) {
  state.step = step;
  track.style.transform = `translateX(-${step * 25}%)`;
  stepCount.textContent = `${String(Math.min(step + 1, 4)).padStart(2, "0")} / 04`;
  document.querySelectorAll(".flow-step").forEach((section, index) => {
    section.setAttribute("aria-hidden", String(index !== step));
  });
}

function goToTime() {
  const value = eventName.value.trim();
  if (!value) {
    document.getElementById("nameMessage").textContent = "Add an event name to continue.";
    eventName.focus();
    return;
  }
  state.eventName = value;
  document.getElementById("nameMessage").textContent = "";
  moveTo(1);
  setTimeout(() => datePickerButton.focus(), 500);
}

function goToSettings() {
  if (!state.startDate || !state.endDate) {
    document.getElementById("dateMessage").textContent = "Choose a start and end date to continue.";
    datePickerButton.focus();
    return;
  }
  document.getElementById("dateMessage").textContent = "";
  moveTo(2);
  setTimeout(() => document.getElementById("blockLength").focus(), 500);
}

function goToReady() {
  if (!state.startDate || !state.endDate) {
    document.getElementById("dateMessage").textContent = "Choose a start and end date to continue.";
    datePickerButton.focus();
    return;
  }
  document.getElementById("dateMessage").textContent = "";
  const formattedStart = formatDate(state.startDate);
  const formattedEnd = formatDate(state.endDate);
  document.getElementById("readyDetails").textContent = `${state.eventName} · ${formattedStart} – ${formattedEnd}`;
  document.getElementById("tableTitle").textContent = state.eventName;
  moveTo(3);
  setTimeout(() => document.getElementById("shareButton").focus(), 500);
}

function saveSettings() {
  goToReady();
}

function toggleCalendar() {
  const isOpen = !calendarPopover.hidden;
  if (isOpen) closeCalendar();
  else {
    positionCalendar();
    calendarPopover.hidden = false;
    datePickerButton.setAttribute("aria-expanded", "true");
    renderCalendar();
  }
}

function positionCalendar() {
  const box = datePickerButton.getBoundingClientRect();
  const popoverHeight = Math.min(window.innerHeight - 32, 470);
  const top = Math.min(box.bottom + 10, window.innerHeight - popoverHeight - 16);
  calendarPopover.style.top = `${Math.max(16, top)}px`;
  calendarPopover.style.left = `${Math.min(window.innerWidth - Math.min(window.innerWidth * 0.9, 360) - 16, Math.max(16, box.left))}px`;
}

function closeCalendar() {
  calendarPopover.hidden = true;
  datePickerButton.setAttribute("aria-expanded", "false");
}

function changeMonth(offset) {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + offset, 1);
  renderCalendar();
}

function renderCalendar() {
  calendarTitle.textContent = state.month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  calendarGrid.innerHTML = "";
  const firstDay = state.month.getDay();
  const daysInMonth = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0).getDate();
  for (let i = 0; i < firstDay; i += 1) {
    const spacer = document.createElement("span");
    calendarGrid.appendChild(spacer);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(state.month.getFullYear(), state.month.getMonth(), day);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = String(day);
    button.setAttribute("aria-label", formatDate(date));
    if (isSameDay(date, state.startDate)) button.classList.add("is-start");
    if (isSameDay(date, state.endDate)) button.classList.add("is-end");
    if (isBetween(date, state.startDate, state.endDate)) button.classList.add("is-between");
    button.addEventListener("click", () => selectDate(date));
    calendarGrid.appendChild(button);
  }
}

function selectDate(date) {
  if (!state.startDate || (state.startDate && state.endDate)) {
    state.startDate = date;
    state.endDate = null;
  } else if (date < state.startDate) {
    state.endDate = state.startDate;
    state.startDate = date;
  } else {
    state.endDate = date;
  }
  dateSummary.textContent = state.endDate
    ? `${formatDate(state.startDate)} – ${formatDate(state.endDate)}`
    : `${formatDate(state.startDate)} – ...`;
  renderCalendar();
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isSameDay(first, second) {
  return first && second && first.toDateString() === second.toDateString();
}

function isBetween(date, start, end) {
  return start && end && date > start && date < end;
}

function link() {
  const params = new URLSearchParams({
    event: state.eventName,
    from: state.startDate.toISOString().slice(0, 10),
    to: state.endDate.toISOString().slice(0, 10),
    block: state.blockLength,
  });
  return `${window.location.origin}${window.location.pathname.replace("create-event.html", "index.html")}?${params}`;
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(link());
    showToast("Event link copied");
  } catch {
    showToast("Could not copy link");
  }
}

async function shareLink() {
  if (navigator.share) {
    try {
      await navigator.share({ title: state.eventName, text: `Join ${state.eventName}`, url: link() });
    } catch (error) {
      if (error.name !== "AbortError") showToast("Could not open sharing options");
    }
  } else {
    await copyLink();
  }
}

function toggleTable() {
  const panel = document.getElementById("timetablePanel");
  if (panel.hidden) openTable();
  else closeTable();
}

function openTable() {
  const panel = document.getElementById("timetablePanel");
  const app = document.querySelector(".create-app");
  panel.hidden = false;
  panel.setAttribute("aria-hidden", "false");
  document.getElementById("tableToggle").setAttribute("aria-expanded", "true");
  document.getElementById("tableToggle").innerHTML = '<span aria-hidden="true">↑</span><span>Close timetable</span>';
  renderTable();
  requestAnimationFrame(() => {
    app.classList.add("table-open");
    panel.classList.add("is-open");
  });
}

function closeTable() {
  const panel = document.getElementById("timetablePanel");
  const app = document.querySelector(".create-app");
  panel.setAttribute("aria-hidden", "true");
  document.getElementById("tableToggle").setAttribute("aria-expanded", "false");
  document.getElementById("tableToggle").innerHTML = '<span aria-hidden="true">↓</span><span>Open timetable</span>';
  app.classList.remove("table-open");
  panel.classList.remove("is-open");
  setTimeout(() => {
    if (panel.getAttribute("aria-hidden") === "true") panel.hidden = true;
  }, 350);
}

function clearTable() {
  state.selectedSlots.clear();
  renderTable();
  showToast("Timetable cleared");
}

function renderTable() {
  const table = document.getElementById("availabilityTable");
  const startHour = Number(document.getElementById("startTime").value.split(":")[0]);
  const endHour = Number(document.getElementById("endTime").value.split(":")[0]);
  const blockMinutes = Number(state.blockLength);
  table.innerHTML = "<caption class=\"sr-only\">Event availability timetable</caption>";
  const header = document.createElement("tr");
  header.innerHTML = "<th scope=\"col\">Time</th>";
  const dates = [];
  for (let date = new Date(state.startDate); date <= state.endDate; date.setDate(date.getDate() + 1)) {
    dates.push(new Date(date));
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    header.appendChild(th);
  }
  table.appendChild(header);
  for (let minutes = startHour * 60; minutes < endHour * 60; minutes += blockMinutes) {
    const row = document.createElement("tr");
    const time = document.createElement("th");
    time.scope = "row";
    time.textContent = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    row.appendChild(time);
    dates.forEach((date) => {
      const key = `${date.toISOString().slice(0, 10)}-${minutes}`;
      const cell = document.createElement("td");
      cell.className = "slot";
      cell.setAttribute("role", "button");
      cell.setAttribute("tabindex", "0");
      cell.setAttribute("aria-label", `Toggle ${key}`);
      if (state.selectedSlots.has(key)) cell.classList.add("selected");
      cell.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        state.isDragging = true;
        state.dragValue = !state.selectedSlots.has(key);
        setSlot(cell, key, state.dragValue);
      });
      cell.addEventListener("pointerenter", () => {
        if (state.isDragging) setSlot(cell, key, state.dragValue);
      });
      cell.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") toggleSlot(cell, key);
      });
      row.appendChild(cell);
    });
    table.appendChild(row);
  }
}

function toggleSlot(cell, key) {
  setSlot(cell, key, !state.selectedSlots.has(key));
}

function setSlot(cell, key, selected) {
  if (!selected) {
    state.selectedSlots.delete(key);
    cell.classList.remove("selected");
  } else {
    state.selectedSlots.add(key);
    cell.classList.add("selected");
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  setTimeout(() => toast.classList.remove("is-visible"), 2500);
}
