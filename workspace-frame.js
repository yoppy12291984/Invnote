/* Shared appearance and document height; no business data or trading rules. */
(()=>{
 if(parent===window||new URLSearchParams(location.search).get('workspace')!=='1')return;
 document.documentElement.dataset.workspace='true';
 function copyPalette(){try{const source=parent.document.documentElement.style;for(const name of source){if((name.startsWith('--custom-')||['--bg','--paper','--sur','--ink','--sub','--mut','--line','--green'].includes(name))&&/^#[0-9a-f]{6}$/i.test(source.getPropertyValue(name)))document.documentElement.style.setProperty(name,source.getPropertyValue(name));}}catch{}}
 copyPalette();
 // Apply the shell theme before the embedded body is parsed.
 try{const theme=parent.document.documentElement.dataset.theme;if(['light','dark'].includes(theme))document.documentElement.dataset.theme=theme;}catch{}
 const kind=location.pathname.includes('/screener/')?'scr':'inv';
 let lastHeight=0,lastMeta='',pending=false;
 const post=data=>parent.postMessage({...data,kind},location.origin);
 function measure(){
  pending=false;const root=document.getElementById('app');if(!root||root.getBoundingClientRect().width<1)return;
  const meta=document.getElementById('stat')?.textContent||'';if(meta!==lastMeta){lastMeta=meta;post({type:'workspace:meta',text:meta});}
  const gate=document.getElementById('suite-access');
  const h=gate&&!gate.hidden?Math.max(600,gate.scrollHeight):Math.max(100,Math.ceil(root.getBoundingClientRect().height+16));
  if(h!==lastHeight){lastHeight=h;post({type:'workspace:height',height:h});}
 }
 const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(measure);}};
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent)return;
  // Only the loaded child changes its own hash. Parent writes during initial
  // about:blank navigation can interrupt the pending document on mobile browsers.
  if(e.data?.type==='workspace:navigate'&&typeof e.data.tab==='string'&&/^[A-Za-z0-9_/-]+$/.test(e.data.tab)){
   location.hash=e.data.tab;schedule();
  }
  if(e.data?.type==='workspace:theme'&&['light','dark'].includes(e.data.theme)){
   document.documentElement.dataset.theme=e.data.theme;copyPalette();schedule();
   requestAnimationFrame(()=>post({type:'workspace:painted'}));
   // The research subview listens to the root theme mutation through its own adapter.
  }
  if(e.data?.type==='workspace:measure'){lastHeight=0;schedule();}
  if(e.data?.type==='workspace:reload'&&kind==='scr')location.reload();
 });

function installFeatureSwipe(root,onSwipe){
 let start=null,suppressUntil=0;
 root.addEventListener('touchstart',e=>{
  start=null;if(e.touches.length!==1||e.target.closest('input,textarea,select,[contenteditable="true"],canvas,#calGrid,#diaryBox,.dnav,#diaryGrid,#diaryTable'))return;
  for(let el=e.target;el&&el!==root;el=el.parentElement){if(el.scrollWidth>el.clientWidth+2&&['auto','scroll'].includes(getComputedStyle(el).overflowX))return;}
  const t=e.touches[0];start={x:t.clientX,y:t.clientY,time:Date.now()};
 },{passive:true});
 root.addEventListener('touchend',e=>{
  if(!start)return;const initial=start;start=null;const t=e.changedTouches[0];if(!t)return;
  const dx=t.clientX-initial.x,dy=t.clientY-initial.y;
  if(Date.now()-initial.time<700&&Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.8){suppressUntil=Date.now()+400;onSwipe(dx<0?1:-1);}
 },{passive:true});
 root.addEventListener('touchcancel',()=>{start=null;},{passive:true});
 root.addEventListener('click',e=>{if(Date.now()<suppressUntil){e.preventDefault();e.stopPropagation();}},true);
}

 function start(){
  document.addEventListener('focusin',()=>post({type:'workspace:focus'}));
  document.addEventListener('focusout',()=>setTimeout(()=>post({type:'workspace:focus'}),0));
  installFeatureSwipe(document, direction=>post({type:"workspace:swipe",direction}));
  const root=document.getElementById('app');if(root){new ResizeObserver(schedule).observe(root);new MutationObserver(schedule).observe(root,{childList:true,subtree:true,attributes:true});}
  window.addEventListener('resize',schedule);window.addEventListener('hashchange',schedule);
  post({type:'workspace:ready'});schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
