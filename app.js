
// v7.5.2 patched — apply 10 requested changes
const RATES={pref_income_extra_pct:{"神奈川県":0.025},muni_income_extra_pct:{"東京都":{"新宿区":0,"世田谷区":0},"神奈川県":{"横浜市":0}}};
const NF=new Intl.NumberFormat('ja-JP');const J=v=>NF.format(Math.round(v||0));
function sanitize(s){return (''+(s??'')).replace(/[,\s％%]/g,'').replace(/[－—–−]/g,'-')}
function num(s){const v=Number(sanitize(s));return Number.isFinite(v)?v:0}
function yyyy_mm(s){const r=(''+(s||'')).trim();return/^\d{6}$/.test(r)?r.slice(0,4)+'-'+r.slice(4,6):r}
function ok_ym(s){const v=yyyy_mm(s);return /^\d{4}-(0[1-9]|1[0-2])$/.test(v||'')}
function parts(s){const v=(yyyy_mm(s)||'').split('-');return{y:parseInt(v[0]||'0',10)||0,m:parseInt(v[1]||'0',10)||0}}
function pctStr(v){return (Math.round(v*1000)/1000)+'%'}

const BASIC_IT=480000,BASIC_RES=430000;
function salDed(g){if(g<=1625000)return 550000;if(g<=1800000)return g*0.40-100000;if(g<=3600000)return g*0.30+80000;if(g<=6600000)return g*0.20+440000;if(g<=8500000)return g*0.10+1100000;return 1950000}
function socIns(g,age){const r=age<40?0.15:(age<=64?0.165:0.14);return Math.round(g*r)}
function itTaxBase(g,age,add=0){const s=socIns(g,age),k=Math.floor(salDed(g));return{tb:Math.max(0,g+add-k-s-BASIC_IT),soc:s,kyu:k}}
function mrate(t){const b=[[0,0.05],[1950000,0.10],[3300000,0.20],[6950000,0.23],[9000000,0.33],[18000000,0.40],[40000000,0.45]];let r=b[0][1];for(const[x,y]of b){if(t>=x)r=y;else break}return r*1.021}
function itax(tb){let t=0;const bs=[[0,1950000,0.05,0],[1950000,3300000,0.10,97500],[3300000,6950000,0.20,427500],[6950000,9000000,0.23,636000],[9000000,18000000,0.33,1536000],[18000000,40000000,0.40,2796000],[40000000,1/0,0.45,4796000]];for(const[lo,hi,r,d]of bs){if(tb>lo){const base=Math.min(tb,hi)-lo;t=base*r-d}}return Math.max(0,Math.floor(t*1.021))}
function rateExtra(pref,city){const pe=RATES.pref_income_extra_pct[pref]||0;const map=RATES.muni_income_extra_pct[pref]||{};let me=0;const c=(''+(city||'')).trim();if(map[c]!=null)me=map[c];return pe+me}

function yendBal(P,ratePct,sy,sm,ty,years,method){const r=ratePct/100/12,n=years*12,elapsed=Math.max(0,(ty-sy)*12+(12-sm+1)),m=Math.min(elapsed,n);let bal=P;
 if(method==='元金均等'){const pp=P/n;return Math.max(0,P-pp*m)}
 if(r===0){const p=P/n;return Math.max(0,P-p*m)}
 const a=P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);for(let i=0;i<m;i++){const it=bal*r;bal-=a-it}return Math.max(0,bal)}

function limitFs(tIncl,R,loanRes){const capA=.20*R,capB=Math.max(R-loanRes,0),d1=2000+capA/(.9-tIncl),d2=2000+capB/(1.0-tIncl);return{d1:Math.max(0,Math.floor(d1)),d2:Math.max(0,Math.floor(d2))}}

function errBox(scope){let box=scope.querySelector('.error-msg');if(!box){box=document.createElement('div');box.className='error-msg';const actions=scope.querySelector('.actions');actions?.parentNode?.insertBefore(box,actions.nextSibling)}return box}
function clearErrors(scope){scope.querySelectorAll('.error-input').forEach(x=>x.classList.remove('error-input'));const e=scope.querySelector('.error-msg');if(e)e.remove()}
function setResult(prefix,amt,html){const big=document.getElementById(prefix+'-dmax'),btn=document.getElementById(prefix+'-more'),det=document.getElementById(prefix+'-details'),box=big.closest('.result');big.textContent='ふるさと納税限度額：'+J(amt)+' 円';btn.onclick=()=>{const open=det.style.display==='none';det.style.display=open?'block':'none';btn.setAttribute('aria-expanded',open?'true':'false')};det.innerHTML=html;box.classList.add('show')}

function showHintSimple(){const pref=document.getElementById('s1-pref').value,city=document.getElementById('s1-city').value||'';document.getElementById('s1-extra-hint').textContent='上乗せ率（所得割）（自動）：'+pctStr(rateExtra(pref,city))}

function computeSimple(){
  const scope=document.getElementById('tab-simple'); clearErrors(scope);
  const pref=document.getElementById('s1-pref').value, city=document.getElementById('s1-city').value||'';
  const salary=num(document.getElementById('s1-salary').value), age=num(document.getElementById('s1-age').value);
  const ym=document.getElementById('s1-start-ym').value||'', prMan=num(document.getElementById('s1-principal').value);
  const years=num(document.getElementById('s1-years').value), rate=num(document.getElementById('s1-rate').value), method=document.getElementById('s1-method').value, ty=num(document.getElementById('s1-target-y').value);
  const need=[]; if(!pref)need.push('都道府県'); if(!salary)need.push('年収'); if(!age)need.push('年齢'); if(!ok_ym(ym))need.push('借入開始年月'); if(!prMan)need.push('借入総額'); if(!years)need.push('返済年数'); if(!rate)need.push('年利'); if(!ty)need.push('対象年');
  if(need.length){errBox(scope).textContent='入力不備：'+need.join('、')+' を確認してください。'; return;}
  const {y:sy,m:sm}=parts(ym); const g=salary*10000; const tb=itTaxBase(g,age,0).tb; const tIncl=mrate(tb);
  const soc=socIns(g,age), kyu=Math.floor(salDed(g)); const tRes=Math.max(0,g-kyu-soc-BASIC_RES); const R=Math.floor(tRes*(0.10+rateExtra(pref,city)/100.0));
  const bal=yendBal(prMan*10000,rate,sy,sm,ty,years,method);
  const cap=30000000, idx=ty-sy; if(idx<0||idx>=13){errBox(scope).textContent='対象年は控除期間外の可能性があります。';return;}
  const credit=Math.floor(Math.min(bal,cap)*0.007), used=Math.min(credit, itax(tb)), resCap=Math.min(Math.floor(tb*0.05),97500);
  const loanRes=Math.min(credit-used,resCap);
  const lim=limitFs(tIncl,R,loanRes), D=Math.min(lim.d1,lim.d2);
  setResult('s1',D,`年末残高（推定）：${J(bal)} 円 ／ 年間控除：${J(credit)} 円 ／ 住民税側控除：${J(loanRes)} 円<br>R：${J(R)} 円 ／ 上乗せ率：${pctStr(rateExtra(pref,city))}`);
}

function computePrecise(){
  const scope=document.getElementById('tab-precise'); clearErrors(scope);
  const pref=document.getElementById('s2-pref').value, city=document.getElementById('s2-city').value||'';
  const salary=num(document.getElementById('s2-salary').value), age=num(document.getElementById('s2-age').value), ty=num(document.getElementById('s2-target-y').value);
  const ym=document.getElementById('s2-start-ym').value||'', prMan=num(document.getElementById('s2-principal').value);
  const years=num(document.getElementById('s2-years').value), rate=num(document.getElementById('s2-rate').value), method=document.getElementById('s2-method').value;
  const need=[]; if(!pref)need.push('都道府県'); if(!salary)need.push('年収'); if(!age)need.push('年齢'); if(!ok_ym(ym))need.push('借入開始年月'); if(!prMan)need.push('借入総額'); if(!years)need.push('返済年数'); if(!rate)need.push('年利'); if(!ty)need.push('対象年');
  if(need.length){errBox(scope).textContent='入力不備：'+need.join('、')+' を確認してください。'; return;}
  const {y:sy,m:sm}=parts(ym); const g=salary*10000; const tb=itTaxBase(g,age,0).tb; const tIncl=mrate(tb);
  const soc=socIns(g,age), kyu=Math.floor(salDed(g)); const tRes=Math.max(0,g-kyu-soc-BASIC_RES); const R=Math.floor(tRes*(0.10+rateExtra(pref,city)/100.0));
  const bal=(function(){const man=document.getElementById('s2-yb-manual').checked; if(man){return num(document.getElementById('s2-yearend-man').value)} const v=yendBal(prMan*10000,rate,sy,sm,ty,years,method); document.getElementById('s2-yearend-auto').value=J(v); return v;})();
  const cap=30000000, idx=ty-sy; if(idx<0||idx>=13){errBox(scope).textContent='対象年は控除期間外の可能性があります。';return;}
  const credit=Math.floor(Math.min(bal,cap)*0.007), used=Math.min(credit, itax(tb)), resCap=Math.min(Math.floor(tb*0.05),97500);
  const loanRes=Math.min(credit-used,resCap);
  const lim=limitFs(tIncl,R,loanRes), D=Math.min(lim.d1,lim.d2);
  setResult('s2',D,`年末残高：${J(bal)} 円 ／ 年間控除：${J(credit)} 円 ／ 住民税側控除：${J(loanRes)} 円<br>R：${J(R)} 円 ／ 上乗せ率：${pctStr(rateExtra(pref,city))}`);
}

function computePlain(){
  const scope=document.getElementById('tab-plain'); clearErrors(scope);
  const pref=document.getElementById('s3-pref').value, city=document.getElementById('s3-city').value||'';
  const salary=num(document.getElementById('s3-salary').value), age=num(document.getElementById('s3-age').value);
  const need=[]; if(!pref)need.push('都道府県'); if(!salary)need.push('年収'); if(!age)need.push('年齢'); if(need.length){errBox(scope).textContent='入力不備：'+need.join('、')+' を確認してください。'; return;}
  const g=salary*10000; const tb=itTaxBase(g,age,0).tb; const tIncl=mrate(tb);
  const soc=socIns(g,age), kyu=Math.floor(salDed(g)); const tRes=Math.max(0,g-kyu-soc-BASIC_RES); const R=Math.floor(tRes*(0.10+rateExtra(pref,city)/100.0));
  const lim=limitFs(tIncl,R,0), D=Math.min(lim.d1,lim.d2);
  setResult('s3',D,`R：${J(R)} 円 ／ 上乗せ率：${pctStr(rateExtra(pref,city))}`);
}

function selectTab(id){document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('active',s.id==='tab-'+id));window.scrollTo({top:0,behavior:'smooth'})}
function bindInfoPop(){document.querySelectorAll('.info').forEach(btn=>{btn.addEventListener('click',()=>{const id=btn.getAttribute('data-pop');const pop=document.getElementById(id);if(!pop)return;const show=pop.hasAttribute('hidden');document.querySelectorAll('.popover').forEach(p=>p.setAttribute('hidden',''));if(show)pop.removeAttribute('hidden');else pop.setAttribute('hidden','');});});document.addEventListener('click',e=>{if(!e.target.closest('.info')&&!e.target.closest('.popover')){document.querySelectorAll('.popover').forEach(p=>p.setAttribute('hidden',''))}})}

function bind(){
  document.querySelectorAll('.tabs button').forEach(b=> b.addEventListener('click',()=>selectTab(b.dataset.tab)));
  document.getElementById('btn-reset').addEventListener('click',()=>{document.querySelectorAll('input').forEach(el=>{if(el.type==='checkbox'){el.checked=false}else el.value=''});document.querySelectorAll('select').forEach(el=>{if(el.id.endsWith('pref'))el.value='東京都';else el.selectedIndex=0});document.querySelectorAll('.result').forEach(r=>r.classList.remove('show'));document.querySelectorAll('.error-msg').forEach(e=>e.remove());showHintSimple();});
  document.getElementById('s1-pref').addEventListener('input',showHintSimple);
  document.getElementById('s1-city').addEventListener('input',showHintSimple);
  document.getElementById('s1-calc').addEventListener('click',computeSimple);
  document.getElementById('s2-calc').addEventListener('click',computePrecise);
  document.getElementById('s3-calc').addEventListener('click',computePlain);
  bindInfoPop();
  showHintSimple();
}
document.addEventListener('DOMContentLoaded',bind);
