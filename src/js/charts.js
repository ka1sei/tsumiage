/* ==========================================================================
   つみあげ — グラフ（素のHTMLとSVGで描く）
   色の決まりごと
   - 科目ごとの棒グラフ、日ごとの棒グラフ：1系列なので、すべてブランドの青
     （科目の見分けは、名前の横の色の点で示す）
   - 円グラフ：割合を見るためのグラフなので、科目の色で塗り分ける。
     凡例に名前・割合・時間を必ず出して、色だけに頼らない
   - 文字は科目の色にしない（読みにくい色があるため）
   ========================================================================== */
'use strict';

const Charts = (() => {
  const { esc, durText, durHTML } = U;

  const colorVar = (key) => `var(--c-${key || 'other'})`;

  function pctText(part, whole) {
    if (!(whole > 0) || !(part > 0)) return '0%';
    const p = (part / whole) * 100;
    return p < 1 ? '1%未満' : `${Math.round(p)}%`;
  }

  /* ---------- 科目ごとの横棒グラフ ---------- */

  function hbars(rows, total) {
    const sorted = [...rows].sort((a, b) => b.seconds - a.seconds);
    const max = Math.max(...sorted.map((r) => r.seconds), 1);
    return `<ul class="hbars">${sorted.map((r) => `
      <li class="hbar">
        <div class="hbar__head">
          <span class="dot" style="--c:${colorVar(r.color)}"></span>
          <span class="hbar__name">${esc(r.name)}</span>
          <span class="hbar__val">${durHTML(r.seconds)}</span>
          <span class="hbar__pct">${pctText(r.seconds, total)}</span>
        </div>
        <div class="hbar__track" aria-hidden="true"><span class="hbar__bar" style="width:${((r.seconds / max) * 100).toFixed(2)}%"></span></div>
      </li>`).join('')}
    </ul>`;
  }

  /* ---------- 割合の円グラフ（ドーナツ） ---------- */

  /** 6つをこえたら、小さいものを「その他」にまとめる（色が増えすぎると見分けられない） */
  function fold(rows, maxSegments = 6) {
    if (rows.length <= maxSegments) return rows;
    const keep = new Set([...rows].sort((a, b) => b.seconds - a.seconds).slice(0, maxSegments - 1).map((r) => r.id));
    const others = rows.filter((r) => !keep.has(r.id));
    return [
      ...rows.filter((r) => keep.has(r.id)),
      { id: '_other', name: `その他（${others.length}科目）`, color: 'other', seconds: others.reduce((a, r) => a + r.seconds, 0) },
    ];
  }

  function donut(rowsInOrder, total) {
    const rows = fold(rowsInOrder);
    const R = 62;
    const C = 2 * Math.PI * R;
    const GAP = rows.length > 1 ? 2 : 0; // 隣の色との間にすき間をあけて、境目をはっきりさせる
    let acc = 0;
    const segments = rows.map((r) => {
      const len = (r.seconds / total) * C;
      const dash = Math.max(0, len - GAP);
      const label = `${r.name}　${durText(r.seconds)}（${pctText(r.seconds, total)}）`;
      const seg = dash > 0 ? `<circle cx="80" cy="80" r="${R}" style="stroke:${colorVar(r.color)}"
        stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}"
        tabindex="0" role="img" aria-label="${esc(label)}"
        data-tip-value="${esc(durText(r.seconds))}" data-tip-label="${esc(`${r.name}（${pctText(r.seconds, total)}）`)}"></circle>` : '';
      acc += len;
      return seg;
    }).join('');

    return `
    <div class="donut">
      <div class="donut__figure">
        <svg viewBox="0 0 160 160" aria-label="科目ごとの割合"><g transform="rotate(-90 80 80)">${segments}</g></svg>
        <p class="donut__center"><span class="donut__total">${durHTML(total, { compact: true })}</span><span class="donut__label">合計</span></p>
      </div>
      <ul class="legend">${rows.map((r) => `
        <li>
          <span class="swatch" style="--c:${colorVar(r.color)}"></span>
          <span class="legend__name">${esc(r.name)}</span>
          <span class="legend__pct">${pctText(r.seconds, total)}</span>
          <span class="legend__val">${esc(durText(r.seconds))}</span>
        </li>`).join('')}
      </ul>
    </div>`;
  }

  /* ---------- 科目ごとの表（テキスト） ---------- */

  function table(rows, total) {
    const sorted = [...rows].sort((a, b) => b.seconds - a.seconds);
    const count = sorted.reduce((a, r) => a + (r.count || 0), 0);
    return `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th scope="col">科目</th><th scope="col">時間</th><th scope="col">割合</th><th scope="col">回数</th></tr></thead>
        <tbody>${sorted.map((r) => `
          <tr>
            <th scope="row"><span class="dot" style="--c:${colorVar(r.color)}"></span>${esc(r.name)}</th>
            <td>${esc(durText(r.seconds))}</td>
            <td>${pctText(r.seconds, total)}</td>
            <td>${r.count || 0}回</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><th scope="row">合計</th><td>${esc(durText(total))}</td><td>100%</td><td>${count}回</td></tr></tfoot>
      </table>
    </div>`;
  }

  /* ---------- 日ごと・月ごとの縦棒グラフ ---------- */

  /** 目盛り：1時間未満なら分、それ以上なら時間で、きりのいい数を3〜5本 */
  function axis(maxSec) {
    const useMin = maxSec < 3600;
    const unitSec = useMin ? 60 : 3600;
    const steps = useMin ? [10, 15, 20, 30] : [0.5, 1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 100, 200, 250, 500];
    const maxU = Math.max(maxSec / unitSec, useMin ? 30 : 1);
    let step = steps.find((s) => maxU / s <= 4);
    if (!step) {
      // 想定より大きいときは 1・2・5 × 10のn乗 から選ぶ
      const pow = 10 ** Math.floor(Math.log10(maxU / 4));
      step = [1, 2, 5, 10].map((k) => k * pow).find((s) => maxU / s <= 4);
    }
    const top = Math.ceil(maxU / step - 1e-9) * step;
    const ticks = [];
    for (let i = 0; i * step <= top + 1e-9; i += 1) ticks.push(+(i * step).toFixed(2));
    return { unitSec, unitLabel: useMin ? '分' : '時間', ticks, maxSec: top * unitSec };
  }

  const tickText = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  /**
   * bars: [{ seconds, label（目盛りの文字。空なら出さない）, name（日付などの読み上げ名）, isNow }]
   */
  function columns(bars) {
    const ax = axis(Math.max(0, ...bars.map((b) => b.seconds)));
    const pos = (v) => `${((v * ax.unitSec) / ax.maxSec) * 100}%`;
    const grid = ax.ticks.map((v) => `<i style="bottom:${pos(v)}"></i>`).join('');
    const yLabels = ax.ticks.map((v) => `<span style="bottom:${pos(v)}">${tickText(v)}</span>`).join('');
    const cols = bars.map((b) => {
      const h = ax.maxSec ? (b.seconds / ax.maxSec) * 100 : 0;
      const value = b.seconds > 0 ? durText(b.seconds) : '記録なし';
      return `<div class="col${b.isNow ? ' is-now' : ''}" tabindex="0" role="img" aria-label="${esc(`${b.name} ${value}`)}"
        data-tip-value="${esc(value)}" data-tip-label="${esc(b.name)}">${b.seconds > 0
          ? `<span class="col__bar" style="height:max(2px, ${h.toFixed(2)}%)"></span>` : ''}</div>`;
    }).join('');
    const xLabels = bars.map((b) => `<span${b.isNow ? ' class="is-now"' : ''}>${esc(b.label)}</span>`).join('');

    return `
    <div class="cols" style="--n:${bars.length}">
      <span class="cols__unit" aria-hidden="true">${ax.unitLabel}</span>
      <div class="cols__y" aria-hidden="true">${yLabels}</div>
      <div class="cols__plot">
        <div class="cols__grid" aria-hidden="true">${grid}</div>
        <div class="cols__bars">${cols}</div>
      </div>
      <div class="cols__x" aria-hidden="true">${xLabels}</div>
    </div>`;
  }

  /** 縦棒グラフと同じ中身の表（グラフが見づらいとき用） */
  function columnsTable(bars, headLabel) {
    return `
    <details class="more-table">
      <summary>表で見る</summary>
      <div class="table-wrap">
        <table class="table table--compact">
          <thead><tr><th scope="col">${esc(headLabel)}</th><th scope="col">時間</th></tr></thead>
          <tbody>${bars.map((b) => `<tr><th scope="row">${esc(b.name)}</th><td>${b.seconds > 0 ? esc(durText(b.seconds)) : '—'}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </details>`;
  }

  /* ---------- 進み具合のバー ---------- */

  function meter(ratio, label) {
    const p = Math.max(0, Math.min(1, ratio || 0));
    return `<div class="meter" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(p * 100)}"><span style="width:${(p * 100).toFixed(1)}%"></span></div>`;
  }

  /* ---------- ツールチップ（マウスを乗せる・フォーカスする・タップすると出る） ---------- */

  function setupTooltip() {
    const tip = document.getElementById('tip');
    if (!tip) return;
    let current = null;

    function show(target) {
      if (current === target) return;
      current = target;
      const value = document.createElement('strong');
      value.textContent = target.dataset.tipValue || '';
      const label = document.createElement('span');
      label.textContent = target.dataset.tipLabel || '';
      tip.replaceChildren(value, label);
      tip.hidden = false;
      const r = target.getBoundingClientRect();
      const t = tip.getBoundingClientRect();
      const x = Math.max(8, Math.min(r.left + r.width / 2 - t.width / 2, window.innerWidth - t.width - 8));
      let y = r.top - t.height - 8;
      if (y < 8) y = r.bottom + 8;
      tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
    function hide() {
      current = null;
      tip.hidden = true;
    }

    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest && e.target.closest('[data-tip-value]');
      if (t) show(t); else hide();
    });
    document.addEventListener('focusin', (e) => {
      const t = e.target.closest && e.target.closest('[data-tip-value]');
      if (t) show(t); else hide();
    });
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, { passive: true, capture: true });
    window.addEventListener('resize', hide);
  }

  return { colorVar, pctText, axis, fold, hbars, donut, table, columns, columnsTable, meter, setupTooltip };
})();
