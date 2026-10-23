import { ROLES, NIGHT_ORDER } from './data.js';
import { effectiveStatuses } from './effects.js';
import {abilityOf,healthy,working,exorcised,deathTriggers,deathPrevention,consumeFool,triggerGoon,previousRecord,announce,START_INFO} from './mechanics.js';
const roles=Object.fromEntries(ROLES.map(r=>[r.id,r]));
const label=p=>`${p.seat}번 ${roles[p.role]?.ko||'참가자'}`;
export const appearsDead=p=>!p.alive||p.statuses.includes('죽은 것으로 감지');
export function expireTimedEffects(state){for(const p of state.players)for(const [status,source] of Object.entries(p.effectSources||{})){if(source.night<state.night&&['monk','sailor','innkeeper','devilsadvocate','witch','cerenovus'].includes(source.roleId)){p.statuses=p.statuses.filter(s=>s!==status);delete p.effectSources[status];}}state.effects=(state.effects||[]).filter(e=>e.throughNight==null||e.throughNight>=state.night);}

export function executionDeaths(state){
  if(state.day?.night===state.night){const e=state.day.execution;return e&&['died','registers-dead'].includes(e.outcome)?[e]:[];}
  return state.players.filter(p=>(state.executionDeaths||[]).includes(p.id)||(!p.alive&&p.diedBeforeNight===state.night&&p.deathCause==='execution')).map(p=>({playerId:p.id,roleId:p.role,outcome:'died'}));
}
export function dayDeaths(state){
  const ids=new Set(executionDeaths(state).map(e=>e.playerId));
  state.players.filter(p=>p.diedBeforeNight===state.night&&p.deathPhase==='day').forEach(p=>ids.add(p.id));
  return [...ids].map(id=>state.players.find(p=>p.id===id)).filter(Boolean);
}
export function conditionalReady(state,p,id){
  const tonight=!p.alive&&p.diedNight===state.night;
  const today=!p.alive&&p.diedBeforeNight===state.night;
  if(roles[id]?.team==='demon'&&id!=='pukka'&&exorcised(state,p))return false;
  if(roles[id]?.team==='demon'&&p.noAttackNight===state.night)return false;
  const diedWithAbility=!p.abilityAtDeath||p.abilityAtDeath===id;
  if(id==='undertaker')return executionDeaths(state).length>0;
  if(id==='ravenkeeper')return tonight&&diedWithAbility;
  if(id==='sage')return tonight&&diedWithAbility&&(p.deathCause==='demon'||!p.deathCause);
  if(['barber','sweetheart'].includes(id))return diedWithAbility&&(tonight||today)&&(id!=='sweetheart'||!p.sweetheartTarget);
  if(id==='moonchild')return today||(!p.alive&&p.diedNight===state.night-1);
  if(id==='godfather'&&state.night>1)return dayDeaths(state).some(p=>roles[executionDeaths(state).find(e=>e.playerId===p.id)?.roleId||p.roleAtDeath||p.role]?.team==='outsider');
  if(id==='zombuul')return dayDeaths(state).length===0;
  if(id==='juggler')return state.night===(p.roleStartedNight||1)+1;
  if(id==='witch')return state.players.filter(p=>!appearsDead(p)).length>3;
  if(id==='grandmother'&&state.night>1){const key=`${p.id}:grandmother`,record=[...(state.pastNights||[])].sort((a,b)=>b.night-a.night).map(n=>n.actions[key]).find(a=>a&&!a.skipped&&a.targets?.length);const child=state.players.find(t=>t.id===(p.grandchildId||record?.targets[0]));return !!child&&!child.alive&&child.diedNight===state.night&&child.deathCause==='demon';}
  return true;
}
const lifeFields=['alive','diedNight','diedBeforeNight','deathPhase','deathCause','deathSource','roleAtDeath','lifeChangeKey','used','abilityUsed','needsStartInfo','roleStartedNight','revivedNight','revivedAtPosition'];
lifeFields.push('ghostVoteUsed');
lifeFields.push('abilityRole','simulatedAbilityRole','abilityAtDeath','healthyAtDeath','changedNight','changedAtPosition','grandchildId','sweetheartTarget','klutzChoice','moonchildChoice','startVersion');
const lifeSnapshot=p=>({...Object.fromEntries(lifeFields.map(k=>[k,p[k]??null])),ghostVoteUsed:p.ghostVoteUsed===true,wasRegistered:p.statuses.includes('죽은 것으로 감지')});
function restoreSnapshot(p,before){for(const key of lifeFields)if(Object.hasOwn(before,key))p[key]=before[key];p.statuses=p.statuses.filter(s=>s!=='죽은 것으로 감지');if(before.wasRegistered)p.statuses.push('죽은 것으로 감지');}
export function setLife(state,id,outcome,source={}){
  const p=state.players.find(p=>p.id===id);if(!p)return false;
  const wasHealthy=healthy(state,p),livingBefore=state.players.filter(t=>t.alive).length,actuallyAlive=p.alive;
  const wasApparentlyDead=appearsDead(p);
  if(outcome==='alive'){
    const wasDead=!p.alive;
    p.lifeChangeKey=null;
    p.alive=true;p.diedNight=null;p.diedBeforeNight=null;p.deathPhase=null;p.deathCause=null;p.deathSource=null;p.roleAtDeath=null;
    if(wasApparentlyDead)p.ghostVoteUsed=false;
    if(wasDead&&p.role==='philosopher'){p.abilityRole=null;p.simulatedAbilityRole=null;}
    p.statuses=p.statuses.filter(s=>!['죽은 것으로 감지','처형 사망'].includes(s));
    if(wasDead){p.used=false;p.abilityUsed=false;p.needsStartInfo=START_INFO.has(p.abilityRole||p.role);if(p.needsStartInfo)p.startVersion=(p.startVersion||0)+1;p.roleStartedNight=state.night;p.changedNight=state.night;p.abilityAtDeath=null;p.healthyAtDeath=null;p.sweetheartTarget=null;p.klutzChoice=null;p.moonchildChoice=null;}
    return true;
  }
  if(outcome==='registers-dead'){
    if(!p.alive&&!source.force)return false;
    if(!p.statuses.includes('죽은 것으로 감지'))p.statuses.push('죽은 것으로 감지');
  }else{if(!p.alive&&!source.force)return false;p.alive=false;}
  if(!wasApparentlyDead)p.ghostVoteUsed=false;
  p.lifeChangeKey=null;
  const day=source.phase?source.phase==='day':state.phase==='between';
  p.deathPhase=day?'day':'night';p.diedNight=day?null:state.night;p.diedBeforeNight=day?state.night:null;
  p.deathCause=source.cause||'other';p.deathSource=source.playerId||null;p.roleAtDeath=p.role;
  if(actuallyAlive&&!p.alive)deathTriggers(state,p,{wasHealthy,livingBefore,cause:p.deathCause,phase:p.deathPhase});
  return true;
}
export function recordExecution(state,id,outcome='auto'){
  for(const key of Object.keys(state.actions))if(key.split(':')[1]==='undertaker'){delete state.actions[key];state.completed=state.completed.filter(k=>k!==key);}
  if(state.day?.night!==state.night)state.day={night:state.night,execution:null};
  const old=state.day.execution;
  if(old?.changes){for(const change of old.changes){const target=state.players.find(p=>p.id===change.id);if(target)for(const [key,pair] of Object.entries(change.fields))if(JSON.stringify(target[key])===JSON.stringify(pair.after)){if(pair.before===undefined)delete target[key];else target[key]=structuredClone(pair.before);}}}
  if(old?.addedEffectKeys)state.effects=(state.effects||[]).filter(e=>!old.addedEffectKeys.includes(e.key));
  if(old?.addedNotifications)state.notifications=(state.notifications||[]).filter(t=>!old.addedNotifications.includes(t));
  if(old?.playerId&&(old.outcome==='died')){state.pendingSweethearts=(state.pendingSweethearts||[]).filter(id=>id!==old.playerId);state.effects=(state.effects||[]).filter(e=>!(e.roleId==='sweetheart'&&e.playerId===old.playerId));}
  if(old?.mastermindAfter!=null&&state.mastermindNight===old.mastermindAfter)state.mastermindNight=old.mastermindBefore??null;
  if(old?.before){const p=state.players.find(p=>p.id===old.playerId);if(p&&p.diedBeforeNight===state.night&&p.deathCause==='execution')restoreSnapshot(p,old.before);}
  state.executionDeaths=[];state.day.execution=null;
  if(!id)return;
  const p=state.players.find(p=>p.id===id);if(!p)return;
  const beforePlayers=structuredClone(state.players),effectKeys=new Set((state.effects||[]).map(e=>e.key)),beforeNotifications=[...(state.notifications||[])],mastermindBefore=state.mastermindNight;
  const before=lifeSnapshot(p),wasRegistered=p.statuses.includes('죽은 것으로 감지');
  if(!p.alive)outcome='already-dead';
  if(outcome==='auto'){const protection=deathPrevention(state,p,{execution:true});outcome=protection?'survived':abilityOf(p)==='zombuul'&&healthy(state,p)&&!wasRegistered?'registers-dead':'died';if(protection==='바보')consumeFool(p);if(protection)announce(state,label(p)+' · '+protection+' 때문에 처형 생존');}
  if(['died','registers-dead'].includes(outcome))setLife(state,id,outcome,{phase:'day',cause:'execution'});
  state.day.execution={playerId:id,roleId:p.role,outcome,before,wasRegistered};
  state.day.execution.changes=state.players.flatMap((target,i)=>{const previous=beforePlayers[i],fields={};for(const key of new Set([...Object.keys(previous),...Object.keys(target)]))if(JSON.stringify(previous[key])!==JSON.stringify(target[key]))fields[key]={before:previous[key],after:structuredClone(target[key])};return Object.keys(fields).length?[{id:target.id,fields}]:[];});
  state.day.execution.addedEffectKeys=(state.effects||[]).filter(e=>!effectKeys.has(e.key)).map(e=>e.key);
  state.day.execution.addedNotifications=(state.notifications||[]).filter(t=>!beforeNotifications.includes(t));
  if(state.mastermindNight!==mastermindBefore){state.day.execution.mastermindBefore=mastermindBefore;state.day.execution.mastermindAfter=state.mastermindNight;}
}

const ATTACKS=new Set(['imp','nodashii','shabaloth','po','zombuul','vigormortis','vortox','fanggu','assassin','godfather']);
function previousAction(state,q){return [...(state.pastNights||[])].sort((a,b)=>b.night-a.night).map(n=>({night:n.night,action:n.actions[q.key],done:n.completed.includes(q.key)})).find(n=>n.done&&n.action&&!n.action.skipped);}
export function lifeResolution(state,q,action,impaired=false){
  const actor=state.players.find(p=>p.id===q.playerId);if(!actor)return null;
  if(q.roleId==='moonchild'&&actor.healthyAtDeath===false)impaired=true;
  let targets=[],revivals=[],warnings=[];
  if(ATTACKS.has(q.roleId))targets=action.targets||[];
  else if(q.roleId==='pukka'&&state.night>1){const previous=[...(state.pastNights||[])].sort((a,b)=>b.night-a.night).find(n=>n.completed.includes(q.key)&&n.actions[q.key]&&!n.actions[q.key].skipped&&n.actions[q.key].poisonApplied!==false&&!n.actions[q.key].baseline?.impaired?.length);targets=previous?.actions[q.key]?.targets||[];}
  else if(q.roleId==='gambler'){const target=state.players.find(p=>p.id===action.targets?.[0]);if(target&&!action.characters?.includes(target.role))targets=[actor.id];}
  else if(q.roleId==='gossip'&&(action.choice||action.result)==='참')targets=action.targets||[];
  else if(q.roleId==='moonchild')targets=(actor.moonchildChoice?[actor.moonchildChoice.targetId]:action.targets||[]).filter(id=>actor.moonchildChoice?actor.moonchildChoice.good:state.players.find(p=>p.id===id)?.alignment==='good');
  else if(q.roleId==='tinker'&&(action.choice||action.result)==='사망')targets=[actor.id];
  else if(q.roleId==='grandmother'&&state.night>1&&q.reminderKind!=='first'){const child=state.players.find(p=>p.id===(actor.grandchildId||previousAction(state,q)?.action.targets?.[0]));if(child&&!child.alive&&child.diedNight===state.night&&child.deathCause==='demon')targets=[actor.id];}
  else if(q.roleId==='professor')revivals=(action.targets||[]).filter(id=>{const p=state.players.find(p=>p.id===id);return p&&!p.alive&&roles[p.role]?.team==='townsfolk';});
  else return null;
  if(q.roleId==='shabaloth'&&action.regurgitate)revivals=[action.regurgitate];
  if(impaired||['drunk','lunatic'].includes(actor.role)){warnings.push('중독·취함: 실제 사망·부활 없음');targets=[];revivals=[];}
  const demon=roles[q.roleId]?.team==='demon',sim=structuredClone(state),deaths=[],fools=[],outcomes={},goonTargets=[];
  let fangGuJump=false,fangGuTarget=null;
  for(const id of revivals){setLife(sim,id,'alive');outcomes[id]='alive';}
  // Pukka poisons the NEW choice before resolving the previous victim.
  if(q.roleId==='pukka'&&!impaired){sim.effects||=[];targets.forEach(id=>sim.effects.push({key:'pukka-previous:'+q.key,playerId:actor.id,roleId:'pukka',targetId:id,status:'중독',night:state.night}));if(!exorcised(sim,actor)){sim.actions[q.key]={...action,poisonApplied:true,skipped:false};if(!sim.completed.includes(q.key))sim.completed.push(q.key);for(const id of action.targets||[])if(triggerGoon(sim,q,id))goonTargets.push(id);}}
  for(const id of targets){
    let p=sim.players.find(t=>t.id===id);const source=sim.players.find(t=>t.id===q.playerId);if(!p?.alive)continue;
    if(q.roleId!=='pukka'&&triggerGoon(sim,q,id))goonTargets.push(id);
    const assassin=q.roleId==='assassin'&&!impaired;
    if(!healthy(sim,source)&&!assassin)continue;
    if(abilityOf(p)==='mayor'&&healthy(sim,p)&&action.mayorRedirect&&!assassin){const replacement=sim.players.find(t=>t.id===action.mayorRedirect);if(replacement?.alive){warnings.push(label(p)+' → '+label(replacement)+' 시장 대리 사망');p=replacement;}}
    const protection=deathPrevention(sim,p,{demon,assassin});
      if(protection){warnings.push(label(p)+' · '+protection+' 보호');if(protection==='바보'){consumeFool(p);fools.push(p.id);}continue;}
    if(q.roleId==='fanggu'&&!state.fangGuJumpUsed&&roles[p.role]?.team==='outsider'){
      fangGuJump=true;fangGuTarget=p.id;deaths.push(actor.id);outcomes[actor.id]='died';setLife(sim,actor.id,'died',{phase:'night',cause:'demon',playerId:actor.id});warnings.push(label(p)+' → 악한 팡 구 · 기존 팡 구 사망');continue;
    }
    const result=abilityOf(p)==='zombuul'&&!appearsDead(p)&&healthy(sim,p)&&!assassin?'registers-dead':'died';
    deaths.push(p.id);outcomes[p.id]=result;setLife(sim,p.id,result,{phase:'night',cause:demon?'demon':'ability',playerId:q.playerId});
  }
  if(state.arbitraryDeathsNight===state.night)warnings.push('새 악마 생성: 이번 밤 사망을 사회자가 조정하세요.');
  return {deaths,revivals,targets,warnings,demon,fools,outcomes,goonTargets,fangGuJump,fangGuTarget};
}
export function restoreLifeChanges(state,q){
  for(const change of state.actions[q.key]?.lifeChanges||[]){const p=state.players.find(p=>p.id===change.playerId);if(p?.lifeChangeKey===`${state.night}:${q.key}`)restoreSnapshot(p,change.before);}
}
export function applyLifeResolution(state,q,resolution,plan=null,action={}){
  const changes=[];
  for(const id of plan?.fools||[]){const p=state.players.find(t=>t.id===id);if(p&&(!resolution[id]||resolution[id]==='unchanged'))consumeFool(p);}
  const ordered=[...new Set([...(plan?.revivals||[]),...(action.targets||[]),...Object.keys(resolution||{})])];
  for(const id of ordered){
    if((action.targets||[]).includes(id))triggerGoon(state,q,id);
    const outcome=resolution?.[id];
    const p=state.players.find(p=>p.id===id);if(!p||outcome==='unchanged')continue;
    if(!outcome)continue;
    const before=lifeSnapshot(p);
    if(setLife(state,id,outcome,{phase:'night',cause:state.arbitraryDeathsNight===state.night&&!(plan?.deaths||[]).includes(id)?'ability':roles[q.roleId]?.team==='demon'?'demon':'ability',playerId:q.playerId})){if(outcome==='alive'&&!before.alive){p.revivedNight=state.night;p.revivedAtPosition=q.position??(state.night===1?NIGHT_ORDER.firstNight:NIGHT_ORDER.otherNight).indexOf(q.roleId);}p.lifeChangeKey=`${state.night}:${q.key}`;changes.push({playerId:id,outcome,before});}
  }
  return changes;
}
