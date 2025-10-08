// Utils
const fmtJPY = n => new Intl.NumberFormat('ja-JP').format(Math.round(n||0));
const parseNum = s => { s=(''+(s??'')).replace(/,/g,'').trim(); return s?Number(s):0; };
const manToYen = s => parseNum(s)*10000;

// Tax core
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
function socialInsuranceEstimate(g,age){ const r = age<40?0.15:(age<=64?0.165:0.14); return Math.round(g*r); }

function furusatoLimit(itRate, residentIncomeSharePre, loanResCredit){
  const residentNet = Math.max(residentIncomeSharePre - loanResCredit, 0);
  const capSpecial = residentNet*0.20;
  const coeff = 1 - 0.10 - itRate;
  if (coeff<=0) return 0;
  return Math.round(capSpecial/coeff + 2000);
}

// Loan helpers
function estimatePrincipalFromAnnualPay(annualPayYen, ratePct=1.2, years=25){
  const r=ratePct/100/12, n=years*12;
  const A = annualPayYen/12;
  if (r===0) return A*n;
  return A * (Math.pow(1+r,n)-1) / (r*Math.pow(1+r,n));
}

// Format on blur
function bindComma(id){ const el=document.getElementById(id); el.addEventListener('blur',()=>{ const v=parseNum(el.value); if(Number.isFinite(v)) el.value=new Intl.NumberFormat('ja-JP').format(v); }); }
['s1-salary','s1-age','s1-annual-pay','s2-salary','s2-age','s2-yearend-bal','s3-salary','s3-age'].forEach(bindComma);

// Tabs
function selectTab(id){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('active', s.id==='tab-'+id));
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.tabs button').forEach(b=> b.addEventListener('click', ()=> selectTab(b.dataset.tab)));

// Tab1
document.getElementById('s1-calc').addEventListener('click', ()=>{
  const salaryMan=parseNum(document.getElementById('s1-salary').value);
  const age=parseNum(document.getElementById('s1-age').value);
  const annualPayMan=parseNum(document.getElementById('s1-annual-pay').value);
  const out=document.getElementById('s1-out');
  if(!salaryMan||!age||!annualPayMan){ out.textContent='必須項目（年収・年齢・住宅ローン返済額）を入力してください。'; return; }

  const g=salaryMan*10000, annualPay=annualPayMan*10000;
  const soc=socialInsuranceEstimate(g,age);
  const kyu=Math.floor(salaryDeduction(g));
  const taxableIT=Math.max(0,g-kyu-soc-BASIC_DED_IT);
  const taxableRES=Math.max(0,g-kyu-soc-BASIC_DED_RES);
  const itRate=incomeTaxRateInclSurtax(taxableIT);
  const residentIncomeSharePre=Math.floor(taxableRES*0.10);

  const balEst=estimatePrincipalFromAnnualPay(annualPay,1.2,25);
  const limitYen=30000000;
  const creditTotal=Math.floor(Math.min(balEst,limitYen)*0.007);
  const estIncomeTax=Math.floor(taxableIT*(itRate/1.021));
  const incomeTaxUsed=Math.min(creditTotal,estIncomeTax);
  const resCap=Math.min(Math.floor(taxableIT*0.05),97500);
  const loanResCredit=Math.min(creditTotal-incomeTaxUsed,resCap);

  const limit=furusatoLimit(itRate,residentIncomeSharePre,loanResCredit);
  out.innerHTML=`上限額（簡易）: <strong>${fmtJPY(limit)} 円</strong><br>`+
    `推定年末残高: 約 ${fmtJPY(balEst)} 円 / 年間控除(合計): ${fmtJPY(creditTotal)} 円 / `+
    `所得税で使用: ${fmtJPY(incomeTaxUsed)} 円 / 住民税側控除: <strong>${fmtJPY(loanResCredit)} 円</strong><br>`+
    `<small>注: 返済額→残高は利率1.2%・残存25年・元利均等の仮定。控除上限は3,000万円で保守的に評価。</small>`;
});

// Tab2
document.getElementById('s2-calc').addEventListener('click', ()=>{
  const salaryMan=parseNum(document.getElementById('s2-salary').value);
  const age=parseNum(document.getElementById('s2-age').value);
  const balMan=parseNum(document.getElementById('s2-yearend-bal').value);
  const out=document.getElementById('s2-out');
  if(!salaryMan||!age||!balMan){ out.textContent='必須項目（年収・年齢・年末残高）を入力してください。'; return; }

  const g=salaryMan*10000, bal=balMan*10000;
  const soc=socialInsuranceEstimate(g,age);
  const kyu=Math.floor(salaryDeduction(g));
  const taxableIT=Math.max(0,g-kyu-soc-BASIC_DED_IT);
  const taxableRES=Math.max(0,g-kyu-soc-BASIC_DED_RES);
  const itRate=incomeTaxRateInclSurtax(taxableIT);
  const residentIncomeSharePre=Math.floor(taxableRES*0.10);

  const limitYen=30000000;
  const creditTotal=Math.floor(Math.min(bal,limitYen)*0.007);
  const estIncomeTax=Math.floor(taxableIT*(itRate/1.021));
  const incomeTaxUsed=Math.min(creditTotal,estIncomeTax);
  const resCap=Math.min(Math.floor(taxableIT*0.05),97500);
  const loanResCredit=Math.min(creditTotal-incomeTaxUsed,resCap);

  const limit=furusatoLimit(itRate,residentIncomeSharePre,loanResCredit);
  out.innerHTML=`上限額（精確）: <strong>${fmtJPY(limit)} 円</strong><br>`+
    `年末残高: ${fmtJPY(bal)} 円 / 年間控除(合計): ${fmtJPY(creditTotal)} 円 / `+
    `所得税で使用: ${fmtJPY(incomeTaxUsed)} 円 / 住民税側控除: <strong>${fmtJPY(loanResCredit)} 円</strong><br>`+
    `<small>注: 住宅性能・区分による上限額は本簡易版では一律3,000万円で評価。</small>`;
});

// Tab3
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
