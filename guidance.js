import {ROLE_MAP} from './game.js';
import {poCharged} from './information.js';
import {executionDeaths} from './life.js';

// Names identify people; the seat number is only a fallback for unnamed players.
export function participantLabel(player) {
  return player?.name?.trim() || (player ? `${player.seat}번 참가자` : '참가자');
}

const finish = '참가자를 다시 재운 뒤 아래의 완료 버튼을 누르세요.';
const wake = (c, ...steps) => [`다음 참가자를 깨우세요: ${participantLabel(c.player)} · ${c.role.ko}.`, ...steps, finish];
const number = (c, check) => wake(c, check, '정상 정보와 상태 안내를 확인해 알려줄 숫자를 고르고, 손가락으로 보여주세요.');
const yesNo = (c, check) => wake(c, check, '정상 정보와 상태 안내를 확인해 예 / 아니오를 고르고, 고개를 끄덕이거나 저어 알려주세요.');
const selectedNames = c => (c.action.targets || []).map(id => participantLabel(c.state.players.find(p => p.id === id))).join(' · ');
const first = c => c.state.night === 1 || c.q.reminderKind === 'first';
const once = '이번 밤 능력을 사용할지 확인하세요. 사용하지 않으면 생략을 누르세요.';
const deathResult = '완료를 누르면 사망 결과가 열립니다. 중독·취함·보호 등 실제 판정을 확인해 사망자를 확정하세요.';
const choose = (c, prompt, effect) => wake(c, `${prompt} 고른 사람을 아래 그리모어에서 선택하세요.`, effect);
const kill = (c, prompt = '한 사람을 고르게 하세요.') => choose(c, prompt, deathResult);
const pairInfo = (c, team) => wake(c,
  `사회자가 알려줄 두 사람을 그리모어에서 고르고, 보여줄 ${team} 캐릭터를 선택하세요. 정상이라면 두 사람 중 한 명은 그 캐릭터여야 합니다.`,
  '선택한 캐릭터 그림을 보여준 다음 두 사람을 차례로 가리키세요. 어느 쪽이 그 캐릭터인지는 알려주지 마세요.');

const PASSIVE = {
  savant: '낮에 찾아오면 따로 정보를 두 가지 주세요. 정상 상태에서는 하나가 참이고 하나가 거짓이어야 합니다.',
  artist: '낮에 한 번 질문을 받으면 상태를 확인하고 예 / 아니오로 답하세요. 능력 사용 여부를 참가자 상태에 기록하세요.',
  slayer: '낮에 공개 능력 사용을 선언하면 대상이 악마인지와 능력이 유효한지 확인해 사망을 처리하세요. 사용 여부도 기록하세요.',
  soldier: '악마의 능력을 처리할 때 이 참가자가 정상 상태인지 확인하세요. 정상이라면 악마로부터 안전합니다.',
  minstrel: `하수인이 낮 처형으로 죽었다면 ${ROLE_MAP.minstrel.ko}을 제외한 참가자에게 다음 날 황혼까지 취함을 적용하세요.`,
  tealady: `${ROLE_MAP.tealady.ko}의 가까운 생존 이웃 두 사람이 모두 선한지 확인하세요. 정상 능력이 유지되는 동안 두 이웃은 죽지 않습니다.`,
  mayor: `밤에 ${ROLE_MAP.mayor.ko}이 죽을 상황이면 다른 참가자에게 죽음을 넘길지 결정하세요. 생존자 3명인 낮에 처형이 없었다면 승리 조건을 확인하세요.`,
  fool: '처음 죽을 상황인지 확인하세요. 정상 능력이 남아 있다면 생존 처리하고 능력이 사용됐음을 기록하세요.',
  virgin: `${ROLE_MAP.virgin.ko}가 처음 지목받을 때 지목한 사람의 마을주민 감지 여부를 확인하세요. 능력이 발동하면 지목자를 즉시 처형하고 낮을 마칩니다.`,
  pacifist: `선한 참가자가 처형될 때 ${ROLE_MAP.pacifist.ko}의 능력으로 살릴지 결정하세요. 처형 결과는 생존으로 기록하세요.`,
  goon: `오늘 밤 능력으로 처음 선택받으면 선택한 사람을 황혼까지 취하게 하고 그 능력이 작동하지 않도록 처리하세요. ${ROLE_MAP.goon.ko}의 진영을 그 사람과 같게 바꾸고, 바뀌었다면 ${ROLE_MAP.goon.ko}에게 알려주세요.`,
  drunk: `${ROLE_MAP.drunk.ko}에게 알려준 마을주민 캐릭터의 순서로 진행하세요. 그 캐릭터의 능력은 작동하지 않으며 참·거짓 정보를 줄 수 있습니다.`,
  recluse: '정보·능력을 판정할 때 이 참가자를 악한 진영 또는 하수인·악마로 감지시킬지 결정하세요. 사망 후에도 가능합니다.',
  klutz: '죽음을 알게 되면 살아 있는 한 사람을 공개 지목하게 하세요. 정상 능력으로 지목한 사람이 악하다면 선한 팀이 패배합니다.',
  saint: `${ROLE_MAP.saint.ko}가 정상 능력을 가진 채 처형으로 사망했다면 선한 팀의 패배를 처리하세요. 다른 원인으로 죽은 경우에는 발동하지 않습니다.`,
  mutant: '외지인이라고 주장하는 광기를 보였는지 확인하세요. 능력에 따라 처형하기로 했다면 처형 결과를 기록하세요.',
  mastermind: '악마의 처형 사망으로 게임이 끝날 상황이었다면 하루를 더 진행하세요. 그 다음 날 처형된 참가자의 팀이 패배합니다.',
  scarletwoman: `사망 직전 생존자가 5명 이상이고 악마가 죽었다면 정상 상태의 ${ROLE_MAP.scarletwoman.ko}을 그 악마로 바꾸세요. 따로 깨워 새 캐릭터를 알려준 뒤 악마 순서로 진행하세요.`,
  baron: `게임 시작 전 ${ROLE_MAP.baron.ko}이 포함됐다면 기본 구성에서 마을주민 2명을 줄이고 외지인 2명을 늘렸는지 확인하세요.`
};

// These instructions follow the official first/other-night reminders in
// scripts/roles.official.json, with explicit app actions added for the storyteller.
export const ROLE_STEPS = {
  chef: c => number(c, '실제 앉은 순서에서 서로 붙어 있는 악한 참가자 쌍을 세세요. 세 사람이 연속이면 두 쌍입니다.'),
  investigator: c => pairInfo(c, '하수인'),
  washerwoman: c => pairInfo(c, '마을주민'),
  clockmaker: c => number(c, '악마에서 가장 가까운 하수인까지 시계·반시계 방향 중 짧은 거리를 확인하세요. 바로 옆이면 1입니다.'),
  grandmother: c => first(c)
    ? wake(c, '사회자가 선한 손주 한 사람을 그리모어에서 고르고, 알려줄 손주의 캐릭터를 선택하세요.', '손주를 가리킨 다음 그 캐릭터 그림을 보여주세요. 손주 본인에게는 이 정보를 알려주지 않습니다.')
    : [`${ROLE_MAP.grandmother.ko}를 깨우지 마세요. 처음 알려준 손주가 이번 밤 악마에게 사망했는지 확인하세요.`, `조건이 맞고 ${ROLE_MAP.grandmother.ko}의 능력이 유효하면 완료를 눌러 ${ROLE_MAP.grandmother.ko}의 실제 사망 결과를 확정하세요.`],
  librarian: c => wake(c,
    '정상 기준으로 외지인이 없으면 0명을 알려주세요. 외지인이 있으면 사회자가 두 사람과 보여줄 외지인 캐릭터를 고르세요.',
    '캐릭터 그림을 보여준 다음 두 사람을 가리키세요. 어느 쪽인지는 알려주지 마세요. 0명을 전달할 때는 대상·캐릭터 선택을 비우고 0명 버튼을 누르세요.'),
  empath: c => number(c, '죽은 사람을 건너뛰고 양옆에서 가장 가까운 생존자 두 명을 확인하세요. 그중 악한 사람이 몇 명인지 알려줍니다.'),
  sailor: c => choose(c, '살아 있는 한 사람을 고르게 하세요.', `${ROLE_MAP.sailor.ko}과 선택한 사람 중 누가 황혼까지 취할지 사회자가 정하고, 해당 사람의 취함 버튼을 누르세요. 누가 취했는지는 알리지 않습니다.`),
  chambermaid: c => wake(c, '자신을 제외한 생존자 두 명을 고르게 하고 그리모어에서 선택하세요.', '각 대상이 이번 밤 자신의 능력 때문에 깨어났는지 아래에서 확인하세요. 첫밤 악마·하수인 정보처럼 다른 이유로 깨어난 것은 세지 않습니다.', '정상 정보와 상태 안내를 확인해 알려줄 인원수를 고르고 손가락으로 보여주세요.'),
  snakecharmer: c => wake(c, '살아 있는 한 사람을 고르게 하고 그리모어에서 선택하세요.', '정상 능력으로 악마를 골랐다면 두 사람의 캐릭터와 진영을 교환하세요. 새 악마에게 악마 캐릭터와 악한 진영을 알려주고 재우세요.', `옛 악마를 따로 깨워 ${ROLE_MAP.snakecharmer.ko} 캐릭터와 선한 진영을 알려주고 중독을 표시하세요. 악마를 고르지 않았다면 아무 정보를 주지 않습니다.`),
  mathematician: c => number(c, '지난 새벽 이후 다른 캐릭터의 능력 때문에 비정상 작동한 능력의 소유자를 세세요. 같은 사람이 여러 번 비정상 작동해도 한 명입니다.'),
  dreamer: c => wake(c, '자신을 제외한 한 사람을 고르게 하고 그리모어에서 선택하세요.', '알려줄 캐릭터에서 선한 유형 1개와 악한 유형 1개를 고르세요. 정상이라면 그중 하나가 대상의 실제 캐릭터입니다.', '두 캐릭터 그림을 보여주세요. 어느 쪽이 맞는지는 알려주지 마세요.'),
  fortuneteller: c => yesNo(c, `두 사람을 고르게 하고 그리모어에서 선택하세요. 악마 또는 미끼가 포함됐는지와 감지 예외를 확인하세요.`),
  flowergirl: c => yesNo(c, '지난 낮에 악마가 한 번이라도 투표했는지 확인하세요. 어떤 지목에서 투표했는지는 관계없습니다.'),
  towncrier: c => yesNo(c, '지난 낮에 하수인이 한 번이라도 처형 후보를 지목했는지 확인하세요. 투표 여부를 세는 능력이 아닙니다.'),
  oracle: c => number(c, '지금까지 죽은 사람 중 악한 참가자 수를 확인하세요. 오늘 죽은 사람만 세는 것이 아닙니다.'),
  undertaker: c => executionDeaths(c.state).length
    ? wake(c, '지난 낮 처형으로 실제 사망한 사람의 캐릭터를 확인하고, 알려줄 캐릭터를 선택하세요.', `선택한 캐릭터 그림을 보여주세요. ${ROLE_MAP.drunk.ko}라면 알려준 마을주민이 아니라 ${ROLE_MAP.drunk.ko}가 정상 정보입니다.`)
    : [`지난 낮 처형으로 사망한 사람이 없어 ${ROLE_MAP.undertaker.ko}를 깨우지 않습니다.`, '처형이 없었거나 처형 후 생존했다면 정보를 주지 않습니다. 낮 처형 기록이 맞는지 확인하세요.'],
  innkeeper: c => choose(c, '두 사람을 고르게 하세요.', '두 사람은 이번 밤 죽지 않도록 보호합니다. 사회자가 둘 중 한 사람을 골라 취함 버튼을 누르세요. 취함은 다음 황혼까지이며 누가 취했는지는 알리지 않습니다.'),
  monk: c => choose(c, '자신을 제외한 한 사람을 고르게 하세요.', '완료하면 선택한 사람에게 이번 밤 악마로부터의 보호가 표시됩니다. 중독·취함 상태라면 보호가 작동하지 않습니다.'),
  gambler: c => wake(c, '한 사람을 고르게 하고, 그 사람의 캐릭터를 추측하게 하세요. 대상과 추측한 캐릭터를 각각 선택하세요.', `추측이 맞는지 확인하되 ${ROLE_MAP.gambler.ko}에게 정답을 알려주지 마세요. 재운 뒤 완료를 눌러 틀린 추측에 따른 실제 사망 결과를 확정하세요.`),
  exorcist: c => wake(c, `지난 밤과 다른 한 사람을 고르게 하고 그리모어에서 선택하세요. ${ROLE_MAP.exorcist.ko}를 다시 재우세요.`, `정상 능력으로 악마를 골랐다면 악마를 따로 깨워 ${ROLE_MAP.exorcist.ko} 캐릭터를 보여주고 ${ROLE_MAP.exorcist.ko}를 가리키세요.`, '악마를 재우고 이번 밤 그 악마의 능력 차례를 건너뛰세요. 대상이 악마가 아니면 아무도 추가로 깨우지 않습니다.'),
  gossip: c => [`${ROLE_MAP.gossip.ko}를 깨우지 마세요. 지난 낮 공개 소문을 참 / 거짓 / 발언 없음 중 하나로 기록하세요.`, '정상 능력에서 소문이 참이면 사회자가 죽일 한 사람을 그리모어에서 고르세요. 소문이 거짓이거나 없으면 선택하지 않습니다.', deathResult],
  courtier: c => wake(c, once, `사용하면 참가자가 말한 캐릭터를 선택하세요. 그 캐릭터가 실제로 있는지는 ${ROLE_MAP.courtier.ko}에게 알려주지 않습니다.`, `정상 능력이면 해당 캐릭터의 참가자에게 취함을 표시하세요. 이번 밤을 포함한 3밤·3낮 동안 유지하고 종료 시 해제하세요.`),
  seamstress: c => wake(c, once, '자신을 제외한 두 사람을 고르게 하고 그리모어에서 선택하세요.', '정상 정보와 상태 안내를 확인해 두 사람의 진영이 같은지 예 / 아니오를 고르고, 고개로 알려주세요.'),
  philosopher: c => wake(c, once, `사용하면 마을주민 또는 외지인 캐릭터를 고르게 하세요. 선택한 능력을 ${ROLE_MAP.philosopher.ko}의 참가자 상태에 지정하세요.`, `그 캐릭터가 이미 게임에 있다면 해당 참가자에게 취함을 표시하세요. ${ROLE_MAP.philosopher.ko}가 새로 얻은 시작 정보나 밤 능력도 해당 순서에 진행하세요.`),
  professor: c => wake(c, once, '사용하면 죽은 사람 한 명을 고르게 하고 그리모어에서 선택하세요.', '재운 뒤 완료를 누르세요. 정상 능력이고 대상이 마을주민이면 부활시킵니다. 다른 유형이거나 능력이 무효라면 부활하지 않습니다.'),
  juggler: c => number(c, `${ROLE_MAP.juggler.ko}의 첫 낮 공개 추측을 확인하세요. 최대 다섯 추측 중 캐릭터를 맞힌 개수를 세어 알려줍니다.`),
  ravenkeeper: c => wake(c, `이번 밤 사망한 ${ROLE_MAP.ravenkeeper.ko}에게 한 사람을 고르게 하고 그리모어에서 선택하세요.`, '정상 정보와 상태 안내를 확인해 알려줄 캐릭터를 고르고 그 그림을 보여주세요.'),
  sage: c => wake(c, `사회자가 이 ${ROLE_MAP.sage.ko}를 죽인 악마를 포함한 두 사람을 그리모어에서 선택하세요. ${ROLE_MAP.sage.ko}가 대상을 고르는 능력이 아닙니다.`, `선택한 두 사람을 차례로 가리키세요. 어느 쪽이 악마인지는 알려주지 않습니다. 중독·취함이면 두 사람이 실제 악마를 포함하지 않아도 됩니다.`),
  butler: c => choose(c, '자신을 제외한 한 사람을 주인으로 고르게 하세요.', `선택한 주인을 기록하세요. 다음 낮 ${ROLE_MAP.butler.ko}는 주인도 투표할 때만 투표할 수 있습니다.`),
  lunatic: c => {
    const shown = ROLE_MAP[c.player?.shownRole]?.ko || '알려준 악마';
    const opening = first(c)
      ? (c.state.count >= 7 ? [`${ROLE_MAP.lunatic.ko}을 깨워 가짜 하수인들을 가리키고, 블러프용 선한 캐릭터 그림 세 개를 보여주세요.`] : ['5~6인 게임에서는 첫밤 하수인·블러프 정보를 주지 않습니다.'])
      : [];
    const targets = !first(c) || c.player?.shownRole === 'pukka'
      ? [`광인을 ${shown}의 차례처럼 깨워 그 악마에 맞는 대상을 고르게 하고 그리모어에 기록하세요. 선택으로 실제 효과가 발생하지는 않습니다.`]
      : [];
    return [...opening, ...targets, `${ROLE_MAP.lunatic.ko}을 재운 뒤 진짜 악마를 깨우세요. 첫밤에는 실제 악마 캐릭터를 확인시킨 뒤 ${ROLE_MAP.lunatic.ko}을 가리켜 알려주세요.`, `${selectedNames(c) ? selectedNames(c) + '을(를)' : `${ROLE_MAP.lunatic.ko}이 고른 대상이 있다면 그 사람들을`} 진짜 악마에게 가리켜 알려주고, 악마를 다시 재운 뒤 완료하세요.`];
  },
  tinker: c => [`${ROLE_MAP.tinker.ko}를 깨우지 마세요. 사회자가 능력으로 이번 밤 죽일지 결정하세요.`, '생존 / 사망을 선택하고 완료를 누르세요. 사망 결과에서 중독·취함·보호 등을 확인한 뒤 확정하세요.'],
  sweetheart: c => [`${ROLE_MAP.sweetheart.ko}을 깨우지 마세요. 죽을 때 능력이 유효했다면 사회자가 앞으로 취할 한 사람을 고르세요.`, `대상을 선택하고 완료하면 취함이 적용됩니다. ${ROLE_MAP.sweetheart.ko}의 사망 때문에 생긴 취함은 이후에도 유지됩니다.`],
  moonchild: c => [`${ROLE_MAP.moonchild.ko}를 깨우지 마세요. 지난 낮 죽음을 알고 공개 지목했던 생존자를 그리모어에서 선택하세요.`, '그 사람이 선한지와 능력이 유효했는지 확인하세요. 정상 능력에서 선한 대상이면 이번 밤 죽습니다.', deathResult],
  barber: c => [`${ROLE_MAP.barber.ko}가 오늘 낮 또는 이번 밤 죽었다면 악마를 깨우고 ${ROLE_MAP.barber.ko} 캐릭터를 보여주세요.`, `악마에게 교환할 두 사람을 고르게 하거나 사용하지 않도록 하세요. 선택한 악마 자신은 포함할 수 있지만 다른 악마는 포함할 수 없습니다.`, '정상 능력이면 두 사람의 캐릭터만 교환하고 진영은 유지하세요. 악마를 재운 뒤 대상들을 한 명씩 깨워 새 캐릭터를 보여주고 다시 재우세요.', '완료하면 캐릭터 교환이 자동 반영됩니다. 교환하지 않았다면 대상을 비워 둡니다.'],
  godfather: c => first(c)
    ? wake(c, '게임에 들어간 외지인 캐릭터를 모두 선택하세요. 없다면 없음으로 기록하세요.', '선택한 외지인 캐릭터 그림을 보여주세요. 누가 그 캐릭터인지는 알려주지 않습니다.')
    : kill(c, '지난 낮 외지인이 사망했는지 확인한 뒤 한 사람을 고르게 하세요.'),
  poisoner: c => choose(c, '중독시킬 한 사람을 고르게 하세요.', `완료하면 대상에게 오늘 밤과 다음 낮 동안 중독이 표시됩니다. ${ROLE_MAP.poisoner.ko}이 중독·취함 상태라면 실제 중독은 적용되지 않습니다.`),
  devilsadvocate: c => choose(c, '지난 밤과 다른 생존자 한 사람을 고르게 하세요.', '완료하면 대상에게 다음 낮의 처형 보호가 표시됩니다. 정상 능력이면 대상은 처형돼도 죽지 않습니다.'),
  spy: c => wake(c, `${ROLE_MAP.spy.ko}에게 그리모어를 보여주세요. 모든 캐릭터와 상태를 충분히 확인할 시간을 주세요.`),
  witch: c => choose(c, '저주할 한 사람을 고르게 하세요.', `완료하면 저주가 표시됩니다. 다음 낮 그 사람이 지목하면 사망을 처리하세요. 생존자가 3명이 되면 ${ROLE_MAP.witch.ko}의 능력을 적용하지 않습니다.`),
  cerenovus: c => wake(c, '한 사람과 그 사람이 주장해야 할 선한 캐릭터를 고르게 하세요. 대상과 캐릭터를 각각 선택하세요.', `${ROLE_MAP.cerenovus.ko}를 재운 뒤 선택한 사람을 깨우세요. ${ROLE_MAP.cerenovus.ko} 그림과 주장해야 할 캐릭터 그림을 순서대로 보여주세요.`, '다음 낮 그 캐릭터라고 주장하는 광기를 보여야 하며 그렇지 않으면 처형될 수 있음을 알려주고 재우세요. 광기 상태를 기록하세요.'),
  pithag: c => wake(c, '한 사람과 바꿀 캐릭터를 고르게 하고 각각 선택하세요. 이미 게임에 있는 캐릭터라면 아무 변화가 없습니다.', `정상 능력으로 바뀐다면 ${ROLE_MAP.pithag.ko}을 재우고 대상을 깨워 새 캐릭터 그림을 보여주세요. 캐릭터만 바꾸며 진영은 유지합니다.`, '새 악마가 만들어졌다면 이번 밤 사망자는 사회자가 결정합니다. 캐릭터 변경은 자동 반영됩니다. 새 악마 생성 시 사망 결과를 확인하세요.'),
  assassin: c => wake(c, once, '사용하면 죽일 한 사람을 고르게 하고 그리모어에서 선택하세요.', `재운 뒤 완료를 누르세요. 정상 능력이라면 죽지 않게 하는 보호도 무시하고 사망시킵니다. ${ROLE_MAP.assassin.ko}가 중독·취함이면 능력은 작동하지 않습니다.`),
  eviltwin: c => ['사회자가 반대 진영의 쌍둥이 한 사람을 그리모어에서 선택하세요.', `${ROLE_MAP.eviltwin.ko}와 선택한 사람을 함께 깨워 서로 눈을 마주치게 하세요.`, '각자에게 상대의 캐릭터 그림을 보여주세요. 두 사람을 다시 재운 뒤 완료하세요.'],
  pukka: c => choose(c, '새로 중독시킬 한 사람을 고르게 하세요.', first(c)
    ? '완료하면 새 대상의 중독이 표시됩니다. 첫밤에는 이전 중독 대상이 없어 이 능력으로 죽는 사람이 없습니다.'
    : '새 대상에게 중독을 적용한 뒤 이전 중독 대상의 죽음을 처리합니다. 완료 후 사망 결과를 확정하세요. 이전 대상은 그 처리 후 건강해집니다.'),
  nodashii: c => choose(c, '죽일 한 사람을 고르게 하세요.', '양쪽에서 가장 가까운 마을주민 두 사람의 중독을 확인하세요. 마을주민이 아닌 사람은 건너뜁니다. ' + deathResult),
  imp: c => wake(c, '죽일 한 사람을 고르게 하고 그리모어에서 선택하세요.', `정상 능력으로 ${ROLE_MAP.imp.ko}가 자신을 죽이면 살아 있는 하수인 한 명을 새 ${ROLE_MAP.imp.ko}로 바꾸세요. 옛 ${ROLE_MAP.imp.ko}를 재우고 새 ${ROLE_MAP.imp.ko}를 깨워 캐릭터를 알려준 뒤 재우세요.`, deathResult),
  shabaloth: c => wake(c, '지난 밤 선택했던 죽은 사람 중 한 명을 부활시킬지 먼저 결정하세요. 현재 밤에 새로 고른 대상의 사망과 구분합니다.', '죽일 두 사람을 고르게 하고 그리모어에서 선택하세요.', '재운 뒤 완료를 눌러 두 대상의 사망 결과와 결정한 부활 대상을 함께 확정하세요.'),
  po: c => kill(c, poCharged(c.state, c.q.playerId)
    ? '직전 선택이 아무도 고르지 않기였으므로 이번 밤에는 서로 다른 세 사람을 고르게 하세요.'
    : '한 사람을 고르거나 아무도 고르지 않게 하세요. 아무도 고르지 않으면 대상을 비운 채 완료해 다음 선택의 3인 공격을 준비합니다.'),
  zombuul: c => kill(c, `지난 낮 아무도 죽지 않았는지 확인한 뒤 한 사람을 고르게 하세요. 죽은 것으로 보이는 ${ROLE_MAP.zombuul.ko}도 실제로 살아 있다면 능력을 진행합니다.`),
  vigormortis: c => wake(c, '죽일 한 사람을 고르게 하고 그리모어에서 선택하세요.', '하수인 사망 시 중독시킬 마을주민 이웃 한 명을 고르세요. 완료하면 능력 유지와 중독이 적용됩니다.', deathResult),
  vortox: c => choose(c, '죽일 한 사람을 고르게 하세요.', `${ROLE_MAP.vortox.ko}가 정상 상태로 살아 있는 동안 마을주민 정보는 반드시 거짓이어야 합니다. 지난 낮 처형이 없었다면 악한 팀 승리 조건도 확인하세요. ` + deathResult),
  fanggu: c => wake(c, '죽일 한 사람을 고르게 하고 그리모어에서 선택하세요.', `이번 게임 최초로 이 능력에 죽을 외지인이라면 외지인을 악한 ${ROLE_MAP.fanggu.ko}로 바꾸고 원래 ${ROLE_MAP.fanggu.ko}를 대신 죽이세요. 이전에 전환이 일어났다면 일반 공격으로 처리합니다.`, `원래 ${ROLE_MAP.fanggu.ko}를 재운 뒤 새 ${ROLE_MAP.fanggu.ko}를 깨워 캐릭터와 악한 진영을 알려주고 재우세요. 완료 후 실제 사망자를 확정하세요.`),
  ...Object.fromEntries(Object.entries(PASSIVE).map(([id, text]) => [id, () => ['이번 밤 기상 없음 · 이 캐릭터만을 위해 깨우지 마세요.', text]]))
};

export function storytellerSteps(state, q, action = {}) {
  const role = ROLE_MAP[q.roleId], player = state.players.find(p => p.id === q.playerId);
  if (!role || !ROLE_STEPS[q.roleId]) return [];
  if (q.kind === 'inspect' && !PASSIVE[q.roleId]) {
    return ['이번 밤 기상 없음 · 현재 이 캐릭터의 행동 차례가 아닙니다.', '사망·능력 사용 여부와 발동 조건을 확인하세요. 캐릭터 능력은 아래 상세 설명에서 볼 수 있습니다.'];
  }
  return ROLE_STEPS[q.roleId]({state, q, action, role, player});
}

const SHORT={
  washerwoman:'깨우기 → 두 사람 + 마을주민 1개 알려주기 → 재우기',librarian:'깨우기 → 두 사람 + 외지인 1개 또는 0명 알려주기 → 재우기',investigator:'깨우기 → 두 사람 + 하수인 1개 알려주기 → 재우기',chef:'악한 이웃 쌍의 수를 알려주세요.',empath:'가까운 생존 이웃 중 악한 사람 수를 알려주세요.',fortuneteller:'두 사람 선택 → 악마·미끼가 있는지 예/아니오 → 재우기',undertaker:'처형으로 죽은 사람의 캐릭터를 알려주세요.',monk:'자신 이외 1명 선택 → 완료하면 보호',ravenkeeper:'1명 선택 → 그 사람의 캐릭터 알려주기',butler:'주인 1명 선택 → 완료',spy:'그리모어 보여주기 → 재우기',poisoner:'1명 선택 → 완료하면 중독',imp:'1명 선택 → 사망 확인. 자살이면 하수인 승계',
  grandmother:'손주 1명 + 그 캐릭터를 알려주세요.',sailor:'생존자 1명 선택 → 사회자가 취할 사람 선택',chambermaid:'생존 타인 2명 선택 → 실제 기상 수 알려주기',exorcist:'지난 밤과 다른 1명 선택 → 악마면 퇴마사 알려주기',innkeeper:'2명 선택 → 사회자가 취할 1명 선택',gambler:'사람 + 캐릭터 추측 → 틀리면 사망 확인',gossip:'소문 참/거짓 판정 → 참이면 사망자 1명 선택',courtier:'캐릭터 1개 선택 → 3밤·3낮 취함 적용',professor:'죽은 사람 1명 선택 → 마을주민이면 부활',lunatic:'가짜 악마 선택을 받고 실제 악마에게 알려주세요.',tinker:'사회자가 생존/사망 결정',moonchild:'낮에 지목한 사람 확인 → 선했다면 사망',godfather:'지난 낮 외지인 사망 → 1명 선택·사망',devilsadvocate:'지난 밤과 다른 생존자 선택 → 처형 보호',assassin:'사용하면 1명 선택 → 보호 무시 사망',pukka:'새 중독 대상 선택 → 이전 대상 사망·해독',shabaloth:'이전 대상 부활 여부 → 2명 선택 순서대로 공격',po:'1명 또는 충전. 충전 뒤에는 3명 순서대로 공격',zombuul:'지난 낮 사망 없음 → 1명 선택·공격',
  clockmaker:'악마와 가장 가까운 하수인의 거리를 알려주세요.',snakecharmer:'생존자 1명 선택 → 악마면 역할·진영 자동 교환',mathematician:'다른 능력 때문에 실제 비정상 작동한 사람 수',dreamer:'타인 1명 선택 → 선한 역할 1개 + 악한 역할 1개',flowergirl:'지난 낮 악마가 투표했는지 예/아니오',towncrier:'지난 낮 하수인이 지목했는지 예/아니오',oracle:'죽은 악한 사람 수를 알려주세요.',seamstress:'타인 2명 선택 → 진영이 같은지 예/아니오',philosopher:'선한 캐릭터 선택 → 능력 획득·원본 취함 자동',juggler:'첫 낮 추측 중 맞힌 수를 알려주세요.',sage:'죽인 악마를 포함한 두 사람을 알려주세요.',sweetheart:'사회자가 취할 1명 선택 → 지속 취함',barber:'악마에게 2명 선택받기 → 캐릭터만 자동 교환',witch:'1명 선택 → 지목 시 죽는 저주',cerenovus:'사람 + 주장할 선한 캐릭터 선택 → 대상에게 알리기',pithag:'사람 + 새 캐릭터 선택 → 등장하지 않은 역할이면 변경',eviltwin:'반대 진영 1명 선택 → 둘에게 상대와 캐릭터 알리기',nodashii:'1명 선택·공격 → 마을주민 이웃 중독 자동',vigormortis:'1명 선택·공격 → 하수인이면 유지 능력·중독 이웃 선택',vortox:'1명 선택·공격. 마을주민 정보는 반드시 거짓',fanggu:'1명 선택 → 첫 외지인 사망이면 악한 팡 구로 이동'
};
export function compactInstruction(state,q){
  if(q.kind==='inspect'||PASSIVE[q.roleId])return '이번 밤 기상 없음 · 필요할 때 상세 확인';
  if(q.roleId==='grandmother'&&state.night>1&&q.reminderKind!=='first')return '손주가 악마에게 죽음 → 할머니 사망 확인';
  if(q.roleId==='godfather'&&(state.night===1||q.reminderKind==='first'))return '등장한 외지인 캐릭터만 알려주세요.';
  return SHORT[q.roleId]||'선택·결과 확인 → 재우기 → 완료';
}
export function renderStorytellerSteps(state, q, action, esc) {
  const steps=storytellerSteps(state,q,action);
  return steps.length?'<section class="storyteller-steps compact-guide" aria-label="사회자 진행 순서"><p>'+esc(compactInstruction(state,q))+'</p><details><summary>자세한 진행</summary><ol>'+steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol></details></section>':'';
}
