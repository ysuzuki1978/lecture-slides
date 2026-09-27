// スライドビューア
//   通常：スライド＋下部バー。?mode=presenter で発表者ビュー、?mode=audience でスライドのみ（スクリーン用）
//   同じ端末の複数ウィンドウは BroadcastChannel でページを同期する
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "";
  const mode = params.get("mode") || "normal";
  const $ = (s) => document.getElementById(s);

  const slideImg = $("slide"), nextImg = $("next");
  const bar = $("bar"), grid = $("grid"), gridList = $("grid-list");
  const notesPanel = $("notes"), notesBody = $("notes-body"), sideNotes = $("side-notes");
  const toastEl = $("toast");

  let deck = null;
  let idx = 0;
  let channel = null;

  document.body.classList.add(`mode-${mode}`);

  function toast(msg, ms = 2200) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (toastEl.hidden = true), ms);
  }

  function url(name) {
    return `decks/${id}/${name}?v=${deck.rev}`;
  }

  function preload(i) {
    if (i >= 0 && i < deck.slides.length) new Image().src = url(deck.slides[i].img);
  }

  function setNotes(target, text) {
    target.textContent = text && text.trim() ? text : "（ノートなし）";
  }

  function show(i, { broadcast = true, push = true } = {}) {
    if (!deck) return;
    i = Math.max(0, Math.min(deck.slides.length - 1, i));
    idx = i;
    const s = deck.slides[i];
    slideImg.src = url(s.img);
    slideImg.alt = s.text || `スライド ${i + 1}`;
    $("count").textContent = `${i + 1} / ${deck.slides.length}`;
    setNotes(notesBody, s.notes);
    if (mode === "presenter") {
      setNotes(sideNotes, s.notes);
      const n = deck.slides[i + 1];
      nextImg.src = n ? url(n.thumb) : "";
      nextImg.alt = n ? `次：スライド ${i + 2}` : "最後のスライド";
      nextImg.classList.toggle("is-end", !n);
    }
    preload(i + 1);
    preload(i - 1);
    if (push) history.replaceState(null, "", `#${i + 1}`);
    if (broadcast && channel) channel.postMessage({ i });
    document.querySelectorAll("#grid-list li").forEach((li, k) => li.classList.toggle("current", k === i));
  }

  const next = () => show(idx + 1);
  const prev = () => show(idx - 1);

  // ---------------------------------------------------------------- 一覧
  function buildGrid() {
    gridList.textContent = "";
    deck.slides.forEach((s, k) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      const im = document.createElement("img");
      im.src = url(s.thumb);
      im.alt = `スライド ${k + 1}`;
      im.loading = "lazy";
      const n = document.createElement("span");
      n.textContent = k + 1;
      b.append(im, n);
      b.addEventListener("click", () => { toggleGrid(false); show(k); });
      li.append(b);
      gridList.append(li);
    });
  }

  function toggleGrid(on = grid.hidden) {
    grid.hidden = !on;
    if (on) {
      const cur = gridList.children[idx];
      if (cur) cur.scrollIntoView({ block: "center" });
    }
  }

  function toggleNotes(on = notesPanel.hidden) {
    notesPanel.hidden = !on;
    document.body.classList.toggle("notes-open", on);
  }

  // ---------------------------------------------------------------- 全画面・スリープ防止
  function toggleFullscreen() {
    const d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    } else {
      const e = d.documentElement;
      const req = e.requestFullscreen || e.webkitRequestFullscreen;
      if (req) req.call(e);
      else toast("この端末では全画面にできません。ホーム画面に追加すると全画面で開けます。", 3500);
    }
  }

  let wakeLock = null;
  async function keepAwake() {
    try {
      if ("wakeLock" in navigator && document.visibilityState === "visible") {
        wakeLock = await navigator.wakeLock.request("screen");
      }
    } catch (_) { /* 非対応・拒否は無視 */ }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") keepAwake(); });

  // ---------------------------------------------------------------- オフライン保存
  function cacheName() { return `deck-${id}-${deck.rev}`; }
  function allUrls() {
    const u = [`decks/${id}/deck.json`];
    deck.slides.forEach((s) => u.push(url(s.img), url(s.thumb)));
    return u;
  }
  async function isSaved() {
    if (!("caches" in window)) return false;
    const c = await caches.open(cacheName());
    const keys = await c.keys();
    return keys.length >= allUrls().length;
  }
  async function saveOffline() {
    if (!("caches" in window)) { toast("この端末ではオフライン保存に対応していません。"); return; }
    const btn = $("btn-save");
    btn.disabled = true;
    try {
      const c = await caches.open(cacheName());
      const urls = allUrls();
      let done = 0;
      for (const u of urls) {
        await c.add(u);
        done += 1;
        if (done % 5 === 0) toast(`保存中… ${done} / ${urls.length}`, 60000);
      }
      // 古い版のキャッシュを消す
      for (const k of await caches.keys()) if (k.startsWith(`deck-${id}-`) && k !== cacheName()) await caches.delete(k);
      btn.classList.add("saved");
      toast("オフライン用に保存しました。");
    } catch (e) {
      toast("保存に失敗しました。通信状態を確認してください。", 3500);
    } finally {
      btn.disabled = false;
    }
  }

  // ---------------------------------------------------------------- 発表者ビュー
  let t0 = Date.now();
  function tick() {
    const s = Math.floor((Date.now() - t0) / 1000);
    $("clock").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  function openAudience() {
    const w = window.open(`viewer.html?id=${encodeURIComponent(id)}&mode=audience#${idx + 1}`, `audience-${id}`, "popup,width=1280,height=720");
    if (!w) toast("ポップアップが止められました。ブラウザの設定で許可してください。", 3500);
  }
  function openPresenter() {
    location.href = `viewer.html?id=${encodeURIComponent(id)}&mode=presenter#${idx + 1}`;
  }

  // ---------------------------------------------------------------- 入力
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (!grid.hidden && k === "Escape") { toggleGrid(false); return; }
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); next(); }
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); prev(); }
    else if (k === "Home") show(0);
    else if (k === "End") show(deck.slides.length - 1);
    else if (k === "g" || k === "G") toggleGrid();
    else if ((k === "n" || k === "N") && mode === "normal") toggleNotes();
    else if (k === "f" || k === "F") toggleFullscreen();
    else if ((k === "p" || k === "P") && mode === "normal") openPresenter();
    else if (k === "Escape" && !notesPanel.hidden) toggleNotes(false);
  });

  $("tap-prev").addEventListener("click", prev);
  $("tap-next").addEventListener("click", next);
  $("prev").addEventListener("click", prev);
  $("nextbtn").addEventListener("click", next);
  $("btn-grid").addEventListener("click", () => toggleGrid());
  $("grid-close").addEventListener("click", () => toggleGrid(false));
  $("btn-notes").addEventListener("click", () => toggleNotes());
  $("btn-fs").addEventListener("click", toggleFullscreen);
  $("btn-save").addEventListener("click", saveOffline);
  $("btn-presenter").addEventListener("click", openPresenter);
  $("open-audience").addEventListener("click", openAudience);
  $("clock-reset").addEventListener("click", () => { t0 = Date.now(); tick(); });
  nextImg.addEventListener("click", next);

  // スワイプ
  let sx = null, sy = null;
  const stage = $("stage");
  stage.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { e.preventDefault(); dx < 0 ? next() : prev(); }
  });

  // 操作がないとバーを隠す（通常ビューの全画面時のみ）
  let idleT = null;
  function wake() {
    document.body.classList.remove("idle");
    clearTimeout(idleT);
    idleT = setTimeout(() => {
      if (document.fullscreenElement || document.webkitFullscreenElement || matchMedia("(display-mode: standalone)").matches) {
        document.body.classList.add("idle");
      }
    }, 3000);
  }
  ["mousemove", "touchstart", "keydown"].forEach((ev) => document.addEventListener(ev, wake, { passive: true }));

  window.addEventListener("hashchange", () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (!Number.isNaN(n) && n - 1 !== idx) show(n - 1, { push: false });
  });

  // ---------------------------------------------------------------- 読み込み
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    document.body.innerHTML = '<p class="error">スライドが指定されていません。<a href="./">一覧へ</a></p>';
    return;
  }

  fetch(`decks/${id}/deck.json`, { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => {
      deck = d;
      document.title = d.title;
      $("title").textContent = d.title;
      buildGrid();
      if ("BroadcastChannel" in window) {
        channel = new BroadcastChannel(`deck-${id}`);
        channel.onmessage = (m) => { if (typeof m.data.i === "number" && m.data.i !== idx) show(m.data.i, { broadcast: false }); };
      }
      const n = parseInt(location.hash.slice(1), 10);
      show(Number.isNaN(n) ? 0 : n - 1, { broadcast: false });
      if (mode === "presenter") { tick(); setInterval(tick, 1000); }
      keepAwake();
      wake();
      isSaved().then((ok) => $("btn-save").classList.toggle("saved", ok)).catch(() => {});
    })
    .catch(() => {
      document.body.innerHTML = '<p class="error">スライドを読み込めませんでした。<a href="./">一覧へ</a></p>';
    });

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
