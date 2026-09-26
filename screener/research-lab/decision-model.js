(function(root){
 'use strict';
 const version='decision-1';
 const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
 const num=x=>typeof x==='number'&&Number.isFinite(x);
 function required(price,eps,per,target){if(![price,eps,per].every(positive)||!num(target)||target<=-100)return null;const need=price*(1+target/100)/per,growth=(need/eps-1)*100;return num(need)&&num(growth)?{eps:need,growth}:null;}
 function outcome(price,eps,per){if(![price,eps,per].every(positive))return null;const value=eps*per,ret=(value/price-1)*100;return num(value)&&num(ret)?{price:value,ret}:null;}
 function range(price,eps,per,lo,hi,pl,ph){if(![lo,hi,pl,ph].every(num)||lo<=-100||lo>hi||pl<=0||pl>ph)return null;const a=outcome(price,eps*(1+lo/100),per*pl),b=outcome(price,eps*(1+hi/100),per*ph);return a&&b?{low:a.ret,high:b.ret}:null;}
 function impact(amount,assets,shock){if(!positive(amount)||!positive(assets)||amount>assets||!num(shock)||shock<0||shock>100)return null;return {loss:amount*shock/100,total:amount/assets*shock};}
 const checks=['資金繰り・借換え・希薄化','投資仮説を壊す事実','流動性・期限・途中下落','保有全体との共通リスク'];
 function blank(){return {version,origin:'未記入（既存記録の内容は保持）',eps:null,epsPeriod:'',epsSource:'',per:null,perBasis:'',target:50,lowGrowth:-20,highGrowth:30,lowPer:.7,highPer:1,thesis:'',gap:'',survival:'',delivery:'',valuation:'',dependency:'',essential:'',counter:'',common:'',next:'',checks:checks.map(label=>({label,state:'open',note:''})),cases:['弱気','基本','強気','半年遅延'].map(label=>({label,eps:null,per:null,months:null,note:''})),amount:null,assets:null,shock:null};}
 function valid(d){return d&&d.version===version&&['origin','epsPeriod','epsSource','perBasis','thesis','gap','survival','delivery','valuation','dependency','essential','counter','common','next'].every(k=>typeof d[k]==='string'&&d[k].length<=30000)&&['eps','per','target','lowGrowth','highGrowth','lowPer','highPer','amount','assets','shock'].every(k=>d[k]===null||num(d[k]))&&Array.isArray(d.checks)&&d.checks.length===4&&d.checks.every(c=>c&&typeof c.label==='string'&&typeof c.note==='string'&&['open','clear','concern'].includes(c.state))&&Array.isArray(d.cases)&&d.cases.length===4&&d.cases.every(c=>c&&typeof c.label==='string'&&typeof c.note==='string'&&['eps','per','months'].every(k=>c[k]===null||num(c[k])));}
 const api={version,positive,required,outcome,range,impact,blank,valid};if(typeof module!=='undefined')module.exports=api;else root.RRDecisionModel=api;
})(typeof window==='undefined'?globalThis:window);
