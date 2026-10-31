/* つみあげ — 自動テスト（tests/test.html をブラウザで開くと実行される） */
'use strict';

const D = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();

/* ---------- 日付と時間 ---------- */

test('週は月曜はじまり（土曜・日曜・月曜）', () => {
  eq(U.startOfWeek(D(2026, 10, 31, 15)), D(2026, 10, 26), '土曜');
  eq(U.startOfWeek(D(2026, 11, 1, 23, 59)), D(2026, 10, 26), '日曜');
  eq(U.startOfWeek(D(2026, 11, 2, 0, 0)), D(2026, 11, 2), '月曜');
});

test('期間の範囲（日・月・年）', () => {
  eq(U.periodRange('day', D(2026, 10, 31, 12)), { start: D(2026, 10, 31), end: D(2026, 11, 1) });
  eq(U.periodRange('month', D(2028, 2, 10)), { start: D(2028, 2, 1), end: D(2028, 3, 1) });
  eq(U.periodRange('year', D(2026, 6, 1)), { start: D(2026, 1, 1), end: D(2027, 1, 1) });
});

test('前後の期間へ移動（月末からでもずれない）', () => {
  eq(U.shiftPeriod('month', D(2026, 1, 31), 1), D(2026, 2, 1));
  eq(U.shiftPeriod('month', D(2026, 3, 31), -1), D(2026, 2, 1));
  eq(U.shiftPeriod('week', D(2026, 10, 31), -1), D(2026, 10, 19));
  eq(U.shiftPeriod('year', D(2026, 10, 31), -1), D(2025, 1, 1));
});

test('いまの期間かどうか', () => {
  const now = D(2026, 10, 31, 10);
  ok(U.isCurrentPeriod('week', D(2026, 10, 26), now), '今週');
  ok(!U.isCurrentPeriod('month', D(2026, 9, 30), now), '先月');
  ok(U.isCurrentPeriod('all', 0, now), '全期間');
});

test('期間の見出し（年をまたぐ週）', () => {
  const now = D(2026, 10, 31);
  eq(U.periodLabel('week', D(2026, 12, 31), now), '12月28日〜2027年1月3日');
  eq(U.periodLabel('week', D(2026, 10, 31), now), '10月26日〜11月1日');
  eq(U.periodLabel('week', D(2025, 6, 4), now), '2025年6月2日〜6月8日');
  eq(U.periodLabel('month', D(2026, 10, 3), now), '2026年10月');
  eq(U.periodLabel('day', D(2026, 10, 31), now), '10月31日（土）');
  eq(U.periodLabel('day', D(2025, 1, 1), now), '2025年1月1日（水）');
});

test('時間の表示', () => {
  eq(U.durText(0), '0分');
  eq(U.durText(59), '0分');
  eq(U.durText(60), '1分');
  eq(U.durText(3600), '1時間');
  eq(U.durText(3660), '1時間1分');
  eq(U.durText(100 * 3600 + 5 * 60), '100時間5分');
  eq(U.durText(1234 * 3600), '1,234時間');
  eq(U.durText(-50), '0分');
});

test('数字を大きく見せるHTML（せまい場所では100時間から分を省く）', () => {
  eq(U.durHTML(3660), '<span class="num">1</span><span class="unit">時間</span><span class="num">1</span><span class="unit">分</span>');
  eq(U.durHTML(150 * 3600 + 20 * 60, { compact: true }), '<span class="num">150</span><span class="unit">時間</span>');
  eq(U.durHTML(99 * 3600 + 20 * 60, { compact: true }), '<span class="num">99</span><span class="unit">時間</span><span class="num">20</span><span class="unit">分</span>');
});

test('タイマーの表示', () => {
  eq(U.clockParts(0), ['00', '00', '00']);
  eq(U.clockParts((1 * 3600 + 23 * 60 + 45) * 1000 + 999), ['01', '23', '45']);
  eq(U.clockParts(125 * 3600 * 1000), ['125', '00', '00']);
});

test('入力欄との変換', () => {
  const t = D(2026, 3, 5, 9, 7);
  eq(U.toDateInput(t), '2026-03-05');
  eq(U.toTimeInput(t), '09:07');
  eq(U.fromInputs('2026-03-05', '09:07'), t);
  ok(Number.isNaN(U.fromInputs('', '09:00')), '空の日付');
  ok(Number.isNaN(U.fromInputs('2026-03-05', '')), '空の時刻');
});

test('HTMLに入れる文字を安全にする', () => {
  eq(U.esc('<b>"A&B"</b>\''), '&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;&#39;');
  eq(U.esc(null), '');
});

/* ---------- 集計 ---------- */

const S = (id, subjectId, start, min) => ({ id, subjectId, start, end: start + min * 60000, seconds: min * 60 });

test('期間に入る記録は「始めた日時」で決まる', () => {
  const list = [S('a', 'x', D(2026, 10, 30, 23, 30), 60), S('b', 'x', D(2026, 10, 31, 0, 0), 30)];
  const day = U.periodRange('day', D(2026, 10, 31));
  eq(U.inRange(list, day).map((s) => s.id), ['b']);
});

test('科目ごとの合計と回数', () => {
  const list = [S('a', 'x', 1, 30), S('b', 'y', 2, 15), S('c', 'x', 3, 45)];
  const map = U.bySubject(list);
  eq(map.get('x'), { seconds: 4500, count: 2 });
  eq(map.get('y'), { seconds: 900, count: 1 });
});

test('日ごと・月ごとに分ける', () => {
  const list = [S('a', 'x', D(2028, 2, 29, 10), 30), S('b', 'x', D(2028, 2, 1, 10), 60), S('c', 'x', D(2028, 3, 1, 10), 60)];
  const feb = U.buckets('month', D(2028, 2, 15), list);
  eq(feb.length, 29, 'うるう年の2月は29日');
  eq(feb[0].seconds, 3600);
  eq(feb[28].seconds, 1800);
  const year = U.buckets('year', D(2028, 5, 1), list);
  eq(year.length, 12);
  eq(year[1].seconds, 5400);
  eq(year[2].seconds, 3600);
  eq(U.buckets('week', D(2028, 3, 1), list).length, 7);
});

test('ごほうびに届いた日時', () => {
  const list = [S('b', 'x', D(2026, 1, 2), 60), S('a', 'y', D(2026, 1, 1), 60), S('c', 'x', D(2026, 1, 3), 60)];
  eq(U.reachedAt(list, 2 * 3600, ''), D(2026, 1, 2) + 3600000, '合計2時間');
  eq(U.reachedAt(list, 2 * 3600, 'x'), D(2026, 1, 3) + 3600000, 'xだけで2時間');
  eq(U.reachedAt(list, 10 * 3600, ''), null, 'まだ');
  eq(U.reachedAt(list, 0, ''), null, '目標0');
});

/* ---------- グラフ ---------- */

test('目盛りはきりのいい数になる', () => {
  eq(Charts.axis(0), { unitSec: 60, unitLabel: '分', ticks: [0, 10, 20, 30], maxSec: 1800 });
  eq(Charts.axis(45 * 60).ticks, [0, 15, 30, 45]);
  eq(Charts.axis(2.5 * 3600).ticks, [0, 1, 2, 3]);
  eq(Charts.axis(3 * 3600).ticks, [0, 1, 2, 3]);
  eq(Charts.axis(7 * 3600).ticks, [0, 2, 4, 6, 8]);
  eq(Charts.axis(80 * 3600).ticks, [0, 20, 40, 60, 80]);
  ok(Charts.axis(123456 * 3600).ticks.length <= 5, '大きな数でも5本まで');
});

test('円グラフは6つをこえたら「その他」にまとめる', () => {
  const rows = 'abcdefgh'.split('').map((id, i) => ({ id, name: id, color: 'blue', seconds: (i + 1) * 60 }));
  const folded = Charts.fold(rows);
  eq(folded.length, 6);
  eq(folded[5].id, '_other');
  eq(folded[5].seconds, (1 + 2 + 3) * 60, '小さい3つをまとめる');
  eq(folded.slice(0, 5).map((r) => r.id), ['d', 'e', 'f', 'g', 'h'], '残りは元の並び順');
});

test('割合の表示', () => {
  eq(Charts.pctText(1, 3), '33%');
  eq(Charts.pctText(1, 1000), '1%未満');
  eq(Charts.pctText(0, 10), '0%');
  eq(Charts.pctText(5, 0), '0%');
});

test('グラフの中の文字も安全にする', () => {
  const html = Charts.hbars([{ id: 'x', name: '<img src=x onerror=alert(1)>', color: 'blue', seconds: 60 }], 60)
    + Charts.donut([{ id: 'x', name: '"><script>', color: 'blue', seconds: 60 }], 60);
  ok(!html.includes('<img') && !html.includes('<script'), 'タグが残っている');
});

/* ---------- データの保存（ブラウザ版） ---------- */

test('ブラウザ版：最初は6科目が入っている', () => {
  localStorage.clear();
  Store.init();
  eq(Store.mode, 'local');
  eq(Store.subjects().map((s) => s.name), ['HTML', 'CSS', 'JavaScript', 'Photoshop', 'Illustrator', 'Figma']);
  eq(Store.subjects().map((s) => s.color), ['orange', 'blue', 'yellow', 'green', 'magenta', 'violet']);
});

test('ブラウザ版：追加・変更・削除がこの端末に保存される', () => {
  const rec = Store.put('sessions', { id: 'ses_t1', subjectId: 'sub_css', start: D(2026, 10, 31, 9), end: D(2026, 10, 31, 10), seconds: 3600, memo: 'Grid' });
  ok(rec.updatedAt > 0, 'updatedAt');
  Store.put('sessions', { id: 'ses_t1', memo: 'Grid と Flex' });
  eq(Store.state.sessions.find((s) => s.id === 'ses_t1').memo, 'Grid と Flex');
  eq(Store.state.sessions.find((s) => s.id === 'ses_t1').seconds, 3600, 'ほかの値はそのまま');
  const cached = JSON.parse(localStorage.getItem('tsumiage:data:v1'));
  ok(cached.state.sessions.some((s) => s.id === 'ses_t1'), '保存されている');
  Store.remove('sessions', 'ses_t1');
  ok(!Store.state.sessions.some((s) => s.id === 'ses_t1'), '削除');
  eq(Store.pending, 0, 'ブラウザ版は送信待ちを作らない');
});

test('ブラウザ版：タイマーの状態も保存される', () => {
  Store.setTimer({ state: 'running', subjectId: 'sub_js', startedAt: 1000, runningSince: 1000, elapsedMs: 0 });
  eq(Store.state.timer.state, 'running');
  const cached = JSON.parse(localStorage.getItem('tsumiage:data:v1'));
  eq(cached.state.timer.subjectId, 'sub_js');
  Store.setTimer(Store.idleTimer());
  eq(Store.state.timer.state, 'idle');
});

test('ブラウザ版：タイマーは複数の科目を持てる（前の形のデータも読める）', () => {
  Store.setTimer({ state: 'running', subjectIds: ['sub_html', 'sub_css', 'sub_html', ''], startedAt: 1000, runningSince: 1000, elapsedMs: 0 });
  eq(Store.state.timer.subjectIds, ['sub_html', 'sub_css'], '重なりと空は除く');
  eq(Store.state.timer.subjectId, 'sub_html', '先頭の科目');
  Store.setTimer({ state: 'paused', subjectId: 'sub_js', startedAt: 1000, runningSince: null, elapsedMs: 5000 });
  eq(Store.state.timer.subjectIds, ['sub_js'], '前の形（subjectId だけ）');
  Store.setTimer(Store.idleTimer());
  eq(Store.state.timer.subjectIds, []);
});

test('ブラウザ版：まとめて勉強した記録は groupId でつながる', () => {
  Store.batch(() => {
    Store.put('sessions', { id: 'ses_g1', subjectId: 'sub_html', start: 10, end: 20, seconds: 1800, groupId: 'grp_a' });
    Store.put('sessions', { id: 'ses_g2', subjectId: 'sub_css', start: 10, end: 20, seconds: 1800, groupId: 'grp_a' });
  });
  eq(Store.state.sessions.filter((s) => s.groupId === 'grp_a').length, 2);
  const cached = JSON.parse(localStorage.getItem('tsumiage:data:v1'));
  ok(cached.state.sessions.every((s) => 'groupId' in s), '保存データにも groupId がある');
  Store.batch(() => { Store.remove('sessions', 'ses_g1'); Store.remove('sessions', 'ses_g2'); });
});

test('バックアップの書き出しと読み込み', () => {
  const data = Store.exportData();
  eq(data.app, 'tsumiage');
  const count = Store.importData({
    app: 'tsumiage',
    subjects: [{ id: 'sub_wp', name: 'WordPress', color: 'red', order: 9 }],
    sessions: [{ id: 'ses_imp', subjectId: 'sub_wp', start: 5, end: 65, seconds: 60 }],
    rewards: [],
  });
  eq(count, { subjects: 1, sessions: 1, rewards: 0 });
  ok(Store.subject('sub_wp'), '科目が増えた');
  let threw = false;
  try { Store.importData({ app: 'other' }); } catch (e) { threw = true; }
  ok(threw, 'ちがうファイルは読み込まない');
});

/* ---------- Apps Script 側（作り物のスプレッドシートで確認） ---------- */

const live = (res, table) => res[table].map((r) => r.id);

test('GAS：最初の同期でシートができ、6科目が入る', () => {
  GasMock.reset();
  const res = GAS.sync([]);
  eq(live(res, 'subjects'), ['sub_html', 'sub_css', 'sub_js', 'sub_ps', 'sub_ai', 'sub_figma']);
  eq(res.sessions.length, 0);
  eq(res.timer, null);
  eq(GasMock.spreadsheet.getSheets().map((s) => s.getName()), ['科目', '記録', 'ごほうび'], '空のシート1は消える');
  eq(GasMock.spreadsheet.getSheetByName('記録').data[0][2], '開始', '見出し');
  const again = GAS.sync([]);
  eq(again.subjects.length, 6, '2回目で科目が増えない');
});

test('GAS：記録が保存され、日時やメモがそのまま戻る', () => {
  GasMock.reset();
  GAS.sync([]);
  const rec = { id: 'ses_a1', subjectId: 'sub_html', start: D(2026, 10, 31, 9, 15), end: D(2026, 10, 31, 10, 20), seconds: 3900, memo: '=SUM(1)', deleted: false, updatedAt: 100 };
  const rec2 = { ...rec, id: 'ses_a2', memo: '10/31', updatedAt: 100 };
  const rec3 = { ...rec, id: 'ses_a3', memo: '12345', updatedAt: 100 };
  const res = GAS.sync([{ type: 'put', table: 'sessions', record: rec }, { type: 'put', table: 'sessions', record: rec2 }, { type: 'put', table: 'sessions', record: rec3 }]);
  const got = res.sessions.find((s) => s.id === 'ses_a1');
  eq(got.start, rec.start, '開始');
  eq(got.end, rec.end, '終了');
  eq(got.seconds, 3900);
  eq(got.memo, '=SUM(1)', '式にならない');
  eq(res.sessions.find((s) => s.id === 'ses_a2').memo, '10/31', '日付にならない');
  eq(res.sessions.find((s) => s.id === 'ses_a3').memo, '12345', '数字にならない');
  const sheet = GasMock.spreadsheet.getSheetByName('記録');
  ok(sheet.data[1][2] instanceof Date, 'シートでは日時として見える');
});

test('GAS：あとから変えたほうが残る（古い変更は無視）', () => {
  GasMock.reset();
  GAS.sync([]);
  const base = { id: 'ses_b1', subjectId: 'sub_css', start: 1000, end: 61000, seconds: 60, memo: 'v1', deleted: false };
  GAS.sync([{ type: 'put', table: 'sessions', record: { ...base, updatedAt: 200 } }]);
  let res = GAS.sync([{ type: 'put', table: 'sessions', record: { ...base, memo: 'old', updatedAt: 150 } }]);
  eq(res.sessions[0].memo, 'v1', '古い変更');
  res = GAS.sync([{ type: 'put', table: 'sessions', record: { ...base, memo: 'new', updatedAt: 300 } }]);
  eq(res.sessions[0].memo, 'new', '新しい変更');
  eq(res.sessions.length, 1, '行が増えない');
  eq(GasMock.spreadsheet.getSheetByName('記録').getLastRow(), 2, 'シートの行も1件');
});

test('GAS：削除したデータは返さない（削除済みとして残る）', () => {
  GasMock.reset();
  GAS.sync([]);
  const base = { id: 'ses_c1', subjectId: 'sub_css', start: 1000, end: 61000, seconds: 60, memo: '', deleted: false, updatedAt: 10 };
  GAS.sync([{ type: 'put', table: 'sessions', record: base }]);
  let res = GAS.sync([{ type: 'put', table: 'sessions', record: { ...base, deleted: true, updatedAt: 20 } }]);
  eq(res.sessions.length, 0, '返さない');
  res = GAS.sync([{ type: 'put', table: 'sessions', record: { ...base, memo: '古い編集', updatedAt: 15 } }]);
  eq(res.sessions.length, 0, '削除より古い編集で復活しない');
  eq(GasMock.spreadsheet.getSheetByName('記録').data[1][6], true, '削除済みの印');
});

test('GAS：タイマーは新しい状態だけ反映', () => {
  GasMock.reset();
  let res = GAS.sync([{ type: 'timer', value: { state: 'running', subjectId: 'sub_js', startedAt: 5, runningSince: 5, elapsedMs: 0, updatedAt: 50 } }]);
  eq(res.timer.state, 'running');
  res = GAS.sync([{ type: 'timer', value: { state: 'idle', updatedAt: 40 } }]);
  eq(res.timer.state, 'running', '古い停止は無視');
  res = GAS.sync([{ type: 'timer', value: { state: 'idle', updatedAt: 60 } }]);
  eq(res.timer.state, 'idle', '新しい停止は反映');
});

test('GAS：たくさん追加してもシートの行が足りなくならない', () => {
  GasMock.reset();
  GAS.sync([]);
  const ops = [];
  for (let i = 0; i < 1500; i += 1) {
    ops.push({ type: 'put', table: 'sessions', record: { id: `ses_m${i}`, subjectId: 'sub_js', start: i * 1000, end: i * 1000 + 60000, seconds: 60, memo: '', deleted: false, updatedAt: 1 } });
  }
  let res = GAS.sync(ops);
  eq(res.sessions.length, 1500);
  res = GAS.sync([{ type: 'put', table: 'sessions', record: { id: 'ses_m700', subjectId: 'sub_js', start: 700000, end: 760000, seconds: 120, memo: '直した', deleted: false, updatedAt: 2 } }]);
  eq(res.sessions.length, 1500, '件数はそのまま');
  eq(res.sessions.find((s) => s.id === 'ses_m700').memo, '直した');
  eq(GasMock.spreadsheet.getSheetByName('記録').data[701][5], '直した', '正しい行が更新された');
});

test('GAS：まとめて勉強した記録の groupId が保存される', () => {
  GasMock.reset();
  GAS.sync([]);
  const base = { subjectId: 'sub_html', start: 1000, end: 61000, seconds: 30, memo: '', deleted: false, updatedAt: 5, groupId: 'grp_x1' };
  const res = GAS.sync([
    { type: 'put', table: 'sessions', record: { ...base, id: 'ses_x1' } },
    { type: 'put', table: 'sessions', record: { ...base, id: 'ses_x2', subjectId: 'sub_css' } },
  ]);
  eq(res.sessions.map((s) => s.groupId), ['grp_x1', 'grp_x1']);
  eq(GasMock.spreadsheet.getSheetByName('記録').data[0][8], 'まとめID', '見出し');
});

test('GAS：前の版で作った記録シートにも、新しい列が足される', () => {
  GasMock.reset();
  // 前の版（まとめIDの列がない）のシートを用意する
  const old = GasMock.spreadsheet.insertSheet('記録');
  old.data = [
    ['ID', '科目ID', '開始', '終了', '勉強時間（秒）', 'メモ', '削除済み', '更新日時'],
    ['ses_old', 'sub_css', new Date(2026, 9, 1, 9), new Date(2026, 9, 1, 10), 3600, 'むかしの記録', false, new Date(2026, 9, 1, 10)],
  ];
  const res = GAS.sync([]);
  eq(old.data[0][8], 'まとめID', '見出しが足された');
  const got = res.sessions.find((s) => s.id === 'ses_old');
  ok(got && got.memo === 'むかしの記録' && got.seconds === 3600 && got.groupId === '', `前の記録がそのまま読める ${JSON.stringify(got)}`);
});

test('GAS：タイマーの複数の科目が保存される', () => {
  GasMock.reset();
  let res = GAS.sync([{ type: 'timer', value: { state: 'running', subjectIds: ['sub_html', 'sub_css', 'sub_js'], startedAt: 5, runningSince: 5, elapsedMs: 0, updatedAt: 10 } }]);
  eq(res.timer.subjectIds, ['sub_html', 'sub_css', 'sub_js']);
  res = GAS.sync([{ type: 'timer', value: { state: 'running', subjectId: 'sub_ps', startedAt: 5, runningSince: 5, elapsedMs: 0, updatedAt: 20 } }]);
  eq(res.timer.subjectIds, ['sub_ps'], '前の形（subjectId だけ）も受け取れる');
});

test('GAS：おかしなデータは保存しない', () => {
  GasMock.reset();
  GAS.sync([]);
  const res = GAS.sync([
    null,
    { type: 'put', table: 'sessions', record: { id: '=HYPERLINK()', seconds: 1 } },
    { type: 'put', table: 'nothing', record: { id: 'ses_x' } },
    { type: 'unknown' },
  ]);
  eq(res.sessions.length, 0);
});

test('GAS：画面側とGAS側で、最初の科目が同じ', () => {
  eq(GAS.DEFAULT_SUBJECTS, DEFAULT_SUBJECTS.map((s) => [s.id, s.name, s.color]));
});

/* ---------- 画面（GitHub Pages）から届く、合言葉つきの送信 ---------- */

const post = (obj) => JSON.parse(GAS.doPost({ postData: { contents: typeof obj === 'string' ? obj : JSON.stringify(obj) } }).getContent());

test('GAS：setup で合言葉ができて、何度実行しても変わらない', () => {
  GasMock.reset();
  GAS.setup();
  const first = GasMock.props.apiToken;
  ok(/^[0-9a-f]{20}$/.test(first), `20文字の英数字 ${first}`);
  GAS.setup();
  eq(GasMock.props.apiToken, first);
});

test('GAS：合言葉が合えば保存して、最新のデータを返す', () => {
  GasMock.reset();
  GAS.setup();
  const token = GasMock.props.apiToken;
  const rec = { id: 'ses_a', subjectId: 'sub_html', start: 1, end: 2, seconds: 60, memo: 'メモ', updatedAt: 5 };
  const res = post({ token, ops: [{ type: 'put', table: 'sessions', record: rec }] });
  eq(res.ok, true);
  eq(res.data.sessions.map((s) => s.id), ['ses_a']);
});

test('GAS：合言葉が違う・ない・壊れたデータは、何も保存せずに断る', () => {
  GasMock.reset();
  GAS.setup();
  const rec = { id: 'ses_b', subjectId: 'sub_html', start: 1, end: 2, seconds: 60, updatedAt: 5 };
  const ops = [{ type: 'put', table: 'sessions', record: rec }];
  eq(post({ token: 'ちがう', ops }), { ok: false, error: 'auth' });
  eq(post({ ops }), { ok: false, error: 'auth' }, '合言葉なし');
  eq(post({ token: GasMock.props.apiToken.slice(0, -1), ops }), { ok: false, error: 'auth' }, '1文字足りない');
  eq(post('これはJSONではない'), { ok: false, error: 'auth' });
  eq(GAS.sync([]).sessions.length, 0, '記録は増えていない');
});

test('GAS：setup 前は、合言葉が何であっても断る', () => {
  GasMock.reset();
  const res = post({ token: '', ops: [] });
  eq([res.ok, res.error], [false, 'setup']);
  eq(post({ token: 'undefined', ops: [] }).ok, false);
});

test('GAS：ブラウザで開いても、データは見えない', () => {
  GasMock.reset();
  GAS.setup();
  ok(!/sub_html|ses_/.test(GAS.doGet().getContent()));
});

/* ---------- 見る用リンク ---------- */

test('どの版として動くか（見る用リンク・持ち主・ブラウザ版・デモ）', () => {
  const base = { hasGas: false, wantsDemo: false, apiUrl: 'https://example.com/exec', protocol: 'https:', search: '', token: '', storedViewKey: '' };
  eq(pickStoreMode({ ...base, apiUrl: '' }).mode, 'local', 'URLが書いていない');
  eq(pickStoreMode({ ...base, protocol: 'file:' }).mode, 'local', 'ファイルを開いたとき');
  eq(pickStoreMode({ ...base, protocol: 'file:', search: '?view=abc' }).mode, 'local', 'ファイルなら、見る用リンクでもブラウザ版');
  eq(pickStoreMode({ ...base, wantsDemo: true, search: '?view=abc' }).mode, 'demo');
  eq(pickStoreMode(base).mode, 'gas', '持ち主（合言葉はこれから入れる）');
  eq(pickStoreMode({ ...base, token: 't' }).mode, 'gas');
  const v = pickStoreMode({ ...base, search: '?view=abc', token: 't' });
  eq([v.mode, v.viewKey, v.rememberView], ['view', 'abc', true], '合言葉がある端末でも、見る用リンクなら見るだけ');
  const home = pickStoreMode({ ...base, storedViewKey: 'abc' });
  eq([home.mode, home.viewKey], ['view', 'abc'], 'ホーム画面から開いたとき（鍵を覚えている）');
  eq(pickStoreMode({ ...base, storedViewKey: 'abc', token: 't' }).mode, 'gas', '合言葉がある端末は、ふつうに開けば持ち主');
  const owner = pickStoreMode({ ...base, storedViewKey: 'abc', search: '?owner' });
  eq([owner.mode, owner.forgetView], ['gas', true], '?owner で持ち主に戻れる');
  eq(pickStoreMode({ ...base, search: '?view=' }).mode, 'gas', '鍵が空なら、見るだけにしない');
});

test('GAS：setup で見る用の鍵もできて、合言葉とは別のもの', () => {
  GasMock.reset();
  GAS.setup();
  const { apiToken, viewKey } = GasMock.props;
  ok(/^[0-9a-f]{20}$/.test(viewKey), `20文字の英数字 ${viewKey}`);
  ok(viewKey !== apiToken, '合言葉と同じになっている');
  GAS.setup();
  eq(GasMock.props.viewKey, viewKey, '何度実行しても変わらない');
});

test('GAS：見る用の鍵で、記録（メモも）・ごほうび・タイマーが読める。スプレッドシートのURLは出さない', () => {
  GasMock.reset();
  GAS.setup();
  post({ token: GasMock.props.apiToken, ops: [
    { type: 'put', table: 'sessions', record: { id: 'ses_v', subjectId: 'sub_html', start: 1, end: 2, seconds: 60, memo: 'メモです', updatedAt: 5 } },
    { type: 'put', table: 'rewards', record: { id: 'rew_v', title: 'ランチ', hours: 10, updatedAt: 5 } },
    { type: 'timer', value: { state: 'running', subjectIds: ['sub_html'], startedAt: 10, runningSince: 10, elapsedMs: 0, updatedAt: 6 } },
  ] });
  const res = post({ view: GasMock.props.viewKey });
  eq(res.ok, true);
  eq(res.data.sessions.map((s) => [s.id, s.memo]), [['ses_v', 'メモです']]);
  eq(res.data.rewards.map((r) => r.title), ['ランチ']);
  eq(res.data.subjects.length, 6);
  eq([res.data.timer.state, res.data.timer.subjectIds], ['running', ['sub_html']]);
  ok(!('spreadsheetUrl' in res.data), 'スプレッドシートのURLが入っている');
  ok(!('viewKey' in res.data), '鍵が入っている');
});

test('GAS：見る用の鍵では、何も保存できない（合言葉をいっしょに送っても）', () => {
  GasMock.reset();
  GAS.setup();
  const ops = [
    { type: 'put', table: 'sessions', record: { id: 'ses_x', subjectId: 'sub_html', start: 1, end: 2, seconds: 60, updatedAt: 5 } },
    { type: 'timer', value: { state: 'running', subjectIds: ['sub_html'], startedAt: 1, runningSince: 1, elapsedMs: 0, updatedAt: 9 } },
  ];
  eq(post({ view: GasMock.props.viewKey, ops }).ok, true, '読むことはできる');
  eq(post({ view: GasMock.props.viewKey, token: GasMock.props.apiToken, ops }).ok, true);
  const now = GAS.sync([]);
  eq(now.sessions.length, 0, '記録が増えた');
  eq(now.timer, null, 'タイマーが変わった');
});

test('GAS：違う鍵・合言葉・空の鍵では読めない。setup 前は断る', () => {
  GasMock.reset();
  eq(post({ view: 'なんでも' }).error, 'setup');
  GAS.setup();
  eq(post({ view: 'ちがう' }), { ok: false, error: 'auth' });
  eq(post({ view: GasMock.props.apiToken }), { ok: false, error: 'auth' }, '合言葉は、見る用の鍵としては使えない');
  eq(post({ view: '' }), { ok: false, error: 'auth' });
  eq(post({ view: null }), { ok: false, error: 'auth' });
});

test('GAS：見る用の鍵を作り直すと、前の鍵は使えず、持ち主には新しい鍵が届く', () => {
  GasMock.reset();
  GAS.setup();
  const old = GasMock.props.viewKey;
  GAS.resetViewKey();
  const fresh = GasMock.props.viewKey;
  ok(fresh && fresh !== old, '鍵が変わっていない');
  eq(post({ view: old }), { ok: false, error: 'auth' });
  eq(post({ view: fresh }).ok, true);
  eq(post({ token: GasMock.props.apiToken, ops: [] }).data.viewKey, fresh);
});

test('GAS：前の版で setup した人にも、持ち主の同期で見る用の鍵ができる', () => {
  GasMock.reset();
  GAS.setup();
  delete GasMock.props.viewKey;
  const res = post({ token: GasMock.props.apiToken, ops: [] });
  ok(/^[0-9a-f]{20}$/.test(res.data.viewKey), `鍵 ${res.data.viewKey}`);
  eq(GasMock.props.viewKey, res.data.viewKey, '保存されている');
  eq(post({ token: GasMock.props.apiToken, ops: [] }).data.viewKey, res.data.viewKey, '2回目も同じ鍵');
});

test('GAS：見る用の読み込みでは、シートを作ったり書きかえたりしない', () => {
  GasMock.reset();
  GasMock.props.apiToken = 'tok';
  GasMock.props.viewKey = 'key';
  const res = post({ view: 'key' });
  eq([res.ok, res.data.subjects.length, res.data.sessions.length], [true, 0, 0]);
  eq(GasMock.spreadsheet.getSheets().map((s) => s.getName()), ['シート1'], 'シートが増えた');
});
