// A nucleotide from its three parts: a nitrogenous base, a five-carbon sugar and a phosphate. DNA uses deoxyribose
// (H on the 2' carbon) and the bases A, G, C, T; RNA uses ribose (OH on the 2' carbon) and A, G, C, U. Purines (A, G)
// have two fused rings and attach through N9; pyrimidines (C, T, U) have one ring and attach through N1. The base joins
// the sugar's 1' carbon by an N-glycosidic bond (base + sugar = nucleoside), and the phosphate joins the 5' carbon by a
// phosphoester bond (nucleoside + phosphate = nucleotide). As atom bookkeeping each link is a condensation that loses one
// H2O (cells actually attach bases to the ready-made sugar phosphate PRPP, but the atoms add up the same):
// base + sugar + H3PO4 - 2 H2O = nucleoside monophosphate, neutral form. Atoms: adenine C5H5N5, guanine C5H5N5O,
// cytosine C4H5N3O, thymine C5H6N2O2, uracil C4H4N2O2, ribose C5H10O5, deoxyribose C5H10O4. M from C 12.011, H 1.008,
// N 14.007, O 15.999, P 30.974. Colors: A green, G amber, C blue, T red, U purple; teal = the 2' position; purple
// circle = phosphate; amber = the bond being made and its water.
(function () {
  var AT = {A: [5, 5, 5, 0, 0], G: [5, 5, 5, 1, 0], C: [4, 5, 3, 1, 0], T: [5, 6, 2, 2, 0], U: [4, 4, 2, 2, 0],
    ribose: [5, 10, 0, 5, 0], deoxyribose: [5, 10, 0, 4, 0], phos: [0, 3, 0, 4, 1], water: [0, 2, 0, 1, 0]};
  var SYM = ["C", "H", "N", "O", "P"], MASS = [12.011, 1.008, 14.007, 15.999, 30.974];
  var BASE = {A: ["adenine", "purine", "adenosine", "AMP"], G: ["guanine", "purine", "guanosine", "GMP"], C: ["cytosine", "pyrimidine", "cytidine", "CMP"],
    T: ["thymine", "pyrimidine", "thymidine", "TMP"], U: ["uracil", "pyrimidine", "uridine", "UMP"]};
  function letter(v) { return v.base === "T/U" ? (v.molecule === "DNA" ? "T" : "U") : v.base; }
  function add(a, b, k) { return a.map(function (x, i) { return x + (k == null ? 1 : k) * b[i]; }); }
  function tex(a) { return "\\mathrm{" + a.map(function (x, i) { return x ? SYM[i] + (x > 1 ? "_{" + x + "}" : "") : ""; }).join("") + "}"; }
  function txt(a) { return Viz.sub(a.map(function (x, i) { return x ? SYM[i] + (x > 1 ? "_{" + x + "}" : "") : ""; }).join("")); }
  function names(v) {
    var L = letter(v), b = BASE[L], dna = v.molecule === "DNA", sugar = dna ? "deoxyribose" : "ribose";
    var nucleoside = dna ? (L === "T" ? "thymidine" : "deoxy" + b[2]) : b[2];
    var nucleotide = (dna ? "d" : "") + b[3];
    var ns = add(add(AT[L], AT[sugar]), AT.water, -1), nt = add(add(ns, AT.phos), AT.water, -1);
    return {L: L, base: b[0], kind: b[1], sugar: sugar, nucleoside: nucleoside, nucleotide: nucleotide, ns: ns, nt: nt,
      M: nt.reduce(function (s, x, i) { return s + x * MASS[i]; }, 0)};
  }
  Viz.register("nucleotides-dna-and-rna", {
    title: "Nucleotides of DNA and RNA",
    subject: "biology",
    shows: "Assemble a nucleotide step by step: the base joins the sugar's 1′ carbon to make a nucleoside, then a phosphate joins the 5′ carbon; switch DNA and RNA to swap deoxyribose for ribose and thymine for uracil",
    params: {
      molecule: {kind: "enum", values: ["DNA", "RNA"], default: "DNA", label: "\\text{type}"},
      base: {kind: "enum", values: ["A", "G", "C", "T/U"], default: "A", label: "\\text{base}", names: {"T/U": "T or U"}}
    },
    steps: ["three parts", "base + sugar: nucleoside", "+ phosphate: nucleotide"],
    stepMs: 1800,
    formula: function (v) {
      var s = v.step || 1, r = names(v), base = tex(AT[r.L]), sug = tex(AT[r.sugar]);
      if (s === 1) return "\\begin{array}{l}\\text{base}+\\text{sugar}+\\text{phosphate}\\\\ " + base + "+" + sug + "+\\mathrm{H_3PO_4}\\end{array}";
      if (s === 2) return "\\begin{array}{l}" + base + "+" + sug + "-\\mathrm{H_2O}\\\\ =" + tex(r.ns) + "\\ \\text{(" + r.nucleoside + ")}\\end{array}";
      return "\\begin{array}{l}" + tex(r.ns) + "+\\mathrm{H_3PO_4}-\\mathrm{H_2O}\\\\ =" + tex(r.nt) + "\\ \\ (" + Viz.n(r.M, 1) + "\\ \\text{g/mol})\\end{array}";
    },
    status: function (v) {
      var s = v.step || 1, r = names(v), dna = v.molecule === "DNA";
      if (s === 1) return "Three parts: a phosphate, <b>" + r.sugar + "</b> (" + (dna ? "H" : "OH") + " on its 2′ carbon) and <b>" + r.base + "</b>, a " + r.kind + " with " + (r.kind === "purine" ? "two rings" : "one ring") + (r.L === "T" ? " found only in DNA" : r.L === "U" ? " found only in RNA" : "") + ".";
      if (s === 2) return r.base.charAt(0).toUpperCase() + r.base.slice(1) + "'s " + (r.kind === "purine" ? "N9" : "N1") + " bonds to the sugar's 1′ carbon and a water leaves: base + sugar = <b>" + r.nucleoside + "</b>, a nucleoside.";
      return "The phosphate bonds to the 5′ carbon and a second water leaves: <b>" + r.nucleotide + "</b> (" + txt(r.nt) + "), one of the four building blocks of " + v.molecule + ".";
    },
    examples: [
      {name: "dAMP assembled", values: {molecule: "DNA", base: "A", step: 3}},
      {name: "RNA: uracil", values: {molecule: "RNA", base: "T/U", step: 1}},
      {name: "DNA: thymidine (nucleoside)", values: {molecule: "DNA", base: "T/U", step: 2}},
      {name: "GMP from ribose", values: {molecule: "RNA", base: "G", step: 3}},
      {name: "cytosine parts", values: {molecule: "DNA", base: "C", step: 1}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, r = names(v), dna = v.molecule === "DNA";
      var bcol = {A: c.c4, G: c.c3, C: c.c2, T: c.c5, U: c.c6}[r.L], amber = c.c3;
      var P = function (cx, cy, rad, a) { return [cx + rad * Math.cos(a * Math.PI / 180), cy - rad * Math.sin(a * Math.PI / 180)]; };
      // the sugar ring: O4' at the top, then C1' (right) round to C4' (left); C5' above C4'
      var S = [180, 110], R = 34, O4 = P(S[0], S[1], R, 90), C1 = P(S[0], S[1], R, 18), C2 = P(S[0], S[1], R, -54), C3 = P(S[0], S[1], R, -126), C4 = P(S[0], S[1], R, 162);
      var C5 = [C4[0] - 22, C4[1] - 30];
      api.polygon([O4, C1, C2, C3, C4], {fill: c.ink, fillOpacity: 0.06, stroke: c.ink, width: 2.2});
      api.line(C4, C5, {color: c.ink, width: 2.2});
      api.circle(O4, 8, {fill: c.card}); api.label(O4, "O", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      [[C1, "1′", 2, 16], [C2, "2′", 13, 0], [C3, "3′", -13, 0], [C4, "4′", -13, 6], [C5, "5′", 13, 3]].forEach(function (q) {
        api.label([q[0][0] + q[2], q[0][1] + q[3]], q[1], {color: q[1] === "2′" ? c.c1 : c.muted, size: 12, weight: q[1] === "2′" ? 700 : 500, anchor: "middle"});
      });
      api.line(C2, [C2[0] + 3, C2[1] + 15], {color: c.c1, width: 2});
      api.label([C2[0] + 4, C2[1] + 24], dna ? "H" : "OH", {color: c.c1, size: 13, weight: 750, anchor: "middle"});
      api.line(C3, [C3[0] - 3, C3[1] + 15], {color: c.ink, width: 2});
      api.label([C3[0] - 5, C3[1] + 24], "OH", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      api.label([S[0], C3[1] + 44], r.sugar + " (2′ " + (dna ? "H" : "OH") + ")", {color: c.c1, size: 12, weight: 600, anchor: "middle"});
      // the base: purine = pentagon fused to a hexagon; pyrimidine = hexagon
      var joined = s >= 2, ax = joined ? C1[0] + 26 : C1[0] + 64, by = C1[1], att = [ax, by], cenH;
      if (r.kind === "purine") {
        var cenP = [ax + 17, by], pent = [0, 1, 2, 3, 4].map(function (k) { return P(cenP[0], cenP[1], 17, 180 + k * 72); });
        api.polygon(pent, {fill: bcol, fillOpacity: 0.3, stroke: bcol, width: 2});
        cenH = [cenP[0] + 17 * Math.cos(36 * Math.PI / 180) + 20 * Math.cos(30 * Math.PI / 180), by];
        api.polygon([0, 1, 2, 3, 4, 5].map(function (k) { return P(cenH[0], cenH[1], 20, 30 + k * 60); }), {fill: bcol, fillOpacity: 0.3, stroke: bcol, width: 2});
      } else {
        cenH = [ax + 20, by];
        api.polygon([0, 1, 2, 3, 4, 5].map(function (k) { return P(cenH[0], cenH[1], 20, k * 60); }), {fill: bcol, fillOpacity: 0.3, stroke: bcol, width: 2});
      }
      api.label([cenH[0], cenH[1] + 0.5], r.L, {color: bcol, size: 15, weight: 800, anchor: "middle"});
      api.label([ax + 6, by + 38], r.base + " (" + r.kind + ")", {color: bcol, size: 12.5, weight: 650});
      api.label([ax - 2, by + 16], r.kind === "purine" ? "N9" : "N1", {color: c.muted, size: 12, anchor: "middle"});
      // the phosphate
      var Pc = s >= 3 ? [82, 40] : [54, 66];
      api.circle(Pc, 15, {fill: c.c6, fillOpacity: 0.3, stroke: c.c6, width: 2});
      api.label([Pc[0], Pc[1] + 0.5], "P", {color: c.c6, size: 14, weight: 800, anchor: "middle"});
      api.label([Pc[0] - (s >= 3 ? 6 : 0), Pc[1] + 27], "phosphate", {color: c.c6, size: 12, anchor: "middle"});
      if (s === 1) {
        api.label([100, 84], "+", {color: c.muted, size: 18, weight: 700, anchor: "middle"});
        api.label([C1[0] + 30, by], "+", {color: c.muted, size: 18, weight: 700, anchor: "middle"});
      }
      // bonds made, and the water each one releases
      var water = function (from, to) { api.arrow(from, to, {color: amber, width: 1.6, halo: false, head: 7}); api.label([to[0] + 4, to[1] - 10], "H₂O", {color: amber, size: 12.5, weight: 700, anchor: "middle"}); };
      if (s >= 2) { api.line(C1, att, {color: amber, width: 3.5}); water([(C1[0] + ax) / 2, by - 6], [(C1[0] + ax) / 2 + 8, by - 34]); }
      if (s >= 3) {
        var O5 = [(C5[0] + Pc[0]) / 2 + 2, (C5[1] + Pc[1]) / 2 + 2];
        api.line(C5, O5, {color: amber, width: 3.5}); api.line(O5, [Pc[0] + 13, Pc[1] + 7], {color: amber, width: 3.5});
        api.circle(O5, 7.5, {fill: c.card}); api.label(O5, "O", {color: amber, size: 12, weight: 700, anchor: "middle"});
        water([O5[0] + 6, O5[1] - 8], [O5[0] + 22, O5[1] - 28]);
      }
      // what it is called so far
      var y = 236, boxes = [["base", r.base, 1], ["nucleoside", r.nucleoside, 2], ["nucleotide", r.nucleotide, 3]];
      api.line([8, 206], [392, 206], {color: c.grid, width: 1});
      boxes.forEach(function (b, i) {
        var x = 10 + i * 130, on = s >= b[2], cur = s === b[2];
        api.rect(x, y - 20, 118, 46, {fill: cur ? amber : c.ink, fillOpacity: cur ? 0.14 : on ? 0.06 : 0.02, stroke: cur ? amber : null, width: 1.5, rx: 8, dash: on ? null : "3 3"});
        api.label([x + 59, y - 6], b[0], {color: c.muted, size: 12, anchor: "middle"});
        api.label([x + 59, y + 12], on ? b[1] : "?", {color: on ? c.ink : c.faint, size: 13, weight: 700, anchor: "middle"});
        if (i < 2) api.label([x + 124, y + 3], "→", {color: c.muted, size: 13, anchor: "middle"});
      });
      api.label([10, 286], s === 1 ? (dna ? "DNA: deoxyribose; bases A, G, C, T" : "RNA: ribose; bases A, G, C, U") : s === 2 ? "N-glycosidic bond made, 1 H₂O released" : "+ phosphoester bond: 2 H₂O released in all",
        {color: c.muted, size: 12});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
