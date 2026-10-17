// An ogive (cumulative frequency polygon) for 60 grouped values in eight classes of width 10. Top: the class
// frequencies as a histogram on the same x axis. Below: cumulative frequency plotted at each class's upper boundary,
// starting from 0 at the lowest boundary, so the ogive climbs steeply where the bars are tall. Pick a percentile:
// read across from p% to the ogive and down to the value, which is the grouped-data formula L + (pN/100 − CF)/f · w.
(function () {
  var W = 10, LOWS = [0, 10, 20, 30, 40, 50, 60, 70];
  var DATA = {
    symmetric: [2, 5, 9, 14, 14, 9, 5, 2],
    "right-skewed": [10, 16, 13, 8, 6, 4, 2, 1],
    "left-skewed": [1, 2, 4, 6, 8, 13, 16, 10]
  };
  function calc(v) {
    var f = DATA[v.shape], N = 0, cum = [0];
    f.forEach(function (q) { N += q; cum.push(N); });
    var target = v.p / 100 * N, i = 0;
    while (i < f.length - 1 && cum[i + 1] < target) i++;
    var value = LOWS[i] + (target - cum[i]) / f[i] * W;
    return {f: f, N: N, cum: cum, target: target, i: i, L: LOWS[i], CF: cum[i], fi: f[i], value: value};
  }
  var NAMES = {0: "the minimum", 25: "the first quartile Q₁", 50: "the median", 75: "the third quartile Q₃", 100: "the maximum"};
  function tint(api) { api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; }); }   // viz.css paints text ink

  Viz.register("ogive", {
    title: "Ogive: cumulative frequency",
    subject: "stats",
    shows: "Pick a percentile: read across from it to the cumulative frequency curve and down to the value; steep stretches are where the data are dense",
    params: {
      shape: {kind: "enum", values: ["symmetric", "right-skewed", "left-skewed"], default: "symmetric", label: "data"},
      p: {kind: "number", default: 50, min: 0, max: 100, step: 1, label: "p\\ (\\%)"}
    },
    formula: function (v) {
      var b = calc(v);
      return "\\begin{array}{l}P_{" + v.p + "}=L+\\dfrac{pN/100-CF}{f}\\cdot w\\\\[6pt]\\phantom{P_{" + v.p + "}}=" + b.L + "+\\dfrac{" + Viz.n(b.target, 2) + "-" + b.CF + "}{" + b.fi + "}\\cdot " + W + "=" + Viz.n(b.value, 2) + "\\end{array}";
    },
    status: function (v) {
      var b = calc(v), name = NAMES[v.p];
      var head = Viz.fmt(b.target, 2) + " of the " + b.N + " values (" + v.p + "%) lie below <b>" + Viz.fmt(b.value, 2) + "</b>";
      return head + (name ? ", so " + name + " is about " + Viz.fmt(b.value, 2) + "." : ", read off the ogive inside the " + b.L + "–" + (b.L + W) + " class.");
    },
    examples: [
      {name: "Minimum supported values", values: {p: 0}},
      {name: "Maximum supported values", values: {p: 100}},
      {name: "first quartile", values: {p: 25}},
      {name: "right-skewed median", values: {shape: "right-skewed", p: 50}},
      {name: "left-skewed 90th percentile", values: {shape: "left-skewed", p: 90}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, b = calc(v), x0 = 46, x1 = 352, hy0 = 84, hy1 = 32, oy0 = 262, oy1 = 112;
      var X = function (x) { return x0 + (x1 - x0) * x / 80; };
      // histogram strip (frequencies), the reading's class highlighted
      var fMax = 18;
      api.label([x0 - 6, 12], "frequency", {color: c.muted, size: 12});
      b.f.forEach(function (q, i) {
        var h = (hy0 - hy1) * q / fMax, on = i === b.i;
        api.rect(X(LOWS[i]) + 1, hy0 - h, X(W) - X(0) - 2, h, {fill: on ? c.c3 : c.c1, fillOpacity: on ? 0.7 : 0.35, rx: 1.5});
        api.label([X(LOWS[i] + W / 2), hy0 - h - 9], String(q), {color: on ? c.c3 : c.muted, size: 12, anchor: "middle", weight: on ? 700 : 500});
      });
      api.line([x0, hy0], [x1, hy0], {color: c.axis, width: 1.2});
      // ogive axes: cumulative count on the left, percent on the right (N = 60 is 100%)
      var Y = function (q) { return oy0 - (oy0 - oy1) * q / b.N; };
      for (var k = 0; k <= 4; k++) {
        var q = b.N * k / 4;
        api.line([x0, Y(q)], [x1, Y(q)], {color: c.grid, width: 1});
        api.label([x0 - 6, Y(q)], String(q), {color: c.muted, size: 12, anchor: "end"});
        api.label([x1 + 6, Y(q)], (25 * k) + "%", {color: c.muted, size: 12});
      }
      api.line([x0, oy0], [x1, oy0], {color: c.axis, width: 1.2});
      api.line([x0, oy0], [x0, oy1 - 6], {color: c.axis, width: 1.2});
      api.label([x0 - 6, oy1 - 16], "cumulative", {color: c.muted, size: 12});
      for (var t = 0; t <= 80; t += 10) api.label([X(t), oy0 + 13], String(t), {color: c.muted, size: 12, anchor: "middle"});
      // the ogive: (upper boundary, cumulative frequency)
      var pts = b.cum.map(function (q, i) { return [X(i * W), Y(q)]; });
      api.polyline(pts, {stroke: c.c1, width: 2.5});
      pts.forEach(function (P, i) { api.point(P, {color: c.c1, r: 3.2}); });
      // the reading: across from p%, down to the value
      var R = [X(b.value), Y(b.target)];
      api.line([x1, R[1]], [R[0], R[1]], {color: c.c3, width: 1.6, dash: "5 4"});
      api.line([R[0], R[1]], [R[0], oy0], {color: c.c3, width: 1.6, dash: "5 4", arrow: true});
      api.line([R[0], hy0], [R[0], hy1 - 2], {color: c.c3, width: 1.2, dash: "2 3", opacity: 0.8});
      api.point(R, {color: c.c3, r: 5});
      var right = R[0] > 250;
      api.label([R[0] + (right ? -8 : 8), oy0 - 12], "P_{" + v.p + "} ≈ " + api.fmt(b.value, 2), {color: c.c3, size: 13, weight: 700, anchor: right ? "end" : "start"});
      tint(api);
    }
  });
})();
