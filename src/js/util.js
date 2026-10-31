/* ==========================================================================
   つみあげ — 共通の道具
   日付の区切り、時間の表示、集計など、画面に依存しない処理をまとめています。
   ========================================================================== */
'use strict';

const U = (() => {
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  const pad2 = (n) => String(n).padStart(2, '0');

  /** HTMLに入れる文字を安全にする（メモや科目名は必ずこれを通す） */
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /** 重なりにくいID（例：ses_lx2k9a3f0q） */
  function uid(prefix) {
    const rand = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    return `${prefix}_${Date.now().toString(36)}${rand}`;
  }

  /* ---------- 日付の区切り（端末の時刻で計算。週は月曜はじまり） ---------- */

  function startOfDay(t) {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  function addDays(t, n) {
    const d = new Date(t);
    d.setDate(d.getDate() + n);
    return d.getTime();
  }
  function startOfWeek(t) {
    const s = startOfDay(t);
    const fromMonday = (new Date(s).getDay() + 6) % 7;
    return addDays(s, -fromMonday);
  }
  function startOfMonth(t) {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }
  function addMonths(t, n) {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime();
  }
  function startOfYear(t) {
    return new Date(new Date(t).getFullYear(), 0, 1).getTime();
  }
  function addYears(t, n) {
    return new Date(new Date(t).getFullYear() + n, 0, 1).getTime();
  }

  /** 期間の始まりと終わり（終わりは含まない） */
  function periodRange(type, anchor) {
    switch (type) {
      case 'day': { const s = startOfDay(anchor); return { start: s, end: addDays(s, 1) }; }
      case 'week': { const s = startOfWeek(anchor); return { start: s, end: addDays(s, 7) }; }
      case 'month': { const s = startOfMonth(anchor); return { start: s, end: addMonths(s, 1) }; }
      case 'year': { const s = startOfYear(anchor); return { start: s, end: addYears(s, 1) }; }
      default: return { start: -Infinity, end: Infinity };
    }
  }

  /** 前後の期間へ動かす（n = -1 で前、1 で次） */
  function shiftPeriod(type, anchor, n) {
    const { start } = periodRange(type, anchor);
    switch (type) {
      case 'day': return addDays(start, n);
      case 'week': return addDays(start, 7 * n);
      case 'month': return addMonths(start, n);
      case 'year': return addYears(start, n);
      default: return anchor;
    }
  }

  function isCurrentPeriod(type, anchor, now = Date.now()) {
    if (type === 'all') return true;
    return periodRange(type, anchor).start === periodRange(type, now).start;
  }

  /* ---------- 時間の表示 ---------- */

  function splitHM(sec) {
    const totalMin = Math.floor(Math.max(0, sec || 0) / 60);
    return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
  }

  /** 例：3時間25分 / 45分 / 2時間 */
  function durText(sec) {
    const { h, m } = splitHM(sec);
    if (!h) return `${m}分`;
    return m ? `${h.toLocaleString('ja-JP')}時間${m}分` : `${h.toLocaleString('ja-JP')}時間`;
  }

  /**
   * 数字を大きく、単位を小さく見せるためのHTML。
   * compact: 100時間をこえたら分を省く（せまい場所用）
   */
  function durHTML(sec, opts = {}) {
    const { h, m } = splitHM(sec);
    const n = (v) => `<span class="num">${v.toLocaleString('ja-JP')}</span>`;
    const u = (s) => `<span class="unit">${s}</span>`;
    if (!h) return n(m) + u('分');
    if (opts.compact && h >= 100) return n(h) + u('時間');
    return n(h) + u('時間') + (m ? n(m) + u('分') : '');
  }

  /** タイマー表示用：['01', '23', '45'] */
  function clockParts(ms) {
    const s = Math.floor(Math.max(0, ms) / 1000);
    return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(pad2);
  }

  /* ---------- 日付の表示 ---------- */

  /** 例：10月31日（金）。今年でなければ年もつける */
  function dateLabel(t, now = Date.now()) {
    const d = new Date(t);
    const y = d.getFullYear() === new Date(now).getFullYear() ? '' : `${d.getFullYear()}年`;
    return `${y}${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
  }

  /** 例：2026年10月31日 */
  function fullDate(t) {
    const d = new Date(t);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  /** 例：9:05 */
  function timeLabel(t) {
    const d = new Date(t);
    return `${d.getHours()}:${pad2(d.getMinutes())}`;
  }

  function weekdayLabel(t) {
    return WEEKDAYS[new Date(t).getDay()];
  }

  /** 期間の見出し（例：2026年10月、10月27日〜11月2日） */
  function periodLabel(type, anchor, now = Date.now()) {
    const { start, end } = periodRange(type, anchor);
    const s = new Date(start);
    const thisYear = new Date(now).getFullYear();
    switch (type) {
      case 'day':
        return dateLabel(start, now);
      case 'week': {
        const e = new Date(addDays(end, -1));
        const sy = s.getFullYear() === thisYear ? '' : `${s.getFullYear()}年`;
        const ey = e.getFullYear() !== s.getFullYear() ? `${e.getFullYear()}年` : '';
        return `${sy}${s.getMonth() + 1}月${s.getDate()}日〜${ey}${e.getMonth() + 1}月${e.getDate()}日`;
      }
      case 'month':
        return `${s.getFullYear()}年${s.getMonth() + 1}月`;
      case 'year':
        return `${s.getFullYear()}年`;
      default:
        return '全期間';
    }
  }

  /* ---------- 入力欄（date / time）との変換 ---------- */

  function toDateInput(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function toTimeInput(t) {
    const d = new Date(t);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function fromInputs(dateStr, timeStr) {
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
    const tm = /^(\d{1,2}):(\d{2})/.exec(String(timeStr || ''));
    if (!dm || !tm) return NaN;
    return new Date(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2]).getTime();
  }

  /* ---------- 集計 ---------- */

  /** 期間に入る記録（記録は「始めた日時」で数える） */
  function inRange(sessions, r) {
    return sessions.filter((s) => s.start >= r.start && s.start < r.end);
  }

  function sumSec(sessions) {
    return sessions.reduce((a, s) => a + (s.seconds || 0), 0);
  }

  /** 科目ごとの合計秒数と回数 */
  function bySubject(sessions) {
    const map = new Map();
    for (const s of sessions) {
      const cur = map.get(s.subjectId) || { seconds: 0, count: 0 };
      cur.seconds += s.seconds || 0;
      cur.count += 1;
      map.set(s.subjectId, cur);
    }
    return map;
  }

  /** 週・月は日ごと、年は月ごとに分けて合計する */
  function buckets(type, anchor, sessions) {
    const r = periodRange(type, anchor);
    const out = [];
    if (type === 'week' || type === 'month') {
      for (let t = r.start; t < r.end; t = addDays(t, 1)) out.push({ start: t, seconds: 0 });
      const index = new Map(out.map((b, i) => [b.start, i]));
      for (const s of inRange(sessions, r)) {
        const i = index.get(startOfDay(s.start));
        if (i !== undefined) out[i].seconds += s.seconds || 0;
      }
    } else if (type === 'year') {
      for (let t = r.start; t < r.end; t = addMonths(t, 1)) out.push({ start: t, seconds: 0 });
      for (const s of inRange(sessions, r)) out[new Date(s.start).getMonth()].seconds += s.seconds || 0;
    }
    return out;
  }

  /** ごほうびの目標に届いた日時（届いていなければ null） */
  function reachedAt(sessions, targetSec, subjectId) {
    if (!(targetSec > 0)) return null;
    const list = sessions
      .filter((s) => !subjectId || s.subjectId === subjectId)
      .sort((a, b) => a.start - b.start);
    let acc = 0;
    for (const s of list) {
      acc += s.seconds || 0;
      if (acc >= targetSec) return s.end || s.start;
    }
    return null;
  }

  return {
    esc, uid, pad2,
    startOfDay, addDays, startOfWeek, startOfMonth, addMonths, startOfYear, addYears,
    periodRange, shiftPeriod, isCurrentPeriod,
    splitHM, durText, durHTML, clockParts,
    dateLabel, fullDate, timeLabel, weekdayLabel, periodLabel,
    toDateInput, toTimeInput, fromInputs,
    inRange, sumSec, bySubject, buckets, reachedAt,
  };
})();
