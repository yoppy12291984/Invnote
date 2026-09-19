const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>v==null?'—':`${v>=0?'+':''}${(v*100).toFixed(2)}%`;
const yen=v=>v==null?'—':Math.round(v).toLocaleString('ja-JP')+'円';
const colors=['#4889cf','#dcaa43','#b08bd4','#39a88d'];
const finite=v=>typeof v==='number'&&Number.isFinite(v);

export function metrics(data,p,period='all',endIndex=p.points.length-1){
 const points=p.points.slice(0,endIndex+1),last=points.at(-1);if(!last)return null;
 let base=data.config.capital,baseFees=0,baseDate=data.started,startIndex=0,benchBase=data.config.capital;
 if(period!=='all'){
  const target=new Date(last.date+'T00:00:00Z');target.setUTCDate(target.getUTCDate()-Number(period));const day=target.toISOString().slice(0,10);
  const i=points.findLastIndex(x=>x.date<=day);if(i<0)return null;
  base=points[i].nav;baseFees=points[i].fees;baseDate=points[i].date;startIndex=i+1;benchBase=data.benchmark[i]?.nav;
 }
 const rows=points.slice(startIndex);let peak=base,drawdown=0;
 for(const point of rows){peak=Math.max(peak,point.nav);drawdown=Math.min(drawdown,point.nav/peak-1);}
 const bench=data.benchmark[endIndex]?.nav;const ret=last.nav/base-1;
 return {ret,excess:finite(bench)&&finite(benchBase)?ret-(bench/benchBase-1):null,drawdown,
  fees:last.fees-baseFees,baseDate,date:last.date,points:[{date:baseDate,value:100},...rows.map(x=>({date:x.date,value:x.nav/base*100}))],
  trades:p.trades.filter(t=>period==='all'?t.date<=last.date:t.date>baseDate&&t.date<=last.date).length};
}
export function ranking(data,mode,period,endIndex){
 const rows=data.portfolios.filter(p=>p.mode===mode).map(p=>({p,m:metrics(data,p,period,endIndex)}));
 rows.sort((a,b)=>(b.m?.ret??-Infinity)-(a.m?.ret??-Infinity));
 let previous=null,rank=0;
 rows.forEach((r,i)=>{if(!r.m||data.status==='blocked'){r.rank=null;return;}if(previous===null||Math.abs(r.m.ret-previous)>1e-10)rank=i+1;r.rank=rank;previous=r.m.ret;});
 return rows;
}
function chart(rows){
 if(!rows.some(r=>r.m))return '<p class="hint">同じ期間の株価が揃うと推移を表示します。</p>';
 const all=rows.flatMap(r=>r.m?.points||[]).map(p=>p.value),lo=Math.min(100,...all),hi=Math.max(100,...all),range=hi-lo||1;
 const sources=['candidates','rebound','catalysts','canslim'];
 return `<svg viewBox="0 0 600 210" role="img" aria-label="選択期間の開始を100とした資産推移" style="width:100%;height:auto"><text x="0" y="14" fill="currentColor" font-size="12">${hi.toFixed(1)}</text><text x="0" y="192" fill="currentColor" font-size="12">${lo.toFixed(1)}</text>${rows.filter(r=>r.m).map(r=>`<polyline fill="none" stroke="${colors[sources.indexOf(r.p.source)]}" stroke-width="2.5" points="${r.m.points.map((p,i)=>`${42+i/(r.m.points.length-1||1)*545},${185-(p.value-lo)/range*165}`).join(' ')}"/>`).join('')}</svg><p class="hint">${rows.filter(r=>r.m).map(r=>`<span style="color:${colors[sources.indexOf(r.p.source)]};margin-right:12px">● ${esc(r.p.name)}</span>`).join('')}<br>期間始点100 → 最終評価日。営業日ごとの終値評価です。</p>`;
}
function validate(data){
 if(data?.version!==1||!['waiting','active','blocked'].includes(data.status)||!Array.isArray(data.portfolios)||data.portfolios.length!==8||!Array.isArray(data.benchmark)||!finite(data.config?.capital)||data.config.capital<=0)throw Error('比較データの形式が違います。');
 for(const p of data.portfolios){if(!Array.isArray(p.points)||p.points.length!==data.benchmark.length||!Array.isArray(p.trades)||!Array.isArray(p.holdings))throw Error('評価日が揃っていません。');p.points.forEach((point,i)=>{if(!finite(point.nav)||point.nav<=0||!finite(point.fees)||point.date!==data.benchmark[i].date||!finite(data.benchmark[i].nav))throw Error('評価値が不正です。');});}
 return data;
}
export async function mount(root){
 root.innerHTML='<p class="hint">比較データを読み込み中…</p>';
 try{
  const response=await fetch('data/strategy-comparison.json?v='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('比較データを取得できません。');
  const data=validate(await response.json());let mode='weekly',period='all';
  function draw(){
   const rows=ranking(data,mode,period),recent=data.portfolios[0].points.slice(-12),end=data.portfolios[0].points.length;
   const stale=data.last_date&&(Date.now()-Date.parse(data.last_date+'T00:00:00+09:00'))>10*86400000;
   const subtitle=data.status==='waiting'?'記録済み・開始待ち。記録日の翌日以降の取引日の株価を取得してから、4つを同じ日に仮想購入します。':data.status==='blocked'?`評価を保留：${data.blocked.date} ${data.blocked.reason} ${data.blocked.codes.join('・')}。順位は表示せず、直前の正常評価までを参考表示します。`:`${data.started}開始 ／ ${data.last_date}まで ${end}営業日の比較`;
   root.innerHTML=`<style>
   #compare .cmp-box{background:var(--sur);border:1px solid var(--line);border-radius:9px;padding:12px;margin:10px 0;overflow-wrap:anywhere}
   #compare .cmp-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}#compare select{font:inherit;font-size:16px;max-width:100%;padding:5px;background:var(--sur);color:var(--ink);border:1px solid var(--line);border-radius:5px}
   #compare .cmp-table{width:100%;min-width:580px;border-collapse:collapse;font-size:13px}#compare th,#compare td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums}#compare th:first-child,#compare td:first-child{text-align:left}#compare th{font-size:11px;color:var(--mut);font-weight:500}#compare .cmp-table td:first-child{font-weight:600}
   #compare details{margin:10px 0}#compare summary{cursor:pointer;font-weight:600}#compare ul{padding-left:20px}#compare li{margin:5px 0}#compare h3{font-size:15px;margin:8px 0}
   </style><div class="cmp-box"><h3>4つの一覧を同じ条件で比較</h3><p>${esc(subtitle)}</p><p class="hint">${data.latest_snapshot_at.slice(0,10)}までに記録したリストを使用。実口座とは別の仮想運用です。</p>${stale?'<p class="warn-note">評価日が10日以上前です。順位は表示日までの結果で、現在の相場を反映していません。</p>':''}<p class="hint">「どれが強かったか」を比較します。将来の1位の予測や、各戦略本来の売買ルールの検証ではありません。</p></div>
   <div class="cmp-controls"><label>方式 <select data-mode><option value="weekly" ${mode==='weekly'?'selected':''}>週次入替</option><option value="fixed" ${mode==='fixed'?'selected':''}>固定保有</option></select></label><label>期間 <select data-period>${[['all','開始以来'],['30','直近1か月'],['90','直近3か月'],['180','直近6か月']].map(([v,t])=>`<option value="${v}" ${period===v?'selected':''}>${t}</option>`).join('')}</select></label></div>
   <p class="hint">${mode==='weekly'?'各週の最初の取引日の始値で、前日までに記録した最新リストに均等配分し直します。':'開始時の銘柄・株数を保有し続けます（株式分割・併合のみ反映）。'} 収益率の高い順。同率は同順位です。</p>
   <div class="stock-list-scroll"><table class="cmp-table"><thead><tr><th>一覧</th><th>順位</th><th>収益率</th><th>対TOPIX</th><th>最大下落率</th><th>費用</th><th>売買回数</th></tr></thead><tbody>${rows.map(r=>`<tr data-compare-source="${r.p.source}"><td>${esc(r.p.name)}</td><td>${r.rank??'—'}</td><td>${pct(r.m?.ret)}</td><td>${pct(r.m?.excess)}</td><td>${pct(r.m?.drawdown)}</td><td>${yen(r.m?.fees)}</td><td>${r.m?.trades??'—'}</td></tr>`).join('')}</tbody></table></div>
   ${!rows.some(r=>r.m)?'<p class="hint">開始待ち、または選択期間に必要な履歴が不足しています。0%の実績や順位は作りません。</p>':`<p class="hint">${rows.find(r=>r.m).m.baseDate} → ${rows.find(r=>r.m).m.date}。入替費用控除後・配当なし。売買回数は売買があった日数で、開始時購入も含みます。</p>`}
   <div class="cmp-box">${chart(rows)}</div>
   <details class="cmp-box"><summary>順位の推移（直近12評価日）</summary><div class="stock-list-scroll"><table class="cmp-table"><thead><tr><th>評価日</th>${Object.values({candidates:'候補',rebound:'反転',catalysts:'カタリスト',canslim:'CAN-SLIM'}).map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${recent.map((pt,i)=>{const rs=ranking(data,mode,period,end-recent.length+i);return `<tr><td>${pt.date}</td>${['candidates','rebound','catalysts','canslim'].map(s=>`<td>${rs.find(r=>r.p.source===s).rank??'—'}</td>`).join('')}</tr>`;}).join('')}</tbody></table></div></details>
   <details class="cmp-box"><summary>記録した候補リスト・仮想保有・入替履歴</summary>${rows.map(({p})=>{const l=data.lists.find(l=>l.source===p.source);return `<details><summary>${esc(p.name)}：${p.points.length?p.holdings.length+'銘柄を仮想保有':'開始待ち'}</summary><p class="hint">最新記録リスト：${l.date}基準・${l.count}銘柄。リストの日付と購入日は別です。</p><p>${(p.points.length?p.holdings:l.members).map(r=>`${esc(r.code)} ${esc(r.name)}${r.weight!==undefined?' '+(r.weight*100).toFixed(1)+'%':''}`).join(' ／ ')||'現金のみ'}</p><p class="hint">開始以来の売買金額 ${yen(p.turnover)} ／ 費用 ${yen(p.fees)}</p>${p.trades.map(t=>`<details><summary>${t.date} ${t.initial?'開始時購入':'配分更新'} ／ 費用 ${yen(t.fee)}</summary><p>追加：${esc(t.added.join('・')||'なし')}<br>除外：${esc(t.removed.join('・')||'なし')}<br>継続：${esc(t.continued.join('・')||'なし')}</p></details>`).join('')}
   <details><summary>銘柄別の価格変動による損益寄与（開始以来・費用前）</summary><ul>${p.contributions.map(c=>`<li>${esc(c.code)} ${esc(c.name)}：${yen(c.amount)}</li>`).join('')}</ul><p class="hint">費用は銘柄に配賦せず、上の一覧全体から控除しています。</p></details></details>`;}).join('')}</details>
   <details class="cmp-box"><summary>比較条件・更新方法</summary><p>各一覧に仮想${yen(data.config.capital)}。全銘柄へ同額配分、端株を許す理論上の比較です。上位銘柄の抜粋や実際の発注は行いません。</p><p>売買金額に片道${(data.config.fee*100).toFixed(2)}%の仮の費用を計上（手数料・スリッページの合算仮定）。実際の約定可能性・税・配当・信用取引・金利は反映していません。週次入替は構成が同じでも均等配分へ戻すため、その効果も含みます。</p><p>株式分割・併合は日次係数で株数を補正。欠損・売買停止・上場廃止等で評価できない時は全方式を同じ日で保留し、都合よく銘柄を除外しません。分割以外の企業行動は別途確認が必要です。</p><p>対TOPIXは配当なし価格指数との差。最大下落率は選択期間の日次終値ベースです。1・3・6か月は30・90・180日前以前の直近評価日から比較。銘柄数・業種・規模・リスクは4つで異なります。</p><p>PCで候補データを生成・公開した時に記録・評価します。画面の再読込だけで市場データを取得しません。条件は実験開始時に固定し、変更時は別実験にします。</p><p class="hint">実験ID：${esc(data.experiment)}<br>最初の記録：${esc(data.recorded_at)}<br>比較データ生成：${esc(data.generated_at)}</p></details>`;
   root.querySelector('[data-mode]').onchange=e=>{mode=e.target.value;draw();};root.querySelector('[data-period]').onchange=e=>{period=e.target.value;draw();};
  }
  draw();
 }catch(error){root.textContent='戦略比較を読み込めません。'+error.message+' 再読込してください。実際の運用記録は変更していません。';}
}
