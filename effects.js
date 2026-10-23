import { ROLES } from './data.js';
import { seatedPlayers } from './layout.js';

const roles = Object.fromEntries(ROLES.map(role => [role.id, role]));
const effectiveRole = player => player.abilityRole || player.role;
const impairedText = status => /중독|취함/.test(status);
const sourcedMarkers={monk:['보호'],innkeeper:['보호','취함'],devilsadvocate:['처형 보호'],witch:['저주'],cerenovus:['광기'],sailor:['취함']};
function managedManual(player,status){
  const source=player.effectSources?.[status];
  if(!source||!sourcedMarkers[source.roleId]?.includes(status)||!Number.isInteger(source.night))return null;
  return {...source,key:`marker:${source.roleId}:${source.playerId}:${source.night}:${player.id}:${status}`,targetId:player.id,status,throughNight:source.night};
}

function manualStatuses(state, player) {
  return player.statuses.filter(status => {
    if(managedManual(player,status))return false;
    const source = player.effectSources?.[status];
    // Older saved games used a manual Poisoner marker. Give it the same expiry.
    if (status === '중독' && source?.roleId === 'poisoner' && Number.isInteger(source.night)) {
      return source.night === state.night || (state.phase === 'between' && source.night === state.night - 1);
    }
    return true;
  });
}

export function townsfolkNeighbors(state, playerId) {
  const seated=seatedPlayers(state),index = seated.findIndex(player => player.id === playerId), found = [];
  if (index < 0) return found;
  // No Dashii skips non-Townsfolk, including the Drunk, but does not skip the dead.
  for (const direction of [-1, 1]) for (let step = 1; step < state.count; step++) {
    const player = seated[(index + direction * step + state.count) % state.count];
    if (roles[player.role]?.team === 'townsfolk') {
      if (!found.includes(player.id)) found.push(player.id);
      break;
    }
  }
  return found;
}

function decisions(state, player, roleId) {
  const key = `${player.id}:${roleId}`;
  return [{ night: state.night, actions: state.actions, completed: state.completed }, ...(state.pastNights || []).slice().sort((a, b) => b.night - a.night)]
    .filter(night => night.completed.includes(key) && night.actions[key] && !night.actions[key].skipped)
    .map(night => ({ night: night.night, action: night.actions[key] }));
}

function candidates(state) {
  if (state.phase === 'setup') return [];
  const effects = [...(state.effects||[]),...state.players.flatMap(p=>p.statuses.map(s=>managedManual(p,s)).filter(Boolean))].filter(e=>(e.throughNight==null||state.night<=e.throughNight||(state.phase==='between'&&state.night===e.throughNight+1))&&(!e.heldMinionId||roles[state.players.find(p=>p.id===e.heldMinionId)?.role]?.team==='minion')).map(e=>({...e}));
  for(const p of state.players)if(p.role==='philosopher'&&p.abilityRole)for(const target of state.players.filter(t=>t.id!==p.id&&t.role===p.abilityRole))effects.push({key:'philosopher:'+p.id+':'+target.id,playerId:p.id,roleId:'philosopher',targetId:target.id,status:'취함',actualRole:true});
  const add = (player, roleId, targetId, night) => effects.push({ key: `${roleId}:${player.id}:${night}:${targetId}`, playerId: player.id, roleId, targetId, night, status: '중독' });
  for (const player of state.players) {
    const roleId = effectiveRole(player);
    if (!['poisoner', 'pukka', 'nodashii'].includes(roleId) || ['drunk', 'lunatic'].includes(player.role)) continue;
    if (roleId === 'nodashii') {
      townsfolkNeighbors(state, player.id).forEach(targetId => add(player, roleId, targetId, 0));
      continue;
    }
    const decision = decisions(state, player, roleId).find(({ night, action }) => {
      if (roleId === 'poisoner' && night !== state.night && !(state.phase === 'between' && night === state.night - 1)) return false;
      return action.poisonApplied !== false && !(action.poisonApplied === undefined && action.baseline?.impaired?.length);
    });
    if (decision) decision.action.targets.forEach(targetId => add(player, roleId, targetId, decision.night));
  }
  return effects;
}

function active(state, effect, all, visiting = new Set()) {
  const source = state.players.find(player => player.id === effect.playerId), target = state.players.find(player => player.id === effect.targetId);
  if (!source || !target || target.ignoredEffects?.includes(effect.key)) return false;
  if (visiting.has(effect.key)) return false;
  const next = new Set(visiting).add(effect.key);
  if(effect.unconditional)return true;
  const kept=all.some(e=>e.status==='사망 후 능력 유지'&&e.targetId===source.id&&active(state,e,all,next));
  if ((!source.alive && !source.statuses.includes('사망 후 능력 유지')&&!kept&&!effect.survivesDeath) || (effect.actualRole?source.role:effectiveRole(source)) !== effect.roleId || source.role === 'drunk') return false;
  if (manualStatuses(state, source).some(impairedText)) return false;
  if (all.some(other => other.key !== effect.key && impairedText(other.status) && other.targetId === source.id && active(state, other, all, next))) return false;
  if (roles[effect.roleId]?.team === 'demon') {
    if (target.role === 'soldier' && !manualStatuses(state, target).some(impairedText)) return false;
    if(all.some(other=>other.status==='보호'&&other.roleId==='monk'&&other.targetId===target.id&&active(state,other,all,next)))return false;
  }
  return true;
}

export function poisonEffects(state, player) {
  if (!player) return [];
  const all = candidates(state);
  return all.filter(effect => effect.status==='중독'&&effect.targetId === player.id && active(state, effect, all));
}

export function effectiveStatuses(state, player) {
  if (!player) return [];
  const all=candidates(state);
  const statuses=[...manualStatuses(state,player),...all.filter(e=>e.targetId===player.id&&active(state,e,all)).map(e=>e.status)];
  for(const pair of state.twins||[]){
    const evil=state.players.find(p=>p.id===pair.evilId);
    if(evil&&effectiveRole(evil)==='eviltwin'&&player.id===pair.goodId){
      const kept=all.some(e=>e.status==='사망 후 능력 유지'&&e.targetId===evil.id&&active(state,e,all));
      const evilImpaired=manualStatuses(state,evil).some(impairedText)||all.some(e=>impairedText(e.status)&&e.targetId===evil.id&&active(state,e,all));
      if((evil.alive||evil.statuses.includes('사망 후 능력 유지')||kept)&&!evilImpaired&&!statuses.includes('쌍둥이'))statuses.push('쌍둥이');
    }
  }
  if(state.players.filter(p=>p.alive&&!p.statuses.includes('죽은 것으로 감지')).length<=3)return [...new Set(statuses.filter(s=>s!=='저주'))];
  return [...new Set(statuses)];
}

export function effectSources(state, player, status = '중독') {
  const all=candidates(state),list=all.filter(e=>e.status===status&&e.targetId===player.id&&active(state,e,all));
  const manual = player.effectSources?.[status];
  if (manual && effectiveStatuses(state, player).includes(status) && !list.some(effect => effect.playerId === manual.playerId && effect.roleId === manual.roleId)) list.push(manual);
  return list;
}

export function toggleStatus(state, player, status) {
  if (effectiveStatuses(state, player).includes(status)) {
    const automatic = effectSources(state,player,status);
    player.ignoredEffects = [...new Set([...(player.ignoredEffects || []), ...automatic.map(effect => effect.key)])];
    player.statuses = player.statuses.filter(value => value !== status);
    if (player.effectSources) delete player.effectSources[status];
  } else {
    player.statuses.push(status);
  }
}
