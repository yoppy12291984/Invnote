/* Shared publication-to-publication changes. Never uses personal holdings. */
(()=>{
 const tabs={cand:['candidates','候補'],reb:['rebound','反転'],cs:['canslim','CAN-SLIM'],theme:['themes','テーマ'],radar:['radar','レーダー'],macro:['macro','マクロ'],catalyst:['catalysts','カタリスト']};
 const esc=x=>String(x??'未確認').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const val=x=>x==null?'未確認':Array.isArray(x)?x.map(v=>typeof v==='object'?JSON.stringify(v):v).join(' / '):typeof x==='object'?JSON.stringify(x):String(x);
 const date=x=>/^\d{8}$/.test(x||'')?`${x.slice(0,4)}-${x.slice(4,6)}-${x.slice(6)}`:x||'不明';
 const label=r=>`${/^\w{4,5}$/.test(r.key)?r.key+' ':''}${r.name}`;
 const list=(title,rows,changes=false)=>!rows.length?'':`<details><summary>${esc(title)} ${rows.length}件</summary><ul>${rows.map(r=>`<li><b>${esc(label(r))}</b>${changes?`<ul>${r.changes.map(c=>`<li>${esc(c.field)}：<span class="upd-before">${esc(val(c.before))}</span> → <strong>${esc(val(c.after))}</strong></li>`).join('')}</ul>`:''}</li>`).join('')}</ul></details>`;
 const css=document.createElement('style');css.textContent=`.update-digest{margin:10px 0 14px;padding:12px;border:1px solid var(--line);border-left:3px solid var(--accent,var(--amb));border-radius:8px;background:var(--sur);font-size:13px;line-height:1.65;overflow-wrap:anywhere}.update-digest p{margin:5px 0}.update-digest .upd-meta,.upd-before{color:var(--mut)}.update-digest details{margin-top:7px}.update-digest summary{cursor:pointer;font-weight:600}.update-digest ul{padding-left:20px}.update-digest li{margin:5px 0}.update-digest strong{font-weight:600}.update-digest .upd-totals{font-size:14px;font-weight:600}.update-digest .upd-foot{font-size:12px;color:var(--mut)}`;document.head.append(css);
 function mount(id,html,entry){
   const section=document.getElementById(id);if(!section)return;
   const box=document.createElement('aside');box.className='update-digest';box.setAttribute('aria-label','前回からの更新');box.innerHTML=html;
   const added=new Set((entry?.added||[]).map(r=>r.key));
   const attach=()=>{if(!section.contains(box)){const guide=section.querySelector('.page-guide');if(guide&&!['theme','macro','radar'].includes(id))guide.after(box);else section.prepend(box);}for(const row of section.querySelectorAll('tr.r[data-code]')){if(added.has(row.dataset.code)&&!row.querySelector('.upd-new')){const b=document.createElement('span');b.className='upd-new';b.textContent='追加';b.title='表示した比較元から新しく一覧に入った銘柄';b.style.cssText='font-size:10px;display:inline-block;margin-left:5px;padding:0 4px;border:1px solid currentColor;border-radius:3px;font-weight:400';row.querySelector('.nm b')?.append(b);}}};
   new MutationObserver(attach).observe(section,{childList:true,subtree:true});attach();
 }
 function render(n,x){
   const compact=['candidates','catalysts','rebound','canslim'].includes(n);
   let lead='';
   if(x.comparison&&n==='themes'){
     const same=JSON.stringify(x.current_topics)===JSON.stringify(x.previous_topics);
     lead=same?'<p>前回からテーマの構成・解説に変更はありません。</p>':`<div class="upd-lead"><p><b>前回 → 今回のテーマ</b></p><p class="upd-before">前回：${esc(x.previous_topics.map(r=>r.name).join(' ／ '))}</p><ul>${x.current_topics.map(r=>`<li><b>今回：${esc(r.name)}</b><br>${esc(val(r.fields.summary||r.fields.stage))}</li>`).join('')}</ul></div>`;
   }
   if(x.comparison&&n==='macro'){
     const values=x.changed.flatMap(r=>r.changes.filter(c=>c.field==='観測値').map(c=>({r,c})));
     lead=`<div class="upd-lead"><p><b>${values.length?'前回取得時からの指標変化':'前回取得時から観測値の変更なし'}</b></p><ul>${values.map(({r,c})=>{const units={VIXCLS:'pt',SP500:'pt',DEXJPUS:'円'};const unit=units[r.key]||'%';const delta=typeof c.before==='number'&&typeof c.after==='number'?c.after-c.before:null;return `<li>${esc(r.name)}：<b>${esc(val(c.before))} → ${esc(val(c.after))}${unit}</b>${delta!==null?`（${delta>0?'+':''}${Number(delta.toFixed(3))}${unit==='%'?'%pt':unit}）`:''}</li>`}).join('')}</ul>${x.changed.length>values.length?'<p class="upd-foot">観測日・取得状態だけが変わった指標もあります。詳細は下で確認できます。</p>':''}</div>`;
   }
   if(x.comparison&&n==='radar')lead=`<div class="upd-lead"><p><b>銘柄の入れ替わり：追加${x.added.length}・除外${x.removed.length}</b></p>${x.added.length?`<p>追加例：${esc(x.added.slice(0,5).map(label).join(' ／ '))}${x.added.length>5?' ほか':''}</p>`:''}<p><b>ニュースの新出語</b>：${x.new_words?.length?esc(x.new_words.join(' ／ ')):'なし'}</p><p class="upd-foot">新出語は収集記事の変化です。無関係な記事や表記揺れを含みます。</p></div>`;
   let out=compact
     ?`<details class="upd-disclosure" style="margin-top:0"><summary><b>今回の更新</b><span class="upd-meta" style="display:block;font-weight:400">データ基準：${esc(date(x.date))}</span></summary><div class="upd-content">${x.comparison?`<p class="upd-meta">比較元：${esc(date(x.previous_date))}（${esc(x.previous_label)}）</p>`:''}`
     :`<b>今回の更新</b>${lead}<p class="upd-meta">${n==='macro'?'データ生成':'データ基準'}：${esc(date(x.date))}${x.comparison?`<br>比較元：${esc(date(x.previous_date))}（${esc(x.previous_label)}）`:''}</p>`;
   if(!x.comparison)out+='<p>前回の比較データがありません。今回を基準に、次の公開更新から差分を表示します。</p>';
   else if(n==='themes'){
     const same=JSON.stringify(x.current_topics)===JSON.stringify(x.previous_topics);
     out+=`<p class="upd-totals">${same?'解説・構成の変更なし':'テーマの構成・解説を更新'}</p><p class="upd-foot">塊は毎回組み直すため、番号が同じでも同じテーマとは限りません。</p>`;
     const topics=(title,rows)=>`<details><summary>${title} ${rows.length}テーマ</summary><ul>${rows.map(r=>`<li><b>${esc(r.name)}</b><p>${esc(val(r.fields.summary||r.fields.stage))}</p><p class="upd-foot">注意点：${esc(val(r.fields.caution))}</p></li>`).join('')}</ul></details>`;
     out+=topics('今回の解説',x.current_topics)+topics('前回の解説',x.previous_topics);
   }else{
     const total=x.added.length+x.removed.length+x.changed.length;
     out+=`<p class="upd-totals">${total?`追加 ${x.added.length} ／ 一覧から外れた ${x.removed.length} ／ 変更 ${x.changed.length}`:'比較対象の変更なし'}</p>`;
     out+=list('新しく一覧に入った項目',x.added)+list('一覧から外れた項目',x.removed)+list(n==='catalysts'?'仮説・確認材料などの変更':'数値・区分などの変更',x.changed,true);
   }
   if(n==='radar'&&x.new_words?.length)out+=`<details><summary>ニュースに新しく現れた語 ${x.new_words.length}件</summary><p>${esc(x.new_words.join(' ／ '))}</p><p class="upd-foot">既存レーダーが前回収集と比較した語です。無関係な記事や表記の揺れも含み、業績への影響を確認済みという意味ではありません。</p></details>`;
   if(x.crossings?.length)out+=`<details><summary>200日線の上下が変わった銘柄 ${x.crossings.length}件</summary><ul>${x.crossings.map(r=>`<li>${esc(label(r))}：${esc(r.direction)}</li>`).join('')}</ul><p class="upd-foot">2つの基準日の比較です。途中の通過日や、その間の往復は分かりません。</p></details>`;
   out+='<details class="upd-foot"><summary>比較の読み方</summary><p>前回の閲覧ではなく、表示した比較元との差分です。追加・除外は買い・売りの記録ではありません。数値や文章の更新だけで、新しい投資判断が確定したとは扱いません。CAN-SLIMは区分をまたぐ重複を除いた銘柄数です。</p></details>';
   if(n==='candidates')out+='<p class="upd-foot">候補の再抽出は月次処理。週次で株価データを取得しても、この一覧は自動再抽出されません。</p>';
   return out+(compact?'</div></details>':'');
 }
 async function run(){
   let data;try{const r=await fetch('data/updates.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error();data=await r.json();}catch{for(const id of Object.keys(tabs))mount(id,'<b>今回の更新</b><p>比較情報を読み込めません。差分は未確認です。</p>');return;}
   await Promise.all(Object.entries(tabs).map(async([id,[name]])=>{
     const entry=data.sources?.[name];let valid=false;
     try{const r=await fetch(`data/${name}.json?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw Error();const hash=await crypto.subtle.digest('SHA-256',await r.arrayBuffer());valid=entry?.hash===[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}catch{}
     mount(id,valid?render(name,entry):'<b>今回の更新</b><p>現在のデータと比較情報が揃っていません。公開更新中、または比較情報が未取得です。時間を置いて再読込してください。</p>',valid?entry:null);
   }));
 }
 run();
})();
