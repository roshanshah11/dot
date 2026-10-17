// Degrees of freedom as free choices. Fix the sample mean, then pick n values: the first n - 1 can be anything (drag
// their bars), but the last one is forced, because the deviations from the mean must sum to zero. The filled caps above
// the dashed mean line (ups) always balance the dashed gaps below it (downs). That one lost choice is why the sample
// variance divides by n - 1. Queue entry has no schema: n, the fixed mean and the five draggable values are Dot's own.
(function () {
  var KEYS = ["x1", "x2", "x3", "x4", "x5"];
  function calc(v) {
    var free = KEYS.slice(0, v.n - 1).map(function (k) { return v[k]; }), sum = free.reduce(function (a, b) { return a + b; }, 0);
    var last = v.n * v.mean - sum, all = free.concat([last]), ss = all.reduce(function (a, x) { return a + (x - v.mean) * (x - v.mean); }, 0);
    return {free: free, sum: sum, last: last, all: all, ss: ss, df: v.n - 1, s2: ss / (v.n - 1)};
  }
  var f = function (x) { return Viz.fmt(x, 2); };
  var params = {
    n: {kind: "integer", default: 6, min: 2, max: 6, label: "n"},
    mean: {kind: "number", default: 5, min: 0, max: 10, step: 0.5, label: "\\bar x"}
  };
  [3, 7, 4, 6, 8].forEach(function (d, i) { params[KEYS[i]] = {kind: "number", default: d, min: 0, max: 10, step: 0.5, control: false, label: "x_" + (i + 1)}; });

  Viz.register("degrees-of-freedom", {
    title: "Degrees of freedom: n − 1 free choices",
    subject: "stats",
    shows: "Fix the mean and drag the first n − 1 values: the last one is forced so the deviations sum to zero, which is why a sample variance divides by n − 1",
    params: params,
    formula: function (v) {
      var k = calc(v), n = v.n, list = n === 2 ? "x_1" : n === 3 ? "x_1+x_2" : "x_1+\\dots+x_{" + (n - 1) + "}";
      return "\\begin{array}{l}x_{" + n + "}=n\\bar x-(" + list + ")\\\\\\phantom{x_{" + n + "}}=" + n + "\\cdot" + Viz.n(v.mean) + "-" + Viz.p(k.sum) + "=" + Viz.n(k.last) + "\\\\" +
        "df=n-1=" + k.df + "\\\\s^2=\\frac{\\sum(x_i-\\bar x)^2}{n-1}=\\frac{" + Viz.n(k.ss) + "}{" + k.df + "}=" + Viz.n(k.s2) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), ord = ["", "", "2nd", "3rd", "4th", "5th", "6th"][v.n];
      var odd = k.last < 0 || k.last > 10 ? ", far outside the others," : "";
      return (k.df === 1 ? "You pick 1 value freely" : "You pick " + k.df + " values freely") + "; to keep the mean at " + f(v.mean) + " the " + ord +
        " is forced to <b>" + f(k.last) + "</b>" + odd + " so df = n − 1 = <b>" + k.df + "</b>.";
    },
    examples: [
      {name: "two values: one free choice", values: {n: 2}},
      {name: "the last value goes negative", values: {mean: 2}},
      {name: "free values all at the mean", values: {x1: 5, x2: 5, x3: 5, x4: 5, x5: 5}},
      {name: "every input at its minimum", values: {n: 2, mean: 0, x1: 0, x2: 0, x3: 0, x4: 0, x5: 0}},
      {name: "every input at its maximum", values: {n: 6, mean: 10, x1: 10, x2: 10, x3: 10, x4: 10, x5: 10}}
    ],
    size: [400, 292],
    draw: function (api, v) {
      var c = api.color, k = calc(v), n = v.n;
      var lo = Math.min(0, k.last), hi = Math.max(10, k.last), span = hi - lo;
      var tick = span <= 14 ? 2 : span <= 30 ? 5 : span <= 70 ? 10 : 20;
      lo = Math.floor(lo / tick) * tick; hi = Math.ceil((hi + span * 0.08) / tick) * tick;
      var pl = api.plane({x: [0, 6], y: [lo, hi], box: [44, 16, 310, 218], equal: false, grid: false, axes: false});
      for (var t = lo; t <= hi + 1e-9; t += tick) {
        api.line([pl.x(0), pl.y(t)], [pl.x(6), pl.y(t)], {color: c.grid, width: 1});
        api.label([pl.x(0) - 6, pl.y(t)], api.fmt(t), {color: c.muted, size: 12, anchor: "end"});
      }
      api.line([pl.x(0), pl.y(0)], [pl.x(6), pl.y(0)], {color: c.axis, width: 1.3});
      var slot = 6 / n, bw = Math.min(40, (pl.x(slot) - pl.x(0)) * 0.56);
      for (var i = 0; i < n; i++) {
        var xc = pl.x(slot * (i + 0.5)), val = k.all[i], forced = i === n - 1, col = forced ? c.c3 : c.c1;
        var y0 = pl.y(0), y1 = pl.y(val), ym = pl.y(v.mean);
        api.rect(xc - bw / 2, Math.min(y0, y1), bw, Math.abs(y1 - y0), {fill: col, fillOpacity: 0.3, rx: 2});
        if (val > v.mean) api.rect(xc - bw / 2, y1, bw, ym - y1, {fill: col, fillOpacity: 0.85, rx: 2});
        else if (val < v.mean) api.rect(xc - bw / 2, ym, bw, y1 - ym, {stroke: col, width: 1.4, dash: "4 3", rx: 2});
        var top = Math.min(y1, ym), bot = Math.max(y1, ym, y0);
        // the value sits at the bar's end: above it, or below it when the bar hangs under zero
        if (val < 0) { api.label([xc, y1 + 14], api.fmt(val), {color: col, size: 12.5, weight: 650, anchor: "middle"}); bot += 16; }
        else api.label([xc, top - (forced ? 12 : 18)], api.fmt(val), {color: col, size: 12.5, weight: 650, anchor: "middle"});
        api.label([xc, Math.max(bot, y0) + 14], "x_" + (i + 1) + (forced ? " forced" : ""), {color: col, size: 12.5, weight: 650, anchor: "middle"});
        if (!forced) (function (key, cx) {
          api.handle([cx, y1], {color: c.c1, r: 6, onDrag: function (q) {
            var y = pl.invert(q)[1], p = {}; p[key] = Math.max(0, Math.min(10, Math.round(y * 2) / 2)); api.set(p);
          }});
        })(KEYS[i], xc);
      }
      // the fixed mean
      api.line([pl.x(0), pl.y(v.mean)], [pl.x(6) + 2, pl.y(v.mean)], {color: c.ink, width: 1.6, dash: "7 5"});
      api.label([pl.x(6) + 6, pl.y(v.mean)], "x̄ = " + api.fmt(v.mean), {color: c.ink, size: 12.5, weight: 650});
      api.label([pl.x(0) - 4, 280], "filled ups balance dashed downs: deviations sum to 0", {color: c.muted, size: 12});
    }
  });
})();
