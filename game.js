import { ROLES, NIGHT_ORDER } from './data.js';
import { conditionalReady } from './life.js';
import {effectiveStatuses} from './effects.js';
import {START_INFO} from './mechanics.js';
export const EDITIONS = [
  { id: 'tb', name: 'Trouble Brewing', label: '의심의 시작', tag: '입문', color: '#b96d59', desc: '정보를 모으고, 거짓말을 찾아내는 첫 번째 밤.', symbol: 'tower' },
  { id: 'bmr', name: 'Bad Moon Rising', label: '불길한 달', tag: '중급', color: '#b18d4e', desc: '죽음과 생존 사이, 예측할 수 없는 밤.', symbol: 'moon' },
  { id: 'snv', name: 'Sects & Violets', label: '비밀과 제비꽃', tag: '상급', color: '#a28cbd', desc: '변하는 정체와 뒤틀린 정보 속에서.', symbol: 'flower' }
];
export const TEAMS = { townsfolk: '마을주민', outsider: '외지인', minion: '하수인', demon: '악마' };
export const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.id, r]));
export function freshState(edition = 'tb', count = 8) {
  return { version: 1, edition, count, phase: 'setup', night: 1, setupStep:1, selectedRoles:[], effects:[], seatOrder:null, boardPositions:null, pendingSweethearts:[], pendingRedHerring:false, notifications:[], twins:[], fangGuJumpUsed:false, mastermindNight:null, arbitraryDeathsNight:null, redHerringId:null, abnormalPlayers:null, players: Array.from({ length: count }, (_, i) => freshPlayer(i)), completed: [], actions: {}, pastNights: [], day: {night:1,execution:null}, log: [], bluffs: [], betweenNote: '', savedAt: null };
}
export function freshPlayer(index) {
  return { id: `seat-${index + 1}`, seat: index + 1, name: '', role: null, shownRole: null, abilityRole: null, alignment: 'good', alive: true, ghostVoteUsed:false, diedNight: null, statuses: [], used: false, abilityUsed: false, needsStartInfo: false, memo: '' };
}
export function changeCount(state, count) {
  if (!Number.isInteger(count) || count < 5 || count > 15) return state;
  return { ...state, count, seatOrder: null, boardPositions: null, players: Array.from({ length: count }, (_, i) => state.players[i] || freshPlayer(i)) };
}
export function distribution(count) {
  return ({ 5: [3,0,1,1], 6: [3,1,1,1], 7: [5,0,1,1], 8: [5,1,1,1], 9: [5,2,1,1], 10: [7,0,2,1], 11: [7,1,2,1], 12: [7,2,2,1], 13: [9,0,3,1], 14: [9,1,3,1], 15: [9,2,3,1] })[count];
}
export function roleCounts(state) {
  return Object.keys(TEAMS).map(t => state.players.filter(p => ROLE_MAP[p.role]?.team === t).length);
}
export function setupWarnings(state) {
  const warnings = [];
  if (state.edition !== 'tb' && state.count < 7) warnings.push('이 버전은 7명 이상 진행을 권장합니다.');
  const actual = roleCounts(state), expected = [...distribution(state.count)],chosen=new Set(state.players.map(p=>p.role));
  let outsiders=expected[1]+(chosen.has('baron')?2:0)+(chosen.has('fanggu')?1:0)-(chosen.has('vigormortis')?1:0);outsiders=Math.max(0,outsiders);
  const outsiderOptions=chosen.has('godfather')?[Math.max(0,outsiders-1),outsiders+1]:[outsiders];
  const validComposition=outsiderOptions.some(n=>actual[1]===n&&actual[0]===state.count-n-expected[2]-expected[3]&&actual[2]===expected[2]&&actual[3]===expected[3]);
  if (!validComposition) warnings.push('기본 인원 구성과 다릅니다. 남작·대부·악마 등의 구성 변경 능력을 확인하세요.');
  if (state.players.filter(p => ROLE_MAP[p.role]?.team === 'demon').length !== 1) warnings.push('악마 수가 1명이 아닙니다. 의도한 구성인지 확인하세요.');
  if (state.players.some(p => ['drunk','lunatic'].includes(p.role) && !p.shownRole)) warnings.push('주정뱅이·광인에게 알려준 캐릭터를 지정하세요.');
  return warnings;
}
export function actingRole(player) {
  return player.abilityRole || player.simulatedAbilityRole || (['drunk','lunatic'].includes(player.role) ? player.shownRole || player.role : player.role);
}
const ONCE = new Set(['courtier', 'professor', 'seamstress', 'philosopher', 'assassin']);
const DEATH_TRIGGERS = new Set(['ravenkeeper', 'sage', 'barber', 'sweetheart', 'moonchild']);
export function nightQueue(state) {
  const order = state.night === 1 ? NIGHT_ORDER.firstNight : NIGHT_ORDER.otherNight;
  const entries = [];
  for (const [position, id] of order.entries()) {
    if (['dusk', 'dawn'].includes(id)) continue;
    if (['minioninfo','demoninfo'].includes(id)) {
      if (state.night === 1 && state.count >= 7) entries.push({ key: id, roleId: id, position, playerId: null, kind: 'info' });
      continue;
    }
    for (const player of state.players) {
      // Lunatic has its own information/target relay step. Its first-night Pukka action is separate.
      const effective = actingRole(player);
      const match = player.role === 'lunatic' ? id === 'lunatic' : id === effective;
      if (!match) continue;
      const key = `${player.id}:${id}`;
      if (!conditionalReady(state,player,id)) continue;
      if (!state.completed.includes(key)) {
        if(player.revivedNight===state.night&&position<=player.revivedAtPosition)continue;
        if (!player.alive && !DEATH_TRIGGERS.has(id) && !effectiveStatuses(state,player).includes('사망 후 능력 유지')) continue;
        if(player.changedNight===state.night&&position<=player.changedAtPosition&&!(player.needsStartInfo&&START_INFO.has(id)))continue;
      }
      if (ONCE.has(id) && (player.abilityRole||player.simulatedAbilityRole ? player.abilityUsed : player.used) && !state.completed.includes(key)) continue;
      const role = ROLE_MAP[id];
      if (!role) continue;
      if(id==='scarletwoman')continue;
      entries.push({ key, roleId: id, position, playerId: player.id, kind: DEATH_TRIGGERS.has(id) || ['gossip','godfather','zombuul','juggler','grandmother'].includes(id) ? 'conditional' : 'action' });
    }
  }
  for (const player of state.players) {
    const role = ROLE_MAP[actingRole(player)];
    if (player.needsStartInfo && player.alive && START_INFO.has(role?.id) && !player.noAttackNight) {
      const existing=entries.find(e=>e.playerId===player.id&&e.roleId===role.id);
      if(existing&&!state.completed.includes(existing.key)&&(state.night===1||!role.otherNightReminder)){existing.reminderKind='first';existing.kind='start';}
      else {
        const pos=player.changedNight===state.night&&Number.isInteger(player.changedAtPosition)&&player.changedAtPosition>=0?player.changedAtPosition:player.revivedNight===state.night&&Number.isInteger(player.revivedAtPosition)&&player.revivedAtPosition>=0?player.revivedAtPosition:-1;
        entries.unshift({ key: `${player.id}:${role.id}:start${player.startVersion?':'+player.startVersion:''}`, roleId: role.id, position: pos, playerId: player.id, kind: 'start', reminderKind: 'first' });
      }
    }
  }
  // Keep changed characters' completed records visible without scheduling the new role twice.
  for(const key of state.completed){if(entries.some(e=>e.key===key))continue;const [playerId,roleId]=key.split(':');if(ROLE_MAP[roleId]&&state.actions[key]?.mechanicsApplied)entries.push({key,roleId,playerId,position:order.indexOf(roleId),kind:'record'});}
  entries.sort((a,b)=>a.position-b.position);
  return entries;
}
export function addLog(state, text, type = 'note') {
  state.log.unshift({ id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, night: state.night, text, type, at: new Date().toISOString() });
}
export function nextNight(state) {
  const next = structuredClone(state);
  addLog(next, `${next.night}번째 밤 종료`, 'phase');
  next.night += 1;
  next.phase = 'between';
  next.pastNights ||= [];
  next.pastNights.push({night:state.night,actions:structuredClone(state.actions),completed:[...state.completed],day:structuredClone(state.day||null)});
  next.completed = [];
  next.actions = {};
  next.abnormalPlayers=null;
  next.players.forEach(p=>{p.noAttackNight=null;});
  next.day = {night:next.night,execution:null};
  next.executionDeaths = [];
  return next;
}
export function validateStored(value) {
  const strings=v=>Array.isArray(v)&&v.every(s=>typeof s==='string');
  const validLife=b=>b&&typeof b==='object'&&!Array.isArray(b)&&typeof b.alive==='boolean'&&['used','abilityUsed','needsStartInfo','wasRegistered','ghostVoteUsed'].every(k=>b[k]==null||typeof b[k]==='boolean')&&(!Object.hasOwn(b,'ghostVoteUsed')||typeof b.ghostVoteUsed==='boolean')&&['diedNight','diedBeforeNight','roleStartedNight','revivedNight','revivedAtPosition'].every(k=>b[k]==null||Number.isInteger(b[k]))&&(b.deathPhase==null||['day','night'].includes(b.deathPhase));
  const validAction=a=>a&&Array.isArray(a.targets)&&a.targets.every(id=>value.players.some(p=>p.id===id))&&typeof a.result==='string'&&typeof a.note==='string'
    &&(['drunkTarget','successor','poisonNeighbor','regurgitate','barberDemon','mayorRedirect','arbitraryDeath'].every(k=>a[k]==null||a[k]===''||value.players.some(p=>p.id===a[k])))
    &&(!Object.hasOwn(a,'mechanicsApplied')||typeof a.mechanicsApplied==='boolean')
    &&(!a.mechanicSummary||strings(a.mechanicSummary))
    &&(!Object.hasOwn(a,'characters')||(Array.isArray(a.characters)&&a.characters.every(id=>typeof id==='string'&&ROLE_MAP[id])&&new Set(a.characters).size===a.characters.length))
    &&(!Object.hasOwn(a,'choice')||typeof a.choice==='string')
    &&(!Object.hasOwn(a,'poisonApplied')||typeof a.poisonApplied==='boolean')
    &&(!Object.hasOwn(a,'infoStep')||(Number.isInteger(a.infoStep)&&a.infoStep>=0&&a.infoStep<4))
    &&(!a.lifeResults||(typeof a.lifeResults==='object'&&!Array.isArray(a.lifeResults)&&Object.entries(a.lifeResults).every(([id,outcome])=>value.players.some(p=>p.id===id)&&['died','alive','registers-dead','unchanged'].includes(outcome))))
    &&(!a.lifeChanges||(Array.isArray(a.lifeChanges)&&a.lifeChanges.every(c=>c&&value.players.some(p=>p.id===c.playerId)&&validLife(c.before))))
    &&(!a.wakeFacts||(typeof a.wakeFacts==='object'&&!Array.isArray(a.wakeFacts)&&Object.values(a.wakeFacts).every(v=>typeof v==='boolean')))
    &&(!a.baseline||((a.baseline.value===null||typeof a.baseline.value==='string')&&strings(a.baseline.impaired)&&strings(a.baseline.exceptions)));
  return value && value.version === 1 && EDITIONS.some(e => e.id === value.edition)
    && Number.isInteger(value.count) && value.count >= 5 && value.count <= 15
    && Number.isInteger(value.night) && value.night >= 1
    && ['setup','night','between'].includes(value.phase)
    && Array.isArray(value.players) && value.players.length === value.count
    && value.players.every((p,i) => p.id === `seat-${i+1}` && p.seat === i+1 && (!p.role || ROLE_MAP[p.role]) && (!p.shownRole || ROLE_MAP[p.shownRole]) && (!p.abilityRole || ROLE_MAP[p.abilityRole]) && Array.isArray(p.statuses) && p.statuses.every(s=>typeof s==='string' && s.length<=80) && ['good','evil'].includes(p.alignment) && typeof p.alive === 'boolean' && typeof p.name==='string' && typeof p.memo==='string')
    && value.players.every(p=>!Object.hasOwn(p,'ignoredEffects')||(Array.isArray(p.ignoredEffects)&&p.ignoredEffects.every(k=>typeof k==='string'&&k.length<200)))
    && value.players.every(p=>!Object.hasOwn(p,'ghostVoteUsed')||typeof p.ghostVoteUsed==='boolean')
    && (!value.seatOrder||(strings(value.seatOrder)&&value.seatOrder.length===value.count&&new Set(value.seatOrder).size===value.count&&value.seatOrder.every(id=>value.players.some(p=>p.id===id))))
    && (!value.boardPositions||(typeof value.boardPositions==='object'&&!Array.isArray(value.boardPositions)&&Object.entries(value.boardPositions).every(([id,pos])=>value.players.some(p=>p.id===id)&&pos&&Number.isFinite(pos.x)&&Number.isFinite(pos.y)&&pos.x>=0&&pos.x<=100&&pos.y>=0&&pos.y<=100)))
    && (!value.effects||(Array.isArray(value.effects)&&value.effects.every(e=>e&&typeof e.key==='string'&&ROLE_MAP[e.roleId]&&typeof e.status==='string'&&e.status.length<80&&value.players.some(p=>p.id===e.playerId)&&value.players.some(p=>p.id===e.targetId)&&(e.throughNight==null||Number.isInteger(e.throughNight)))))
    && (!value.notifications||strings(value.notifications))
    && (!value.pendingSweethearts||(strings(value.pendingSweethearts)&&value.pendingSweethearts.every(id=>value.players.some(p=>p.id===id))))
    && (!value.twins||(Array.isArray(value.twins)&&value.twins.every(pair=>pair&&['evilId','goodId'].every(k=>value.players.some(p=>p.id===pair[k])))))
    && (!Object.hasOwn(value,'selectedRoles')||(Array.isArray(value.selectedRoles)&&value.selectedRoles.every(id=>ROLE_MAP[id]?.edition===value.edition)&&new Set(value.selectedRoles).size===value.selectedRoles.length))
    && (!Object.hasOwn(value,'setupStep')||[1,2,3].includes(value.setupStep))
    && value.players.every(p=>(p.deathPhase==null||['day','night'].includes(p.deathPhase))&&(p.diedBeforeNight==null||(Number.isInteger(p.diedBeforeNight)&&p.diedBeforeNight>=1))&&(p.diedNight==null||(Number.isInteger(p.diedNight)&&p.diedNight>=0)))
    && (!value.day||(Number.isInteger(value.day.night)&&(!value.day.execution||(value.players.some(p=>p.id===value.day.execution.playerId)&&ROLE_MAP[value.day.execution.roleId]&&['died','survived','already-dead','registers-dead'].includes(value.day.execution.outcome)&&(!value.day.execution.before||validLife(value.day.execution.before))))))
    && Array.isArray(value.completed) && value.completed.every(k=>typeof k==='string')
    && value.actions && typeof value.actions === 'object' && !Array.isArray(value.actions)
    && Object.values(value.actions).every(validAction)
    && (!value.pastNights||(Array.isArray(value.pastNights)&&value.pastNights.every(n=>n&&Number.isInteger(n.night)&&n.actions&&typeof n.actions==='object'&&!Array.isArray(n.actions)&&Object.values(n.actions).every(validAction)&&strings(n.completed))))
    && Array.isArray(value.log) && value.log.every(l=>l && typeof l.text==='string' && typeof l.at==='string' && Number.isInteger(l.night))
    && Array.isArray(value.bluffs) && value.bluffs.length<=3 && value.bluffs.every(id=>ROLE_MAP[id]);
}
