import { ROLES } from './data.js';
import { appearsDead } from './life.js';

const roleNames = Object.fromEntries(ROLES.map(role => [role.id, role.ko]));

// Ghost votes belong to a death, not a day: only explicit use consumes one.
export function voteStatus(player) {
  const dead = appearsDead(player);
  const used = dead && player.ghostVoteUsed === true;
  return {
    key: !dead ? 'alive' : used ? 'ghost-used' : 'ghost-available',
    dead,
    available: !used,
    ghost: dead,
    used,
    label: !dead ? '생존 · 투표 가능' : used ? '사망 · 유령표 사용 완료' : '사망 · 유령표 1개 남음',
    shortLabel: !dead ? '투표 가능' : used ? '유령표 사용 완료' : '유령표 1개'
  };
}

export function voteSummary(state) {
  const summary = { alive: 0, ghostAvailable: 0, ghostUsed: 0, available: 0, total: 0 };
  for (const player of state.players) {
    if (!player.role) continue;
    const status = voteStatus(player);
    summary.total += 1;
    if (!status.dead) summary.alive += 1;
    else if (status.used) summary.ghostUsed += 1;
    else summary.ghostAvailable += 1;
    if (status.available) summary.available += 1;
  }
  return summary;
}

export function setGhostVote(state, playerId, used) {
  const player = state.players.find(player => player.id === playerId);
  if (!player || typeof used !== 'boolean' || !appearsDead(player) || (player.ghostVoteUsed === true) === used) return false;
  player.ghostVoteUsed = used;
  return true;
}

export function renderVotePanel(state, { token, esc, playerName, button }) {
  const summary = voteSummary(state);
  const rows = state.players.filter(player => player.role).map(player => {
    const status = voteStatus(player);
    const name = playerName(player);
    const control = status.dead
      ? button('ghost-vote-used', status.used ? '유령표 복구' : '유령표 사용 처리', 'vote-control ' + (status.used ? 'secondary' : ''),
        'data-player="' + esc(player.id) + '" data-used="' + (!status.used) + '" aria-label="' + esc(name + (status.used ? ' 유령표 복구' : ' 유령표 사용 처리')) + '"')
      : '<span class="vote-living-note">매 투표에 참여 가능</span>';
    return '<li class="vote-row ' + status.key + '" data-vote-player="' + esc(player.id) + '">' + token(player.role)
      + '<div class="vote-person"><strong>' + esc(name) + '</strong><span>' + esc(roleNames[player.role] || '캐릭터 미지정') + '</span><span class="vote-state">' + status.label + '</span></div>'
      + control + '</li>';
  }).join('');
  const butler = state.players.some(player => (player.abilityRole || player.role) === 'butler' && !appearsDead(player));
  return '<section class="vote-panel" aria-label="참가자별 투표권"><p class="muted-copy">사망자는 유령표로 1번 더 투표할 수 있습니다. 실제로 투표한 뒤에만 사용 처리하세요.</p>'
    + '<div class="vote-summary"><span>생존 <strong>' + summary.alive + '명</strong></span><span>남은 유령표 <strong>' + summary.ghostAvailable + '개</strong></span><span>사용 완료 <strong>' + summary.ghostUsed + '명</strong></span></div>'
    + (butler ? '<p class="notice vote-rule-note">집사는 주인이 투표할 때만 함께 투표할 수 있습니다. '+state.players.filter(p=>(p.abilityRole||p.role)==='butler'&&!appearsDead(p)).map(p=>esc(playerName(p))+' → '+esc(playerName(state.players.find(t=>t.id===p.butlerMaster)||p))).join(' · ')+'</p>' : '')
    + '<ul class="vote-list">' + rows + '</ul><p class="subtle">유령표 사용 상태는 다음 밤에도 유지됩니다. 잘못 처리했다면 ‘유령표 복구’를 누르세요.</p></section>';
}
