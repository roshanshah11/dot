// Pooling six studies of one effect (a standardized mean difference d): fixed effect vs random effects.
// Each study has a fixed standard error (big trials small SE); its result is 0.30 + spread × its own deviation, so
// the spread slider sets how much the studies disagree. Fixed effect weights by 1/SE² and assumes one true effect;
// random effects adds the between-study variance τ² (DerSimonian–Laird: τ² = max(0, (Q − df)/C)) to every study's
// variance, which evens out the weights, moves the estimate toward the small studies and widens its interval.
// Squares are sized by each study's weight in the selected model (side ∝ √weight, so area ∝ weight, as in a forest
// plot); the dashed diamond is the other model. I² = (Q − df)/Q is the share of the observed spread that chance cannot
// explain. Q > df only says τ² > 0; "beyond chance" needs Q past the χ²₅ 95% point 11.07, so the status reports Q and
// its p-value. For odd df the χ² tail is closed form: P(χ²₅ > q) = 2(1 − Φ(√q)) + √(2/π)·e^(−q/2)·(√q + q^(3/2)/3).
// Dot's design: the queue gives no parameters; spread and the model are the two things that drive the idea.
(function () {
  var SE = [0.30, 0.12, 0.21, 0.08, 0.26, 0.15], DEV = [0.55, -0.18, 0.38, -0.06, -0.45, 0.22], MU = 0.3;
  function pool(th, w) {
    var W = w.reduce(function (s, x) { return s + x; }, 0), est = th.reduce(function (s, t, i) { return s + w[i] * t; }, 0) / W;
    return {W: W, est: est, se: 1 / Math.sqrt(W), pct: w.map(function (x) { return x / W; })};
  }
  function calc(v) {
    var th = DEV.map(function (d) { return MU + v.spread * d; });
    var w = SE.map(function (s) { return 1 / (s * s); }), fe = pool(th, w);
    var Q = th.reduce(function (s, t, i) { return s + w[i] * Math.pow(t - fe.est, 2); }, 0), df = th.length - 1;
    var C = fe.W - w.reduce(function (s, x) { return s + x * x; }, 0) / fe.W;
    var tau2 = Math.max(0, (Q - df) / C), I2 = Q > df ? (Q - df) / Q : 0;
    var re = pool(th, SE.map(function (s) { return 1 / (s * s + tau2); }));
    return {th: th, fe: fe, re: re, Q: Q, p: pChi5(Q), tau2: tau2, I2: I2, sel: v.model === "random" ? re : fe};
  }
  var fx = function (x, d) { return x.toFixed(d).replace(/^-/, "−"); }, f2 = function (x) { return fx(x, 2); }, Q95 = 11.07;   // χ²(0.95, df 5)
  function erfc(x) {   // Abramowitz–Stegun 7.1.26, |error| < 1.5e-7, x ≥ 0
    var t = 1 / (1 + 0.3275911 * x);
    return t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  }
  function pChi5(q) { var z = Math.sqrt(q); return q <= 0 ? 1 : erfc(z / Math.SQRT2) + Math.sqrt(2 / Math.PI) * Math.exp(-q / 2) * (z + z * z * z / 3); }
  function pTxt(p) { return p < 0.001 ? "p < 0.001" : "p = " + fx(p, p < 0.01 ? 3 : 2); }

  Viz.register("meta-analysis", {
    title: "Meta-analysis: fixed vs random effects",
    subject: "stats",
    shows: "Spread the six study results apart: heterogeneity (I², τ²) grows, and random effects evens out the weights and widens the pooled interval",
    params: {
      spread: {kind: "number", default: 1, min: 0, max: 2, step: 0.1, label: "\\text{spread}"},
      model: {kind: "enum", values: ["fixed", "random"], default: "fixed", label: "\\text{model}"}
    },
    formula: function (v) {
      var k = calc(v);
      if (v.model === "random") return "\\begin{array}{l}\\hat\\theta_{RE}=\\dfrac{\\sum w_i^*\\hat\\theta_i}{\\sum w_i^*},\\ w_i^*=\\dfrac{1}{SE_i^2+\\tau^2}\\\\[6pt]\\tau^2=" +
        Viz.n(k.tau2, 3) + ",\\ SE=1/\\sqrt{\\textstyle\\sum w_i^*}=" + Viz.n(k.re.se, 3) + "\\\\[4pt]\\hat\\theta_{RE}=" + Viz.n(k.re.est, 3) + "\\pm1.96\\cdot" + Viz.n(k.re.se, 3) + "\\end{array}";
      return "\\begin{array}{l}\\hat\\theta_{FE}=\\dfrac{\\sum w_i\\hat\\theta_i}{\\sum w_i},\\ w_i=\\dfrac{1}{SE_i^2}\\\\[6pt]SE=1/\\sqrt{\\textstyle\\sum w_i}=" + Viz.n(k.fe.se, 3) +
        "\\\\[4pt]\\hat\\theta_{FE}=" + Viz.n(k.fe.est, 3) + "\\pm1.96\\cdot" + Viz.n(k.fe.se, 3) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), hFE = f2(1.96 * k.fe.se), hRE = f2(1.96 * k.re.se);
      var q = "Q = " + fx(k.Q, 1) + " on 5 df, " + pTxt(k.p);
      if (k.tau2 < 1e-12) return "The results differ no more than chance predicts (" + q + ", I² = 0%), so τ² = 0 and both models give <b>" + f2(k.fe.est) + " ± " + hFE + "</b>.";
      var big = SE.indexOf(Math.min.apply(null, SE)), fall = "study " + (big + 1) + " falls from " + Viz.fmt(100 * k.fe.pct[big], 0) + "% to <b>" + Viz.fmt(100 * k.re.pct[big], 0) + "%</b>";
      if (k.Q < Q95) {
        if (k.re.se < 1.1 * k.fe.se) return "A little more spread than chance predicts (" + q + "), so τ² = " + fx(k.tau2, 3) + " is small and the two models nearly agree: fixed <b>±" + hFE + "</b>, random <b>±" + hRE + "</b>.";
        return "More spread than expected, but not beyond chance (" + q + "); random effects still adds the estimated τ² = " + fx(k.tau2, 3) +
          (v.model === "fixed" ? ", which would widen the interval from ±" + hFE + " to <b>±" + hRE + "</b>." : ": " + fall + " and the interval widens to <b>±" + hRE + "</b>.");
      }
      if (v.model === "fixed") return "I² = <b>" + Viz.fmt(100 * k.I2, 0) + "%</b>: the studies disagree beyond chance (" + q + "), so the fixed-effect interval (±" + hFE +
        ") is too narrow; random effects widens it to <b>±" + hRE + "</b>.";
      return "Beyond chance (" + q + "): adding τ² = " + fx(k.tau2, 3) + " to every study's variance evens the weights (" + fall + ") and widens the interval to <b>±" + hRE + "</b>.";
    },
    examples: [
      {name: "random effects", values: {model: "random"}},
      {name: "studies agree", values: {spread: 0, model: "random"}},
      {name: "a little extra spread, not beyond chance", values: {spread: 0.6}},
      {name: "more spread, still not beyond chance", values: {spread: 0.8, model: "random"}},
      {name: "studies disagree a lot", values: {spread: 2, model: "random"}},
      {name: "large spread, fixed effect", values: {spread: 2, model: "fixed"}}
    ],
    size: [400, 296],
    draw: function (api, v) {
      var c = api.color, k = calc(v), rnd = v.model === "random", col = rnd ? c.c3 : c.c2, oth = rnd ? c.c2 : c.c3;
      var x0 = 80, x1 = 330, lo = -1, hi = 2, X = function (q) { return x0 + (x1 - x0) * (Math.max(lo, Math.min(hi, q)) - lo) / (hi - lo); };
      var Ry = function (i) { return 38 + i * 23; }, yAx = 222;
      api.label([8, 14], "study", {color: c.muted, size: 12});
      api.label([(x0 + x1) / 2, 14], "effect size d, 95% CI", {color: c.muted, size: 12, anchor: "middle"});
      api.label([392, 14], "weight", {color: col, size: 12, anchor: "end", weight: 600});
      api.line([X(0), 26], [X(0), yAx], {color: c.faint, width: 1, dash: "3 4"});
      k.th.forEach(function (t, i) {
        var y = Ry(i), a = t - 1.96 * SE[i], b = t + 1.96 * SE[i], wp = k.sel.pct[i], side = Math.min(21, 28 * Math.sqrt(wp));
        api.label([8, y], "Study " + (i + 1), {color: c.ink, size: 12});
        api.line([X(a), y], [X(b), y], {color: c.ink, width: 1.4, opacity: 0.8});
        if (a < lo) api.line([X(a) + 6, y], [X(a), y], {color: c.ink, width: 1.4, arrow: true});
        if (b > hi) api.line([X(b) - 6, y], [X(b), y], {color: c.ink, width: 1.4, arrow: true});
        api.rect(X(t) - side / 2, y - side / 2, side, side, {fill: col, fillOpacity: 0.9, rx: 1.5});
        api.label([392, y], Viz.fmt(100 * wp, 0) + "%", {color: col, size: 12.5, weight: 600, anchor: "end"});
      });
      // pooled diamonds: the selected model solid, the other dashed
      var dia = function (p, y, colr, solid) {
        var a = p.est - 1.96 * p.se, b = p.est + 1.96 * p.se;
        api.polygon([[X(a), y], [X(p.est), y - 8], [X(b), y], [X(p.est), y + 8]], solid ? {fill: colr, fillOpacity: 0.9} : {fill: "none", stroke: colr, dash: "3 3", width: 1.5});
      };
      [["fixed", k.fe, 182], ["random", k.re, 204]].forEach(function (r) {
        var on = (r[0] === "random") === rnd, colr = r[0] === "random" ? c.c3 : c.c2;
        api.label([8, r[2]], r[0] === "random" ? "random effects" : "fixed effect", {color: colr, size: 12, weight: on ? 700 : 500});
        dia(r[1], r[2], colr, on);
        api.label([392, r[2]], f2(r[1].est) + " ± " + f2(1.96 * r[1].se), {color: colr, size: 12, weight: on ? 700 : 500, anchor: "end"});
      });
      api.line([x0, yAx], [x1, yAx], {color: c.axis, width: 1.2});
      [-1, -0.5, 0, 0.5, 1, 1.5, 2].forEach(function (t) {
        api.line([X(t), yAx], [X(t), yAx + 4], {color: c.axis, width: 1});
        if (t === Math.round(t)) api.label([X(t), yAx + 15], api.fmt(t), {color: c.muted, size: 12, anchor: "middle"});
      });
      // heterogeneity meter
      var mx0 = 120, mx1 = 330, my = 258;
      api.label([8, my], "heterogeneity I²", {color: c.c6, size: 12, weight: 600});
      api.rect(mx0, my - 6, mx1 - mx0, 12, {fill: c.ink, fillOpacity: 0.08, rx: 6});
      if (k.I2 > 0) api.rect(mx0, my - 6, (mx1 - mx0) * k.I2, 12, {fill: c.c6, fillOpacity: 0.85, rx: 6});
      api.label([392, my], Viz.fmt(100 * k.I2, 0) + "%", {color: c.c6, size: 12, weight: 600, anchor: "end"});
      api.label([8, 281], "Q = " + fx(k.Q, 2) + " on 5 df (beyond chance past " + Q95 + "), " + pTxt(k.p) + ", τ² = " + fx(k.tau2, 3),
        {color: k.Q >= Q95 ? c.c6 : c.muted, size: 12, weight: 600});
    }
  });
})();
