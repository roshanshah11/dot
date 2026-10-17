// Chi-square goodness of fit against equal proportions over four categories: each expected count is E = N/4, every
// category adds (O - E)^2 / E, and the sum is compared with chi-square on 4 - 1 = 3 df. The bars are the observed
// counts (drag their tops), the dashed line is E. On the right, the four parts are stacked along the chi-square axis
// so their sum lands where the statistic sits on the curve; the red tail is the p-value. With every count at least 5,
// N >= 20 and every E >= 5, so the chi-square approximation's usual condition always holds here.
// For 3 df the tail has a closed form: P(chi2_3 >= x) = erfc(sqrt(x/2)) + sqrt(2x/pi) e^(-x/2).
(function () {
  var CATS = ["A", "B", "C", "D"], KEYS = ["observedA", "observedB", "observedC", "observedD"];
  function erfc(x) { // Numerical Recipes erfcc, relative error < 1.2e-7
    var z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 +
      t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function p3(x) { return x <= 0 ? 1 : erfc(Math.sqrt(x / 2)) + Math.sqrt(2 * x / Math.PI) * Math.exp(-x / 2); }
  function pdf3(x) { return x <= 0 ? 0 : Math.sqrt(x) * Math.exp(-x / 2) / Math.sqrt(2 * Math.PI); }
  function calc(v) {
    var O = KEYS.map(function (k) { return v[k]; }), N = O.reduce(function (a, b) { return a + b; }, 0), E = N / 4;
    var parts = O.map(function (o) { return (o - E) * (o - E) / E; }), chi = parts.reduce(function (a, b) { return a + b; }, 0);
    return {O: O, N: N, E: E, parts: parts, chi: chi, p: p3(chi)};
  }
  // four decimals near 0.05 so a borderline p never rounds onto the cutoff
  function pNum(p) {
    if (Math.abs(p - 0.05) < 0.005) { var t = p.toPrecision(3); return t === "0.0500" ? p.toPrecision(4) : t; }
    return Viz.fmt(p, p < 0.01 ? 4 : 3);
  }
  function pText(p) { return p < 0.0001 ? "p < 0.0001" : "p = " + pNum(p); }
  var CRIT = 7.8147; // chi-square 3 df, upper 5% point
  var params = {};
  KEYS.forEach(function (k, i) { params[k] = {kind: "integer", default: [18, 22, 27, 33][i], min: 5, max: 60, label: "O_{" + CATS[i] + "}"}; });

  Viz.register("chi-square-goodness-of-fit", {
    title: "Chi-square goodness of fit",
    subject: "stats",
    shows: "Drag the four counts: each one's gap from the equal-share expectation adds (O − E)²/E to χ², and the tail of χ² with 3 df past that sum is the p-value",
    params: params,
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}E=\\dfrac{N}{4}=\\dfrac{" + k.N + "}{4}=" + Viz.n(k.E, 2) + "\\\\[6pt]\\chi^2=\\sum\\dfrac{(O_i-E_i)^2}{E_i}=" + Viz.n(k.chi, 2) + "\\\\[3pt]" +
        "df=3,\\ \\ p" + (k.p < 0.0001 ? "<0.0001" : "=" + pNum(k.p)) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), big = 0;
      k.parts.forEach(function (q, i) { if (q > k.parts[big]) big = i; });
      if (k.chi < 1e-12) return "All four counts equal " + Viz.fmt(k.E, 2) + ", exactly what equal proportions predict: <b>χ² = 0</b> and p = 1.";
      if (k.p < 0.05) return "χ² = " + Viz.fmt(k.chi, 2) + " on 3 df gives <b>" + pText(k.p) + "</b>: too uneven for equal shares, so reject H₀; " + CATS[big] +
        " contributes most (" + Viz.fmt(k.parts[big], 2) + ").";
      return "χ² = " + Viz.fmt(k.chi, 2) + " on 3 df gives <b>" + pText(k.p) + "</b>: counts this uneven are common when all four shares are equal, so no evidence against H₀.";
    },
    examples: [
      {name: "Minimum supported values", values: {observedA: 5, observedB: 5, observedC: 5, observedD: 5}},
      {name: "Maximum supported values", values: {observedA: 60, observedB: 60, observedC: 60, observedD: 60}},
      {name: "Evidence against equal proportions", values: {observedA: 60, observedB: 5, observedC: 5, observedD: 5}},
      {name: "borderline", values: {observedA: 32, observedB: 18, observedC: 20, observedD: 30}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v), base = 226, yTop = 50, per = (base - yTop) / 60;
      var Y = function (n) { return base - n * per; }, cx = function (i) { return 86 + i * 44; }, bw = 30;
      // left: the observed counts against the expected count
      api.label([4, 14], "observed counts (drag the tops)", {color: c.c2, size: 12.5, weight: 650});
      api.label([4, 31], "dashed: expected E = " + Viz.fmt(k.E, 2) + " each", {color: c.ink, size: 12});
      [0, 20, 40, 60].forEach(function (t) {
        api.line([62, Y(t)], [240, Y(t)], {color: c.grid, width: 1});
        api.label([56, Y(t)], String(t), {color: c.muted, size: 12, anchor: "end"});
      });
      api.line([62, base], [240, base], {color: c.axis, width: 1.2});
      api.label([4, 262], "(O − E)²/E", {color: c.c5, size: 12});
      k.O.forEach(function (o, i) {
        var x = cx(i), tall = base - Y(o) > 34;
        api.rect(x - bw / 2, Y(o), bw, base - Y(o), {fill: c.c2, fillOpacity: 0.55, rx: 3});
        // the gap from expectation, in red beside the bar
        if (Math.abs(o - k.E) * per > 1.5) api.line([x + bw / 2 + 4, Y(k.E)], [x + bw / 2 + 4, Y(o)], {color: c.c5, width: 2.5});
        var ly = tall ? Y(o) + 18 : Y(o) - 16;
        if (tall && Math.abs(ly - Y(k.E)) < 10) ly = Y(k.E) + 14;   // keep the count off the dashed line
        api.label([x, ly], String(o), {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
        api.label([x, base + 14], CATS[i], {color: c.muted, size: 12.5, weight: 600, anchor: "middle"});
        api.label([x, 262], Viz.fmt(k.parts[i], 2), {color: c.c5, size: 12, weight: 600, anchor: "middle"});
      });
      api.line([66, Y(k.E)], [240, Y(k.E)], {color: c.ink, width: 1.6, dash: "6 4"});
      k.O.forEach(function (o, i) {
        api.handle([cx(i), Y(o)], {color: c.c2, r: 6, onDrag: function (q) {
          var patch = {}; patch[KEYS[i]] = Math.max(5, Math.min(60, Math.round((base - q[1]) / per))); api.set(patch);
        }});
      });
      // right: chi-square with 3 df, the statistic and its tail
      var gx0 = 264, gx1 = 390, gB = 166, gT = 58, XM = 16, peak = pdf3(1) * 1.1;
      var GX = function (x) { return gx0 + (gx1 - gx0) * Math.min(x, XM) / XM; }, GY = function (d) { return gB - (gB - gT) * d / peak; };
      api.label([gx1, 14], "χ² with 3 df", {color: c.muted, size: 12.5, weight: 600, anchor: "end"});
      api.label([gx1, 30], pText(k.p), {color: c.c5, size: 12.5, weight: 650, anchor: "end"});
      var pts = [];
      for (var i = 0; i <= 160; i++) pts.push([GX(i / 10), GY(pdf3(i / 10))]);
      var xs = Math.min(k.chi, XM), tail = [[GX(xs), gB], [GX(xs), GY(pdf3(xs))]];
      pts.forEach(function (q, j) { if (j / 10 > xs) tail.push(q); });
      tail.push([GX(XM), gB]);
      if (k.chi < XM) api.polygon(tail, {fill: c.c5, fillOpacity: 0.55});
      api.polyline(pts, {stroke: c.muted, width: 2});
      api.line([gx0, gB], [gx1, gB], {color: c.axis, width: 1.2});
      [0, 4, 8, 12, 16].forEach(function (t) { api.label([GX(t), gB + 13], String(t), {color: c.muted, size: 12, anchor: "middle"}); });
      api.line([GX(CRIT), gB], [GX(CRIT), gT], {color: c.muted, width: 1.2, dash: "4 3"});
      var cl = k.chi > CRIT && k.chi < CRIT + 4;   // keep the label off the statistic's line
      api.label([GX(CRIT) + (cl ? -4 : 4), gT + 6], "5% line", {color: c.muted, size: 12, anchor: cl ? "end" : "start"});
      api.line([GX(xs), gB], [GX(xs), gT - 6], {color: c.c3, width: 2.2});
      var right = xs > 8;
      api.label([GX(xs) + (right ? -6 : 6), gT - 14], "χ² = " + Viz.fmt(k.chi, k.chi > XM ? 1 : 2) + (k.chi > XM ? " →" : ""), {color: c.c3, size: 12.5, weight: 650, anchor: right ? "end" : "start"});
      // the four parts, stacked along the same axis: their sum is where the statistic sits
      var sy = 214, run = 0;
      api.label([gx0, sy - 15], "the four parts, stacked", {color: c.c5, size: 12});
      k.parts.forEach(function (q, i) {
        var a2 = GX(run), b2 = GX(run + q);
        run += q;
        if (b2 - a2 < 0.5) return;
        api.rect(a2, sy - 6, b2 - a2, 12, {fill: c.c5, fillOpacity: i % 2 ? 0.45 : 0.85, rx: 0});
        if (b2 - a2 > 13) api.label([(a2 + b2) / 2, sy + 16], CATS[i], {color: c.c5, size: 12, anchor: "middle"});
      });
      if (k.chi > XM) api.label([gx1, sy + 16], "→ " + Viz.fmt(k.chi, 1), {color: c.c5, size: 12, anchor: "end"});
      if (k.chi < 1e-12) api.label([gx0, sy + 2], "all zero", {color: c.c5, size: 12});
    }
  });
})();
