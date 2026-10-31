/* ==========================================================================
   つみあげ — 画面
   タイマー／記録／ごほうび／設定 の4画面と、入力用のダイアログ
   見る用リンクで開いたときは、記録とごほうびの2画面だけを、見るだけで出す
   記録は「勉強」と「読書」に分けて数える（読書の時間は、勉強の合計やごほうびに入れない）
   ========================================================================== */
'use strict';

(() => {
  const { esc, durText, durHTML } = U;
  const { colorVar } = Charts;
  const $ = (sel, root = document) => root.querySelector(sel);
  // 見る用リンクを開いた人の画面か
  const VIEW = Store.mode === 'view';
  const OWNER_NAME = String(window.TSUMIAGE_OWNER_NAME || '').trim();
  const VIEW_TITLE = OWNER_NAME ? `${OWNER_NAME}の勉強記録` : '勉強の記録';
  const BASE_TITLE = VIEW ? `${VIEW_TITLE}｜つみあげ` : 'つみあげ｜勉強時間の記録';

  /* ---------- アイコン（24×24、線で描く） ---------- */
  const svg = (body, fill = false) => `<svg class="icon${fill ? ' icon--fill' : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  const ICON = {
    timer: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.6 2.2M9.5 3h5"/>'),
    chart: svg('<path d="M4 20h16M7.5 16v-4.5M12 16V7M16.5 16V10"/>'),
    gift: svg('<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5.5 12.5V20h13v-7.5M12 8.5V20M12 8.5C10.6 5.4 7.2 4.5 6.7 6.6 6.3 8.3 9.3 8.5 12 8.5zm0 0c1.4-3.1 4.8-4 5.3-1.9.4 1.7-2.6 1.9-5.3 1.9z"/>'),
    sliders: svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
    play: svg('<path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2A.8.8 0 0 0 8 5.8z"/>', true),
    pause: svg('<rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/>', true),
    stop: svg('<rect x="6" y="6" width="12" height="12" rx="2.2"/>', true),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    left: svg('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
    right: svg('<path d="M9.5 5.5 16 12l-6.5 6.5"/>'),
    up: svg('<path d="M6 14.5 12 8.5l6 6"/>'),
    down: svg('<path d="M6 9.5l6 6 6-6"/>'),
    check: svg('<path d="M5 12.5 9.5 17 19 7.5"/>'),
    sync: svg('<path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1M17.5 3.5v3.6h-3.6M6.5 20.5v-3.6h3.6"/>'),
    alert: svg('<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.2M12 17.2h.01"/>'),
    device: svg('<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2.5 19.5h19"/>'),
    edit: svg('<path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-4-4l-10 10z"/><path d="M13 7l4 4"/>'),
    external: svg('<path d="M14 4.5h5.5V10M19.5 4.5 11 13M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10"/>'),
    download: svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>'),
    upload: svg('<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>'),
    eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
    copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>'),
    book: svg('<path d="M12 6.5C10.2 5.2 7.6 4.6 4 4.8v13c3.6-.2 6.2.4 8 1.7 1.8-1.3 4.4-1.9 8-1.7v-13c-3.6-.2-6.2.4-8 1.7zM12 6.5v13"/>'),
    study: svg('<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.6V16c1.5 1.4 3.4 2 5.5 2s4-.6 5.5-2v-4.4M21.5 9.5V15"/>'),
  };
  const MARK = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect x="4" y="21" width="23" height="6.5" rx="2" fill="#004fc8"/>
    <rect x="7.5" y="13" width="20" height="6.5" rx="2" fill="#0b7bec"/>
    <rect x="4" y="5" width="16" height="6.5" rx="2" fill="#00a3ec"/></svg>`;

  /* ---------- 画面の状態（この端末だけで覚えておくもの） ---------- */
  // 見るだけの画面の表示の好みは、持ち主の画面とは別に覚える
  const UI_KEY = VIEW ? 'tsumiage:ui-view:v1' : 'tsumiage:ui:v1';
  function loadUi() {
    try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}'); } catch (e) { return {}; }
  }
  const saved = loadUi();
  const ui = {
    // タイマーで選んでいる科目（いくつでも）。null は「まだ選んだことがない」
    selectedIds: Array.isArray(saved.selectedIds) ? saved.selectedIds
      : saved.selected ? [saved.selected] : null,
    // 最後に押した科目ボタンの種類（何もえらんでいないときに、タイマー画面でどちらの合計を出すか）
    pickKind: KINDS.includes(saved.pickKind) ? saved.pickKind : 'study',
    // 記録とごほうびの画面で見ている種類
    kind: KINDS.includes(saved.kind) ? saved.kind : 'study',
    period: ['day', 'week', 'month', 'year', 'all'].includes(saved.period) ? saved.period : 'week',
    breakdown: ['bar', 'donut', 'text'].includes(saved.breakdown) ? saved.breakdown : 'bar',
    anchor: Date.now(),
    listLimit: 40,
  };
  // デモでは、URLで表示を指定できる（例：?demo&period=month&breakdown=donut&kind=reading）
  if (Store.mode === 'demo') {
    const params = new URLSearchParams(location.search);
    if (['day', 'week', 'month', 'year', 'all'].includes(params.get('period'))) ui.period = params.get('period');
    if (['bar', 'donut', 'text'].includes(params.get('breakdown'))) ui.breakdown = params.get('breakdown');
    if (KINDS.includes(params.get('kind'))) ui.kind = params.get('kind');
  }
  function saveUi() {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({
        selectedIds: ui.selectedIds, pickKind: ui.pickKind, kind: ui.kind, period: ui.period, breakdown: ui.breakdown,
      }));
    } catch (e) { /* 保存できなくても動く */ }
  }

  const ALL_ROUTES = [
    { id: 'timer', label: 'タイマー', icon: ICON.timer },
    { id: 'stats', label: '記録', icon: ICON.chart },
    { id: 'rewards', label: 'ごほうび', icon: ICON.gift },
    { id: 'settings', label: '設定', icon: ICON.sliders },
  ];
  // 見るだけの画面は、記録とごほうびだけ
  const ROUTES = VIEW ? ALL_ROUTES.filter((r) => r.id === 'stats' || r.id === 'rewards') : ALL_ROUTES;
  function routeFromHash() {
    const id = (location.hash || '').replace(/^#\/?/, '');
    return ROUTES.some((r) => r.id === id) ? id : ROUTES[0].id;
  }
  let route = routeFromHash();

  /* ---------- 小さな道具 ---------- */
  const int = (v) => {
    const n = parseInt(String(v == null ? '' : v).trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const subjectOf = (id) => Store.subject(id) || { id, name: '（削除した科目）', color: 'other', archived: true, kind: 'study' };

  /* ---------- 勉強と読書 ---------- */
  const KIND_INFO = {
    study: { name: '勉強', noun: '科目', doing: '勉強中', did: '勉強した' },
    reading: { name: '読書', noun: 'ジャンル', doing: '読書中', did: '読書した' },
  };
  const kindOf = (subjectId) => subjectOf(subjectId).kind;
  /** 読書のジャンルが1つでもあるか（なければ、切りかえは出さない） */
  const hasReading = () => Store.state.subjects.some((s) => s.kind === 'reading');
  /** その種類の記録だけにする（科目が見つからない記録は、勉強として数える） */
  function sessionsOf(kind, list = Store.state.sessions) {
    const reading = new Set(Store.state.subjects.filter((s) => s.kind === 'reading').map((s) => s.id));
    return list.filter((s) => reading.has(s.subjectId) === (kind === 'reading'));
  }
  /** 記録とごほうびの画面で見ている種類 */
  const shownKind = () => (ui.kind === 'reading' && hasReading() ? 'reading' : 'study');
  /** 「勉強｜読書」の切りかえ（記録とごほうびの画面の一番上） */
  function kindTabsHTML() {
    if (!hasReading()) return '';
    const k = shownKind();
    return `
      <div class="kind-tabs" role="group" aria-label="勉強と読書の切りかえ">
        <button type="button" aria-pressed="${k === 'study'}" data-action="kind" data-value="study">${ICON.study}勉強</button>
        <button type="button" aria-pressed="${k === 'reading'}" data-action="kind" data-value="reading">${ICON.book}読書</button>
      </div>`;
  }

  function elapsedMs(t, now = Date.now()) {
    if (!t || t.state === 'idle') return 0;
    return t.elapsedMs + (t.state === 'running' && t.runningSince ? Math.max(0, now - t.runningSince) : 0);
  }
  /** 計測中の時間を、その期間の合計に足すか（記録と同じく「始めた日時」で判断） */
  function liveExtra(from) {
    const t = Store.state.timer;
    return t.state !== 'idle' && t.startedAt >= from ? Math.floor(elapsedMs(t) / 1000) : 0;
  }
  /** タイマーで選んでいる科目（表示中の科目だけ、並び順どおり。勉強と読書はまぜない） */
  function currentPicks() {
    const visible = Store.subjects();
    if (ui.selectedIds === null) {
      const first = visible.find((s) => s.kind === 'study') || visible[0];
      return first ? [first.id] : [];
    }
    const chosen = visible.filter((s) => ui.selectedIds.includes(s.id));
    return chosen.filter((s) => s.kind === chosen[0].kind).map((s) => s.id);
  }
  /** タイマーの科目（前の形の subjectId だけのデータにも対応） */
  const timerSubjectIds = (t) => (t.subjectIds && t.subjectIds.length ? t.subjectIds : t.subjectId ? [t.subjectId] : []);
  const timerKind = (t) => {
    const ids = timerSubjectIds(t);
    return ids.length ? kindOf(ids[0]) : 'study';
  };
  /**
   * タイマー画面で出す種類（計測中はその種類。止まっているときは、えらんでいる科目の種類）。
   * 何もえらんでいなければ、最後に押したボタンの種類（その種類のボタンがもう出ていなければ、勉強）
   */
  function homeKind() {
    const t = Store.state.timer;
    if (t.state !== 'idle') return timerKind(t);
    const picks = currentPicks();
    if (picks.length) return kindOf(picks[0]);
    return Store.subjects(false, ui.pickKind).length ? ui.pickKind : 'study';
  }

  /** 科目の色の点。複数のときは、色を分けた1つの点にする */
  function dotHTML(subjects) {
    if (subjects.length <= 1) {
      return `<span class="dot" style="--c:${colorVar(subjects[0] ? subjects[0].color : 'other')}"></span>`;
    }
    const step = 100 / subjects.length;
    const stops = subjects.map((s, i) => `${colorVar(s.color)} 0 ${(step * (i + 1)).toFixed(2)}%`).join(', ');
    return `<span class="dot dot--multi" style="background:conic-gradient(${stops})"></span>`;
  }
  const namesText = (subjects) => subjects.map((s) => s.name).join('・');

  /** 秒数を、えらんだ科目で等分する（割り切れない分は前の科目から1つずつ足す） */
  function splitEvenly(total, ids) {
    const base = Math.floor(total / ids.length);
    const rest = total - base * ids.length;
    return ids.map((_, i) => base + (i < rest ? 1 : 0));
  }

  /**
   * 記録を「1回の勉強」ごとにまとめる。
   * まとめて勉強した記録（同じ groupId）は、科目が複数あっても1件として扱う
   */
  function toEntries(list) {
    const order = new Map(Store.subjects(true).map((s, i) => [s.id, i]));
    const byKey = new Map();
    const entries = [];
    for (const s of list) {
      const key = s.groupId || s.id;
      let e = byKey.get(key);
      if (!e) {
        e = { key, start: s.start, end: s.end, memo: '', items: [], seconds: 0 };
        byKey.set(key, e);
        entries.push(e);
      }
      e.items.push(s);
      e.seconds += s.seconds;
      if (!e.memo && s.memo) e.memo = s.memo;
    }
    const rank = (id) => (order.has(id) ? order.get(id) : 999);
    entries.forEach((e) => e.items.sort((a, b) => rank(a.subjectId) - rank(b.subjectId)));
    return entries;
  }
  const entryRecords = (key) => Store.state.sessions.filter((s) => (s.groupId || s.id) === key);
  function clockHTML(ms) {
    return U.clockParts(ms)
      .map((part) => [...part].map((d) => `<span class="d">${d}</span>`).join(''))
      .join('<span class="c">:</span>');
  }

  /* ---------- ごほうびの計算 ---------- */
  /** ごほうびの種類（科目をえらんでいれば、その科目の種類） */
  const rewardKind = (r) => (r.subjectId && Store.subject(r.subjectId) ? Store.subject(r.subjectId).kind : r.kind);
  /** ごほうびで数える記録（科目だけ、またはその種類の全部） */
  const rewardSessions = (r) => (r.subjectId ? Store.state.sessions.filter((s) => s.subjectId === r.subjectId) : sessionsOf(rewardKind(r)));
  function rewardInfo(r) {
    const sec = U.sumSec(rewardSessions(r));
    const target = r.hours * 3600;
    const achieved = target > 0 && sec >= target;
    return { r, sec, target, achieved, ratio: target ? sec / target : 0, remain: Math.max(0, target - sec) };
  }
  const achievedIds = () => new Set(Store.state.rewards.map(rewardInfo).filter((i) => i.achieved).map((i) => i.r.id));
  const scopeName = (r) => (r.subjectId ? subjectOf(r.subjectId).name : `${KIND_INFO[rewardKind(r)].name}の合計`);

  /* ======================================================================
     画面ごとのHTML
     ====================================================================== */

  let lastTimerState = null;

  /* ---------- タイマー ---------- */
  /** 科目ボタン。読書のジャンルもあれば「勉強」「読書」の2段に分ける（ちがう段を押すと、そちらに切りかわる） */
  function pickersHTML(visible, picks) {
    const chips = (list) => list.map((s) => `
        <button type="button" class="chip" aria-pressed="${picks.includes(s.id)}" data-action="pick" data-id="${esc(s.id)}">
          <span class="dot" style="--c:${colorVar(s.color)}"></span>${esc(s.name)}
        </button>`).join('');
    const groups = KINDS.map((k) => ({ k, list: visible.filter((s) => s.kind === k) })).filter((g) => g.list.length);
    if (groups.length === 1) {
      const K = KIND_INFO[groups[0].k];
      return `<div class="chips" role="group" aria-label="${K.name}の${K.noun}（いくつでもえらべます）">${chips(groups[0].list)}</div>`;
    }
    return `
      <div class="pickers">${groups.map(({ k, list }) => `
        <div class="pickers__group" role="group" aria-labelledby="pick-${k}">
          <p class="pickers__label" id="pick-${k}">${KIND_INFO[k].name}</p>
          <div class="chips">${chips(list)}</div>
        </div>`).join('')}
      </div>`;
  }

  function viewTimer() {
    const { timer: t } = Store.state;
    const now = Date.now();
    const visible = Store.subjects();
    const active = t.state !== 'idle';
    const picks = currentPicks();
    const kind = homeKind();
    const K = KIND_INFO[kind];
    const sessions = sessionsOf(kind);
    const fresh = lastTimerState !== null && lastTimerState !== t.state ? ' is-fresh' : '';
    lastTimerState = t.state;

    let head;
    if (active) {
      const subs = timerSubjectIds(t).map(subjectOf);
      head = `<p class="stage__subject">${dotHTML(subs)}<span>${esc(namesText(subs))}</span></p>`;
    } else if (visible.length) {
      head = pickersHTML(visible, picks);
    } else {
      head = '<p class="stage__empty">科目がありません。<a href="#/settings">設定</a>で追加してください。</p>';
    }

    const kindsShown = new Set(visible.map((s) => s.kind));
    const askPick = kindsShown.size > 1 ? '科目かジャンルをえらんでください'
      : `${KIND_INFO[kindsShown.has('reading') ? 'reading' : 'study'].noun}をえらんでください`;
    const statusText = t.state === 'running' ? `${U.timeLabel(t.startedAt)} から${K.doing}`
      : t.state === 'paused' ? '一時停止中'
        : picks.length ? `${K.noun}をえらんでスタート<span class="stage__hint">（いくつでもえらべます）</span>` : askPick;
    const buttons = t.state === 'running'
      ? `<button type="button" class="btn btn--on-color" data-action="pause">${ICON.pause}一時停止</button>
         <button type="button" class="btn btn--white" data-action="stop">${ICON.stop}終了して記録</button>`
      : t.state === 'paused'
        ? `<button type="button" class="btn btn--primary" data-action="resume">${ICON.play}再開</button>
           <button type="button" class="btn btn--outline" data-action="stop">${ICON.stop}終了して記録</button>`
        : `<button type="button" class="btn btn--primary btn--xl" data-action="start"${picks.length ? '' : ' disabled'}>${ICON.play}スタート</button>`;
    const longRun = active && elapsedMs(t, now) >= 8 * 3600000
      ? '<p class="stage__warn">8時間をこえています。止め忘れていたら、終了するときに時間を直せます。</p>' : '';

    const r = { day: U.periodRange('day', now), week: U.periodRange('week', now), month: U.periodRange('month', now) };
    const todays = U.inRange(sessions, r.day).sort((a, b) => b.start - a.start);
    const base = {
      day: U.sumSec(todays),
      week: U.sumSec(U.inRange(sessions, r.week)),
      month: U.sumSec(U.inRange(sessions, r.month)),
      all: U.sumSec(sessions),
    };
    const live = (key, from, compact = false) => `<span data-live-base="${base[key]}" data-live-from="${from}"${compact ? ' data-compact' : ''}>${durHTML(base[key] + liveExtra(from), { compact })}</span>`;

    return `
    <div class="home">
      <section class="stage stage--${t.state}${fresh}" aria-label="タイマー">
        ${head}
        <p class="clock" role="timer" data-clock>${clockHTML(elapsedMs(t, now))}</p>
        <p class="stage__status">${statusText}</p>
        <div class="stage__actions">${buttons}</div>
        ${longRun}
      </section>

      <div class="home__side">
        <section class="today" aria-labelledby="today-h">
          <h2 class="label" id="today-h">今日の${K.name}時間</h2>
          <p class="hero-num">${live('day', r.day.start)}</p>
          <dl class="tiles">
            <div class="tile"><dt>今週</dt><dd>${live('week', r.week.start, true)}</dd></div>
            <div class="tile"><dt>今月</dt><dd>${live('month', r.month.start, true)}</dd></div>
            <div class="tile"><dt>累計</dt><dd>${live('all', 0, true)}</dd></div>
          </dl>
          ${active ? '<p class="note">計測中の時間も入っています。</p>' : ''}
        </section>

        ${nextRewardHTML(kind)}

        <section class="panel" aria-labelledby="todays-h">
          <div class="sec-head">
            <h2 class="sec-title" id="todays-h">${hasReading() ? `今日の${K.name}` : '今日の記録'}</h2>
            <button type="button" class="btn btn--text" data-action="add-session" data-kind="${kind}">${ICON.plus}手で追加</button>
          </div>
          ${todays.length ? recordList(toEntries(todays)) : '<p class="empty">まだ記録がありません。タイマーを終了すると、ここに並びます。</p>'}
        </section>
      </div>
    </div>`;
  }

  /** 次のごほうび（その種類のごほうびだけ）。押すと、ごほうびの画面をその種類で開く */
  function nextRewardHTML(kind) {
    const infos = Store.state.rewards.filter((r) => rewardKind(r) === kind).map(rewardInfo);
    if (!infos.length) {
      return `
      <a class="panel next next--empty" href="#/rewards" data-kind="${kind}">
        <span class="next__label">ごほうび</span>
        <span class="next__title">${kind === 'reading' ? '読書の時間' : '勉強時間'}に応じて、自分へのごほうびを決めておけます。</span>
        <span class="next__link">ごほうびを決める</span>
      </a>`;
    }
    const unclaimed = infos.filter((i) => i.achieved && !i.r.claimedAt).length;
    const next = infos.filter((i) => !i.achieved).sort((a, b) => a.remain - b.remain)[0];
    const notice = unclaimed ? `<span class="next__notice">${ICON.gift}受け取っていないごほうびが${unclaimed}つあります</span>` : '';
    if (!next) {
      return `
      <a class="panel next" href="#/rewards" data-kind="${kind}">
        ${notice}
        <span class="next__label">ごほうび</span>
        <span class="next__title">決めたごほうびは、すべて達成しました。</span>
        <span class="next__link">次のごほうびを決める</span>
      </a>`;
    }
    return `
    <a class="panel next" href="#/rewards" data-kind="${kind}">
      ${notice}
      <span class="next__head">
        <span class="next__label">次のごほうび</span>
        <span class="next__goal">${esc(scopeName(next.r))} ${next.r.hours.toLocaleString('ja-JP')}時間</span>
      </span>
      <span class="next__title">${esc(next.r.title)}</span>
      ${Charts.meter(next.ratio, `${next.r.title}までの進み具合`)}
      <span class="next__rest">あと ${durHTML(next.remain)}</span>
    </a>`;
  }

  /* ---------- 記録の一覧（タイマー画面と記録画面で共通） ---------- */
  function recItem(e) {
    const subs = e.items.map((s) => subjectOf(s.subjectId));
    const split = e.items.length > 1
      ? `<span class="rec__split">${e.items.map((s, i) => `<span>${esc(subs[i].name)} ${esc(durText(s.seconds))}</span>`).join('')}</span>`
      : '';
    // 見るだけの画面では、押しても何も起きない形にする（編集画面を開かない）
    const open = VIEW ? '<div class="rec rec--static">'
      : `<button type="button" class="rec" data-action="edit-session" data-id="${esc(e.key)}">`;
    return `
      <li>
        ${open}
          ${dotHTML(subs)}
          <span class="rec__subject">${esc(namesText(subs))}</span>
          <span class="rec__dur">${durHTML(e.seconds)}</span>
          <span class="rec__time">${U.timeLabel(e.start)}〜${U.timeLabel(e.end)}</span>
          ${split}
          ${e.memo ? `<span class="rec__memo">${esc(e.memo)}</span>` : ''}
        ${VIEW ? '</div>' : '</button>'}
      </li>`;
  }

  /** entries は toEntries() でまとめたもの */
  function recordList(entries, { group = false, dayTotals = null } = {}) {
    if (!group) return `<ul class="rec-list">${entries.map(recItem).join('')}</ul>`;
    const days = new Map();
    for (const e of entries) {
      const d = U.startOfDay(e.start);
      if (!days.has(d)) days.set(d, []);
      days.get(d).push(e);
    }
    return [...days].map(([day, items]) => `
      <div class="rec-group">
        <h3 class="rec-day"><span>${U.dateLabel(day)}</span><span class="rec-day__sum">${esc(durText(dayTotals ? dayTotals.get(day) : items.reduce((a, e) => a + e.seconds, 0)))}</span></h3>
        <ul class="rec-list">${items.map(recItem).join('')}</ul>
      </div>`).join('');
  }

  /* ---------- 記録（集計とグラフ） ---------- */
  const PERIOD_TABS = [['day', '日'], ['week', '週'], ['month', '月'], ['year', '年'], ['all', '全期間']];
  const PERIOD_UNIT = { day: '日', week: '週', month: '月', year: '年' };
  const BACK_TO_NOW = { day: '今日に戻る', week: '今週に戻る', month: '今月に戻る', year: '今年に戻る' };

  function breakdownRows(list) {
    const map = U.bySubject(list);
    const rows = [];
    for (const s of Store.subjects(true)) {
      const v = map.get(s.id);
      if (v && v.seconds > 0) rows.push({ id: s.id, name: s.name, color: s.color, seconds: v.seconds, count: v.count });
      map.delete(s.id);
    }
    let orphan = { seconds: 0, count: 0 };
    map.forEach((v) => { orphan = { seconds: orphan.seconds + v.seconds, count: orphan.count + v.count }; });
    if (orphan.seconds > 0) rows.push({ id: '_unknown', name: '（削除した科目）', color: 'other', ...orphan });
    return rows;
  }

  function trendHTML(p, anchor, sessions, now, K) {
    if (p === 'day' || p === 'all') return '';
    const bucketList = U.buckets(p, anchor, sessions);
    const bars = bucketList.map((b) => {
      if (p === 'year') {
        const m = new Date(b.start).getMonth() + 1;
        return { seconds: b.seconds, label: `${m}月`, name: `${new Date(b.start).getFullYear()}年${m}月`, isNow: U.isCurrentPeriod('month', b.start, now) };
      }
      const d = new Date(b.start).getDate();
      const label = p === 'week' ? U.weekdayLabel(b.start) : ([1, 5, 10, 15, 20, 25, 30].includes(d) ? String(d) : '');
      return { seconds: b.seconds, label, name: U.dateLabel(b.start, now), isNow: U.isCurrentPeriod('day', b.start, now) };
    });
    const title = p === 'year' ? '月ごと' : '日ごと';
    return `
      <section class="panel trend" aria-labelledby="trend-h">
        <div class="sec-head"><h2 class="sec-title" id="trend-h">${title}の${K.name}時間</h2></div>
        ${Charts.columns(bars)}
        ${Charts.columnsTable(bars, p === 'year' ? '月' : '日付')}
      </section>`;
  }

  function viewStats() {
    const kind = shownKind();
    const K = KIND_INFO[kind];
    const sessions = sessionsOf(kind);
    const now = Date.now();
    const p = ui.period;
    if (p !== 'all' && ui.anchor > now) ui.anchor = now;
    const anchor = ui.anchor;
    const range = U.periodRange(p, anchor);
    const list = U.inRange(sessions, range).sort((a, b) => b.start - a.start);
    const total = U.sumSec(list);
    const entries = toEntries(list); // まとめて勉強した記録は1件として数える
    const isNow = U.isCurrentPeriod(p, anchor, now);
    const unit = PERIOD_UNIT[p];

    // 合計の下に並べる補足
    const meta = [];
    if (p !== 'all') {
      const prev = U.sumSec(U.inRange(sessions, U.periodRange(p, U.shiftPeriod(p, anchor, -1))));
      if (prev || total) {
        const diff = total - prev;
        const word = Math.abs(diff) < 60 ? `前の${unit}と同じくらい` : `前の${unit}より ${durText(Math.abs(diff))} ${diff > 0 ? '多い' : '少ない'}`;
        meta.push(word);
      }
    }
    if (p !== 'day' && list.length) meta.push(`${K.did}日 ${new Set(list.map((s) => U.startOfDay(s.start))).size}日`);
    meta.push(`記録 ${entries.length}件`);
    if (p === 'all' && list.length) meta.push(`${U.fullDate(Math.min(...list.map((s) => s.start)))}から`);

    // 科目ごと
    const rows = breakdownRows(list);
    const views = [['bar', '棒グラフ'], ['donut', '円グラフ'], ['text', 'テキスト']];
    let breakdownBody = '<p class="empty">この期間の記録はありません。</p>';
    if (rows.length) {
      breakdownBody = ui.breakdown === 'donut' ? Charts.donut(rows, total, K.noun)
        : ui.breakdown === 'text' ? Charts.table(rows, total, K.noun)
          : Charts.hbars(rows, total);
    }

    // 記録の一覧
    const dayTotals = new Map();
    for (const s of list) {
      const d = U.startOfDay(s.start);
      dayTotals.set(d, (dayTotals.get(d) || 0) + s.seconds);
    }
    const shown = entries.slice(0, ui.listLimit);
    const rest = entries.length - shown.length;

    return `
    ${kindTabsHTML()}
    <div class="stats">
      <div class="filters">
        <div class="seg" role="group" aria-label="集計する期間">${PERIOD_TABS.map(([v, l]) => `
          <button type="button" aria-pressed="${p === v}" data-action="period" data-value="${v}">${l}</button>`).join('')}
        </div>
        ${p === 'all' ? '' : `
        <div class="pager">
          <button type="button" class="icon-btn" data-action="period-prev" aria-label="前の${unit}">${ICON.left}</button>
          <h2 class="pager__label">${U.periodLabel(p, anchor, now)}</h2>
          <button type="button" class="icon-btn" data-action="period-next" aria-label="次の${unit}"${isNow ? ' disabled' : ''}>${ICON.right}</button>
          ${isNow ? '' : `<button type="button" class="btn btn--text pager__now" data-action="period-now">${BACK_TO_NOW[p]}</button>`}
        </div>`}
      </div>

      <section class="summary" aria-label="合計">
        <h2 class="label">${p === 'all' ? `これまでの${K.name}時間` : `${K.name}時間の合計`}</h2>
        <p class="hero-num hero-num--xl">${durHTML(total)}</p>
        <ul class="summary__meta">${meta.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      </section>

      <div class="stats__grid${p === 'day' || p === 'all' ? ' stats__grid--single' : ''}">
        ${trendHTML(p, anchor, sessions, now, K)}
        <section class="panel breakdown" aria-labelledby="breakdown-h">
          <div class="sec-head sec-head--wrap">
            <h2 class="sec-title" id="breakdown-h">${K.noun}ごと</h2>
            <div class="seg seg--small" role="group" aria-label="表示のしかた">${views.map(([v, l]) => `
              <button type="button" aria-pressed="${ui.breakdown === v}" data-action="breakdown" data-value="${v}">${l}</button>`).join('')}
            </div>
          </div>
          ${breakdownBody}
        </section>
      </div>

      <section class="panel" aria-labelledby="list-h">
        <div class="sec-head">
          <h2 class="sec-title" id="list-h">記録</h2>
          ${VIEW ? '' : `<button type="button" class="btn btn--text" data-action="add-session" data-kind="${kind}">${ICON.plus}手で追加</button>`}
        </div>
        ${list.length ? recordList(shown, { group: p !== 'day', dayTotals }) : '<p class="empty">この期間の記録はありません。</p>'}
        ${rest > 0 ? `<button type="button" class="btn btn--quiet btn--block" data-action="more">さらに表示（残り${rest}件）</button>` : ''}
      </section>
    </div>`;
  }

  /* ---------- ごほうび ---------- */
  function roadItem(info, isNext) {
    const { r } = info;
    const subj = r.subjectId ? subjectOf(r.subjectId) : null;
    const at = info.achieved ? U.reachedAt(rewardSessions(r), info.target, r.subjectId) : null;
    const cls = info.achieved ? (r.claimedAt ? 'is-claimed' : 'is-achieved') : isNext ? 'is-next' : '';
    let body;
    if (info.achieved) {
      body = r.claimedAt
        ? `<p class="road__state">${at ? `${U.fullDate(at)}に達成。` : ''}受け取りました。</p>`
        : `<p class="road__state">${at ? `${U.fullDate(at)}に` : ''}達成しました。</p>
           ${VIEW ? '' : `<button type="button" class="btn btn--primary btn--sm" data-action="claim" data-id="${esc(r.id)}">${ICON.check}受け取った</button>`}`;
    } else {
      body = `${Charts.meter(info.ratio, `${r.title}までの進み具合`)}
        <p class="road__rest"><span>あと ${durHTML(info.remain)}</span><span class="road__pct">${Math.floor(info.ratio * 100)}%</span></p>`;
    }
    return `
      <li class="road__item ${cls}">
        <span class="road__node" aria-hidden="true">${info.achieved ? ICON.check : ''}</span>
        <div class="road__body">
          <p class="road__goal"><span class="num">${r.hours.toLocaleString('ja-JP')}</span><span class="unit">時間</span>
            ${subj ? `<span class="tag"><span class="dot" style="--c:${colorVar(subj.color)}"></span>${esc(subj.name)}だけ</span>` : ''}</p>
          <p class="road__title">${esc(r.title)}</p>
          ${body}
        </div>
        ${VIEW ? '' : `<button type="button" class="icon-btn icon-btn--quiet" data-action="edit-reward" data-id="${esc(r.id)}" aria-label="「${esc(r.title)}」を編集">${ICON.edit}</button>`}
      </li>`;
  }

  function viewRewards() {
    const kind = shownKind();
    const K = KIND_INFO[kind];
    const sessions = sessionsOf(kind);
    const total = U.sumSec(sessions);
    const first = sessions.length ? Math.min(...sessions.map((s) => s.start)) : null;
    const infos = Store.state.rewards.filter((r) => rewardKind(r) === kind).map(rewardInfo)
      .sort((a, b) => a.r.hours - b.r.hours || a.r.title.localeCompare(b.r.title, 'ja'));
    const next = infos.filter((i) => !i.achieved).sort((a, b) => a.remain - b.remain)[0];
    const subjectsWithTime = breakdownRows(sessions);
    const example = kind === 'reading' ? '「読書の合計30時間で、新しい本を1冊」' : '「合計100時間で、ちょっといいランチ」';

    return `
    ${kindTabsHTML()}
    <div class="rewards">
      <section class="rw-hero" aria-labelledby="rw-total-h">
        <h2 class="label" id="rw-total-h">これまでの${K.name}時間</h2>
        <p class="hero-num hero-num--xl">${durHTML(total)}</p>
        ${first ? `<p class="meta">${U.fullDate(first)}から記録しています。</p>`
          : `<p class="meta">${VIEW ? 'まだ記録がありません。' : '記録をつけると、ここに合計が出ます。'}</p>`}
        ${subjectsWithTime.length ? `
        <ul class="rw-subjects" aria-label="${K.noun}ごとの合計">${subjectsWithTime.sort((a, b) => b.seconds - a.seconds).map((s) => `
          <li><span class="dot" style="--c:${colorVar(s.color)}"></span><span class="rw-subjects__name">${esc(s.name)}</span><span class="rw-subjects__val">${esc(durText(s.seconds))}</span></li>`).join('')}
        </ul>` : ''}
      </section>

      <section class="panel road" aria-labelledby="road-h">
        <div class="sec-head">
          <h2 class="sec-title" id="road-h">${hasReading() ? `${K.name}のごほうび` : 'ごほうび'}</h2>
          ${VIEW ? '' : `<button type="button" class="btn btn--text" data-action="add-reward" data-kind="${kind}">${ICON.plus}追加</button>`}
        </div>
        ${infos.length
          ? `<ol class="road__list">${infos.map((i) => roadItem(i, next && i.r.id === next.r.id)).join('')}</ol>`
          : VIEW ? '<p class="empty">まだごほうびは決まっていません。</p>'
          : `<div class="empty empty--action">
              <p>まだごほうびがありません。</p>
              <p>${example}のように、時間と内容を決めておけます。</p>
              <button type="button" class="btn btn--primary" data-action="add-reward" data-kind="${kind}">${ICON.plus}ごほうびを追加</button>
            </div>`}
      </section>
    </div>`;
  }

  /* ---------- いまの様子（見るだけの画面の一番上に出す） ---------- */

  /** 例：今日 14:30 / 昨日 21:10 / 10月28日 21:10（今年でなければ年もつける） */
  function whenLabel(t, now = Date.now()) {
    const day = U.startOfDay(t);
    const today = U.startOfDay(now);
    const time = U.timeLabel(t);
    if (day === today) return `今日 ${time}`;
    if (day === U.startOfDay(today - 1)) return `昨日 ${time}`;
    const d = new Date(t);
    const y = d.getFullYear() === new Date(now).getFullYear() ? '' : `${d.getFullYear()}年`;
    return `${y}${d.getMonth() + 1}月${d.getDate()}日 ${time}`;
  }

  /** 「いまの様子」の欄が、どの状態か（書き直しが要るかの判断にも使う） */
  function nowState() {
    if (!Store.fresh) return Store.status.kind === 'error' ? 'unknown' : 'checking';
    return Store.state.timer.state; // running / paused / idle
  }

  function nowHTML() {
    const t = Store.state.timer;
    const st = nowState();
    if (st === 'checking' || st === 'unknown') {
      return `
      <section class="now now--idle" aria-label="いまの様子">
        <p class="now__state">${st === 'checking' ? 'いまの様子を確かめています…' : 'いまの様子を読み込めませんでした。'}</p>
      </section>`;
    }
    if (st === 'idle') {
      const { sessions } = Store.state;
      const now = Date.now();
      const day = U.periodRange('day', now);
      const last = sessions.length ? Math.max(...sessions.map((s) => s.end || s.start)) : 0;
      const lastLine = last ? `<p class="now__line">最後の記録：${esc(whenLabel(last, now))}</p>` : '';
      if (hasReading()) {
        const todayOf = (k) => esc(durText(U.sumSec(U.inRange(sessionsOf(k), day))));
        return `
        <section class="now now--idle" aria-label="いまの様子">
          <p class="now__state">いまは勉強も読書もしていません</p>
          ${lastLine}
          <p class="now__line now__today"><span>今日の勉強：${todayOf('study')}</span><span>今日の読書：${todayOf('reading')}</span></p>
        </section>`;
      }
      const today = U.sumSec(U.inRange(sessions, day));
      return `
      <section class="now now--idle" aria-label="いまの様子">
        <p class="now__state">いまは勉強していません</p>
        ${lastLine}
        <p class="now__line">${today ? `今日の合計：${esc(durText(today))}` : '今日はまだ勉強していません'}</p>
      </section>`;
    }
    const subs = timerSubjectIds(t).map(subjectOf);
    const running = st === 'running';
    return `
    <section class="now now--${st}" aria-label="いまの様子">
      <p class="now__state">${running ? `<span class="now__pulse" aria-hidden="true"></span>いま${KIND_INFO[timerKind(t)].doing}` : `${ICON.pause}一時停止中`}</p>
      <p class="now__main">
        <span class="now__subject">${dotHTML(subs)}<span>${esc(namesText(subs))}</span></span>
        <span class="now__clock" role="timer" data-now-clock>${clockHTML(elapsedMs(t))}</span>
      </p>
    </section>`;
  }

  /* ---------- 合言葉（GitHub Pages などに置いたとき、端末ごとに1回入れる） ---------- */
  function tokenFormHTML(lead, note = '') {
    return `
      <div class="token-form">
        ${lead ? `<p>${lead}</p>` : ''}
        <label class="field__label" for="token-input">合言葉</label>
        <input type="text" id="token-input" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Apps Script で作った合言葉">
        <button type="button" class="btn btn--primary" data-action="save-token">保存してつなぐ</button>
        <p class="help">この端末に覚えておくので、入れるのは1回だけです。<br>合言葉は、Apps Script の「setup」を実行したときのログに出ます。</p>
        ${note ? `<p class="help">${note}</p>` : ''}
      </div>`;
  }

  /* ---------- 見る用リンク（持ち主の設定画面に出す） ---------- */
  function shareUrl(key) {
    return new URL(`./?view=${encodeURIComponent(key)}`, location.href).href;
  }

  function shareHTML() {
    if (!Store.usesToken) return '';
    const url = Store.shareKey ? shareUrl(Store.shareKey) : '';
    return `
      <section class="panel" aria-labelledby="share-h">
        <div class="sec-head"><h2 class="sec-title" id="share-h">見る用リンク</h2></div>
        <p class="help">このリンクを開いた人は、記録とごほうびを見られます。<br>${hasReading() ? 'いま勉強中・読書中かどうか' : 'いま勉強中かどうか'}と、メモも見えます。<br>編集はできません。</p>
        ${url ? `
        <input type="text" class="share-url" id="share-url" value="${esc(url)}" readonly aria-label="見る用リンク">
        <div class="btn-row">
          <button type="button" class="btn btn--primary" data-action="copy-share">${ICON.copy}リンクをコピー</button>
          <a class="btn btn--outline" href="${esc(url)}" target="_blank" rel="noopener">${ICON.external}開いてみる</a>
        </div>
        <p class="help">リンクを見られたくない人に知られたときは、Apps Script で「resetViewKey」を実行すると、作り直せます。<br>前のリンクは使えなくなります。</p>`
        : '<p class="help">同期が終わると、ここにリンクが出ます。</p>'}
      </section>`;
  }

  /* ---------- 設定 ---------- */
  /** 科目（読書ではジャンル）の一覧。並べかえは同じ種類の中だけ */
  function subjectListHTML(kind) {
    const list = Store.subjects(true, kind);
    const counts = U.bySubject(Store.state.sessions);
    if (!list.length) return `<p class="empty">まだ${KIND_INFO[kind].noun}がありません。</p>`;
    return `<ul class="subj-list">${list.map((s, i) => `
      <li class="subj${s.archived ? ' is-archived' : ''}">
        <span class="dot" style="--c:${colorVar(s.color)}"></span>
        <span class="subj__name">${esc(s.name)}${s.archived ? '<span class="tag">非表示</span>' : ''}</span>
        <span class="subj__total">${esc(durText(counts.get(s.id) ? counts.get(s.id).seconds : 0))}</span>
        <span class="subj__ops">
          <button type="button" class="icon-btn icon-btn--quiet" data-action="move-subject" data-id="${esc(s.id)}" data-dir="-1" aria-label="${esc(s.name)}を上へ"${i === 0 ? ' disabled' : ''}>${ICON.up}</button>
          <button type="button" class="icon-btn icon-btn--quiet" data-action="move-subject" data-id="${esc(s.id)}" data-dir="1" aria-label="${esc(s.name)}を下へ"${i === list.length - 1 ? ' disabled' : ''}>${ICON.down}</button>
          <button type="button" class="icon-btn icon-btn--quiet" data-action="edit-subject" data-id="${esc(s.id)}" aria-label="${esc(s.name)}を編集">${ICON.edit}</button>
        </span>
      </li>`).join('')}
    </ul>`;
  }

  /**
   * 読書のジャンルを足せるか。
   * Apps Script が古い版だと「種類」が保存されず、足したジャンルが勉強の科目になってしまうので、新しい版と分かるまで足させない
   */
  const canAddReading = () => Store.mode !== 'gas' || Store.serverVersion >= 2;

  function viewSettings() {
    const mode = Store.mode;
    const oldServer = mode === 'gas' && Store.fresh && Store.serverVersion < 2;

    let dataHTML;
    if (mode === 'gas') {
      const st = Store.status;
      dataHTML = `
        <dl class="kv">
          <div><dt>保存先</dt><dd>Googleスプレッドシート（スマホとパソコンで共有）</dd></div>
          <div><dt>最後に同期した時刻</dt><dd>${st.lastSync ? `${U.dateLabel(st.lastSync)} ${U.timeLabel(st.lastSync)}` : 'まだ同期していません'}</dd></div>
          ${Store.pending ? `<div><dt>まだ送っていない変更</dt><dd>${Store.pending}件（つながったら自動で送ります）</dd></div>` : ''}
          ${st.kind === 'error' ? `<div><dt>同期できない理由</dt><dd>${esc(st.message)}</dd></div>` : ''}
        </dl>
        ${Store.usesToken && (st.auth || !Store.hasToken) ? tokenFormHTML('') : ''}
        <div class="btn-row">
          <button type="button" class="btn btn--outline" data-action="sync-now">${ICON.sync}今すぐ同期</button>
          ${Store.spreadsheetUrl ? `<a class="btn btn--outline" href="${esc(Store.spreadsheetUrl)}" target="_blank" rel="noopener">${ICON.external}スプレッドシートを開く</a>` : ''}
        </div>
        <p class="help">記録はスプレッドシートにそのまま残るので、バックアップにもなります。</p>`;
    } else if (mode === 'demo') {
      dataHTML = `
        <dl class="kv"><div><dt>保存先</dt><dd>保存しません（デモ表示）</dd></div></dl>
        <p class="help">見本のデータを表示しています。<br>ここでの操作は、ページを閉じると消えます。</p>`;
    } else {
      dataHTML = `
        <dl class="kv"><div><dt>保存先</dt><dd>このブラウザの中だけ</dd></div></dl>
        <p class="help">ほかの端末とは共有されません。<br>スマホとパソコンで同じ記録を見るには、Googleスプレッドシートとつなぎます。<br>手順は「セットアップ手順.md」にまとめています。</p>`;
    }

    return `
    <div class="settings">
      <section class="panel" aria-labelledby="subj-h">
        <div class="sec-head">
          <h2 class="sec-title" id="subj-h">勉強の科目</h2>
          <button type="button" class="btn btn--text" data-action="add-subject" data-kind="study">${ICON.plus}科目を追加</button>
        </div>
        <p class="help">並び順は、タイマーの科目ボタンの順番です。<br>使わなくなった科目は、編集から非表示にできます。</p>
        ${subjectListHTML('study')}
      </section>

      <section class="panel" aria-labelledby="genre-h">
        <div class="sec-head">
          <h2 class="sec-title" id="genre-h">読書のジャンル</h2>
          ${canAddReading() ? `<button type="button" class="btn btn--text" data-action="add-subject" data-kind="reading">${ICON.plus}ジャンルを追加</button>` : ''}
        </div>
        <p class="help">読書の時間は、勉強時間とは別に数えます。<br>並び順は、タイマーのジャンルボタンの順番です。</p>
        ${oldServer ? '<p class="notice">ジャンルを足すには、Apps Script を新しい版にしてください（「セットアップ手順.md」の「アプリを新しくしたとき」）。いまの版では、ジャンルが勉強の科目として保存されてしまいます。</p>' : ''}
        ${subjectListHTML('reading')}
      </section>

      <section class="panel" aria-labelledby="data-h">
        <div class="sec-head"><h2 class="sec-title" id="data-h">データ</h2></div>
        ${dataHTML}
        <h3 class="sub-title">バックアップ</h3>
        <p class="help">記録をファイルに書き出したり、書き出したファイルを読み込んだりできます。<br>ブラウザ版からスプレッドシート版へ記録を移すときにも使えます。</p>
        <div class="btn-row">
          ${mode === 'gas' ? '' : `<button type="button" class="btn btn--outline" data-action="export">${ICON.download}書き出す</button>`}
          <button type="button" class="btn btn--outline" data-action="import">${ICON.upload}読み込む</button>
        </div>
      </section>

      ${shareHTML()}

      <section class="panel" aria-labelledby="rule-h">
        <div class="sec-head"><h2 class="sec-title" id="rule-h">集計のルール</h2></div>
        <ul class="rules">
          <li>週は月曜日から日曜日で数えます。</li>
          <li>日をまたいだ記録は、始めた日の記録になります。</li>
          <li>一時停止していた時間は、記録に入りません。</li>
          <li>読書の時間は、勉強時間とは別に数えます（勉強の合計やごほうびには入りません）。</li>
        </ul>
      </section>
    </div>`;
  }

  function loadingHTML() {
    const failed = Store.status.kind === 'error';
    if (VIEW) {
      return `
      <div class="loading" role="status">
        ${MARK}
        ${failed && Store.status.auth
          ? '<p>この見る用リンクは、使えなくなっています。</p><p class="help">新しいリンクをもらってください。</p>'
          : failed
          ? `<p>記録を読み込めませんでした。</p><p class="help">${esc(Store.status.message)}</p>
             <button type="button" class="btn btn--primary" data-action="sync-now">${ICON.sync}もう一度読み込む</button>`
          : `<p>${esc(VIEW_TITLE)}を読み込んでいます。</p>`}
      </div>`;
    }
    return `
    <div class="loading" role="status">
      ${MARK}
      ${failed && Store.status.auth
        ? (Store.hasToken
          ? tokenFormHTML('合言葉が違うようです。入れなおしてください。')
          : tokenFormHTML('このページの持ち主の方は、合言葉を入れてください。', '見る用のリンクをもらった方は、そのリンクから開いてください。'))
        : failed
        ? `<p>スプレッドシートから読み込めませんでした。</p><p class="help">${esc(Store.status.message)}</p>
           <button type="button" class="btn btn--primary" data-action="sync-now">${ICON.sync}もう一度読み込む</button>`
        : '<p>スプレッドシートから記録を読み込んでいます。</p>'}
    </div>`;
  }

  const VIEWS = { timer: viewTimer, stats: viewStats, rewards: viewRewards, settings: viewSettings };

  /* ======================================================================
     描画
     ====================================================================== */
  const view = $('#view');

  function renderNav() {
    $('#nav').innerHTML = ROUTES.map((r) => `
      <a href="#/${r.id}" data-route="${r.id}"${r.id === route ? ' aria-current="page"' : ''}>
        <span class="nav__icon">${r.icon}</span><span class="nav__label">${r.label}</span>
      </a>`).join('');
  }

  function renderSync() {
    const el = $('#sync');
    const s = Store.status;
    let icon = ICON.device;
    let text = 'このブラウザに保存';
    let cls = '';
    if (VIEW) {
      // 見るだけの画面：ふだんは「見るだけ」。1分ごとの読み込みでは、表示を変えない（ちらつかせない）
      if (s.kind === 'error') { icon = ICON.alert; text = s.auth ? 'リンクが使えません' : 'つながりません'; cls = ' is-error'; }
      else if (!Store.fresh) { icon = ICON.sync; text = '読み込み中'; cls = ' is-syncing'; }
      else { icon = ICON.eye; text = '見るだけ'; cls = ' is-view'; }
      el.className = `sync${cls}`;
      el.innerHTML = `${icon}<span>${text}</span>`;
      el.title = s.lastSync ? `見るだけのページです。最後に読み込んだ時刻：${U.timeLabel(s.lastSync)}（押すと最新にします）` : '見るだけのページです（押すと最新にします）';
      return;
    }
    if (Store.mode === 'demo') {
      text = 'デモ表示（保存しません）';
    } else if (Store.mode === 'gas') {
      if (s.kind === 'syncing') { icon = ICON.sync; text = '同期中'; cls = ' is-syncing'; }
      else if (s.kind === 'error' && s.auth) { icon = ICON.alert; text = Store.hasToken ? '合言葉が違います' : '合言葉が必要です'; cls = ' is-error'; }
      else if (s.kind === 'error') { icon = ICON.alert; text = Store.pending ? `未同期 ${Store.pending}件` : '同期できません'; cls = ' is-error'; }
      else { icon = ICON.check; text = '同期済み'; }
    }
    el.className = `sync${cls}`;
    el.innerHTML = `${icon}<span>${text}</span>`;
    el.title = Store.mode === 'gas'
      ? (s.lastSync ? `最後に同期した時刻：${U.timeLabel(s.lastSync)}（押すと今すぐ同期）` : '押すと今すぐ同期')
      : 'データの保存先を見る';
  }

  /** 見るだけの画面のタブの名前（勉強中・読書中は時間も出す） */
  function viewTitle() {
    const t = Store.state.timer;
    const st = nowState();
    if (st === 'running') return `${KIND_INFO[timerKind(t)].doing} ${U.clockParts(elapsedMs(t)).join(':')}｜${VIEW_TITLE}`;
    if (st === 'paused') return `一時停止中｜${VIEW_TITLE}`;
    return BASE_TITLE;
  }

  /** 書き直しの前後で、フォーカスしていたボタンを戻す */
  function focusKey(el) {
    if (!el || !view.contains(el) || !el.dataset || !el.dataset.action) return '';
    return `${el.dataset.action}|${el.dataset.id || ''}|${el.dataset.value || ''}|${el.dataset.dir || ''}`;
  }

  let renderedDay = 0;
  let shownNow = ''; // 見るだけの画面で、いま出している「いまの様子」の状態

  function render() {
    const key = focusKey(document.activeElement);
    renderedDay = U.startOfDay(Date.now());
    document.body.dataset.route = route;
    renderNav();
    renderSync();
    if (!Store.ready) {
      view.innerHTML = loadingHTML();
      shownNow = '';
      return;
    }
    if (VIEW) {
      shownNow = nowState();
      view.innerHTML = nowHTML() + VIEWS[route]();
      document.title = viewTitle();
    } else {
      view.innerHTML = VIEWS[route]();
      if (Store.state.timer.state === 'idle') document.title = BASE_TITLE;
    }
    if (key) {
      const el = [...view.querySelectorAll('[data-action]')].find((x) => focusKey(x) === key);
      if (el) el.focus({ preventScroll: true });
    }
  }

  /* ---------- 1秒ごとの更新（タイマーの数字と、計測中の合計） ---------- */
  let lastSecond = -1;
  let lastMinute = -1;
  function tick() {
    const t = Store.state.timer;
    if (t.state === 'idle' || !Store.ready) return;
    const ms = elapsedMs(t);
    const sec = Math.floor(ms / 1000);
    if (sec === lastSecond) return;
    lastSecond = sec;
    if (VIEW) {
      // 見るだけの画面：「いまの様子」の時間を、この端末の中で1秒ずつ進める（通信はしない）
      if (!Store.fresh) return;
      document.title = viewTitle();
      const now = view.querySelector('[data-now-clock]');
      if (now) now.innerHTML = clockHTML(ms);
      return;
    }
    document.title = `${U.clockParts(ms).join(':')}｜つみあげ`;
    if (route !== 'timer') return;
    const clock = view.querySelector('[data-clock]');
    if (clock) clock.innerHTML = clockHTML(ms);
    const min = Math.floor(sec / 60);
    if (min !== lastMinute) {
      lastMinute = min;
      view.querySelectorAll('[data-live-base]').forEach((el) => {
        const total = Number(el.dataset.liveBase) + liveExtra(Number(el.dataset.liveFrom));
        el.innerHTML = durHTML(total, { compact: el.hasAttribute('data-compact') });
      });
    }
  }

  /* ======================================================================
     ダイアログ
     ====================================================================== */
  const dlg = $('#dialog');
  let submitHandler = null;
  let openerKey = '';

  /** setup(form) は、開く前に入力欄の動きをつなぐための関数 */
  function openDialog(html, onSubmit, setup) {
    if (dlg.open) dlg.close();
    else openerKey = focusKey(document.activeElement);
    dlg.innerHTML = html;
    submitHandler = onSubmit || null;
    if (setup) setup(dlg.querySelector('form'));
    dlg.showModal();
  }
  function closeDialog() {
    if (dlg.open) dlg.close();
  }
  dlg.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const error = submitHandler ? submitHandler(new FormData(form), form) : '';
    const box = form.querySelector('.form-error');
    if (error) {
      if (box) {
        box.textContent = error;
        box.hidden = false;
      }
      return;
    }
    closeDialog();
  });
  // 画面の外側（暗いところ）を押したら閉じる
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDialog(); });
  // close イベントは少し遅れて届くので、すでに次のダイアログを開いていたら消さない
  dlg.addEventListener('close', () => {
    if (dlg.open) return;
    dlg.innerHTML = '';
    submitHandler = null;
    // 画面を書き直していても、ダイアログを開いたボタンにフォーカスを戻す
    if (openerKey && (document.activeElement === document.body || !document.activeElement)) {
      const el = [...view.querySelectorAll('[data-action]')].find((x) => focusKey(x) === openerKey);
      if (el) el.focus({ preventScroll: true });
    }
    openerKey = '';
  });

  /** 科目のえらび方（その種類の科目から、いくつでも。チェックボックスを科目ボタンの見た目にする） */
  function subjectPicker(selectedIds, kind) {
    const list = Store.subjects(true, kind).filter((s) => !s.archived || selectedIds.includes(s.id));
    selectedIds.forEach((id) => { if (!list.some((s) => s.id === id)) list.push(subjectOf(id)); });
    return `
      <fieldset class="field">
        <legend class="field__label">${KIND_INFO[kind].noun}<span class="field__opt">（いくつでもえらべます）</span></legend>
        <div class="pick">${list.map((s) => `
          <label class="pick__opt">
            <input type="checkbox" name="subject" value="${esc(s.id)}"${selectedIds.includes(s.id) ? ' checked' : ''}>
            <span class="chip"><span class="dot" style="--c:${colorVar(s.color)}"></span>${esc(s.name)}</span>
          </label>`).join('')}
        </div>
      </fieldset>`;
  }
  function durationFields(totalSec, kind) {
    const K = KIND_INFO[kind];
    const { h, m } = U.splitHM(totalSec);
    return `
      <fieldset class="field">
        <legend class="field__label">${K.name}時間</legend>
        <div class="dur-input">
          <label><input type="number" name="h" value="${h}" min="0" max="24" inputmode="numeric" aria-label="時間"><span>時間</span></label>
          <label><input type="number" name="m" value="${m}" min="0" max="59" inputmode="numeric" aria-label="分"><span>分</span></label>
        </div>
      </fieldset>
      <div class="split" data-split hidden>
        <p class="field__label">${K.noun}ごとの内訳</p>
        <ul class="split__list"></ul>
        <p class="help">${K.name}時間を、えらんだ${K.noun}で等分しています。<br>${K.noun}ごとに直すこともできます。</p>
      </div>`;
  }
  function memoField(value, kind) {
    return `
      <label class="field"><span class="field__label">メモ<span class="field__opt">（なくてもOK）</span></span>
        <textarea name="memo" rows="3" maxlength="1000" placeholder="${kind === 'reading' ? '読んだ本、気づいたこと' : 'やったこと、気づいたこと'}">${esc(value)}</textarea>
      </label>`;
  }
  const actionsRow = (primary, cancel = 'キャンセル') => `
      <p class="form-error" role="alert" hidden></p>
      <div class="dlg__actions">
        <button type="submit" class="btn btn--primary">${primary}</button>
        <button type="button" class="btn btn--quiet" data-action="close-dialog">${cancel}</button>
      </div>`;

  /**
   * 科目と時間の入力欄をつなぐ。
   * - 科目が2つ以上なら、勉強時間を等分した「内訳」を出す
   * - 勉強時間を直したら内訳を等分し直し、内訳を直したら勉強時間をその合計にする
   * - 時間を何も直さなければ、秒まで正確な時間で記録する
   * init: { total: 最初の秒数, split: 科目ごとの最初の秒数（Map。編集のとき）, kind: 勉強か読書か }
   * 戻り値の関数で、えらんだ科目と科目ごとの秒数を読み取る
   */
  function wireTime(form, init) {
    const K = KIND_INFO[init.kind];
    const hEl = form.elements.h;
    const mEl = form.elements.m;
    const box = form.querySelector('[data-split]');
    const list = box.querySelector('.split__list');
    let touched = false; // 時間を手で直したか
    let changedPick = false; // 科目のえらび方を変えたか

    const picked = () => [...form.querySelectorAll('input[name="subject"]:checked')].map((el) => el.value);
    const inputMinutes = () => int(hEl.value) * 60 + int(mEl.value);
    const keepsInitial = (ids) => !changedPick && init.split && ids.length === init.split.size && ids.every((id) => init.split.has(id));

    function drawSplit() {
      const ids = picked();
      box.hidden = ids.length < 2;
      if (ids.length < 2) {
        list.innerHTML = '';
        return;
      }
      const minutes = !touched && keepsInitial(ids)
        ? ids.map((id) => Math.floor(init.split.get(id) / 60))
        : splitEvenly(touched ? inputMinutes() : Math.floor(init.total / 60), ids);
      list.innerHTML = ids.map((id, i) => {
        const s = subjectOf(id);
        return `
          <li class="split__row">
            ${dotHTML([s])}
            <span class="split__name">${esc(s.name)}</span>
            <label class="split__min"><input type="number" data-split-id="${esc(id)}" value="${minutes[i]}" min="0" max="1440" inputmode="numeric" aria-label="${esc(s.name)}の時間（分）"><span>分</span></label>
          </li>`;
      }).join('');
    }

    form.addEventListener('change', (e) => {
      if (e.target.name !== 'subject') return;
      changedPick = true;
      drawSplit();
    });
    form.addEventListener('input', (e) => {
      if (e.target === hEl || e.target === mEl) {
        touched = true;
        drawSplit();
      } else if (e.target.dataset && e.target.dataset.splitId) {
        touched = true;
        const sum = [...list.querySelectorAll('[data-split-id]')].reduce((a, el) => a + int(el.value), 0);
        hEl.value = Math.floor(sum / 60);
        mEl.value = sum % 60;
      }
    });
    drawSplit();

    return function read() {
      const ids = picked();
      if (!ids.length) return { error: `${K.noun}を1つ以上えらんでください。` };
      if (ids.some((id) => kindOf(id) !== kindOf(ids[0]))) return { error: '勉強と読書は、いっしょに記録できません。' };
      let seconds;
      if (!touched) {
        seconds = keepsInitial(ids) ? ids.map((id) => init.split.get(id)) : splitEvenly(init.total, ids);
      } else if (ids.length === 1) {
        seconds = [inputMinutes() * 60];
      } else {
        const byId = new Map([...list.querySelectorAll('[data-split-id]')].map((el) => [el.dataset.splitId, int(el.value) * 60]));
        seconds = ids.map((id) => byId.get(id) || 0);
      }
      const total = seconds.reduce((a, b) => a + b, 0);
      if (total <= 0) return { error: `${K.name}時間を入力してください。` };
      if (total > 24 * 3600) return { error: `${K.name}時間は24時間以内で入力してください。` };
      if (seconds.some((v) => v <= 0)) return { error: `時間が0分の${K.noun}があります。時間を入れるか、その${K.noun}のチェックを外してください。` };
      return { ids, seconds, total };
    };
  }

  /**
   * 1回の勉強を保存する（科目ごとの記録に分けて、同じ groupId でつなぐ）。
   * 前の記録があれば同じIDを使い、外した科目の記録は消す。Store.batch の中で呼ぶ
   */
  function saveEntry({ prev = [], ids, seconds, start, end, memo }) {
    const oldGroup = (prev.find((r) => r.groupId) || {}).groupId;
    const groupId = ids.length > 1 ? oldGroup || U.uid('grp') : '';
    const reuse = new Map();
    const extra = [];
    prev.forEach((r) => { if (reuse.has(r.subjectId)) extra.push(r); else reuse.set(r.subjectId, r); });
    ids.forEach((subjectId, i) => {
      const old = reuse.get(subjectId);
      Store.put('sessions', { id: old ? old.id : U.uid('ses'), subjectId, start, end, seconds: seconds[i], memo, groupId });
      reuse.delete(subjectId);
    });
    [...reuse.values(), ...extra].forEach((r) => Store.remove('sessions', r.id));
  }

  /** 保存して、新しく達成したごほうびがあればお知らせする */
  function saveAndCelebrate(save, message) {
    const before = achievedIds();
    Store.batch(save);
    toast(message);
    const reached = Store.state.rewards.map(rewardInfo).filter((i) => i.achieved && !before.has(i.r.id));
    if (reached.length) setTimeout(() => celebrate(reached[0].r.id), 300);
  }

  /* ---------- タイマーを終了して記録する ---------- */
  function openStopDialog() {
    const t = Store.state.timer;
    if (t.state === 'idle') return;
    const stoppedAt = Date.now();
    const exact = Math.floor(elapsedMs(t, stoppedAt) / 1000);
    const kind = timerKind(t);
    let read = null;
    openDialog(`
      <form class="dlg" novalidate>
        <h2 class="dlg__title" id="dlg-title">記録する</h2>
        ${subjectPicker(timerSubjectIds(t), kind)}
        ${durationFields(exact, kind)}
        ${exact >= 8 * 3600 ? '<p class="dlg__note">8時間をこえています。止め忘れていたら、時間を直してから記録してください。</p>' : ''}
        ${memoField('', kind)}
        ${actionsRow('記録する', 'タイマーに戻る')}
        <button type="button" class="btn btn--danger-text dlg__sub" data-action="discard">記録せずに終わる</button>
      </form>`, (fd) => {
      const cur = Store.state.timer;
      if (cur.state === 'idle' || cur.startedAt !== t.startedAt) return 'このタイマーは、ほかの端末ですでに終了しています。';
      const r = read();
      if (r.error) return r.error;
      saveAndCelebrate(() => {
        saveEntry({ ids: r.ids, seconds: r.seconds, start: t.startedAt, end: stoppedAt, memo: String(fd.get('memo') || '').trim() });
        Store.setTimer(Store.idleTimer());
      }, `記録しました（${durText(r.total)}）`);
      return '';
    }, (form) => { read = wireTime(form, { total: exact, split: null, kind }); });
  }

  /* ---------- 記録の追加・編集 ---------- */
  /** kindForNew：新しく足すときの種類（編集のときは、記録の科目の種類になる） */
  function openSessionDialog(key, kindForNew = 'study') {
    const prev = key ? entryRecords(key) : [];
    if (key && !prev.length) return;
    const entry = prev.length ? toEntries(prev)[0] : null;
    const kind = entry ? kindOf(entry.items[0].subjectId) : (kindForNew === 'reading' ? 'reading' : 'study');
    const start = entry ? entry.start : Date.now() - 3600000;
    const total = entry ? entry.seconds : 3600;
    // 新しく足すときは、タイマーでえらんでいる科目を最初からえらんでおく（同じ種類のときだけ）
    const firstPicks = entry ? entry.items.map((s) => s.subjectId) : currentPicks().filter((id) => kindOf(id) === kind);
    let read = null;
    openDialog(`
      <form class="dlg" novalidate>
        <h2 class="dlg__title" id="dlg-title">${entry ? '記録を編集' : `${KIND_INFO[kind].name}の記録を追加`}</h2>
        ${subjectPicker(firstPicks, kind)}
        <div class="field-row">
          <label class="field"><span class="field__label">日付</span><input type="date" name="date" value="${U.toDateInput(start)}" required></label>
          <label class="field"><span class="field__label">始めた時刻</span><input type="time" name="time" value="${U.toTimeInput(start)}" required></label>
        </div>
        ${durationFields(total, kind)}
        ${memoField(entry ? entry.memo : '', kind)}
        ${actionsRow(entry ? '保存する' : '追加する')}
        ${entry ? `<button type="button" class="btn btn--danger-text dlg__sub" data-action="delete-session" data-id="${esc(entry.key)}">この記録を削除</button>` : ''}
      </form>`, (fd) => {
      const st = U.fromInputs(fd.get('date'), fd.get('time'));
      if (!Number.isFinite(st)) return '日付と始めた時刻を入力してください。';
      const r = read();
      if (r.error) return r.error;
      const startChanged = !entry || U.toDateInput(st) !== U.toDateInput(entry.start) || U.toTimeInput(st) !== U.toTimeInput(entry.start);
      const newStart = startChanged ? st : entry.start;
      const end = startChanged || r.total !== entry.seconds ? newStart + r.total * 1000 : entry.end;
      saveAndCelebrate(
        () => saveEntry({ prev, ids: r.ids, seconds: r.seconds, start: newStart, end, memo: String(fd.get('memo') || '').trim() }),
        entry ? '保存しました' : `記録しました（${durText(r.total)}）`,
      );
      return '';
    }, (form) => {
      read = wireTime(form, { total, split: entry ? new Map(entry.items.map((s) => [s.subjectId, s.seconds])) : null, kind });
    });
  }

  /* ---------- ごほうびの追加・編集 ---------- */
  /** kindForNew：新しく足すときの種類（編集のときは、ごほうびの種類のまま） */
  function openRewardDialog(id, kindForNew = 'study') {
    const r = id ? Store.state.rewards.find((x) => x.id === id) : null;
    if (id && !r) return;
    const info = r ? rewardInfo(r) : null;
    const kind = r ? rewardKind(r) : (kindForNew === 'reading' ? 'reading' : 'study');
    const K = KIND_INFO[kind];
    const subjects = Store.subjects(true, kind).filter((s) => !s.archived || (r && s.id === r.subjectId));
    openDialog(`
      <form class="dlg" novalidate>
        <h2 class="dlg__title" id="dlg-title">${r ? 'ごほうびを編集' : `${K.name}のごほうびを追加`}</h2>
        <label class="field"><span class="field__label">ごほうびの内容</span>
          <input type="text" name="title" maxlength="60" required value="${esc(r ? r.title : '')}" placeholder="${kind === 'reading' ? '例：新しい本を1冊' : '例：ちょっといいランチ'}">
        </label>
        <div class="field-row field-row--stack">
          <label class="field"><span class="field__label">目標の時間</span>
            <span class="with-unit"><input type="number" name="hours" min="1" max="100000" step="1" inputmode="numeric" required value="${r ? r.hours : ''}" placeholder="${kind === 'reading' ? '30' : '100'}"><span>時間</span></span>
          </label>
          <label class="field"><span class="field__label">数える${K.noun}</span>
            <select name="subjectId">
              <option value="">すべての${K.noun}の合計</option>
              ${subjects.map((s) => `<option value="${esc(s.id)}"${r && r.subjectId === s.id ? ' selected' : ''}>${esc(s.name)}だけ</option>`).join('')}
            </select>
          </label>
        </div>
        ${info && info.achieved ? `<label class="check"><input type="checkbox" name="claimed"${r.claimedAt ? ' checked' : ''}><span>受け取った</span></label>` : ''}
        ${actionsRow(r ? '保存する' : '追加する')}
        ${r ? `<button type="button" class="btn btn--danger-text dlg__sub" data-action="delete-reward" data-id="${esc(r.id)}">このごほうびを削除</button>` : ''}
      </form>`, (fd) => {
      const title = String(fd.get('title') || '').trim();
      if (!title) return 'ごほうびの内容を入力してください。';
      const hours = Number(fd.get('hours'));
      if (!Number.isFinite(hours) || hours < 1) return '目標の時間を1以上の数字で入力してください。';
      if (hours > 100000) return '目標の時間は100,000時間以内で入力してください。';
      const before = achievedIds();
      let claimedAt = r ? r.claimedAt : null;
      if (fd.has('claimed')) claimedAt = claimedAt || Date.now();
      else if (info && info.achieved) claimedAt = null;
      const saved = Store.put('rewards', { id: r ? r.id : U.uid('rew'), title, hours: Math.round(hours), subjectId: String(fd.get('subjectId') || ''), claimedAt, kind });
      toast(r ? '保存しました' : 'ごほうびを追加しました');
      // 追加した時点でもう届いていたら、お知らせする
      if (!r && rewardInfo(saved).achieved && !before.has(saved.id)) setTimeout(() => celebrate(saved.id), 300);
      return '';
    });
  }

  function celebrate(rewardId) {
    const r = Store.state.rewards.find((x) => x.id === rewardId);
    if (!r || r.claimedAt) return;
    openDialog(`
      <form class="dlg dlg--celebrate" novalidate>
        <div class="cele__badge" aria-hidden="true">${ICON.gift}</div>
        <h2 class="dlg__title" id="dlg-title">ごほうび達成</h2>
        <p class="cele__goal">${esc(scopeName(r))}が${r.hours.toLocaleString('ja-JP')}時間に届きました。</p>
        <p class="cele__title">${esc(r.title)}</p>
        ${actionsRow(`${ICON.check}受け取った`, 'あとで')}
      </form>`, () => {
      const cur = Store.state.rewards.find((x) => x.id === rewardId);
      if (cur) Store.put('rewards', { ...cur, claimedAt: Date.now() });
      toast('受け取りました');
      return '';
    });
  }

  /* ---------- 科目（読書ではジャンル）の追加・編集 ---------- */
  /** 同じ種類でまだ使っていない色（色の並び順で、先にあるもの） */
  function nextColor(kind) {
    const used = new Set(Store.subjects(false, kind).map((s) => s.color));
    return (COLORS.find((c) => !used.has(c.key)) || COLORS[0]).key;
  }

  /** kindForNew：新しく足すときの種類（種類は、あとから変えられない） */
  function openSubjectDialog(id, kindForNew = 'study') {
    const s = id ? Store.subject(id) : null;
    if (id && !s) return;
    const kind = s ? s.kind : (kindForNew === 'reading' ? 'reading' : 'study');
    const K = KIND_INFO[kind];
    const sessionsCount = s ? Store.state.sessions.filter((x) => x.subjectId === s.id).length : 0;
    const rewardsCount = s ? Store.state.rewards.filter((x) => x.subjectId === s.id).length : 0;
    const color = s ? s.color : nextColor(kind);
    const deleteArea = !s ? ''
      : sessionsCount || rewardsCount
        ? `<p class="dlg__note">記録やごほうびがある${K.noun}は削除できません。使わなくなったら「タイマーに表示する」をオフにしてください。</p>`
        : `<button type="button" class="btn btn--danger-text dlg__sub" data-action="delete-subject" data-id="${esc(s.id)}">この${K.noun}を削除</button>`;
    openDialog(`
      <form class="dlg" novalidate>
        <h2 class="dlg__title" id="dlg-title">${s ? `${K.noun}を編集` : `${K.noun}を追加`}</h2>
        <label class="field"><span class="field__label">${K.noun}名</span>
          <input type="text" name="name" maxlength="30" required value="${esc(s ? s.name : '')}" placeholder="${kind === 'reading' ? '例：小説' : '例：WordPress'}">
        </label>
        <fieldset class="field">
          <legend class="field__label">色</legend>
          <div class="swatches">${COLORS.map((c) => `
            <label class="swatch-opt" title="${c.name}">
              <input type="radio" name="color" value="${c.key}"${c.key === color ? ' checked' : ''}>
              <span class="swatch-opt__chip" style="--c:${colorVar(c.key)}"></span>
              <span class="sr-only">${c.name}</span>
            </label>`).join('')}
          </div>
        </fieldset>
        ${s ? `<label class="check"><input type="checkbox" name="visible"${s.archived ? '' : ' checked'}><span>タイマーに表示する</span></label>` : ''}
        ${actionsRow(s ? '保存する' : '追加する')}
        ${deleteArea}
      </form>`, (fd) => {
      const name = String(fd.get('name') || '').trim();
      if (!name) return `${K.noun}名を入力してください。`;
      if (Store.subjects(true, kind).some((x) => x.name === name && x.id !== id)) return `同じ名前の${K.noun}がすでにあります。`;
      const order = s ? s.order : Math.max(-1, ...Store.state.subjects.map((x) => x.order)) + 1;
      Store.put('subjects', {
        id: s ? s.id : U.uid('sub'),
        name,
        color: String(fd.get('color') || color),
        order,
        archived: s ? !fd.has('visible') : false,
        kind,
      });
      toast(s ? '保存しました' : `「${name}」を追加しました`);
      return '';
    });
  }

  /** 同じ種類の中で、1つ上か下と入れかえる（全体の並び順の番号は、ふり直す） */
  function moveSubject(id, dir) {
    const s = Store.subject(id);
    if (!s) return;
    const list = Store.subjects(true, s.kind);
    const i = list.indexOf(s);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const all = Store.subjects(true);
    const a = all.indexOf(list[i]);
    const b = all.indexOf(list[j]);
    [all[a], all[b]] = [all[b], all[a]];
    Store.batch(() => all.forEach((x, k) => { if (x.order !== k) Store.put('subjects', { ...x, order: k }); }));
  }

  /* ======================================================================
     ボタンの動き
     ====================================================================== */
  // 見るだけの画面で使えるのは、表示を切りかえる操作と、最新にする操作だけ
  const VIEW_ACTIONS = new Set(['kind', 'period', 'period-prev', 'period-next', 'period-now', 'breakdown', 'more', 'sync-click', 'sync-now']);
  const actions = {
    // 科目ボタンは押すたびに「えらぶ／外す」が切りかわる（同じ種類なら、いくつでもえらべる）
    // ちがう種類（勉強と読書）のボタンを押したら、そちらだけをえらんだ状態にする
    pick(el) {
      const s = Store.subject(el.dataset.id);
      if (!s) return;
      const picks = currentPicks();
      const chosen = new Set(picks.length && kindOf(picks[0]) === s.kind ? picks : []);
      if (chosen.has(s.id)) chosen.delete(s.id);
      else chosen.add(s.id);
      ui.selectedIds = Store.subjects().map((x) => x.id).filter((id) => chosen.has(id));
      ui.pickKind = s.kind;
      saveUi();
      render();
    },
    start() {
      const ids = currentPicks();
      if (!ids.length) return;
      const now = Date.now();
      Store.setTimer({ state: 'running', subjectIds: ids, startedAt: now, runningSince: now, elapsedMs: 0 });
    },
    pause() {
      const t = Store.state.timer;
      if (t.state === 'running') Store.setTimer({ ...t, state: 'paused', elapsedMs: elapsedMs(t), runningSince: null });
    },
    resume() {
      const t = Store.state.timer;
      if (t.state === 'paused') Store.setTimer({ ...t, state: 'running', runningSince: Date.now() });
    },
    stop: openStopDialog,
    discard() {
      const K = KIND_INFO[timerKind(Store.state.timer)];
      if (!window.confirm(`この${K.name}時間を記録せずに、タイマーを終わりますか？`)) return;
      Store.setTimer(Store.idleTimer());
      closeDialog();
      toast('記録せずに終わりました');
    },
    'add-session'(el) { openSessionDialog(null, el.dataset.kind); },
    'edit-session'(el) { openSessionDialog(el.dataset.id); },
    'delete-session'(el) {
      if (!window.confirm('この記録を削除しますか？\n削除すると元に戻せません。')) return;
      const records = entryRecords(el.dataset.id); // まとめて勉強した記録は、科目の分もいっしょに消す
      Store.batch(() => records.forEach((r) => Store.remove('sessions', r.id)));
      closeDialog();
      toast('記録を削除しました');
    },
    kind(el) {
      ui.kind = el.dataset.value === 'reading' ? 'reading' : 'study';
      ui.listLimit = 40;
      saveUi();
      render();
    },
    period(el) {
      ui.period = el.dataset.value;
      ui.listLimit = 40;
      saveUi();
      render();
    },
    'period-prev'() {
      ui.anchor = U.shiftPeriod(ui.period, ui.anchor, -1);
      ui.listLimit = 40;
      render();
    },
    'period-next'() {
      const next = U.shiftPeriod(ui.period, ui.anchor, 1);
      if (next > Date.now()) return;
      ui.anchor = next;
      ui.listLimit = 40;
      render();
    },
    'period-now'() {
      ui.anchor = Date.now();
      ui.listLimit = 40;
      render();
    },
    breakdown(el) {
      ui.breakdown = el.dataset.value;
      saveUi();
      render();
    },
    more() {
      ui.listLimit += 40;
      render();
    },
    'add-reward'(el) { openRewardDialog(null, el.dataset.kind); },
    'edit-reward'(el) { openRewardDialog(el.dataset.id); },
    'delete-reward'(el) {
      if (!window.confirm('このごほうびを削除しますか？')) return;
      Store.remove('rewards', el.dataset.id);
      closeDialog();
      toast('ごほうびを削除しました');
    },
    claim(el) {
      const r = Store.state.rewards.find((x) => x.id === el.dataset.id);
      if (!r) return;
      Store.put('rewards', { ...r, claimedAt: Date.now() });
      toast('受け取りました');
    },
    'add-subject'(el) {
      if (el.dataset.kind === 'reading' && !canAddReading()) return;
      openSubjectDialog(null, el.dataset.kind);
    },
    'edit-subject'(el) { openSubjectDialog(el.dataset.id); },
    'delete-subject'(el) {
      const s = Store.subject(el.dataset.id);
      if (!s || !window.confirm(`「${s.name}」を削除しますか？`)) return;
      Store.remove('subjects', s.id);
      closeDialog();
      toast(`${KIND_INFO[s.kind].noun}を削除しました`);
    },
    'move-subject'(el) { moveSubject(el.dataset.id, Number(el.dataset.dir)); },
    'sync-click'() {
      if (Store.mode === 'gas' || VIEW) Store.sync();
      else navigate('settings');
    },
    'sync-now'() { Store.sync(); },
    async 'copy-share'() {
      if (!Store.shareKey) return;
      const url = shareUrl(Store.shareKey);
      try {
        await navigator.clipboard.writeText(url);
        toast('見る用リンクをコピーしました');
      } catch (e) {
        // コピーできない環境では、リンクを選んだ状態にして、手でコピーしてもらう
        const input = $('#share-url');
        if (input) {
          input.focus();
          input.select();
        }
        toast('リンクを選びました。コピーしてください');
      }
    },
    'save-token'() {
      const input = $('#token-input');
      const value = input ? input.value.trim() : '';
      if (!value) {
        toast('合言葉を入れてください');
        return;
      }
      Store.setToken(value);
    },
    export() {
      const d = new Date();
      const name = `tsumiage-backup-${d.getFullYear()}${U.pad2(d.getMonth() + 1)}${U.pad2(d.getDate())}.json`;
      const blob = new Blob([JSON.stringify(Store.exportData(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast('ファイルに書き出しました');
    },
    import() { $('#import-file').click(); },
    'close-dialog': closeDialog,
  };

  /**
   * 画面の切りかえ。Apps Script では画面が枠（iframe）の中で動くので、
   * リンクの移動にまかせず、ここで切りかえてからURLの # だけそろえる
   */
  function navigate(id) {
    if (!ROUTES.some((r) => r.id === id)) return;
    if (route !== id) {
      route = id;
      render();
      window.scrollTo(0, 0);
    }
    try {
      if (location.hash !== `#/${id}`) history.replaceState(null, '', `#/${id}`);
    } catch (e) { /* URLを変えられない環境でも、画面は切りかわる */ }
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#/"]');
    if (link) {
      e.preventDefault();
      // タイマー画面の「次のごほうび」から開いたときは、同じ種類（勉強／読書）のごほうびを出す
      if (KINDS.includes(link.dataset.kind)) {
        ui.kind = link.dataset.kind;
        saveUi();
      }
      navigate(link.getAttribute('href').slice(2));
      return;
    }
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    if (VIEW && !VIEW_ACTIONS.has(el.dataset.action)) return;
    const fn = actions[el.dataset.action];
    if (fn) {
      e.preventDefault();
      fn(el, e);
    }
  });

  $('#import-file').addEventListener('change', async (e) => {
    if (VIEW) return;
    const input = e.target;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app !== 'tsumiage') throw new Error('つみあげのバックアップファイルではありません。');
      const n = (key) => (Array.isArray(data[key]) ? data[key].length : 0);
      const ok = window.confirm(`記録${n('sessions')}件、科目${n('subjects')}件、ごほうび${n('rewards')}件を読み込みます。\n同じデータがある場合は、ファイルの内容で上書きします。`);
      if (!ok) return;
      Store.importData(data);
      toast('読み込みました');
    } catch (err) {
      window.alert(`読み込めませんでした。\n${err.message}`);
    }
  });

  /* ---------- お知らせ（画面下に少し出る） ---------- */
  let toastTimer = 0;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 2600);
  }

  /* ======================================================================
     起動
     ====================================================================== */
  window.addEventListener('hashchange', () => {
    const next = routeFromHash();
    if (next === route) return;
    route = next;
    render();
    window.scrollTo(0, 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') render(); // 日付が変わっていても正しく出す
  });
  Store.on('data', render);
  Store.on('status', () => {
    renderSync();
    // 合言葉の入力欄は、読み込み中と設定画面に出る
    // 見るだけの画面では、「いまの様子」が「確かめています」から変わったときに書き直す
    if (!Store.ready || (route === 'settings' && Store.usesToken) || (VIEW && nowState() !== shownNow)) render();
  });

  // 見るだけの画面：名前を出して、ロゴから記録の画面へ戻れるようにする
  if (VIEW) {
    document.body.classList.add('is-view');
    $('.brand__name').textContent = VIEW_TITLE;
    $('.brand').setAttribute('href', `#/${ROUTES[0].id}`);
  }
  $('#brand-mark').innerHTML = MARK;
  Charts.setupTooltip();
  Store.init();
  render();
  setInterval(tick, 250);
  // 開いたまま日付が変わったら、「今日」を出し直す
  setInterval(() => {
    if (U.startOfDay(Date.now()) !== renderedDay && !dlg.open) render();
  }, 30 * 1000);

  // デモでは、URLでダイアログを開ける（見た目の確認用。例：?demo=running&open=stop）
  if (Store.mode === 'demo') {
    const open = new URLSearchParams(location.search).get('open');
    const firstSession = Store.state.sessions.slice().sort((a, b) => b.start - a.start)[0];
    const firstReward = Store.state.rewards[0];
    const openers = {
      stop: openStopDialog,
      session: () => openSessionDialog(firstSession && (firstSession.groupId || firstSession.id)),
      'group-session': () => {
        const grouped = Store.state.sessions.filter((s) => s.groupId).sort((a, b) => b.start - a.start)[0];
        if (grouped) openSessionDialog(grouped.groupId);
      },
      'new-session': () => openSessionDialog(null),
      'new-reading': () => openSessionDialog(null, 'reading'),
      reward: () => openRewardDialog(firstReward && firstReward.id),
      'new-reading-reward': () => openRewardDialog(null, 'reading'),
      subject: () => openSubjectDialog('sub_html'),
      'new-genre': () => openSubjectDialog(null, 'reading'),
      celebrate: () => celebrate('rew_demo2'),
    };
    if (openers[open]) openers[open]();
  }
})();
