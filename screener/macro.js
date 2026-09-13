import {classifyRegime, RULES} from './macro-regime.js?v=2.16';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => Number.isFinite(value) ? value.toFixed(2) : '未取得';
function chart(item) {
  const points = (item.history || []).filter(p => Number.isFinite(p.value));
  if (points.length < 2) return '';
  const min = Math.min(...points.map(p => p.value)), max = Math.max(...points.map(p => p.value));
  const start = Date.parse(points[0].date), span = Date.parse(points.at(-1).date) - start || 1;
  const line = points.map(p => `${5 + 270 * (Date.parse(p.date) - start) / span},${55 - 45 * (p.value - min) / (max - min || 1)}`).join(' ');
  return `<svg viewBox="0 0 280 65" role="img" aria-label="${escape(item.name)}の約3か月の推移。最小${number(min)}、最大${number(max)}" style="width:100%;height:65px"><polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2"/></svg><small>約3か月：${number(min)}〜${number(max)}（縦軸は指標ごとに異なります）</small>`;
}

export async function mountMacro(root) {
  root.innerHTML = '<p class="hint">マクロデータを読み込み中…</p>';
  try {
    const response = await fetch(`data/macro.json?v=${Date.now()}`, {cache:'no-store'});
    if (!response.ok) throw new Error('load');
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error('schema');
    const items = data.items.map(x => ({...x, stale: x.stale || !x.date ||
      (Date.now() - Date.parse(x.date)) / 86400000 > (x.frequency === 'monthly' ? 75 : 10)}));
    const regime = classifyRegime(items);
    const driver = (id, up, down) => {
      const x = items.find(x => x.id === id), d = x?.changes?.['1m']?.value;
      return !x || x.stale || x.status !== 'fresh' || !Number.isFinite(d) ? '判定保留（欠損・保存値・更新遅延）' : d > 0 ? up : d < 0 ? down : '1か月前比で横ばい';
    };
    root.innerHTML = `<h2>マクロ状況</h2><p class="hint">米国中心の市場環境とドル円。各指標の観測日を確認してください。売買判断はご自身で行えます。</p>
      <div class="macro-card" id="macroRegime"><small>総合局面（米国の金利・信用・雇用による暫定判定）</small><h3>${escape(regime.label)}</h3><p>${escape(regime.reason)}</p><p>次の確認：${escape(regime.next)}</p><p>データ充足：${escape(regime.coverage)}。予測の的中確率ではありません。</p>${regime.missing.length?`<p>不足：${regime.missing.map(escape).join("、")}</p>`:""}<details><summary>根拠と判定方法</summary>${regime.evidence.map(x=>`<p>${escape(x)}</p>`).join("")}<p>表示用の仮ルール v${RULES.version}。1か月変化で実質金利 +${RULES.real}%pt、HY +${RULES.hy}%pt、BBB +${RULES.bbb}%pt、VIX +${RULES.vix}pt、失業率は3か月 +${RULES.unemployment}%ptを変化の目安とします。信用同時悪化→金利→雇用→緩和→混在の順に確認。閾値は収益性・予測精度を検証したものではありません。</p></details><p>EPS修正・日本金利・流動性・株価の広がりは未接続です。業績相場・リスクオンの確定や売買指示には使いません。</p></div><div class="macro-card"><b>1か月の変化を読む</b><p>実質金利：${driver('DFII10','上昇 → 評価倍率への下押し要因','低下 → 評価倍率への支えとなる要因')}</p><p>HYスプレッド：${driver('BAMLH0A0HYM2','拡大 → 信用面の警戒が強まる方向','縮小 → 信用面の警戒が和らぐ方向')}</p><p>BBBスプレッド：${driver('BAMLC0A4CBBB','拡大 → 投資適格にも警戒の広がりを確認','縮小 → 投資適格の信用環境は緩和方向')}</p><small>変化の方向の説明です。景気局面の確定や買い・売りの点数ではありません。EPS予想修正・日本の金利・流動性・業種別の在庫受注は未接続のため、総合判定は接続済み指標による暫定評価です。</small></div>
      <p class="hint">データ生成：${escape(data.generated_at)}<br>更新はPCで取得処理を実行した時点です。画面の再読込だけではFREDを再取得しません。</p>
      <div class="macro-grid">${items.map(x => `<article class="macro-card"><small>${escape(x.group)}</small><h3>${escape(x.name)}</h3><strong style="font-size:24px">${number(x.value)} ${escape(x.unit)}</strong><p>観測日：${escape(x.date || '未取得')}<br>${x.status === 'missing' ? 'データ未取得' : x.status === 'cached' ? '保存値を表示' : '取得済み'}${x.stale ? ' ／ 更新遅延・欠損に注意' : ''}</p>${chart(x)}<div class="macro-changes">${[['1w','1週間'],['1m','1か月'],['3m','3か月']].map(([key,label]) => {const d=x.changes?.[key];return `<div><b>${label}</b><br>${d && Number.isFinite(d.value) ? `${d.value>0?'+':''}${number(d.value)} ${x.unit==='%'?'%pt':escape(x.unit)}`:'—'}${d ? `<br><small>${escape(d.from)}比</small>`:''}</div>`;}).join('')}</div><p>${escape(x.meaning)}</p><small>${x.frequency==='monthly'?'月次：観測日は対象月。週次比較は表示しません。':'日次：休日・欠測日は直前の観測値で比較します。'}<br>取得日時：${escape(x.fetched_at || 'なし')}${x.error?`<br>${escape(x.error)}`:''}</small><p><a href="https://fred.stlouisfed.org/series/${encodeURIComponent(x.id)}" target="_blank" rel="noopener">FREDの原資料 ↗</a></p></article>`).join('')}</div>
      <p class="hint">${escape(data.note)}<br>変化は各指標の最新観測日から7・30・90日前以前の直近値との差。%表示の指標は%ポイント差です。</p>`;
  } catch {
    root.innerHTML = '<h2>マクロ状況</h2><p class="hint">マクロデータを読み込めませんでした。PCで python macro_dashboard.py を実行し、再読込してください。</p>';
  }
}
