import { ROLES } from './data.js';
import { ROLE_MAP } from './game.js';
import { targetError, poCharged, information } from './information.js';
import { executionDeaths } from './life.js';
import {exorcised,healthy,working,abilityOf,chosenGoonState} from './mechanics.js';

const GOOD = ['townsfolk', 'outsider'];
const ALL = ['townsfolk', 'outsider', 'minion', 'demon'];
const profile = (kind, label, extra = {}) => ({ kind, label, ...extra });
const number = (label, max) => profile('number', label, { min: 0, max });
const character = (label, teams = ALL, extra = {}) => profile('character', label, { teams, min: 1, max: 1, characterLabel: label, ...extra });
const targets = label => profile('targets', label, { targetLabel: label });
const passive = label => profile('passive', label);

// Every base-edition character has an explicit workflow. None falls back to free text.
export const ABILITY_PROFILES = {
  chef: number('알려줄 악한 쌍의 수'),
  investigator: character('알려줄 하수인', ['minion']),
  washerwoman: character('알려줄 마을주민', ['townsfolk']),
  clockmaker: number('알려줄 거리'),
  grandmother: character('알려줄 손주의 캐릭터', ALL, { targetLabel: '손주 선택' }),
  librarian: character('알려줄 외지인', ['outsider'], { choices: ['0'] }),
  empath: number('알려줄 악한 이웃 수', 2),
  sailor: targets('선원이 고른 사람'),
  chambermaid: number('알려줄 기상 인원', 2),
  snakecharmer: targets('뱀 조련사가 고른 사람'),
  mathematician: number('알려줄 비정상 작동 인원'),
  dreamer: profile('pair', '알려줄 캐릭터 두 개', { teams: ALL, min: 2, max: 2, characterLabel: '선한 유형 1개 + 악한 유형 1개' }),
  fortuneteller: profile('boolean', '악마가 있나요?'),
  flowergirl: profile('boolean', '악마가 투표했나요?'),
  towncrier: profile('boolean', '하수인이 지목했나요?'),
  oracle: number('알려줄 죽은 악인 수'),
  undertaker: character('알려줄 처형 사망 캐릭터', ALL, { choices: ['없음'] }),
  innkeeper: targets('여관주인이 고른 두 사람'),
  monk: targets('수도승이 보호할 사람'),
  gambler: character('도박꾼이 추측한 캐릭터', ALL, { targetLabel: '추측할 사람' }),
  exorcist: targets('퇴마사가 고른 사람'),
  gossip: profile('confirm', '소문 판정', { choices: ['참', '거짓', '발언 없음'], targetLabel: '능력으로 죽일 사람' }),
  savant: passive('낮에 사회자에게 정보를 받습니다.'),
  courtier: character('궁정신하가 고른 캐릭터'),
  seamstress: profile('boolean', '두 사람의 진영이 같나요?'),
  philosopher: character('철학자가 얻을 능력', GOOD),
  professor: targets('교수가 되살릴 사람'),
  artist: passive('낮에 질문을 받습니다.'),
  slayer: passive('낮에 공개 지목을 처리합니다.'),
  juggler: number('알려줄 맞힌 추측 수', 5),
  soldier: passive('악마에게 안전합니다.'),
  minstrel: passive('하수인이 처형으로 죽었다면 다른 참가자가 취합니다.'),
  ravenkeeper: character('알려줄 캐릭터', ALL, { targetLabel: '까마귀지기가 고른 사람' }),
  sage: targets('악마 후보로 알려줄 두 사람'),
  tealady: passive('살아 있는 두 이웃이 모두 선하면 죽지 않습니다.'),
  mayor: passive('밤의 죽음을 다른 사람에게 넘길 수 있습니다.'),
  fool: passive('처음 죽을 때 죽지 않습니다.'),
  virgin: passive('첫 지목을 낮에 처리합니다.'),
  pacifist: passive('처형된 선한 참가자는 죽지 않을 수 있습니다.'),
  butler: targets('집사가 고른 주인'),
  goon: passive('오늘 밤 처음 자신을 선택한 사람과 같은 진영이 됩니다.'),
  lunatic: targets('광인이 고른 대상 · 실제 악마에게 전달'),
  drunk: passive('알려준 마을주민 능력으로 진행합니다. 실제로는 취해 있습니다.'),
  tinker: profile('confirm', '땜장이의 생사', { choices: ['생존', '사망'] }),
  recluse: passive('악한 진영·하수인·악마로 감지할 수 있습니다.'),
  sweetheart: targets('연인의 죽음으로 취할 사람'),
  klutz: passive('죽음을 알게 되면 낮에 공개 지목을 처리합니다.'),
  moonchild: targets('달의 아이가 지목한 생존자'),
  saint: passive('처형으로 죽으면 선한 팀이 패배합니다.'),
  barber: targets('악마가 캐릭터를 바꿀 두 사람 · 선택 안 함 가능'),
  mutant: passive('외지인이라고 광기 상태를 보이면 처형할 수 있습니다.'),
  godfather: targets('대부가 죽일 사람'),
  poisoner: targets('독살범이 중독시킬 사람'),
  devilsadvocate: targets('악마의 변호인이 보호할 생존자'),
  spy: profile('confirm', '그리모어 확인', { choices: ['확인 완료'] }),
  witch: targets('마녀가 저주할 사람'),
  cerenovus: character('광기로 주장할 캐릭터', GOOD, { targetLabel: '광기가 될 사람' }),
  pithag: character('변경할 캐릭터', ALL, { targetLabel: '캐릭터를 바꿀 사람' }),
  assassin: targets('암살자가 죽일 사람'),
  eviltwin: targets('서로 알려줄 반대 진영 쌍둥이'),
  mastermind: passive('악마가 처형으로 죽었다면 하루를 더 진행합니다.'),
  scarletwoman: passive('생존자가 5명 이상일 때 악마가 죽으면 악마가 됩니다.'),
  baron: passive('설정 시 외지인이 2명 더 들어갑니다.'),
  pukka: targets('푸카가 새로 중독시킬 사람'),
  nodashii: targets('노 다시가 죽일 사람'),
  imp: targets('임프가 죽일 사람'),
  shabaloth: targets('샤발로스가 죽일 두 사람'),
  po: targets('포가 고른 대상 · 충전한 다음 밤에는 세 사람'),
  zombuul: targets('좀부울이 죽일 사람'),
  vigormortis: targets('비고르모르티스가 죽일 사람'),
  vortox: targets('보르톡스가 죽일 사람'),
  fanggu: targets('팡 구가 죽일 사람')
};

export function abilityProfile(state, q, action = {}) {
  if(q.roleId==='pukka'&&exorcised(state,state.players.find(p=>p.id===q.playerId)))return profile('confirm','깨우지 않고 이전 중독 대상만 처리',{choices:['확인 완료']});
  if (['minioninfo', 'demoninfo'].includes(q.roleId)) return profile('confirm', q.roleId === 'minioninfo' ? '악마를 알려주세요.' : '하수인과 등장하지 않은 캐릭터를 알려주세요.', { choices: ['확인 완료'] });
  if (!ABILITY_PROFILES[q.roleId]) throw new Error(`Unknown base character: ${q.roleId}`);
  const base = ABILITY_PROFILES[q.roleId];
  if(q.roleId==='grandmother'&&state.night>1&&q.reminderKind!=='first')return profile('confirm','손주가 악마에게 사망했는지 확인', {choices:['확인 완료']});
  if (q.roleId === 'godfather' && (state.night === 1 || q.reminderKind === 'first')) return profile('characters', '알려줄 외지인들', { teams: ['outsider'], min: 0, max: state.count, characterLabel: '등장한 외지인 · 여러 개 선택 가능', choices: ['없음'] });
  if (q.roleId === 'lunatic' && state.night === 1 && state.players.find(player => player.id === q.playerId)?.shownRole !== 'pukka') return profile('confirm', '광인에게 가짜 하수인과 블러프 전달', { choices: ['전달 완료'] });
  if (q.roleId === 'po') {
    const charged = poCharged(state, q.playerId);
    return targets(charged ? '포가 죽일 세 사람 · 지난 밤 충전됨' : '포가 죽일 한 사람 · 선택 안 함은 충전');
  }
  if (base.kind === 'number') {
    const max = base.max ?? (q.roleId === 'clockmaker' ? Math.floor(state.count / 2) : state.count);
    return { ...base, max, choices: Array.from({ length: max + 1 }, (_, i) => String(i)) };
  }
  if (base.kind === 'boolean') return { ...base, choices: ['예', '아니오'] };
  return { ...base, ...(base.teams ? { teams: [...base.teams] } : {}), ...(base.choices ? { choices: [...base.choices] } : {}) };
}

export function candidates(state, q, action = {}) {
  const p = abilityProfile(state, q, action);
  if (!p.teams) return [];
  const present = new Set(state.players.flatMap(player => [player.role, player.shownRole, player.abilityRole]).filter(Boolean));
  return ROLES.filter(role => p.teams.includes(role.team) && (role.edition === state.edition || present.has(role.id))&&(q.roleId!=='philosopher'||role.id!=='philosopher')).map(role => role.id);
}

export function selectionResult(state, q, action = {}) {
  if (action.characters?.length) return action.characters.map(id => ROLE_MAP[id]?.ko || id).join(' · ');
  if (action.choice) return action.choice === '0' && q.roleId === 'librarian' ? '외지인 0명' : action.choice;
  if (typeof action.result === 'string' && action.result) return action.result;
  const p = abilityProfile(state, q, action);
  if (p.kind === 'passive') return '';
  if (p.kind === 'characters' && p.min === 0) return '없음';
  if (p.kind === 'targets') return (action.targets || []).map(id => { const player = state.players.find(player => player.id === id); return player ? `${player.seat}번${player.name ? ` ${player.name}` : ''}` : ''; }).filter(Boolean).join(' · ') || '선택 안 함';
  return '';
}

export function selectionError(state, q, action = {}) {
  const p = abilityProfile(state, q, action), selected = action.characters || [], choice = action.choice || '', targets = action.targets || [];
  const info=information(state,q,action),vortox=info.exceptions.some(s=>s.includes('보르톡스'));
  if(vortox&&info.value!==null&&!info.exceptions.some(s=>s.includes('감지 예외'))&&['number','boolean'].includes(p.kind)&&(choice||action.result)===info.value)return '보르톡스: 정상 정보와 다른 값을 전달해야 합니다.';
  if(vortox&&['character','pair'].includes(p.kind)&&selected.some(id=>info.characterIds.includes(id)))return '보르톡스: 실제 캐릭터가 아닌 정보를 고르세요.';
  if (q.roleId==='undertaker'&&!executionDeaths(state).length)return '처형으로 사망한 사람이 없어 장의사는 이번 밤 정보를 받지 않습니다.';
  if (p.kind === 'passive') return '';
  if (q.roleId === 'librarian' && choice === '0') return targets.length || selected.length ? '외지인 0명을 알릴 때는 대상과 캐릭터 선택을 지우세요.' : '';
  const targetProblem = targetError(state, q, targets);
  if (targetProblem) return targetProblem;
  if(q.roleId==='sage'){
    const actor=state.players.find(p=>p.id===q.playerId),killer=state.players.find(p=>p.id===actor?.deathSource)||state.players.find(p=>ROLE_MAP[p.role]?.team==='demon'&&p.alive);
    const register=info.exceptions.some(s=>s.includes('감지 예외'));
    if(killer&&!register){
      if(vortox&&actor?.role!=='drunk'&&targets.includes(killer.id))return '보르톡스: 실제 악마를 제외한 두 사람을 고르세요.';
      if(!vortox&&!info.impaired.length&&!targets.includes(killer.id))return '정상 현자 정보에는 자신을 죽인 악마가 포함되어야 합니다.';
    }
  }
  if (['number', 'boolean'].includes(p.kind)) {
    const value = choice || action.result || '';
    return p.choices.includes(String(value)) ? '' : `${p.label}를 버튼으로 선택하세요.`;
  }
  if (p.kind === 'confirm' && p.choices?.length > 1 && !p.choices.includes(choice || action.result || '')) return `${p.label}를 버튼으로 선택하세요.`;
  if (['character', 'pair', 'characters'].includes(p.kind)) {
    if (p.choices?.includes(choice)) return selected.length ? '캐릭터 선택과 없음 선택 중 하나만 사용하세요.' : '';
    // Existing saved records remain readable; new UI always stores character IDs.
    if (!selected.length && !Object.hasOwn(action, 'characters') && action.result) return '';
    if (selected.length < p.min || selected.length > p.max) return p.kind === 'pair' ? '선한 유형과 악한 유형 캐릭터를 하나씩 고르세요.' : `${p.characterLabel || p.label}를 ${p.min === p.max ? p.min : `${p.min}–${p.max}`}개 고르세요.`;
    const allowed = new Set(candidates(state, q, action));
    if (selected.some(id => !allowed.has(id))) return '이 능력에 맞는 캐릭터를 선택하세요.';
    if (new Set(selected).size !== selected.length) return '같은 캐릭터를 두 번 선택할 수 없습니다.';
    if (p.kind === 'pair' && selected.filter(id => GOOD.includes(ROLE_MAP[id].team)).length !== 1) return '선한 유형과 악한 유형 캐릭터를 하나씩 고르세요.';
    if(q.roleId==='dreamer'){
      const target=state.players.find(p=>p.id===targets[0]),actor=state.players.find(p=>p.id===q.playerId),vortox=state.players.some(p=>abilityOf(p)==='vortox'&&working(state,p));
      if(vortox&&target&&selected.includes(target.role))return '보르톡스: 실제 캐릭터가 없는 두 역할을 고르세요.';
      const simulated=chosenGoonState(state,q,action);
      if(!vortox&&target&&healthy(simulated,simulated.players.find(p=>p.id===actor.id))&&!(['spy','recluse'].includes(target.role)&&healthy(state,target))&&!selected.includes(target.role))return '정상 몽상가는 실제 캐릭터를 하나 포함해야 합니다.';
    }
  }
  return '';
}
