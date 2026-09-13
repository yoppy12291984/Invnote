// Provisional display thresholds, adjustable in the macro settings dialog.
// Changes affect macro interpretation only, never portfolio weights or orders.
export const DEFAULTS = Object.freeze({version:'2', real:0.15, hy:0.30, bbb:0.10, vix:3,
  unemployment:0.30, curve:0.05, equity:2, severeHy:1.5, severeBbb:0.5,
  crisisHy:8, crisisWeek:0.5});
export const FIELDS = [
 ['real','金利・BEIの1か月変化','%pt',0.01,5],['hy','HYの1か月拡大','%pt',0.01,10],
 ['bbb','BBBの1か月拡大','%pt',0.01,5],['vix','VIXの1か月上昇','pt',0.1,50],
 ['unemployment','失業率の3か月上昇','%pt',0.01,5],['curve','カーブの変化・横ばい幅','%pt',0.01,2],
 ['equity','株高確認の1か月上昇率','%',0.1,20],['severeHy','重大ストレス：HYの1か月拡大','%pt',0.1,20],
 ['severeBbb','重大ストレス：BBBの1か月拡大','%pt',0.01,10],
 ['crisisHy','重大ストレス：HY水準','%',1,30],['crisisWeek','重大ストレス：HYの1週間拡大','%pt',0.01,10]
];
export function validateConfig(value) {
 const next={...DEFAULTS};
 for(const [key,, ,min,max] of FIELDS){
  if(!Number.isFinite(value?.[key])||value[key]<min||value[key]>max)throw Error('値が設定可能範囲を外れています。');
  next[key]=value[key];
 }
 if(next.severeHy<next.hy||next.severeBbb<next.bbb)throw Error('重大ストレスの拡大幅は通常の警戒幅以上にしてください。');
 return next;
}
