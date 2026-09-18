import {dateOK} from './performance-engine.js?v=2.12';
export function parseCsv(text){
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false,closed=false;
 const field=()=>{row.push(cell);cell='';closed=false;};
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw Error('引用符の位置が不正です。');quoted=true;}
  else if(c===',')field();else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;field();if(row.some(x=>x.trim()))rows.push(row);row=[];}
  else{if(closed)throw Error('引用符の後に不正な文字があります。');cell+=c;}}
 if(quoted)throw Error('CSVの引用符が閉じられていません。');field();if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2||rows.length>10001)throw Error('見出し行と1〜10000行の明細が必要です。');
 const headers=rows.shift().map(x=>x.trim());if(headers.some(x=>!x)||new Set(headers).size!==headers.length)throw Error('見出しは空欄・重複なしにしてください。');
 if(rows.some(r=>r.length!==headers.length))throw Error('CSVの列数が行によって違います。先頭行を列見出しにしてください。');return {headers,rows};
}
const numeric=(s,zero=false)=>{s=s.trim();if(!/^(?:\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?)$/.test(s))throw Error('数量・価格・費用には数値が必要です。');const n=Number(s.replace(/,/g,''));if(!Number.isFinite(n)||(zero?n<0:n<=0))throw Error('数量・価格は正、費用は0以上です。');return n;};
export function csvEvents(table,map,{namespace,spotOnly,zeroFee}){
 if(!namespace.trim())throw Error('証券会社・口座の識別名を入力してください。再取込でも同じ名前を使います。');
 for(const k of ['id','date','kind','code','shares','price'])if(!Number.isInteger(map[k])||map[k]<0||map[k]>=table.headers.length)throw Error('必須の列をすべて指定してください。');
 if(!spotOnly)throw Error('現物取引だけのCSVであることを確認してください。信用は別の会計対応が必要です。');
 if(!(map.fee>=0)&&!zeroFee)throw Error('費用の列を指定するか、費用0円を確認してください。');
 const seen=new Set();return table.rows.map((r,i)=>{try{
  const val=k=>(r[map[k]]||'').trim();if(/信用|返済|買建|売建|現引|現渡|空売/.test(r.join(' ')))throw Error('信用取引は現物台帳へ取り込めません。');
  const id=val('id');if(!id)throw Error('約定IDが空欄です。');const key='csv:'+encodeURIComponent(namespace.trim())+':'+encodeURIComponent(id);if(seen.has(key))throw Error('約定IDが重複しています。分割約定は個別の一意IDが必要です。');seen.add(key);
  const m=val('date').match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);const date=m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:val('date');if(!dateOK(date))throw Error('約定日はYYYY-MM-DDまたはYYYY/MM/DDで指定してください。');
  const kind={'買':'buy','買付':'buy','現物買':'buy','現物買付':'buy','buy':'buy','売':'sell','売却':'sell','現物売':'sell','現物売却':'sell','sell':'sell'}[val('kind').toLowerCase()];if(!kind)throw Error('売買区分を買付/売却に対応できません。');
  const code=val('code').toUpperCase();if(!/^[0-9A-Z]{4}$/.test(code))throw Error('銘柄コードは4桁です。');
  return {id:key,date,kind,code,shares:numeric(val('shares')),price:numeric(val('price')),fee:map.fee>=0?numeric(val('fee'),true):0};
 }catch(e){throw Error(`${i+2}行目：${e.message}`);}}).sort((a,b)=>a.date.localeCompare(b.date));
}
export function mountCsv(root,{getState,commit,merge}){
 const box=document.createElement('details');box.className='perf-box';box.innerHTML=`<summary>約定CSVを取り込む</summary><p class="hint">現物の買付・売却に対応。先頭行を列見出しにし、各約定を一意に識別できるIDが必要です。最初に取引台帳の開始条件を保存してください。明細はこの端末内で処理します。</p><label>証券会社・口座の識別名<input data-csv-account placeholder="例：証券会社名・特定口座"></label><label>文字コード<select data-csv-encoding><option value="utf-8">UTF-8</option><option value="shift_jis">Shift_JIS</option></select></label><input type="file" accept=".csv,text/csv" data-csv-file aria-label="約定CSV"><div data-csv-map class="perf-grid"></div><label><input type="checkbox" data-csv-spot> このCSVは現物取引だけです</label><label><input type="checkbox" data-csv-zero> 費用列がない場合、費用は全件0円です</label><p class="hint">費用は手数料・税など取引で差し引かれる合計額。複数列に分かれている場合は合計列を用意してください。同日内の取引順はCSVの行順です。</p><button class="chip" data-csv-check>取込内容を確認</button><pre data-csv-preview style="white-space:pre-wrap;overflow-wrap:anywhere" role="status"></pre><button class="chip" data-csv-save hidden>確認した取引を保存</button>`;root.append(box);
 let table=null,pending=null,readVersion=0;const q=s=>box.querySelector(s),preview=q('[data-csv-preview]'),save=q('[data-csv-save]');
 const invalidate=()=>{pending=null;save.hidden=true;};box.addEventListener('input',invalidate);box.addEventListener('change',invalidate);
 const fields=[['id','約定ID'],['date','約定日'],['kind','売買区分'],['code','銘柄コード'],['shares','株数'],['price','約定単価'],['fee','費用合計']];
 async function read(){const token=++readVersion;table=null;invalidate();q('[data-csv-map]').replaceChildren();try{const f=q('[data-csv-file]').files[0];if(!f)return;if(f.size>5000000)throw Error('5MB以下のCSVを選んでください。');const parsed=parseCsv(new TextDecoder(q('[data-csv-encoding]').value,{fatal:true}).decode(await f.arrayBuffer()));if(token!==readVersion)return;table=parsed;
  for(const [key,label]of fields){const el=document.createElement('label');el.textContent=label;const select=document.createElement('select');select.dataset.csvColumn=key;select.add(new Option('列を選択（費用のみ省略可）','-1'));table.headers.forEach((h,i)=>select.add(new Option(h,String(i))));const match=table.headers.indexOf(label);if(match>=0)select.value=String(match);el.append(select);q('[data-csv-map]').append(el);}preview.textContent=table.rows.length+'件。各項目の列を確認してください。';
 }catch(e){if(token===readVersion)preview.textContent=e.message;}}
 q('[data-csv-file]').onchange=read;q('[data-csv-encoding]').onchange=read;
 q('[data-csv-check]').onclick=()=>{invalidate();try{if(!getState())throw Error('先に取引台帳で開始条件を保存してください。');if(!table)throw Error('CSVを選択してください。');const map=Object.fromEntries([...box.querySelectorAll('[data-csv-column]')].map(x=>[x.dataset.csvColumn,Number(x.value)]));const input={events:csvEvents(table,map,{namespace:q('[data-csv-account]').value,spotOnly:q('[data-csv-spot]').checked,zeroFee:q('[data-csv-zero]').checked}),points:[]};const r=merge(getState(),input);pending={input,base:JSON.stringify(getState())};preview.textContent=`新規 ${r.added}件／既存 ${input.events.length-r.added}件\n`+input.events.map(e=>`${e.date} ${e.kind==='buy'?'買付':'売却'} ${e.code} ${e.shares}株 × ${e.price}円 費用${e.fee}円`).join('\n');save.hidden=r.added===0;}catch(e){preview.textContent=e.message;}};
 save.onclick=()=>{if(!pending)return;try{if(pending.base!==JSON.stringify(getState()))throw Error('台帳が変更されました。再度確認してください。');commit(merge(getState(),pending.input).next);}catch(e){preview.textContent=e.message;}};
}
