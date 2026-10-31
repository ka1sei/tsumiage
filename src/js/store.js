/* ==========================================================================
   つみあげ — データの保存と同期
   - スプレッドシート版：Apps Script を通して Googleスプレッドシートに保存し、
     スマホとパソコンで同じ記録を見られるようにする
   - ブラウザ版：この端末のブラウザ（localStorage）にだけ保存する
   - デモ：見本のデータを表示する（何も保存しない）
   ========================================================================== */
'use strict';

/** 科目の色。並び順は、色覚の違いがあっても隣どうしを見分けやすい順（検証済み） */
const COLORS = [
  { key: 'blue', name: '青' },
  { key: 'orange', name: 'オレンジ' },
  { key: 'aqua', name: 'エメラルド' },
  { key: 'yellow', name: '黄色' },
  { key: 'magenta', name: 'ピンク' },
  { key: 'green', name: '緑' },
  { key: 'violet', name: '紫' },
  { key: 'red', name: '赤' },
];
const COLOR_KEYS = COLORS.map((c) => c.key);

/** 最初に入っている科目。Apps Script 側（Code.gs）の DEFAULT_SUBJECTS と同じにしておく */
const DEFAULT_SUBJECTS = [
  { id: 'sub_html', name: 'HTML', color: 'orange' },
  { id: 'sub_css', name: 'CSS', color: 'blue' },
  { id: 'sub_js', name: 'JavaScript', color: 'yellow' },
  { id: 'sub_ps', name: 'Photoshop', color: 'green' },
  { id: 'sub_ai', name: 'Illustrator', color: 'magenta' },
  { id: 'sub_figma', name: 'Figma', color: 'violet' },
];

const Store = (() => {
  const CACHE_KEY = 'tsumiage:data:v1';
  const TOKEN_KEY = 'tsumiage:token:v1';
  const hasGas = typeof google === 'object' && google && google.script && google.script.run;
  const wantsDemo = window.TSUMIAGE_DEMO || /[?&]demo/.test(location.search);
  // GitHub Pages などに置いた画面から、Apps Script のウェブアプリへ直接送る場合の宛先
  // （ファイルをダブルクリックして開いたときは、ブラウザ版として動かす）
  const apiUrl = String(window.TSUMIAGE_API_URL || '').trim();
  const useHttp = !hasGas && !wantsDemo && !!apiUrl && /^https?:$/.test(location.protocol);
  // 'gas' は「スプレッドシートに保存する版」のこと（送り方は hasGas か useHttp のどちらか）
  const mode = hasGas || useHttp ? 'gas' : wantsDemo ? 'demo' : 'local';

  let state = blankState();
  let outbox = []; // スプレッドシートにまだ送っていない変更
  let ready = false;
  let spreadsheetUrl = '';
  let token = '';
  try { token = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { /* 読めない環境では、毎回入力する */ }
  let status = { kind: mode === 'gas' ? 'syncing' : mode, lastSync: 0, message: '' };
  const listeners = { data: new Set(), status: new Set() };

  function idleTimer(updatedAt = 0) {
    return { state: 'idle', subjectIds: [], subjectId: '', startedAt: null, runningSince: null, elapsedMs: 0, updatedAt };
  }
  function blankState() {
    return { subjects: [], sessions: [], rewards: [], timer: idleTimer() };
  }

  /* ---------- データの形をそろえる ---------- */

  const num = (v, d = 0) => (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
  const str = (v, max) => String(v == null ? '' : v).slice(0, max);

  const clean = {
    subjects: (r) => ({
      id: str(r.id, 64),
      name: str(r.name, 40).trim() || '（名前なし）',
      color: COLOR_KEYS.includes(r.color) ? r.color : 'blue',
      order: num(r.order),
      archived: !!r.archived,
      updatedAt: num(r.updatedAt),
    }),
    // 複数の科目をまとめて勉強したときは、科目ごとの記録に分けて、同じ groupId でつなぐ
    sessions: (r) => ({
      id: str(r.id, 64),
      subjectId: str(r.subjectId, 64),
      start: num(r.start),
      end: num(r.end, num(r.start)),
      seconds: Math.max(0, Math.round(num(r.seconds))),
      memo: str(r.memo, 2000),
      groupId: str(r.groupId, 64),
      updatedAt: num(r.updatedAt),
    }),
    rewards: (r) => ({
      id: str(r.id, 64),
      title: str(r.title, 100),
      hours: Math.max(0, num(r.hours)),
      subjectId: str(r.subjectId, 64),
      claimedAt: r.claimedAt ? num(r.claimedAt) : null,
      updatedAt: num(r.updatedAt),
    }),
  };

  /** タイマーの科目（いくつでも）。前の形（subjectId 1つ）でも読めるようにしておく */
  function timerSubjects(t) {
    const ids = Array.isArray(t.subjectIds) && t.subjectIds.length ? t.subjectIds : (t.subjectId ? [t.subjectId] : []);
    return [...new Set(ids.map((x) => str(x, 64)).filter(Boolean))].slice(0, 20);
  }

  function cleanTimer(t) {
    if (!t || (t.state !== 'running' && t.state !== 'paused')) return idleTimer(t ? num(t.updatedAt) : 0);
    const subjectIds = timerSubjects(t);
    return {
      state: t.state,
      subjectIds,
      subjectId: subjectIds[0] || '',
      startedAt: num(t.startedAt, Date.now()),
      runningSince: t.state === 'running' ? num(t.runningSince, Date.now()) : null,
      elapsedMs: Math.max(0, num(t.elapsedMs)),
      updatedAt: num(t.updatedAt),
    };
  }

  function normalize(raw) {
    const out = blankState();
    for (const table of ['subjects', 'sessions', 'rewards']) {
      const rows = raw && Array.isArray(raw[table]) ? raw[table] : [];
      out[table] = rows.filter((r) => r && r.id && !r.deleted).map(clean[table]);
    }
    out.timer = cleanTimer(raw && raw.timer);
    return out;
  }

  /* ---------- この端末への保存 ---------- */

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeCache() {
    if (mode === 'demo') return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ v: 1, state, outbox, lastSync: status.lastSync, spreadsheetUrl }));
    } catch (e) {
      // 保存できない環境では、開いているあいだだけ動かす
    }
  }

  /* ---------- 変更の反映 ---------- */

  function emit(type) { listeners[type].forEach((fn) => fn()); }

  /** 同じデータは「あとから変えたほう」を残す */
  function applyPut(table, rec) {
    const list = state[table];
    const i = list.findIndex((r) => r.id === rec.id);
    if (i >= 0 && num(rec.updatedAt) < list[i].updatedAt) return;
    if (rec.deleted) {
      if (i >= 0) list.splice(i, 1);
      return;
    }
    const value = clean[table](rec);
    if (i >= 0) list[i] = value;
    else list.push(value);
  }

  function applyOp(op) {
    if (op.type === 'put' && clean[op.table]) applyPut(op.table, op.record);
    if (op.type === 'timer' && num(op.value.updatedAt) >= state.timer.updatedAt) state.timer = cleanTimer(op.value);
  }

  /** 端末どうしの時計のずれがあっても、今の変更が勝つように少し進める */
  function stamp(prev) {
    return Math.max(Date.now(), num(prev) + 1);
  }

  let batchDepth = 0;
  let batchDirty = false;

  function commit(op) {
    applyOp(op);
    if (mode === 'gas') {
      outbox.push(op);
      scheduleSync();
    }
    if (batchDepth) {
      batchDirty = true;
      return;
    }
    writeCache();
    emit('data');
  }

  /** まとめて変更して、画面の書き直しを1回で済ませる */
  function batch(fn) {
    batchDepth += 1;
    try {
      return fn();
    } finally {
      batchDepth -= 1;
      if (!batchDepth && batchDirty) {
        batchDirty = false;
        writeCache();
        emit('data');
      }
    }
  }

  function put(table, record) {
    const prev = state[table].find((r) => r.id === record.id);
    const rec = { ...clean[table]({ ...prev, ...record }), deleted: false, updatedAt: stamp(prev && prev.updatedAt) };
    commit({ type: 'put', table, record: rec });
    return rec;
  }

  function remove(table, id) {
    const prev = state[table].find((r) => r.id === id);
    if (!prev) return;
    commit({ type: 'put', table, record: { ...prev, deleted: true, updatedAt: stamp(prev.updatedAt) } });
  }

  function setTimer(t) {
    commit({ type: 'timer', value: { ...cleanTimer(t), updatedAt: stamp(state.timer.updatedAt) } });
  }

  /* ---------- スプレッドシートとの同期 ---------- */

  let syncTimer = 0;
  let retryTimer = 0;
  let retryDelay = 5000;
  let inFlight = false;
  let again = false;

  function scheduleSync(delay = 400) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, delay);
  }

  function setStatus(patch) {
    status = { ...status, ...patch };
    emit('status');
  }

  function sync() {
    if (mode !== 'gas') return;
    if (useHttp && !token) {
      setStatus({ kind: 'error', message: '合言葉が入っていません', auth: true });
      return;
    }
    if (inFlight) {
      again = true;
      return;
    }
    inFlight = true;
    clearTimeout(retryTimer);
    const sent = outbox.slice();
    setStatus({ kind: 'syncing' });

    callSync(sent, (res) => {
      inFlight = false;
      outbox.splice(0, sent.length);
      const before = JSON.stringify(state);
      state = normalize(res);
      outbox.forEach(applyOp); // 送っている間に増えた変更を上に重ねる
      if (res && res.spreadsheetUrl) spreadsheetUrl = res.spreadsheetUrl;
      const wasReady = ready;
      ready = true;
      retryDelay = 5000;
      status = { kind: 'synced', lastSync: Date.now(), message: '' };
      writeCache();
      if (!wasReady || JSON.stringify(state) !== before) emit('data');
      emit('status');
      if (outbox.length || again) {
        again = false;
        scheduleSync();
      }
    }, (err) => {
      inFlight = false;
      setStatus({ kind: 'error', message: (err && err.message) || String(err), auth: !!(err && err.auth) });
      // 合言葉が違うときは、入れなおすまでくり返しても意味がない
      if (err && err.auth) return;
      retryTimer = setTimeout(sync, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 120000);
    });
  }

  /** 変更を送って、最新のデータを受け取る（送り方は、2通りのどちらか） */
  function callSync(ops, onOk, onFail) {
    if (hasGas) {
      google.script.run.withSuccessHandler(onOk).withFailureHandler(onFail).sync(ops);
      return;
    }
    const fail = (message, auth = false) => onFail(Object.assign(new Error(message), { auth }));
    // text/plain にすると、事前の確認（プリフライト）が要らず、そのまま送れる
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, ops }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`サーバーがエラーを返しました（${r.status}）`);
        return r.json();
      })
      .then((body) => {
        if (body && body.ok) onOk(body.data);
        else if (body && body.error === 'auth') fail('合言葉が違います', true);
        else fail((body && body.message) || 'サーバー側でエラーが起きました');
      })
      .catch((e) => fail(e instanceof TypeError ? 'つながりませんでした（電波かURLを確かめてください）' : e.message));
  }

  /** 合言葉を保存して、すぐ同期する */
  function setToken(value) {
    token = String(value || '').trim();
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) { /* 保存できなくても、開いている間は使える */ }
    if (token) sync();
    else setStatus({ kind: 'error', message: '合言葉が入っていません', auth: true });
  }

  /* ---------- はじめの読み込み ---------- */

  function init() {
    if (mode === 'demo') {
      state = normalize(Demo.build());
      ready = true;
      return;
    }

    const cache = readCache();
    if (cache && cache.state) {
      state = normalize(cache.state);
      outbox = Array.isArray(cache.outbox) ? cache.outbox : [];
      status.lastSync = cache.lastSync || 0;
      spreadsheetUrl = cache.spreadsheetUrl || '';
      ready = true;
    }

    if (mode === 'local') {
      if (!cache) {
        const now = Date.now();
        state.subjects = DEFAULT_SUBJECTS.map((s, i) => clean.subjects({ ...s, order: i, updatedAt: now }));
        writeCache();
      }
      ready = true;
      // 同じブラウザでタブを2つ開いていても、内容をそろえる
      window.addEventListener('storage', (e) => {
        if (e.key !== CACHE_KEY) return;
        const c = readCache();
        if (c && c.state) {
          state = normalize(c.state);
          emit('data');
        }
      });
      return;
    }

    // 合言葉をまだ入れていない端末では、入れてもらうまで待つ
    if (useHttp && !token) {
      status = { kind: 'error', lastSync: status.lastSync, message: '合言葉が入っていません', auth: true };
      return;
    }

    // スプレッドシート版：最新を取りにいく。ほかの端末の変更も拾えるよう、ときどき確認する
    sync();
    setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
    window.addEventListener('online', () => sync());
  }

  /* ---------- バックアップ ---------- */

  function exportData() {
    return {
      app: 'tsumiage',
      version: 1,
      exportedAt: new Date().toISOString(),
      subjects: state.subjects,
      sessions: state.sessions,
      rewards: state.rewards,
    };
  }

  /** 読み込んだデータで上書きする（同じIDはファイルの内容が残る） */
  function importData(data) {
    if (!data || data.app !== 'tsumiage') throw new Error('つみあげのバックアップファイルではありません。');
    const count = { subjects: 0, sessions: 0, rewards: 0 };
    batch(() => {
      for (const table of ['subjects', 'sessions', 'rewards']) {
        for (const r of Array.isArray(data[table]) ? data[table] : []) {
          if (!r || !r.id) continue;
          put(table, r);
          count[table] += 1;
        }
      }
    });
    return count;
  }

  return {
    init, put, remove, setTimer, batch, sync, idleTimer, exportData, importData,
    on(type, fn) { listeners[type].add(fn); },
    get state() { return state; },
    get mode() { return mode; },
    get ready() { return ready; },
    get status() { return status; },
    get pending() { return outbox.length; },
    get spreadsheetUrl() { return spreadsheetUrl; },
    /** 合言葉が必要な送り方か（GitHub Pages などに置いたとき） */
    get usesToken() { return useHttp; },
    get hasToken() { return !!token; },
    setToken,
    /** 並び順どおりの科目（all = true で非表示の科目も含める） */
    subjects(all = false) {
      return state.subjects
        .filter((s) => all || !s.archived)
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ja'));
    },
    subject(id) {
      return state.subjects.find((s) => s.id === id) || null;
    },
  };
})();

/* ==========================================================================
   デモ用の見本データ（demo.html で表示。保存はしない）
   ========================================================================== */
const Demo = {
  build(now = Date.now()) {
    // 毎回同じ見本になるよう、決まった順で乱数を出す
    let seed = 20261031;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const subjects = DEFAULT_SUBJECTS.map((s, i) => ({ ...s, order: i, updatedAt: 1 }));
    const weights = [['sub_html', 5], ['sub_css', 5], ['sub_js', 4], ['sub_ps', 2], ['sub_ai', 1.5], ['sub_figma', 3]];
    const totalWeight = weights.reduce((a, w) => a + w[1], 0);
    const pick = () => {
      let r = rnd() * totalWeight;
      for (const [id, w] of weights) {
        r -= w;
        if (r < 0) return id;
      }
      return weights[0][0];
    };
    const memos = {
      sub_html: ['フォームのマークアップ', '見出しの構造を見直し', 'テーブルの書き方', ''],
      sub_css: ['Flexboxで横並び', 'Gridでカードを並べる', 'ホバーのアニメーション', ''],
      sub_js: ['配列メソッドの復習', 'タブ切り替えを作る', 'fetchでデータを取る', ''],
      sub_ps: ['写真の切り抜き', 'バナーのレタッチ', ''],
      sub_ai: ['ロゴのトレース', 'アイコンを3つ作る', ''],
      sub_figma: ['オートレイアウト', 'コンポーネントとバリアント', 'LPのワイヤーフレーム', ''],
    };

    const sessions = [];
    const today = U.startOfDay(now);
    const DAYS = 430;
    for (let i = DAYS; i >= 0; i -= 1) {
      const day = U.addDays(today, -i);
      const keepUp = 0.35 + 0.5 * (1 - i / DAYS); // だんだん続くようになる
      if (i > 0 && rnd() > keepUp) continue;
      const count = 1 + Math.floor(rnd() * 2.4);
      let t = day + (9 + Math.floor(rnd() * 5)) * 3600000;
      for (let k = 0; k < count; k += 1) {
        const min = 20 + Math.floor(rnd() * 70);
        const start = t;
        const end = t + min * 60000;
        if (end > now) break;
        if (rnd() < 0.18) {
          // ときどき、HTML・CSS（・JavaScript）をまとめて勉強した記録にする
          const combo = rnd() < 0.5 ? ['sub_html', 'sub_css'] : ['sub_html', 'sub_css', 'sub_js'];
          const each = Math.floor((min * 60) / combo.length);
          combo.forEach((subjectId, n) => {
            sessions.push({ id: `ses_demo${i}x${k}g${n}`, subjectId, start, end, seconds: each, memo: 'LPを1枚コーディング', groupId: `grp_demo${i}x${k}`, updatedAt: 1 });
          });
        } else {
          const subjectId = pick();
          const list = memos[subjectId];
          sessions.push({ id: `ses_demo${i}x${k}`, subjectId, start, end, seconds: min * 60, memo: list[Math.floor(rnd() * list.length)], updatedAt: 1 });
        }
        t = end + (40 + Math.floor(rnd() * 200)) * 60000;
      }
    }

    const hoursOf = (id) => sessions.filter((s) => !id || s.subjectId === id).reduce((a, s) => a + s.seconds, 0) / 3600;
    const total = hoursOf();
    const figma = hoursOf('sub_figma');
    const first = { id: 'rew_demo1', title: 'ちょっといいランチ', hours: 50, subjectId: '' };
    const firstAt = U.reachedAt(sessions, 50 * 3600, '');
    const rewards = [
      { ...first, claimedAt: firstAt ? firstAt + 2 * 86400000 : null, updatedAt: 1 },
      { id: 'rew_demo2', title: '新しいキーボード', hours: Math.max(100, Math.floor(total / 100) * 100), subjectId: '', claimedAt: null, updatedAt: 1 },
      { id: 'rew_demo3', title: '温泉に1泊', hours: Math.ceil((total + 20) / 100) * 100, subjectId: '', claimedAt: null, updatedAt: 1 },
      { id: 'rew_demo4', title: 'Figmaの有料講座', hours: Math.ceil((figma + 6) / 10) * 10, subjectId: 'sub_figma', claimedAt: null, updatedAt: 1 },
    ];

    let timer = null;
    const m = /[?&]demo=(running|paused)/.exec(location.search);
    if (m) {
      const startedAt = now - (83 * 60 + 12) * 1000;
      const subjectIds = ['sub_html', 'sub_css', 'sub_js'];
      timer = m[1] === 'running'
        ? { state: 'running', subjectIds, startedAt, runningSince: startedAt, elapsedMs: 0, updatedAt: 1 }
        : { state: 'paused', subjectIds, startedAt, runningSince: null, elapsedMs: (52 * 60 + 40) * 1000, updatedAt: 1 };
    }

    return { subjects, sessions, rewards, timer };
  },
};
