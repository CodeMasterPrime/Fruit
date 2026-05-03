const fruitSelect = document.getElementById("fruitSelect");
const savedSelect = document.getElementById("savedSelect");
const tempInput = document.getElementById("tempInput");
const humidityInput = document.getElementById("humidityInput");
const storageGroup = document.getElementById("storageGroup");

const baseShelfEl = document.getElementById("baseShelf");
const adjustedShelfEl = document.getElementById("adjustedShelf");
const vpdValueEl = document.getElementById("vpdValue");
const currentRetentionCard = document.getElementById("currentRetentionCard");
const currentRetentionEl = document.getElementById("currentRetention");
const recTempEl = document.getElementById("recTemp");
const recRhEl = document.getElementById("recRh");
const recLifeEl = document.getElementById("recLife");
const kValueEl = document.getElementById("kValue");
const q10ValueEl = document.getElementById("q10Value");
const savedNoteEl = document.getElementById("savedNote");

let fruits = [];
let postharvest = {};
let chart = null;
let storage = "room";
const initialSavedKey = new URLSearchParams(window.location.search).get("savedKey") || "";

const Q10_RANGES = [
  { max: 10, value: 3.25 }, // midpoint of 2.5–4.0
  { max: 20, value: 2.25 }, // midpoint of 2.0–2.5
  { max: 30, value: 1.75 }, // midpoint of 1.5–2.0
  { max: 40, value: 1.25 }  // midpoint of 1.0–1.5
];
const TARGET_RETENTION = 0.30; // retention at end of shelf life for k calibration
const nutrientFactors = {
  Vitamin_C_mg: 1.2,
  Fiber_g: 0.7,
  Total_Sugar_g: 0.9,
  Protein_g: 0.8
};

function parseDMY(dateStr) {
  if (!dateStr || dateStr === "-") return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function getHistoryWithKeys() {
  const history = JSON.parse(localStorage.getItem("scanHistory") || "[]");
  return history.map((item, index) => ({
    ...item,
    __key: item.id ? `id:${item.id}` : `idx:${index}`,
    __index: index
  }));
}

function findHistoryItemByKey(historyWithKeys, key) {
  if (!key) return null;
  return historyWithKeys.find((item) => item.__key === key) || null;
}

function toDMY(date) {
  return date.toLocaleDateString("en-GB");
}

function daysBetween(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function fmtRange(min, max, unit = "") {
  if (min == null || max == null) return "-";
  const value = min === max ? `${min}` : `${min}–${max}`;
  return unit ? `${value} ${unit}` : value;
}

// FAO-56 saturation vapor pressure equation (kPa)
function saturationVaporPressure(tempC) {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

function getVPD(tempC, rh) {
  const es = saturationVaporPressure(tempC);
  const ea = es * (rh / 100);
  return Math.max(0, es - ea);
}

function getQ10ForTemp(tempC) {
  const match = Q10_RANGES.find(r => tempC < r.max) || Q10_RANGES[Q10_RANGES.length - 1];
  return match.value;
}

function getQ10(tempC, refTempC) {
  const q10A = getQ10ForTemp(tempC);
  const q10B = getQ10ForTemp(refTempC);
  return (q10A + q10B) / 2;
}

function getRateFactor(temp, humidity, refTemp, refRh) {
  const q10 = getQ10(temp, refTemp);
  const tempRate = Math.pow(q10, (temp - refTemp) / 10);
  const vpd = getVPD(temp, humidity);
  const vpdRef = getVPD(refTemp, refRh);
  const humidityRate = Math.max(0.3, vpd / Math.max(0.01, vpdRef));
  return { rate: tempRate * humidityRate, vpd, q10 };
}

function retentionExp(day, k, rateFactor, nutrientFactor = 1) {
  return Math.exp(-k * rateFactor * nutrientFactor * day);
}

function buildChart(labels, datasets) {
  const ctx = document.getElementById("freshnessChart").getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y * 100).toFixed(0)}%`
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 1,
          ticks: { callback: (v) => `${Math.round(v * 100)}%` },
          title: { display: true, text: "Retention" }
        },
        x: { title: { display: true, text: "Days" } }
      }
    }
  });
}

function getSelectedFruit() {
  const id = fruitSelect.value;
  return fruits.find(f => String(f.No) === id);
}

function getPostharvest(fruit) {
  if (!fruit) return null;
  return postharvest[String(fruit.No)] || null;
}

function calcBaseShelf(fruit, rec) {
  if (rec && rec.storage_life_days_min != null && rec.storage_life_days_max != null) {
    return (rec.storage_life_days_min + rec.storage_life_days_max) / 2;
  }
  return fruit.ShelfLife_days || 1;
}

function calcK(baseShelf) {
  return -Math.log(TARGET_RETENTION) / Math.max(1, baseShelf);
}

function applyRecommended(fruit, rec) {
  if (!rec) return;
  const tempMid = (rec.temp_c_min + rec.temp_c_max) / 2;
  const rhMid = (rec.rh_min + rec.rh_max) / 2;
  tempInput.value = tempMid.toFixed(1);
  humidityInput.value = rhMid.toFixed(0);
}

function updateUI() {
  const fruit = getSelectedFruit();
  if (!fruit) return;

  const rec = getPostharvest(fruit);
  if (rec) {
    recTempEl.textContent = fmtRange(rec.temp_c_min, rec.temp_c_max, "°C");
    recRhEl.textContent = fmtRange(rec.rh_min, rec.rh_max, "%");
    recLifeEl.textContent = fmtRange(rec.storage_life_days_min, rec.storage_life_days_max, "days");
  } else {
    recTempEl.textContent = "-";
    recRhEl.textContent = "-";
    recLifeEl.textContent = "-";
  }

  const refTemp = rec ? (rec.temp_c_min + rec.temp_c_max) / 2 : 20;
  const refRh = rec ? (rec.rh_min + rec.rh_max) / 2 : 60;

  const temp = Number(tempInput.value || refTemp);
  const humidity = Number(humidityInput.value || refRh);

  const { rate, vpd, q10 } = getRateFactor(temp, humidity, refTemp, refRh);
  const baseShelf = calcBaseShelf(fruit, rec);
  const k = calcK(baseShelf);
  const adjustedShelf = Math.max(1, baseShelf / rate);

  baseShelfEl.textContent = `${baseShelf.toFixed(1)} days`;
  adjustedShelfEl.textContent = `${adjustedShelf.toFixed(1)} days`;
  vpdValueEl.textContent = `${vpd.toFixed(3)} kPa`;
  kValueEl.textContent = k.toFixed(4);
  if (q10ValueEl) q10ValueEl.textContent = q10.toFixed(2);

  const labels = [];
  const datasetList = [];
  const colors = {
    Vitamin_C_mg: "#34d399",
    Fiber_g: "#60a5fa",
    Total_Sugar_g: "#fbbf24",
    Protein_g: "#f472b6"
  };

  const maxDays = Math.ceil(adjustedShelf * 1.2);
  for (let i = 0; i <= maxDays; i++) labels.push(i);

  Object.keys(nutrientFactors).forEach(key => {
    const factor = nutrientFactors[key];
    const data = labels.map(day => retentionExp(day, k, rate, factor));
    datasetList.push({
      label: key.replace(/_/g, " ").replace("mg", "(mg)").replace("g", "(g)"),
      data,
      borderColor: colors[key],
      backgroundColor: "transparent",
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 0
    });
  });

  buildChart(labels, datasetList);

  updateSavedRetention(k, rate);
}

function updateSavedRetention(k, rate) {
  const savedKey = savedSelect.value;
  if (!savedKey) {
    currentRetentionEl.textContent = "-";
    currentRetentionCard.style.display = "none";
    if (savedNoteEl) savedNoteEl.textContent = "Select a saved item to update expiry date by storage.";
    return;
  }
  const history = getHistoryWithKeys();
  const item = findHistoryItemByKey(history, savedKey);
  if (!item) return;
  const prod = parseDMY(item.dateProduced);
  const day = prod ? Math.max(0, daysBetween(prod, new Date())) : 0;
  const todayRetention = retentionExp(day, k, rate, nutrientFactors.Vitamin_C_mg);
  currentRetentionEl.textContent = `${Math.round(todayRetention * 100)}%`;
  currentRetentionCard.style.display = "block";
}

function updateSavedExpiry() {
  const savedKey = savedSelect.value;
  if (!savedKey) return;
  const history = JSON.parse(localStorage.getItem("scanHistory") || "[]");
  const historyWithKeys = history.map((item, index) => ({
    ...item,
    __key: item.id ? `id:${item.id}` : `idx:${index}`,
    __index: index
  }));
  const selected = findHistoryItemByKey(historyWithKeys, savedKey);
  const item = selected ? history[selected.__index] : null;
  const fruit = getSelectedFruit();
  if (!item || !fruit) return;

  const rec = getPostharvest(fruit);
  const refTemp = rec ? (rec.temp_c_min + rec.temp_c_max) / 2 : 20;
  const refRh = rec ? (rec.rh_min + rec.rh_max) / 2 : 60;
  const temp = Number(tempInput.value || refTemp);
  const humidity = Number(humidityInput.value || refRh);
  const { rate } = getRateFactor(temp, humidity, refTemp, refRh);
  const baseShelf = calcBaseShelf(fruit, rec);
  const adjustedShelf = Math.max(1, baseShelf / rate);

  const prod = parseDMY(item.dateProduced);
  if (!prod) return;
  const newExpiry = new Date(prod);
  newExpiry.setDate(newExpiry.getDate() + Math.round(adjustedShelf));
  item.expireDate = toDMY(newExpiry);
  item.storageLocation = storage;

  localStorage.setItem("scanHistory", JSON.stringify(history));
  if (savedNoteEl) {
    savedNoteEl.textContent = `Updated expiry to ${item.expireDate} (${storage}).`;
  }
}

function setStorage(value, applyPreset = true) {
  storage = value;
  [...storageGroup.querySelectorAll(".seg")].forEach(btn => {
    btn.classList.toggle("active", btn.dataset.value === value);
  });

  if (applyPreset) {
    if (value === "room") {
      tempInput.value = 20;
      humidityInput.value = 60;
    } else if (value === "fridge") {
      tempInput.value = 4;
      humidityInput.value = 90;
    } else if (value === "freezer") {
      tempInput.value = -18;
      humidityInput.value = 90;
    }
  }

  updateUI();
  updateSavedExpiry();
}

function loadSavedItems() {
  const history = getHistoryWithKeys();
  history.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.__key;
    opt.textContent = `${item.fruit || "Fruit"} (${item.dateProduced || "-"})`;
    savedSelect.appendChild(opt);
  });
}

function syncFromSavedSelection() {
  const history = getHistoryWithKeys();
  const item = findHistoryItemByKey(history, savedSelect.value);
  if (!item) return;
  const match = fruits.find(f => f.English_Name.trim().toLowerCase() === (item.fruit || "").trim().toLowerCase());
  if (match) fruitSelect.value = String(match.No);
  const rec = getPostharvest(match);
  if (rec) applyRecommended(match, rec);
  if (item.storageLocation) {
    setStorage(item.storageLocation, false);
  }
}

async function init() {
  try {
    const res = await fetch("fruits.json");
    fruits = await res.json();
    const res2 = await fetch("postharvest.json");
    postharvest = await res2.json();
  } catch (e) {
    console.error(e);
  }

  fruitSelect.innerHTML = "";
  fruits.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.No;
    opt.textContent = f.English_Name.trim();
    fruitSelect.appendChild(opt);
  });

  loadSavedItems();
  if (initialSavedKey) {
    const hasOption = [...savedSelect.options].some((opt) => opt.value === initialSavedKey);
    if (hasOption) savedSelect.value = initialSavedKey;
  }
  syncFromSavedSelection();

  const firstFruit = fruits[0];
  const rec = getPostharvest(firstFruit);
  if (rec) applyRecommended(firstFruit, rec);

  setStorage("room", false);
  updateUI();
}

fruitSelect.addEventListener("change", () => {
  const fruit = getSelectedFruit();
  const rec = getPostharvest(fruit);
  if (rec) applyRecommended(fruit, rec);
  updateUI();
  updateSavedExpiry();
});

savedSelect.addEventListener("change", () => {
  syncFromSavedSelection();
  updateUI();
  updateSavedExpiry();
});

tempInput.addEventListener("input", updateUI);
humidityInput.addEventListener("input", updateUI);

storageGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".seg");
  if (!btn) return;
  setStorage(btn.dataset.value);
});

init();
