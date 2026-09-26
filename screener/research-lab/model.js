(function(root){
 'use strict';
 const groups={
  asset:[['流動資産の換金性','現預金＋有価証券の50%−総負債を時価総額で割る。価格変更時は再計算が必要。'],['負債・資金需要','自己資本比率を代理指標とする。資金調達に重大な未解決懸念があれば上限3点。'],['現金を維持する力','一時的な在庫圧縮ではなく、平常時の営業CFと資金流出を確認する。'],['株主に届く経路','余剰資産の活用・還元実行・資本配分を確認する。']],
  growth:[['需要の裏付け','会社説明を数量・受注・川下企業の資料で照合する。'],['売上化の能力','供給余力、顧客認証、工事進捗、立ち上げ時期を確認する。'],['増益への転換','粗利益、固定費、償却、為替、一時損益を分解する。'],['持続と期待差','翌期にも継続し、更新日をそろえた市場予想を超える経路を確認する。']]
 };
 const anchors=['根拠により明確な悪化・弱さを確認','重大な弱点がある','弱点が優勢','長所と弱点が拮抗','長所が優勢','複数の根拠で強さを確認'];
 function blank(code,name){return {code,name,rubricVersion:'RR-2026-09-26.1',date:'',horizon:12,price:null,bear:null,base:null,bull:null,scenarioNote:'',reviewDate:'',breakCondition:'',asset:Array(4).fill(null),growth:Array(4).fill(null),evidence:Array.from({length:8},()=>({note:'',url:'',date:'',kind:'unverified'})),history:[]};}
 function score(r,key){if(r.rubricVersion!=='RR-2026-09-26.1')return null;const offset=key==='asset'?0:4;const complete=r[key].every((v,i)=>Number.isInteger(v)&&v>=0&&v<=5&&verified(r.evidence[offset+i]));return complete?Math.round(r[key].reduce((a,b)=>a+b,0)/20*100):null;}
 function verified(e){return !!(e&&e.kind!=='unverified'&&e.note.trim()&&e.url.trim()&&e.date);}
 function metrics(r){const {price:p,bear:b,base:m,bull:u}=r;const ok=[p,b,m,u].every(x=>typeof x==='number'&&Number.isFinite(x))&&p>0&&b>=0&&b<p&&b<=m&&m<=u;const ret=x=>(x/p-1)*100;return {asset:score(r,'asset'),growth:score(r,'growth'),coverage:Math.round(r.evidence.filter(verified).length/8*100),valid:ok,down:ok?-ret(b):null,up:ok?ret(m):null,bull:ok?ret(u):null,ratio:ok&&m>p?(m-p)/(p-b):null};}
 const api={groups,anchors,blank,score,metrics,verified};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RRModel=api;
})(typeof window==='undefined'?globalThis:window);
