(function(root){
 'use strict';const n=x=>typeof x==='number'&&Number.isFinite(x),pos=x=>n(x)&&x>0;
 const types=['未分類','利益改善型','隠れた成長型（未織込みは要検証）','資本効率改善型'];
 const stages=['候補','精査','監視','見送り','仮想保有','保有（手動記録）'];
 const labels=['重要数値を一次資料と照合','利益計算・倍率の前提に過大な期待なし','きっかけと途中指標が明確','最大の反論を調べ未解決を把握','購入上限の根拠を確認','損失額・共通リスク・流動性を許容'];
 function blank(){return {version:'workflow-1',type:types[0],stage:stages[0],pilot:false,selectedReason:'',profitLogic:'',catalyst:'',catalystMonths:null,indicator:'',exitRule:'',unknown:'',verdict:'',reviewDate:'',reviewSource:'',reviewFindings:'',reviewOutcome:'未実施',returnRequired:null,lossBudget:null,maxWeight:null,cash:null,planned:null,checks:labels.map(label=>({label,state:'pending',note:'',date:''})),facts:[],bridge:{sales:null,margin:null,nonOperating:null,exceptional:null,tax:null,minority:null,shares:null,period:'',basis:''},followups:[]};}
 function bridge(b){if(!b||!['sales','margin','nonOperating','exceptional','tax','minority','shares'].every(k=>n(b[k]))||b.sales<0||b.margin<-100||b.margin>100||b.tax<0||b.tax>100||b.minority<0||b.shares<=0)return null;const op=b.sales*b.margin/100,net=(op+b.nonOperating+b.exceptional)*(1-b.tax/100)-b.minority,eps=net*10000/b.shares;return [op,net,eps].every(n)?{op,net,eps}:null;}
 function calculations(r){const w=r.workflow,d=r.decision,p=r.price,c=d?.cases||[],prices=c.slice(0,3).map(x=>pos(x.eps)&&pos(x.per)?x.eps*x.per:null),[bear,base,bull]=prices;
 const scenario=prices.length===3&&prices.every(pos)&&bear<=base&&base<=bull&&c.slice(0,3).every(x=>pos(x.months)&&x.months<=r.horizon&&x.note.trim());
 const ceiling=pos(base)&&n(w.returnRequired)&&w.returnRequired>=0?base/(1+w.returnRequired/100):null;
 const down=pos(p)&&pos(bear)&&bear<p?(p-bear)/p:null;
 const amount=pos(w.lossBudget)&&pos(d?.assets)&&pos(w.maxWeight)&&w.maxWeight<=100&&pos(w.cash)&&pos(down)?Math.min(w.lossBudget/down,d.assets*w.maxWeight/100,w.cash):null;
 return {prices,scenario,ceiling:n(ceiling)?ceiling:null,down,amount:n(amount)?amount:null};}
 function basis(r){const {checks,followups,stage,verdict,...w}=r.workflow,s=JSON.stringify({price:r.price,date:r.date,horizon:r.horizon,decision:r.decision,workflow:w});let a=2166136261,b=5381;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i);}return 'change-v1:'+s.length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16);}
 function gates(r){const w=r.workflow,d=r.decision,x=calculations(r),manual=w.checks.map(c=>c.state==='pass'&&c.basis===basis(r)&&!!c.note.trim()&&!!c.date);
 const facts=w.facts.filter(f=>f.kind==='一次資料');const primary=facts.length>0&&facts.every(f=>n(f.value)&&f.source&&f.published&&f.period&&f.unit&&f.checked);
 const independent=w.reviewOutcome==='確認済み'&&w.reviewDate&&w.reviewSource.trim()&&w.reviewFindings.trim();
 const noConcern=d&&d.checks.every(c=>c.state==='clear'&&c.note.trim());
 return [manual[0]&&primary,manual[1]&&x.scenario&&w.profitLogic.trim(),manual[2]&&pos(w.catalystMonths)&&w.catalystMonths<=Math.min(24,r.horizon)&&w.catalyst.trim()&&w.indicator.trim(),manual[3]&&independent,manual[4]&&pos(r.price)&&pos(x.ceiling)&&r.price<=x.ceiling,manual[5]&&noConcern&&pos(x.amount)&&pos(w.planned)&&w.planned<=x.amount].map(Boolean);}
 function ready(r){return gates(r).every(Boolean);}
 const str=x=>typeof x==='string'&&x.length<=30000;
 function valid(w){return w&&w.version==='workflow-1'&&types.includes(w.type)&&stages.includes(w.stage)&&typeof w.pilot==='boolean'&&['selectedReason','profitLogic','catalyst','indicator','exitRule','unknown','verdict','reviewDate','reviewSource','reviewFindings'].every(k=>str(w[k]))&&['未実施','未解決あり','確認済み'].includes(w.reviewOutcome)&&['catalystMonths','returnRequired','lossBudget','maxWeight','cash','planned'].every(k=>w[k]===null||n(w[k]))&&Array.isArray(w.checks)&&w.checks.length===6&&w.checks.every(c=>str(c.label)&&str(c.note)&&str(c.date)&&['pending','pass','fail'].includes(c.state))&&Array.isArray(w.facts)&&w.facts.length<=100&&w.facts.every(f=>f&&['name','unit','period','published','source','kind'].every(k=>str(f[k]))&&['一次資料','二次資料','分析仮定'].includes(f.kind)&&(f.value===null||n(f.value))&&typeof f.checked==='boolean')&&w.bridge&&['sales','margin','nonOperating','exceptional','tax','minority','shares'].every(k=>w.bridge[k]===null||n(w.bridge[k]))&&str(w.bridge.period)&&str(w.bridge.basis)&&Array.isArray(w.followups)&&w.followups.length<=100&&w.followups.every(e=>['date','kind','before','actual','action','source'].every(k=>str(e[k])));}
 const api={types,stages,labels,blank,bridge,calculations,gates,ready,valid,basis};if(typeof module!=='undefined')module.exports=api;else root.RRWorkflowModel=api;
})(typeof window==='undefined'?globalThis:window);
