// -------- Utils --------
const fmtJPY = n => new Intl.NumberFormat('ja-JP').format(Math.round(n||0));
const parseNum = s => { s=(''+(s??'')).replace(/,/g,'').trim(); return s?Number(s):0; };
const manToYen = s => parseNum(s)*10000;

// -------- Tax core --------
function incomeTaxRateInclSurtax(taxable){
  const b = [[0,0.05],[1950000,0.10],[3300000,0.20],[6950000,0.23],[9000000,0.33],[18000000,0.40],[40000000,0.45]];
  let r=b[0][1]; for(const [th,rate] of b){ if(taxable>=th) r=rate; else break; } return r*1.021;
}
const BASIC_DED_IT=480000, BASIC_DED_RES=430000;
function salaryDeduction(g){
  if(g<=1625000) return 550000;
  if(g<=1800000) return g*0.40-100000;
  if(g<=3600000) return g*0.30+80000;
  if(g<=6600000) return g*0.20+440000;
  if(g<=8500000) return g*0.10+1100000;
  return 1950000;
}
function socialInsuranceEstimate(g,age){ const r= age<40?0.15:(age<=64?0.165:0.14); return Math.round(g*r); }

function furusatoLimit(itRate, residentIncomeSharePre, loanResCredit){
  const residentNet = Math.max(residentIncomeSharePre - loanResCredit, 0);
  const capSpecial = residentNet*0.20;
  const coeff = 1 - 0.10 - itRate;
  if (coeff<=0) return 0;
  return Math.round(capSpecial/coeff + 2000);
}

// -------- Loan math --------
function yearEndBalance(principal, ratePct, startY, startM, targetY, years, method){
  const r = ratePct/100/12;
  const n = years*12;
  const monthsElapsed = Math.max(0, (targetY - startY)*12 + (12 - startM + 1)); // approximate Dec-end months since start
  const m = Math.min(monthsElapsed, n);
  let bal = principal;
  if (method==='元金均等'){
    const pmtPrin = principal/n;
    for (let i=0;i<m;i++){
      const interest = bal * r;
      bal -= pmtPrin;
    }
    return Math.max(0, bal);
  } else {
    if (r===0){
      const pmt = principal/n;
      return Math.max(0, principal - pmt*m);
    }
    const a = principal * r * Math.pow(1+r, n) / (Math.pow(1+r, n)-1);
    for (let i=0;i<m;i++){
      const interest = bal * r;
      const principalPart = a - interest;
      bal -= principalPart;
    }
    return Math.max(0, bal);
  }
}

// Format on blur
function bindComma(id){ const el=document.getElementById(id); if(!el) return; el.addEventListener('blur',()=>{ const v=parseNum(el.value); if(Number.isFinite(v)) el.value=new Intl.NumberFormat('ja-JP').format(v); }); }
['s1-salary','s1-age','s1-start-y','s1-start-m','s1-principal','s1-years','s1-rate','s1-target-y',
 's2-salary','s2-age','s2-start-y','s2-start-m','s2-principal','s2-years','s2-rate','s2-target-y','s2-cap-man',
 's3-salary','s3-age'].forEach(bindComma);

// Tabs
function selectTab(id){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('active', s.id==='tab-'+id));
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.tabs button').forEach(b=> b.addEventListener('click', ()=> selectTab(b.dataset.tab)));

// ---- Tab 1 (simplified) ----
document.getElementById('s1-calc').addEventListener('click', ()=>{
  const salaryMan=parseNum(document.getElementById('s1-salary').value);
  const age=parseNum(document.getElementById('s1-age').value);
  const sy=parseNum(document.getElementById('s1-start-y').value);
  const sm=parseNum(document.getElementById('s1-start-m').value);
  const principalMan=parseNum(document.getElementById('s1-principal').value);
  const years=parseNum(document.getElementById('s1-years').value);
  const rate=parseNum(document.getElementById('s1-rate').value);
  const method=document.getElementById('s1-method').value;
  const targetY=parseNum(document.getElementById('s1-target-y').value);
  const out=document.getElementById('s1-out');

  if(!salaryMan||!age||!sy||!sm||!principalMan||!years||!rate||!targetY){ out.textContent='必須項目をすべて入力してください。'; return; }

  const g=salaryMan*10000, principal=principalMan*10000;
  const soc=socialInsuranceEstimate(g,age);
  const kyu=Math.floor(salaryDeduction(g));
  const taxableIT=Math.max(0,g-kyu-soc-BASIC_DED_IT);
  const taxableRES=Math.max(0,g-kyu-soc-BASIC_DED_RES);
  const itRate=incomeTaxRateInclSurtax(taxableIT);
  const residentIncomeSharePre=Math.floor(taxableRES*0.10);

  const bal = yearEndBalance(principal, rate, sy, sm, targetY, years, method);
  const capYen = 30000000; // 簡易版は 3,000 万円上限
  const annualCredit = Math.floor(Math.min(bal, capYen)*0.007);
  const incomeTaxEst = Math.floor(taxableIT*(itRate/1.021));
  const usedIT = Math.min(annualCredit, incomeTaxEst);
  const resCap = Math.min(Math.floor(taxableIT*0.05), 97500);
  const loanResCredit = Math.min(annualCredit - usedIT, resCap);

  const limit=furusatoLimit(itRate, residentIncomeSharePre, loanResCredit);
  out.innerHTML = `上限額（簡易）: <strong>${fmtJPY(limit)} 円</strong><br>`+
    `年末残高: 約 ${fmtJPY(bal)} 円 / 年間控除: ${fmtJPY(annualCredit)} 円 / 所得税で使用: ${fmtJPY(usedIT)} 円 / `+
    `住民税側控除: <strong>${fmtJPY(loanResCredit)} 円</strong><br>`+
    `<small>注: 住宅性能に基づく上限は本タブでは一律 3,000 万円で評価します。</small>`;
});

// ---- Tab 2 (precise) ----
document.getElementById('s2-calc').addEventListener('click', ()=>{
  const salaryMan=parseNum(document.getElementById('s2-salary').value);
  const age=parseNum(document.getElementById('s2-age').value);
  const sy=parseNum(document.getElementById('s2-start-y').value);
  const sm=parseNum(document.getElementById('s2-start-m').value);
  const principalMan=parseNum(document.getElementById('s2-principal').value);
  const years=parseNum(document.getElementById('s2-years').value);
  const rate=parseNum(document.getElementById('s2-rate').value);
  const method=document.getElementById('s2-method').value;
  const targetY=parseNum(document.getElementById('s2-target-y').value);
  const capMan=parseNum(document.getElementById('s2-cap-man').value);
  const out=document.getElementById('s2-out');

  if(!salaryMan||!age||!sy||!sm||!principalMan||!years||!rate||!targetY||!capMan){ out.textContent='必須項目をすべて入力してください。'; return; }

  const g=salaryMan*10000, principal=principalMan*10000, capYen=capMan*10000;
  const soc=socialInsuranceEstimate(g,age);
  const kyu=Math.floor(salaryDeduction(g));
  const taxableIT=Math.max(0,g-kyu-soc-BASIC_DED_IT);
  const taxableRES=Math.max(0,g-kyu-soc-BASIC_DED_RES);
  const itRate=incomeTaxRateInclSurtax(taxableIT);
  const residentIncomeSharePre=Math.floor(taxableRES*0.10);

  const bal = yearEndBalance(principal, rate, sy, sm, targetY, years, method);
  const annualCredit = Math.floor(Math.min(bal, capYen)*0.007);
  const incomeTaxEst = Math.floor(taxableIT*(itRate/1.021));
  const usedIT = Math.min(annualCredit, incomeTaxEst);
  const resCap = Math.min(Math.floor(taxableIT*0.05), 97500);
  const loanResCredit = Math.min(annualCredit - usedIT, resCap);

  const limit=furusatoLimit(itRate, residentIncomeSharePre, loanResCredit);
  out.innerHTML = `上限額（精確）: <strong>${fmtJPY(limit)} 円</strong><br>`+
    `年末残高: ${fmtJPY(bal)} 円 / 上限: ${fmtJPY(capYen)} 円 / 年間控除: ${fmtJPY(annualCredit)} 円 / `+
    `所得税で使用: ${fmtJPY(usedIT)} 円 / 住民税側控除: <strong>${fmtJPY(loanResCredit)} 円</strong>`;
});

// ---- Tab 3 (no loan) ----
document.getElementById('s3-calc').addEventListener('click', ()=>{
  const salaryMan=parseNum(document.getElementById('s3-salary').value);
  const age=parseNum(document.getElementById('s3-age').value);
  const out=document.getElementById('s3-out');
  if(!salaryMan||!age){ out.textContent='必須項目（年収・年齢）を入力してください。'; return; }

  const g=salaryMan*10000;
  const soc=socialInsuranceEstimate(g,age);
  const kyu=Math.floor(salaryDeduction(g));
  const taxableIT=Math.max(0,g-kyu-soc-BASIC_DED_IT);
  const taxableRES=Math.max(0,g-kyu-soc-BASIC_DED_RES);
  const itRate=incomeTaxRateInclSurtax(taxableIT);
  const residentIncomeSharePre=Math.floor(taxableRES*0.10);

  const limit=furusatoLimit(itRate,residentIncomeSharePre,0);
  out.innerHTML=`上限額: <strong>${fmtJPY(limit)} 円</strong><br>`+
    `（住宅ローン控除なし） / 住民税所得割(控除前): ${fmtJPY(residentIncomeSharePre)} 円 / 所得税の実効率: ${(itRate*100).toFixed(2)}%`;
});
