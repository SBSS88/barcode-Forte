document.addEventListener("DOMContentLoaded", () => {

const LS_DATA = "warehouse_data_v3";
const LS_SECTOR = "warehouse_sector_v3";
const LS_RECENT = "warehouse_recent_v3";

let data = { sectors:{}, employees:[] };
let currentSector = null;
let currentMode = "cells";

const sectorScreen = document.getElementById("sectorScreen");
const mainScreen = document.getElementById("mainScreen");
const sectorButtons = document.getElementById("sectorButtons");
const sectorTitle = document.getElementById("sectorTitle");
const changeSectorBtn = document.getElementById("changeSectorBtn");
const modeCells = document.getElementById("modeCells");
const modeEmployees = document.getElementById("modeEmployees");
const searchInput = document.getElementById("searchInput");
const results = document.getElementById("results");
const barcodeCard = document.getElementById("barcodeCard");
const barcodeName = document.getElementById("barcodeName");
const barcode = document.getElementById("barcode");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const fullscreen = document.getElementById("fullscreen");
const fullscreenBarcode = document.getElementById("fullscreenBarcode");
const recentDiv = document.getElementById("recent");

function normalize(str){
  return (str||"").toUpperCase().trim();
}

/* ---------- НАДЁЖНЫЙ CSV ПАРСЕР ---------- */
function parseCSV(text){
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for(let i=0;i<text.length;i++){
    const char = text[i];

    if(char === '"'){
      if(inQuotes && text[i+1] === '"'){
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    }
    else if(char === ',' && !inQuotes){
      row.push(value);
      value = "";
    }
    else if((char === '\n' || char === '\r') && !inQuotes){
      if(value !== "" || row.length){
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      }
    }
    else{
      value += char;
    }
  }

  return rows;
}

/* ---------- ЗАГРУЗКА CSV ---------- */
async function loadCSV(){
  const resp = await fetch("location.csv",{cache:"no-store"});
  const text = await resp.text();
  const rows = parseCSV(text);

  const headers = rows[0].map(h=>h.toLowerCase());

  const idxName = headers.indexOf("locationname");
  const idxBarcode = headers.indexOf("locationbarcode");
  const idxRoute = headers.indexOf("routezone_id");

  data = { sectors:{}, employees:[] };

  for(let i=1;i<rows.length;i++){
    const cols = rows[i];

    const name = cols[idxName];
    const barcodeVal = cols[idxBarcode];
    const route = cols[idxRoute];

    if(!name || !barcodeVal) continue;

    if(route == "2"){
      data.employees.push({name, barcode: barcodeVal});
    } else {
      const sector = name[0];
      if(!data.sectors[sector]) data.sectors[sector] = [];
      data.sectors[sector].push({name, barcode: barcodeVal});
    }
  }

  localStorage.setItem(LS_DATA, JSON.stringify(data));
}

/* ---------- ИНИЦИАЛИЗАЦИЯ ---------- */
function init(){
  const saved = localStorage.getItem(LS_DATA);
  if(saved){
    data = JSON.parse(saved);
    start();
  } else {
    loadCSV().then(start);
  }
}

function start(){
  const savedSector = localStorage.getItem(LS_SECTOR);
  if(savedSector){
    currentSector = savedSector;
    showMain();
  } else {
    showSectorSelect();
  }
}

/* ---------- ВЫБОР СЕКТОРА ---------- */
function showSectorSelect(){
  sectorButtons.innerHTML="";
  Object.keys(data.sectors).sort().forEach(sec=>{
    const btn = document.createElement("button");
    btn.textContent = sec;
    btn.onclick = ()=>{
      currentSector = sec;
      localStorage.setItem(LS_SECTOR,sec);
      showMain();
    };
    sectorButtons.appendChild(btn);
  });
}

function showMain(){
  sectorScreen.classList.add("hidden");
  mainScreen.classList.remove("hidden");
  sectorTitle.textContent = "Сектор " + currentSector;
  renderRecent();
}

/* ---------- КНОПКИ ---------- */
if(changeSectorBtn){
  changeSectorBtn.onclick = ()=>{
    localStorage.removeItem(LS_SECTOR);
    location.reload();
  };
}

if(modeCells){
  modeCells.onclick = ()=>{
    currentMode="cells";
    searchInput.value="";
    results.innerHTML="";
  };
}

if(modeEmployees){
  modeEmployees.onclick = ()=>{
    currentMode="employees";
    searchInput.value="";
    results.innerHTML="";
  };
}

/* ---------- ПОИСК ---------- */
if(searchInput){
searchInput.oninput = ()=>{
  const query = normalize(searchInput.value);
  results.innerHTML="";
  if(query.length < 1) return;

  let list=[];

  if(currentMode==="cells"){
    const sectorList = data.sectors[currentSector] || [];
    list = sectorList
      .filter(x=>normalize(x.name).includes(query))
      .slice(0,20);
  }
  else{
    list = data.employees
      .filter(x=>normalize(x.name).includes(query))
      .slice(0,20);
  }

  list.forEach(item=>{
    const div = document.createElement("div");
    div.className="result";
    div.textContent=item.name;
    div.onclick=()=>showBarcode(item);
    results.appendChild(div);
  });
};
}

/* ---------- ПОКАЗ ШК ---------- */
function showBarcode(item){
  barcodeCard.classList.remove("hidden");
  barcodeName.textContent=item.name;

  JsBarcode(barcode,item.barcode,{
    format:"CODE128",
    width:3,
    height:100,
    displayValue:true
  });

  addRecent(item);

  if(fullscreenBtn){
    fullscreenBtn.onclick=()=>openFullscreen(item.barcode);
  }

  // 🔥 прокрутка вверх к штрихкоду
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- FULLSCREEN ---------- */
function openFullscreen(code){
  fullscreen.style.display="flex";
  JsBarcode(fullscreenBarcode,code,{
    format:"CODE128",
    width:4,
    height:180,
    displayValue:true
  });
}

window.closeFullscreen = function(){
  fullscreen.style.display="none";
}

/* ---------- ПОСЛЕДНИЕ ---------- */
function addRecent(item){
  let arr = JSON.parse(localStorage.getItem(LS_RECENT)||"[]");
  arr = arr.filter(x=>x.name!==item.name);
  arr.unshift(item);
  arr = arr.slice(0,10);
  localStorage.setItem(LS_RECENT,JSON.stringify(arr));
  renderRecent();
}

function renderRecent(){
  recentDiv.innerHTML="";
  const arr = JSON.parse(localStorage.getItem(LS_RECENT)||"[]");
  arr.forEach(item=>{
    const div=document.createElement("div");
    div.className="result";
    div.textContent=item.name;
    div.onclick=()=>showBarcode(item);
    recentDiv.appendChild(div);
  });
}

init();

});



