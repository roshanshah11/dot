// Autocorrelation: how much a series is correlated with itself shifted by k steps. Top: sixty observations.
// Bottom left: the correlogram, r_k for lags 1 to 12, with the approximate 95% band for pure noise, ±1.96/sqrt(n).
// Bottom right: the lag plot behind the chosen r_k, each point is (x_t, x_{t+k}). All four series share one seeded
// noise sequence (the seed picked so each pattern looks like its textbook case): persistent is AR(1) with
// phi = 0.8, alternating is AR(1) with phi = -0.75, seasonal is a period-6 cycle plus noise, uncorrelated is the
// noise itself. Every r_k is computed from the drawn series. Lag k is Dot's addition to the queue's pattern choice.
(function () {
  var N = 60, BURN = 40, LAGS = 12;
  var E = (function () {
    var s = 9, out = [];
    function rnd() { s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    while (out.length < N + BURN) { var u = rnd() || 1e-9, w = rnd(); out.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w)); }
    return out;
  })();
  var cache = {};
  function series(p) {
    if (cache[p]) return cache[p];
    var x = [], prev = 0;
    for (var t = 0; t < N + BURN; t++) {
      var val = p === "persistent" ? 0.8 * prev + E[t] : p === "alternating" ? -0.75 * prev + E[t] : p === "seasonal" ? 2 * Math.sin(2 * Math.PI * t / 6) + 0.8 * E[t] : E[t];
      prev = val; x.push(val);
    }
    x = x.slice(BURN);
    var m = x.reduce(function (a, b) { return a + b; }, 0) / N, den = 0, r = [];
    x.forEach(function (val) { den += (val - m) * (val - m); });
    for (var k = 1; k <= LAGS; k++) { var num = 0; for (var i = 0; i + k < N; i++) num += (x[i] - m) * (x[i + k] - m); r.push(num / den); }
    return (cache[p] = {x: x, m: m, r: r});
  }
  var BAND = 1.96 / Math.sqrt(N);
  // 3 decimals when r is within 0.01 of the band, so "inside" or "outside" never contradicts the printed numbers
  function dp(r) { return Math.abs(Math.abs(r) - BAND) < 0.01 ? 3 : 2; }
  function subk(k) { return String(k).split("").map(function (d) { return "₀₁₂₃₄₅₆₇₈₉"[+d]; }).join(""); }
  var WHAT = {
    persistent: "<b>Persistent</b>: a high value tends to follow a high one, so the correlogram starts high and fades slowly",
    alternating: "<b>Alternating</b>: each value tends to flip the last one's sign, so r swings between negative and positive",
    seasonal: "<b>Seasonal</b>: the pattern repeats every 6 steps, so r peaks at lags 6 and 12 and dips at 3 and 9",
    uncorrelated: "<b>Uncorrelated</b>: the past says nothing about the next value, so the bars stay near zero"
  };

  Viz.register("autocorrelation", {
    title: "Autocorrelation and the correlogram",
    subject: "stats",
    shows: "Pick a pattern and a lag: r_k correlates the series with itself k steps later, and the correlogram shows it for every lag",
    params: {
      example_pattern: {kind: "enum", values: ["persistent", "alternating", "seasonal", "uncorrelated"], default: "persistent", label: "\\text{pattern}"},
      lag: {kind: "integer", default: 1, min: 1, max: LAGS, label: "k\\ (\\text{lag})"}
    },
    formula: function (v) {
      var r = series(v.example_pattern).r[v.lag - 1], d = dp(r);
      return "\\begin{array}{l}r_k=\\dfrac{\\sum_{t=1}^{n-k}(x_t-\\bar x)(x_{t+k}-\\bar x)}{\\sum_{t=1}^{n}(x_t-\\bar x)^2}\\\\[10pt]r_{" + v.lag + "}=" + Viz.n(r, d) +
        ",\\quad \\pm\\tfrac{1.96}{\\sqrt{" + N + "}}=\\pm" + Viz.n(BAND, d) + "\\end{array}";
    },
    status: function (v) {
      var r = series(v.example_pattern).r[v.lag - 1], d = dp(r);
      return WHAT[v.example_pattern] + "; at lag " + v.lag + ", r" + subk(v.lag) + " = <b>" + Viz.fmt(r, d) + "</b>, " +
        (Math.abs(r) > BAND ? "outside" : "inside") + " the ±" + Viz.fmt(BAND, d) + " noise band.";
    },
    examples: [
      {name: "alternating", values: {example_pattern: "alternating", lag: 1}},
      {name: "seasonal at lag 6", values: {example_pattern: "seasonal", lag: 6}},
      {name: "uncorrelated", values: {example_pattern: "uncorrelated", lag: 1}},
      {name: "persistent, faded by lag 7", values: {example_pattern: "persistent", lag: 7}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = series(v.example_pattern), k = v.lag, x = s.x;
      var lo = Math.min.apply(null, x), hi = Math.max.apply(null, x), pad = (hi - lo) * 0.08;
      // the series
      var sx0 = 30, sx1 = 392, sy0 = 22, sy1 = 104;
      var SX = function (t) { return sx0 + (sx1 - sx0) * t / (N - 1); }, SY = function (val) { return sy1 - (sy1 - sy0) * (val - lo + pad) / (hi - lo + 2 * pad); };
      api.label([sx0, 10], "the series x_t, t = 1 to " + N, {color: c.muted, size: 12});
      api.line([sx0, SY(s.m)], [sx1, SY(s.m)], {color: c.faint, width: 1, dash: "4 4"});
      api.polyline(x.map(function (val, t) { return [SX(t), SY(val)]; }), {stroke: c.c2, width: 1.6});
      x.forEach(function (val, t) { api.circle([SX(t), SY(val)], 2, {fill: c.c2}); });
      // one example pair k apart
      var t0 = 24, ta = [SX(t0), SY(x[t0])], tb = [SX(t0 + k), SY(x[t0 + k])], yb = Math.max(ta[1], tb[1]) + 12;
      api.circle(ta, 4.5, {fill: c.c3}); api.circle(tb, 4.5, {fill: c.c3});
      api.path("M " + ta[0] + " " + (ta[1] + 6) + " L " + ta[0] + " " + yb + " L " + tb[0] + " " + yb + " L " + tb[0] + " " + (tb[1] + 6), {stroke: c.c3, width: 1.5});
      api.label([(ta[0] + tb[0]) / 2, Math.min(yb + 11, sy1 + 16)], "k = " + k, {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      // the correlogram: bars for lags 1..12, the noise band running on past them to carry its own label
      var cx0 = 40, bw = 15, cxb = cx0 + LAGS * bw, cx1 = cxb + 48, cy0 = 152, cy1 = 268, cz = (cy0 + cy1) / 2, ch = (cy1 - cy0) / 2;
      var CY = function (r) { return cz - r * ch; }, d = dp(s.r[k - 1]);
      api.label([10, cy0 - 14], "correlogram", {color: c.muted, size: 12});
      [0.5, -0.5].forEach(function (r) { api.line([cx0, CY(r)], [cxb, CY(r)], {color: c.grid, width: 1}); });
      api.rect(cx0, CY(BAND), cx1 - cx0, CY(-BAND) - CY(BAND), {fill: c.ink, fillOpacity: 0.06, rx: 0});
      [BAND, -BAND].forEach(function (b) { api.line([cx0, CY(b)], [cx1, CY(b)], {color: c.muted, width: 1, dash: "3 3"}); });
      [0.5, 0, -0.5].forEach(function (r) { api.label([cx0 - 6, CY(r)], api.fmt(r), {color: c.muted, size: 12, anchor: "end"}); });
      api.line([cx0, cz], [cxb, cz], {color: c.axis, width: 1.2});
      s.r.forEach(function (r, i) {
        var bx = cx0 + i * bw + bw * 0.18, on = i + 1 === k;
        api.rect(bx, Math.min(cz, CY(r)), bw * 0.64, Math.abs(CY(r) - cz), {fill: on ? c.c3 : c.ink, fillOpacity: on ? 0.95 : 0.4, rx: 1.5});
        if ((i + 1) % 3 === 0 || i === 0) api.label([bx + bw * 0.32, cy1 + 14], String(i + 1), {color: on ? c.c3 : c.muted, size: 12, anchor: "middle"});
      });
      api.label([cx0 - 6, cy1 + 14], "lag k", {color: c.muted, size: 12, anchor: "end"});
      api.label([(cxb + cx1) / 2 + 2, cz - 7], "band", {color: c.muted, size: 12, anchor: "middle"});
      api.label([(cxb + cx1) / 2 + 2, cz + 7], "±" + api.fmt(BAND, d), {color: c.muted, size: 12, anchor: "middle"});
      // the lag plot behind the chosen bar
      var lx0 = 286, lx1 = 392, ly0 = 152, ly1 = 258, L = function (val) { return (val - lo + pad) / (hi - lo + 2 * pad); };
      api.rect(lx0, ly0, lx1 - lx0, ly1 - ly0, {stroke: c.axis, width: 1, rx: 2});
      for (var i = 0; i + k < N; i++) api.circle([lx0 + (lx1 - lx0) * L(x[i]), ly1 - (ly1 - ly0) * L(x[i + k])], 2.4, {fill: c.c3, fillOpacity: 0.8});
      // the line through the mean point with slope r_k (both axes on the same scale), clipped to the box
      var r = s.r[k - 1], mx = L(s.m), xa = 0, xb = 1, Ly = function (q) { return mx + r * (q - mx); };
      if (Math.abs(r) > 1e-9) { var e0 = mx - mx / r, e1 = mx + (1 - mx) / r; xa = Math.max(0, Math.min(e0, e1)); xb = Math.min(1, Math.max(e0, e1)); }
      var LP = function (q) { return [lx0 + (lx1 - lx0) * q, ly1 - (ly1 - ly0) * Ly(q)]; };
      api.line(LP(xa), LP(xb), {color: c.c3, width: 1.5, opacity: 0.8});
      api.label([(lx0 + lx1) / 2, ly0 - 14], "r" + subk(k) + " = " + api.fmt(r, d), {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      api.label([(lx0 + lx1) / 2, ly1 + 12], "x_t", {color: c.muted, size: 12, anchor: "middle"});
      var yl = [lx0 - 9, (ly0 + ly1) / 2];   // the vertical axis title runs up the box's left edge
      api.label(yl, "xₜ₊ₖ", {color: c.muted, size: 12, anchor: "middle", clamp: false}).setAttribute("transform", "rotate(-90 " + yl[0] + " " + yl[1] + ")");
    }
  });
})();
