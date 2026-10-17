// The binomial distribution: n independent trials, each a success with probability p. One bar per count k = 0..n with
// height C(n, k) p^k (1 − p)^(n − k); the bars always sum to 1. The amber bar is the count picked with the handle
// (drag it sideways), and its probability is worked out in the formula. Under the axis: the mean np and a bracket of
// one standard deviation sqrt(np(1 − p)) either side. The y axis rescales so a flat distribution still reads.
(function () {
  function choose(n, k) { var r = 1; for (var i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }
  function pmf(n, k, p) { return choose(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k); }   // Math.pow(0, 0) = 1
  function calc(v) {
    var n = v.trials, p = v.successPercent / 100, k = Math.min(v.k, n), probs = [], best = 0;
    for (var j = 0; j <= n; j++) { probs.push(pmf(n, j, p)); best = Math.max(best, probs[j]); }
    var modes = []; probs.forEach(function (q, j) { if (q > best * (1 - 1e-9)) modes.push(j); });
    return {n: n, p: p, k: k, probs: probs, best: best, modes: modes, mu: n * p, sd: Math.sqrt(n * p * (1 - p))};
  }
  function pr(x, tex) { // probabilities: 4 decimals, 2 significant figures when small, powers of ten when tiny
    if (x === 0 || x >= 0.01) return Viz.fmt(x, 4);
    if (x >= 1e-4) return String(Number(x.toPrecision(2)));
    var e = x.toExponential(1).split("e"), sup = {"-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹"};
    return tex ? e[0] + "\\times10^{" + Number(e[1]) + "}" : e[0] + "×10" + String(Number(e[1])).split("").map(function (ch) { return sup[ch]; }).join("");
  }

  Viz.register("binomial-distribution", {
    title: "Binomial distribution",
    subject: "stats",
    shows: "Set the number of trials and the success chance: the bars are the probability of each number of successes, centred on np",
    params: {
      trials: {kind: "integer", default: 6, min: 1, max: 10, label: "n"},
      successPercent: {kind: "number", default: 50, min: 0, max: 100, step: 1, label: "p\\ (\\%)"},
      k: {kind: "integer", default: 3, min: 0, max: 10, label: "k", control: false}
    },
    formula: function (v) {
      var c = calc(v), p = Viz.n(c.p, 3), q = Viz.n(1 - c.p, 3), tex = pr(c.probs[c.k], true);
      return "\\begin{array}{l}P(X=" + c.k + ")=\\binom{" + c.n + "}{" + c.k + "}" + p + "^{" + c.k + "}\\cdot " + q + "^{" + (c.n - c.k) + "}=" + tex +
        "\\\\[6pt]\\mu=np=" + Viz.n(c.mu, 2) + "\\\\[4pt]\\sigma=\\sqrt{np(1-p)}=" + Viz.n(c.sd, 2) + "\\end{array}";
    },
    status: function (v) {
      var c = calc(v);
      if (c.p === 0) return "With p = 0 every trial fails, so X = 0 is <b>certain</b> and every other count has probability 0.";
      if (c.p === 1) return "With p = 100% every trial succeeds, so X = " + c.n + " is <b>certain</b>.";
      var mode = c.modes.length > 1 ? "<b>" + c.modes.join("</b> and <b>") + "</b> tie as the most likely counts" : "the most likely count is <b>" + c.modes[0] + "</b>";
      return "Exactly " + c.k + " success" + (c.k === 1 ? "" : "es") + " in " + c.n + " has probability <b>" + pr(c.probs[c.k]) + "</b>; " + mode + ", and on average you get np = " + Viz.fmt(c.mu, 2) + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {trials: 1, successPercent: 0}},
      {name: "Maximum supported values", values: {trials: 10, successPercent: 100}},
      {name: "skewed: 10 trials at 20%", values: {trials: 10, successPercent: 20, k: 2}},
      {name: "two modes: 5 trials at 50%", values: {trials: 5, successPercent: 50, k: 2}}
    ],
    size: [390, 280],
    draw: function (api, v) {
      var c = api.color, b = calc(v), n = b.n;
      var top = [0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1].filter(function (t) { return t >= b.best * 1.08 || t === 1; })[0];
      var tk = top <= 0.4 ? 0.1 : 0.2;
      var pl = api.plane({x: [-0.6, n + 0.6], y: [0, top], box: [52, 36, 322, 170], equal: false, grid: false, axes: false});
      for (var t = 0; t <= top + 1e-9; t += tk) {
        api.line([pl.x(-0.6), pl.y(t)], [pl.x(n + 0.6), pl.y(t)], {color: c.grid, width: 1});
        api.label([pl.x(-0.6) - 7, pl.y(t)], api.fmt(t, 1), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([pl.x(-0.6), 14], "P(X = k)", {color: c.muted, size: 12, anchor: "start"});
      var bw = Math.min(30, pl.sx * 0.72), y0 = pl.y(0);
      b.probs.forEach(function (q, j) {
        var on = j === b.k, h = y0 - pl.y(q);
        api.rect(pl.x(j) - bw / 2, y0 - h, bw, h, {fill: on ? c.c3 : c.c1, fillOpacity: on ? 0.95 : 0.6, rx: 2});
        api.label([pl.x(j), y0 + 14], String(j), {color: on ? c.c3 : c.muted, size: 12, anchor: "middle", weight: on ? 700 : 500});
      });
      api.line([pl.x(-0.6), y0], [pl.x(n + 0.6) + 4, y0], {color: c.axis, width: 1.3});
      api.label([pl.x(n + 0.6) + 2, y0 + 14], "k", {color: c.muted, size: 12.5, italic: true, anchor: "start"});
      // mean and one standard deviation either side
      var ym = y0 + 32, xm = pl.x(b.mu);
      if (b.sd > 1e-9) {
        api.line([pl.x(b.mu - b.sd), ym], [pl.x(b.mu + b.sd), ym], {color: c.c2, width: 2.5});
        [b.mu - b.sd, b.mu + b.sd].forEach(function (x) { api.line([pl.x(x), ym - 5], [pl.x(x), ym + 5], {color: c.c2, width: 2}); });
      }
      api.polygon([[xm, ym - 3], [xm - 6, ym - 12], [xm + 6, ym - 12]], {fill: c.c2, fillOpacity: 1});
      api.label([xm, ym + 17], "μ = np = " + api.fmt(b.mu, 2) + (b.sd > 1e-9 ? ",  bracket = μ ± σ (σ = " + api.fmt(b.sd, 2) + ")" : ",  σ = 0"),
        {color: c.c2, size: 12, weight: 600, anchor: "middle"});
      // the picked count: its probability and a handle to move it
      var hk = pl.y(b.probs[b.k]);
      api.label([pl.x(b.k), hk - 22], pr(b.probs[b.k]), {color: c.c3, size: 13, weight: 700, anchor: "middle"});
      api.handle([pl.x(b.k), hk - 6], {color: c.c3, r: 6, onDrag: function (q) {
        var j = Math.round(pl.invert(q)[0]); api.set({k: Math.max(0, Math.min(n, j))});
      }});
    }
  });
})();
