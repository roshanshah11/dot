// Specificity and neutralization. An antibody binds only an epitope whose shape matches its binding site (paratope);
// the fraction of spikes it covers follows the binding isotherm theta = [Ab] / ([Ab] + K_D) (antibody in excess,
// one site per epitope, spikes bound independently). One free spike is enough for a virion to dock, so a virion is
// neutralized only when all 10 of its spikes are covered, which happens with probability theta^10. The cartoon shows
// the virion neutralized only when theta^10 >= 0.9 (most virions); otherwise it shows one that keeps a free spike.
(function () {
  var KD = {"matched": 0.5, "weak fit": 40, "wrong shape": Infinity};
  var NS = 10, ORDER = [5, 4, 6, 3, 7, 2, 8, 1, 9, 0];   // the bottom spike (k = 0) is covered last
  var FLOAT = [[30, 52], [82, 40], [170, 44], [222, 58], [26, 122], [224, 128], [36, 192], [216, 198]];
  function th(kd, c) { return isFinite(kd) ? c / (c + kd) : 0; }
  function theta(v) { return th(KD[v.ab], v.conc); }
  function tfmt(t) { return Viz.fmt(t, t >= 0.95 && t < 1 ? 3 : 2); }   // 3 decimals where theta^10 is sensitive
  function pct(P) { return P < 0.01 ? "under 1%" : "about " + Math.round(P * 100) + "%"; }
  function rot(p, deg) { var a = deg * Math.PI / 180; return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)]; }

  Viz.register("antibody-specificity-and-antigen-neutralization", {
    title: "Antibody specificity and neutralization",
    subject: "biology",
    shows: "Pick an antibody and add more of it: only one whose binding site fits the spike's epitope binds, and a virus is neutralized only when every one of its spikes is covered",
    params: {
      ab: {kind: "enum", values: ["matched", "weak fit", "wrong shape"], default: "matched", label: "antibody"},
      conc: {kind: "number", default: 10, min: 0, max: 100, step: 1, label: "[\\text{Ab}]"}
    },
    formula: function (v) {
      if (!isFinite(KD[v.ab])) return "\\text{no fit: }\\theta\\approx0\\ \\text{at any }[\\text{Ab}]";
      var t = theta(v);
      return "\\theta=\\frac{[\\text{Ab}]}{[\\text{Ab}]+K_D}=\\frac{" + v.conc + "}{" + v.conc + "+" + KD[v.ab] + "}=\\nobreak " + tfmt(t) +
        "\\newline P(\\text{all 10 covered})=\\theta^{10}=\\nobreak " + Viz.n(Math.pow(t, NS), 2);
    },
    status: function (v) {
      var t = theta(v), P = Math.pow(t, NS), kd = KD[v.ab];
      // the framework's status sanitizer keeps only <b>, so the dissociation constant is written Kd here
      if (v.conc <= 0) return "No antibody yet: all 10 spikes are free, so the virus grips a receptor and can enter.";
      if (!isFinite(kd)) return "This antibody's binding site does not match the spike's epitope, so none of the <b>" + v.conc + " nM</b> binds and the virus docks anyway: antibodies are specific.";
      var lead = "With Kd = " + kd + " nM at " + v.conc + " nM, θ = <b>" + tfmt(t) + "</b>";
      if (P >= 0.9) return lead + " and θ¹⁰ = <b>" + Viz.fmt(P, 2) + "</b>: " + pct(P) + " of virions have every spike covered, so they cannot dock and are <b>neutralized</b>.";
      return lead + " (" + Viz.fmt(t * NS, 1) + " of 10 spikes on average), but θ¹⁰ = <b>" + Viz.fmt(P, 2) + "</b>: only " + pct(P) + " of virions have every spike covered, and the rest dock with a free spike.";
    },
    examples: [
      {name: "enough matched antibody: neutralized", values: {ab: "matched", conc: 60}},
      {name: "almost every spike covered, yet many virions dock", values: {ab: "matched", conc: 15}},
      {name: "weak fit, high dose", values: {ab: "weak fit", conc: 100}},
      {name: "wrong shape", values: {ab: "wrong shape", conc: 100}},
      {name: "no antibody", values: {conc: 0}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, t = theta(v), P = Math.pow(t, NS), neut = v.conc > 0 && P >= 0.9;
      var nb = neut ? NS : Math.min(NS - 1, Math.round(t * NS)), C = [125, neut ? 112 : 188];
      var bound = {}; ORDER.slice(0, nb).forEach(function (k) { bound[k] = true; });
      var Y = function (H, axis, col) {   // a small antibody: axis points from the hinge toward the arms
        var a1 = rot(axis, -38), a2 = rot(axis, 38);
        api.line(H, [H[0] + a1[0] * 12, H[1] + a1[1] * 12], {color: col, width: 2.6});
        api.line(H, [H[0] + a2[0] * 12, H[1] + a2[1] * 12], {color: col, width: 2.6});
        api.line(H, [H[0] - axis[0] * 13, H[1] - axis[1] * 13], {color: col, width: 2.6});
      };
      // host cell membrane with three receptors
      api.rect(8, 262, 238, 8, {fill: c.muted, fillOpacity: 0.3, rx: 3});
      api.label([125, 282], "host cell", {color: c.muted, size: 12, anchor: "middle"});
      [55, 125, 195].forEach(function (x) {   // a receptor with a notch that the spike's tip fits into
        api.line([x, 262], [x, 254], {color: c.c4, width: 3});
        api.polygon([[x - 10, 255], [x - 10, 241], [x - 5, 241], [x, 247], [x + 5, 241], [x + 10, 241], [x + 10, 255]], {fill: c.c4, fillOpacity: 0.85});
      });
      api.label([55, 228], "receptor", {color: c.c4, size: 12, anchor: "middle"});
      // the virus and its spikes; covered spikes carry an antibody on their epitope
      api.circle(C, 40, {fill: c.c6, fillOpacity: 0.18, stroke: c.c6, width: 2});
      api.label(C, "virus", {color: c.c6, size: 12.5, anchor: "middle", weight: 600});
      for (var k = 0; k < NS; k++) {
        var a = (90 + 36 * k) * Math.PI / 180, e = [Math.cos(a), Math.sin(a)], p = [-e[1], e[0]];
        var at = function (r, s) { return [C[0] + e[0] * r + p[0] * (s || 0), C[1] + e[1] * r + p[1] * (s || 0)]; };
        api.line(at(40), at(47), {color: c.c3, width: 3});
        api.polygon([at(46, -6), at(52, -6), at(52, -3), at(58), at(52, 3), at(52, 6), at(46, 6)], {fill: c.c3, fillOpacity: 0.95});
        if (bound[k]) Y(at(71), rot([-e[0], -e[1]], 38), c.c2);
      }
      if (!isFinite(KD[v.ab]) && v.conc > 0) {   // a non-matching antibody stays in solution
        var nf = Math.min(FLOAT.length, Math.ceil(v.conc / 12.5));
        for (var f = 0; f < nf; f++) Y(FLOAT[f], rot([0, -1], f * 47), c.c2);
      }
      api.label([12, 14], neut ? "every spike covered: neutralized" : "a free spike docks: infection",
        {color: neut ? c.ink : c.c5, size: 12.5, weight: 650});
      // close-up: paratope against epitope
      api.rect(266, 6, 126, 72, {stroke: c.faint, width: 1, rx: 8});
      api.polygon([[296, 74], [296, 62], [316, 62], [328, 48], [340, 62], [360, 62], [360, 74]], {fill: c.c3, fillOpacity: 0.9});
      var tipPts = v.ab === "matched" ? [[300, 14], [356, 14], [356, 61], [340, 61], [328, 47], [316, 61], [300, 61]]
        : v.ab === "weak fit" ? [[300, 12], [356, 12], [356, 55], [349, 55], [333, 38], [311, 55], [300, 55]]
        : [[300, 12], [356, 12], [356, 36], [338, 36], [338, 24], [318, 24], [318, 36], [300, 36]];
      api.polygon(tipPts, {fill: c.c2, fillOpacity: 0.8});
      api.label([324, 90], "paratope", {color: c.c2, size: 12, anchor: "end"});
      api.label([334, 90], "epitope", {color: c.c3, size: 12});
      // binding isotherm for this antibody (spikes bound) and the share of virions with all 10 covered
      var x0 = 282, x1 = 390, yT = 136, yB = 252, kd = KD[v.ab];
      var X = function (cc) { return x0 + cc / 100 * (x1 - x0); }, YY = function (q) { return yB - q * (yB - yT); };
      api.label([266, 106], "θ: spikes bound", {color: c.c2, size: 12, weight: 650});
      api.label([266, 121], "θ¹⁰: neutralized", {color: c.c6, size: 12, weight: 650});
      api.line([x0, yB], [x1 + 4, yB], {color: c.axis, width: 1.2});
      api.line([x0, yB], [x0, yT - 6], {color: c.axis, width: 1.2});
      [0, 50, 100].forEach(function (q) { api.line([X(q), yB], [X(q), yB + 3], {color: c.axis, width: 1.2}); api.label([X(q), yB + 13], String(q), {color: c.muted, size: 12, anchor: "middle"}); });
      [[0.5, "0.5"], [1, "1"]].forEach(function (q) { api.line([x0 - 3, YY(q[0])], [x0, YY(q[0])], {color: c.axis, width: 1.2}); api.label([x0 - 6, YY(q[0])], q[1], {color: c.muted, size: 12, anchor: "end"}); });
      api.label([(x0 + x1) / 2, 280], "[Ab], nM", {color: c.muted, size: 12, anchor: "middle"});
      var pt = [], pp = [];
      for (var cc = 0; cc <= 100; cc += 0.5) { var q = th(kd, cc); pt.push([X(cc), YY(q)]); pp.push([X(cc), YY(Math.pow(q, NS))]); }
      api.polyline(pp, {stroke: c.c6, width: 2});
      api.polyline(pt, {stroke: c.c2, width: 2});
      api.line([X(v.conc), YY(t)], [X(v.conc), yB], {color: c.muted, width: 1.1, dash: "3 3"});
      api.point([X(v.conc), YY(P)], {color: c.c6, r: 4.5});
      api.point([X(v.conc), YY(t)], {color: c.c2, r: 4.5});
      // viz.css paints every svg label ink (it overrides the fill attribute); keep each label's own color
      api.svg.querySelectorAll("text").forEach(function (tx) { tx.style.fill = tx.getAttribute("fill"); });
    }
  });
})();
