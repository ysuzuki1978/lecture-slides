// スライド一覧：decks.json を読み、新しい順にカードを並べる
(function () {
  "use strict";

  const list = document.getElementById("decks");
  const empty = document.getElementById("empty");

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function render(decks) {
    list.textContent = "";
    decks.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    empty.hidden = decks.length > 0;
    for (const d of decks) {
      const li = el("li", "deck-card");
      const a = el("a");
      a.href = `viewer.html?id=${encodeURIComponent(d.id)}`;
      const img = el("img", "deck-thumb");
      img.src = `decks/${d.id}/${d.thumb}?v=${d.rev}`;
      img.alt = "";
      img.loading = "lazy";
      img.width = 480;
      img.height = Math.round(480 / (d.aspect || 16 / 9));
      const body = el("div", "deck-body");
      body.append(el("p", "deck-meta", `${d.date || ""}  ·  ${d.slides} 枚`));
      body.append(el("h2", "deck-title", d.title));
      if (d.subtitle) body.append(el("p", "deck-sub", d.subtitle));
      a.append(img, body);
      li.append(a);
      list.append(li);
    }
  }

  fetch("decks.json", { cache: "no-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then((j) => render(j.decks || []))
    .catch(() => {
      empty.hidden = false;
      empty.textContent = "一覧を読み込めませんでした。通信状態を確認してください。";
    });

  if (!navigator.onLine) document.getElementById("offline-note").hidden = false;
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
