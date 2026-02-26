document.addEventListener("DOMContentLoaded", () => {

  const LS_SECTOR = "warehouse_sector_v2";
  const LS_RECENT = "warehouse_recent_v2";
  const LS_FAV = "warehouse_fav_v2";

  let data = { sectors: {}, employees: [] };
  let currentSector = null;
  let currentMode = "cells";
  let currentItem = null;

  // ---- DOM ----
  const sectorScreen = document.getElementById("sectorScreen");
  const mainScreen = document.getElementById("mainScreen");
  const sectorButtons = document.getElementById("sectorButtons");
  const sectorTitle = document.getElementById("sectorTitle");
  const changeSectorBtn = document.getElementById("changeSectorBtn");

  const modeCells = document.getElementById("modeCells");
  const modeEmployees = document.getElementById("modeEmployees");
  const modeFavorites = document.getElementById("modeFavorites");

  const searchInput = document.getElementById("searchInput");
  const results = document.getElementById("results");

  const barcodeCard = document.getElementById("barcodeCard");
  const barcodeName = document.getElementById("barcodeName");
  const barcode = document.getElementById("barcode");

  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const fullscreen = document.getElementById("fullscreen");
  const fullscreenBarcode = document.getElementById("fullscreenBarcode");

  const favoriteBtn = document.getElementById("favoriteBtn");

  const favoritesPanel = document.getElementById("favoritesPanel");
  const favoritesDiv = document.getElementById("favorites");

  const recentDiv = document.getElementById("recent");

  function normalize(str) {
    return (str || "").toUpperCase().trim();
  }

  // ---- CSV parser (quotes-aware, handles "" escaping) ----
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let value = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];

      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (c === "," && !inQuotes) {
        row.push(value);
        value = "";
        continue;
      }

      if ((c === "\n" || c === "\r") && !inQuotes) {
        if (value !== "" || row.length) {
          row.push(value);
          rows.push(row);
          row = [];
          value = "";
        }
        continue;
      }

      value += c;
    }

    if (value !== "" || row.length) {
      row.push(value);
      rows.push(row);
    }

    return rows;
  }

  async function loadCSV() {
    const resp = await fetch("location.csv"); // SW cache can serve offline
    const text = await resp.text();
    const rows = parseCSV(text);

    const headers = rows[0].map(h => (h || "").toLowerCase());
    const idxName = headers.indexOf("locationname");
    const idxBarcode = headers.indexOf("locationbarcode");
    const idxRoute = headers.indexOf("routezone_id");

    const sectors = {};
    const employees = [];

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];

      const name = cols[idxName];
      const barcodeVal = cols[idxBarcode];
      const route = cols[idxRoute];

      if (!name || !barcodeVal) continue;

      if (route === "2") {
        employees.push({ name, barcode: barcodeVal });
      } else {
        const sector = name[0];
        if (!sectors[sector]) sectors[sector] = [];
        sectors[sector].push({ name, barcode: barcodeVal });
      }
    }

    data = { sectors, employees };
  }

  // ---- Favorites ----
  function getFav() {
    try { return JSON.parse(localStorage.getItem(LS_FAV) || "[]"); }
    catch { return []; }
  }
  function setFav(arr) {
    localStorage.setItem(LS_FAV, JSON.stringify(arr));
  }
  function isFav(item) {
    return getFav().some(x => x.name === item.name);
  }
  function updateFavoriteButton() {
    if (!favoriteBtn || !currentItem) return;
    favoriteBtn.textContent = isFav(currentItem) ? "⭐ В избранном" : "⭐ В избранное";
  }
  function toggleFav(item) {
    let arr = getFav();
    if (arr.some(x => x.name === item.name)) {
      arr = arr.filter(x => x.name !== item.name);
    } else {
      arr.push({ name: item.name, barcode: item.barcode });
    }
    setFav(arr);
    renderFavorites();
    updateFavoriteButton();
  }
  function renderFavorites() {
    if (!favoritesDiv) return;
    favoritesDiv.innerHTML = "";

    const arr = getFav();
    if (arr.length === 0) {
      const empty = document.createElement("div");
      empty.className = "small";
      empty.textContent = "Пока пусто";
      favoritesDiv.appendChild(empty);
      return;
    }

    arr.slice()
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .forEach(item => {
        const div = document.createElement("div");
        div.className = "result";
        div.textContent = item.name;
        div.onclick = () => showBarcode(item);
        favoritesDiv.appendChild(div);
      });
  }

  // ---- Recent ----
  function addRecent(item) {
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(LS_RECENT) || "[]"); } catch {}
    arr = arr.filter(x => x.name !== item.name);
    arr.unshift({ name: item.name, barcode: item.barcode });
    arr = arr.slice(0, 10);
    localStorage.setItem(LS_RECENT, JSON.stringify(arr));
    renderRecent();
  }
  function renderRecent() {
    if (!recentDiv) return;
    recentDiv.innerHTML = "";

    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(LS_RECENT) || "[]"); } catch {}
    arr.forEach(item => {
      const div = document.createElement("div");
      div.className = "result";
      div.textContent = item.name;
      div.onclick = () => showBarcode(item);
      recentDiv.appendChild(div);
    });
  }

  // ---- Mode switching ----
  function setMode(mode) {
    currentMode = mode;

    if (results) results.innerHTML = "";

    // show/hide favorites panel
    if (favoritesPanel) favoritesPanel.classList.add("hidden");

    if (mode === "favorites") {
      if (searchInput) searchInput.value = "";
      if (favoritesPanel) favoritesPanel.classList.remove("hidden");
      renderFavorites();
      if (searchInput) searchInput.blur();
    } else {
      if (searchInput) searchInput.focus();
    }
  }

  // ---- UI ----
  function showSectorSelect() {
    sectorButtons.innerHTML = "";
    Object.keys(data.sectors).sort().forEach(sec => {
      const btn = document.createElement("button");
      btn.textContent = sec;
      btn.onclick = () => {
        currentSector = sec;
        localStorage.setItem(LS_SECTOR, sec);
        showMain();
      };
      sectorButtons.appendChild(btn);
    });
  }

  function showMain() {
    sectorScreen.classList.add("hidden");
    mainScreen.classList.remove("hidden");
    sectorTitle.textContent = "Сектор " + currentSector;

    renderFavorites();
    renderRecent();

    setMode("cells");
  }

  function showBarcode(item) {
    currentItem = item;

    if (barcodeCard) barcodeCard.classList.remove("hidden");
    if (barcodeName) barcodeName.textContent = item.name;

    JsBarcode(barcode, item.barcode, {
      format: "CODE128",
      width: 3,
      height: 100,
      displayValue: true
    });

    addRecent(item);

    if (fullscreenBtn) fullscreenBtn.onclick = () => openFullscreen(item.barcode);

    if (favoriteBtn) {
      updateFavoriteButton();
      favoriteBtn.onclick = () => toggleFav(item);
    }

    // ШК всегда сверху
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openFullscreen(code) {
    if (!fullscreen) return;
    fullscreen.style.display = "flex";
    JsBarcode(fullscreenBarcode, code, {
      format: "CODE128",
      width: 4,
      height: 180,
      displayValue: true
    });
  }

  window.closeFullscreen = function () {
    if (!fullscreen) return;
    fullscreen.style.display = "none";
  };

  // ---- Handlers ----
  if (changeSectorBtn) {
    changeSectorBtn.onclick = () => {
      localStorage.removeItem(LS_SECTOR);
      location.reload();
    };
  }

  if (modeCells) modeCells.onclick = () => setMode("cells");
  if (modeEmployees) modeEmployees.onclick = () => setMode("employees");
  if (modeFavorites) modeFavorites.onclick = () => setMode("favorites");

  if (searchInput) {
    searchInput.oninput = () => {
      if (currentMode === "favorites") return;

      const query = normalize(searchInput.value);
      if (results) results.innerHTML = "";
      if (query.length < 1) return;

      let list = [];
      if (currentMode === "cells") {
        const sectorList = data.sectors[currentSector] || [];
        list = sectorList.filter(x => normalize(x.name).includes(query)).slice(0, 20);
      } else if (currentMode === "employees") {
        list = data.employees.filter(x => normalize(x.name).includes(query)).slice(0, 20);
      }

      list.forEach(item => {
        const div = document.createElement("div");
        div.className = "result";
        div.textContent = item.name;
        div.onclick = () => showBarcode(item);
        results.appendChild(div);
      });
    };
  }

  // ---- Start ----
  (async function init() {
    await loadCSV();

    const savedSector = localStorage.getItem(LS_SECTOR);
    if (savedSector) {
      currentSector = savedSector;
      showMain();
    } else {
      showSectorSelect();
    }
  })();

});
