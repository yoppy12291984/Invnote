import {DEFAULTS} from './macro-config.js?v=2.18';
const DAY=86400000;
const round=x=>Math.round(x*1e6)/1e6;
export function usable(x,now=Date.now()) {
 const age=(now-Date.parse(x?.date))/DAY;
 return !!x&&x.status==='fresh'&&!x.stale&&Number.isFinite(x.value)&&Number.isFinite(age)&&age>=0&&age<=(x.frequency==='monthly'?75:10);
}
// Compare daily series on exactly the same end date and baseline date.
export function aligned(items,ids,days=30,now=Date.now()) {
 const rows=ids.map(id=>items.find(x=>x.id===id));
 if(rows.some(x=>!usable(x,now)))return null;
 const maps=rows.map(x=>new Map((x.history||[]).filter(p=>Number.isFinite(p.value)&&Date.parse(p.date)<=now).map(p=>[p.date,p.value])));
 const dates=[...maps[0].keys()].filter(d=>maps.every(m=>m.has(d))).sort();
 if(!dates.length)return null;
 const to=dates.at(-1),target=Date.parse(to)-days*DAY;
 if((now-Date.parse(to))/DAY>10)return null;
 const from=dates.filter(d=>Date.parse(d)<=target).at(-1);
 if(!from||(target-Date.parse(from))/DAY>7)return null;
 return {from,to,values:Object.fromEntries(ids.map((id,i)=>[id,{value:maps[i].get(to),before:maps[i].get(from),change:round(maps[i].get(to)-maps[i].get(from))}]))};
}
export function classifyCurve(pair,c=DEFAULTS) {
 if(!pair)return '判定保留（共通日の金利データ不足）';
 const a=pair.values.DGS10.change,b=pair.values.DGS2.change,gap=round(a-b),t=c.curve;
 if(Math.abs(gap)<t)return '長短差は概ね横ばい';
 const shape=gap>0?'Steepening（差が拡大）':'Flattening（差が縮小）';
 if(a<=-t&&b<=-t)return `Bull ${shape}`;
 if(a>=t&&b>=t)return `Bear ${shape}`;
 return `金利の方向が混在：${shape}`;
}
export function classifyRegime(items,now=Date.now(),c=DEFAULTS) {
 const ids=['DFII10','DGS10','DGS2','T10YIE','BAMLH0A0HYM2','BAMLC0A4CBBB','VIXCLS','SP500','UNRATE'],missing=[],evidence=[],signals=[];
 const get=id=>items.find(x=>x.id===id);
 for(const id of ids){const x=get(id);if(!usable(x,now)){missing.push(x?.name||id);continue;}
  const v=x.changes?.[id==='UNRATE'?'3m':'1m'];
  if(!Number.isFinite(v?.value)){missing.push(`${x.name||id}の比較値`);continue;}
  evidence.push(`${x.name||id}：${id==='UNRATE'?'3か月':'1か月'} ${v.value>0?'+':''}${v.value.toFixed(2)} ${x.unit==='%'?'%pt':'pt'}（${v.from} → ${x.date}）`);
 }
 const rates=aligned(items,['DGS10','DFII10','T10YIE'],30,now),curve=aligned(items,['DGS10','DGS2'],30,now);
 const credit=aligned(items,['BAMLH0A0HYM2','BAMLC0A4CBBB'],30,now),divergence=aligned(items,['SP500','BAMLH0A0HYM2'],30,now);
 const v=usable(get('VIXCLS'),now)?get('VIXCLS').changes?.['1m']?.value:null;
 const u=usable(get('UNRATE'),now)?get('UNRATE').changes?.['3m']?.value:null;
 const hy=usable(get('BAMLH0A0HYM2'),now)?get('BAMLH0A0HYM2'):null;
 const h=credit?.values.BAMLH0A0HYM2.change,b=credit?.values.BAMLC0A4CBBB.change;
 // Serious credit evidence overrides missing non-credit factors. Missing never means zero.
 const severe=(Number.isFinite(h)&&Number.isFinite(b)&&h>=c.severeHy&&b>=c.severeBbb)||
   (hy&&hy.value>=c.crisisHy&&Number.isFinite(hy.changes?.['1w']?.value)&&hy.changes['1w'].value>=c.crisisWeek);
 if(severe&&hy)evidence.push(`重大ストレス確認：HY水準 ${hy.value.toFixed(2)}%、1週間変化 ${Number.isFinite(hy.changes?.['1w']?.value)?hy.changes['1w'].value.toFixed(2):'未取得'}%pt。`);
 if(credit)evidence.push(`信用の共通比較期間：${credit.from} → ${credit.to}、HY ${h.toFixed(2)}%pt／BBB ${b.toFixed(2)}%pt。`);
 const creditBad=Number.isFinite(h)&&Number.isFinite(b)&&h>=c.hy&&b>=c.bbb;
 const fear=Number.isFinite(v)&&v>=c.vix,labor=Number.isFinite(u)&&u>=c.unemployment;
 const rate=rates?.values.DFII10.change ?? (usable(get('DFII10'),now)?get('DFII10').changes?.['1m']?.value:null);
 const nominal=rates?.values.DGS10.change,bei=rates?.values.T10YIE.change;
 if(Number.isFinite(rate)&&rate>=c.real)signals.push('実質金利上昇による評価倍率の逆風');
 if(Number.isFinite(nominal)&&Number.isFinite(bei)&&nominal>=c.real&&bei>=c.real)signals.push('インフレ関連の金利上昇候補（BEI寄与あり）');
 if(Number.isFinite(nominal)&&Number.isFinite(bei)&&nominal<=-c.real&&bei<=-c.real&&Number.isFinite(h)&&h>=c.hy)signals.push('不況型の警戒材料（金利・BEI低下と信用悪化／EPS未確認）');
 if(creditBad)signals.push('HY・BBBの同時悪化');
 if(fear)signals.push('VIX上昇');if(labor)signals.push('失業率上昇');
 if(curve&&curve.values.DGS10.value-curve.values.DGS2.value<0)signals.push('逆イールド（中長期の背景リスク）');
 const equity=divergence&&divergence.values.SP500.before>0?100*divergence.values.SP500.change/divergence.values.SP500.before:null;
 const divergent=Number.isFinite(equity)&&equity>=c.equity&&divergence.values.BAMLH0A0HYM2.change>=c.hy;
 if(divergent)signals.push('株高・信用悪化の乖離');
 // One-sided credit deterioration must not disappear merely because its peer is missing.
 for(const [id,t] of [['BAMLH0A0HYM2',c.hy],['BAMLC0A4CBBB',c.bbb]]){
  const x=get(id);if(!creditBad&&usable(x,now)&&Number.isFinite(x.changes?.['1m']?.value)&&x.changes['1m'].value>=t)signals.push(`${x.name||id}の拡大（他指標との整合を確認）`);
 }
 let color='gray',label='総合判定を保留',reason='利益・銀行株・需給の裏付けが不足。安全と判定する材料は揃っていません。';
 if(severe){color='red';label='重大な信用ストレス';reason='重大ストレス条件に該当。他指標が不足していても警戒を優先します。';}
 else if(creditBad&&(fear||labor)){color='red';label='信用ストレスが複数因子へ波及';reason='信用悪化に市場ストレスまたは雇用悪化が重なっています。';}
 else if(signals.length){color='yellow';label=divergent?'株高・信用悪化':signals[0];reason='確認できた警戒材料を表示。欠損項目があっても観測済みの悪化は消しません。';}
 else if(Number.isFinite(rate)&&rate<=-c.real&&Number.isFinite(h)&&Number.isFinite(b)&&h<=0&&b<=0){label='金融環境は緩和方向／青判定は保留';reason='金利・信用は緩和方向ですが、企業利益と市場の広がりを確認できていません。';}
 else if(missing.length<ids.length){label='方向感が限定的／青判定は保留';}
 const actions=color==='red'?'守り方を優先点検。新規リスクや逆張りを慎重にし、建玉・現金・個別チャートを見直す参考に。':color==='yellow'?'新規候補とロットを厳選する参考に。警戒材料の継続と信用・利益への波及を点検。':'通常リスクを許容できるかは未確認。未取得の利益・需給を確認してから判断。';
 const names=['S1 高質グロース・バリュー','S2 シクリカル底打ち','S3 ネットキャッシュ資産バリュー','S4 大型優良株・暴落逆張り','S5 新高値ブレイク','S6 テーマ・モメンタム'];
 const strategies=names.map((name,i)=>({name,text:color==='red'?'共通の逆風：信用・資金調達の悪化を優先確認。':[
  Number.isFinite(rate)&&rate>=c.real?'評価倍率に逆風。EPS成長が相殺するか確認。':'金利だけで追い風確定にせず、EPSと価格を確認。',
  '在庫・受注・利益率の反転が未接続。適性は未判定。',
  '資産価値に加え、信用・CF・還元の実行を確認。',
  Number.isFinite(rate)&&rate>=c.real&&credit&&h<c.hy&&b<c.bbb?'金利要因の下落候補を点検。ただし個別EPS・品質は未確認で逆張り適性は未確定。':'下落の原因と個別EPS・品質を確認。適性は未判定。',
  'EPS・Stage・RS・出来高を個別確認。マクロだけで採用しない。',
  divergent?'株高と信用悪化が乖離。テーマ内の資金流入継続を慎重に確認。':'テーマの広がりと資金流入は未接続。適性は未判定。'][i]}));
 return {color,label,reason,actions,missing,evidence,signals,strategies,severe:!!severe,coverage:`${ids.length-missing.length}/${ids.length} 接続指標の比較値`,rates,curve,credit,curveLabel:classifyCurve(curve,c),divergence,equity,
  gaps:['Forward EPS／Revision','銀行株の相対強度','ポジショニング・市場の広がり','日本金利・流動性'],
  next:'信用拡大・金利上昇が設定幅を下回るかを再確認。青への移行は利益・銀行株・需給の裏付けが揃ってから。自動売買や数値のロット上限には連動しません。'};
}
