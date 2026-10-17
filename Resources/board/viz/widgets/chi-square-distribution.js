// The chi-square distribution with k degrees of freedom (the sum of k squared standard normals): mean k, variance 2k,
// peak at k - 2 for k >= 3. The p-value of an observed statistic is the right tail P(chi2_k >= x), shaded red; the
// dashed line is the 5% critical value. Tail areas use the regularized incomplete gamma function,
// P(chi2_k >= x) = Q(k/2, x/2), by series below a + 1 and Lentz's continued fraction above (Numerical Recipes 6.2).
// The axis follows k: it runs past the 0.1% critical value (rounded up to a multiple of 5, at least 15), so the curve and
// its tail fill the width at every k; an observed value beyond the axis is marked at the right edge. The curve's height
// is rescaled per k (densities are not read off this chart, areas are), and the k = 1 spike at 0 is clipped at the top.
// The grey band past the critical value is the 5% rejection region, so the red p-value area can be set against it.
// The default observed value is 13, not the catalog's 11.1: 11.1 sits on the 11.07 critical line and hides it, and the
// "just past the 5% line" example already shows that case.
(function () {
  function lnG(z) {
    var p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
             12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnG(1 - z);
    z -= 1; var x = p[0]; for (var i = 1; i < 9; i++) x += p[i] / (z + i);
    var t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function gammaQ(a, x) { // upper regularized incomplete gamma
    if (x <= 0) return 1;
    var lead = Math.exp(-x + a * Math.log(x) - lnG(a));
    if (x < a + 1) {
      var sum = 1 / a, del = sum, ap = a;
      for (var n = 0; n < 1000; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-15) break; }
      return Math.max(0, 1 - sum * lead);
    }
    var b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (var i = 1; i < 1000; i++) {
      var an = -i * (i - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; var dl = d * c; h *= dl; if (Math.abs(dl - 1) < 1e-15) break;
    }
    return lead * h;
  }
  function pval(k, x) { return gammaQ(k / 2, x / 2); }
  function pdf(k, x) { return x <= 0 ? (k === 2 ? 0.5 : k === 1 ? Infinity : 0) : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.log(2) - lnG(k / 2)); }
  function crit(k, alpha) { var lo = 0, hi = 200; for (var i = 0; i < 80; i++) { var mid = (lo + hi) / 2; if (pval(k, mid) > alpha) lo = mid; else hi = mid; } return (lo + hi) / 2; }
  // four decimals near 0.05 so a borderline p never rounds onto the cutoff
  function pNum(p) {
    if (Math.abs(p - 0.05) < 0.005) { var t = p.toPrecision(3); return t === "0.0500" ? p.toPrecision(4) : t; }
    return Viz.fmt(p, p < 0.01 ? 4 : 3);
  }
  function pText(p) { return p < 0.0001 ? "p < 0.0001" : "p = " + pNum(p); }

  Viz.register("chi-square-distribution", {
    title: "The chi-square distribution and its tail",
    subject: "stats",
    shows: "Set the degrees of freedom and drag the observed statistic: the shaded right tail is the p-value, and it falls below 5% once you pass the critical value",
    params: {
      degrees_of_freedom: {kind: "integer", default: 5, min: 1, max: 20, label: "k\\ (\\text{df})"},
      observed_value: {kind: "number", default: 13, min: 0, max: 30, step: 0.1, label: "\\chi^2_{\\text{obs}}"}
    },
    formula: function (v) {
      var k = v.degrees_of_freedom, x = v.observed_value, p = pval(k, x);
      return "\\begin{array}{l}p=P(\\chi^2_{" + k + "}\\ge " + Viz.n(x, 2) + ")" + (p < 0.0001 ? "<0.0001" : "=" + pNum(p)) + "\\\\" +
        "\\chi^2_{0.05,\\," + k + "}=" + Viz.n(crit(k, 0.05), 2) + ",\\ \\ \\text{mean}=k=" + k + "\\end{array}";
    },
    status: function (v) {
      var k = v.degrees_of_freedom, x = v.observed_value, p = pval(k, x), cv = crit(k, 0.05);
      if (x === 0) return "χ² = 0 means every observed count matched its expected count exactly, so <b>p = 1</b>.";
      if (p < 0.05) return "χ² = " + Viz.fmt(x, 2) + " is past the 5% critical value " + Viz.fmt(cv, 2) + ", so <b>" + pText(p) + "</b> < 0.05: reject H₀ at the 5% level.";
      if (p > 0.95) return "<b>" + pText(p) + "</b>: no evidence against H₀, and a χ² this small is itself rare (" + (1 - p < 0.001 ? "under 0.1%" : Viz.fmt(100 * (1 - p), 1) + "%") + " of the time): a fit this close can mean data too good to be true.";
      return "<b>" + pText(p) + "</b>: with " + k + " df a χ² this large turns up " + Viz.fmt(100 * p, 1) + "% of the time when H₀ is true, so it is no evidence against H₀ at 5%.";
    },
    examples: [
      {name: "Minimum supported values", values: {degrees_of_freedom: 1, observed_value: 0}},
      {name: "Maximum supported values", values: {degrees_of_freedom: 20, observed_value: 30}},
      {name: "just past the 5% line", values: {degrees_of_freedom: 5, observed_value: 11.1}},
      {name: "1 df, chi-square 3.84", values: {degrees_of_freedom: 1, observed_value: 3.8}},
      {name: "typical value: near the mean", values: {degrees_of_freedom: 10, observed_value: 9.3}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, k = v.degrees_of_freedom, xo = v.observed_value, p = pval(k, xo), cv = crit(k, 0.05);
      var x0 = 22, x1 = 386, base = 226, top = 48, XM = 5 * Math.ceil(Math.max(15, crit(k, 0.001) + 2) / 5), off = xo > XM;
      var X = function (x) { return x0 + (x1 - x0) * x / XM; };
      var ymax = (k >= 3 ? pdf(k, k - 2) : 0.5) * 1.08, Y = function (d) { return base - (base - top) * Math.min(d, ymax) / ymax; };
      var pts = [];
      for (var i = 0; i <= 360; i++) { var x = i * XM / 360; pts.push([X(x), Y(pdf(k, Math.max(x, k === 1 ? 0.004 : 0)))]); }
      // an area under the curve from a to the right edge
      var area = function (a) {
        var poly = [[X(a), base], [X(a), Y(pdf(k, Math.max(a, 0.004)))]];
        pts.forEach(function (q, i) { if (i * XM / 360 > a) poly.push(q); });
        return poly.concat([[X(XM), base]]);
      };
      // the 5% rejection region in grey, and the p-value (the area right of the observed value) in red over it
      api.polygon(area(cv), {fill: c.muted, fillOpacity: 0.45});
      if (!off) api.polygon(area(xo), {fill: c.c5, fillOpacity: 0.55});
      api.polyline(pts, {stroke: c.c2, width: 2.4});
      api.line([X(0), base], [X(XM), base], {color: c.axis, width: 1.2});
      for (var t = 0, te = XM > 35 ? 10 : 5; t <= XM; t += te) {
        api.line([X(t), base], [X(t), base + 4], {color: c.axis, width: 1});
        api.label([X(t), base + 15], String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1, base + 32], "χ² value", {color: c.muted, size: 12, anchor: "end"});
      // the 5% critical value
      api.line([X(cv), base], [X(cv), top - 14], {color: c.muted, width: 1.4, dash: "5 4"});
      // the curve's name and the mean, on the side away from the critical line
      var left = X(cv) > 200;
      api.label([left ? x0 : x1, 14], "χ² with " + k + " df: mean " + k + ", SD " + Viz.fmt(Math.sqrt(2 * k), 2), {color: c.c2, size: 12.5, weight: 650, anchor: left ? "start" : "end"});
      var crT = "critical " + Viz.fmt(cv, 2) + ": grey area = 5%", crLabelRight = X(cv) + 8 + crT.length * 12 * 0.56 < x1;
      api.label([X(cv) + (crLabelRight ? 6 : -6), top - 20], crT, {color: c.muted, size: 12, anchor: crLabelRight ? "start" : "end"});
      // the observed statistic, draggable along the axis; past the axis end it is pinned to the edge with an arrow
      var xp = X(Math.min(xo, XM));
      api.line([xp, base], [xp, top + 4], {color: c.c3, width: 2.2, dash: off ? "5 3" : null});
      // p sits over its tail when there is room right of the line, otherwise under the observed label on the left
      if (X(XM) - xp > 84) {
        // and it steps off the dashed critical line rather than letting the line strike through it
        var pAt = xo + Math.max(1.5, (XM - xo) * 0.2), pW = pText(p).length * 13 * 0.56 + 4;
        if (X(pAt) - 4 < X(cv) && X(cv) < X(pAt) + pW) pAt = (X(cv) + 7 - x0) / (x1 - x0) * XM;
        api.label([X(pAt), Math.max(top + 30, Math.min(base - 16, Y(pdf(k, Math.max(pAt, 0.004))) - 16))], pText(p), {color: c.c5, size: 13, weight: 650});
      } else {
        api.label([xp - 7, top + 30], pText(p), {color: c.c5, size: 13, weight: 650, anchor: "end"});
      }
      // the observed label sits above the curve's peak, beside its line: first choice the side away from the critical
      // line, then the other; a side that would cover the curve (the steep k = 1 spike) loses to one that only crosses the
      // dashed critical line, which a card plate then interrupts; the curve is never hidden unless both sides would hide it
      var obT = "observed " + Viz.fmt(xo, 2) + (off ? " →" : ""), obW = obT.length * 12.5 * 0.56, oy = top - 2;
      var sides = (xo < cv ? [true, false] : [false, true]).map(function (L) {
        var a = L ? xp - 10 - obW : xp + 4, b = a + obW + 6;
        return {left: L, a: a, fits: a > x0 - 8 && b < x1 + 8, crit: a < X(cv) && X(cv) < b,
                curve: pts.some(function (q) { return q[0] > a && q[0] < b && q[1] < oy + 9; })};
      });
      var ob = sides.filter(function (q) { return q.fits && !q.curve && !q.crit; })[0] || sides.filter(function (q) { return q.fits && !q.curve; })[0] ||
        sides.filter(function (q) { return q.fits; })[0] || sides[0];
      if (ob.crit || ob.curve) api.rect(ob.a, oy - 9, obW + 6, 18, {fill: c.card, fillOpacity: 0.9, rx: 4});
      api.label([xp + (ob.left ? -7 : 7), oy], obT, {color: c.c3, size: 12.5, weight: 650, anchor: ob.left ? "end" : "start"});
      api.handle([xp, base], {color: c.c3, onDrag: function (q) {
        var x = (q[0] - x0) / (x1 - x0) * XM;
        api.set({observed_value: Math.round(Math.max(0, Math.min(30, XM, x)) * 10) / 10});
      }});
    }
  });
})();
