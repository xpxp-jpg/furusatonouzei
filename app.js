
// v7.5.2-3 single precise page with spouse/dependents required & tax impact
const NF=new Intl.NumberFormat('ja-JP');const J=v=>NF.format(Math.round(v||0));
function sanitize(s){return (''+(s??'')).replace(/[,\s％%]/g,'').replace(/[－—–−]/g,'-')}
function num(s){const v=Number(sanitize(s));return Number.isFinite(v)?v:0}
function isEmpty(s){return (''+(s??'')).trim()===''}
function yyyy_mm(s){const r=(''+(s||'')).trim();return/^\d{6}$/.test(r)?r.slice(0,4)+'-'+r.slice(4,6):r}
function ok_ym(s){const v=yyyy_mm(s);return /^\d{4}-(0[1-9]|1[0-2])$/.test(v||'')}
function parts(s){const v=(yyyy_mm(s)||'').split('-');return{y:parseInt(v[0]||'0',10)||0,m:parseInt(v[1]||'0',10)||0}}
function pctStr(v){return (Math.round(v*1000)/1000)+'%'}

const BASIC_IT=480000,BASIC_RES=430000;
// employment income deduction
function salDed(g){if(g<=1625000)return 550000;if(g<=1800000)return g*0.40-100000;if(g<=3600000)return g*0.30+80000;if(g<=6600000)return g*0.20+440000;if(g<=8500000)return g*0.10+1100000;return 1950000}
// social insurance (rough ratio by age band)
function socIns(g,age){const r=age<40?0.15:(age<=64?0.165:0.14);return Math.round(g*r)}

// resident tax: dependents
function depDed_RES(gen,spec,elderSame,elderOther){return 330000*gen+450000*spec+450000*elderSame+380000*elderOther}
// income tax: dependents
function depDed_IT(gen,spec,elderSame,elderOther){return 380000*gen+630000*spec+580000*elderSame+480000*elderOther}

// spouse deduction (approx) by spouse total income (合計所得金額, yen)
function spDed_RES(sp){if(sp<=480000)return 330000;if(sp<1330000){const t=(1330000-sp)/(1330000-480000);return Math.floor(330000*t)}return 0}
function spDed_IT(sp){if(sp<=480000)return 380000;if(sp<1330000){const t=(1330000-sp)/(1330000-480000);return Math.floor(380000*t)}return 0}

// municipal surtax
const PREF_EXTRA={"神奈川県":0.025};
const MUNI_EXTRA={"東京都":{"千代田区":0,"中央区":0,"港区":0,"新宿区":0,"文京区":0,"台東区":0,"墨田区":0,"江東区":0,"品川区":0,"目黒区":0,"大田区":0,"世田谷区":0,"渋谷区":0,"中野区":0,"杉並区":0,"豊島区":0,"北区":0,"荒川区":0,"板橋区":0,"練馬区":0,"足立区":0,"葛飾区":0,"江戸川区":0},
                   "神奈川県":{"横浜市":0,"川崎市":0,"相模原市":0,"横須賀市":0,"藤沢市":0}};
function normCity(s){return (''+(s||'')).trim().replace(/\s+/g,'').replace(/(都|道|府|県)/,'').replace(/^(.*?市).*$/,'$1').replace(/^(.*?区).*$/,'$1')}
function rateExtra(pref,city){let e=0;if(PREF_EXTRA[pref]!=null)e+=PREF_EXTRA[pref];const map=MUNI_EXTRA[pref]||{};const n=normCity(city);if(map[n]!=null)e+=map[n];return e}

// tax utilities
function mrate(t){const b=[[0,0.05],[1950000,0.10],[3300000,0.20],[6950000,0.23],[9000000,0.33],[18000000,0.40],[40000000,0.45]];let r=b[0][1];for(const[x,y]of b){if(t>=x)r=y;else break}return r*1.021}
function itax(tb){let t=0;const bs=[[0,1950000,0.05,0],[1950000,3300000,0.10,97500],[3300000,6950000,0.20,427500],[6950000,9000000,0.23,636000],[9000000,18000000,0.33,1536000],[18000000,40000000,0.40,2796000],[40000000,1/0,0.45,4796000]];for(const[lo,hi,r,d]of bs){if(tb>lo){const base=Math.min(tb,hi)-lo;t=base*r-d}}return Math.max(0,Math.floor(t*1.021))}

// year-end balance
function yendBal(P,ratePct,sy,sm,ty,years,method){const r=ratePct/100/12,n=years*12,elapsed=Math.max(0,(ty-sy)*12+(12-sm+1)),m=Math.min(elapsed,n);let bal=P;
 if(method==='元金均等'){const pp=P/n;return Math.max(0,P-pp*m)}
 if(r===0){const p=P/n;return Math.max(0,P-p*m)}
 const a=P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);for(let i=0;i<m;i++){const it=bal*r;bal-=a-it}return Math.max(0,bal)}

// furusato calc
function limitFs(tIncl,R,loanRes){const capA=.20*R,capB=Math.max(R-loanRes,0),d1=2000+capA/(.9-tIncl),d2=2000+capB/(1.0-tIncl);return{d1:Math.max(0,Math.floor(d1)),d2:Math.max(0,Math.floor(d2))}}

// UI helpers
function err(msg,ids){const area=document.getElementById('err');area.textContent=msg;area.style.display='block';(ids||[]).forEach(id=>document.getElementById(id).classList.add('error-input'))}
function clearErr(){document.getElementById('err').style.display='none';document.querySelectorAll('.error-input').forEach(x=>x.classList.remove('error-input'))}
function showResult(amt,html){const big=document.getElementById('dmax'),btn=document.getElementById('more'),det=document.getElementById('details'),box=document.getElementById('resultBox');big.textContent='ふるさと納税限度額：'+J(amt)+' 円';btn.onclick=()=>{const open=det.style.display==='none';det.style.display=open?'block':'none';btn.setAttribute('aria-expanded',open?'true':'false')};det.innerHTML=html;box.classList.add('show')}
function showHint(){const pref=document.getElementById('pref').value,city=document.getElementById('city').value||'';document.getElementById('extra-hint').textContent='上乗せ率（所得割）（自動）：'+pctStr(rateExtra(pref,city))}

// main compute
function compute(){
  clearErr();
  const pref=document.getElementById('pref').value, city=document.getElementById('city').value||'';
  const salary=num(document.getElementById('salary').value), age=num(document.getElementById('age').value), ty=num(document.getElementById('targetY').value);
  const spIncomeM=document.getElementById('spIncome').value, depGenV=document.getElementById('depGen').value, depSpecV=document.getElementById('depSpec').value, depESV=document.getElementById('depElderSame').value, depEOV=document.getElementById('depElderOther').value;
  const ym=document.getElementById('startYM').value||'', prMan=document.getElementById('principal').value;
  const years=document.getElementById('years').value, rate=document.getElementById('rate').value, method=document.getElementById('method').value;
  // required checks (including spouse & dependents)
  const miss=[];
  [['salary','年収'],['age','年齢'],['targetY','対象年'],['spIncome','配偶者の合計所得金額'],['depGen','扶養（一般）人数'],['depSpec','扶養（特定）人数'],['depElderSame','老人扶養（同居）人数'],['depElderOther','老人扶養（その他）人数'],['startYM','借入開始年月'],['principal','借入総額'],['years','返済年数'],['rate','年利']].forEach(([id,label])=>{const el=document.getElementById(id);if(isEmpty(el.value))miss.push(label)});
  if(!pref)miss.push('都道府県'); if(!ok_ym(ym))miss.push('借入開始年月の形式');
  if(miss.length){err('入力不備：'+miss.join('、')+' を入力・確認してください。');return;}
  const g= num(salary)*10000;
  const spIncome = num(spIncomeM)*10000;
  const depGen=num(depGenV), depSpec=num(depSpecV), depES=num(depESV), depEO=num(depEOV);
  const kyu=Math.floor(salDed(g)), soc=Math.floor(socIns(g,age));
  // income tax base (考虑配偶/扶养的 IT 版控除)
  const it_add = spDed_IT(spIncome)+depDed_IT(depGen,depSpec,depES,depEO);
  const tb=Math.max(0, g - kyu - soc - BASIC_IT - it_add);
  const tIncl=mrate(tb);
  // resident tax income for R (考虑配偶/扶养的 RES 版控除)
  const res_add = spDed_RES(spIncome)+depDed_RES(depGen,depSpec,depES,depEO);
  const tRes=Math.max(0, g - kyu - soc - BASIC_RES - res_add);
  const R=Math.floor(tRes*(0.10+rateExtra(pref,city)/100.0));
  const useR=document.getElementById('R-manual').checked; const Rv=useR?num(document.getElementById('R-man').value):R;
  document.getElementById('R-auto').value=J(R);
  const {y:sy,m:sm}=parts(ym); const bal=(function(){const man=document.getElementById('yb-manual').checked; if(man){return num(document.getElementById('yearend-man').value)} const v=yendBal(num(prMan)*10000, num(rate), sy, sm, num(ty), num(years), method); document.getElementById('yearend-auto').value=J(v); return v;})();
  const cap=30000000, idx=num(ty)-sy; if(idx<0||idx>=13){err('対象年は控除期間外の可能性があります。');return;}
  const credit=Math.floor(Math.min(bal,cap)*0.007), used=Math.min(credit, itax(tb)), resCap=Math.min(Math.floor(tb*0.05),97500);
  const loanRes=Math.min(credit-used,resCap);
  const lim= (function(){const capA=.20*Rv, capB=Math.max(Rv-loanRes,0), d1=2000+capA/(.9-tIncl), d2=2000+capB/(1.0-tIncl);return {d1:Math.max(0,Math.floor(d1)), d2:Math.max(0,Math.floor(d2))}})();
  const D=Math.min(lim.d1,lim.d2);
  showResult(D,`年末残高：${J(bal)} 円 ／ 年間控除：${J(credit)} 円 ／ 住民税側控除：${J(loanRes)} 円<br>R：${J(Rv)} 円（自動計算） ／ 所得税課税所得：${J(tb)} 円`);
}

function rateExtra(pref,city){let e=0;if({"神奈川県":0.025}[pref]!=null)e+=({"神奈川県":0.025}[pref]);const map={"東京都":{"千代田区":0,"中央区":0,"港区":0,"新宿区":0,"文京区":0,"台東区":0,"墨田区":0,"江東区":0,"品川区":0,"目黒区":0,"大田区":0,"世田谷区":0,"渋谷区":0,"中野区":0,"杉並区":0,"豊島区":0,"北区":0,"荒川区":0,"板橋区":0,"練馬区":0,"足立区":0,"葛飾区":0,"江戸川区":0},"神奈川県":{"横浜市":0,"川崎市":0,"相模原市":0,"横須賀市":0,"藤沢市":0}}[pref]||{};const n=(''+(city||'')).trim().replace(/\s+/g,'').replace(/(都|道|府|県)/,'').replace(/^(.*?市).*$/,'$1').replace(/^(.*?区).*$/,'$1');if(map[n]!=null)e+=map[n];return e}

function showHint(){const pref=document.getElementById('pref').value,city=document.getElementById('city').value||'';document.getElementById('extra-hint').textContent='上乗せ率（所得割）（自動）：'+pctStr(rateExtra(pref,city))}

function yendBal(P,ratePct,sy,sm,ty,years,method){const r=ratePct/100/12,n=years*12,elapsed=Math.max(0,(ty-sy)*12+(12-sm+1)),m=Math.min(elapsed,n);let bal=P;if(method==='元金均等'){const pp=P/n;return Math.max(0,P-pp*m)}if(r===0){const p=P/n;return Math.max(0,P-p*m)}const a=P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);for(let i=0;i<m;i++){const it=bal*r;bal-=a-it}return Math.max(0,bal)}

function resetAll(){document.querySelectorAll('input').forEach(el=>{if(el.type==='checkbox'){el.checked=false}else el.value=''});document.querySelectorAll('select').forEach(el=>{if(el.id==='pref')el.value='東京都';else el.selectedIndex=0});document.getElementById('resultBox').classList.remove('show');clearErr();showHint()}
function bind(){document.getElementById('pref').addEventListener('input',showHint);document.getElementById('city').addEventListener('input',showHint);document.getElementById('calc').addEventListener('click',compute);document.getElementById('btn-reset').addEventListener('click',resetAll);document.getElementById('R-manual').addEventListener('change',e=>{document.getElementById('R-man').style.display=e.target.checked?'block':'none'});document.getElementById('yb-manual').addEventListener('change',e=>{document.getElementById('yearend-man').style.display=e.target.checked?'block':'none'});showHint()}document.addEventListener('DOMContentLoaded',bind);
