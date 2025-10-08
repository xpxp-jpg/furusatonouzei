// app.js v7.5.2 (robust init + validation + formatting)
const NUMFMT = (typeof Intl !== 'undefined' && Intl.NumberFormat)
  ? new Intl.NumberFormat('ja-JP')
  : { format: (n)=> String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') };
const fmtJPY = n => NUMFMT.format(Math.round(n||0));
function sanitizeNumber(s){return Number((''+(s??'')).replace(/[,\s]/g,'').replace(/[％%]/g,'').replace(/[－—–−]/g,'-'));}
function parseNum(s){ const n = sanitizeNumber(s); return Number.isFinite(n)?n:0; }
function parsePercentTo100Scale(s){let raw=(''+(s??'')).trim();if(/[％%]$/.test(raw)) raw=raw.slice(0,-1);const n=sanitizeNumber(raw);if(!Number.isFinite(n))return 0;return n<=1?n*100:n;}
function bindFormat(id,decimals=0){const el=document.getElementById(id);if(!el)return;el.addEventListener('blur',()=>{const v=sanitizeNumber(el.value);if(!Number.isFinite(v))return;el.value=v.toLocaleString('ja-JP',{maximumFractionDigits:decimals,minimumFractionDigits:0});});}
const manToYen=s=>parseNum(s)*10000;
const BRACKETS=[[0,0.05],[1950000,0.10],[3300000,0.20],[6950000,0.23],[9000000,0.33],[18000000,0.40],[40000000,0.45]];
const BASIC_DED_IT=480000,BASIC_DED_RES=430000;
function salaryDeduction(g){if(g<=1625000)return 550000;if(g<=1800000)return g*0.40-100000;if(g<=3600000)return g*0.30+80000;if(g<=6600000)return g*0.20+440000;if(g<=8500000)return g*0.10+1100000;return 1950000;}
function socialInsuranceEstimateFromSalary(g,age){const r=age<40?0.15:(age<=64?0.165:0.14);return Math.round(g*r);}
function taxableITFromIncome(gSalary,age,addOthers=0){const soc=socialInsuranceEstimateFromSalary(gSalary,age);const kyu=Math.floor(salaryDeduction(gSalary));const taxableIT=Math.max(0,gSalary+addOthers-kyu-soc-BASIC_DED_IT);return {taxableIT,soc,kyu};}
function marginalIncomeRateInclSurtax(taxable){let rate=BRACKETS[0][1];for(const [th,r] of BRACKETS){if(taxable>=th)rate=r;else break;}return rate*1.021;}
function residentShareFromIncome(gSalary,age,addOthers,prefName,muniExtraPct){const soc=socialInsuranceEstimateFromSalary(gSalary,age);const kyu=Math.floor(salaryDeduction(gSalary));const taxableRES=Math.max(0,gSalary+addOthers-kyu-soc-BASIC_DED_RES);const PREF_INCOME_LEVY_EXTRA={'神奈川県':0.00025};const extraPref=PREF_INCOME_LEVY_EXTRA[prefName]||0;const extraMuni=(muniExtraPct||0)/100.0;const rate=0.10+extraPref+extraMuni;const R=Math.floor(taxableRES*rate);return {R,taxableRES,appliedRate:rate};}
function loanLimit(category,isChildYoung,isNew){category=category||'その他';if(category==='その他')return 20000000;if(isNew){if(isChildYoung){if(category==='認定')return 50000000;if(category==='ZEH')return 45000000;if(category==='省エネ')return 40000000;}else{if(category==='認定')return 45000000;if(category==='ZEH')return 35000000;if(category==='省エネ')return 30000000;}}if(['認定','ZEH','省エネ'].includes(category))return 30000000;return 20000000;}
function deductionYears(isNew,category){return category==='その他'?10:(isNew?13:10);}
function yearEndBalance(principal,ratePct,startY,startM,targetY,years,method){const r=ratePct/100/12;const n=years*12;const monthsElapsed=Math.max(0,(targetY-startY)*12+(12-startM+1));const m=Math.min(monthsElapsed,n);let bal=principal;if(method==='元金均等'){const pmtPrin=principal/n;for(let i=0;i<m;i++){bal-=pmtPrin;}return Math.max(0,bal);}else{if(r===0){const pmt=principal/n;return Math.max(0,principal-pmt*m);}const a=principal*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);for(let i=0;i<m;i++){const interest=bal*r;const prin=a-interest;bal-=prin;}return Math.max(0,bal);}}
function furusatoLimitGiven(tIncl,R,loanResCredit){const capA=0.20*R;const capB=Math.max(R-loanResCredit,0);const d1=2000+capA/(0.9-tIncl);const d2=2000+capB/(1.0-tIncl);return {d1:Math.max(0,Math.floor(d1)),d2:Math.max(0,Math.floor(d2)),capA:Math.floor(capA),capB:Math.floor(capB)};}
function incomeTaxAmountBeforeCredits(taxable){let tax=0;const bands=[[0,1950000,0.05,0],[1950000,3300000,0.10,97500],[3300000,6950000,0.20,427500],[6950000,9000000,0.23,636000],[9000000,18000000,0.33,1536000],[18000000,40000000,0.40,2796000],[40000000,Infinity,0.45,4796000]];for(const [lo,hi,rate,ded] of bands){if(taxable>lo){const base=Math.min(taxable,hi)-lo;tax=base*rate-ded;}}return Math.max(0,Math.floor(tax*1.021));}
function isValidYYYYMM(ym){return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym||'');}
function markError(el){if(el)el.classList.add('error-input');}
function clearErrors(scope){scope.querySelectorAll('.error-input').forEach(x=>x.classList.remove('error-input'));const old=scope.querySelector('.error-msg');if(old)old.remove();}
function ensureErrorBox(scope){let box=scope.querySelector('.error-msg');if(!box){box=document.createElement('div');box.className='error-msg';box.setAttribute('role','alert');box.setAttribute('aria-live','polite');const actions=scope.querySelector('.actions');(actions?.parentNode)?.insertBefore(box,actions.nextSibling);}return box;}
function setResult(prefix,Dmax,detailsHtml){const big=document.getElementById(prefix+'-dmax');const btn=document.getElementById(prefix+'-more');const det=document.getElementById(prefix+'-details');const box=big?.closest('.result');if(big){big.textContent='ふるさと納税限度額：'+fmtJPY(Dmax)+' 円';}if(btn&&det){btn.setAttribute('aria-expanded','false');btn.onclick=()=>{const opened=det.style.display==='none';det.style.display=opened?'block':'none';btn.setAttribute('aria-expanded',opened?'true':'false');};}if(det)det.innerHTML=detailsHtml;if(box)box.classList.add('show');}
function setupAutoManual(autoId,manualId,toggleId,computeFn){const autoEl=document.getElementById(autoId);const manEl=document.getElementById(manualId);const toggle=document.getElementById(toggleId);if(!autoEl||!manEl||!toggle)return {getValueYen:()=>0};function recompute(){if(!toggle.checked){const val=computeFn();autoEl.value=isNaN(val)?'':fmtJPY(val);}}toggle.addEventListener('change',()=>{if(toggle.checked){autoEl.style.display='none';manEl.style.display='block';manEl.focus();}else{manEl.style.display='none';autoEl.style.display='block';recompute();}});document.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{if(!toggle.checked)recompute();}));recompute();return {getValueYen:()=> toggle.checked ? (parseNum(manEl.value)*10000) : parseNum(autoEl.value.replace(/,/g,''))};}
function selectTab(id){document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('active',s.id==='tab-'+id));window.scrollTo({top:0,behavior:'smooth'});}
function clearAllInputsKeepTab(){document.querySelectorAll('input').forEach(el=>{if(el.type==='checkbox'){el.checked=false;}else{el.value='';}el.classList.remove('error-input');});document.querySelectorAll('select').forEach(el=>{if(el.id.endsWith('pref'))el.value='東京都';else if(el.id.endsWith('cat'))el.value='';else el.selectedIndex=0;});document.querySelectorAll('label.toggle input[type=checkbox]').forEach(cb=>{cb.checked=false;const field=cb.closest('.field');const auto=field?.querySelector('input:not(.alt)');const man=field?.querySelector('input.alt');if(auto&&man){man.style.display='none';auto.style.display='block';}});document.querySelectorAll('.result').forEach(r=>r.classList.remove('show'));document.querySelectorAll('.error-msg').forEach(e=>e.remove());}
window.addEventListener('DOMContentLoaded',function init(){
  document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));
  document.getElementById('btn-reset')?.addEventListener('click',clearAllInputsKeepTab);
  ['s1-rate','s2-rate'].forEach(id=>bindFormat(id,3));
  ['s2-muni-extra','s3-muni-extra'].forEach(id=>bindFormat(id,2));
  const ybField=setupAutoManual('s2-yearend-auto','s2-yearend-man','s2-yb-manual',computeYearEndS2);
  const rField=setupAutoManual('s2-R-auto','s2-R-man','s2-R-manual',computeRS2);
  document.getElementById('s1-calc')?.addEventListener('click',()=>{
    const scope=document.getElementById('tab-simple');const rb=document.getElementById('s1-dmax')?.closest('.result');if(rb)rb.classList.remove('show');clearErrors(scope);
    const pref=document.getElementById('s1-pref')?.value;const salaryMan=parseNum(document.getElementById('s1-salary')?.value);const age=parseNum(document.getElementById('s1-age')?.value);
    const ym=document.getElementById('s1-start-ym')?.value||'';const sy=ym?Number(ym.split('-')[0]):0;const sm=ym?Number(ym.split('-')[1]):0;
    const principalMan=parseNum(document.getElementById('s1-principal')?.value);const years=parseNum(document.getElementById('s1-years')?.value);const rate=parseNum(document.getElementById('s1-rate')?.value);
    const method=document.getElementById('s1-method')?.value;const cat=document.getElementById('s1-cat')?.value;const isNew=(document.getElementById('s1-newused')?.value==='新築');const isChild=!!document.getElementById('s1-child')?.checked;
    const targetY=parseNum(document.getElementById('s1-target-y')?.value);
    const err=[];const gE=(id)=>document.getElementById(id);
    if(!pref){err.push('居住地');markError(gE('s1-pref'));}
    if(!salaryMan){err.push('年収');markError(gE('s1-salary'));}
    if(!age){err.push('年齢');markError(gE('s1-age'));}
    if(!ym||!isValidYYYYMM(ym)){err.push('借入開始年月');markError(gE('s1-start-ym'));}
    if(!principalMan){err.push('借入総額');markError(gE('s1-principal'));}
    if(!years){err.push('返済年数');markError(gE('s1-years'));}
    if(!rate){err.push('年利');markError(gE('s1-rate'));}
    if(!targetY){err.push('対象年');markError(gE('s1-target-y'));}
    if(err.length){ensureErrorBox(scope).textContent='入力不備：'+err.join('、')+' を確認してください。';return;}
    const g=salaryMan*10000, principal=principalMan*10000, addOthers=0;
    const {taxableIT}=taxableITFromIncome(g,age,addOthers);const tIncl=marginalIncomeRateInclSurtax(taxableIT);
    const {R}=residentShareFromIncome(g,age,addOthers,pref,0);
    const bal=yearEndBalance(principal,rate,sy,sm,targetY,years,method);const cap=loanLimit(cat,isChild,isNew);const period=deductionYears(isNew,cat);const index=targetY-sy;
    if(index<0||index>=period){ensureErrorBox(scope).textContent='対象年は控除期間外の可能性があります（借入開始年月と対象年をご確認ください）';return;}
    const annualCredit=Math.floor(Math.min(bal,cap)*0.007);
    const itaxEst=incomeTaxAmountBeforeCredits(taxableIT);const usedIT=Math.min(annualCredit,itaxEst);const resCap=Math.min(Math.floor(taxableIT*0.05),97500);const loanResCredit=Math.min(annualCredit-usedIT,resCap);
    const {d1,d2,capA,capB}=furusatoLimitGiven(tIncl,R,loanResCredit);const Dmax=Math.min(d1,d2);
    const details1=`年末残高（推定）：${fmtJPY(bal)} 円 ／ 控除上限：${fmtJPY(cap)} 円 ／ 年間控除：${fmtJPY(annualCredit)} 円<br>`+`所得税で使用：${fmtJPY(usedIT)} 円 ／ 住民税側控除：<strong>${fmtJPY(loanResCredit)} 円</strong><br>`+`住民税所得割（推定）：${fmtJPY(R)} 円 ／ 特例上限（20%）：${fmtJPY(capA)} 円 ／ 住民税残：${fmtJPY(capB)} 円`;
    setResult('s1',Dmax,details1);
  });
  document.getElementById('s2-calc')?.addEventListener('click',()=>{
    const scope=document.getElementById('tab-precise');const rb=document.getElementById('s2-dmax')?.closest('.result');if(rb)rb.classList.remove('show');clearErrors(scope);
    const pref=document.getElementById('s2-pref')?.value;const salaryMan=parseNum(document.getElementById('s2-salary')?.value);const age=parseNum(document.getElementById('s2-age')?.value);
    const ym2=document.getElementById('s2-start-ym')?.value||'';const sy=parseInt(ym2?ym2.split('-')[0]:0);const sm=parseInt(ym2?ym2.split('-')[1]:0);
    const principalMan=parseNum(document.getElementById('s2-principal')?.value);const years=parseNum(document.getElementById('s2-years')?.value);const rate=parseNum(document.getElementById('s2-rate')?.value);
    const method=document.getElementById('s2-method')?.value;const cat=document.getElementById('s2-cat')?.value;const isNew=(document.getElementById('s2-newused')?.value==='新築');const isChild=!!document.getElementById('s2-child')?.checked;
    const targetY=parseNum(document.getElementById('s2-target-y')?.value);
    const realMan=parseNum(document.getElementById('s2-real')?.value);const sideMan=parseNum(document.getElementById('s2-side')?.value);const itaxMan=parseNum(document.getElementById('s2-itax')?.value);
    const muniExtraPct=parsePercentTo100Scale(document.getElementById('s2-muni-extra')?.value);
    const err=[];const gE=(id)=>document.getElementById(id);
    if(!pref){err.push('居住地');markError(gE('s2-pref'));}
    if(!salaryMan){err.push('年収');markError(gE('s2-salary'));}
    if(!age){err.push('年齢');markError(gE('s2-age'));}
    if(!ym2||!isValidYYYYMM(ym2)){err.push('借入開始年月');markError(gE('s2-start-ym'));}
    if(!principalMan){err.push('借入総額');markError(gE('s2-principal'));}
    if(!years){err.push('返済年数');markError(gE('s2-years'));}
    if(!rate){err.push('年利');markError(gE('s2-rate'));}
    if(!targetY){err.push('対象年');markError(gE('s2-target-y'));}
    if(String(document.getElementById('s2-muni-extra')?.value).trim()===''){err.push('市区町村の超過課税');markError(gE('s2-muni-extra'));}
    if(err.length){ensureErrorBox(scope).textContent='入力不備：'+err.join('、')+' を確認してください。';return;}
    const g=salaryMan*10000, addOthers=(realMan+sideMan)*10000;
    const {taxableIT}=taxableITFromIncome(g,age,addOthers);const tIncl=marginalIncomeRateInclSurtax(taxableIT);
    const bal= (function(){const v=computeYearEndS2();return isNaN(v)?0:v;})();
    const R= (function(){const v=computeRS2();if(!isNaN(v)&&v>0) return v; return residentShareFromIncome(g,age,addOthers,pref,muniExtraPct).R;})();
    const cap=loanLimit(cat,isChild,isNew);const period=deductionYears(isNew,cat);const index=targetY-sy;
    if(index<0||index>=period){ensureErrorBox(scope).textContent='対象年は控除期間外の可能性があります（借入開始年月と対象年をご確認ください）';return;}
    const annualCredit=Math.floor(Math.min(bal,cap)*0.007);
    const itaxEst= itaxMan ? (itaxMan*10000) : incomeTaxAmountBeforeCredits(taxableIT);
    const usedIT=Math.min(annualCredit,itaxEst);const resCap=Math.min(Math.floor(taxableIT*0.05),97500);const loanResCredit=Math.min(annualCredit-usedIT,resCap);
    const {d1,d2,capA,capB}=furusatoLimitGiven(tIncl,R,loanResCredit);let Dmax=Math.min(d1,d2);
    const grossIncome=g+addOthers;const inc40=Math.floor(grossIncome*0.40);const res30=Math.floor(grossIncome*0.30);Dmax=Math.min(Dmax,inc40,res30);
    const details2=`年末残高：${fmtJPY(bal)} 円 ／ 控除上限：${fmtJPY(cap)} 円 ／ 年間控除：${fmtJPY(annualCredit)} 円<br>`+`所得税で使用：${fmtJPY(usedIT)} 円 ／ 住民税側控除：<strong>${fmtJPY(loanResCredit)} 円</strong><br>`+`R（住民税所得割）：${fmtJPY(R)} 円 ／ 特例上限（20%）：${fmtJPY(capA)} 円 ／ 住民税残：${fmtJPY(capB)} 円`;
    setResult('s2',Dmax,details2);
  });
  document.getElementById('s3-calc')?.addEventListener('click',()=>{
    const scope=document.getElementById('tab-plain');const rb=document.getElementById('s3-dmax')?.closest('.result');if(rb)rb.classList.remove('show');clearErrors(scope);
    const pref=document.getElementById('s3-pref')?.value;const salaryMan=parseNum(document.getElementById('s3-salary')?.value);const age=parseNum(document.getElementById('s3-age')?.value);
    const muniExtraPct=parsePercentTo100Scale(document.getElementById('s3-muni-extra')?.value);const realMan=parseNum(document.getElementById('s3-real')?.value);const sideMan=parseNum(document.getElementById('s3-side')?.value);
    const err=[];const gE=(id)=>document.getElementById(id);
    if(!pref){err.push('居住地');markError(gE('s3-pref'));}
    if(!salaryMan){err.push('年収');markError(gE('s3-salary'));}
    if(!age){err.push('年齢');markError(gE('s3-age'));}
    if(String(document.getElementById('s3-muni-extra')?.value).trim()===''){err.push('市区町村の超過課税');markError(gE('s3-muni-extra'));}
    if(err.length){ensureErrorBox(scope).textContent='入力不備：'+err.join('、')+' を確認してください。';return;}
    const g=salaryMan*10000, addOthers=(realMan+sideMan)*10000;
    const {taxableIT}=taxableITFromIncome(g,age,addOthers);const tIncl=marginalIncomeRateInclSurtax(taxableIT);
    const {R}=residentShareFromIncome(g,age,addOthers,pref,muniExtraPct);
    const loanResCredit=0;const {d1,d2,capA,capB}=furusatoLimitGiven(tIncl,R,loanResCredit);let Dmax=Math.min(d1,d2);
    const grossIncome=g+addOthers;const inc40=Math.floor(grossIncome*0.40);const res30=Math.floor(grossIncome*0.30);Dmax=Math.min(Dmax,inc40,res30);
    const details3=`R（住民税所得割）：${fmtJPY(R)} 円 ／ 特例上限（20%）：${fmtJPY(capA)} 円 ／ 住民税残：${fmtJPY(capB)} 円`;
    setResult('s3',Dmax,details3);
  });
  const fbMask=document.getElementById('fbMask');const fbModal=document.getElementById('fbModal');const fbOpen=document.getElementById('fbOpen');const fbClose=document.getElementById('fbClose');
  const fbForm=document.getElementById('fbForm');const fbPreview=document.getElementById('fbPreview');const fbConfirm=document.getElementById('fbConfirm');const fbSend=document.getElementById('fbSend');const fbMsg=document.getElementById('fbMsg');
  function openFb(){if(fbMask&&fbModal){fbMask.style.display='block';fbModal.style.display='flex';(fbForm?.querySelector('input,textarea'))?.focus();}}
  function closeFb(){if(fbMask&&fbModal&&fbConfirm&&fbForm&&fbMsg){fbMask.style.display='none';fbModal.style.display='none';fbConfirm.style.display='none';fbForm.style.display='block';fbForm.reset();fbMsg.textContent='';fbOpen?.focus();}}
  fbOpen?.addEventListener('click',openFb);fbClose?.addEventListener('click',closeFb);fbMask?.addEventListener('click',closeFb);window.addEventListener('keydown',(e)=>{if(e.key==='Escape')closeFb();});
  fbPreview?.addEventListener('click',()=>{if(!fbMsg||!fbForm||!fbConfirm)return;fbMsg.textContent='';const fd=new FormData(fbForm);const name=(''+(fd.get('name')||'')).trim();const email=(''+(fd.get('email')||'')).trim();const message=(''+(fd.get('message')||'')).trim();fbForm.querySelectorAll('input,textarea').forEach(el=>el.classList.remove('error-input'));if(!message){fbMsg.textContent='「ご要望」は必須です。';fbForm.querySelector('[name=message]')?.classList.add('error-input');return;}const cn=document.getElementById('c_name'),ce=document.getElementById('c_email'),cm=document.getElementById('c_message');if(cn)cn.textContent=name||'(未入力)';if(ce)ce.textContent=email||'(未入力)';if(cm)cm.textContent=message;fbForm.style.display='none';fbConfirm.style.display='block';});
  fbSend?.addEventListener('click',()=>{const name=(document.getElementById('c_name')||{}).textContent||'';const email=(document.getElementById('c_email')||{}).textContent||'';const message=(document.getElementById('c_message')||{}).textContent||'';const subject=encodeURIComponent('【改良リクエスト】ふるさと納税×住宅ローン控除');const body=encodeURIComponent(`お名前: ${name}\nメール: ${email}\n\nご要望:\n${message}`);const a=document.createElement('a');a.href=`mailto:gwycoco@gmail.com?subject=${subject}&body=${body}`;document.body.appendChild(a);a.click();a.remove();closeFb();});
});
function computeYearEndS2(){const principal=manToYen(document.getElementById('s2-principal')?.value);const rate=parseNum(document.getElementById('s2-rate')?.value);const ym=document.getElementById('s2-start-ym')?.value||'';const sy=ym?Number(ym.split('-')[0]):0;const sm=ym?Number(ym.split('-')[1]):0;const years=parseNum(document.getElementById('s2-years')?.value);const targetY=parseNum(document.getElementById('s2-target-y')?.value);const method=document.getElementById('s2-method')?.value;if(!principal||!rate||!sy||!sm||!years||!targetY)return NaN;return yearEndBalance(principal,rate,sy,sm,targetY,years,method);}
function computeRS2(){const pref=document.getElementById('s2-pref')?.value;const muniExtraPct=parsePercentTo100Scale(document.getElementById('s2-muni-extra')?.value);const g=manToYen(document.getElementById('s2-salary')?.value);const age=parseNum(document.getElementById('s2-age')?.value);const real=manToYen(document.getElementById('s2-real')?.value);const side=manToYen(document.getElementById('s2-side')?.value);if(!g||!age)return NaN;const {R}=residentShareFromIncome(g,age,real+side,pref,muniExtraPct);return R;}
