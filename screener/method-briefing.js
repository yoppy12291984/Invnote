/* Public observations only. Selection here is a reading order, never a trading rule. */
(function(root){
 const iso=x=>/^\d{8}$/.test(String(x))?`${x.slice(0,4)}-${x.slice(4,6)}-${x.slice(6)}`:String(x||'');
 const esc=x=>String(x??'未確認').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=x=>typeof x==='number'&&Number.isFinite(x)?String(Math.round(x*100)/100):'未確認';
 function bottom(r,crossing){
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  let state='判定材料不足',tone='muted';
  if(finite(r.ma50)&&finite(r.ma200)){
   if(crossing==='200日線の下へ'||r.ma50<0){state='反発の失速に注意';tone='caution';}
   else if(r.ma50>0&&r.ma200>0){state='反発の兆候あり・底固めは未確認';tone='positive';}
   else if(r.ma50>0){state='短期反発・長期の回復待ち';tone='watch';}
   else{state='移動平均線付近・方向待ち';tone='watch';}
  }
  return {state,tone,evidence:`50日線比 ${num(r.ma50)}%、200日線比 ${num(r.ma200)}%。${crossing?`前回比較：${crossing}。`:''}`,missing:'安値の切り上げ・底固めの期間・反発時の出来高は、この一覧データでは未確認。',next:'日足で安値の切り上げと直近戻り高値の突破、上昇時の出来高を確認。直近安値の更新なら底打ち仮説を見直す。'};
 }
 function build(kind,data,diff,today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})){
  const date=iso(data.date), monthly=kind==='candidates';
  const age=(Date.parse(today)-Date.parse(date))/86400000;
  const stale=!Number.isFinite(age)||age<0||(monthly?date.slice(0,7)!==today.slice(0,7):age>7);
  const rows=[...new Map((data.items||[]).map(r=>[String(r.code),r])).values()];
  const added=new Set((diff?.added||[]).map(r=>String(r.key)));
  const result={date,stale,monthly,headline:'',action:'',cards:[],selection:'',change:diff?.comparison?`${iso(diff.previous_date)} → ${date}：追加${diff.added.length}・除外${diff.removed.length}・変更${diff.changed.length}銘柄`:'前回との比較は未確認です。',notice:stale?'更新待ち：以下は保存済みデータの注目点です。現在の株価・開示を確認してから判断してください。':''};
  const card=(r,why,next,risk)=>({code:String(r.code),name:r.name,why,next,risk});
  if(kind==='rebound'){
   const crosses=diff?.comparison?(diff.crossings||[]):[];
   const up=crosses.filter(x=>x.direction==='200日線の上へ'),down=crosses.filter(x=>x.direction==='200日線の下へ');
   result.headline=up.length?`${up[0].name}など${up.length}社、200日線の上へ`:'新規候補の反発が続くかを確認';
   result.action='まず200日線との位置が変わった銘柄を確認。直近チャートで反発の継続と出来高を確かめる。';
   const selected=[...up.slice(0,2),...down.slice(0,1)].map(x=>({r:rows.find(r=>String(r.code)===String(x.key)),x})).filter(x=>x.r);
   result.cards=selected.map(({r,x})=>card(r,`${x.direction}。基準日時点の200日線比 ${num(r.ma200)}%、50日線比 ${num(r.ma50)}%。`,x.direction.includes('上')?'200日線の上を維持できるか、上昇時の出来高と直近決算を確認。':'200日線を回復できるかを確認。反発が崩れていないか先に点検。','2時点の比較です。途中の通過日や反発の持続は未確認。'));
   if(!result.cards.length)result.cards=rows.filter(r=>added.has(String(r.code))).slice(0,2).map(r=>card(r,'比較元から新しく抽出一覧に入りました。','下落の原因・直近決算と、反発時の出来高を確認。','一覧への追加だけでは底打ちを確認できません。'));
   if(!result.cards.length)result.cards=rows.slice(0,2).map(r=>card(r,'継続候補の反発状況を点検。','直近の日足と決算を確認。','新たな底打ちを確認したという意味ではありません。'));
   for(const c of result.cards){c.bottom=bottom(rows.find(r=>String(r.code)===c.code),crosses.find(x=>String(x.key)===c.code)?.direction);c.next=c.bottom.next;}
   result.bottomGuide='底打ちチェック：移動平均線との位置から反発の兆候を整理します。底固めの確認には日足・出来高が必要で、底打ち確定とは表示しません。';
   result.selection='表示順：200日線の上への変化を2社、下への変化を1社。変化がなければ新規追加から2社、それもなければ既存一覧の先頭2社。';
  }else if(kind==='canslim'){
   const strict=(data.items||[]).filter(r=>r.bucket==='厳密');
   result.headline=strict.length?'厳密条件の候補を優先確認':'厳密条件は0件。ブレイクを待って確認';
   result.action='候補入りと買うタイミングを分ける。ピボット突破・出来高・決算日を確認する。';
   const order=['厳密','柔軟','S2初期'];
   const pool=[...(data.items||[])].sort((a,b)=>order.indexOf(a.bucket)-order.indexOf(b.bucket)||(added.has(String(b.code))-added.has(String(a.code)))||(a.rank??999)-(b.rank??999));
   result.cards=[...new Map(pool.map(r=>[String(r.code),pool.find(x=>String(x.code)===String(r.code))])).values()].slice(0,2).map(r=>card(r,`${r.bucket}候補${added.has(String(r.code))?'に新規追加':''}。株価 ${num(r.price)}円、ピボット ${num(r.pivot)}円（差 ${num(r.pivot_gap)}%）。`,'最新チャートでピボット突破と出来高を照合。次の決算日も確認。',r.warn||'基準日時点の候補です。ピボットや株価は最新値ではありません。'));
   result.selection='表示順：厳密→柔軟→S2初期。同区分では新規追加、続いて既存の表示順位。';
  }else if(kind==='candidates'){
   const changes=diff?.comparison?(diff.added.length+diff.removed.length+diff.changed.length):null;
   result.headline=changes===0?'前回との変更なし。次の月次抽出を待つ':'月次の入れ替わりと資産の中身を確認';
   result.action='月次で候補の入れ替わりを確認。気になる会社は、現金・有価証券・負債と直近決算を読む。';
   result.cards=rows.filter(r=>added.has(String(r.code))).slice(0,2).map(r=>card(r,`月次一覧に新規追加。NC比率 ${num(r.nc)}、PBR ${num(r.pbr)}倍。`,'換金性・負債・赤字による資産流出を一次資料で確認。','低PBR・高NCだけで購入判断はしません。'));
   result.selection='新規追加がある場合だけ先頭2社を表示。変更のない月に注目銘柄を無理に作りません。';
  }else if(kind==='catalysts'){
   const changed=new Set((diff?.changed||[]).filter(r=>r.changes.some(c=>['仮説','次の確認','懸念・反証','状態'].includes(c.field))).map(r=>String(r.key)));
   const pool=[...rows].sort((a,b)=>(changed.has(String(b.code))-changed.has(String(a.code)))||(a.rank??999)-(b.rank??999));
   result.headline=changed.size?'仮説が変わった会社から確認':'仮説の続報待ち。次の決算で確かめる';
   result.action='期待した材料が利益に届くかを確認。好材料だけでなく、仮説を見直す条件も一緒に読む。';
   result.cards=pool.slice(0,2).map(r=>card(r,r.thesis,r.next_check,r.risk));
   result.selection='仮説・確認材料の変更を優先し、次に既存の調査優先度を使用。買い順位ではありません。';
  }
  if(!diff?.comparison&&['candidates','catalysts'].includes(kind))result.headline='前回比較は未確認。保存済み候補の確認から';
  if(!rows.length){result.headline='候補データがありません';result.action='データ更新後に注目点を表示します。';result.cards=[];}
  return result;
 }
 function render(kind,data,diff){
  const b=build(kind,data,diff);
  return `<section class="method-brief" aria-label="今回の注目点"><p class="brief-kicker">${b.monthly?'MONTHLY':'WEEKLY'} FOCUS · ${esc(b.date)}</p><h3>${esc(b.headline)}</h3>${b.notice?`<p class="brief-warning">${esc(b.notice)}</p>`:''}<p>${esc(b.action)}</p><p class="brief-period">${esc(b.change)}</p>${b.bottomGuide?`<p class="brief-period">${esc(b.bottomGuide)}</p>`:''}${b.cards.map(c=>`<article class="brief-stock"><h4>${esc(c.name)} <small>${esc(c.code)}</small></h4>${c.bottom?`<div class="brief-bottom" data-state="${esc(c.bottom.tone)}"><b>底打ちの見方：${esc(c.bottom.state)}</b><p>${esc(c.bottom.missing)}</p></div>`:''}<p><b>注目理由</b> ${esc(c.why)}</p><p class="brief-next"><b>次に見る</b> ${esc(c.next)}</p><details><summary>見直す条件・注意点</summary><p>${esc(c.risk)}</p></details></article>`).join('')}<details class="brief-period"><summary>注目点の選び方</summary><p>${esc(b.selection)} 既存データからの要約で、新たな決算精査や売買指示ではありません。</p></details></section>`;
 }
 if(typeof module!=='undefined')module.exports={build,render,bottom};
 else root.MethodBriefing={build,render};
})(globalThis);
