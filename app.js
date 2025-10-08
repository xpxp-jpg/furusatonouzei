/* Core tax logic in JS (client-side only) */
const fmt = (n)=> new Intl.NumberFormat('ja-JP').format(Math.round(n||0));
const parseNum = (s)=> {
  if (s==null) return 0;
  s = (''+s).replace(/,/g,'').trim();
  if (!s) return 0;
  return Number(s);
};

function incomeTaxRateInclSurtax(taxable){
  const b = [[0,0.05],[1950000,0.10],[3300000,0.20],[6950000,0.23],[9000000,0.33],[18000000,0.40],[40000000,0.45]];
  let r = b[0][1];
  for (const [th,rate] of b){ if (taxable >= th) r=rate; else break; }
  return r*1.021;
}
const BASIC_DED_IT = 480000, BASIC_DED_RES = 430000;
function salaryDeduction(g){
  if (g<=1625000) return 550000;
  if (g<=1800000) return g*0.40-100000;
  if (g<=3600000) return g*0.30+80000;
  if (g<=6600000) return g*0.20+440000;
  if (g<=8500000) return g*0.10+1100000;
  return 1950000;
}
function residentDependentDeduction(a,b,c,d){ return a*330000 + b*450000 + c*380000 + d*450000; }
function incomeDependentDeduction(a,b,c,d){ return a*380000 + b*630000 + c*480000 + d*580000; }
function spouseDedRes(sp){ return (sp && sp<=1030000)?330000:0; }
function spouseDedIT(sp){ return (sp && sp<=1030000)?380000:0; }
function socialInsuranceEstimate(g,age){ let rate = age<40?0.15:(age<=64?0.165:0.14); return Math.round(g*rate); }

function furusatoLimit(incomeTaxRateIncl, residentIncomeSharePre, housingLoanCreditResident, otherResidentCredits){
  const residentNet = Math.max(residentIncomeSharePre - housingLoanCreditResident - otherResidentCredits, 0);
  const capSpecial = residentNet * 0.20;
  const coeff = 1 - 0.10 - incomeTaxRateIncl;
  if (coeff <= 0) return 0;
  return Math.round(capSpecial/coeff + 2000);
}

// Loan caps (2024–2025 cohorts). Non-child/young household: 認定4500万/ZEH3500万/省エネ3000万; child-young: 5000/4500/4000;その他:2000
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

function yearEndBalanceFixed(principal, annualRate, monthsElapsed, totalMonths, method){
  const r = annualRate/12/100, n=totalMonths;
  if (method==='元金均等'){
    const bal = principal - (principal/n)*monthsElapsed;
    return Math.max(0, bal);
  } else {
    if (r===0) {
      const monthly = principal/n;
      return Math.max(0, principal - monthly*monthsElapsed);
    }
    const a = principal * r * Math.pow(1+r, n) / (Math.pow(1+r, n)-1);
    let bal = principal;
    for (let i=0;i<Math.min(monthsElapsed,n);i++){
      const interest = bal * r;
      const principalPart = a - interest;
      bal -= principalPart;
    }
    return Math.max(0, bal);
  }
}

function residentSideCreditThisYear(args){
  const {
    moveInYear, targetYear, isNew, category, isChildYoung,
    principal, rate, years, startY, startM, method,
    salary, age, dgen, dsp, d70n, d70c, spSalary
  } = args;
  const limit = loanLimit(category, isChildYoung, isNew);
  const period = deductionYears(isNew, category);
  const index = targetYear - moveInYear;
  if (index<0 || index>=period) return { error: "対象年は控除期間外です。" };
  const monthsFromStart = Math.max(0, (targetYear - startY)*12 + (12 - startM + 1));
  const totalMonths = years*12;
  const bal = yearEndBalanceFixed(principal, rate, Math.min(monthsFromStart,totalMonths), totalMonths, method);
  const creditBase = Math.min(bal, limit);
  const annualCredit = Math.floor(creditBase * 0.007);

  const soc = socialInsuranceEstimate(salary, age);
  const kyu = Math.floor(salaryDeduction(salary));
  const itDep = incomeDependentDeduction(dgen, dsp, d70n, d70c);
  const resDep = residentDependentDeduction(dgen, dsp, d70n, d70c);
  const taxableIT = Math.max(0, salary - kyu - soc - BASIC_DED_IT - itDep - spouseDedIT(spSalary));
  const taxableRES= Math.max(0, salary - kyu - soc - BASIC_DED_RES - resDep - spouseDedRes(spSalary));
  const itRate = incomeTaxRateInclSurtax(taxableIT);
  const estIncomeTax = Math.floor(taxableIT * (itRate/1.021));
  const incomeTaxUsed = Math.min(annualCredit, estIncomeTax);
  const remaining = annualCredit - incomeTaxUsed;
  const residentCap = Math.min(Math.floor(taxableIT*0.05), 97500);
  const residentCredit = Math.min(remaining, residentCap);

  return {
    yearEndBalance: Math.round(bal),
    loanLimitUsed: limit,
    annualCreditTotal: annualCredit,
    incomeTaxEst: estIncomeTax,
    incomeTaxUsed: incomeTaxUsed,
    residentCreditCap: residentCap,
    residentCredit: residentCredit,
    taxableIT: taxableIT,
    taxableRES: taxableRES,
    incomeTaxRateIncl: itRate
  };
}

// Prefecture list
const PREFS = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];

// UI wiring
function selectTab(id){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('active', s.id === 'tab-'+id));
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=> selectTab(btn.dataset.tab));
});

// Formatting on blur (thousand separators)
function bindComma(input, allowFloat=false){
  input.addEventListener('blur', ()=>{
    let v = input.value.trim(); if(!v) return;
    v = v.replace(/,/g,'');
    if (allowFloat){
      if (v.includes('.')){
        const [i,f] = v.split('.',2);
        const i2 = (Number(i)||0).toLocaleString('ja-JP');
        input.value = `${i2}.${f}`;
      } else {
        input.value = (Number(v)||0).toLocaleString('ja-JP');
      }
    } else {
      input.value = (Number(v)||0).toLocaleString('ja-JP');
    }
  });
}

// Populate prefectures & bind formatters
(function init(){
  const rs = document.getElementById('rs-pref');
  PREFS.forEach(p=>{
    const opt = document.createElement('option');
    opt.textContent = p; rs.appendChild(opt);
  });
  document.querySelectorAll('input[inputmode="numeric"]').forEach(i=>bindComma(i,false));
  document.querySelectorAll('input[inputmode="decimal"]').forEach(i=>bindComma(i,true));
})();

// Quick calc
document.getElementById('q-calc').addEventListener('click', ()=>{
  const g = parseNum(document.getElementById('q-salary').value);
  const age = parseNum(document.getElementById('q-age').value);
  const a = parseNum(document.getElementById('q-dep-gen').value);
  const b = parseNum(document.getElementById('q-dep-sp').value);
  const c = parseNum(document.getElementById('q-dep-70n').value);
  const d = parseNum(document.getElementById('q-dep-70c').value);
  const sp = parseNum(document.getElementById('q-sp-salary').value);
  const otherRes = parseNum(document.getElementById('q-other-res').value);
  const hasLoan = document.getElementById('q-has-home-loan').checked;

  // resident income share: prefer resident tab result if user calculated
  let residentIncomeShare = window._resident_income_share_pre || null;
  if (residentIncomeShare == null){
    const soc = socialInsuranceEstimate(g,age);
    const kyu = Math.floor(salaryDeduction(g));
    const resDep = residentDependentDeduction(a,b,c,d);
    const taxableRes = Math.max(0, g - kyu - soc - BASIC_DED_RES - resDep - spouseDedRes(sp));
    residentIncomeShare = Math.floor(taxableRes * 0.10);
  }

  const itDep = incomeDependentDeduction(a,b,c,d);
  const soc2 = socialInsuranceEstimate(g,age);
  const kyu2 = Math.floor(salaryDeduction(g));
  const taxableIT = Math.max(0, g - kyu2 - soc2 - BASIC_DED_IT - itDep - spouseDedIT(sp));
  const itRate = incomeTaxRateInclSurtax(taxableIT);

  let loanRes = window._loan_resident_credit || 0;
  if (!hasLoan) loanRes = 0;

  const limit = furusatoLimit(itRate, residentIncomeShare, loanRes, otherRes);
  document.getElementById('q-result').innerHTML =
    `上限額（概算）: <strong>${fmt(limit)} 円</strong><br>`+
    `所得税の実効率: ${(itRate*100).toFixed(2)}% / 住民税所得割(控除前): ${fmt(residentIncomeShare)} 円 / 住宅ローン控除(住民税側): ${fmt(loanRes)} 円`;
});

// Precise calc
document.getElementById('p-calc').addEventListener('click', ()=>{
  const taxableIT = parseNum(document.getElementById('p-taxable-it').value);
  const residentShare = parseNum(document.getElementById('p-resident-share').value);
  const loanRes = parseNum(document.getElementById('p-loan-res').value);
  const otherRes = parseNum(document.getElementById('p-other-res').value);
  const itRate = incomeTaxRateInclSurtax(taxableIT);
  const limit = furusatoLimit(itRate, residentShare, loanRes, otherRes);
  document.getElementById('p-result').innerHTML =
    `上限額: <strong>${fmt(limit)} 円</strong>（自己負担2,000円想定）`;
});

// Loan calc
document.getElementById('ln-calc').addEventListener('click', ()=>{
  const out = residentSideCreditThisYear({
    moveInYear: parseNum(document.getElementById('ln-movein').value),
    targetYear: parseNum(document.getElementById('ln-target').value),
    isNew: document.getElementById('ln-newused').value==='新築',
    category: document.getElementById('ln-category').value,
    isChildYoung: document.getElementById('ln-child').checked,
    principal: parseNum(document.getElementById('ln-principal').value),
    rate: Number((''+document.getElementById('ln-rate').value).replace(/,/g,'')),
    years: parseNum(document.getElementById('ln-years').value),
    startY: parseNum(document.getElementById('ln-start-y').value),
    startM: parseNum(document.getElementById('ln-start-m').value),
    method: document.getElementById('ln-method').value,
    salary: parseNum(document.getElementById('ld-salary').value),
    age: parseNum(document.getElementById('ld-age').value),
    dgen: parseNum(document.getElementById('ld-dep-gen').value),
    dsp: parseNum(document.getElementById('ld-dep-sp').value),
    d70n: parseNum(document.getElementById('ld-dep-70n').value),
    d70c: parseNum(document.getElementById('ld-dep-70c').value),
    spSalary: parseNum(document.getElementById('ld-sp-salary').value),
  });
  if (out.error){
    document.getElementById('ln-result').textContent = out.error; return;
  }
  window._loan_resident_credit = out.residentCredit;
  document.getElementById('p-loan-res').value = fmt(out.residentCredit); // auto sync to precise
  document.getElementById('ln-result').innerHTML =
    `年末残高: ${fmt(out.yearEndBalance)} / 年間控除: ${fmt(out.annualCreditTotal)} / `+
    `所得税で使用: ${fmt(out.incomeTaxUsed)} / 住民税上限: ${fmt(out.residentCreditCap)} / `+
    `今年の住民税側控除: <strong>${fmt(out.residentCredit)}</strong>`;
  selectTab('precise');
});

// Resident calc
document.getElementById('rs-calc').addEventListener('click', ()=>{
  const pref = document.getElementById('rs-pref').value;
  const extraRate = Number((''+document.getElementById('rs-extra').value).replace(/,/g,''))/100;
  const capPref = parseNum(document.getElementById('rs-cap-pref').value);
  const capCity = parseNum(document.getElementById('rs-cap-city').value);
  const g = parseNum(document.getElementById('rs-salary').value);
  const age = parseNum(document.getElementById('rs-age').value);
  const a = parseNum(document.getElementById('rs-dep-gen').value);
  const b = parseNum(document.getElementById('rs-dep-sp').value);
  const c = parseNum(document.getElementById('rs-dep-70n').value);
  const d = parseNum(document.getElementById('rs-dep-70c').value);
  const sp = parseNum(document.getElementById('rs-sp-salary').value);
  const other = parseNum(document.getElementById('rs-other').value);

  const soc = socialInsuranceEstimate(g,age);
  const kyu = Math.floor(salaryDeduction(g));
  const resDep = residentDependentDeduction(a,b,c,d);
  const taxableRes = Math.max(0, g - kyu - soc - BASIC_DED_RES - resDep - spouseDedRes(sp));
  const base = taxableRes * 0.10;
  const incomeShare = Math.round(base*(1+extraRate));
  const perCapita = capPref + capCity;

  window._resident_income_share_pre = incomeShare;
  document.getElementById('rs-result').innerHTML =
    `${pref}｜住民税課税所得: ${fmt(taxableRes)} / 所得割(控除前): <strong>${fmt(incomeShare)}</strong> `+
    `（内10%基礎: ${fmt(base)} + 上乗せ率 ${(extraRate*100)||0}%） / 均等割(参考): ${fmt(perCapita)} / 税額控除(任意): ${fmt(other)}`;
});

document.getElementById('rs-apply').addEventListener('click', ()=>{
  if (window._resident_income_share_pre!=null){
    document.getElementById('p-resident-share').value = fmt(window._resident_income_share_pre);
  }
  const other = parseNum(document.getElementById('rs-other').value);
  document.getElementById('p-other-res').value = fmt(other);
  selectTab('precise');
});
