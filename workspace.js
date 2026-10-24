/* Private content arrives only from the existing authenticated Invnote frame. */
'use strict';
const appRelease=JSON.parse(document.getElementById('app-release').textContent);
let personalStocks=[],personalPositions=[],positionMeta={},researchHash='',syncTime=0;
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
function openCompanyMemo(code,initialText=''){
 if(!memoDialog){
  memoDialog=document.createElement('dialog');memoDialog.className='company-memo-dialog';memoDialog.setAttribute('aria-labelledby','company-memo-title');
  memoDialog.innerHTML='<h2 id="company-memo-title"></h2><p>自分用メモ · 日付は自動記録</p><form><label for="company-memo-text">メモ</label><textarea id="company-memo-text" rows="5" maxlength="20000" required></textarea><div class="workspace-setting-actions"><button class="action primary" type="submit">メモを保存</button><button class="action" type="button" data-new>新しいメモ</button><button class="action" type="button" data-close>閉じる</button></div><p role="status"></p></form><div data-memo-list></div>';
  document.body.append(memoDialog);memoDialog.querySelector('form').onsubmit=e=>{e.preventDefault();sendCompanyMemo('save',memoEditing);};
  memoDialog.querySelector('[data-new]').onclick=()=>{memoEditing=null;memoDialog.querySelector('textarea').value='';};
  memoDialog.querySelector('[data-close]').onclick=()=>memoDialog.close();
 }
 memoCode=code;memoEditing=null;memoDialog.querySelector('textarea').value=initialText;memoDialog.querySelector('h2').textContent=code+' '+(notes[code]?.name||personalStocks.find(x=>x.code===code)?.name||'')+' のメモ';memoDialog.querySelector('[role=status]').textContent='';renderCompanyMemos();memoDialog.showModal();
}
function heldCompanyRows(positions,stocks){
 const result=new Map();
 for(const p of positions||[]){
  if(!/^[0-9A-Z]{4,5}$/.test(p.code||'')||!Number.isFinite(p.shares)||p.shares<=0)continue;
  const row=result.get(p.code)||{code:p.code,name:stocks.find(x=>x.code===p.code)?.name||p.code,shares:0,accounts:[],price:null,priceDate:''};
  if(Number.isFinite(p.price)&&p.price>0&&/^\d{4}-\d{2}-\d{2}$/.test(p.priceDate||'')&&(!row.priceDate||p.priceDate>row.priceDate)){row.price=p.price;row.priceDate=p.priceDate;}
  row.shares+=p.shares;if(p.acct&&!row.accounts.includes(p.acct))row.accounts.push(p.acct);result.set(p.code,row);
 }
 return [...result.values()].sort((a,b)=>a.code.localeCompare(b.code));
}
function holdingMemoHTML(code){
 const list=companyMemos.filter(n=>n.code===code&&!n.memoDeleted).sort((a,b)=>(b.edited||b.ts)-(a.edited||a.ts));
 return list.length?list.map(n=>`<details><summary>自分のメモ · ${esc(memoDate(n.edited||n.ts))}</summary><p class="detail-body">${esc(n.text)}</p></details>`).join(''):'<p class="muted">買い増しのタイミング・条件はまだ記録されていません。</p>';
}
function holdingsPlanPage(){
 app.innerHTML=title('MY HOLDINGS','保有銘柄','保有中の銘柄だけを表示。買い増しの価格・タイミング・見送る条件を確認できます。');
 if(!invReady||invLocked){app.innerHTML+='<p class="empty">保有情報の読み込み・同期後に表示します。</p>';return;}
 const rows=heldCompanyRows(personalPositions,personalStocks);
 app.innerHTML+=`<p>${rows.length}銘柄 · 同じ銘柄の複数口座はまとめて表示</p><p class="muted">保有記録 ${esc(positionMeta.date||'基準日未記録')} · ${positionMeta.complete?'全保有として登録されたデータ':'一部の保有情報の可能性があります'}。売買後はポートフォリオを更新してください。</p>`;
 if(!rows.length){app.innerHTML+='<p class="empty">保存されている保有情報に、株数がプラスの銘柄はありません。</p><a class="action" href="#today/inv:vPf">ポートフォリオを確認</a>';return;}
 app.innerHTML+='<div class="grid">'+rows.map(p=>{
  const code=p.code,n=notes[code],r=ratings[code];
  return `<article class="card"><h2><button class="open" data-company="${esc(code)}">${esc(n?.name||p.name)}（${esc(code)}）</button></h2><p>保有 ${p.shares.toLocaleString('ja-JP')}株${p.accounts.length?' · '+p.accounts.map(esc).join(' / '):''}</p><p class="holding-current-price">最新の保有株価：${p.price!=null?`<strong class="price-accent">${p.price.toLocaleString('ja-JP')}円</strong><br><small>価格日 ${esc(p.priceDate)} · ポートフォリオの更新・同期に連動</small>`:'未取得・未同期'}</p>${companyMemos.some(m=>m.code===code&&!m.memoDeleted)?holdingMemoHTML(code):''}${r?`<div class="rating-pair"><div><span>3か月</span><b>${esc(r.short_3m)}</b> / 10</div><div><span>12か月</span><b>${esc(r.long_12m)}</b> / 10</div></div><small>採点 ${esc(r.assessment_date||R.assessment_date)} · 採点時の株価 ${Number(r.baseline_close).toLocaleString('ja-JP')}円（${esc(r.baseline_price_date)}）</small>${ninePointPriceLine(code)}`:'<p>投資妙味：未採点・未同期</p>'}${n?earningsDates(n):'<p>研究本文は未収録です。</p>'}${rankingPriceDetails(code)}<details><summary>次の確認・見立てが変わる条件</summary><p>${esc(n?.next||'未記録')}</p><p>${esc(r?.change_conditions||n?.counter||'未記録')}</p></details></article>`;
 }).join('')+'</div>';

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
 if(m?.type==='invnote:locked'){companyMemos=[];memoDialog?.close();invReady=false;invLocked=true;syncPending=false;clearTimeout(syncTimer);document.getElementById('workspace-sync').disabled=false;replaceResearch(initialData);personalStocks=[];personalPositions=[];positionMeta={};researchHash='';if(!['#settings','#import'].includes(location.hash))route();status.textContent='設定から引き継ぎコードを入力してください。';return;}
 if(m?.type!=='invnote:state')return;
 const previousMemos=JSON.stringify(companyMemos);
 companyMemos=Array.isArray(m.companyMemos)?m.companyMemos.filter(n=>n.kind==='company-memo-v1'&&typeof n.text==='string'&&/^[0-9A-Z]{4,5}$/.test(n.code)&&Number.isFinite(n.ts)):[];if(memoDialog?.open)renderCompanyMemos();
 invReady=true;invLocked=false;if(syncPending){syncPending=false;clearTimeout(syncTimer);queueMicrotask(syncWorkspace);}if(!appearanceMode&&['light','dark'].includes(m.theme))appearanceMode=m.theme;paintAppearance();
 const nextStocks=Array.isArray(m.stocks)?m.stocks.filter(s=>/^[0-9A-Z]{4,5}$/.test(s.code)&&typeof s.name==='string'&&typeof s.status==='string'):[];
 const nextPositions=Array.isArray(m.positions)?m.positions.filter(p=>/^[0-9A-Z]{4,5}$/.test(p.code)&&Number.isFinite(p.shares)&&p.shares>0):[];
 const nextMeta={date:typeof m.holdingsAsOf==='string'?m.holdingsAsOf:'',complete:m.holdingsComplete===true};
 const changed=(location.hash==='#today/holdings-plan'&&previousMemos!==JSON.stringify(companyMemos))||m.researchHash!==researchHash||JSON.stringify(nextStocks)!==JSON.stringify(personalStocks)||JSON.stringify(nextPositions)!==JSON.stringify(personalPositions)||JSON.stringify(nextMeta)!==JSON.stringify(positionMeta);
 personalPositions=nextPositions;positionMeta=nextMeta;
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
 if(!['today/updates'].includes(hash)||document.getElementById('update-health'))return;
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
 if(h==='today/inv:vCal'){location.replace('#today/market');return;}
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
 window.InvnoteMarketCalendar?.setHoldings(personalPositions,notes,invReady&&!invLocked);
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
 const bothCredit=speeds.every(x=>x.hit);
 const level=primary===2?(bankHit?(bothCredit?4:3):2):primary;
 const label=level===4?'信用警戒拡大':level===3?'警戒強化':level===2?'一次警戒':level===1?'速度基準未満':'速度未判定';
 const detail=level===4?'HY・BBBの両方が急拡大し、銀行株の弱さも重なっています。投資適格社債を含む信用不安の広がりを警戒します。':primary===2?(bankHit?'信用の急拡大に銀行株下落も重なっています。':bankKnown?'信用が急拡大。銀行株下落を待たず一次警戒します。':'信用が急拡大。銀行側は一部未判定ですが、一次警戒は維持します。'):primary===1?(bankHit?'銀行株に弱さはありますが、信用の上昇速度は一次警戒基準未満です。':'信用の上昇速度は一次警戒基準未満です。'):bankHit?'銀行株に弱さがあります。信用の速度データ不足で段階は未判定です。':'信用の速度データが不足しています。';
 return {speeds,primary,bankHit,bankKnown,level,label,detail};
}
function pulseVixMacdHTML(items,speed,banks,now=Date.now(),late=false){
 const item=items.find(x=>x.id==='VIXCLS'),m=item?.macd_daily;
 const known=!late&&pulseUsable(item,now)&&m?.status==='ok'&&m.date===item.date&&m.value===item.value&&m.timeframe==='daily'&&JSON.stringify(m.parameters)==='[12,26,9]'&&m.count>=100&&[m.macd,m.signal,m.histogram].every(Number.isFinite)&&typeof m.above==='boolean'&&m.above===(m.macd>m.signal)&&Math.abs(m.histogram-(m.macd-m.signal))<1e-8;
 const signed=v=>(v>0?'+':'')+v.toFixed(3);
 const compare=(label,valid,hit,date)=>{
  const text=!known||!valid?'未判定':m.above&&hit?'警戒方向で一致':m.above?'MACDのみ警戒方向':hit?'警戒継続・MACDは不一致':'双方とも該当なし';
  return `<div class="pulse-bank"><span>${esc(label)}</span><b>${text}</b><p>基準日 ${esc(date||'未取得')}</p></div>`;
 };
 const rows=speed.speeds.map(x=>compare(`${x.label}の上昇速度`,x.known,x.hit,x.date)).join('')+compare('銀行セクター・KBE',banks.broadLevel>0,banks.broadLevel>=2,banks.banks?.to)+compare('地銀・KRE',banks.regionalLevel>0,banks.regionalLevel>=2,banks.regional?.to);
 return `<section class="pulse-credit pulse-vix-macd" aria-label="VIXの日足MACD補助情報"><h3>VIX 日足MACD <small>12・26・9 ／ 補助情報</small></h3><p><b>${known?(m.above?'シグナル線より上：警戒方向':'シグナル線以下：警戒方向の確認なし'):'未判定：データ不足・保存値・更新待ち'}</b></p>${known?`<p>MACD ${signed(m.macd)} ／ シグナル ${signed(m.signal)}<br>ヒストグラム ${signed(m.histogram)} pt<br>VIX基準日 ${esc(m.date)}</p>`:''}<div class="pulse-speed-values">${rows}</div><small>各指標の最新判定を比較しています。基準日・比較期間は異なります。一致は危機の確定ではなく、不一致も既存警戒の解除や買い信号ではありません。MACDは警戒度の加点・減点には使いません。VIXの20・30の信号は補助表示です。過去検証ではMACDの必須追加で有効警告を失う例がありました。</small></section>`;
}
function pulseSpeedHTML(s){
 const colors=['gray','green','yellow','red','red'];
 const rows=s.speeds.map(x=>`<div class="pulse-bank"><span>${x.label}の1か月変化</span><strong class="pulse-signal is-${x.known?(x.hit?'yellow':'green'):'gray'}">${x.known?(x.hit?'急拡大':'基準未満'):'未判定'}</strong><p>${x.known?`${x.change>0?'+':''}${x.change.toFixed(2)}%pt`:'—'} ／ 一次警戒 +${x.threshold.toFixed(2)}%pt以上<br>${esc(x.date)}までの比較${x.known?'':' · 現在の判定に使えません'}</p></div>`).join('');
 return `<section class="pulse-credit pulse-speed" aria-label="信用の上昇速度と警戒段階"><h3>信用の上昇速度 <strong class="pulse-signal is-${colors[s.level]}">${s.label}</strong></h3><p>${esc(s.detail)}</p><div class="pulse-speed-values">${rows}</div><p>① HYかBBBが急拡大 → 一次警戒<br>② さらにKBEかKREが下落基準に到達 → 警戒強化<br>③ HY・BBBの両方が急拡大＋銀行株の弱さ → 信用警戒拡大（4/4）</p>${s.speeds.some(x=>!x.known)||!s.bankKnown?'<p>一部データは未判定です。確認できた悪化は表示し、欠測を安全とは扱いません。</p>':''}<small>冒頭の4段階警戒度と同じ判定です。水準の信号とは別です。HY・BBBの両方が急拡大しても銀行株の下落基準未到達なら2/4です。4/4と3/4の暴落頻度の差は未検証です。銀行の下落基準と日付は下欄に表示。速度は各系列の1か月変化を使います。過去検証では誤報や見逃しが残り、銀行条件で警告が遅れる例もありました。暴落予測・売買指示ではありません。</small></section>`;
}
function pulseAlertSnapshot(speed,banks){
 return {level:speed.level,label:speed.label,primary:speed.primary,bankKnown:speed.bankKnown,speeds:speed.speeds.map(x=>({...x})),banks:[
  {label:'銀行セクター KBE',level:banks.broadLevel,value:banks.bankReturn,relative:banks.relative,from:banks.banks?.from||null,to:banks.banks?.to||null},
  {label:'地銀 KRE',level:banks.regionalLevel,value:banks.regionalReturn,relative:banks.regionalRelative,from:banks.regional?.from||null,to:banks.regional?.to||null}
 ]};
}
function pulseAlertHTML(current,feed,now=Date.now()){
 if(current.level===0)return '';
 const fresh=feed&&Number.isFinite(Date.parse(feed.generated_at))&&now-Date.parse(feed.generated_at)>=0&&now-Date.parse(feed.generated_at)<=36*3600000;
 const event=fresh&&feed.current?.level===current.level&&Array.isArray(feed.events)?feed.events.at(-1):null;
 const matched=event?.snapshot?.level===current.level&&Number.isFinite(Date.parse(event.confirmedAt))&&Array.isArray(event.snapshot.speeds)&&Array.isArray(event.snapshot.banks);
 const improving=matched&&['ease','clear'].includes(event.kind),eventAge=matched?now-Date.parse(event.confirmedAt):Infinity;
 const recentImprovement=improving&&eventAge>=0&&eventAge<=7*86400000;
 if(current.level===1&&!recentImprovement)return '';
 const snapshot=matched?event.snapshot:current;
 const label=current.level===4?'信用警戒拡大':current.level===3?'警戒強化':'一次警戒';
 const title=matched?(event.kind==='initial'?`${label}を初回確認`:event.kind==='ease'?`${label}へ低下`:`${label}へ変化`):`現在：${label}（変化履歴未確認）`;
 const stamp=matched?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(event.confirmedAt)):null;
 const signed=x=>Number.isFinite(x)?`${x>0?'+':''}${x.toFixed(2)}`:'—';
 if(recentImprovement){
  const before=event.before,baseDate=event.beforeConfirmedAt?String(event.beforeConfirmedAt).slice(0,10):'未記録';
  const previousLabel=before?.label||['未判定','速度基準未満','一次警戒','警戒強化','信用警戒拡大'][event.fromLevel]||'前の警戒段階';
  const creditRows=snapshot.speeds.map(x=>{
   const prior=before?.speeds?.find(y=>(x.id&&y.id===x.id)||y.label===x.label),valid=x.known&&prior?.known&&Number.isFinite(x.change)&&Number.isFinite(prior.change);
   const delta=valid?Math.round((x.change-prior.change)*1e6)/1e6:null;
   const direction=delta===null?'改善幅は未確認':delta<0?`拡大速度が${Math.abs(delta).toFixed(2)}%pt低下`:delta>0?`拡大速度は${delta.toFixed(2)}%pt上昇`:'拡大速度は横ばい';
   return `<li><b>${esc(x.label)}：1か月変化 ${prior?.known?signed(prior.change):'—'} → ${x.known?signed(x.change):'—'}%pt</b><br>${direction}。${x.known?(x.hit?'急拡大基準には引き続き到達':'急拡大基準未満'):'現在は未判定'}<br><small>観測日 ${esc(prior?.date||'未記録')} → ${esc(x.date)}。差はスプレッド水準そのものの下落幅ではありません。</small></li>`;
  }).join('');
  const bankRows=snapshot.banks.map(x=>{
   const prior=before?.banks?.find(y=>y.label===x.label),valid=x.level>0&&prior?.level>0&&Number.isFinite(x.value)&&Number.isFinite(prior.value);
   const delta=valid?Math.round((x.value-prior.value)*1e6)/1e6:null;
   const direction=delta===null?'改善幅は未確認':delta>0?`月次騰落率が${delta.toFixed(2)}%pt改善`:delta<0?`月次騰落率は${Math.abs(delta).toFixed(2)}%pt悪化`:'月次騰落率は横ばい';
   return `<li><b>${esc(x.label)}：1か月 ${prior?.level?signed(prior.value):'—'} → ${x.level?signed(x.value):'—'}%</b><br>${direction}。S&P500比 ${prior?.level?signed(prior.relative):'—'} → ${x.level?signed(x.relative):'—'}%pt。${x.level===1?'下落基準未満':x.level>=2?'下落基準には引き続き到達':'現在は未判定'}<br><small>前回期間 ${esc(prior?.from||'未記録')} → ${esc(prior?.to||'未記録')} ／ 今回 ${esc(x.from||'未確認')} → ${esc(x.to||'未確認')}</small></li>`;
  }).join('');
  return `<section class="news-credit-alert is-improving" aria-label="市場の警戒改善"><span class="news-category">市場の重要変化</span><h2>${current.level===1?'信用の速度警戒を解除':esc(previousLabel+'から'+label+'へ低下')}</h2><p>${esc(stamp)} 日本時間に確認${event.afterGap?'（欠測後の再確認）':''}。${esc(event.beforeBasis||'前回確認')}（${esc(baseDate)}）との比較：</p><ul>${creditRows}${bankRows}</ul><p>${current.level===1?'HY・BBBの急拡大がともに基準未満となり、この速度警戒を解除しました。銀行株の弱さが残る場合は別途注意します。':current.level===3?'HY・BBBの同時急拡大が解消しました。一方の信用の急拡大と銀行株の弱さによる警戒強化は続いています。':'銀行株の下落基準が解消し、一次警戒へ下げました。信用の急拡大による一次警戒は続いています。'}</p><small>改善通知は確認から7日間表示。同じ状態の再取得で日時を更新しません。水準の警戒や他の市場リスクがなくなった意味ではなく、買い信号でもありません。比較期間が移るため月次騰落率の改善は、その間の株価上昇率とは異なります。最新値は下のMarket Pulseへ。</small></section>`;
 }
 const credit=snapshot.speeds.filter(x=>x.hit).map(x=>`<li><b>${esc(x.label)}：1か月 ${signed(x.change)}%pt</b>（一次警戒 +${Number(x.threshold).toFixed(2)}%pt以上）<br><small>${esc(x.date)}時点</small></li>`).join('');
 const bank=current.level>=3?snapshot.banks.filter(x=>x.level>=2).map(x=>`<li><b>${esc(x.label)}：1か月 ${signed(x.value)}%</b> ／ S&P500比 ${signed(x.relative)}%pt<br><small>${esc(x.from)} → ${esc(x.to)}。下落−5%以下、または下落かつ市場比−3%pt以下で確認。</small></li>`).join(''):'';
 return `<section class="news-credit-alert is-${current.level>=3?'red':'yellow'}" aria-label="市場の警戒変化"><span class="news-category">市場の重要変化</span><h2>${esc(improving?label+'が継続':title)}</h2><p>${stamp?`${esc(stamp)} 日本時間に確認${event.afterGap?'（欠測後の再確認）':''}。変化時の根拠：`:'現在の取得値に基づく警告です。初回点灯日時は未確認です。'}</p><ul>${credit}${bank}</ul><p>${current.level===4?'HY・BBBの両方の急拡大に銀行株の弱さが重なっています。投資適格社債まで含む信用不安の広がりを警戒します。':current.level===3?'信用の急拡大に銀行株の弱さが重なっています。':'信用が急拡大しています。銀行株下落を待たず一次警戒します。'}</p><small>現在も${label}。確認日時は当アプリの更新時刻で、市場での発生時刻とは異なります。同じ段階の再取得は新しい変化として記録しません。最新値と未判定項目は下のMarket Pulseへ。</small></section>`;
}
function pulseScoreContext(items,banks,now=Date.now(),late=false){
 const parts=[['BAMLH0A0HYM2','HY',3,.5],['BAMLC0A4CBBB','BBB',1.5,.2]].map(([id,label,threshold,speedThreshold])=>{
  const x=items.find(x=>x.id===id),valueKnown=!late&&pulseUsable(x,now),change=x?.changes?.['1m']?.value,speedKnown=valueKnown&&Number.isFinite(change);
  const levelPoint=valueKnown?(x.value>=threshold?.5:0):null,speedPoint=speedKnown?(change>=speedThreshold?.5:0):null;
  return {id,label,threshold,speedThreshold,value:valueKnown?x.value:null,change:speedKnown?change:null,date:x?.date||'未取得',levelPoint,speedPoint,known:valueKnown&&speedKnown,points:(levelPoint??0)+(speedPoint??0)};
 });
 const bankKnown=banks.broadLevel>0&&banks.regionalLevel>0,bankPoints=Math.max(0,(Math.max(banks.broadLevel,banks.regionalLevel)-1)/2);
 parts.push({id:'BANK',label:'銀行',known:bankKnown,points:bankPoints});
 const complete=parts.every(x=>x.known),confirmed=parts.reduce((s,x)=>s+x.points,0),score=complete?confirmed:null;
 return {model:'credit-bank-v3',score,confirmed,complete,parts,warning:confirmed>=1.5,label:complete?(score>=1.5?'早期警戒':'警戒基準未満'):confirmed>=1.5?'早期警戒・一部未判定':'判定保留',banks:[
  {label:'KBE',level:banks.broadLevel,value:banks.bankReturn,relative:banks.relative,from:banks.banks?.from||null,to:banks.banks?.to||null},
  {label:'KRE',level:banks.regionalLevel,value:banks.regionalReturn,relative:banks.regionalRelative,from:banks.regional?.from||null,to:banks.regional?.to||null}
 ]};
}
function pulseScoreRows(s,before=null){
 const signed=v=>Number.isFinite(v)?`${v>0?'+':''}${v.toFixed(2)}`:'未判定';
 const credit=s.parts.filter(x=>x.id!=='BANK').map(x=>{
  const p=before?.parts?.find(y=>y.id===x.id);
  return `<li><b>${x.label} ${x.known?x.points+' / 1点':'更新待ち（採点保留）'}</b>：水準 ${signed(x.value)}%（${x.threshold}%以上で0.5点）、1か月差 ${signed(x.change)}%pt（+${x.speedThreshold.toFixed(2)}以上で0.5点）<small>基準日 ${esc(x.date)}${p?` ／ 前回 水準 ${signed(p.value)}%・月差 ${signed(p.change)}%pt → 今回。水準差 ${signed(Number.isFinite(p.value)&&Number.isFinite(x.value)?x.value-p.value:null)}%pt、拡大速度差 ${signed(Number.isFinite(p.change)&&Number.isFinite(x.change)?x.change-p.change:null)}%pt` :''}</small></li>`;
 }).join('');
 const bank=s.banks.map(x=>{
  const p=before?.banks?.find(y=>y.label===x.label);
  return `<li><b>${x.label}</b>：1か月 ${signed(x.value)}% ／ S&P500比 ${signed(x.relative)}%pt<small>${esc(x.from||'未取得')} → ${esc(x.to||'未取得')}${p?` ／ 前回 ${signed(p.value)}% → 今回。月次騰落率差 ${signed(Number.isFinite(p.value)&&Number.isFinite(x.value)?x.value-p.value:null)}%pt`:''}</small></li>`;
 }).join('');
 return `<ul>${credit}${bank}</ul><p>銀行 ${s.parts[2].known?s.parts[2].points+' / 1点':'更新待ち（採点保留）'}：KBE・KREの悪い方のみ。月間−5%以下、または下落かつ市場比−3%pt以下で0.5点。−10%以下、または下落かつ市場比−7%pt以下で1点。</p>`;
}
function pulseScoreHeadlineHTML(s,metrics,signals,feed=null){
 const extras=metrics.map((x,i)=>({name:x.label,s:signals[i]})).filter(x=>x.s.level>=2||!x.s.level).map(x=>`${x.name}：${x.s.label}`);
 const previous=feed?.model===s.model&&feed.lastConfirmed?.complete&&Number.isFinite(feed.lastConfirmed.score)?feed.lastConfirmed:null;
 const basis=previous?[...new Set([...(previous.parts||[]).map(x=>x.date),...(previous.banks||[]).map(x=>x.to)].filter(x=>x&&x!=='未取得'))].sort():[];
 const waiting=!s.complete?`<p><b>データ更新待ち：${esc(s.parts.filter(x=>!x.known).map(x=>x.label).join('・'))}</b>。取得できない指標は0点にせず採点を保留しています。警戒解除・改善の判定ではありません。${s.warning?'確認できた指標だけでも早期警戒基準に達しています。':''}</p>${previous?`<p>前回確定：<b>${previous.score} / 3 · ${esc(previous.label)}</b><small>観測日 ${esc(basis.join('・'))}。過去の判定であり、現在のスコアではありません。</small></p>`:''}`:'';
 const bank=s.parts.find(x=>x.id==='BANK'),falling=(s.banks||[]).filter(x=>Number.isFinite(x.value)&&x.value<0);
 const bankNote=bank?.known&&bank.points===0&&falling.length?`<p>銀行株は下落中（${esc(falling.map(x=>x.label+' '+x.value.toFixed(2)+'%').join('、'))}／1か月）。現在の加点基準には未到達です。0点は横ばい・上昇を意味しません。</p>`:'';
 return `<div class="pulse-summary"><b>警戒スコア ${s.complete?s.score+' / 3 · '+esc(s.label):'更新待ち · 判定保留'}</b>${waiting}<p class="pulse-score-parts">${s.parts.map(x=>`<span>${x.label} ${x.known?x.points+'/1':'更新待ち'}</span>`).join('')}</p>${bankNote}<small>1.5点以上で早期警戒。点数は条件の重なりで、暴落確率ではありません。欠測や0点も安全を意味しません。</small>${extras.length?`<p class="pulse-other">補助情報：${esc(extras.join(' ／ '))}</p>`:''}</div>`;
}
function pulseScoreHTML(s){
 return `<section class="pulse-credit"><h3>3点の内訳：水準＋上昇速度＋銀行</h3>${pulseScoreRows(s)}<small>信用の水準と速度を各0.5点、銀行を最大1点。VIX・日本株信用需給は二段階目の絞り込みに使い、3点には加減点しません。日足MACDは補助情報です。1.5点は早めに気づくための基準で、点数が上がるほど的中率が必ず上がるとは確認できていません。</small></section>`;
}
function pulseScoreAlertHTML(s,feed,now=Date.now()){
 const fresh=feed?.model===s.model&&Number.isFinite(Date.parse(feed.generated_at))&&now-Date.parse(feed.generated_at)>=0&&now-Date.parse(feed.generated_at)<=36*3600000;
 const e=fresh&&s.complete&&feed.current?.score===s.score?feed.events?.at(-1):null;
 const matched=e?.snapshot?.model===s.model&&e.snapshot.score===s.score;
 const recent=matched&&now-Date.parse(e.confirmedAt)>=0&&now-Date.parse(e.confirmedAt)<=7*86400000;
 // The headline already shows current risk. Reserve this card for real, recent changes.
 if(!recent||e.kind==='method-change')return '';
 const title=recent?(e.kind==='method-change'?'警戒スコアを新方式へ変更':e.kind==='clear'?'早期警戒の基準を下回りました':e.kind==='ease'?'警戒スコアが低下':e.kind==='rise'?'警戒スコアが上昇':'早期警戒を初回確認'):`現在：${s.label}`;
 const stamp=recent?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(e.confirmedAt)):'';
 return `<section class="news-credit-alert is-${recent&&['ease','clear'].includes(e.kind)?'improving':s.confirmed>=2?'red':'yellow'}"><span class="news-category">市場の重要変化</span><h2>${esc(title)} · ${s.complete?s.score:'確認分 '+s.confirmed}/3</h2><p>${recent?esc(stamp)+' 日本時間に確認。':'変化日時は未確認。'}${recent&&e.kind==='method-change'?'旧4段階との点数差は市場の改善・悪化ではありません。':recent&&e.before?`前回 ${e.before.score}/3 → 今回 ${s.score}/3。`:''}</p><details><summary>指標の値と変化を見る</summary>${pulseScoreRows(recent?e.snapshot:s,recent?e.before:null)}<small>HY・BBBの水準差はマイナスが縮小、拡大速度差はマイナスが鈍化。銀行の月次騰落率差はプラスが改善ですが、その間の株価上昇率とは異なります。基準変更と市場変化を区別し、欠測では解除しません。確認日時は観測日・市場発生時刻とは異なります。</small></details></section>`;
}
function pulseResearchHTML(){
 return `<section class="pulse-credit"><h3>検証からの使い方</h3><p>早期発見を優先して1.5/3点を採用。2016〜2025年の価格10%下落局面は日経3/4・ダウ4/5を事前検知しましたが、新規警告後63営業日以内に10%追加下落しなかった例も日経65/80・ダウ72/80あります。局面の検知と警告後の追加下落は別の集計です。</p><p>VIX20以上や日足MACDを必須にすると有効な警告も失いました。信用倍率・買い残との組合せを二段階目に表示します。特異度は上がりましたが感度は低下し、期間でも不安定でした。高得点まで待つ運用や、点数から将来確率を出す運用は採用しません。</p><h3>下落後の回復を見る視点</h3><p>下落後にHY・BBBが縮小し、銀行全体・地銀が上昇し、VIXが低下するかを確認します。10%下落後20営業日の同時改善群は半年後の回復が多かった一方、20%下落では再現しませんでした。回復予測への加点はしません。</p><p>この研究の回復は、下落到達から126営業日後に警告前価格へ戻ること。高値回復とは異なります。表示している月次指標は現在の観察用で、暴落起点の20営業日判定ではありません。</p><small>同じ暴落の反復警告、少数事例、探索済みの歴史を含むため、普遍的な最適方法・校正済み確率・半年で戻る保証ではありません。2026/10/20比較に基づく監視方法です。</small></section>`;
}

function pulseConfirmationContext(score,items,margin,now=Date.now(),late=false){
 const x=items.find(x=>x.id==='VIXCLS'),vk=!late&&pulseUsable(x,now);
 const age=now-Date.parse(margin?.generated_at),observationAge=now-Date.parse(margin?.date);
 const mk=margin?.status==='fresh'&&age>=0&&age<=36*3600000&&observationAge>=0&&observationAge<=15*86400000&&Date.parse(margin?.published)<=now;
 const rk=mk&&Number.isFinite(margin.ratio),bk=mk&&margin.baselineCount===156&&Number.isFinite(margin.normalized)&&Number.isFinite(margin.normMedian156)&&margin.normMedian156>0;
 const base=score.complete?score.warning:score.warning?true:null,vix=vk?x.value>=20:null,ratio=rk?margin.ratio>=3:null,buy=bk?margin.normalized>=margin.normMedian156:null;
 // Unknown inputs remain unknown, rather than looking like an improvement.
 const joint=(...xs)=>xs.some(v=>v===null)?null:xs.every(v=>v);
 return {model:'vix-margin-confirm-v1',base,vix,ratio,buy,ratioJoint:joint(base,vix,ratio),buyJoint:joint(base,vix,buy),
  vixValue:vk?x.value:null,vixDate:x?.date||null,ratioValue:rk?margin.ratio:null,buyNormalized:bk?margin.normalized:null,buyMedian:bk?margin.normMedian156:null,
  marginDate:margin?.date||null,published:margin?.published||null,turnoverDate:margin?.turnoverDate||null,buyMillion:mk?margin.buyMillion:null};
}
function pulseConfirmationHTML(c,feed,now=Date.now()){
 const text=v=>v===null?'未判定':v?'成立':'未成立';
 const fresh=feed&&now-Date.parse(feed.generated_at)>=0&&now-Date.parse(feed.generated_at)<=36*3600000;
 const e=fresh?feed.confirmationEvents?.at(-1):null;
 const recent=e&&e.snapshot?.model===c.model&&['base','vix','ratio','buy'].every(k=>e.snapshot[k]===c[k])&&now-Date.parse(e.confirmedAt)>=0&&now-Date.parse(e.confirmedAt)<=7*86400000;
 const label=c.buyJoint===true?'VIX＋買い残の追加確認あり':c.ratioJoint===true?'VIX＋信用倍率の追加確認あり':c.buyJoint===null||c.ratioJoint===null?'追加確認は一部未判定':'追加確認は未成立';
 const n=(x,d=2)=>Number.isFinite(x)?x.toFixed(d):'未判定';
 const changed=recent&&e.before?['base','vix','ratio','buy'].filter(k=>e.before[k]!==c[k]).map(k=>`${{base:'基本警戒',vix:'VIX20以上',ratio:'信用倍率3倍以上',buy:'規模調整買い残多'}[k]} ${text(e.before[k])} → ${text(c[k])}`).join(' ／ '):'';
 return `<section class="pulse-credit pulse-confirmation" aria-label="VIXと日本株信用の二段階確認"><h3>二段階確認 · ${label}</h3><p>基本警戒 ${text(c.base)} → VIX＋信用倍率 ${text(c.ratioJoint)} ／ VIX＋買い残 ${text(c.buyJoint)}</p>${recent?`<p><b>${e.kind==='initial'?'追加確認の監視を開始':'追加確認条件が変化'}</b> · ${esc(new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(e.confirmedAt)))} 日本時間<br>${esc(changed)}</p>`:''}<details><summary>追加条件の値・検証結果を見る</summary>${recent&&e.before?`<p>前回確認 → 今回：VIX ${n(e.before.vixValue)} → ${n(c.vixValue)}、信用倍率 ${n(e.before.ratioValue)} → ${n(c.ratioValue)}倍、規模調整買い残 ${n(e.before.buyNormalized,3)} → ${n(c.buyNormalized,3)}。観測日・比較基準の更新を含みます。</p>`:''}<p>VIX ${n(c.vixValue)}（${esc(c.vixDate||'未取得')}）／20以上：${text(c.vix)}<br>日本株信用倍率 ${n(c.ratioValue)}倍／3倍以上：${text(c.ratio)}<br>規模調整買い残 ${n(c.buyNormalized,3)}／過去156週中央値 ${n(c.buyMedian,3)}以上：${text(c.buy)}</p><p>信用残高 ${esc(c.marginDate||'未取得')}申込分、${esc(c.published||'未確認')}公表。買い残 ${Number.isFinite(c.buyMillion)?(c.buyMillion/1e6).toFixed(2)+'兆円':'未判定'}。売買代金 ${esc(c.turnoverDate||'未取得')}月末分。</p><p>基本1.5点以上に「VIX20以上＋信用倍率3倍以上」、または別条件の「VIX20以上＋規模調整買い残多」を重ね、警告を絞り込む確認です。3点には加点せず、未成立でも基本の早期警戒は解除しません。</p><p>2016〜2025年の日経・63営業日10%追加下落の同一既知日比較：特異度は基本72.4% → VIX＋倍率87.2%／VIX＋買い残95.2%。一方、感度は26.2% → 15.6%／5.5%。特異度は暴落しなかった日を警告なしとできた割合で、的中率ではありません。絞り込みには見逃しとの交換条件があり、将来保証ではありません。</p><small>倍率は株数の買残÷売残。規模調整は買残金額÷直近公表済み東証月間平均売買代金。過去156週中央値と比較し、現在値は中央値に含めません。残高と売買代金の市場範囲は完全一致せず、換金日数ではありません。週次データ・日次VIXの基準日は異なります。未取得・保存値・期限切れは未判定。<a href="https://www.jpx.co.jp/markets/statistics-equities/margin/04.html" target="_blank" rel="noopener">JPX信用残高</a></small></details></section>`;
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
 const bankQuarter={KBE:engine.aligned(combined,['KBE','SP500'],90,now),KRE:engine.aligned(combined,['KRE','SP500'],90,now)};
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
 return {bankQuarter,kind,credit,banks,rates,bankReturn,marketReturn,relative,bankLevel,broadLevel,regional,regionalReturn,regionalRelative,regionalLevel,transmission,transmissionText,spreadText};
}
function pulseBankTrend(month,quarter){
 if(!Number.isFinite(month)||!Number.isFinite(quarter))return '期間比較は未判定（データ不足）';
 if(month<0&&quarter<0)return '1か月・3か月とも下落';
 if(month>0&&quarter<0)return '3か月では下落、直近1か月は持ち直し';
 if(month<0&&quarter>0)return '3か月では上昇、直近1か月は悪化';
 if(month>0&&quarter>0)return '1か月・3か月とも上昇';
 return '一方または両期間で横ばい';
}
function pulseCreditHTML(context,extra,now=Date.now()){
 const c=context,signed=(x,d=2)=>Number.isFinite(x)?(x>0?'+':'')+x.toFixed(d):'—';
 const names=['判定保留','基準内','注意','警戒'],colors=['gray','green','yellow','red'];
 const bankRow=(label,pair,value,relative,level,id)=>{
  const q=c.bankQuarter?.[id],v=q?.values?.[id],sp=q?.values?.SP500;
  const qr=v?.before>0?100*v.change/v.before:null,sr=sp?.before>0?100*sp.change/sp.before:null;
  const sameEnd=!!pair&&!!q&&pair.to===q.to;
  return `<div class="pulse-bank"><span>${label}</span><strong class="pulse-signal is-${colors[level]}">1か月判定：${names[level]}</strong><p>${pair?`1か月 ${signed(value)}% ／ S&P500比 ${signed(relative)}%pt（${esc(pair.from)} → ${esc(pair.to)}）`:'1か月：共通日のETF・S&P500データ不足'}</p><p>${q?`3か月 ${signed(qr)}% ／ S&P500比 ${signed(Number.isFinite(qr)&&Number.isFinite(sr)?qr-sr:null)}%pt（${esc(q.from)} → ${esc(q.to)}）`:'3か月：共通日のETF・S&P500データ不足'}</p><p><b>${esc(sameEnd?pulseBankTrend(value,qr):pair&&q?'期間比較は未判定（観測日が異なります）':'期間比較は未判定（データ不足）')}</b></p></div>`;
 };

 const t=c.transmission,tv=t?.values,pct=x=>100*x.change/x.before;
 const transmissionDetail=t?`共通期間 ${esc(t.from)} → ${esc(t.to)}：KBE ${signed(pct(tv.KBE))}%、KRE ${signed(pct(tv.KRE))}%、地銀−銀行セクター ${signed(pct(tv.KRE)-pct(tv.KBE))}%pt、BBB ${signed(tv.BAMLC0A4CBBB.change)}%pt。`:'';
 const items=extra?.items||[],row=(id,label,quarterly=false)=>{
  const x=items.find(x=>x.id===id),valid=pulseUsable(x,now),value=Number.isFinite(x?.value)?x.value.toFixed(2)+'%':'未取得',change=x?.changes?.[quarterly?'3m':'1m']?.value;
  return `<div><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(x?.date||'未取得')}${quarterly?'対象期':''}${valid?'':' · 現在の判定には使いません'}${Number.isFinite(change)?` ／ ${quarterly?'前期差':'1か月'} ${signed(change)}%pt`:''}</small></div>`;
 };
 return `<section class="pulse-credit" aria-label="銀行と信用リスク"><h3>${esc(c.kind)}</h3><p>${esc(c.spreadText)}${c.credit?`。共通期間 ${esc(c.credit.from)} → ${esc(c.credit.to)}：HY ${signed(c.credit.values.BAMLH0A0HYM2.change)}%pt、BBB ${signed(c.credit.values.BAMLC0A4CBBB.change)}%pt。`:''}</p>${bankRow('米銀行セクター・KBE',c.banks,c.bankReturn,c.relative,c.broadLevel,'KBE')}${bankRow('米地銀・KRE',c.regional,c.regionalReturn,c.regionalRelative,c.regionalLevel,'KRE')}<p><b>${esc(c.transmissionText)}</b><br>${transmissionDetail}</p><small>1か月は約30日前、3か月は約90日前の共通営業日との比較です。採点と信号色は従来の1か月条件を使用し、3か月と状態説明は補助表示です。持ち直しは下落リスクの解消や今後の上昇を意味しません。KBEは銀行セクターの代理で全銀行を網羅せず、地銀も多く含みます。KREと構成銘柄が重複します。日次終値・配当なしで比較。株価下落とBBB拡大の同時発生は、波及の因果を証明しません。</small><details class="pulse-reference"><summary>借換え環境・貸出基準を見る</summary><div class="pulse-refinance">${row('BAMLH0A0HYM2EY','HY社債利回り')}${row('BAMLC0A4CBBBEY','BBB社債利回り')}${row('DRTSCIS','小企業向け貸出基準・厳格化超',true)}${row('DRTSCILM','大中企業向け貸出基準・厳格化超',true)}</div><p>借換えは金利とスプレッドの両方が重要。社債利回りは既発債市場の参考値で、個社の借換え金利ではありません。旧借入金利・今後の満期額・発行量/発行中止・利払い余力は別途確認します。</p><p>貸出基準は「厳格化した銀行−緩和した銀行」の純割合。プラスは厳格化超、マイナスは緩和超。四半期調査で速報性は低く、日付は対象期です。貸出減少には需要減もあるため、供給制約と区別します。</p><p>地銀は預金流出・商業用不動産・債券評価損も確認。米地銀専用の<a href="https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-regional-banking-etf-kre" target="_blank" rel="noopener">KRE</a>を自動取得し、銀行セクターの<a href="https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-bank-etf-kbe" target="_blank" rel="noopener">KBE</a>と別表示。日本の地銀とは区別します。</p><p>銀行株安＋HY/BBB拡大＋貸出厳格化が重なるほど信用収縮を警戒しますが、ここで因果やクレジットクランチを確定しません。</p><p><a href="https://finance.yahoo.com/quote/KBE/history/" target="_blank" rel="noopener">KBE価格</a> · <a href="https://finance.yahoo.com/quote/KRE/history/" target="_blank" rel="noopener">KRE価格</a> · <a href="https://fred.stlouisfed.org/series/DRTSCIS" target="_blank" rel="noopener">貸出基準</a> · <a href="https://fred.stlouisfed.org/series/BAMLH0A0HYM2EY" target="_blank" rel="noopener">HY利回り</a> · <a href="https://fred.stlouisfed.org/series/BAMLC0A4CBBBEY" target="_blank" rel="noopener">BBB利回り</a></p></details></section>`;
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
function pulseHeadlineHTML(speed,metrics,signals,banks){
 const signed=v=>(v>0?'+':'')+v.toFixed(2);
 const credit=speed.speeds.map(x=>`${x.label} ${x.known?signed(x.change)+'%pt':'未判定'}`).join(' ／ ');
 const dates=[...new Set(speed.speeds.filter(x=>x.known).map(x=>x.date))].join('・');
 const bankNames=['未判定','基準内','注意','警戒'];
 const other=metrics.map((x,i)=>({name:x.label,signal:signals[i]})).filter(x=>x.signal.level>=2||!x.signal.level).map(x=>`${x.name}：${x.signal.label}`);
 return `<div class="pulse-summary"><b>${speed.level?'警戒度 '+speed.level+' / 4 · ':''}${esc(speed.label)}</b><p>${esc(credit)}（1か月差）${dates?`<small>基準日 ${esc(dates)}</small>`:''}<br>銀行 ${bankNames[banks.broadLevel]} ／ 地銀 ${bankNames[banks.regionalLevel]}</p><p>${esc(speed.detail)}</p>${other.length?`<p class="pulse-other">別の注意点：${esc(other.join(' ／ '))}</p>`:''}<small>速度・銀行による警戒度。1でも安全や買いの判定ではありません。</small></div>`;
}
function marginPressureHTML(d){
 const f=v=>typeof v==='number'&&Number.isFinite(v)?(v>=0?'+':'')+v.toFixed(1)+'%':'未取得';
 const p=d?.pressure;
 if(!p)return '<section class="japan-market"><strong>信用取引の圧力</strong><p>追加データ未取得 · 3点スコアへの加点なし</p></section>';
 const old=d.status!=='fresh'||Date.now()-Date.parse(d.date+'T00:00:00+09:00')>14*86400000;
 let context='株価との組み合わせは未判定';
 if(Number.isFinite(p.topix4wPct)&&Number.isFinite(p.buy4wPct))context=p.buy4wPct>0?(p.topix4wPct<0?'株価下落と買い残増加が重なる':'買い残増加・同期間の株価は下落せず'):(p.topix4wPct<0?'株価下落と買い残減少が重なる':'買い残は減少または横ばい');
 return `<section class="japan-market"><strong>信用取引の圧力 <small>補助・加点なし</small></strong><p>買い残4週 ${f(p.buy4wPct)} ／ TOPIX同期間 ${f(p.topix4wPct)}</p><details><summary>信用残高・評価損益率を見る</summary><p>${esc(context)}${old?'（保存値・更新確認が必要）':''}。買い残減少だけで投げ売り完了とは判断しません。</p><p>買い残 ${Number.isFinite(d.buyMillion)?(d.buyMillion/1e6).toFixed(2)+'兆円':'未取得'}、前週比 ${f(p.buy1wPct)}。残高基準 ${esc(d.date)}、公表 ${esc(d.published)}。4週比較 ${esc(p.fromDate)}〜${esc(p.toDate)}。株価は同じ両日の終値を確認できた場合のみ表示。</p><p>市場全体の信用評価損益率：公表値＝未取得／推計値＝推計未実施。信用残高と指数だけでは取得単価や入替が分からず、追証発生水準も算出できません。</p><p>${esc(d.note||'')}</p>${/^https:\/\//.test(d.source||'')?`<a href="${esc(d.source)}" target="_blank" rel="noopener">JPX公表資料</a>`:''}</details></section>`;
}
function holdingFactors(n){
 const themes=(n?.themes||[]).join(' '),business=n?.business||'',out=[];
 if(/半導体|電子基板/.test(themes+' '+business))out.push('半導体の投資・生産');
 if(/AI|データセンター/.test(themes))out.push('AI・データセンター需要');
 if(/電力|電気設備|空調|自動制御/.test(themes+' '+business))out.push('電力・建物設備の投資更新');
 if(/航空|防衛/.test(themes))out.push('航空・防衛需要');
 if(/食品|飲料|製粉/.test(themes))out.push('食品・飲料需要と製造費');
 if(/道路|橋|河川|自治体/.test(business))out.push('公共インフラ整備');
 if(/薬局/.test(themes))out.push('薬局のIT投資・利用');
 if(/クリーンエネルギー/.test(themes))out.push('クリーンエネルギー設備投資');
 return out;
}
function portfolioExposure(positions,ns){
 const groups={},unknown=[],valid=[],unpriced=[];let total=0,credit=0;
 for(const p of positions){
  const priced=Number.isFinite(p.price)&&p.price>0&&Number.isFinite(p.shares)&&p.shares>0;
  const amount=priced?p.price*p.shares:null;
  if(!priced){unpriced.push(p);continue;}
  const row={...p,amount};valid.push(row);total+=amount;if(/信用/.test(p.acct||''))credit+=amount;
  const factors=holdingFactors(ns[p.code]);if(!factors.length)unknown.push(row);
  for(const label of factors){const g=groups[label]||(groups[label]={label,amount:0,credit:0,rows:[]});g.amount+=amount;if(/信用/.test(p.acct||''))g.credit+=amount;g.rows.push(row);}
 }
 return {total,credit,valid,unpriced,unknown,groups:Object.values(groups).sort((a,b)=>b.amount-a.amount)};
}
function portfolioImpactHTML(positions,ns,rs,meta){
 if(!positions.length)return '<section class="japan-market"><strong>自分の保有への影響</strong><p>保有情報の同期・登録後に表示します。</p></section>';
 const e=portfolioExposure(positions,ns),money=v=>(v/10000).toLocaleString('ja-JP',{maximumFractionDigits:1})+'万円';
 const lead=e.groups[0];const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
 const priceDates=[...new Set(e.valid.map(p=>p.priceDate||'日付不明'))].sort();
 const allRows=positions.map(p=>{const n=ns[p.code],r=rs[p.code],date=n?.earnings_dates?.next?.date;return `<li><a href="#company/${esc(p.code)}">${esc(n?.name||p.code)}</a> · ${esc(p.acct||'口座区分不明')} · ${Number.isFinite(p.price)&&p.price>0?money(p.price*p.shares):'時価未取得'}<br>決算：${date?esc(date)+(date<today?'（予定日経過・再確認）':'（保存された予定）'):'次回予定未確認'}／確認 ${esc(n?.earnings_dates?.checked_on||'不明')}<br>見直す条件：${esc(r?.change_conditions||n?.counter||'調査条件未登録')}<br><small>研究 ${esc(n?.updated||'未登録')} · ${esc(n?.business||'事業の確認待ち')}</small></li>`;}).join('');
 return `<section class="japan-market"><strong>自分の保有への影響 <small>端末内で集計</small></strong><p>${lead?`${esc(lead.label)}に関係 ${money(lead.amount)}（評価可能時価の${(lead.amount/e.total*100).toFixed(1)}%）`:'共通要因は分類待ち'} ／ 信用保有 ${money(e.credit)}</p><details><summary>共通要因ごとの保有額・決算・見直し条件</summary><p>保有基準 ${esc(meta.date||'不明')} · ${meta.complete?'全保有として登録':'全量確認なし・登録分のみ'}。株価基準 ${esc(priceDates.join(' / '))}。現在値の再取得や証券会社残高との照合ではありません。</p><p>評価可能な株式時価 ${money(e.total)}、うち信用 ${money(e.credit)}。時価欠測 ${e.unpriced.length}口座行、分類待ち ${e.unknown.length}口座行。現金・借入・保証金を含む純資産比率ではありません。口座区分不明は信用額へ推測算入しません。</p><ul>${e.groups.map(g=>`<li><b>${esc(g.label)}：${money(g.amount)}</b> ／ 信用 ${money(g.credit)}<br>${[...new Set(g.rows.map(p=>ns[p.code]?.name||p.code))].map(esc).join('・')}</li>`).join('')}</ul><p>保存された研究のテーマ・事業説明から抽出した「共通要因への関係候補」です。関係する銘柄の全時価を表示し、当該事業への売上配分や損失予測を意味しません。複数要因に重複するため各行は合算できません。半導体でも装置は設備投資、材料は生産量・工程・採用に左右され、感応度は同じではありません。</p><ul>${allRows}</ul><p><a href="#today/inv:vPf">保有情報・株価を確認する</a></p></details></section>`;
}
function japanMarketHTML(d, now=Date.now()) {
 const num=(v,n=1)=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(n):'未判定';
 if(!d||!d.asOf||!d.evaluated)return '<section class="japan-market"><strong>日本株の広がり・売られ方</strong><p>データ未取得（3点スコアとは別）</p></section>';
 const age=now-Date.parse(d.asOf+'T15:30:00+09:00'),old=!Number.isFinite(age)||age>96*3600000;
 return `<section class="japan-market"><strong>日本株の広がり・売られ方 <small>補助情報・加点なし</small></strong><p>下落 ${num(d.downPct)}%の銘柄 ／ 売買代金 ${num(d.turnoverRatio20,2)}倍<span>（直前20営業日平均比）</span></p><small>${esc(d.asOf)} 終値 · ${esc(d.evaluated)}/${esc(d.universe)}社${old?' · 保存値が古いため最新状況は未確認':''}</small><details><summary>広がり・売買の内訳を見る</summary><p>上昇 ${esc(d.up)}社 ／ 下落 ${esc(d.down)}社 ／ 横ばい ${esc(d.unchanged)}社。騰落率中央値 ${num(d.medianReturnPct,2)}%。3%以上下落 ${esc(d.sharpDown)}社。</p><p>下落銘柄の売買代金は集計全体の ${num(d.downTurnoverPct)}%（${esc(d.turnoverEvaluated)}社）。これは売り注文の割合ではありません。</p><p>売買代金 ${num(d.turnoverYen===null?null:d.turnoverYen/1e12,2)}兆円、直前20日平均比 ${num(d.turnoverRatio20,2)}倍。比較期間 ${esc(d.baselineFrom)}〜${esc(d.baselineTo)}、全21日を揃えた ${esc(d.turnoverCohort)}社で比較。</p><p>値動きの内訳：2%以上の下窓 ${d.priceAction?esc(d.priceAction.gapDown2)+'社':'未取得'} ／ 日中値幅5%以上 ${d.priceAction?esc(d.priceAction.wideRange5)+'社':'未取得'}（OHLC判定 ${d.priceAction?esc(d.priceAction.evaluated):'未取得'}社）。始値の前日比中央値 ${num(d.priceAction?.medianGapPct,2)}%、日中値幅中央値 ${num(d.priceAction?.medianRangePct,2)}%。分割補正前日終値で比較。2%/5%は表示用の区切りです。</p><p>売買代金・窓・値幅は売られ方の観測です。板の厚さやスプレッドの直接測定ではなく、投げ売り・買い手不在の原因は確定できません。</p><p>対象は全市場の国内普通株。ETF・REITを除外し、前日比は株式分割を補正。価格欠測・権利等で ${esc(d.excluded)}社を除外。売買代金の比較には追加の履歴・正値条件があり、対象数は異なります。終値ベースで平日夜に更新、場中の情報ではありません。</p><p>下落の広がりと商いの増減を観測する欄です。低商いでも下落は続き得ます。これだけで投げ売り・底打ち・今後の下落確率は判定しません。</p><small>${esc(d.source)}</small></details></section>`;
}
async function renderNewsMacro(){
 const el=document.getElementById('news-macro')||document.getElementById('news-market-alerts');if(!el)return;
 const fmt=v=>{const d=new Date(v);return Number.isFinite(+d)?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d):'未取得';};
 try{
  const [data,engine,configModule,extra,alertFeed,marginFeed,japanFeed]=await Promise.all([fetch('screener/data/macro.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}),import('./screener/macro-engine.js?v=2.18'),import('./screener/macro-config.js?v=2.18'),fetch('screener/data/credit-monitor.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>null),fetch('screener/data/credit-alerts.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>null),fetch('screener/data/margin-monitor.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>null),fetch('screener/data/japan-market.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>null)]);
  if(!el.isConnected)return;
  let config=configModule.DEFAULTS;try{const v=localStorage.getItem('screener_macro_config_v2');if(v)config=configModule.validateConfig(JSON.parse(v));}catch{}
  const r=engine.classifyRegime(data.items,Date.now(),config),dates=data.items.filter(x=>x.frequency==='daily'&&x.date).map(x=>x.date).sort(),monthly=data.items.filter(x=>x.frequency==='monthly'&&x.date).map(x=>x.date.slice(0,7)),bad=data.items.filter(x=>x.status!=='fresh');
  const age=Date.now()-Date.parse(data.generated_at),late=!Number.isFinite(age)||age>36*3600000;
   const labels=['速度基準未満','一次警戒','警戒強化','信用警戒拡大'];
   const metrics=[pulseMetric(data.items,'DGS2','米2年金利',2,'%','1m'),pulseMetric(data.items,'DGS10','米10年金利',2,'%','1m'),pulseMetric(data.items,'T10Y2Y','10年−2年',2,'%pt'),pulseMetric(data.items,'VIXCLS','VIX',2,'pt'),pulseMetric(data.items,'BAMLH0A0HYM2','HY社債・水準',2,'%','1m'),pulseMetric(data.items,'BAMLC0A4CBBB','BBB社債・水準',2,'%','1m')],curve=pulseCurve(r);
   const signals=metrics.map(x=>pulseLevelSignal(x.item,Date.now(),late));
   const context=pulseCreditContext(late?[]:data.items,extra,engine);
   const speed=pulseSpeedContext(data.items,context,Date.now(),late);
   const score=pulseScoreContext(data.items,context,Date.now(),late);
   score.confirmation=pulseConfirmationContext(score,data.items,marginFeed,Date.now(),late);
  el.dataset.pulse=String(!score.complete?0:score.score>=2?5:score.warning?3:1);
   if(el.id==='news-market-alerts'){el.innerHTML=pulseScoreAlertHTML(score,alertFeed);return;}
   el.innerHTML=`${pulseScoreAlertHTML(score,alertFeed)}<div class="pulse-header"><strong>Market Pulse</strong><span>DAILY DIGEST · 毎朝更新</span></div>${pulseScoreHeadlineHTML(score,metrics,signals,alertFeed)}${japanMarketHTML(japanFeed)}${marginPressureHTML(marginFeed)}${portfolioImpactHTML(personalPositions,notes,ratings,positionMeta)}${pulseConfirmationHTML(score.confirmation,alertFeed)}<section class="pulse-details"><h3>指標・判定の詳細</h3><div class="pulse-metrics" aria-label="主要な市場指標">${metrics.map((x,i)=>`<div><span>${esc(x.label)}</span><strong class="pulse-signal is-${signals[i].color}" title="${esc(signals[i].reason)}">${signals[i].label}</strong><b>${esc(x.value)}${x.value==='—'?'':`<small>${esc(x.unit)}</small>`}</b><em>${esc(x.date)}${x.saved?' · 保存値':''}${x.change===null?'':` · <i class="${x.change>0?'is-wider':x.change<0?'is-narrower':''}">1か月 ${x.change>0?'+':''}${x.change.toFixed(2)}%pt</i>`}</em></div>`).join('')}</div><p class="pulse-legend">緑＝基準内 ／ 黄＝注意 ／ 赤＝警戒 ／ 灰＝未判定。HY・BBBの色は水準のみ。上昇速度は下欄で別判定します。値は国債に対する上乗せ幅（社債利回りではありません）。</p>${pulseScoreHTML(score)}${pulseVixMacdHTML(data.items,speed,context,Date.now(),late)}<div class="pulse-curve"><span>米国イールドカーブ</span><b>${esc(curve.label)}</b><small>${esc(curve.detail)}</small></div>${pulseCreditHTML(context,extra)}${pulseResearchHTML()}<details class="news-story"><summary><span class="news-category">判定の背景</span><span class="news-headline">指標ごとの基準と更新日</span><span class="news-expand">＋</span></summary><div class="news-body"><p>金利・信用スプレッド（企業の資金調達への警戒）・VIX（相場への不安の目安）などを、決めた条件で自動分類しています。社債スプレッドは拡大が警戒、縮小が改善の方向です。個別信号は今回の暫定監視基準で、公式な危機判定や検証済み売買ルールではありません。HY：3%未満緑／3〜5%未満黄／5%以上赤、BBB：1.5%未満緑／1.5〜2.5%未満黄／2.5%以上赤。</p><h4>警戒スコアの加点条件（合計3点）</h4><ul><li><b>HY：最大1点</b><br>水準が3%以上で＋0.5点。<br><b>速度：1か月前より＋0.50ポイント以上で＋0.5点。</b></li><li><b>BBB：最大1点</b><br>水準が1.5%以上で＋0.5点。<br><b>速度：1か月前より＋0.20ポイント以上で＋0.5点。</b></li><li><b>銀行：最大1点</b>。KBE・KREの悪い方を採用します。</li></ul><p><b>速度＝現在のスプレッド − 約1か月前のスプレッド。</b>当日だけの上昇幅や、何％増えたかという変化率ではありません。<br>例：HYが2.70%→3.20%なら＋0.50ポイントで、速度に＋0.5点。BBBが0.90%→1.10%なら＋0.20ポイントで、速度に＋0.5点。</p><p>水準と速度の両方を満たすと、その指標は1点です。合計1.5点以上で早期警戒します。水準色は速度で変更しません。欠測は採点を保留し、前回確定値があれば現在値と区別して示します。</p><h4>その他の指標の色分け</h4><p>VIX：20未満緑／20〜30未満黄／30以上赤。米2年・10年金利：1か月上昇+0.25/+0.50%ptで黄/赤。銀行株（KBE・KRE各々）：1か月−5/−10%以下、または銀行株下落かつS&P500比−3/−7%pt以下で黄/赤。逆イールドは黄。緑も買い信号や安全保証ではありません。金利・VIXは加点せず、補助情報として表示します。カーブ分類は1か月の2年・10年金利の共通日比較です。今日や明日の株価を予言する表示ではありません。</p><p>最終取得処理：${esc(fmt(data.generated_at))} 日本時間 · 毎朝7時</p><p>日次指標：${esc(dates[0]||'未取得')}〜${esc(dates.at(-1)||'未取得')}<br>月次統計：${esc([...new Set(monthly)].join(' / ')||'未取得')}</p><p>${late?'取得処理が古いため、直近の変動を反映していない可能性があります。':''}${bad.length?esc(bad.map(x=>x.name).join('・'))+'は未取得または保存値です。':''}</p><small>取得可能な指標による暫定判定。発表直後のニュース、企業利益、日本市場全体の需給は別途調査します。灰は安全の意味ではありません。</small><p><a href="#review/scr:macro">指標と判定根拠</a> · <a href="#review/history">月次分類の履歴</a></p></div></details></section>`;

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
