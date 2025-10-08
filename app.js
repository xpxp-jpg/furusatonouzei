
// compact calculator (v7.6.1)
const RATES={pref_income_extra_pct:{"神奈川県":0.025},muni_income_extra_pct:{"東京都":{"新宿区":0,"世田谷区":0},"神奈川県":{"横浜市":0}}};
const NF=new Intl.NumberFormat('ja-JP');const J=v=>NF.format(Math.round(v||0));
const nrm=s=>Number(String(s??'').replace(/[,\s％%]/g,'').replace(/[－—–−]/g,'-'));const num=s=>{const v=nrm(s);return Number.isFinite(v)?v:0};const y2v=s=>{const r=(''+(s||'')).trim();return/^\d{6}$/.test(r)?r.slice(0,4)+'-'+r.slice(4,6):r};const okym=s=>/^\d{4}-(0[1-9]|1[0-2])$/.test(y2v(s)||'');const parts=s=>{const v=y2v(s).split('-');return{y:parseInt(v[0]||'0',10)||0,m:parseInt(v[1]||'0',10)||0}};
function salDed(g){if(g<=1625000)return 550000;if(g<=1800000)return g*0.40-100000;if(g<=3600000)return g*0.30+80000;if(g<=6600000)return g*0.20+440000;if(g<=8500000)return g*0.10+1100000;return 1950000}
function soc(g,a){const r=a<40?0.15:(a<=64?0.165:0.14);return Math.round(g*r)}const BASIC_IT=480000,BASIC_RES=430000;
function itBase(g,a,add=0){const s=soc(g,a),k=Math.floor(salDed(g));return{tx:Math.max(0,g+add-k-s-BASIC_IT),soc:s,kyu:k}}function mrate(t){const b=[[0,0.05],[1950000,0.10],[3300000,0.20],[6950000,0.23],[9000000,0.33],[18000000,0.40],[40000000,0.45]];let r=b[0][1];for(const[x,y]of b){if(t>=x)r=y;else break}return r*1.021}
function itax(t){let tax=0;const bs=[[0,1950000,0.05,0],[1950000,3300000,0.10,97500],[3300000,6950000,0.20,427500],[6950000,9000000,0.23,636000],[9000000,18000000,0.33,1536000],[18000000,40000000,0.40,2796000],[40000000,1/0,0.45,4796000]];for(const[lo,hi,r,d]of bs){if(t>lo){const b=Math.min(t,hi)-lo;tax=b*r-d}}return Math.max(0,Math.floor(tax*1.021))}
function capLoan(){return 30000000}function yearsDed(){return 13}
function ybal(P,rate,sy,sm,ty,years,method){const r=rate/100/12,n=years*12,m=Math.min(Math.max(0,(ty-sy)*12+(12-sm+1)),n);if(method==='元金均等'){const p=P/n;return Math.max(0,P-p*m)}if(r===0){const p=P/n;return Math.max(0,P-p*m)}let bal=P;const a=P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);for(let i=0;i<m;i++){const it=bal*r;bal-=a-it}return Math.max(0,bal)}
function pctStr(v){return (Math.round(v*1000)/1000)+'%'}function extra(pref,city){const pe=RATES.pref_income_extra_pct[pref]||0;const map=RATES.muni_income_extra_pct[pref]||{};let me=0;const c=(''+(city||'')).trim();if(map[c]!=null)me=map[c];return pe+me}
function fsCap(tIncl,R,loanRes){const capA=.2*R,capB=Math.max(R-loanRes,0),d1=2000+capA/(.9-tIncl),d2=2000+capB/(1.0-tIncl);return Math.min(Math.floor(d1),Math.floor(d2))}

function setResult(id,amt,html){const big=document.getElementById(id+'-dmax'),btn=document.getElementById(id+'-more'),det=document.getElementById(id+'-details'),box=big.closest('.result');big.textContent='ふるさと納税限度額：'+J(amt)+' 円';btn.onclick=()=>{const o=det.style.display==='none';det.style.display=o?'block':'none';btn.setAttribute('aria-expanded',o?'true':'false')};det.innerHTML=html;box.classList.add('show')}
function showHint(){const p=document.getElementById('s1-pref').value,c=document.getElementById('s1-city').value||'';document.getElementById('s1-extra-hint').textContent='上乗せ率（所得割）（自動）：'+pctStr(extra(p,c))}

function computeSimple(){
 const pref=document.getElementById('s1-pref').value, city=document.getElementById('s1-city').value||'';
 const salary=num(document.getElementById('s1-salary').value), age=num(document.getElementById('s1-age').value);
 const ym=document.getElementById('s1-start-ym').value||'', pr=num(document.getElementById('s1-principal').value)*10000;
 const years=num(document.getElementById('s1-years').value), rate=num(document.getElementById('s1-rate').value);
 const method=document.getElementById('s1-method').value, ty=num(document.getElementById('s1-target-y').value);
 if(!pref||!salary||!age||!okym(ym)||!pr||!years||!rate||!ty){alert('入力不備があります');return;}
 const {y:sy,m:sm}=parts(ym), g=salary*10000, tb=itBase(g,age,0).tx, tIncl=mrate(tb), add=0;
 const socv=soc(g,age), kyu=salDed(g), tRes=Math.max(0,g+add-kyu-socv-BASIC_RES), R=Math.floor(tRes*(0.10+extra(pref,city)/100.0));
 const bal=ybal(pr,rate,sy,sm,ty,years,method), cap=capLoan(), idx=ty-sy; if(idx<0||idx>=yearsDed()){alert('対象年は控除期間外の可能性');return;}
 const credit=Math.floor(min(bal,cap)*0.007); function min(a,b){return a<b?a:b}
 const used=min(credit,itax(tb)), resCap=min(Math.floor(tb*0.05),97500), loanRes=min(credit-used,resCap);
 const D=fsCap(tIncl,R,loanRes);
 setResult('s1',D,`年末残高（推定）：${J(bal)} 円 ／ 年間控除：${J(credit)} 円 ／ 住民税側控除：${J(loanRes)} 円<br>R：${J(R)} 円 ／ 上乗せ率：${pctStr(extra(pref,city))}`);
}
function computePrecise(){document.getElementById('s2-dmax').textContent='（デモ）簡易計算と同一ロジック';document.getElementById('s2-dmax').closest('.result').classList.add('show')}
function computePlain(){
 const pref=document.getElementById('s3-pref').value, salary=num(document.getElementById('s3-salary').value), age=num(document.getElementById('s3-age').value);
 if(!pref||!salary||!age){alert('入力不備があります');return;}
 const g=salary*10000, tb=itBase(g,age,0).tx, tIncl=mrate(tb), R=Math.floor(Math.max(0,g-salDed(g)-soc(g,age)-BASIC_RES)*(0.10+extra(pref,'')/100.0));
 const capA=.2*R, d=2000+capA/(.9-tIncl); setResult('s3',Math.floor(d),`R：${J(R)} 円 ／ 特例上限（20%）：${J(Math.floor(R*0.20))} 円`);
}

function bind(){
 document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('active',x===b));
  document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('active',s.id==='tab-'+b.dataset.tab));
 }));
 document.getElementById('btn-reset').addEventListener('click',()=>{location.reload()});
 document.getElementById('s1-pref').addEventListener('input',showHint);
 document.getElementById('s1-city').addEventListener('input',showHint);
 document.getElementById('s1-calc').addEventListener('click',computeSimple);
 document.getElementById('s2-calc').addEventListener('click',computePrecise);
 document.getElementById('s3-calc').addEventListener('click',computePlain);
 showHint();
}
document.addEventListener('DOMContentLoaded',bind);
