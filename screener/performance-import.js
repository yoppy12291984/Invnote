import {mountCsv} from './performance-csv.js?v=2.28';
import {validate} from './performance-engine.js?v=2.12';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=v=>v==null?'未確認':v.toLocaleString('ja-JP',{maximumFractionDigits:0})+'円';
const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function observedPortfolio(data){
 if(!data||!data.holdings||Array.isArray(data.holdings))throw Error('InvnoteのバックアップJSONを選んでください。');
 const rows=Object.entries(data.holdings).filter(([c,h])=>/^[0-9A-Z]{4}$/.test(c)&&h&&valid(h.shares)&&h.shares>0).map(([code,h])=>({code,name:String(data.stocks?.[code]?.name||''),...h}));
 const dates=[...new Set(rows.map(x=>x.pdate).filter(Boolean))];
 const verified=rows.every(x=>valid(x.price)&&x.price>0&&!/信用|空売|売建/.test(x.acct||'')&&x.pdate)&&dates.length<=1;
 const val=verified?rows.reduce((n,x)=>n+x.shares*x.price,0):null;
 // Imported average prices absent in old Invnote data are often zero. Do not turn them into profit.
 const cost=rows.every(x=>valid(x.avg)&&x.avg>0)?rows.reduce((n,x)=>n+x.shares*x.avg,0):null;
 return {rows,date:dates.length===1?dates[0]:'価格日が混在・不明',complete:data.holdingsComplete===true,val,cost,pl:val!==null&&cost!==null?val-cost:null};
}
export function mergeLedger(current,input){
 if(!input||!Array.isArray(input.events)||!Array.isArray(input.points))throw Error('events と points の配列が必要です。');
 const next=current?structuredClone(current):{version:1,start:input.start,events:[],points:[],reviews:[]};
 if(current&&input.start&&stable(input.start)!==stable(current.start))throw Error('固定済みの開始条件は一括取込では変更できません。');
 let added=0;
 for(const e of input.events){
  if(!e||typeof e.id!=='string'||!e.id.trim())throw Error('取引には証券明細などに基づく一意のidが必要です。');
  const existing=next.events.find(x=>x.id===e.id);
  if(existing){if(stable(existing)!==stable(e))throw Error('同じ取引idの内容が違います。既存の取引訂正を使ってください。');continue;}
  next.events.push(e);added++;
 }
 for(const p of input.points){const previous=next.points.find(x=>x.date===p.date);if(previous&&stable(previous)!==stable(p))throw Error(p.date+' の評価が既存記録と違います。評価訂正で確認してください。');if(!previous){next.points.push(p);added++;}}
 validate(next);return {next,added};
}
export function mountImports(root,{getState,commit,message}){
 root.innerHTML=`<div class="perf-box"><b>Invnoteの保有をそのまま確認</b><p class="hint">同じブラウザ・同じ公開サイトのInvnoteから読み込みます。別端末ならInvnoteのJSONバックアップを選べます。保有残高を取引明細へ変換しません。</p><button class="chip" data-inv-refresh>Invnoteから読み直す</button><label>Invnoteバックアップを読む<input type="file" data-inv-file accept=".json,application/json"></label><div data-inv-result></div></div>
 <details class="perf-box"><summary>約定・評価をJSONで一括取り込み</summary><p class="hint">証券明細などで確認した実取引と同日の終値をまとめて貼れます。同じidの取引・同じ日の評価は二重登録しません。保有画像から売買価格や実現益を推定しないでください。</p><textarea data-ledger-json rows="7" aria-label="取引と評価のJSON"></textarea><button class="chip" data-ledger-check>内容を確認</button><pre data-ledger-preview style="white-space:pre-wrap;overflow-wrap:anywhere"></pre><button class="chip" data-ledger-save hidden>確認した内容を保存</button><button class="chip" data-ledger-example>形式例を入れる（架空データ）</button></details>`;
 let pending=null;
 const output=root.querySelector('[data-inv-result]');
 const draw=data=>{const p=observedPortfolio(data);output.innerHTML=`<p>${p.complete?'全保有確認済み':'確認範囲は未確定'} · ${esc(p.date)}</p><div class="perf-grid"><div class="perf-metric"><span>登録株式の評価額</span><b>${yen(p.val)}</b></div><div class="perf-metric"><span>含み損益</span><b>${yen(p.pl)}</b></div></div><p class="hint">現金・売却済み損益を含まない保有状況です。入出金・配当・費用を含む運用収益率とは異なります。価格はInvnote側で更新してください。信用建玉・価格欠損・価格日混在では合計評価を保留します。</p>${p.rows.map(x=>`<p><b>${esc(x.name||x.code)}</b> <small>${esc(x.code)} · ${esc(x.acct||'口座未設定')}</small><br>${x.shares.toLocaleString('ja-JP')}株 · 現在値 ${yen(valid(x.price)&&x.price>0?x.price:null)}</p>`).join('')||'<p>登録保有はありません。</p>'}`;};
 const refresh=()=>{try{const raw=localStorage.getItem('invnote_v1');if(!raw){output.textContent='このブラウザにはInvnoteの保存データがありません。Invnoteを同じブラウザで開くか、バックアップを選んでください。';return;}draw(JSON.parse(raw));}catch(e){output.textContent='Invnoteを読み込めません：'+e.message;}};
 root.querySelector('[data-inv-refresh]').onclick=refresh;
 root.querySelector('[data-inv-file]').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>10000000)throw Error('10MB以下のJSONを選んでください。');draw(JSON.parse(await f.text()));}catch(err){output.textContent=err.message;}};
 const area=root.querySelector('[data-ledger-json]'),preview=root.querySelector('[data-ledger-preview]'),save=root.querySelector('[data-ledger-save]');
 area.oninput=()=>{pending=null;save.hidden=true;preview.textContent='';};
 root.querySelector('[data-ledger-check]').onclick=()=>{try{const input=JSON.parse(area.value.trim().replace(/^```(?:json)?\s*|```$/g,''));const result=mergeLedger(getState(),input);pending={input,base:JSON.stringify(getState())};preview.textContent=`開始 ${result.next.start.date}／開始資産 ${yen(result.next.start.capital)}\n新規追加 ${result.added}件\n`+input.events.map(e=>`${e.date} ${e.kind} ${e.code||''} ${e.shares??''}株 ${e.price??e.amount??''}円`).join('\n')+'\n評価日：'+input.points.map(p=>p.date).join('、');save.hidden=false;}catch(e){pending=null;save.hidden=true;preview.textContent=e.message;}};
 save.onclick=()=>{if(!pending)return;try{if(pending.base!==JSON.stringify(getState()))throw Error('記録が変更されました。もう一度内容を確認してください。');const r=mergeLedger(getState(),pending.input);commit(r.next);}catch(e){message(e.message);}};
 root.querySelector('[data-ledger-example]').onclick=()=>{area.value=JSON.stringify({start:{date:'2026-09-18',capital:1000000,topix:null,ideal:[]},events:[{id:'sample-20260918-6136-buy-1',date:'2026-09-18',kind:'buy',code:'6136',shares:100,price:2000,fee:0}],points:[{date:'2026-09-18',prices:{'6136':2000},topix:null}]},null,2);area.oninput();preview.textContent='架空の形式例です。日付・数量・金額・idを実際の明細に置き換えてください。開始資産は株式時価＋現金、開始時の既存保有はその日の時価で記録します。';};
 mountCsv(root,{getState,commit,merge:mergeLedger});
 refresh();
}
