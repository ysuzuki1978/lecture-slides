"""docs/ の PWA をヘッドレス Chrome で操作して確認する（decks.json の先頭のスライドを使う）。

  ~/scratch/pwvenv/bin/python tests/e2e.py <スクリーンショットの出力先>
"""
import glob
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

DOCS = str(Path(__file__).resolve().parent.parent / "docs")
OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
CHROME = glob.glob(os.path.expanduser("~/scratch/chrome/chrome-headless-shell/*/chrome-headless-shell-linux64/chrome-headless-shell"))[0]
PORT = 8791
CAT = json.loads(Path(DOCS, "decks.json").read_text(encoding="utf-8"))["decks"]
D = json.loads(Path(DOCS, "decks", CAT[0]["id"], "deck.json").read_text(encoding="utf-8"))
ID, N, REV = D["id"], len(D["slides"]), D["rev"]
NOTE_I = next(i for i, s in enumerate(D["slides"]) if s["notes"])  # ノートのある最初のスライド（0 始まり）
BASE = f"http://localhost:{PORT}/"

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "-d", DOCS], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail else ""))


try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME)
        ctx = b.new_context(viewport={"width": 1280, "height": 800})
        errors = []
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

        # 1. 一覧
        page.goto(BASE)
        page.wait_for_selector(".deck-card")
        check(f"一覧にカードが {len(CAT)} 枚", page.locator(".deck-card").count() == len(CAT))
        page.wait_for_function("document.querySelector('.deck-thumb').naturalWidth > 0")
        check("サムネイルが読み込まれる", True)
        page.screenshot(path=str(OUT / "01_catalog.png"))

        # 2. ビューア
        page.goto(BASE + f"viewer.html?id={ID}")
        page.wait_for_function("document.getElementById('count').textContent.startsWith('1 /')")
        page.wait_for_function("document.getElementById('slide').naturalWidth === 1920")
        check("ビューアで 1 枚目が表示", page.inner_text("#count") == f"1 / {N}", page.inner_text("#count"))
        page.screenshot(path=str(OUT / "02_viewer.png"))
        page.keyboard.press("ArrowRight")
        page.keyboard.press("ArrowRight")
        check("→ キーで 3 枚目", page.inner_text("#count") == f"3 / {N}")
        check("URL ハッシュが #3", page.evaluate("location.hash") == "#3")
        page.click("#tap-next")
        check("右側タップで 4 枚目", page.inner_text("#count") == f"4 / {N}")
        page.click("#tap-prev")
        check("左側タップで 3 枚目", page.inner_text("#count") == f"3 / {N}")
        page.keyboard.press("End")
        check("End で最後", page.inner_text("#count") == f"{N} / {N}")
        page.keyboard.press("ArrowRight")
        check("最後で止まる", page.inner_text("#count") == f"{N} / {N}")

        # 3. 一覧表示
        page.keyboard.press("g")
        check("G で一覧表示", page.is_visible("#grid") and page.locator("#grid-list li").count() == N)
        page.locator("#grid-list li").nth(NOTE_I).click()
        check("一覧から選んだスライドへ", page.inner_text("#count") == f"{NOTE_I + 1} / {N}" and not page.is_visible("#grid"))

        # 4. ノート
        page.keyboard.press("n")
        page.wait_for_timeout(200)
        notes = page.inner_text("#notes-body")
        check("N でノート表示", page.is_visible("#notes") and notes.strip() == D["slides"][NOTE_I]["notes"].strip(), notes[:30])
        page.screenshot(path=str(OUT / "03_notes.png"))
        page.keyboard.press("n")

        # 5. 発表者ビュー＋スクリーン用の同期
        pres = ctx.new_page()
        pres.goto(BASE + f"viewer.html?id={ID}&mode=presenter#6")
        pres.wait_for_function("document.getElementById('next').naturalWidth > 0")
        check("発表者ビューに次スライドとノート", pres.inner_text("#count") == f"6 / {N}" and len(pres.inner_text("#side-notes")) > 10)
        aud = ctx.new_page()
        aud.goto(BASE + f"viewer.html?id={ID}&mode=audience#6")
        aud.wait_for_function("document.getElementById('slide').naturalWidth > 0")
        check("スクリーン用はバー非表示", not aud.is_visible("#bar"))
        pres.bring_to_front()
        pres.keyboard.press("ArrowRight")
        aud.wait_for_function("location.hash === '#7'", timeout=3000)
        check("発表者で送るとスクリーン用も 7 枚目", aud.evaluate("location.hash") == "#7")
        time.sleep(1.2)
        pres.screenshot(path=str(OUT / "04_presenter.png"))
        aud.screenshot(path=str(OUT / "05_audience.png"))

        # 6. オフライン
        page.bring_to_front()
        page.click("#btn-save")
        page.wait_for_function("document.getElementById('btn-save').classList.contains('saved')", timeout=60000)
        n_cached = page.evaluate(f"caches.open('deck-{ID}-{REV}').then(c => c.keys()).then(k => k.length)")
        check(f"オフライン保存（{2 * N + 1} 件）", n_cached == 2 * N + 1, str(n_cached))
        page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=10000)
        ctx.set_offline(True)
        off = ctx.new_page()
        off.goto(BASE + f"viewer.html?id={ID}#{N - 1}")
        off.wait_for_function("document.getElementById('slide').naturalWidth === 1920", timeout=10000)
        check("オフラインでスライドが表示", off.inner_text("#count") == f"{N - 1} / {N}")
        off.goto(BASE)
        off.wait_for_selector(".deck-card", timeout=10000)
        check("オフラインで一覧も表示", off.locator(".deck-card").count() == len(CAT))
        ctx.set_offline(False)

        # 7. スマホ幅（iPhone 相当・縦横）
        m = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
        mp = m.new_page()
        mp.goto(BASE)
        mp.wait_for_selector(".deck-card")
        mp.screenshot(path=str(OUT / "06_phone_catalog.png"))
        mp.goto(BASE + f"viewer.html?id={ID}#2")
        mp.wait_for_function("document.getElementById('slide').naturalWidth > 0")
        mp.screenshot(path=str(OUT / "07_phone_viewer.png"))
        mp.set_viewport_size({"width": 844, "height": 390})
        mp.wait_for_timeout(300)
        mp.screenshot(path=str(OUT / "08_phone_landscape.png"))
        # スワイプ（左へ）
        mp.evaluate("""() => {
          const s = document.getElementById('stage');
          const t = (x) => new Touch({identifier: 1, target: s, clientX: x, clientY: 150});
          s.dispatchEvent(new TouchEvent('touchstart', {touches: [t(600)], changedTouches: [t(600)], bubbles: true}));
          s.dispatchEvent(new TouchEvent('touchend', {touches: [], changedTouches: [t(300)], bubbles: true, cancelable: true}));
        }""")
        check("左スワイプで次へ", mp.inner_text("#count") == f"3 / {N}", mp.inner_text("#count"))

        check("JS エラーなし", not errors, "; ".join(errors[:3]))
        b.close()
finally:
    srv.terminate()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
