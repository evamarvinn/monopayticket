const KINDS = ["trolleybus", "tram", "bus"];

const PAGES = {
  trolleybus: "index.html",
  tram: "tram.html",
  bus: "bus.html",
};

const FIELD_IDS = {
  trolleybus: "trolley-number",
  tram: "tram-number",
  bus: "bus-number",
};

const KEYS = {
  trolleybus: "vehicle-trolleybus",
  tram: "vehicle-tram",
  bus: "vehicle-bus",
  session: {
    trolleybus: "ticket-session-trolleybus",
    tram: "ticket-session-tram",
    bus: "ticket-session-bus",
  },
};

const LABELS = {
  trolleybus: "Тролейбус",
  tram: "Трамвай",
  bus: "Автобус",
};

const DEFAULTS = {
  trolleybus: "009",
  tram: "001",
  bus: "101",
};

const TICKET = {
  count: 1,
  quotes: [
    "— залишайтеся людьми і кричіть, що ви живі. Я живий!",
    "Життя — цікаве",
  ],
  validMs: 60 * 60 * 1000,
};

const monthNames = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

function formatPurchased(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `Придбано ${date.getDate()} ${monthNames[date.getMonth()]} о ${hours}:${minutes}`;
}

function formatRemain(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

function normalizeVehicle(value, fallback) {
  const digits = digitsOnly(value);
  if (!digits) return fallback;
  return digits.padStart(Math.max(3, digits.length), "0");
}

function readVehicle(kind) {
  return normalizeVehicle(localStorage.getItem(KEYS[kind]), DEFAULTS[kind]);
}

function writeVehicle(kind, value) {
  const next = normalizeVehicle(value, DEFAULTS[kind]);
  localStorage.setItem(KEYS[kind], next);
  return next;
}

function randomTicketNumber() {
  const n = Math.floor(100000 + Math.random() * 900000);
  const s = String(n);
  return `${s.slice(0, 3)} ${s.slice(3)}`;
}

function readSession(kind) {
  try {
    const raw = localStorage.getItem(KEYS.session[kind]);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const purchasedAt = Number(data.purchasedAt);
    const expiresAt = Number(data.expiresAt);
    const number = typeof data.number === "string" && data.number.trim()
      ? data.number.trim()
      : null;
    if (!purchasedAt || !expiresAt || !number) return null;
    return { purchasedAt, expiresAt, number };
  } catch {
    return null;
  }
}

function writeSession(kind, session) {
  localStorage.setItem(KEYS.session[kind], JSON.stringify(session));
}

function createSession() {
  const purchasedAt = Date.now();
  return {
    purchasedAt,
    expiresAt: purchasedAt + TICKET.validMs,
    number: randomTicketNumber(),
  };
}

function getSession(kind) {
  const saved = readSession(kind);
  if (saved) return saved;
  const session = createSession();
  writeSession(kind, session);
  return session;
}

function init() {
  const kind = KINDS.includes(document.body.dataset.kind)
    ? document.body.dataset.kind
    : "trolleybus";
  const label = LABELS[kind];

  let session = getSession(kind);
  let tickTimer = null;

  const quoteParts = TICKET.quotes
    .map((text) => `<span>${text}</span>`)
    .join('<span class="quote-sep">◆</span>');
  document.getElementById("quote").innerHTML = `${quoteParts}<span class="quote-sep">◆</span>${quoteParts}`;
  document.getElementById("transport").textContent = label;
  document.getElementById("amount").textContent = `${TICKET.count} квиток`;
  document.getElementById("transport-label").textContent = label;

  const purchasedEl = document.getElementById("purchased");
  const numberEl = document.getElementById("number");
  const timer = document.getElementById("timer");
  const status = document.getElementById("status");
  const statusText = document.getElementById("status-text");

  const renderTicket = () => {
    purchasedEl.textContent = formatPurchased(new Date(session.purchasedAt));
    numberEl.innerHTML = `Номер: <strong>${session.number}</strong>`;
    document.body.classList.remove("is-expired");
    status.classList.remove("is-expired");
  };

  const stopTick = () => {
    if (tickTimer != null) {
      clearTimeout(tickTimer);
      tickTimer = null;
    }
  };

  const tick = () => {
    stopTick();
    const remain = session.expiresAt - Date.now();
    if (remain <= 0) {
      document.body.classList.add("is-expired");
      status.classList.add("is-expired");
      statusText.textContent = "😔  Квиток недійсний";
      timer.textContent = "";
      return;
    }
    statusText.textContent = "Квиток дійсний — ";
    timer.textContent = formatRemain(remain);
    tickTimer = setTimeout(tick, 250);
  };

  const renewTicket = () => {
    session = createSession();
    writeSession(kind, session);
    renderTicket();
    tick();
  };

  renderTicket();
  tick();

  const vehicleInput = document.getElementById("vehicle-input");
  const fields = Object.fromEntries(
    KINDS.map((k) => [k, document.getElementById(FIELD_IDS[k])])
  );

  const syncFields = () => {
    for (const k of KINDS) {
      fields[k].value = readVehicle(k);
    }
    vehicleInput.value = readVehicle(kind);
  };

  syncFields();

  const applyVehicleChange = (fieldKind, value) => {
    const prev = readVehicle(fieldKind);
    const next = writeVehicle(fieldKind, value);
    syncFields();
    if (fieldKind === kind && next !== prev) {
      renewTicket();
    }
    return next;
  };

  vehicleInput.addEventListener("input", () => {
    vehicleInput.value = digitsOnly(vehicleInput.value);
  });

  vehicleInput.addEventListener("blur", () => {
    applyVehicleChange(kind, vehicleInput.value);
  });

  vehicleInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      vehicleInput.blur();
    }
  });

  for (const fieldKind of KINDS) {
    const field = fields[fieldKind];
    field.addEventListener("input", () => {
      field.value = digitsOnly(field.value);
    });
    field.addEventListener("blur", () => {
      applyVehicleChange(fieldKind, field.value);
    });
  }

  const overlay = document.getElementById("overlay");
  document.getElementById("info-btn").addEventListener("click", () => {
    syncFields();
    overlay.classList.add("is-open");
  });
  document.getElementById("close-info").addEventListener("click", () => {
    for (const fieldKind of KINDS) {
      applyVehicleChange(fieldKind, fields[fieldKind].value);
    }
    overlay.classList.remove("is-open");
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.classList.remove("is-open");
  });

  const otherTickets = document.getElementById("other-tickets");
  otherTickets.innerHTML = KINDS.filter((k) => k !== kind)
    .map(
      (k) =>
        `<a class="sheet-link" href="${PAGES[k]}">Квиток: ${LABELS[k]}</a>`
    )
    .join("");
}

init();