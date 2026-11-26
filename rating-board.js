/* Price-based assessment board. Rendering only: never writes scores or entry rules. */
let ratingViewMode='groups', ratingHorizon='long', ratingBoardLayout='compact', ratingQuery='', ratingFilter='all';
const ratingAnchors={10:'例外的に条件が揃う',9:'最有力',8:'明確に魅力',7:'魅力・懸念あり',6:'やや魅力',5:'中立',4:'やや見送り',3:'見送り',2:'強く見送り',1:'避けたい'};
function boardAssessment(item,cross,ranking){
 const a=item.assessment||ratings[item.code];
 // Domestic scores use their own assessed price, not the cross-market comparison quote.
 return {code:item.code,name:item.name||a?.name||notes[item.code]?.name||item.code,
  short:cross?item.short:a?.short_3m,long:cross?item.long:a?.long_12m,
  close:a?.baseline_close??item.close,currency:a?.currency||item.currency||'JPY',
  priceDate:a?.baseline_price_date||(cross?ranking.priceDate:null),
  assessed:a?.assessment_date||(cross?ranking.date:null),confidence:a?.evidence_confidence||'未記録',
  reason:a?.long_reason||item.reason||'',shortReason:a?.short_reason||item.reason||'',
  counter:a?.change_conditions||notes[item.code]?.counter||'',rating:a,item};
}
function boardReview(row){
 const review=D.ratingContext?.companies?.[row.code]?.review;
 if(!review)return null;
 const b=review.basis;
 // A review applies only to the audited assessment; a new assessment is not silently quarantined.
 return b&&b.assessmentDate===row.assessed&&b.short===row.short&&b.long===row.long&&
  b.close===row.close&&b.priceDate===row.priceDate&&b.longReason===row.reason?review:null;
}
function boardRows(cross){
 const ranking=purchaseRankingSource(cross);
 return (ranking?.rows||[]).slice(0,rankingLimit).map(item=>boardAssessment(item,cross,ranking));
}
function boardGroups(rows,horizon){
 const groups=new Map(),review=[];
 for(const row of rows){
  if(boardReview(row)){review.push(row);continue;}
  const n=row[horizon],score=Number.isInteger(n)&&n>=1&&n<=10?n:null;
  if(!groups.has(score))groups.set(score,[]);
  groups.get(score).push(row);
 }
 const codeOrder=(a,b)=>String(a.code).localeCompare(String(b.code),'en',{numeric:true});
 return {review:review.sort(codeOrder),groups:[...groups].sort(([a],[b])=>(b??-1)-(a??-1)).map(([score,rows])=>({score,rows:rows.sort(codeOrder)}))};
}
function boardMoney(value,currency){return Number.isFinite(value)?new Intl.NumberFormat('ja-JP',{maximumFractionDigits:2}).format(value)+(currency==='JPY'?'円':' '+currency):'未記録';}
function boardProfile(row){return D.ratingContext?.companies?.[row.code];}
function boardPrices(row){
 const normal=priceCase(row.code,'normal'),weak=priceCase(row.code,'weak'),review=boardReview(row);
 const value=(x)=>x?esc(x.amount):'未算定';
 return `<div class="rb-prices" aria-label="条件付きの価値試算"><div><span>通常価値${review?' · 旧試算':normal?.reference?' · 参考':''}</span><b>${value(normal)}</b></div><div><span>弱気時の価値${review?' · 旧試算':weak?.reference?' · 参考':''}</span><b>${value(weak)}</b></div></div>
 <p class="rb-price-date">試算基準 ${esc(normal?.date||weak?.date||'未記録')} · 弱気価格は購入の必須条件ではありません</p>`;
}
function boardCard(row){
 const code=esc(row.code),profile=boardProfile(row),review=boardReview(row),h=ratingHorizon;
 const score=row[h],other=h==='long'?'short':'long',primary=h==='long'?'12か月':'3か月',secondary=h==='long'?'3か月':'12か月';
 const risk=profile?.risk||row.counter||'リスクの記録を確認できません。';
 const reason=review?review.reason:(h==='long'?row.reason:row.shortReason);
 const detail=D.purchasePriority?.rows?.[row.code];
 const knownType=profile?.type||'特性は未分類';
 const next=profile?.next||row.counter||'見直す条件は未記録です。';
 return `<article class="rb-card${review?' rb-under-review':''}" data-rating-code="${code}">
 <div class="rb-card-top"><span class="rb-code">${code}</span><span class="rb-type">${esc(knownType)}</span></div>
 <div class="rb-company-line"><h3><button type="button" class="open" data-company="${code}">${esc(row.name)}</button></h3><div class="rb-score" aria-label="${review?'旧評価 ':''}${primary} ${esc(score??'未採点')}点"><span>${review?'旧評価 · ':''}${primary}</span><strong>${esc(score??'—')}<small>/10</small></strong></div></div>
 ${review?'<div class="rb-review-label">評価点検中</div>':''}
 <div class="rb-baseline"><span>${review?'保存基準株価':'評価に使った株価'}</span><b>${esc(boardMoney(row.close,row.currency))}</b><time>${esc(row.priceDate||'日付未記録')}</time></div>
 <p class="rb-reason">${esc(reason||'評価理由は未記録です。')}</p>
 <div class="rb-meta"><span>${secondary} <b>${esc(row[other]??'—')}</b>/10</span><span>根拠：${esc(row.confidence)}</span></div>
 ${ratingBoardLayout==='compact'?'':boardPrices(row)}
 <div class="rb-risk"><span>外れる条件・リスク</span><p>${esc(risk)}</p></div>
 <details class="rb-detail"><summary>評価の根拠と見直す条件</summary>
  <p><b>3か月</b> ${esc(row.shortReason||'未記録')}</p><p><b>12か月</b> ${esc(row.reason||'未記録')}</p>
  <p><b>外れる条件・リスク</b> ${esc(risk)}</p><p><b>次の点検</b> ${esc(next)}</p>
  ${profile?`<p><b>相場との関係</b> ${esc(profile.regime)}</p><p class="rb-date">特性の試分類 ${esc(D.ratingContext.date)} · 安全性の点数ではありません</p>`:''}
  ${review?`<p><b>点検を終える条件</b> ${esc(review.resolve)}</p>`:''}
  ${notes[row.code]?earningsDates(notes[row.code]):''}
 </details>
 <details class="rb-detail"><summary>価格シナリオ・過去の購入条件</summary>
  <p>保存された条件の参考資料です。この条件で点数を再度下げたり、購入まで待つ必要があると判定したりしません。</p>
  ${priceOverview(row.code,true)}
  ${detail?`<p><b>以前の確認条件</b> ${esc(detail.check)}</p>`:''}
 </details>
 <footer class="rb-date">採点 ${esc(row.assessed||'未記録')} · 保存評価</footer></article>`;
}
function boardLineTable(rows,label){
 const periods=ratingHorizon==='short'?[['short','3か月'],['long','12か月']]:[['long','12か月'],['short','3か月']];
 return `<div class="line-table-scroll rating-line-scroll" role="region" aria-label="${esc(label)}の1行一覧" tabindex="0"><table class="line-table rating-line-table"><colgroup><col class="rating-col-code"><col class="rating-col-name"><col class="rating-col-score"><col class="rating-col-score"><col class="rating-col-price"><col class="rating-col-date"><col class="rating-col-date"><col class="rating-col-state"></colgroup><thead><tr><th scope="col">コード</th><th scope="col">銘柄名</th>${periods.map(([,name])=>`<th scope="col">${name}</th>`).join('')}<th scope="col">基準株価</th><th scope="col">価格日</th><th scope="col">採点日</th><th scope="col">評価状態</th></tr></thead><tbody>${rows.map(row=>`<tr data-rating-code="${esc(row.code)}"><td>${esc(row.code)}</td><td><button class="open" data-company="${esc(row.code)}" title="${esc(row.name)}">${esc(row.name)}</button></td>${periods.map(([key],i)=>`<td class="line-number${i===0?' line-selected':''}">${esc(row[key]??'—')}</td>`).join('')}<td class="line-number">${esc(boardMoney(row.close,row.currency))}</td><td>${esc(row.priceDate||'未記録')}</td><td>${esc(row.assessed||'未記録')}</td><td>${boardReview(row)?'<span class="line-review">旧評価・点検中</span>':'保存評価'}</td></tr>`).join('')}</tbody></table></div>`;
}

function boardCompareBody(rows){
 if(rows.length!==2||rows[0].code===rows[1].code)return '<p role="status">異なる2社を選んでください。</p>';
 const period=ratingHorizon==='long'?'12か月':'3か月';
 if(rows.some(r=>boardReview(r))||!Number.isInteger(rows[0][ratingHorizon])||rows[0][ratingHorizon]!==rows[1][ratingHorizon])return '<p role="status">同じ期間・同じ点数の採点済み銘柄を選んでください。</p>';
 const sameDate=rows.every(r=>r.priceDate)&&rows[0].priceDate===rows[1].priceDate;
 const textCell=value=>{const text=typeof value==='string'?value.trim():'';return !text?'<span class="rb-unknown">未記録・比較未判定</span>':text.length>180?`<p>${esc(text.slice(0,180))}…</p><details><summary>根拠の全文</summary><p>${esc(text)}</p></details>`:`<p>${esc(text)}</p>`;};
 const field=(label,fn)=>`<tr><th scope="row">${label}</th>${rows.map(r=>`<td>${fn(r)}</td>`).join('')}</tr>`;
 const profile=r=>boardProfile(r)||{};
 return `<p class="rb-compare-notice" role="status">${sameDate?'価格日は一致しています。資料と採点日は下欄で確認してください。':'価格日が異なる、または未記録です。同条件の比較には価格の確認が必要です。'}</p>
 <p class="rb-compare-guide">利益の伸びを選ぶなら「利益・倍率の前提」、損失への耐性なら「リスク」、分散なら「需要・相場との関係」を比べてください。根拠が未記録の項目では優劣を判定できません。</p>
 <div class="rb-compare-scroll" role="region" aria-label="同点2社の比較表" tabindex="0"><table class="rb-compare-table"><thead><tr><th scope="col">選び分ける視点</th>${rows.map(r=>`<th scope="col"><a href="#company/${encodeURIComponent(r.code)}">${esc(r.name)}</a><small>${esc(r.code)} · ${period} ${esc(r[ratingHorizon])}点</small></th>`).join('')}</tr></thead><tbody>
 ${field('優先候補にする根拠<br><small>保存評価の理由</small>',r=>textCell(ratingHorizon==='long'?r.reason:r.shortReason))}
 ${field('利益・倍率の前提',r=>textCell(notes[r.code]?.valuation))}
 ${field('根拠の確かさ',r=>textCell(r.confidence))}
 ${field('優先しにくい理由・リスク',r=>textCell(profile(r).risk||r.counter))}
 ${field('需要・相場との関係',r=>textCell([profile(r).type,profile(r).regime].filter(Boolean).join('。')))}
 ${field('次に確認する条件',r=>textCell(profile(r).next||r.counter))}
 ${field('比較の基準',r=>`<p>${esc(boardMoney(r.close,r.currency))}<br>価格日 ${esc(r.priceDate||'未記録')}<br>採点日 ${esc(r.assessed||'未記録')}<br>研究更新 ${esc(notes[r.code]?.updated||'未記録')}</p>`)}
 ${field('原文・出典',r=>`<a href="#company/${encodeURIComponent(r.code)}">会社の調査・出典を読む</a>`)}
 </tbody></table></div><p class="rb-compare-foot">左右の順番は優先順位ではありません。保有との重なりは、現在の保有比率と共通の需要を別途確認してください。この表だけで購入配分は決まりません。</p>`;
}
function boardComparePanel(rows,score){
 if(score==null||rows.length<2)return '';
 const option=(row,selected)=>`<option value="${esc(row.code)}" ${selected?'selected':''}>${esc(row.code)} ${esc(row.name)}</option>`;
 return `<details class="rb-compare" data-compare-score="${score}"><summary>同点の2社を比較する<span>違いと優先する根拠</span></summary><div class="rb-compare-pickers">${[0,1].map(i=>`<label>銘柄${i===0?'A':'B'}<select data-compare-slot="${i}" aria-label="比較する銘柄${i===0?'A':'B'}">${rows.map((r,j)=>option(r,j===i)).join('')}</select></label>`).join('')}</div><div class="rb-compare-body">${boardCompareBody(rows.slice(0,2))}</div></details>`;
}

function renderBoardResults(){
 const root=document.getElementById('rb-results');if(!root)return;
 const cross=rankingMarket==='cross',allRows=boardRows(cross),q=ratingQuery.normalize('NFKC').toLowerCase().trim();
 const rows=allRows.filter(row=>(!q||(row.code+' '+row.name).normalize('NFKC').toLowerCase().includes(q))&&
  (ratingFilter==='all'||(ratingFilter==='review'?!!boardReview(row):!boardReview(row)&&String(row[ratingHorizon])===ratingFilter)));
 const {groups,review}=boardGroups(rows,ratingHorizon),period=ratingHorizon==='long'?'12か月':'3か月';
 document.getElementById('rb-result-count').textContent=`${rows.length} / ${allRows.length}社`;
 const section=(label,list,score)=>`<section class="rb-group" aria-label="${esc(label)}"><div class="rb-group-heading"><h2>${esc(label)}</h2><span>${list.length}社${score!=null?' · '+esc(ratingAnchors[score]||''):''}</span></div>${boardComparePanel(list,score)}${ratingBoardLayout==='compact'?boardLineTable(list,label):`<div class="rb-grid">${list.map(boardCard).join('')}</div>`}</section>`;
 root.innerHTML=(review.length?section('評価を点検している銘柄',review,null):'')+groups.map(g=>section(g.score==null?'未採点':`${period} ${g.score}点`,g.rows,g.score)).join('')||'<p class="empty">条件に合う銘柄がありません。検索や絞り込みを変更してください。</p>';
 for(const panel of root.querySelectorAll('[data-compare-score]')){
  panel.addEventListener('change',()=>{
   const selected=[...panel.querySelectorAll('[data-compare-slot]')].map(el=>rows.find(r=>r.code===el.value)).filter(Boolean);
   panel.querySelector('.rb-compare-body').innerHTML=boardCompareBody(selected);
  });
 }
}
function purchaseRanking(){
 if(ratingViewMode==='legacy'){legacyPurchaseRanking();return;}
 priorView='ranking/ranking';
 const rows=boardRows(rankingMarket==='cross'),groups=boardGroups(rows,ratingHorizon);
 const controls=(label,attr,current,choices)=>`<div class="rb-segment" role="group" aria-label="${label}">${choices.map(([key,text])=>`<button type="button" ${attr}="${key}" aria-pressed="${key===current}">${text}</button>`).join('')}</div>`;
 const scored=groups.groups.filter(g=>g.score!=null),profiles=rows.filter(row=>boardProfile(row)).length;
 app.innerHTML=`<section class="rb-board" aria-label="投資妙味の評価グループ">
 <div class="rb-heading"><div><div class="rb-kicker">INVESTMENT VIEW <span>試用版</span></div><h1>価格から、投資妙味を見る。</h1><p>評価とリスクを並べて、納得できる銘柄を探す。</p></div><button type="button" class="rb-legacy" id="rb-legacy">従来の順位</button></div>
 <div class="rb-intro"><p>点数は各銘柄の基準株価での評価です。購入待ちによる並べ替えは行いません。</p><details><summary>評価の読み方</summary><p>同点内はコード順で、優劣はありません。保存済みの点数を使う表示の試用であり、今日の株価で全社を再採点したものではありません。各カードの価格日を確認してください。</p><p>需要の安定と株価の安全性は別です。相場局面は利益と評価倍率を点検するために使い、一律に点数を加減しません。現在の局面判定は未実施です。特性の試分類は${profiles}社、残りは未分類です。</p></details></div>
 <div class="rb-toolbar"><div class="rb-controls">${controls('対象市場','data-rb-market',rankingMarket,[['domestic','日本株'],['cross','日米欧']])}${controls('評価の期間','data-rb-horizon',ratingHorizon,[['long','12か月'],['short','3か月']])}${controls('表示形式','data-rb-layout',ratingBoardLayout,[['cards','カード'],['compact','1行一覧']])}</div>
 <div class="rb-search-row"><label class="rb-search"><span>銘柄を探す</span><input id="rb-search" type="search" placeholder="会社名・コード" value="${esc(ratingQuery)}" autocomplete="off"></label><label class="rb-filter"><span>評価で絞る</span><select id="rb-filter"><option value="all">すべての評価</option>${scored.map(g=>`<option value="${g.score}" ${ratingFilter===String(g.score)?'selected':''}>${g.score}点 · ${g.rows.length}社</option>`).join('')}<option value="review" ${ratingFilter==='review'?'selected':''}>評価点検中</option></select></label></div></div>
 <div class="rb-results-heading"><span>同点は同じ評価グループ</span><span id="rb-result-count" role="status" aria-live="polite"></span></div><div id="rb-results"></div></section>`;
 document.getElementById('rb-legacy').onclick=()=>{ratingViewMode='legacy';route();};
 for(const b of app.querySelectorAll('[data-rb-market],[data-rb-horizon],[data-rb-layout]'))b.onclick=()=>{
  let attr;if(b.dataset.rbMarket){rankingMarket=b.dataset.rbMarket;ratingFilter='all';attr='data-rb-market';}
  else if(b.dataset.rbHorizon){ratingHorizon=b.dataset.rbHorizon;ratingFilter='all';attr='data-rb-horizon';}
  else{ratingBoardLayout=b.dataset.rbLayout;attr='data-rb-layout';}
  route();app.querySelector(`[${attr}][aria-pressed="true"]`)?.focus({preventScroll:true});
 };
 document.getElementById('rb-search').oninput=e=>{ratingQuery=e.target.value;renderBoardResults();};
 document.getElementById('rb-filter').onchange=e=>{ratingFilter=e.target.value;renderBoardResults();};
 renderBoardResults();
 if(!rows.length)document.getElementById('rb-results').innerHTML='<p class="empty">研究データがまだ読み込まれていません。</p><button type="button" class="action" id="rb-sync">研究データを同期</button>';
 document.getElementById('rb-sync')?.addEventListener('click',()=>document.getElementById('workspace-sync')?.click());
}
