import { ROLE_MAP, actingRole } from './game.js';
import { effectiveStatuses } from './effects.js';
import { executionDeaths } from './life.js';
import {seatedPlayers} from './layout.js';
import {exorcised,healthy} from './mechanics.js';

const RULES = {
  empath:[0,0], chef:[0,0], clockmaker:[0,0], oracle:[0,0], mathematician:[0,0], flowergirl:[0,0], towncrier:[0,0], juggler:[0,0], undertaker:[0,0], spy:[0,0], ravenkeeper:[1,1], dreamer:[1,1,'other'], fortuneteller:[2,2], seamstress:[2,2,'other'],
  washerwoman:[2,2], librarian:[2,2], investigator:[2,2], grandmother:[1,1,'good-other'], poisoner:[1,1], monk:[1,1,'other'], butler:[1,1,'other'], snakecharmer:[1,1,'alive'], chambermaid:[2,2,'alive-other'], sailor:[1,1,'alive'], innkeeper:[2,2], gambler:[1,1], exorcist:[1,1], professor:[1,1,'dead'], devilsadvocate:[1,1,'alive'], assassin:[1,1], witch:[1,1], cerenovus:[1,1], pithag:[1,1], eviltwin:[1,1,'other'], sweetheart:[1,1], moonchild:[1,1,'alive-other'], barber:[0,2], imp:[1,1], pukka:[1,1], shabaloth:[2,2], po:[0,3], zombuul:[1,1], fanggu:[1,1], vigormortis:[1,1], vortox:[1,1], nodashii:[1,1], godfather:[1,1], courtier:[0,0], philosopher:[0,0], gossip:[0,1], sage:[2,2], tinker:[0,0], lunatic:[0,3]
};
export function targetRule(roleId, night=1) {
  const rule = roleId==='godfather' && night===1 || roleId==='grandmother'&&night>1 ? [0,0] : RULES[roleId] || [0,0];
  return {min:rule[0],max:rule[1],restriction:rule[2]||'',label:rule[0]===rule[1]?`${rule[1]}명 선택`:`${rule[0]}–${rule[1]}명 선택`};
}
export function poCharged(state, playerOrId, roleId) {
  const playerId=typeof playerOrId==='object'?playerOrId?.id:playerOrId;
  const p=state.players?.find(t=>t.id===playerId);
  const rId=roleId||(p?.role==='lunatic'?'lunatic':'po');
  const key=`${playerId}:${rId}`;
  const nights=[...(state.pastNights||[])].filter(n=>!(n.night===1&&rId==='lunatic')&&n.night<state.night).sort((a,b)=>b.night-a.night);
  for(const night of nights){
    const action=night.actions?.[key];
    if(action&&!action.skipped&&night.completed.includes(key))return action.targets.length===0;
  }
  return false;
}
const SILENT_NIGHT_ROLES=new Set(['gossip','tinker','moonchild','sweetheart','barber']);
export function wokeTonightDueToAbility(state, playerId) {
  return (state.completed||[]).some(key=>{
    const [pid,rid,kind]=key.split(':');
    if(pid!==playerId)return false;
    const a=state.actions?.[key];
    if(!a||SILENT_NIGHT_ROLES.has(rid))return false;
    if(a.skipped&&!['courtier','professor','seamstress','philosopher','assassin'].includes(rid))return false;
    if(rid==='grandmother'&&state.night>1&&kind!=='start'&&!a.characters?.length)return false;
    if(rid==='pukka'&&exorcised(state,state.players.find(p=>p.id===playerId)))return false;
    return true;
  });
}
export function targetError(state, q, targetIds, partial=false) {
  if(q.roleId==='pukka'&&exorcised(state,state.players.find(p=>p.id===q.playerId)))return targetIds.length?'퇴마된 푸카는 새 대상을 선택하지 않습니다.':'';
  let roleId=q.roleId;
  if(roleId==='lunatic'&&state.night>1)roleId=state.players.find(p=>p.id===q.playerId)?.shownRole||'lunatic';
  const rule=q.roleId==='lunatic'&&state.night===1
    ? state.players.find(p=>p.id===q.playerId)?.shownRole==='pukka' ? {min:1,max:1,restriction:'',label:'1명 선택'} : {min:0,max:0,restriction:'',label:'대상 선택 없음'}
    : targetRule(roleId,q.reminderKind==='first'?1:state.night);
  if((!partial&&targetIds.length<rule.min) || targetIds.length>rule.max)return rule.label+'이 필요해요.';
  if(new Set(targetIds).size!==targetIds.length)return '서로 다른 참가자를 선택하세요.';
  if(!partial&&roleId==='barber'&&targetIds.length!==0&&targetIds.length!==2)return '선택하지 않거나 두 사람을 선택하세요.';
  if(roleId==='po'){
    const charged=poCharged(state,q.playerId,q.roleId);
    if(charged&&(!partial&&targetIds.length!==3))return '지난 밤 충전했습니다. 세 사람을 선택하세요.';
    if(!charged&&targetIds.length>1)return '충전하지 않은 포는 한 사람을 선택하거나 선택하지 않습니다.';
  }
  for(const id of targetIds){
    const p=state.players.find(p=>p.id===id);
    if(!p)return '없는 참가자입니다.';
    if(rule.restriction.includes('other')&&id===q.playerId)return '자신 이외의 참가자를 선택하세요.';
    if(rule.restriction.includes('alive')&&(!p.alive||p.statuses.includes('죽은 것으로 감지'))&&!(q.roleId==='moonchild'&&state.players.find(t=>t.id===q.playerId)?.moonchildChoice?.targetId===id))return '생존한 참가자를 선택하세요.';
    if(rule.restriction==='dead'&&detectedAlive(p)&&!(state.completed.includes(q.key)&&p.lifeChangeKey===`${state.night}:${q.key}`&&state.actions[q.key]?.lifeResults?.[p.id]==='alive'))return '죽은 참가자를 선택하세요.';
    if(rule.restriction.includes('good')&&p.alignment!=='good'&&p.role!=='spy'&&!impairment(state.players.find(actor=>actor.id===q.playerId),state).length)return '선한 참가자를 손주로 선택하세요.';
    if(roleId==='eviltwin'&&p.alignment===state.players.find(actor=>actor.id===q.playerId)?.alignment&&!impairment(state.players.find(actor=>actor.id===q.playerId),state).length)return '반대 진영의 쌍둥이를 고르세요.';
    if(['exorcist','devilsadvocate'].includes(roleId)){
      const previous=state.pastNights?.find(n=>n.night===state.night-1)?.actions?.[`${q.playerId}:${q.roleId}`];
      if(previous&&!previous.skipped&&previous.targets.includes(id))return '지난 밤과 다른 참가자를 선택하세요.';
    }
    if(roleId==='barber'&&ROLE_MAP[p.role]?.team==='demon'){
      const actor=state.players.find(actor=>actor.id===q.playerId),demonId=actor?.role==='barber'?state.players.find(player=>ROLE_MAP[player.role]?.team==='demon'&&player.alive)?.id:q.playerId;
      if(id!==demonId)return '이발사 교환은 선택하는 악마 이외의 악마를 포함할 수 없습니다.';
    }
  }
  return '';
}
const isEvil=p=>p.alignment==='evil';
const detectedAlive=p=>p.alive&&!p.statuses.includes('죽은 것으로 감지');
export function aliveNeighbors(state, playerId) {
  const order=seatedPlayers(state),index=order.findIndex(p=>p.id===playerId), found=[];
  if(index<0)return found;
  for(const direction of [-1,1])for(let step=1;step<state.count;step++){
    const p=order[(index+direction*step+state.count)%state.count];
    if(detectedAlive(p)){if(!found.some(t=>t.id===p.id))found.push(p);break;}
  }
  return found;
}
export function impairment(player, state) {
  if(!player)return [];
  const list=[...(state?effectiveStatuses(state,player):player.statuses).filter(s=>/중독|취함/.test(s)),...(player.role==='drunk'?['취함 · 주정뱅이']:[]),...(player.simulatedAbilityRole?['능력 미획득 · 실제 효과 없음']:[])];
  if(!player.alive&&player.healthyAtDeath===false&&!list.some(s=>/중독|취함/.test(s)))list.push('중독 · 사망 당시');
  return [...new Set(list)];
}
const LEARNS_INFO=['washerwoman','librarian','investigator','chef','empath','fortuneteller','undertaker','ravenkeeper','grandmother','chambermaid','clockmaker','dreamer','mathematician','flowergirl','towncrier','oracle','seamstress','juggler','sage'];
export function abnormalAbilityPlayers(state) {
  const found=new Set(),vortox=state.players.some(p=>p.role==='vortox'&&p.alive&&!impairment(p,state).length);
  for(const e of state.day?.events||[]){
    if(!e?.actorId)continue;
    const actor=state.players.find(p=>p.id===e.actorId);
    if(e.abnormal||(e.impaired?.length&&actor?.role!=='drunk')||(vortox&&['artist','savant'].includes(e.type)&&actor?.role!=='drunk'))found.add(e.actorId);
    if(e.type==='slayer'){
      const target=state.players.find(p=>p.id===e.targetId);
      if((e.slayerKill&&target&&ROLE_MAP[target.role]?.team!=='demon')||(!e.slayerKill&&target&&ROLE_MAP[target.role]?.team==='demon'&&actor?.role!=='drunk'))found.add(e.actorId);
    }
  }
  for(const key of state.completed||[]){
    const [pid,rid]=key.split(':'),p=state.players.find(pl=>pl.id===pid),a=state.actions?.[key];
    if(!p||!a||a.skipped||rid==='mathematician')continue;
    const imp=(a.baseline?.impaired||impairment(p,state)).filter(s=>!s.includes('주정뱅이')&&!(rid==='sailor'&&a.drunkTarget===pid)&&!(rid==='innkeeper'&&a.drunkTarget===pid));
    if(a.goonTriggered||a.goonDrunk===pid||exorcised(state,p)||a.mayorRedirect||a.poisonApplied===false){found.add(pid);continue;}
    if(LEARNS_INFO.includes(rid)){
      if(vortox&&p.role!=='drunk'&&ROLE_MAP[p.role]?.team==='townsfolk'){found.add(pid);continue;}
      if(imp.length){
        const delivered=a.choice||a.result;
        if(a.baseline?.value!=null&&delivered&&String(delivered)!==String(a.baseline.value)){found.add(pid);continue;}
        if(a.characters?.length&&a.baseline?.characterIds?.length){
          const mismatch=rid==='dreamer'?!a.characters.includes(a.baseline.characterIds[0]):!a.baseline.characterIds.includes(a.characters[0]);
          if(mismatch){found.add(pid);continue;}
        }
        if(!a.baseline||(a.baseline.value==null&&!a.baseline.characterIds?.length)){found.add(pid);continue;}
      }
      if(a.baseline?.exceptions?.some(x=>x.includes('감지 예외'))){
        const delivered=a.choice||a.result;
        if(a.baseline.value!=null&&delivered&&String(delivered)!==String(a.baseline.value)){found.add(pid);continue;}
        if(a.characters?.length&&a.baseline.characterIds?.length&&!a.baseline.characterIds.some(id=>a.characters.includes(id))){found.add(pid);continue;}
      }
    }else if(imp.length){
      found.add(pid);continue;
    }else if(['imp','shabaloth','po','zombuul','fanggu','vigormortis','vortox','nodashii','godfather','moonchild','gossip','tinker'].includes(rid)&&a.lifeResults){
      const blocked=(a.targets?.length?a.targets:rid==='tinker'?[pid]:[]).some(tid=>{const t=state.players.find(pl=>pl.id===tid);return t&&(a.lifeResults[tid]==='alive'||a.lifeResults[tid]==='unchanged')&&!(rid==='fanggu'&&t.role==='fanggu');});
      if(blocked)found.add(pid);
    }
  }
  return [...found];
}
export function information(state, q, action={targets:[]}) {
  const seated=seatedPlayers(state);
  const actor=state.players.find(p=>p.id===q.playerId), targets=(action.targets||[]).map(id=>state.players.find(p=>p.id===id)).filter(Boolean);
  const result={value:null,type:'text',caption:'정상 기준 정보',detail:'',characterIds:[],related:[],exceptions:[],impaired:impairment(actor,state)};
  let relevant=[];
  const set=(value,type,detail,players=[])=>{Object.assign(result,{value:String(value),type,detail,related:players.map(p=>p.id)});relevant=players;};
  const setCharacters=(players,detail)=>{result.characterIds=[...new Set(players.map(p=>p.role).filter(id=>ROLE_MAP[id]))];set(result.characterIds.map(id=>ROLE_MAP[id].ko).join(' · ')||'없음','text',detail,players);};
  switch(q.roleId){
    case 'empath': {const neighbors=aliveNeighbors(state,q.playerId);set(neighbors.filter(isEvil).length,'number','양옆 생존 이웃: '+neighbors.map(p=>`${p.seat}번 ${ROLE_MAP[p.role]?.ko||''}(${isEvil(p)?'악':'선'})`).join(' · '),neighbors);if(neighbors.length<2)result.exceptions.push('생존 이웃이 2명보다 적습니다. 종료 조건을 확인하세요.');break;}
    case 'chef': {const pairs=seated.flatMap((p,i)=>isEvil(p)&&isEvil(seated[(i+1)%state.count])?[[p,seated[(i+1)%state.count]]]:[]);set(pairs.length,'number',pairs.length?'인접한 악한 쌍: '+pairs.map(pair=>pair.map(p=>`${p.seat}번 ${ROLE_MAP[p.role]?.ko||''}`).join('–')).join(' · '):'서로 붙어 앉은 악한 쌍 없음',state.players);break;}
    case 'clockmaker': {const demons=state.players.filter(p=>ROLE_MAP[p.role]?.team==='demon'),minions=state.players.filter(p=>ROLE_MAP[p.role]?.team==='minion');if(demons.length&&minions.length){const distances=demons.flatMap(d=>minions.map(m=>({d,m,n:Math.min(Math.abs(seated.findIndex(p=>p.id===d.id)-seated.findIndex(p=>p.id===m.id)),state.count-Math.abs(seated.findIndex(p=>p.id===d.id)-seated.findIndex(p=>p.id===m.id)))}))).sort((a,b)=>a.n-b.n);const best=distances[0];set(best.n,'number',`${best.d.seat}번 ${ROLE_MAP[best.d.role]?.ko||'악마'} ↔ ${best.m.seat}번 ${ROLE_MAP[best.m.role]?.ko||'하수인'} · 최단 좌석 거리`,[best.d,best.m]);}else result.detail='악마와 하수인을 배치하면 계산됩니다.';relevant=state.players;break;}
    case 'oracle': {const dead=state.players.filter(p=>!detectedAlive(p));set(dead.filter(isEvil).length,'number',dead.filter(isEvil).map(p=>p.seat+'번').join(' · ')||'죽은 악한 참가자 없음',dead);break;}
    case 'fortuneteller': if(targets.length===2){const yes=targets.some(p=>ROLE_MAP[p.role]?.team==='demon'||p.statuses.includes('미끼'));set(yes?'예':'아니오','boolean',yes?'선택한 대상에 악마 또는 미끼가 있습니다.':'선택한 대상에 악마와 미끼가 없습니다.',targets);if(!state.players.some(p=>p.statuses.includes('미끼')))result.exceptions.push('점쟁이의 미끼를 참가자 상태에서 지정하세요.');}else result.detail='두 사람을 고르면 악마·미끼 여부를 계산합니다.';break;
    case 'seamstress': if(targets.length===2)set(targets[0].alignment===targets[1].alignment?'예':'아니오','boolean',targets[0].alignment===targets[1].alignment?'두 사람의 실제 진영이 같습니다.':'두 사람의 실제 진영이 다릅니다.',targets);else result.detail='자신 이외의 두 사람을 고르세요.';break;
    case 'ravenkeeper': case 'dreamer': if(targets.length===1){setCharacters(targets,q.roleId==='dreamer'?'실제 캐릭터 · 반대 유형의 캐릭터 하나를 함께 고르세요.':'선택한 사람의 실제 캐릭터');}else result.detail='한 사람을 고르면 실제 캐릭터가 표시됩니다.';break;
    case 'grandmother': {if(state.night>1&&q.reminderKind!=='first'){result.caption='능력 처리';result.detail='손주가 악마에게 사망했다면 할머니의 사망을 반영합니다.';break;}const pool=targets.length?targets:state.players.filter(p=>p.id!==q.playerId);const good=pool.filter(p=>p.alignment==='good');setCharacters(good,targets.length?'선택한 손주의 실제 캐릭터':'선한 참가자의 캐릭터 · 손주를 선택하세요.');relevant=pool;break;}
    case 'sage': {const killer=state.players.find(p=>p.id===actor?.deathSource)||state.players.find(p=>ROLE_MAP[p.role]?.team==='demon'&&p.alive);if(killer)set(killer.seat+'번 '+ROLE_MAP[killer.role].ko,'text','이 참가자를 포함한 두 명을 알려주세요.',[killer,...targets.filter(t=>t.id!==killer.id)]);else result.detail='자신을 죽인 악마를 포함한 두 사람을 알려주세요.';break;}
    case 'godfather': if(state.night===1||q.reminderKind==='first'){const outsiders=state.players.filter(p=>ROLE_MAP[p.role]?.team==='outsider');setCharacters(outsiders,'등장한 외지인 캐릭터');relevant=state.players;}break;
    case 'chambermaid': if(targets.length===2){const known=targets.map(p=>action.wakeFacts?.[p.id]);if(known.every(v=>typeof v==='boolean'))set(known.filter(Boolean).length,'number','아래에서 확인한 실제 기상 여부 기준',targets);else result.detail='두 대상이 자신의 능력으로 깨어났는지 아래에서 확인하세요.';}else result.detail='자신 이외의 생존자 두 명을 고르세요.';break;
    case 'washerwoman': case 'librarian': case 'investigator': {const team={washerwoman:'townsfolk',librarian:'outsider',investigator:'minion'}[q.roleId],all=state.players.filter(p=>ROLE_MAP[p.role]?.team===team);if(q.roleId==='librarian'&&!all.length)set('0','number','외지인 없음',state.players);else{const matching=(targets.length?targets:state.players).filter(p=>ROLE_MAP[p.role]?.team===team);setCharacters(matching,targets.length?'선택한 두 사람 안의 해당 캐릭터':'등장한 해당 캐릭터 · 알려줄 두 사람을 선택하세요.');if(!matching.length){result.value=null;result.detail='선택한 사람 중 해당 유형의 캐릭터가 없습니다.';}}relevant=targets.length?targets:state.players;break;}
    case 'mathematician': {const abnormal=state.abnormalPlayers??abnormalAbilityPlayers(state),people=abnormal.map(id=>state.players.find(p=>p.id===id)).filter(Boolean);set(abnormal.length,'number',state.abnormalPlayers?'사회자가 확인한 실제 비정상 작동 인원':people.length?'자동 감지: '+people.map(p=>`${p.seat}번 ${ROLE_MAP[p.role]?.ko||''}`).join(' · '):'비정상 작동한 능력 없음',people);break;}
    case 'flowergirl': {const votes=state.day?.events?.filter(e=>e.type==='vote');if(votes?.length)set(votes.some(e=>ROLE_MAP[e.roleAtTime]?.team==='demon')?'예':'아니오','boolean','기록된 투표 당시 캐릭터 기준 · 누락한 투표가 있으면 조정');else if(typeof state.day?.demonVoted==='boolean')set(state.day.demonVoted?'예':'아니오','boolean','낮 진행 기록 기준');else result.detail='지난 낮 투표 기록을 확인하고 예 / 아니오를 선택하세요.';break;}
    case 'towncrier': {const nominations=state.day?.events?.filter(e=>e.type==='nomination');if(nominations?.length)set(nominations.some(e=>ROLE_MAP[e.roleAtTime]?.team==='minion')?'예':'아니오','boolean','기록된 지목 당시 캐릭터 기준');else if(typeof state.day?.minionNominated==='boolean')set(state.day.minionNominated?'예':'아니오','boolean','낮 진행 기록 기준');else result.detail='지난 낮 지목 기록을 확인하고 예 / 아니오를 선택하세요.';break;}
    case 'juggler': {const guesses=state.day?.events?.filter(e=>e.type==='juggle'&&e.actorId===q.playerId);if(guesses?.length)set(guesses.filter(e=>e.correct).length,'number','추측 당시 캐릭터 기준');else if(Number.isInteger(state.day?.jugglerCorrect?.[q.playerId]))set(state.day.jugglerCorrect[q.playerId],'number','낮 진행 기록 기준');else result.detail='첫 낮의 추측 중 맞힌 수를 고르세요.';break;}
    case 'undertaker': {const executed=executionDeaths(state);if(executed.length){const players=executed.map(e=>state.players.find(p=>p.id===e.playerId));setCharacters(players,'지난 낮 처형으로 사망한 참가자');result.characterIds=[...new Set(executed.map(e=>e.roleId))];result.value=result.characterIds.map(id=>ROLE_MAP[id].ko).join(' · ');}else {result.value='없음';result.detail='지난 낮 처형 사망 없음 · 이번 밤 기상 없음';}break;}
    case 'eviltwin': if(targets.length===1)setCharacters(targets,'서로 알려줄 상대 쌍둥이의 캐릭터');break;
    default: result.caption='능력 처리';result.detail=targets.length?targets.map(p=>`${p.seat}번 ${ROLE_MAP[p.role]?.ko||''}`).join(' · '):'선택한 대상과 처리한 결과가 여기에 표시됩니다.';
  }
  const register=q.roleId==='chambermaid'?[]:relevant.filter(p=>['recluse','spy'].includes(p.role)&&healthy(state,p));
  if(register.length)result.exceptions.push(register.map(p=>`${p.seat}번 ${ROLE_MAP[p.role].ko}`).join(' · ')+' 감지 예외는 사회자가 결정합니다.');
  const vortox=state.players.some(p=>p.role==='vortox'&&p.alive&&!impairment(p,state).length);
  if(vortox&&LEARNS_INFO.includes(q.roleId)&&actor?.role!=='drunk')result.exceptions.push('보르톡스가 활동 중입니다. 마을주민에게 거짓 정보를 전달하세요.');
  result.canCopy=result.value!==null&&!result.impaired.length&&!result.exceptions.length&&!['dreamer','washerwoman','librarian','investigator'].includes(q.roleId)&&!(result.characterIds.length>1&&q.roleId!=='godfather');
  return result;
}
export function actionRelations(state) {
  return Object.entries(state.actions).flatMap(([key,a])=>{
    const [playerId,roleId]=key.split(':');
    if(a.skipped||!state.players.some(p=>p.id===playerId))return [];
    return (a.targets||[]).map(targetId=>({key,playerId,targetId,roleId,done:state.completed.includes(key)}));
  });
}
