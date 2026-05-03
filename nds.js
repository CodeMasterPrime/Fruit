const tbody = document.querySelector("#ndsTable tbody");
const podiumDiv = document.getElementById("podium");
const nutrientsToConsider = ['Protein_g','Fiber_g','Vitamin_C_mg','Vitamin_A_mg'];
const MS_DAY = 1000 * 60 * 60 * 24;

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
  const keys = [
    "Energy_kcal","Carbohydrate_g","Protein_g","Total_Sugar_g","Fiber_g","Fat_g",
    "Vitamin_A_mg","Vitamin_B6_mg","Vitamin_C_mg","Vitamin_D_mg","Sodium_mg","Potassium_mg"
  ];
  keys.forEach(k => {
    if (typeof out[k] === "number") out[k] = out[k] * factor * (weightFactor || 1);
  });
  return out;
}

// --- Toast ---
function showToast(message){
  const toast = document.createElement('div');
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(()=>toast.style.opacity=1,100);
  setTimeout(()=>{
    toast.style.opacity=0;
    setTimeout(()=>toast.remove(),300);
  },3000);
}

// --- NDS Calculation ---
function calculateNDS(nutrition){
  let score = 0;
  nutrientsToConsider.forEach(key => { if(nutrition[key]) score += nutrition[key]; });
  return score / (nutrition.Energy_kcal || 1);
}

// --- Render Podium Top 3 ---
function renderPodium(items){
  podiumDiv.innerHTML = "";
  items.slice(0,3).forEach((item,i)=>{
    const div = document.createElement('div');
    div.className = "podium-slot";
    div.style.height = (100 + 50*(3-i)) + "px";
    const colors = ["#F7A5A5","#F08787","#FFCC5C"];
    div.style.background = colors[i];
    div.textContent = `#${i+1} ${item.fruit}\n(${item.nds.toFixed(2)})`;
    podiumDiv.appendChild(div);
  });
}

// --- Load NDS Table ---
function loadNDS(){
  tbody.innerHTML = "";
  let history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
  const today = new Date();

  // Calculate NDS for each item
  history.forEach(item => {
    let nutrition = {Energy_kcal:0, Protein_g:0, Fiber_g:0, Vitamin_C_mg:0, Vitamin_A_mg:0};
    if(item.nutrition && item.nutrition !== "-"){
      try {
        const raw = JSON.parse(item.nutrition);
        const factor = getDecayFactor(item);
        const weightFactor = getWeightFactor(item);
        nutrition = adjustNutrition(raw, factor, weightFactor);
      } catch(e){ nutrition = {}; }
    }
    item.nds = calculateNDS(nutrition);
    item.nutritionObj = nutrition;
  });

  // Sort descending by NDS
  const sortedHistory = [...history].sort((a,b)=>b.nds - a.nds);
  renderPodium(sortedHistory);

  // Render table
  history.forEach((item,index)=>{
    const tr = document.createElement('tr');

    // Highlight near expiry ≤3 days
    if(item.expireDate && item.expireDate !== "-"){
      const expireDate = new Date(item.expireDate.split('/').reverse().join('-'));
      const diffDays = Math.ceil((expireDate - today)/(1000*60*60*24));
      if(diffDays <= 3 && diffDays >= 0){
        tr.style.background = "linear-gradient(90deg,#608BC1,#113F67)";
        tr.style.color = "#FFF3B0";
        tr.style.fontWeight = "bold";
        tr.style.textShadow = "1px 1px 4px #FFF176";
      }
    }

    // Nutrition text
    const n = item.nutritionObj;
    const nutritionText = `Energy: ${n.Energy_kcal?.toFixed ? n.Energy_kcal.toFixed(2) : n.Energy_kcal} kcal
Protein: ${n.Protein_g?.toFixed ? n.Protein_g.toFixed(2) : n.Protein_g} g
Fiber: ${n.Fiber_g?.toFixed ? n.Fiber_g.toFixed(2) : (n.Fiber_g || 0)} g
Vitamin C: ${n.Vitamin_C_mg?.toFixed ? n.Vitamin_C_mg.toFixed(2) : n.Vitamin_C_mg} mg
Vitamin A: ${n.Vitamin_A_mg?.toFixed ? n.Vitamin_A_mg.toFixed(2) : n.Vitamin_A_mg} mg`;

    // Mini nutrient bar
    const nutrientBar = nutrientsToConsider.map(key => {
      const value = n[key] || 0;
      return `<div class="nutrient-segment" style="width:${value*3}px;background-color:#93DA97"></div>`;
    }).join('');

    tr.innerHTML = `
      <td>${index+1}</td>
      <td>${item.fruit}</td>
      <td>${item.dateProduced}</td>
      <td>${item.expireDate}</td>
      <td><pre>${nutritionText}</pre><div class="nutrient-bar">${nutrientBar}</div></td>
      <td>${item.nds.toFixed(2)}</td>
      <td><button class="deleteBtn" onclick="deleteRecord(${index})">Delete</button></td>
    `;
    tbody.appendChild(tr);
  });

  // Delete button hover
  document.querySelectorAll(".deleteBtn").forEach(btn=>{
    btn.addEventListener('mouseover',()=>btn.style.backgroundColor="#8DBCC7");
    btn.addEventListener('mouseout',()=>btn.style.backgroundColor="#93DA97");
  });
}

// --- Delete ---
function deleteRecord(index){
  let history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
  const removed = history.splice(index,1);
  localStorage.setItem('scanHistory', JSON.stringify(history));
  loadNDS();
  showToast(`Deleted "${removed[0].fruit}" successfully! 🪄`);
}

// --- Search ---
document.getElementById("searchInput").addEventListener('input',()=>{
  const filter = document.getElementById("searchInput").value.toLowerCase();
  let found = false;
  tbody.querySelectorAll('tr').forEach(row=>{
    const fruitCell = row.cells[1].textContent.toLowerCase();
    if(fruitCell.includes(filter)){ row.style.display=''; found=true; }
    else row.style.display='none';
  });
  if(!found && filter !== "") showToast(`Fruit "${filter}" not found 🔍`);
});

// --- Navigation ---
document.querySelector(".backBtn").addEventListener('click',()=>{
  showToast("Returning to History… 🏰");
  setTimeout(()=>window.navigateWithTransition("history.html"),500);
});
document.querySelector(".scienceBtn").addEventListener('click',()=>{
  showToast("Going to Science… 🔬");
  setTimeout(()=>window.navigateWithTransition("science.html"),500);
});

// --- Initial load ---
loadNDS();
let chartInstance = null;

function openChart(fruitName, n){
  document.getElementById("chartTitle").textContent = `Nutrition of ${fruitName}`;
  document.getElementById("chartPopup").style.display = "flex";

  const ctx = document.getElementById("nutritionChart").getContext("2d");

  if(chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["Protein (g)", "Fiber (g)", "Vit C (mg)", "Vit A (mg)"],
      datasets: [{
        label: fruitName,
        data: [
          n.Protein_g || 0,
          n.Fiber_g || 0,
          n.Vitamin_C_mg || 0,
          n.Vitamin_A_mg || 0
        ],
        fill: true,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      scales: {
        r: {
          beginAtZero: true
        }
      }
    }
  });
}

document.getElementById("closeChart").onclick = () => {
  document.getElementById("chartPopup").style.display = "none";
};
