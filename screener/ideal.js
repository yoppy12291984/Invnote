export const defaults=[['2153','E・J',9,1817],['3151','バイタルKSK',9,1571],['4401','ADEKA',8,4375],['1941','中電工',8,5120],['3088','マツキヨココカラ',8,2473.5],['8035','東京エレクトロン',8,51460],['7013','IHI',7,2665],['7974','任天堂',7,8093],['5304','SECカーボン',3,2493],['4060','rakumo',3,1190],['8316','三井住友FG',5,6911],['2768','双日',5,5739]].map(([code,name,weight,price])=>({code,name,weight,price}));
const KEY='screener_ideal_inputs_v1';
export function readPlan(){
 const s=JSON.parse(localStorage.getItem(KEY)||'{}')||{};
 const items=Array.isArray(s.items)?s.items:defaults.map(r=>({...r,weight:s.rows?.[r.code]?.weight??r.weight,price:s.rows?.[r.code]?.price??r.price}));
 const seen=new Set();
 for(const r of items){if(!/^[0-9A-Z]{4}$/.test(r.code)||seen.has(r.code)||typeof r.name!=='string'||!r.name.trim()||r.name.length>60)throw Error('銘柄の保存データが不正です。');seen.add(r.code);}
 return {budget:s.budget??'',items:items.map(r=>({...r}))};
}
export function calculate(budget,rows){
 if(!Number.isFinite(budget)||budget<=0||budget>1e12)return {error:'資金は0より大きく1兆円以下で入力してください。'};
 if(rows.some(r=>!Number.isFinite(r.weight)||r.weight<0||r.weight>100||!Number.isFinite(r.price)||r.price<=0||r.price>1e9))return {error:'配分は0〜100％、株価は0より大きく10億円以下で入力してください。'};
 const total=rows.reduce((s,r)=>s+r.weight,0);if(total>100+1e-8)return {error:'配分合計が100％を超えています。減らしてから計算してください。'};
 const items=rows.map(r=>{const target=budget*r.weight/100,shares=Math.floor(target/r.price);return {...r,target,shares,amount:shares*r.price};});const invested=items.reduce((s,r)=>s+r.amount,0);
 return {items,total,invested,cash:budget-invested,reserve:budget*(100-total)/100};
}
export function mount(root){
 let plan;try{plan=readPlan();}catch(e){root.textContent='理想配分の保存データを読み込めません。元データは上書きしていません。';return;}
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const yen=v=>v.toLocaleString('ja-JP',{maximumFractionDigits:1});
 let notice='';
 function save(next,structural=false){try{localStorage.setItem(KEY,JSON.stringify({version:2,...next}));}catch(e){root.querySelector('#ideal-save').textContent='端末への保存に失敗しました。変更は未確定です。';return false;}plan=next;notice='この端末に保存しました。他の端末とは同期しません。';root.querySelector('#ideal-save').textContent=notice;window.dispatchEvent(new Event('ideal-plan-changed'));return true;}
 function fromScreen(){return {budget:root.querySelector('#ideal-budget').value,items:[...root.querySelectorAll('[data-code]')].map((el,i)=>({...plan.items[i],weight:el.querySelector('[data-field=weight]').value,price:el.querySelector('[data-field=price]').value}))};}
 function draw(){const s=fromScreen(),r=calculate(Number(s.budget)*10000,s.items.map(x=>({...x,weight:x.weight===''?NaN:Number(x.weight),price:x.price===''?NaN:Number(x.price)})));root.querySelector('#ideal-summary').textContent=s.budget===''?'資金を入力すると目安株数が表示されます。':r.error||`${s.items.length}銘柄・株式 ${r.total.toFixed(1)}％・約${yen(r.invested/10000)}万円 ／ 残る現金 約${yen(r.cash/10000)}万円（切捨て残額を含む）`;[...root.querySelectorAll('[data-result]')].forEach((el,i)=>el.textContent=r.items?`${yen(r.items[i].shares)}株 ／ 約${yen(r.items[i].amount)}円`:'— 株');}
 function render(){root.innerHTML=`<style>#ideal input{font:inherit;font-size:16px;background:var(--sur);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:6px;width:100%;min-width:0}#ideal .ideal-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0}#ideal label{display:block;font-size:12px;color:var(--mut)}#ideal .ideal-result{font-weight:600;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}#ideal .ideal-top,#ideal-editor{background:var(--sur);padding:12px;border-radius:10px;margin-bottom:12px}#ideal .name{overflow-wrap:anywhere;white-space:normal}#ideal .chip{margin:4px 3px 4px 0;white-space:normal}</style>
 <p class="hint">理想ポートフォリオの配分案。銘柄を追加・編集・削除できます。削除した配分は現金に残し、他の銘柄へ自動配分しません。運用成績で固定した開始条件・実際の売買記録は変更しません。</p>
 <div class="ideal-top"><label>運用資金（万円）<input id="ideal-budget" type="number" inputmode="decimal" min="0" step="any" placeholder="例：1000" value="${esc(plan.budget)}"></label><p id="ideal-summary" class="ideal-result" aria-live="polite"></p><p id="ideal-save" class="hint" role="status">${esc(notice)}</p><button class="chip" id="ideal-add">銘柄を追加</button><button id="ideal-reset" class="chip">銘柄・配分・株価を初期案に戻す</button></div>
 <form id="ideal-editor" hidden><b id="ideal-editor-title"></b><div class="ideal-fields"><label>銘柄コード<input name="code" maxlength="4" required pattern="[0-9A-Za-z]{4}"></label><label>銘柄名<input name="name" maxlength="60" required></label><label>配分（％）<input name="weight" type="number" min="0" max="100" step="any" required></label><label>計算用株価（円）<input name="price" type="number" min="0.000001" max="1000000000" step="any" required></label></div><p id="ideal-editor-error" role="status"></p><button type="submit" class="chip">銘柄を保存</button><button type="button" id="ideal-cancel" class="chip">キャンセル</button></form>
 <p class="hint">株数は資金×配分率÷株価を1株単位で切り捨て。既存保有を含む目標数で、追加注文数ではありません。費用は含みません。</p><p class="hint">初期株価は2026/9/11終値の固定参考値。株価・分割は自動更新しません。追加・変更時は価格を確認してください。東京エレクトロン1対5、三井住友FG1対2の分割予定（9/30基準日）にも注意し、分割後は株価を変更してください。</p>
 ${plan.items.map((r,i)=>`<article class="stk" data-code="${esc(r.code)}"><div class="shead"><span class="code">${esc(r.code)}</span><span class="name">${esc(r.name)}</span></div><div class="ideal-fields"><label>配分（％）<input aria-label="${esc(r.name)} 配分" data-field="weight" type="number" min="0" max="100" step="any" value="${esc(r.weight)}"></label><label>計算用株価（円）<input aria-label="${esc(r.name)} 株価" data-field="price" type="number" min="0" step="any" value="${esc(r.price)}"></label></div><p class="ideal-result" data-result></p><a href="https://finance.yahoo.co.jp/quote/${esc(r.code)}.T" target="_blank" rel="noopener">株価を確認</a><div><button class="chip" data-edit="${i}">銘柄を編集</button><button class="chip" data-remove="${i}">削除</button></div></article>`).join('')||'<p class="empty">銘柄がありません。資金はすべて現金です。「銘柄を追加」から登録できます。</p>'}`;
 const editor=root.querySelector('#ideal-editor');let editing=-1;
 function edit(i){editing=i;const r=i<0?{code:'',name:'',weight:0,price:''}:fromScreen().items[i];for(const k of ['code','name','weight','price'])editor.elements[k].value=r[k];root.querySelector('#ideal-editor-title').textContent=i<0?'銘柄を追加':'銘柄を編集';root.querySelector('#ideal-editor-error').textContent='';editor.hidden=false;editor.elements.code.focus();}
 root.querySelector('#ideal-add').onclick=()=>edit(-1);root.querySelector('#ideal-cancel').onclick=()=>editor.hidden=true;
 for(const b of root.querySelectorAll('[data-edit]'))b.onclick=()=>edit(Number(b.dataset.edit));
 for(const b of root.querySelectorAll('[data-remove]'))b.onclick=()=>{const i=Number(b.dataset.remove);if(!confirm(`${plan.items[i].name}を理想配分から削除しますか？`))return;const next=fromScreen();next.items.splice(i,1);if(save(next,true))render();};
 editor.onsubmit=e=>{e.preventDefault();const f=editor.elements,next=fromScreen(),r={code:f.code.value.trim().toUpperCase(),name:f.name.value.trim(),weight:f.weight.valueAsNumber,price:f.price.valueAsNumber};if(!/^[0-9A-Z]{4}$/.test(r.code)||!r.name||next.items.some((x,i)=>i!==editing&&x.code===r.code)){root.querySelector('#ideal-editor-error').textContent='コード・銘柄名を確認してください。同じコードは重複登録できません。';return;}if(editing<0)next.items.push(r);else next.items[editing]=r;const check=calculate(10000,next.items.map(x=>({...x,weight:x.weight===''?NaN:Number(x.weight),price:x.price===''?NaN:Number(x.price)})));if(check.error){root.querySelector('#ideal-editor-error').textContent=check.error;return;}if(save(next,true))render();};
 root.querySelector('#ideal-reset').onclick=()=>{if(!confirm('銘柄・配分・株価を最初の12銘柄へ戻しますか？入力資金は残します。'))return;if(save({budget:root.querySelector('#ideal-budget').value,items:defaults.map(x=>({...x}))},true))render();};
 for(const el of root.querySelectorAll('#ideal-budget,[data-field]'))el.oninput=()=>{draw();save(fromScreen());};draw();
 }
 render();
}
