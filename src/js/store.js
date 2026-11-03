/* ==========================================================================
   つみあげ — データの保存と同期
   - スプレッドシート版：Apps Script を通して Googleスプレッドシートに保存し、
     スマホとパソコンで同じ記録を見られるようにする
   - 見るだけ：見る用リンク（?view=鍵）で開いた人の画面。読むだけで、何も保存しない
   - ブラウザ版：この端末のブラウザ（localStorage）にだけ保存する
   - デモ：見本のデータを表示する（何も保存しない）
   ========================================================================== */
'use strict';

/**
 * 科目の色。並び順は、色覚の違いがあっても隣どうしを見分けやすい順（検証済み）。
 * あとから足した4色（水色〜茶色）は、ほかの11色のどれとも見分けやすいことを確かめた
 */
const COLORS = [
  { key: 'blue', name: '青' },
  { key: 'orange', name: 'オレンジ' },
  { key: 'aqua', name: 'エメラルド' },
  { key: 'yellow', name: '黄色' },
  { key: 'magenta', name: 'ピンク' },
  { key: 'green', name: '緑' },
  { key: 'violet', name: '紫' },
  { key: 'red', name: '赤' },
  { key: 'sky', name: '水色' },
  { key: 'navy', name: '紺' },
  { key: 'lime', name: '黄緑' },
  { key: 'brown', name: '茶色' },
];
const COLOR_KEYS = COLORS.map((c) => c.key);

/** 記録の種類。読書の時間は、勉強時間とは別に数える（科目とごほうびが種類を持つ） */
const KINDS = ['study', 'reading'];

/**
 * 最初に入っている科目とジャンル。Apps Script 側（Code.gs）の DEFAULT_SUBJECTS と同じにしておく。
 * since は足した版。2 のものは、前の版から使っている人にも1回だけ足す
 */
const DEFAULT_SUBJECTS = [
  { id: 'sub_html', name: 'HTML', color: 'orange', kind: 'study', since: 1 },
  { id: 'sub_css', name: 'CSS', color: 'blue', kind: 'study', since: 1 },
  { id: 'sub_js', name: 'JavaScript', color: 'yellow', kind: 'study', since: 1 },
  { id: 'sub_ps', name: 'Photoshop', color: 'green', kind: 'study', since: 1 },
  { id: 'sub_ai', name: 'Illustrator', color: 'magenta', kind: 'study', since: 1 },
  { id: 'sub_figma', name: 'Figma', color: 'violet', kind: 'study', since: 1 },
  { id: 'sub_react', name: 'React', color: 'sky', kind: 'study', since: 2 },
  { id: 'sub_ts', name: 'TypeScript', color: 'navy', kind: 'study', since: 2 },
  { id: 'sub_stock', name: '株', color: 'red', kind: 'reading', since: 2 },
  { id: 'sub_fund', name: '投資信託', color: 'green', kind: 'reading', since: 2 },
  { id: 'sub_btc', name: 'ビットコイン', color: 'yellow', kind: 'reading', since: 2 },
];

/**
 * どの版として動くかを決める（テストしやすいよう、ここだけ切り出してある）。
 * 'gas'  ：スプレッドシート版（持ち主）
 * 'view' ：見るだけ（見る用リンクを開いた人）
 * 'demo' ：デモ
 * 'local'：ブラウザ版
 */
function pickStoreMode(env) {
  const none = { useHttp: false, viewKey: '', rememberView: false, forgetView: false };
  if (env.hasGas) return { ...none, mode: 'gas' };
  if (env.wantsDemo) return { ...none, mode: 'demo' };
  // ファイルをダブルクリックして開いたときは、URLが書いてあってもブラウザ版として動かす
  const httpOk = !!env.apiUrl && (/^https?:$/.test(env.protocol || '') || !!env.allowFile);
  if (!httpOk) return { ...none, mode: 'local' };

  const params = new URLSearchParams(env.search || '');
  const fromUrl = (params.get('view') || '').trim();
  // 見る用リンク（?view=鍵）で開いたとき。ホーム画面から開いても見られるよう、鍵を覚えておく
  if (fromUrl) return { ...none, mode: 'view', useHttp: true, viewKey: fromUrl, rememberView: true };
  // ?owner：持ち主として開く（覚えている見る用の鍵は忘れる）
  if (params.has('owner')) return { ...none, mode: 'gas', useHttp: true, forgetView: true };
  // 見る用リンクを開いたことがあり、合言葉を入れていない端末
  if (!env.token && env.storedViewKey) return { ...none, mode: 'view', useHttp: true, viewKey: env.storedViewKey };
  return { ...none, mode: 'gas', useHttp: true };
}

const Store = (() => {
  const CACHE_KEY = 'tsumiage:data:v1';
  const VIEW_CACHE_KEY = 'tsumiage:view-data:v1'; // 見るだけのときは、持ち主の記録とまざらないよう別に覚える
  const TOKEN_KEY = 'tsumiage:token:v1';
  const VIEW_KEY = 'tsumiage:view-key:v1';
  const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても、開いている間は使える */ } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* 同上 */ } };

  const hasGas = typeof google === 'object' && google && google.script && google.script.run;
  // GitHub Pages などに置いた画面から、Apps Script のウェブアプリへ直接送る場合の宛先
  const apiUrl = String(window.TSUMIAGE_API_URL || '').trim();
  const picked = pickStoreMode({
    hasGas: !!hasGas,
    wantsDemo: !!window.TSUMIAGE_DEMO || /[?&]demo/.test(location.search),
    apiUrl,
    protocol: location.protocol,
    search: location.search,
    token: lsGet(TOKEN_KEY),
    storedViewKey: lsGet(VIEW_KEY),
    allowFile: window.TSUMIAGE_TEST_ALLOW_FILE === true, // テストのときだけ使う
  });
  const { mode, useHttp, viewKey } = picked;
  if (picked.rememberView) lsSet(VIEW_KEY, viewKey);
  if (picked.forgetView) lsDel(VIEW_KEY);
  const usesServer = mode === 'gas' || mode === 'view';
  const cacheKey = mode === 'view' ? VIEW_CACHE_KEY : CACHE_KEY;

  let state = blankState();
  let outbox = []; // スプレッドシートにまだ送っていない変更
  let ready = false;
  let fresh = false; // この画面を開いてから、1回でもサーバーから最新を受け取れたか
  let spreadsheetUrl = '';
  let shareKey = ''; // 持ち主の画面で使う、見る用リンクの鍵
  let serverVersion = 0; // Apps Script の版（2 から「読書」の種類、3 から見る用リンクの公開・非公開を保存できる）
  let token = lsGet(TOKEN_KEY);
  let status = { kind: usesServer ? 'syncing' : mode, lastSync: 0, message: '' };
  const listeners = { data: new Set(), status: new Set() };

  function idleTimer(updatedAt = 0) {
    return { state: 'idle', subjectIds: [], subjectId: '', startedAt: null, runningSince: null, elapsedMs: 0, updatedAt };
  }
  function blankState() {
    return { subjects: [], sessions: [], rewards: [], timer: idleTimer(), share: cleanShare(null) };
  }
  /** 見る用リンクを公開しているか（まだ一度も切りかえていなければ、公開中） */
  function cleanShare(v) {
    return { open: !(v && v.open === false), updatedAt: v && Number.isFinite(Number(v.updatedAt)) ? Number(v.updatedAt) : 0 };
  }

  /* ---------- データの形をそろえる ---------- */

  const num = (v, d = 0) => (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
  const str = (v, max) => String(v == null ? '' : v).slice(0, max);
  const toKind = (v) => (KINDS.includes(v) ? v : 'study'); // 種類がない前のデータは、勉強として扱う

  const clean = {
    subjects: (r) => ({
      id: str(r.id, 64),
      name: str(r.name, 40).trim() || '（名前なし）',
      color: COLOR_KEYS.includes(r.color) ? r.color : 'blue',
      order: num(r.order),
      archived: !!r.archived,
      kind: toKind(r.kind),
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
    // 数える科目（subjectId）が空なら、その種類（勉強／読書）の合計で数える
    rewards: (r) => ({
      id: str(r.id, 64),
      title: str(r.title, 100),
      hours: Math.max(0, num(r.hours)),
      subjectId: str(r.subjectId, 64),
      claimedAt: r.claimedAt ? num(r.claimedAt) : null,
      kind: toKind(r.kind),
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
    out.share = cleanShare(raw && raw.share);
    return out;
  }

  /* ---------- この端末への保存 ---------- */

  function readCache() {
    try { return JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch (e) { return null; }
  }
  // v2：科目とごほうびが「種類」を持つようになった版
  function writeCache() {
    if (mode === 'demo') return;
    try {
      const saved = mode === 'view'
        ? { v: 2, state, lastSync: status.lastSync }
        : { v: 2, state, outbox, lastSync: status.lastSync, spreadsheetUrl, shareKey, serverVersion };
      localStorage.setItem(cacheKey, JSON.stringify(saved));
    } catch (e) {
      // 保存できない環境では、開いているあいだだけ動かす
    }
  }

  /** あとから足した科目とジャンルを足す（ブラウザ版で、前の版から使っている人のため。同じIDか、同じ種類で同じ名前があれば足さない） */
  function addNewDefaults() {
    const now = Date.now();
    let order = Math.max(-1, ...state.subjects.map((s) => s.order));
    for (const s of DEFAULT_SUBJECTS) {
      if (s.since < 2 || state.subjects.some((x) => x.id === s.id || (x.name === s.name && x.kind === s.kind))) continue;
      order += 1;
      state.subjects.push(clean.subjects({ ...s, order, updatedAt: now }));
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
    if (op.type === 'share' && num(op.value.updatedAt) >= state.share.updatedAt) state.share = cleanShare(op.value);
  }

  /** 端末どうしの時計のずれがあっても、今の変更が勝つように少し進める */
  function stamp(prev) {
    return Math.max(Date.now(), num(prev) + 1);
  }

  let batchDepth = 0;
  let batchDirty = false;

  function commit(op) {
    // 見るだけの画面では、何も変えない（受付側でも断るが、画面側でも止めておく）
    if (mode === 'view') return;
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

  /** 見る用リンクの公開・非公開を切りかえる */
  function setShare(open) {
    commit({ type: 'share', value: { open: !!open, updatedAt: stamp(state.share.updatedAt) } });
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
    if (!usesServer) return;
    if (mode === 'gas' && useHttp && !token) {
      setStatus({ kind: 'error', message: '合言葉が入っていません', auth: true });
      return;
    }
    if (inFlight) {
      again = true;
      return;
    }
    inFlight = true;
    clearTimeout(retryTimer);
    const sent = mode === 'view' ? [] : outbox.slice();
    setStatus({ kind: 'syncing' });

    callSync(sent, (res) => {
      inFlight = false;
      outbox.splice(0, sent.length);
      const before = JSON.stringify(state);
      state = normalize(res);
      outbox.forEach(applyOp); // 送っている間に増えた変更を上に重ねる
      if (res && res.spreadsheetUrl) spreadsheetUrl = res.spreadsheetUrl;
      if (mode === 'gas' && res && res.viewKey) shareKey = String(res.viewKey);
      serverVersion = num(res && res.apiVersion);
      const wasReady = ready;
      ready = true;
      fresh = true;
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
      const auth = !!(err && err.auth);
      const closed = !!(err && err.closed);
      // 見る用の鍵が作り直されていたり、非公開になっていたりしたら、前に覚えた記録も見せない
      if (mode === 'view' && (auth || closed)) {
        const wasReady = ready;
        state = blankState();
        ready = false;
        fresh = false;
        lsDel(VIEW_CACHE_KEY);
        if (wasReady) emit('data');
      }
      setStatus({ kind: 'error', message: (err && err.message) || String(err), auth, closed });
      // 合言葉や鍵が違うときは、くり返しても意味がない。非公開のときは、1分ごとの確認で公開に戻ったかを見る
      if (auth || closed) return;
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
    const fail = (message, auth = false, closed = false) => onFail(Object.assign(new Error(message), { auth, closed }));
    // 見る人は鍵だけを送る（変更は送らない）
    const payload = mode === 'view' ? { view: viewKey } : { token, ops };
    // text/plain にすると、事前の確認（プリフライト）が要らず、そのまま送れる
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`サーバーがエラーを返しました（${r.status}）`);
        return r.json();
      })
      .then((body) => {
        if (body && body.ok) onOk(body.data);
        else if (body && body.error === 'auth') fail(mode === 'view' ? 'この見る用リンクは使えなくなっています' : '合言葉が違います', true);
        else if (body && body.error === 'closed') fail('現在非公開中です', false, true);
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
      outbox = mode !== 'view' && Array.isArray(cache.outbox) ? cache.outbox : [];
      status.lastSync = cache.lastSync || 0;
      spreadsheetUrl = cache.spreadsheetUrl || '';
      shareKey = cache.shareKey || '';
      serverVersion = num(cache.serverVersion);
      ready = true;
    }

    if (mode === 'local') {
      if (!cache) {
        const now = Date.now();
        state.subjects = DEFAULT_SUBJECTS.map((s, i) => clean.subjects({ ...s, order: i, updatedAt: now }));
        writeCache();
      } else if (!(cache.v >= 2)) {
        addNewDefaults();
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
    if (mode === 'gas' && useHttp && !token) {
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
    init, put, remove, setTimer, setShare, batch, sync, idleTimer, exportData, importData,
    on(type, fn) { listeners[type].add(fn); },
    get state() { return state; },
    get mode() { return mode; },
    get ready() { return ready; },
    get status() { return status; },
    get pending() { return outbox.length; },
    get spreadsheetUrl() { return spreadsheetUrl; },
    /** 合言葉が必要な送り方か（GitHub Pages などに置いた、持ち主の画面） */
    get usesToken() { return mode === 'gas' && useHttp; },
    get hasToken() { return !!token; },
    setToken,
    /** 見る用リンクの鍵（持ち主の画面で、同期のあとに入る） */
    get shareKey() { return shareKey; },
    /** この画面を開いてから、サーバーの最新を受け取れたか（見るだけの画面で、古い「勉強中」を出さないため） */
    get fresh() { return fresh; },
    /** Apps Script の版（同期するまでは、前に覚えた版。わからなければ 0） */
    get serverVersion() { return serverVersion; },
    /** 並び順どおりの科目（all = true で非表示の科目も含める。kind をわたすと、その種類だけ） */
    subjects(all = false, kind = '') {
      return state.subjects
        .filter((s) => (all || !s.archived) && (!kind || s.kind === kind))
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
    const weights = [['sub_html', 5], ['sub_css', 5], ['sub_js', 4], ['sub_ps', 2], ['sub_ai', 1.5], ['sub_figma', 3], ['sub_react', 2], ['sub_ts', 1.5]];
    const weighted = (list) => {
      const total = list.reduce((a, w) => a + w[1], 0);
      return () => {
        let r = rnd() * total;
        for (const [id, w] of list) {
          r -= w;
          if (r < 0) return id;
        }
        return list[0][0];
      };
    };
    const pick = weighted(weights);
    const memos = {
      sub_html: ['フォームのマークアップ', '見出しの構造を見直し', 'テーブルの書き方', ''],
      sub_css: ['Flexboxで横並び', 'Gridでカードを並べる', 'ホバーのアニメーション', ''],
      sub_js: ['配列メソッドの復習', 'タブ切り替えを作る', 'fetchでデータを取る', ''],
      sub_ps: ['写真の切り抜き', 'バナーのレタッチ', ''],
      sub_ai: ['ロゴのトレース', 'アイコンを3つ作る', ''],
      sub_figma: ['オートレイアウト', 'コンポーネントとバリアント', 'LPのワイヤーフレーム', ''],
      sub_react: ['useStateでカウンター', 'コンポーネントに分ける', ''],
      sub_ts: ['型の基本', 'interfaceとtype', ''],
      sub_stock: ['「会社四季報」の読み方', '決算書の入門書 第2章', '高配当株の本', ''],
      sub_fund: ['インデックス投資の本', 'NISAの解説書', ''],
      sub_btc: ['ビットコインの仕組み', 'ブロックチェーン入門', ''],
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

    // 読書は夜に、ときどき
    const pickBook = weighted([['sub_stock', 3], ['sub_fund', 2], ['sub_btc', 1.5]]);
    for (let i = 300; i >= 0; i -= 1) {
      if (rnd() > 0.45) continue;
      const start = U.addDays(today, -i) + (21 * 60 + Math.floor(rnd() * 60)) * 60000;
      const min = 15 + Math.floor(rnd() * 45);
      const end = start + min * 60000;
      if (end > now) continue;
      const subjectId = pickBook();
      const list = memos[subjectId];
      sessions.push({ id: `ses_book${i}`, subjectId, start, end, seconds: min * 60, memo: list[Math.floor(rnd() * list.length)], updatedAt: 1 });
    }

    const study = new Set(subjects.filter((s) => s.kind === 'study').map((s) => s.id));
    const studySessions = sessions.filter((s) => study.has(s.subjectId));
    const bookSessions = sessions.filter((s) => !study.has(s.subjectId));
    const hoursOf = (list, id) => list.filter((s) => !id || s.subjectId === id).reduce((a, s) => a + s.seconds, 0) / 3600;
    const total = hoursOf(studySessions);
    const figma = hoursOf(studySessions, 'sub_figma');
    const books = hoursOf(bookSessions);
    const first = { id: 'rew_demo1', title: 'ちょっといいランチ', hours: 50, subjectId: '', kind: 'study' };
    const firstAt = U.reachedAt(studySessions, 50 * 3600, '');
    const cafeAt = U.reachedAt(bookSessions, 10 * 3600, '');
    const rewards = [
      { ...first, claimedAt: firstAt ? firstAt + 2 * 86400000 : null, updatedAt: 1 },
      { id: 'rew_demo2', title: '新しいキーボード', hours: Math.max(100, Math.floor(total / 100) * 100), subjectId: '', kind: 'study', claimedAt: null, updatedAt: 1 },
      { id: 'rew_demo3', title: '温泉に1泊', hours: Math.ceil((total + 20) / 100) * 100, subjectId: '', kind: 'study', claimedAt: null, updatedAt: 1 },
      { id: 'rew_demo4', title: 'Figmaの有料講座', hours: Math.ceil((figma + 6) / 10) * 10, subjectId: 'sub_figma', kind: 'study', claimedAt: null, updatedAt: 1 },
      { id: 'rew_demo5', title: 'カフェで読書', hours: 10, subjectId: '', kind: 'reading', claimedAt: cafeAt ? cafeAt + 86400000 : null, updatedAt: 1 },
      { id: 'rew_demo6', title: '気になっていた本をまとめ買い', hours: Math.ceil((books + 5) / 10) * 10, subjectId: '', kind: 'reading', claimedAt: null, updatedAt: 1 },
    ];

    let timer = null;
    const m = /[?&]demo=(running|paused|reading)/.exec(location.search);
    if (m) {
      const startedAt = now - (83 * 60 + 12) * 1000;
      const subjectIds = m[1] === 'reading' ? ['sub_stock'] : ['sub_html', 'sub_css', 'sub_js'];
      timer = m[1] === 'paused'
        ? { state: 'paused', subjectIds, startedAt, runningSince: null, elapsedMs: (52 * 60 + 40) * 1000, updatedAt: 1 }
        : { state: 'running', subjectIds, startedAt, runningSince: startedAt, elapsedMs: 0, updatedAt: 1 };
    }

    return { subjects, sessions, rewards, timer };
  },
};
