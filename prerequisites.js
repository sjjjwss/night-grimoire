import {ROLES} from './data.js';
const roles=Object.fromEntries(ROLES.map(r=>[r.id,r]));
export function validBluffIds(state){
  const unavailable=new Set(state.players.flatMap(p=>[p.role,p.shownRole,p.abilityRole]).filter(Boolean));
  return ROLES.filter(r=>r.edition===state.edition&&['townsfolk','outsider'].includes(r.team)&&!unavailable.has(r.id)).map(r=>r.id);
}
export function bluffError(state){
  if(state.count<7)return '';
  const available=new Set(validBluffIds(state));
  return state.bluffs.length!==3||new Set(state.bluffs).size!==3||state.bluffs.some(id=>!available.has(id))
    ?'시작 전에 등장하지 않는 선한 캐릭터 3개를 블러프로 고르세요.':'';
}
export function needsRedHerring(state){return state.players.some(p=>p.role==='fortuneteller'||p.shownRole==='fortuneteller'||p.abilityRole==='fortuneteller');}
export function setRedHerring(state,id){
  const p=state.players.find(p=>p.id===id);
  if(!p||p.alignment!=='good')return false;
  state.players.forEach(t=>t.statuses=t.statuses.filter(s=>s!=='미끼'));
  p.statuses.push('미끼');state.redHerringId=id;return true;
}
export function prerequisiteError(state){
  if(needsRedHerring(state)&&state.players.filter(p=>p.statuses.includes('미끼')&&p.alignment==='good').length!==1)return '예언자의 미끼가 될 선한 참가자 1명을 고르세요.';
  return '';
}
export function renderPrerequisites(state,{esc,token,playerName}){
  if(!needsRedHerring(state))return '';
  return '<section class="panel setup-prerequisites"><div class="panel-body"><h2>예언자 · 미끼 지정</h2><p>악마로 감지될 선한 참가자 1명. 예언자 본인도 가능합니다.</p><div class="setup-person-options">'+state.players.filter(p=>p.alignment==='good').map(p=>'<button class="button ghost '+(p.statuses.includes('미끼')?'selected':'')+'" data-action="red-herring" data-player="'+p.id+'" aria-pressed="'+p.statuses.includes('미끼')+'">'+token(p.role)+'<span>'+esc(playerName(p))+'<small>'+esc(roles[p.role]?.ko||'')+'</small></span>'+(p.statuses.includes('미끼')?'✓':'')+'</button>').join('')+'</div></div></section>';
}
