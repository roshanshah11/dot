// Correlation is not causation: a confounder. Smoking (Z) raises both coffee drinking (X) and heart risk (Y), so coffee
// and risk correlate across everyone even when coffee does nothing. Splitting by smoking (holding Z fixed) removes the
// confounder's share: what is left within each group is coffee's own effect. Model, in standard units:
// X = k Z + e1, Y = k Z + c X + e2, Z = 0 for 20 non-smokers and 1 for 20 smokers; e1, e2 are a fixed seeded sample,
// centered, scaled and decorrelated within each group, so the within-group r is exactly c / sqrt(1 + c^2) and the
// overall r is whatever the data give (both are computed from the plotted points). Displayed as cups of coffee a day
// (2 + 0.6 X) and a heart-risk score (50 + 10 Y). Queue entry has no schema: k, c and the split are Dot's own.
(function () {
  var G = 20, RAW = (function () {
    var s = 17, out = [];
    function rnd() { s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    while (out.length < 4 * G) { var u = rnd() || 1e-9, w = rnd(); out.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w)); }
    return out;
  })();
  function std(a) { var m = 0, ss = 0, i; for (i = 0; i < a.length; i++) m += a[i] / a.length; for (i = 0; i < a.length; i++) ss += (a[i] - m) * (a[i] - m) / a.length; return a.map(function (x) { return (x - m) / Math.sqrt(ss); }); }
  var E = [0, 1].map(function (g) {
    var e1 = std(RAW.slice(g * 2 * G, g * 2 * G + G)), e2 = std(RAW.slice(g * 2 * G + G, g * 2 * G + 2 * G)), d = 0, i;
    for (i = 0; i < G; i++) d += e1[i] * e2[i] / G;
    return {e1: e1, e2: std(e2.map(function (x, j) { return x - d * e1[j]; }))};
  });
  function corr(pts) { // pts: [[x, y]], returns r and the LS line
    var n = pts.length, mx = 0, my = 0, sxx = 0, syy = 0, sxy = 0;
    pts.forEach(function (p) { mx += p[0] / n; my += p[1] / n; });
    pts.forEach(function (p) { sxx += (p[0] - mx) * (p[0] - mx); syy += (p[1] - my) * (p[1] - my); sxy += (p[0] - mx) * (p[1] - my); });
    return {r: sxy / Math.sqrt(sxx * syy), mx: mx, my: my, m: sxy / sxx, sxx: sxx, syy: syy, sxy: sxy};
  }
  function calc(v) {
    var groups = [0, 1].map(function (z) {
      return E[z].e1.map(function (e1, i) { var X = v.k * z + e1, Y = v.k * z + v.c * X + E[z].e2[i]; return [2 + 0.6 * X, 50 + 10 * Y]; });
    });
    var all = corr(groups[0].concat(groups[1])), g0 = corr(groups[0]), g1 = corr(groups[1]);
    var within = (g0.sxy + g1.sxy) / Math.sqrt((g0.sxx + g1.sxx) * (g0.syy + g1.syy));
    return {groups: groups, all: all, g: [g0, g1], within: within};
  }
  var f2 = function (x) { return Viz.fmt(Math.abs(x) < 0.005 ? 0 : x, 2); };

  Viz.register("correlation-causation-confounding", {
    title: "Correlation vs causation: a confounder",
    subject: "stats",
    shows: "Smoking raises both coffee drinking and heart risk, so coffee and risk correlate even when coffee does nothing; split by smoking and the fake part vanishes",
    params: {
      k: {kind: "number", default: 2.5, min: 0, max: 3, step: 0.1, label: "\\text{confound}"},
      c: {kind: "number", default: 0, min: -1, max: 1, step: 0.05, label: "\\text{effect}"},
      split: {kind: "boolean", default: true, label: "\\text{split}", on: "by smoking", off: "everyone"}
    },
    formula: function (v) {
      var q = calc(v);
      return "\\begin{array}{l}r_{\\text{coffee, risk}}=" + Viz.n(q.all.r, 2) + "\\\\r_{\\text{coffee, risk}\\,\\mid\\,\\text{smoking}}=" + Viz.n(Math.abs(q.within) < 0.005 ? 0 : q.within, 2) + "\\end{array}";
    },
    status: function (v) {
      var q = calc(v), all = f2(q.all.r), w = f2(q.within);
      if (!v.split) return "Across everyone, coffee and heart risk correlate at r = <b>" + all + "</b>; split by smoking to see how much of that coffee actually causes.";
      if (v.k === 0) return "Smoking has no pull here, so nothing is confounded: the overall r = <b>" + all + "</b> matches the within-group r, and it is all coffee's doing.";
      if (Math.abs(v.c) < 1e-9) return "Coffee does nothing, yet r = <b>" + all + "</b> overall, only because smokers drink more coffee and have higher risk; within each group r = <b>" + w + "</b>.";
      if (q.all.r * q.within < 0 && Math.abs(q.all.r) >= 0.005) return "Simpson's paradox: overall r = <b>" + all + "</b>, but within each smoking group r = <b>" + w + "</b>, the opposite sign: smoking hides coffee's real effect.";
      return "Overall r = <b>" + all + "</b> mixes two things: coffee's real effect (r = <b>" + w + "</b> within each group) and the smoking that drives both.";
    },
    examples: [
      {name: "everyone pooled: looks causal", values: {split: false}},
      {name: "no confounding", values: {k: 0}},
      {name: "real effect, no confounding", values: {k: 0, c: 0.6}},
      {name: "Simpson's paradox", values: {k: 3, c: -0.3}},
      {name: "every input at its minimum", values: {k: 0, c: -1, split: false}},
      {name: "every input at its maximum", values: {k: 3, c: 1, split: true}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, q = calc(v);
      // the causal diagram: smoking -> coffee, smoking -> risk, and coffee's own arrow (dashed when it is zero)
      var S = [200, 18], C = [62, 64], R = [338, 64];
      function node(at, text, col) {
        var w = text.length * 7.4 + 18;
        api.rect(at[0] - w / 2, at[1] - 12, w, 24, {fill: c.card, stroke: col, width: 1.5, rx: 12});
        api.label(at, text, {color: col, size: 12.5, weight: 650, anchor: "middle"});
      }
      var kw = 1 + v.k * 1.2;
      if (v.k > 0) {
        api.arrow([170, 30], [96, 52], {color: c.c5, width: kw, halo: false});
        api.arrow([230, 30], [298, 52], {color: c.c5, width: kw, halo: false});
      } else {
        api.line([170, 30], [96, 52], {color: c.faint, width: 1.2, dash: "3 4"});
        api.line([230, 30], [298, 52], {color: c.faint, width: 1.2, dash: "3 4"});
      }
      if (Math.abs(v.c) > 1e-9) {
        api.arrow([108, 64], [284, 64], {color: c.c3, width: 1 + Math.abs(v.c) * 3, halo: false});
        api.label([196, 78], "real effect " + (v.c > 0 ? "+" : "−") + api.fmt(Math.abs(v.c)), {color: c.c3, size: 12, anchor: "middle", weight: 600});
      } else {
        api.line([108, 64], [282, 64], {color: c.faint, width: 1.5, dash: "4 5"});
        api.label([196, 78], "no effect of coffee", {color: c.muted, size: 12, anchor: "middle"});
      }
      node(S, "smoking", c.c5); node(C, "coffee", c.ink); node(R, "heart risk", c.ink);
      // the data: non-smokers blue, smokers red; dashed = one line fitted to everyone, solid = a line per group
      var all = q.groups[0].concat(q.groups[1]), ys = all.map(function (p) { return p[1]; });
      var lo = Math.floor((Math.min.apply(null, ys) - 4) / 20) * 20, hi = Math.ceil((Math.max.apply(null, ys) + 4) / 20) * 20;
      var pl = api.plane({x: [0, 6], y: [lo, hi], box: [42, 110, 252, 158], equal: false, grid: false, axes: false});
      api.line([pl.x(0), pl.y(lo)], [pl.x(6) + 4, pl.y(lo)], {color: c.axis, width: 1.2});
      api.line([pl.x(0), pl.y(lo)], [pl.x(0), pl.y(hi)], {color: c.axis, width: 1.2});
      for (var t = 1; t <= 6; t++) api.label([pl.x(t), pl.y(lo) + 12], String(t), {color: c.muted, size: 12, anchor: "middle"});
      var step = hi - lo > 120 ? 40 : 20;
      for (var ty = lo; ty <= hi; ty += step) api.label([pl.x(0) - 5, pl.y(ty)], String(ty), {color: c.muted, size: 12, anchor: "end"});
      api.label([pl.x(6), pl.y(lo) - 10], "coffee (cups/day)", {color: c.muted, size: 12, anchor: "end"});
      api.label([pl.x(0) + 6, pl.y(hi) + 4], "heart risk", {color: c.muted, size: 12});
      api.circle([48, 98], 4, {fill: c.c2}); api.label([56, 98], "non-smokers", {color: c.c2, size: 12, weight: 650});
      api.circle([146, 98], 4, {fill: c.c5}); api.label([154, 98], "smokers", {color: c.c5, size: 12, weight: 650});
      var cols = [c.c2, c.c5];
      function fitLine(fit, xs, col, opt) {
        var a = Math.min.apply(null, xs), b = Math.max.apply(null, xs);
        api.line(pl.px([a, fit.my + fit.m * (a - fit.mx)]), pl.px([b, fit.my + fit.m * (b - fit.mx)]), Object.assign({color: col}, opt));
      }
      [0, 1].forEach(function (g) { q.groups[g].forEach(function (p) { api.circle(pl.px(p), 3.6, {fill: cols[g], fillOpacity: 0.8}); }); });
      if (v.split) [0, 1].forEach(function (g) { fitLine(q.g[g], q.groups[g].map(function (p) { return p[0]; }), cols[g], {width: 2.6}); });
      fitLine(q.all, all.map(function (p) { return p[0]; }), c.ink, {width: 2.2, dash: "7 5"});
      // the two correlations as bars on one -1..1 scale
      var gt = 118, gb = 258, G = function (r) { return gb - (gb - gt) * (r + 1) / 2; }, bars = [[344, q.all.r, c.ink, "all"]];
      if (v.split) bars.push([382, q.within, c.c3, "within"]);
      api.line([326, G(0)], [398, G(0)], {color: c.axis, width: 1.2});
      api.label([320, G(1)], "1", {color: c.muted, size: 12, anchor: "end"});
      api.label([320, G(0)], "0", {color: c.muted, size: 12, anchor: "end"});
      api.label([320, G(-1)], "−1", {color: c.muted, size: 12, anchor: "end"});
      api.line([326, G(1)], [398, G(1)], {color: c.grid, width: 1});
      api.line([326, G(-1)], [398, G(-1)], {color: c.grid, width: 1});
      api.label([363, 98], "r", {color: c.muted, size: 12.5, anchor: "middle", italic: true});
      bars.forEach(function (b) {
        var r = Math.abs(b[1]) < 0.005 ? 0 : b[1], y0 = G(0), y1 = G(r);
        api.rect(b[0] - 11, Math.min(y0, y1), 22, Math.max(1.5, Math.abs(y1 - y0)), {fill: b[2], fillOpacity: b[2] === c.ink ? 0.55 : 0.8, rx: 2});
        api.label([b[0], r >= 0 ? y1 - 10 : y1 + 10], f2(r), {color: b[2], size: 12, weight: 650, anchor: "middle"});
        api.label([b[0], gb + 22], b[3], {color: b[2], size: 12, anchor: "middle", weight: 600});
      });
      if (!v.split) api.label([382, G(0) - 10], "split?", {color: c.muted, size: 12, anchor: "middle"});
    }
  });
})();
