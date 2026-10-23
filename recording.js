import { ROLE_MAP, addLog } from './game.js';
import { selectionError, selectionResult } from './abilities.js';
import { information } from './information.js';
import { applyLifeResolution, restoreLifeChanges,lifeResolution } from './life.js';
import {mechanicError,applyMechanics,triggerGoon,healthy,abilityOf,reconcileTwins} from './mechanics.js';

const ONCE = new Set(['courtier', 'professor', 'seamstress', 'philosopher', 'assassin']);
const playerLabel = player => `${player.seat}번${player.name ? ` ${player.name}` : ''}`;

// Records a storyteller decision. Poisoner and Pukka choices also supply their poison markers to the shared effect resolver.
// An empty return value means success; an error leaves the game untouched.
export function recordAction(state, q, action = {}, skipped = false) {
  if (!q?.key || (!ROLE_MAP[q.roleId] && !['minioninfo', 'demoninfo'].includes(q.roleId))) return '처리할 캐릭터를 선택하세요.';
  const targets = action.targets || [];
  if (!Array.isArray(targets) || targets.some(id => !state.players.some(p => p.id === id)) || new Set(targets).size !== targets.length) return '그리모어에서 서로 다른 대상을 선택하세요.';
  if (Object.hasOwn(action, 'characters') && (!Array.isArray(action.characters) || action.characters.some(id => !ROLE_MAP[id]) || new Set(action.characters).size !== action.characters.length)) return '알려줄 캐릭터를 다시 선택하세요.';
  if (Object.hasOwn(action, 'choice') && typeof action.choice !== 'string') return '능력 결과를 버튼으로 다시 선택하세요.';
  if(action.lifeResults&&(typeof action.lifeResults!=='object'||Array.isArray(action.lifeResults)||Object.entries(action.lifeResults).some(([id,result])=>!state.players.some(p=>p.id===id)||!['died','alive','registers-dead','unchanged'].includes(result))))return '사망·부활 결과를 다시 선택하세요.';
  if (!skipped) {
    const error = selectionError(state, q, action);
    if (error) return error;
    const mechanical=mechanicError(state,q,action);if(mechanical)return mechanical;
  }
  if(state.actions[q.key]?.mechanicsApplied)return '이미 반영한 행동입니다. 변경하려면 상단 되돌리기로 취소하세요.';
  const originalActor=state.players.find(p=>p.id===q.playerId),actorRole=originalActor?.role,actorAlignment=originalActor?.alignment;
  const mechanicalBefore=JSON.stringify({roles:state.players.map(p=>[p.role,p.alignment,p.id===q.playerId?null:p.used,p.id===q.playerId?null:p.abilityUsed,p.goonNight]),effects:state.effects,pending:state.pendingSweethearts});
  const planning=structuredClone(state);restoreLifeChanges(planning,q);
  const plan=!skipped?lifeResolution(planning,q,action,originalActor?!healthy(planning,planning.players.find(p=>p.id===q.playerId)):false):null;
  let goonTriggered=false;
  if(!skipped&&!plan)for(const id of targets)goonTriggered=triggerGoon(state,q,id)||goonTriggered;
  const stored = structuredClone({ ...action, targets, result: skipped ? '' : selectionResult(state, q, action), note: typeof action.note === 'string' ? action.note : '', skipped: !!skipped, baseline: information(state, q, action) });
  if(goonTriggered)stored.goonTriggered=true;
  if (['poisoner', 'pukka'].includes(q.roleId)) {
    const previous = state.actions[q.key];
    stored.poisonApplied = !skipped && !(goonTriggered || plan?.goonTargets?.length) && (previous && !previous.skipped && typeof previous.poisonApplied === 'boolean' ? previous.poisonApplied : !stored.baseline.impaired.length);
  }
  restoreLifeChanges(state,q);
  const simpleEffect={monk:'보호',innkeeper:'보호',devilsadvocate:'처형 보호',witch:'저주',cerenovus:'광기'}[q.roleId];
  if(simpleEffect){
    for(const p of state.players){const source=p.effectSources?.[simpleEffect];if(source?.playerId===q.playerId&&source.roleId===q.roleId&&source.night===state.night){p.statuses=p.statuses.filter(s=>s!==simpleEffect);delete p.effectSources[simpleEffect];}}
    if(!skipped&&!stored.baseline.impaired.length)for(const id of targets){const p=state.players.find(p=>p.id===id);if(!p.statuses.includes(simpleEffect))p.statuses.push(simpleEffect);p.effectSources||={};p.effectSources[simpleEffect]={playerId:q.playerId,roleId:q.roleId,night:state.night,...(q.roleId==='cerenovus'?{characterId:stored.characters[0]}:{})};}
  }
  state.actions[q.key] = stored;
  if(!skipped&&plan){stored.lifeResults||={...plan.outcomes};stored.fangGuJump=plan.fangGuJump;stored.fangGuTarget=plan.fangGuTarget;stored.goonTriggered||=plan.goonTargets?.length>0;stored.lifeChanges=applyLifeResolution(state,q,stored.lifeResults,plan,stored);}
  else if(!skipped&&stored.lifeResults)stored.lifeChanges=applyLifeResolution(state,q,stored.lifeResults);
  if(q.roleId==='pukka'&&!skipped&&!stored.baseline.impaired.length&&stored.lifeResults){const previous=[...(state.pastNights||[])].sort((a,b)=>b.night-a.night).find(n=>n.completed.includes(q.key)&&n.actions[q.key]&&!n.actions[q.key].skipped&&n.actions[q.key].poisonApplied!==false&&!n.actions[q.key].baseline?.impaired?.length);for(const id of previous?.actions[q.key]?.targets||[])if(targets.includes(id)){const p=state.players.find(p=>p.id===id);p.ignoredEffects=[...new Set([...(p.ignoredEffects||[]),`pukka:${q.playerId}:${state.night}:${id}`])];}}
  if (!state.completed.includes(q.key)) state.completed.push(q.key);
  if(q.roleId==='pukka'&&stored.lifeChanges?.length){for(const c of stored.lifeChanges)if(c.outcome==='died'){const v=state.players.find(p=>p.id===c.playerId);if(v&&v.abilityAtDeath!=='sweetheart')v.healthyAtDeath=healthy(state,v);}}
  const actor = state.players.find(p => p.id === q.playerId);
  if (actor && q.kind === 'start') actor.needsStartInfo = false;
  if (actor && ONCE.has(q.roleId) && !skipped) {
    if (actor.abilityRole === q.roleId||actor.simulatedAbilityRole===q.roleId) actor.abilityUsed = true;
    else actor.used = true;
  }
  if(!skipped)applyMechanics(state,q,stored,{normal:!stored.baseline.impaired.length&&!['drunk','lunatic'].includes(actorRole)&&(!['barber','sweetheart'].includes(q.roleId)||originalActor?.healthyAtDeath!==false)&&(!stored.goonTriggered||q.roleId==='assassin'),actorRole,actorAlignment});
  if(plan&&mechanicalBefore!==JSON.stringify({roles:state.players.map(p=>[p.role,p.alignment,p.id===q.playerId?null:p.used,p.id===q.playerId?null:p.abilityUsed,p.goonNight]),effects:state.effects,pending:state.pendingSweethearts})){stored.mechanicsApplied=true;stored.mechanicSummary||=['사망과 연결된 능력까지 반영했습니다.'];}
  reconcileTwins(state);
  const roleName = ROLE_MAP[q.roleId]?.ko || (q.roleId === 'minioninfo' ? '하수인 시작 정보' : '악마 시작 정보');
  const targetNames = targets.map(id => playerLabel(state.players.find(p => p.id === id))).join(' · ');
  const parts = [`${actor ? `${playerLabel(actor)} ` : ''}${roleName}${skipped ? ' · 건너뜀' : ''}`];
  if (!skipped && targetNames) parts.push(`대상 ${targetNames}`);
  if (!skipped && stored.result && stored.result !== targetNames) parts.push(stored.result);
  if(!skipped&&stored.lifeChanges?.length)parts.push(stored.lifeChanges.map(change=>`${playerLabel(state.players.find(p=>p.id===change.playerId))} ${change.outcome==='alive'?'부활':change.outcome==='registers-dead'?'사망으로 표시':'사망'}`).join(' · '));
  if (stored.note) parts.push(`메모: ${stored.note}`);
  addLog(state, parts.join(' · '), skipped ? 'skip' : 'action');
  return '';
}
