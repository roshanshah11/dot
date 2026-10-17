// Density-dependent inhibition in a culture dish. Normal cells divide freely while they have room, slow sharply as
// they close up into one layer (confluence), then stop: crowded neighbours and the growth factors they share shut the
// cell cycle off. Contact inhibition bites only near confluence, so growth is modelled as a theta-logistic,
// dN/dt = r N (1 - (N/K)^theta) with theta = 4 (sparse cells divide at nearly the open-dish rate; theta = 1 would be
// the plain logistic, which slows cells that are not yet touching). Closed form:
// N(t) = K / (1 + ((K/N0)^theta - 1) e^(-theta r t))^(1/theta). Transformed (cancer) cells ignore the signal and follow
// the same curve past confluence, piling up until a nutrient ceiling of four layers (K = 400, an illustrative limit),
// so the two curves match until the dish is nearly full. r = ln 2 / doubling time. Top view, side view of one row
// (the row whose count is closest to the field's average), growth curve.
// Colors: teal = normal cells, red = cancer cells, amber = one full layer (confluence).
(function () {
  var order = (function () {   // a fixed shuffle of the 100 spots, so cells land in the same places every time
    var a = [], s = 7;
    for (var i = 0; i < 100; i++) a.push(i);
    for (var j = 99; j > 0; j--) { s = (s * 16807) % 2147483647; var k = s % (j + 1), t = a[j]; a[j] = a[k]; a[k] = t; }
    var rank = []; a.forEach(function (spot, r) { rank[spot] = r; });
    return rank;
  })();
  function K(v) { return v.cells === "cancer" ? 400 : 100; }
  function rate(v) { return Math.LN2 * 24 / v.Td; }   // per day
  var TH = 4;   // theta: how late in filling the dish crowding starts to slow division
  function N(v, t) { var k = K(v); return k / Math.pow(1 + (Math.pow(k / v.N0, TH) - 1) * Math.exp(-TH * rate(v) * t), 1 / TH); }

  Viz.register("density-dependent-contact-inhibition", {
    title: "Density-dependent inhibition of cell division",
    subject: "biology",
    shows: "Run the days forward: normal cells fill the dish in one layer and stop dividing; cancer cells ignore the crowding and pile up",
    params: {
      t: {kind: "number", default: 4, min: 0, max: 10, step: 0.5, label: "t\\ (\\text{d})"},
      N0: {kind: "integer", default: 5, min: 1, max: 50, label: "N_0"},
      Td: {kind: "integer", default: 24, min: 12, max: 48, label: "T_d\\ (\\text{h})"},
      cells: {kind: "enum", values: ["normal", "cancer"], default: "normal", label: "\\text{cells}"}
    },
    formula: function (v) {
      var k = K(v);
      return "N(t)=\\frac{" + k + "}{\\left[1+(" + Viz.n(k / v.N0, 1) + "^{4}-1)\\,e^{-4\\cdot " + Viz.n(rate(v), 2) + "\\cdot " + Viz.n(v.t, 1) + "}\\right]^{1/4}}=" + Viz.n(N(v, v.t), 1);
    },
    status: function (v) {
      var n = N(v, v.t), cov = Math.min(100, Math.round(n)), left = 1 - Math.pow(n / K(v), TH), day = "Day " + Viz.fmt(v.t, 1) + ": <b>" + cov + " of 100</b> spots covered; ";
      if (v.cells === "normal") {
        if (cov >= 98) return "<b>Confluent</b>: " + cov + " of 100 spots, one full layer, and touching neighbours have shut division almost off, so the cells stay one layer deep.";
        if (left >= 0.95) return day + "the cells barely touch, so each still divides at the <b>full</b> open-dish rate, once every " + v.Td + " h.";
        return day + "crowding has cut each cell's division rate to <b>" + Math.round(left * 100) + "%</b> of the open-dish rate.";
      }
      var nn = N(Object.assign({}, v, {cells: "normal"}), v.t);
      if (n <= 100) return (n - nn) / n < 0.1
        ? day + "normal cells would have <b>" + Math.round(nn) + "</b> by now, since crowding barely slows either kind until the dish is nearly full."
        : day + "cancer cells are already ahead of normal ones (<b>" + Math.round(nn) + "</b>) because crowding barely slows them.";
      if (n >= 398) return "Day " + Viz.fmt(v.t, 1) + ": cancer cells ignored contact inhibition and piled up <b>4 layers</b> deep; only the nutrient ceiling stops them.";
      return "Day " + Viz.fmt(v.t, 1) + ": the dish is full but cancer cells keep dividing, <b>" + Viz.fmt(n / 100, 1) + " layers</b> deep: they ignore contact inhibition.";
    },
    examples: [
      {name: "seeding day", values: {t: 0}},
      {name: "normal cells at confluence", values: {t: 10, cells: "normal"}},
      {name: "cancer cells piling up", values: {t: 10, cells: "cancer"}},
      {name: "one cell, slow doubling", values: {N0: 1, Td: 48, t: 10}},
      {name: "dense seeding, fast doubling", values: {N0: 50, Td: 12, t: 2, cells: "cancer"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, cancer = v.cells === "cancer", col = cancer ? c.c5 : c.c1;
      var n = Math.round(N(v, v.t)), base = Math.floor(n / 100), extra = n % 100;
      var layers = function (spot) { return base + (order[spot] < extra ? 1 : 0); };
      // ---- top view: a 10 x 10 field of spots ----
      var gx = 18, gy = 34, sp = 13, row = 4, best = Infinity;
      var rowSum = function (r) { var t = 0; for (var q = 0; q < 10; q++) t += layers(r * 10 + q); return t; };
      [4, 5, 3, 6, 2, 7, 1, 8, 0, 9].forEach(function (r) { var e = Math.abs(rowSum(r) - n / 10); if (e < best - 1e-9) { best = e; row = r; } });
      api.label([gx, 16], "top view", {color: c.muted, size: 12});
      api.rect(gx - 4, gy - 4, sp * 10 + 7, sp * 10 + 7, {stroke: c.faint, width: 1, rx: 6});
      for (var s = 0; s < 100; s++) {
        var L = layers(s), x = gx + (s % 10) * sp, y = gy + Math.floor(s / 10) * sp;
        if (L) {
          api.rect(x, y, sp - 2, sp - 2, {fill: col, fillOpacity: Math.min(1, 0.32 + 0.22 * L), rx: 3});
          api.circle([x + (sp - 2) / 2, y + (sp - 2) / 2], 1.8, {fill: c.card, opacity: 0.8});
        } else api.rect(x, y, sp - 2, sp - 2, {stroke: c.faint, width: 0.8, rx: 3, opacity: 0.6});
      }
      api.rect(gx - 3, gy + row * sp - 2, sp * 10 + 3, sp + 2, {stroke: c.ink, width: 1.2, dash: "3 3", rx: 3});
      if (cancer && n > 100) api.label([gx - 4, gy + sp * 10 + 16], "brighter = stacked deeper", {color: c.muted, size: 12});
      // ---- growth curve ----
      var pl = api.plane({x: [0, 10], y: [0, 400], box: [196, 34, 146, 128], equal: false, grid: false, ticks: false, labels: false});
      for (var d = 0; d <= 10; d += 2) api.label([pl.x(d), pl.y(0) + 13], String(d), {color: c.muted, size: 12, anchor: "middle"});
      api.label([pl.x(10), pl.y(0) + 28], "days", {color: c.muted, size: 12, anchor: "end"});
      [100, 200, 300, 400].forEach(function (q) { api.label([pl.x(0) - 5, pl.y(q)], String(q), {color: c.muted, size: 12, anchor: "end"}); });
      api.line(pl.px([0, 100]), pl.px([10, 100]), {color: c.c3, width: 1.4, dash: "5 4"});
      api.label([pl.x(10) - 2, pl.y(100) - 9], "one full layer", {color: c.c3, size: 12, anchor: "end"});
      var ends = {};
      ["normal", "cancer"].forEach(function (kind) {
        var w = Object.assign({}, v, {cells: kind}), pts = [], on = kind === v.cells, kc = kind === "cancer" ? c.c5 : c.c1;
        for (var q = 0; q <= 100; q++) pts.push(pl.px([q / 10, N(w, q / 10)]));
        api.polyline(pts, {stroke: kc, width: on ? 2.6 : 1.4, dash: on ? null : "3 4", opacity: on ? 1 : 0.55});
        if (!on) api.circle(pl.px([v.t, N(w, v.t)]), 3.2, {fill: c.card, stroke: kc, width: 1.4, opacity: 0.8});
        ends[kind] = pl.y(N(w, 10));
      });
      if (ends.normal - ends.cancer < 13) { var mid = (ends.normal + ends.cancer) / 2; ends.cancer = mid - 6.5; ends.normal = mid + 6.5; }
      var lift = Math.max(0, ends.normal - (pl.y(0) - 9)); ends.normal -= lift; ends.cancer = Math.min(ends.cancer, ends.normal - 13);
      ["normal", "cancer"].forEach(function (kind) {
        api.label([pl.x(10) + 9, ends[kind]], kind, {color: kind === "cancer" ? c.c5 : c.c1, size: 12, weight: kind === v.cells ? 700 : 500});
      });
      var now = pl.px([v.t, N(v, v.t)]);
      api.line([now[0], pl.y(0)], now, {color: col, width: 1, dash: "2 3", opacity: 0.7});
      api.point(now, {color: col, r: 5});
      api.label([pl.x(0) - 22, 13], "cells in the field", {color: c.muted, size: 12});
      // ---- side view of the dashed row ----
      var sx = 34, cw = 33.5, floor = 288;
      api.label([sx - 14, 204], "side view of the dashed row", {color: c.muted, size: 12});
      api.line([sx - 14, floor + 3], [sx + cw * 10 + 10, floor + 3], {color: c.axis, width: 2});
      api.line([sx - 14, floor + 3], [sx - 14, 228], {color: c.axis, width: 2});
      api.line([sx + cw * 10 + 10, floor + 3], [sx + cw * 10 + 10, 228], {color: c.axis, width: 2});
      for (var k = 0; k < 10; k++) {
        var Lk = layers(row * 10 + k);
        for (var m = 0; m < Lk; m++) {
          var cx = sx + k * cw;
          api.rect(cx, floor - 14 - m * 15, cw - 3, 13, {fill: col, fillOpacity: 0.75, rx: 6});
          api.circle([cx + (cw - 3) / 2, floor - 7.5 - m * 15], 2.6, {fill: c.card, opacity: 0.8});
        }
      }
      api.label([sx + cw * 10 + 10, 204], cancer ? "cancer cells" : "normal cells", {color: col, size: 12.5, weight: 650, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
