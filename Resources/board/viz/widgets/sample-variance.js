// Sample variance built from its parts. Each row is one data value (drag the blue dot); the teal bar is its deviation
// from the mean x-bar (dashed line), and the number on the right is that deviation squared. Below, the squared
// deviations are laid end to end (total length = the sum of squares), and the amber bar cuts the same length into
// n - 1 equal shares: one share is s^2. Switching the divisor to n cuts it into n shares instead, the smaller
// "divide by n" figure that runs low on average because deviations are measured from x-bar, not the true mean.
// Dot's design: the queue gives only the formula, so the data values (dragged) and n are the inputs.
(function () {
  var MAXN = 5;
  function calc(v) {
    var xs = [], i;
    for (i = 1; i <= v.n; i++) xs.push(v["x" + i]);
    var sum = xs.reduce(function (a, b) { return a + b; }, 0), m = sum / v.n;
    var d2 = xs.map(function (x) { return (x - m) * (x - m); }), ss = d2.reduce(function (a, b) { return a + b; }, 0);
    var div = v.divisor === "n" ? v.n : v.n - 1;
    return {xs: xs, sum: sum, m: m, d2: d2, ss: ss, div: div, s2: ss / (v.n - 1), pop: ss / v.n, val: ss / div};
  }
  var f2 = function (x) { return Viz.fmt(x, 2); }, n2 = function (x) { return Viz.n(x, 2); };
  var params = {
    n: {kind: "integer", default: 5, min: 2, max: MAXN, label: "n"},
    divisor: {kind: "enum", values: ["n-1", "n"], names: {"n-1": "n − 1 (sample)", "n": "n"}, default: "n-1", label: "\\text{divide by}"}
  };
  [2, 4, 5, 6, 8].forEach(function (x, i) { params["x" + (i + 1)] = {kind: "number", default: x, min: 0, max: 10, step: 0.5, label: "x_" + (i + 1), control: false}; });

  Viz.register("sample-variance", {
    title: "Sample variance",
    subject: "stats",
    shows: "Drag the data: each value's squared distance from the mean adds to a total, and s² is that total shared among n − 1",
    params: params,
    formula: function (v) {
      var k = calc(v), lhs = v.divisor === "n" ? "\\dfrac{\\sum(x_i-\\bar x)^2}{n}" : "s^2=\\dfrac{\\sum(x_i-\\bar x)^2}{n-1}";
      return "\\begin{array}{l}\\bar x=\\dfrac{\\sum x_i}{n}=\\dfrac{" + n2(k.sum) + "}{" + v.n + "}=" + n2(k.m) + "\\\\[10pt]" + lhs + "=\\dfrac{" + n2(k.ss) + "}{" + k.div + "}=" + n2(k.val) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (k.ss < 1e-12) return "Every value equals the mean " + f2(k.m) + ", so every deviation is 0 and <b>s² = 0</b>: no spread at all.";
      if (v.divisor === "n") return "Dividing by n = " + v.n + " gives <b>" + f2(k.pop) + "</b>, below s² = " + f2(k.s2) + ": deviations from x̄ run short of deviations from the true mean, and n − 1 makes up for it.";
      return "The " + v.n + " squared deviations add to <b>" + f2(k.ss) + "</b>; shared over n − 1 = " + (v.n - 1) + " that is <b>s² = " + f2(k.s2) + "</b>, so s = " + f2(Math.sqrt(k.s2)) + ".";
    },
    examples: [
      {name: "two values", values: {n: 2, x1: 3, x2: 7}},
      {name: "all equal: no spread", values: {x1: 5, x2: 5, x3: 5, x4: 5, x5: 5}},
      {name: "one outlier", values: {x1: 4, x2: 5, x3: 5, x4: 6, x5: 10}},
      {name: "divide by n instead", values: {divisor: "n"}},
      {name: "widest spread", values: {x1: 0, x2: 0, x3: 0, x4: 10, x5: 10}}
    ],
    size: [400, 272],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 70, ppu = 21.4, X = function (x) { return x0 + x * ppu; };
      var rowY = function (i) { return 36 + i * 24; }, last = rowY(v.n - 1);
      api.line([X(k.m), 22], [X(k.m), last + 14], {color: c.ink, width: 1.4, dash: "4 4", opacity: 0.8});
      api.label([X(k.m), 12], "x̄ = " + f2(k.m), {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      k.xs.forEach(function (x, i) {
        var y = rowY(i), d = x - k.m;
        api.label([4, y], "x_" + (i + 1) + " = " + Viz.fmt(x, 1), {color: c.c2, size: 12.5});
        if (Math.abs(d) * ppu > 1) api.line([X(k.m), y], [X(x), y], {color: c.c1, width: 3.5});
        api.point([X(x), y], {color: c.c2, r: 5});
        api.label([396, y], "(" + f2(d) + ")² = " + f2(d * d), {color: c.c1, size: 12, anchor: "end"});
        api.handle([X(x), y], {color: c.c2, r: 6, onDrag: function (q) {
          var p = {}; p["x" + (i + 1)] = Math.max(0, Math.min(10, Math.round((q[0] - x0) / ppu * 2) / 2)); api.set(p);
        }});
      });
      var ya = 156;
      api.line([X(0), ya], [X(10), ya], {color: c.axis, width: 1.2});
      for (var t = 0; t <= 10; t += 2) api.label([X(t), ya + 13], String(t), {color: c.muted, size: 12, anchor: "middle"});
      // the sum of squares, then the same length cut into equal shares
      var bx = x0, bw = 314, y1 = 192, y2 = 230, bh = 16;
      api.label([4, y1 + bh / 2], "Σ(x − x̄)²", {color: c.c1, size: 12.5, weight: 650});
      api.label([4, y2 + bh / 2], "÷ " + (v.divisor === "n" ? "n" : "(n − 1)"), {color: c.c3, size: 12.5, weight: 650});
      if (k.ss < 1e-12) {
        api.rect(bx, y1, bw, bh, {stroke: c.faint, dash: "4 4", rx: 3});
        api.label([bx + bw / 2, y1 + bh / 2], "sum of squares = 0", {color: c.muted, size: 12, anchor: "middle"});
        api.label([bx, y2 + bh / 2], "nothing to share: s² = 0", {color: c.c3, size: 12.5, weight: 650});
        return;
      }
      var at = bx;
      k.d2.forEach(function (q) {
        var w = bw * q / k.ss;
        if (w > 0.5) api.rect(at + 0.6, y1, w - 1.2, bh, {fill: c.c1, fillOpacity: 0.75, rx: 2});
        if (w > 22) api.label([at + w / 2, y1 + bh / 2 + 0.5], Viz.fmt(q, q < 10 ? 2 : 1), {color: c.card, size: 12, weight: 700, anchor: "middle"});
        at += w;
      });
      api.label([bx + bw, y1 - 10], "total " + f2(k.ss), {color: c.c1, size: 12, anchor: "end"});
      var sw = bw / k.div;
      for (var j = 0; j < k.div; j++) api.rect(bx + j * sw + 0.6, y2, sw - 1.2, bh, {fill: c.c3, fillOpacity: j === 0 ? 0.95 : 0.3, rx: 2});
      var share = f2(k.ss) + " ÷ " + k.div + " = " + f2(k.val);
      api.label([bx, y2 + bh + 14], v.divisor === "n" ? "one share: " + share + ", below s² = " + f2(k.s2) : "one share: s² = " + share + ", s = " + f2(Math.sqrt(k.s2)), {color: c.c3, size: 12.5, weight: 650});
    }
  });
})();
