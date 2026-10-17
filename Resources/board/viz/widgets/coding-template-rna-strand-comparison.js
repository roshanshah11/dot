// Coding strand, template strand and RNA side by side while RNA polymerase works: the template is read 3' to 5', the
// RNA grows 5' to 3' as its complement, so the RNA ends up matching the coding strand with U for T. Pick any two
// strands to compare: identical (coding vs RNA) or complementary and antiparallel (either one against the template).
Viz.register("coding-template-rna-strand-comparison", {
  title: "Coding, template and RNA strands compared",
  subject: "biology",
  shows: "Slide RNA polymerase along a short gene and compare any two strands: coding and RNA match (U for T), the template pairs with both",
  params: {
    k: {kind: "integer", default: 9, min: 1, max: 18, label: "\\text{bases}"},
    pair: {kind: "enum", values: ["coding-RNA", "template-RNA", "coding-template"], default: "coding-RNA", label: "\\text{compare}",
           names: {"coding-RNA": "coding vs RNA", "template-RNA": "template vs RNA", "coding-template": "coding vs template"}}
  },
  formula: function (v) {
    var cod = "ATGACGTTCGGACATTAA", comp = {A: "T", T: "A", G: "C", C: "G"}, dnaOnly = v.pair === "coding-template";
    var hi = dnaOnly ? Math.max(v.k, 9) : v.k, lo = Math.max(0, hi - 9);   // the DNA exists whole; the RNA only up to k
    var seg = function (s) { return (lo > 0 ? "\\cdots " : "") + "\\texttt{" + s.slice(lo, hi) + "}" + (dnaOnly && hi < 18 ? "\\cdots" : ""); };
    var rows = {coding: "\\text{coding}&5'\\text{-}" + seg(cod) + "\\text{-}3'",
                template: "\\text{template}&3'\\text{-}" + seg(cod.split("").map(function (b) { return comp[b]; }).join("")) + "\\text{-}5'",
                RNA: "\\text{RNA}&5'\\text{-}" + seg(cod.replace(/T/g, "U")) + "\\text{-}3'"};
    var two = v.pair.split("-");
    return "\\begin{array}{rl}" + rows[two[0]] + "\\\\" + rows[two[1]] + "\\end{array}";
  },
  status: function (v) {
    var cod = "ATGACGTTCGGACATTAA".slice(0, v.k), t = (cod.match(/T/g) || []).length;
    if (v.pair === "coding-RNA") return (v.k === 1 ? "The first RNA base matches" : "The " + v.k + " RNA bases so far match") + " the coding strand letter for letter, in the same 5′→3′ direction, " +
      (t ? "with <b>" + t + "</b> T" + (t > 1 ? "s" : "") + " written as U." : (v.k === 1 ? "and it is not a T." : "and none of them is a T yet."));
    if (v.pair === "template-RNA") return (v.k === 1 ? "The first RNA base pairs" : "Each of the <b>" + v.k + "</b> RNA bases pairs") + " with the template base across from it (A–U, G–C), running the opposite way: template read 3′→5′, RNA built 5′→3′.";
    var open = Math.min(17, v.k + 1) - Math.max(0, v.k - 4) + 1;   // positions inside RNA polymerase, where the duplex is unwound
    return "Outside the polymerase the DNA strands pair at <b>" + (18 - open) + "</b> of 18 positions, A–T or G–C, running opposite ways; inside it the template pairs with the RNA, " +
      (v.k === 1 ? "whose first base copies" : "whose <b>" + v.k + "</b> bases copy") + " the coding strand.";
  },
  examples: [
    {name: "first base", values: {k: 1, pair: "template-RNA"}},
    {name: "whole gene, identical strands", values: {k: 18, pair: "coding-RNA"}},
    {name: "the DNA duplex", values: {k: 12, pair: "coding-template"}}
  ],
  size: [400, 250],
  draw: function (api, v) {
    var c = api.color, cod = "ATGACGTTCGGACATTAA", comp = {A: "T", T: "A", G: "C", C: "G"}, rna = cod.replace(/T/g, "U");
    var x = function (i) { return 98 + i * 15.4; }, yC = 62, yT = 98, yR = 134, k = v.k, two = v.pair.split("-");
    var dim = {coding: two.indexOf("coding") < 0, template: two.indexOf("template") < 0, RNA: two.indexOf("RNA") < 0};
    // RNA polymerase around the growing 3' end
    var a = Math.max(0, k - 4), b = Math.min(17, k + 1);
    api.rect(x(a) - 10, yC - 20, x(b) - x(a) + 20, yR - yC + 40, {rx: 16, fill: c.ink, fillOpacity: 0.05, stroke: c.faint, width: 1.2, dash: "4 4"});
    api.label([(x(a) + x(b)) / 2, yC - 32], "RNA polymerase →", {color: c.muted, size: 12, anchor: "middle"});
    // the comparison marks
    var bonds = function (i, y1, y2, p, op) { var n = /G|C/.test(p) ? 3 : 2;
      for (var j = 0; j < n; j++) api.line([x(i) - (n - 1) * 2.4 + j * 4.8, y1], [x(i) - (n - 1) * 2.4 + j * 4.8, y2], {color: c.ink, width: 1.3, opacity: op || 0.8}); };
    if (v.pair === "coding-RNA") {
      for (var i = 0; i < k; i++) api.rect(x(i) - 7, yC - 11, 14, yR - yC + 22, {rx: 5, fill: cod[i] === "T" ? c.c6 : c.c4, fillOpacity: cod[i] === "T" ? 0.32 : 0.15});
    } else if (v.pair === "template-RNA") { for (i = 0; i < k; i++) bonds(i, yT + 9, yR - 9, cod[i]); }
    else {   // inside the polymerase the duplex is open (the transcription bubble): the template pairs with the RNA there
      for (i = 0; i < 18; i++) if (i < a || i > b) bonds(i, yC + 9, yT - 9, cod[i]);
      for (i = a; i < k; i++) bonds(i, yT + 9, yR - 9, cod[i], 0.35);
    }
    // the strands
    for (i = 0; i < 18; i++) {
      api.label([x(i), yC], cod[i], {color: c.c1, size: 13.5, weight: 650, anchor: "middle", opacity: dim.coding ? 0.35 : 1});
      api.label([x(i), yT], comp[cod[i]], {color: c.c2, size: 13.5, weight: 650, anchor: "middle", opacity: dim.template ? 0.35 : 1});
      if (i < k) api.label([x(i), yR], rna[i], {color: c.c3, size: 13.5, weight: 650, anchor: "middle", opacity: dim.RNA ? 0.35 : 1});
    }
    api.label([86, yC], "coding 5′", {color: c.c1, size: 12.5, weight: 600, anchor: "end", opacity: dim.coding ? 0.45 : 1});
    api.label([86, yT], "template 3′", {color: c.c2, size: 12.5, weight: 600, anchor: "end", opacity: dim.template ? 0.45 : 1});
    api.label([86, yR], "RNA 5′", {color: c.c3, size: 12.5, weight: 600, anchor: "end", opacity: dim.RNA ? 0.45 : 1});
    api.label([x(17) + 12, yC], "3′", {color: c.c1, size: 12, opacity: dim.coding ? 0.45 : 1});
    api.label([x(17) + 12, yT], "5′", {color: c.c2, size: 12, opacity: dim.template ? 0.45 : 1});
    api.label([x(k - 1) + 12, yR], "3′", {color: c.c3, size: 12, opacity: dim.RNA ? 0.45 : 1});
    if (k > 1) api.arrow([x(0), yR + 24], [x(k - 1) + 4, yR + 24], {color: c.c3, width: 2, halo: false, head: 8});
    api.label([x(0), yR + 42], "RNA grows 5′ → 3′", {color: c.c3, size: 12});
    // what the two strands share
    var t = (cod.slice(0, k).match(/T/g) || []).length;
    var paired = 18 - (b - a + 1), bp = function (n) { return n + (n === 1 ? " base pair" : " base pairs"); };
    var line1 = v.pair === "coding-RNA" ? k - t + " identical, " + t + " differ only by T → U" : v.pair === "template-RNA" ? bp(k) + ": A–U, T–A, G–C, C–G" : bp(paired) + ": A–T and G–C";
    var line2 = v.pair === "coding-RNA" ? "same sequence, same direction" : v.pair === "template-RNA" ? "complementary, antiparallel" : "complementary, antiparallel; opened inside the polymerase";
    api.label([200, 216], line1, {color: v.pair === "coding-RNA" ? c.c4 : c.ink, size: 13, weight: 650, anchor: "middle"});
    api.label([200, 238], line2, {color: c.muted, size: 12, anchor: "middle"});
    if (v.pair === "coding-RNA" && t) api.label([392, 238], "purple: T ↔ U", {color: c.c6, size: 12, anchor: "end"});
    // viz.css paints every svg text ink, over the fill attribute; restate each label's color inline
    api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
  }
});
