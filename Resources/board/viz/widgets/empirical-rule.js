// The 68-95-99.7 rule on a normal curve. The curve is always drawn from mu - 3.7 sigma to mu + 3.7 sigma, because the
// rule is the same shape at every mean and spread: what changes are the numbers on the axis and in the brackets.
// Bands: 34% + 34% within one SD, 13.5% on each side out to two, 2.35% out to three, 0.15% in each tail
// (the rule's rounding of 34.13, 13.59, 2.14 and 0.13; they add to 100).
(function () {
  function calc(v) {
    var m = v.mean, s = v.standard_deviation;
    return {m: m, s: s, iv: [1, 2, 3].map(function (k) { return [m - k * s, m + k * s]; })};
  }
  var f = function (x) { return Viz.fmt(x, 2); }, t = function (x) { return Viz.n(x, 2); };

  Viz.register("empirical-rule", {
    title: "The empirical rule (68-95-99.7)",
    subject: "stats",
    shows: "Set the mean and SD: about 68% of a normal distribution lies within one SD of the mean, 95% within two and 99.7% within three",
    params: {
      mean: {kind: "number", default: 100, min: -10000, max: 10000, step: 0.5, label: "\\mu"},
      standard_deviation: {kind: "number", default: 15, min: 0.1, max: 3000, step: 0.05, label: "\\sigma"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}" + k.iv.map(function (iv, i) {
        return "\\mu\\pm" + (i ? i + 1 : "") + "\\sigma=[" + t(iv[0]) + ",\\ " + t(iv[1]) + "]";
      }).join("\\\\") + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      return "About <b>68%</b> of values fall between <b>" + f(k.iv[0][0]) + "</b> and <b>" + f(k.iv[0][1]) + "</b>, 95% between " +
        f(k.iv[1][0]) + " and " + f(k.iv[1][1]) + ", and nearly all (99.7%) between " + f(k.iv[2][0]) + " and " + f(k.iv[2][1]) + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {mean: -10000, standard_deviation: 0.1}},
      {name: "Maximum supported values", values: {mean: 10000, standard_deviation: 3000}},
      {name: "Test scores with a narrow spread", values: {mean: 72.5, standard_deviation: 4.25}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), cx = 200, sp = 50, base = 196, peak = 112;
      var X = function (z) { return cx + z * sp; }, pdf = function (z) { return Math.exp(-z * z / 2); };
      var Y = function (z) { return base - peak * pdf(z); };
      var curve = function (a, b) { var pts = []; for (var i = 0; i <= 60; i++) { var z = a + (b - a) * i / 60; pts.push([X(z), Y(z)]); } return pts; };
      // shaded bands, darker toward the middle
      var bands = [[-3.7, -3, 0.06], [-3, -2, 0.16], [-2, -1, 0.32], [-1, 1, 0.55], [1, 2, 0.32], [2, 3, 0.16], [3, 3.7, 0.06]];
      bands.forEach(function (b) {
        api.polygon([[X(b[0]), base]].concat(curve(b[0], b[1])).concat([[X(b[1]), base]]), {fill: c.c1, fillOpacity: b[2]});
      });
      api.polyline(curve(-3.7, 3.7), {stroke: c.c1, width: 2.5});
      for (var z = -3; z <= 3; z++) if (z) api.line([X(z), base], [X(z), Y(z)], {color: c.c1, width: 1, opacity: 0.7});
      api.line([X(0), base], [X(0), Y(0)], {color: c.ink, width: 1.5, dash: "4 4"});
      // the share in each band
      [["34%", 0.5, base - 22], ["13.5%", 1.5, base - 12], ["2.35%", 2.5, base - 22], ["0.15%", 3.45, base - 10]].forEach(function (q) {
        [-1, 1].forEach(function (sg) { api.label([X(sg * q[1]), q[2]], q[0], {color: c.ink, size: 12, weight: 600, anchor: "middle"}); });
      });
      // nested brackets: 99.7, 95, 68
      [[3, 30, "99.7% within 3σ"], [2, 54, "95% within 2σ"], [1, 78, "68% within 1σ"]].forEach(function (b, i) {
        var a = X(-b[0]), e = X(b[0]), y = b[1], col = [c.c6, c.c2, c.c3][i];
        api.line([a, y], [e, y], {color: col, width: 2});
        api.line([a, y], [a, y + 7], {color: col, width: 2});
        api.line([e, y], [e, y + 7], {color: col, width: 2});
        api.label([cx, y - 10], b[2], {color: col, size: 12.5, weight: 650, anchor: "middle"});
      });
      // axis in data units: alternate rows so long numbers never collide
      api.line([X(-3.8), base], [X(3.8), base], {color: c.axis, width: 1.4});
      for (var j = -3; j <= 3; j++) {
        api.line([X(j), base], [X(j), base + 4], {color: c.axis, width: 1});
        api.label([X(j), base + (j % 2 ? 15 : 31)], f(k.m + j * k.s), {color: j ? c.muted : c.ink, size: 12, weight: j ? 500 : 650, anchor: "middle"});
      }
      // one SD as a ruler
      var yr = 258;
      api.line([X(0), yr], [X(1), yr], {color: c.ink, width: 2});
      api.line([X(0), yr - 5], [X(0), yr + 5], {color: c.ink, width: 2});
      api.line([X(1), yr - 5], [X(1), yr + 5], {color: c.ink, width: 2});
      api.label([X(1) + 8, yr], "1 SD = " + f(k.s), {color: c.ink, size: 12.5, weight: 600});
      api.label([X(0) - 8, yr], "mean " + f(k.m), {color: c.ink, size: 12.5, weight: 600, anchor: "end"});
      api.label([cx, 288], "the same shape at every μ and σ: only the numbers move", {color: c.muted, size: 12, anchor: "middle"});
      // viz.css sets every svg text's fill to ink, which beats the fill attribute api.label writes: restate it inline
      api.svg.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
