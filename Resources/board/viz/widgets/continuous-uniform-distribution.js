// Continuous uniform distribution on [a, b]: a flat density 1/(b - a), so the rectangle always has area 1.
// The chance of landing in [c, d] is the share of the width it covers, after clipping [c, d] to [a, b].
// Queue params: lower_bound and upper_bound (names and ranges kept). c and d are Dot's own additions so the
// picture answers a question; drag their dots on the axis. The x axis fits a, b, c and d with a 10% margin, rounded
// out to the tick step (5, or 10 past a span of 40, finer for a span under 10), so the rectangle fills most of it.
// The y axis rescales in doubling steps so a narrow, tall rectangle still fits; its height label reads the exact density.
(function () {
  function calc(v) {
    var a = v.lower_bound, b = v.upper_bound, w = b - a, lo = Math.min(v.c, v.d), hi = Math.max(v.c, v.d);
    var L = Math.max(lo, a), R = Math.min(hi, b);
    return {a: a, b: b, w: w, f: 1 / w, lo: lo, hi: hi, L: L, R: R, p: Math.max(0, R - L) / w, mu: (a + b) / 2, sd: w / Math.sqrt(12)};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };

  Viz.register("continuous-uniform-distribution", {
    title: "Continuous uniform distribution",
    subject: "stats",
    shows: "Move a and b: the density stays flat at 1/(b − a) so the area is always 1, and P(c ≤ X ≤ d) is the share of the width [c, d] covers",
    params: {
      lower_bound: {kind: "number", default: 0, min: -20, max: 10, step: 0.5, label: "a"},
      upper_bound: {kind: "number", default: 15, min: 11, max: 40, step: 0.5, label: "b"},
      c: {kind: "number", default: 3, min: -20, max: 40, step: 0.5, label: "c"},
      d: {kind: "number", default: 9, min: -20, max: 40, step: 0.5, label: "d"}
    },
    formula: function (v) {
      var k = calc(v), w = Viz.n(k.w), P = "P(" + Viz.n(k.lo) + "\\le X\\le " + Viz.n(k.hi) + ")=";
      var pr = k.lo === k.hi ? P + "0" : k.p === 0 ? P + "\\frac{0}{" + w + "}=0" :
        P + "\\frac{" + Viz.n(k.R) + "-" + Viz.p(k.L) + "}{" + w + "}=" + Viz.n(k.p, 3);
      return "\\begin{array}{l}f(x)=\\frac{1}{b-a}=\\frac{1}{" + w + "}" + (Math.abs(k.f * 1000 - Math.round(k.f * 1000)) < 1e-9 ? "=" : "\\approx ") + Viz.n(k.f, 3) + "\\\\" +
        "\\text{area}=(b-a)\\cdot\\frac{1}{b-a}=" + w + "\\cdot\\frac{1}{" + w + "}=1\\\\" + pr + "\\\\" +
        "\\mu=\\frac{a+b}{2}=" + Viz.n(k.mu) + ",\\ \\sigma=\\frac{b-a}{\\sqrt{12}}=" + Viz.n(k.sd) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), rng = f(k.a) + " to " + f(k.b);
      if (k.lo === k.hi) return "A single point has probability <b>0</b> for a continuous variable: only an interval with width has area under the flat line.";
      if (k.p === 0) return "Every value from " + rng + " is equally likely, but [" + f(k.lo) + ", " + f(k.hi) + "] lies outside that range, so the chance is <b>0</b>.";
      if (k.L > k.lo || k.R < k.hi) return "Only the part of [" + f(k.lo) + ", " + f(k.hi) + "] inside [" + f(k.a) + ", " + f(k.b) + "] counts: " +
        f(k.R - k.L) + " of the " + f(k.w) + " units of width, so P = <b>" + f(k.p, 3) + "</b>.";
      return "Every value from " + rng + " is equally likely, so the chance of landing in [" + f(k.lo) + ", " + f(k.hi) + "] is its share of the width: " +
        f(k.R - k.L) + " of " + f(k.w) + " = <b>" + f(k.p, 3) + "</b>.";
    },
    examples: [
      {name: "every input at its minimum", values: {lower_bound: -20, upper_bound: 11, c: -20, d: -20}},
      {name: "every input at its maximum", values: {lower_bound: 10, upper_bound: 40, c: 40, d: 40}},
      {name: "narrowest: 10 to 11, density 1", values: {lower_bound: 10, upper_bound: 11, c: 10, d: 10.5}},
      {name: "interval sticks out past b", values: {c: 10, d: 30}},
      {name: "interval misses the range", values: {c: 20, d: 30}}
    ],
    size: [400, 272],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 50, x1 = 382, base = 196, top = 36;
      // fit the x axis to a, b, c, d; X() and the drag's toX() share this one mapping
      var mn = Math.min(k.a, v.c, v.d), mx = Math.max(k.b, v.c, v.d), span = mx - mn;
      var t = span > 40 ? 10 : span > 10 ? 5 : span > 4 ? 2 : 1, u = Math.min(t, 5);
      var lo = Math.floor((mn - 0.1 * span) / u) * u, hi = Math.ceil((mx + 0.1 * span) / u) * u;
      var X = function (x) { return x0 + (x - lo) * (x1 - x0) / (hi - lo); };
      var toX = function (px) { return Math.max(-20, Math.min(40, Math.round((lo + (px - x0) * (hi - lo) / (x1 - x0)) * 2) / 2)); };
      var ymax = [0.025, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6].filter(function (m) { return k.f <= 0.8 * m; })[0];
      var Y = function (y) { return base - (base - top) * y / ymax; };
      var xa = X(k.a), xb = X(k.b), yf = Y(k.f), xm = X(k.mu), showMu = xb - xa >= 80;
      var hText = k.w === 1 ? "1" : "1/" + api.fmt(k.w);
      // axes: the density axis on the left edge; x tick labels give way to the a, b and μ labels
      api.line([x0, base], [x1 + 10, base], {color: c.axis, width: 1.3, arrow: true});
      api.line([x0, base], [x0, top - 14], {color: c.axis, width: 1.3, arrow: true});
      for (var tk = Math.ceil(lo / t) * t; tk <= hi + 1e-9; tk += t) {
        var xt = X(tk);
        api.line([xt, base], [xt, base + 4], {color: c.axis, width: 1});
        if (Math.abs(xt - xa) > 12 && Math.abs(xt - xb) > 12 && !(showMu && Math.abs(xt - xm) < 14)) api.label([xt, base + 14], api.fmt(tk), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1 + 10, base - 12], "x", {color: c.muted, size: 12.5, anchor: "end"});
      api.label([x0 + 8, top - 16], "f(x)", {color: c.muted, size: 12.5});
      api.line([x0 - 4, Y(ymax)], [x0, Y(ymax)], {color: c.axis, width: 1});
      api.label([x0 - 6, Y(ymax)], api.fmt(ymax, 3), {color: c.muted, size: 12, anchor: "end"});
      // the density: a rectangle of height 1/(b - a) over [a, b]
      api.line([x0, yf], [xa, yf], {color: c.c2, width: 1, dash: "3 4", opacity: 0.7});
      api.label([x0 - 6, yf], hText, {color: c.c2, size: 12, anchor: "end", weight: 650});
      api.rect(xa, yf, xb - xa, base - yf, {fill: c.c2, fillOpacity: 0.16, stroke: c.c2, width: 1.6, rx: 0});
      // the probability: the part of [c, d] inside [a, b]
      if (k.p > 0) {
        api.rect(X(k.L), yf, X(k.R) - X(k.L), base - yf, {fill: c.c3, fillOpacity: 0.5, rx: 0});
        api.label([(X(k.L) + X(k.R)) / 2, yf - 12], "P = " + api.fmt(k.p, 3), {color: c.c3, size: 13, weight: 650, anchor: "middle"});
      }
      // width × height = area 1, always shown: one row above the rectangle (above the P label when there is one)
      var aText = "width " + api.fmt(k.w) + " × height " + hText + " = area 1", aw = aText.length * 12 * 0.56;
      var ax = Math.max(x0 + 8 + aw / 2, Math.min(x1 + 8 - aw / 2, (xa + xb) / 2));
      api.label([ax, yf - (k.p > 0 ? 30 : 12)], aText, {color: c.c2, size: 12, anchor: "middle", weight: 600});
      // the mean sits at the middle of [a, b]; drawn only when there is room to label it under the axis
      if (showMu) {
        api.line([xm, yf], [xm, base + 22], {color: c.ink, width: 1.2, dash: "4 4", opacity: 0.6});
        api.label([xm, base + 32], "μ = " + api.fmt(k.mu), {color: c.ink, size: 12, anchor: "middle"});
      }
      // a and b, with their own ticks
      api.line([xa, base], [xa, base + 24], {color: c.c2, width: 1.6});
      api.line([xb, base], [xb, base + 24], {color: c.c2, width: 1.6});
      api.label([xa - 3, base + 32], "a = " + api.fmt(k.a), {color: c.c2, size: 12.5, weight: 650, anchor: "end"});
      api.label([xb + 3, base + 32], "b = " + api.fmt(k.b), {color: c.c2, size: 12.5, weight: 650, anchor: "start"});
      // c and d: dashed edges up to the density and draggable dots on the axis. A drag keeps the axis it started on
      // (the handle's closure holds this draw's toX), so the axis refitting under the pointer cannot run away.
      var xc = X(v.c), xd = X(v.d), hy = Math.min(yf, base - 24);
      api.line([xc, base], [xc, hy], {color: c.c3, width: 1.6, dash: "5 4"});
      api.line([xd, base], [xd, hy], {color: c.c3, width: 1.6, dash: "5 4"});
      var lowIsC = v.c <= v.d;
      if (k.lo === k.hi) api.label([xc, base + 52], "c = d = " + api.fmt(k.lo), {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      else api.label([(lowIsC ? xc : xd) - 3, base + 52], (lowIsC ? "c" : "d") + " = " + api.fmt(k.lo), {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
      if (k.lo !== k.hi) api.label([(lowIsC ? xd : xc) + 3, base + 52], (lowIsC ? "d" : "c") + " = " + api.fmt(k.hi), {color: c.c3, size: 12.5, weight: 650, anchor: "start"});
      api.handle([xc, base], {color: c.c3, r: 6, onDrag: function (q) { api.set({c: toX(q[0])}); }});
      api.handle([xd, base], {color: c.c3, r: 6, onDrag: function (q) { api.set({d: toX(q[0])}); }});
    }
  });
})();
