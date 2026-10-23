import { ROLES } from './data.js';
import { ROLE_MAP, TEAMS, distribution } from './game.js';
export function rosterRoles(state){return [...new Set((state.selectedRoles||state.players.map(p=>p.role)).filter(id=>ROLE_MAP[id]?.edition===state.edition))];}
export function compositionReport(state,ids=rosterRoles(state)){
  const base=distribution(state.count),actual=Object.keys(TEAMS).map(t=>ids.filter(id=>ROLE_MAP[id]?.team===t).length);
  let offsets=[(ids.includes('baron')?2:0)+(ids.includes('fanggu')?1:0)-(ids.includes('vigormortis')?1:0)];
  if(ids.includes('godfather'))offsets=offsets.flatMap(n=>[n-1,n+1]);
  const expected=offsets.map(offset=>{const outsiders=Math.max(0,base[1]+offset);return [base[0]-(outsiders-base[1]),outsiders,base[2],base[3]];});
  const ranges=base.map((_,i)=>({min:Math.min(...expected.map(a=>a[i])),max:Math.max(...expected.map(a=>a[i]))}));
  const warnings=Object.keys(TEAMS).flatMap((t,i)=>actual[i]>ranges[i].max?[TEAMS[t]+' '+actual[i]+'명 / 권장 '+ranges[i].max+'명 — '+(actual[i]-ranges[i].max)+'명 많습니다.']:[]);
  const complete=ids.length===state.count,valid=expected.some(a=>a.every((n,i)=>n===actual[i]));
  if(complete&&!valid&&!warnings.length)warnings.push('선택한 캐릭터 구성이 권장 구성과 다릅니다. 구성 변경 능력을 확인하세요.');
  return {actual,ranges,expected,warnings,valid,complete};
}
export function toggleRosterRole(state,id){
  if(ROLE_MAP[id]?.edition!==state.edition)return false;
  const ids=rosterRoles(state);
  if(ids.includes(id)){state.selectedRoles=ids.filter(r=>r!==id);for(const p of state.players)if(p.role===id){p.role=null;p.shownRole=null;p.abilityRole=null;}return true;}
  if(ids.length>=state.count)return false;
  state.selectedRoles=[...ids,id];state.bluffs=state.bluffs.filter(r=>r!==id);return true;
}
function roleFields(id){return {role:id,shownRole:null,abilityRole:null,alignment:['demon','minion'].includes(ROLE_MAP[id]?.team)?'evil':'good',used:false,abilityUsed:false,needsStartInfo:false};}
export function prepareAssignment(state){
  const ids=rosterRoles(state);if(ids.length!==state.count)return false;
  const assigned=new Set();for(const p of state.players){if(!ids.includes(p.role)||assigned.has(p.role)){Object.assign(p,roleFields(null));}else assigned.add(p.role);}
  const rest=ids.filter(id=>!assigned.has(id));for(const p of state.players)if(!p.role)Object.assign(p,roleFields(rest.shift()));state.selectedRoles=ids;return true;
}
export function assignRosterRole(state,playerId,id){
  if(!rosterRoles(state).includes(id))return false;const p=state.players.find(p=>p.id===playerId);if(!p||p.role===id)return false;
  const other=state.players.find(t=>t.id!==playerId&&t.role===id),old=p.role;
  if(other){const fields={role:p.role,shownRole:p.shownRole,abilityRole:p.abilityRole,alignment:p.alignment};const swap={role:other.role,shownRole:other.shownRole,abilityRole:other.abilityRole,alignment:other.alignment};Object.assign(p,swap);Object.assign(other,fields);}else Object.assign(p,roleFields(id));
  return true;
}
export function moveSetupPlayer(state,id,delta){const i=state.players.findIndex(p=>p.id===id),j=i+delta;if(state.phase!=='setup'||i<0||j<0||j>=state.count||![-1,1].includes(delta))return false;[state.players[i],state.players[j]]=[state.players[j],state.players[i]];state.players.forEach((p,n)=>{p.id='seat-'+(n+1);p.seat=n+1;});return true;}
export function renderComposition(state,helpers,ids=rosterRoles(state)){
  const {esc}=helpers,r=compositionReport(state,ids);return '<div class="roster-composition" aria-live="polite">'+Object.keys(TEAMS).map((t,i)=>'<span class="team-chip '+t+'">'+TEAMS[t]+' <b>'+r.actual[i]+' / '+(r.ranges[i].min===r.ranges[i].max?r.ranges[i].max:r.ranges[i].min+'–'+r.ranges[i].max)+'</b></span>').join('')+r.warnings.map(w=>'<p class="composition-warning" role="status">'+esc(w)+'</p>').join('')+(r.complete&&r.valid?'<p class="composition-ok">권장 구성과 일치합니다.</p>':'')+'</div>';
}
export function renderRoster(state,helpers,filter='all'){
  const {token,esc,button}=helpers,ids=rosterRoles(state);return '<section class="panel"><div class="panel-heading"><strong>사용할 캐릭터 '+ids.length+' / '+state.count+'</strong></div><div class="panel-body"><p class="muted-copy">이번 게임에 실제로 등장할 캐릭터를 '+state.count+'개 고르세요. 주정뱅이는 실제 역할인 주정뱅이를 선택합니다.</p>'+renderComposition(state,helpers)+'<div class="filter-row">'+[['all','전체'],...Object.entries(TEAMS)].map(([id,label])=>button('roster-filter',label,'small '+(filter===id?'primary':'ghost'),'data-filter="'+id+'"')).join('')+'</div><div class="role-roster">'+ROLES.filter(r=>r.edition===state.edition&&(filter==='all'||r.team===filter)).map(r=>'<button class="roster-card '+(ids.includes(r.id)?'selected':'')+'" data-action="roster-toggle" data-role="'+r.id+'" aria-pressed="'+ids.includes(r.id)+'" aria-label="'+esc(r.ko)+' '+(ids.includes(r.id)?'선택 해제':'선택')+'">'+token(r.id)+'<strong>'+esc(r.ko)+'</strong><span>'+TEAMS[r.team]+'</span><small>'+esc(r.summary)+'</small></button>').join('')+'</div></div></section><div class="footer-action">'+button('setup-back','이전','ghost')+button('roster-next','이름·배치로 이동','primary',ids.length===state.count?'':'disabled')+'</div>';
}
export function renderAssignments(state,helpers){
  const {token,esc,button,playerName}=helpers;return '<section class="panel"><div class="panel-body"><p class="muted-copy">이름이나 별명을 입력하고 받은 캐릭터를 연결하세요. 다른 사람의 캐릭터를 고르면 서로 바뀝니다. 화면의 자리 모양과 관계없이 이름으로 찾을 수 있습니다.</p><p class="muted-copy">이웃 능력 판정을 위해 실제 앉은 순서대로 정렬하세요. 첫 사람을 정하고 한 방향으로 돌아가며 위·아래 버튼으로 맞춥니다.</p>'+renderComposition(state,helpers,state.players.map(p=>p.role))+'<details class="bulk-names"><summary>이름 한 번에 입력</summary><label class="field-label" for="bulk-names">한 줄에 한 명씩, 자리 순서대로 입력</label><textarea id="bulk-names" aria-label="이름 한 번에 입력" placeholder="민수&#10;지영&#10;서연"></textarea>'+button('apply-names','이름 적용','ghost')+'</details><div class="assignment-list">'+state.players.map((p,i)=>'<div class="assignment-row"><div class="assignment-identity"><span class="seat-order">'+(i+1)+'</span><label><span class="field-label">이름·별명</span><input class="input" data-field="setup-name" data-player="'+p.id+'" maxlength="30" aria-label="'+(i+1)+'번째 참가자 이름" value="'+esc(p.name)+'" placeholder="이름 입력"></label></div>'+button('assign-role',token(p.role)+'<span>'+esc(ROLE_MAP[p.role]?.ko||'캐릭터 선택')+'</span>','assignment-character','data-player="'+p.id+'" aria-label="'+esc(playerName(p))+' 캐릭터 변경"')+'<div class="assignment-order">'+button('move-player','↑','ghost small','data-player="'+p.id+'" data-delta="-1" aria-label="'+esc(playerName(p))+' 위로" '+(!i?'disabled':''))+button('move-player','↓','ghost small','data-player="'+p.id+'" data-delta="1" aria-label="'+esc(playerName(p))+' 아래로" '+(i===state.count-1?'disabled':''))+'</div>'+(['drunk','lunatic'].includes(p.role)?'<div class="assignment-shown">'+button('shown-role','본인에게 알려준 역할: '+esc(ROLE_MAP[p.shownRole]?.ko||'선택 필요'),'ghost full-width','data-player="'+p.id+'"')+'</div>':'')+'</div>').join('')+'</div></div></section>';
}
