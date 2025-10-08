
function markError(el){ if(el) el.classList.add('error-input'); }
function clearErrors(scope){
  scope.querySelectorAll('.error-input').forEach(x=> x.classList.remove('error-input'));
  const old = scope.querySelector('.error-msg'); if(old) old.remove();
}
function ensureErrorBox(scope){
  let box = scope.querySelector('.error-msg'); 
  if(!box){ box = document.createElement('div'); box.className='error-msg'; scope.querySelector('.actions').after(box); }
  return box;
}


function setResult(prefix, Dmax, detailsHtml){
  const big = document.getElementById(prefix+'-dmax');
  const btn = document.getElementById(prefix+'-more');
  const det = document.getElementById(prefix+'-details');
  big.textContent = 'ふるさと納税限度額：' + fmtJPY(Dmax) + ' 円';
  btn.onclick = ()=>{ det.style.display = (det.style.display==='none')?'block':'none'; };
  det.innerHTML = detailsHtml;
}

// ------- Prefecture small adjustment example -------
const PREF_INCOME_LEVY_EXTRA = { "神奈川県": 0.00025 };

// ------- Utils -------
const NUMFMT = (typeof Intl !== 'undefined' && Intl.NumberFormat)
  ? new Intl.NumberFormat('ja-JP')
  : { format: (n)=> String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') };
const fmtJPY = n => NUMFMT.format(Math.round(n||0));
const parseNum = s => { s=(''+(s??'')).replace(/,/g,'').trim(); return s?Number(s):0; };
const manToYen = s => parseNum(s)*10000;
function bindComma(id){ const el=document.getElementById(id); if(!el) return;
  el.addEventListener('blur', ()=>{ const v=parseNum(el.value); if(Number.isFinite(v)) el.value=new Intl.NumberFormat('ja-JP').format(v); });
}
['s1-salary','s1-age','s1-start-y','s1-start-m','s1-principal','s1-years','s1-rate','s1-target-y','s1-muni-extra',
 's2-salary','s2-age','s2-start-y','s2-start-m','s2-principal','s2-years','s2-rate','s2-target-y','s2-real','s2-side','s2-itax','s2-muni-extra',
 's3-salary','s3-age','s3-real','s3-side','s3-muni-extra'].forEach(bindComma);

// ------- Tax core (approx) -------
const BRACKETS=[[0,0.05],[1950000,0.10],[3300000,0.20],[6950000,0.23],[9000000,0.33],[18000000,0.40],[40000000,0.45]];
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
  const r= age<40?0.15:(age<=64?0.165:0.14);
  return Math.round(g*r);
}
function marginalIncomeRateInclSurtax(taxable){
  let rate=BRACKETS[0][1]; for(const [th,r] of BRACKETS){ if(taxable>=th) rate=r; else break; } return rate*1.021;
}
function incomeTaxAmountBeforeCredits(taxable){
  let tax=0, prev=0;
  for(let i=0;i<BRACKETS.length;i++){
    const [th,r]=BRACKETS[i]; const next=(i+1<BRACKETS.length)?BRACKETS[i+1][0]:Infinity;
    const base=Math.max(th,prev);
    if(taxable>base){ const span=Math.min(taxable,next)-base; tax+=span*r; prev=next; } else break;
  }
  return Math.floor(tax*1.021);
}

function residentShareFromIncome(gSalary, age, addOthers, prefName, muniExtraPct){
  const soc=socialInsuranceEstimateFromSalary(gSalary,age);
  const kyu=Math.floor(salaryDeduction(gSalary));
  const taxableRES=Math.max(0, gSalary+addOthers - kyu - soc - BASIC_DED_RES);
  const extraPref = PREF_INCOME_LEVY_EXTRA[prefName] || 0;
  const extraMuni = (muniExtraPct||0)/100.0;
  const rate = 0.10 + extraPref + extraMuni;
  const R=Math.floor(taxableRES * rate);
  return {R,taxableRES, appliedRate:rate};
}
function taxableITFromIncome(gSalary, age, addOthers=0){
  const soc=socialInsuranceEstimateFromSalary(gSalary,age);
  const kyu=Math.floor(salaryDeduction(gSalary));
  const taxableIT=Math.max(0, gSalary+addOthers - kyu - soc - BASIC_DED_IT);
  return {taxableIT,soc,kyu};
}

// ------- Loan rules (limits & period) -------
function loanLimit(category, isChildYoung, isNew){ category = category||'その他';
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
    for (let i=0;i<m;i++){ bal -= pmtPrin; }
    return Math.max(0, bal);
  } else {
    if (r===0){ const pmt = principal/n; return Math.max(0, principal - pmt*m); }
    const a = principal * r * Math.pow(1+r, n) / (Math.pow(1+r, n)-1);
    for (let i=0;i<m;i++){ const interest = bal * r; const prin = a - interest; bal -= prin; }
    return Math.max(0, bal);
  }
}

// ------- Furu limit -------
function furusatoLimitGiven(tIncl, R, loanResCredit){
  const capA = 0.20 * R;
  const capB = Math.max(R - loanResCredit, 0);
  const d1 = 2000 + capA / (0.9 - tIncl);
  const d2 = 2000 + capB / (1.0 - tIncl);
  return { d1: Math.max(0, Math.floor(d1)), d2: Math.max(0, Math.floor(d2)), capA: Math.floor(capA), capB: Math.floor(capB) };
}

// ------- Tabs -------
function selectTab(id){
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active', b.dataset.tab===id));
  document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('active', s.id==='tab-'+id));
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.tabs button').forEach(b=> b.addEventListener('click', ()=> selectTab(b.dataset.tab)));

// ------- Auto/Manual helpers -------
function setupAutoManual(autoId, manualId, toggleId, computeFn){
  const autoEl = document.getElementById(autoId);
  const manEl  = document.getElementById(manualId);
  const toggle = document.getElementById(toggleId);

  function recompute(){
    if (!toggle.checked){
      const val = computeFn();
      autoEl.value = isNaN(val)?'': fmtJPY(val);
    }
  }
  toggle.addEventListener('change', ()=>{
    if (toggle.checked){ autoEl.style.display='none'; manEl.style.display='block'; manEl.focus(); }
    else{ manEl.style.display='none'; autoEl.style.display='block'; recompute(); }
  });
  const baseInputs = document.querySelectorAll('input,select');
  baseInputs.forEach(el=> el.addEventListener('input', ()=>{ if(!toggle.checked) recompute(); }));
  recompute();
  return { getValueYen: ()=> toggle.checked ? (parseNum(manEl.value)*10000) : parseNum(autoEl.value.replace(/,/g,'')) };
}

// ------- SIMPLE -------
document.getElementById('s1-calc').addEventListener('click', ()=>{
  const pref=document.getElementById('s1-pref').value;
  const salaryMan=parseNum(document.getElementById('s1-salary').value);
  const age=parseNum(document.getElementById('s1-age').value);
  const ym=document.getElementById('s1-start-ym').value; const sy= ym? Number(ym.split('-')[0]):0;
  const sm= ym? Number(ym.split('-')[1]):0;
  const principalMan=parseNum(document.getElementById('s1-principal').value);
  const years=parseNum(document.getElementById('s1-years').value);
  const rate=parseNum(document.getElementById('s1-rate').value);
  const method=document.getElementById('s1-method').value;
  const cat=document.getElementById('s1-cat').value;
  const isNew=document.getElementById('s1-newused').value==='新築';
  const isChild=document.getElementById('s1-child').checked;
  const targetY=parseNum(document.getElementById('s1-target-y').value);
  const muniExtra=0;
  const out=document.getElementById('s1-out');
  const sum=document.getElementById('s1-summary');

  
  const scope = document.getElementById('tab-simple');
  clearErrors(scope);
  const err = [];
  function gE(id){return document.getElementById(id);}
  if(!pref){ err.push('居住地'); markError(gE('s1-pref')); }
  if(!salaryMan){ err.push('年収'); markError(gE('s1-salary')); }
  if(!age){ err.push('年齢'); markError(gE('s1-age')); }
  if(!ym){ err.push('借入開始年月'); markError(gE('s1-start-ym')); }
  if(!principalMan){ err.push('借入総額'); markError(gE('s1-principal')); }
  if(!years){ err.push('返済年数'); markError(gE('s1-years')); }
  if(!rate){ err.push('年利'); markError(gE('s1-rate')); }
  if(!targetY){ err.push('対象年'); markError(gE('s1-target-y')); }
  if(err.length){ const box=ensureErrorBox(scope); box.textContent='入力不備：' + err.join('、') + ' を確認してください。'; return; }


  const g=salaryMan*10000, principal=principalMan*10000;
  const addOthers=0;
  const { taxableIT } = taxableITFromIncome(g, age, addOthers);
  const tIncl = marginalIncomeRateInclSurtax(taxableIT);
  const { R, appliedRate } = residentShareFromIncome(g, age, addOthers, pref, muniExtra);

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

  const details1 = `年末残高（推定）：${fmtJPY(bal)} 円 ／ 控除上限：${fmtJPY(cap)} 円 ／ 年間控除：${fmtJPY(annualCredit)} 円<br>`+
    `所得税で使用：${fmtJPY(usedIT)} 円 ／ 住民税側控除：<strong>${fmtJPY(loanResCredit)} 円</strong><br>`+
    `住民税所得割（推定）：${fmtJPY(R)} 円 ／ 特例上限（20%）：${fmtJPY(capA)} 円 ／ 住民税残：${fmtJPY(capB)} 円`;
  setResult('s1', Dmax, details1);
  document.getElementById('s1-dmax').closest('.result').classList.add('show');
});

// ------- PRECISE -------
function computeYearEndS2(){
  const principal=manToYen(document.getElementById('s2-principal')?.value);
  const rate=parseNum(document.getElementById('s2-rate')?.value);
  const ym=document.getElementById('s2-start-ym')?.value||'';
  const sy= ym? Number(ym.split('-')[0]):0;
  const sm= ym? Number(ym.split('-')[1]):0;
  const years=parseNum(document.getElementById('s2-years')?.value);
  const targetY=parseNum(document.getElementById('s2-target-y')?.value);
  const method=document.getElementById('s2-method')?.value;
  if(!principal||!rate||!sy||!sm||!years||!targetY) return NaN;
  return yearEndBalance(principal, rate, sy, sm, targetY, years, method);
}
function computeRS2(){
  const pref=document.getElementById('s2-pref').value;
  const muniExtra=parseNum(document.getElementById('s2-muni-extra').value);
  const g=manToYen(document.getElementById('s2-salary').value);
  const age=parseNum(document.getElementById('s2-age').value);
  const real=manToYen(document.getElementById('s2-real').value);
  const side=manToYen(document.getElementById('s2-side').value);
  if(!g||!age) return NaN;
  const { R } = residentShareFromIncome(g, age, real+side, pref, muniExtra);
  return R;
}
const ybField = setupAutoManual('s2-yearend-auto','s2-yearend-man','s2-yb-manual', computeYearEndS2);
const rField  = setupAutoManual('s2-R-auto','s2-R-man','s2-R-manual', computeRS2);

document.getElementById('s2-calc').addEventListener('click', ()=>{
  const pref=document.getElementById('s2-pref').value;
  const salaryMan=parseNum(document.getElementById('s2-salary').value);
  const age=parseNum(document.getElementById('s2-age').value);
  const ym2=document.getElementById('s2-start-ym').value; const ym2=document.getElementById('s2-start-ym').value; const sy=parseInt(ym2? ym2.split('-')[0]:0);
  const sm=parseInt(ym2? ym2.split('-')[1]:0);
  const principalMan=parseNum(document.getElementById('s2-principal').value);
  const years=parseNum(document.getElementById('s2-years').value);
  const rate=parseNum(document.getElementById('s2-rate').value);
  const method=document.getElementById('s2-method').value;
  const cat=document.getElementById('s2-cat').value;
  const isNew=document.getElementById('s2-newused').value==='新築';
  const isChild=document.getElementById('s2-child').checked;
  const targetY=parseNum(document.getElementById('s2-target-y').value);
  const muniExtra=parseNum(document.getElementById('s2-muni-extra').value);

  const realMan=parseNum(document.getElementById('s2-real').value);
  const sideMan=parseNum(document.getElementById('s2-side').value);
  const itaxMan=parseNum(document.getElementById('s2-itax').value);

  const out=document.getElementById('s2-out');
  const sum=document.getElementById('s2-summary');

  
  const scope = document.getElementById('tab-simple');
  clearErrors(scope);
  const err = [];
  function gE(id){return document.getElementById(id);}
  if(!pref){ err.push('居住地'); markError(gE('s1-pref')); }
  if(!salaryMan){ err.push('年収'); markError(gE('s1-salary')); }
  if(!age){ err.push('年齢'); markError(gE('s1-age')); }
  if(!ym){ err.push('借入開始年月'); markError(gE('s1-start-ym')); }
  if(!principalMan){ err.push('借入総額'); markError(gE('s1-principal')); }
  if(!years){ err.push('返済年数'); markError(gE('s1-years')); }
  if(!rate){ err.push('年利'); markError(gE('s1-rate')); }
  if(!targetY){ err.push('対象年'); markError(gE('s1-target-y')); }
  if(err.length){ const box=ensureErrorBox(scope); box.textContent='入力不備：' + err.join('、') + ' を確認してください。'; return; }


  const g=salaryMan*10000, addOthers=(realMan+sideMan)*10000;
  const { taxableIT } = taxableITFromIncome(g, age, addOthers);
  const tIncl = marginalIncomeRateInclSurtax(taxableIT);

  const bal = ybField.getValueYen();
  const R = rField.getValueYen();

  const cap = loanLimit(cat, isChild, isNew);
  const period = deductionYears(isNew, cat);
  const index = targetY - sy;
  if (index<0 || index>=period){ out.innerHTML='対象年は控除期間外の可能性があります（目安）。'; return; }
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

  const { appliedRate } = residentShareFromIncome(g, age, addOthers, pref, muniExtra);
  const details2 = `年末残高：${fmtJPY(bal)} 円 ／ 控除上限：${fmtJPY(cap)} 円 ／ 年間控除：${fmtJPY(annualCredit)} 円<br>`+
    `所得税で使用：${fmtJPY(usedIT)} 円 ／ 住民税側控除：<strong>${fmtJPY(loanResCredit)} 円</strong><br>`+
    `R（住民税所得割）：${fmtJPY(R)} 円 ／ 特例上限（20%）：${fmtJPY(capA)} 円 ／ 住民税残：${fmtJPY(capB)} 円`;
  setResult('s2', Dmax, details2);
  document.getElementById('s2-dmax').closest('.result').classList.add('show');
});

// ------- PLAIN -------
function computeRS3(){
  const pref=document.getElementById('s3-pref').value;
  const muniExtra=parseNum(document.getElementById('s3-muni-extra').value);
  const g=manToYen(document.getElementById('s3-salary').value);
  const age=parseNum(document.getElementById('s3-age').value);
  const real=manToYen(document.getElementById('s3-real').value);
  const side=manToYen(document.getElementById('s3-side').value);
  if(!g||!age) return NaN;
  const { R } = residentShareFromIncome(g, age, real+side, pref, muniExtra);
  return R;
}
function setupRAutoManual(prefix){
  return setupAutoManual(`${prefix}-R-auto`, `${prefix}-R-man`, `${prefix}-R-manual`, prefix==='s3'?computeRS3:computeRS2);
}
const r3Field = setupRAutoManual('s3');

document.getElementById('s3-calc').addEventListener('click', ()=>{
  const pref=document.getElementById('s3-pref').value;
  const salaryMan=parseNum(document.getElementById('s3-salary').value);
  const age=parseNum(document.getElementById('s3-age').value);
  const muniExtra=parseNum(document.getElementById('s3-muni-extra').value);
  const out=document.getElementById('s3-out');
  const sum=document.getElementById('s3-summary');

  
  const scope = document.getElementById('tab-plain');
  clearErrors(scope);
  const err = [];
  function gE(id){return document.getElementById(id);}
  if(!pref){ err.push('居住地'); markError(gE('s3-pref')); }
  if(!salaryMan){ err.push('年収'); markError(gE('s3-salary')); }
  if(!age){ err.push('年齢'); markError(gE('s3-age')); }
  if(isNaN(muniExtra) || String(muniExtra)===''){ err.push('市区町村の超過課税'); markError(gE('s3-muni-extra')); }
  if(err.length){ const box=ensureErrorBox(scope); box.textContent='入力不備：' + err.join('、') + ' を確認してください。'; return; }


  const g=salaryMan*10000;
  const realMan=parseNum(document.getElementById('s3-real').value);
  const sideMan=parseNum(document.getElementById('s3-side').value);
  const addOthers=(realMan+sideMan)*10000;

  const { taxableIT } = taxableITFromIncome(g, age, addOthers);
  const tIncl = marginalIncomeRateInclSurtax(taxableIT);
  const R = r3Field.getValueYen();

  const loanResCredit = 0;
  const { d1, d2, capA, capB } = furusatoLimitGiven(tIncl, R, loanResCredit);
  let Dmax = Math.min(d1, d2);

  const grossIncome = g + addOthers;
  const inc40 = Math.floor(grossIncome*0.40);
  const res30 = Math.floor(grossIncome*0.30);
  Dmax = Math.min(Dmax, inc40, res30);

  const { appliedRate } = residentShareFromIncome(g, age, addOthers, pref, muniExtra);
  const details3 = `R（住民税所得割）：${fmtJPY(R)} 円 ／ 特例上限（20%）：${fmtJPY(capA)} 円 ／ 住民税残：${fmtJPY(capB)} 円`;
  setResult('s3', Dmax, details3);
  document.getElementById('s3-dmax').closest('.result').classList.add('show');
  setResult('s2', Dmax, details2);
  document.getElementById('s2-dmax').closest('.result').classList.add('show');
});

// ---- Feature banner ----
(function(){
  var okGrid = !!(window.CSS && CSS.supports && CSS.supports('display','grid'));
  if(!okGrid){
    var w = document.getElementById('compatWarn');
    if(w) w.style.display = 'block';
  }
})();

const FEEDBACK_EMAIL = 'gwycoco@gmail.com';
const fbMask = document.getElementById('fbMask');
const fbModal = document.getElementById('fbModal');
const fbOpen = document.getElementById('fbOpen');
const fbClose = document.getElementById('fbClose');
const fbForm = document.getElementById('fbForm');
const fbPreview = document.getElementById('fbPreview');
const fbConfirm = document.getElementById('fbConfirm');
const fbSend = document.getElementById('fbSend');
const fbMsg = document.getElementById('fbMsg');

function openFb(){ fbMask.style.display='block'; fbModal.style.display='flex'; }
function closeFb(){ fbMask.style.display='none'; fbModal.style.display='none'; fbConfirm.style.display='none'; fbForm.style.display='block'; fbForm.reset(); fbMsg.textContent=''; }
fbOpen.addEventListener('click', openFb);
fbClose.addEventListener('click', closeFb);
fbMask.addEventListener('click', closeFb);

fbPreview.addEventListener('click', ()=>{
  fbMsg.textContent='';
  const fd = new FormData(fbForm);
  const name = (fd.get('name')||'').toString().trim();
  const email = (fd.get('email')||'').toString().trim();
  const message = (fd.get('message')||'').toString().trim();
  fbForm.querySelectorAll('input,textarea').forEach(el=> el.classList.remove('error-input'));
  if(!message){ fbMsg.textContent='「ご要望」は必須です。'; fbForm.querySelector('[name=message]').classList.add('error-input'); return; }
  document.getElementById('c_name').textContent = name||'(未入力)';
  document.getElementById('c_email').textContent = email||'(未入力)';
  document.getElementById('c_message').textContent = message;
  fbForm.style.display='none'; fbConfirm.style.display='block';
});

fbSend.addEventListener('click', ()=>{
  const name = document.getElementById('c_name').textContent;
  const email = document.getElementById('c_email').textContent;
  const message = document.getElementById('c_message').textContent;
  const subject = encodeURIComponent('【改良リクエスト】ふるさと納税×住宅ローン控除');
  const body = encodeURIComponent(`お名前: ${name}\nメール: ${email}\n\nご要望:\n${message}`);
  const a = document.createElement('a');
  a.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
  document.body.appendChild(a); a.click(); a.remove();
  closeFb();
});
