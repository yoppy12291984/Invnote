export function mount(root){
 if(root.dataset.mounted)return;root.dataset.mounted='1';
 root.innerHTML=`<div style="padding:10px 0;line-height:1.7"><strong>投資調査</strong> · 候補の発見から反証・購入検討・継続確認まで
 <details><summary>保存・試作からの引継ぎについて</summary><p>公開調査・変更履歴は自動更新します。個人条件・判断と詳細欄の変更はこのブラウザー内に自動保存します。サーバーへ投資額やメモを送信しません。</p><p>ローカル試作や別端末の記録は、元の画面で「調査記録を書き出す」→この画面で「記録を読み込む」→内容を確認してください。個人条件・判断は専用バックアップで引き継ぎます。端末間の自動同期はありません。</p><p>株価・調査資料の基準日は画面内に表示します。新規開示と週次調査は下の公開フィードに表示します。取得日・対象範囲・未精査の表示を確認してください。</p></details>
 <a href="research-lab/index.html?v=1.3" target="_blank" rel="noopener">投資調査だけを別画面で開く</a><p id="researchLoadState" role="status">投資調査を読み込み中…</p></div>
 <iframe id="researchFrame" title="投資調査：候補・反証・購入検討" src="research-lab/index.html?v=1.3" loading="lazy" style="width:100%;height:900px;display:block;border:0;border-radius:10px;background:var(--sur)"></iframe>`;
 const frame=root.querySelector('iframe'),state=root.querySelector('#researchLoadState');let observer;
 function sync(){try{const doc=frame.contentDocument;if(!doc?.body||root.hidden)return;doc.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'dark':'light';frame.style.height=Math.ceil(Math.max(600,doc.body.getBoundingClientRect().height))+8+'px';}catch{state.textContent='画面内に表示できません。上のリンクから開いてください。';}}
 frame.addEventListener('load',()=>{observer?.disconnect();try{const doc=frame.contentDocument;if(!doc?.querySelector('#workflow'))throw Error('unavailable');state.textContent='';observer=new ResizeObserver(sync);observer.observe(doc.body);sync();}catch{state.textContent='読み込めませんでした。再読込するか、上のリンクから開いてください。';}});
 new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('resize',sync);
}
