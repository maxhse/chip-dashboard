/* 法人籌碼儀錶板 — 讀 data/dashboard.json 後渲染。無外部相依。 */
(() => {
  const $ = (s) => document.querySelector(s);
  const EL = (t, c, txt) => {
    const e = document.createElement(t);
    if (c) e.className = c;
    if (txt != null) e.textContent = txt;
    return e;
  };

  const OKU = 1e8;
  const sign = (v) => (v == null ? "flat" : v > 0 ? "buy" : v < 0 ? "sell" : "flat");

  const fmtOku = (v, dp = 1) =>
    v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v / OKU).toFixed(dp);
  const fmtLots = (v) =>
    v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toLocaleString("en-US");
  const plain = (v, dp = 1) => (v == null ? "—" : (v / OKU).toFixed(dp));

  const shortTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  let DATA = null;
  let win = 10;
  let who = "f";
  let rankWin = 1;

  /* ---------------- 資料來源狀態列 ---------------- */
  function renderFeeds(status) {
    const box = $("#feeds");
    box.textContent = "";
    Object.entries(status || {})
      .filter(([k]) => !k.startsWith("_"))
      .forEach(([, s]) => {
        const el = EL("div", "feed" + (s.ok ? "" : " stale"));
        el.append(EL("b", null, s.label || ""));
        const t = EL("time", null, shortTime(s.updated_at));
        if (!s.ok) {
          t.textContent = "上次成功 " + shortTime(s.updated_at);
          el.title = "最近一次抓取失敗：" + (s.error || "");
        }
        el.append(t);
        box.append(el);
      });
  }

  /* ---------------- 中軸發散條 ---------------- */
  function axisBar(value, scale, ghost) {
    const wrap = EL("div", "axis");
    const put = (v, cls, extra) => {
      if (v == null || !scale) return;
      const pct = Math.min(Math.abs(v) / scale, 1) * 50;
      const b = EL("div", cls + " " + extra);
      b.style.background =
        v > 0 ? (extra === "ghost" ? "var(--buy-soft)" : "var(--buy)")
              : (extra === "ghost" ? "var(--sell-soft)" : "var(--sell)");
      if (v >= 0) { b.style.left = "50%"; b.style.width = pct + "%"; }
      else { b.style.left = 50 - pct + "%"; b.style.width = pct + "%"; }
      wrap.append(b);
    };
    put(ghost, "bar", "ghost");
    put(value, "bar", "solid");
    return wrap;
  }

  function metric(name, sub, value, display, scale, ghost) {
    const row = EL("div", "metric");
    const n = EL("div", "metric-name", name);
    if (sub) n.append(EL("small", null, sub));
    row.append(n, axisBar(value, scale, ghost));
    const v = EL("div", "metric-val " + sign(value), display.text);
    if (display.unit) v.append(EL("small", null, display.unit));
    row.append(v);
    return row;
  }

  /* ---------------- 今日盤後 ---------------- */
  function renderSummary() {
    const s = DATA.summary, w5 = DATA.windows["5"] || {};
    const box = $("#summary");
    box.textContent = "";

    const dates = Object.values(s.dates || {}).filter(Boolean).sort();
    $("#today-date").textContent = dates.length
      ? `最近交易日 ${dates[dates.length - 1]}` : "尚無資料";

    const flowScale = Math.max(
      300 * OKU,
      ...[s.twse_foreign, s.twse_trust, w5.twse_foreign, w5.twse_trust]
        .filter((v) => v != null).map(Math.abs)
    );
    const marginScale = Math.max(
      30 * OKU,
      ...[s.twse_margin_change, s.tpex_margin_change]
        .filter((v) => v != null).map(Math.abs)
    );
    const oiScale = Math.max(
      8000,
      ...[s.tx_foreign_oi, s.tx_foreign_oi_change].filter((v) => v != null).map(Math.abs)
    );

    box.append(
      metric("外資", "上市買賣超", s.twse_foreign,
        { text: fmtOku(s.twse_foreign), unit: "億" }, flowScale, w5.twse_foreign),
      metric("投信", "上市買賣超", s.twse_trust,
        { text: fmtOku(s.twse_trust), unit: "億" }, flowScale, w5.twse_trust),
      metric("上市融資", "餘額增減", s.twse_margin_change,
        { text: fmtOku(s.twse_margin_change, 2), unit: "億" }, marginScale),
      metric("上櫃融資", "餘額增減", s.tpex_margin_change,
        { text: fmtOku(s.tpex_margin_change, 2), unit: "億" }, marginScale),
      metric("台指期", "外資未平倉淨額", s.tx_foreign_oi,
        { text: fmtLots(s.tx_foreign_oi), unit: "口" }, oiScale),
      metric("　", "較前一日增減", s.tx_foreign_oi_change,
        { text: fmtLots(s.tx_foreign_oi_change), unit: "口" }, oiScale)
    );
  }

  /* ---------------- SVG 圖 ---------------- */
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (t, attrs) => {
    const e = document.createElementNS(NS, t);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  function barChart(points, unit) {
    const W = 320, H = 96, PAD = 4;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    if (!points.length) return svg;

    const max = Math.max(...points.map((p) => Math.abs(p.v))) || 1;
    const mid = H / 2;
    const bw = Math.max(2, (W - PAD * 2) / points.length - 2);

    svg.append(svgEl("line", {
      x1: 0, y1: mid, x2: W, y2: mid, stroke: "var(--rule)", "stroke-width": 1,
    }));
    points.forEach((p, i) => {
      const x = PAD + i * ((W - PAD * 2) / points.length);
      const h = (Math.abs(p.v) / max) * (mid - 6);
      const rect = svgEl("rect", {
        x: x, y: p.v >= 0 ? mid - h : mid, width: bw, height: Math.max(h, 0.7),
        fill: p.v >= 0 ? "var(--buy)" : "var(--sell)",
      });
      const tip = document.createElementNS(NS, "title");
      tip.textContent = `${p.d}　${(p.v / OKU).toFixed(2)} ${unit}`;
      rect.append(tip);
      svg.append(rect);
    });
    return svg;
  }

  function lineChart(points, unit) {
    const W = 320, H = 96, PAD = 6;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    if (points.length < 2) return svg;

    const vs = points.map((p) => p.v);
    const lo = Math.min(...vs), hi = Math.max(...vs);
    const span = hi - lo || 1;
    const x = (i) => PAD + (i * (W - PAD * 2)) / (points.length - 1);
    const y = (v) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);

    const up = vs[vs.length - 1] >= vs[0];
    const stroke = up ? "var(--buy)" : "var(--sell)";
    const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");

    svg.append(svgEl("path", {
      d: `${d}L${x(points.length - 1)},${H - PAD}L${x(0)},${H - PAD}Z`,
      fill: up ? "var(--buy-soft)" : "var(--sell-soft)", opacity: .55,
    }));
    svg.append(svgEl("path", { d, fill: "none", stroke, "stroke-width": 1.8 }));
    const last = svgEl("circle", {
      cx: x(points.length - 1), cy: y(vs[vs.length - 1]), r: 3, fill: stroke,
    });
    last.append(Object.assign(document.createElementNS(NS, "title"),
      { textContent: `${points[points.length - 1].d}　${unit}` }));
    svg.append(last);
    return svg;
  }

  function card(title, sub, node) {
    const c = EL("div", "chart");
    c.append(EL("h3", null, title), EL("p", "sub", sub), node);
    return c;
  }

  function renderCharts() {
    const box = $("#charts");
    box.textContent = "";
    const S = DATA.series, W = DATA.windows[String(win)] || {};
    const cut = (a) => (a || []).slice(-win);

    const flows = [
      ["上市 外資買賣超", "twse_foreign"],
      ["上市 投信買賣超", "twse_trust"],
      ["上櫃 外資買賣超", "tpex_foreign"],
      ["上櫃 投信買賣超", "tpex_trust"],
    ];
    flows.forEach(([label, key]) => {
      const pts = cut(S[key]);
      const sum = W[key];
      box.append(card(label,
        `${win} 日累計 ${sum == null ? "—" : fmtOku(sum)} 億`,
        barChart(pts, "億")));
    });

    [["上市 融資餘額", "twse_margin"], ["上櫃 融資餘額", "tpex_margin"]]
      .forEach(([label, key]) => {
        const pts = cut(S[key]);
        const last = pts.length ? pts[pts.length - 1].v : null;
        const chg = W[key];
        box.append(card(label,
          `餘額 ${plain(last)} 億　${win} 日增減 ${chg == null ? "—" : fmtOku(chg)} 億`,
          lineChart(pts, plain(last) + " 億")));
      });

    const oi = cut(S.tx_foreign_oi);
    const lastOi = oi.length ? oi[oi.length - 1].v : null;
    box.append(card("台指期 外資未平倉淨額",
      `淨額 ${lastOi == null ? "—" : lastOi.toLocaleString("en-US")} 口　${win} 日增減 ${fmtLots(W.tx_foreign_oi)} 口`,
      lineChart(oi, (lastOi ?? "") + " 口")));
  }

  /* ---------------- 明細表 ---------------- */
  function renderTable() {
    const tb = $("#detail tbody");
    tb.textContent = "";
    (DATA.table || []).forEach((r) => {
      const tr = EL("tr");
      tr.append(EL("td", null, r.d));
      const cell = (v, fmt, sep) => {
        const td = EL("td", (sep ? "sep " : "") + sign(v), fmt(v));
        tr.append(td);
      };
      cell(r.tw_f, (v) => fmtOku(v), true);
      cell(r.tw_t, (v) => fmtOku(v));
      cell(r.tw_d, (v) => fmtOku(v));
      cell(r.tp_f, (v) => fmtOku(v), true);
      cell(r.tp_t, (v) => fmtOku(v));
      cell(r.tp_d, (v) => fmtOku(v));
      tr.append(EL("td", "sep", plain(r.tw_m)));
      tr.append(EL("td", null, plain(r.tp_m)));
      const oi = EL("td", "sep " + sign(r.oi),
        r.oi == null ? "—" : r.oi.toLocaleString("en-US"));
      tr.append(oi);
      tb.append(tr);
    });
  }

  /* ---------------- 排行 ---------------- */
  function renderRanks() {
    const block = (DATA.rankings || {})[String(rankWin)];
    const note = $("#rank-note");
    const buy = $("#rank-buy"), sell = $("#rank-sell");
    buy.textContent = ""; sell.textContent = "";

    if (!block || !block[who]) {
      note.textContent = "尚無排行資料。";
      return;
    }
    note.textContent = block.complete
      ? `${block.from} ～ ${block.to}　共 ${block.days_used} 個交易日`
      : `資料僅累積 ${block.days_used} 個交易日（不足 ${rankWin} 日），${block.from} ～ ${block.to}`;

    const fill = (ol, rows, cls) => {
      if (!rows.length) {
        ol.append(EL("li", "empty", "無符合條件的個股"));
        return;
      }
      rows.forEach((r, i) => {
        const li = EL("li");
        li.append(EL("div", "r", String(i + 1)));
        const s = EL("div", "s");
        s.append(EL("code", null, r.c), document.createTextNode(r.n));
        s.append(EL("span", "mk", r.m === "TWSE" ? "市" : "櫃"));
        li.append(s, EL("div", "v " + cls, fmtOku(r[who], 2)));
        ol.append(li);
      });
    };
    fill(buy, block[who].buy || [], "buy");
    fill(sell, block[who].sell || [], "sell");
  }

  /* ---------------- 切換 ---------------- */
  function wire(sel, attr, fn) {
    $(sel).addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      [...e.currentTarget.children].forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      fn(b.dataset[attr]);
    });
  }

  /* ---------------- 啟動 ---------------- */
  fetch("data/dashboard.json?t=" + Date.now())
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then((json) => {
      DATA = json;
      renderFeeds(json.status);
      renderSummary();
      renderCharts();
      renderTable();
      renderRanks();
      $("#built").textContent = "頁面資料產出時間 " + shortTime(json.built_at);

      wire("#win-switch", "win", (v) => { win = +v; renderCharts(); });
      wire("#who-switch", "who", (v) => { who = v; renderRanks(); });
      wire("#rank-switch", "w", (v) => { rankWin = +v; renderRanks(); });
    })
    .catch(() => {
      $("#summary").innerHTML =
        '<p class="empty">還沒有資料檔。到 GitHub 的 Actions 頁面手動執行一次「更新籌碼資料」，' +
        "回補天數填 40，跑完後重新整理這一頁。</p>";
    });
})();
