const labels={blue:'青',green:'緑',yellow:'黄',red:'赤',none:'色なし'};
export function decorate(root){
 if(!document.getElementById('list-mark-style')){
  const style=document.createElement('style');style.id='list-mark-style';style.textContent=`
  #ideal .ideal-row-name,#catalyst .cat-name{align-self:stretch;justify-content:center;position:relative;padding-right:8px}
  #ideal .ideal-row-name:after,#catalyst .cat-name:after{content:'';position:absolute;right:-3px;top:-8px;bottom:-8px;border-right:1px solid var(--line)}
  #ideal .stk[class*="mark-"]>.ideal-row-toggle,#catalyst .stk[class*="mark-"]>.cat-toggle{box-shadow:inset 4px 0 var(--mark);background:color-mix(in srgb,var(--mark) 10%,var(--bg))}
  #ideal .stk[class*="mark-"] .ideal-row-name .name,#catalyst .stk[class*="mark-"] .cat-name .name{color:var(--mark)}
  #ideal[data-ideal-view=card] .ideal-row-name:after,#catalyst[data-layout=card] .cat-name:after{top:-14px;bottom:-14px}
  `;document.head.append(style);
 }
 const key=`screener_${root.id}_marks_v1`;let marks={};let readError=false;
 try{const saved=JSON.parse(localStorage.getItem(key)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))marks=saved;}catch{readError=true;}
 root.querySelectorAll('.stk').forEach(row=>{
  if(row.querySelector('.list-mark-controls'))return;
  const toggle=row.querySelector('.ideal-row-toggle,.cat-toggle'),body=row.querySelector('.ideal-row-body,.cat-detail');
  const code=row.dataset.code||toggle?.dataset.catCode;if(!code||!body)return;
  const box=document.createElement('div');box.className='list-mark-controls';
  const caption=document.createElement('p');caption.className='slast';caption.textContent='銘柄の色（この端末に保存）';box.append(caption);
  const controls=document.createElement('div');controls.className='mark-controls';controls.setAttribute('aria-label','銘柄の色');box.append(controls);
  const status=document.createElement('p');status.className='slast';status.setAttribute('role','status');if(readError)status.textContent='保存色を読み込めませんでした。';
  const paint=()=>{Object.keys(labels).forEach(c=>row.classList.remove('mark-'+c));const value=Object.hasOwn(labels,marks[code])?marks[code]:'none';if(value!=='none')row.classList.add('mark-'+value);controls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===value)));};
  Object.entries(labels).forEach(([value,label])=>{const b=document.createElement('button');b.type='button';b.className='mark-'+value;b.dataset.color=value;b.textContent=label;b.onclick=()=>{const next={...marks,[code]:value};try{localStorage.setItem(key,JSON.stringify(next));}catch{status.textContent='色を保存できませんでした。変更は未確定です。';return;}marks=next;paint();status.textContent='この端末に保存しました。';};controls.append(b);});
  box.append(status);body.append(box);paint();
 });
}
