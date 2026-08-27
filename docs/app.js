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

  /* ---------------- 摘要卡（分類色 + 迷你走勢） ---------------- */
  function sparkline(seq) {
    const wrap = EL("div", "spark");
    const pts = (seq || []).slice(-8);
    if (!pts.length) return wrap;
    const max = Math.max(...pts.map((p) => Math.abs(p.v))) || 1;
    pts.forEach((p) => {
      const bar = EL("i", sign(p.v));
      bar.style.height = Math.max(10, (Math.abs(p.v) / max) * 100) + "%";
      wrap.append(bar);
    });
    return wrap;
  }

  function summaryCard(cat, label, dateStr, value, display, seq) {
    const card = EL("div", "s-card cat-" + cat);
    card.append(EL("div", "s-label", label));
    if (dateStr) card.append(EL("div", "s-date", dateStr));
    const val = EL("div", "s-val num " + sign(value), display.text);
    if (display.unit) val.append(EL("small", null, display.unit));
    card.append(val, sparkline(seq));
    return card;
  }

  function renderSummary() {
    const s = DATA.summary, ser = DATA.series;
    const box = $("#summary");
    box.textContent = "";

    const dates = Object.values(s.dates || {}).filter(Boolean).sort();
    $("#today-date").textContent = dates.length
      ? `最近交易日 ${dates[dates.length - 1]}` : "尚無資料";

    box.append(
      summaryCard("flow", "上市外資買賣超", s.dates.twse_foreign, s.twse_foreign,
        { text: fmtOku(s.twse_foreign), unit: "億" }, ser.twse_foreign),
      summaryCard("flow", "上市投信買賣超", s.dates.twse_trust, s.twse_trust,
        { text: fmtOku(s.twse_trust), unit: "億" }, ser.twse_trust),
      summaryCard("margin", "上市融資增減", s.dates.twse_margin, s.twse_margin_change,
        { text: fmtOku(s.twse_margin_change, 2), unit: "億" }, null),
      summaryCard("margin", "上櫃融資增減", s.dates.tpex_margin, s.tpex_margin_change,
        { text: fmtOku(s.tpex_margin_change, 2), unit: "億" }, null),
      summaryCard("oi", "外資期貨未平倉淨額", s.dates.tx_foreign_oi, s.tx_foreign_oi,
        { text: fmtLots(s.tx_foreign_oi), unit: "口" }, ser.tx_foreign_oi),
      summaryCard("oi", "較前一日增減", s.dates.tx_foreign_oi, s.tx_foreign_oi_change,
        { text: fmtLots(s.tx_foreign_oi_change), unit: "口" }, null)
    );
  }

  /* ---------------- SVG 圖 ---------------- */
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (t, attrs) => {
    const e = document.createElementNS(NS, t);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  function barChart(points) {
    const W = 320, H = 92, PAD = 4;
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
        x, y: p.v >= 0 ? mid - h : mid, width: bw, height: Math.max(h, 0.7),
        fill: p.v >= 0 ? "var(--buy)" : "var(--sell)",
      });
      const tip = document.createElementNS(NS, "title");
      tip.textContent = `${p.d}　${(p.v / OKU).toFixed(2)} 億`;
      rect.append(tip);
      svg.append(rect);
    });
    return svg;
  }

  function lineChart(points, accent) {
    const W = 320, H = 92, PAD = 6;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    if (points.length < 2) return svg;

    const vs = points.map((p) => p.v);
    const lo = Math.min(...vs), hi = Math.max(...vs);
    const span = hi - lo || 1;
    const x = (i) => PAD + (i * (W - PAD * 2)) / (points.length - 1);
    const y = (v) => PAD + (1 - (v - lo) / span) * (H - PAD * 2);
    const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");

    svg.append(svgEl("path", {
      d: `${d}L${x(points.length - 1)},${H - PAD}L${x(0)},${H - PAD}Z`,
      fill: accent, opacity: .13,
    }));
    svg.append(svgEl("path", { d, fill: "none", stroke: accent, "stroke-width": 1.8 }));
    const last = svgEl("circle", { cx: x(points.length - 1), cy: y(vs[vs.length - 1]), r: 3, fill: accent });
    const tip = document.createElementNS(NS, "title");
    tip.textContent = `${points[points.length - 1].d}`;
    last.append(tip);
    svg.append(last);
    return svg;
  }

  function chartCard(cat, eyebrow, title, sub, node) {
    const c = EL("div", "chart cat-" + cat);
    c.append(EL("p", "eyebrow", eyebrow), EL("h3", null, title), EL("p", "sub", sub), node);
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
      box.append(chartCard("flow", "INSTITUTIONAL FLOW", label,
        `${win} 日累計 ${sum == null ? "—" : fmtOku(sum)} 億`,
        barChart(pts)));
    });

    [["上市 融資餘額", "twse_margin"], ["上櫃 融資餘額", "tpex_margin"]]
      .forEach(([label, key]) => {
        const pts = cut(S[key]);
        const last = pts.length ? pts[pts.length - 1].v : null;
        const chg = W[key];
        box.append(chartCard("margin", "MARGIN BALANCE", label,
          `餘額 ${plain(last)} 億　${win} 日增減 ${chg == null ? "—" : fmtOku(chg)} 億`,
          lineChart(pts, "var(--cat-margin)")));
      });

    const oi = cut(S.tx_foreign_oi);
    const lastOi = oi.length ? oi[oi.length - 1].v : null;
    box.append(chartCard("oi", "FUTURES OPEN INTEREST", "台指期 外資未平倉淨額",
      `淨額 ${lastOi == null ? "—" : lastOi.toLocaleString("en-US")} 口　${win} 日增減 ${fmtLots(W.tx_foreign_oi)} 口`,
      lineChart(oi, "var(--cat-oi)")));
  }

  /* ---------------- 明細表 ---------------- */
  function renderTable() {
    const tb = $("#detail tbody");
    tb.textContent = "";
    (DATA.table || []).forEach((r) => {
      const tr = EL("tr");
      tr.append(EL("td", null, r.d));
      const cell = (v, sep) => tr.append(EL("td", (sep ? "sep " : "") + sign(v), fmtOku(v)));
      cell(r.tw_f, true); cell(r.tw_t); cell(r.tw_d);
      cell(r.tp_f, true); cell(r.tp_t); cell(r.tp_d);
      tr.append(EL("td", "sep", plain(r.tw_m)));
      tr.append(EL("td", null, plain(r.tp_m)));
      tr.append(EL("td", "sep " + sign(r.oi), r.oi == null ? "—" : r.oi.toLocaleString("en-US")));
      tb.append(tr);
    });
  }

  /* ---------------- 排行（表格） ---------------- */
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

    const fill = (tbody, rows, cls) => {
      if (!rows.length) {
        const tr = EL("tr");
        const td = EL("td", "rank-empty", "無符合條件的個股");
        td.colSpan = 3;
        tr.append(td);
        tbody.append(tr);
        return;
      }
      rows.forEach((r, i) => {
        const tr = EL("tr");
        tr.append(EL("td", "rk", String(i + 1)));
        const nm = EL("td", "nm");
        nm.append(EL("code", null, r.c), document.createTextNode(r.n));
        nm.append(EL("span", "mk", r.m === "TWSE" ? "［市］" : "［櫃］"));
        tr.append(nm);
        tr.append(EL("td", "amt num " + cls, fmtOku(r[who], 2)));
        tbody.append(tr);
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
        '<p class="rank-empty">還沒有資料檔。到 GitHub 的 Actions 頁面手動執行一次「更新籌碼資料」，' +
        "回補天數填 40，跑完後重新整理這一頁。</p>";
    });
})();
