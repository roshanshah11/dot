// One nucleotide added, as chemistry. The growing strand ends in a sugar whose 3' carbon carries an -OH. The incoming dNTP
// pairs with the next template base (A-T: 2 hydrogen bonds, G-C: 3); then that 3'-OH attacks the dNTP's alpha-phosphate
// (the one on its 5' carbon). A phosphodiester bond forms (3' C - O - P - O - 5' C) and the beta and gamma phosphates leave
// as pyrophosphate, which pyrophosphatase splits into 2 Pi, pulling the reaction forward. The energy rides in on the
// incoming nucleotide, so a chain can only grow at its 3' end: 5' -> 3', antiparallel to a template read 3' -> 5'.
// Sugars are drawn as plain pentagons: backbone enters at the 5' side (left), leaves at the 3' side (right).
(function () {
  var PAIR = {A: "T", T: "A", G: "C", C: "G"}, HB = {A: 2, T: 2, G: 3, C: 3};
  var TPL = ["T", "G", "C", "A"], AFTER = "G";      // template under the existing chain, and the base after the next one
  function dntp(b) { return "d" + PAIR[b] + "TP"; }

  Viz.register("dna-replication-five-prime-to-three-prime-synthesis", {
    title: "Why a DNA strand grows 5′ to 3′",
    subject: "biology",
    shows: "Step through one nucleotide being added: the strand's 3′-OH attacks the incoming dNTP's α-phosphate, pyrophosphate leaves, and the chain ends in a new 3′-OH, so it can only grow 5′ to 3′",
    params: {
      next: {kind: "enum", values: ["A", "T", "G", "C"], default: "A", label: "\\text{template}"}
    },
    steps: ["dNTP pairs with the template", "3′-OH attacks the α-phosphate", "bond forms, PPᵢ leaves", "one longer, new 3′-OH"],
    stepMs: 1800,
    formula: function (v) {
      return "\\begin{array}{l}\\text{DNA}_n+\\text{" + dntp(v.next) + "}\\to\\text{DNA}_{n+1}+\\text{PP}_i\\\\ \\text{PP}_i+\\text{H}_2\\text{O}\\to 2\\,\\text{P}_i\\end{array}";
    },
    status: function (v) {
      var s = v.step || 1, d = dntp(v.next);
      return ["The next template base is <b>" + v.next + "</b>, so polymerase accepts only <b>" + d + "</b>, which pairs with it by <b>" + HB[v.next] + "</b> hydrogen bonds.",
        "The <b>3′-OH</b> at the end of the growing strand attacks the <b>α-phosphate</b> of " + d + ", the one bonded to its 5′ carbon.",
        "A <b>phosphodiester bond</b> now links the old 3′ carbon to the new 5′ carbon, and the β and γ phosphates leave as <b>pyrophosphate</b>.",
        "The strand is one nucleotide longer and ends in a <b>new 3′-OH</b>: the energy came in on the dNTP, so growth can only be <b>5′ → 3′</b>."][s - 1];
    },
    examples: [
      {name: "A on the template: dTTP pairs", values: {next: "A", step: 1}},
      {name: "G on the template: three hydrogen bonds", values: {next: "G", step: 1}},
      {name: "the attack", values: {next: "C", step: 2}},
      {name: "pyrophosphate leaves", values: {next: "T", step: 3}},
      {name: "one nucleotide longer", values: {next: "G", step: 4}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, X = function (i) { return 44 + 64 * i; };
      var yS = 112, yB = 148, yT = 186, yTS = 222, inc = PAIR[v.next];
      var sugar = function (x, y, col, down) {   // a pentose ring
        var pts = [];
        for (var k = 0; k < 5; k++) { var a = (down ? Math.PI / 2 : -Math.PI / 2) + k * 2 * Math.PI / 5; pts.push([x + 13 * Math.cos(a), y + 13 * Math.sin(a)]); }
        api.polygon(pts, {fill: col, fillOpacity: 0.22, stroke: col, width: 1.6});
      };
      var phos = function (at, col, txt) {
        api.circle(at, 10, {fill: col, fillOpacity: 0.22, stroke: col, width: 1.6});
        api.label([at[0], at[1] + 0.5], txt || "P", {color: col, size: 12, weight: 700, anchor: "middle"});
      };
      var base = function (x, y, letter, col, dash) {
        api.rect(x - 11, y - 10, 22, 20, {fill: col, fillOpacity: dash ? 0 : 0.18, stroke: col, width: 1.4, rx: 4, dash: dash ? "3 3" : null});
        api.label([x, y + 0.5], letter, {color: col, size: 13, weight: 700, anchor: "middle"});
      };
      var hbonds = function (x, n, col) {
        for (var k = 0; k < n; k++) { var dx = (k - (n - 1) / 2) * 6; api.line([x + dx, yB + 11], [x + dx, yT - 11], {color: col, width: 1.3, dash: "2 3"}); }
      };
      // template strand: 3' at the left, 5' at the right, phosphates below the sugars
      for (var i = 0; i < 6; i++) {
        if (i < 5) { api.line([X(i) + 12, yTS], [X(i) + 32, yTS + 16], {color: c.c2, width: 1.6}); api.line([X(i) + 32, yTS + 16], [X(i + 1) - 12, yTS], {color: c.c2, width: 1.6}); }
        sugar(X(i), yTS, c.c2, true);
        api.line([X(i), yTS - 13], [X(i), yT + 10], {color: c.c2, width: 1.4});
        base(X(i), yT, i < 4 ? TPL[i] : i === 4 ? v.next : AFTER, c.c2);
      }
      for (i = 0; i < 5; i++) phos([X(i) + 32, yTS + 16], c.c2);
      api.label([12, yTS], "3′", {color: c.c2, size: 13, weight: 700, anchor: "middle"});
      api.label([390, yTS], "5′", {color: c.c2, size: 13, weight: 700, anchor: "middle"});
      api.label([200, 266], "template, read 3′ → 5′", {color: c.c2, size: 12, anchor: "middle"});
      // the growing chain: 4 nucleotides, 5 after the addition
      var made = s === 4 ? 5 : 4;
      api.line([X(0) - 32, yS - 16], [X(0) - 12, yS], {color: c.c3, width: 1.6});
      for (i = 0; i < made; i++) {
        if (i > 0) { api.line([X(i - 1) + 12, yS], [X(i) - 32, yS - 16], {color: c.c3, width: 1.6}); api.line([X(i) - 32, yS - 16], [X(i) - 12, yS], {color: c.c3, width: 1.6}); }
        sugar(X(i), yS, c.c3);
        api.line([X(i), yS + 11], [X(i), yB - 10], {color: c.c3, width: 1.4});
        base(X(i), yB, PAIR[i < 4 ? TPL[i] : v.next], c.c3);
        hbonds(X(i), HB[i < 4 ? TPL[i] : v.next], c.faint);
      }
      for (i = 0; i < made; i++) phos([X(i) - 32, yS - 16], c.c3);
      api.label([12, yS - 40], "5′", {color: c.c3, size: 13, weight: 700, anchor: "middle"});
      api.label([X(1) - 17, yS + 17], "5′", {color: c.muted, size: 12, anchor: "middle"});
      api.label([X(1) + 17, yS + 17], "3′", {color: c.muted, size: 12, anchor: "middle"});
      api.arrow([28, 30], [104, 30], {color: c.c3, width: 2.5, halo: false, head: 9});
      api.label([112, 30], "new strand grows 5′ → 3′", {color: c.c3, size: 12, weight: 650});
      // the incoming dNTP (green until it is part of the chain)
      var x4 = X(4), Pa = s <= 2 ? [x4 - 22, yS - 34] : [x4 - 32, yS - 16];
      var Pb = s <= 2 ? [x4 - 2, yS - 58] : [x4 + 2, yS - 66], Pg = s <= 2 ? [x4 + 22, yS - 74] : [x4 + 28, yS - 82];
      if (s <= 3) {
        api.line([x4 - 12, yS], Pa, {color: c.c4, width: 1.6});
        sugar(x4, yS, c.c4);
        api.line([x4, yS + 11], [x4, yB - 10], {color: c.c4, width: 1.4});
        base(x4, yB, inc, c.c4);
        hbonds(x4, HB[v.next], c.c4);
        api.line(Pb, Pg, {color: s === 3 ? c.c5 : c.c4, width: 1.6});
        if (s <= 2) api.line(Pa, Pb, {color: c.c4, width: 1.6});
        if (s === 3) api.line([X(3) + 12, yS], Pa, {color: c.c1, width: 3.5});
        phos(Pa, c.c4); phos(Pb, s === 3 ? c.c5 : c.c4); phos(Pg, s === 3 ? c.c5 : c.c4);
        if (s <= 2) {
          api.label([Pa[0] + 16, Pa[1] + 3], "α", {color: c.c4, size: 13, weight: 650, anchor: "middle"});
          api.label([Pb[0] + 16, Pb[1] + 3], "β", {color: c.c4, size: 13, weight: 650, anchor: "middle"});
          api.label([Pg[0] + 16, Pg[1] + 3], "γ", {color: c.c4, size: 13, weight: 650, anchor: "middle"});
          api.label([x4 + 18, yB + 1], dntp(v.next), {color: c.c4, size: 12, weight: 650});
        }
      }
      // the 3'-OH and what it does at each step
      var oh = s === 4 ? X(4) : X(3);
      if (s !== 3) api.label([oh + 15, yS + 16], "3′-OH", {color: c.c1, size: 12, weight: 700});
      if (s === 2) {
        api.path("M " + (X(3) + 18) + " " + (yS + 6) + " Q " + (X(3) + 18) + " " + (Pa[1] + 4) + " " + (Pa[0] - 13) + " " + (Pa[1] + 3), {stroke: c.c1, width: 2, arrow: true});
        api.label([X(3) + 4, 62], "attacks α-P", {color: c.c1, size: 12, weight: 650, anchor: "end"});
      }
      if (s === 3) {
        api.label([X(3) + 4, 62], "new phosphodiester bond", {color: c.c1, size: 12, weight: 650, anchor: "end"});
        api.line([X(3) + 8, 70], [X(3) + 20, yS - 8], {color: c.c1, width: 1.2, dash: "2 3"});
        api.label([Pg[0] + 16, Pg[1]], "PPᵢ", {color: c.c5, size: 13, weight: 700});
        api.arrow([Pb[0] + 18, Pb[1] + 8], [Pb[0] + 44, Pb[1] - 2], {color: c.c5, width: 2, halo: false, head: 8});
      }
      if (s === 4) {
        base(X(5), yB, PAIR[AFTER], c.c4, true);
        api.line([X(5), yS - 22], [X(5), yB - 12], {color: c.c4, width: 1.2, dash: "2 3"});
        api.label([X(5), yS - 30], "next dNTP", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
        api.label([X(4) - 32, yS - 42], "+1", {color: c.c3, size: 13, weight: 700, anchor: "middle"});
        api.label([390, 30], "PPᵢ → 2 Pᵢ", {color: c.c5, size: 12, weight: 650, anchor: "end"});
      }
      api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
