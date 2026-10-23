import {roleLabel,resolvedAction,nextEntry,simpleStep,renderCirclePrompt,renderCircleChoices} from './simple-flow.js';
import {recordDayAbility,renderDayAbilityForm,dayOutcomeNotices,pendingDayTrigger,renderDayFlow} from './day-abilities.js';
import {boardPositions,moveOnBoard,resetBoard,bindBoardDrag} from './layout.js';
import {prerequisiteError,renderPrerequisites,setRedHerring,needsRedHerring,bluffError,validBluffIds} from './prerequisites.js';
import {renderMechanicControls,mechanicError,resolveSweetheart,changeCharacter,exorcised,working,abilityOf,announce} from './mechanics.js';
import {rosterRoles,toggleRosterRole,prepareAssignment,assignRosterRole,moveSetupPlayer,renderRoster,renderAssignments,renderComposition,compositionReport} from './setup.js';
import {evilInfoSteps,infoStepIndex,renderEvilSteps} from './evil-info.js';
import {voteStatus,voteSummary,setGhostVote,renderVotePanel} from './voting.js';
import { ROLES } from './data.js';
import {effectiveStatuses,toggleStatus} from './effects.js';
import {appearsDead,setLife,recordExecution,lifeResolution,expireTimedEffects} from './life.js';
import {renderDayResults,initialLifeChoices,renderLifeResults,renderLifeSelect} from './life-ui.js';
import { recordAction } from './recording.js';
import { abilityProfile, candidates, selectionResult, selectionError } from './abilities.js';
import { renderAbilityInspector, renderAbilityPicker, renderTargetSummary, renderEffectControls, selectedCharacters, suggestedAction } from './storyteller.js';
import { information, impairment, actionRelations, targetRule, targetError } from './information.js';
import { EDITIONS, TEAMS, ROLE_MAP, freshState, changeCount, distribution, roleCounts, setupWarnings, actingRole, nightQueue, nextNight, addLog, validateStored } from './game.js';

const STORAGE = 'night-grimoire:v1';
let state = freshState(), view = 'setup', setupStep = 1, boardMode = 'circle', currentKey = null, queueExpanded = false, inspectedId = null, targeting = false;
let rosterFilter='all', boardSelection=null;
let history = [], modal = null, storageFailed = false, lastFocus = null, toastTimer;
try { const stored = JSON.parse(localStorage.getItem(STORAGE)); if (validateStored(stored)) { state = stored; view = state.phase === 'setup' ? 'setup' : 'night'; setupStep = state.setupStep || (state.players.some(p => p.role) ? 3 : 1); } } catch { storageFailed = true; }
const app = document.querySelector('#app'), modalRoot = document.querySelector('#modal-root');
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const edition = () => EDITIONS.find(e => e.id === state.edition);
const playerName = p => roleLabel(p);
function readableChange(text){let value=String(text);for(const p of state.players){value=value.replaceAll(p.seat+'번 참가자',`${p.seat}번(${roleLabel(p)})`);if(p.name?.trim())value=value.replaceAll(p.name.trim(),`${p.seat}번 ${p.name.trim()}(${roleLabel(p)})`);}return value.replace('에게 변경 정보를 알려주세요: ','에게 알려주세요: ');}
const token = (id, cls = '') => ROLE_MAP[id] ? `<img class="${cls}" src="./${ROLE_MAP[id].icon}" alt="${esc(ROLE_MAP[id].ko)}" loading="lazy">` : '';
const icons = {
  moon:'<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>',
  book:'<path d="M12 5c-3-2-7-2-10 0v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-3-2-7-2-10 0Zm0 0v15"/>',
  people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m1 4a5 5 0 0 1 4 5"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>', back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  settings:'<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="2" fill="#171918"/><circle cx="16" cy="12" r="2" fill="#171918"/><circle cx="9" cy="19" r="2" fill="#171918"/>',
  undo:'<path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
  circle:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="4" r="2" fill="#171918"/><circle cx="5" cy="16" r="2" fill="#171918"/><circle cx="19" cy="16" r="2" fill="#171918"/>',
  feather:'<path d="M4 20 19 5M6 15c-2-6 3-13 13-12 2 10-5 15-11 13M9 12h5M12 9v5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  shuffle:'<path d="m3 5 4 0 10 14h4m-4-4 4 4-4 4M3 19h4l10-14h4m-4-4 4 4-4 4"/>',
  plus:'<path d="M12 4v16M4 12h16"/>', chevron:'<path d="m8 5 7 7-7 7"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.moon}</svg>`;
const button = (action, text, cls = '', attributes = '') => `<button type="button" class="button ${cls}" data-action="${action}" ${attributes}>${text}</button>`;
function persist() {
  state.savedAt = new Date().toISOString();
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); storageFailed = false; } catch { storageFailed = true; }
}
function mutate(callback, message) {
  history.push(structuredClone(state)); if (history.length > 35) history.shift();
  callback(state); persist(); render(); if (message) toast(message);
}
function toast(text) { const el = document.querySelector('#toast'); el.textContent = text; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2600); }
function go(nextView) { view = nextView; modal = null; render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
function navLink(id, label, ico, mobile = false) {
  return `<button class="${mobile ? '' : 'side-link '}${view === id ? 'active' : ''}" data-action="nav" data-view="${id}">${icon(ico)}${label}${!mobile && id === 'night' ? `<span class="pill">${String(state.night).padStart(2,'0')}</span>` : ''}</button>`;
}
function render() {
  const scrollY=window.scrollY;
  const playing=state.phase!=='setup';
  app.innerHTML='<div class="circle-shell"><header class="circle-topbar"><strong>밤의 서재</strong><div>'+button('undo',icon('undo'),'icon-button','aria-label="마지막 변경 되돌리기" '+(history.length?'':'disabled'))+button('menu',icon('settings'),'icon-button','aria-label="설정과 기록 내보내기"')+'</div></header><main class="circle-main">'+(!playing?renderSetup():view==='records'?renderRecords():renderNight())+'</main>'+(storageFailed?'<p class="storage-warning">이 기기에 저장할 수 없습니다. 설정에서 기록을 내보내세요.</p>':'')+'</div>';
  renderModal();
  if(!modal&&window.scrollY!==scrollY)window.scrollTo({top:scrollY,behavior:'instant'});
}
function renderSetup() {
  return setupStep===1?'<h1 class="circle-page-title">버전과 인원</h1>'+renderEditionSelect():renderSetupBoard();
}
function renderEditionSelect() {
  const expected = distribution(state.count);
  return `<div class="section-head"><h2><span class="section-index">01</span>버전 선택</h2><span class="subtle">세 가지 기본 버전</span></div><div class="editions">${EDITIONS.map(e => `<button class="edition-card ${state.edition === e.id ? 'selected' : ''}" style="--edition-color:${e.color}" data-action="edition" data-edition="${e.id}" aria-pressed="${state.edition === e.id}"><span class="selection-circle">${state.edition === e.id ? icon('check') : ''}</span><span class="edition-tag">${e.tag}</span><svg class="edition-art" viewBox="0 0 200 160" aria-hidden="true"><use href="#art-${e.symbol}"/></svg><h3>${e.name}</h3><div class="edition-bottom"><span>${ROLES.filter(r => r.edition === e.id).length}개의 캐릭터</span>${icon('arrow')}</div></button>`).join('')}</div><div class="section-head"><h2><span class="section-index">02</span>참가 인원</h2><span class="subtle">사회자 제외 · 5–15명</span></div><div class="count-panel"><div class="count-copy">${icon('people')}<div><div class="count-title">몇 명이 함께하나요?</div><p>인원에 맞는 기본 구성을 안내해드려요.</p></div></div><div class="stepper"><button data-action="count" data-delta="-1" aria-label="인원 한 명 줄이기" ${state.count <= 5 ? 'disabled' : ''}>−</button><div class="count-value">${state.count}<small>명</small></div><button data-action="count" data-delta="1" aria-label="인원 한 명 늘리기" ${state.count >= 15 ? 'disabled' : ''}>+</button></div></div><div class="composition">${Object.keys(TEAMS).map((team,i) => `<span class="team-chip ${team}">${TEAMS[team]}<b>${expected[i]}</b></span>`).join('')}</div>${state.edition !== 'tb' && state.count < 7 ? '<div class="notice sheet-notice">이 버전은 7명 이상 진행을 권장합니다.</div>' : ''}<div class="footer-action"><div class="hint">${icon('lock')}<span>역할과 진행 기록은 이 기기에만 저장됩니다.<br>참가자의 설치나 로그인은 필요하지 않아요.</span></div>${button('setup-next',`캐릭터 고르기 ${icon('arrow')}`,'primary')}</div>`;
}
function activeEntry() {
  const queue=nightQueue(state), selected=state.players.find(p=>p.id===inspectedId);
  if(selected) return queue.find(q=>q.key===currentKey&&q.playerId===selected.id) || queue.find(q=>q.playerId===selected.id) || {key:selected.id+':'+actingRole(selected),roleId:actingRole(selected),playerId:selected.id,kind:'inspect'};
  return queue.find(q=>q.key===currentKey)||null;
}
function seats(focused=false,center='') {
  const q=focused?activeEntry():null, a=q?resolvedAction(state,q,state.actions[q.key]||{targets:[],result:'',note:''}):{targets:[]};
  const positions=boardPositions(state),evil=q?.kind==='info'?evilInfoSteps(state,q.roleId)[infoStepIndex(state,q)]:null;
  const dayTrig=state.phase==='between'?pendingDayTrigger(state):null;
  const barberDemons=q?.roleId==='barber'?state.players.filter(p=>ROLE_MAP[p.role]?.team==='demon'&&p.alive).map(p=>p.id):[];
  const highlighted=[...(evil?.players?.map(p=>p.id)||[]),...barberDemons,...(dayTrig?[dayTrig.player.id]:[])];
  const pointerMode=boardSelection||(state.pendingSweethearts?.length?'sweetheart':dayTrig?'day-trigger':focused&&canTarget(q)?'target':null);
  return '<div class="circle-board simple-circle '+(pointerMode?'choosing-targets':'')+'" data-count="'+state.count+'" style="--seat-count:'+state.count+'"><div class="circle-ring"></div><div class="circle-center">'+center+'</div>'+state.players.map(p=>{
    const pos=positions[p.id],effects=effectiveStatuses(state,p),bad=impairment(p,state),dead=appearsDead(p),vote=voteStatus(p),selected=p.id===q?.playerId||highlighted.includes(p.id),target=a.targets.includes(p.id);
    const madRole=p.effectSources?.['광기']?.characterId?ROLE_MAP[p.effectSources['광기'].characterId]?.ko:'';
    const marker=bad.length?(bad.some(v=>v.includes('중독'))?'중독':'취함'):effects.includes('보호')?'보호':effects.includes('처형 보호')?'처형보호':(p.alive&&effects.includes('죽은 것으로 감지'))?'가짜사망':effects.includes('미끼')?'미끼':effects.includes('저주')?'저주':effects.includes('광기')?('광기'+(madRole?':'+madRole:'')):effects.includes('쌍둥이')?'쌍둥이':effects.includes('사망 후 능력 유지')?'능력유지':'';
    const subRole=p.abilityRole||p.simulatedAbilityRole||p.shownRole;
    const seatName=roleLabel(p)+(subRole&&ROLE_MAP[subRole]?'('+ROLE_MAP[subRole].ko+')':'');
    return '<div class="seat-position" style="left:'+pos.x+'%;top:'+pos.y+'%"><button class="seat-card '+(p.role?'':'empty ')+(dead?'dead ':'')+(selected?'is-active ':'')+(state.notifications?.some(t=>t.startsWith((p.name?.trim()||p.seat+'번 참가자')+'에게 변경 정보를'))?'is-changed ':'')+(target?'is-target ':'')+'" data-action="circle-seat" data-player="'+p.id+'" aria-label="'+esc(seatName)+(dead?' · 사망':'')+(marker?' · '+marker:'')+'" aria-pressed="'+target+'">'+(p.role?token(p.role):'<span class="seat-plus">+</span>')+'<span class="seat-role">'+esc(seatName)+'</span>'+(marker?'<span class="seat-effect '+(bad.length?'impaired':'')+'">'+esc(marker)+'</span>':'')+(target?'<span class="target-order">'+(a.targets.indexOf(p.id)+1)+'</span>':'')+(dead?'<span class="death-mark">사망</span>':'')+'</button>'+(state.phase!=='setup'&&vote.ghost?(vote.used?'<span class="ghost-spent" aria-label="'+esc(roleLabel(p))+' 유령표 사용 완료">표 없음</span>':button('use-ghost-vote','●','ghost-token','data-player="'+p.id+'" aria-label="'+esc(roleLabel(p))+' 유령표 사용"')):'')+'</div>';
  }).join('')+'</div>';
}
function boardPanel(){return seats(false);}
function renderSetupBoard() {
  const filled=state.players.filter(p=>p.role).length,report=compositionReport(state,state.players.map(p=>p.role)),need=needsRedHerring(state),marked=state.players.find(p=>p.statuses.includes('미끼'));
  const center=boardSelection==='red-herring'?'<strong class="circle-message">미끼를 고르세요</strong><p>선한 캐릭터 1명 터치</p>':'<span class="circle-kicker">'+filled+' / '+state.count+' 배치</span><strong class="circle-message">'+(filled===state.count?'위치를 맞추세요':'빈 자리 터치')+'</strong><p>'+(filled===state.count?'꾹 눌러 이동':'캐릭터를 놓으세요')+'</p><small>실제 앉은 순서대로</small>';
  return '<div class="circle-heading"><h1>캐릭터 배치</h1>'+button('setup-back','버전·인원','ghost small')+'</div>'+seats(false,center)+report.warnings.map(w=>'<p class="composition-warning">'+esc(w)+'</p>').join('')+'<div class="circle-setup-tools">'+(need?button('pick-red-herring','미끼: '+(marked?esc(roleLabel(marked)):'선택 필요'),'ghost '+(!marked?'attention':'')):'')+state.players.filter(p=>['drunk','lunatic'].includes(p.role)).map(p=>button('shown-role',esc(roleLabel(p))+'에게 보여준 역할: '+esc(ROLE_MAP[p.shownRole]?.ko||'선택'),'ghost','data-player="'+p.id+'"')).join('')+button('bluffs','블러프 '+state.bluffs.length+'/3','ghost '+(bluffError(state)?'attention':''))+'</div><details class="circle-details"><summary>인원 구성 확인</summary>'+renderComposition(state,uiHelpers(),state.players.map(p=>p.role))+'</details><div class="circle-footer">'+button('start','첫 번째 밤 시작','primary',filled!==state.count?'disabled':'')+'</div>';
}
function renderBoard() {
  return `<div class="intro"><div><h1>참가자 관리</h1>${button('votes','투표권 관리','ghost')}<p>역할과 진영, 생존 여부, 능력과 상태를 관리하세요.</p></div><div class="intro-icon">${icon('book')}</div></div><div class="board-layout">${boardPanel()}<div class="side-summary"><section class="panel"><div class="panel-body"><h2 class="summary-title">오늘 밤의 마을</h2><div class="summary-row"><span>생존</span><strong>${state.players.filter(p=>p.alive).length}명</strong></div><div class="summary-row"><span>사망</span><strong>${state.players.filter(p=>!p.alive).length}명</strong></div><p class="muted-copy" style="margin-top:16px">상태와 역할 변경은 밤 순서에 반영됩니다. 중독·취함은 사회자가 해제할 때까지 표시됩니다.</p></div></section><section class="panel"><div class="panel-body"><h3 class="summary-title">악마의 블러프</h3><div class="bluff-list">${state.bluffs.map(id=>`<span class="small-token">${token(id)}${esc(ROLE_MAP[id].ko)}</span>`).join('') || '<span class="subtle">선택하지 않음</span>'}</div></div></section></div></div>`;
}
const GUIDE = {
  minioninfo:'하수인들을 깨워 서로와 실제 악마가 누구인지 알려주세요. 참가자에게 보여주기 전, 아래 정보를 확인하세요.',
  demoninfo:'실제 악마를 깨워 하수인과 블러프 캐릭터 3개를 알려주세요.',
  poisoner:'한 사람을 선택받고 중독 상태를 기록하세요. 전날 중독의 종료 시점도 확인하세요.',
  monk:'자신 이외의 한 사람을 선택받으세요. 정상적으로 능력이 작동하면 오늘 밤 악마로부터 보호됩니다.',
  empath:'가장 가까운 생존 이웃 두 사람을 확인하고, 전달할 악한 사람의 수를 기록하세요.',
  fortuneteller:'두 사람을 선택받고 예/아니오 정보를 전달하세요. 미끼, 감지 예외, 중독·취함을 확인하세요.',
  spy:'참가자에게 그리모어를 보여주세요. 다른 참가자가 보지 않도록 주의하세요.',
  ravenkeeper:'오늘 밤 죽었을 때만 처리하세요. 한 사람을 선택받고 캐릭터 정보를 전달합니다.',
  sage:'악마에게 죽었을 때만 처리하세요. 두 사람 중 실제 악마를 포함해 정보를 전달합니다.',
  undertaker:'오늘 처형으로 죽은 사람을 확인하고 캐릭터 정보를 전달하세요. 처형만 되고 죽지 않았다면 구분하세요.',
  philosopher:'얻을 선한 능력을 선택받으세요. 완료하면 능력·밤 순서·기존 동일 캐릭터의 취함이 반영됩니다.',
  pithag:'참가자와 새 캐릭터를 선택받으세요. 완료하면 역할이 바뀝니다. 악마가 만들어졌다면 실제 사망자는 사회자가 결정하세요.',
  snakecharmer:'생존자 한 명을 선택받으세요. 악마면 완료 시 역할·진영 교환과 새 뱀 조련사의 중독이 반영됩니다.',
  barber:'오늘 낮이나 밤에 이발사가 죽었을 때만 처리하세요. 악마의 선택에 따라 두 참가자의 캐릭터를 교환합니다. 진영은 그대로 유지합니다.',
  sweetheart:'연인이 죽었을 때의 효과를 확인하세요. 사망 즉시 결정한 취함이 이미 기록되어 있는지 확인합니다.',
  moonchild:'달의 아이가 죽고 선택한 사람을 확인하세요. 그 사람이 선하다면 능력과 보호 상태에 따라 죽음을 처리합니다.',
  lunatic:'광인에게 알려준 악마의 행동을 흉내 내고 선택한 대상을 기록하세요. 실제 악마에게 광인과 선택 대상을 전달합니다.',
  flowergirl:'지난 낮에 악마가 투표했는지 사회자가 확인하고 예/아니오 정보를 전달하세요.',
  towncrier:'지난 낮에 하수인이 지목했는지 사회자가 확인하고 예/아니오 정보를 전달하세요.',
  juggler:'곡예사가 공개적으로 한 추측을 확인하고 맞힌 수를 전달하세요. 첫날 낮 또는 능력을 얻은 첫 낮의 추측인지 확인하세요.',
  mathematician:'지난 새벽 이후 다른 캐릭터로 인해 능력이 비정상적으로 작동한 참가자 수를 확인하고 전달하세요.',
  zombuul:'오늘 아무도 죽지 않았을 때만 대상을 선택받으세요. 실제 생존과 죽은 것으로 감지되는 상태를 구분해 기록하세요.',
  godfather:'첫날에는 등장한 외지인을 알려주세요. 이후에는 지난 낮에 외지인이 죽었는지 확인하고 대상 선택을 처리하세요.'
};

function renderNight() {
  if(state.pendingRedHerring)boardSelection='red-herring';
  if(state.phase==='between')return renderBetween();
  const queue=nightQueue(state),remaining=queue.filter(q=>!state.completed.includes(q.key));
  if(!queue.some(q=>q.key===currentKey)||state.completed.includes(currentKey)){const next=nextEntry(state);currentKey=next?.key||null;inspectedId=null;}
  const q=remaining.length?activeEntry():null;targeting=canTarget(q);
  const done=queue.filter(q=>state.completed.includes(q.key)).length;
  let center=renderCirclePrompt(state,q,uiHelpers());
  if(boardSelection==='red-herring')center='<strong class="circle-message">미끼를 고르세요</strong><p>선한 캐릭터 1명 터치</p>';
  if(state.pendingSweethearts?.length&&boardSelection!=='red-herring')center='<strong class="circle-message">연인이 사망했습니다</strong><p>취할 캐릭터 1명 터치</p>';
  const pending=state.pendingSweethearts?.length||state.pendingRedHerring;
  const allNotices=state.notifications||[],notices=allNotices.filter(t=>!t.includes('선택을 반영')&&(!allNotices.some(n=>n.includes('변경 정보를'))||!t.includes(' → '))).map(readableChange);
  let primary=button('finish-direct','낮으로','primary');
  if(q?.kind==='info'){const steps=evilInfoSteps(state,q.roleId),i=infoStepIndex(state,q);primary=i<steps.length-1?button('info-next','다음','primary',steps[i].bluffs&&state.bluffs.length!==3?'disabled':''):button('complete','재우고 다음','primary');}
  else if(q)primary=button('complete','완료 · 다음','primary');
  return '<div class="circle-heading"><h1>'+state.night+'번째 밤</h1>'+button('night-order',done+' / '+queue.length+' · 차례','ghost small')+'</div>'+seats(!!q&&!pending,center)+(notices.length?'<div class="circle-update" role="status">'+notices.map(t=>'<p>'+esc(t)+'</p>').join('')+'</div>':'')+(q&&!pending?renderCircleChoices(state,q,uiHelpers()):'')+'<div class="circle-footer">'+(pending?button('await-target','판에서 대상을 고르세요','primary','disabled'):(q?(['philosopher','courtier','seamstress','professor','assassin'].includes(q.roleId)?button('skip','사용 안 함','ghost'):button('step-details','상세','ghost')):button('day-ability','낮 기록','ghost'))+primary)+'</div><p class="circle-footnote">꾹 눌러 이동 · 사망자의 ●를 누르면 유령표 사용</p>';
}
function uiHelpers(){return {token,esc,button,icon,playerName};}
function renderInspector(q) {
  const a=state.actions[q.key]||{targets:[],result:'',note:''};
  if(q.playerId)return renderAbilityInspector(state,q,a,uiHelpers());
  return '<div class="ability-inspector storyteller-inspector"><div class="ability-heading"><div class="inspector-token">'+icon('eye')+'</div><h2>'+(q.roleId==='minioninfo'?'하수인 정보':'악마 정보')+'</h2></div>'+renderEvilSteps(state,q,uiHelpers())+'</div>';
}
function renderActionTools(q) {
  if(q.kind==='inspect')return '';
  if(state.actions[q.key]?.mechanicsApplied)return '<div class="grimoire-tools">'+renderMechanicControls(state,q,state.actions[q.key],uiHelpers())+'<p class="subtle">반영 완료 · 변경하려면 상단 되돌리기</p></div>';
  if(q.kind==='info'){const steps=evilInfoSteps(state,q.roleId),index=infoStepIndex(state,q),last=index===steps.length-1;return '<div class="grimoire-tools"><div class="action-footer">'+button('info-back','이전 단계','ghost',index?'':'disabled')+(last?button('complete','전달 완료 · 다음 캐릭터','primary'):button('info-next','다음 · '+steps[index+1].title,'primary',steps[index].bluffs&&state.bluffs.length!==3?'disabled':''))+'</div></div>';}
  const a=state.actions[q.key]||{targets:[],result:'',note:''};
  const wake=q.roleId==='chambermaid'&&a.targets.length===2?'<div class="wake-facts"><span class="choice-label">자신의 능력으로 깨어났는지 확인</span>'+a.targets.map(id=>{const t=state.players.find(p=>p.id===id);return '<div><span>'+esc(playerName(t))+'</span>'+[true,false].map(w=>button('wake-fact',w?'깨어남':'안 깨어남','small '+(a.wakeFacts?.[id]===w?'primary':'ghost'),'data-player="'+id+'" data-value="'+w+'"')).join('')+'</div>';}).join('')+'</div>':'';
  return '<div class="grimoire-tools">'+wake+'<details class="night-notes"><summary>메모 · 상세 규칙</summary><textarea data-field="action-note" aria-label="사회자 메모" maxlength="2000" placeholder="필요한 메모만 남기세요">'+esc(a.note||'')+'</textarea><p>'+esc(GUIDE[q.roleId]||rSummary(q.roleId))+'</p><p class="subtle">'+esc(ROLE_MAP[q.roleId]?.[state.night===1?'firstNightReminder':'otherNightReminder']||'')+'</p>'+(ROLE_MAP[q.roleId]?'<a href="https://wiki.bloodontheclocktower.com/'+encodeURIComponent(ROLE_MAP[q.roleId].name.replaceAll(' ','_'))+'" target="_blank" rel="noopener">공식 규칙 ↗</a>':'')+'</details><div class="action-footer">'+button('skip','생략','ghost small')+button('complete',state.completed.includes(q.key)?'기록 수정':['poisoner','pukka'].includes(q.roleId)?'완료 · 중독 적용 '+icon('arrow'):'완료 · 다음 '+icon('arrow'),'primary')+'</div></div>';
}
function rSummary(id){return ROLE_MAP[id]?.summary||'';}
function renderRelationLedger(q) {
  const relations=actionRelations(state), relevant=relations.filter(rel=>rel.playerId===q?.playerId||rel.targetId===q?.playerId);
  if(!relevant.length&&!state.players.some(p=>effectiveStatuses(state,p).length||!p.alive))return '';
  return '<section class="panel relationship-ledger"><div class="panel-heading"><strong>누가 누구에게</strong><span class="subtle">이번 밤</span></div><div class="panel-body">'+(relevant.length?relevant.map(rel=>{const from=state.players.find(p=>p.id===rel.playerId),to=state.players.find(p=>p.id===rel.targetId);return '<button class="relationship-row" data-action="queue" data-key="'+rel.key+'"><span>'+esc(playerName(from))+' <b>'+esc(ROLE_MAP[rel.roleId]?.ko||'능력')+'</b></span><span class="relationship-arrow">→</span><span>'+esc(playerName(to))+' <b>'+esc(ROLE_MAP[to.role]?.ko||'')+'</b></span><small>'+(rel.done?'기록됨':'선택 중')+'</small></button>';}).join(''):'<p class="muted-copy">선택한 캐릭터가 사용하거나 받은 능력이 여기에 표시됩니다.</p>')+'</div></section><section class="panel"><div class="panel-body"><h3 class="summary-title">이번 밤의 상태</h3>'+state.players.filter(p=>effectiveStatuses(state,p).length||appearsDead(p)).map(p=>'<button class="state-summary-row" data-action="grimoire-seat" data-player="'+p.id+'"><b>'+esc(playerName(p))+'</b><span>'+esc(ROLE_MAP[p.role]?.ko||'')+'<small>'+esc([...effectiveStatuses(state,p),...(appearsDead(p)?['사망']:[])].join(' · '))+'</small></span></button>').join('')+'</div></section>';
}
function renderBetween(){
  const executed=state.day?.execution,p=state.players.find(p=>p.id===executed?.playerId),votes=voteSummary(state),dayTrig=pendingDayTrigger(state);
  const center=state.pendingSweethearts?.length?'<strong class="circle-message">연인이 사망했습니다</strong><p>취할 캐릭터 1명 터치</p>':dayTrig?'<strong class="circle-message">'+esc(dayTrig.title)+'</strong><p>'+esc(dayTrig.prompt)+'</p>':boardSelection==='red-herring'?'<strong class="circle-message">미끼를 고르세요</strong><p>선한 캐릭터 1명 터치</p>':'<span class="circle-kicker">'+(state.night-1)+'번째 낮</span><strong class="circle-message">캐릭터를 누르세요</strong><p>처형·사망 기록</p><small>● 터치 = 유령표 사용</small><span class="day-votes">투표 가능 '+votes.available+'명</span>';
  return '<div class="circle-heading"><h1>'+(state.night-1)+'번째 낮</h1>'+button('day-ability','기타 낮 능력','ghost small')+'</div>'+seats(false,center)+(p?'<div class="circle-update">처형: '+esc(roleLabel(p))+' · '+(executed.outcome==='died'?'사망':executed.outcome==='registers-dead'?'사망 표시 (좀부울 생존)':executed.outcome==='already-dead'?'시체 처형 (변화 없음)':'생존')+' '+(executed.outcome==='died'?button('execution-outcome','생존으로 변경','ghost small','data-outcome="survived"'):executed.outcome==='survived'?button('execution-outcome','사망으로 변경','ghost small','data-outcome="died"'):'')+button('clear-execution','취소','ghost small')+'</div>':'')+((state.notifications||[]).length?'<div class="circle-update">'+state.notifications.map(t=>'<p>'+esc(readableChange(t))+'</p>').join('')+'</div>':'')+renderDayFlow(state,uiHelpers())+'<div class="circle-footer">'+button('begin-next',state.night+'번째 밤 시작','primary')+'</div>';
}
function renderRecords() {
  return `<div class="circle-heading"><h1>진행 기록</h1>${button('nav','판으로','ghost','data-view="night"')}</div><section class="panel"><div class="panel-body">${state.log.length?`<div class="record-list">${state.log.map(l=>`<div class="record-row"><div class="record-moon">${l.night}</div><div><p>${esc(readableChange(l.text))}</p><time>${new Date(l.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} · ${l.night}번째 밤</time></div></div>`).join('')}</div>`:`<div class="empty-state">${icon('feather')}<p>아직 기록이 없습니다.<br>밤 행동을 완료하면 기록이 쌓여요.</p></div>`}</div></section>`;
}
function openModal(next) { lastFocus = document.activeElement; modal = next; renderModal(); requestAnimationFrame(()=>modalRoot.querySelector('input,button,select,textarea')?.focus()); }
function openBluffPicker(){const allowed=new Set(validBluffIds(state)),kept=[...new Set(state.bluffs)].filter(id=>allowed.has(id));if(kept.length!==state.bluffs.length)mutate(s=>{s.bluffs=kept;});openModal({type:'roles',purpose:'bluffs',filter:'all'});}
function closeModal() { modal = null; render(); lastFocus?.focus?.(); }
function modalFrame(title,body,foot='') { return `<div class="modal-overlay" data-action="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="닫기">${icon('close')}</button></header><div class="modal-content">${body}</div>${foot?`<footer class="modal-foot">${foot}</footer>`:''}</section></div>`; }
function renderModal() {
  document.body.style.overflow = modal ? 'hidden' : ''; app.inert = !!(modal);
  if (!modal) { modalRoot.innerHTML = ''; return; }
  const p = state.players.find(p=>p.id===modal.playerId);
  if(modal.type==='quick-player'){
    const dead=appearsDead(p),statuses=effectiveStatuses(state,p),fakeDead=p.alive&&dead;
    const madRole=p.effectSources?.['광기']?.characterId?ROLE_MAP[p.effectSources['광기'].characterId]?.ko:'';
    const dayExtras=state.phase==='between'&&!dead?(statuses.includes('저주')?button('day-quick','지목함 · 마녀 저주 발동','danger','data-type="nomination" data-actor="'+p.id+'" data-target="'+p.id+'"'):'')+((statuses.includes('광기')||p.role==='mutant')?button('day-quick','광기 위반 처형'+(madRole?' ('+esc(madRole)+' 미주장)':''),'danger','data-type="ability-execution" data-actor="'+p.id+'"'):''):'';
    const execBtn=state.phase==='between'?(!dead?button('execute-player','투표로 처형','danger','data-player="'+p.id+'"'):fakeDead?button('execute-player','투표로 처형 (좀부울 사망)','danger','data-player="'+p.id+'"'):button('execute-player','시체 처형 (좀부울 확인)','ghost','data-player="'+p.id+'"')):'';
    modalRoot.innerHTML=modalFrame(esc(roleLabel(p)), '<div class="quick-character">'+token(p.role)+'<p>'+esc(ROLE_MAP[p.role]?.summary||'')+'</p></div><div class="quick-actions">'+execBtn+(state.phase==='between'&&!dead?dayExtras+button('other-death','기타 사망','ghost','data-player="'+p.id+'"'):'')+(dead?button('revive-player','생존으로 정정','ghost','data-player="'+p.id+'"'):'')+button('advanced-player','상태·역할 수정','ghost','data-player="'+p.id+'"')+'</div>',button('close-modal','닫기','primary'));
  } else if(modal.type==='night-order'){const queue=nightQueue(state);modalRoot.innerHTML=modalFrame('밤 차례','<div class="compact-order">'+queue.map(q=>button('view-step',(state.completed.includes(q.key)?'✓ ':'')+(ROLE_MAP[q.roleId]?.ko||(q.roleId==='minioninfo'?'하수인 정보':'악마 정보')),'ghost','data-key="'+q.key+'"')).join('')+'</div>');
  } else if(modal.type==='step-details'){const q=activeEntry();modalRoot.innerHTML=modalFrame('이번 차례 상세',q?renderInspector(q):'<p>밤 진행 완료</p>',q?button('skip','이번 차례 생략','ghost')+button('resolve-details','사망 결과 조정','ghost')+button('close-modal','닫기','primary'):'');
  } else if(modal.type==='adjust-layout'){const person=state.players.find(p=>p.id===modal.playerId)||state.players[0];modal.playerId=person.id;modalRoot.innerHTML=modalFrame('그리모어 위치 조정','<p>길게 누른 채 움직이거나 아래 방향 버튼을 사용하세요.</p><select data-field="layout-person" aria-label="이동할 참가자">'+state.players.map(p=>'<option value="'+p.id+'" '+(p.id===person.id?'selected':'')+'>'+esc(playerName(p))+'</option>').join('')+'</select><div class="layout-arrows">'+[['0,-4','위 ↑'],['-4,0','← 왼쪽'],['4,0','오른쪽 →'],['0,4','아래 ↓']].map(([delta,text])=>button('nudge-position',text,'ghost','data-delta="'+delta+'"')).join('')+'</div>',button('reset-layout','원형으로 초기화','ghost')+button('close-modal','완료','primary'));
  } else if(modal.type==='day-ability'){modalRoot.innerHTML=modalFrame('밤 능력에 필요한 기록',renderDayAbilityForm(state,modal.form,uiHelpers()),button('close-modal','닫기','ghost')+button('save-day-ability','기록 · 반영','primary'));
  } else if(modal.type==='changes'){const pending=state.pendingSweethearts||[];modalRoot.innerHTML=modalFrame('반영 결과 · 참가자에게 알리기',(state.notifications||[]).map(t=>'<p class="change-line">'+esc(t)+'</p>').join('')+pending.map(id=>'<h3>'+esc(playerName(state.players.find(p=>p.id===id)))+' · 연인 사망</h3><p>즉시 취할 사람 1명을 고르세요.</p><div class="mechanic-people">'+state.players.map(p=>button('sweetheart-target',token(p.role)+' '+esc(playerName(p)),'ghost','data-source="'+id+'" data-player="'+p.id+'"')).join('')+'</div>').join('')+(state.pendingRedHerring?renderPrerequisites(state,uiHelpers()):''),button('ack-changes','확인 · 계속','primary',pending.length||state.pendingRedHerring?'disabled':''));
  } else if(modal.type==='votes'){modalRoot.innerHTML=modalFrame('투표권 관리',renderVotePanel(state,uiHelpers()),button('close-modal','닫기','primary'));
  } else if (modal.type==='roles') {
    const isBluff = modal.purpose==='bluffs';
    modalRoot.innerHTML = modalFrame(isBluff?`악마의 블러프 · ${state.bluffs.length}/3`:modal.purpose==='shown'?'참가자에게 알려준 캐릭터':modal.purpose==='ability'?'얻은 능력 선택':`${esc(playerName(p))} · 캐릭터 선택`, `<div class="role-search"><input class="input" type="search" id="role-search" data-field="role-search" value="${esc(modal.search||'')}" placeholder="캐릭터 이름 검색" aria-label="캐릭터 이름 검색"><div class="filter-row">${[['all','전체'],...Object.entries(TEAMS)].map(([id,name])=>`<button class="filter-button ${(modal.filter||'all')===id?'active':''}" data-action="role-filter" data-filter="${id}">${name}</button>`).join('')}</div></div><div class="role-library" id="role-library">${roleLibrary()}</div>`, isBluff?button('close-modal','선택 완료','primary'):button('close-modal','닫기','ghost'));
  } else if (modal.type==='life-results') {
    modalRoot.innerHTML=modalFrame('실제 사망·부활 결과',renderLifeResults(state,modal.q,modal.plan,modal.choices,uiHelpers()),button('close-modal','돌아가기','ghost')+button('confirm-life','완료 · 상태 반영','primary'));
  } else if(modal.type==='day-results') {
    modalRoot.innerHTML=modalFrame('지난 낮의 결과',renderDayResults(state,uiHelpers()),button('close-modal','완료','primary'));
  } else if (modal.type==='player') {
    const r = ROLE_MAP[p.role];
    modalRoot.innerHTML = modalFrame(esc(playerName(p)), `<div class="player-info">${token(p.role)}<div><h3>${r?esc(r.ko):'캐릭터 미배치'}</h3><p class="subtle">${r?`${esc(r.name)} · ${TEAMS[r.team]}`:''}</p>${button('change-role','캐릭터 변경','ghost small',`data-player="${p.id}"`)}</div></div>${r?`<p class="muted-copy" style="margin-top:15px">${esc(r.summary)}</p>`:''}${['drunk','lunatic'].includes(p.role)?`<label class="field-label">본인에게 알려준 캐릭터</label>${button('shown-role',`${p.shownRole?esc(ROLE_MAP[p.shownRole].ko):'캐릭터 선택'} ${icon('chevron')}`,'ghost full-width',`data-player="${p.id}"`)}<p class="subtle" style="margin-top:8px">이 캐릭터에 맞춰 밤 행동을 안내합니다.</p>`:''}${state.phase!=='setup'?`<div class="split-fields"><div><label class="field-label">생존 여부</label>${renderLifeSelect(state,p)}</div><div><label class="field-label">실제 진영</label><select data-field="player-alignment" aria-label="실제 진영"><option value="good" ${p.alignment==='good'?'selected':''}>선</option><option value="evil" ${p.alignment==='evil'?'selected':''}>악</option></select></div></div><label class="field-label">상태 · 직접 추가 / 해제</label><div class="status-buttons">${['중독','취함','보호','사망 후 능력 유지','죽은 것으로 감지','미끼','저주','광기',...p.statuses.filter(s=>!['중독','취함','보호','사망 후 능력 유지','죽은 것으로 감지','미끼','저주','광기'].includes(s))].map(s=>`<button class="status-button ${effectiveStatuses(state,p).includes(s)?'selected':''}" data-action="status" data-status="${esc(s)}">${s==='사망 후 능력 유지'?'사망 후 능력 유지':esc(s)}</button>`).join('')}</div><div class="input-row" style="margin-top:10px"><input class="input" id="custom-status" maxlength="40" placeholder="추가 상태 / 효과의 출처" aria-label="추가 상태">${button('add-status','추가','ghost small')}</div><label class="field-label">능력 사용</label><button class="status-button ${p.used?'selected':''}" data-action="used">${p.used?'✓ 일회성 능력 사용함':'일회성 능력 아직 사용 안 함'}</button><label class="field-label">다른 캐릭터의 능력</label>${button('ability-role',p.abilityRole?`${esc(ROLE_MAP[p.abilityRole].ko)} 능력 · 변경`:'철학자 등 얻은 능력 지정','ghost small',`data-player="${p.id}"`)}${p.abilityRole?button('clear-ability','해제','ghost small')+`<div style="margin-top:9px"><button class="status-button ${p.abilityUsed?'selected':''}" data-action="ability-used">${p.abilityUsed?'✓ 얻은 일회성 능력 사용함':'얻은 일회성 능력 아직 사용 안 함'}</button></div>`:''}`:''}<label class="field-label" for="player-memo">개인 메모</label><textarea id="player-memo" data-field="player-memo" maxlength="2000" placeholder="효과의 출처, 종료 시점, 전달 정보…">${esc(p.memo)}</textarea>`,`${state.phase==='setup'?button('remove-role','배치 해제','ghost'):''}${button('close-modal','완료','primary')}`);
  } else if (modal.type==='menu') {
    modalRoot.innerHTML = modalFrame('서재 설정',`<div class="menu-actions">${state.phase!=='setup'?button('nav','진행 기록','ghost','data-view="records"'):''}${button('adjust-layout','위치 조정·원형 초기화','ghost')}${button('export',`${icon('download')}게임 기록 파일로 저장`,'ghost')}${button('import',`${icon('book')}저장한 게임 불러오기`,'ghost')}${button('help',`${icon('info')}사용 안내`,'ghost')}${button('new-game',`${icon('plus')}새 게임 준비`,'danger')}</div><p class="muted-copy" style="margin-top:18px">기록에는 모든 역할과 비밀 정보가 포함됩니다. 이 기기의 브라우저에 저장되며, 브라우저 데이터를 지우면 삭제됩니다.</p><input id="import-file" type="file" accept="application/json,.json" class="visually-hidden">`);
  } else if (modal.type==='new-game-check') {
    modalRoot.innerHTML=modalFrame('새 게임을 준비할까요?', '<p class="muted-copy">현재 게임을 새 게임으로 바꿉니다. 기록이 필요하면 먼저 게임 기록을 파일로 저장하세요.</p>', button('close-modal','돌아가기','ghost')+button('confirm-new-game','새 게임 준비','primary'));
  } else if (modal.type==='help') {
    modalRoot.innerHTML = modalFrame('밤의 서재 사용 안내', `<div class="eyebrow">FOR THE STORYTELLER</div><h3>인원과 캐릭터를 놓고, 밤을 시작하세요.</h3><div class="divider"></div><div class="muted-copy"><p>① 세 가지 버전 중 하나와 참가 인원을 정하세요.</p><p style="margin-top:10px">② 원형 판의 빈 자리를 눌러 캐릭터를 놓으세요. 꾹 눌러 실제 앉은 위치로 옮깁니다. 주정뱅이·광인은 본인에게 알려준 역할도 선택합니다.</p><p style="margin-top:10px">③ 밤 순서에서 캐릭터를 고르고 ‘이번 차례 진행’ 안내를 차례대로 따르세요. 하수인·악마 시작 정보는 다음 단계 버튼으로 전달합니다. 숫자·예/아니오·캐릭터 토큰으로 정보를 선택하고, 필요한 대상은 그리모어에서 고릅니다. 완료하면 사망·보호·역할 변경이 자동 적용됩니다. 필요한 경우 상세에서 결과를 조정합니다. 결과는 좌석과 이후 밤 순서에 바로 반영됩니다.</p><p style="margin-top:10px">④ 독살범·푸카는 완료하면 대상의 중독이 표시되고, 노 다시의 마을주민 이웃도 자동 표시됩니다. 중독·취함 안내를 보고 전달 정보를 선택하세요. 다른 상태와 판정은 자리 상세에서 조정할 수 있습니다.</p><p style="margin-top:10px">⑤ 다음 밤 준비에서 지난 낮 처형 대상과 사망·생존 결과를 선택하세요. 처형 사망이 있을 때만 장의사가 깨어납니다. 밤 진행 중에도 ‘낮 처형·사망 기록’에서 수정할 수 있습니다. 판에서 사망자 아래 ●를 터치하면 유령표가 사라집니다. 유령표는 사망 후 한 번이며 다음 밤에도 사용 상태가 유지됩니다.</p></div><div class="notice sheet-notice">이 앱은 사회자의 순서·기록 도우미입니다. 능력 상호작용과 거짓 정보, 승리 판정은 사회자가 결정합니다. 한국어 이름과 설명은 비공식 요약이며 공식 원문을 함께 제공합니다.</div><h3>휴대폰에서 사용하기</h3><p class="muted-copy" style="margin-top:10px">브라우저 메뉴에서 ‘홈 화면에 추가’를 선택하세요. 한 번 자료를 저장한 뒤에는 같은 기기에서 오프라인으로 진행할 수 있습니다. 사회자만 사용하는 화면입니다.</p><div class="divider"></div><p class="subtle">개인용 비공식 도우미 · 게임과 캐릭터 자료 © The Pandemonium Institute. <a href="https://release.botc.app/resources/" target="_blank" rel="noopener">공식 자료</a> · <a href="https://bloodontheclocktower.com/pages/community-created-content-policy" target="_blank" rel="noopener">커뮤니티 정책</a></p><img src="./assets/ccc-sleeve.png" alt="Community Created Content" style="width:110px;margin-top:18px">`);
  } else if (modal.type==='start-check') {
    modalRoot.innerHTML = modalFrame('첫 번째 밤을 시작할까요?',`<p class="muted-copy">${edition().name} · ${state.count}명</p>${setupWarnings(state).map(w=>`<div class="notice sheet-notice">${esc(w)}</div>`).join('')}${state.count>=7&&state.bluffs.length!==3?'<div class="notice sheet-notice">악마에게 알려줄 블러프 3개를 아직 정하지 않았습니다. 시작 전에 블러프를 정해주세요.</div>':''}<p class="muted-copy" style="margin-top:15px">구성 변경 능력을 반영했다면 그대로 시작할 수 있습니다.</p>`,`${button('close-modal','돌아가기','ghost')}${button('confirm-start','밤 시작','primary')}`);
  } else if (modal.type==='finish-check') {
    modalRoot.innerHTML = modalFrame('이 밤을 마무리할까요?',`<p class="muted-copy">사망·보호·중독·역할 변경을 그리모어에 반영했는지 확인하세요. 다음 밤 시작 전에도 변경할 수 있습니다.</p>`,`${button('close-modal','계속 진행','ghost')}${button('confirm-finish','밤 마무리','primary')}`);
  } else if (modal.type==='ability-characters') {
    const q=activeEntry(),a=state.actions[q?.key]||{targets:[],result:'',note:''};
    modalRoot.innerHTML=modalFrame('캐릭터 선택',renderAbilityPicker(state,q,a,uiHelpers(),modal.filter||'all'),button('close-modal','선택 완료','primary'));

  }
}
function roleLibrary() {
  const purpose = modal.purpose, p = state.players.find(p=>p.id===modal.playerId), search = (modal.search||'').toLowerCase();
  const taken = state.players.filter(t=>t.id!==p?.id).flatMap(t=>[t.role,...(t.role==='drunk'&&t.shownRole?[t.shownRole]:[])]);
  let roles = ROLES.filter(r=>r.edition===state.edition);
  if(purpose==='assign')roles=roles.filter(r=>rosterRoles(state).includes(r.id));
  if (purpose==='shown') roles = roles.filter(r=>p.role==='drunk'?r.team==='townsfolk'&&!state.players.some(t=>t.id!==p.id&&(t.role===r.id||t.shownRole===r.id)):r.team==='demon');
  if (purpose==='ability') roles = roles.filter(r=>['townsfolk','outsider'].includes(r.team) && r.id!=='philosopher');
  if (purpose==='bluffs') roles = roles.filter(r=>['townsfolk','outsider'].includes(r.team) && !state.players.some(p=>p.role===r.id||p.shownRole===r.id));
  roles = roles.filter(r=>(!modal.filter||modal.filter==='all'||r.team===modal.filter) && `${r.name} ${r.ko}`.toLowerCase().includes(search));
  return roles.map(r=>{
    const disabled = purpose==='role' && state.phase==='setup' && taken.includes(r.id);
    const selected = purpose==='bluffs'?state.bluffs.includes(r.id):purpose==='shown'?p.shownRole===r.id:purpose==='ability'?p.abilityRole===r.id:p.role===r.id;
    return `<button class="role-choice ${selected?'selected':''}" data-action="pick-role" data-role="${r.id}" ${disabled?'disabled':''}>${token(r.id)}<div class="role-info"><strong>${esc(r.ko)} ${disabled?'· 배치됨':''}${selected?' ✓':''}${purpose==='assign'&&!selected&&state.players.some(t=>t.role===r.id)?' · 교환: '+esc(playerName(state.players.find(t=>t.role===r.id))):''}</strong><small>${esc(r.name)} · ${TEAMS[r.team]}</small></div></button>`;
  }).join('') || '<div class="empty-state">조건에 맞는 캐릭터가 없어요.</div>';
}

function canTarget(q){return !!q?.playerId&&!state.actions[q.key]?.mechanicsApplied&&q.kind!=='inspect'&&!(q.roleId==='pukka'&&exorcised(state,state.players.find(p=>p.id===q.playerId)))&&targetRule(q.roleId,q.reminderKind==='first'?1:state.night).max>0&&!(q.roleId==='godfather'&&(state.night===1||q.reminderKind==='first'))&&!(q.roleId==='lunatic'&&abilityProfile(state,q).kind==='confirm')&&!(q.roleId==='librarian'&&suggestedAction(state,q,state.actions[q.key]||{targets:[],result:'',note:''}).choice==='0');}
function advanceQueue(q){const next=nextEntry(state,q);currentKey=next?.key||null;inspectedId=null;targeting=canTarget(next);}
function draft() { const key=activeEntry()?.key||currentKey;state.actions[key] ||= { targets: [], result: '', note: '' }; return state.actions[key]; }
function toggleTarget(playerId){const q=activeEntry();if(!canTarget(q))return;const a=resolvedAction(state,q,state.actions[q.key]||{targets:[]});if(!a.targets.includes(playerId)){const error=targetError(state,q,[...a.targets,playerId],true);const rule=targetRule(q.roleId,q.reminderKind==='first'?1:state.night);if(a.targets.length>=rule.max||error){toast(error||rule.label+'까지만 가능해요.');return;}}mutate(()=>{const action=draft();delete action.lifeResults;action.targets=a.targets.includes(playerId)?a.targets.filter(id=>id!==playerId):[...a.targets,playerId];});}
function completeAction(q,a,skipped=false){const check=structuredClone(state);check.notifications=[];const error=recordAction(check,q,a,skipped);if(error){toast(error);return;}mutate(s=>{Object.assign(s,check);modal=null;advanceQueue(q);if(s.pendingRedHerring)boardSelection='red-herring';});window.scrollTo({top:0,behavior:'instant'});}
function logPlayer(p,text) { if(state.phase!=='setup') addLog(state,`${p.seat}번 ${playerName(p)} · ${text}`,'player'); }
async function onAction(event) {
  const el = event.target.closest('[data-action]'); if(!el || el.disabled) return;
  const action = el.dataset.action, playerId = el.dataset.player;
  const p = state.players.find(p=>p.id===(playerId||modal?.playerId));
  if(action==='modal-backdrop') { if(event.target===el) closeModal(); return; }
  switch(action) {
    case 'nav': go(el.dataset.view); break;
    case 'edition': if(el.dataset.edition===state.edition) break; if(state.players.some(p=>p.role)&&!confirm('버전을 바꾸면 배치한 캐릭터가 초기화됩니다. 변경할까요?')) break; mutate(s=>{ const fresh=freshState(el.dataset.edition,s.count); Object.assign(s,fresh); }); break;
    case 'count': { const count=state.count+Number(el.dataset.delta); if(count<state.count&&state.players.at(-1)?.role&&!confirm('마지막 자리의 캐릭터 배치가 삭제됩니다. 인원을 줄일까요?')) break; mutate(s=>Object.assign(s,changeCount(s,count))); break; }
    case 'setup-next': mutate(s=>{s.setupStep=2;setupStep=2;});window.scrollTo(0,0);break;
    case 'roster-filter':rosterFilter=el.dataset.filter;render();break;
    case 'roster-toggle':if(!rosterRoles(state).includes(el.dataset.role)&&rosterRoles(state).length>=state.count){toast('참가 인원만큼 선택했습니다. 기존 캐릭터를 해제한 뒤 고르세요.');break;}mutate(s=>toggleRosterRole(s,el.dataset.role));break;
    case 'roster-next':if(rosterRoles(state).length!==state.count)break;mutate(s=>{prepareAssignment(s);setupStep=3;s.setupStep=3;});window.scrollTo(0,0);break;
    case 'assign-role':openModal({type:'roles',playerId:p.id,purpose:'assign',filter:'all'});break;
    case 'move-player':mutate(s=>moveSetupPlayer(s,p.id,Number(el.dataset.delta)));break;
    case 'apply-names':{const names=document.querySelector('#bulk-names').value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);mutate(s=>names.slice(0,s.count).forEach((name,i)=>s.players[i].name=name.slice(0,30)),'이름을 적용했습니다.');break;}
    case 'setup-back':mutate(s=>{setupStep=1;s.setupStep=1;});window.scrollTo(0,0);break;
    case 'red-herring':mutate(s=>{if(setRedHerring(s,p.id)){s.pendingRedHerring=false;boardSelection=null;}});break;
    case 'adjust-layout':openModal({type:'adjust-layout',playerId:inspectedId||state.players[0].id});break;
    case 'nudge-position':{const delta=el.dataset.delta.split(',').map(Number),pos=boardPositions(state)[p.id];mutate(s=>applySeatMove(s,p.id,pos.x+delta[0],pos.y+delta[1]),'자리를 이동했습니다 · 이웃 판정에 반영됨');break;}
    case 'reset-layout':mutate(s=>resetBoard(s),'원형 배치로 초기화했습니다.');break;
    case 'day-ability':openModal({type:'day-ability',form:{type:'nomination'}});break;
    case 'save-day-ability':{const check=structuredClone(state),error=recordDayAbility(check,modal.form);if(error){toast(error);break;}mutate(s=>{Object.assign(s,check);addLog(s,'낮 행동 · '+modal.form.type,'action');modal=s.notifications?.length||s.pendingSweethearts?.length?{type:'changes'}:null;},'기록했습니다.');break;}
    case 'day-quick':{const payload={type:el.dataset.type,actorId:el.dataset.actor,targetId:el.dataset.target,choice:el.dataset.choice};const check=structuredClone(state),error=recordDayAbility(check,payload);if(error){toast(error);break;}mutate(s=>{Object.assign(s,check);addLog(s,'낮 행동 · '+payload.type,'action');modal=null;},'반영했습니다.');break;}
    case 'show-changes':openModal({type:'changes'});break;
    case 'sweetheart-target':mutate(s=>resolveSweetheart(s,el.dataset.source,p.id));break;
    case 'ack-changes':if(state.pendingSweethearts?.length||state.pendingRedHerring)break;mutate(s=>{s.notifications=[];modal=null;});break;
    case 'mechanic-choice':mutate(()=>{draft()[el.dataset.field]=playerId;delete draft().lifeResults;});break;
    case 'pick-red-herring':boardSelection=boardSelection==='red-herring'?null:'red-herring';render();break;
    case 'circle-seat':
      if(boardSelection==='red-herring'){if(p.alignment!=='good'){toast('선한 캐릭터를 고르세요.');break;}mutate(s=>{setRedHerring(s,p.id);s.pendingRedHerring=false;boardSelection=null;});break;}
      if(state.pendingSweethearts?.length){if(p.id===state.pendingSweethearts[0]){toast('연인 이외의 참가자를 고르세요.');break;}mutate(s=>resolveSweetheart(s,s.pendingSweethearts[0],p.id));break;}
      if(state.phase==='between'&&pendingDayTrigger(state)){const trig=pendingDayTrigger(state),check=structuredClone(state),err=recordDayAbility(check,{type:trig.type,actorId:trig.player.id,targetId:p.id});if(err){toast(err);break;}mutate(s=>{Object.assign(s,check);addLog(s,'낮 지목 · '+trig.type,'action');},'지목을 반영했습니다.');break;}
      if(state.phase==='setup'){openModal({type:'roles',playerId:p.id,purpose:'role',filter:'all'});break;}
      if(state.phase==='night'&&canTarget(activeEntry())){toggleTarget(p.id);break;}
      openModal({type:'quick-player',playerId:p.id});break;
    case 'use-ghost-vote':mutate(s=>{if(setGhostVote(s,p.id,true))logPlayer(p,'유령표 사용');},'유령표를 사용했습니다.');break;
    case 'execute-player':mutate(s=>{recordExecution(s,p.id);logPlayer(p,'투표로 처형');modal=null;});break;
    case 'clear-execution':mutate(s=>recordExecution(s,''));break;
    case 'other-death':mutate(s=>{setLife(s,p.id,'died',{phase:'day',cause:'other'});logPlayer(p,'낮 사망');modal=null;});break;
    case 'revive-player':mutate(s=>{if(s.day?.execution?.playerId===p.id)recordExecution(s,'');else setLife(s,p.id,'alive');modal=null;});break;
    case 'advanced-player':openModal({type:'player',playerId:p.id});break;
    case 'night-order':openModal({type:'night-order'});break;
    case 'view-step':{const q=nightQueue(state).find(q=>q.key===el.dataset.key);if(!q)break;currentKey=q.key;inspectedId=null;modal={type:'step-details'};renderModal();break;}
    case 'step-details':openModal({type:'step-details'});break;
    case 'resolve-details':{const q=activeEntry(),a=q?resolvedAction(state,q,state.actions[q.key]||{targets:[],result:'',note:''}):null;if(!q)break;const error=selectionError(state,q,a)||mechanicError(state,q,a);if(error){toast(error);break;}const plan=lifeResolution(state,q,a,impairment(state.players.find(p=>p.id===q.playerId),state).length>0);if(plan)openModal({type:'life-results',q,action:a,plan,choices:initialLifeChoices(state,q,a,plan)});else toast('이 차례에는 사망·부활 결과가 없습니다.');break;}
    case 'finish-direct':if(state.pendingSweethearts?.length||state.pendingRedHerring){toast('판에서 먼저 대상을 고르세요.');break;}mutate(s=>{Object.assign(s,nextNight(s));modal=null;currentKey=null;inspectedId=null;targeting=false;boardSelection=null;s.notifications=[];});window.scrollTo(0,0);break;
    case 'board-mode': boardMode=el.dataset.mode; render(); break;
    case 'seat': openModal({type:p.role?'player':'roles',playerId:p.id,purpose:'role',filter:'all'}); break;
    case 'change-role': openModal({type:'roles',playerId:p.id,purpose:'role',filter:'all'}); break;
    case 'shown-role': openModal({type:'roles',playerId:p.id,purpose:'shown',filter:'all'}); break;
    case 'ability-role': openModal({type:'roles',playerId:p.id,purpose:'ability',filter:'all'}); break;
    case 'clear-ability': mutate(()=>{p.abilityRole=null;p.abilityUsed=false;logPlayer(p,'얻은 능력 해제');}); break;
    case 'player-back': openModal({type:'player',playerId:modal.playerId}); break;
    case 'role-filter': modal.filter=el.dataset.filter; renderModal(); break;
    case 'pick-role': {
      const id=el.dataset.role, r=ROLE_MAP[id], purpose=modal.purpose;
      if(purpose==='assign'){mutate(s=>{assignRosterRole(s,p.id,id);modal=null;});}
      else if(purpose==='bluffs') { mutate(s=>{if(s.bluffs.includes(id))s.bluffs=s.bluffs.filter(v=>v!==id);else if(s.bluffs.length<3)s.bluffs.push(id);else toast('블러프는 3개까지 선택할 수 있어요.');}); }
      else { mutate(s=>{if(purpose==='shown')p.shownRole=id;else if(purpose==='ability'){p.abilityRole=id;p.abilityUsed=false;p.roleStartedNight=s.night;p.needsStartInfo=!!ROLE_MAP[id].firstNightReminder;}else{const old=p.role;if(s.phase==='setup'){p.role=id;p.shownRole=null;p.abilityRole=null;p.used=false;p.abilityUsed=false;}else changeCharacter(s,p,id,{position:activeEntry()?.position??-1});if(s.phase==='setup')p.alignment=['minion','demon'].includes(r.team)?'evil':'good';s.bluffs=s.bluffs.filter(b=>b!==id);logPlayer(p,`${old?ROLE_MAP[old].ko:'미배치'} → ${r.ko} · 진영 ${p.alignment==='good'?'선':'악'}`);}if(s.phase==='setup'){s.selectedRoles=s.players.map(t=>t.role).filter(Boolean);modal=null;}else modal={type:'player',playerId:p.id};}); }
      break;
    }
    case 'remove-role': mutate(()=>{p.role=null;p.shownRole=null;p.abilityRole=null;modal=null;}); break;
    case 'shuffle': mutate(s=>{const assigned=s.players.map(p=>({role:p.role,shownRole:p.shownRole,alignment:p.alignment}));for(let i=assigned.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[assigned[i],assigned[j]]=[assigned[j],assigned[i]];}s.players.forEach((p,i)=>Object.assign(p,assigned[i]));},'선택한 캐릭터를 섞었어요.'); break;
    case 'bluffs': openBluffPicker(); break;
    case 'start': if(bluffError(state)){toast(bluffError(state));openBluffPicker();break;}if(prerequisiteError(state)){toast(prerequisiteError(state));boardSelection='red-herring';render();break;}if(state.players.some(p=>!p.role)){toast('모든 참가자에게 캐릭터를 연결하세요.');break;}if(state.players.some(p=>['drunk','lunatic'].includes(p.role)&&!p.shownRole)){toast('주정뱅이·광인에게 알려준 캐릭터를 지정해주세요.');break;} if(setupWarnings(state).length){openModal({type:'start-check'});break;}mutate(s=>{s.phase='night';addLog(s,edition().name+' · 첫 번째 밤 시작','phase');modal=null;view='night';currentKey=null;inspectedId=null;targeting=false;boardSelection=null;});window.scrollTo(0,0);break;
    case 'confirm-start': if(bluffError(state)){toast(bluffError(state));openBluffPicker();break;}if(prerequisiteError(state)){toast(prerequisiteError(state));break;}mutate(s=>{s.phase='night';addLog(s,`${edition().name} · ${s.count}명 · 첫 번째 밤 시작`,'phase');modal=null;view='night';currentKey=null;inspectedId=null;targeting=false;});window.scrollTo(0,0);break;
    case 'queue-toggle': queueExpanded=!queueExpanded;render();break;
    case 'queue': {const q=nightQueue(state).find(q=>q.key===el.dataset.key);currentKey=el.dataset.key;inspectedId=q?.playerId||null;targeting=canTarget(q);render();break;}
    case 'grimoire-seat': if(targeting){toggleTarget(playerId);}else{inspectedId=playerId;const q=nightQueue(state).find(q=>q.playerId===playerId);if(q)currentKey=q.key;render();}break;
    case 'target-mode': targeting=!targeting;render();break;
    case 'set-result': mutate(()=>{const a=draft();a.result=el.dataset.value;a.choice='';a.characters=[];});break;
    case 'set-choice': mutate(()=>{const a=draft(),q=activeEntry();a.choice=el.dataset.value;a.result='';a.characters=[];delete a.lifeResults;if(q?.roleId==='librarian'&&a.choice==='0'){a.targets=[];targeting=false;}if(q?.roleId==='gossip'&&a.choice!=='참'){a.targets=[];}});break;
    case 'character-picker': {const q=activeEntry();const a=suggestedAction(state,q,state.actions[q.key]||{targets:[],result:'',note:''});if(a.characters.length&&!state.actions[q.key]?.characters?.length){Object.assign(draft(),a);persist();}openModal({type:'ability-characters',filter:'all'});break;}
    case 'ability-filter':modal.filter=el.dataset.filter;renderModal();break;
    case 'choose-character': {const q=activeEntry(),profile=abilityProfile(state,q,draft()),id=el.dataset.role;if(!['character','pair','characters'].includes(profile.kind)||!candidates(state,q,draft()).includes(id))break;mutate(()=>{const a=draft();let ids=selectedCharacters(resolvedAction(state,q,a));if(ids.includes(id))ids=ids.filter(v=>v!==id);else if(profile.kind==='pair'){const good=['townsfolk','outsider'].includes(ROLE_MAP[id].team);ids=[...ids.filter(v=>['townsfolk','outsider'].includes(ROLE_MAP[v].team)!==good),id];}else if((profile.max||1)===1)ids=[id];else if(ids.length<(profile.max||15))ids.push(id);else{toast('선택할 수 있는 캐릭터 수를 확인하세요.');return;}a.characters=ids;a.result='';a.choice='';delete a.lifeResults;targeting=canTarget(q);});break;}
    case 'wake-fact': mutate(()=>{const q=activeEntry(),a=draft(),auto=q?resolvedAction(state,q,a).wakeFacts:{};a.wakeFacts={...auto,...(a.wakeFacts||{})};a.wakeFacts[playerId]=el.dataset.value==='true';a.result='';a.choice='';});break;
    case 'apply-effect': {const q=activeEntry(),a=draft();if(!q||!a.targets.length)break;mutate(s=>{for(const id of (el.dataset.target?[el.dataset.target]:a.targets)){const t=s.players.find(p=>p.id===id);if(!t.statuses.includes(el.dataset.effect))t.statuses.push(el.dataset.effect);t.effectSources||={};t.effectSources[el.dataset.effect]={playerId:q.playerId,roleId:q.roleId,night:s.night};logPlayer(t,el.dataset.effect+' · '+ROLE_MAP[q.roleId].ko+'의 능력');}},'선택한 대상에 '+el.dataset.effect+' 표시를 추가했어요.');break;}
    case 'target': toggleTarget(playerId);break;
    case 'complete':case 'skip':{if(state.pendingSweethearts?.length||state.pendingRedHerring){toast('판에서 먼저 대상을 고르세요.');if(state.pendingRedHerring)boardSelection='red-herring';render();break;}const q=activeEntry();if(!q||q.kind==='inspect')break;if(action==='complete'&&q.roleId==='demoninfo'&&bluffError(state)){toast(bluffError(state));openBluffPicker();break;}const a=resolvedAction(state,q,state.actions[q.key]||{targets:[],result:'',note:''});if(action==='complete'){const error=selectionError(state,q,a)||mechanicError(state,q,a);if(error){toast(error);break;}const plan=lifeResolution(state,q,a,impairment(state.players.find(p=>p.id===q.playerId),state).length>0);if(plan&&state.arbitraryDeathsNight===state.night&&!Object.values(state.actions).some(act=>act?.arbitraryDeath)){openModal({type:'life-results',q,action:a,plan,choices:initialLifeChoices(state,q,a,plan)});break;}}completeAction(q,a,action==='skip');break;}
    case 'confirm-life': {const {q,action:a,choices}=modal;completeAction(q,{...a,lifeResults:choices});break;}
    case 'votes':openModal({type:'votes'});break;
    case 'ghost-vote-used':mutate(s=>{const used=el.dataset.used==='true';if(setGhostVote(s,p.id,used))logPlayer(p,used?'유령표 사용':'유령표 복구');});break;
    case 'info-next':{const q=activeEntry(),steps=evilInfoSteps(state,q.roleId),index=infoStepIndex(state,q);if(steps[index].bluffs&&state.bluffs.length!==3)break;mutate(()=>{draft().infoStep=Math.min(index+1,steps.length-1);});window.scrollTo({top:0,behavior:'instant'});break;}
    case 'info-back':{const q=activeEntry();mutate(()=>{draft().infoStep=Math.max(0,infoStepIndex(state,q)-1);});break;}
    case 'day-results':openModal({type:'day-results'});break;
    case 'execution-outcome':mutate(s=>{recordExecution(s,s.day?.execution?.playerId,el.dataset.outcome);addLog(s,'낮 처형 결과 변경 · '+el.textContent,'player');});break;
    case 'finish-night': openModal({type:'finish-check'});break;
    case 'confirm-finish': mutate(s=>{Object.assign(s,nextNight(s));modal=null;currentKey=null;inspectedId=null;targeting=false;});window.scrollTo(0,0);break;
    case 'begin-next': if(state.pendingSweethearts?.length||state.pendingRedHerring||pendingDayTrigger(state)){toast('판에서 먼저 공개 지목/대상을 고르세요.');break;}mutate(s=>{dayOutcomeNotices(s);s.phase='night';expireTimedEffects(s);if(s.betweenNote){addLog(s,`밤 사이 메모: ${s.betweenNote}`,'note');s.betweenNote='';}addLog(s,`${s.night}번째 밤 시작`,'phase');currentKey=null;inspectedId=null;targeting=false;boardSelection=null;});window.scrollTo(0,0);break;
    case 'status': mutate(s=>{const status=el.dataset.status;toggleStatus(s,p,status);if(status==='죽은 것으로 감지'&&p.alive)p.ghostVoteUsed=false;logPlayer(p,`${status} ${effectiveStatuses(s,p).includes(status)?'추가':'해제'}`);});break;
    case 'add-status': {const value=document.querySelector('#custom-status').value.trim();if(value&&!p.statuses.includes(value))mutate(()=>{p.statuses.push(value);if(value==='죽은 것으로 감지'&&p.alive)p.ghostVoteUsed=false;logPlayer(p,`상태 추가: ${value}`);});break;}
    case 'ability-used':mutate(()=>{p.abilityUsed=!p.abilityUsed;logPlayer(p,`얻은 능력 ${p.abilityUsed?'사용':'미사용'}으로 변경`);});break;
    case 'used':mutate(()=>{p.used=!p.used;logPlayer(p,`일회성 능력 ${p.used?'사용':'미사용'}으로 변경`);});break;
    case 'undo': if(history.length){state=history.pop();persist();modal=null;currentKey=null;inspectedId=null;targeting=false;boardSelection=null;view=state.phase==='setup'?'setup':view;setupStep=state.setupStep||(state.players.some(p=>p.role)?3:1);render();toast('마지막 변경을 되돌렸어요.');}break;
    case 'close-modal':closeModal();break;
    case 'menu':openModal({type:'menu'});break;
    case 'help':openModal({type:'help'});break;
    case 'export':{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`밤의서재-${state.edition}-${state.night}밤-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('게임 기록을 파일로 저장했어요.');break;}
    case 'import':document.querySelector('#import-file')?.click();break;
    case 'new-game':openModal({type:'new-game-check'});break;
    case 'confirm-new-game':{mutate(s=>{Object.assign(s,freshState(s.edition,s.count));modal=null;view='setup';setupStep=1;currentKey=null;inspectedId=null;targeting=false;boardSelection=null;});}break;
  }
}
function applySeatMove(s,id,x,y){
  moveOnBoard(s,id,x,y);
  for(const key of s.completed||[]){
    const [playerId,roleId]=key.split(':'),a=s.actions?.[key];
    if(a&&!a.skipped&&['empath','chef','clockmaker'].includes(roleId)){
      const info=information(s,{key,roleId,playerId},a);
      if(info.canCopy&&info.value!==null&&a.result!==info.value){
        a.result=info.value;a.baseline=info;
        announce(s,`${ROLE_MAP[roleId]?.ko||roleId} 정상 정보가 자리 이동에 따라 ${info.value}(으)로 변경되었습니다.`);
      }else a.baseline=info;
    }
  }
}
bindBoardDrag({root:app,onMove:(id,pos)=>mutate(s=>applySeatMove(s,id,pos.x,pos.y),'자리를 이동했습니다 · 이웃 판정에 반영됨'),onHold:()=>toast('끌어서 옮기거나 원하는 위치를 누르세요.')});
document.addEventListener('click',onAction);
document.addEventListener('input',event=>{
  const field=event.target.dataset.field;
  if(field==='setup-name'){const p=state.players.find(p=>p.id===event.target.dataset.player);if(p){p.name=event.target.value;persist();}return;}
  if(field==='role-search'){modal.search=event.target.value;document.querySelector('#role-library').innerHTML=roleLibrary();return;}
  if(field==='action-note'){draft().note=event.target.value;persist();}
  if(field==='between-note'){state.betweenNote=event.target.value;persist();}
  const p=state.players.find(p=>p.id===modal?.playerId);
  if(p&&field==='player-name'){p.name=event.target.value;persist();}
  if(p&&field==='player-memo'){p.memo=event.target.value;persist();}
});
document.addEventListener('change',async event=>{
  const field=event.target.dataset.field,p=state.players.find(p=>p.id===modal?.playerId);
  if(field?.startsWith('day-ability-')&&modal?.type==='day-ability'){const key=field.slice(12);modal.form[key]=event.target.value;if(key==='type'){modal.form={type:event.target.value};renderModal();}return;}
  if(field==='layout-person'&&modal?.type==='adjust-layout'){modal.playerId=event.target.value;renderModal();return;}
  if(field==='life-result'&&modal?.type==='life-results'){modal.choices[event.target.dataset.player]=event.target.value;return;}
  if(field==='execution-player')mutate(s=>{recordExecution(s,event.target.value);addLog(s,event.target.value?'낮 처형 · '+playerName(s.players.find(p=>p.id===event.target.value)):'낮 처형 없음','player');});
  if(field==='other-day-death')mutate(s=>{const id=event.target.value;if(id){setLife(s,id,'died',{phase:'day',cause:'other'});logPlayer(s.players.find(p=>p.id===id),'처형 외 낮 사망');}});
  if(p&&field==='player-alive')mutate(s=>{const value=event.target.value;if(value==='dead-execution')recordExecution(s,p.id);else {setLife(s,p.id,value==='alive'?'alive':'died',{phase:value==='dead-day'?'day':'night',cause:value==='dead-demon'?'demon':'other',force:true});if(value==='dead-earlier'){p.diedNight=0;p.diedBeforeNight=null;}}logPlayer(p,({'alive':'생존으로 변경','dead-demon':'이번 밤 악마에게 사망','dead-tonight':'이번 밤 기타 사망','dead-execution':'지난 낮 처형 사망','dead-day':'지난 낮 기타 사망','dead-earlier':'이전 사망'})[value]);});
  if(p&&field==='player-alignment')mutate(()=>{p.alignment=event.target.value;logPlayer(p,`진영 ${p.alignment==='good'?'선':'악'}으로 변경`);});
  if(event.target.id==='import-file'){
    try{const file=event.target.files[0];if(!file)return;if(file.size>3_000_000)throw new Error('파일이 너무 큽니다.');const parsed=JSON.parse(await file.text());if(!validateStored(parsed))throw new Error('밤의 서재에서 저장한 게임 파일이 아닙니다.');if(!confirm('현재 게임을 저장 파일로 바꿀까요?'))return;history.push(structuredClone(state));state=parsed;view=state.phase==='setup'?'setup':'night';setupStep=state.setupStep||(state.players.some(p=>p.role)?3:1);currentKey=null;inspectedId=null;targeting=false;boardSelection=null;modal=null;persist();render();toast('저장한 게임을 불러왔어요.');}catch(error){toast(error.message||'게임 파일을 불러오지 못했어요.');}
  }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&modal)closeModal();
  if(event.key==='Tab'&&modal){const container=modalRoot,focusable=[...container.querySelectorAll('button:not([disabled]),input,textarea,select,a[href]')].filter(el=>el.offsetParent!==null);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
render();
if('serviceWorker' in navigator){let refreshed=false;const controlled=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controlled&&!refreshed){refreshed=true;location.reload();}});navigator.serviceWorker.register('./sw.js').catch(()=>toast('오프라인 저장을 사용할 수 없어요. 온라인으로는 계속 진행할 수 있습니다.'));}
