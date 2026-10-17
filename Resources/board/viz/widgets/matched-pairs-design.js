// A matched pairs experiment on six pairs: does caffeine raise a memory-test score? Two designs.
// Separate units: two different people matched on ability; a coin decides which of them gets caffeine (T) and
// which gets the placebo (C). Self-paired: each person is tested twice, caffeine one day and placebo the other,
// with a coin deciding the order (the second sitting carries a +1.5 practice bonus, which the random order balances).
// Top: each pair's two scores (blue C, amber T) on the score axis; the people differ by 40 points, the
// within-pair differences far less. Bottom: 95% confidence intervals for the mean difference. Paired: d̄ ± t(0.975, 5)
// · s_d/√6 = d̄ ± 2.571 · SE, so the interval misses 0 exactly when |t| > 2.571 (the status's test). Unpaired: the same
// scores as two groups of 6, SE_U = √(s_T²/6 + s_C²/6) (equal n, so this is the pooled SE) on 2n − 2 = 10 df, t = 2.228;
// it carries all the between-person spread. A bar that runs off the axis ends in an arrowhead. Scores come from fixed
// abilities, matching offsets and noise (no randomness), plus the true effect you set.
// Dot's design: the queue gives only design_variant; the effect slider is added so the picture can move.
(function () {
  var ABIL = [58, 74, 46, 66, 82, 52];             // pair (or person) ability, points
  var OFF_T = [1, -0.5, 1.5, -1.5, 0.5, -1];      // separate units: treated member's offset from the pair's ability
  var OFF_C = [-1, 1, -1, 1.5, -1, 0.5];          // ... and the control member's
  var E_T = [0.8, -1.2, 0.5, 1.0, -0.6, -0.4], E_C = [-0.7, 0.9, -1.1, 0.3, 1.2, -1.1];   // test-day noise
  var T_FIRST = [true, false, false, true, false, true];   // coin: which member is treated / which sitting comes first
  var PRACTICE = 1.5, TCRIT = 2.571, TCRIT_U = 2.228;       // t(0.975) on 5 df (paired) and 10 df (two groups of 6)
  function sd(a) { var m = a.reduce(function (s, x) { return s + x; }, 0) / a.length; return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1)); }
  function calc(v) {
    var self = v.design_variant === "self-paired", yT = [], yC = [];
    for (var i = 0; i < 6; i++) {
      if (self) {
        yT.push(ABIL[i] + v.effect + E_T[i] + (T_FIRST[i] ? 0 : PRACTICE));
        yC.push(ABIL[i] + E_C[i] + (T_FIRST[i] ? PRACTICE : 0));
      } else {
        yT.push(ABIL[i] + OFF_T[i] + v.effect + E_T[i]);
        yC.push(ABIL[i] + OFF_C[i] + E_C[i]);
      }
    }
    var d = yT.map(function (t, i) { return t - yC[i]; }), dbar = d.reduce(function (s, x) { return s + x; }, 0) / 6;
    var sdd = sd(d), se = sdd / Math.sqrt(6), seU = Math.sqrt(Math.pow(sd(yT), 2) / 6 + Math.pow(sd(yC), 2) / 6);
    return {self: self, yT: yT, yC: yC, d: d, dbar: dbar, sd: sdd, se: se, t: dbar / se, seU: seU, tU: dbar / seU};
  }
  function sg(x) { return Math.abs(x) < 0.05 ? "0.0" : (x > 0 ? "+" : "−") + Math.abs(x).toFixed(1); }   // fixed 1 decimal so the column lines up

  Viz.register("matched-pairs-design", {
    title: "Matched pairs design",
    subject: "stats",
    shows: "Pair similar units (or use each unit twice) and analyse the differences: between-unit spread drops out of the comparison",
    params: {
      design_variant: {kind: "enum", values: ["separate-units", "self-paired"], default: "separate-units", label: "design",
        names: {"separate-units": "separate units", "self-paired": "self-paired"}},
      effect: {kind: "number", default: 4, min: -5, max: 10, step: 0.5, label: "\\text{effect}"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\bar d=\\tfrac{1}{n}\\sum_i\\,(y_{T,i}-y_{C,i})=" + Viz.n(k.dbar, 2) +
        "\\\\[4pt]t=\\dfrac{\\bar d}{s_d/\\sqrt{n}}=\\dfrac{" + Viz.n(k.dbar, 2) + "}{" + Viz.n(k.sd, 2) + "/\\sqrt{6}}=" + Viz.n(k.t, 2) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), sig = Math.abs(k.t) > TCRIT;
      return (k.self ? "Each person is their own control, so only day-to-day noise is left" : "Matching on ability leaves each pair a few points apart") +
        " (s_d = " + Viz.fmt(k.sd) + "): paired t = <b>" + Viz.fmt(k.t) + "</b>" + (sig ? ", past the ±2.57 cutoff" : ", inside ±2.57, so no clear effect") +
        "; as two unrelated groups the same scores give t = <b>" + Viz.fmt(k.tU) + "</b> (cutoff ±2.23).";
    },
    examples: [
      {name: "self-paired", values: {design_variant: "self-paired"}},
      {name: "no true effect", values: {effect: 0}},
      {name: "effect at its minimum", values: {effect: -5}},
      {name: "effect at its maximum, self-paired", values: {effect: 10, design_variant: "self-paired"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), ax0 = 104, ax1 = 330, yAx = 168;
      var S = function (s) { return ax0 + (ax1 - ax0) * (s - 40) / 60; };
      var R = function (i) { return 36 + i * 22; };
      api.label([8, 14], k.self ? "same person" : "matched pair", {color: c.muted, size: 12});
      api.label([ax0, 14], "control", {color: c.c2, size: 12, weight: 650});
      api.label([ax0 + 56, 14], "treatment", {color: c.c3, size: 12, weight: 650});
      api.label([392, 14], "d = T − C", {color: c.c1, size: 12, weight: 650, anchor: "end"});
      for (var i = 0; i < 6; i++) {
        var y = R(i), tc = k.yT[i], cc = k.yC[i];
        api.label([10, y], String(i + 1), {color: c.muted, size: 12});
        if (k.self) {
          api.circle([34, y], 6.5, {fill: c.ink, fillOpacity: 0.85});
          api.label([46, y], T_FIRST[i] ? "T, then C" : "C, then T", {color: c.muted, size: 12});
        } else {
          api.line([34, y], [56, y], {color: c.faint, width: 1.5});
          api.circle([34, y], 6.5, {fill: T_FIRST[i] ? c.c3 : c.c2});
          api.circle([56, y], 6.5, {fill: T_FIRST[i] ? c.c2 : c.c3});
        }
        api.line([S(cc), y], [S(tc), y], {color: c.faint, width: 2.5});
        api.circle([S(cc), y], 5, {fill: c.c2});
        api.circle([S(tc), y], 5, {fill: c.c3});
        api.label([392, y], sg(k.d[i]), {color: c.c1, size: 12.5, weight: 600, anchor: "end"});
      }
      api.line([ax0, yAx], [ax1, yAx], {color: c.axis, width: 1.2});
      [40, 60, 80, 100].forEach(function (t) {
        api.line([S(t), yAx], [S(t), yAx + 4], {color: c.axis, width: 1});
        api.label([S(t), yAx + 14], String(t), {color: c.muted, size: 12, anchor: "middle"});
      });
      api.label([ax1 + 8, yAx], "score", {color: c.muted, size: 12});
      // bottom: 95% CIs for the mean difference on the difference scale (−25..35); a bar past the end gets a head
      var b0 = 112, b1 = 388, yB = 270, LO = -25, HI = 35, D = function (x) { return b0 + (b1 - b0) * (Math.max(LO, Math.min(HI, x)) - LO) / (HI - LO); };
      api.line([b0, yB], [b1, yB], {color: c.axis, width: 1.2});
      [-20, -10, 0, 10, 20, 30].forEach(function (t) {
        api.line([D(t), yB], [D(t), yB + 4], {color: c.axis, width: 1});
        api.label([D(t), yB + 14], api.fmt(t), {color: c.muted, size: 12, anchor: "middle"});
      });
      api.line([D(0), 202], [D(0), yB], {color: c.faint, width: 1, dash: "3 4"});
      api.label([D(0) + 4, 199], "no effect", {color: c.muted, size: 12});
      var rows = [[216, "unpaired 95% CI", c.muted, TCRIT_U * k.seU, "5 4", 2], [236, "paired 95% CI", c.c1, TCRIT * k.se, null, 4]];
      rows.forEach(function (r) {
        var lo = k.dbar - r[3], hi = k.dbar + r[3];
        api.label([8, r[0]], r[1], {color: r[2], size: 12, weight: 600});
        api.line([D(lo), r[0]], [D(hi), r[0]], {color: r[2], width: r[5], dash: r[4], arrow: hi > HI, arrowStart: lo < LO});
        if (lo >= LO) api.line([D(lo), r[0] - 4], [D(lo), r[0] + 4], {color: r[2], width: 1.5});
        if (hi <= HI) api.line([D(hi), r[0] - 4], [D(hi), r[0] + 4], {color: r[2], width: 1.5});
        api.line([D(k.dbar), r[0] - 6], [D(k.dbar), r[0] + 6], {color: r[2], width: 2.5});
      });
      api.label([8, 256], "differences", {color: c.c1, size: 12, weight: 600});
      k.d.forEach(function (d, j) { api.circle([D(d), 256 - (j % 2) * 5 + 2], 4.2, {fill: c.c1, fillOpacity: 0.85}); });
      api.label([b1, 199], "mean d̄ = " + api.fmt(k.dbar), {color: c.c1, size: 12, anchor: "end", weight: 650});
    }
  });
})();
