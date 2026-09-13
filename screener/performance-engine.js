// Private ledger calculations. No network, market assumptions or persisted personal data here.
export const kinds=['buy','sell','deposit','withdraw','dividend','expense','split'];
export const dateOK=d=>typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0,10)===d;
const num=(v,zero=false)=>typeof v==='number'&&Number.isFinite(v)&&v<1e13&&(zero?v>=0:v>0);
const codeOK=c=>typeof c==='string'&&/^[0-9A-Z]{4}$/.test(c);
const fail=s=>{throw new Error(s);};
export function validate(s){
 if(s?.version!==1||!dateOK(s.start?.date)||!num(s.start.capital)||!Array.isArray(s.start.ideal)||!Array.isArray(s.events)||!Array.isArray(s.points)||!Array.isArray(s.reviews))fail('保存データの形式が違います。');
 if(s.start.topix!==null&&!num(s.start.topix))fail('開始TOPIXが不正です。');
 const codes=new Set();let allocation=0;
 for(const r of s.start.ideal){if(!codeOK(r.code)||codes.has(r.code)||!num(r.price)||!num(r.shares,true))fail('開始時の理想配分が不正です。');codes.add(r.code);allocation+=r.price*r.shares;}
 if(allocation>s.start.capital+0.01)fail('理想配分が開始資金を超えています。');
 const ids=new Set();
 for(const e of s.events){
  if(typeof e.id!=='string'||ids.has(e.id)||!dateOK(e.date)||e.date<s.start.date||!kinds.includes(e.kind))fail('取引の日付・種類・IDが不正です。');ids.add(e.id);
  if(['buy','sell','split','dividend'].includes(e.kind)&&!codeOK(e.code))fail('銘柄コードは4桁の英数字です。');
  if(['buy','sell'].includes(e.kind)&&(!num(e.shares)||!num(e.price)||!num(e.fee,true)))fail('株数・価格・費用を確認してください。');
  if(['deposit','withdraw','expense'].includes(e.kind)&&!num(e.amount))fail('金額を入力してください。');
  if(e.kind==='dividend'&&(!num(e.amount,true)||!num(e.idealAmount,true)||(e.amount===0&&e.idealAmount===0)))fail('配当額を確認してください（実際・理想の少なくとも一方は0より大きい額）。');
  if(e.kind==='split'&&(!num(e.ratio)||e.ratio>10000))fail('分割倍率を確認してください。');
  if(['deposit','withdraw'].includes(e.kind)&&e.date===s.start.date)fail('開始日の入出金は開始資金へ含めてください。');
 }
 const dates=new Set();
 for(const p of s.points){if(!dateOK(p.date)||p.date<s.start.date||dates.has(p.date)||!p.prices||Array.isArray(p.prices))fail('評価日は開始日以降・1日1件です。');dates.add(p.date);for(const [c,v]of Object.entries(p.prices))if(!codeOK(c)||!num(v))fail('評価株価が不正です。');if(p.topix!==null&&!num(p.topix))fail('TOPIXが不正です。');}
 for(const r of s.reviews)if(!dateOK(r.date)||r.date<s.start.date||!codeOK(r.code)||!['順調','要確認','仮説崩れ'].includes(r.status)||typeof r.note!=='string'||r.note.length>4000)fail('仮説記録が不正です。');
 positions(s);return s;
}
export function positions(s,until='9999-12-31'){
 let cash=s.start.capital;
 const actual={},ideal=Object.fromEntries(s.start.ideal.map(r=>[r.code,r.shares]));
 let idealCash=s.start.capital-s.start.ideal.reduce((n,r)=>n+r.shares*r.price,0),flow=0;
 // External flows occur at the start of each date. Other same-day events keep entry order.
 const events=s.events.map((e,i)=>({...e,i})).filter(e=>e.date<=until).sort((a,b)=>a.date.localeCompare(b.date)||Number(!['deposit','withdraw'].includes(a.kind))-Number(!['deposit','withdraw'].includes(b.kind))||a.i-b.i);
 for(const e of events){const c=e.code;
  if(e.kind==='deposit'){cash+=e.amount;flow+=e.amount;}
  if(e.kind==='withdraw'){cash-=e.amount;flow-=e.amount;}
  if(e.kind==='buy'){actual[c]=(actual[c]||0)+e.shares;cash-=e.shares*e.price+e.fee;}
  if(e.kind==='sell'){if((actual[c]||0)+1e-8<e.shares)fail(`${e.date} ${c}：保有株数を超える売却です。`);actual[c]-=e.shares;cash+=e.shares*e.price-e.fee;}
  if(e.kind==='expense')cash-=e.amount;
  if(e.kind==='dividend'){cash+=e.amount;idealCash+=e.idealAmount;}
  if(e.kind==='split'){actual[c]=(actual[c]||0)*e.ratio;ideal[c]=(ideal[c]||0)*e.ratio;}
  if(cash<-.01)fail(`${e.date}：現金が不足しています。開始資金・入金・入力順を確認してください。`);
 }
 return {cash,actual,ideal,idealCash,flow};
}
export function evaluate(s){
 validate(s);
 const ordered=[...s.points].sort((a,b)=>a.date.localeCompare(b.date));
 let previousDate=s.start.date, previousNAV=s.start.capital, unit=1,peak=1,dd=0,chain=true;
 return ordered.map(p=>{
  const h=positions(s,p.date),missing=[...new Set([...Object.keys(h.actual),...Object.keys(h.ideal)])].filter(c=>((h.actual[c]||0)>1e-8||(h.ideal[c]||0)>1e-8)&&!num(p.prices[c]));
  if(missing.length){chain=false;return {date:p.date,error:`評価株価が不足：${missing.join('・')}`};}
  const nav=h.cash+Object.entries(h.actual).reduce((n,[c,q])=>n+(q>1e-8?q*p.prices[c]:0),0);
  const idealNAV=h.idealCash+Object.entries(h.ideal).reduce((n,[c,q])=>n+(q>1e-8?q*p.prices[c]:0),0);
  const flows=s.events.filter(e=>e.date>previousDate&&e.date<=p.date&&['deposit','withdraw'].includes(e.kind));
  const endFlow=flows.reduce((n,e)=>n+(e.kind==='deposit'?e.amount:-e.amount),0);
  let reason='';
  if(flows.some(e=>e.date!==p.date))reason='途中の入出金日の評価が必要です。';
  if(previousNAV+endFlow<=0)reason='入出金調整後の基準資産が0以下です。';
  if(reason)chain=false;
  if(chain){unit*=nav/(previousNAV+endFlow);peak=Math.max(peak,unit);dd=Math.min(dd,unit/peak-1);}
  const ret=chain?unit-1:null;
  const topix=s.start.topix&&p.topix?p.topix/s.start.topix-1:null;
  const ideal=idealNAV/s.start.capital-1;
  previousDate=p.date;previousNAV=nav;
  return {date:p.date,nav,cash:h.cash,profit:nav-s.start.capital-h.flow,ret,topix,ideal,vsTopix:ret===null||topix===null?null:ret-topix,vsIdeal:ret===null?null:ret-ideal,dd:chain?dd:null,reason:chain?'':reason||'過去の評価不足を修正してください。'};
 });
}
