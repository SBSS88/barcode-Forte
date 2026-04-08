document.addEventListener("DOMContentLoaded", () => {
  const LS_SECTOR = "warehouse_sector_v8";
  const LS_RECENT = "warehouse_recent_v8";
  const LS_FAV = "warehouse_fav_v8";

  let data = { sectors: {}, employees: [], allCells: [] };
  let currentSector = null;
  let currentMode = "cells";
  let currentItem = null;

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
  const qrCanvas = document.getElementById("qrCanvas");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const fullscreen = document.getElementById("fullscreen");
  const fullscreenQR = document.getElementById("fullscreenQR");
  const fullscreenName = document.getElementById("fullscreenName");
  const favoriteBtn = document.getElementById("favoriteBtn");
  const favoritesPanel = document.getElementById("favoritesPanel");
  const favoritesDiv = document.getElementById("favorites");
  const recentDiv = document.getElementById("recent");

  function normalize(str) {
    return (str || "").toUpperCase().trim();
  }

  function sortByRuName(list) {
    return list.sort((a, b) =>
      a.name.localeCompare(b.name, "ru", {
        numeric: true,
        sensitivity: "base"
      })
    );
  }

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

  function detectGroup(name) {
    const n = normalize(name);

    if (n.includes("СЕКТОР")) return "Сектор";
    if (n.includes("БУФЕР")) return "Буфер";
    if (n.includes("ТРАНЗИТ")) return "Транзит";
    if (n.includes("ДОК")) return "Док";

    return null;
  }

  async function loadCSV() {
    const resp = await fetch("location.csv");

    if (!resp.ok) {
      throw new Error("Не удалось загрузить location.csv");
    }

    const text = await resp.text();
    const rows = parseCSV(text);

    if (!rows.length) {
      throw new Error("location.csv пустой");
    }

    const headers = rows[0].map(h => (h || "").toLowerCase().trim());

    const idxName = headers.indexOf("locationname");
    const idxBarcode = headers.indexOf("locationbarcode");
    const idxRoute = headers.indexOf("routezone_id");

    if (idxName === -1 || idxBarcode === -1 || idxRoute === -1) {
      throw new Error("В location.csv должны быть колонки: locationname, locationbarcode, routezone_id");
    }

    const sectors = {};
    const employees = [];
    const allCells = [];

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const name = (cols[idxName] || "").trim();
      const barcodeVal = (cols[idxBarcode] || "").trim();
      const route = (cols[idxRoute] || "").trim();

      if (!name || !barcodeVal) continue;

      if (route === "2") {
        employees.push({ name, barcode: barcodeVal });
        continue;
      }

      const commonItem = { name, barcode: barcodeVal };

      allCells.push(commonItem);

      const group = detectGroup(name);
      if (!group) continue;

      const groupedItem = { name, barcode: barcodeVal, group };

      if (!sectors[group]) sectors[group] = [];
      sectors[group].push(groupedItem);
    }

    Object.keys(sectors).forEach(group => {
      sortByRuName(sectors[group]);
    });

    sortByRuName(employees);
    sortByRuName(allCells);

    data = { sectors, employees, allCells };
  }

  function generateQR(container, code, size) {
    container.innerHTML = "";

    new QRCode(container, {
      text: code,
      width: size,
      height: size,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  function getFav() {
    try {
      return JSON.parse(localStorage.getItem(LS_FAV) || "[]");
    } catch {
      return [];
    }
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

    arr
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "ru", { numeric: true, sensitivity: "base" }))
      .forEach(item => {
        const div = document.createElement("div");
        div.className = "result";
        div.textContent = item.name;
        div.onclick = () => showBarcode(item);
        favoritesDiv.appendChild(div);
      });
  }

  function addRecent(item) {
    let arr = [];

    try {
      arr = JSON.parse(localStorage.getItem(LS_RECENT) || "[]");
    } catch {}

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
    try {
      arr = JSON.parse(localStorage.getItem(LS_RECENT) || "[]");
    } catch {}

    arr.forEach(item => {
      const div = document.createElement("div");
      div.className = "result";
      div.textContent = item.name;
      div.onclick = () => showBarcode(item);
      recentDiv.appendChild(div);
    });
  }

  function renderList(list) {
    if (!results) return;
    results.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "result";
      empty.textContent = "Ничего не найдено";
      results.appendChild(empty);
      return;
    }

    list.forEach(item => {
      const div = document.createElement("div");
      div.className = "result";
      div.textContent = item.name;
      div.onclick = () => showBarcode(item);
      results.appendChild(div);
    });
  }

  function getCurrentList() {
    if (currentMode === "cells") {
      if (currentSector === "__GLOBAL_SEARCH__") {
        return data.allCells.slice();
      }
      return (data.sectors[currentSector] || []).slice();
    }

    if (currentMode === "employees") {
      return data.employees.slice();
    }

    return [];
  }

  function updateResults() {
    if (currentMode === "favorites") {
      if (results) results.innerHTML = "";
      return;
    }

    const query = normalize(searchInput ? searchInput.value : "");
    let list = getCurrentList();

    if (currentSector === "__GLOBAL_SEARCH__") {
      if (!query) {
        renderList([]);
        return;
      }
      list = list.filter(x => normalize(x.name).includes(query));
    } else {
      if (query) {
        list = list.filter(x => normalize(x.name).includes(query));
      }
    }

    list = list
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "ru", { numeric: true, sensitivity: "base" }))
      .slice(0, 200);

    renderList(list);
  }

  function updateSearchPlaceholder() {
    if (!searchInput) return;

    if (currentSector === "__GLOBAL_SEARCH__") {
      searchInput.placeholder = "Введите название ячейки для поиска по всем значениям";
      return;
    }

    if (currentMode === "employees") {
      searchInput.placeholder = "Поиск сотрудника...";
      return;
    }

    searchInput.placeholder = "Поиск...";
  }

  function setMode(mode) {
    currentMode = mode;

    if (favoritesPanel) favoritesPanel.classList.add("hidden");
    updateSearchPlaceholder();

    if (mode === "favorites") {
      if (searchInput) searchInput.value = "";
      if (results) results.innerHTML = "";
      if (favoritesPanel) favoritesPanel.classList.remove("hidden");
      renderFavorites();
      if (searchInput) searchInput.blur();
    } else {
      updateResults();
      if (searchInput) searchInput.focus();
    }
  }

  function openGroup(groupName) {
    currentSector = groupName;
    localStorage.setItem(LS_SECTOR, groupName);
    showMain();
  }

  function showSectorSelect() {
    sectorButtons.innerHTML = "";

    const groups = Object.keys(data.sectors)
      .sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }));

    groups.forEach(sec => {
      const btn = document.createElement("button");
      btn.textContent = sec;
      btn.onclick = () => openGroup(sec);
      sectorButtons.appendChild(btn);
    });

    const searchBtn = document.createElement("button");
    searchBtn.textContent = "Поиск по названию";
    searchBtn.onclick = () => openGroup("__GLOBAL_SEARCH__");
    sectorButtons.appendChild(searchBtn);
  }

  function showMain() {
    sectorScreen.classList.add("hidden");
    mainScreen.classList.remove("hidden");

    sectorTitle.textContent =
      currentSector === "__GLOBAL_SEARCH__" ? "Поиск по названию" : currentSector;

    renderFavorites();
    renderRecent();
    updateSearchPlaceholder();
    setMode("cells");
  }

  function showBarcode(item) {
    currentItem = item;

    if (barcodeCard) barcodeCard.classList.remove("hidden");
    if (barcodeName) barcodeName.textContent = item.name;

    generateQR(qrCanvas, item.barcode, 260);
    addRecent(item);

    if (fullscreenBtn) fullscreenBtn.onclick = () => openFullscreen(item);

    if (favoriteBtn) {
      updateFavoriteButton();
      favoriteBtn.onclick = () => toggleFav(item);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openFullscreen(item) {
    if (!fullscreen) return;

    fullscreen.style.display = "flex";

    if (fullscreenName) fullscreenName.textContent = item.name;

    const size = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9, 500);
    generateQR(fullscreenQR, item.barcode, size);
  }

  window.closeFullscreen = function () {
    if (!fullscreen) return;
    fullscreen.style.display = "none";
  };

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
      updateResults();
    };
  }

  (async function init() {
    try {
      await loadCSV();

      const savedSector = localStorage.getItem(LS_SECTOR);

      if (
        savedSector &&
        (data.sectors[savedSector] || savedSector === "__GLOBAL_SEARCH__")
      ) {
        currentSector = savedSector;
        showMain();
      } else {
        showSectorSelect();
      }
    } catch (e) {
      console.error(e);
      alert("Ошибка загрузки данных: " + e.message);
    }
  })();
});
