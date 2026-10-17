// The share of a normal distribution within z standard deviations of its mean: P(−z < Z < z) = 2Φ(z) − 1, the rest
// split evenly between the two tails. The curve is the standard normal density; the middle is shaded teal, the tails
// red. Underneath, the three intervals of the 68–95–99.7 rule on the same axis, so the slider's interval can be laid
// against them. Φ is Marsaglia's (2004) series, accurate to about 1e-15, so the tail shares at z = 4 are right too.
(function () {
  function Phi(x) {
    var s = x, t = 0, b = x, q = x * x, i = 1;
    while (s !== t) { t = s; b *= q / (i += 2); s = t + b; }
    return 0.5 + s * Math.exp(-0.5 * q - 0.91893853320467274178);
  }
  function pdf(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }
  function share(x) { // a percentage with enough digits to stay honest near 0 and 100
    var p = 100 * x;
    if (p > 0 && p < 0.01) return p.toPrecision(2).replace(/0+$/, "") + "%";
    if (p > 99.99 && p < 100) return p.toFixed(4) + "%";
    return Viz.fmt(p, 2) + "%";
  }
  var NAMED = [[1, "the 68–95–99.7 rule", 0.005], [2, "the 68–95–99.7 rule", 0.005], [3, "the 68–95–99.7 rule", 0.005],
               [1.645, "90%", 0.006], [1.96, "95%", 0.006], [2.576, "99%", 0.006]];

  Viz.register("common-normal-intervals", {
    title: "Normal intervals: the 68–95–99.7 rule",
    subject: "stats",
    shows: "Slide z: the shaded share of a normal curve within ±z standard deviations of the mean, against the 68–95–99.7 rule",
    params: {
      z: {kind: "number", default: 1, min: 0, max: 4, step: 0.01, label: "z"}
    },
    formula: function (v) {
      var inside = 2 * Phi(v.z) - 1;
      return "P(-z<Z<z)=2\\Phi(z)-1=2\\Phi(" + Viz.n(v.z, 3) + ")-1=" + Viz.n(Math.abs(inside) < 5e-7 ? 0 : inside, inside > 0.999 ? 6 : 4);
    },
    status: function (v) {
      var inside = 2 * Phi(v.z) - 1, tail = 1 - Phi(v.z), z = Viz.fmt(v.z, 3);
      if (v.z === 0) return "A zero-width interval holds <b>0%</b> of the distribution: all of it lies in the two tails.";
      for (var i = 0; i < NAMED.length; i++) {
        var m = NAMED[i];
        if (Math.abs(v.z - m[0]) <= m[2]) {
          if (m[0] < 4 && m[0] === Math.round(m[0])) return "That is " + m[1] + ": <b>" + share(inside) + "</b> of a normal distribution lies within ±" + m[0] +
            " SD of the mean, leaving " + share(tail) + " in each tail.";
          return "z = " + m[0] + " is the <b>" + m[1] + "</b> critical value: " + share(inside) + " lies within ±" + m[0] + " SD and " + share(tail) +
            " in each tail, which is where " + m[1] + " confidence intervals come from.";
        }
      }
      return "<b>" + share(inside) + "</b> of a normal distribution lies within ±" + z + " SD of the mean; <b>" + share(tail) + "</b> sits in each tail.";
    },
    examples: [
      {name: "Minimum supported values", values: {z: 0}},
      {name: "Maximum supported values", values: {z: 4}},
      {name: "two standard deviations", values: {z: 2}},
      {name: "the 90% critical value", values: {z: 1.645}},
      {name: "the 95% critical value", values: {z: 1.96}},
      {name: "the 99% critical value", values: {z: 2.576}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      // viz.css paints every svg text ink, which beats the fill attribute; an inline style restores the label colors
      var lab0 = api.label; api.label = function (at, t, o) { var e = lab0(at, t, o); if (o && o.color) e.style.fill = o.color; return e; };
      var c = api.color, z = v.z, x0 = 22, x1 = 378, R = 4.3, base = 176, peak = 46;
      var X = function (t) { return x0 + (x1 - x0) * (t + R) / (2 * R); }, Y = function (d) { return base - (base - peak) * d / pdf(0); };
      var curve = function (a, b) { var out = []; for (var t = a; t <= b + 1e-9; t += (b - a) / 80 || 1) out.push([X(t), Y(pdf(t))]); return out; };
      // tails, then the middle
      [[-R, -z], [z, R]].forEach(function (seg) {
        if (seg[1] - seg[0] > 1e-6) api.polygon([[X(seg[0]), base]].concat(curve(seg[0], seg[1]), [[X(seg[1]), base]]), {fill: c.c5, fillOpacity: 0.28});
      });
      if (z > 0) api.polygon([[X(-z), base]].concat(curve(-z, z), [[X(z), base]]), {fill: c.c1, fillOpacity: 0.35});
      api.polyline(curve(-R, R), {stroke: c.ink, width: 2});
      // axis in SD units
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
      for (var t = -4; t <= 4; t++) {
        api.line([X(t), base], [X(t), base + 4], {color: c.axis, width: 1});
        api.label([X(t), base + 14], t === 0 ? "μ" : (t > 0 ? "+" : "−") + Math.abs(t) + "σ", {color: c.muted, size: 12, anchor: "middle"});
      }
      // the interval's edges and its share
      var inside = 2 * Phi(z) - 1, tail = 1 - Phi(z);
      if (z > 0) {
        [-z, z].forEach(function (e) { api.line([X(e), base], [X(e), Y(pdf(e)) - 6], {color: c.c1, width: 1.6}); });
        api.line([X(-z), 32], [X(z), 32], {color: c.c1, width: 1.6, arrow: X(z) - X(-z) > 24, arrowStart: X(z) - X(-z) > 24});
      }
      api.label([X(0), 18], share(inside) + " within ±" + api.fmt(z, 3) + "σ", {color: c.c1, size: 13, weight: 700, anchor: "middle"});
      // each tail's share sits fully above the curve: the curve falls away from the middle, so its height at the
      // label's inner edge is the highest point under the label (half-width estimated from the text in SD units)
      var tt = share(tail), hw = tt.length * 12.5 * 0.29 / ((x1 - x0) / (2 * R)), tx = Math.min(z + 1.4, 3.85);
      var ty = Math.min(base - 16, Y(pdf(Math.max(0, tx - hw))) - 10);
      api.label([X(tx), ty], tt, {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      api.label([X(-tx), ty], tt, {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      // the 68-95-99.7 rule underneath, on the same axis; the slider's interval is a faint band behind the rows, and
      // each row's name sits left of its bar and its share right of it, so text and bar never share space
      if (z > 0) api.rect(X(-z), 200, X(z) - X(-z), 78, {fill: c.c1, fillOpacity: 0.07, rx: 2});
      [1, 2, 3].forEach(function (k) {
        var y = 186 + k * 26, on = Math.abs(z - k) <= 0.005, col = on ? c.c1 : c.muted, wt = on ? 700 : 500;
        api.line([X(-k), y], [X(k), y], {color: col, width: on ? 3 : 1.6});
        api.line([X(-k), y - 3], [X(-k), y + 3], {color: col, width: 1.6});
        api.line([X(k), y - 3], [X(k), y + 3], {color: col, width: 1.6});
        api.label([X(-k) - 7, y], "±" + k + "σ", {color: col, size: 12, weight: wt, anchor: "end"});
        api.label([X(k) + 7, y], share(2 * Phi(k) - 1), {color: col, size: 12, weight: wt, anchor: "start"});
      });
    }
  });
})();
