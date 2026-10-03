/* Private content arrives only from the existing authenticated Invnote frame. */
'use strict';
let personalStocks=[],researchHash='',syncTime=0;
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
 watch=new Set([...watch].filter(c=>Object.hasOwn(notes,c)));
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
 if(e.origin===location.origin&&e.source===frames.scr?.contentWindow&&e.data?.type==='screener:company'&&/^[0-9A-Z]{4,5}$/.test(e.data.code)){location.hash='company/'+e.data.code;return;}
 if(e.origin!==location.origin||e.source!==frames.inv?.contentWindow)return;
 const m=e.data;
 if(m?.type==='invnote:company'&&/^[0-9A-Z]{4,5}$/.test(m.code)){location.hash='company/'+m.code;return;}
 if(m?.type==='invnote:locked'){replaceResearch(initialData);personalStocks=[];researchHash='';route();status.textContent='設定・同期から端末登録を確認してください。';return;}
 if(m?.type!=='invnote:state')return;
 const nextStocks=Array.isArray(m.stocks)?m.stocks.filter(s=>/^[0-9A-Z]{4,5}$/.test(s.code)&&typeof s.name==='string'&&typeof s.status==='string'):[];
 const changed=m.researchHash!==researchHash||JSON.stringify(nextStocks)!==JSON.stringify(personalStocks);
 personalStocks=nextStocks;syncTime=m.lastSync||0;
 if(validBundle(m.bundle)){replaceResearch(m.bundle);researchHash=m.researchHash;status.textContent=`四季報 ${all.length}社 · ${syncTime?'Invnote 最終同期 '+new Date(syncTime).toLocaleString('ja-JP'):'端末の保存データ'}`;}
 else {replaceResearch(initialData);researchHash='';status.textContent=m.bundle?'四季報の形式を確認できませんでした。設定・同期を確認してください。':'四季報はまだ同期されていません。設定・同期から読み込めます。';}
 // Keep active search text and personal edits intact when only sync time changed.
 if(changed)route();
});
// Load the existing authenticated application once, retaining its drafts across areas.
embedded('inv','vPf');route();
