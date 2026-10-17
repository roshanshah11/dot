// A forest plot of five studies pooled by inverse-variance weights (fixed effect). Each study's weight is
// w = 1/SE², so its 95% CI is θ ± 1.96/√w: a heavy study has a short line and a big square (side = 30·√share, so
// area ∝ its share; floored at 4 px so a 2% study stays visible).
// The pooled effect is the weighted mean Σwθ/Σw, its SE is 1/√Σw, and the diamond spans its 95% CI.
// Drag a square sideways to move that study's result; the sliders set the weights. CIs past ±1.5 end in arrows.
// Ten queue params: the five weights are sliders, the five effects are dragged on the plot (control: false), which
// keeps the panel to five rows.
(function () {
  var N = 5;
  function calc(v) {
    var th = [], w = [], W = 0, S = 0;
    for (var i = 1; i <= N; i++) { th.push(v["effect" + i]); w.push(v["weight" + i]); W += v["weight" + i]; S += v["weight" + i] * v["effect" + i]; }
    var est = S / W, se = 1 / Math.sqrt(W), big = w.indexOf(Math.max.apply(null, w));
    return {th: th, w: w, W: W, S: S, est: est, se: se, lo: est - 1.96 * se, hi: est + 1.96 * se, big: big};
  }
  var params = {}, E = [-0.35, -0.08, 0.18, 0.42, 0.1], WT = [5, 12, 8, 18, 10];
  for (var i = 0; i < N; i++) {
    params["effect" + (i + 1)] = {kind: "number", default: E[i], min: -0.8, max: 0.8, step: 0.01, label: "\\theta_" + (i + 1), control: false};
  }
  for (var j = 0; j < N; j++) params["weight" + (j + 1)] = {kind: "number", default: WT[j], min: 2, max: 24, step: 0.5, label: "w_" + (j + 1)};
  var f2 = function (x) { return Viz.fmt(x, 2); };

  Viz.register("meta-analysis-forest-weights", {
    title: "Forest plot: how weights pool studies",
    subject: "stats",
    shows: "Change the study weights or drag a result: the pooled effect is the weighted mean, pulled toward the heaviest, most precise studies",
    params: params,
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\hat\\theta=\\dfrac{\\sum w_i\\hat\\theta_i}{\\sum w_i}=\\dfrac{" + Viz.n(k.S, 2) + "}{" + Viz.n(k.W, 1) + "}=" + Viz.n(k.est, 3) +
        "\\\\[6pt]SE=\\dfrac{1}{\\sqrt{" + Viz.n(k.W, 1) + "}}=" + Viz.n(k.se, 3) + "\\\\[4pt]\\text{CI}_{95}=\\hat\\theta\\pm1.96\\,SE=[" + Viz.n(k.lo, 2) + ",\\," + Viz.n(k.hi, 2) + "]\\end{array}";
    },
    status: function (v) {
      var k = calc(v), sh = Viz.fmt(100 * k.w[k.big] / k.W, 0), ci = "[" + f2(k.lo) + ", " + f2(k.hi) + "]";
      var verdict = k.lo > 0 ? "lies above 0: a clear positive pooled effect" : k.hi < 0 ? "lies below 0: a clear negative pooled effect" : "includes 0, so the pooled effect is not clearly different from none";
      if (Math.max.apply(null, k.w) - Math.min.apply(null, k.w) < 1e-9) return "All five weights are equal, so the pooled effect <b>" + f2(k.est) + "</b> is the plain average; the 95% CI " + ci + " " + verdict + ".";
      var top = k.w.map(function (w, i) { return Math.abs(w - k.w[k.big]) < 1e-9 ? i + 1 : 0; }).filter(Boolean);
      if (top.length > 1) return "Studies " + top.slice(0, -1).join(", ") + " and " + top[top.length - 1] + " tie for the most weight (<b>" + sh + "%</b> each), and the pooled effect is <b>" +
        f2(k.est) + "</b>; the 95% CI " + ci + " " + verdict + ".";
      return "Study " + (k.big + 1) + " carries <b>" + sh + "%</b> of the weight, so the pooled effect <b>" + f2(k.est) + "</b> leans toward its " + f2(k.th[k.big]) +
        "; the 95% CI " + ci + " " + verdict + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {effect1: -0.8, effect2: -0.8, effect3: -0.8, effect4: -0.8, effect5: -0.8, weight1: 2, weight2: 2, weight3: 2, weight4: 2, weight5: 2}},
      {name: "Maximum supported values", values: {effect1: 0.8, effect2: 0.8, effect3: 0.8, effect4: 0.8, effect5: 0.8, weight1: 24, weight2: 24, weight3: 24, weight4: 24, weight5: 24}},
      {name: "equal weights: a plain average", values: {weight1: 10, weight2: 10, weight3: 10, weight4: 10, weight5: 10}},
      {name: "one huge study dominates", values: {weight1: 2, weight2: 2, weight3: 2, weight4: 24, weight5: 2}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 70, x1 = 300, lo = -1.5, hi = 1.5;
      var X = function (q) { return x0 + (x1 - x0) * (Math.max(lo, Math.min(hi, q)) - lo) / (hi - lo); };
      var Ry = function (i) { return 48 + i * 40; }, yP = 250, yAx = 278;
      api.label([8, 14], "study", {color: c.muted, size: 12});
      api.label([(x0 + x1) / 2, 14], "effect, 95% CI", {color: c.muted, size: 12, anchor: "middle"});
      api.label([344, 14], "w", {color: c.muted, size: 12, anchor: "end"});
      api.label([392, 14], "share", {color: c.c2, size: 12, anchor: "end", weight: 600});
      api.line([X(0), 26], [X(0), yAx], {color: c.faint, width: 1, dash: "3 4"});
      api.line([X(k.est), 26], [X(k.est), yP], {color: c.c1, width: 1.5, dash: "5 4", opacity: 0.8});
      k.th.forEach(function (t, i) {
        var y = Ry(i), half = 1.96 / Math.sqrt(k.w[i]), a = t - half, b = t + half, share = k.w[i] / k.W;
        var side = Math.max(4, Math.min(26, 30 * Math.sqrt(share)));
        api.label([8, y], "Study " + (i + 1), {color: c.ink, size: 12});
        api.line([X(a), y], [X(b), y], {color: c.ink, width: 1.5, opacity: 0.8});
        if (a < lo) api.line([X(a) + 6, y], [X(a), y], {color: c.ink, width: 1.5, arrow: true});
        if (b > hi) api.line([X(b) - 6, y], [X(b), y], {color: c.ink, width: 1.5, arrow: true});
        // the square is the drag target: the handle sits under it (tiny, so it never inflates a small study's square)
        // and the square lets the pointer through to it
        api.handle([X(t), y], {color: c.c2, r: 1.5, onDrag: function (q) {
          var patch = {}; patch["effect" + (i + 1)] = Math.max(-0.8, Math.min(0.8, Math.round(((q[0] - x0) / (x1 - x0) * (hi - lo) + lo) * 20) / 20));
          api.set(patch);
        }});
        api.rect(X(t) - side / 2, y - side / 2, side, side, {fill: c.c2, fillOpacity: 0.9, rx: 1.5}).setAttribute("pointer-events", "none");
        api.label([344, y], api.fmt(k.w[i], 1), {color: c.muted, size: 12, anchor: "end"});
        api.label([392, y], Viz.fmt(100 * share, 0) + "%", {color: c.c2, size: 12.5, weight: 650, anchor: "end"});
      });
      // pooled diamond
      api.label([8, yP], "pooled", {color: c.c1, size: 12.5, weight: 700});
      api.polygon([[X(k.lo), yP], [X(k.est), yP - 9], [X(k.hi), yP], [X(k.est), yP + 9]], {fill: c.c1, fillOpacity: 0.9});
      api.label([344, yP], api.fmt(k.W, 1), {color: c.muted, size: 12, anchor: "end"});
      api.label([392, yP], f2(k.est), {color: c.c1, size: 12.5, weight: 700, anchor: "end"});
      api.line([x0, yAx], [x1, yAx], {color: c.axis, width: 1.2});
      [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].forEach(function (t) {
        api.line([X(t), yAx], [X(t), yAx + 4], {color: c.axis, width: 1});
        api.label([X(t), yAx + 15], api.fmt(t), {color: c.muted, size: 12, anchor: "middle"});
      });
      api.label([(x0 + x1) / 2, yAx + 44], "drag a square to move a study's result", {color: c.muted, size: 12, anchor: "middle"});
    }
  });
})();
