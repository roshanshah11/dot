// The large-sample (Wald) confidence interval for a proportion: p̂ ± z*·sqrt(p̂(1 − p̂)/n), with z* = Φ⁻¹((1 + C)/2).
// Top: a zoomed window of the proportion axis (0.36 wide, following p̂) with the estimated sampling distribution of p̂,
// N(p̂, SE), its middle C shaded, and the interval as a bracket under the axis. Values outside 0..1 are shaded red, since
// the Wald interval can spill past them when p̂ is near 0 or 1. Bottom: the margin of error against n for this p̂ and C,
// on a fixed scale, so the 1/√n shape is visible. Φ⁻¹ is Acklam's rational approximation (relative error ~1e-9).
(function () {
  function qnorm(p) {
    var a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
    var b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    var cc = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    var d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    var q, r, lo = 0.02425;
    if (p < lo || p > 1 - lo) {
      q = Math.sqrt(-2 * Math.log(p < lo ? p : 1 - p));
      var x = (((((cc[0] * q + cc[1]) * q + cc[2]) * q + cc[3]) * q + cc[4]) * q + cc[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
      return p < lo ? x : -x;
    }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function calc(v) {
    var p = v.sample_proportion, n = v.sample_size, zs = qnorm((1 + v.confidence_level) / 2), se = Math.sqrt(p * (1 - p) / n), me = zs * se;
    return {p: p, n: n, zs: zs, se: se, me: me, lo: p - me, hi: p + me, succ: p * n, fail: (1 - p) * n};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 3 : d); };
  function pdf(x, m, s) { return Math.exp(-0.5 * Math.pow((x - m) / s, 2)); }

  Viz.register("confidence-interval-proportion", {
    title: "Confidence interval for a proportion",
    subject: "stats",
    shows: "Slide p̂, n and the confidence level: the interval is p̂ ± z*·SE, wider for more confidence and narrower like 1/√n",
    params: {
      sample_proportion: {kind: "number", default: 0.4, min: 0.02, max: 0.98, step: 0.01, label: "\\hat p"},
      sample_size: {kind: "integer", default: 100, min: 100, max: 400, step: 1, label: "n"},
      confidence_level: {kind: "number", default: 0.95, min: 0.9, max: 0.99, step: 0.01, label: "C"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\hat p\\pm z^*\\sqrt{\\tfrac{\\hat p(1-\\hat p)}{n}}\\\\=" + Viz.n(k.p) + "\\pm" + Viz.n(k.zs, 3) + "\\sqrt{\\tfrac{" + Viz.n(k.p) + "\\cdot" + Viz.n(1 - k.p) + "}{" + k.n + "}}\\\\" +
        "=" + Viz.n(k.p) + "\\pm" + Viz.n(k.me, 3) + "=(" + Viz.n(k.lo, 3) + ",\\ " + Viz.n(k.hi, 3) + ")\\end{array}";
    },
    status: function (v) {
      var k = calc(v), c = Viz.pct(v.confidence_level, 0);
      if (k.succ < 10 || k.fail < 10) {
        var few = k.succ < 10 ? "successes" : "failures", count = Math.round(Math.min(k.succ, k.fail));
        return "Only about <b>" + count + "</b> " + few + " in " + k.n + ": this normal-approximation interval needs at least 10 successes and 10 failures, so (" +
          f(k.lo) + ", " + f(k.hi) + ") is unreliable" + (k.lo < 0 || k.hi > 1 ? " and even runs past " + (k.lo < 0 ? "0" : "1") : "") + ".";
      }
      return "We're " + c + " confident the true proportion is between <b>" + f(k.lo) + "</b> and <b>" + f(k.hi) + "</b> (margin ±" + f(k.me) +
        "); four times the sample would halve the margin.";
    },
    examples: [
      {name: "every input at its minimum", values: {sample_proportion: 0.02, sample_size: 100, confidence_level: 0.9}},
      {name: "every input at its maximum", values: {sample_proportion: 0.98, sample_size: 400, confidence_level: 0.99}},
      {name: "widest: p̂ = 0.5, n = 100, 99%", values: {sample_proportion: 0.5, sample_size: 100, confidence_level: 0.99}},
      {name: "four times the sample", values: {sample_proportion: 0.4, sample_size: 400, confidence_level: 0.95}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      // viz.css paints every svg text ink, which beats the fill attribute; an inline style restores the label colors
      var lab0 = api.label; api.label = function (at, t, o) { var e = lab0(at, t, o); if (o && o.color) e.style.fill = o.color; return e; };
      var c = api.color, k = calc(v), W = 0.36, x0 = 22, x1 = 378, axY = 128, pk = 34;
      var lo = Math.max(-0.05, Math.min(1.05 - W, k.p - W / 2)), X = function (q) { return x0 + (x1 - x0) * (q - lo) / W; };
      // outside 0..1 is impossible
      if (lo < 0) {
        api.rect(X(lo), pk - 6, X(0) - X(lo), axY - pk + 6, {fill: c.c5, fillOpacity: 0.1, rx: 0});
        api.label([(X(lo) + X(0)) / 2, pk + 8], "< 0", {color: c.c5, size: 12, anchor: "middle", weight: 650});
      }
      if (lo + W > 1) {
        api.rect(X(1), pk - 6, X(lo + W) - X(1), axY - pk + 6, {fill: c.c5, fillOpacity: 0.1, rx: 0});
        api.label([(X(1) + X(lo + W)) / 2, pk + 8], "> 1", {color: c.c5, size: 12, anchor: "middle", weight: 650});
      }
      // estimated sampling distribution of p-hat, middle C shaded
      var Yc = function (q) { return axY - (axY - pk) * pdf(q, k.p, k.se); };
      var pts = [], mid = [[X(k.lo), axY]];
      for (var i = 0; i <= 160; i++) { var q = lo + W * i / 160; pts.push([X(q), Yc(q)]); }
      for (var j = 0; j <= 60; j++) { var t = k.lo + (k.hi - k.lo) * j / 60; mid.push([X(t), Yc(t)]); }
      mid.push([X(k.hi), axY]);
      api.polygon(mid, {fill: c.c1, fillOpacity: 0.3});
      api.polyline(pts, {stroke: c.ink, width: 1.8});
      api.line([X(k.p), pk - 4], [X(k.p), axY], {color: c.c3, width: 1.5, dash: "4 3"});
      api.label([X(k.p), pk - 14], "p̂ = " + api.fmt(k.p), {color: c.c3, size: 12.5, weight: 650, anchor: "middle", raw: true});
      var midH = Yc(k.p + k.me * 0.5);
      if (X(k.hi) - X(k.lo) > 70) api.label([X(k.p), (midH + axY) / 2 + 6], "middle " + Viz.pct(v.confidence_level, 0), {color: c.c1, size: 12, weight: 650, anchor: "middle"});
      // axis with ticks every 0.05
      api.line([x0, axY], [x1, axY], {color: c.axis, width: 1.2});
      for (var tk = Math.ceil(lo / 0.05 - 1e-9) * 0.05; tk <= lo + W + 1e-9; tk += 0.05) {
        api.line([X(tk), axY], [X(tk), axY + 4], {color: c.axis, width: 1});
        api.label([X(tk), axY + 14], Viz.fmt(Math.abs(tk) < 1e-9 ? 0 : tk, 2), {color: c.muted, size: 12, anchor: "middle"});
      }
      // the interval
      var by = 154;
      api.line([X(k.lo), by], [X(k.hi), by], {color: c.c1, width: 3});
      [k.lo, k.hi].forEach(function (e) { api.line([X(e), by - 6], [X(e), by + 6], {color: c.c1, width: 2}); });
      api.point([X(k.p), by], {color: c.c3, r: 4});
      api.label([X(k.lo) - 6, by], f(k.lo), {color: c.c1, size: 12.5, weight: 650, anchor: "end"});
      api.label([X(k.hi) + 6, by], f(k.hi), {color: c.c1, size: 12.5, weight: 650, anchor: "start"});
      api.label([X(k.p), by + 16], "±" + f(k.me) + " = " + f(k.zs, 2) + " × SE " + f(k.se), {color: c.c1, size: 12, anchor: "middle"});
      // margin of error against n, fixed scale 0..0.14
      var gx0 = 62, gx1 = 378, gyB = 284, gyT = 206, Nx = function (m) { return gx0 + (gx1 - gx0) * (m - 100) / 300; }, My = function (e) { return gyB - (gyB - gyT) * e / 0.14; };
      api.line([gx0, gyB], [gx1, gyB], {color: c.axis, width: 1.2});
      api.line([gx0, gyB], [gx0, gyT - 4], {color: c.axis, width: 1.2});
      [0.07, 0.14].forEach(function (e) { api.label([gx0 - 6, My(e)], String(e), {color: c.muted, size: 12, anchor: "end"}); });
      [100, 200, 300, 400].forEach(function (m) { api.label([Nx(m), gyB + 12], String(m), {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([gx1, gyT - 8], "margin of error vs n", {color: c.muted, size: 12, anchor: "end"});
      var curve = [];
      for (var m = 100; m <= 400; m += 5) curve.push([Nx(m), My(k.zs * Math.sqrt(k.p * (1 - k.p) / m))]);
      api.polyline(curve, {stroke: c.c1, width: 2});
      api.point([Nx(k.n), My(k.me)], {color: c.c1, r: 4.5});
      api.label([Nx(k.n) + (k.n > 300 ? -8 : 8), My(k.me) - 11], "n = " + k.n, {color: c.c1, size: 12, weight: 650, anchor: k.n > 300 ? "end" : "start"});
    }
  });
})();
