/* Private content arrives only from the existing authenticated Invnote frame. */
'use strict';
const appRelease=JSON.parse(document.getElementById('app-release').textContent);
let personalStocks=[],researchHash='',syncTime=0;
let appearanceMode=null,invReady=false,syncTimer,featureMeta='';
try{const saved=localStorage.getItem('invnote-workspace-appearance');if(['light','dark','system'].includes(saved))appearanceMode=saved;}catch{}
const systemAppearance=matchMedia('(prefers-color-scheme: dark)');
const effectiveAppearance=()=>appearanceMode==='system'||!appearanceMode?(systemAppearance.matches?'dark':'light'):appearanceMode;
const paletteKey='invnote-workspace-colors-v1';
const paletteFields=[
 ['cardline','銘柄カード上の線','--custom-cardline','#b63832','#f17c73'],
 ['updates','最近の研究更新','--custom-updates','#315f97','#8fb7ed'],
 ['short','3か月の点数','--custom-short','#866019','#efc35b'],
 ['long','12か月の点数','--custom-long','#23715c','#70c9ad'],
 ['bodycount','本文ありの件数','--custom-bodycount','#70c9ad','#70c9ad'],
 ['registered','登録の件数','--custom-registered','#70c9ad','#70c9ad'],
 ['accent','選択中のタブ・ボタン','--green','#245e49','#6e9bd6'],
 ['icons','上の操作アイコン','--custom-icons','#243b35','#e6eaee'],
 ['heading','通常の見出し','--custom-heading','#b63832','#f17c73'],
 ['tag','テーマの文字','--custom-tag','#315f97','#8fb7ed'],
 ['tagbg','テーマの背景','--custom-tagbg','#edf3fa','#202e3e'],
 ['bg','画面の背景','--bg','#f5f4ef','#12171c'],
 ['card','カードの背景','--paper','#ffffff','#1b2229'],
 ['text','本文の文字','--ink','#243b35','#e6eaee'],
 ['muted','補足の文字','--sub','#64716b','#a9b5c2'],
 ['border','境界線','--line','#dce2db','#2b343d'],
 ['hero','Todayの先頭カード背景','--custom-hero','#245e49','#232c35'],
 ['herotext','Todayの先頭カード文字','--custom-herotext','#f2f5ee','#e6eaee'],
 ['herolabel','Todayの先頭カード小見出し','--custom-herolabel','#efc35b','#efc35b']
];
let palettePrefs={};try{const p=JSON.parse(localStorage.getItem(paletteKey)||'{}');if(p&&typeof p==='object'&&!Array.isArray(p))palettePrefs=p;}catch{}
function colorValue(field,mode=effectiveAppearance()){const value=palettePrefs[mode]?.[field[0]];return /^#[0-9a-f]{6}$/i.test(value||'')?value:field[mode==='dark'?4:3];}
function paintPalette(){
 const style=document.documentElement.style;
 for(const field of paletteFields)style.setProperty(field[2],colorValue(field));
 style.setProperty('--sur',style.getPropertyValue('--paper'));style.setProperty('--mut',style.getPropertyValue('--sub'));
 document.querySelectorAll('[data-palette]').forEach(input=>{const field=paletteFields.find(f=>f[0]===input.dataset.palette);if(field)input.value=colorValue(field);});
 const mode=document.getElementById('palette-mode');if(mode)mode.textContent=effectiveAppearance()==='dark'?'ダークの配色':'ライトの配色';
}
function savePalette(){try{localStorage.setItem(paletteKey,JSON.stringify(palettePrefs));return true;}catch{document.getElementById('palette-result').textContent='保存できませんでした。端末の保存容量・設定を確認してください。';return false;}}
function renderPaletteSettings(){
 const panel=document.createElement('section');panel.className='workspace-setting';panel.innerHTML=`<h2>配色</h2><p><b id="palette-mode"></b>を編集。変更はすぐ反映され、この端末に保存します。ライトとダークは別々に設定できます。</p><details open><summary>線・見出し・数字</summary>${paletteFields.slice(0,11).map(colorRow).join('')}</details><details><summary>背景・文字</summary>${paletteFields.slice(11).map(colorRow).join('')}</details><article class="card company-card palette-preview"><small>配色のプレビュー</small><p>銘柄カードの本文</p><div class="score">3か月 <b>6</b> / 12か月 <b>7</b></div><span class="pill">テーマ</span></article><button class="action" id="palette-reset">このモードの配色を標準に戻す</button><p id="palette-result" role="status"></p>`;
 app.append(panel);paintPalette();
 panel.querySelectorAll('[data-palette]').forEach(input=>input.addEventListener('input',()=>{const mode=effectiveAppearance();palettePrefs[mode]={...palettePrefs[mode],[input.dataset.palette]:input.value};paintAppearance();if(savePalette())document.getElementById('palette-result').textContent='保存しました。';}));
 document.getElementById('palette-reset').onclick=()=>{delete palettePrefs[effectiveAppearance()];paintAppearance();if(savePalette())document.getElementById('palette-result').textContent='標準の配色に戻しました。';};
 function colorRow(f){return `<label class="palette-row"><span>${esc(f[1])}</span><input type="color" data-palette="${f[0]}" aria-label="${esc(f[1])}" value="${colorValue(f)}"></label>`;}
}
function paintAppearance(){
 const resolved=effectiveAppearance();document.documentElement.dataset.theme=resolved;
 paintPalette();
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
 const draw=()=>{const q=document.getElementById('personal-search').value.trim().toLowerCase();const rows=personalStocks.filter(s=>(s.code+' '+s.name).toLowerCase().includes(q));document.getElementById('personal-count').textContent=rows.length+'社';document.getElementById('personal-results').innerHTML=rows.map(s=>`<article class="card"><small>${esc(s.code)} · ${esc(s.status)}</small><div><button class="open" data-company="${esc(s.code)}">${esc(s.name)}</button></div><small>${notes[s.code]?'調査本文あり':'個人メモ・登録情報'}</small></article>`).join('');};document.getElementById('personal-search').oninput=draw;draw();
};
window.addEventListener('message',e=>{
 const kind=Object.keys(frames).find(k=>e.source===frames[k].contentWindow);
 if(e.origin!==location.origin||!kind)return;
 if(e.data?.type==='workspace:height'){
  const h=e.data.height;if(!frameHost.hidden&&!frames[kind].hidden&&Number.isFinite(h)&&h>=100&&h<100000)frames[kind].style.height=Math.ceil(h)+'px';return;
 }
 if(e.data?.type==='workspace:meta'&&kind==='scr'){featureMeta=String(e.data.text||'');const el=document.getElementById('feature-meta');if(el)el.textContent=featureMeta;return;}
 if(e.data?.type==='workspace:painted'){frames[kind].style.visibility='visible';return;}
 if(e.data?.type==='workspace:ready'){
  frames[kind].contentWindow.postMessage({type:'workspace:theme',theme:effectiveAppearance()},location.origin);return;
 }
 if(kind==='inv'&&e.data?.type==='workspace:sync-result'){clearTimeout(syncTimer);document.getElementById('workspace-sync').disabled=false;status.textContent=String(e.data.message||'同期を確認してください。');return;}
 if(kind==='inv'&&e.data?.type==='invnote:navigate'&&e.data.route==='notebook/inv:vStocks'){location.hash=e.data.route;return;}
 if(e.origin===location.origin&&e.source===frames.scr?.contentWindow&&e.data?.type==='screener:company'&&/^[0-9A-Z]{4,5}$/.test(e.data.code)){location.hash='company/'+e.data.code;return;}
 if(e.origin!==location.origin||e.source!==frames.inv?.contentWindow)return;
 const m=e.data;
 if(m?.type==='invnote:company'&&/^[0-9A-Z]{4,5}$/.test(m.code)){location.hash='company/'+m.code;return;}
 if(m?.type==='invnote:locked'){invReady=false;replaceResearch(initialData);personalStocks=[];researchHash='';if(!['#settings','#import'].includes(location.hash))route();status.textContent='設定から端末登録を確認してください。';return;}
 if(m?.type!=='invnote:state')return;
 invReady=true;if(!appearanceMode&&['light','dark'].includes(m.theme))appearanceMode=m.theme;paintAppearance();
 const nextStocks=Array.isArray(m.stocks)?m.stocks.filter(s=>/^[0-9A-Z]{4,5}$/.test(s.code)&&typeof s.name==='string'&&typeof s.status==='string'):[];
 const changed=m.researchHash!==researchHash||JSON.stringify(nextStocks)!==JSON.stringify(personalStocks);
 personalStocks=nextStocks;syncTime=m.lastSync||0;
 if(validBundle(m.bundle)){replaceResearch(m.bundle);researchHash=m.researchHash;status.textContent=`四季報 ${all.length}社 · ${syncTime?'Invnote 最終同期 '+new Date(syncTime).toLocaleString('ja-JP'):'端末の保存データ'}`;}
 else {replaceResearch(initialData);researchHash='';status.textContent=m.bundle?'四季報の形式を確認できませんでした。設定・同期を確認してください。':'四季報はまだ同期されていません。設定・同期から読み込めます。';}
 // Keep active search text and personal edits intact when only sync time changed.
 if(changed&&!['#settings','#import'].includes(location.hash))route();
});
// A single header owns appearance, sync, import and settings for all four areas.
utilities.remove();document.querySelector('header .private')?.remove();
const versionLink=document.createElement('a');versionLink.className='workspace-version';versionLink.href='#settings';versionLink.textContent='ver'+appRelease.version;versionLink.setAttribute('aria-label','アプリのバージョン ver'+appRelease.version);document.querySelector('header b').append(versionLink);
const icons={sync:'<path d="M20 12a8 8 0 0 1-13.7 5.6"/><path d="M4 12a8 8 0 0 1 13.7-5.6"/><path d="M17.7 3v3.4h-3.4"/><path d="M6.3 21v-3.4h3.4"/>',import:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',theme:'<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'};
const svg=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[k]}</svg>`;
const actions=document.createElement('div');actions.className='workspace-actions';actions.innerHTML=`<button id="workspace-sync" aria-label="同期" title="同期">${svg('sync')}</button><a href="#import" aria-label="取り込み" title="取り込み">${svg('import')}</a><button id="workspace-theme" aria-label="ダークモードにする" title="配色を切り替え">${svg('theme')}</button><a href="#settings" aria-label="設定" title="設定">${svg('settings')}</a>`;document.querySelector('header').append(actions);
document.getElementById('workspace-sync').onclick=syncWorkspace;
document.getElementById('workspace-theme').onclick=()=>setAppearance(effectiveAppearance()==='dark'?'light':'dark');
frameHost.className='workspace-frame-host';frameHost.removeAttribute('style');
sections.notebook=sections.notebook.filter(([id])=>!['inv:vSet','inv:vImport'].includes(id));
const defaultSections=JSON.parse(JSON.stringify(sections));
const defaultAreaLabels={today:'Today',discover:'Search',notebook:'Note',review:'Review'};
const tabSettingsKey='invnote-workspace-tabs-v1';
let tabSettings={};
try{const value=JSON.parse(localStorage.getItem(tabSettingsKey)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))tabSettings=value;}catch{}
if(tabSettings['discover/inv:vHot']&&!tabSettings['notebook/inv:vHot'])tabSettings['notebook/inv:vHot']=tabSettings['discover/inv:vHot'];
function tabOption(key,label){const value=tabSettings[key];return {label:typeof value?.label==='string'&&value.label.trim()?value.label.trim().slice(0,30):label,hidden:typeof value?.hidden==='boolean'?value.hidden:key==='today/inv:vTodos'};}
function applyTabSettings(){
 for(const [area,items] of Object.entries(defaultSections)){
  sections[area]=items.filter(([id])=>!tabOption(area+'/'+id,'').hidden).map(([id,label])=>[id,tabOption(area+'/'+id,label).label]);
  if(!sections[area].length)sections[area]=[items[0]];
 }
 const allHidden=Object.keys(defaultAreaLabels).every(area=>tabOption(area,'').hidden);
 document.querySelectorAll('nav a[data-view]').forEach(a=>{const area=a.dataset.view,option=tabOption(area,defaultAreaLabels[area]);a.hidden=option.hidden&&!(allHidden&&area==='today');a.querySelector('span').textContent=option.label;});
}
function renderTabSettings(){
 const row=(key,label)=>{const value=tabOption(key,label);return `<div class="workspace-tab-row"><label><input type="checkbox" data-tab-visible="${esc(key)}" ${value.hidden?'':'checked'}> 表示</label><label class="workspace-tab-name">${esc(label)}<input aria-label="${esc(label)}の表示名" data-tab-name="${esc(key)}" value="${esc(value.label)}" maxlength="30"></label></div>`;};
 const panel=document.createElement('section');panel.className='workspace-setting';panel.innerHTML='<h2>タブの名前・表示</h2><p class="muted">下のメニューと各画面の上のタブを変更できます。この端末に保存します。非表示にしても記録は消えません。</p><form id="workspace-tab-form"><details open><summary>下のメニュー</summary>'+Object.entries(defaultAreaLabels).map(([area,label])=>row(area,label)).join('')+'</details>'+Object.entries(defaultSections).map(([area,items])=>`<details><summary>${esc(tabOption(area,defaultAreaLabels[area]).label)} の上のタブ</summary>${items.map(([id,label])=>row(area+'/'+id,label)).join('')}</details>`).join('')+'<p id="workspace-tab-result" role="status"></p><div class="workspace-setting-actions"><button class="action primary" type="submit">タブ設定を保存</button><button class="action" type="button" id="workspace-tab-reset">標準に戻す</button></div></form>';app.append(panel);
 panel.querySelector('form').onsubmit=e=>{
  e.preventDefault();const next={};panel.querySelectorAll('[data-tab-name]').forEach(input=>{const key=input.dataset.tabName;next[key]={label:input.value.trim().slice(0,30),hidden:!Array.from(panel.querySelectorAll('[data-tab-visible]')).find(el=>el.dataset.tabVisible===key).checked};});
  const result=panel.querySelector('#workspace-tab-result');
  if(Object.keys(defaultAreaLabels).every(key=>next[key].hidden)||Object.entries(defaultSections).some(([area,items])=>items.every(([id])=>next[area+'/'+id].hidden))){result.textContent='下のメニューと各画面のタブは、それぞれ1つ以上表示してください。';return;}
  try{localStorage.setItem(tabSettingsKey,JSON.stringify(next));tabSettings=next;applyTabSettings();result.textContent='タブ設定を保存しました。';}catch{result.textContent='保存できませんでした。';}
 };
 panel.querySelector('#workspace-tab-reset').onclick=()=>{try{localStorage.removeItem(tabSettingsKey);tabSettings={};applyTabSettings();route();}catch{panel.querySelector('#workspace-tab-result').textContent='保存できませんでした。';}};
}
applyTabSettings();
const tabPositions=new Map();
app.addEventListener('scroll',e=>{const bar=e.target;if(bar.matches?.('.workspace-tabs'))tabPositions.set(bar.dataset.area,bar.scrollLeft);},true);
function restoreTabPosition(){
 const bar=app.querySelector('.workspace-tabs');if(!bar)return;
 bar.scrollLeft=tabPositions.get(bar.dataset.area)||0;
 const active=bar.querySelector('[aria-current=page]');if(!active)return;
 const bounds=bar.getBoundingClientRect(), item=active.getBoundingClientRect();
 if(item.left<bounds.left)bar.scrollLeft-=bounds.left-item.left+8;
 else if(item.right>bounds.right)bar.scrollLeft+=item.right-bounds.right+8;
 tabPositions.set(bar.dataset.area,bar.scrollLeft);
}
function swipeFeature(direction){
 const [area,sub]=location.hash.slice(1).split('/'),list=sections[area||'today'];if(!list)return;
 const index=Math.max(0,list.findIndex(([id])=>id===sub)),next=index+direction;
 if(next>=0&&next<list.length)location.hash=(area||'today')+'/'+list[next][0];
}
window.addEventListener('message',e=>{if(e.origin===location.origin&&Object.values(frames).some(f=>e.source===f.contentWindow&&!f.hidden)&&e.data?.type==='workspace:swipe'&&[-1,1].includes(e.data.direction))swipeFeature(e.data.direction);});
const workspaceRoute=route;
route=function(){
 const oldBar=app.querySelector('.workspace-tabs');if(oldBar)tabPositions.set(oldBar.dataset.area,oldBar.scrollLeft);
 const h=location.hash.slice(1);
 if(h==='discover/inv:vHot'){location.replace('#notebook/inv:vHot');return;}
 if(h==='notebook/inv:vSet'){location.replace('#settings');return;}
 if(h==='notebook/inv:vImport'){location.replace('#import');return;}
 if(h==='settings'||h==='import'){
  frameHost.hidden=true;app.style.paddingBottom='12px';
  app.innerHTML=`<div class="workspace-back"><a class="action" href="#${priorView}">← 戻る</a></div>`+title(h==='settings'?'SETTINGS':'IMPORT',h==='settings'?'設定':'取り込み',h==='settings'?'表示とデータの管理':'メモ・銘柄・保有情報を取り込む');
  if(h==='settings'){
   app.insertAdjacentHTML('beforeend',`<section class="workspace-setting workspace-release"><h2>アプリのバージョン</h2><p><b>ver${esc(appRelease.version)}</b></p><small>更新日 ${esc(appRelease.date)} · ビルド ${esc(appRelease.build)}</small><ul>${appRelease.changes.map(change=>`<li>${esc(change)}</li>`).join('')}</ul><p class="muted">この端末で読み込んでいる画面のバージョンです。決算データや同期の日時とは別です。</p></section>`);
   app.insertAdjacentHTML('beforeend','<section class="workspace-setting"><h2>アプリの表示</h2><div class="appearance-options"><button class="action" data-appearance="light">ライト</button><button class="action" data-appearance="dark">ダーク</button><button class="action" data-appearance="system">端末に合わせる</button></div><p class="muted">Today・Search・Note・Review 共通の配色です。</p></section><section class="workspace-setting"><h2>同期</h2><p class="muted">登録済みの端末と、メモ・日記・四季報を同期します。</p><div class="workspace-setting-actions"><button class="action" id="settings-sync">今すぐ同期</button><a class="action" href="#import">取り込み</a></div></section>');
   app.querySelectorAll('[data-appearance]').forEach(b=>b.onclick=()=>setAppearance(b.dataset.appearance));document.getElementById('settings-sync').onclick=syncWorkspace;
   renderPaletteSettings();renderTabSettings();
  }
  embedded('inv',h==='settings'?'vSet':'vImport');
  document.querySelectorAll('nav a').forEach(a=>a.removeAttribute('aria-current'));
 }else{workspaceRoute();
  if(h==='notebook/inv:vHot'){
   const entry=document.createElement('section');entry.className='workspace-setting';entry.innerHTML='<p>購入前に確認したい銘柄を、自分でまとめるリストです。保有中の銘柄も追加できます。</p><p class="muted">登録銘柄を開く →「個人メモ・登録情報」→「購入前リストに追加」を押してください。未登録なら「＋ 銘柄を追加」からコード・名前を登録できます。</p><a class="action" href="#notebook/inv:vStocks">登録銘柄から選ぶ・新しく登録する</a>';app.append(entry);
  }
  if(h==='today/inv:vCal'){app.querySelector('.section-top')?.remove();app.querySelector('.eyebrow')?.remove();app.querySelector('h1')?.remove();}
  if(h.includes('/scr:')){const heading=app.querySelector('.section-top');if(heading){const meta=document.createElement('p');meta.id='feature-meta';meta.className='muted';meta.style.fontSize='12px';meta.textContent=featureMeta;heading.append(meta);const b=document.createElement('button');b.className='action';b.textContent='データを再読込';b.onclick=()=>frames.scr.contentWindow.postMessage({type:'workspace:reload'},location.origin);heading.append(b);}}
 }
 for(const f of Object.values(frames)){f.setAttribute('scrolling','no');if(!f.hidden)f.contentWindow?.postMessage({type:'workspace:measure'},location.origin);}
 actions.querySelectorAll('a').forEach(a=>{if(a.hash===location.hash)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 restoreTabPosition();
 paintAppearance();
 window.scrollTo(0,0);
};
// Replace the original event listener; otherwise an old route can overwrite settings.
window.removeEventListener('hashchange',workspaceRoute);window.addEventListener('hashchange',route);
paintAppearance();embedded('inv','vPf');route();

function installFeatureSwipe(root,onSwipe){
 let start=null,suppressUntil=0;
 root.addEventListener('touchstart',e=>{
  start=null;if(e.touches.length!==1||e.target.closest('input,textarea,select,[contenteditable="true"],canvas'))return;
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

installFeatureSwipe(app,swipeFeature);

// Keep the mobile navigation anchored to the visible viewport and reserve its height.
const mainNavigation=document.querySelector('nav[aria-label="メインナビゲーション"]');
function measureNavigation(){
 const viewport=window.visualViewport;
 const offset=viewport?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;
 document.documentElement.style.setProperty('--workspace-nav-offset',offset+'px');
 document.documentElement.style.setProperty('--workspace-nav-space',(mainNavigation.getBoundingClientRect().height+offset+24)+'px');
}
new ResizeObserver(measureNavigation).observe(mainNavigation);
window.addEventListener('resize',measureNavigation);
window.visualViewport?.addEventListener('resize',measureNavigation);
window.visualViewport?.addEventListener('scroll',measureNavigation);
measureNavigation();

// Warm the shared Screener renderer without changing the visible route or frame.
function preloadScreener(){
 if(frames.scr)return;
 const f=document.createElement('iframe');
 f.title='Screenerの既存機能';f.hidden=true;f.setAttribute('scrolling','no');
 f.style.cssText='display:none;visibility:hidden;width:100%;border:0';
 const url=new URL('screener/index.html',location.href);
 const version=new URL(frames.inv.src).searchParams.get('v');
 url.searchParams.set('workspace','1');if(version)url.searchParams.set('v',version);url.hash='ideal';
 f.src=url.href;frames.scr=f;frameHost.append(f);
}
if('requestIdleCallback' in window)requestIdleCallback(preloadScreener,{timeout:1200});
else setTimeout(preloadScreener,300);
