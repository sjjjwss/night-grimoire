import {ROLES} from './data.js';
import {setLife,recordExecution} from './life.js';
import {abilityOf,working,healthy,deathPrevention,consumeFool,announce,label} from './mechanics.js';
import {effectiveStatuses} from './effects.js';
const roles=Object.fromEntries(ROLES.map(r=>[r.id,r]));
export const dayRole=p=>p?.abilityRole||p?.simulatedAbilityRole||(p?.role==='drunk'&&p?.shownRole?p.shownRole:p?.role);
const isUsed=p=>(p?.abilityRole||p?.simulatedAbilityRole)?!!p.abilityUsed:!!p?.used;
const markUsed=p=>{if(p?.abilityRole||p?.simulatedAbilityRole)p.abilityUsed=true;else if(p)p.used=true;};
function day(state){if(state.day?.night!==state.night)state.day={night:state.night,execution:null};state.day.events||=[];return state.day;}
function kill(state,p,cause='ability'){
  const protection=deathPrevention(state,p,{});if(protection){if(protection==='바보')consumeFool(p);announce(state,`${label(p)} · ${protection} 때문에 생존`);return;}
  setLife(state,p.id,abilityOf(p)==='zombuul'&&healthy(state,p)&&!p.statuses.includes('죽은 것으로 감지')?'registers-dead':'died',{phase:'day',cause});
}
export function pendingDayTrigger(state){
  for(const p of state.players){
    const role=p.abilityAtDeath||dayRole(p);
    const recentDeath=!p.alive&&(p.diedBeforeNight===state.night||p.diedNight===state.night-1);
    if(!recentDeath)continue;
    if(role==='klutz'&&!p.klutzChoice)return {type:'klutz',player:p,title:`${label(p)} (얼뜨기) 공개 지목`,prompt:'사망을 확인한 얼뜨기가 공개 지목한 생존자를 판에서 누르세요.'};
    if(role==='moonchild'&&!p.moonchildChoice)return {type:'moonchild',player:p,title:`${label(p)} (달의 아이) 공개 지목`,prompt:'사망을 확인한 달의 아이가 공개 지목한 생존자를 판에서 누르세요.'};
  }
  return null;
}
export function recordDayAbility(state,{type,actorId,targetId,roleId,choice,register}={}){
  const current=day(state);
  if(type==='flowergirl-summary'){current.demonVoted=choice==='예'?true:choice==='아니오'?false:null;return '';}
  if(type==='towncrier-summary'){current.minionNominated=choice==='예'?true:choice==='아니오'?false:null;return '';}
  const actor=state.players.find(p=>p.id===actorId),target=state.players.find(p=>p.id===targetId);
  if(!actor)return '참가자를 선택하세요.';
  if(type==='juggler-summary'){current.jugglerCorrect||={};current.jugglerCorrect[actor.id]=choice===''||choice==null?null:Number(choice);return '';}
  if(type==='gossip-summary'){current.gossipChoice||={};current.gossipChoice[actor.id]=choice||'';return '';}
  if(type==='pacifist-save'){
    if(!current.execution?.playerId)return '처형된 참가자가 없습니다.';
    recordExecution(state,current.execution.playerId,'survived');
    announce(state,`${label(actor)} · 평화주의자 능력으로 처형 생존`);
    return '';
  }
  if(type==='tinker'){
    if(dayRole(actor)!=='tinker'||!actor.alive)return '생존한 땜장이를 선택하세요.';
    if(!healthy(state,actor))return '중독·취함 상태인 땜장이는 능력으로 죽을 수 없습니다.';
    kill(state,actor,'other');
    announce(state,`${label(actor)} · 땜장이 낮 사망`);
    current.events.push({type:'tinker',actorId:actor.id,roleAtTime:actor.role,alignmentAtTime:actor.alignment,impaired:[]});
    return '';
  }
  if(!DAY_TYPES.some(([id])=>id===type))return '기록할 행동을 선택하세요.';
  if(type==='artist'&&!['예','아니오','모르겠음'].includes(choice))return '알려줄 답변을 고르세요.';
  if(['nomination','slayer','klutz','moonchild','juggle'].includes(type)&&!target)return '대상을 선택하세요.';
  if(['slayer','artist','savant'].includes(type)&&dayRole(actor)!==type)return '능력의 소유자를 다시 선택하세요.';
  if(['klutz','moonchild'].includes(type)&&(actor.abilityAtDeath||dayRole(actor))!==type)return '능력의 소유자를 다시 선택하세요.';
  if(['slayer','artist','savant'].includes(type)&&(!actor.alive||(['slayer','artist'].includes(type)&&isUsed(actor))))return '이미 사용했거나 사망한 능력입니다.';
  if(type==='nomination'&&(!actor.alive||actor.statuses.includes('죽은 것으로 감지')))return '사망한 참가자는 지목할 수 없습니다.';
  if(['klutz','moonchild'].includes(type)&&(actor.alive||!target.alive||target.statuses.includes('죽은 것으로 감지')))return '죽은 능력의 소유자와 살아 있는 지목 대상을 고르세요.';
  if(type==='juggle'&&(!roles[roleId]||dayRole(actor)!=='juggler'||state.night!==(actor.roleStartedNight||1)+1))return '곡예사의 첫 낮에 사람과 추측 캐릭터를 고르세요.';
  if(type==='juggle'&&current.events.filter(e=>e.type==='juggle'&&e.actorId===actor.id).length>=5)return '추측은 최대 5개입니다.';
  const actorHealthy=healthy(state,actor);
  const event={type,actorId:actor.id,targetId:target?.id||null,roleId:roleId||null,roleAtTime:actor.role,alignmentAtTime:actor.alignment,choice:choice||'',register:register||'',targetRole:target?.role||null,targetAlignment:target?.alignment||null,impaired:actorHealthy?[]:['중독/취함']};
  if(type==='vote'){current.events.push(event);return '';}
  if(type==='abnormal'){state.abnormalPlayers||=[];state.abnormalPlayers=state.abnormalPlayers.includes(actor.id)?state.abnormalPlayers.filter(id=>id!==actor.id):[...state.abnormalPlayers,actor.id];return '';}
  if(type==='savant'){
    announce(state,`${label(actor)} · 학자 낮 정보 전달 완료`);
  }
  if(type==='slayer'){
    markUsed(actor);
    if(actorHealthy&&(roles[target.role]?.team==='demon'||(target.role==='recluse'&&healthy(state,target)&&register==='demon'))){event.slayerKill=true;kill(state,target);}
    else{event.slayerKill=false;announce(state,'처단자: 효과 없음');}
  }
  if(type==='artist'){markUsed(actor);announce(state,`${label(actor)}에게 ${choice||'답변'} 전달 · 예술가 사용 완료`);}
  if(type==='moonchild'){actor.moonchildChoice={targetId:target.id,good:target.alignment==='good',night:state.night};announce(state,`${label(actor)} · 달의 아이 지목: ${label(target)}`);}
  if(type==='klutz'){
    const klutzHealthy=actor.healthyAtDeath!==false&&actorHealthy;
    actor.klutzChoice={targetId:target.id,evil:target.alignment==='evil',night:state.night};
    if(klutzHealthy&&target.alignment==='evil')announce(state,`${label(actor)} · 악한 사람 지목: ${actor.alignment==='good'?'선한':'악한'} 팀 패배`);
    else announce(state,`${label(actor)} · 얼뜨기 지목 확인 (${label(target)})`);
  }
  if(type==='nomination'){
    if(effectiveStatuses(state,actor).includes('저주')){const source=actor.effectSources?.['저주'],witch=state.players.find(p=>p.id===source?.playerId);if(working(state,witch)&&abilityOf(witch)==='witch')kill(state,actor);}
    if(target&&dayRole(target)==='virgin'&&!isUsed(target)){markUsed(target);const town=roles[actor.role]?.team==='townsfolk'||(actor.role==='spy'&&healthy(state,actor)&&register==='townsfolk');if(working(state,target)&&town)recordExecution(state,actor.id);}
  }
  if(type==='ability-execution')recordExecution(state,actor.id);
  if(type==='juggle')event.correct=target.role===roleId;
  current.events.push(event);return '';
}
export function dayOutcomeNotices(state){
  const execution=state.day?.execution;
  if(!execution&&state.players.some(p=>abilityOf(p)==='vortox'&&working(state,p)))announce(state,'보르톡스: 지난 낮 처형 없음 → 악한 팀 승리');
  if(!execution&&state.players.filter(p=>p.alive&&!p.statuses.includes('죽은 것으로 감지')).length===3&&state.players.some(p=>abilityOf(p)==='mayor'&&working(state,p)))announce(state,'시장: 생존 3명에서 처형 없이 낮 종료 → 선한 팀 승리');
  if(state.mastermindNight!=null&&state.night===state.mastermindNight+1){const p=state.players.find(p=>p.id===execution?.playerId);announce(state,p?`배후자 추가 낮: ${p.alignment==='good'?'선한':'악한'} 팀 패배`:'배후자 추가 낮: 처형 없음 → 선한 팀 승리');}
}
export const DAY_TYPES=[['nomination','지목 · 마녀/처녀'],['vote','투표한 사람 · 꽃파는 소녀'],['slayer','처단자'],['artist','예술가'],['savant','학자 정보 전달'],['moonchild','달의 아이 지목'],['klutz','얼뜨기 지목'],['juggle','곡예사 추측'],['abnormal','수학자 · 비정상 작동'],['ability-execution','광기 위반 등 능력 처형']];
export function renderDayFlow(state,{esc,button,token}){
  const items=[],current=state.day||{},events=current.events||[];
  const vortox=state.players.some(p=>abilityOf(p)==='vortox'&&working(state,p));
  if(vortox)items.push('<div class="day-flow-item '+(current.execution?'':'warning')+'"><span>'+token('vortox')+'<b>보르톡스</b> · '+(current.execution?'오늘 처형 기록됨':'오늘 처형이 없으면 악한 팀 승리 · 마을주민 정보는 모두 거짓')+'</span></div>');
  if(state.mastermindNight!=null&&state.night===state.mastermindNight)items.push('<div class="day-flow-item"><span>'+token('mastermind')+'<b>배후자 발동</b> · 악마 처형 사망 — 오늘 밤과 내일 낮까지 하루 더 진행합니다</span></div>');
  if(state.mastermindNight!=null&&state.night===state.mastermindNight+1){
    const execP=state.players.find(p=>p.id===current.execution?.playerId);
    items.push('<div class="day-flow-item warning"><span>'+token('mastermind')+'<b>배후자 추가 낮</b> · '+(execP?esc(label(execP))+' 처형됨 → '+(execP.alignment==='good'?'선한 팀 패배 (악 승리)':'악한 팀 패배 (선 승리)'):'오늘 처형되는 사람의 팀 패배 · 처형 없으면 선 승리')+'</span></div>');
  }
  if((state.effects||[]).some(e=>e.roleId==='minstrel'&&(e.throughNight===state.night||(state.phase==='between'&&e.throughNight===state.night-1)))){
    items.push('<div class="day-flow-item"><span>'+token('minstrel')+'<b>음유시인 발동</b> · 하수인 처형 사망으로 음유시인 외 전원 해질녘까지 취함</span></div>');
  }
  for(const pair of state.twins||[]){
    const evil=state.players.find(p=>p.id===pair.evilId),good=state.players.find(p=>p.id===pair.goodId);
    if(evil&&good?.alive&&abilityOf(evil)==='eviltwin'&&working(state,evil))items.push('<div class="day-flow-item"><span>'+token('eviltwin')+'<b>쌍둥이</b> · '+esc(label(evil))+'(악) ↔ '+esc(label(good))+'(선 · '+esc(roles[good.role]?.ko||'')+') · 선한 쌍둥이 처형 시 악 승리</span></div>');
  }
  for(const p of state.players){
    const statuses=effectiveStatuses(state,p);
    if(p.alive&&statuses.includes('처형 보호')){
      items.push('<div class="day-flow-item"><span>'+token('devilsadvocate')+'<b>악마의 변호인</b> · '+esc(label(p))+' 오늘 처형 보호 중</span></div>');
    }
    if(p.alive&&statuses.includes('저주')){
      const cursedNom=events.some(e=>e.type==='nomination'&&e.actorId===p.id);
      items.push('<div class="day-flow-item"><span>'+token('witch')+'<b>마녀 저주</b> · '+esc(label(p))+' 지목 시 즉시 사망</span>'+(cursedNom?'<small class="subtle">발동됨</small>':button('day-quick','지목함 (저주 발동)','ghost small','data-type="nomination" data-actor="'+p.id+'" data-target="'+p.id+'"'))+'</div>');
    }
    if(p.alive&&statuses.includes('광기')){
      const madRole=roles[p.effectSources?.['광기']?.characterId]?.ko||'선한 캐릭터';
      items.push('<div class="day-flow-item"><span>'+token('cerenovus')+'<b>세레노부스 광기</b> · '+esc(label(p))+' → <strong>'+esc(madRole)+'</strong> 주장 필수</span>'+button('day-quick','광기 위반 처형','ghost small','data-type="ability-execution" data-actor="'+p.id+'"')+'</div>');
    }
    if(p.alive&&dayRole(p)==='mutant'){
      items.push('<div class="day-flow-item"><span>'+token('mutant')+'<b>돌연변이</b> · '+esc(label(p))+' (외지인 주장 시 처형 가능)</span>'+button('day-quick','광기 처형','ghost small','data-type="ability-execution" data-actor="'+p.id+'"')+'</div>');
    }
    if(p.alive&&dayRole(p)==='pacifist'&&working(state,p)){
      const execP=state.players.find(t=>t.id===current.execution?.playerId);
      const canSave=execP&&execP.alignment==='good'&&current.execution?.outcome==='died';
      items.push('<div class="day-flow-item"><span>'+token('pacifist')+'<b>평화주의자</b> · '+esc(label(p))+' (처형된 선한 참가자 생존 가능)</span>'+(canSave?button('day-quick','평화주의자로 살리기','ghost small','data-type="pacifist-save" data-actor="'+p.id+'"'):'')+'</div>');
    }
    if(p.alive&&dayRole(p)==='gossip'){
      const gVal=current.gossipChoice?.[p.id]||'';
      items.push('<div class="day-flow-item"><span>'+token('gossip')+'<b>소문꾼</b> · '+esc(label(p))+' 오늘 공개 발언</span><div class="day-quick-buttons">'+['참','거짓','발언 없음'].map(v=>button('day-quick',v,'small '+(gVal===v?'primary':'ghost'),'data-type="gossip-summary" data-actor="'+p.id+'" data-choice="'+v+'"')).join('')+'</div></div>');
    }
    if(p.alive&&dayRole(p)==='tinker'){
      const bad=!healthy(state,p);
      items.push('<div class="day-flow-item"><span>'+token('tinker')+'<b>땜장이</b> · '+esc(label(p))+' <small>('+(bad?'중독·취함: 능력 사망 불가':'언제든 사망 가능')+')</small></span>'+(bad?'':button('day-quick','낮 사망 처리','ghost small','data-type="tinker" data-actor="'+p.id+'"'))+'</div>');
    }
    if(p.alive&&dayRole(p)==='savant'){
      const done=events.some(e=>e.type==='savant'&&e.actorId===p.id),bad=!healthy(state,p);
      const guide=vortox&&p.role!=='drunk'?'보르톡스: 거짓 2개 전달':bad?'중독·취함: 참·거짓 자유 전달':'정상: 참 1개 + 거짓 1개 전달';
      items.push('<div class="day-flow-item"><span>'+token('savant')+'<b>학자</b> · '+esc(label(p))+' <small>('+esc(guide)+')</small></span>'+(done?'<small class="subtle">전달 완료</small>':button('day-quick','정보 전달 완료','ghost small','data-type="savant" data-actor="'+p.id+'"'))+'</div>');
    }
    if(p.alive&&dayRole(p)==='artist'){
      const used=isUsed(p),bad=!healthy(state,p);
      const guide=vortox&&p.role!=='drunk'?'보르톡스: 거짓 답변 필수':bad?'중독·취함: 자유 답변':'정상: 진실 답변';
      items.push('<div class="day-flow-item"><span>'+token('artist')+'<b>예술가</b> · '+esc(label(p))+' <small>('+esc(guide)+')</small></span>'+(used?'<small class="subtle">사용 완료</small>':'<div class="day-quick-buttons">'+['예','아니오','모르겠음'].map(v=>button('day-quick',v,'ghost small','data-type="artist" data-actor="'+p.id+'" data-choice="'+v+'"')).join('')+'</div>')+'</div>');
    }
    if(dayRole(p)==='juggler'&&state.night===(p.roleStartedNight||1)+1){
      const guesses=events.filter(e=>e.type==='juggle'&&e.actorId===p.id);
      const currentVal=guesses.length?guesses.filter(e=>e.correct).length:current.jugglerCorrect?.[p.id];
      items.push('<div class="day-flow-item"><span>'+token('juggler')+'<b>곡예사</b> · '+esc(label(p))+' 맞힌 추측 수</span><div class="day-quick-buttons">'+[0,1,2,3,4,5].map(n=>button('day-quick',String(n),'small '+(currentVal===n?'primary':'ghost'),'data-type="juggler-summary" data-actor="'+p.id+'" data-choice="'+n+'"')).join('')+'</div></div>');
    }
  }
  if(state.players.some(p=>dayRole(p)==='flowergirl')){
    const votes=events.filter(e=>e.type==='vote');
    const val=votes.length?(votes.some(e=>roles[e.roleAtTime]?.team==='demon')?'예':'아니오'):typeof current.demonVoted==='boolean'?(current.demonVoted?'예':'아니오'):'';
    items.push('<div class="day-flow-item"><span>'+token('flowergirl')+'<b>꽃파는 소녀</b> · 오늘 악마가 투표했나요?</span><div class="day-quick-buttons">'+['예','아니오'].map(v=>button('day-quick',v,'small '+(val===v?'primary':'ghost'),'data-type="flowergirl-summary" data-choice="'+v+'"')).join('')+'</div></div>');
  }
  if(state.players.some(p=>dayRole(p)==='towncrier')){
    const noms=events.filter(e=>e.type==='nomination');
    const val=noms.length?(noms.some(e=>roles[e.roleAtTime]?.team==='minion')?'예':'아니오'):typeof current.minionNominated==='boolean'?(current.minionNominated?'예':'아니오'):'';
    items.push('<div class="day-flow-item"><span>'+token('towncrier')+'<b>포고꾼</b> · 오늘 하수인이 지목했나요?</span><div class="day-quick-buttons">'+['예','아니오'].map(v=>button('day-quick',v,'small '+(val===v?'primary':'ghost'),'data-type="towncrier-summary" data-choice="'+v+'"')).join('')+'</div></div>');
  }
  return items.length?'<div class="day-flow-list">'+items.join('')+'</div>':'';
}
export function renderDayAbilityForm(state,form,{esc,token}){
  const type=form.type||'nomination',roleTypes=['slayer','artist','savant','moonchild','klutz','juggle'];
  const people=roleTypes.includes(type)?state.players.filter(p=>(['klutz','moonchild'].includes(type)?(p.abilityAtDeath||dayRole(p)):dayRole(p))===(type==='juggle'?'juggler':type)):state.players;
  const select=(field,title,list,value)=>'<label class="field-label">'+title+'</label><select data-field="day-ability-'+field+'" aria-label="'+title+'"><option value="">선택하세요</option>'+list.map(([id,name])=>'<option value="'+id+'" '+(id===value?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select>';
  return '<p class="muted-copy">밤 능력에 필요한 낮 행동만 기록합니다.</p>'+select('type','기록할 행동',DAY_TYPES,type)+select('actorId','행동한 참가자',people.map(p=>[p.id,label(p)+' · '+roles[p.role]?.ko]),form.actorId)+(['nomination','slayer','klutz','moonchild','juggle'].includes(type)?select('targetId','선택한 대상',state.players.map(p=>[p.id,label(p)+' · '+roles[p.role]?.ko]),form.targetId):'')+(type==='juggle'?select('roleId','추측 캐릭터',ROLES.filter(r=>r.edition===state.edition).map(r=>[r.id,r.ko]),form.roleId):'')+(type==='artist'?select('choice','알려줄 답변',[['예','예'],['아니오','아니오'],['모르겠음','모르겠음']],form.choice):'')+(['nomination','slayer'].includes(type)?select('register','감지 예외',[['actual','실제 역할로 판정'],['demon','은둔자를 악마로 감지'],['townsfolk','스파이를 마을주민으로 감지']],form.register||'actual'):'')+(type==='abnormal'?'<p>중독 수가 아니라 실제 잘못 작동한 사람을 표시합니다. 다시 선택하면 해제합니다.</p><p>현재: '+(state.abnormalPlayers||[]).map(id=>esc(label(state.players.find(p=>p.id===id)))).join(' · ')+'</p>':'');
}
