
let S={
  balance:0,
  initialBalance:0,
  unitPct:1,
  bets:[],
  bankHistory:[],
  page:0,
  perPage:12,
  risk:{
    maxStakePct:5,
    maxStakeUnits:3,
    dailyLossLimit:10,
    weeklyLossLimit:20
  }
};

const SAVED=localStorage.getItem('bpro_v5');
if(SAVED){
  try{
    const parsed=JSON.parse(SAVED);
    S={
      ...S,
      ...parsed,
      risk:{...S.risk,...(parsed.risk||{})}
    };
  }catch(e){}
}

let accLegs=[],editingId=null,pendingCfm=null,curFilter='all',resolveAccId=null,resolveLegMap={};

function save(){localStorage.setItem('bpro_v5',JSON.stringify(S))}
function fmt(v){return 'R$ '+Math.abs(Number(v||0)).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.')}
function fmtS(v){return (v>=0?'+':'-')+fmt(v)}
function fmtP(v){return Number(v||0).toFixed(1)+'%'}
function n(v){return Number(v||0)}

let _tt;
function toast(msg,type='g'){
  clearTimeout(_tt);
  const el=document.getElementById('toast');
  el.innerHTML=msg;
  el.className='toast '+type+' show';
  _tt=setTimeout(()=>el.className='toast',3500);
}

function goPage(id,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  if(btn)btn.classList.add('active');
  if(id==='apostas')renderTbl();
  if(id==='simples'||id==='acumulada')updateUBars();
  if(id==='dashboard')renderDash();
  if(id==='config')loadCfg();
  if(id==='relatorios')renderReports();
}

function loadCfg(){
  document.getElementById('cfgBal').value=S.balance>0?S.balance:'';
  document.getElementById('cfgUnit').value=S.unitPct;
  document.getElementById('cfgRiskPct').value=S.risk?.maxStakePct ?? 5;
  document.getElementById('cfgRiskUnits').value=S.risk?.maxStakeUnits ?? 3;
  document.getElementById('cfgDailyLoss').value=S.risk?.dailyLossLimit ?? 10;
  document.getElementById('cfgWeeklyLoss').value=S.risk?.weeklyLossLimit ?? 20;
  updUnitHint();
  updRiskHint();
}

function updUnitHint(){
  const p=parseFloat(document.getElementById('cfgUnit').value)||1;
  const v=S.balance*(p/100);
  document.getElementById('unitHint').textContent=S.balance>0?`1 unit = ${fmt(v)} (${p}% de ${fmt(S.balance)})`:`${p}% da banca`;
}

function setBal(){
  const v=parseFloat(document.getElementById('cfgBal').value);
  if(!v||v<=0){toast('Valor inválido!','r');return}
  S.balance=v;
  S.initialBalance=v;
  S.bankHistory=[{balance:v,label:'Início',ts:Date.now()}];
  save();
  renderAll();
  toast(`✅ Banca definida: ${fmt(v)}`,'g');
}

function saveUnit(){
  const v=parseFloat(document.getElementById('cfgUnit').value);
  if(!v||v<=0){toast('Valor inválido!','r');return}
  S.unitPct=v;
  save();
  updateUBars();
  updRiskHint();
  toast(`✅ 1 unit = ${v}% da banca`,'g');
}

function updRiskHint(){
  const pct=parseFloat(document.getElementById('cfgRiskPct')?.value)||0;
  const units=parseFloat(document.getElementById('cfgRiskUnits')?.value)||0;
  const daily=parseFloat(document.getElementById('cfgDailyLoss')?.value)||0;
  const weekly=parseFloat(document.getElementById('cfgWeeklyLoss')?.value)||0;
  const oneUnit=S.balance>0?S.balance*(S.unitPct/100):0;
  const maxStakeByPct=S.balance>0?S.balance*(pct/100):0;
  const maxStakeByUnits=oneUnit*units;
  const el=document.getElementById('riskHint');
  el.innerHTML=`
    Máx por entrada: <strong>${fmt(maxStakeByPct)}</strong> por %
    • <strong>${fmt(maxStakeByUnits)}</strong> por units
    • Stop diário: <strong>${daily.toFixed(1)}%</strong>
    • Stop semanal: <strong>${weekly.toFixed(1)}%</strong>
  `;
}

function saveRisk(){
  const maxStakePct=parseFloat(document.getElementById('cfgRiskPct').value);
  const maxStakeUnits=parseFloat(document.getElementById('cfgRiskUnits').value);
  const dailyLossLimit=parseFloat(document.getElementById('cfgDailyLoss').value);
  const weeklyLossLimit=parseFloat(document.getElementById('cfgWeeklyLoss').value);

  if(maxStakePct<=0||maxStakeUnits<=0||dailyLossLimit<=0||weeklyLossLimit<=0){
    toast('⚠️ Valores de risco inválidos!','r');
    return;
  }

  S.risk={maxStakePct,maxStakeUnits,dailyLossLimit,weeklyLossLimit};
  save();
  updRiskHint();
  toast('✅ Regras de risco salvas!','g');
}

function updateUBars(){
  ['S','A'].forEach(suf=>{
    const bar=document.getElementById('unitBar'+suf);
    if(!bar)return;
    if(S.balance<=0){bar.style.display='none';return}
    bar.style.display='flex';
    const one=S.balance*(S.unitPct/100);
    document.getElementById('unitVal'+suf).textContent=`1 unit = ${fmt(one)}`;
    document.getElementById('unitSub'+suf).textContent=`Banca: ${fmt(S.balance)} · ${S.unitPct}% por unit`;
  });
}

function startOfDay(ts){
  const d=new Date(ts);
  d.setHours(0,0,0,0);
  return d.getTime();
}
function startOfWeek(ts){
  const d=new Date(ts);
  const day=d.getDay();
  const diff=d.getDate()-day+(day===0?-6:1);
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return d.getTime();
}
function startOfMonth(ts){
  const d=new Date(ts);
  d.setDate(1);
  d.setHours(0,0,0,0);
  return d.getTime();
}
function isSameDay(tsA,tsB){return startOfDay(tsA)===startOfDay(tsB)}
function isSameWeek(tsA,tsB){return startOfWeek(tsA)===startOfWeek(tsB)}
function isSameMonth(tsA,tsB){
  const a=new Date(tsA),b=new Date(tsB);
  return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth();
}

function resolvedLossValue(b){
  return b.profitLoss!=null&&b.profitLoss<0?Math.abs(b.profitLoss):0;
}
function getTodayLoss(){
  const now=Date.now();
  return S.bets.filter(b=>b.profitLoss!=null&&isSameDay(b.ts,now)).reduce((acc,b)=>acc+resolvedLossValue(b),0);
}
function getWeekLoss(){
  const now=Date.now();
  return S.bets.filter(b=>b.profitLoss!=null&&isSameWeek(b.ts,now)).reduce((acc,b)=>acc+resolvedLossValue(b),0);
}

function validateRisk(stake){
  if(S.balance<=0||!S.risk||S.initialBalance<=0)return{ok:true,msg:''};

  const oneUnit=S.balance*(S.unitPct/100);
  const maxByPct=S.balance*(S.risk.maxStakePct/100);
  const maxByUnits=oneUnit*S.risk.maxStakeUnits;
  const dailyLimit=S.initialBalance*(S.risk.dailyLossLimit/100);
  const weeklyLimit=S.initialBalance*(S.risk.weeklyLossLimit/100);
  const todayLoss=getTodayLoss();
  const weekLoss=getWeekLoss();

  if(stake>maxByPct){
    return{ok:false,msg:`❌ Valor excede o limite de ${S.risk.maxStakePct}% da banca (${fmt(maxByPct)}).`};
  }
  if(stake>maxByUnits){
    return{ok:false,msg:`❌ Valor excede o limite de ${S.risk.maxStakeUnits} units (${fmt(maxByUnits)}).`};
  }
  if(todayLoss>=dailyLimit){
    return{ok:false,msg:`❌ Stop diário já atingido (${fmt(todayLoss)} / ${fmt(dailyLimit)}).`};
  }
  if(weekLoss>=weeklyLimit){
    return{ok:false,msg:`❌ Stop semanal já atingido (${fmt(weekLoss)} / ${fmt(weeklyLimit)}).`};
  }

  let alerts=[];
  if(todayLoss+stake>dailyLimit){
    alerts.push(`⚠️ Esta entrada coloca o risco diário acima do stop (${fmt(todayLoss+stake)} > ${fmt(dailyLimit)}).`);
  }
  if(weekLoss+stake>weeklyLimit){
    alerts.push(`⚠️ Esta entrada coloca o risco semanal acima do stop (${fmt(weekLoss+stake)} > ${fmt(weeklyLimit)}).`);
  }

  return{ok:true,msg:alerts.join(' ')};
}

function previewRisk(stake,targetId){
  const box=document.getElementById(targetId);
  if(!box)return;
  if(!stake||stake<=0||S.balance<=0||S.initialBalance<=0){
    box.style.display='none';
    box.innerHTML='';
    return;
  }
  const r=validateRisk(stake);
  if(!r.ok){
    box.style.display='block';
    box.className='danger-bar';
    box.innerHTML=r.msg;
    return;
  }
  if(r.msg){
    box.style.display='block';
    box.className='warn-bar';
    box.innerHTML=r.msg;
    return;
  }
  box.style.display='none';
  box.innerHTML='';
}

/* ── SIMPLES ── */
function calcS(){
  const odd=parseFloat(document.getElementById('sOdd').value);
  const stake=parseFloat(document.getElementById('sStake').value);
  previewRisk(stake,'riskPreviewSimple');
  if(odd>=1&&stake>0){
    document.getElementById('sRet').value=fmt(odd*stake);
    document.getElementById('sImplied').value=((1/odd)*100).toFixed(1)+'%';
    if(S.balance>0){
      const h=document.getElementById('sHint');
      const pct=(stake/S.balance*100).toFixed(1);
      const u=(stake/(S.balance*S.unitPct/100)).toFixed(2);
      h.textContent=`${pct}% da banca · ${u} units`;
      h.className='hint '+(stake>S.balance*0.1?'r':'g');
    }
  }else{
    document.getElementById('sRet').value='';
    document.getElementById('sImplied').value='';
    document.getElementById('sHint').textContent='';
  }
}

function syncUnitsS(){
  const s=parseFloat(document.getElementById('sStake').value);
  if(!s||S.balance<=0)return;
  document.getElementById('sUnits').value=(s/(S.balance*S.unitPct/100)).toFixed(2);
}
function unitsToStakeS(){
  const u=parseFloat(document.getElementById('sUnits').value);
  if(!u||S.balance<=0)return;
  document.getElementById('sStake').value=(S.balance*S.unitPct/100*u).toFixed(2);
  calcS();
}

function addSimple(){
  const event=document.getElementById('sEvent').value.trim();
  const cat=document.getElementById('sCat').value;
  const mkt=document.getElementById('sMkt').value.trim();
  const mode=document.getElementById('sMode').value;
  const conf=document.getElementById('sConf').value;
  const odd=parseFloat(document.getElementById('sOdd').value);
  const stake=parseFloat(document.getElementById('sStake').value);
  const notes=document.getElementById('sNotes').value.trim();

  if(!event){toast('⚠️ Informe o evento!','a');return}
  if(!odd||odd<1.01){toast('⚠️ Odd inválida!','a');return}
  if(!stake||stake<=0){toast('⚠️ Valor inválido!','a');return}
  if(S.initialBalance===0){toast('⚠️ Configure a banca primeiro!','a');return}
  if(stake>S.balance){toast('❌ Saldo insuficiente!','r');return}

  const riskCheck=validateRisk(stake);
  if(!riskCheck.ok){toast(riskCheck.msg,'r');return}

  const units=S.balance>0?+(stake/(S.balance*S.unitPct/100)).toFixed(2):0;

  S.balance=+(S.balance-stake).toFixed(2);
  S.bets.unshift({
    id:Date.now(),
    type:'simple',
    event,cat,mkt,mode,conf,
    odd,stake,
    return:+(odd*stake).toFixed(2),
    units,
    status:'pending',
    notes,
    date:new Date().toLocaleDateString('pt-BR'),
    ts:Date.now()
  });

  save();
  renderAll();
  toast(`✅ <strong>${event}</strong> registrado`,'g');
  clearS();
}

function clearS(){
  ['sEvent','sOdd','sStake','sUnits','sRet','sImplied','sNotes','sMkt'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.value='';
  });
  document.getElementById('sHint').textContent='';
  previewRisk(0,'riskPreviewSimple');
}

/* ── ACUMULADA BUILD ── */
function addLeg(){
  const ev=document.getElementById('aLegEvent').value.trim();
  const odd=parseFloat(document.getElementById('aLegOdd').value);
  const cat=document.getElementById('aLegCat').value;
  const mkt=document.getElementById('aLegMkt').value.trim();

  if(!ev){toast('⚠️ Informe o evento!','a');return}
  if(!odd||odd<1.01){toast('⚠️ Odd inválida!','a');return}

  accLegs.push({id:Date.now()+Math.random(),ev,odd,cat,mkt});
  document.getElementById('aLegEvent').value='';
  document.getElementById('aLegOdd').value='';
  document.getElementById('aLegMkt').value='';
  document.getElementById('aLegEvent').focus();

  renderLegBuilder();
  calcA();
  toast(`✅ Seleção ${accLegs.length} adicionada`,'g');
}

function removeLeg(id){
  accLegs=accLegs.filter(l=>l.id!==id);
  renderLegBuilder();
  calcA();
}

function renderLegBuilder(){
  const wrap=document.getElementById('legBuilder');
  const summary=document.getElementById('accSummary');
  const stakeCard=document.getElementById('aStakeCard');

  document.getElementById('legCountBadge').textContent=accLegs.length>0?`(${accLegs.length})`:'';

  if(accLegs.length===0){
    wrap.innerHTML='<div class="empty" style="padding:16px"><div class="empty-icon">🎯</div>Adicione pelo menos 2 seleções</div>';
    summary.style.display='none';
    stakeCard.style.display='none';
    return;
  }

  wrap.innerHTML=accLegs.map((l,i)=>`
    <div class="leg-row">
      <span class="leg-num">${i+1}</span>
      <div>
        <div class="leg-event">${l.ev}</div>
        <div class="leg-detail">${l.cat}${l.mkt?' · '+l.mkt:''} · implícita ${((1/l.odd)*100).toFixed(0)}%</div>
      </div>
      <span class="leg-odd-badge">${l.odd.toFixed(2)}</span>
      <span></span>
      <button class="leg-del" onclick="removeLeg(${l.id})">×</button>
    </div>
  `).join('');

  if(accLegs.length>=2){
    summary.style.display='grid';
    stakeCard.style.display='block';
    document.getElementById('aCount').textContent=accLegs.length;
    document.getElementById('aTotalOdd').textContent=accLegs.reduce((p,l)=>p*l.odd,1).toFixed(2);
    calcA();
  }else{
    summary.style.display='none';
    stakeCard.style.display='none';
  }
}

function calcA(){
  if(accLegs.length<2)return;
  const totalOdd=accLegs.reduce((p,l)=>p*l.odd,1);
  const stake=parseFloat(document.getElementById('aStake')?.value)||0;

  document.getElementById('aRetShow').textContent=fmt(stake*totalOdd);
  document.getElementById('aProfShow').textContent=fmt(stake*totalOdd-stake);
  previewRisk(stake,'riskPreviewAcc');

  if(stake>0){
    document.getElementById('aRet').value=fmt(stake*totalOdd);
    if(S.balance>0){
      const h=document.getElementById('aHint');
      const pct=(stake/S.balance*100).toFixed(1);
      const u=(stake/(S.balance*S.unitPct/100)).toFixed(2);
      h.textContent=`${pct}% da banca · ${u} units`;
      h.className='hint '+(stake>S.balance*0.1?'r':'g');
    }
  }else{
    document.getElementById('aRet').value='';
  }
}

function syncUnitsA(){
  const s=parseFloat(document.getElementById('aStake').value);
  if(!s||S.balance<=0)return;
  document.getElementById('aUnits').value=(s/(S.balance*S.unitPct/100)).toFixed(2);
}
function unitsToStakeA(){
  const u=parseFloat(document.getElementById('aUnits').value);
  if(!u||S.balance<=0)return;
  document.getElementById('aStake').value=(S.balance*S.unitPct/100*u).toFixed(2);
  calcA();
}

function registerAcc(){
  if(accLegs.length<2){toast('⚠️ Mínimo 2 seleções!','a');return}
  const stake=parseFloat(document.getElementById('aStake').value);
  if(!stake||stake<=0){toast('⚠️ Informe o valor!','a');return}
  if(S.initialBalance===0){toast('⚠️ Configure a banca primeiro!','a');return}
  if(stake>S.balance){toast('❌ Saldo insuficiente!','r');return}

  const riskCheck=validateRisk(stake);
  if(!riskCheck.ok){toast(riskCheck.msg,'r');return}

  const totalOdd=+(accLegs.reduce((p,l)=>p*l.odd,1)).toFixed(4);
  const notes=document.getElementById('aNotes').value.trim();
  const units=S.balance>0?+(stake/(S.balance*S.unitPct/100)).toFixed(2):0;
  const names=accLegs.map(l=>l.ev);
  const displayName=names.length<=2?names.join(' + '):names.slice(0,2).join(' + ')+` +${names.length-2} mais`;

  S.balance=+(S.balance-stake).toFixed(2);
  S.bets.unshift({
    id:Date.now(),
    type:'acc',
    event:displayName,
    cat:'Acumulada',
    mkt:`${accLegs.length} seleções`,
    mode:'Pré-evento',
    conf:'—',
    odd:totalOdd,
    stake,
    return:+(totalOdd*stake).toFixed(2),
    units,
    status:'pending',
    notes,
    legs:accLegs.map(l=>({ev:l.ev,odd:l.odd,cat:l.cat,mkt:l.mkt,status:'pending'})),
    date:new Date().toLocaleDateString('pt-BR'),
    ts:Date.now()
  });

  save();
  renderAll();
  toast(`🎯 Acumulada ${accLegs.length}x registrada! Odd: ${totalOdd.toFixed(2)}`,'o');
  clearAcc();
}

function clearAcc(){
  accLegs=[];
  ['aStake','aUnits','aRet','aNotes'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.value='';
  });
  document.getElementById('aHint').textContent='';
  previewRisk(0,'riskPreviewAcc');
  renderLegBuilder();
}

/* ── RESOLVE SIMPLES ── */
function resolve(id,result){
  const bet=S.bets.find(b=>b.id===id);
  if(!bet||bet.status!=='pending'||bet.type==='acc')return;

  bet.status=result;

  let credit=0,msg='';
  if(result==='win'){credit=bet.return;msg=`✅ Ganhou! +${fmt(credit)}`}
  else if(result==='loss'){credit=0;msg=`❌ Perdeu ${fmt(bet.stake)}`}
  else if(result==='halfwin'){credit=bet.stake+(bet.return-bet.stake)/2;msg=`↗️ ½W: +${fmt(credit-bet.stake)}`}
  else if(result==='halfloss'){credit=bet.stake/2;msg=`↘️ ½L: -${fmt(bet.stake/2)}`}
  else if(result==='void'){credit=bet.stake;msg=`⚪ Void — valor devolvido`}

  bet.credit=+credit.toFixed(2);
  bet.profitLoss=+(credit-bet.stake).toFixed(2);

  S.balance=+(S.balance+credit).toFixed(2);
  S.bankHistory.push({
    balance:S.balance,
    label:bet.event.length>14?bet.event.slice(0,14)+'…':bet.event,
    ts:Date.now()
  });

  save();
  renderAll();
  toast(msg,credit>=bet.stake?'g':(result==='void'?'b':'r'));
}

/* ── RESOLVE ACUMULADA ── */
function openResolveAcc(id){
  const bet=S.bets.find(b=>b.id===id);
  if(!bet||bet.type!=='acc'||bet.status!=='pending')return;

  resolveAccId=id;
  resolveLegMap={};
  bet.legs.forEach((_,i)=>{resolveLegMap[i]='pending'});
  renderResolveLegs(bet);
  document.getElementById('resolveAccOv').classList.add('open');
}

function closeResolveAcc(){
  resolveAccId=null;
  resolveLegMap={};
  document.getElementById('resolveAccOv').classList.remove('open');
}

function setLegResult(idx,status){
  resolveLegMap[idx]=status;
  const bet=S.bets.find(b=>b.id===resolveAccId);
  if(bet)renderResolveLegs(bet);
}

function renderResolveLegs(bet){
  const wrap=document.getElementById('resolveLegsWrap');
  wrap.innerHTML=bet.legs.map((leg,i)=>{
    const cur=resolveLegMap[i]||'pending';
    const op=s=>cur===s?'':'style="opacity:.4"';
    return `
      <div class="resolve-leg">
        <div class="rl-info">
          <div class="rl-name">${i+1}. ${leg.ev}</div>
          <div class="rl-odd">${leg.cat} · odd ${leg.odd.toFixed(2)}</div>
        </div>
        <div class="rl-btns">
          <button class="bwin" ${op('win')} onclick="setLegResult(${i},'win')">Win</button>
          <button class="bloss" ${op('loss')} onclick="setLegResult(${i},'loss')">Loss</button>
          <button class="bvoid" ${op('void')} onclick="setLegResult(${i},'void')">Void</button>
        </div>
      </div>
    `;
  }).join('');
  updateAccPreview(bet);
}

function updateAccPreview(bet){
  const vals=Object.values(resolveLegMap);
  const allDone=vals.every(s=>s!=='pending');
  const btn=document.getElementById('confirmAccBtn');
  const prev=document.getElementById('accResultPreview');

  btn.disabled=!allDone;
  if(!allDone){
    prev.innerHTML='<span style="color:var(--muted)">Resolva todas as seleções para ver o resultado</span>';
    return;
  }

  const hasLoss=vals.some(s=>s==='loss');
  const allVoid=vals.every(s=>s==='void');
  const someVoid=vals.some(s=>s==='void');

  if(hasLoss){
    prev.innerHTML=`<span style="color:var(--red)">❌ Acumulada PERDIDA</span><br><span style="font-size:11px;color:var(--muted)">Prejuízo: -${fmt(bet.stake)}</span>`;
  }else if(allVoid){
    prev.innerHTML=`<span style="color:var(--muted2)">⚪ Toda acumulada anulada — devolução de ${fmt(bet.stake)}</span>`;
  }else if(someVoid){
    const adjOdd=bet.legs.reduce((acc,leg,i)=>resolveLegMap[i]==='void'?acc:acc*leg.odd,1);
    const adjRet=+(adjOdd*bet.stake).toFixed(2);
    prev.innerHTML=`<span style="color:var(--green)">✅ Acumulada GANHA (legs void deduzidas)</span><br><span style="font-size:11px;color:var(--muted)">Odd ajustada: <b style="color:var(--amber)">${adjOdd.toFixed(4)}</b> · Retorno: <b style="color:var(--green)">${fmt(adjRet)}</b> · Lucro: +${fmt(adjRet-bet.stake)}</span>`;
  }else{
    prev.innerHTML=`<span style="color:var(--green)">✅ Acumulada GANHA!</span><br><span style="font-size:11px;color:var(--muted)">Retorno: <b style="color:var(--green)">${fmt(bet.return)}</b> · Lucro: +${fmt(bet.return-bet.stake)}</span>`;
  }
}

function confirmResolveAcc(){
  const bet=S.bets.find(b=>b.id===resolveAccId);
  if(!bet)return;

  const vals=resolveLegMap;
  const hasLoss=Object.values(vals).some(s=>s==='loss');
  const allVoid=Object.values(vals).every(s=>s==='void');
  const someVoid=Object.values(vals).some(s=>s==='void');

  bet.legs.forEach((leg,i)=>{leg.status=vals[i]||'pending'});

  let credit=0,finalStatus='loss',msg='';
  if(hasLoss){
    credit=0;
    finalStatus='loss';
    msg=`❌ Acumulada perdida — -${fmt(bet.stake)}`;
  }else if(allVoid){
    credit=bet.stake;
    finalStatus='void';
    msg=`⚪ Acumulada anulada — ${fmt(bet.stake)} devolvido`;
  }else if(someVoid){
    const adjOdd=+(bet.legs.reduce((acc,leg,i)=>vals[i]==='void'?acc:acc*leg.odd,1)).toFixed(4);
    credit=+(adjOdd*bet.stake).toFixed(2);
    finalStatus='win';
    bet.odd=adjOdd;
    bet.return=credit;
    msg=`🎯 Acumulada ganha (odd ajustada)! +${fmt(credit-bet.stake)}`;
  }else{
    credit=bet.return;
    finalStatus='win';
    msg=`🎯 Acumulada GANHA! +${fmt(credit-bet.stake)}`;
  }

  bet.status=finalStatus;
  bet.credit=+credit.toFixed(2);
  bet.profitLoss=+(credit-bet.stake).toFixed(2);

  S.balance=+(S.balance+credit).toFixed(2);
  S.bankHistory.push({balance:S.balance,label:`Acum${bet.legs.length}x`,ts:Date.now()});

  save();
  renderAll();
  closeResolveAcc();
  toast(msg,finalStatus==='win'?'o':(finalStatus==='void'?'b':'r'));
}

/* ── FILTERS ── */
function setF(f,el){
  curFilter=f;
  S.page=0;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderTbl();
}
function toggleLD(id){
  const el=document.getElementById('ld-'+id);
  if(el)el.classList.toggle('open');
}
function passPeriodFilter(b){
  const p=document.getElementById('periodSel')?.value||'all';
  const now=Date.now();
  if(p==='all')return true;
  if(p==='today')return isSameDay(b.ts,now);
  if(p==='7d')return b.ts>=now-(7*24*60*60*1000);
  if(p==='30d')return b.ts>=now-(30*24*60*60*1000);
  if(p==='month')return isSameMonth(b.ts,now);
  return true;
}

/* ── TABLE ── */
function renderTbl(){
  const srch=(document.getElementById('srch')?.value||'').toLowerCase();
  const sort=document.getElementById('sortSel')?.value||'newest';

  let bets=S.bets
    .filter(b=>{
      if(curFilter==='acc')return b.type==='acc';
      if(curFilter==='void')return ['void','halfwin','halfloss'].includes(b.status);
      if(curFilter!=='all')return b.status===curFilter;
      return true;
    })
    .filter(passPeriodFilter)
    .filter(b=>{
      if(!srch)return true;
      const legMatch=b.type==='acc'&&b.legs?b.legs.some(l=>l.ev.toLowerCase().includes(srch)):false;
      return b.event.toLowerCase().includes(srch)
        || (b.cat||'').toLowerCase().includes(srch)
        || (b.mkt||'').toLowerCase().includes(srch)
        || (b.notes||'').toLowerCase().includes(srch)
        || legMatch;
    });

  bets.sort((a,b)=>
    sort==='newest'?b.ts-a.ts:
    sort==='oldest'?a.ts-b.ts:
    sort==='biggest'?b.stake-a.stake:
    sort==='best'?(b.profitLoss||0)-(a.profitLoss||0):
    b.odd-a.odd
  );

  const total=bets.length,start=S.page*S.perPage,end=start+S.perPage;
  const pageBets=bets.slice(start,end);
  const tbody=document.getElementById('betsTbody');

  if(total===0){
    tbody.innerHTML=`<tr><td colspan="8"><div class="empty"><div class="empty-icon">📋</div>Nenhuma entrada encontrada.</div></td></tr>`;
    document.getElementById('pagInfo').textContent='0 entradas';
    document.getElementById('pagBtns').innerHTML='';
    return;
  }

  tbody.innerHTML=pageBets.map(bet=>{
    const isAcc=bet.type==='acc';
    const badge={
      pending:'<span class="badge b-pend">⏳ Pendente</span>',
      win:'<span class="badge b-win">✓ Ganhou</span>',
      loss:'<span class="badge b-loss">✗ Perdeu</span>',
      halfwin:'<span class="badge b-hw">↗ ½W</span>',
      halfloss:'<span class="badge b-hl">↘ ½L</span>',
      void:'<span class="badge b-void">○ Void</span>'
    }[bet.status]||'';

    const plC=bet.profitLoss==null?'var(--muted2)':bet.profitLoss>0?'var(--green)':'var(--red)';
    const plT=bet.profitLoss!=null?`<span class="mono" style="color:${plC}">${fmtS(bet.profitLoss)}</span>`:`<span style="color:var(--muted)">—</span>`

    let evCell='';
    if(isAcc){
      const legItems=(bet.legs||[]).map((l,i)=>{
        const lsc={'pending':'lst-p','win':'lst-w','loss':'lst-l','void':'lst-v'}[l.status||'pending']||'lst-p';
        const lst={'pending':'⏳','win':'✓ Win','loss':'✗ Loss','void':'○ Void'}[l.status||'pending']||'⏳';
        return `<div class="leg-item"><span class="li-n">${i+1}</span><span class="li-ev">${l.ev}</span><span class="li-odd">${l.odd.toFixed(2)}</span><span class="li-st ${lsc}">${lst}</span></div>`;
      }).join('');
      evCell=`<div class="ev-name">🎯 Acumulada ${(bet.legs||[]).length}x<span class="ev-tag tag-a">ACUM</span></div><button class="legs-toggle" onclick="toggleLD(${bet.id})">▸ Ver ${(bet.legs||[]).length} seleções</button><div class="legs-list" id="ld-${bet.id}">${legItems}</div><div class="ev-date">${bet.date}</div>`;
    }else{
      evCell=`<div class="ev-name">${bet.event}<span class="ev-tag tag-s">${bet.cat}</span></div>${bet.mkt?`<div class="ev-date">${bet.mkt}</div>`:''}<div class="ev-date">${bet.date} · ${bet.mode||'—'} · ${bet.conf||'—'}</div>`;
    }

    let actions='';
    if(bet.status==='pending'){
      actions=isAcc
        ? `<div class="rac"><button class="bwin" onclick="openResolveAcc(${bet.id})">Resolver</button><button class="btn bxs bd" onclick="askDel(${bet.id})">✕</button></div>`
        : `<div class="rac"><button class="bwin" onclick="resolve(${bet.id},'win')">Win</button><button class="bloss" onclick="resolve(${bet.id},'loss')">Loss</button><button class="bhw" onclick="resolve(${bet.id},'halfwin')">½W</button><button class="bhl" onclick="resolve(${bet.id},'halfloss')">½L</button><button class="bvoid" onclick="resolve(${bet.id},'void')">Void</button><button class="btn bxs bo" onclick="openEdit(${bet.id})">✏</button><button class="btn bxs bd" onclick="askDel(${bet.id})">✕</button></div>`;
    }else{
      actions=`<div class="rac"><button class="btn bxs bd" onclick="askDel(${bet.id})">Del</button></div>`;
    }

    return `
      <tr>
        <td data-label="Evento">${evCell}</td>
        <td data-label="Odd"><span class="mono" style="color:var(--amber)">${bet.odd.toFixed(2)}</span></td>
        <td data-label="Valor"><span class="mono">${fmt(bet.stake)}</span></td>
        <td data-label="Retorno"><span class="mono" style="color:var(--green)">${fmt(bet.return)}</span></td>
        <td data-label="Units"><span class="mono" style="color:var(--muted2)">${bet.units||'—'}</span></td>
        <td data-label="Status">${badge}</td>
        <td data-label="P/L">${plT}</td>
        <td data-label="Ações">${actions}</td>
      </tr>
    `;
  }).join('');

  const pages=Math.ceil(total/S.perPage);
  document.getElementById('pagInfo').textContent=`${start+1}–${Math.min(end,total)} de ${total}`;
  const pb=document.getElementById('pagBtns');
  pb.innerHTML='';

  const prev=document.createElement('button');
  prev.className='pb';
  prev.textContent='←';
  prev.disabled=S.page===0;
  prev.onclick=()=>{S.page--;renderTbl()};
  pb.appendChild(prev);

  for(let i=0;i<pages;i++){
    if(pages>7&&i>1&&i<pages-2&&Math.abs(i-S.page)>1){
      if(i===2){
        const d=document.createElement('span');
        d.textContent='…';
        d.style.cssText='padding:0 5px;color:var(--muted)';
        pb.appendChild(d);
      }
      continue;
    }
    const b=document.createElement('button');
    b.className='pb'+(i===S.page?' active':'');
    b.textContent=i+1;
    b.onclick=((idx)=>()=>{S.page=idx;renderTbl()})(i);
    pb.appendChild(b);
  }

  const next=document.createElement('button');
  next.className='pb';
  next.textContent='→';
  next.disabled=S.page>=pages-1;
  next.onclick=()=>{S.page++;renderTbl()};
  pb.appendChild(next);
}

/* ── DASHBOARD ── */
function calcDrawdown(){
  const hist=S.bankHistory.length?S.bankHistory:[{balance:S.initialBalance||0,ts:Date.now()}];
  let peak=hist[0]?.balance||0;
  let maxDD=0;
  let peakVal=peak;
  let troughVal=peak;

  hist.forEach(h=>{
    if(h.balance>peak){
      peak=h.balance;
      peakVal=h.balance;
    }
    const dd=peak>0?((peak-h.balance)/peak)*100:0;
    if(dd>maxDD){
      maxDD=dd;
      troughVal=h.balance;
    }
  });

  return {maxDD,peakVal,troughVal};
}

function renderDash(){
  const bets=S.bets;
  const resolved=bets.filter(b=>b.status!=='pending');
  const wins=bets.filter(b=>b.status==='win');
  const losses=bets.filter(b=>b.status==='loss');
  const pending=bets.filter(b=>b.status==='pending');
  const halfW=bets.filter(b=>b.status==='halfwin');
  const halfL=bets.filter(b=>b.status==='halfloss');
  const voids=bets.filter(b=>b.status==='void');

  const countable=wins.length+losses.length+halfW.length+halfL.length;
  const winRate=countable>0?((wins.length+halfW.length*0.5)/countable*100):0;

  const staked4roi=resolved.filter(b=>b.status!=='void').reduce((s,b)=>s+b.stake,0);
  const totalCredit=resolved.reduce((s,b)=>s+(b.credit||0),0);
  const profit=totalCredit-staked4roi;
  const roi=staked4roi>0?(profit/staked4roi*100):0;
  const avgOdd=bets.length>0?bets.reduce((s,b)=>s+b.odd,0)/bets.length:0;
  const avgStake=bets.length>0?bets.reduce((s,b)=>s+b.stake,0)/bets.length:0;
  const diff=S.balance-S.initialBalance;
  const riskVal=pending.reduce((s,b)=>s+b.stake,0);
  const yieldVal=staked4roi>0?(profit/staked4roi*100):0;

  const grossWin=resolved.filter(b=>(b.profitLoss||0)>0).reduce((s,b)=>s+b.profitLoss,0);
  const grossLoss=Math.abs(resolved.filter(b=>(b.profitLoss||0)<0).reduce((s,b)=>s+b.profitLoss,0));
  const pf=grossLoss>0?(grossWin/grossLoss):0;

  const dd=calcDrawdown();

  const kBal=document.getElementById('kBal');
  kBal.textContent=fmt(S.balance);
  kBal.style.color=diff>=0?'var(--green)':'var(--red)';
  document.getElementById('kBalDiff').textContent=S.initialBalance>0?fmtS(diff)+` (${fmtP(diff/S.initialBalance*100)})`:'—';

  document.getElementById('hBal').textContent=fmt(S.balance);
  document.getElementById('hBal').style.color=diff>=0?'var(--green)':'var(--red)';

  document.getElementById('kTotal').textContent=bets.length;
  document.getElementById('kPend').textContent=`${pending.length} pendente${pending.length!==1?'s':''}`;

  const kWR=document.getElementById('kWR');
  kWR.textContent=fmtP(winRate);
  kWR.style.color=winRate>=50?'var(--green)':'var(--red)';
  document.getElementById('kWRsub').textContent=`${wins.length}W — ${losses.length}L${halfW.length+halfL.length>0?' — '+(halfW.length+halfL.length)+'½':''}`;

  const kROI=document.getElementById('kROI');
  kROI.textContent=fmtP(roi);
  kROI.style.color=roi>=0?'var(--green)':'var(--red)';
  const rb=document.getElementById('roiBar');
  rb.style.width=Math.min(Math.abs(roi),100)+'%';
  rb.style.background=roi>=0?'var(--green)':'var(--red)';

  const kP=document.getElementById('kProfit');
  kP.textContent=fmtS(profit);
  kP.style.color=profit>=0?'var(--green)':'var(--red)';
  document.getElementById('kProfSub').textContent=voids.length>0?`${voids.length} void(s)`:'';  

  document.getElementById('kStaked').textContent=fmt(staked4roi);
  document.getElementById('kAvgOdd').textContent=avgOdd>0?`odd média: ${avgOdd.toFixed(2)}`:'odd média: —';

  const rBets=bets.filter(b=>['win','loss','halfwin','halfloss'].includes(b.status)).sort((a,b)=>b.ts-a.ts);
  let streak=0,streakType='';
  if(rBets.length>0){
    streakType=['win','halfwin'].includes(rBets[0].status)?'W':'L';
    for(const b of rBets){
      const t=['win','halfwin'].includes(b.status)?'W':'L';
      if(t===streakType)streak++;
      else break;
    }
  }
  const kStr=document.getElementById('kStreak');
  kStr.textContent=streak>0?`${streak}${streakType}`:'—';
  kStr.style.color=streakType==='W'?'var(--green)':'var(--red)';
  document.getElementById('streakDots').innerHTML=rBets.slice(0,10).reverse().map(b=>`<div class="sdot" style="background:${['win','halfwin'].includes(b.status)?'var(--green)':'var(--red)'};opacity:.8" title="${b.event}"></div>`).join('');

  const resBets=bets.filter(b=>b.profitLoss!=null);
  if(resBets.length>0){
    const best=resBets.reduce((m,b)=>b.profitLoss>m.profitLoss?b:m,resBets[0]);
    const worst=resBets.reduce((m,b)=>b.profitLoss<m.profitLoss?b:m,resBets[0]);
    document.getElementById('kBest').textContent=fmtS(best.profitLoss);
    document.getElementById('kBestName').textContent=best.event;
    document.getElementById('kWorst').textContent=fmtS(worst.profitLoss);
    document.getElementById('kWorstName').textContent=worst.event;
  }else{
    ['kBest','kBestName','kWorst','kWorstName'].forEach(id=>document.getElementById(id).textContent='—');
  }

  document.getElementById('kRisk').textContent=fmt(riskVal);
  document.getElementById('kRiskSub').textContent=`${pending.length} entrada${pending.length!==1?'s':''}`;

  document.getElementById('kDD').textContent=fmtP(dd.maxDD);
  document.getElementById('kDDsub').textContent=dd.maxDD>0?`Topo ${fmt(dd.peakVal)} → Fundo ${fmt(dd.troughVal)}`:'—';

  document.getElementById('kYield').textContent=fmtP(yieldVal);
  document.getElementById('kYieldSub').textContent=staked4roi>0?`Sobre ${fmt(staked4roi)}`:'—';

  document.getElementById('kPF').textContent=pf>0?pf.toFixed(2):'—';
  document.getElementById('kPFSub').textContent=grossLoss>0?`${fmt(grossWin)} / ${fmt(grossLoss)}`:'—';

  document.getElementById('kAvgStake').textContent=bets.length?fmt(avgStake):'—';
  document.getElementById('kAvgStakeSub').textContent=bets.length?`${bets.length} entradas`:'—';

  drawChart();
  renderCatBreakdown();
  renderRecent();
}

/* ── CHART ── */
function drawChart(){
  const hist=S.bankHistory;
  const canvas=document.getElementById('bankChart');
  const empty=document.getElementById('chartEmpty');

  if(hist.length<2){
    canvas.style.display='none';
    empty.style.display='block';
    return;
  }

  canvas.style.display='block';
  empty.style.display='none';

  const W=canvas.parentElement.clientWidth-36,H=150;
  canvas.width=W;
  canvas.height=H;

  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  const vals=hist.map(h=>h.balance);
  const min=Math.min(...vals)*0.97,max=Math.max(...vals)*1.03,range=max-min||1;
  const pad={top:10,right:14,bottom:22,left:56},gW=W-pad.left-pad.right,gH=H-pad.top-pad.bottom;
  const xOf=i=>pad.left+(i/(vals.length-1))*gW;
  const yOf=v=>pad.top+gH-((v-min)/range)*gH;

  ctx.strokeStyle='rgba(255,255,255,0.04)';
  ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad.top+(i/4)*gH;
    ctx.beginPath();
    ctx.moveTo(pad.left,y);
    ctx.lineTo(pad.left+gW,y);
    ctx.stroke();

    ctx.fillStyle='rgba(90,106,122,0.8)';
    ctx.font='9px JetBrains Mono,monospace';
    ctx.textAlign='right';
    ctx.fillText('R$'+(max-(i/4)*range).toFixed(0),pad.left-5,y+3);
  }

  const grad=ctx.createLinearGradient(0,pad.top,0,pad.top+gH);
  grad.addColorStop(0,'rgba(0,230,118,0.2)');
  grad.addColorStop(1,'rgba(0,230,118,0)');

  ctx.beginPath();
  ctx.moveTo(xOf(0),yOf(vals[0]));
  for(let i=1;i<vals.length;i++){
    const cpx=(xOf(i-1)+xOf(i))/2;
    ctx.bezierCurveTo(cpx,yOf(vals[i-1]),cpx,yOf(vals[i]),xOf(i),yOf(vals[i]));
  }
  ctx.lineTo(xOf(vals.length-1),pad.top+gH);
  ctx.lineTo(xOf(0),pad.top+gH);
  ctx.closePath();
  ctx.fillStyle=grad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(xOf(0),yOf(vals[0]));
  for(let i=1;i<vals.length;i++){
    const cpx=(xOf(i-1)+xOf(i))/2;
    ctx.bezierCurveTo(cpx,yOf(vals[i-1]),cpx,yOf(vals[i]),xOf(i),yOf(vals[i]));
  }
  ctx.strokeStyle='#00e676';
  ctx.lineWidth=2;
  ctx.stroke();

  vals.forEach((v,i)=>{
    ctx.beginPath();
    ctx.arc(xOf(i),yOf(v),3,0,Math.PI*2);
    ctx.fillStyle='#00e676';
    ctx.fill();
    ctx.strokeStyle='#161b22';
    ctx.lineWidth=1.5;
    ctx.stroke();
  });

  document.getElementById('chartInfo').textContent=`${vals.length} pontos · máx ${fmt(Math.max(...vals))} · mín ${fmt(Math.min(...vals))}`;
}

/* ── CAT BREAKDOWN ── */
function cleanCatLabel(cat){
  return (cat||'').replace(/^[^ ]+ /,'');
}
function renderCatBreakdown(){
  const catMap={};

  S.bets.filter(b=>['win','loss','halfwin','halfloss'].includes(b.status)).forEach(b=>{
    const c=b.type==='acc'?'Acumulada':cleanCatLabel(b.cat);
    if(!catMap[c])catMap[c]={w:0,l:0,profit:0,count:0};
    if(['win','halfwin'].includes(b.status))catMap[c].w++;
    else catMap[c].l++;
    catMap[c].profit+=(b.profitLoss||0);
    catMap[c].count++;
  });

  const keys=Object.keys(catMap);
  const el=document.getElementById('catBreakdown');

  if(keys.length===0){
    el.innerHTML='<div class="empty" style="padding:16px">Sem dados</div>';
    return;
  }

  el.innerHTML=keys.sort((a,b)=>catMap[b].profit-catMap[a].profit).map(cat=>{
    const d=catMap[cat],total=d.w+d.l,wr=total>0?(d.w/total*100):0;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:13px;font-weight:700">${cat}</div>
          <div style="font-size:10px;color:var(--muted)">${d.count} entradas · ${d.w}W ${d.l}L · ${wr.toFixed(0)}% WR</div>
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:${d.profit>=0?'var(--green)':'var(--red)'}">${fmtS(d.profit)}</div>
      </div>
    `;
  }).join('');
}

/* ── RECENT ── */
function renderRecent(){
  const el=document.getElementById('recentBets');
  const last5=S.bets.slice(0,5);

  if(last5.length===0){
    el.innerHTML='<div class="empty" style="padding:16px">Sem entradas</div>';
    return;
  }

  el.innerHTML=last5.map(b=>{
    const sC={pending:'var(--amber)',win:'var(--green)',loss:'var(--red)',halfwin:'var(--green)',halfloss:'var(--purple)',void:'var(--muted2)'}[b.status];
    const sT={pending:'⏳',win:'✓',loss:'✗',halfwin:'↗',halfloss:'↘',void:'○'}[b.status];
    const name=b.type==='acc'?`🎯 Acum ${(b.legs||[]).length}x`:b.event;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:12px;font-weight:700;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
          <div style="font-size:10px;color:var(--muted)">${b.date} · odd ${b.odd.toFixed(2)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${b.profitLoss!=null?`<span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:${b.profitLoss>=0?'var(--green)':'var(--red)'}">${fmtS(b.profitLoss)}</span>`:''}
          <span style="color:${sC};font-size:14px">${sT}</span>
        </div>
      </div>
    `;
  }).join('');
}

/* ── REPORTS ── */
function calcProfitInRange(filterFn){
  return S.bets
    .filter(b=>b.profitLoss!=null&&filterFn(b))
    .reduce((acc,b)=>acc+(b.profitLoss||0),0);
}
function renderReports(){
  const now=Date.now();
  const today=calcProfitInRange(b=>isSameDay(b.ts,now));
  const last7=calcProfitInRange(b=>b.ts>=now-(7*24*60*60*1000));
  const last30=calcProfitInRange(b=>b.ts>=now-(30*24*60*60*1000));
  const thisMonth=calcProfitInRange(b=>isSameMonth(b.ts,now));

  document.getElementById('rToday').textContent=fmtS(today);
  document.getElementById('rToday').style.color=today>=0?'var(--green)':'var(--red)';
  document.getElementById('r7').textContent=fmtS(last7);
  document.getElementById('r7').style.color=last7>=0?'var(--green)':'var(--red)';
  document.getElementById('r30').textContent=fmtS(last30);
  document.getElementById('r30').style.color=last30>=0?'var(--green)':'var(--red)';
  document.getElementById('rMonth').textContent=fmtS(thisMonth);
  document.getElementById('rMonth').style.color=thisMonth>=0?'var(--green)':'var(--red)';

  const dailyLimit=S.initialBalance*(S.risk.dailyLossLimit/100||0);
  const weeklyLimit=S.initialBalance*(S.risk.weeklyLossLimit/100||0);
  const todayLoss=getTodayLoss();
  const weekLoss=getWeekLoss();

  document.getElementById('rDailyStop').textContent=dailyLimit>0?`${fmt(todayLoss)} / ${fmt(dailyLimit)}`:'—';
  document.getElementById('rWeeklyStop').textContent=weeklyLimit>0?`${fmt(weekLoss)} / ${fmt(weeklyLimit)}`:'—';

  const monthlyMap={};
  S.bets.filter(b=>b.profitLoss!=null).forEach(b=>{
    const d=new Date(b.ts);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if(!monthlyMap[key])monthlyMap[key]=0;
    monthlyMap[key]+=b.profitLoss||0;
  });

  const monthlyKeys=Object.keys(monthlyMap).sort().reverse();
  const monthlyEl=document.getElementById('monthlyReport');
  if(monthlyKeys.length===0){
    monthlyEl.innerHTML='<div class="empty" style="padding:16px">Sem dados</div>';
  }else{
    monthlyEl.innerHTML=monthlyKeys.map(k=>{
      const v=monthlyMap[k];
      return `<div class="line"><span>${k}</span><strong style="font-family:'JetBrains Mono',monospace;color:${v>=0?'var(--green)':'var(--red)'}">${fmtS(v)}</strong></div>`;
    }).join('');
  }

  const categoryMap={};
  S.bets.filter(b=>b.profitLoss!=null).forEach(b=>{
    const c=b.type==='acc'?'Acumulada':cleanCatLabel(b.cat);
    if(!categoryMap[c])categoryMap[c]=0;
    categoryMap[c]+=b.profitLoss||0;
  });

  const catKeys=Object.keys(categoryMap).sort((a,b)=>categoryMap[b]-categoryMap[a]);
  const catEl=document.getElementById('categoryReport');
  if(catKeys.length===0){
    catEl.innerHTML='<div class="empty" style="padding:16px">Sem dados</div>';
  }else{
    catEl.innerHTML=catKeys.map(k=>{
      const v=categoryMap[k];
      return `<div class="line"><span>${k}</span><strong style="font-family:'JetBrains Mono',monospace;color:${v>=0?'var(--green)':'var(--red)'}">${fmtS(v)}</strong></div>`;
    }).join('');
  }
}

/* ── EDIT ── */
function openEdit(id){
  const bet=S.bets.find(b=>b.id===id);
  if(!bet||bet.status!=='pending'||bet.type==='acc')return;
  editingId=id;
  document.getElementById('eEv').value=bet.event;
  document.getElementById('eOdd').value=bet.odd;
  document.getElementById('eStk').value=bet.stake;
  document.getElementById('eCat').value=bet.cat;
  document.getElementById('eMkt').value=bet.mkt||'';
  document.getElementById('eMode').value=bet.mode||'Pré-evento';
  document.getElementById('eConf').value=bet.conf||'Média';
  document.getElementById('eNotes').value=bet.notes||'';
  document.getElementById('editOv').classList.add('open');
}
function closeEdit(){
  editingId=null;
  document.getElementById('editOv').classList.remove('open');
}
function saveEdit(){
  const bet=S.bets.find(b=>b.id===editingId);
  if(!bet)return;

  const nOdd=parseFloat(document.getElementById('eOdd').value);
  const nStk=parseFloat(document.getElementById('eStk').value);
  if(!nOdd||!nStk){toast('Valores inválidos!','r');return}

  const diff=nStk-bet.stake;
  if(diff>S.balance){toast('Saldo insuficiente!','r');return}

  const riskCheck=validateRisk(nStk);
  if(!riskCheck.ok){toast(riskCheck.msg,'r');return}

  S.balance=+(S.balance-diff).toFixed(2);
  bet.event=document.getElementById('eEv').value.trim();
  bet.odd=nOdd;
  bet.stake=nStk;
  bet.return=+(nOdd*nStk).toFixed(2);
  bet.cat=document.getElementById('eCat').value;
  bet.mkt=document.getElementById('eMkt').value.trim();
  bet.mode=document.getElementById('eMode').value;
  bet.conf=document.getElementById('eConf').value;
  bet.notes=document.getElementById('eNotes').value.trim();
  bet.units=S.balance>0?+(nStk/(S.balance*S.unitPct/100)).toFixed(2):0;

  save();
  renderAll();
  closeEdit();
  toast('✅ Entrada atualizada!','g');
}

/* ── DELETE/RESET ── */
function askDel(id){
  pendingCfm={type:'del',id};
  document.getElementById('cIcon').textContent='🗑️';
  document.getElementById('cTitle').textContent='Excluir entrada';
  document.getElementById('cMsg').textContent='Tem certeza? Esta ação não pode ser desfeita.';
  document.getElementById('confirmOv').classList.add('open');
}
function askReset(){
  pendingCfm={type:'reset'};
  document.getElementById('cIcon').textContent='⚠️';
  document.getElementById('cTitle').textContent='Apagar tudo';
  document.getElementById('cMsg').textContent='Todos os dados serão permanentemente apagados.';
  document.getElementById('confirmOv').classList.add('open');
}
function closeCfm(){
  pendingCfm=null;
  document.getElementById('confirmOv').classList.remove('open');
}
function doCfm(){
  if(!pendingCfm)return;

  if(pendingCfm.type==='del'){
    const bet=S.bets.find(b=>b.id===pendingCfm.id);
    if(bet&&bet.status==='pending')S.balance=+(S.balance+bet.stake).toFixed(2);
    S.bets=S.bets.filter(b=>b.id!==pendingCfm.id);
    toast('Entrada excluída','r');
  }else{
    S={
      balance:0,
      initialBalance:0,
      unitPct:1,
      bets:[],
      bankHistory:[],
      page:0,
      perPage:12,
      risk:{maxStakePct:5,maxStakeUnits:3,dailyLossLimit:10,weeklyLossLimit:20}
    };
    toast('Dados apagados','r');
  }

  save();
  renderAll();
  closeCfm();
}

/* ── EXPORT / IMPORT ── */
function expCSV(){
  if(!S.bets.length){toast('Nenhuma entrada!','a');return}
  const h=['Data','Tipo','Evento','Seleções','Categoria','Mercado','Modo','Confiança','Odd','Valor','Retorno','Units','Status','P/L','Observações'];
  const rows=S.bets.map(b=>[
    b.date,
    b.type==='acc'?'acumulada':'simples',
    `"${b.event}"`,
    `"${(b.legs||[]).map(l=>l.ev).join(' | ')}"`,
    b.cat||'',
    b.mkt||'',
    b.mode||'',
    b.conf||'',
    b.odd.toFixed(4),
    b.stake.toFixed(2),
    b.return.toFixed(2),
    b.units||0,
    b.status,
    b.profitLoss!=null?b.profitLoss.toFixed(2):'',
    `"${(b.notes||'').replace(/"/g,'""')}"`
  ]);
  dlBlob([h,...rows].map(r=>r.join(',')).join('\n'),'bancapro_export.csv','text/csv');
  toast('✅ CSV exportado!','g');
}
function expJSON(){
  dlBlob(JSON.stringify(S,null,2),'bancapro_backup.json','application/json');
  toast('✅ Backup exportado!','g');
}
function impJSON(){document.getElementById('impFile').click()}
function doImp(e){
  const file=e.target.files[0];
  if(!file)return;
  const r=new FileReader();
  r.onload=ev=>{
    try{
      const parsed=JSON.parse(ev.target.result);
      S={
        ...S,
        ...parsed,
        risk:{...S.risk,...(parsed.risk||{})}
      };
      save();
      renderAll();
      toast('✅ Dados importados!','g');
    }catch{
      toast('❌ Arquivo inválido!','r');
    }
  };
  r.readAsText(file);
}
function dlBlob(content,filename,type){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type}));
  a.download=filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── RENDER ALL ── */
function renderAll(){
  renderDash();
  renderTbl();
  renderReports();
  document.getElementById('hBal').textContent=fmt(S.balance);
  document.getElementById('hBal').style.color=(S.balance-S.initialBalance)>=0?'var(--green)':'var(--red)';
  updateUBars();
}

/* ── BACKDROPS ── */
['editOv','confirmOv','resolveAccOv'].forEach(id=>{
  document.getElementById(id).addEventListener('click',e=>{
    if(e.target.id===id){
      if(id==='editOv')closeEdit();
      else if(id==='confirmOv')closeCfm();
      else closeResolveAcc();
    }
  });
});

renderAll();
window.addEventListener('resize',()=>{
  if(document.getElementById('page-dashboard').classList.contains('active'))drawChart();
});

