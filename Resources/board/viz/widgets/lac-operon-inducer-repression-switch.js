// The lac repressor as an inducible switch. LacI (made all the time from lacI) grips the operator and blocks RNA
// polymerase; an inducer (allolactose in the cell, or IPTG in the lab, which the cell cannot break down) binds the
// repressor, changes its shape and makes it let go. Model, kept simple and stated: expression follows a Hill curve in
// the inducer, E = E0 + (1 - E0) I^2 / (K^2 + I^2), with the round values used for IPTG in E. coli: half of full at
// K = 50 µM, Hill coefficient 2 (the repressor binds inducer cooperatively), a leak E0 = 0.1% (repression ~1,000-fold).
// Glucose is taken as absent, so CAP is on and "full" really is full. The classic mutants: lacI⁻ (no repressor) and
// Oᶜ (operator the repressor cannot grip) are always on; lacIˢ (repressor that cannot bind inducer) never turns on.
// IPTG levels are a 1-2-5 ladder (an enum) because the switch lives on a log scale and the sliders are linear.
(function () {
  var K = 50, E0 = 0.001, LEVELS = ["0", "5", "10", "20", "50", "100", "200", "500", "1000"];
  function model(v) {
    var I = Number(v.iptg), h = I * I / (K * K + I * I);
    var E = v.strain === "lacI-" || v.strain === "Oc" ? 1 : v.strain === "lacIs" ? E0 : E0 + (1 - E0) * h;
    return {I: I, h: h, E: E, bound: (E - E0) / (1 - E0) < 0.5};
  }
  function pc(x) { return x > 0.9995 ? "100%" : x >= 0.1 ? Viz.fmt(x * 100, 0) + "%" : x >= 0.01 ? Viz.fmt(x * 100, 1) + "%" : Viz.fmt(x * 100, 2) + "%"; }
  var NAMES = {"wild type": "wild type", "lacI-": "lacI⁻", "lacIs": "lacIˢ", "Oc": "Oᶜ"};

  Viz.register("lac-operon-inducer-repression-switch", {
    title: "lac repressor: the inducer switch",
    subject: "biology",
    shows: "Raise the inducer (IPTG): it binds the lac repressor, which lets go of the operator, and expression climbs a steep S-curve; lacI⁻ and Oᶜ stay on, lacIˢ never turns on",
    params: {
      iptg: {kind: "enum", values: LEVELS, default: "20", label: "I\\ (\\mu\\text{M})"},
      strain: {kind: "enum", values: ["wild type", "lacI-", "lacIs", "Oc"], names: NAMES, default: "wild type", label: "\\text{strain}"}
    },
    formula: function (v) {
      var m = model(v);
      if (v.strain === "lacI-") return "\\begin{array}{l}\\text{no repressor made}\\\\ E=100\\%\\text{ at any }I\\end{array}";
      if (v.strain === "Oc") return "\\begin{array}{l}\\text{repressor cannot grip }\\text{O}^{c}\\\\ E=100\\%\\text{ at any }I\\end{array}";
      if (v.strain === "lacIs") return "\\begin{array}{l}\\text{repressor ignores the inducer}\\\\ E=E_0=0.1\\%\\text{ at any }I\\end{array}";
      return "\\begin{array}{l}E=E_0+(1-E_0)\\,\\frac{I^2}{K^2+I^2}\\\\ \\phantom{E}=0.001+0.999\\cdot\\frac{" + m.I + "^2}{50^2+" + m.I + "^2}=" + pc(m.E).replace("%", "\\%") + "\\end{array}";
    },
    status: function (v) {
      var m = model(v);
      if (v.strain === "lacI-") return "<b>lacI⁻</b>: no repressor is made, so the operator is always open and the genes run at <b>100%</b> with or without inducer.";
      if (v.strain === "Oc") return "<b>Oᶜ</b>: the repressor is there but cannot grip the mutant operator, so the genes run at <b>100%</b>; it acts only on its own DNA (cis).";
      if (v.strain === "lacIs") return "<b>lacIˢ</b>: the repressor cannot bind inducer, so it never lets go of the operator: stuck at <b>0.1%</b> even at " + m.I + " µM IPTG.";
      if (!m.I) return "No inducer: the repressor holds the operator, and only a leak of about <b>0.1%</b> of full gets through.";
      if (Math.abs(m.h - 0.5) < 0.05) return "At " + m.I + " µM IPTG, the curve's K, inducer has pulled the repressor off the operator half the time: <b>" + pc(m.E) + "</b> of full.";
      if (m.bound) return "At " + m.I + " µM IPTG few repressors carry inducer, so the operator is free only " + Math.round(m.h * 100) + "% of the time: <b>" + pc(m.E) + "</b> of full.";
      return "At " + m.I + " µM IPTG most repressors carry inducer and let go, so the operator is free " + Math.round(m.h * 100) + "% of the time: <b>" + pc(m.E) + "</b> of full.";
    },
    examples: [
      {name: "no inducer", values: {iptg: "0", strain: "wild type"}},
      {name: "half on at K", values: {iptg: "50", strain: "wild type"}},
      {name: "fully induced", values: {iptg: "1000", strain: "wild type"}},
      {name: "lacI⁻ without inducer", values: {iptg: "0", strain: "lacI-"}},
      {name: "lacIˢ in excess IPTG", values: {iptg: "1000", strain: "lacIs"}},
      {name: "Oᶜ without inducer", values: {iptg: "0", strain: "Oc"}}
    ],
    size: [400, 310],
    draw: function (api, v) {
      var c = api.color, m = model(v), y = 104, idx = LEVELS.indexOf(v.iptg), oBad = v.strain === "Oc";
      // ---- the operon ----
      api.line([10, y], [392, y], {color: c.muted, width: 3});
      api.rect(22, y - 8, 46, 16, {fill: c.c2, fillOpacity: 0.15, stroke: c.c2, width: 1.2, rx: 3});
      api.rect(68, y - 8, 28, 16, {fill: oBad ? c.c5 : c.c6, fillOpacity: 0.2, stroke: oBad ? c.c5 : c.c6, width: 1.5, rx: 3});
      api.label([45, y + 19], "P", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      api.label([82, y + 19], oBad ? "Oᶜ" : "O", {color: oBad ? c.c5 : c.c6, size: 12.5, weight: 650, anchor: "middle", raw: true});
      [["lacZ", 100, 120], ["lacY", 222, 82], ["lacA", 306, 82]].forEach(function (g) {
        api.rect(g[1], y - 9, g[2] - 4, 18, {fill: c.ink, fillOpacity: 0.08, stroke: c.faint, width: 1.2, rx: 3});
        api.label([g[1] + g[2] / 2 - 2, y], g[0], {color: c.ink, size: 12, anchor: "middle", italic: true});
      });
      // ---- lacI, its own gene, makes the repressor ----
      var broken = v.strain === "lacI-", mutRep = v.strain === "lacIs";
      api.line([12, 18], [94, 18], {color: c.muted, width: 2});
      api.rect(22, 10, 50, 16, {fill: c.c6, fillOpacity: 0.16, stroke: broken ? c.c5 : c.c6, width: 1.3, rx: 3});
      api.label([47, 18], broken ? "lacI⁻" : mutRep ? "lacIˢ" : "lacI", {color: broken ? c.c5 : c.c6, size: 12, anchor: "middle", italic: true, raw: true});
      if (broken) { api.line([26, 8], [68, 28], {color: c.c5, width: 2}); api.line([26, 28], [68, 8], {color: c.c5, width: 2}); }
      api.label([100, 18], broken ? "broken: no repressor" : mutRep ? "repressor blind to inducer" : "repressor gene, always on", {color: broken ? c.c5 : c.muted, size: 12});
      // ---- the inducer pool: more dots per ladder step ----
      var nDots = [0, 1, 2, 3, 5, 7, 9, 12, 15][idx];
      var spots = [[300, 52], [356, 42], [272, 64], [334, 62], [384, 56], [314, 38], [262, 44], [368, 68], [288, 38], [346, 52], [300, 68], [376, 42], [258, 58], [324, 50], [386, 70]];
      for (var d = 0; d < nDots; d++) api.circle(spots[d], 3.5, {fill: c.c3});
      api.label([390, 22], m.I ? "IPTG " + m.I + " µM" : "no IPTG", {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
      // ---- the repressor (a tetramer, drawn as four subunits): on the operator, or lifted off carrying inducer ----
      if (!broken) {
        var onO = !oBad && m.bound, at = onO ? [82, y - 22] : [150, 50], carry = !mutRep && !onO && m.I > 0;
        api.line([47, 27], [at[0] - (onO ? 6 : 22), at[1] - 14], {color: c.c6, width: 1.3, dash: "3 3", arrow: true, opacity: 0.75});
        [[-7, -6], [7, -6], [-7, 6], [7, 6]].forEach(function (o) { api.circle([at[0] + o[0], at[1] + o[1]], 7, {fill: c.c6, fillOpacity: 0.85}); });
        if (carry) [[-12, -12], [12, -12]].forEach(function (o) { api.circle([at[0] + o[0], at[1] + o[1]], 3.5, {fill: c.c3}); });
        var txt = onO ? (mutRep && m.I ? "holds O; inducer can't bind" : "repressor holds O") : oBad ? "can't grip Oᶜ" : "inducer on: lets go of O";
        api.label(onO ? [104, y - 30] : [at[0], at[1] + 24], txt, {color: c.c6, size: 12, raw: true, anchor: onO ? "start" : "middle"});
      }
      // ---- RNA polymerase: shut out, or transcribing; one transcript per quarter of full ----
      var pol = function (x, py, op) { api.path("M " + (x - 14) + " " + py + " a 14 10 0 1 0 28 0 a 14 10 0 1 0 -28 0", {fill: c.c2, fillOpacity: op, stroke: c.c2, width: 1}); };
      var n = Math.round(4 * m.E);
      if (n === 0) {
        pol(45, 148, 0.4);
        api.line([39, 160], [51, 170], {color: c.c5, width: 2}); api.line([51, 160], [39, 170], {color: c.c5, width: 2});
        api.label([64, 150], "RNA polymerase blocked", {color: c.c2, size: 12});
      } else {
        pol(45, y, 0.9);
        var spots2 = [[200], [130, 230], [124, 210, 300], [124, 196, 292, 376]][n - 1];   // between the gene names
        for (var k = 0; k < n; k++) {
          var x = spots2[k], pts = [];
          for (var s = 0; s <= 10 + (x - 116) * 0.12; s += 2) pts.push([x - 4 - s * 0.45 + 1.6 * Math.sin(s / 2.2), y + 10 + s * 0.9]);
          api.polyline(pts, {stroke: c.c1, width: 1.7});
          pol(x, y, 0.9);
        }
        api.label([64, 150], n === 1 ? "an occasional lac mRNA" : "lac mRNA, one per polymerase", {color: c.c1, size: 12});
      }
      // ---- the induction curve: expression against IPTG, log scale with a break to 0 ----
      var X0 = 62, xa = 86, xb = 384, lo = Math.log10(2), hi = 3, yT = 196, yB = 268;
      var xp = function (q) { return q <= 0 ? X0 : xa + (Math.log10(q) - lo) / (hi - lo) * (xb - xa); };
      var yp = function (r) { return yB - r * (yB - yT); };
      var wt = function (q) { return E0 + (1 - E0) * q * q / (K * K + q * q); };
      api.label([X0 - 6, 180], "expression, % of full", {color: c.muted, size: 12});
      api.line([X0 - 6, yB], [xb + 4, yB], {color: c.axis, width: 1.2});
      api.line([X0 - 6, yT - 4], [X0 - 6, yB], {color: c.axis, width: 1.2});
      api.line([71, yB + 4], [75, yB - 4], {color: c.axis, width: 1.2}); api.line([76, yB + 4], [80, yB - 4], {color: c.axis, width: 1.2});
      [[1, "100%"], [0.5, "50%"], [0, "0"]].forEach(function (t) {
        api.label([X0 - 10, yp(t[0])], t[1], {color: c.muted, size: 12, anchor: "end"});
        if (t[0]) api.line([X0 - 6, yp(t[0])], [xb, yp(t[0])], {color: c.grid, width: 1});
      });
      [[0, "0"], [10, "10"], [100, "100"], [1000, "1000"]].forEach(function (t) { api.label([xp(t[0]), yB + 13], t[1], {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([(xa + xb) / 2, yB + 30], "IPTG, µM (log scale)", {color: c.muted, size: 12, anchor: "middle"});
      api.line([xp(K), yT], [xp(K), yB], {color: c.c3, width: 1, dash: "3 3", opacity: 0.7});
      api.label([xp(K) + 5, yB - 10], "K = 50 µM", {color: c.c3, size: 12});
      var curve = [];
      for (var q = 0; q <= 90; q++) { var I = Math.pow(10, lo + (hi - lo) * q / 90); curve.push([xp(I), yp(wt(I))]); }
      if (v.strain === "wild type") {
        api.line([X0, yp(E0)], curve[0], {color: c.c1, width: 2.2, dash: "2 3"});
        api.polyline(curve, {stroke: c.c1, width: 2.4});
      } else {
        api.polyline(curve, {stroke: c.muted, width: 1.4, dash: "4 3", opacity: 0.8});
        api.label([xp(140) + 6, yp(0.62)], "wild type", {color: c.muted, size: 12});
        api.line([X0, yp(m.E)], [xb, yp(m.E)], {color: c.c1, width: 2.4});
      }
      var P = [xp(m.I), yp(m.E)];
      if (m.E < 0.9) api.line([P[0], P[1]], [P[0], yB], {color: c.c3, width: 1.2, dash: "2 3"});
      api.point(P, {color: c.c1, r: 5, label: pc(m.E), dx: m.I >= 500 ? -8 : 8, anchor: m.I >= 500 ? "end" : "start", dy: m.E > 0.5 ? 13 : -12, size: 12.5});
      // viz.css paints svg text ink over the fill attribute; restate each label's color inline
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
