import {ROLE_MAP} from './game.js';

export function evilInfoSteps(state,id){
  const minions=state.players.filter(p=>ROLE_MAP[p.role]?.team==='minion');
  const demons=state.players.filter(p=>ROLE_MAP[p.role]?.team==='demon');
  const names=players=>players.map(p=>ROLE_MAP[p.role].ko).join(' · ');
  return id==='minioninfo'?[
    {title:names(minions)+' 깨우세요',text:minions.length>1?'서로와 악마가 누구인지 알려주세요.':'악마가 누구인지 알려주세요.',players:demons,wakePlayers:minions}
  ]:[
    {title:names(demons)+' 깨우세요',text:'하수인과 블러프 3개를 알려주세요.',players:minions,wakePlayers:demons,bluffs:true}
  ];
}
export function infoStepIndex(state,q){return Math.min(Math.max(0,state.actions[q.key]?.infoStep||0),evilInfoSteps(state,q.roleId).length-1);}
export function renderEvilSteps(state,q,{token,esc,playerName}){
  const steps=evilInfoSteps(state,q.roleId),index=infoStepIndex(state,q),step=steps[index];
  const cards='<div class="info-people">'+step.players.map(p=>'<div class="person-card">'+token(p.role)+'<strong>'+esc(playerName(p))+'</strong></div>').join('')+'</div>'+(step.bluffs?'<div class="info-people bluff-cards">'+state.bluffs.map(id=>'<div class="bluff-card">'+token(id)+'<strong>'+esc(ROLE_MAP[id].ko)+'</strong></div>').join('')+'</div>':'');
  return '<section class="info-current"><h3>'+esc(step.title)+'</h3><p>'+esc(step.text)+'</p>'+cards+'</section>';
}
