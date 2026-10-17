// Beta-binomial updating. A Beta(α, β) prior on a success probability p, then s successes and f failures: the
// posterior is Beta(α + s, β + f). The likelihood p^s (1 − p)^f is drawn normalized (it is the Beta(s + 1, f + 1)
// density) so the three curves share one density axis. The strip under the plot shows the posterior mean as a
// weighted average: it sits n / (α + β + n) of the way from the prior mean α / (α + β) to the sample proportion s / n,
// so α + β acts like the number of observations the prior is worth.
(function () {
  function lgamma(z) { // Lanczos approximation, g = 7 (z >= 1 here)
    var g = 7, k = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    z -= 1; var x = k[0]; for (var i = 1; i < g + 2; i++) x += k[i] / (z + i);
    var t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function betaPdf(p, a, b) { // a, b >= 1 here, so the clamp only avoids 0 * log(0)
    var q = Math.min(1 - 1e-12, Math.max(1e-12, p));
    return Math.exp((a - 1) * Math.log(q) + (b - 1) * Math.log(1 - q) + lgamma(a + b) - lgamma(a) - lgamma(b));
  }
  function calc(v) {
    var a = v.prior_alpha, b = v.prior_beta, s = v.observed_successes, f = v.observed_failures, n = s + f;
    var A = a + s, B = b + f;
    return {a: a, b: b, s: s, f: f, n: n, A: A, B: B, pm: a / (a + b), post: A / (A + B), prop: n ? s / n : null, w: n / (a + b + n)};
  }
  var one = function (x) { return Viz.n(x, 1); };

  Viz.register("bayesian-beta-binomial-updating", {
    title: "Beta-binomial Bayesian updating",
    subject: "stats",
    shows: "Set a Beta prior and add successes and failures: the posterior Beta(α + s, β + f) lands between the prior and the data, weighted by how much of each you have",
    params: {
      prior_alpha: {kind: "number", default: 5, min: 1.5, max: 6, step: 0.5, label: "\\alpha"},
      prior_beta: {kind: "number", default: 5, min: 1.5, max: 6, step: 0.5, label: "\\beta"},
      observed_successes: {kind: "integer", default: 6, min: 0, max: 12, label: "s"},
      observed_failures: {kind: "integer", default: 2, min: 0, max: 12, label: "f"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\alpha'=\\alpha+s=" + one(k.a) + "+" + k.s + "=" + one(k.A) + "\\\\[2pt]\\beta'=\\beta+f=" + one(k.b) + "+" + k.f + "=" + one(k.B) +
        "\\\\[4pt]E[p\\mid\\text{data}]=\\tfrac{\\alpha'}{\\alpha'+\\beta'}=\\tfrac{" + one(k.A) + "}{" + one(k.A + k.B) + "}=" + Viz.n(k.post, 3) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (!k.n) return "No data yet, so the posterior is the prior: Beta(" + Viz.fmt(k.a, 1) + ", " + Viz.fmt(k.b, 1) + ") with mean <b>" + Viz.fmt(k.pm, 2) + "</b>.";
      if (Math.abs(k.prop - k.pm) < 1e-9) return "The data's " + k.s + " of " + k.n + " matches the prior mean, so the mean stays <b>" + Viz.fmt(k.post, 2) +
        "</b> and the posterior only gets narrower.";
      return k.s + " success" + (k.s === 1 ? "" : "es") + " in " + k.n + " move the mean from " + Viz.fmt(k.pm, 2) + " to <b>" + Viz.fmt(k.post, 2) + "</b>: the data get <b>" +
        Viz.fmt(k.w * 100, 0) + "%</b> of the weight, n = " + k.n + " against a prior worth α + β = " + Viz.fmt(k.a + k.b, 1) + " observations.";
    },
    examples: [
      {name: "no data yet", values: {observed_successes: 0, observed_failures: 0}},
      {name: "weak prior, all successes", values: {prior_alpha: 1.5, prior_beta: 1.5, observed_successes: 12, observed_failures: 0}},
      {name: "strong prior, data disagree", values: {prior_alpha: 6, prior_beta: 1.5, observed_successes: 0, observed_failures: 12}},
      {name: "data agree with the prior", values: {prior_alpha: 4, prior_beta: 4, observed_successes: 5, observed_failures: 5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      // the likelihood is only defined up to a constant: draw it rescaled so its peak matches the posterior's
      var c = api.color, k = calc(v), N = 200, pr = [], lk = [], po = [], ymax = 0, lmax = 0, pmax = 0;
      for (var i = 0; i <= N; i++) {
        var p = i / N, d1 = betaPdf(p, k.a, k.b), d2 = betaPdf(p, k.s + 1, k.f + 1), d3 = betaPdf(p, k.A, k.B);
        pr.push([p, d1]); lk.push([p, d2]); po.push([p, d3]); ymax = Math.max(ymax, d1, d3); lmax = Math.max(lmax, d2); pmax = Math.max(pmax, d3);
      }
      lk = lk.map(function (q) { return [q[0], q[1] * pmax / lmax]; });
      var tick = ymax <= 4 ? 1 : ymax <= 9 ? 2 : 4, top = Math.ceil(ymax * 1.12 / tick) * tick;
      var pl = api.plane({x: [0, 1], y: [0, top], box: [44, 32, 336, 172], equal: false, grid: false, axes: false});
      // axes: density on the left, p along the bottom
      for (var t = 0; t <= top + 1e-9; t += tick) {
        api.line([pl.x(0), pl.y(t)], [pl.x(1), pl.y(t)], {color: c.grid, width: 1});
        api.label([pl.x(0) - 7, pl.y(t)], String(t), {color: c.muted, size: 12, anchor: "end"});
      }
      api.line([pl.x(0), pl.y(0)], [pl.x(1) + 6, pl.y(0)], {color: c.axis, width: 1.3});
      [0, 0.25, 0.5, 0.75, 1].forEach(function (x) {
        api.line([pl.x(x), pl.y(0)], [pl.x(x), pl.y(0) + 4], {color: c.axis, width: 1});
        api.label([pl.x(x), pl.y(0) + 15], String(x), {color: c.muted, size: 12, anchor: "middle"});
      });
      api.label([pl.x(1) + 10, pl.y(0)], "p", {color: c.muted, size: 13, italic: true});
      api.label([pl.x(0) + 6, pl.y(top)], "density", {color: c.muted, size: 12});
      // the three curves
      var base = [[pl.x(0), pl.y(0)]].concat(po.map(pl.px), [[pl.x(1), pl.y(0)]]);
      api.polygon(base, {fill: c.c1, fillOpacity: 0.18});
      api.polyline(lk.map(pl.px), {stroke: c.c3, width: 1.8, opacity: k.n ? 0.95 : 0.6});
      api.polyline(pr.map(pl.px), {stroke: c.c2, width: 2, dash: "6 4"});
      api.polyline(po.map(pl.px), {stroke: c.c1, width: 2.6});
      api.line([pl.x(k.post), pl.y(0)], [pl.x(k.post), pl.y(betaPdf(k.post, k.A, k.B))], {color: c.c1, width: 1.3, dash: "2 3"});
      // legend row (three overlapping curves, so a legend earns its place)
      var lx = 44;
      [["prior", c.c2, "6 4"], ["likelihood (scaled)", c.c3, null], ["posterior", c.c1, null]].forEach(function (e) {
        api.line([lx, 14], [lx + 18, 14], {color: e[1], width: e[0] === "posterior" ? 3 : 2, dash: e[2]});
        api.label([lx + 23, 14], e[0], {color: e[1], size: 12, weight: 600});
        lx += 23 + e[0].length * 6.5 + 18;
      });
      // the posterior mean as a weighted average of the prior mean and the data
      var ys = 264, xP = pl.x(k.pm), xPost = pl.x(k.post);
      if (k.n) {
        var xD = pl.x(k.prop), left = xP <= xD;
        api.line([xP, ys], [xD, ys], {color: c.faint, width: 3});
        api.point([xP, ys], {color: c.c2, r: 5});
        api.point([xD, ys], {color: c.c3, r: 5});
        api.label([xP + (left ? -6 : 6), ys + 19], "prior " + api.fmt(k.pm, 2), {color: c.c2, size: 12, anchor: left ? "end" : "start", weight: 600});
        api.label([xD + (left ? 6 : -6), ys + 19], "data " + k.s + "/" + k.n + " = " + api.fmt(k.prop, 2), {color: c.c3, size: 12, anchor: left ? "start" : "end", weight: 600});
      } else {
        api.label([xPost, ys + 19], "no data: flat likelihood, posterior = prior", {color: c.muted, size: 12, anchor: "middle"});
      }
      api.point([xPost, ys], {color: c.c1, r: 6.5});
      var moved = k.n && Math.abs(k.prop - k.pm) > 1e-9;
      api.label([xPost, ys - 17], "posterior mean " + api.fmt(k.post, 3) + (moved ? ", " + api.fmt(k.w * 100, 0) + "% of the way to the data" : ""),
        {color: c.c1, size: 12.5, anchor: "middle", weight: 650});
    }
  });
})();
