/* Presentation and transient search only; source records and rankings stay intact. */
(()=>{
 const notes={cand:'銘柄をタップして詳細と色分けを確認。見出しで並べ替えできます。',cs:'銘柄をタップして条件を確認。見出しで並べ替えできます。',catalyst:'構造変化と次の確認材料を追う一覧です。優先度は調査の順番です。',ideal:'銘柄をタップして配分を編集。運用資金は一覧の下にあります。',hold:'保有の確認と、取引を記録した運用成績を見られます。',theme:'テーマをタップして背景・主導銘柄・ニュースを確認できます。',macro:'金利・信用・景気をあわせて確認。指標ごとの観測日にも注目してください。',radar:'気になる動きを確認し、銘柄ごとの材料を調べる入口です。',rec:'これまでの記録と検証結果を振り返るページです。',status:'戦略ごとの検証結果を確認。実際の口座成績とは区別して見てください。'};
 const searchable={cand:['#candBody tr.r','.nm','銘柄名・コード'],reb:['#rebBody tr.r','.nm','銘柄名・コード'],catalyst:['#catalystCards>.stk','.cat-name','銘柄名・コード'],theme:['article.stk','.theme-title','テーマ名']};
 const style=document.createElement('style');style.textContent=`
 .page-guide{border-left:3px solid var(--amb)}
 .quick-find{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:10px 0}
 .quick-find input{flex:1;min-width:100px;width:140px;font:inherit;font-size:16px;color:var(--ink);background:var(--sur);border:1px solid var(--line);border-radius:6px;padding:6px 8px}
 .quick-find .chip{font-size:12px;padding:5px 8px}.quick-find output{font-size:12px;color:var(--mut)}
 .search-excluded{display:none!important}
 #tabs .on{border-bottom-color:var(--amb)}
 button:focus-visible,a:focus-visible,summary:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--amb);outline-offset:2px}
 #theme .theme-controls .chip{font-size:12px;min-height:28px;padding:3px 8px}
 `;document.head.append(style);
 for(const section of document.querySelectorAll('#app>section')){
   const id=section.id,config=searchable[id];let query='',guide,bar,input,count;
   if(notes[id]){guide=document.createElement('p');guide.className='warn-note page-guide';guide.textContent=notes[id];}
   if(config){bar=document.createElement('div');bar.className='quick-find';input=document.createElement('input');input.type='search';input.placeholder=config[2]+'で検索';input.setAttribute('aria-label',input.placeholder);input.autocomplete='off';const clear=document.createElement('button');clear.type='button';clear.className='chip';clear.textContent='クリア';count=document.createElement('output');count.setAttribute('aria-live','polite');bar.append(input,clear,count);input.addEventListener('input',()=>{query=input.value;apply()});clear.onclick=()=>{query='';input.value='';apply();input.focus()};}
   const normalize=x=>x.normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g,'');
   function apply(){
     if(guide&&!section.contains(guide))section.prepend(guide);
     if(bar&&!section.contains(bar)){const intro=guide||section.querySelector('#rebNote');if(intro)intro.after(bar);else section.prepend(bar);}
     if(!config)return;
     const rows=[...section.querySelectorAll(config[0])],q=normalize(query);let visible=0;
     for(const row of rows){const match=normalize((row.querySelector(config[1])||row).textContent).includes(q);row.classList.toggle('search-excluded',!match);if(match)visible++;if(row.nextElementSibling?.matches('tr.detail'))row.nextElementSibling.classList.toggle('search-excluded',!match);}
     const text=q?(visible?visible+' / '+rows.length+'件':'該当なし（クリアで戻る）'):rows.length+'件';if(count.textContent!==text)count.textContent=text;
   }
   new MutationObserver(apply).observe(section,{childList:true,subtree:true});apply();
 }
})();
