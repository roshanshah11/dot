// Correlation coefficient r from a scatter of 40 points. The pattern sets the trend (y rises, falls or ignores x);
// the noise sets how far points stray from it. With "signs" on, the dashed lines at x-bar and y-bar cut the plane into
// quadrants and each point is colored by the sign of its product (x - x-bar)(y - y-bar): r is the sum of those
// products, scaled, so a cloud living in the + quadrants has r > 0.
// Data: a fixed seeded sample (mulberry32 + Box-Muller), standardized and decorrelated so that the sample r is exactly
// 1.8 b / sqrt(1.8^2 + noise^2); r is still computed from the plotted points. Queue param: pattern (kept);
// noise and signs are Dot's own additions. The y axis zooms in coarse steps so the cloud keeps its true spread.
(function () {
  var N = 40, Z = (function () {
    var s = 19, out = [];
    function rnd() { s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    while (out.length < 2 * N) { var u = rnd() || 1e-9, w = rnd(); out.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w)); }
    return out;
  })();
  function std(a) { var m = 0, ss = 0, i; for (i = 0; i < a.length; i++) m += a[i] / a.length; for (i = 0; i < a.length; i++) ss += (a[i] - m) * (a[i] - m) / a.length; return a.map(function (x) { return (x - m) / Math.sqrt(ss); }); }
  var Z1 = std(Z.slice(0, N)), Z2 = std(Z.slice(N)), dot = 0;
  for (var i = 0; i < N; i++) dot += Z1[i] * Z2[i] / N;
  Z2 = std(Z2.map(function (z, j) { return z - dot * Z1[j]; }));
  var SLOPE = {negative: -1, none: 0, positive: 1};
  function calc(v) {
    var b = SLOPE[v.pattern], xs = [], ys = [], mx = 0, my = 0, sxx = 0, syy = 0, sxy = 0, k;
    for (k = 0; k < N; k++) { xs.push(5 + 1.8 * Z1[k]); ys.push(5 + b * 1.8 * Z1[k] + v.noise * Z2[k]); mx += xs[k] / N; my += ys[k] / N; }
    var pos = 0;
    for (k = 0; k < N; k++) { var dx = xs[k] - mx, dy = ys[k] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; if (dx * dy > 0) pos++; }
    return {b: b, xs: xs, ys: ys, mx: mx, my: my, sxx: sxx, syy: syy, sxy: sxy, r: sxy / Math.sqrt(sxx * syy), pos: pos};
  }
  function strength(r) { var a = Math.abs(r); return a >= 0.7 ? "strong" : a >= 0.4 ? "moderate" : a >= 0.1 ? "weak" : "no"; }

  Viz.register("correlation", {
    title: "Correlation: positive, negative or none",
    subject: "stats",
    shows: "Pick a pattern and add noise: r is the sum of the products (x − x̄)(y − ȳ), scaled to lie between −1 and 1, so its sign says which quadrants the cloud lives in",
    params: {
      pattern: {kind: "enum", values: ["negative", "none", "positive"], default: "positive", label: "\\text{pattern}"},
      noise: {kind: "number", default: 1.2, min: 0.2, max: 5, step: 0.1, label: "\\text{noise}"},
      signs: {kind: "boolean", default: true, label: "\\text{signs}", on: "colored", off: "plain"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}r=\\dfrac{\\sum(x_i-\\bar x)(y_i-\\bar y)}{\\sqrt{\\sum(x_i-\\bar x)^2\\sum(y_i-\\bar y)^2}}\\\\[4pt]" +
        "\\phantom{r}=\\dfrac{" + Viz.n(k.sxy, 1) + "}{\\sqrt{" + Viz.n(k.sxx, 1) + "\\cdot" + Viz.n(k.syy, 1) + "}}=" + Viz.n(k.r, 2) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), r = Viz.fmt(k.r, 2);
      if (k.b === 0) return "No pattern: y ignores x, so the fitted line is flat" + (v.signs ? ", the + and − products cancel," : "") +
        " and r = <b>" + r + "</b> however wide the noise spreads the cloud.";
      var dir = k.b > 0 ? "rise" : "fall", quad = k.b > 0 ? k.pos : N - k.pos;
      return "A <b>" + strength(k.r) + " " + v.pattern + "</b> correlation: as x grows y tends to " + dir + ", " +
        (v.signs ? quad + " of 40 points sit in the " + (k.b > 0 ? "+" : "−") + " quadrants," : "the noisier the cloud the closer r gets to 0,") + " and r = <b>" + r + "</b>.";
    },
    examples: [
      {name: "pattern: negative", values: {pattern: "negative"}},
      {name: "pattern: none", values: {pattern: "none"}},
      {name: "tight positive, noise at its minimum", values: {pattern: "positive", noise: 0.2}},
      {name: "weak negative, noise at its maximum", values: {pattern: "negative", noise: 5, signs: false}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v), ext = 1.8 * 2.2 * Math.abs(k.b) + v.noise * 2.2;
      var h = [6, 9, 12, 15].filter(function (q) { return ext <= 0.95 * q; })[0] || 15;
      var tick = h <= 6 ? 2 : h <= 9 ? 3 : 5;
      var pl = api.plane({x: [0, 10], y: [5 - h, 5 + h], box: [26, 10, 272, 268], equal: false, grid: false, axes: false});
      // frame and ticks (the data sit around 5, so the axes are drawn as a box rather than through 0)
      api.rect(pl.x(0), pl.y(5 + h), pl.x(10) - pl.x(0), pl.y(5 - h) - pl.y(5 + h), {stroke: c.axis, width: 1, rx: 0});
      for (var t = 2; t <= 8; t += 2) api.label([pl.x(t), pl.y(5 - h) + 12], String(t), {color: c.muted, size: 12, anchor: "middle"});
      for (var ty = Math.ceil((5 - h + 0.5) / tick) * tick; ty <= 5 + h - 0.5; ty += tick) api.label([pl.x(0) - 5, pl.y(ty)], api.fmt(ty), {color: c.muted, size: 12, anchor: "end"});
      api.label([pl.x(10) - 4, pl.y(5 - h) - 10], "x", {color: c.muted, size: 12.5, anchor: "end"});
      api.label([pl.x(0) + 6, pl.y(5 + h) + 11], "y", {color: c.muted, size: 12.5});
      if (v.signs) {
        api.line([pl.x(k.mx), pl.y(5 + h)], [pl.x(k.mx), pl.y(5 - h)], {color: c.muted, width: 1.2, dash: "4 4"});
        api.line([pl.x(0), pl.y(k.my)], [pl.x(10), pl.y(k.my)], {color: c.muted, width: 1.2, dash: "4 4"});
        api.label([pl.x(k.mx) + 4, pl.y(5 - h) - 10], "x̄", {color: c.muted, size: 12.5});
        api.label([pl.x(10) - 4, pl.y(k.my) - 10], "ȳ", {color: c.muted, size: 12.5, anchor: "end"});
        var q = [[8.8, 5 + h * 0.84, "+", c.c2], [1.2, 5 - h * 0.84, "+", c.c2], [1.2, 5 + h * 0.84, "−", c.c5], [8.8, 5 - h * 0.84, "−", c.c5]];
        q.forEach(function (e) { api.label(pl.px([e[0], e[1]]), e[2], {color: e[3], size: 20, weight: 700, anchor: "middle"}); });
      }
      // least squares line through (x-bar, y-bar), slope sxy / sxx
      var m = k.sxy / k.sxx;
      api.line(pl.px([0.3, k.my + m * (0.3 - k.mx)]), pl.px([9.7, k.my + m * (9.7 - k.mx)]), {color: c.c3, width: 2.2, dash: "7 5", opacity: 0.9});
      for (var j = 0; j < N; j++) {
        var pr = (k.xs[j] - k.mx) * (k.ys[j] - k.my);
        api.circle(pl.px([k.xs[j], k.ys[j]]), 4, {fill: v.signs ? (pr > 0 ? c.c2 : c.c5) : c.ink, fillOpacity: 0.85});
      }
      // the r gauge: -1 to 1
      var gx = 360, gt = 34, gb = 262, G = function (r) { return gb - (gb - gt) * (r + 1) / 2; };
      api.label([gx, gt - 20], "r", {color: c.c3, size: 13, weight: 650, anchor: "middle"});
      api.line([gx, gb], [gx, gt], {color: c.axis, width: 2});
      [-1, -0.5, 0, 0.5, 1].forEach(function (r) {
        api.line([gx - 4, G(r)], [gx + 4, G(r)], {color: c.axis, width: 1.2});
        api.label([gx + 9, G(r)], api.fmt(r), {color: c.muted, size: 12});
      });
      api.rect(gx - 3, Math.min(G(0), G(k.r)), 6, Math.abs(G(k.r) - G(0)), {fill: c.c3, fillOpacity: 0.55, rx: 2});
      api.point([gx, G(k.r)], {color: c.c3, r: 5.5});
      api.label([gx - 9, G(k.r)], api.fmt(k.r, 2), {color: c.c3, size: 13, weight: 650, anchor: "end"});
    }
  });
})();
