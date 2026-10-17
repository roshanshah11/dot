// Which DNA strand is the template is decided gene by gene, by the direction the gene points. RNA polymerase can only
// add nucleotides to the RNA's 3' end, so the RNA grows 5'->3' and the strand it reads must run 3'->5' in the
// direction the polymerase moves. Two genes on one stretch of DNA: gene A points right (template = bottom strand),
// gene B points left (template = top strand). Each RNA pairs antiparallel with its template and so reads like the
// other strand, the coding strand, with U for T. Both genes start ATG on their coding strand, read 5'->3'.
(function () {
  var TOP = "TAATGAAACGTGCCTGAACCATAT", PAIR = {A: "T", T: "A", G: "C", C: "G"};
  var GENE = {A: {from: 2, to: 10, dir: 1}, B: {from: 21, to: 13, dir: -1}};   // first and last transcribed position
  function rnaAt(g, p) { var b = g === "A" ? TOP[p] : PAIR[TOP[p]]; return b === "T" ? "U" : b; }
  function rna(v) { var g = GENE[v.gene], out = ""; for (var i = 0; i < v.k; i++) out += rnaAt(v.gene, g.from + g.dir * i); return out; }

  Viz.register("gene-coding-template-strand-orientation", {
    title: "Which strand is the template?",
    subject: "biology",
    shows: "Pick a gene and slide transcription along it: the gene's direction decides the template, the strand that runs 3' to 5' the way RNA polymerase moves",
    params: {
      gene: {kind: "enum", values: ["A", "B"], names: {A: "gene A (→)", B: "gene B (←)"}, default: "A", label: "\\text{gene}"},
      k: {kind: "integer", default: 6, min: 0, max: 9, label: "\\text{bases}"}
    },
    formula: function (v) {
      var r = rna(v), A = v.gene === "A";
      var l1 = "\\text{gene " + v.gene + "}\\ " + (A ? "\\rightarrow" : "\\leftarrow") + ":\\ \\text{template} = \\text{" + (A ? "bottom" : "top") + "}";
      var l2 = r ? "\\text{RNA} = 5'\\text{-}\\texttt{" + r + "}\\text{-}3'" : "\\text{RNA: not started yet}";
      return "\\begin{array}{l}" + l1 + "\\\\ " + l2 + "\\end{array}";
    },
    status: function (v) {
      var A = v.gene === "A", dir = A ? "left to right" : "right to left", tpl = A ? "bottom" : "top", cod = A ? "top" : "bottom";
      if (!v.k) return "Gene " + v.gene + "'s promoter points " + (A ? "right" : "left") + ", so RNA polymerase will move " + dir + " reading the <b>" + tpl + "</b> strand, the one running 3′→5′ that way.";
      return "Gene " + v.gene + " is read " + dir + ": the RNA can grow only at its 3′ end, so the template is the <b>" + tpl + "</b> strand, and the " + v.k + " RNA base" + (v.k > 1 ? "s" : "") + " so far copy the " + cod + " strand with U for T.";
    },
    examples: [
      {name: "gene A, not started", values: {gene: "A", k: 0}},
      {name: "gene A, finished", values: {gene: "A", k: 9}},
      {name: "gene B, halfway", values: {gene: "B", k: 4}},
      {name: "gene B, finished", values: {gene: "B", k: 9}}
    ],
    size: [400, 256],
    draw: function (api, v) {
      var c = api.color, x = function (i) { return 70 + i * 13; }, yT = 118, yB = 148, A = v.gene === "A", g = GENE[v.gene];
      var inGene = function (p, name) { var q = GENE[name]; return p >= Math.min(q.from, q.to) && p <= Math.max(q.from, q.to); };
      // gene regions
      ["A", "B"].forEach(function (name) {
        var q = GENE[name], lo = Math.min(q.from, q.to), hi = Math.max(q.from, q.to), sel = name === v.gene;
        api.rect(x(lo) - 7, yT - 13, x(hi) - x(lo) + 14, yB - yT + 26, {fill: c.ink, fillOpacity: sel ? 0.07 : 0.03, stroke: sel ? c.faint : null, width: 1, rx: 6});
      });
      api.label([(x(2) + x(10)) / 2, yT - 24], "gene A →", {color: A ? c.ink : c.muted, size: 12.5, weight: A ? 650 : 500, anchor: "middle"});
      api.label([(x(13) + x(21)) / 2, yB + 25], "← gene B", {color: A ? c.muted : c.ink, size: 12.5, weight: A ? 500 : 650, anchor: "middle"});
      // promoters: bent arrows pointing the way each gene is read
      api.path("M " + x(1) + " " + (yT - 10) + " L " + x(1) + " " + (yT - 24) + " L " + (x(2) + 3) + " " + (yT - 24), {stroke: A ? c.c4 : c.muted, width: 2, arrow: true});
      api.path("M " + x(22) + " " + (yB + 10) + " L " + x(22) + " " + (yB + 24) + " L " + (x(21) - 3) + " " + (yB + 24), {stroke: A ? c.muted : c.c4, width: 2, arrow: true});
      api.label([x(0) - 4, yT - 38], "promoter", {color: A ? c.c4 : c.muted, size: 12});
      api.label([x(23) + 4, yB + 40], "promoter", {color: A ? c.muted : c.c4, size: 12, anchor: "end"});
      // RNA polymerase around the growing end
      var head = g.from + g.dir * v.k, lo = A ? Math.max(1, head - 3) : head - 1, hi = A ? head + 1 : Math.min(22, head + 3);
      var py0 = A ? yT - 12 : yT - 50, py1 = A ? yB + 50 : yB + 12;
      api.rect(x(lo) - 9, py0, x(hi) - x(lo) + 18, py1 - py0, {rx: 14, fill: c.ink, fillOpacity: 0.04, stroke: c.muted, width: 1.2, dash: "4 4"});
      api.label(A ? [x(lo) - 6, py1 + 14] : [x(hi) + 6, py0 - 12], A ? "RNA polymerase →" : "← RNA polymerase", {color: c.muted, size: 12, anchor: A ? "start" : "end"});
      // the two DNA strands, base pairs between them
      for (var p = 0; p < 24; p++) {
        var sel = inGene(p, v.gene), codingTop = A;
        var topCol = sel ? (codingTop ? c.c1 : c.c2) : c.ink, botCol = sel ? (codingTop ? c.c2 : c.c1) : c.ink;
        api.line([x(p), yT + 8], [x(p), yB - 8], {color: c.faint, width: 1.2});
        api.label([x(p), yT], TOP[p], {color: topCol, size: 13, weight: sel ? 650 : 500, anchor: "middle", opacity: sel ? 1 : 0.5});
        api.label([x(p), yB], PAIR[TOP[p]], {color: botCol, size: 13, weight: sel ? 650 : 500, anchor: "middle", opacity: sel ? 1 : 0.5});
      }
      api.label([x(0) - 13, yT], "5′", {color: c.muted, size: 12, anchor: "middle"});
      api.label([x(23) + 13, yT], "3′", {color: c.muted, size: 12, anchor: "middle"});
      api.label([x(0) - 13, yB], "3′", {color: c.muted, size: 12, anchor: "middle"});
      api.label([x(23) + 13, yB], "5′", {color: c.muted, size: 12, anchor: "middle"});
      api.label([44, yT], "top", {color: c.muted, size: 12, anchor: "end"});
      api.label([44, yB], "bottom", {color: c.muted, size: 12, anchor: "end"});
      // each strand's role for the chosen gene, beside its name
      api.label([44, yT - 16], A ? "coding" : "template", {color: A ? c.c1 : c.c2, size: 12, weight: 650, anchor: "end"});
      api.label([44, yB + 16], A ? "template" : "coding", {color: A ? c.c2 : c.c1, size: 12, weight: 650, anchor: "end"});
      // the RNA, paired against the template (below the bottom strand for A, above the top strand for B)
      var yR = A ? yB + 34 : yT - 34, r = rna(v);
      for (var i = 0; i < r.length; i++) {
        var q = g.from + g.dir * i;
        api.line([x(q), A ? yB + 8 : yR + 8], [x(q), A ? yR - 8 : yT - 8], {color: c.c3, width: 1, opacity: 0.45});
        api.label([x(q), yR], r[i], {color: c.c3, size: 13, weight: 650, anchor: "middle"});
      }
      if (r.length) {
        api.label([x(g.from) - g.dir * 13, yR], "5′", {color: c.c3, size: 12, anchor: "middle"});
        api.label([x(g.from + g.dir * (r.length - 1)) + g.dir * 13, yR], "3′", {color: c.c3, size: 12, anchor: "middle"});
        api.label(A ? [44, yR] : [44, yR], "RNA", {color: c.c3, size: 12, weight: 650, anchor: "end"});
      }
      api.label([200, 244], "RNA grows 5′ → 3′, so its template is read 3′ → 5′", {color: c.muted, size: 12, anchor: "middle"});
      // viz.css paints svg text ink over the fill attribute; restate each label's color inline
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
