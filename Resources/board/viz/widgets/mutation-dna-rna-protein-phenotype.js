// One base, followed from the gene to the person: human beta-globin (HBB, NM_000518.5) codons 4-8, ACT CCT GAG GAG AAG
// = Thr Pro Glu Glu Lys, traditional numbering (initiator Met removed), with both copies of the gene carrying the change.
// The template strand is read 3' -> 5' to make an mRNA that matches the coding strand (U for T); the ribosome reads it in
// codons; the beta chains pair with alpha chains into hemoglobin (two alpha + two beta); the hemoglobin fills red cells.
// GAG -> GTG (Glu6Val) is HbS: deoxygenated HbS polymerizes into long fibers and the cells sickle (sickle-cell disease);
// oxygenated HbS stays dissolved, so most cells keep their shape until oxygen drops (a few irreversibly sickled cells
// remain). GAG -> GAA is silent (still Glu, an illustrative change). GAG -> TAG is an illustrative premature stop at codon
// 6, like the real codon 17 and 39 stops: nonsense-mediated decay leaves no beta chains, the beta0-thalassemia picture
// (few, small, pale red cells). Colors: purple = the changed base and what it changes, teal = mRNA, blue = alpha chains,
// green = beta chains, red = red cells, amber = stop.
(function () {
  var CODING = "ACTCCTGAGGAGAAG", FIRST = 4, B = "TCAG", COMP = {A: "T", T: "A", G: "C", C: "G"};
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var NAME = {A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met",
    F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop"};
  var ALLELE = {normal: [7, "A"], silent: [8, "A"], missense: [7, "T"], nonsense: [6, "T"]};
  function aa(c) { return CODE[16 * B.indexOf(c[0]) + 4 * B.indexOf(c[1]) + B.indexOf(c[2])]; }
  function model(v) {
    var q = ALLELE[v.allele], s = CODING.slice(0, q[0]) + q[1] + CODING.slice(q[0] + 1), prot = [], stop = -1;
    for (var k = 0; k < 5; k++) { var a = aa(s.substr(3 * k, 3)); prot.push(a); if (a === "*" && stop < 0) stop = k; }
    return {s: s, at: q[0], changed: v.allele !== "normal", prot: prot, stop: stop, low: v.oxygen === "low", cod: s.substr(6, 3)};
  }

  Viz.register("mutation-dna-rna-protein-phenotype", {
    title: "From DNA to trait: one base in beta-globin",
    subject: "biology",
    shows: "Change codon 6 of beta-globin and follow it down: DNA, mRNA, protein, hemoglobin and red cells; GAG to GTG makes HbS, which sickles cells when oxygen is low",
    params: {
      allele: {kind: "enum", values: ["normal", "silent", "missense", "nonsense"], names: {missense: "missense (HbS)"}, default: "missense", label: "\\text{codon 6}"},
      oxygen: {kind: "enum", values: ["normal", "low"], default: "low", label: "\\text{O}_2"}
    },
    formula: function (v) {
      var r = model(v), a = r.prot[2], mr = r.cod.replace(/T/g, "U");
      var hb = v.allele === "missense" ? "\\text{HbS}" : v.allele === "nonsense" ? "\\text{no }\\beta\\text{ chain}" : "\\text{HbA}";
      return "\\begin{array}{l}\\texttt{" + r.cod + "}\\to\\texttt{" + mr + "}\\to\\text{" + (a === "*" ? "Stop" : NAME[a] + "6") + "}\\\\ \\to " + hb + "\\end{array}";
    },
    status: function (v) {
      var r = model(v), low = r.low;
      if (v.allele === "normal") return "GAG is read as <b>Glu6</b>: normal β chains make soluble HbA, so the red cells stay round and flexible" + (low ? ", even with little oxygen." : ".");
      if (v.allele === "silent") return "GAG → GAA still codes <b>Glu</b>, so the protein, the hemoglobin and the cells are all normal: the change is <b>silent</b>.";
      if (v.allele === "nonsense") return "GAG → TAG ends the chain at codon 6 and the mRNA is destroyed, so <b>no β chains</b> are made: few, small, pale red cells (β⁰-thalassemia).";
      return low ? "GAG → GTG puts <b>Val6</b> on the surface of β-globin; without oxygen HbS sticks into long fibers and the cells bend into <b>sickles</b> that block small vessels."
        : "GAG → GTG makes <b>HbS</b>, but oxygenated HbS stays dissolved, so <b>most cells keep their shape</b> until oxygen drops.";
    },
    examples: [
      {name: "sickle cell, low oxygen", values: {allele: "missense", oxygen: "low"}},
      {name: "sickle cell, oxygen normal", values: {allele: "missense", oxygen: "normal"}},
      {name: "normal", values: {allele: "normal", oxygen: "normal"}},
      {name: "silent", values: {allele: "silent", oxygen: "low"}},
      {name: "nonsense", values: {allele: "nonsense", oxygen: "normal"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, r = model(v), X = function (i) { return 112 + i * 13 + Math.floor(i / 3) * 8; };
      var CX = function (k) { return X(3 * k + 1); };
      [["DNA", 39], ["mRNA", 82], ["protein", 120], ["hemoglobin", 166], ["red cells", 224]].forEach(function (L) {
        api.label([8, L[1]], L[0], {color: c.muted, size: 12, weight: 650});
      });
      // DNA: coding strand over template strand; the mRNA under them (faded when nonsense-mediated decay destroys it)
      var nmd = v.allele === "nonsense";
      for (var i = 0; i < 15; i++) {
        var hit = r.changed && i === r.at;
        api.label([X(i), 30], r.s[i], {color: hit ? c.c6 : c.ink, size: 13, weight: hit ? 800 : 550, anchor: "middle"});
        api.label([X(i), 48], COMP[r.s[i]], {color: hit ? c.c6 : c.muted, size: 13, weight: hit ? 800 : 500, anchor: "middle"});
        api.label([X(i), 82], r.s[i].replace("T", "U"), {color: hit ? c.c6 : c.c1, size: 13, weight: hit ? 800 : 650, anchor: "middle", opacity: nmd ? 0.35 : 1});
      }
      if (nmd) {
        api.line([X(0) - 6, 82], [X(14) + 6, 82], {color: c.muted, width: 1.5, dash: "4 3", opacity: 0.8});
        api.label([X(14) + 12, 82], "destroyed", {color: c.muted, size: 12, weight: 650});
      }
      api.label([X(0) - 16, 30], "5′", {color: c.muted, size: 12, anchor: "middle"});
      api.label([X(14) + 16, 30], "3′", {color: c.muted, size: 12, anchor: "middle"});
      api.label([X(0) - 16, 48], "3′", {color: c.muted, size: 12, anchor: "middle"});
      api.label([X(14) + 16, 48], "5′", {color: c.muted, size: 12, anchor: "middle"});
      // codon 6: the purple box and its label directly above it
      api.rect(X(6) - 8, 19, 42, 40, {stroke: c.c6, width: 1.5, rx: 6, dash: r.changed ? null : "3 3"});
      api.label([X(7), 10], "codon 6", {color: c.c6, size: 12, weight: 650, anchor: "middle"});
      var k;
      // protein beads: residue 6 turns purple only when its amino acid actually differs from Glu
      for (k = 0; k < 5; k++) {
        var a = r.prot[k], gone = r.stop >= 0 && k > r.stop, y = 120;
        if (k && !gone && a !== "*") api.line([CX(k - 1) + 15, y], [CX(k) - 15, y], {color: c.muted, width: 2, opacity: 0.6});
        if (a === "*") { api.rect(CX(k) - 18, y - 11, 36, 22, {fill: c.c3, fillOpacity: 0.9, rx: 6}); api.label([CX(k), y], "Stop", {color: c.card, size: 12, weight: 700, anchor: "middle"}); continue; }
        var diff = k === 2 && a !== "E";
        api.circle([CX(k), y], 15, {fill: diff ? c.c6 : c.c4, fillOpacity: gone ? 0.12 : 0.85});
        if (k === 2 && r.changed && !diff) api.circle([CX(k), y], 18, {stroke: c.c6, width: 1.5});   // silent: same residue, position marked
        api.label([CX(k), y], NAME[a], {color: c.card, size: 12, weight: 700, anchor: "middle", opacity: gone ? 0.4 : 1});
      }
      // hemoglobin: two alpha (blue) + two beta (green, purple when changed)
      var bcol = v.allele === "missense" ? c.c6 : c.c4;
      var tet = function (x, y) {
        [[-6, -6, c.c2], [6, -6, bcol], [-6, 6, bcol], [6, 6, c.c2]].forEach(function (p) { api.circle([x + p[0], y + p[1]], 6.5, {fill: p[2], fillOpacity: 0.85}); });
      };
      var yH = 166;
      if (v.allele === "nonsense") {
        [[0, 0], [12, -4], [6, 9], [-8, 8], [20, 7]].forEach(function (p, j) { api.circle([140 + p[0] + (j % 2) * 4, yH + p[1] - 2], 6.5, {fill: c.c2, fillOpacity: 0.7}); });
        api.label([180, yH], "α chains with no β partner clump", {color: c.ink, size: 12});
      } else if (v.allele === "missense" && r.low) {
        for (k = 0; k < 6; k++) tet(126 + k * 26, yH);
        api.line([114, yH], [272, yH], {color: c.c6, width: 3, opacity: 0.5});
        api.label([286, yH], "HbS fiber", {color: c.c6, size: 12, weight: 650});
      } else {
        [[130, 0], [176, -4], [222, 3]].forEach(function (p) { tet(p[0], yH + p[1]); });
        api.label([256, yH], v.allele === "missense" ? "HbS, dissolved" : "HbA, dissolved", {color: v.allele === "missense" ? c.c6 : c.c4, size: 12, weight: 650});
      }
      // red cells
      var yC = 224, xs = [128, 172, 216, 260, 304];
      var round = function (x, y, s) { api.circle([x, y], 16 * s, {fill: c.c5, fillOpacity: 0.85}); api.circle([x, y], 7 * s, {fill: c.c5, fillOpacity: 0.45}); };
      var sickle = function (x, y, rot) {
        var p = api.path("M -19 6 A 21 21 0 0 1 19 6 A 30 30 0 0 0 -19 6 Z", {fill: c.c5, fillOpacity: 0.85, stroke: c.c5, width: 1.5});
        p.setAttribute("transform", "translate(" + x + " " + y + ") rotate(" + rot + ")");
      };
      xs.forEach(function (x, j) {
        if (v.allele === "nonsense") {
          var s = [0.62, 0.5, 0.7, 0.55, 0.6][j];
          api.circle([x, yC + (j % 2 ? 5 : -4)], 16 * s, {fill: c.c5, fillOpacity: 0.3, stroke: c.c5, width: 1.2});
        } else if (v.allele === "missense" && (r.low ? j !== 2 : j === 3)) sickle(x, yC, [-20, 15, 0, -35, 25][j]);
        else round(x, yC + (j % 2 ? 3 : -3), 1);
      });
      api.label([336, yC - 12], "O_2", {color: c.muted, size: 12});
      api.label([336, yC + 6], r.low ? "low" : "normal", {color: r.low ? c.c2 : c.muted, size: 12, weight: 650});
      var trait = v.allele === "missense" ? (r.low ? "sickle-cell disease: cells sickle and block vessels" : "sickle-cell disease, but cells mostly round now")
        : v.allele === "nonsense" ? "β⁰-thalassemia: severe anemia" : "normal red cells";
      api.label([8, 266], "trait (both gene copies)", {color: c.muted, size: 12});
      api.label([8, 286], trait, {color: v.allele === "normal" || v.allele === "silent" ? c.ink : c.c5, size: 13, weight: 700});
      // viz.css paints svg text with the ink color; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
