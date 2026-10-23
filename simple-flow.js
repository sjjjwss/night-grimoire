import {ROLE_MAP,nightQueue} from './game.js';
import {abilityProfile,candidates,selectionResult,selectionError} from './abilities.js';
import {information,targetError,poCharged} from './information.js';
import {suggestedAction,renderSelection} from './storyteller.js';
import {chosenGoonState,mechanicError,renderMechanicControls,previousRecord} from './mechanics.js';
import {lifeResolution} from './life.js';
import {compactInstruction} from './guidance.js';
import {evilInfoSteps,infoStepIndex} from './evil-info.js';

const AUTO_CHARACTERS=new Set(['washerwoman','librarian','investigator','ravenkeeper','undertaker','grandmother','godfather']);
const OVERRIDABLE_AUTO=new Set(['mathematician','flowergirl','towncrier','juggler']);
const PAIR_INFORMATION=new Set(['washerwoman','librarian','investigator']);
const normalPair=(q,info,action)=>PAIR_INFORMATION.has(q.roleId)&&!info.impaired.length&&!info.exceptions.length&&action.choice!=='0';
const normalDreamer=(q,info)=>q.roleId==='dreamer'&&!info.impaired.length&&!info.exceptions.length;
export const roleLabel=p=>ROLE_MAP[p?.role]?.ko||'빈 자리';
export function resolvedAction(state,q,action={targets:[],result:'',note:''}){
  if(!q?.playerId)return action;
  if(state.completed.includes(q.key))return {...action};
  const pre=q.roleId==='chambermaid'?suggestedAction(state,q,{...action,result:'',choice:''}):action;
  const profile=abilityProfile(state,q,pre),info=information(chosenGoonState(state,q,pre),q,pre);
  const automatic=!info.impaired.length&&!info.exceptions.length&&!OVERRIDABLE_AUTO.has(q.roleId)&&(
    (['number','boolean'].includes(profile.kind)&&info.value!==null)||
    (AUTO_CHARACTERS.has(q.roleId)&&(info.characterIds?.length===1||q.roleId==='godfather'||info.value==='0'))
  );
  // Recalculate normal information from today's roles and targets, never a stale draft.
  const clearPair=normalPair(q,info,pre)&&(pre.characters||[]).some(id=>!info.characterIds.includes(id));
  return suggestedAction(state,q,automatic||clearPair?{...pre,result:'',choice:'',characters:[]}:pre);
}
export function nextEntry(state,previous){
  const remaining=nightQueue(state).filter(q=>!state.completed.includes(q.key));
  return remaining.find(q=>q.kind==='start'&&q.position<=(previous?.position??-1))||remaining.find(q=>q.position>=(previous?.position??-1))||remaining[0]||null;
}
export function simpleStep(state,q){
  const raw=state.actions[q.key]||{targets:[],result:'',note:''};
  const action=resolvedAction(state,q,raw),profile=abilityProfile(state,q,action);
  const info=information(chosenGoonState(state,q,action),q,action);
  const targetIssue=q.roleId==='librarian'&&action.choice==='0'?'':targetError(state,q,action.targets||[]);
  const automatic=!info.impaired.length&&!info.exceptions.length&&!targetIssue&&
    ((['number','boolean'].includes(profile.kind)&&info.value!==null)||
    (AUTO_CHARACTERS.has(q.roleId)&&!selectionError(state,q,action)));
  return {action,profile,info,automatic,targetIssue,result:selectionResult(state,q,action),
    error:selectionError(state,q,action)||mechanicError(state,q,action)};
}
function stepFollowup(state,q,m,esc){
  const actor=state.players.find(p=>p.id===q.playerId);
  const targets=(m.action.targets||[]).map(id=>state.players.find(p=>p.id===id)).filter(Boolean),t=targets[0];
  const charId=m.action.characters?.[0],charRole=ROLE_MAP[charId],bad=m.info.impaired.length>0;
  let extra='';
  if(ROLE_MAP[q.roleId]?.team==='demon'){
    const lunatics=state.players.filter(p=>p.role==='lunatic'&&p.alive);
    for(const l of lunatics){
      const la=state.actions?.[l.id+':lunatic'];
      if(la&&!la.skipped&&la.targets?.length){
        const lt=la.targets.map(id=>state.players.find(p=>p.id===id)).filter(Boolean).map(p=>p.seat+'번 '+roleLabel(p)).join(' · ');
        extra+='<div class="circle-followup">👁️ 광인('+esc(l.seat+'번')+')의 오늘 밤 선택: <b>'+esc(lt)+'</b> — 실제 악마에게 알려주세요.</div>';
      }
    }
  }
  if(q.roleId==='snakecharmer'&&t)return !bad&&ROLE_MAP[t.role]?.team==='demon'?'<div class="circle-followup alert">⚡ 악마('+esc(t.seat+'번 '+roleLabel(t))+') 지목! 완료 시 역할·진영이 즉시 교환되고 옛 악마는 중독됩니다. 뱀 조련사를 재운 뒤 '+esc(t.seat+'번')+'을 따로 깨워 뱀 조련사 토큰과 선한 진영을 알려주세요.</div>':'<div class="circle-followup">악마가 아닙니다. 고개를 저어 알리고 재우세요.</div>';
  if(q.roleId==='pithag'&&t&&charRole){
    if(bad)return '<div class="circle-followup">중독·취함 상태이므로 실제 캐릭터는 바뀌지 않습니다. 마녀 할멈만 재우세요.</div>';
    if(state.players.some(p=>p.role===charId))return '<div class="circle-followup">이미 등장 중인 캐릭터('+esc(charRole.ko)+')입니다 → 아무 변화 없음. 마녀 할멈만 재우세요.</div>';
    return '<div class="circle-followup alert">마녀 할멈을 재운 뒤 '+esc(t.seat+'번')+'을 따로 깨워 <b>'+esc(charRole.ko)+'</b> 토큰을 보여주세요 (진영 유지).'+(charRole.team==='demon'?'<br>⚡ 새 악마 생성! 아래에서 함께 사망할 참가자(기존 악마 등)를 선택할 수 있습니다.':'')+'</div>';
  }
  if(q.roleId==='cerenovus'&&t&&charRole)return '<div class="circle-followup">세레노부스를 재운 뒤 '+esc(t.seat+'번')+'을 따로 깨워 세레노부스 토큰과 <b>'+esc(charRole.ko)+'</b> 토큰을 보여주세요.</div>';
  if(q.roleId==='barber'&&targets.length===2)return '<div class="circle-followup alert">악마를 재운 뒤 '+esc(targets[0].seat+'번')+'에게 <b>'+esc(roleLabel(targets[1]))+'</b> 토큰을, '+esc(targets[1].seat+'번')+'에게 <b>'+esc(roleLabel(targets[0]))+'</b> 토큰을 각각 따로 깨워 보여주세요 (진영 유지).</div>';
  if(q.roleId==='eviltwin'&&t)return '<div class="circle-followup">두 쌍둥이('+esc((actor?.seat||'')+'번 · '+t.seat+'번')+')를 함께 깨워 눈을 맞추게 하고, 악한 쌍둥이에게 <b>'+esc(roleLabel(t))+'</b> 토큰을, 선한 쌍둥이에게 <b>사악한 쌍둥이</b> 토큰을 보여주세요.</div>';
  if(q.roleId==='philosopher'&&charRole){const dup=state.players.find(p=>p.role===charId&&p.id!==q.playerId);return '<div class="circle-followup">완료 시 <b>'+esc(charRole.ko)+'</b> 능력을 즉시 얻고 밤 순서에 반영됩니다'+(dup&&!bad?' (기존 '+esc(dup.seat+'번 '+charRole.ko)+' 자동 취함)':'')+'.</div>';}
  if(q.roleId==='fanggu'&&t&&!bad&&!state.fangGuJumpUsed&&ROLE_MAP[t.role]?.team==='outsider')return extra+'<div class="circle-followup alert">⚡ 첫 외지인('+esc(t.seat+'번 '+roleLabel(t))+') 공격! 완료 시 기존 팡 구가 사망하고 '+esc(t.seat+'번')+'이 악한 팡 구가 됩니다. '+esc(t.seat+'번')+'을 따로 깨워 팡 구 토큰과 악한 진영을 알려주세요.</div>';
  if(q.roleId==='vigormortis'&&t&&!bad&&ROLE_MAP[t.role]?.team==='minion')return extra+'<div class="circle-followup alert">⚡ 하수인('+esc(t.seat+'번 '+roleLabel(t))+') 살해! 사망 후에도 능력을 유지하며 마을주민 이웃 1명을 중독시킵니다.</div>';
  if(q.roleId==='sage'&&!bad&&!m.info.exceptions.length)return targets.length===1?'<div class="circle-followup">자신을 죽인 악마('+esc(t.seat+'번 '+roleLabel(t))+')가 자동 포함되었습니다. 함께 알려줄 다른 참가자 1명을 판에서 더 누르세요.</div>':targets.length===2?'<div class="circle-followup"><b>'+esc(m.result)+'</b> 두 사람을 현자에게 알려주고 재우세요.</div>':'';
  if(q.roleId==='exorcist'&&t)return !bad&&ROLE_MAP[t.role]?.team==='demon'?'<div class="circle-followup alert">⚡ 악마('+esc(t.seat+'번 '+roleLabel(t))+') 퇴마 성공! 퇴마사를 재운 뒤 '+esc(t.seat+'번')+'을 따로 깨워 <b>퇴마사</b> 토큰과 퇴마사 위치('+esc((actor?.seat||'')+'번')+')를 알려주고 재우세요. 오늘 밤 악마는 깨어나지 않습니다.</div>':'<div class="circle-followup">악마가 아니거나 능력이 무효이므로 퇴마사만 재우고 넘어갑니다.</div>';
  if(q.roleId==='courtier'&&charRole){
    if(bad)return '<div class="circle-followup">중독·취함 상태이므로 1회 능력만 소모되고 아무도 취하지 않습니다.</div>';
    const matches=state.players.filter(p=>p.role===charId);
    return matches.length?'<div class="circle-followup alert">완료 시 <b>'+esc(matches.map(p=>p.seat+'번 '+roleLabel(p)).join(' · '))+'</b>이(가) 3밤·3낮 동안 취합니다.</div>':'<div class="circle-followup">등장하지 않는 캐릭터('+esc(charRole.ko)+')입니다 → 1회 능력만 소모되고 아무도 취하지 않습니다.</div>';
  }
  if(q.roleId==='professor'&&t)return bad?'<div class="circle-followup">중독·취함 상태이므로 1회 능력만 소모되고 부활하지 않습니다.</div>':ROLE_MAP[t.role]?.team==='townsfolk'&&!t.alive?'<div class="circle-followup alert">⚡ 마을주민('+esc(t.seat+'번 '+roleLabel(t))+') 선택! 완료 시 즉시 부활하고 유령표와 1회 능력이 회복됩니다.</div>':'<div class="circle-followup">마을주민이 아닙니다('+esc(t.seat+'번 실제 역할: '+roleLabel(t))+') → 교수의 1회 능력만 소모되고 부활하지 않습니다.</div>';
  if(q.roleId==='gambler'&&t&&charRole)return bad?'<div class="circle-followup">중독·취함 상태이므로 추측이 틀려도 도박꾼이 죽지 않습니다.</div>':t.role===charId?'<div class="circle-followup">추측 성공! ('+esc(t.seat+'번 실제 역할: '+roleLabel(t))+') → 도박꾼이 생존합니다.</div>':'<div class="circle-followup alert">⚡ 추측 실패! ('+esc(t.seat+'번 실제 역할: '+roleLabel(t)+' ≠ 추측: '+charRole.ko)+') → 완료 시 도박꾼이 사망합니다.</div>';
  if(q.roleId==='gossip'){
    const c=m.action.choice||m.action.result;
    if(c==='참'){
      if(bad)return '<div class="circle-followup">중독·취함 상태이므로 소문이 참이어도 아무도 죽지 않습니다.</div>';
      if(!t)return '<div class="circle-followup alert">소문이 참입니다. 오늘 밤 사망할 참가자 1명을 판에서 누르세요.</div>';
    }
  }
  if(q.roleId==='lunatic'){
    const realDemon=state.players.find(p=>ROLE_MAP[p.role]?.team==='demon'&&p.alive);
    const chosen=targets.length?targets.map(p=>p.seat+'번 '+roleLabel(p)).join(' · '):'없음';
    return realDemon?'<div class="circle-followup">광인을 재운 뒤 실제 악마('+esc(realDemon.seat+'번 '+roleLabel(realDemon))+')에게 광인('+esc((actor?.seat||'')+'번')+')과 선택한 대상(<b>'+esc(chosen)+'</b>)을 알려주세요.</div>':'';
  }
  if(ROLE_MAP[q.roleId]?.team==='demon'){
    const lunatics=state.players.filter(p=>p.role==='lunatic'&&state.completed.includes(p.id+':lunatic'));
    for(const l of lunatics){
      const lTargets=(state.actions[l.id+':lunatic']?.targets||[]).map(id=>state.players.find(p=>p.id===id)).filter(Boolean);
      extra+='<div class="circle-followup">👁️ 광인('+esc(l.seat+'번')+')의 오늘 밤 선택 알리기: <b>'+esc(lTargets.length?lTargets.map(p=>p.seat+'번 '+roleLabel(p)).join(' · '):'기 모으기(선택 안 함)')+'</b></div>';
    }
  }
  if(q.roleId==='pukka'&&state.night>1){
    const prev=previousRecord(state,q),prevTarget=state.players.find(p=>p.id===prev?.action?.targets?.[0]);
    if(prevTarget)extra+='<div class="circle-followup">이전 중독 대상: <b>'+esc(prevTarget.seat+'번 '+roleLabel(prevTarget))+'</b> (이번 차례에 사망 판정 후 해독)</div>';
  }
  if(q.roleId==='po'){
    const charged=poCharged(state,q.playerId);
    if(!charged&&!targets.length)return extra+'<div class="circle-followup">대상을 고르지 않고 완료하면 오늘 밤 공격을 쉬고 충전합니다 (다음 행동 밤에 3명 공격).</div>';
    if(charged&&targets.length<3)return extra+'<div class="circle-followup alert">⚡ 지난 밤 충전됨! 서로 다른 3명을 골라야 합니다 ('+targets.length+'/3명 선택됨).</div>';
  }
  if(q.roleId==='shabaloth'&&m.action.regurgitate){
    const rev=state.players.find(p=>p.id===m.action.regurgitate);
    if(rev)extra+='<div class="circle-followup alert">⚡ 역류 부활: <b>'+esc(rev.seat+'번 '+roleLabel(rev))+'</b></div>';
  }
  if(['imp','pukka','shabaloth','po','zombuul','nodashii','vigormortis','vortox','fanggu','assassin','godfather','gossip','moonchild','tinker','grandmother'].includes(q.roleId)&&!m.targetIssue){
    const rawImpaired=actor?m.info.impaired.filter(s=>!s.includes('불한당')).length>0:false;
    const plan=lifeResolution(state,q,m.action,rawImpaired);
    if(plan){
      if(plan.goonTargets?.length){
        const goon=state.players.find(p=>p.id===plan.goonTargets[0]);
        if(goon)extra+='<div class="circle-followup alert">⚡ 불한당('+esc(goon.seat+'번')+') 첫 지목! '+esc((actor?.seat||'')+'번 '+roleLabel(actor))+'이(가) 즉시 취하고 불한당은 '+(actor?.alignment==='evil'?'악한':'선한')+' 진영이 됩니다'+(goon.alignment!==actor?.alignment?' (불한당을 깨워 바뀐 진영을 알려주세요)':'')+'.</div>';
      }
      if(plan.warnings?.length)extra+='<div class="circle-followup">'+plan.warnings.map(esc).join(' · ')+'</div>';
      const regDead=Object.entries(plan.outcomes||{}).filter(([,v])=>v==='registers-dead').map(([id])=>state.players.find(p=>p.id===id)).filter(Boolean);
      if(regDead.length)extra+='<div class="circle-followup alert">⚡ '+esc(regDead.map(p=>p.seat+'번 '+roleLabel(p)).join(' · '))+' · 첫 사망이므로 실제 생존하며 죽은 것으로만 감지됩니다.</div>';
    }
  }
  return extra;
}
export function renderCirclePrompt(state,q,helpers){
  const {esc,token,button}=helpers;
  if(!q)return '<span class="circle-kicker">오늘 밤 완료</span><strong class="circle-message">모두 재우세요</strong><p>사망·역할·상태 반영 완료</p>';
  if(q.kind==='info'){
    const steps=evilInfoSteps(state,q.roleId),index=infoStepIndex(state,q),step=steps[index];
    const lunatics=q.roleId==='demoninfo'?state.players.filter(p=>p.role==='lunatic'):[];
    const lunaticNote=lunatics.length?'<div class="circle-followup">👁️ 광인 위치 함께 알리기: '+lunatics.map(l=>esc(l.seat+'번 (알려준 악마: '+(ROLE_MAP[l.shownRole]?.ko||'악마')+')')).join(' · ')+'</div>':'';
    return '<strong class="circle-message">'+esc(step.title)+'</strong><p>'+esc(step.text)+'</p><strong class="circle-chosen">'+esc(step.players.map(roleLabel).join(' · '))+'</strong>'+(step.bluffs?'<div class="circle-bluffs">'+state.bluffs.map(id=>'<span>'+token(id)+'<b>'+esc(ROLE_MAP[id].ko)+'</b></span>').join('')+'</div>':'')+lunaticNote;
  }
  const m=simpleStep(state,q),r=ROLE_MAP[q.roleId],vortox=m.info.exceptions.some(t=>t.includes('보르톡스'));
  const bad=m.info.impaired.length>0,actor=state.players.find(p=>p.id===q.playerId);
  const roleTitle=actor?.role==='lunatic'&&ROLE_MAP[actor.shownRole]?`광인(${ROLE_MAP[actor.shownRole].ko})`:actor&&actor.role!==q.roleId&&ROLE_MAP[actor.role]?`${ROLE_MAP[actor.role].ko}(${r?.ko||'캐릭터'})`:(r?.ko||'캐릭터');
  const title=q.roleId==='pukka'&&m.profile.kind==='confirm'?'푸카는 깨우지 마세요':q.roleId==='barber'?'악마를 깨우세요':q.roleId==='sweetheart'?'취할 사람을 고르세요':q.roleId==='moonchild'?'달의 아이 사망 판정':q.roleId==='gossip'?'소문꾼 판정 · 깨우지 마세요':q.roleId==='tinker'?'땜장이 판정 · 깨우지 마세요':q.roleId==='grandmother'&&state.night>1&&q.reminderKind!=='first'?'할머니 사망 판정 · 깨우지 마세요':roleTitle+' 깨우세요';
  let content='';
  if(normalPair(q,m.info,m.action)){
    const people=m.action.targets.map(id=>state.players.find(p=>p.id===id)).filter(Boolean);
    const team={washerwoman:'마을주민',librarian:'외지인',investigator:'하수인'}[q.roleId];
    content=people.length!==2?'<p>판에서 두 명을 고르세요.</p>':'<div class="circle-pair">'+people.map(p=>button('choose-character',token(p.role)+'<b>'+esc(roleLabel(p))+'</b>','ghost pair-character '+(m.action.characters?.includes(p.role)?'selected':''),'data-role="'+p.role+'" aria-label="'+esc(roleLabel(p))+' 정보 선택" aria-pressed="'+!!m.action.characters?.includes(p.role)+'" '+(m.info.characterIds.includes(p.role)?'':'disabled'))).join('')+'</div><p>'+(m.result?esc(m.result)+' 알려주세요.':m.info.characterIds.length?'알려줄 '+team+'을 고르세요.':team+'을 포함해 다시 고르세요.')+'</p>';
  }else if(normalDreamer(q,m.info)&&m.action.targets.length===1){
    const chars=m.action.characters||[],actual=m.info.characterIds[0],actualGood=['townsfolk','outsider'].includes(ROLE_MAP[actual]?.team);
    content='<div class="circle-answer-roles">'+chars.map(id=>'<span>'+token(id)+'<b>'+esc(ROLE_MAP[id]?.ko||id)+'</b></span>').join('')+'</div><p>'+(chars.length===2?esc(m.result)+' 알려주고 재우세요':'실제 역할('+esc(ROLE_MAP[actual]?.ko||'')+') 자동 선택 · 아래에서 함께 알려줄 '+(actualGood?'악한':'선한')+' 캐릭터 1개를 고르세요.')+'</p>';
  }else if(m.automatic){
    const chars=m.action.characters||[];
    content=chars.length?'<div class="circle-answer-roles">'+chars.map(id=>'<span>'+token(id)+'<b>'+esc(ROLE_MAP[id].ko)+'</b></span>').join('')+'</div><p>알려주고 재우세요</p>':'<strong class="circle-answer">'+esc(m.action.choice==='0'?'0':m.result)+'</strong><p>알려주고 재우세요</p>'+(['mathematician','empath','chef','clockmaker'].includes(q.roleId)&&m.info.detail?'<small class="circle-truth">'+esc(m.info.detail)+'</small>':'');
  }else{
    content='<p class="circle-instruction">'+esc(compactInstruction(state,q).replace('깨우기 → ','').replace(' → 재우기',''))+'</p>';
    if(bad||vortox){
      content='<span class="circle-warning">'+(vortox?'거짓 정보 필수':m.info.impaired.some(t=>t.includes('중독'))?'중독 · 거짓 정보 가능':'취함 · 거짓 정보 가능')+'</span>'+content;
      if(m.info.value!==null&&m.info.caption!=='능력 처리')content+='<small class="circle-truth">정상 정보: '+esc(m.info.value)+'</small>';
    }else if(m.info.exceptions.length)content+='<span class="circle-warning">감지 예외 확인</span>';
    if(!m.targetIssue&&m.result&&!['targets','confirm'].includes(m.profile.kind))content+='<strong class="circle-chosen">'+esc(m.result)+'</strong>';
    content+=stepFollowup(state,q,m,esc);
  }
  return '<strong class="circle-message">'+esc(title)+'</strong>'+content;
}
export function renderCircleChoices(state,q,helpers){
  if(!q?.playerId)return '';
  const m=simpleStep(state,q),{esc,button,token}=helpers;
  let selection='';
  if(normalDreamer(q,m.info)&&m.action.targets.length===1&&m.info.characterIds.length===1){
    const actual=m.info.characterIds[0],actualGood=['townsfolk','outsider'].includes(ROLE_MAP[actual]?.team);
    const opposite=candidates(state,q,m.action).filter(id=>id!==actual&&(['townsfolk','outsider'].includes(ROLE_MAP[id]?.team)!==actualGood));
    selection='<div class="ability-choice"><span class="choice-label">함께 알려줄 '+(actualGood?'악한':'선한')+' 캐릭터 1개 선택</span><div class="answer-buttons dreamer-opposite-grid">'+opposite.map(id=>button('choose-character',token(id)+'<span>'+esc(ROLE_MAP[id].ko)+'</span>','answer-button role-chip '+(m.action.characters?.includes(id)?'selected':''),'data-role="'+id+'" aria-pressed="'+!!m.action.characters?.includes(id)+'"')).join('')+'</div></div>';
  }else if((!m.automatic||OVERRIDABLE_AUTO.has(q.roleId))&&!normalPair(q,m.info,m.action)){
    selection=renderSelection(state,q,m.action,helpers);
  }
  const wake=q.roleId==='chambermaid'&&m.action.targets.length===2?'<div class="simple-wake"><span>자신의 능력으로 깨어났나요?</span>'+m.action.targets.map(id=>{const p=state.players.find(t=>t.id===id);return '<div>'+helpers.token(p.role)+'<b>'+esc(roleLabel(p))+'</b>'+[true,false].map(v=>button('wake-fact',v?'예':'아니오','small '+(m.action.wakeFacts?.[id]===v?'primary':'ghost'),'data-player="'+id+'" data-value="'+v+'"')).join('')+'</div>';}).join('')+'</div>':'';
  return (selection||wake||renderMechanicControls(state,q,m.action,helpers))?'<section class="circle-choices">'+wake+selection+renderMechanicControls(state,q,m.action,helpers)+'</section>':'';
}
