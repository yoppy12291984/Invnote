// 公開するのは提案テンプレートのみ。資金・画面変更は端末内だけに保存。
export const defaults = [
  ['2153','E・J',9,1817],['3151','バイタルKSK',9,1571],
  ['4401','ADEKA',8,4375],['1941','中電工',8,5120],
  ['3088','マツキヨココカラ',8,2473.5],['8035','東京エレクトロン',8,51460],
  ['7013','IHI',7,2665],['7974','任天堂',7,8093],
  ['5304','SECカーボン',3,2493],['4060','rakumo',3,1190],
  ['8316','三井住友FG',5,6911],['2768','双日',5,5739]
].map(([code,name,weight,price])=>({code,name,weight,price}));

export function calculate(budget, rows) {
  if (!Number.isFinite(budget) || budget <= 0 || budget > 1e12)
    return {error:'資金は0より大きく1兆円以下で入力してください。'};
  if(rows.some(r=>!Number.isFinite(r.weight)||r.weight<0||r.weight>100||!Number.isFinite(r.price)||r.price<=0||r.price>1e9))
    return {error:'配分は0〜100％、株価は0より大きく10億円以下で入力してください。'};
  const total=rows.reduce((s,r)=>s+r.weight,0);
  if(total>100+1e-8)return {error:'配分合計が100％を超えています。減らしてから計算してください。'};
  const items=rows.map(r=>{const target=budget*r.weight/100;
    const shares=Math.floor(target/r.price);
    return {...r,target,shares,amount:shares*r.price};});
  const invested=items.reduce((s,r)=>s+r.amount,0);
  return {items,total,invested,cash:budget-invested,reserve:budget*(100-total)/100};
}

export function mount(root) {
  const key='screener_ideal_inputs_v1';
  let saved={};
  try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(e){}
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const yen=v=>v.toLocaleString('ja-JP',{maximumFractionDigits:1});
  root.innerHTML=`<style>
    #ideal input{font:inherit;background:var(--sur);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:6px;width:100%;min-width:0}
    #ideal .ideal-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0}
    #ideal label{display:block;font-size:12px;color:var(--mut)}
    #ideal .ideal-result{font-weight:600;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
    #ideal .ideal-top{background:var(--sur);padding:12px;border-radius:10px;margin-bottom:12px}
  </style><p class="hint">理想ポートフォリオの配分案 · 2026/9/13版<br>12銘柄＋現金20％。既存の清原式ルールとは別の裁量案です。建設枠は中電工を仮置き。比率は全資金に対する割合です。</p>
  <div class="ideal-top"><label>運用資金（万円）<input id="ideal-budget" type="number" inputmode="decimal" min="0" max="100000000" step="any" placeholder="例：1000" value="${esc(saved.budget??'')}"></label>
  <p id="ideal-summary" class="ideal-result" aria-live="polite"></p><p id="ideal-save" class="hint"></p>
  <button id="ideal-reset" class="chip">配分・株価を初期案に戻す</button></div>
  <p class="hint">株数＝資金×配分率÷計算用株価を1株単位で切り捨て。残額は現金。既存保有を含む目標株数で、追加注文数ではありません。費用は含みません。</p>
  <p class="hint">初期株価は2026/9/11終値の固定参考値です。自動取得ではありません。注文前に計算用株価を更新してください。東京エレクトロンは1対5、三井住友FGは1対2の分割予定（9/30基準日）。分割後の株価に変更すると、その基準の株数を計算します。分割調整も自動ではありません。</p>
  ${defaults.map(r=>{const s=saved.rows?.[r.code]||{};return `<article class="stk" data-code="${r.code}"><div class="shead"><span class="code">${r.code}</span><span class="name">${r.name}</span></div>
    <div class="ideal-fields"><label>配分（％）<input aria-label="${r.name} 配分" data-field="weight" type="number" inputmode="decimal" min="0" max="100" step="any" value="${esc(s.weight??r.weight)}"></label>
    <label>計算用株価（円）<input aria-label="${r.name} 株価" data-field="price" type="number" inputmode="decimal" min="0" step="any" value="${esc(s.price??r.price)}"></label></div>
    <p class="ideal-result" data-result></p><a href="https://finance.yahoo.co.jp/quote/${r.code}.T" target="_blank" rel="noopener">株価を確認</a></article>`;}).join('')}`;
  const budget=root.querySelector('#ideal-budget');
  const cards=[...root.querySelectorAll('[data-code]')];
  function draw(persist=false){
    const rows=cards.map((el,i)=>({...defaults[i],weight:el.querySelector('[data-field=weight]').valueAsNumber,price:el.querySelector('[data-field=price]').valueAsNumber}));
    const result=calculate(budget.valueAsNumber*10000,rows);
    root.querySelector('#ideal-summary').textContent=budget.value===''?'資金を入力すると目安株数が表示されます。':result.error||`株式 ${result.total.toFixed(1)}％・約${yen(result.invested/10000)}万円 ／ 残る現金 約${yen(result.cash/10000)}万円（切捨て残額を含む）`;
    cards.forEach((el,i)=>{const r=result.items?.[i];el.querySelector('[data-result]').textContent=r?`${yen(r.shares)}株 ／ 約${yen(r.amount)}円`:'— 株';});
    if(persist){try{
      const state={budget:budget.value,rows:Object.fromEntries(cards.map(el=>[el.dataset.code,{weight:el.querySelector('[data-field=weight]').value,price:el.querySelector('[data-field=price]').value}]))};
      localStorage.setItem(key,JSON.stringify(state));
      root.querySelector('#ideal-save').textContent='この端末のブラウザに保存しました。資金・変更内容は送信されません。';
    }catch(e){root.querySelector('#ideal-save').textContent='端末への保存に失敗しました。計算はできますが、再読込すると入力が失われます。';}}
  }
  root.addEventListener('input',()=>draw(true));
  root.querySelector('#ideal-reset').addEventListener('click',()=>{cards.forEach((el,i)=>{for(const k of ['weight','price'])el.querySelector(`[data-field=${k}]`).value=defaults[i][k];});draw(true);});
  draw();
}
