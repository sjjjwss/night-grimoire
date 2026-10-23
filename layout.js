// Identity stays stable when people move: actions refer to IDs, adjacency uses seatOrder.
export function seatedPlayers(state) {
  const ids = state.seatOrder || state.players.map(p=>p.id);
  return [...ids.map(id=>state.players.find(p=>p.id===id)).filter(Boolean), ...state.players.filter(p=>!ids.includes(p.id))];
}
export function boardPositions(state) {
  // Equal distance along the mobile ellipse keeps larger games from bunching up at the top.
  const samples=[{angle:0,length:0}];let length=0;
  for(let i=1;i<=720;i++){const a=(i-1)*2*Math.PI/720,b=i*2*Math.PI/720;length+=Math.hypot(130*(Math.sin(b)-Math.sin(a)),(state.count>=13?278:217)*(Math.cos(b)-Math.cos(a)));samples.push({angle:b,length});}
  return Object.fromEntries(seatedPlayers(state).map((p,i)=>{
    const angle=state.count>=10?samples.find(s=>s.length>=length*i/state.count).angle:i*2*Math.PI/state.count;
    return [p.id,state.boardPositions?.[p.id]||{x:50+36*Math.sin(angle),y:50-38*Math.cos(angle)}];
  }));
}
export function moveOnBoard(state,id,x,y) {
  if(!state.players.some(p=>p.id===id)||!Number.isFinite(x)||!Number.isFinite(y))return;
  const current=boardPositions(state),oldPos=current[id];
  const clamped={x:Math.max(12,Math.min(88,x)),y:Math.max(10,Math.min(90,y))};
  state.boardPositions={...current};
  const overlap=state.players.map(p=>p.id).filter(otherId=>otherId!==id&&current[otherId]).sort((a,b)=>Math.hypot(clamped.x-current[a].x,clamped.y-current[a].y)-Math.hypot(clamped.x-current[b].x,clamped.y-current[b].y))[0];
  if(overlap&&oldPos&&Math.hypot(clamped.x-current[overlap].x,clamped.y-current[overlap].y)<8){
    state.boardPositions[id]={...current[overlap]};
    state.boardPositions[overlap]={...oldPos};
  }else{
    state.boardPositions[id]=clamped;
  }
  const pts=state.players.map(p=>state.boardPositions[p.id]).filter(Boolean);
  const cx=pts.length?pts.reduce((s,p)=>s+p.x,0)/pts.length:50;
  const cy=pts.length?pts.reduce((s,p)=>s+p.y,0)/pts.length:50;
  const angle=p=>(Math.atan2(p.x-cx,cy-p.y)+2*Math.PI)%(2*Math.PI);
  state.seatOrder=state.players.map(p=>p.id).sort((a,b)=>angle(state.boardPositions[a])-angle(state.boardPositions[b]));
  for(const [key,a] of Object.entries(state.actions||{})){
    if(!state.completed?.includes(key)&&a){
      delete a.poisonNeighbor;delete a.lifeResults;
      if(['empath','chef','clockmaker','tealady','nodashii','vigormortis'].includes(key.split(':')[1])){a.result='';a.choice='';}
    }
  }
}
export function resetBoard(state){delete state.boardPositions;delete state.seatOrder;}

export function bindBoardDrag({root,onMove,onHold}) {
  let drag=null,armed=null,suppressUntil=0;
  const doc=root.ownerDocument||globalThis.document;
  const win=doc?.defaultView||globalThis;
  // Freeze the page itself while a seat is lifted. iOS ignores touch-action/overflow on
  // some versions, so the body is pinned in place and the scroll offset restored afterwards.
  let locked=null;
  const lockScroll=()=>{
    const body=doc?.body;if(!body||locked)return;
    const y=win.scrollY||0;
    locked={y,style:body.getAttribute('style')};
    body.classList?.add('dragging-seat');
    Object.assign(body.style,{position:'fixed',top:-y+'px',left:'0',right:'0',width:'100%'});
  };
  const unlockScroll=()=>{
    const body=doc?.body;if(!body)return;
    body.classList?.remove('dragging-seat');
    if(!locked)return;
    const {y,style}=locked;locked=null;
    if(style==null)body.removeAttribute('style');else body.setAttribute('style',style);
    win.scrollTo?.({top:y,behavior:'instant'});
  };
  const clear=()=>{if(drag)clearTimeout(drag.timer);drag=null;unlockScroll();};
  const activate=()=>{
    if(!drag||drag.active)return;
    clearTimeout(drag.timer);
    drag.active=true;
    try{drag.card.setPointerCapture(drag.pointer);}catch{}
    drag.card.classList.add('being-moved');
    drag.board.classList.add('moving-seat');
    lockScroll();
    if(drag.touch)touchHeld=true;
    try{win.navigator?.vibrate?.(25);}catch{}
    suppressUntil=Date.now()+1500;
  };
  const finish=e=>{
    if(!drag||(e?.pointerId!=null&&e.pointerId!==drag.pointer))return;
    const current=drag;clear();
    if(current.active&&!current.pos){armed=current;suppressUntil=Date.now()+900;return;}
    current.card.classList.remove('being-moved');current.board.classList.remove('moving-seat');
    if(current.active&&current.pos){suppressUntil=Date.now()+900;onMove(current.id,current.pos);}
  };
  root.addEventListener('pointerdown',e=>{
    if(armed){
      const current=armed;armed=null;current.card.classList.remove('being-moved');current.board.classList.remove('moving-seat');unlockScroll();
      const board=e.target.closest('.circle-board');
      if(board){const rect=board.getBoundingClientRect();suppressUntil=Date.now()+900;e.preventDefault();onMove(current.id,{x:(e.clientX-rect.left)/rect.width*100,y:(e.clientY-rect.top)/rect.height*100});return;}
    }
    const card=e.target.closest('.circle-board .seat-card');
    if(!card||(e.button!==0&&e.pointerType==='mouse'))return;
    const board=card.closest('.circle-board'),rect=board.getBoundingClientRect();
    try{card.setPointerCapture(e.pointerId);}catch{}
    drag={id:card.dataset.player,card,moveElement:card.closest('.seat-position')||card,board,rect,pointer:e.pointerId,touch:e.pointerType!=='mouse',x:e.clientX,y:e.clientY,active:false};
    drag.timer=setTimeout(()=>{if(!drag)return;activate();onHold();},520);
  });
  // Block native panning for the whole touch once a seat is pressed, even if the
  // browser sends pointercancel before the finger lifts.
  let touchHeld=false;
  const blockTouch=e=>{if((drag||touchHeld)&&e.cancelable)e.preventDefault();};
  win.addEventListener('touchmove',blockTouch,{passive:false,capture:true});
  doc?.addEventListener?.('touchmove',blockTouch,{passive:false,capture:true});
  const releaseTouch=e=>{if(!e.touches?.length)touchHeld=false;};
  win.addEventListener('touchend',releaseTouch,{capture:true});
  win.addEventListener('touchcancel',releaseTouch,{capture:true});
  win.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointer)return;
    if(!drag.active){
      if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>12)clear();
      return;
    }
    e.preventDefault();
    suppressUntil=Date.now()+900;
    const rect=drag.board.getBoundingClientRect()||drag.rect;
    drag.pos={x:Math.max(12,Math.min(88,(e.clientX-rect.left)/rect.width*100)),y:Math.max(10,Math.min(90,(e.clientY-rect.top)/rect.height*100))};
    drag.moveElement.style.left=drag.pos.x+'%';drag.moveElement.style.top=drag.pos.y+'%';
  },{passive:false});
  win.addEventListener('pointerup',finish);
  win.addEventListener('pointercancel',finish);
  root.addEventListener('contextmenu',e=>{if(e.target.closest('.circle-board .seat-card'))e.preventDefault();});
  root.addEventListener('click',e=>{if(Date.now()<suppressUntil&&e.target.closest('.circle-board')){e.preventDefault();e.stopImmediatePropagation();}},true);
}
