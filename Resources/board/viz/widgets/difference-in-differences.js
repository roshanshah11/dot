// Difference-in-differences. Two groups measured before and after a policy that only the treated group gets. The control
// group's change is the common trend; assuming parallel trends, the treated group would have changed by the same amount
// without the policy (dashed path). The effect is the gap between where the treated group ended up and that dashed path:
// tau = change(treated) - change(control). Queue params kept (names, ranges, defaults); steps of 1.
(function () {
  function calc(v) {
    var Tpre = v.treated_pre_outcome, Cpre = v.control_pre_outcome, g = v.common_change, tau = v.treatment_effect;
    var Cpost = Cpre + g, Tcf = Tpre + g, Tpost = Tcf + tau;
    return {Tpre: Tpre, Cpre: Cpre, Cpost: Cpost, Tcf: Tcf, Tpost: Tpost, dT: Tpost - Tpre, dC: Cpost - Cpre, did: (Tpost - Tpre) - (Cpost - Cpre), g: g, tau: tau};
  }
  var f = function (x) { return Viz.fmt(x, 2); }, sg = function (x) { return (x > 0 ? "+" : "") + Viz.fmt(x, 2); };
  // push labels apart so none sit closer than gap px (items: {y}), keeping their order
  function spread(items, gap) {
    items.sort(function (a, b) { return a.y - b.y; });
    for (var it = 0; it < 20; it++) for (var i = 1; i < items.length; i++) {
      var d = items[i].y - items[i - 1].y;
      if (d < gap) { var push = (gap - d) / 2; items[i].y += push; items[i - 1].y -= push; }
    }
    return items;
  }

  Viz.register("difference-in-differences", {
    title: "Difference-in-differences",
    subject: "stats",
    shows: "Set where each group starts, the trend they share and the policy's effect: the control's change stands in for what the treated group would have done, and the effect is what is left over",
    params: {
      treated_pre_outcome: {kind: "number", default: 60, min: 20, max: 80, step: 1, label: "Y_{T,\\text{pre}}"},
      control_pre_outcome: {kind: "number", default: 40, min: 20, max: 80, step: 1, label: "Y_{C,\\text{pre}}"},
      common_change: {kind: "number", default: 8, min: -15, max: 15, step: 1, label: "\\text{trend}"},
      treatment_effect: {kind: "number", default: 14, min: -20, max: 20, step: 1, label: "\\tau"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\widehat{\\tau}_{DiD}=\\Delta Y_T-\\Delta Y_C\\\\\\phantom{\\widehat{\\tau}_{DiD}}=(" + Viz.n(k.Tpost) + "-" + Viz.p(k.Tpre) + ")-(" + Viz.n(k.Cpost) + "-" + Viz.p(k.Cpre) + ")\\\\" +
        "\\phantom{\\widehat{\\tau}_{DiD}}=" + Viz.n(k.dT) + "-" + Viz.p(k.dC) + "=" + Viz.n(k.did) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), naive = [], gap0 = k.Tpre - k.Cpre;
      var s = k.did === 0 ? "Both groups changed by " + sg(k.dC) + ", so DiD = <b>0</b>: the policy did nothing" :
        "The treated group changed by " + sg(k.dT) + " but would have changed by " + sg(k.dC) + " anyway (the control's trend), so the policy's effect is <b>" + sg(k.did) + "</b>";
      if (gap0 !== 0) naive.push("the after-only gap (" + f(k.Tpost - k.Cpost) + ")");
      if (k.g !== 0) naive.push("the treated group's raw change (" + sg(k.dT) + ")");
      if (naive.length) s += "; " + naive.join(" and ") + (naive.length > 1 ? " would both" : " would") + " get it wrong";
      return s + ".";
    },
    examples: [
      {name: "no effect", values: {treatment_effect: 0}},
      {name: "groups start level", values: {treated_pre_outcome: 50, control_pre_outcome: 50}},
      {name: "a downturn hides a real gain", values: {common_change: -15, treatment_effect: 10}},
      {name: "every input at its minimum", values: {treated_pre_outcome: 20, control_pre_outcome: 20, common_change: -15, treatment_effect: -20}},
      {name: "every input at its maximum", values: {treated_pre_outcome: 80, control_pre_outcome: 80, common_change: 15, treatment_effect: 20}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v), vals = [k.Tpre, k.Cpre, k.Cpost, k.Tcf, k.Tpost];
      var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
      var tick = mx - mn > 60 ? 20 : 10, lo = Math.floor((mn - 6) / tick) * tick, hi = Math.ceil((mx + 6) / tick) * tick;
      var bx = 142, ax = 278, top = 50, base = 256, Y = function (y) { return base - (base - top) * (y - lo) / (hi - lo); };
      for (var t = lo; t <= hi; t += tick) {
        api.line([40, Y(t)], [392, Y(t)], {color: c.grid, width: 1});
        api.label([34, Y(t)], api.fmt(t), {color: c.muted, size: 12, anchor: "end"});
      }
      // legend: what each line means
      api.line([40, 14], [62, 14], {color: c.c3, width: 3}); api.label([68, 14], "treated", {color: c.c3, size: 12});
      api.line([128, 14], [150, 14], {color: c.c3, width: 2, dash: "6 5"}); api.label([156, 14], "treated, had there been no policy", {color: c.c3, size: 12});
      api.line([40, 32], [62, 32], {color: c.c2, width: 3}); api.label([68, 32], "control", {color: c.c2, size: 12});
      // the policy starts between the two measurements
      api.line([(bx + ax) / 2, top - 4], [(bx + ax) / 2, base], {color: c.faint, width: 1.2, dash: "3 5"});
      api.label([(bx + ax) / 2, 32], "policy starts", {color: c.muted, size: 12, anchor: "middle"});
      api.label([bx, base + 16], "before", {color: c.muted, size: 12.5, anchor: "middle"});
      api.label([ax, base + 16], "after", {color: c.muted, size: 12.5, anchor: "middle"});
      // control, the treated group's no-policy path (parallel to control), and what actually happened
      api.line([bx, Y(k.Cpre)], [ax, Y(k.Cpost)], {color: c.c2, width: 3});
      api.line([bx, Y(k.Tpre)], [ax, Y(k.Tcf)], {color: c.c3, width: 2, dash: "6 5", opacity: 0.8});
      api.line([bx, Y(k.Tpre)], [ax, Y(k.Tpost)], {color: c.c3, width: 3});
      api.circle([ax, Y(k.Tcf)], 5, {fill: c.card, stroke: c.c3, width: 2});
      [[bx, k.Cpre, c.c2], [ax, k.Cpost, c.c2], [bx, k.Tpre, c.c3], [ax, k.Tpost, c.c3]].forEach(function (p) { api.circle([p[0], Y(p[1])], 5.5, {fill: p[2]}); });
      // labels: left of the before points, right of the after points, spread so they never collide
      spread([{y: Y(k.Tpre), t: "treated " + f(k.Tpre), col: c.c3}, {y: Y(k.Cpre), t: "control " + f(k.Cpre), col: c.c2}], 15)
        .forEach(function (L) { api.label([bx - 10, L.y], L.t, {color: L.col, size: 12.5, weight: 650, anchor: "end"}); });
      // a value shared by two points is labeled once
      var right = [{y: Y(k.Tpost), t: f(k.Tpost), col: c.c3, w: 650}];
      if (k.Cpost !== k.Tpost) right.push({y: Y(k.Cpost), t: f(k.Cpost), col: c.c2, w: 650});
      if (k.tau !== 0 && k.Tcf !== k.Cpost) right.push({y: Y(k.Tcf), t: f(k.Tcf), col: c.c3, w: 500});
      spread(right, 15).forEach(function (L) { api.label([ax + 10, L.y], L.t, {color: L.col, size: 12.5, weight: L.w}); });
      // the effect: from the no-policy point to the actual point
      var ex = 332;
      if (k.tau !== 0) {
        api.line([ax + 40, Y(k.Tcf)], [ex, Y(k.Tcf)], {color: c.c4, width: 1.2, dash: "2 3"});
        api.line([ax + 40, Y(k.Tpost)], [ex, Y(k.Tpost)], {color: c.c4, width: 1.2, dash: "2 3"});
        api.line([ex, Y(k.Tcf)], [ex, Y(k.Tpost)], {color: c.c4, width: 2.5, arrow: Math.abs(Y(k.Tpost) - Y(k.Tcf)) > 10});
        api.label([ex + 8, (Y(k.Tcf) + Y(k.Tpost)) / 2], "τ = " + sg(k.tau), {color: c.c4, size: 13, weight: 650});
      } else {
        api.label([ex + 8, Y(k.Tpost)], "τ = 0", {color: c.c4, size: 13, weight: 650});
      }
    }
  });
})();
