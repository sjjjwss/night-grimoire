import {ROLE_MAP,TEAMS} from './game.js';
import {effectiveStatuses,effectSources,poisonEffects} from './effects.js';
import {information,targetRule,wokeTonightDueToAbility} from './information.js';
import {abilityProfile,candidates,selectionResult} from './abilities.js';
import {participantLabel,renderStorytellerSteps} from './guidance.js';
import {renderMechanicControls,chosenGoonState,mechanicOptions} from './mechanics.js';

export function selectedCharacters(action){
  if(action.characters?.length)return action.characters.filter(id=>ROLE_MAP[id]);
  return Object.values(ROLE_MAP).filter(r=>r.ko===action.result||r.name===action.result).map(r=>r.id);
}
export function suggestedAction(state,q,action){
  const next={...action,characters:selectedCharacters(action)};
  if(q.roleId==='moonchild'){const choice=state.players.find(p=>p.id===q.playerId)?.moonchildChoice;if(choice&&!next.targets?.length)next.targets=[choice.targetId];}
  if(q.roleId==='gossip'&&!next.choice&&!next.result&&state.day?.gossipChoice?.[q.playerId])next.choice=state.day.gossipChoice[q.playerId];
  if(q.roleId==='chambermaid'&&next.targets?.length===2){
    next.wakeFacts={...next.wakeFacts};
    for(const id of next.targets)if(typeof next.wakeFacts[id]!=='boolean')next.wakeFacts[id]=wokeTonightDueToAbility(state,id);
  }
  const info=information(state,q,next),profile=abilityProfile(state,q,next);
  const normal=!information(chosenGoonState(state,q,next),q,next).impaired.length&&!info.impaired.length&&!info.exceptions.length;
  if(normal&&q.roleId==='sailor'&&next.targets?.length===1&&next.targets[0]===q.playerId&&!next.drunkTarget)next.drunkTarget=q.playerId;
  if(normal&&q.roleId==='sage'&&!(next.targets?.length)){
    const actor=state.players.find(p=>p.id===q.playerId),killer=state.players.find(p=>p.id===actor?.deathSource)||state.players.find(p=>ROLE_MAP[p.role]?.team==='demon'&&p.alive);
    if(killer&&killer.id!==q.playerId)next.targets=[killer.id];
  }
  if(normal&&q.roleId==='vigormortis'&&!next.poisonNeighbor&&next.targets?.length===1){
    const opt=mechanicOptions(state,q,next).find(o=>o.field==='poisonNeighbor');
    if(opt?.people.length===1)next.poisonNeighbor=opt.people[0].id;
  }
  if(normal&&q.roleId==='dreamer'&&next.targets?.length===1&&info.characterIds?.length===1){
    const actual=info.characterIds[0],actualGood=['townsfolk','outsider'].includes(ROLE_MAP[actual]?.team);
    const other=next.characters.find(id=>id!==actual&&(['townsfolk','outsider'].includes(ROLE_MAP[id]?.team)!==actualGood));
    next.characters=other?[actual,other]:[actual];
    return next;
  }
  if(next.result||next.choice||next.characters.length)return next;
  if(!normal)return next;
  if(['number','boolean'].includes(profile.kind)&&info.value!==null)next.result=info.value;
  if(profile.kind==='character'&&info.characterIds?.length===1&&['washerwoman','librarian','investigator','ravenkeeper','undertaker','grandmother'].includes(q.roleId))next.characters=[...info.characterIds];
  if(q.roleId==='godfather'&&(state.night===1||q.reminderKind==='first')&&info.characterIds)next.characters=[...info.characterIds];
  if(q.roleId==='librarian'&&info.value==='0')next.choice='0';
  return next;
}
function roleTile(id,helpers,options={}){
  const {token,esc}=helpers,r=ROLE_MAP[id];if(!r)return '';
  return '<button type="button" class="character-tile '+(options.selected?'selected ':'')+(options.recommended?'recommended ':'')+'" data-action="'+(options.action||'choose-character')+'" data-role="'+id+'" aria-pressed="'+!!options.selected+'" aria-label="'+esc(r.ko)+' 선택">'+token(id)+'<span>'+esc(r.ko)+'</span>'+(options.recommended?'<small>정상 정보</small>':options.badge?'<small>'+esc(options.badge)+'</small>':'')+'</button>';
}
function chosenTiles(ids,helpers){return ids.map(id=>'<span class="chosen-character">'+helpers.token(id)+'<b>'+helpers.esc(ROLE_MAP[id].ko)+'</b></span>').join('');}
function numberLabel(id){return ({empath:'알려줄 숫자',chef:'알려줄 쌍의 수',clockmaker:'알려줄 거리',oracle:'알려줄 악한 사망자 수',mathematician:'비정상 작동 인원',chambermaid:'알려줄 기상 인원',juggler:'맞힌 추측 수'})[id]||'알려줄 숫자';}
function namedText(state,text){return String(text).replace(/(\d+)번/g,(match,seat)=>{const p=state.players.find(p=>p.seat===Number(seat));return p?.name?.trim()||match;});}

export function renderImpairmentNotice(state,p,helpers){
  if(p.simulatedAbilityRole)return '<div class="impairment-callout"><strong>능력 미획득 · 실제 효과 없음</strong><span>능력을 얻은 것처럼 진행하며 정보는 사회자가 정합니다.</span></div>';
  const bad=impairmentForNotice(state,p);
  if(!bad.length)return '';
  const poisoned=bad.some(value=>value.includes('중독')),sources=effectSources(state,p,poisoned?'중독':'취함');
  const origin=sources.map(source=>{const from=state.players.find(player=>player.id===source.playerId);return (from?(from.name?.trim()||from.seat+'번')+' ':'')+(ROLE_MAP[source.roleId]?.ko||'상태 지정')+(source.roleId==='poisoner'?' · 오늘 밤과 다음 낮':source.roleId==='pukka'?' · 푸카의 중독':source.roleId==='nodashii'?' · 마을주민 이웃':'');}).join(' / ');
  return '<div class="impairment-callout" role="note"><strong>'+(poisoned?'중독':'취함')+' 상태 · 거짓 정보를 줘도 됩니다</strong>'+(origin?'<span class="impairment-origin">'+helpers.esc(origin)+'</span>':'')+'<p>정보를 얻는 능력이라면 참·거짓 정보를 선택할 수 있습니다. 정상 정보는 참고용이며, 실제 능력 효과는 적용되지 않습니다.</p></div>';
}
function impairmentForNotice(state,p){return [...effectiveStatuses(state,p).filter(value=>/중독|취함/.test(value)),...(p.role==='drunk'?['취함']:[])];}

export function renderAbilityInspector(state,q,action,helpers){
  const {token,esc,button,icon}=helpers,p=state.players.find(p=>p.id===q.playerId),r=ROLE_MAP[q.roleId];
  if(!p)return '';
  const info=information(state,q,action),profile=abilityProfile(state,q,action),suggested=suggestedAction(state,q,action),chosen=selectedCharacters(suggested);
  const status=[...new Set([...info.impaired,...effectiveStatuses(state,p),...(!p.alive?['사망']:[])])];
  const statuses=status.map(s=>'<span class="effect-chip '+(/중독|취함/.test(s)?'impaired':'')+'">'+esc(s)+(effectSources(state,p,s).length?' · '+effectSources(state,p,s).map(source=>esc(participantLabel(state.players.find(t=>t.id===source.playerId)))).join(' · '):'')+'</span>').join('');
  let normal='';
  if(info.characterIds?.length)normal='<div class="normal-role-tokens">'+info.characterIds.map(id=>roleTile(id,helpers,{action:'choose-character',recommended:true,selected:chosen.includes(id)})).join('')+'</div>';
  else if(info.value!==null&&info.caption!=='능력 처리')normal='<strong class="normal-value '+(info.type==='number'?'numeric':'')+'">'+esc(namedText(state,info.value))+'</strong>';
  const inactive=q.kind==='inspect'||profile.kind==='passive'||state.actions[q.key]?.mechanicsApplied;
  return '<div class="ability-inspector storyteller-inspector"><div class="ability-heading"><div class="inspector-token">'+token(q.roleId)+'</div><div class="ability-heading-copy"><span class="eyebrow">'+esc(participantLabel(p))+(q.kind==='conditional'?' · 조건부':'')+'</span><h2>'+esc(r?.ko||'캐릭터')+'</h2></div>'+button('seat',icon('settings'),'ghost small','data-player="'+p.id+'" aria-label="'+esc(participantLabel(p))+' 상태 관리"')+'</div>'+(statuses?'<div class="ability-status">'+statuses+'</div>':'')+renderImpairmentNotice(state,p,helpers)+renderStorytellerSteps(state,q,action,esc)+(normal?'<div class="truth-strip"><span class="truth-label">정상 정보</span>'+normal+'</div>':'')+(info.exceptions.length?'<details class="rules-exceptions"><summary>판정 확인 '+info.exceptions.length+'</summary>'+info.exceptions.map(v=>'<p>'+esc(namedText(state,v))+'</p>').join('')+'</details>':'')+(inactive?'<div class="passive-note">'+(state.actions[q.key]?.mechanicsApplied?'반영 완료':'이번 밤 기상 없음')+'</div>':renderSelection(state,q,action,helpers))+(!inactive?renderMechanicControls(state,q,action,helpers):'')+'<details class="ability-rule-details"><summary>캐릭터 능력 설명</summary><p class="ability-description">'+esc(r?.summary||'')+'</p></details></div>';
}

export function renderSelection(state,q,action,helpers){
  const {esc,button}=helpers,profile=abilityProfile(state,q,action),suggested=suggestedAction(state,q,action),chosen=selectedCharacters(suggested),value=selectionResult(state,q,suggested);
  const info=information(state,q,action);
  if(profile.kind==='number'||profile.kind==='boolean')return '<div class="ability-choice"><span class="choice-label">'+esc(profile.kind==='number'?numberLabel(q.roleId):profile.label)+'</span><div class="answer-buttons">'+(profile.choices||[]).map(v=>button('set-result',esc(v),'answer-button '+(value===v?'selected':'')+(info.value===v?' recommended':''),'data-value="'+esc(v)+'" aria-pressed="'+(value===v)+'"')).join('')+'</div></div>';
  if(['character','pair','characters'].includes(profile.kind))return '<div class="ability-choice character-answer-row"><span class="choice-label">'+esc(profile.characterLabel||profile.label)+'</span>'+button('character-picker',chosen.length?chosenTiles(chosen,helpers)+'<span class="change-hint">변경</span>':'캐릭터 선택','ghost selected-characters-button')+(profile.choices?.length?'<div class="answer-buttons compact">'+profile.choices.map(v=>button('set-choice',v==='0'?'0명':esc(v),'answer-button '+(suggested.choice===v?'selected':''),'data-value="'+esc(v)+'" aria-label="'+(v==='0'?'외지인 없음 · 0':esc(v))+'"')).join('')+'</div>':'')+(action.result&&!chosen.length&&!action.choice?'<span class="legacy-value">이전 기록: '+esc(action.result)+'</span>':'')+'</div>';

  if(profile.kind==='confirm'&&(profile.choices?.length||0)<2)return '';
  if(profile.kind==='confirm')return '<div class="ability-choice"><span class="choice-label">'+esc(profile.label)+'</span><div class="answer-buttons">'+(profile.choices||['확인']).map(v=>button('set-choice',esc(v),'answer-button '+((suggested.choice||action.choice||action.result)===v?'selected':''),'data-value="'+esc(v)+'"')).join('')+'</div></div>';
  return '';
}

export function renderAbilityPicker(state,q,action,helpers,filter='all'){
  const {esc,button}=helpers,profile=abilityProfile(state,q,action),info=information(state,q,action),selected=selectedCharacters(action);
  const allowed=candidates(state,q,action),teams=Object.keys(TEAMS).filter(t=>allowed.some(id=>ROLE_MAP[id].team===t));
  const badgeFor=id=>{const inPlay=state.players.some(p=>p.role===id);return inPlay?(q.roleId==='pithag'?'등장 중 · 무효':q.roleId==='philosopher'?'등장 중 · 기존 취함':'등장 중'):'';};
  return '<div class="picker-caption">'+esc(profile.kind==='pair'?'선한 캐릭터 1개 + 악한 캐릭터 1개':profile.characterLabel||profile.label)+'</div><div class="picker-selection">'+chosenTiles(selected,helpers)+(selected.length?'':'<span class="subtle">선택한 캐릭터</span>')+'</div><div class="picker-tabs">'+[['all','전체'],...teams.map(t=>[t,TEAMS[t]])].map(([id,name])=>button('ability-filter',esc(name),'small '+(filter===id?'primary':'ghost'),'data-filter="'+id+'"')).join('')+'</div><div class="character-picker-grid">'+allowed.filter(id=>filter==='all'||ROLE_MAP[id].team===filter).map(id=>roleTile(id,helpers,{selected:selected.includes(id),recommended:info.characterIds?.includes(id),badge:badgeFor(id)})).join('')+'</div>';
}

export function renderTargetSummary(state,q,action,helpers){
  const {esc,token}=helpers,rule=targetRule(q.roleId,q.reminderKind==='first'?1:state.night),profile=abilityProfile(state,q,action);
  if(!q.playerId||q.kind==='inspect'||profile.kind==='passive'||rule.max===0||(q.roleId==='lunatic'&&profile.kind==='confirm')||(q.roleId==='godfather'&&(state.night===1||q.reminderKind==='first'))||(q.roleId==='librarian'&&suggestedAction(state,q,action).choice==='0'))return '';
  return '<div class="ability-targets"><span class="choice-label">'+esc(profile.targetLabel||rule.label)+'</span><div class="target-pills">'+(action.targets||[]).map(id=>{const p=state.players.find(t=>t.id===id);if(!p)return '';return '<button class="target-pill" data-action="target" data-player="'+id+'" aria-label="'+esc(participantLabel(p))+' 선택 취소">'+token(p.role)+'<b>'+esc(participantLabel(p))+'</b><span>'+esc(ROLE_MAP[p.role]?.ko||'')+'</span><span aria-hidden="true">×</span></button>';}).join('')+(action.targets?.length?'':'<span class="subtle">아래 그리모어에서 해당 사람을 누르세요.</span>')+'</div></div>';
}

export function renderEffectControls(state,q,action,helpers){
  const {button,esc}=helpers,ids=action.targets||[],role=q.roleId;
  if(!ids.length&&role!=='courtier'&&role!=='philosopher')return '';
  if(['poisoner','pukka'].includes(role)){
    const actor=state.players.find(player=>player.id===q.playerId),blocked=state.actions[q.key]?.poisonApplied===false||(impairmentForNotice(state,actor).length&&!state.completed.includes(q.key));
    const applied=ids.every(id=>poisonEffects(state,state.players.find(player=>player.id===id)).some(effect=>effect.playerId===q.playerId));
    return '<div class="automatic-effect-hint '+(blocked?'blocked':'')+'">'+(blocked?'중독·취함 상태이므로 중독 효과가 적용되지 않습니다.':ids.map(id=>esc(participantLabel(state.players.find(player=>player.id===id)))).join(' · ')+(applied?' · 중독 적용됨':' · 완료하면 중독 표시'))+'</div>';
  }
  const effect=({monk:'보호',devilsadvocate:'처형 보호',witch:'저주',sweetheart:'취함',cerenovus:'광기',innkeeper:'보호'})[role];
  let controls=effect?button('apply-effect',effect+' 적용','ghost small','data-effect="'+effect+'"'):'';
  if(role==='sailor')controls=[...new Set([q.playerId,...ids])].map(id=>button('apply-effect',esc(participantLabel(state.players.find(p=>p.id===id)))+' 취함','ghost small','data-effect="취함" data-target="'+id+'"')).join('');
  if(role==='innkeeper')controls+=ids.map(id=>button('apply-effect',esc(participantLabel(state.players.find(p=>p.id===id)))+' 취함','ghost small','data-effect="취함" data-target="'+id+'"')).join('');
  if(['pithag','philosopher','courtier','barber','snakecharmer','professor','imp','pukka','zombuul','shabaloth','po','nodashii','vigormortis','vortox','fanggu','assassin','godfather','gossip','moonchild'].includes(role)){
    const players=[...new Set([...(role==='philosopher'?[q.playerId]:[]),...ids])];
    controls+=players.map(id=>button('seat',esc(participantLabel(state.players.find(p=>p.id===id)))+' 상태 변경','ghost small','data-player="'+id+'"')).join('');
  }
  return controls?'<details class="state-actions"><summary>그리모어에 반영</summary><div>'+controls+'</div><small>능력의 실제 효과를 확인하고 상태 변경</small></details>':'';
}
