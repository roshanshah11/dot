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
      var s = series(v.example_pattern);
      return "\\begin{array}{l}r_k=\\dfrac{\\sum_{t=1}^{n-k}(x_t-\\bar x)(x_{t+k}-\\bar x)}{\\sum_{t=1}^{n}(x_t-\\bar x)^2}\\\\r_{" + v.lag + "}=" + Viz.n(s.r[v.lag - 1]) +
        ",\\quad \\pm\\tfrac{1.96}{\\sqrt{" + N + "}}=\\pm" + Viz.n(BAND) + "\\end{array}";
    },
    status: function (v) {
      var r = series(v.example_pattern).r[v.lag - 1];
      return WHAT[v.example_pattern] + "; at lag " + v.lag + ", r" + subk(v.lag) + " = <b>" + Viz.fmt(r) + "</b>, " +
        (Math.abs(r) > BAND ? "outside" : "inside") + " the ±" + Viz.fmt(BAND) + " noise band.";
    },
    examples: [
      {name: "alternating", values: {example_pattern: "alternating", lag: 1}},
      {name: "seasonal at lag 6", values: {example_pattern: "seasonal", lag: 6}},
      {name: "uncorrelated", values: {example_pattern: "uncorrelated", lag: 1}},
      {name: "persistent at lag 12", values: {example_pattern: "persistent", lag: 12}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = series(v.example_pattern), k = v.lag, x = s.x;
      var lo = Math.min.apply(null, x), hi = Math.max.apply(null, x), pad = (hi - lo) * 0.08;
      // the series
      var sx0 = 30, sx1 = 392, sy0 = 22, sy1 = 112;
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
      // the correlogram
      var cx0 = 40, cx1 = 236, cy0 = 150, cy1 = 284, cz = (cy0 + cy1) / 2, ch = (cy1 - cy0) / 2;
      var bw = (cx1 - cx0) / LAGS, CY = function (r) { return cz - r * ch; };
      api.label([cx0 - 30, cy0 - 14], "correlogram", {color: c.muted, size: 12});
      api.rect(cx0, CY(BAND), cx1 - cx0, CY(-BAND) - CY(BAND), {fill: c.ink, fillOpacity: 0.06, rx: 0});
      [BAND, -BAND].forEach(function (b) { api.line([cx0, CY(b)], [cx1, CY(b)], {color: c.muted, width: 1, dash: "3 3"}); });
      [1, 0, -1].forEach(function (r) { api.label([cx0 - 6, CY(r)], api.fmt(r), {color: c.muted, size: 12, anchor: "end"}); });
      api.line([cx0, cz], [cx1, cz], {color: c.axis, width: 1.2});
      s.r.forEach(function (r, i) {
        var bx = cx0 + i * bw + bw * 0.18, on = i + 1 === k;
        api.rect(bx, Math.min(cz, CY(r)), bw * 0.64, Math.abs(CY(r) - cz), {fill: on ? c.c3 : c.ink, fillOpacity: on ? 0.95 : 0.4, rx: 1.5});
        if ((i + 1) % 3 === 0 || i === 0) api.label([bx + bw * 0.32, cy1 + 9], String(i + 1), {color: on ? c.c3 : c.muted, size: 12, anchor: "middle"});
      });
      api.label([cx1, cy0 - 14], "band ±" + api.fmt(BAND), {color: c.muted, size: 12, anchor: "end"});
      // the lag plot behind the chosen bar
      var lx0 = 276, lx1 = 390, ly0 = 156, ly1 = 272, L = function (val) { return (val - lo + pad) / (hi - lo + 2 * pad); };
      api.rect(lx0, ly0, lx1 - lx0, ly1 - ly0, {stroke: c.axis, width: 1, rx: 2});
      for (var i = 0; i + k < N; i++) api.circle([lx0 + (lx1 - lx0) * L(x[i]), ly1 - (ly1 - ly0) * L(x[i + k])], 2.4, {fill: c.c3, fillOpacity: 0.8});
      // the line through the mean point with slope r_k (both axes on the same scale), clipped to the box
      var r = s.r[k - 1], mx = L(s.m), xa = 0, xb = 1, Ly = function (q) { return mx + r * (q - mx); };
      if (Math.abs(r) > 1e-9) { var e0 = mx - mx / r, e1 = mx + (1 - mx) / r; xa = Math.max(0, Math.min(e0, e1)); xb = Math.min(1, Math.max(e0, e1)); }
      var LP = function (q) { return [lx0 + (lx1 - lx0) * q, ly1 - (ly1 - ly0) * Ly(q)]; };
      api.line(LP(xa), LP(xb), {color: c.c3, width: 1.5, opacity: 0.8});
      api.label([(lx0 + lx1) / 2, ly0 - 14], "r" + subk(k) + " = " + api.fmt(r), {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      api.label([(lx0 + lx1) / 2, ly1 + 12], "x_t", {color: c.muted, size: 12, anchor: "middle"});
      api.label([lx0 - 4, (ly0 + ly1) / 2], "xₜ₊ₖ", {color: c.muted, size: 12, anchor: "end"});
    }
  });
})();
