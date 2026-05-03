const savedSelect = document.getElementById("savedSelect");
const statusText = document.getElementById("statusText");
const producedValue = document.getElementById("producedValue");
const expireValue = document.getElementById("expireValue");
const elapsedValue = document.getElementById("elapsedValue");
const freshnessValue = document.getElementById("freshnessValue");
const backBtn = document.getElementById("backBtn");
const openModelBtn = document.getElementById("openModelBtn");

const initialSavedKey = new URLSearchParams(window.location.search).get("savedKey") || "";
const TARGET_RETENTION = 0.30;
const MS_DAY = 1000 * 60 * 60 * 24;

let regressionChart = null;

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

function buildHistoryItems() {
  const history = JSON.parse(localStorage.getItem("scanHistory") || "[]");
  return history.map((item, index) => ({
    ...item,
    __key: item.id ? `id:${item.id}` : `idx:${index}`,
    __index: index
  }));
}

function calcBaseShelf(prod, exp) {
  if (!prod || !exp) return 1;
  return Math.max(1, Math.ceil((exp - prod) / MS_DAY));
}

function calcK(baseShelf) {
  return -Math.log(TARGET_RETENTION) / Math.max(1, baseShelf);
}

function retention(day, k, factor) {
  return Math.exp(-k * factor * day);
}

function buildOptions(items) {
  savedSelect.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Select fruit record";
  savedSelect.appendChild(empty);

  items.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.__key;
    opt.textContent = `${item.fruit || "Fruit"} (${item.dateProduced || "-"})`;
    savedSelect.appendChild(opt);
  });

  if (initialSavedKey) {
    const hasOption = items.some((item) => item.__key === initialSavedKey);
    if (hasOption) savedSelect.value = initialSavedKey;
  }
}

function drawChart(item) {
  const prod = parseDMY(item.dateProduced);
  const exp = parseDMY(item.expireDate);
  if (!prod || !exp) {
    statusText.textContent = "Selected record is missing produced/expire date.";
    return;
  }

  const baseShelf = calcBaseShelf(prod, exp);
  const k = calcK(baseShelf);
  const labels = [];
  for (let i = 0; i <= baseShelf; i++) labels.push(i);

  const colors = {
    Vitamin_C_mg: "#34d399",
    Fiber_g: "#60a5fa",
    Total_Sugar_g: "#fbbf24",
    Protein_g: "#f472b6"
  };

  const datasets = Object.keys(nutrientFactors).map((key) => ({
    label: key.replace(/_/g, " "),
    data: labels.map((day) => retention(day, k, nutrientFactors[key])),
    borderColor: colors[key],
    backgroundColor: "transparent",
    borderWidth: 2,
    tension: 0.28,
    pointRadius: 0
  }));

  const ctx = document.getElementById("regressionChart").getContext("2d");
  if (regressionChart) regressionChart.destroy();
  regressionChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (c) => `${c.dataset.label}: ${(c.parsed.y * 100).toFixed(0)}%`
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
        x: {
          title: { display: true, text: "Days Since Produced" }
        }
      }
    }
  });

  const elapsed = Math.max(0, Math.floor((new Date() - prod) / MS_DAY));
  const freshness = retention(Math.min(elapsed, baseShelf), k, nutrientFactors.Vitamin_C_mg);

  producedValue.textContent = item.dateProduced || "-";
  expireValue.textContent = item.expireDate || "-";
  elapsedValue.textContent = `${elapsed} day(s)`;
  freshnessValue.textContent = `${Math.round(freshness * 100)}%`;
  statusText.textContent = `Curve generated from saved timeline (${baseShelf} day shelf window).`;
}

function refresh() {
  const items = buildHistoryItems();
  buildOptions(items);
  if (!savedSelect.value && items.length) {
    savedSelect.value = items[0].__key;
  }
  const selected = items.find((item) => item.__key === savedSelect.value);
  if (!selected) {
    statusText.textContent = "No saved record available.";
    producedValue.textContent = "-";
    expireValue.textContent = "-";
    elapsedValue.textContent = "-";
    freshnessValue.textContent = "-";
    if (regressionChart) {
      regressionChart.destroy();
      regressionChart = null;
    }
    return;
  }
  drawChart(selected);
}

savedSelect.addEventListener("change", refresh);
backBtn.addEventListener("click", () => {
  window.navigateWithTransition("history.html");
});
openModelBtn.addEventListener("click", () => {
  const key = savedSelect.value || "";
  window.navigateWithTransition(`freshness.html?savedKey=${encodeURIComponent(key)}`);
});

refresh();
