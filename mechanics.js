import {ROLES,NIGHT_ORDER} from './data.js';
import {effectiveStatuses,townsfolkNeighbors} from './effects.js';
import {seatedPlayers} from './layout.js';
const roles=Object.fromEntries(ROLES.map(r=>[r.id,r]));
export const abilityOf=p=>p?.abilityRole||p?.role;
export const START_INFO=new Set(['washerwoman','librarian','investigator','chef','clockmaker','grandmother','godfather','eviltwin']);
export const label=p=>p?.name?.trim()||`${p?.seat}번 참가자`;
export function healthy(state,p){return !!p&&p.role!=='drunk'&&p.role!=='lunatic'&&!p.simulatedAbilityRole&&!effectiveStatuses(state,p).some(s=>/중독|취함/.test(s));}
export function working(state,p){return healthy(state,p)&&(p.alive||effectiveStatuses(state,p).includes('사망 후 능력 유지'));}
export function addEffect(state,{source,target,status,night=state.night,...options}){
  state.effects||=[];
  const effect={key:`${source.roleId}:${source.playerId}:${night}:${target}:${status}:${options.keySuffix||''}`,playerId:source.playerId,roleId:source.roleId,targetId:target,status,night,...options};
  state.effects=state.effects.filter(e=>e.key!==effect.key);state.effects.push(effect);return effect;
}
export function changeCharacter(state,p,roleId,{alignment=p.alignment,position=-1,noAttack=false,abilityOnly=false}={}){
  const oldAbility=abilityOf(p),oldAlignment=p.alignment;
  p.simulatedAbilityRole=null;
  if(abilityOnly){p.abilityRole=roleId;p.abilityUsed=false;}else{p.role=roleId;p.shownRole=null;p.abilityRole=null;p.used=false;p.abilityUsed=false;}
  p.alignment=alignment;p.roleStartedNight=state.night;p.changedAtPosition=position;p.changedNight=state.night;
  p.needsStartInfo=START_INFO.has(roleId);
  if(p.needsStartInfo)p.startVersion=(p.startVersion||0)+1;
  p.noAttackNight=noAttack?state.night:null;
  if(!abilityOnly&&oldAbility!==roleId){
    // These effects belong to the old ability, not the token's new owner.
    state.effects=(state.effects||[]).filter(e=>e.playerId!==p.id||e.unconditional);
    for(const target of state.players)for(const [status,e] of Object.entries(target.effectSources||{}))if(e.playerId===p.id&&e.roleId===oldAbility){target.statuses=target.statuses.filter(s=>s!==status);delete target.effectSources[status];}
  }
  if(roleId==='fortuneteller'&&!state.players.some(t=>t.statuses.includes('미끼')))state.pendingRedHerring=true;
  state.notifications||=[];state.notifications.push(`${label(p)}에게 변경 정보를 알려주세요: ${roles[roleId]?.ko}${alignment===oldAlignment?'':' · '+(alignment==='evil'?'악한':'선한')+' 진영'}`);
}
export function exorcised(state,p){
  return Object.entries(state.actions).some(([key,a])=>key.split(':')[1]==='exorcist'&&state.completed.includes(key)&&!a.skipped&&!a.baseline?.impaired?.length&&a.targets.includes(p.id)&&working(state,state.players.find(t=>t.id===key.split(':')[0])));
}
export function previousRecord(state,q){return [...(state.pastNights||[])].sort((a,b)=>b.night-a.night).map(n=>({night:n.night,action:n.actions[q.key],done:n.completed.includes(q.key)})).find(n=>n.done&&n.action&&!n.action.skipped);}
const PLAYER_CHOICES=new Set(['poisoner','monk','butler','fortuneteller','ravenkeeper','sailor','chambermaid','exorcist','innkeeper','gambler','professor','devilsadvocate','assassin','godfather','lunatic','snakecharmer','dreamer','seamstress','witch','cerenovus','pithag','imp','pukka','shabaloth','po','zombuul','nodashii','vigormortis','vortox','fanggu']);
export function triggerGoon(state,q,targetId){
  if(!PLAYER_CHOICES.has(q.roleId))return false;
  const target=state.players.find(p=>p.id===targetId),actor=state.players.find(p=>p.id===q.playerId);
  if(abilityOf(target)!=='goon'||!working(state,target)||target.goonNight===state.night||!actor||actor.role==='drunk'||actor.simulatedAbilityRole)return false;
  target.goonNight=state.night;target.alignment=actor.alignment;
  addEffect(state,{source:{playerId:target.id,roleId:'goon'},target:actor.id,status:'취함',throughNight:state.night,unconditional:true});
  return true;
}
export function chosenGoonState(state,q,a){const next=structuredClone(state);for(const id of a.targets||[])triggerGoon(next,q,id);return next;}
export function livingNeighbors(state,id){
  const order=seatedPlayers(state),index=order.findIndex(p=>p.id===id),found=[];
  for(const direction of [-1,1])for(let n=1;n<order.length;n++){const p=order[(index+direction*n+order.length)%order.length];if(p.alive&&!p.statuses.includes('죽은 것으로 감지')){if(!found.includes(p))found.push(p);break;}}
  return found;
}
export function deathPrevention(state,p,{demon=false,assassin=false,execution=false}={}){
  if(assassin)return '';
  if(demon&&abilityOf(p)==='soldier'&&working(state,p))return '군인';
  if(abilityOf(p)==='sailor'&&working(state,p))return '선원';
  for(const tea of state.players.filter(t=>abilityOf(t)==='tealady'&&working(state,t))){const neighbors=livingNeighbors(state,tea.id);if(neighbors.length===2&&neighbors.every(t=>t.alignment==='good')&&neighbors.includes(p))return '차부인';}
  const status=execution?'처형 보호':'보호',effect=p.effectSources?.[status],source=state.players.find(t=>t.id===effect?.playerId);
  if(p.statuses.includes(status)&&effect&&(effect.night===state.night||(execution&&state.phase==='between'&&effect.night===state.night-1))&&working(state,source)&&abilityOf(source)===effect.roleId&&(execution||effect.roleId==='innkeeper'||demon))return roles[effect.roleId].ko;
  if(abilityOf(p)==='fool'&&working(state,p)&&!(p.abilityRole?p.abilityUsed:p.used))return '바보';
  return '';
}
export function consumeFool(p){if(p.abilityRole)p.abilityUsed=true;else p.used=true;}
export function deathTriggers(state,p,{wasHealthy,livingBefore,cause,phase}){
  p.abilityAtDeath=abilityOf(p);p.healthyAtDeath=wasHealthy;
  if(roles[p.role]?.team==='demon'&&livingBefore>=5){
    const scarlet=state.players.find(t=>abilityOf(t)==='scarletwoman'&&t.alive&&working(state,t));
    if(scarlet){changeCharacter(state,scarlet,p.role,{noAttack:phase==='night'});state.notifications.push(`${label(scarlet)} · 주홍 여인 승계 → ${roles[p.role].ko} (악마 사망 당시 생존 ${livingBefore}명)`);}
  }
  if(p.abilityAtDeath==='sweetheart'&&wasHealthy)state.pendingSweethearts=[...new Set([...(state.pendingSweethearts||[]),p.id])];
  if(phase==='day'&&cause==='execution'){
    if(roles[p.role]?.team==='minion'){
      const minstrels=state.players.filter(t=>abilityOf(t)==='minstrel'&&working(state,t));
      for(const minstrel of minstrels)for(const target of state.players.filter(t=>t.id!==minstrel.id))addEffect(state,{source:{playerId:minstrel.id,roleId:'minstrel'},target:target.id,status:'취함',throughNight:state.night});
      if(minstrels.length)announce(state,'음유시인: 하수인 처형 사망으로 음유시인 외 전원 내일 해질녘까지 취함');
    }
    if(abilityOf(p)==='saint'&&wasHealthy)announce(state,'성자가 처형으로 사망: 악한 팀 승리');
    if(roles[p.role]?.team==='demon'&&!state.players.some(t=>t.alive&&roles[t.role]?.team==='demon')&&state.players.some(t=>abilityOf(t)==='mastermind'&&working(state,t))){state.mastermindNight=state.night;announce(state,'배후자: 다음 낮까지 계속 진행. 그 낮 처형된 사람의 진영이 패배합니다.');}
  }
  if(p.alignment==='good'&&cause==='execution')for(const pair of state.twins||[]){if(![pair.goodId,pair.evilId].includes(p.id))continue;const twin=state.players.find(t=>t.id===pair.evilId);if(abilityOf(twin)==='eviltwin'&&(twin.id===p.id?wasHealthy:working(state,twin)))announce(state,'선한 쌍둥이 처형: 악한 팀 승리');}
  if(roles[p.role]?.team==='demon'&&!state.players.some(t=>t.alive&&roles[t.role]?.team==='demon')){
    const activeTwin=(state.twins||[]).some(pair=>{const evil=state.players.find(t=>t.id===pair.evilId),good=state.players.find(t=>t.id===pair.goodId);return evil&&good?.alive&&abilityOf(evil)==='eviltwin'&&working(state,evil);});
    if(activeTwin)announce(state,'사악한 쌍둥이와 선한 쌍둥이가 모두 살아 있어 악마가 사망해도 게임이 계속됩니다.');
  }
}
export function reconcileTwins(state){
  state.twins=(state.twins||[]).filter(pair=>abilityOf(state.players.find(p=>p.id===pair.evilId))==='eviltwin');
  for(const pair of state.twins){const twin=state.players.find(p=>p.id===pair.evilId),other=state.players.find(p=>p.id===pair.goodId);if(working(state,twin)&&other&&twin.alignment===other.alignment){if(!twin.needsStartInfo)twin.startVersion=(twin.startVersion||0)+1;twin.needsStartInfo=true;announce(state,`${label(twin)} · 쌍둥이와 진영이 같아져 반대 진영 상대를 다시 정해야 합니다.`);}}
}
export function announce(state,text){state.notifications||=[];if(!state.notifications.includes(text))state.notifications.push(text);}
export function resolveSweetheart(state,id,target){
  const source=state.players.find(p=>p.id===id);if(!source||id===target||!state.players.some(p=>p.id===target))return;
  addEffect(state,{source:{playerId:id,roleId:'sweetheart'},target,status:'취함',survivesDeath:true,unconditional:true});
  state.pendingSweethearts=(state.pendingSweethearts||[]).filter(v=>v!==id);source.sweetheartTarget=target;
}
export function mechanicOptions(state,q,a){
  const actor=state.players.find(p=>p.id===q.playerId),targets=(a.targets||[]).map(id=>state.players.find(p=>p.id===id)).filter(Boolean),options=[];
  if(!actor||state.actions[q.key]?.mechanicsApplied)return options;
  const simulated=chosenGoonState(state,q,a),normal=healthy(simulated,simulated.players.find(p=>p.id===actor.id));
  const add=(field,title,people,optional=false)=>options.push({field,title,people:people.filter(Boolean),optional});
  if(normal&&['sailor','innkeeper'].includes(q.roleId)&&targets.length)add('drunkTarget','사회자 선택 · 취할 사람',q.roleId==='sailor'?[...new Set([actor,...targets])]:targets);
  if(normal&&q.roleId==='courtier'&&(a.characters||[]).length){const matching=state.players.filter(p=>p.role===a.characters[0]);if(matching.length>1)add('drunkTarget','같은 캐릭터 중 취할 사람',matching);}
  if(normal&&q.roleId==='imp'&&targets.includes(actor)&&!state.players.some(p=>abilityOf(p)==='scarletwoman'&&working(state,p)&&state.players.filter(t=>t.alive).length>=5))add('successor','자살 성공 시 새 임프',state.players.filter(p=>p.alive&&roles[p.role]?.team==='minion'));
  if(normal&&q.roleId==='vigormortis'&&targets[0]&&roles[targets[0].role]?.team==='minion'&&!deathPrevention(simulated,simulated.players.find(p=>p.id===targets[0].id),{demon:true}))add('poisonNeighbor','하수인 사망 시 중독시킬 이웃',townsfolkNeighbors(state,targets[0].id).map(id=>state.players.find(p=>p.id===id)));
  if(normal&&q.roleId==='pithag'&&targets[0]&&a.characters?.[0]&&roles[a.characters[0]]?.team==='demon'&&!state.players.some(p=>p.role===a.characters[0]))add('arbitraryDeath','새 악마 생성 · 함께 사망 처리할 참가자 (선택 사항)',state.players.filter(p=>p.alive),true);
  if(normal&&q.roleId==='shabaloth'){const previous=previousRecord(state,q);if(previous?.night===state.night-1)add('regurgitate','역류 · 지난 밤 대상 중 부활',state.players.filter(p=>!p.alive&&previous.action.targets.includes(p.id)),true);}
  if(normal&&q.roleId==='barber'&&state.players.filter(p=>roles[p.role]?.team==='demon'&&p.alive).length>1)add('barberDemon','교환을 선택하는 악마',state.players.filter(p=>roles[p.role]?.team==='demon'&&p.alive));
  const deathTargets=q.roleId==='pukka'?(previousRecord(state,q)?.action.targets||[]).map(id=>state.players.find(p=>p.id===id)):targets;
  if(normal&&['imp','pukka','shabaloth','po','zombuul','nodashii','vortox','vigormortis','fanggu','godfather','gossip'].includes(q.roleId)&&deathTargets.some(p=>abilityOf(p)==='mayor'&&working(state,p)))add('mayorRedirect','시장 · 대신 죽일 사람 (선택 사항)',state.players.filter(p=>p.alive&&abilityOf(p)!=='mayor'),true);
  return options.filter(o=>o.people.length);
}
export function mechanicError(state,q,a){
  if(state.actions[q.key]?.mechanicsApplied)return '이미 반영한 행동입니다. 변경하려면 상단 되돌리기로 취소하세요.';
  for(const option of mechanicOptions(state,q,a))if(!option.optional&&!option.people.some(p=>p.id===a[option.field]))return option.title+'을 고르세요.';
  for(const option of mechanicOptions(state,q,a))if(a[option.field]&&!option.people.some(p=>p.id===a[option.field]))return option.title+'을 다시 고르세요.';
  if(q.roleId==='eviltwin'){const actor=state.players.find(p=>p.id===q.playerId),target=state.players.find(p=>p.id===a.targets?.[0]);if(target&&actor.alignment===target.alignment&&healthy(state,actor))return '반대 진영의 쌍둥이를 고르세요.';}
  if(q.roleId==='barber'&&a.barberDemon&&(a.targets||[]).some(id=>{const p=state.players.find(p=>p.id===id);return roles[p?.role]?.team==='demon'&&id!==a.barberDemon;}))return '선택하는 악마 이외의 악마는 교환할 수 없습니다.';
  if(q.roleId==='gossip'&&(a.choice||a.result)==='참'&&healthy(state,state.players.find(p=>p.id===q.playerId))&&a.targets?.length!==1)return '참인 소문으로 죽일 사람 1명을 고르세요.';
  return '';
}
const AUTOMATED=new Set(['snakecharmer','pithag','barber','philosopher','sweetheart','sailor','innkeeper','courtier','eviltwin','imp','fanggu','vigormortis','shabaloth']);
export function applyMechanics(state,q,a,{normal,actorRole,actorAlignment}={}){
  const actor=state.players.find(p=>p.id===q.playerId),targets=(a.targets||[]).map(id=>state.players.find(p=>p.id===id)).filter(Boolean),target=targets[0];
  if(!actor)return;
  const source={playerId:actor.id,roleId:q.roleId},position=q.position??(state.night===1?NIGHT_ORDER.firstNight:NIGHT_ORDER.otherNight).indexOf(q.roleId);
  const changes=[];
  if(q.roleId==='grandmother'&&target&&actor.role!=='drunk')actor.grandchildId=target.id;
  if(a.goonTriggered){const goon=targets.find(t=>abilityOf(t)==='goon'&&t.goonNight===state.night);if(goon)changes.push(`${label(goon)} 불한당 발동 → ${label(actor)} 취함 · 불한당 ${goon.alignment==='evil'?'악한':'선한'} 진영`);}
  if(!normal&&q.roleId==='philosopher'&&a.characters?.[0]){actor.simulatedAbilityRole=a.characters[0];actor.abilityUsed=false;actor.needsStartInfo=START_INFO.has(a.characters[0]);actor.roleStartedNight=state.night;changes.push(`${label(actor)} · 실제 능력 획득 실패. ${roles[a.characters[0]].ko} 차례에서는 가짜 능력으로 진행`);}
  if(normal){
    if(q.roleId==='snakecharmer'&&target&&roles[target.role]?.team==='demon'){
      const demonRole=target.role,demonAlignment=target.alignment;
      changeCharacter(state,target,actorRole,{alignment:actorAlignment,position});
      changeCharacter(state,actor,demonRole,{alignment:demonAlignment,position});
      addEffect(state,{source,target:target.id,status:'중독',unconditional:true});
      changes.push(`${label(actor)} → ${roles[demonRole].ko} · ${demonAlignment==='evil'?'악':'선'}, ${label(target)} → ${roles[actorRole].ko} · ${actorAlignment==='evil'?'악':'선'} · 중독`);
    }
    if(q.roleId==='pithag'&&target&&a.characters?.[0]){
      const roleId=a.characters[0];
      if(state.players.some(p=>p.role===roleId))changes.push('이미 등장한 캐릭터: 변화 없음');
      else{
        changeCharacter(state,target,roleId,{position});changes.push(`${label(target)} → ${roles[roleId].ko} · 진영 유지`);
        if(roles[roleId].team==='demon'){
          state.arbitraryDeathsNight=state.night;
          if(a.arbitraryDeath){
            const victim=state.players.find(p=>p.id===a.arbitraryDeath);
            if(victim?.alive){
              const wasHealthy=healthy(state,victim),livingBefore=state.players.filter(t=>t.alive).length;
              victim.alive=false;victim.deathPhase='night';victim.diedNight=state.night;victim.deathCause='ability';victim.deathSource=actor.id;victim.roleAtDeath=victim.role;
              deathTriggers(state,victim,{wasHealthy,livingBefore,cause:'ability',phase:'night'});
              changes.push(`${label(victim)} · 새 악마 생성에 따른 밤 사망`);
            }
          }
          announce(state,'마녀의 구덩이가 악마를 만들었습니다. 이번 밤 실제 사망자는 사망 결과에서 사회자가 선택하세요.');
        }
      }
    }
    if(q.roleId==='barber'&&targets.length===2){const [one,two]=targets,first=one.role,second=two.role;changeCharacter(state,one,second,{position});changeCharacter(state,two,first,{position});changes.push(`${label(one)} ↔ ${label(two)} 캐릭터 교환 · 진영 유지`);}
    if(q.roleId==='philosopher'&&a.characters?.[0]){changeCharacter(state,actor,a.characters[0],{position,abilityOnly:true});changes.push(`${roles[a.characters[0]].ko} 능력 획득 · 기존 동일 캐릭터 취함`);}
    if(q.roleId==='sweetheart'&&target){resolveSweetheart(state,actor.id,target.id);changes.push(`${label(target)} · 지속 취함`);}
    if(['sailor','innkeeper'].includes(q.roleId)&&a.drunkTarget){addEffect(state,{source,target:a.drunkTarget,status:'취함',throughNight:state.night});changes.push(`${label(state.players.find(p=>p.id===a.drunkTarget))} · 취함 (다음 밤 해제)`);}
    if(q.roleId==='courtier'){const matches=state.players.filter(p=>p.role===a.characters?.[0]),target=matches.find(p=>p.id===a.drunkTarget)||matches[0];if(target){addEffect(state,{source,target:target.id,status:'취함',throughNight:state.night+2});changes.push(`${label(target)} · ${state.night+2}번째 밤 이후 낮까지 취함`);}else if(a.characters?.[0]){changes.push(`${roles[a.characters[0]]?.ko||'선택 캐릭터'} 미등장 · 1회 능력만 소모`);}}
    if(q.roleId==='exorcist'&&target&&roles[target.role]?.team==='demon')changes.push(`${label(target)} 퇴마됨 · 깨워서 퇴마사(${label(actor)})를 알리고 오늘 밤 행동 생략`);
    if(q.roleId==='eviltwin'&&target){state.twins||=[];state.twins=state.twins.filter(p=>p.evilId!==actor.id);state.twins.push({evilId:actor.id,goodId:target.id});changes.push(`${label(actor)} ↔ ${label(target)} 쌍둥이 연결`);}
    if(q.roleId==='imp'&&!actor.alive&&targets.includes(actor)&&actor.deathSource===actor.id&&a.successor&&!state.players.some(p=>p.alive&&p.role==='imp')){const next=state.players.find(p=>p.id===a.successor);if(next?.alive&&roles[next.role]?.team==='minion'){changeCharacter(state,next,'imp',{position,noAttack:true});changes.push(`${label(next)} → 임프 · 오늘 밤 재공격 없음`);}}
    if(q.roleId==='fanggu'&&a.fangGuJump&&!actor.alive){const recipient=state.players.find(p=>p.id===(a.fangGuTarget||target?.id));if(recipient?.alive){changeCharacter(state,recipient,'fanggu',{alignment:'evil',position,noAttack:true});state.fangGuJumpUsed=true;changes.push(`${label(recipient)} → 악한 팡 구 · 게임 중 이동 사용 완료`);}}
    if(q.roleId==='vigormortis'&&target&&!target.alive&&roles[target.role]?.team==='minion'&&target.deathSource===actor.id){addEffect(state,{source,target:target.id,status:'사망 후 능력 유지',heldMinionId:target.id});if(a.poisonNeighbor)addEffect(state,{source,target:a.poisonNeighbor,status:'중독',heldMinionId:target.id,keySuffix:target.id});changes.push(`${label(target)} · 하수인 능력 유지`);}
    if(q.roleId==='butler'&&target)actor.butlerMaster=target.id;
    if(q.roleId==='cerenovus'&&target)changes.push(`${label(target)}에게 ${roles[a.characters?.[0]]?.ko} 주장 요구를 알려주세요.`);
  }
  if((AUTOMATED.has(q.roleId)&&!['imp','fanggu','vigormortis','shabaloth'].includes(q.roleId))||changes.length||a.goonTriggered){a.mechanicsApplied=true;a.mechanicSummary=changes.length?changes:[normal?'선택을 반영했습니다.':'중독·취함으로 실제 효과 없음'];}
  for(const text of changes)announce(state,text);
}
export function renderMechanicControls(state,q,a,{button,esc,token}){
  const saved=state.actions[q.key];
  if(saved?.mechanicsApplied)return '<div class="mechanic-applied">'+(saved.mechanicSummary||[]).map(esc).join('<br>')+'</div>';
  const options=mechanicOptions(state,q,a);
  return options.map(o=>'<div class="mechanic-choice"><span class="choice-label">'+esc(o.title)+'</span><div class="mechanic-people">'+(o.optional?button('mechanic-choice','선택 안 함','ghost small '+(!a[o.field]?'selected':''),'data-field="'+o.field+'" data-player=""'):'')+o.people.map(p=>button('mechanic-choice',token(p.role)+'<span>'+esc(label(p))+'</span>','ghost small '+(a[o.field]===p.id?'selected':''),'data-field="'+o.field+'" data-player="'+p.id+'" aria-pressed="'+(a[o.field]===p.id)+'"')).join('')+'</div></div>').join('');
}
