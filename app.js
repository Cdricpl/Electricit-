"use strict";
/* Changer APP_VERSION à chaque modification : nouvelle URL de service worker
   => nouveau cache => les anciens sont purgés automatiquement. */
const APP_VERSION = "2.1.0";

const LS_S = "decompte_settings_v2",
      LS_R = "decompte_readings_v2",
      LS_U = "decompte_ui_v3",
      LS_P = "decompte_acomptes_v2";

const DEFAULTS = {
  enerUnit:16.56, vertUnit:2.85, reduc:24, redev:61.32,
  transUnit:2.712,
  distUnit:8.11, ristUnit:2.724, servUnit:0.967, distTaxUnit:1.128, grdFixe:25,
  accise:4.748, cotis:0.1926, racc:0.075,
  injMode:"manuel", injHP:3.26, injHC:0.94, belpex:61.07, coefHP:0.0794, coefHC:0.0414, constInj:1.59,
  cbOn:false, cb:130, domOn:false, dom:20
};

// Index réels relevés par le gestionnaire de réseau.
const SEED_READINGS = [
  {date:"2025-07-05", prelHP:3784.43, prelHC:5213.13, injHP:4153.81, injHC:1630.02},
  {date:"2025-07-31", prelHP:3926.9,  prelHC:5363.6,  injHP:4376.9,  injHC:1713.9},
  {date:"2025-08-31", prelHP:4043.2,  prelHC:5532.7,  injHP:4712.3,  injHC:1834.9},
  {date:"2025-09-30", prelHP:4275.8,  prelHC:5651.1,  injHP:4898.2,  injHC:1935.6},
  {date:"2025-10-31", prelHP:4417.6,  prelHC:5798,    injHP:4984.2,  injHC:1966.8},
  {date:"2025-11-30", prelHP:4536.6,  prelHC:5955.1,  injHP:5077.4,  injHC:2000.4},
  {date:"2025-12-31", prelHP:4725.5,  prelHC:6115.1,  injHP:5154.5,  injHC:2029.2},
  {date:"2026-01-31", prelHP:4923.4,  prelHC:6305.1,  injHP:5163.3,  injHC:2070.7},
  {date:"2026-02-28", prelHP:5094.5,  prelHC:6450.3,  injHP:5192.8,  injHC:2170.7},
  {date:"2026-03-31", prelHP:5266.1,  prelHC:6593.5,  injHP:5296.3,  injHC:2437.9},
  {date:"2026-04-30", prelHP:5334.5,  prelHC:6684.8,  injHP:5397.9,  injHC:2775.8},
  {date:"2026-05-31", prelHP:5399.8,  prelHC:6772.2,  injHP:5489.2,  injHC:3035.1},
  {date:"2026-06-30", prelHP:5462.53, prelHC:6866.25, injHP:5584.93, injHC:3313.68},
  {date:"2026-07-31", prelHP:5535.7,  prelHC:6984.1,  injHP:5713.2,  injHC:3652.7}
];

const DEF_UI  = {yearStart:"2026-07-01"};
const DEF_PAY = {monthly:60, over:{}};

function load(k,def){
  try{const v=JSON.parse(localStorage.getItem(k));return v?(Array.isArray(def)?v:{...def,...v}):structuredClone(def);}
  catch(e){return structuredClone(def);}
}
let S=load(LS_S,DEFAULTS), R=load(LS_R,SEED_READINGS), UI=load(LS_U,DEF_UI), P=load(LS_P,DEF_PAY);
if(!P.over) P.over={};

function saveS(){localStorage.setItem(LS_S,JSON.stringify(S));}
function saveR(){localStorage.setItem(LS_R,JSON.stringify(R));}
function saveU(){localStorage.setItem(LS_U,JSON.stringify(UI));}
function saveP(){localStorage.setItem(LS_P,JSON.stringify(P));}

const $   = id => document.getElementById(id);
const eur = n => n.toLocaleString("fr-BE",{minimumFractionDigits:2,maximumFractionDigits:2});
const eur0= n => Math.round(n).toLocaleString("fr-BE");
const kwh = n => n.toLocaleString("fr-BE",{maximumFractionDigits:0});
const signed = n => (n>0?"+":n<0?"−":"")+kwh(Math.abs(n));
const fmtDate = d => {const[y,m,dd]=d.split("-");return dd+"/"+m+"/"+y;};

const MONTHS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const MON3  =["janv","févr","mars","avr","mai","juin","juil","août","sept","oct","nov","déc"];
function monthAdd(key,n){const[y,m]=key.split("-").map(Number);const d=new Date(Date.UTC(y,m-1+n,1));return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0");}
function monthLabel(key){const[y,m]=key.split("-");return MONTHS[+m-1]+" "+y;}
function dayAdd(iso,n){const d=new Date(iso+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function yearAdd(iso,n){const d=new Date(iso+"T00:00:00Z");d.setUTCFullYear(d.getUTCFullYear()+n);return d.toISOString().slice(0,10);}

let flashT;
function flash(msg){const f=$("flash");f.textContent=msg;f.classList.add("show");clearTimeout(flashT);flashT=setTimeout(()=>f.classList.remove("show"),1600);}

/* ================= Volumes ================= */

function sortedReadings(){return [...R].sort((a,b)=>a.date<b.date?-1:1);}

// Consommation entre le relevé de référence (le dernier à la date de départ ou
// avant — c'est lui qui porte l'index de départ) et le dernier relevé de la période.
function periodConsumption(startISO,endISO){
  const s=sortedReadings();
  if(s.length<2)return null;
  let ref=null;
  for(const r of s){ if(r.date<=startISO) ref=r; else break; }
  if(!ref) ref=s.find(r=>r.date>=startISO)||null;
  if(!ref) return null;
  const upto = endISO ? s.filter(r=>r.date<=endISO) : s;
  const last = upto[upto.length-1];
  if(!last || last.date<=ref.date) return null;
  return {prelHP:last.prelHP-ref.prelHP, prelHC:last.prelHC-ref.prelHC,
          injHP:last.injHP-ref.injHP,   injHC:last.injHC-ref.injHC,
          days:(new Date(last.date)-new Date(ref.date))/86400000,
          from:ref.date, to:last.date};
}

// Une année complète garde son volume tel quel ; toute autre durée est ramenée
// à 12 mois. Sans la borne haute, 13 mois de relevés passeraient pour un an.
function annualize(c){
  const full = c.days>=355 && c.days<=375;
  const f = full ? 1 : (c.days>0 ? 365/c.days : 1);
  return {prelHP:c.prelHP*f, prelHC:c.prelHC*f, injHP:c.injHP*f, injHC:c.injHC*f,
          factor:f, full, days:c.days, from:c.from, to:c.to};
}

// Un décompte couvre exactement douze mois : la période s'arrête au dernier jour
// de l'année contractuelle, même si des relevés plus récents existent déjà.
function yearEnd(){return dayAdd(yearAdd(UI.yearStart,1),-1);}
function currentYear(){const c=periodConsumption(UI.yearStart,yearEnd());return c?annualize(c):null;}

/* ================= Calcul du décompte ================= */

function injTariffs(){
  if(S.injMode==="belpex") return {hp:S.coefHP*S.belpex-S.constInj, hc:S.coefHC*S.belpex-S.constInj};
  return {hp:S.injHP, hc:S.injHC};
}

function calc(v){
  const gross=v.prelHP+v.prelHC;
  const injTot=v.injHP+v.injHC;
  const net=Math.max(0, gross-injTot);
  const surplus=Math.max(0, injTot-gross);
  const days=v.full?361:365;
  const dayFrac=days/365;

  const enerMaxx=net*S.enerUnit/100;
  const vert=net*S.vertUnit/100;
  const redevF=S.redev*dayFrac;
  const reduc=enerMaxx*S.reduc/100;
  const luminus=enerMaxx+vert+redevF-reduc;

  const transport=gross*S.transUnit/100;

  const distCap=gross*S.distUnit/100;
  const rist=injTot*S.ristUnit/100;
  const services=gross*S.servUnit/100;
  const grdF=S.grdFixe*dayFrac;
  const distTax=gross*S.distTaxUnit/100;
  const resa=distCap-rist+services+grdF+distTax;

  const accise=net*S.accise/100;
  const cotis=net*S.cotis/100;
  const raccord=net*S.racc/100;

  const it=injTariffs();
  const injPay = surplus>0 ? surplus*((it.hp+it.hc)/2)/100 : 0;

  const htva=luminus+transport+resa+accise+cotis+raccord-injPay;
  const tva=(htva-raccord)*0.06;
  const tvac=htva+tva;

  const cb=S.cbOn?S.cb:0, dom=S.domOn?S.dom:0;
  return {net,gross,injTot,surplus,enerMaxx,vert,redevF,reduc,luminus,transport,
          distCap,rist,services,grdF,distTax,resa,accise,cotis,raccord,injPay,it,
          htva,tva,tvac,cb,dom,total:tvac-cb-dom,
          bLum:luminus,bElia:transport,bResa:resa,bGouv:accise+cotis+raccord};
}

/* ================= Acomptes ================= */

function paySchedule(){
  const start=UI.yearStart.slice(0,7), out=[];
  for(let i=0;i<12;i++){
    const k=monthAdd(start,i);
    const edited=Object.prototype.hasOwnProperty.call(P.over,k);
    out.push({key:k, edited, amount:edited?P.over[k]:P.monthly});
  }
  return out;
}
const payTotal = () => paySchedule().reduce((s,x)=>s+x.amount,0);

/* ================= Vue Décompte ================= */

function renderDecompte(){
  const v=currentYear();
  const raw=periodConsumption(UI.yearStart,yearEnd());
  const paid=payTotal();

  if(!v){
    ["heroTotal","heroPrel","heroInj"].forEach(id=>$(id).textContent="—");
    $("heroPeriod").textContent="ajoute tes index";
    $("heroSolde").textContent="";
    $("netPeriod").textContent="Il faut deux relevés pour calculer une consommation.";
    $("netVal").textContent="—";
    $("netSub").textContent="";
    $("kPrel").innerHTML="—<small> kWh</small>";
    $("kInj").innerHTML="—<small> kWh</small>";
    $("advice").innerHTML="";
    $("eqGap").textContent="—"; $("eqDayNight").innerHTML=""; $("eqRows").innerHTML=""; $("eqFoot").textContent="";
    $("calcBasis").textContent="En attente de relevés.";
    ["cHtva","cTva","cTotal","cPaid","cSolde"].forEach(id=>$(id).textContent="—");
    $("breakdown").innerHTML=`<p class="note">En attente de relevés.</p>`;
    return;
  }

  const r=calc(v);
  const solde=r.total-paid;

  // --- Prélèvement net, sur les volumes réellement relevés ---
  const gross=raw.prelHP+raw.prelHC, inj=raw.injHP+raw.injHC, net=gross-inj;
  $("netPeriod").textContent=`Du ${fmtDate(raw.from)} au ${fmtDate(raw.to)} · ${Math.round(raw.days)} jours`;
  $("netVal").textContent=signed(net);
  $("netVal").parentElement.className="netbig"+(net<=0?" credit":"");
  $("netSub").innerHTML = net>0
    ? `Prélèvement − injection. C'est ce volume qui te sera facturé en énergie.`
    : `Tu injectes plus que tu ne prélèves : <b>aucune énergie facturée</b> sur cette période.`;
  $("kPrel").innerHTML=kwh(gross)+"<small> kWh</small>";
  $("kInj").innerHTML=kwh(inj)+"<small> kWh</small>";
  const annualNet=(v.prelHP+v.prelHC)-(v.injHP+v.injHC);
  const unreliable=!v.full && v.days<150;
  $("advice").innerHTML = net>0
    ? `Chaque kWh de net te coûte <b>${eur(rates().netRate)} c€</b> d'énergie et de taxes. L'onglet ci-dessous dit quoi faire pour le réduire.`
    : `L'énergie ne t'est pas facturée tant que le net reste à zéro ou en dessous. Mais descendre bien en dessous ne rapporte presque rien — voir ci-dessous.`;
  renderEquilibrer(annualNet, raw, unreliable);

  // --- Le calcul ---
  $("calcBasis").textContent = v.full
    ? `Année complète · ${fmtDate(v.from)} → ${fmtDate(v.to)}`
    : `Projeté sur 12 mois depuis ${Math.round(v.days)} jours de relevés (×${v.factor.toFixed(2)})`;
  // Étirer quelques semaines sur un an ignore les saisons : un mois d'été
  // produit beaucoup et consomme peu, l'inverse en hiver.
  $("calcWarn").hidden = v.full || v.days>=150;
  if(!$("calcWarn").hidden)
    $("calcWarn").innerHTML=`<b>Estimation encore peu fiable.</b> ${Math.round(v.days)} jours étirés sur
      12 mois, sans tenir compte des saisons : un mois d'été produit beaucoup et consomme peu,
      l'hiver fait l'inverse. Le chiffre se stabilisera au fil des relevés.`;
  $("cHtva").textContent=eur(r.htva)+" €";
  $("cTva").textContent=eur(r.tva)+" €";
  $("cTotal").textContent=eur0(r.total)+" €";
  $("cPaid").textContent="− "+eur(paid)+" €";
  $("cSoldeLbl").innerHTML=(solde>=0?"Reste à payer":"À te rembourser")+`<small>décompte − acomptes</small>`;
  $("cSolde").textContent=eur0(Math.abs(solde))+" €";
  $("cSolde").className="a "+(solde>=0?"due":"credit");

  // --- En-tête ---
  $("heroTotal").textContent=eur0(r.total);
  $("heroPrel").textContent=kwh(r.gross)+" kWh";
  $("heroInj").textContent=kwh(r.injTot)+" kWh";
  $("heroPeriod").textContent=v.full?`année complète · ${fmtDate(v.to)}`:`projeté 12 mois · ${fmtDate(v.to)}`;
  const hs=$("heroSolde");
  hs.className="solde-line "+(solde>=0?"due":"credit");
  hs.textContent=(solde>=0?"reste à payer · ":"à rembourser · ")+eur0(Math.abs(solde))+" €";

  renderBreakdown(r,v);
}

/* ---------- Leviers pour équilibrer ----------
   Sur une année : prélèvement brut = C − S, injection = P − S, où S est la part
   de la consommation couverte directement par la production. Donc
   net = (C−S) − (P−S) = C − P : le net ne dépend que des totaux, jamais du
   moment où l'on consomme. Déplacer une consommation vers la journée ne change
   que le brut et l'injection — c'est-à-dire les frais de réseau, pas le net. */
function rates(){
  const grossRate=(S.transUnit+S.distUnit+S.servUnit+S.distTaxUnit)*1.06; // c€/kWh prélevé au compteur
  const ristRate = S.ristUnit*1.06;                                       // c€/kWh injecté (crédit)
  const netRate  =(S.enerUnit*(1-S.reduc/100)+S.vertUnit+S.accise+S.cotis)*1.06+S.racc;
  const it=injTariffs();
  const injRate=Math.max(0,(it.hp+it.hc)/2)*1.06;                         // rachat du surplus
  return {grossRate, ristRate, netRate, injRate, selfRate:grossRate-ristRate};
}

// Net réel de l'année contractuelle précédente, quand elle est complète.
function previousYearNet(){
  const c=periodConsumption(yearAdd(UI.yearStart,-1), dayAdd(UI.yearStart,-1));
  if(!c || c.days<355) return null;
  return {net:(c.prelHP+c.prelHC)-(c.injHP+c.injHC), from:c.from, to:c.to};
}

function renderEquilibrer(annualNet, raw, unreliable){
  const R=rates();
  const q=Math.max(0,+$("eqKwh").value||0);
  const pos=Math.max(0,annualNet);            // part encore facturée en énergie
  const onNet=Math.min(q,pos);                // ce qui efface vraiment du net facturé
  const beyond=Math.max(0,q-pos);             // ce qui bascule en surplus injecté

  // --- écart à zéro ---
  const prev=previousYearNet();
  let gap = annualNet>0
    ? `Il te reste <b>${kwh(annualNet)} kWh</b> de net à effacer pour finir à zéro.`
    : `Tu es à <b>${kwh(-annualNet)} kWh</b> sous zéro : au-delà, chaque kWh injecté n'est racheté que <b>${eur(R.injRate)} c€</b> au lieu des <b>${eur(R.netRate)} c€</b> qu'il vaut en compensation.`;
  if(unreliable && prev)
    gap += ` <span style="color:var(--muted)">Projection encore instable ; l'an dernier (${fmtDate(prev.from)} → ${fmtDate(prev.to)}) tu as terminé à ${signed(prev.net)} kWh.</span>`;
  $("eqGap").innerHTML=gap;

  // --- la réponse à la question jour / nuit ---
  $("eqDayNight").innerHTML=`<b>Jour ou nuit ne change pas ton net.</b> Ta compensation additionne les
    deux plages (${signed(raw.prelHP-raw.injHP)} en HP, ${signed(raw.prelHC-raw.injHC)} en HC) et seule
    leur somme compte. Une machine lancée à midi est nourrie par tes panneaux : ton prélèvement baisse,
    mais ton injection baisse d'autant. Le net ne bouge pas — en revanche la facture, oui.`;

  const lev=(name,sub,dNet,dEur,best)=>`<div class="lev${best?" best":""}">
      <div class="lh"><span class="ln">${name}</span>
        <span class="lv${dEur<=0.005?" zero":""}">${dEur<=0.005?"—":"− "+eur(dEur)+" €"}</span></div>
      <div class="ls">${sub}</div>
      <div class="lnet">net ${dNet===0?"inchangé":signed(-dNet)+" kWh"}</div>
    </div>`;

  const gainShift = q*R.selfRate/100;
  const gainLess  = (onNet*R.netRate + q*R.grossRate + beyond*R.injRate)/100;
  const gainMore  = (onNet*R.netRate + q*R.ristRate  + beyond*R.injRate)/100;
  const best=Math.max(gainShift,gainLess,gainMore);

  $("eqRows").innerHTML=
      lev(`Déplacer ${kwh(q)} kWh de la nuit vers la journée`,
          `Autoconsommés au lieu d'être injectés puis re-prélevés · ${eur(R.selfRate)} c€/kWh de frais de réseau évités`,
          0, gainShift, gainShift===best)
    + lev(`Consommer ${kwh(q)} kWh de moins sur l'année`,
          `Énergie et taxes sur le net, plus les frais de réseau sur le brut`,
          q, gainLess, gainLess===best)
    + lev(`Produire ${kwh(q)} kWh de plus`,
          `Énergie et taxes sur le net, plus le ristorno sur l'injection`,
          q, gainMore, gainMore===best);

  $("eqFoot").innerHTML=`Un kWh de net vaut <b>${eur(R.netRate)} c€</b>, un kWh prélevé au compteur
    <b>${eur(R.grossRate)} c€</b> de frais de réseau. Le déplacement vers la journée n'agit que dans la
    limite de ce que tes panneaux produisent à cet instant.`;
}

function renderBreakdown(r,v){
  const row=(k,sub,val,credit)=>`<div class="bd-row"><div class="k">${k}${sub?`<small>${sub}</small>`:""}</div><div class="v ${credit?"credit":""}">${val>=0?"+":"−"} ${eur(Math.abs(val))} €</div></div>`;
  const blockH=(name,st)=>`<div class="bd-h"><span>${name}</span><span class="st">${eur(st)} €</span></div>`;
  let h="";
  h+=blockH("Luminus · énergie",r.bLum);
  h+=row("Énergie MaxxFix","net · c€ "+eur(S.enerUnit),r.enerMaxx);
  h+=row("Énergie verte","net",r.vert);
  h+=row("Redevance fixe","",r.redevF);
  if(r.reduc>0)h+=row("Réduction promo "+eur(S.reduc)+"%","",-r.reduc,true);
  h+=blockH("ELIA · transport",r.bElia);
  h+=row("Puissance souscrite","brut",r.transport);
  h+=blockH("RESA · distribution",r.bResa);
  h+=row("Puissance souscrite","brut",r.distCap);
  h+=row("Ristorno production","≤10 kWe · sur injection",-r.rist,true);
  h+=row("Services publics","brut",r.services);
  h+=row("Terme fixe GRD","",r.grdF);
  h+=row("Autres taxes réseau","soldes · impôts · voirie",r.distTax);
  h+=blockH("Gouvernement · taxes",r.bGouv);
  h+=row("Accise spéciale","net",r.accise);
  h+=row("Cotisation énergie","net",r.cotis);
  h+=row("Redev. raccordement","net · hors TVA",r.raccord);
  if(r.injPay>0){h+=blockH("Surplus injecté",-r.injPay);
    h+=row("Rémunération surplus","HP "+eur(r.it.hp)+" · HC "+eur(r.it.hc)+" c€",-r.injPay,true);}
  h+=`<div class="bd-sub" style="margin-top:12px"><span>Total HTVA</span><span class="v">${eur(r.htva)} €</span></div>`;
  h+=`<div class="bd-sub"><span>TVA 6 %</span><span class="v">${eur(r.tva)} €</span></div>`;
  if(r.cb>0)h+=`<div class="bd-sub"><span>Cashback</span><span class="v">− ${eur(r.cb)} €</span></div>`;
  if(r.dom>0)h+=`<div class="bd-sub"><span>Domiciliation</span><span class="v">− ${eur(r.dom)} €</span></div>`;
  h+=`<div class="bd-total"><span class="t">Décompte annuel (TVAC)</span><span class="a">${eur0(r.total)} €</span></div>`;
  h+=`<p class="note">${v.full?"Année complète.":"Projeté sur 12 mois depuis "+Math.round(v.days)+" jours."}</p>`;
  $("breakdown").innerHTML=h;
}

function renderReadings(){
  const s=sortedReadings(), list=$("readingsList");
  if(s.length===0){list.innerHTML=`<p class="note">Aucun relevé.</p>`;return;}
  let h="";
  for(let i=s.length-1;i>=0;i--){
    const rd=s[i], prev=s[i-1];
    const del = prev
      ? `<span class="rdel">+${kwh((rd.prelHP-prev.prelHP)+(rd.prelHC-prev.prelHC))} prél · +${kwh((rd.injHP-prev.injHP)+(rd.injHC-prev.injHC))} inj</span>`
      : `<span class="rdel">point de départ</span>`;
    h+=`<div class="reading"><div class="rhead"><span class="rdate">${fmtDate(rd.date)}</span>
      <span style="display:flex;gap:10px;align-items:center">${del}<button class="btn-x" data-del="${rd.date}" aria-label="Supprimer">✕</button></span></div>
      <div class="rgrid">
        <div class="reg p"><span class="ri">☀↓</span><span class="rv">${rd.prelHP}</span></div>
        <div class="reg p"><span class="ri">☾↓</span><span class="rv">${rd.prelHC}</span></div>
        <div class="reg i"><span class="ri">☀↑</span><span class="rv">${rd.injHP}</span></div>
        <div class="reg i"><span class="ri">☾↑</span><span class="rv">${rd.injHC}</span></div>
      </div></div>`;
  }
  list.innerHTML=h;
  list.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{
    R=R.filter(x=>x.date!==b.dataset.del);saveR();renderAll();flash("Relevé supprimé");
  });
}

function bindDecompte(){
  $("addReading").onclick=()=>{
    const d=$("r_date").value;
    if(!d){alert("Choisis une date de relevé.");return;}
    R=R.filter(x=>x.date!==d);
    R.push({date:d, prelHP:+$("r_prelHP").value||0, prelHC:+$("r_prelHC").value||0,
            injHP:+$("r_injHP").value||0, injHC:+$("r_injHC").value||0});
    saveR();
    ["r_prelHP","r_prelHC","r_injHP","r_injHC","r_date"].forEach(id=>$(id).value="");
    renderAll(); flash("Relevé enregistré");
  };
  $("eqKwh").addEventListener("input",()=>renderDecompte());
  $("yearStart").value=UI.yearStart;
  $("yearStart").addEventListener("change",()=>{
    if(!$("yearStart").value){$("yearStart").value=UI.yearStart;return;}
    UI.yearStart=$("yearStart").value; saveU(); renderAll(); flash("Période mise à jour");
  });
}

/* ================= Vue Suivi ================= */

function monthlyDeltas(fromISO,toISO){
  const s=sortedReadings(), out=[];
  for(let i=1;i<s.length;i++){
    const a=s[i-1], b=s[i];
    if(b.date<=fromISO) continue;
    if(toISO && b.date>toISO) continue;
    out.push({key:b.date.slice(0,7),
      prelHP:b.prelHP-a.prelHP, prelHC:b.prelHC-a.prelHC,
      injHP:b.injHP-a.injHP,   injHC:b.injHC-a.injHC});
  }
  return out;
}
function niceMax(v){
  if(!(v>0))return 1;
  const p=Math.pow(10,Math.floor(Math.log10(v)));
  for(const m of [1,2,2.5,5]) if(v<=m*p) return m*p;
  return 10*p;
}

function chartSvg(data){
  if(data.length===0) return `<p class="note" style="text-align:center;padding:22px 0">Pas encore de relevé sur cette période.</p>`;
  const W=340,H=190,PL=4,PR=44,PT=10,PB=26, pw=W-PL-PR, ph=H-PT-PB;
  let up=0,dn=0;
  data.forEach(d=>{up=Math.max(up,d.prelHP+d.prelHC);dn=Math.max(dn,d.injHP+d.injHC);});
  const step=niceMax(Math.max(up,dn,1))/2;
  const nUp=Math.max(1,Math.ceil(up/step)), nDn=Math.ceil(dn/step);
  const topV=nUp*step, tot=topV+nDn*step;
  const y=v=>PT+ph*(topV-v)/tot;
  const slot=pw/data.length, bw=Math.min(30,slot*0.58);

  let g="";
  for(let i=-nDn;i<=nUp;i++){
    const v=i*step, yy=y(v);
    g+=`<line x1="${PL}" y1="${yy.toFixed(1)}" x2="${(PL+pw).toFixed(1)}" y2="${yy.toFixed(1)}" stroke="${i===0?"#a9a69b":"#e8e5db"}"/>`;
    g+=`<text x="${(PL+pw+6).toFixed(1)}" y="${(yy+3.4).toFixed(1)}" font-size="9" fill="#6c7771">${Math.round(v)}</text>`;
  }
  g+=`<text x="${(PL+pw+6).toFixed(1)}" y="${H-8}" font-size="9" fill="#6c7771">kWh</text>`;

  const y0=y(0);
  data.forEach((d,i)=>{
    const cx=PL+slot*(i+0.5), p=d.prelHP+d.prelHC, inj=d.injHP+d.injHC;
    if(p>0)  g+=`<rect x="${(cx-bw/2).toFixed(1)}" y="${y(p).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y0-y(p)).toFixed(1)}" fill="#3f9a4e" rx="2"/>`;
    if(inj>0)g+=`<rect x="${(cx-bw/2).toFixed(1)}" y="${y0.toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(-inj)-y0).toFixed(1)}" fill="#e9930f" rx="2"/>`;
    if(!(data.length>8&&i%2===1))
      g+=`<text x="${cx.toFixed(1)}" y="${H-8}" font-size="9" fill="#6c7771" text-anchor="middle">${MON3[+d.key.split("-")[1]-1]}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Prélèvement et injection par mois">${g}</svg>`;
}

function chartTotals(data){
  if(data.length===0) return "";
  const t=data.reduce((a,d)=>({p:a.p+d.prelHP+d.prelHC, i:a.i+d.injHP+d.injHC}),{p:0,i:0});
  return `<div class="totline"><span>Prélevé</span><span>${kwh(t.p)} kWh</span></div>
          <div class="totline"><span>Injecté</span><span>${kwh(t.i)} kWh</span></div>
          <div class="totline"><span>Net</span><span>${signed(t.p-t.i)} kWh</span></div>`;
}

function renderSuivi(){
  const curFrom=UI.yearStart;
  const prevFrom=yearAdd(UI.yearStart,-1), prevTo=dayAdd(UI.yearStart,-1);
  const cur=monthlyDeltas(curFrom,yearEnd()), prev=monthlyDeltas(prevFrom,prevTo);

  $("curTitle").textContent="Depuis le "+fmtDate(curFrom);
  $("chartCur").innerHTML=chartSvg(cur);
  $("curTot").innerHTML=chartTotals(cur);

  $("prevTitle").textContent=fmtDate(prevFrom)+" → "+fmtDate(prevTo);
  $("chartPrev").innerHTML=chartSvg(prev);
  $("prevTot").innerHTML=chartTotals(prev);
}

/* ================= Vue Acomptes ================= */

function renderAcomptes(){
  const sch=paySchedule(), total=sch.reduce((s,x)=>s+x.amount,0);
  $("a_total").innerHTML=eur(total)+"<small> €</small>";
  $("a_defLbl").textContent=eur0(P.monthly);

  const v=currentYear();
  if(v){
    const solde=calc(v).total-total;
    $("a_solde").innerHTML=(solde<0?"− ":"")+eur(Math.abs(solde))+"<small> €</small>";
    $("a_note").innerHTML=solde>=0
      ? `Décompte estimé <b>${eur0(calc(v).total)} €</b> − acomptes <b>${eur(total)} €</b> : il resterait <b>${eur(solde)} €</b> à payer.`
      : `Décompte estimé <b>${eur0(calc(v).total)} €</b> − acomptes <b>${eur(total)} €</b> : <b>${eur(-solde)} €</b> te seraient remboursés.`;
  }else{
    $("a_solde").innerHTML="—";
    $("a_note").textContent="Le solde s'affichera dès que le décompte pourra être calculé.";
  }

  $("a_list").innerHTML=sch.map(x=>`<div class="pay${x.edited?" edited":""}">
      <div class="m">${monthLabel(x.key)}</div>
      <input type="number" step="0.01" min="0" inputmode="decimal" data-k="${x.key}" value="${x.amount}" aria-label="Acompte de ${monthLabel(x.key)}">
      <span class="cur">€</span>
      <button class="rst" data-rst="${x.key}" title="Remettre au montant habituel" aria-label="Remettre au montant habituel">↺</button>
    </div>`).join("");

  $("a_list").querySelectorAll("input[data-k]").forEach(inp=>{
    inp.addEventListener("change",()=>{
      const k=inp.dataset.k, val=+inp.value;
      if(inp.value===""||isNaN(val)) delete P.over[k]; else P.over[k]=val;
      saveP(); renderAcomptes(); renderDecompte(); flash("Acompte enregistré");
    });
  });
  $("a_list").querySelectorAll("[data-rst]").forEach(b=>b.onclick=()=>{
    delete P.over[b.dataset.rst]; saveP(); renderAcomptes(); renderDecompte(); flash("Montant habituel rétabli");
  });
}

/* ================= Vue Tarifs ================= */

const SMAP={s_enerUnit:"enerUnit",s_vertUnit:"vertUnit",s_reduc:"reduc",s_redev:"redev",
  s_transUnit:"transUnit",s_distUnit:"distUnit",s_ristUnit:"ristUnit",s_servUnit:"servUnit",
  s_distTaxUnit:"distTaxUnit",s_grdFixe:"grdFixe",s_accise:"accise",s_cotis:"cotis",s_racc:"racc",
  s_injHP:"injHP",s_injHC:"injHC",s_belpex:"belpex",s_coefHP:"coefHP",s_coefHC:"coefHC",s_const:"constInj",
  s_cb:"cb",s_dom:"dom"};

function fillSettings(){
  for(const[el,key]of Object.entries(SMAP))$(el).value=S[key];
  $("s_cbOn").checked=S.cbOn;$("s_domOn").checked=S.domOn;
  $("lbl_cb").textContent=S.cb;$("lbl_dom").textContent=S.dom;
  document.querySelectorAll("#injMode button").forEach(b=>b.classList.toggle("on",b.dataset.mode===S.injMode));
  $("injManual").style.display=S.injMode==="manuel"?"block":"none";
  $("injBelpex").style.display=S.injMode==="belpex"?"block":"none";
  updateBelpexPreview();
}
function updateBelpexPreview(){
  if(S.injMode!=="belpex")return;
  const hp=S.coefHP*S.belpex-S.constInj, hc=S.coefHC*S.belpex-S.constInj;
  $("belpexPreview").innerHTML=`→ Tarifs surplus : <b>HP ${eur(hp)} · HC ${eur(hc)} c€/kWh</b>`;
}
function bindSettings(){
  for(const[el,key]of Object.entries(SMAP)){
    $(el).addEventListener("input",()=>{
      S[key]=+$(el).value||0; saveS();
      if(el==="s_cb")$("lbl_cb").textContent=S.cb;
      if(el==="s_dom")$("lbl_dom").textContent=S.dom;
      updateBelpexPreview(); renderDecompte(); renderAcomptes();
    });
  }
  $("s_cbOn").addEventListener("change",()=>{S.cbOn=$("s_cbOn").checked;saveS();renderDecompte();renderAcomptes();});
  $("s_domOn").addEventListener("change",()=>{S.domOn=$("s_domOn").checked;saveS();renderDecompte();renderAcomptes();});
  document.querySelectorAll("#injMode button").forEach(b=>b.onclick=()=>{S.injMode=b.dataset.mode;saveS();fillSettings();renderDecompte();});
  $("resetAll").onclick=()=>{
    if(confirm("Réinitialiser tous les tarifs aux valeurs par défaut ? (tes relevés et acomptes sont conservés)")){
      S=structuredClone(DEFAULTS);saveS();fillSettings();renderAll();flash("Tarifs réinitialisés");
    }
  };
}

/* ================= Navigation ================= */

function switchView(name){
  if(name==="suivi")    renderSuivi();
  if(name==="acomptes") renderAcomptes();
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="v-"+name));
  document.querySelectorAll("nav.tabs button").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  window.scrollTo({top:0,behavior:"instant"});
}
document.querySelectorAll("nav.tabs button").forEach(b=>b.onclick=()=>switchView(b.dataset.view));

function renderAll(){renderDecompte();renderReadings();renderSuivi();renderAcomptes();}

fillSettings(); bindSettings(); bindDecompte(); renderAll();

/* ================= Installation / hors ligne ================= */

$("appVer").textContent="v"+APP_VERSION;

let swReg=null;
if("serviceWorker" in navigator && location.protocol!=="file:"){
  const url="sw.js?v="+encodeURIComponent(APP_VERSION)+"&p="+encodeURIComponent(location.pathname);
  navigator.serviceWorker.register(url).then(r=>{swReg=r;}).catch(()=>{});
}

let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("btnInstall").hidden=false;});
$("btnInstall").onclick=async()=>{
  if(!deferredPrompt)return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice;
  deferredPrompt=null; $("btnInstall").hidden=true;
};
window.addEventListener("appinstalled",()=>{$("btnInstall").hidden=true;flash("Application installée");});

(function(){
  const iOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const standalone=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
  if(iOS&&!standalone)$("installHint").hidden=false;
})();

$("btnUpdate").onclick=async()=>{
  flash("Recherche…");
  try{
    if(swReg){await swReg.update(); if(swReg.active)swReg.active.postMessage("purge");}
    else if("caches" in window){const k=await caches.keys();await Promise.all(k.map(x=>caches.delete(x)));}
  }catch(e){}
  setTimeout(()=>location.reload(),600);
};

/* ================= Sauvegarde ================= */

$("btnExport").onclick=()=>{
  const data={app:"decompte",version:APP_VERSION,exportedAt:new Date().toISOString(),
              settings:S,readings:R,ui:UI,acomptes:P};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="decompte-"+new Date().toISOString().slice(0,10)+".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  flash("Sauvegarde exportée");
};
$("fileImport").onchange=e=>{
  const f=e.target.files&&e.target.files[0];
  if(!f)return;
  const fr=new FileReader();
  fr.onload=()=>{
    try{
      const d=JSON.parse(fr.result);
      if(!d||!Array.isArray(d.readings)||typeof d.settings!=="object")throw new Error("format");
      if(!confirm("Remplacer les données actuelles par celles de la sauvegarde ?"))return;
      R=d.readings; S={...DEFAULTS,...d.settings};
      UI={...DEF_UI,...(d.ui||{})};
      P={...DEF_PAY,...(d.acomptes||{})}; P.over=P.over||{};
      saveR();saveS();saveU();saveP();
      fillSettings(); $("yearStart").value=UI.yearStart; renderAll();
      flash("Sauvegarde restaurée");
    }catch(err){alert("Fichier illisible : ce n'est pas une sauvegarde Décompte.");}
    finally{e.target.value="";}
  };
  fr.readAsText(f);
};
