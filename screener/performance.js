import {mountImports} from './performance-import.js?v=2.28';
import {defaults,calculate,readPlan} from './ideal.js?v=2.28';
import {validate,positions,evaluate} from './performance-engine.js?v=2.12';
const KEY='screener_performance_v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=v=>v==null?'—':v.toLocaleString('ja-JP',{maximumFractionDigits:0})+'円';
const pct=v=>v==null?'—':(v>=0?'+':'')+(v*100).toFixed(2)+'％';
const labels={buy:'購入／開始時保有',sell:'売却',deposit:'入金',withdraw:'出金',dividend:'配当受取',expense:'費用・税金',split:'株式分割・併合'};
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const input=(name,label,type='number',value='',required=true)=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'step="any" min="0" inputmode="decimal"':''} ${required?'required':''}></label>`;
export function mount(root){
 let state=null,notice='',broken=false;
 try{const raw=localStorage.getItem(KEY);if(raw)state=validate(JSON.parse(raw));}catch(e){broken=true;notice='保存データを読み込めません。元データは上書きしていません。バックアップを復元してください。';}
 const message=text=>{notice=text;root.querySelector('[data-message]').textContent=text;};
 function commit(next){validate(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch(e){throw new Error('保存できませんでした。変更は未確定です。ブラウザの保存設定・空き容量を確認してください。');}state=next;broken=false;notice='この端末に保存しました。取引情報は送信されません。';render();}
 function change(fn){try{const next=structuredClone(state);fn(next);commit(next);}catch(e){message(e.message);}}
 function render(){
  const ledgerOpen=root.querySelector('[data-ledger-panel]')?.open||false;
  root.innerHTML=`<style>
  #hold .perf-box{background:var(--sur);border-radius:10px;padding:12px;margin:10px 0;overflow-wrap:anywhere}
  #hold label{display:block;color:var(--mut);font-size:12px;margin:7px 0}
  #hold input,#hold select,#hold textarea{display:block;width:100%;min-width:0;box-sizing:border-box;font:inherit;font-size:16px;background:var(--sur);color:var(--ink);padding:7px;border:1px solid var(--line);border-radius:6px}
  #hold input[type=checkbox]{display:inline;width:auto}#hold .perf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  #hold .perf-metric b{display:block;font-size:19px}#hold .perf-metric span{color:var(--mut);font-size:12px}#hold button.chip{margin:8px 4px 0 0;padding:7px 10px;white-space:normal}
  #hold [data-message]{color:var(--blu);overflow-wrap:anywhere}#hold small{color:var(--mut)}
  </style><p class="hint">ポートフォリオ全体の運用成績。実際の記録から計算し、理想配分の入力だけでは購入済みにしません。旧清原式の採点記録は実績に移しません。</p>
  <p role="status" data-message>${esc(notice)}</p><div data-easy-import></div><details class="perf-box" data-ledger-panel ${ledgerOpen?'open':''}><summary>取引台帳・運用収益率（既存の記録と手動編集）</summary><div data-main></div></details>
  <details class="perf-box"><summary>保存・バックアップ</summary><p class="hint">記録はこの端末・ブラウザだけに保存されます。他端末との同期はありません。ブラウザのデータ削除に備えてバックアップしてください。ファイルには取引情報が含まれます。</p><button class="chip" data-export ${state?'':'disabled'}>バックアップを書き出す</button><label>バックアップを復元（現在の記録を置換）<input data-import type="file" accept=".json,application/json"></label></details>
  <details class="perf-box"><summary>成績の読み方・計算条件</summary><p>損益＝評価資産−開始資産−純入金。配当・税金・費用は記録した金額を現金へ反映します。開始以前の損益は含みません。</p><p>収益率は評価間の変化を連結します。入出金はその日の日初扱いです。入出金日の終値評価が必要で、欠ける場合は収益率・比較差・下落率を表示しません。日中の入出金時刻による差は反映しません。</p><p>TOPIXは入力した指数の騰落率（配当なし・費用なし）です。実運用の配当込み収益率と条件差があります。理想配分は開始日に固定した株数＋現金を保有し続ける仮想比較（売買費用なし）。配当と分割は手動記録です。途中の入出金は比較先を比例拡大・縮小する想定で収益率を比べます。</p><p>最大下落率は記録した評価時点の収益率指数で計算します。日次記録がなければ、その間の下落を見逃します。株価・指数・配当・分割は自動取得しません。</p></details>`;
  mountImports(root.querySelector('[data-easy-import]'),{getState:()=>state,commit,message});
  const main=root.querySelector('[data-main]');
  if(!state){if(!broken)setup(main);}else dashboard(main);
  root.querySelector('[data-export]').onclick=()=>{if(!state)return;const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`portfolio-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  root.querySelector('[data-import]').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>2000000)throw new Error('2MB以下のバックアップを選んでください。');const next=validate(JSON.parse(await f.text()));if(state&&!confirm('現在の運用記録をバックアップの内容に置き換えますか？'))return;commit(next);}catch(err){message(err.message);}};
 }
 function setup(main){
  let plan;try{plan=readPlan();}catch(e){main.textContent='理想配分の保存データを確認してください。開始条件はまだ固定していません。';return;}
  const rows=plan.items.map(r=>({...r,weight:r.weight===''?NaN:Number(r.weight),price:r.price===''?NaN:Number(r.price)}));
  main.innerHTML=`<form class="perf-box" data-start><b>1. 運用の開始時点を固定</b><p class="hint">開始資産は株式時価＋現金の合計。すでに持つ株は、開始日の時価で「購入／開始時保有」に記録してください。過去の購入価格を使うと開始以前の損益が混ざります。</p>
  ${input('date','開始日','date',today())}${input('capital','開始資産（万円）')}${input('topix','開始日のTOPIX終値（省略すると比較なし）','number','',false)}
  <details open><summary>比較用の理想配分を確認</summary><p class="hint">理想配分タブの比率を読み込みます。株価は開始日の終値へ修正してください。固定後は理想配分タブを編集しても比較基準は変わりません。</p>
  ${rows.map(r=>`<div class="perf-grid">${input('w'+r.code,r.name+' 配分（％）','number',r.weight)}${input('p'+r.code,r.code+' 開始株価（円）','number',r.price)}</div>`).join('')}</details>
  <label><input name="verified" type="checkbox" required> 開始日・資産・比較用株価を確認しました</label><button class="chip" type="submit">この条件で運用記録を開始</button></form>`;
  main.querySelector('[data-start]').onsubmit=e=>{e.preventDefault();try{const f=e.currentTarget;const capital=f.elements.capital.valueAsNumber*10000;const result=calculate(capital,rows.map(r=>({...r,weight:f.elements['w'+r.code].valueAsNumber,price:f.elements['p'+r.code].valueAsNumber})));if(result.error)throw new Error(result.error);commit({version:1,start:{date:f.elements.date.value,capital,topix:f.elements.topix.value===''?null:f.elements.topix.valueAsNumber,ideal:result.items.map(({code,name,shares,price,weight})=>({code,name,shares,price,weight}))},events:[],points:[],reviews:[]});}catch(err){message(err.message);}};
 }
 function dashboard(main){
  const points=evaluate(state),last=points.at(-1),n=last&&!last.error?last:null,held=positions(state);
  main.innerHTML=`<div class="perf-box"><p>開始 ${esc(state.start.date)} · ${yen(state.start.capital)}<br>最終評価 ${esc(last?.date||'未記録')}</p><div class="perf-grid">
  ${[['評価資産',yen(n?.nav)],['累計損益',yen(n?.profit)],['運用収益率',pct(n?.ret)],['TOPIXとの差',n?.vsTopix==null?'—':(n.vsTopix*100).toFixed(2)+' pt'],['固定した理想配分との差',n?.vsIdeal==null?'—':(n.vsIdeal*100).toFixed(2)+' pt'],['最大下落率（記録時点間）',pct(n?.dd)]].map(([a,b])=>`<div class="perf-metric"><span>${a}</span><b>${b}</b></div>`).join('')}
  </div><p class="hint">現金 ${yen(n?.cash)}<br>${esc(last?.error||n?.reason||(!last?'取引を記録し、評価日の株価を入力すると成績が表示されます。':''))}</p></div>
  <details class="perf-box"><summary>記録上の保有・現金（全取引を反映）</summary>${Object.entries(held.actual).filter(([c,q])=>q>1e-8).map(([c,q])=>`<p>${esc(c)} ${esc(defaults.find(r=>r.code===c)?.name||'')} ${q}株</p>`).join('')||'<p>株式の記録はありません。</p>'}<p>現金 ${yen(held.cash)}</p></details>
  <details class="perf-box"><summary>固定した開始時の理想配分</summary>${state.start.ideal.map(r=>`<p>${esc(r.code)} ${esc(r.name)} ${r.shares}株 × ${yen(r.price)}</p>`).join('')}<p>現金 ${yen(state.start.capital-state.start.ideal.reduce((a,r)=>a+r.price*r.shares,0))}</p></details>
  ${state.start.topix===null?`<form class="perf-box" data-start-index>${input('topix','開始日 '+esc(state.start.date)+' のTOPIX終値を補完')}<button class="chip" type="submit">開始指数を保存</button></form>`:''}
  <form class="perf-box" data-event><b>2. 実際の取引を記録</b>${input('date','取引日','date',today())}<label>種類<select name="kind">${Object.entries(labels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
  <div data-for="buy sell dividend split">${input('code','銘柄コード（4桁）','text','',false)}</div>
  <div data-for="buy sell" class="perf-grid">${input('shares','株数','number','',false)}${input('price','1株あたり約定価格（円）','number','',false)}${input('fee','手数料・税金の合計（円）','number',0,false)}</div>
  <div data-for="deposit withdraw dividend expense">${input('amount','金額（円）／配当は税引後の受取総額','number','',false)}</div>
  <div data-for="dividend">${input('idealAmount','固定理想配分の配当総額（円・該当なしは0）','number','',false)}<p class="hint">実際の受取額とは別です。理想配分の権利株数に応じた金額を入力してください。</p></div>
  <div data-for="split">${input('ratio','株数の倍率（1→5なら5、5→1なら0.2）','number','',false)}<p class="hint">権利落ち日で記録。実保有と固定理想配分の両方に適用し、株価は分割後の値で評価します。</p></div>
  ${input('note','メモ（任意）','text','',false)}<button type="submit" class="chip">取引を保存</button></form>
  <form class="perf-box" data-point><b>3. 評価日の終値を記録</b>${input('date','評価日','date',today())}<div data-prices></div>${input('topix','同じ評価日のTOPIX終値（任意）','number','',false)}<label><input name="verified" type="checkbox" required> 同じ日の終値と配当・分割の記録を確認しました</label><button type="submit" class="chip">評価を保存</button><p class="hint">同じ日は上書き確認します。後から取引を訂正した場合は全評価を再計算し、必要株価の不足を表示します。</p></form>
  <form class="perf-box" data-review><b>4. 購入理由を振り返る</b>${input('date','確認日','date',today())}${input('code','対象の銘柄コード','text')}<label>進展<select name="status"><option>順調</option><option selected>要確認</option><option>仮説崩れ</option></select></label><label>購入理由・確認した事実・次回の確認事項<textarea name="note" required maxlength="4000"></textarea></label><button type="submit" class="chip">仮説の記録を保存</button></form>
  <details class="perf-box"><summary>評価の履歴（${points.length}件）</summary>${points.slice().reverse().map(p=>`<p>${esc(p.date)}　${p.error?esc(p.error):`${yen(p.nav)} ／ ${pct(p.ret)}　TOPIX ${pct(p.topix)} ／ 理想 ${pct(p.ideal)}`}</p><button class="chip" data-del-point="${p.date}">この評価を削除</button>`).join('')||'<p>まだありません。</p>'}</details>
  <details class="perf-box"><summary>取引の履歴（${state.events.length}件）</summary>${state.events.map((e,i)=>`<p>${esc(e.date)} ${esc(labels[e.kind])} ${esc(e.code)} ${['buy','sell'].includes(e.kind)?`${e.shares}株 × ${yen(e.price)}（費用${yen(e.fee)}）`:e.kind==='split'?`${e.ratio}倍`:yen(e.amount)} ${e.kind==='dividend'?`／理想配分への配当 ${yen(e.idealAmount)}`:''} ${esc(e.note)}</p><button class="chip" data-edit-event="${i}">この取引を訂正</button><button class="chip" data-del-event="${i}">この取引を削除</button>`).reverse().join('')||'<p>まだありません。</p>'}</details>
  <details class="perf-box"><summary>仮説の履歴（${state.reviews.length}件）</summary>${state.reviews.map((r,i)=>`<p>${esc(r.date)} ${esc(r.code)} ${esc(r.status)}<br>${esc(r.note)}</p><button class="chip" data-del-review="${i}">この仮説記録を削除</button>`).reverse().join('')||'<p>まだありません。</p>'}</details>`;
  const eventForm=main.querySelector('[data-event]');
  const fields=()=>{main.querySelectorAll('[data-for]').forEach(el=>{el.hidden=!el.dataset.for.split(' ').includes(eventForm.elements.kind.value);for(const field of el.querySelectorAll('input')){field.disabled=el.hidden;field.required=!el.hidden;}});};fields();eventForm.elements.kind.onchange=fields;
  eventForm.onsubmit=e=>{e.preventDefault();const f=e.currentTarget.elements,kind=f.kind.value;change(s=>{const i=eventForm.dataset.edit;const entry={id:i===undefined?crypto.randomUUID():s.events[Number(i)].id,date:f.date.value,kind,code:f.code.value.trim().toUpperCase(),shares:f.shares.valueAsNumber,price:f.price.valueAsNumber,fee:f.fee.valueAsNumber,amount:f.amount.valueAsNumber,idealAmount:f.idealAmount.valueAsNumber,ratio:f.ratio.valueAsNumber,note:f.note.value.slice(0,1000)};if(i===undefined)s.events.push(entry);else s.events[Number(i)]=entry;});};
  for(const b of main.querySelectorAll('[data-edit-event]'))b.onclick=()=>{const i=Number(b.dataset.editEvent),entry=state.events[i];for(const name of ['date','kind','code','shares','price','fee','amount','idealAmount','ratio','note'])eventForm.elements[name].value=entry[name]??'';eventForm.dataset.edit=String(i);eventForm.querySelector('b').textContent='取引を訂正（保存すると上書き）';eventForm.querySelector('[type=submit]').textContent='訂正を保存';fields();eventForm.scrollIntoView({block:'center'});};
  const startIndex=main.querySelector('[data-start-index]');if(startIndex)startIndex.onsubmit=e=>{e.preventDefault();change(s=>s.start.topix=startIndex.elements.topix.valueAsNumber);};
  const pointForm=main.querySelector('[data-point]');
  function priceFields(){try{const h=positions(state,pointForm.elements.date.value);const codes=[...new Set([...Object.keys(h.actual),...Object.keys(h.ideal)])].filter(c=>(h.actual[c]||0)>1e-8||(h.ideal[c]||0)>1e-8);const existing=state.points.find(p=>p.date===pointForm.elements.date.value);pointForm.querySelector('[data-prices]').innerHTML=codes.map(c=>input('q'+c,c+' 終値（円）','number',existing?.prices[c]??'')).join('');pointForm.elements.topix.value=existing?.topix??'';}catch(e){message(e.message);}}
  pointForm.elements.date.onchange=priceFields;priceFields();
  pointForm.onsubmit=e=>{e.preventDefault();const f=e.currentTarget,date=f.elements.date.value;if(state.points.some(p=>p.date===date)&&!confirm('この日の評価を上書きしますか？'))return;const prices=Object.fromEntries([...f.querySelectorAll('[name^=q]')].map(el=>[el.name.slice(1),el.valueAsNumber]));change(s=>{s.points=s.points.filter(p=>p.date!==date);s.points.push({date,prices,topix:f.elements.topix.value===''?null:f.elements.topix.valueAsNumber});});};
  main.querySelector('[data-review]').onsubmit=e=>{e.preventDefault();const f=e.currentTarget.elements;change(s=>s.reviews.push({date:f.date.value,code:f.code.value.trim().toUpperCase(),status:f.status.value,note:f.note.value}));};
  for(const b of main.querySelectorAll('[data-del-event]'))b.onclick=()=>{if(confirm('この取引を削除して成績を再計算しますか？'))change(s=>s.events.splice(Number(b.dataset.delEvent),1));};
  for(const b of main.querySelectorAll('[data-del-point]'))b.onclick=()=>{if(confirm('この評価を削除しますか？'))change(s=>s.points=s.points.filter(p=>p.date!==b.dataset.delPoint));};
  for(const b of main.querySelectorAll('[data-del-review]'))b.onclick=()=>{if(confirm('この仮説記録を削除しますか？'))change(s=>s.reviews.splice(Number(b.dataset.delReview),1));};
 }
 window.addEventListener('ideal-plan-changed',()=>{if(!state&&!broken)render();});
 render();
}
