"""
つみあげ — テスト用のファイルを作るスクリプト

gas/Code.gs を、テスト用に tests/_code_gs.js として複製します。
（画面は GitHub Pages に置くので、Apps Script 用に HTML をまとめる作業は要りません）

使い方：このフォルダで  python tools/build.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main() -> None:
    # 画面側と名前がぶつからないよう、関数の中に閉じこめる
    code = (ROOT / "gas" / "Code.gs").read_text(encoding="utf-8")
    wrapped = (
        "/* tools/build.py が作るテスト用の複製。直接編集しない */\n"
        "const GAS = (function () {\n" + code +
        "\nreturn { sync: sync, setup: setup, doPost: doPost, doGet: doGet, DEFAULT_SUBJECTS: DEFAULT_SUBJECTS, TABLES: TABLES };\n})();\n"
    )
    out = ROOT / "tests" / "_code_gs.js"
    out.write_text(wrapped, encoding="utf-8", newline="\n")
    print(f"作成しました：{out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
