// ----------------- Variables -----------------
const tbody = document.querySelector("#eatTable tbody");
const progressBars = document.getElementById("progressBars");
const backButton = document.getElementById("backButton");
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

// Player
let player = {
  HP: 100,
  vitamins: { Vitamin_A_mg:0, Vitamin_B6_mg:0, Vitamin_C_mg:0, Vitamin_D_mg:0 }
};

// Daily vitamin goals
const dailyGoal = { Vitamin_A_mg:0.9, Vitamin_B6_mg:1.3, Vitamin_C_mg:90, Vitamin_D_mg:0.015 };

// Bosses
let bosses = [
  { name:"Vitamin A", key:"Vitamin_A_mg", MaxHP:dailyGoal.Vitamin_A_mg, currentHP:dailyGoal.Vitamin_A_mg },
  { name:"Vitamin B6", key:"Vitamin_B6_mg", MaxHP:dailyGoal.Vitamin_B6_mg, currentHP:dailyGoal.Vitamin_B6_mg },
  { name:"Vitamin C", key:"Vitamin_C_mg", MaxHP:dailyGoal.Vitamin_C_mg, currentHP:dailyGoal.Vitamin_C_mg },
  { name:"Vitamin D", key:"Vitamin_D_mg", MaxHP:dailyGoal.Vitamin_D_mg, currentHP:dailyGoal.Vitamin_D_mg }
];

let currentBossIndex = 0;

// Boss Elements
const bossImg = document.getElementById("boss-img");
const bossName = document.getElementById("boss-name");
const bossHPFill = document.getElementById("bossHP");

// Boss images map
const bossImages = {
  "Vitamin_A_mg": "apple(g).png",
  "Vitamin_B6_mg": "banana.png",
  "Vitamin_C_mg": "orange .png",
  "Vitamin_D_mg": "kiwi.png"
};

// ----------------- Load fruits from history -----------------
function getFruitsFromHistory() {
  const history = JSON.parse(localStorage.getItem('scanHistory')||'[]');
  const gameState = JSON.parse(localStorage.getItem('gameState')||'{}');

  return history.map((item, index) => {
    let nutrition = {};
    try { nutrition = JSON.parse(item.nutrition); } catch {}
    const factor = getDecayFactor(item);
    const key = item.id || `idx_${index}_${item.fruit || "fruit"}`;

    const eaten = Boolean(gameState.eatenFruits?.[key] || gameState.eatenFruits?.[item.fruit]);

    return {
      id: item.id || null,
      key,
      fruit: item.fruit || "-",
      dateProduced: item.dateProduced || "-",
      expireDate: item.expireDate || "-",
      nutrition: {
        Vitamin_A_mg: (nutrition.Vitamin_A_mg || 0) * factor,
        Vitamin_B6_mg: (nutrition.Vitamin_B6_mg || 0) * factor,
        Vitamin_C_mg: (nutrition.Vitamin_C_mg || 0) * factor,
        Vitamin_D_mg: (nutrition.Vitamin_D_mg || 0) * factor
      },
      eaten: eaten
    };
  });
}

let fruits = getFruitsFromHistory();

// ----------------- Tooltip -----------------
const tooltip = document.createElement('div');
Object.assign(tooltip.style, {
  position:'absolute', padding:'6px 10px', background:'#333', color:'#fff',
  borderRadius:'6px', fontSize:'12px', pointerEvents:'none', opacity:0,
  transition:'0.2s', zIndex:9999
});
document.body.appendChild(tooltip);
function showTooltip(text,x,y){ tooltip.textContent=text; tooltip.style.left=x+'px'; tooltip.style.top=(y-30)+'px'; tooltip.style.opacity=1;}
function hideTooltip(){ tooltip.style.opacity=0; }

// ----------------- Load fruits into table -----------------
function loadFruits() {
  tbody.innerHTML = "";
  if(fruits.length===0){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" style="text-align:center; color:gray;">No fruits found 🍎</td>`;
    tbody.appendChild(tr);
    return;
  }

  fruits.forEach((item, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML=`
      <td>${idx+1}</td>
      <td>${item.fruit}</td>
      <td>${item.dateProduced}</td>
      <td>${item.expireDate}</td>
      <td>
        Vitamin A: ${item.nutrition.Vitamin_A_mg} mg<br>
        Vitamin B6: ${item.nutrition.Vitamin_B6_mg} mg<br>
        Vitamin C: ${item.nutrition.Vitamin_C_mg} mg<br>
        Vitamin D: ${item.nutrition.Vitamin_D_mg} mg
      </td>
      <td>
        <button class="${item.eaten?'disabled-btn':'eat-btn'}" ${item.eaten?'disabled':`onclick="eatFruit(${idx})"`}>
        ${item.eaten?'Eaten ✅':'Eat'}</button>
      </td>
    `;
    tbody.appendChild(tr);

    const btn = tr.querySelector("button");
    btn.addEventListener('mousemove',e=>{
      if(!item.eaten){
        const vitText = Object.keys(item.nutrition).map(k=>`${k.replace("_"," ")}:+${item.nutrition[k]} mg`).join(' / ');
        showTooltip(vitText,e.pageX,e.pageY);
      }
    });
    btn.addEventListener('mouseleave', hideTooltip);
  });
}

// ----------------- Vitamin calculation & progress bars -----------------
function calculateVitaminTotals(){
  player.vitamins={ Vitamin_A_mg:0, Vitamin_B6_mg:0, Vitamin_C_mg:0, Vitamin_D_mg:0 };
  fruits.forEach(f=>{
    if(f.eaten){ Object.keys(player.vitamins).forEach(k=>player.vitamins[k]+=f.nutrition[k]); }
  });
}

function updateVitaminBars(){
  progressBars.innerHTML="";
  Object.keys(player.vitamins).forEach(vit=>{
    const goal = dailyGoal[vit], have=player.vitamins[vit], percent=Math.min((have/goal)*100,100);
    const div=document.createElement("div"); div.style.marginBottom="12px";
    div.innerHTML=`
      <p style="margin:0 0 4px 0; font-weight:bold;">${vit.replace(/_/g," ")}</p>
      <div class="progress"><div class="progress-bar hp" style="width:${percent}%">${have.toFixed(1)} / ${goal} mg</div></div>
    `;
    progressBars.appendChild(div);
  });
}

// ----------------- Update boss + player HP -----------------
function updateProgressBars(){
  const playerBar = document.getElementById("playerHP");
  playerBar.style.width=player.HP+"%";
  playerBar.textContent=player.HP+"%";

  const boss = bosses[currentBossIndex];
  if(!boss) return;

  const percent = ((boss.MaxHP - boss.currentHP)/boss.MaxHP)*100;
  bossHPFill.style.width=percent+"%";
  bossHPFill.textContent=`${(boss.MaxHP-boss.currentHP).toFixed(2)} / ${boss.MaxHP}`;
  bossName.textContent = boss.name;
  bossImg.src = bossImages[boss.key] || "banana.png";

  if(boss.currentHP<=0){ bossHPFill.style.width="100%"; bossImg.classList.add("boss-full"); }
  else bossImg.classList.remove("boss-full");
}

// ----------------- Toast -----------------
function showToast(msg){
  const toast = document.createElement("div"); toast.textContent=msg;
  Object.assign(toast.style,{
    position:"fixed", bottom:"20px", left:"50%", transform:"translateX(-50%)",
    background:"#333", color:"#fff", padding:"10px 20px", borderRadius:"8px",
    opacity:0, transition:"0.5s", zIndex:9999
  });
  document.body.appendChild(toast);
  requestAnimationFrame(()=>toast.style.opacity="1");
  setTimeout(()=>{ toast.style.opacity="0"; setTimeout(()=>toast.remove(),500); },1500);
}

// ----------------- Eat fruit -----------------
function eatFruit(index){
  const fruit = fruits[index]; if(!fruit||fruit.eaten) return;

  const boss = bosses[currentBossIndex];
  const add = fruit.nutrition[boss.key]||0;
  boss.currentHP = Math.max(boss.currentHP-add,0);
  fruit.eaten=true;
  player.HP = Math.min(player.HP+2,100);

  calculateVitaminTotals(); updateVitaminBars(); loadFruits(); updateProgressBars();

  // Save game state
  const gameState = JSON.parse(localStorage.getItem('gameState')||'{}');
  gameState.eatenFruits = gameState.eatenFruits||{};
  gameState.eatenFruits[fruit.key || fruit.id || fruit.fruit]=true;
  gameState.vitamins={...player.vitamins};
  gameState.bosses=bosses.map(b=>b.currentHP);
  gameState.currentBossIndex=currentBossIndex;
  localStorage.setItem('gameState',JSON.stringify(gameState));

  showToast(`🍎 Ate ${fruit.fruit} +${add} ${boss.name}`);

  if(boss.currentHP<=0){
    currentBossIndex++;
    if(currentBossIndex>=bosses.length) showToast("🎉 You have collected all vitamins! Perfect health! 🥳");
    else { showToast(`➡️ Next: ${bosses[currentBossIndex].name}`); updateProgressBars(); }
  }
}

// ----------------- Initialize -----------------
function initializeGame(){
  const gameState = JSON.parse(localStorage.getItem('gameState')||'{}');
  if(gameState.vitamins) player.vitamins={...gameState.vitamins};
  if(gameState.bosses) bosses.forEach((b,i)=>b.currentHP=gameState.bosses[i]);
  if(gameState.currentBossIndex) currentBossIndex=gameState.currentBossIndex;

  loadFruits(); calculateVitaminTotals(); updateVitaminBars(); updateProgressBars();
}

window.addEventListener("DOMContentLoaded",()=>{
  const game = document.querySelector(".game-container");
  setTimeout(()=>game.classList.add("active"),100);
  initializeGame();
});

backButton.addEventListener('click',()=>window.navigateWithTransition("welcome.html"));
