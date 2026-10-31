/* 保存先の設定。
   スプレッドシートに保存する版では、Apps Script の「ウェブアプリのURL」（末尾が /exec）を入れる。
   空のままなら、このブラウザの中だけに保存する版として動く。
   URLだけでは読み書きできない（合言葉が要る）ので、公開しても大丈夫。 */
window.TSUMIAGE_API_URL = 'https://script.google.com/macros/s/AKfycbyezY0V7YIfVMI-mbvUjkV3EEn3HhHNyJ28C3lNxgfks78Rq20UffUtHuiXg7QIEY0/exec';

/* 見る用リンクを開いた人の画面に出す名前。「〇〇の勉強記録」と表示される */
window.TSUMIAGE_OWNER_NAME = 'かいせい';
