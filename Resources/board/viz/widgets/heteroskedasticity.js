// Heteroskedasticity: the same 40 x values and the same standard-normal draws z, with y = 2 + 0.8x + sigma(x) z, where
// the error spread sigma(x) is constant, grows, shrinks or bulges with x. The widget fits OLS to the points it draws,
// plots the residuals underneath, and runs White's test on them: regress e^2 on 1, x, x^2, then nR^2 is chi-square
// with 2 df, whose tail is exactly e^(-nR^2 / 2). The shaded band is the true +/- 2 sigma(x) the data were drawn from.
(function () {
  var Z = [0.4, -0.02, -0.12, 1.95, 1.02, -0.79, -1.56, -1.1, 2.06, -0.32, 0.46, -1.11, -0.59, 1.34, 1.39, -1.01, 0.93, -1.55, -1.29, 0.7,
           -1.33, -0.6, 0, 0.7, -1.1, 1.56, -0.27, 0.9, 1.03, -0.13, -0.76, -1.18, 0.65, 1.12, -1.27, -0.69, -1.34, 0.45, 0.99, 1.7];
  var XS = Z.map(function (_, i) { return 0.125 + i * 0.25; });
  var SIG = {
    constant: function () { return 1.6; },
    increasing: function (x) { return 0.25 + 0.3 * x; },
    decreasing: function (x) { return 3.25 - 0.3 * x; },
    bulge: function (x) { return 0.35 + 2.7 * (1 - Math.pow((x - 5) / 5, 2)); }
  };
  function solve(A, b) {   // Gaussian elimination with partial pivoting, small systems only
    var n = b.length, M = A.map(function (r, i) { return r.concat([b[i]]); });
    for (var col = 0; col < n; col++) {
      var piv = col; for (var r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      var t = M[col]; M[col] = M[piv]; M[piv] = t;
      for (r = col + 1; r < n; r++) { var m = M[r][col] / M[col][col]; for (var j = col; j <= n; j++) M[r][j] -= m * M[col][j]; }
    }
    var out = new Array(n);
    for (var i = n - 1; i >= 0; i--) { var s = M[i][n]; for (var k = i + 1; k < n; k++) s -= M[i][k] * out[k]; out[i] = s / M[i][i]; }
    return out;
  }
  function ols(rows, y) {   // least squares via the normal equations X'X b = X'y
    var p = rows[0].length, A = [], b = [];
    for (var i = 0; i < p; i++) { A.push([]); b.push(0); for (var j = 0; j < p; j++) A[i].push(0); }
    rows.forEach(function (r, n) { for (var i = 0; i < p; i++) { b[i] += r[i] * y[n]; for (var j = 0; j < p; j++) A[i][j] += r[i] * r[j]; } });
    return solve(A, b);
  }
  function calc(v) {
    var sg = SIG[v.initial_variance_pattern], n = XS.length;
    var ys = XS.map(function (x, i) { return 2 + 0.8 * x + sg(x) * Z[i]; });
    var b = ols(XS.map(function (x) { return [1, x]; }), ys), e = ys.map(function (y, i) { return y - b[0] - b[1] * XS[i]; });
    var e2 = e.map(function (r) { return r * r; }), g = ols(XS.map(function (x) { return [1, x, x * x]; }), e2);
    var m = e2.reduce(function (s, r) { return s + r; }, 0) / n, sst = 0, sse = 0;
    e2.forEach(function (r, i) { var fit = g[0] + g[1] * XS[i] + g[2] * XS[i] * XS[i]; sst += (r - m) * (r - m); sse += (r - fit) * (r - fit); });
    var R2 = 1 - sse / sst, lm = n * R2;
    return {sg: sg, n: n, ys: ys, b: b, e: e, R2: R2, lm: lm, p: Math.exp(-lm / 2)};
  }
  function pv(p) { return p >= 0.001 ? Viz.fmt(p, 3) : "< 0.001"; }

  Viz.register("heteroskedasticity", {
    title: "Heteroskedasticity: when the spread changes",
    subject: "stats",
    shows: "Pick how the error spread behaves: constant spread leaves an even band of residuals, while a fan or a bulge is heteroskedasticity, and White's test picks it up",
    params: {
      initial_variance_pattern: {kind: "enum", values: ["constant", "increasing", "decreasing", "bulge"], default: "constant", label: "\\sigma(x)"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\hat y=" + Viz.n(k.b[0], 2) + "+" + Viz.n(k.b[1], 3) + "x\\\\\\text{White: }nR^2=" + k.n + "\\cdot" + Number(k.R2.toPrecision(4)) + "=" + Viz.n(k.lm, 2) +
        "\\\\p=e^{-nR^2/2}=" + (k.p >= 0.001 ? Viz.n(k.p, 3) : Viz.n(k.p / Math.pow(10, Math.floor(Math.log10(k.p))), 1) + "\\times10^{" + Math.floor(Math.log10(k.p)) + "}") + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), pat = v.initial_variance_pattern, rej = k.p < 0.05;
      var shape = {constant: "The spread is the same everywhere", increasing: "The residuals fan out as x grows", decreasing: "The residuals narrow as x grows",
                   bulge: "The residuals swell in the middle and pinch at the ends"}[pat];
      if (!rej) return shape + ": an even band, White's test finds nothing (p = <b>" + pv(k.p) + "</b>), and the usual OLS standard errors hold.";
      return shape + ": White's test rejects equal variance (p = <b>" + pv(k.p) + "</b>); the OLS line is still unbiased, but its usual standard errors are unreliable, so use robust ones.";
    },
    examples: [
      {name: "initial_variance_pattern: increasing", values: {initial_variance_pattern: "increasing"}},
      {name: "initial_variance_pattern: decreasing", values: {initial_variance_pattern: "decreasing"}},
      {name: "initial_variance_pattern: bulge", values: {initial_variance_pattern: "bulge"}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 40, x1 = 388, X = function (x) { return x0 + (x1 - x0) * x / 10; };
      var panel = function (yTop, yBot, lo, hi) { return function (y) { return yBot - (yBot - yTop) * (y - lo) / (hi - lo); }; };
      var Yt = panel(24, 176, -5, 17), Yb = panel(214, 298, -7, 7);
      var band = function (Y, mid) {   // the true +/- 2 sigma(x) band around mid(x)
        var up = [], dn = [];
        for (var i = 0; i <= 40; i++) { var x = i / 4; up.push([X(x), Y(mid(x) + 2 * k.sg(x))]); dn.unshift([X(x), Y(mid(x) - 2 * k.sg(x))]); }
        api.polygon(up.concat(dn), {fill: c.c2, fillOpacity: 0.12});
        api.polyline(up, {stroke: c.c2, width: 1.2, dash: "4 4"}); api.polyline(dn, {stroke: c.c2, width: 1.2, dash: "4 4"});
      };
      // top: data, true band around the true line, OLS fit
      [0, 5, 10, 15].forEach(function (g) { api.line([x0, Yt(g)], [x1, Yt(g)], {color: g ? c.grid : c.axis, width: g ? 1 : 1.2}); api.label([x0 - 6, Yt(g)], String(g), {color: c.muted, size: 12, anchor: "end"}); });
      band(Yt, function (x) { return 2 + 0.8 * x; });
      XS.forEach(function (x, i) { api.circle([X(x), Yt(k.ys[i])], 3.6, {fill: c.ink, fillOpacity: 0.9}); });
      api.line([X(0), Yt(k.b[0])], [X(10), Yt(k.b[0] + 10 * k.b[1])], {color: c.c1, width: 2.5});
      api.label([x0 + 4, 12], "data with the OLS line", {color: c.muted, size: 12});
      api.label([X(10) - 8, Yt(k.b[0] + 10 * k.b[1]) + 14], "ŷ", {color: c.c1, size: 14, weight: 700, anchor: "end", raw: true});
      api.label([x1, 12], "shaded: true ±2σ(x)", {color: c.c2, size: 12, weight: 600, anchor: "end"});
      // bottom: residuals against x
      [-5, 5].forEach(function (g) { api.line([x0, Yb(g)], [x1, Yb(g)], {color: c.grid, width: 1}); api.label([x0 - 6, Yb(g)], api.fmt(g), {color: c.muted, size: 12, anchor: "end"}); });
      band(Yb, function () { return 0; });
      api.line([x0, Yb(0)], [x1, Yb(0)], {color: c.c1, width: 1.5});
      api.label([x0 - 6, Yb(0)], "0", {color: c.muted, size: 12, anchor: "end"});
      XS.forEach(function (x, i) {
        api.line([X(x), Yb(0)], [X(x), Yb(k.e[i])], {color: c.faint, width: 1.2});
        api.circle([X(x), Yb(k.e[i])], 3.4, {fill: c.ink});
      });
      api.label([x0 + 4, 200], "residuals e = y − ŷ", {color: c.muted, size: 12});
      for (var t = 0; t <= 10; t += 2) api.label([X(t), 312], String(t), {color: c.muted, size: 12, anchor: "middle"});
      api.label([x0 - 6, 312], "x", {color: c.muted, size: 12.5, anchor: "end", italic: true});
      // viz.css sets every svg text's fill to ink, which beats the fill attribute api.label writes: restate it inline
      api.svg.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
