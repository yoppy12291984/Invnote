// Display-only heuristic; not calibrated probabilities or trading rules.
export const RULES = Object.freeze({version:'1', real:0.15, hy:0.30, bbb:0.10, vix:3, unemployment:0.30});
export function classifyRegime(items, now=Date.now()) {
  const ids=['DFII10','BAMLH0A0HYM2','BAMLC0A4CBBB','VIXCLS','UNRATE'],missing=[],evidence=[],d={};
  for(const id of ids){
    const x=items.find(x=>x.id===id),period=id==='UNRATE'?'3m':'1m',c=x?.changes?.[period],age=(now-Date.parse(x?.date))/86400000;
    if(!x||x.status!=='fresh'||x.stale||!Number.isFinite(age)||age<0||age>(id==='UNRATE'?75:10)||!Number.isFinite(x.value)||!Number.isFinite(c?.value)){missing.push(x?.name||id);continue;}
    d[id]=c.value;evidence.push(`${x.name||id}：${period==='3m'?'3か月':'1か月'} ${c.value>0?'+':''}${c.value.toFixed(2)} ${id==='VIXCLS'?'pt':'%pt'}（${c.from} → ${x.date}）`);
  }
  const base={evidence,missing,coverage:`${ids.length-missing.length}/${ids.length} 指標`};
  if(missing.length)return {...base,label:'総合判定を保留',reason:'必須指標に欠損・保存値・更新遅延があります。',next:'不足指標の更新後に再判定します。'};
  const rate=d.DFII10>=RULES.real,credit=d.BAMLH0A0HYM2>=RULES.hy&&d.BAMLC0A4CBBB>=RULES.bbb,fear=d.VIXCLS>=RULES.vix,labor=d.UNRATE>=RULES.unemployment;
  let label,reason,next;
  if(credit&&(fear||labor)){label='信用ストレス拡大';reason='HY・BBBの同時拡大に、変動率または雇用の悪化が重なっています。';next='信用スプレッドの縮小と、変動率・雇用の落ち着きを確認。';}
  else if(credit){label='信用環境の悪化に注意';reason='HY・BBBが同時拡大。変動率・雇用の追加確認はまだ揃っていません。';next='変動率・雇用への波及や、信用スプレッドの縮小を確認。';}
  else if(rate){label='金利上昇による逆風';reason='実質金利が上昇する一方、HY・BBBの同時悪化条件は満たしていません。'+(labor?' 雇用悪化も併存しています。':'');next='実質金利の落ち着きと信用への波及を確認。';}
  else if(labor){label='景気減速に注意';reason='失業率の3か月変化が悪化方向です。企業利益の裏付けは未接続です。';next='雇用改善と企業の利益予想修正を確認。';}
  else if(d.DFII10<=-RULES.real&&d.BAMLH0A0HYM2<=0&&d.BAMLC0A4CBBB<=0&&!fear){label='金融環境の緩和方向';reason='実質金利低下と信用スプレッドの非拡大が揃っています。利益成長や株価上昇の確認は別に必要です。';next='企業利益や市場の上昇の広がりが伴うかを確認。';}
  else if(fear||d.BAMLH0A0HYM2>=RULES.hy||d.BAMLC0A4CBBB>=RULES.bbb){label='警戒材料が混在';reason='変動率または一部の信用指標が悪化していますが、同じ方向には揃っていません。';next='信用・金利・雇用が同じ方向に動くかを確認。';}
  else{label='方向感が限定的';reason='設定した変化幅では大きな共通方向を検出していません。景気良好を保証する判定ではありません。';next='金利・信用の変化と企業利益を確認。';}
  return {...base,label,reason,next};
}
