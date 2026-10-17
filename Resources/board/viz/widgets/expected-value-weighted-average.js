// Expected value as a probability-weighted average. A bag holds tickets with four prizes ($0, $2, $5, $10); draw one,
// and X is its prize. The sliders set how many tickets carry each prize, so P(X = x) = (tickets at x) / (all tickets).
// Top: the distribution of X, with E[X] marked where it balances. Bottom: E[X] built as a sum of x·P(X = x) pieces,
// next to the plain average of the four prizes (each weighted 1/4), so the effect of the weights is visible.
(function () {
  var PRIZES = [0, 2, 5, 10], KEYS = ["tickets0", "tickets2", "tickets5", "tickets10"];
  function calc(v) {
    var w = KEYS.map(function (k) { return v[k]; }), N = w.reduce(function (s, x) { return s + x; }, 0);
    var p = w.map(function (x) { return N ? x / N : 0; }), parts = PRIZES.map(function (x, i) { return x * p[i]; });
    return {w: w, N: N, p: p, parts: parts, e: parts.reduce(function (s, x) { return s + x; }, 0), plain: 17 / 4};
  }
  var money = function (x) { return "$" + x.toFixed(2); };
  var close = function (a, b) { return Math.abs(a - b) < 1e-9; };

  Viz.register("expected-value-weighted-average", {
    title: "Expected value as a weighted average",
    subject: "stats",
    shows: "Change how many tickets carry each prize: E[X] weights every prize by its probability, so common prizes pull it toward them",
    params: {
      tickets0: {kind: "integer", default: 4, min: 0, max: 10, label: "\\#\\,\\$0"},
      tickets2: {kind: "integer", default: 3, min: 0, max: 10, label: "\\#\\,\\$2"},
      tickets5: {kind: "integer", default: 2, min: 0, max: 10, label: "\\#\\,\\$5"},
      tickets10: {kind: "integer", default: 1, min: 0, max: 10, label: "\\#\\,\\$10"}
    },
    formula: function (v) {
      var k = calc(v);
      if (!k.N) return "\\mathbb{E}[X]\\ \\text{is undefined: no tickets}";
      var exact = close(Math.round(k.e * 100) / 100, k.e);
      return "\\begin{array}{l}\\mathbb{E}[X]=\\sum_x xP(X=x)\\\\\\quad=" + PRIZES.map(function (x, i) { return x + "\\cdot\\tfrac{" + k.w[i] + "}{" + k.N + "}"; }).join("+") +
        "\\\\\\quad=" + k.parts.map(function (q) { return Viz.n(q, 2); }).join("+") + (exact ? "=" : "\\approx") + Viz.n(k.e, 2) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), nz = k.w.filter(function (x) { return x > 0; }).length;
      if (!k.N) return "The bag is empty, so X has no distribution yet: add at least one ticket.";
      if (nz === 1) return "Every ticket pays the same prize, so X is certain and <b>E[X] = " + money(k.e) + "</b>.";
      if (k.w.every(function (x) { return x === k.w[0]; })) return "Equal tickets make every prize equally likely, so E[X] is just the plain average, <b>" + money(k.e) + "</b>.";
      if (close(k.e, k.plain)) return "Here the weights happen to balance out: <b>E[X] = " + money(k.e) + "</b>, the same as the plain average.";
      var low = k.e < k.plain;
      return "Weighted by probability, the average prize is <b>" + money(k.e) + "</b>, " + (low ? "below" : "above") + " the plain average of the four prizes (" +
        money(k.plain) + "): each prize counts in proportion to its tickets, not equally.";
    },
    examples: [
      {name: "equal tickets", values: {tickets0: 1, tickets2: 1, tickets5: 1, tickets10: 1}},
      {name: "only $10 tickets", values: {tickets0: 0, tickets2: 0, tickets5: 0, tickets10: 5}},
      {name: "big prize common", values: {tickets0: 1, tickets2: 1, tickets5: 2, tickets10: 6}},
      {name: "Minimum supported values", values: {tickets0: 0, tickets2: 0, tickets5: 0, tickets10: 0}},
      {name: "Maximum supported values", values: {tickets0: 10, tickets2: 10, tickets5: 10, tickets10: 10}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), base = 172, top = 56, bw = 34, cols = [c.c1, c.c2, c.c3, c.c6];
      var pMax = Math.max.apply(null, k.p) > 0.5 ? 1 : 0.5;   // bar scale: 0.5 or 1 at full height
      var X = function (x) { return 46 + x * 31; };
      api.label([8, 12], k.N ? "draw 1 of " + k.N + " tickets; X = its prize" : "the bag is empty", {color: c.muted, size: 12});
      api.line([X(0) - 24, base], [X(10) + 24, base], {color: c.axis, width: 1.4});
      for (var d = 0; d <= 10; d++) api.line([X(d), base], [X(d), base + 4], {color: c.axis, width: 1});
      var E = X(k.e);
      if (k.N) api.line([E, 44], [E, base], {color: c.ink, width: 1.8, dash: "5 4"});
      PRIZES.forEach(function (x, i) {
        var h = k.p[i] / pMax * (base - top), cx = X(x);
        if (h > 0) api.rect(cx - bw / 2, base - h, bw, h, {fill: cols[i], fillOpacity: 0.85, rx: 3});
        var lab = k.w[i] + "/" + (k.N || 0), inside = h >= 24;
        api.label([cx, inside ? base - h + 12 : base - h - 10], lab, {color: inside ? c.card : cols[i], size: 12.5, weight: 700, anchor: "middle"});
        api.label([cx, base + 18], "$" + x, {color: cols[i], size: 12.5, weight: 650, anchor: "middle"});
      });
      if (k.N) {   // the balance point
        api.polygon([[E, base - 6], [E + 6, base], [E, base + 6], [E - 6, base]], {fill: c.ink, fillOpacity: 1});
        api.label([E, 34], "E[X] = " + money(k.e), {color: c.ink, size: 13, weight: 700, anchor: "middle"});
      }
      // E[X] as a sum of pieces x·P(X = x), against the plain average (each prize weighted 1/4)
      var rows = [[k.parts, 224, "weighted by probability: Σ x·P(X = x)", k.e], [PRIZES.map(function (x) { return x / 4; }), 268, "plain average: each prize weighted 1/4", k.plain]];
      rows.forEach(function (r, j) {
        if (j === 0 && !k.N) return;
        api.label([X(0) - 4, r[1] - 12], r[2], {color: c.muted, size: 12});
        var at = X(0);
        r[0].forEach(function (q, i) {
          var wpx = q * 31;
          if (wpx > 0.5) api.rect(at, r[1], wpx, 15, {fill: cols[i], fillOpacity: j ? 0.6 : 0.9, rx: 0});
          if (wpx >= 30) api.label([at + wpx / 2, r[1] + 8], api.fmt(q, 2), {color: c.card, size: 12, weight: 700, anchor: "middle"});
          at += wpx;
        });
        api.line([X(0), r[1] - 3], [X(0), r[1] + 18], {color: c.axis, width: 1.2});
        var past = at > 340;   // no room past the end: write the total inside the bar's end instead
        api.label([past ? at - 6 : at + 6, r[1] + 8], money(r[3]), {color: past ? c.card : j ? c.muted : c.ink, size: 13, weight: 700, anchor: past ? "end" : "start"});
      });
      // viz.css sets every svg text's fill to ink, which beats the fill attribute api.label writes: restate it inline
      api.svg.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
