/* Private content arrives only from the existing authenticated Invnote frame. */
'use strict';
const appRelease=JSON.parse(document.getElementById('app-release').textContent);
let personalStocks=[],researchHash='',syncTime=0;
let companyMemos=[],memoDialog=null,memoCode='',memoEditing=null,memoRequest='',memoBusy=false;
function memoDate(ts){return new Date(ts).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function renderCompanyMemos(){
 if(!memoDialog)return;
 const list=memoDialog.querySelector('[data-memo-list]');list.replaceChildren();
 for(const n of companyMemos.filter(n=>n.code===memoCode).sort((a,b)=>b.ts-a.ts)){
  const card=document.createElement('article');card.className='card';
  const date=document.createElement('small');date.textContent='作成 '+memoDate(n.ts)+(n.edited>n.ts?' · 更新 '+memoDate(n.edited):'')+'（日本時間）';card.append(date);
  const text=document.createElement('p');text.style.whiteSpace='pre-wrap';text.textContent=n.memoDeleted?'削除済みのメモ':n.text;card.append(text);
  const actions=document.createElement('div');actions.className='workspace-setting-actions';card.append(actions);
  const add=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='action';b.textContent=label;b.disabled=memoBusy;b.onclick=fn;actions.append(b);};
  if(n.memoDeleted)add('復元',()=>sendCompanyMemo('restore',n));
  else{add('編集',()=>{memoEditing=n;memoDialog.querySelector('textarea').value=n.text;memoDialog.querySelector('textarea').focus();});add('削除',()=>sendCompanyMemo('delete',n));}
  list.append(card);
 }
 if(!list.children.length){const p=document.createElement('p');p.textContent='まだメモはありません。';list.append(p);}
}
function openCompanyMemo(code){
 if(!memoDialog){
  memoDialog=document.createElement('dialog');memoDialog.className='company-memo-dialog';memoDialog.setAttribute('aria-labelledby','company-memo-title');
  memoDialog.innerHTML='<h2 id="company-memo-title"></h2><p>自分用メモ · 日付は自動記録</p><form><label for="company-memo-text">メモ</label><textarea id="company-memo-text" rows="5" maxlength="20000" required></textarea><div class="workspace-setting-actions"><button class="action primary" type="submit">メモを保存</button><button class="action" type="button" data-new>新しいメモ</button><button class="action" type="button" data-close>閉じる</button></div><p role="status"></p></form><div data-memo-list></div>';
  document.body.append(memoDialog);memoDialog.querySelector('form').onsubmit=e=>{e.preventDefault();sendCompanyMemo('save',memoEditing);};
  memoDialog.querySelector('[data-new]').onclick=()=>{memoEditing=null;memoDialog.querySelector('textarea').value='';};
  memoDialog.querySelector('[data-close]').onclick=()=>memoDialog.close();
 }
 memoCode=code;memoEditing=null;memoDialog.querySelector('textarea').value='';memoDialog.querySelector('h2').textContent=code+' '+(notes[code]?.name||'')+' のメモ';memoDialog.querySelector('[role=status]').textContent='';renderCompanyMemos();memoDialog.showModal();
}
function sendCompanyMemo(action,n){
 if(memoBusy)return;
 const output=memoDialog.querySelector('[role=status]');if(!invReady){output.textContent='データの読み込み完了を待ってください。';return;}
 memoBusy=true;memoRequest=crypto.randomUUID();memoDialog.querySelectorAll('button').forEach(b=>b.disabled=true);output.textContent='保存中…';
 frames.inv.contentWindow.postMessage({type:'workspace:memo',request:memoRequest,action,code:memoCode,id:n?.id,expected:n?(n.edited||n.ts):undefined,text:memoDialog.querySelector('textarea').value},location.origin);
 const request=memoRequest;setTimeout(()=>{if(memoBusy&&request===memoRequest){memoBusy=false;memoDialog.querySelectorAll('button').forEach(b=>b.disabled=false);output.textContent='保存の応答を確認できません。入力は残しています。同期後に一覧を確認してください。';}},15000);
}
let ninePriceSyncRequested=false;
let appearanceMode=null,invReady=false,syncTimer,featureMeta='',syncPending=false,invLocked=false;
let transferDialog=null,transferSubmitting=false;
function openTransferDialog(){
 if(!transferDialog){
  transferDialog=document.createElement('dialog');transferDialog.className='workspace-transfer-dialog';transferDialog.setAttribute('aria-labelledby','transfer-dialog-title');
  transferDialog.innerHTML='<h2 id="transfer-dialog-title">引き継ぎコードを入力</h2><p>新しいアイコンで、発行されたコードを入力してください。</p><form><label>この端末の名前<input name="deviceName" value="自分のiPhone" maxlength="60" autocomplete="off"></label><label>引き継ぎコード<input name="transferCode" required autocomplete="off" autocapitalize="none" spellcheck="false"></label><p role="status"></p><div class="workspace-setting-actions"><button class="action" type="submit">この端末に引き継ぐ</button><button class="action" type="button" data-close>戻る</button></div><p class="muted">登録に成功するまで、今の登録とデータを保持します。</p></form>';
  document.body.append(transferDialog);
  transferDialog.querySelector('[data-close]').onclick=()=>{if(!transferSubmitting)transferDialog.close();};
  transferDialog.addEventListener('cancel',e=>{if(transferSubmitting)e.preventDefault();});
  transferDialog.addEventListener('close',()=>{transferDialog.querySelector('[name=transferCode]').value='';});
  transferDialog.querySelector('form').onsubmit=async e=>{
   e.preventDefault();if(transferSubmitting)return;
   transferSubmitting=true;transferDialog.querySelectorAll('button').forEach(b=>b.disabled=true);transferDialog.querySelector('[role=status]').textContent='登録を確認しています…（最大45秒）';
   try{
    await window.SuiteTransfer.register(window.SuiteDeviceConfig,transferDialog.querySelector('[name=transferCode]').value,transferDialog.querySelector('[name=deviceName]').value);
    // Restart the app with the saved credential; its existing restore flow loads cloud data first.
    transferDialog.querySelector('[name=transferCode]').value='';
    location.reload();
   }catch(err){
    transferDialog.querySelector('[role=status]').textContent=({invalid_invite:'コードが違うか、有効期限が切れています。',storage_error:'登録を保存できません。Safariの保存設定をご確認ください。',server_update_required:'登録先の応答を確認できませんでした。更新を確認してください。',device_limit:'登録端末数の上限です。管理端末でご確認ください。'})[err.message]||'通信を確認できませんでした。同じコードで再試行できます。今の登録とデータは保持しています。';
   }finally{transferSubmitting=false;transferDialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
 }
 transferDialog.querySelector('[role=status]').textContent='';transferDialog.querySelector('[type=submit]').disabled=false;
 if(!transferDialog.open)transferDialog.showModal();
}
try{const saved=localStorage.getItem('invnote-workspace-appearance');if(['light','dark','system'].includes(saved))appearanceMode=saved;else{const last=localStorage.getItem('invnote-workspace-resolved-theme');if(['light','dark'].includes(last))appearanceMode=last;}}catch{}
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
 document.documentElement.style.colorScheme=resolved;
 document.querySelector('meta[name=theme-color]')?.setAttribute('content',document.documentElement.style.getPropertyValue('--bg'));
 try{localStorage.setItem('invnote-workspace-resolved-theme',resolved);}catch{}
 document.querySelector('meta[name=color-scheme]')?.setAttribute('content',resolved);
 for(const f of Object.values(frames))f.contentWindow?.postMessage({type:'workspace:theme',theme:resolved},location.origin);
 const button=document.getElementById('workspace-theme');if(button){button.setAttribute('aria-label',resolved==='dark'?'ライトモードにする':'ダークモードにする');button.setAttribute('aria-pressed',String(resolved==='dark'));}
 document.querySelectorAll('[data-appearance]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.appearance===(appearanceMode||'system'))));
}
function setAppearance(mode){appearanceMode=mode;try{localStorage.setItem('invnote-workspace-appearance',mode)}catch{status.textContent='配色を保存できませんでした。';}paintAppearance();}
systemAppearance.addEventListener('change',()=>{if(appearanceMode==='system')paintAppearance()});
function syncWorkspace(){
 const b=document.getElementById('workspace-sync');
 if(!invReady){
  if(invLocked){status.textContent='この画面では端末登録を確認できません。引き継ぎコードで登録してください。';openTransferDialog();return;}
  syncPending=true;b.disabled=true;status.textContent='データ画面の読み込み後に同期します…';
  frames.inv?.contentWindow.postMessage({type:'workspace:refresh'},location.origin);
  clearTimeout(syncTimer);syncTimer=setTimeout(()=>{syncPending=false;b.disabled=false;status.textContent='データ画面を読み込めませんでした。画面を再読み込みしてください。';},15000);return;
 }
 syncPending=false;
 b.disabled=true;status.textContent='同期中…';frames.inv.contentWindow.postMessage({type:'workspace:sync'},location.origin);
 clearTimeout(syncTimer);syncTimer=setTimeout(()=>{b.disabled=false;status.textContent='同期に時間がかかっています。接続設定を確認してください。';},45000);
}
const initialData=JSON.parse(JSON.stringify(D));
function validBundle(d){
 if(d?.kiyoharaRanking!=null){
  const p=d.kiyoharaRanking;
  if(!p||!['date','priceDate','scope','caution'].every(k=>typeof p[k]==='string')||!Array.isArray(p.rows)||p.rows.length>6)return false;
  const codes=new Set();for(const x of p.rows){if(!x||!/^[0-9A-Z]{4,5}$/.test(x.code)||codes.has(x.code)||!['name','reason','detail','counter','next','evidence_confidence'].every(k=>typeof x[k]==='string')||![x.short_3m,x.long_12m].every(v=>v===null||(Number.isInteger(v)&&v>=1&&v<=10)))return false;codes.add(x.code);}
 }
 if(d?.purchaseRanking!=null){
  const p=d.purchaseRanking;
  if(!p||typeof p.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!['scope','caution'].every(k=>typeof p[k]==='string')||!Array.isArray(p.rows))return false;
  const codes=new Set();for(const row of p.rows){if(!row||!/^[0-9A-Z]{4,5}$/.test(row.code)||typeof row.reason!=='string'||codes.has(row.code))return false;codes.add(row.code);}
 }
 if(d?.companyProfiles!==undefined){
  const ps=d.companyProfiles,day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x),url=x=>typeof x==='string'&&/^https:\/\//.test(x);
  if(!ps||typeof ps!=='object'||Array.isArray(ps))return false;
  for(const [c,p] of Object.entries(ps)){
   if(!/^[0-9A-Z]{4,5}$/.test(c)||!p||typeof p.market!=='string'||typeof p.marketAsOf!=='string'||!url(p.marketSource))return false;
   if(p.marketCap!==null&&(!p.marketCap||!Number.isFinite(p.marketCap.oku)||p.marketCap.oku<=0||!day(p.marketCap.asOf)||typeof p.marketCap.basis!=='string'||!url(p.marketCap.source)))return false;
   if(!p.indices||!['nikkei225','topix','growth250'].every(k=>{const x=p.indices[k];return x&&[true,false,null].includes(x.member)&&typeof x.asOf==='string'&&typeof x.source==='string'&&(x.member===null||(day(x.asOf)&&url(x.source)));}))return false;
  }
 }
 if(d?.researchProgress!==undefined){
  const p=d.researchProgress;
  if(!p||!p.companies||typeof p.companies!=='object'||Array.isArray(p.companies))return false;
  for(const [c,r] of Object.entries(p.companies)){
   if(!/^[0-9A-Z]{4,5}$/.test(c)||!r||r.code!==c||!(r.stars===null||(Number.isInteger(r.stars)&&r.stars>=1&&r.stars<=5)))return false;
   if(!['label','reason','assessed_on','record_basis','next_action'].every(k=>typeof r[k]==='string')||typeof r.needs_reassessment!=='boolean')return false;
   if(!Array.isArray(r.blocking_work)||!r.blocking_work.every(x=>typeof x==='string')||!Array.isArray(r.documents)||!Array.isArray(r.records))return false;
   if(r.stars===5&&(r.blocking_work.length||typeof r.completion_basis!=='string'||!r.completion_basis.trim()))return false;
   if(!r.documents.every(x=>x&&typeof x.id==='string'&&typeof x.status==='string'&&(x.evidence===undefined||(Array.isArray(x.evidence)&&x.evidence.every(s=>typeof s==='string')))))return false;
   if(!r.records.every(x=>x&&typeof x.path==='string'&&Array.isArray(x.coverage)&&x.coverage.every(z=>z&&typeof z.field==='string'&&typeof z.scope==='string')))return false;
  }
 }
 if(d?.news!==undefined){
  if(!d.news||!Array.isArray(d.news.entries))return false;
  const ids=new Set();
  for(const n of d.news.entries){
   if(!n||!['id','date','category','headline','summary','caution','asOf'].every(k=>typeof n[k]==='string')||!/^\d{4}-\d{2}-\d{2}$/.test(n.date)||ids.has(n.id))return false;
   if(!['actions','body','codes'].every(k=>Array.isArray(n[k])&&n[k].every(x=>typeof x==='string'))||!n.codes.every(c=>/^[0-9A-Z]{4,5}$/.test(c)))return false;
   if(!Array.isArray(n.sources)||!n.sources.every(s=>s&&typeof s.title==='string'&&typeof s.url==='string'&&/^https:\/\//.test(s.url)))return false;
   ids.add(n.id);
  }
 }

 if(!d||!d.notes||typeof d.notes!=='object'||Array.isArray(d.notes)||!d.ratings||!Array.isArray(d.ratings.rows)||!d.coverage)return false;
 if(!['body_notes','registered','legacy_references'].every(k=>Number.isInteger(d.coverage[k])&&d.coverage[k]>=0))return false;
 if(!d.ratings.horizons?.['3m']||!d.ratings.horizons?.['12m']||!Array.isArray(d.ratings.evaluation_rules))return false;
 return Object.entries(d.notes).every(([c,n])=>/^[0-9A-Z]{4,5}$/.test(c)&&n&&['name','updated','summary','change','business','facts','hypothesis','counter','next','valuation','source_period','stage'].every(k=>typeof n[k]==='string')&&['themes','sources','related'].every(k=>Array.isArray(n[k])&&n[k].every(x=>typeof x==='string'))&&(n.introduction===undefined||(n.introduction&&typeof n.introduction.business==='string'&&typeof n.introduction.earnings==='string'&&Array.isArray(n.introduction.sources)&&n.introduction.sources.every(s=>typeof s==='string'&&/^https:\/\//.test(s)))))
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
 if(mode==='personal'){app.innerHTML=title(esc(code),esc(notes[code]?.name||p?.name||code),'個人メモ・登録情報');app.style.paddingBottom='12px';embedded('inv','stock/'+code);}
 else if(notes[code]){const b=document.createElement('button');b.type='button';b.className='action';b.style.marginLeft='8px';b.textContent='メモ';b.onclick=()=>openCompanyMemo(code);document.getElementById('watch-toggle')?.after(b);}
}
const baseNotebook=notebook;
notebook=function(){baseNotebook();
 const el=document.createElement('p');el.className='muted';el.innerHTML='<a href="#notebook/inv:vStocks">個人の登録銘柄を管理する</a>';app.append(el);
};
window.addEventListener('message',e=>{
 const kind=Object.keys(frames).find(k=>e.source===frames[k].contentWindow);
 if(e.origin!==location.origin||!kind)return;
 if(kind==='inv'&&e.data?.type==='workspace:transfer-dialog'){openTransferDialog();return;}
 if(e.data?.type==='workspace:height'){
  if(frames[kind].dataset.registering==='true')return;
  const h=e.data.height;if(!frameHost.hidden&&!frames[kind].hidden&&Number.isFinite(h)&&h>=100&&h<100000)frames[kind].style.height=Math.ceil(h)+'px';return;
 }
 if(e.data?.type==='workspace:meta'&&kind==='scr'){featureMeta=String(e.data.text||'');const el=document.getElementById('feature-meta');if(el)el.textContent=featureMeta;return;}
 if(e.data?.type==='workspace:painted'){frames[kind].style.visibility='visible';return;}
 if(e.data?.type==='workspace:ready'){
  const tab=frames[kind].dataset.workspaceTab;if(tab)frames[kind].contentWindow.postMessage({type:'workspace:navigate',tab},location.origin);
  frames[kind].contentWindow.postMessage({type:'workspace:theme',theme:effectiveAppearance()},location.origin);return;
 }
 if(kind==='inv'&&e.data?.type==='workspace:registration-open'){frames.inv.dataset.registering='true';frames.inv.style.height=Math.max(380,window.innerHeight-90)+'px';frames.inv.style.minHeight='380px';frameHost.scrollIntoView({block:'start'});return;}
 if(kind==='inv'&&e.data?.type==='workspace:registration-close'){delete frames.inv.dataset.registering;frames.inv.style.minHeight='540px';frames.inv.contentWindow.postMessage({type:'workspace:measure'},location.origin);return;}
 if(kind==='inv'&&e.data?.type==='workspace:restore-status'){status.textContent=typeof e.data.message==='string'?e.data.message:'';return;}
 if(kind==='inv'&&e.data?.type==='workspace:sync-result'){clearTimeout(syncTimer);document.getElementById('workspace-sync').disabled=false;status.textContent=String(e.data.message||'同期を確認してください。');return;}
 if(kind==='inv'&&e.data?.type==='invnote:navigate'&&e.data.route==='notebook/inv:vStocks'){location.hash=e.data.route;return;}
 if(e.origin===location.origin&&e.source===frames.scr?.contentWindow&&e.data?.type==='screener:company'&&/^[0-9A-Z]{4,5}$/.test(e.data.code)){location.hash='company/'+e.data.code;return;}
 if(e.origin!==location.origin||e.source!==frames.inv?.contentWindow)return;
 const m=e.data;
 if(m?.type==='workspace:memo-result'&&m.request===memoRequest){memoBusy=false;memoDialog.querySelectorAll('button').forEach(b=>b.disabled=false);memoDialog.querySelector('[role=status]').textContent=String(m.message||'');if(m.ok){memoEditing=null;memoDialog.querySelector('textarea').value='';}renderCompanyMemos();return;}
 if(m?.type==='invnote:company'&&/^[0-9A-Z]{4,5}$/.test(m.code)){location.hash='company/'+m.code;return;}
 if(m?.type==='invnote:locked'){companyMemos=[];memoDialog?.close();invReady=false;invLocked=true;syncPending=false;clearTimeout(syncTimer);document.getElementById('workspace-sync').disabled=false;replaceResearch(initialData);personalStocks=[];researchHash='';if(!['#settings','#import'].includes(location.hash))route();status.textContent='設定から引き継ぎコードを入力してください。';return;}
 if(m?.type!=='invnote:state')return;
 companyMemos=Array.isArray(m.companyMemos)?m.companyMemos.filter(n=>n.kind==='company-memo-v1'&&typeof n.text==='string'&&/^[0-9A-Z]{4,5}$/.test(n.code)&&Number.isFinite(n.ts)):[];if(memoDialog?.open)renderCompanyMemos();
 invReady=true;invLocked=false;if(syncPending){syncPending=false;clearTimeout(syncTimer);queueMicrotask(syncWorkspace);}if(!appearanceMode&&['light','dark'].includes(m.theme))appearanceMode=m.theme;paintAppearance();
 const nextStocks=Array.isArray(m.stocks)?m.stocks.filter(s=>/^[0-9A-Z]{4,5}$/.test(s.code)&&typeof s.name==='string'&&typeof s.status==='string'):[];
 const changed=m.researchHash!==researchHash||JSON.stringify(nextStocks)!==JSON.stringify(personalStocks);
 personalStocks=nextStocks;syncTime=m.lastSync||0;
 if(validBundle(m.bundle)){replaceResearch(m.bundle);researchHash=m.researchHash;status.textContent=`四季報 ${all.length}社 · ${syncTime?'Invnote 最終同期 '+new Date(syncTime).toLocaleString('ja-JP'):'端末の保存データ'}`;}
 else {replaceResearch(initialData);researchHash='';status.textContent=m.bundle?'四季報の形式を確認できませんでした。設定・同期を確認してください。':'四季報はまだ同期されていません。設定・同期から読み込めます。';}
 // Keep active search text and personal edits intact when only sync time changed.
 if(changed&&!['#settings','#import'].includes(location.hash))route();
 if(validBundle(m.bundle)&&!ninePriceSyncRequested&&!Object.values(m.bundle.notes).some(n=>n.ninePointPrice)){ninePriceSyncRequested=true;queueMicrotask(syncWorkspace);}
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
 // Review contains wide tables and dense records. Horizontal finger drift must
 // not move to another review tab; use the visible tab buttons explicitly.
 if(area==='review')return;
 const index=Math.max(0,list.findIndex(([id])=>id===sub)),next=index+direction;
 if(next>=0&&next<list.length)location.hash=(area||'today')+'/'+list[next][0];
}
window.addEventListener('message',e=>{if(e.origin===location.origin&&Object.values(frames).some(f=>e.source===f.contentWindow&&!f.hidden)&&e.data?.type==='workspace:swipe'&&[-1,1].includes(e.data.direction))swipeFeature(e.data.direction);});
let updateHealth=null;
function renderUpdateHealth(){
 const hash=location.hash.slice(1);
 if(!['','today','today/updates'].includes(hash)||document.getElementById('update-health'))return;
 const box=document.createElement('section');box.id='update-health';box.className='workspace-setting';
 const title=document.createElement('h2');title.textContent='データ更新状況';box.append(title);
 if(!updateHealth){const p=document.createElement('p');p.textContent='更新状況を確認中…';box.append(p);}
 else if(updateHealth.unavailable){const p=document.createElement('p');p.textContent='更新状況を取得できませんでした。';box.append(p);}
 else{
  for(const key of ['daily','weekly','monthly']){
   const job=updateHealth.jobs?.[key];if(!job)continue;
   const p=document.createElement('p');
   const label={complete:'配信確認済み',running:'更新中',failed:'未完・再確認が必要',partial:'一部未完',unverified:'未確認'}[job.status]||'未確認';
   p.textContent=job.label+'：'+label+'（対象 '+(job.period||'未確認')+'）';box.append(p);
  }
  const p=document.createElement('p');p.className='muted';p.textContent='確認時点：'+(updateHealth.asOf||'未確認')+'。四季報の研究日・採点基準日とは別です。';box.append(p);
 }
 app.append(box);
}
fetch('screener/data/update-health.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{updateHealth=data;document.getElementById('update-health')?.remove();renderUpdateHealth();}).catch(()=>{updateHealth={unavailable:true};document.getElementById('update-health')?.remove();renderUpdateHealth();});
const workspaceRoute=route;
route=function(){
 document.getElementById('feature-reload-help')?.remove();
 const oldBar=app.querySelector('.workspace-tabs');if(oldBar)tabPositions.set(oldBar.dataset.area,oldBar.scrollLeft);
 const h=location.hash.slice(1);
 if(h==='discover/scr:catalyst'||h==='discover/scr:macro'){location.replace('#review/'+h.split('/')[1]);return;}
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
   const transfer=document.createElement('section');transfer.className='workspace-setting';transfer.innerHTML='<h2>ホーム画面への引き継ぎ</h2><p>この端末で同期してから、Safariの共有メニューでホーム画面に追加してください。</p><p class="muted">追加したアイコンを開き、端末登録が表示されたら同じ保存先の登録コードで登録します。同期済みのメモ・保有・四季報・Newsを自動で読み込みます。完了まで旧アイコンは残してください。</p><button class="action" id="transfer-sync">引き継ぎ前に同期</button><p class="muted">未同期の変更は、旧アプリ側で同期が必要です。配色・監視リストなど端末内だけの設定は別管理です。</p>';app.append(transfer);document.getElementById('transfer-sync').onclick=syncWorkspace;
   const enterTransfer=document.createElement('button');enterTransfer.className='action';enterTransfer.textContent='引き継ぎコードを入力';enterTransfer.onclick=openTransferDialog;transfer.append(enterTransfer);
   const transferHelp=document.createElement('p');transferHelp.className='muted';transferHelp.textContent='新しいホーム画面アイコンで登録画面が出ない場合は、このボタンから入力できます。すでに管理端末として使えている場合は再入力不要です。';transfer.append(transferHelp);
   renderPaletteSettings();renderTabSettings();
  }
  embedded('inv',h==='settings'?'vSet':'vImport');
  document.querySelectorAll('nav a').forEach(a=>a.removeAttribute('aria-current'));
 }else{workspaceRoute();
  if(h==='notebook/inv:vHot'){
   const entry=document.createElement('section');entry.className='workspace-setting';entry.innerHTML='<p>購入前に確認したい銘柄を、自分でまとめるリストです。保有中の銘柄も追加できます。</p><p class="muted">登録銘柄を開く →「個人メモ・登録情報」→「購入前リストに追加」を押してください。未登録なら「＋ 銘柄を追加」からコード・名前を登録できます。</p><a class="action" href="#notebook/inv:vStocks">登録銘柄から選ぶ・新しく登録する</a>';app.append(entry);
  }
  if(h==='today/inv:vCal'){app.querySelector('.section-top')?.remove();app.querySelector('.eyebrow')?.remove();app.querySelector('h1')?.remove();}
  if(h.includes('/scr:')){const heading=app.querySelector('.section-top');if(heading){const meta=document.createElement('p');meta.id='feature-meta';meta.className='muted';meta.style.fontSize='12px';meta.textContent=featureMeta;heading.append(meta);const help=document.createElement('details');help.id='feature-reload-help';help.style.cssText='font-size:12px;margin-top:24px';const summary=document.createElement('summary');summary.textContent='表示がおかしいとき';help.append(summary);const note=document.createElement('p');note.textContent='公開済みデータを読み直します。株価の取得や銘柄の再計算は行いません。';help.append(note);const b=document.createElement('button');b.className='action';b.textContent='表示を再読み込み';b.onclick=()=>frames.scr.contentWindow.postMessage({type:'workspace:reload'},location.origin);help.append(b);frameHost.append(help);}}
 }
 for(const f of Object.values(frames)){f.setAttribute('scrolling','no');if(!f.hidden)f.contentWindow?.postMessage({type:'workspace:measure'},location.origin);}
 actions.querySelectorAll('a').forEach(a=>{if(a.hash===location.hash)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 restoreTabPosition();
 paintAppearance();
 renderUpdateHealth();
 renderNewsMacro();
 window.scrollTo(0,0);
};
// Replace the original event listener; otherwise an old route can overwrite settings.
window.removeEventListener('hashchange',workspaceRoute);window.addEventListener('hashchange',route);
paintAppearance();embedded('inv','vPf');route();

function installFeatureSwipe(root,onSwipe){
 let start=null,suppressUntil=0;
 root.addEventListener('touchstart',e=>{
  start=null;if(e.touches.length!==1||e.target.closest('input,textarea,select,[contenteditable="true"],[data-no-feature-swipe],canvas'))return;
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

// Never lift the navigation by the keyboard height: Safari already moves fixed UI.
const mainNavigation=document.querySelector('nav[aria-label="メインナビゲーション"]');
function navigationEditing(){
 let el=document.activeElement;
 try{while(el?.tagName==='IFRAME')el=el.contentDocument?.activeElement;}catch{}
 return !!el&&(el.isContentEditable||el.matches('textarea,select,input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"])'));
}
function measureNavigation(){
 const viewport=window.visualViewport;
 const touch=window.matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;
 const keyboardGap=viewport&&viewport.scale===1?window.innerHeight-viewport.height:0;
 const hidden=touch&&(navigationEditing()||keyboardGap>140);
 mainNavigation.hidden=hidden;
 document.documentElement.style.setProperty('--workspace-nav-offset','0px');
 document.documentElement.style.setProperty('--workspace-nav-space',(hidden?24:mainNavigation.getBoundingClientRect().height+24)+'px');
}
new ResizeObserver(measureNavigation).observe(mainNavigation);
window.addEventListener('resize',measureNavigation);
window.visualViewport?.addEventListener('resize',measureNavigation);
window.visualViewport?.addEventListener('scroll',measureNavigation);
document.addEventListener('focusin',measureNavigation);
document.addEventListener('focusout',()=>setTimeout(measureNavigation,0));
window.addEventListener('message',e=>{if(e.origin===location.origin&&Object.values(frames).some(f=>f.contentWindow===e.source)&&e.data?.type==='workspace:focus')measureNavigation();});
measureNavigation();

// Warm the shared Screener renderer without changing the visible route or frame.
function preloadScreener(){
 if(frames.scr)return;
 const f=document.createElement('iframe');
 f.title='Screenerの既存機能';f.hidden=true;f.dataset.workspaceTab='ideal';f.setAttribute('scrolling','no');
 f.style.cssText='display:none;visibility:hidden;width:100%;border:0';
 const url=new URL('screener/index.html',location.href);
 const version=new URL(frames.inv.src).searchParams.get('v');
 url.searchParams.set('workspace','1');if(version)url.searchParams.set('v',version);
 f.src=url.href;frames.scr=f;frameHost.insertBefore(f,document.getElementById('feature-reload-help'));
}
if('requestIdleCallback' in window)requestIdleCallback(preloadScreener,{timeout:1200});
else setTimeout(preloadScreener,300);

function marketPulse(r,late){
 if(late)return {level:0,label:'更新待ち',message:'データの更新を確認するまで、現在の状態は判定しません。'};
 if(r.severe)return {level:5,label:'強い警戒',message:'企業の資金調達環境に強いストレス。リスクの取り方を慎重に点検する局面。'};
 if(r.color==='red')return {level:4,label:'警戒',message:'信用不安に他の悪化も重なっています。相場の不安定化に注意する局面。'};
 if(r.color==='yellow')return {level:3,label:'注意',message:'一部の指標に逆風。強気一辺倒にせず、材料と価格を選ぶ局面。'};
 if(r.missing?.length)return {level:0,label:'判定保留',message:'必要な指標が不足しています。落ち着いているとは判断できません。'};
 if(r.label.includes('緩和方向'))return {level:1,label:'追い風含み',message:'金利・信用環境は緩和方向。企業利益と日本株への波及は別途確認。'};
 return {level:2,label:'落ち着き',message:'接続済みのマクロ指標に目立つ警戒条件はありません。株価の上昇を保証するものではありません。'};
}
// Display rules are provisional monitoring thresholds, not estimated crisis probabilities.
function pulseUsable(item,now=Date.now()){
 const age=(now-Date.parse(item?.date))/86400000,fetchAge=(now-Date.parse(item?.fetched_at))/3600000;
 return !!item&&Number.isFinite(item.value)&&item.status==='fresh'&&!item.stale&&Number.isFinite(age)&&age>=0&&age<=(item.frequency==='quarterly'?150:item.frequency==='monthly'?75:10)&&(!item.fetched_at||(Number.isFinite(fetchAge)&&fetchAge>=0&&fetchAge<=36));
}
function pulseSignal(item,now=Date.now(),late=false){
 if(late||!pulseUsable(item,now))return {color:'gray',label:'判定保留',reason:'未取得・保存値・期限切れは安全と判定しません。',level:0};
 const id=item.id,v=item.value,change=item.changes?.['1m']?.value;
 let level=1,reason='';
 if(id==='BAMLH0A0HYM2'||id==='BAMLC0A4CBBB'){
  const hy=id==='BAMLH0A0HYM2',yellow=hy?3:1.5,red=hy?5:2.5,dy=hy?.5:.2,dr=hy?1:.4;
  level=v>=red?3:v>=yellow?2:1;
  if(Number.isFinite(change))level=Math.max(level,change>=dr?3:change>=dy?2:1);
  // A low level with no change data cannot establish a green signal.
  if(!Number.isFinite(change)&&level===1)return {color:'gray',label:'変化未確認',reason:'水準は低いものの急拡大を確認できません。',level:0};
  reason=`水準 ${yellow}%未満は緑、${yellow}〜${red}%未満は黄、${red}%以上は赤。1か月拡大 +${dy.toFixed(2)}%ptで黄、+${dr.toFixed(2)}%ptで赤へ引上げ。`;
 }else if(id==='VIXCLS'){
  level=v>=30?3:v>=20?2:1;reason='20未満は緑、20〜30未満は黄、30以上は赤。表示単位はVIX指数のpt。';
 }else if(id==='DGS2'||id==='DGS10'){
  if(!Number.isFinite(change))return {color:'gray',label:'変化未確認',reason:'金利は1か月の上昇速度で判定します。',level:0};
  level=change>=.5?3:change>=.25?2:1;reason='1か月上昇 +0.25%pt未満は緑、+0.25〜0.50%pt未満は黄、+0.50%pt以上は赤。低下は景気悪化でも起きるため買い信号ではありません。';
 }else if(id==='T10Y2Y'){
  level=v<0?2:1;reason='逆イールドは黄。解消やスティープニングだけで景気回復・安全と判断しません。';
 }
 return {color:['gray','green','yellow','red'][level],label:['判定保留','基準内','注意','警戒'][level],reason,level};
}
// Credit level badges intentionally exclude speed; the legacy combined signal
// remains available to the existing five-stage overview.
function pulseLevelSignal(item,now=Date.now(),late=false){
 if(!['BAMLH0A0HYM2','BAMLC0A4CBBB'].includes(item?.id))return pulseSignal(item,now,late);
 if(late||!pulseUsable(item,now))return {color:'gray',label:'水準未判定',level:0,reason:'未取得・保存値・期限切れ'};
 const hy=item.id==='BAMLH0A0HYM2',yellow=hy?3:1.5,red=hy?5:2.5;
 const level=item.value>=red?3:item.value>=yellow?2:1;
 return {level,color:['gray','green','yellow','red'][level],label:['未判定','水準内','水準注意','水準警戒'][level],reason:`水準のみ：${yellow}%未満は緑、${yellow}〜${red}%未満は黄、${red}%以上は赤。上昇速度は別欄。`};
}
function pulseSpeedContext(items,banks,now=Date.now(),late=false){
 const speeds=[['BAMLH0A0HYM2','HY',.5],['BAMLC0A4CBBB','BBB',.2]].map(([id,label,threshold])=>{
  const item=items.find(x=>x.id===id),change=item?.changes?.['1m']?.value;
  const known=!late&&pulseUsable(item,now)&&Number.isFinite(change);
  return {id,label,threshold,known,change:known?change:null,date:item?.date||'未取得',hit:known&&change>=threshold};
 });
 const primary=speeds.some(x=>x.hit)?2:speeds.every(x=>x.known)?1:0;
 const bankHit=banks.broadLevel>=2||banks.regionalLevel>=2,bankKnown=banks.broadLevel>0&&banks.regionalLevel>0;
 const level=primary===2?(bankHit?3:2):primary;
 const label=level===3?'警戒強化':level===2?'一次警戒':level===1?'速度基準未満':'速度未判定';
 const detail=primary===2?(bankHit?'信用の急拡大に銀行株下落も重なっています。':bankKnown?'信用が急拡大。銀行株下落を待たず一次警戒します。':'信用が急拡大。銀行側は一部未判定ですが、一次警戒は維持します。'):primary===1?(bankHit?'銀行株に弱さはありますが、信用の上昇速度は一次警戒基準未満です。':'信用の上昇速度は一次警戒基準未満です。'):bankHit?'銀行株に弱さがあります。信用の速度データ不足で段階は未判定です。':'信用の速度データが不足しています。';
 return {speeds,primary,bankHit,bankKnown,level,label,detail};
}
function pulseSpeedHTML(s){
 const colors=['gray','green','yellow','red'];
 const rows=s.speeds.map(x=>`<div class="pulse-bank"><span>${x.label}の1か月変化</span><strong class="pulse-signal is-${x.known?(x.hit?'yellow':'green'):'gray'}">${x.known?(x.hit?'急拡大':'基準未満'):'未判定'}</strong><p>${x.known?`${x.change>0?'+':''}${x.change.toFixed(2)}%pt`:'—'} ／ 一次警戒 +${x.threshold.toFixed(2)}%pt以上<br>${esc(x.date)}までの比較${x.known?'':' · 現在の判定に使えません'}</p></div>`).join('');
 return `<section class="pulse-credit pulse-speed" aria-label="信用の上昇速度と警戒段階"><h3>信用の上昇速度 <strong class="pulse-signal is-${colors[s.level]}">${s.label}</strong></h3><p>${esc(s.detail)}</p><div class="pulse-speed-values">${rows}</div><p>① HYかBBBが急拡大 → 一次警戒<br>② さらにKBEかKREが下落基準に到達 → 警戒強化</p>${s.speeds.some(x=>!x.known)||!s.bankKnown?'<p>一部データは未判定です。確認できた悪化は表示し、欠測を安全とは扱いません。</p>':''}<small>水準の信号・5段階総合とは別の補助信号。銀行の下落基準と日付は下欄に表示。速度は各系列の1か月変化を使います。過去検証では誤報や見逃しが残り、銀行条件で警告が遅れる例もありました。暴落予測・売買指示ではありません。</small></section>`;
}
function pulseMetric(items,id,label,digits,unit,changePeriod=''){
 const item=items.find(x=>x.id===id),value=item?.value,change=item?.changes?.[changePeriod]?.value;
 return {id,item,label,value:Number.isFinite(value)?value.toFixed(digits):'—',unit,date:item?.date||'未取得',saved:item?.status&&item.status!=='fresh',change:Number.isFinite(change)?change:null};
}
function pulseCreditContext(items,extra,engine,now=Date.now()){
 // Filter each source's freshness before common-date comparison. No missing=zero.
 const combined=[...items,...(extra?.items||[])].filter(x=>pulseUsable(x,now));
 const credit=engine.aligned(combined,['BAMLH0A0HYM2','BAMLC0A4CBBB'],30,now);
 const banks=engine.aligned(combined,['KBE','SP500'],30,now);
 const regional=engine.aligned(combined,['KRE','SP500'],30,now);
 const transmission=engine.aligned(combined,['KBE','KRE','SP500','BAMLC0A4CBBB'],30,now);
 const rates=engine.aligned(combined,['DGS10','DGS2'],30,now);
 const percent=x=>x&&x.before>0?100*x.change/x.before:null;
 const bankReturn=percent(banks?.values.KBE),marketReturn=percent(banks?.values.SP500);
 const relative=Number.isFinite(bankReturn)&&Number.isFinite(marketReturn)?bankReturn-marketReturn:null;
 const bankSignal=(value,rel)=>!Number.isFinite(value)||!Number.isFinite(rel)?0:value<=-10||(value<0&&rel<=-7)?3:value<=-5||(value<0&&rel<=-3)?2:1;
 const broadLevel=bankSignal(bankReturn,relative),regionalReturn=percent(regional?.values.KRE),regionalMarket=percent(regional?.values.SP500);
 const regionalRelative=Number.isFinite(regionalReturn)&&Number.isFinite(regionalMarket)?regionalReturn-regionalMarket:null;
 const regionalLevel=bankSignal(regionalReturn,regionalRelative),bankLevel=Math.max(broadLevel,regionalLevel);
 let transmissionText='銀行セクター・地銀・BBBの共通日比較は未判定';
 if(transmission){
  const v=transmission.values,kbe=percent(v.KBE),kre=percent(v.KRE),sp=percent(v.SP500),b=v.BAMLC0A4CBBB;
  const weak=bankSignal(kbe,kbe-sp)>=2||bankSignal(kre,kre-sp)>=2,bbbWidening=b.change>=.2;
  transmissionText=weak&&bbbWidening?'銀行株の弱さとBBB拡大が同時進行（信用不安の広がりを警戒）':weak?'銀行株に弱さ、BBBへの広がりは急拡大基準未満':bbbWidening?'BBBは拡大、銀行株下落との同時悪化は未確認':'銀行株とBBBの同時悪化は基準未満';
 }
 const hy=credit?.values.BAMLH0A0HYM2,bbb=credit?.values.BAMLC0A4CBBB;
 const hyBad=!!hy&&(hy.value>=3||hy.change>=.5),bbbBad=!!bbb&&(bbb.value>=1.5||bbb.change>=.2);
 const rateBad=!!rates&&(rates.values.DGS10.change>=.25||rates.values.DGS2.change>=.25);
 const rateKnown=!!rates,creditKnown=!!credit;
 let kind='接続指標は警戒基準内';
 if((hyBad||bbbBad)&&rateBad)kind='金利上昇と信用不安が併存';
 else if(hyBad||bbbBad)kind=bankLevel>=2&&bbbBad?'銀行株とBBBに警戒材料':'信用リスク型の警戒';
 else if(rateBad)kind=creditKnown?'金利上昇型の候補':'金利上昇・信用側は未判定';
 else if(bankLevel>=2)kind='銀行株が弱い・原因は未特定';
 else if(!creditKnown||!rateKnown||!broadLevel||!regionalLevel)kind='一部未判定';
 const spreadText=!credit?'HY・BBBの共通日比較は未確認':hy.change>=.5&&bbb.change>=.2?'HY・BBBが同時拡大（信用不安の広がりを警戒）':bbb.change>=.2?'BBBも拡大（HYとの因果関係は未確定）':hy.change>=.5?'HY拡大、BBBへの広がりは基準未満':'HY・BBBの同時急拡大は基準未満';
 return {kind,credit,banks,rates,bankReturn,marketReturn,relative,bankLevel,broadLevel,regional,regionalReturn,regionalRelative,regionalLevel,transmission,transmissionText,spreadText};
}
function pulseCreditHTML(context,extra,now=Date.now()){
 const c=context,signed=(x,d=2)=>Number.isFinite(x)?(x>0?'+':'')+x.toFixed(d):'—';
 const names=['判定保留','基準内','注意','警戒'],colors=['gray','green','yellow','red'];
 const bankRow=(label,pair,value,relative,level)=>`<div class="pulse-bank"><span>${label}</span><strong class="pulse-signal is-${colors[level]}">${names[level]}</strong><p>${pair?`1か月 ${signed(value)}% ／ S&P500比 ${signed(relative)}%pt（${esc(pair.from)} → ${esc(pair.to)}）`:'共通日のETF・S&P500データ不足'}</p></div>`;
 const t=c.transmission,tv=t?.values,pct=x=>100*x.change/x.before;
 const transmissionDetail=t?`共通期間 ${esc(t.from)} → ${esc(t.to)}：KBE ${signed(pct(tv.KBE))}%、KRE ${signed(pct(tv.KRE))}%、地銀−銀行セクター ${signed(pct(tv.KRE)-pct(tv.KBE))}%pt、BBB ${signed(tv.BAMLC0A4CBBB.change)}%pt。`:'';
 const items=extra?.items||[],row=(id,label,quarterly=false)=>{
  const x=items.find(x=>x.id===id),valid=pulseUsable(x,now),value=Number.isFinite(x?.value)?x.value.toFixed(2)+'%':'未取得',change=x?.changes?.[quarterly?'3m':'1m']?.value;
  return `<div><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(x?.date||'未取得')}${quarterly?'対象期':''}${valid?'':' · 現在の判定には使いません'}${Number.isFinite(change)?` ／ ${quarterly?'前期差':'1か月'} ${signed(change)}%pt`:''}</small></div>`;
 };
 return `<section class="pulse-credit" aria-label="銀行と信用リスク"><h3>${esc(c.kind)}</h3><p>${esc(c.spreadText)}${c.credit?`。共通期間 ${esc(c.credit.from)} → ${esc(c.credit.to)}：HY ${signed(c.credit.values.BAMLH0A0HYM2.change)}%pt、BBB ${signed(c.credit.values.BAMLC0A4CBBB.change)}%pt。`:''}</p>${bankRow('米銀行セクター・KBE',c.banks,c.bankReturn,c.relative,c.broadLevel)}${bankRow('米地銀・KRE',c.regional,c.regionalReturn,c.regionalRelative,c.regionalLevel)}<p><b>${esc(c.transmissionText)}</b><br>${transmissionDetail}</p><small>KBEは銀行セクターの代理で全銀行を網羅せず、地銀も多く含みます。KREと構成銘柄が重複します。日次終値・配当なしで比較。株価下落とBBB拡大の同時発生は、波及の因果を証明しません。</small><details class="pulse-reference"><summary>借換え環境・貸出基準を見る</summary><div class="pulse-refinance">${row('BAMLH0A0HYM2EY','HY社債利回り')}${row('BAMLC0A4CBBBEY','BBB社債利回り')}${row('DRTSCIS','小企業向け貸出基準・厳格化超',true)}${row('DRTSCILM','大中企業向け貸出基準・厳格化超',true)}</div><p>借換えは金利とスプレッドの両方が重要。社債利回りは既発債市場の参考値で、個社の借換え金利ではありません。旧借入金利・今後の満期額・発行量/発行中止・利払い余力は別途確認します。</p><p>貸出基準は「厳格化した銀行−緩和した銀行」の純割合。プラスは厳格化超、マイナスは緩和超。四半期調査で速報性は低く、日付は対象期です。貸出減少には需要減もあるため、供給制約と区別します。</p><p>地銀は預金流出・商業用不動産・債券評価損も確認。米地銀専用の<a href="https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-regional-banking-etf-kre" target="_blank" rel="noopener">KRE</a>を自動取得し、銀行セクターの<a href="https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-bank-etf-kbe" target="_blank" rel="noopener">KBE</a>と別表示。日本の地銀とは区別します。</p><p>銀行株安＋HY/BBB拡大＋貸出厳格化が重なるほど信用収縮を警戒しますが、ここで因果やクレジットクランチを確定しません。</p><p><a href="https://finance.yahoo.com/quote/KBE/history/" target="_blank" rel="noopener">KBE価格</a> · <a href="https://finance.yahoo.com/quote/KRE/history/" target="_blank" rel="noopener">KRE価格</a> · <a href="https://fred.stlouisfed.org/series/DRTSCIS" target="_blank" rel="noopener">貸出基準</a> · <a href="https://fred.stlouisfed.org/series/BAMLH0A0HYM2EY" target="_blank" rel="noopener">HY利回り</a> · <a href="https://fred.stlouisfed.org/series/BAMLC0A4CBBBEY" target="_blank" rel="noopener">BBB利回り</a></p></details></section>`;
}
function pulseCurve(r){
 const curve=r?.curve,a=curve?.values?.DGS10?.change,b=curve?.values?.DGS2?.change,label=r?.curveLabel||'';
 if(!curve||!Number.isFinite(a)||!Number.isFinite(b))return {label:'判定保留',detail:'共通日の金利データ不足'};
 const names=[['Bull Steepening','ブル・スティープニング'],['Bull Flattening','ブル・フラットニング'],['Bear Steepening','ベア・スティープニング'],['Bear Flattening','ベア・フラットニング']];
 let ja=names.find(x=>label.includes(x[0]))?.[1];
 if(!ja&&label.includes('概ね横ばい'))ja=a>0&&b>0?'ベア・パラレル':a<0&&b<0?'ブル・パラレル':'長短差は概ね横ばい';
 if(!ja)ja='金利の方向が混在';
 const signed=v=>(v>0?'+':'')+v.toFixed(2);
 return {label:ja,detail:`1か月変化：2年 ${signed(b)}%pt ／ 10年 ${signed(a)}%pt`};
}
async function renderNewsMacro(){
 const el=document.getElementById('news-macro');if(!el)return;
 const fmt=v=>{const d=new Date(v);return Number.isFinite(+d)?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d):'未取得';};
 try{
  const [data,engine,configModule,extra]=await Promise.all([fetch('screener/data/macro.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}),import('./screener/macro-engine.js?v=2.18'),import('./screener/macro-config.js?v=2.18'),fetch('screener/data/credit-monitor.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>null)]);
  if(!el.isConnected)return;
  let config=configModule.DEFAULTS;try{const v=localStorage.getItem('screener_macro_config_v2');if(v)config=configModule.validateConfig(JSON.parse(v));}catch{}
  const r=engine.classifyRegime(data.items,Date.now(),config),dates=data.items.filter(x=>x.frequency==='daily'&&x.date).map(x=>x.date).sort(),monthly=data.items.filter(x=>x.frequency==='monthly'&&x.date).map(x=>x.date.slice(0,7)),bad=data.items.filter(x=>x.status!=='fresh');
  const age=Date.now()-Date.parse(data.generated_at),late=!Number.isFinite(age)||age>36*3600000;
   let pulse=marketPulse(r,late);const labels=['追い風含み','落ち着き','注意','警戒','強い警戒'];
   const metrics=[pulseMetric(data.items,'DGS2','米2年金利',2,'%','1m'),pulseMetric(data.items,'DGS10','米10年金利',2,'%','1m'),pulseMetric(data.items,'T10Y2Y','10年−2年',2,'%pt'),pulseMetric(data.items,'VIXCLS','VIX',1,'pt'),pulseMetric(data.items,'BAMLH0A0HYM2','HY社債・水準',2,'%','1m'),pulseMetric(data.items,'BAMLC0A4CBBB','BBB社債・水準',2,'%','1m')],curve=pulseCurve(r);
   const signals=metrics.map(x=>pulseLevelSignal(x.item,Date.now(),late));
   const context=pulseCreditContext(late?[]:data.items,extra,engine);
   const speed=pulseSpeedContext(data.items,context,Date.now(),late);
   const overallSignals=metrics.map(x=>pulseSignal(x.item,Date.now(),late));
   const alertLevel=Math.max(...overallSignals.map(x=>x.level),context.bankLevel);
   if(!late&&alertLevel>=2&&pulse.level<(alertLevel===3?4:3))pulse={level:alertLevel===3?4:3,label:alertLevel===3?'指標に警戒':'指標に注意',message:'個別指標が警戒基準に達しています。水準・変化・銀行株を併せて背景を確認します。'};
   if(!late&&pulse.level<=2&&(overallSignals.some(x=>!x.level)||!context.broadLevel||!context.regionalLevel))pulse={level:0,label:'一部未判定',message:'主要指標または銀行株の比較値が不足しています。緑を安全判定として扱いません。'};
  el.dataset.pulse=String(pulse.level);
   el.innerHTML=`<div class="pulse-header"><strong>Market Pulse</strong><span>DAILY DIGEST · 毎朝更新</span></div><div class="pulse-summary"><b>${pulse.level?pulse.level+' / 5 · ':''}${esc(pulse.label)}</b><p>${esc(pulse.message)}</p></div><div class="pulse-metrics" aria-label="主要な市場指標">${metrics.map((x,i)=>`<div><span>${esc(x.label)}</span><strong class="pulse-signal is-${signals[i].color}" title="${esc(signals[i].reason)}">${signals[i].label}</strong><b>${esc(x.value)}${x.value==='—'?'':`<small>${esc(x.unit)}</small>`}</b><em>${esc(x.date)}${x.saved?' · 保存値':''}${x.change===null?'':` · <i class="${x.change>0?'is-wider':x.change<0?'is-narrower':''}">1か月 ${x.change>0?'+':''}${x.change.toFixed(2)}%pt</i>`}</em></div>`).join('')}</div><p class="pulse-legend">緑＝基準内 ／ 黄＝注意 ／ 赤＝警戒 ／ 灰＝未判定。HY・BBBの色は水準のみ。上昇速度は下欄で別判定します。値は国債に対する上乗せ幅（社債利回りではありません）。</p>${pulseSpeedHTML(speed)}<div class="pulse-curve"><span>米国イールドカーブ</span><b>${esc(curve.label)}</b><small>${esc(curve.detail)}</small></div>${pulseCreditHTML(context,extra)}<div class="pulse-scale" aria-label="5段階の警戒度。数字が大きいほど警戒">${labels.map((label,i)=>`<span class="pulse-step ${pulse.level===i+1?'is-current':''}"><b>${i+1}</b>${label}</span>`).join('')}</div><small class="pulse-note">金利・カーブ・社債スプレッド・VIXによる暫定評価 · 米国中心${r.missing.length?' · 一部指標不足':''}</small><details class="news-story"><summary><span class="news-category">判定の背景</span><span class="news-headline">${esc(r.label)}</span><span class="news-expand">＋</span></summary><div class="news-body"><p>金利・信用スプレッド（企業の資金調達への警戒）・VIX（相場への不安の目安）などを、決めた条件で自動分類しています。社債スプレッドは拡大が警戒、縮小が改善の方向です。個別信号は今回の暫定監視基準で、公式な危機判定や検証済み売買ルールではありません。HY：3%未満緑／3〜5%未満黄／5%以上赤、BBB：1.5%未満緑／1.5〜2.5%未満黄／2.5%以上赤。上昇速度の補助信号は1か月拡大HY +0.50%ptまたはBBB +0.20%ptで一次警戒、さらにKBEかKREの下落基準到達で警戒強化。水準の色を上昇速度で引き上げません。既存5段階総合は従来の水準・変化条件を保持しています。VIX：20未満緑／20〜30未満黄／30以上赤。米2年・10年金利：1か月上昇+0.25/+0.50%ptで黄/赤。銀行株（KBE・KRE各々）：1か月−5/−10%以下、または銀行株下落かつS&P500比−3/−7%pt以下で黄/赤。逆イールドは黄。緑も買い信号や安全保証ではありません。従来の総合判定に個別信号の警戒を重ねています。カーブ分類は1か月の2年・10年金利の共通日比較です。今日や明日の株価を予言する表示ではありません。</p><p>${esc(r.reason)}</p><p>最終取得処理：${esc(fmt(data.generated_at))} 日本時間 · 毎朝7時</p><p>日次指標：${esc(dates[0]||'未取得')}〜${esc(dates.at(-1)||'未取得')}<br>月次統計：${esc([...new Set(monthly)].join(' / ')||'未取得')}</p><p>${late?'取得処理が古いため、直近の変動を反映していない可能性があります。':''}${bad.length?esc(bad.map(x=>x.name).join('・'))+'は未取得または保存値です。':''}</p><p>${esc(r.actions)}</p><small>取得可能な指標による暫定判定。発表直後のニュース、企業利益、日本市場全体の需給は別途調査します。灰は安全の意味ではありません。</small><p><a href="#review/scr:macro">指標と判定根拠</a> · <a href="#review/history">月次分類の履歴</a></p></div></details>`;
 }catch{if(el.isConnected)el.innerHTML='<p class="muted">市場環境を取得できません。自動判定は未確認です。</p>';}
}

function kiyoharaEvaluatedRows(rows,feed,orderPolicy){
 const evidence=new Map((feed?.items||[]).map(x=>[x.code,x.buyback]));
 if(orderPolicy==='reviewed')return rows.map((x,i)=>({...x,buyback:evidence.get(x.code)||null,originalPosition:i}));
 return rows.map((x,i)=>({...x,buyback:evidence.get(x.code)||null,originalPosition:i})).sort((a,b)=>(b.long_12m-a.long_12m)||((b.buyback?.priority||0)-(a.buyback?.priority||0))||a.originalPosition-b.originalPosition);
}
function kiyoharaEvidenceText(b){
 if(!b)return '自社株買い実行・株数純減：判定不明（候補データ未取得または対象外）';
 const yes=v=>v===true?'あり':v===false?'なし':'不明';
 return `追加評価：${b.label} ／ 実行 ${yes(b.executed)}・株数純減 ${yes(b.shrunk)}${b.shareChangePct==null?'':'（前年比 '+b.shareChangePct.toFixed(3)+'%）'} ／ ${b.fyEnd||'—'}期・開示 ${b.disclosed||'—'}・判定基準 ${b.asof}。年次CFで判定、買付枠の発表ではありません。`;
}
function methodScreenGroupHTML(g){
 const route=['cand','reb','cs'].includes(g.route)?g.route:null;if(!route)return '';
 const label=route==='cand'?'清原式 · 機械抽出':g.name;
 const kind=route==='reb'?'固定条件の進行順。個社調査による購入推奨順位ではありません。':'機械抽出の順位。個社調査による購入推奨順位ではありません。';
 return `<section class="method-ranking-group"><h2>${esc(label)}</h2><p class="muted">${esc(g.priceDate)} 終値基準 · ${esc(kind)}</p><p>${esc(g.rule)}</p>${g.rows.map((x,i)=>`<details class="card"><summary>${i+1}位 ${esc(x.name)} · ${esc(x.code)}</summary><p>${x.previousRank==null?'比較開始':x.previousRank===i+1?'→ 据置':x.previousRank>i+1?'↑ '+(x.previousRank-i-1):'↓ '+(i+1-x.previousRank)} · 前回 ${esc(g.previousDate||'比較開始')}</p><p>${esc(x.detail)}</p>${notes[x.code]?`<button class="open" data-company="${esc(x.code)}">会社の調査を読む</button>`:''}<p><a href="#discover/scr:${route}">一覧と抽出条件を見る</a></p></details>`).join('')||'<p>現在の候補はありません。</p>'}</section>`;
}
async function renderMethodRankings(){
 const el=document.getElementById('method-rankings');if(!el)return;
 const privateRank=D.kiyoharaRanking;
 let feed=null;
 try{const response=await fetch('screener/data/candidates.json',{cache:'no-store'});if(response.ok)feed=await response.json();}catch{}
 if(!el.isConnected)return;
 const bt=feed?.buybackBacktest,stats=bt?.rows?.buyback_and_shrink;
 const evidenceHTML=stats?`<div class="card"><b>清原式＋実行・純減：過去のプラス割合 ${stats.positive_pct.toFixed(2)}% ／ 半年平均利益率 +${stats.mean_pct.toFixed(2)}%</b><p>追加群 ${stats.evaluated}件。追加なし：プラス ${bt.rows.baseline.positive_pct.toFixed(2)}% ／ 平均 +${bt.rows.baseline.mean_pct.toFixed(2)}%。往復費用0.5%後。</p><p>${esc(bt.note)}</p></div>`:'';
 const privateHTML=evidenceHTML+(privateRank?.rows?.length?'<h2>清原式 · 今買うならの個社調査順位</h2>'+`<p class="muted">調査 ${esc(privateRank.date)} · ${esc(privateRank.priceDate)}終値基準<br>${esc(privateRank.scope)}</p><p class="muted">${esc(privateRank.caution)}</p><p>個社調査の比較順位を固定表示。機械判定で並び替えません。</p><p>${esc(privateRank.definitions||"")}</p>`+kiyoharaEvaluatedRows(privateRank.rows,feed,privateRank.orderPolicy).map((x,i)=>`<details class="card"><summary>${i+1}位 ${esc(x.name)} · ${esc(x.code)} · ${esc(x.status||"")}</summary><p>${esc(x.detail)}</p><p>${esc(x.facts||"")}</p><p>${esc(kiyoharaEvidenceText(x.buyback))}</p><p>3か月 ${x.short_3m==null?"採点保留":x.short_3m+"/10"} · 12か月 ${x.long_12m==null?"採点保留":x.long_12m+"/10"} · 根拠 ${esc(x.evidence_confidence)}</p><p>${esc(x.reason)}</p><p><b>反証</b> ${esc(x.counter)}</p><p><b>次の確認</b> ${esc(x.next)}</p><p>個社調査による裁量比較。NC順・点数順ではありません。</p><button class="open" data-company="${esc(x.code)}">会社の調査を読む</button></details>`).join(''):'');
 el.innerHTML=privateHTML;
 try{const r=await fetch('screener/data/method-rankings.json',{cache:'no-store'});if(!r.ok)throw Error();const d=await r.json();if(!el.isConnected)return;
 el.innerHTML=privateHTML+d.groups.map(methodScreenGroupHTML).join('');
 }catch{if(el.isConnected)el.innerHTML=privateHTML+'<p>スクリーニング順位は取得できませんでした。</p>';}
 if(el.isConnected&&feed?.valuationMethod)el.insertAdjacentHTML('afterbegin',`<p class="muted">清原式の分割・開示基準を修正済み。${esc(feed.financialNote)} 旧20年検証は成績採用を停止しています。</p>`);
}
