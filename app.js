// app.js — авто-загрузка location.csv (locationname -> locationbarcode) + офлайн через localStorage + генерация Code128

const LS_KEY = "loc2barcode_v1";
const LS_META = "loc2barcode_meta_v1"; // для даты обновления

const elLoc = document.getElementById("loc");
const elBtn = document.getElementById("btn");
const elClear = document.getElementById("clear");
const elRefresh = document.getElementById("refresh");
const elStatus = document.getElementById("status");
const elCode = document.getElementById("code");
const elErr = document.getElementById("err");
const elSvg = document.getElementById("barcode");

// -------------------- storage --------------------

function loadDict() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDict(dict) {
  localStorage.setItem(LS_KEY, JSON.stringify(dict));
}

function saveMeta(meta) {
  localStorage.setItem(LS_META, JSON.stringify(meta || {}));
}

function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem(LS_META) || "{}");
  } catch {
    return {};
  }
}

// -------------------- helpers --------------------

function normalizeKey(str) {
  return (str || "")
    .replace(/\u00A0/g, " ")
    .trim()
    .toUpperCase();
}

function showStatus(msg, ok = true) {
  elStatus.textContent = msg;
  elStatus.className = "muted " + (ok ? "ok" : "bad");
}

function clearSvg(svgEl) {
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
}

function nowIso() {
  try { return new Date().toISOString(); } catch { return ""; }
}

// -------------------- barcode render --------------------

function renderBarcode(value) {
  elErr.textContent = "";
  elErr.className = "muted";
  elCode.textContent = value || "";

  clearSvg(elSvg);

  if (!value) return;

  try {
    JsBarcode(elSvg, value, {
      format: "CODE128",
      displayValue: true,
      width: 3,
      height: 100,
      margin: 20,
      fontSize: 16
    });
  } catch (e) {
    elErr.textContent = "Ошибка генерации штрихкода: " + (e?.message || e);
    elErr.className = "muted bad";
  }
}

// -------------------- CSV parsing --------------------
// CSV в твоём формате: много колонок, в т.ч. "locationname","locationbarcode",...
// Разделитель: запятая. Поддержка кавычек и экранирования "".

function parseCSV(text) {
  const src = (text || "").replace(/\r/g, "");

  function parseRows(s) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < s.length; i++) {
      const c = s[i];

      if (c === '"') {
        if (inQuotes && s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (c === "," && !inQuotes) {
        row.push(field);
        field = "";
        continue;
      }

      if (c === "\n" && !inQuotes) {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        continue;
      }

      field += c;
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  const rows = parseRows(src).filter(r => r.some(x => (x || "").trim() !== ""));
  if (rows.length === 0) return { dict: {}, count: 0, error: "Пустой CSV" };

  const header = rows[0].map(x => (x || "").trim().toLowerCase());
  const idxLocName = header.indexOf("locationname");
  const idxBarcode = header.indexOf("locationbarcode");

  if (idxLocName === -1 || idxBarcode === -1) {
    return { dict: {}, count: 0, error: "Не найдены колонки locationname/locationbarcode" };
  }

  const dict = {};
  let count = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const locationRaw = (r[idxLocName] || "").trim();
    const barcodeRaw = (r[idxBarcode] || "").trim();

    if (!locationRaw || !barcodeRaw) continue;

    const location = normalizeKey(locationRaw); // ключи храним нормализованными
    dict[location] = barcodeRaw;
    count++;
  }

  return { dict, count, error: "" };
}

// -------------------- auto-load CSV --------------------

async function autoLoadCSV({ silent = false } = {}) {
  try {
    const resp = await fetch("location.csv", { cache: "no-store" });
    if (!resp.ok) throw new Error("HTTP " + resp.status);

    const text = await resp.text();
    const res = parseCSV(text);

    if (res.error || res.count === 0) {
      if (!silent) showStatus("CSV загружен, но не распознан (нет locationname/locationbarcode).", false);
      return false;
    }

    saveDict(res.dict);
    saveMeta({ updated_at: nowIso(), count: res.count });

    if (!silent) showStatus(`Справочник обновлён автоматически: ${res.count} записей.`, true);
    return true;
  } catch (e) {
    const cnt = Object.keys(loadDict()).length;
    const meta = loadMeta();
    const when = meta.updated_at ? ` (последнее обновление: ${meta.updated_at})` : "";

    if (cnt > 0) {
      if (!silent) showStatus(`Сеть недоступна. Работаю офлайн: ${cnt} записей${when}.`, true);
      return true;
    }

    if (!silent) showStatus("Не удалось загрузить справочник (и локально он пуст).", false);
    return false;
  }
}

// -------------------- find --------------------

function findAndShow() {
  const dict = loadDict();
  const key = normalizeKey(elLoc.value);

  if (!key) {
    showStatus("Введите ячейку.", false);
    renderBarcode("");
    return;
  }

  const code = dict[key];

  if (!code) {
    showStatus(`Не найдено: ${key}`, false);
    renderBarcode("");
    return;
  }

  showStatus(`Найдено: ${key} → ${code}`, true);
  renderBarcode(code);
}

// -------------------- UI events --------------------

elBtn.addEventListener("click", findAndShow);

elLoc.addEventListener("keydown", (e) => {
  if (e.key === "Enter") findAndShow();
});

elClear.addEventListener("click", () => {
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_META);
  showStatus("Справочник очищен.", true);
  renderBarcode("");
});

elRefresh.addEventListener("click", async () => {
  await autoLoadCSV({ silent: false });
});

// -------------------- init --------------------

(async function init() {
  // service worker (офлайн-кэш самого приложения)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  // при запуске: сначала пробуем подтянуть свежий CSV, если сети нет — используем локальный
  await autoLoadCSV({ silent: false });

  // если справочник уже есть — пользователь может сразу искать
  const cnt = Object.keys(loadDict()).length;
  if (cnt > 0) {
    // ничего
  } else {
    renderBarcode("");
  }
})();