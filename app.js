// ---------- Utils ----------
const fmtJPY = n => new Intl.NumberFormat('ja-JP').format(Math.round(n||0));
const parseNum = s => { s=(''+(s??'')).replace(/,/g,'').trim(); return s?Number(s):0; };
const manToYen = s => parseNum(s)*10000;

// add thousand separators on blur
function bindComma(id){
  const el=document.getElementById(id); if(!el) return;
  el.addEventListener('blur', ()=>{ const v=parseNum(el.value); if(Number.isFinite(v)) el.value=new Intl.NumberFormat('ja-JP').format(v); });
}

// bind a list
['s1-salary','s1-age','s1-start-y','s1-start-m','s1-principal','s1-years','s1-rate','s1-target-y',
 's2-salary','s2-age','s2-movein-y','s2-target-y','s2-yearend','s2-R','s2-real','s2-side','s2-itax',
 's3-salary','s3-age','s3-R','s3-real','s3-side','s3-itax'].forEach(bindComma);

// ---------- Tax core ----------
const BRACKETS = [
  [0, 0.05], [1950000, 0.10], [3300000, 0.20],
  [6950000, 0.23], [9000000, 0.33],
  [18000000, 0.40], [40000000, 0.45]
];
const BASIC_DED_IT=480000, BASIC_DED_RES=430000;

function salaryDeduction(g){
  if(g<=1625000) return 550000;
  if(g<=1800000) return g*0.40-100000;
  if(g<=3600000) return g*0.30+80000;
  if(g<=6600000) return g*0.20+440000;
  if(g<=8500000) return g*0.10+1100000;
  return 1950000;
}

function socialInsuranceEstimateFromSalary(g, age){
  const r = age<40?0.15:(age<=64?0.165:0.14);
  return Math.round(g*r);
}

function marginalIncomeRateInclSurtax(taxable){
  let rate = BRACKETS[0][1];
  for(const [th, r] of BRACKETS){ if (taxable>=th) rate=r; else break; }
  return rate*1.021;
}

function incomeTaxAmountBeforeCredits(taxable){
  let tax = 0, prev=0;
  for(let i=0;i<BRACKETS.length;i++){
    const [th, r] = BRACKETS[i];
    const next = (i+1<BRACKETS.length) ? BRACKETS[i+1][0] : Infinity;
    const base = Math.max(th, prev);
    if (taxable>base){
      const span = Math.min(taxable, next) - base;
      tax += span * r; prev = next;
    } else break;
  }
  const surtax = tax * 0.021;
  return Math.floor(tax + surtax);
}

// ---------- Loan rules ----------
function loanLimit(category, isChildYoung, isNew){
  if (category==='その他') return 20000000;
  if (isNew){
    if (isChildYoung){
      if (category==='認定') return 50000000;
      if (category==='ZEH') return 45000000;
      if (category==='省エネ') return 40000000;
    } else {
      if (category==='認定') return 45000000;
      if (category==='ZEH') return 35000000;
      if (category==='省エネ') return 30000000;
    }
  }
  if (['認定','ZEH','省エネ'].includes(category)) return 30000000;
  return 20000000;
}
function deductionYears(isNew, category){ return category==='その他'?10:(isNew?13:10); }

function yearEndBalance(principal, ratePct, startY, startM, targetY, years, method){
  const r = ratePct/100/12;
  const n = years*12;
  const monthsElapsed = Math.max(0, (targetY - startY)*12 + (12 - startM + 1));
  const m = Math.min(monthsElapsed, n);
  let bal = principal;
  if (method==='元金均等'){
    const pmtPrin = principal/n;
    for (let i=0;i<m;i++){ const interest = bal * r; bal -= pmtPrin; }
    return Math.max(0, bal);
  } else {
    if (r===0){ const pmt = principal/n; return Math.max(0, principal - pmt*m); }
    const a = principal * r * Math.pow(1+r, n) / (Math.pow(1+r, n)-1);
    for (let i=0;i<m;i++){ const interest = bal * r; const prin = a - interest; bal -= prin; }
    return Math.max(0, bal);
  }
}

// ---------- Core calculators ----------
function residentShareFromIncome(gSalary, age, addOthers=0){
  const soc = socialInsuranceEstimateFromSalary(gSalary, age);
  const kyu = Math.floor(salaryDeduction(gSalary));
  const taxableRES = Math.max(0, gSalary + addOthers - kyu - soc - BASIC_DED_RES);
  const R = Math.floor(taxableRES * 0.10);
  return { R, taxableRES };
}
function taxableITFromIncome(gSalary, age, addOthers=0){
  const soc = socialInsuranceEstimateFromSalary(gSalary, age);
  const kyu = Math.floor(salaryDeduction(gSalary));
  const taxableIT = Math.max(0, gSalary + addOthers - kyu - soc - BASIC_DED_IT);
  return { taxableIT, soc, kyu };
}
function furusatoLimitGiven(tIncl, R, loanResCredit){
  const capA = 0.20 * R;
  const capB = Math.max(R - loanResCredit, 0);
  const d1 = 2000 + capA / (0.9 - tIncl);
  const d2 = 2000 + capB / (1.0 - tIncl);
  return { d1: Math.max(0, Math.floor(d1)), d2: Math.max(0, Math.floor(d2)), capA: Math.floor(capA), capB: Math.floor(capB) };
}

// ---------- Tabs ----------
function selectTab(id){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('active', s.id==='tab-'+id));
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.tabs button').forEach(b=> b.addEventListener('click', ()=> selectTab(b.dataset.tab)));

// ---------- Tab 1: 簡易 ----------
document.getElementById('s1-calc').addEventListener('click', ()=>{
  const salaryMan=parseNum(document.getElementById('s1-salary').value);
  const age=parseNum(document.getElementById('s1-age').value);
  const sy=parseNum(document.getElementById('s1-start-y').value);
  const sm=parseNum(document.getElementById('s1-start-m').value);
  const principalMan=parseNum(document.getElementById('s1-principal').value);
  const years=parseNum(document.getElementById('s1-years').value);
  const rate=parseNum(document.getElementById('s1-rate').value);
  const method=document.getElementById('s1-method').value;
  const cat=document.getElementById('s1-cat').value;
  const isNew=document.getElementById('s1-newused').value==='新築';
  const isChild=document.getElementById('s1-child').checked;
  const targetY=parseNum(document.getElementById('s1-target-y').value);
  const out=document.getElementById('s1-out');

  if(!salaryMan||!age||!sy||!sm||!principalMan||!years||!rate||!targetY){ out.textContent='必須項目をすべて入力してください。'; return; }

  const g=salaryMan*10000, principal=principalMan*10000;
  const { taxableIT } = taxableITFromIncome(g, age, 0);
  const { R } = residentShareFromIncome(g, age, 0);
  const tIncl = marginalIncomeRateInclSurtax(taxableIT);

  const bal = yearEndBalance(principal, rate, sy, sm, targetY, years, method);
  const cap = loanLimit(cat, isChild, isNew);
  const period = deductionYears(isNew, cat);
  const index = targetY - sy;
  if (index<0 || index>=period){ out.innerHTML='対象年は控除期間外の可能性があります（目安）。'; return; }
  const annualCredit = Math.floor(Math.min(bal, cap)*0.007);

  const itaxEst = incomeTaxAmountBeforeCredits(taxableIT);
  const usedIT = Math.min(annualCredit, itaxEst);
  const resCap = Math.min(Math.floor(taxableIT*0.05), 97500);
  const loanResCredit = Math.min(annualCredit - usedIT, resCap);

  const { d1, d2, capA, capB } = furusatoLimitGiven(tIncl, R, loanResCredit);
  const Dmax = Math.min(d1, d2);

  out.innerHTML = `上限額（簡易・推定）: <strong>${fmtJPY(Dmax)} 円</strong><br>`+
    `年末残高: ${fmtJPY(bal)} 円 / 控除上限: ${fmtJPY(cap)} 円 / 年間控除: ${fmtJPY(annualCredit)} 円<br>`+
    `所得税で使用: ${fmtJPY(usedIT)} 円 / 住民税側控除: <strong>${fmtJPY(loanResCredit)} 円</strong><br>`+
    `住民税所得割(推定・控除前): ${fmtJPY(R)} 円 / 特例上限(20%): ${fmtJPY(capA)} 円 / 住民税残: ${fmtJPY(capB)} 円<br>`+
    `<small>注: 簡易版は R（住民税所得割）や社会保険等を推定しています。e-Tax の数値が分かる場合は「精確」タブをご利用ください。</small>`;
});

// ---------- Tab 2: 精確 ----------
document.getElementById('s2-calc').addEventListener('click', ()=>{
  const salaryMan=parseNum(document.getElementById('s2-salary').value);
  const age=parseNum(document.getElementById('s2-age').value);
  const moveinY=parseNum(document.getElementById('s2-movein-y').value);
  const targetY=parseNum(document.getElementById('s2-target-y').value);
  const yearendMan=parseNum(document.getElementById('s2-yearend').value);
  const cat=document.getElementById('s2-cat').value;
  const isNew=document.getElementById('s2-newused').value==='新築';
  const isChild=document.getElementById('s2-child').checked;
  const Rman=parseNum(document.getElementById('s2-R').value);

  const realMan=parseNum(document.getElementById('s2-real').value);
  const sideMan=parseNum(document.getElementById('s2-side').value);
  const itaxMan=parseNum(document.getElementById('s2-itax').value);

  const out=document.getElementById('s2-out');

  if(!salaryMan||!age||!moveinY||!targetY||!yearendMan||!Rman){ out.textContent='必須項目をすべて入力してください。'; return; }

  const g=salaryMan*10000, addOthers=(realMan+sideMan)*10000;
  const { taxableIT } = taxableITFromIncome(g, age, addOthers);
  const tIncl = marginalIncomeRateInclSurtax(taxableIT);
  const R = Rman*10000;

  const cap = loanLimit(cat, isChild, isNew);
  const period = deductionYears(isNew, cat);
  const index = targetY - moveinY;
  if (index<0 || index>=period){ out.innerHTML='対象年は控除期間外の可能性があります（目安）。'; return; }
  const bal = yearendMan*10000;
  const annualCredit = Math.floor(Math.min(bal, cap)*0.007);

  const itaxEst = itaxMan ? (itaxMan*10000) : incomeTaxAmountBeforeCredits(taxableIT);
  const usedIT = Math.min(annualCredit, itaxEst);
  const resCap = Math.min(Math.floor(taxableIT*0.05), 97500);
  const loanResCredit = Math.min(annualCredit - usedIT, resCap);

  const { d1, d2, capA, capB } = furusatoLimitGiven(tIncl, R, loanResCredit);
  let Dmax = Math.min(d1, d2);

  const grossIncome = g + addOthers;
  const inc40 = Math.floor(grossIncome*0.40);
  const res30 = Math.floor(grossIncome*0.30);
  Dmax = Math.min(Dmax, inc40, res30);

  out.innerHTML = `上限額（精確）: <strong>${fmtJPY(Dmax)} 円</strong><br>`+
    `年末残高: ${fmtJPY(bal)} 円 / 控除上限: ${fmtJPY(cap)} 円 / 年間控除: ${fmtJPY(annualCredit)} 円<br>`+
    `所得税で使用: ${fmtJPY(usedIT)} 円 / 住民税側控除: <strong>${fmtJPY(loanResCredit)} 円</strong><br>`+
    `R(住民税所得割・調整控除後): ${fmtJPY(R)} 円 / 特例上限(20%): ${fmtJPY(capA)} 円 / 住民税残: ${fmtJPY(capB)} 円<br>`+
    `<small>注: t（実効所得税率）は課税所得から自動推定（復興特別所得税含む）。「所得税額（控除前）」を入力した場合はそれを優先します。</small>`;
});

// ---------- Tab 3: ふるさと（no loan） ----------
document.getElementById('s3-calc').addEventListener('click', ()=>{
  const salaryMan=parseNum(document.getElementById('s3-salary').value);
  const age=parseNum(document.getElementById('s3-age').value);
  const Rman=parseNum(document.getElementById('s3-R').value);
  const realMan=parseNum(document.getElementById('s3-real').value);
  const sideMan=parseNum(document.getElementById('s3-side').value);
  const itaxMan=parseNum(document.getElementById('s3-itax').value);
  const out=document.getElementById('s3-out');

  if(!salaryMan||!age||!Rman){ out.textContent='必須項目（年収・年齢・R）を入力してください。'; return; }

  const g=salaryMan*10000, addOthers=(realMan+sideMan)*10000;
  const { taxableIT } = taxableITFromIncome(g, age, addOthers);
  const tIncl = marginalIncomeRateInclSurtax(taxableIT);
  const R = Rman*10000;

  const loanResCredit = 0;

  const { d1, d2, capA, capB } = furusatoLimitGiven(tIncl, R, loanResCredit);
  let Dmax = Math.min(d1, d2);

  const grossIncome = g + addOthers;
  const inc40 = Math.floor(grossIncome*0.40);
  const res30 = Math.floor(grossIncome*0.30);
  Dmax = Math.min(Dmax, inc40, res30);

  out.innerHTML = `上限額: <strong>${fmtJPY(Dmax)} 円</strong><br>`+
    `R(住民税所得割・調整控除後): ${fmtJPY(R)} 円 / 特例上限(20%): ${fmtJPY(capA)} 円 / 住民税残: ${fmtJPY(capB)} 円<br>`+
    `<small>注: t（実効所得税率）は課税所得から自動推定（復興特別所得税含む）。</small>`;
});
