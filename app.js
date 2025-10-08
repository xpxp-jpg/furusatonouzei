
// single precise page (v7.5.2sp)
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
function err(msg,els){const area=document.getElementById('err');area.textContent=msg;area.style.display='block';(els||[]).forEach(id=>document.getElementById(id).classList.add('error-input'))}
function clearErr(){document.getElementById('err').style.display='none';document.querySelectorAll('.error-input').forEach(x=>x.classList.remove('error-input'))}
function showResult(amt,html){const big=document.getElementById('dmax'),btn=document.getElementById('more'),det=document.getElementById('details'),box=document.getElementById('resultBox');big.textContent='ふるさと納税限度額：'+J(amt)+' 円';btn.onclick=()=>{const open=det.style.display==='none';det.style.display=open?'block':'none';btn.setAttribute('aria-expanded',open?'true':'false')};det.innerHTML=html;box.classList.add('show')}
function showHint(){const pref=document.getElementById('pref').value,city=document.getElementById('city').value||'';document.getElementById('extra-hint').textContent='上乗せ率（所得割）（自動）：'+pctStr(rateExtra(pref,city))}

function compute(){
  clearErr();
  const pref=document.getElementById('pref').value, city=document.getElementById('city').value||'';
  const salary=num(document.getElementById('salary').value), age=num(document.getElementById('age').value), ty=num(document.getElementById('targetY').value);
  const ym=document.getElementById('startYM').value||'', prMan=num(document.getElementById('principal').value);
  const years=num(document.getElementById('years').value), rate=num(document.getElementById('rate').value), method=document.getElementById('method').value;
  const need=[]; if(!pref)need.push('pref'); if(!salary)need.push('salary'); if(!age)need.push('age'); if(!ok_ym(ym))need.push('startYM'); if(!prMan)need.push('principal'); if(!years)need.push('years'); if(!rate)need.push('rate'); if(!ty)need.push('targetY');
  if(need.length){err('入力不備：必須項目を確認してください。',need); return;}
  const {y:sy,m:sm}=parts(ym); const g=salary*10000; const tb=itTaxBase(g,age,0).tb; const tIncl=mrate(tb);
  const soc=socIns(g,age), kyu=Math.floor(salDed(g)); const tRes=Math.max(0,g-kyu-soc-BASIC_RES);
  const R=Math.floor(tRes*(0.10+rateExtra(pref,city)/100.0));
  document.getElementById('R-auto').value=J(R);
  const useR=document.getElementById('R-manual').checked; const Rv=useR?num(document.getElementById('R-man').value):R;
  const bal=(function(){const man=document.getElementById('yb-manual').checked; if(man){return num(document.getElementById('yearend-man').value)} const v=yendBal(prMan*10000,rate,sy,sm,ty,years,method); document.getElementById('yearend-auto').value=J(v); return v;})();
  const cap=30000000, idx=ty-sy; if(idx<0||idx>=13){err('対象年は控除期間外の可能性があります。',['targetY']);return;}
  const credit=Math.floor(Math.min(bal,cap)*0.007), used=Math.min(credit, itax(tb)), resCap=Math.min(Math.floor(tb*0.05),97500);
  const loanRes=Math.min(credit-used,resCap);
  const lim=limitFs(tIncl,Rv,loanRes), D=Math.min(lim.d1,lim.d2);
  showResult(D,`年末残高：${J(bal)} 円 ／ 年間控除：${J(credit)} 円 ／ 住民税側控除：${J(loanRes)} 円<br>R：${J(Rv)} 円 ／ 上乗せ率：${pctStr(rateExtra(pref,city))}`);
}

function bindInfoPop(){document.querySelectorAll('.info').forEach(btn=>{btn.addEventListener('click',()=>{const id=btn.getAttribute('data-pop');const pop=document.getElementById(id);if(!pop)return;const show=pop.hasAttribute('hidden');document.querySelectorAll('.popover').forEach(p=>p.setAttribute('hidden',''));if(show)pop.removeAttribute('hidden');else pop.setAttribute('hidden','');});});document.addEventListener('click',e=>{if(!e.target.closest('.info')&&!e.target.closest('.popover')){document.querySelectorAll('.popover').forEach(p=>p.setAttribute('hidden',''))}})}
function resetAll(){document.querySelectorAll('input').forEach(el=>{if(el.type==='checkbox'){el.checked=false}else el.value=''});document.querySelectorAll('select').forEach(el=>{if(el.id==='pref')el.value='東京都';else el.selectedIndex=0});document.getElementById('resultBox').classList.remove('show');clearErr();showHint()}

function bind(){
  document.getElementById('pref').addEventListener('input',showHint);
  document.getElementById('city').addEventListener('input',showHint);
  document.getElementById('calc').addEventListener('click',compute);
  document.getElementById('btn-reset').addEventListener('click',resetAll);
  document.getElementById('R-manual').addEventListener('change',e=>{document.getElementById('R-man').style.display=e.target.checked?'block':'none'});
  document.getElementById('yb-manual').addEventListener('change',e=>{document.getElementById('yearend-man').style.display=e.target.checked?'block':'none'});
  bindInfoPop();
  showHint();
}
document.addEventListener('DOMContentLoaded',bind);
