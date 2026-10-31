/**
 * つみあげ — 勉強時間の記録（Google Apps Script 側）
 *
 * このファイルは、Googleスプレッドシートの「拡張機能 → Apps Script」に貼り付けて使います。
 * 記録はこのスプレッドシートの「科目」「記録」「ごほうび」シートに保存されます。
 * 画面は GitHub Pages に置いてあり、ここは「保存の受付」だけをします（doPost）。
 * 手順は「セットアップ手順.md」を見てください。
 *
 * 受け付けるのは2種類です。
 * - 合言葉つき：持ち主の画面から。変更を保存して、最新のデータを返す
 * - 見る用の鍵つき：見る用リンクを開いた人の画面から。読むだけで、何も保存しない
 *
 * @OnlyCurrentDoc
 */

/** 合言葉と見る用の鍵を入れておく場所の名前（スクリプトのプロパティ） */
var TOKEN_PROP = 'apiToken';
var VIEW_PROP = 'viewKey';

/** 最初に入れておく科目（画面側 store.js の DEFAULT_SUBJECTS と同じ） */
var DEFAULT_SUBJECTS = [
  ['sub_html', 'HTML', 'orange'],
  ['sub_css', 'CSS', 'blue'],
  ['sub_js', 'JavaScript', 'yellow'],
  ['sub_ps', 'Photoshop', 'green'],
  ['sub_ai', 'Illustrator', 'magenta'],
  ['sub_figma', 'Figma', 'violet']
];

/** シートの列。type は 文字（text）／数字（number）／はい・いいえ（bool）／日時（date） */
var TABLES = {
  subjects: {
    sheet: '科目',
    cols: [
      { key: 'id', label: 'ID', type: 'text', max: 64 },
      { key: 'name', label: '科目名', type: 'text', max: 40 },
      { key: 'color', label: '色', type: 'text', max: 16 },
      { key: 'order', label: '並び順', type: 'number' },
      { key: 'archived', label: '非表示', type: 'bool' },
      { key: 'deleted', label: '削除済み', type: 'bool' },
      { key: 'updatedAt', label: '更新日時', type: 'date' }
    ]
  },
  sessions: {
    sheet: '記録',
    cols: [
      { key: 'id', label: 'ID', type: 'text', max: 64 },
      { key: 'subjectId', label: '科目ID', type: 'text', max: 64 },
      { key: 'start', label: '開始', type: 'date' },
      { key: 'end', label: '終了', type: 'date' },
      { key: 'seconds', label: '勉強時間（秒）', type: 'number' },
      { key: 'memo', label: 'メモ', type: 'text', max: 2000 },
      { key: 'deleted', label: '削除済み', type: 'bool' },
      { key: 'updatedAt', label: '更新日時', type: 'date' },
      // 複数の科目をまとめて勉強したときに、同じ値が入る（列を足すときは必ず最後に足す）
      { key: 'groupId', label: 'まとめID', type: 'text', max: 64 }
    ]
  },
  rewards: {
    sheet: 'ごほうび',
    cols: [
      { key: 'id', label: 'ID', type: 'text', max: 64 },
      { key: 'title', label: 'ごほうび', type: 'text', max: 100 },
      { key: 'hours', label: '目標（時間）', type: 'number' },
      { key: 'subjectId', label: '数える科目ID（空欄は全科目）', type: 'text', max: 64 },
      { key: 'claimedAt', label: '受け取った日時', type: 'date' },
      { key: 'deleted', label: '削除済み', type: 'bool' },
      { key: 'updatedAt', label: '更新日時', type: 'date' }
    ]
  }
};

/** ブラウザでURLを開いたとき。画面は出さず、動いているかだけ分かるようにする */
function doGet() {
  return ContentService.createTextOutput('つみあげの保存サーバーです。画面は別の場所にあります。');
}

/**
 * 画面（GitHub Pages）から、送信を受け取る。
 * - 持ち主：{ token: 合言葉, ops: 変更のリスト } → 保存して、最新のデータと見る用の鍵を返す
 * - 見る人：{ view: 見る用の鍵 } → 読むだけ。ops がついていても、何も保存しない
 * 合言葉や鍵が合わなければ、何もせずに断る。
 */
function doPost(e) {
  try {
    var body = parseJson_(e && e.postData && e.postData.contents) || {};
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty(TOKEN_PROP);
    if (!expected) return json_({ ok: false, error: 'setup', message: 'Apps Script で「setup」をまだ実行していません' });

    // 見る用の鍵がついていたら、合言葉がついていても「見るだけ」として扱う
    if (body.view !== undefined) {
      var viewKey = props.getProperty(VIEW_PROP);
      if (!viewKey || !safeEqual_(String(body.view || ''), viewKey)) return json_({ ok: false, error: 'auth' });
      return json_({ ok: true, data: viewData_() });
    }

    if (!safeEqual_(String(body.token || ''), expected)) return json_({ ok: false, error: 'auth' });
    var data = sync(Array.isArray(body.ops) ? body.ops : []);
    data.viewKey = ensureViewKey_();
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, error: 'server', message: String(err && err.message || err) });
  }
}

/**
 * 見る人に返すデータ。シートを読むだけで、書きこまない。
 * 持ち主の保存を待たせないよう、ロックは使わない（読み途中に保存が重なっても、次の読み込みでそろう）。
 * スプレッドシートのURLは返さない。
 */
function viewData_() {
  return {
    subjects: readTable_('subjects'),
    sessions: readTable_('sessions'),
    rewards: readTable_('rewards'),
    timer: parseJson_(PropertiesService.getScriptProperties().getProperty('timer')),
    serverTime: Date.now()
  };
}

/** シートを読むだけ（シートがなければ空。見出しの書き足しもしない） */
function readTable_(name) {
  var def = TABLES[name];
  var sheet = SpreadsheetApp.getActive().getSheetByName(def.sheet);
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, def.cols.length).getValues()
    .map(function (row) { return fromRow_(def, row); })
    .filter(function (r) { return r.id && !r.deleted; });
}

/** 見る用の鍵を返す。まだなければ作る（前の版で setup した人も、そのまま使えるように） */
function ensureViewKey_() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty(VIEW_PROP);
  if (key) return key;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    key = props.getProperty(VIEW_PROP);
    if (!key) {
      key = makeToken_();
      props.setProperty(VIEW_PROP, key);
    }
    return key;
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 文字数が同じなら、最後まで見比べる（合言葉を一文字ずつ当てられにくくする） */
function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 合言葉を作る。当てられにくい乱数（UUID）から、打ちやすい英数字20文字にする */
function makeToken_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 20);
}

/**
 * 最初に1回だけ、エディタから実行する関数。
 * 権限を許可して、シートを作り、合言葉と見る用の鍵を作ります。
 * 何度実行しても大丈夫です（合言葉も鍵も変わりません）。
 * 合言葉は、下の「実行ログ」に出ます。
 */
function setup() {
  var res = sync([]);
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty(TOKEN_PROP);
  if (!token) {
    token = makeToken_();
    props.setProperty(TOKEN_PROP, token);
  }
  ensureViewKey_();
  Logger.log('準備できました。科目 %s件、記録 %s件、ごほうび %s件', res.subjects.length, res.sessions.length, res.rewards.length);
  Logger.log('合言葉：%s', token);
  Logger.log('見る用リンクは、アプリの「設定」に出ます。');
}

/**
 * 見る用の鍵を作り直す関数。エディタから実行します。
 * 前の見る用リンクは、使えなくなります（見ていた人の画面からも、記録が消えます）。
 * 新しいリンクは、アプリの「設定」に出ます。
 */
function resetViewKey() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    PropertiesService.getScriptProperties().setProperty(VIEW_PROP, makeToken_());
  } finally {
    lock.releaseLock();
  }
  Logger.log('見る用の鍵を作り直しました。前のリンクは使えません。');
  Logger.log('新しいリンクは、アプリの「設定」→「見る用リンク」に出ます（一度同期すると出ます）。');
}

/**
 * 画面から呼ばれる関数。
 * 届いた変更（ops）を保存してから、最新のデータを全部返します。
 * 同じデータに変更が重なったときは、あとから変えたほう（updatedAt が新しいほう）を残します。
 */
function sync(ops) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var db = {};
    Object.keys(TABLES).forEach(function (name) {
      db[name] = loadTable_(name);
    });

    var props = PropertiesService.getScriptProperties();
    var timer = parseJson_(props.getProperty('timer'));
    var timerChanged = false;

    (ops || []).forEach(function (op) {
      if (!op || typeof op !== 'object') return;
      if (op.type === 'put' && db[op.table]) {
        putRecord_(db[op.table], op.record);
      } else if (op.type === 'timer' && op.value) {
        if (!timer || num_(op.value.updatedAt) >= num_(timer.updatedAt)) {
          timer = cleanTimer_(op.value);
          timerChanged = true;
        }
      }
    });

    Object.keys(db).forEach(function (name) {
      saveTable_(db[name]);
    });
    if (timerChanged) props.setProperty('timer', JSON.stringify(timer));
    SpreadsheetApp.flush();

    return {
      subjects: liveRecords_(db.subjects),
      sessions: liveRecords_(db.sessions),
      rewards: liveRecords_(db.rewards),
      timer: timer,
      spreadsheetUrl: SpreadsheetApp.getActive().getUrl(),
      serverTime: Date.now()
    };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- シートの読み書き ---------- */

function loadTable_(name) {
  var def = TABLES[name];
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(def.sheet);
  var created = false;
  if (!sheet) {
    sheet = createSheet_(ss, def);
    created = true;
  } else {
    ensureHeaders_(sheet, def);
  }

  var n = def.cols.length;
  var last = sheet.getLastRow();
  var values = last >= 2 ? sheet.getRange(2, 1, last - 1, n).getValues() : [];
  var table = { def: def, sheet: sheet, records: [], index: {}, changed: {}, baseCount: values.length };
  values.forEach(function (row, i) {
    var rec = fromRow_(def, row);
    table.records.push(rec);
    if (rec.id) table.index[rec.id] = i;
  });

  if (created && name === 'subjects') {
    var now = Date.now();
    DEFAULT_SUBJECTS.forEach(function (s, i) {
      putRecord_(table, { id: s[0], name: s[1], color: s[2], order: i, archived: false, deleted: false, updatedAt: now });
    });
  }
  return table;
}

function createSheet_(ss, def) {
  var sheet = ss.insertSheet(def.sheet);
  var n = def.cols.length;
  sheet.getRange(1, 1, 1, n)
    .setValues([def.cols.map(function (c) { return c.label; })])
    .setFontWeight('bold')
    .setBackground('#e0ebfa');
  sheet.setFrozenRows(1);
  def.cols.forEach(function (c, i) {
    if (c.type === 'date') sheet.getRange(2, i + 1, sheet.getMaxRows() - 1, 1).setNumberFormat('yyyy/mm/dd hh:mm');
  });

  // 最初からある空のシート（シート1）は、使わないので消す
  ['シート1', 'Sheet1'].forEach(function (blankName) {
    var blank = ss.getSheetByName(blankName);
    if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  });
  return sheet;
}

/** 前の版で作ったシートに、新しく足した列の見出しを書き足す */
function ensureHeaders_(sheet, def) {
  var n = def.cols.length;
  var labels = def.cols.map(function (c) { return c.label; });
  var current = sheet.getRange(1, 1, 1, n).getValues()[0];
  var same = labels.every(function (label, i) { return current[i] === label; });
  if (!same) {
    sheet.getRange(1, 1, 1, n).setValues([labels]).setFontWeight('bold').setBackground('#e0ebfa');
  }
}

function saveTable_(table) {
  var n = table.def.cols.length;
  var sheet = table.sheet;
  var changed = Object.keys(table.changed).map(Number).sort(function (a, b) { return a - b; });
  if (!changed.length) return;

  var appended = [];
  changed.forEach(function (i) {
    if (i < table.baseCount) {
      sheet.getRange(i + 2, 1, 1, n).setValues([toRow_(table.def, table.records[i])]);
    } else {
      appended.push(toRow_(table.def, table.records[i]));
    }
  });

  if (appended.length) {
    // 新しい行は、いまある行のすぐ下にまとめて足す
    var startRow = table.baseCount + 2;
    var lastRow = startRow + appended.length - 1;
    if (sheet.getMaxRows() < lastRow) sheet.insertRowsAfter(sheet.getMaxRows(), lastRow - sheet.getMaxRows());
    sheet.getRange(startRow, 1, appended.length, n).setValues(appended);
    table.def.cols.forEach(function (c, i) {
      if (c.type === 'date') sheet.getRange(startRow, i + 1, appended.length, 1).setNumberFormat('yyyy/mm/dd hh:mm');
    });
  }
}

/** 同じIDがあれば、新しいほうで置き換える。なければ足す */
function putRecord_(table, raw) {
  if (!raw || typeof raw !== 'object') return;
  var rec = cleanRecord_(table.def, raw);
  if (!/^[A-Za-z]+_[A-Za-z0-9_]+$/.test(rec.id)) return;
  var i = table.index[rec.id];
  if (i === undefined) {
    table.index[rec.id] = table.records.length;
    table.records.push(rec);
    table.changed[table.records.length - 1] = true;
    return;
  }
  if (num_(rec.updatedAt) >= num_(table.records[i].updatedAt)) {
    table.records[i] = rec;
    table.changed[i] = true;
  }
}

function liveRecords_(table) {
  return table.records.filter(function (r) { return r.id && !r.deleted; });
}

/* ---------- 値の変換 ---------- */

function cleanRecord_(def, raw) {
  var rec = {};
  def.cols.forEach(function (c) {
    var v = raw[c.key];
    if (c.type === 'text') rec[c.key] = String(v == null ? '' : v).slice(0, c.max || 500);
    else if (c.type === 'number') rec[c.key] = num_(v);
    else if (c.type === 'bool') rec[c.key] = v === true;
    else rec[c.key] = v ? num_(v) : null;
  });
  if (!rec.updatedAt) rec.updatedAt = Date.now();
  return rec;
}

function toRow_(def, rec) {
  return def.cols.map(function (c) {
    var v = rec[c.key];
    if (c.type === 'date') return v ? new Date(Number(v)) : '';
    if (c.type === 'number') return v == null ? '' : Number(v);
    if (c.type === 'bool') return v === true;
    var s = v == null ? '' : String(v);
    // 先頭に ' をつけて、「=」で始まるメモや「10/31」などが式や日付に変わらないようにする
    return s === '' ? '' : "'" + s;
  });
}

function fromRow_(def, row) {
  var rec = {};
  def.cols.forEach(function (c, i) {
    var v = row[i];
    if (c.type === 'date') {
      rec[c.key] = v instanceof Date ? v.getTime() : (v === '' || v == null ? null : num_(v) || null);
    } else if (c.type === 'number') {
      rec[c.key] = v === '' || v == null ? 0 : num_(v);
    } else if (c.type === 'bool') {
      rec[c.key] = v === true || String(v).toUpperCase() === 'TRUE';
    } else {
      var s = v == null ? '' : String(v);
      rec[c.key] = s.charAt(0) === "'" ? s.slice(1) : s;
    }
  });
  return rec;
}

function cleanTimer_(v) {
  var running = v.state === 'running';
  var paused = v.state === 'paused';
  if (!running && !paused) {
    return { state: 'idle', subjectIds: [], subjectId: '', startedAt: null, runningSince: null, elapsedMs: 0, updatedAt: num_(v.updatedAt) || Date.now() };
  }
  // 科目はいくつでも（前の版の subjectId 1つの形でも受け取れるようにする）
  var raw = Array.isArray(v.subjectIds) && v.subjectIds.length ? v.subjectIds : (v.subjectId ? [v.subjectId] : []);
  var subjectIds = [];
  raw.forEach(function (id) {
    var s = String(id || '').slice(0, 64);
    if (s && subjectIds.indexOf(s) === -1 && subjectIds.length < 20) subjectIds.push(s);
  });
  return {
    state: v.state,
    subjectIds: subjectIds,
    subjectId: subjectIds[0] || '',
    startedAt: num_(v.startedAt) || Date.now(),
    runningSince: running ? (num_(v.runningSince) || Date.now()) : null,
    elapsedMs: Math.max(0, num_(v.elapsedMs)),
    updatedAt: num_(v.updatedAt) || Date.now()
  };
}

function num_(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function parseJson_(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}
