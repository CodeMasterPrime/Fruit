const fridgeGrid = document.getElementById("fridgeGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const sortSelect = document.getElementById("sortSelect");
const statusText = document.getElementById("statusText");

const sumWeight = document.getElementById("sumWeight");
const sumCalories = document.getElementById("sumCalories");
const sumProtein = document.getElementById("sumProtein");
const sumCarb = document.getElementById("sumCarb");
const sumFiber = document.getElementById("sumFiber");
const sumNds = document.getElementById("sumNds");
const sumItems = document.getElementById("sumItems");
const sumStored = document.getElementById("sumStored");
const sumExpiring = document.getElementById("sumExpiring");

const detailModal = document.getElementById("detailModal");
const detailTitle = document.getElementById("detailTitle");
const detailDates = document.getElementById("detailDates");
const detailStatus = document.getElementById("detailStatus");
const detailGrid = document.getElementById("detailGrid");
const detailImage = document.getElementById("detailImage");
const closeModal = document.getElementById("closeModal");
const emptyScanBtn = document.getElementById("emptyScanBtn");

const backBtn = document.getElementById("backBtn");
const historyBtn = document.getElementById("historyBtn");

const MS_DAY = 1000 * 60 * 60 * 24;
const NUTRIENT_KEYS = [
  "Energy_kcal","Carbohydrate_g","Protein_g","Total_Sugar_g","Fiber_g","Fat_g",
  "Vitamin_A_mg","Vitamin_B6_mg","Vitamin_C_mg","Vitamin_D_mg","Sodium_mg","Potassium_mg"
];

function getFruitImage(nutritionRaw, fruitName) {
  const byNo = {
    1: "apple(g).png",
    2: "apple(r).png",
    3: "avocado.png",
    4: "banana.png",
    5: "blackberry.png",
    6: "blueberry.png",
    7: "cantaloupe.png",
    8: "cherry.png",
    9: "coconut(j).png",
    10: "coconut(m).png",
    11: "cranberry.png",
    12: "dragon fruit_.png",
    13: "durian.png",
    14: "grapes(g).png",
    15: "grapes(p).png",
    16: "guava.png",
    17: "jackfruit.png",
    18: "kiwi.png",
    19: "lemon.png",
    21: "lemon(j).png",
    22: "longan.png",
    23: "Lychee.png",
    24: "mango(r).png",
    25: "mangosteen.png",
    26: "mango(u).png",
    28: "orange .png",
    29: "papaya.png",
    30: "passionfruit.png",
    31: "peach.png",
    32: "pear.png",
    33: "pineapple.png",
    34: "plum.png",
    35: "pomegranate .png",
    36: "rambutan.png",
    37: "rasberry.png",
    38: "strawberry.png",
    39: "sugarapple.png",
    40: "watermelon.png"
  };

  if (nutritionRaw && typeof nutritionRaw.No === "number" && byNo[nutritionRaw.No]) {
    return byNo[nutritionRaw.No];
  }

  const name = (fruitName || "").toLowerCase().trim();
  if (name.includes("apple")) return "apple(g).png";
  if (name.includes("avocado")) return "avocado.png";
  if (name.includes("banana")) return "banana.png";
  if (name.includes("orange")) return "orange .png";
  if (name.includes("mango")) return "mango(r).png";
  if (name.includes("lemon") || name.includes("lime")) return "lemon.png";
  if (name.includes("grape")) return "grapes(p).png";
  if (name.includes("kiwi")) return "kiwi.png";
  if (name.includes("strawberry")) return "strawberry.png";
  if (name.includes("watermelon")) return "watermelon.png";
  return "";
}

function parseDMY(dateStr) {
  if (!dateStr || dateStr === "-") return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function getDecayFactor(item) {
  const prod = parseDMY(item.dateProduced);
  const exp = parseDMY(item.expireDate);
  if (!prod || !exp) return 1;
  const total = (exp - prod) / MS_DAY;
  if (total <= 0) return 0;
  const remaining = (exp - new Date()) / MS_DAY;
  return Math.max(0, Math.min(1, remaining / total));
}

function getWeightFactor(item) {
  const w = Number(item.weight_g);
  return Number.isFinite(w) && w > 0 ? w / 100 : 1;
}

function adjustNutrition(nutrition, factor, weightFactor) {
  const out = { ...nutrition };
  NUTRIENT_KEYS.forEach(k => {
    if (typeof out[k] === "number") out[k] = out[k] * factor * (weightFactor || 1);
  });
  return out;
}

function fmtNum(v) {
  if (!Number.isFinite(v)) return "0";
  return (Math.round(v * 100) / 100).toFixed(2);
}

function calcNDS(n) {
  const score = (n.Protein_g || 0) + (n.Fiber_g || 0) + (n.Vitamin_C_mg || 0) + (n.Vitamin_A_mg || 0);
  return score / (n.Energy_kcal || 1);
}

function openDetail(item, n, img) {
  detailTitle.textContent = item.fruit || "-";
  detailDates.textContent = `Produced: ${item.dateProduced || "-"} • Expiry: ${item.expireDate || "-"}`;
  detailStatus.textContent = `Status: ${item.status || "stored"} • Weight: ${item.weight_g ? item.weight_g + " g" : "100 g"}`;
  if (detailImage) {
    if (img) {
      detailImage.innerHTML = `<img src="${img}" alt="Fruit" />`;
    } else {
      detailImage.textContent = (item.fruit || "?").slice(0, 1).toUpperCase();
    }
  }

  const labels = {
    Energy_kcal: "Energy (kcal)",
    Carbohydrate_g: "Carb (g)",
    Protein_g: "Protein (g)",
    Total_Sugar_g: "Sugar (g)",
    Fiber_g: "Fiber (g)",
    Fat_g: "Fat (g)",
    Vitamin_A_mg: "Vitamin A (mg)",
    Vitamin_B6_mg: "Vitamin B6 (mg)",
    Vitamin_C_mg: "Vitamin C (mg)",
    Vitamin_D_mg: "Vitamin D (mg)",
    Sodium_mg: "Sodium (mg)",
    Potassium_mg: "Potassium (mg)"
  };

  detailGrid.innerHTML = NUTRIENT_KEYS.map(k => {
    return `<div class="item">${labels[k]}: ${fmtNum(n[k])}</div>`;
  }).join("");

  detailModal.classList.add("show");
}

function buildList() {
  const history = JSON.parse(localStorage.getItem("scanHistory") || "[]");
  const q = (searchInput.value || "").trim().toLowerCase();
  const status = statusFilter.value;

  let items = history.filter(item => {
    if (status !== "all" && (item.status || "stored") !== status) return false;
    if (q && !(item.fruit || "").toLowerCase().includes(q)) return false;
    return true;
  });

  const mapped = items.map(item => {
    let raw = null;
    if (item.nutrition && item.nutrition !== "-") {
      try { raw = JSON.parse(item.nutrition); } catch (e) { raw = null; }
    }
    const decay = getDecayFactor(item);
    const weightFactor = getWeightFactor(item);
    const n = raw ? adjustNutrition(raw, decay, weightFactor) : {};
    const freshness = Math.round(decay * 100);
    const nds = raw ? calcNDS(n) : null;
    const exp = parseDMY(item.expireDate);
    const daysLeft = exp ? Math.ceil((exp - new Date()) / MS_DAY) : null;
    const img = getFruitImage(raw, item.fruit);
    return { item, n, freshness, nds, daysLeft, img };
  });

  const sort = sortSelect.value;
  mapped.sort((a, b) => {
    if (sort === "freshness") return (b.freshness || 0) - (a.freshness || 0);
    if (sort === "weight") return (Number(b.item.weight_g) || 0) - (Number(a.item.weight_g) || 0);
    if (sort === "nds") return (b.nds || 0) - (a.nds || 0);
    return (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999);
  });

  fridgeGrid.innerHTML = "";
  if (mapped.length === 0) {
    emptyState.style.display = "grid";
  } else {
    emptyState.style.display = "none";
  }

  let totalWeight = 0;
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarb = 0;
  let totalFiber = 0;
  let ndsSum = 0;
  let ndsCount = 0;

  let storedCount = 0;
  let expiringCount = 0;

  mapped.forEach(({ item, n, freshness, nds, daysLeft, img }) => {
    const weight = Number(item.weight_g) || 0;
    totalWeight += weight;
    totalCalories += Number(n.Energy_kcal) || 0;
    totalProtein += Number(n.Protein_g) || 0;
    totalCarb += Number(n.Carbohydrate_g) || 0;
    totalFiber += Number(n.Fiber_g) || 0;
    if (Number.isFinite(nds)) {
      ndsSum += nds;
      ndsCount += 1;
    }
    if ((item.status || "stored") === "stored") storedCount += 1;
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 3) expiringCount += 1;

    const card = document.createElement("div");
    card.className = "card";
    const statusVal = item.status || "stored";
    const weightLabel = weight > 0 ? `${weight.toFixed(1)} g` : "100 g";
    const expiryText = daysLeft === null ? "-" : daysLeft < 0 ? `${Math.abs(daysLeft)} day(s) overdue` : `${daysLeft} day(s) left`;
    const freshnessClass = freshness < 30 ? "danger" : freshness < 60 ? "warn" : "good";
    const statusTone = statusVal === "consumed"
      ? "status-consumed"
      : statusVal === "wasted"
        ? "status-wasted"
        : "status-stored";
    const expiryChip = daysLeft === null
      ? ""
      : daysLeft < 0
        ? '<span class="status-chip status-expired">Expired</span>'
        : daysLeft <= 3
          ? '<span class="status-chip status-expiring">Expiring</span>'
          : "";

    card.innerHTML = `
      <div class="card-header">
        <div class="card-thumb">${img ? `<img src="${img}" alt="Fruit">` : (item.fruit || "-").slice(0,1)}</div>
        <div class="card-main">
          <h3>${item.fruit || "-"}</h3>
          <div class="meta">${weightLabel} • ${expiryText}</div>
          <div class="meta">Freshness ${freshness}%</div>
        </div>
      </div>
      <div class="chip-row">
        <span class="status-chip ${statusTone}">${statusVal}</span>
        ${expiryChip}
        <span class="status-chip status-warning">NDS ${nds ? nds.toFixed(2) : "-"}</span>
      </div>
      <div class="freshness">
        <div class="freshness-label">Freshness</div>
        <div class="freshness-bar"><span class="fill ${freshnessClass}" style="width:${freshness}%"></span></div>
      </div>
      <div class="nutrition-mini">
        <div>Calories: ${fmtNum(n.Energy_kcal)} kcal</div>
        <div>Protein: ${fmtNum(n.Protein_g)} g</div>
        <div>Carb: ${fmtNum(n.Carbohydrate_g)} g</div>
        <div>NDS: ${nds ? nds.toFixed(2) : "-"}</div>
      </div>
    `;
    card.addEventListener("click", () => openDetail(item, n, img));
    fridgeGrid.appendChild(card);
  });

  sumItems.textContent = mapped.length;
  sumStored.textContent = storedCount;
  sumExpiring.textContent = expiringCount;
  sumWeight.textContent = totalWeight > 0 ? `${totalWeight.toFixed(1)} g` : "-";
  sumCalories.textContent = totalCalories > 0 ? `${fmtNum(totalCalories)} kcal` : "-";
  sumProtein.textContent = totalProtein > 0 ? `${fmtNum(totalProtein)} g` : "-";
  sumCarb.textContent = totalCarb > 0 ? `${fmtNum(totalCarb)} g` : "-";
  sumFiber.textContent = totalFiber > 0 ? `${fmtNum(totalFiber)} g` : "-";
  sumNds.textContent = ndsCount ? (ndsSum / ndsCount).toFixed(2) : "-";

  statusText.textContent = `${mapped.length} item(s) shown`;
}

searchInput.addEventListener("input", buildList);
statusFilter.addEventListener("change", buildList);
sortSelect.addEventListener("change", buildList);

closeModal.addEventListener("click", () => detailModal.classList.remove("show"));
detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) detailModal.classList.remove("show");
});

backBtn.addEventListener("click", () => { window.navigateWithTransition("welcome.html"); });
historyBtn.addEventListener("click", () => { window.navigateWithTransition("history.html"); });
emptyScanBtn?.addEventListener("click", () => {
  emptyScanBtn.classList.add("is-busy");
  window.navigateWithTransition("fruits-calculator-ai.html");
});

window.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("active");
  buildList();
});
