/* Private content arrives only from the existing authenticated Invnote frame. */
'use strict';
let personalStocks=[],researchHash='',syncTime=0;
let appearanceMode=null,invReady=false,syncTimer,featureMeta='';
try{const saved=localStorage.getItem('invnote-workspace-appearance');if(['light','dark','system'].includes(saved))appearanceMode=saved;}catch{}
const systemAppearance=matchMedia('(prefers-color-scheme: dark)');
const effectiveAppearance=()=>appearanceMode==='system'||!appearanceMode?(systemAppearance.matches?'dark':'light'):appearanceMode;
function paintAppearance(){
 const resolved=effectiveAppearance();document.documentElement.dataset.theme=resolved;
 document.querySelector('meta[name=color-scheme]')?.setAttribute('content',resolved);
 for(const f of Object.values(frames))f.contentWindow?.postMessage({type:'workspace:theme',theme:resolved},location.origin);
 const button=document.getElementById('workspace-theme');if(button){button.setAttribute('aria-label',resolved==='dark'?'ライトモードにする':'ダークモードにする');button.setAttribute('aria-pressed',String(resolved==='dark'));}
 document.querySelectorAll('[data-appearance]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.appearance===(appearanceMode||'system'))));
}
function setAppearance(mode){appearanceMode=mode;try{localStorage.setItem('invnote-workspace-appearance',mode)}catch{status.textContent='配色を保存できませんでした。';}paintAppearance();}
systemAppearance.addEventListener('change',()=>{if(appearanceMode==='system')paintAppearance()});
function syncWorkspace(){
 const b=document.getElementById('workspace-sync');if(!invReady){status.textContent='端末の登録・読み込みを確認してください。';location.hash='settings';return;}
 b.disabled=true;status.textContent='同期中…';frames.inv.contentWindow.postMessage({type:'workspace:sync'},location.origin);
 clearTimeout(syncTimer);syncTimer=setTimeout(()=>{b.disabled=false;status.textContent='同期に時間がかかっています。接続設定を確認してください。';},45000);
}
const initialData=JSON.parse(JSON.stringify(D));
function validBundle(d){
 if(!d||!d.notes||typeof d.notes!=='object'||Array.isArray(d.notes)||!d.ratings||!Array.isArray(d.ratings.rows)||!d.coverage)return false;
 if(!['body_notes','registered','legacy_references'].every(k=>Number.isInteger(d.coverage[k])&&d.coverage[k]>=0))return false;
 if(!d.ratings.horizons?.['3m']||!d.ratings.horizons?.['12m']||!Array.isArray(d.ratings.evaluation_rules))return false;
 return Object.entries(d.notes).every(([c,n])=>/^[0-9A-Z]{4,5}$/.test(c)&&n&&['name','updated','summary','change','business','facts','hypothesis','counter','next','valuation','source_period','stage'].every(k=>typeof n[k]==='string')&&['themes','sources','related'].every(k=>Array.isArray(n[k])&&n[k].every(x=>typeof x==='string')))
 &&d.ratings.rows.every(r=>/^[0-9A-Z]{4,5}$/.test(r.code)&&[r.short_3m,r.long_12m].every(n=>typeof n==='number'&&n>=0&&n<=10));
}
function replaceResearch(d){
 D=d;notes=D.notes;R=D.ratings;ratings=Object.fromEntries(R.rows.map(x=>[x.code,x]));all=Object.entries(notes);themes=[...new Set(all.flatMap(([,n])=>n.themes))].sort((a,b)=>a.localeCompare(b,'ja'));
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');watch=new Set((Array.isArray(saved)?saved:[]).filter(c=>Object.hasOwn(notes,c)));}catch{watch=new Set([...watch].filter(c=>Object.hasOwn(notes,c)));}
}
function companyTools(code,mode){
 if(!/^[0-9A-Z]{4,5}$/.test(code||''))return;
 const p=personalStocks.find(s=>s.code===code);
 if(!notes[code])app.innerHTML=title(esc(code),esc(p?.name||code),'この会社の調査本文はまだありません。既存の個人メモを確認・編集できます。');
 const bar=document.createElement('div');bar.className='toolbar';bar.innerHTML=`<a class="action" href="#company/${code}">調査・採点</a><a class="action" href="#company/${code}/personal">個人メモ・登録情報</a><a class="action" href="#notebook/inv:vStocks">登録銘柄一覧</a>`;app.prepend(bar);
 if(mode==='personal'){app.innerHTML=title(esc(code),esc(notes[code]?.name||p?.name||code),'個人メモ・登録情報');app.append(bar);app.style.paddingBottom='12px';embedded('inv','stock/'+code);}
}
const baseNotebook=notebook;
notebook=function(){baseNotebook();
 const el=document.createElement('section');el.innerHTML='<h2>登録銘柄から開く</h2><p class="muted">調査本文と個人メモは、同じ銘柄ページにまとめています。</p><div class="toolbar"><input aria-label="登録銘柄の検索" id="personal-search" placeholder="銘柄名・コード"><span id="personal-count"></span></div><div id="personal-results" class="grid"></div>';app.append(el);
 const draw=()=>{const q=document.getElementById('personal-search').value.trim().toLowerCase();const rows=personalStocks.filter(s=>(s.code+' '+s.name).toLowerCase().includes(q));document.getElementById('personal-count').textContent=rows.length+'社';document.getElementById('personal-results').innerHTML=rows.map(s=>`<article class="card"><small>${esc(s.code)} · ${esc(s.status)}</small><div><button class="open" data-company="${esc(s.code)}">${esc(s.name)} →</button></div><small>${notes[s.code]?'調査本文あり':'個人メモ・登録情報'}</small></article>`).join('');};document.getElementById('personal-search').oninput=draw;draw();
};
window.addEventListener('message',e=>{
 const kind=Object.keys(frames).find(k=>e.source===frames[k].contentWindow);
 if(e.origin!==location.origin||!kind)return;
 if(e.data?.type==='workspace:height'){
  const h=e.data.height;if(!frameHost.hidden&&!frames[kind].hidden&&Number.isFinite(h)&&h>=100&&h<100000)frames[kind].style.height=Math.ceil(h)+'px';return;
 }
 if(e.data?.type==='workspace:meta'&&kind==='scr'){featureMeta=String(e.data.text||'');const el=document.getElementById('feature-meta');if(el)el.textContent=featureMeta;return;}
 if(e.data?.type==='workspace:ready'){
  frames[kind].contentWindow.postMessage({type:'workspace:theme',theme:effectiveAppearance()},location.origin);return;
 }
 if(kind==='inv'&&e.data?.type==='workspace:sync-result'){clearTimeout(syncTimer);document.getElementById('workspace-sync').disabled=false;status.textContent=String(e.data.message||'同期を確認してください。');return;}
 if(kind==='inv'&&e.data?.type==='invnote:navigate'&&e.data.route==='notebook/inv:vStocks'){location.hash=e.data.route;return;}
 if(e.origin===location.origin&&e.source===frames.scr?.contentWindow&&e.data?.type==='screener:company'&&/^[0-9A-Z]{4,5}$/.test(e.data.code)){location.hash='company/'+e.data.code;return;}
 if(e.origin!==location.origin||e.source!==frames.inv?.contentWindow)return;
 const m=e.data;
 if(m?.type==='invnote:company'&&/^[0-9A-Z]{4,5}$/.test(m.code)){location.hash='company/'+m.code;return;}
 if(m?.type==='invnote:locked'){invReady=false;replaceResearch(initialData);personalStocks=[];researchHash='';route();status.textContent='設定から端末登録を確認してください。';return;}
 if(m?.type!=='invnote:state')return;
 invReady=true;if(!appearanceMode&&['light','dark'].includes(m.theme))appearanceMode=m.theme;paintAppearance();
 const nextStocks=Array.isArray(m.stocks)?m.stocks.filter(s=>/^[0-9A-Z]{4,5}$/.test(s.code)&&typeof s.name==='string'&&typeof s.status==='string'):[];
 const changed=m.researchHash!==researchHash||JSON.stringify(nextStocks)!==JSON.stringify(personalStocks);
 personalStocks=nextStocks;syncTime=m.lastSync||0;
 if(validBundle(m.bundle)){replaceResearch(m.bundle);researchHash=m.researchHash;status.textContent=`四季報 ${all.length}社 · ${syncTime?'Invnote 最終同期 '+new Date(syncTime).toLocaleString('ja-JP'):'端末の保存データ'}`;}
 else {replaceResearch(initialData);researchHash='';status.textContent=m.bundle?'四季報の形式を確認できませんでした。設定・同期を確認してください。':'四季報はまだ同期されていません。設定・同期から読み込めます。';}
 // Keep active search text and personal edits intact when only sync time changed.
 if(changed)route();
});
// A single header owns appearance, sync, import and settings for all four areas.
utilities.remove();document.querySelector('header .private')?.remove();
const icons={sync:'<path d="M20 12a8 8 0 0 1-13.7 5.6"/><path d="M4 12a8 8 0 0 1 13.7-5.6"/><path d="M17.7 3v3.4h-3.4"/><path d="M6.3 21v-3.4h3.4"/>',import:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',theme:'<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'};
const svg=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[k]}</svg>`;
const actions=document.createElement('div');actions.className='workspace-actions';actions.innerHTML=`<button id="workspace-sync" aria-label="同期" title="同期">${svg('sync')}</button><a href="#import" aria-label="取り込み" title="取り込み">${svg('import')}</a><button id="workspace-theme" aria-label="ダークモードにする" title="配色を切り替え">${svg('theme')}</button><a href="#settings" aria-label="設定" title="設定">${svg('settings')}</a>`;document.querySelector('header').append(actions);
document.getElementById('workspace-sync').onclick=syncWorkspace;
document.getElementById('workspace-theme').onclick=()=>setAppearance(effectiveAppearance()==='dark'?'light':'dark');
frameHost.className='workspace-frame-host';frameHost.removeAttribute('style');
sections.notebook=sections.notebook.filter(([id])=>!['inv:vSet','inv:vImport'].includes(id));
const workspaceRoute=route;
route=function(){
 const h=location.hash.slice(1);
 if(h==='notebook/inv:vSet'){location.replace('#settings');return;}
 if(h==='notebook/inv:vImport'){location.replace('#import');return;}
 if(h==='settings'||h==='import'){
  frameHost.hidden=true;app.style.paddingBottom='12px';
  app.innerHTML=`<div class="workspace-back"><a class="action" href="#${priorView}">← 戻る</a></div>`+title(h==='settings'?'SETTINGS':'IMPORT',h==='settings'?'設定':'取り込み',h==='settings'?'表示とデータの管理':'メモ・銘柄・保有情報を取り込む');
  if(h==='settings'){
   app.insertAdjacentHTML('beforeend','<section class="workspace-setting"><h2>アプリの表示</h2><div class="appearance-options"><button class="action" data-appearance="light">ライト</button><button class="action" data-appearance="dark">ダーク</button><button class="action" data-appearance="system">端末に合わせる</button></div><p class="muted">Today・Search・Note・Review 共通の配色です。</p></section><section class="workspace-setting"><h2>同期</h2><p class="muted">登録済みの端末と、メモ・日記・四季報を同期します。</p><div class="workspace-setting-actions"><button class="action" id="settings-sync">今すぐ同期</button><a class="action" href="#import">取り込み</a></div></section>');
   app.querySelectorAll('[data-appearance]').forEach(b=>b.onclick=()=>setAppearance(b.dataset.appearance));document.getElementById('settings-sync').onclick=syncWorkspace;
  }
  embedded('inv',h==='settings'?'vSet':'vImport');
  document.querySelectorAll('nav a').forEach(a=>a.removeAttribute('aria-current'));
 }else{workspaceRoute();
  if(h.includes('/scr:')){const heading=app.querySelector('.section-top');if(heading){const meta=document.createElement('p');meta.id='feature-meta';meta.className='muted';meta.style.fontSize='12px';meta.textContent=featureMeta;heading.append(meta);const b=document.createElement('button');b.className='action';b.textContent='データを再読込';b.onclick=()=>frames.scr.contentWindow.postMessage({type:'workspace:reload'},location.origin);heading.append(b);}}
 }
 for(const f of Object.values(frames)){f.setAttribute('scrolling','no');if(!f.hidden)f.contentWindow?.postMessage({type:'workspace:measure'},location.origin);}
 actions.querySelectorAll('a').forEach(a=>{if(a.hash===location.hash)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 paintAppearance();
 window.scrollTo(0,0);
};
// Replace the original event listener; otherwise an old route can overwrite settings.
window.removeEventListener('hashchange',workspaceRoute);window.addEventListener('hashchange',route);
paintAppearance();embedded('inv','vPf');route();
