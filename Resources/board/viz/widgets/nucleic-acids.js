// The nucleic acid family: polymers of nucleotides (phosphate + five-carbon sugar + base) joined 3' to 5' by
// phosphodiester bonds. DNA: deoxyribose, bases A T G C, two antiparallel strands paired A-T and G-C; stores the genes
// (about 3.1 billion base pairs per human genome copy). Three RNAs, all ribose with U in place of T, single-stranded
// but folded where they pair with themselves: mRNA carries one gene's message (5' cap, 5' UTR, codons from AUG to a stop,
// 3' UTR, poly(A) tail); tRNA (about 76 nt, cloverleaf) is the adaptor, its anticodon pairing with a codon and its 3'
// CCA end carrying the amino acid (here tRNA-Phe: anticodon 5'-GAA-3' reads codon 5'-UUC-3'); rRNA is most of the
// ribosome and about 80% of a cell's RNA, and the large subunit's rRNA catalyses peptide bonds (eukaryotes: 28S, 5.8S and
// 5S in the large subunit, 18S in the small; bacteria 23S + 5S and 16S). Colors: A green, T red, U purple, G amber,
// C blue; teal = backbone.
(function () {
  var INFO = {
    DNA: {strands: 2, sugar: "deoxyribose", bases: "A, T, G, C", job: "stores genes", tex: "\\{A,T,G,C\\}"},
    mRNA: {strands: 1, sugar: "ribose", bases: "A, U, G, C", job: "carries a message", tex: "\\{A,U,G,C\\}"},
    tRNA: {strands: 1, sugar: "ribose", bases: "A, U, G, C", job: "brings amino acids", tex: "\\{A,U,G,C\\}"},
    rRNA: {strands: 1, sugar: "ribose", bases: "A, U, G, C", job: "builds ribosomes", tex: "\\{A,U,G,C\\}"}
  };
  var KEYS = ["DNA", "mRNA", "tRNA", "rRNA"];
  function baseColor(c, b) { return {A: c.c4, T: c.c5, U: c.c6, G: c.c3, C: c.c2}[b] || c.muted; }
  var COMP = {A: "T", T: "A", G: "C", C: "G"};
  Viz.register("nucleic-acids", {
    title: "Nucleic acids: DNA and the three RNAs",
    subject: "biology",
    shows: "Switch between DNA, mRNA, tRNA and rRNA: all are chains of nucleotides, but DNA is a double-stranded deoxyribose store of genes while the single-stranded ribose RNAs carry the message, bring the amino acids and build the ribosome",
    params: {
      molecule: {kind: "enum", values: KEYS, default: "DNA", label: "\\text{molecule}"}
    },
    formula: function (v) {
      var x = INFO[v.molecule];
      return "\\begin{array}{l}\\text{" + v.molecule + "}:\\ \\text{" + x.sugar + "},\\ " + x.tex + "\\\\ " + x.strands + "\\ \\text{strand" + (x.strands > 1 ? "s" : "") + "},\\ \\text{" + x.job + "}\\end{array}";
    },
    status: function (v) {
      return {
        DNA: "<b>DNA</b> stores the genes: two antiparallel deoxyribose strands held together by A–T and G–C pairs, about <b>3.1 billion</b> base pairs per human genome copy.",
        mRNA: "<b>mRNA</b> carries one gene's message to the ribosome: codons from AUG to a stop, between a protective 5′ cap and a poly(A) tail.",
        tRNA: "<b>tRNA</b> is the adaptor: about <b>76</b> nucleotides folded into a cloverleaf, whose anticodon pairs with a codon while its 3′ end carries the matching amino acid.",
        rRNA: "<b>rRNA</b> is most of the ribosome and about <b>80%</b> of a cell's RNA, and the large subunit's rRNA itself forms the peptide bonds."
      }[v.molecule];
    },
    examples: [
      {name: "DNA double helix", values: {molecule: "DNA"}},
      {name: "mRNA message", values: {molecule: "mRNA"}},
      {name: "tRNA adaptor", values: {molecule: "tRNA"}},
      {name: "rRNA in the ribosome", values: {molecule: "rRNA"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = v.molecule;
      var nt = function (at, b, o) { o = o || {}; api.rect(at[0] - 8, at[1] - 9, 16, 18, {fill: baseColor(c, b), fillOpacity: 0.85, rx: 3}); api.label([at[0], at[1] + 0.5], b, {color: c.card, size: 12, weight: 800, anchor: "middle"}); };
      if (m === "DNA") {
        var seq = "ATGCGTACCAGT", x0 = 46, dx = 27, yT = 64, yB = 132;
        api.line([x0 - 14, yT - 16], [x0 + 11 * dx + 14, yT - 16], {color: c.c1, width: 4});
        api.line([x0 - 14, yB + 16], [x0 + 11 * dx + 14, yB + 16], {color: c.c1, width: 4});
        for (var i = 0; i < seq.length; i++) {
          var x = x0 + i * dx, b = seq[i], p = COMP[b], gc = b === "G" || b === "C";
          api.line([x, yT - 16], [x, yT - 9], {color: c.c1, width: 2}); api.line([x, yB + 9], [x, yB + 16], {color: c.c1, width: 2});
          nt([x, yT], b); nt([x, yB], p);
          for (var h = 0; h < (gc ? 3 : 2); h++) { var hx = x + (h - (gc ? 1 : 0.5)) * 5; api.line([hx, yT + 13], [hx, yB - 13], {color: c.muted, width: 1.2, dash: "3 3"}); }
        }
        api.label([18, yT - 16], "5′", {color: c.c1, size: 12.5, weight: 700}); api.label([382, yT - 16], "3′", {color: c.c1, size: 12.5, weight: 700, anchor: "end"});
        api.label([18, yB + 16], "3′", {color: c.c1, size: 12.5, weight: 700}); api.label([382, yB + 16], "5′", {color: c.c1, size: 12.5, weight: 700, anchor: "end"});
        api.label([200, 22], "two antiparallel strands, deoxyribose backbone", {color: c.c1, size: 12, anchor: "middle"});
        api.label([200, 174], "A–T: 2 hydrogen bonds   G–C: 3   (twists into a double helix)", {color: c.muted, size: 12, anchor: "middle"});
      } else if (m === "mRNA") {
        var y = 96, cod = ["AUG", "GCU", "UUC", "AAA", "UGG", "UAA"];
        api.circle([28, y], 14, {fill: c.c1, fillOpacity: 0.25, stroke: c.c1, width: 1.6});
        api.label([28, y], "m^7G", {color: c.c1, size: 12, weight: 700, anchor: "middle"});
        api.label([28, y + 28], "5′ cap", {color: c.c1, size: 12, anchor: "middle"});
        api.line([42, y], [62, y], {color: c.c1, width: 3});
        api.label([52, y - 18], "UTR", {color: c.muted, size: 12, anchor: "middle"});
        cod.forEach(function (k, j) {
          var cx = 84 + j * 40;
          api.rect(cx - 19, y - 13, 38, 26, {fill: j === 5 ? c.c5 : c.ink, fillOpacity: j === 5 ? 0.2 : 0.06, stroke: j === 0 ? c.c4 : j === 5 ? c.c5 : null, width: 1.4, rx: 4});
          for (var q = 0; q < 3; q++) api.label([cx - 11 + q * 11, y + 0.5], k[q], {color: baseColor(c, k[q]), size: 12.5, weight: 750, anchor: "middle"});
        });
        api.label([84, y - 24], "start", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
        api.label([284, y - 24], "stop", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
        api.label([184, y + 28], "codons, read 5′ → 3′", {color: c.ink, size: 12, anchor: "middle"});
        api.line([304, y], [322, y], {color: c.c1, width: 3});
        api.label([313, y - 18], "UTR", {color: c.muted, size: 12, anchor: "middle"});
        api.label([358, y], "AAAAAA", {color: c.c4, size: 12, weight: 700, anchor: "middle"});
        api.label([358, y + 28], "poly(A) tail 3′", {color: c.c4, size: 12, anchor: "middle"});
        api.label([200, 30], "one strand, ribose backbone, U instead of T", {color: c.c1, size: 12, anchor: "middle"});
        api.label([200, 168], "made in the nucleus, read by ribosomes in the cytoplasm", {color: c.muted, size: 12, anchor: "middle"});
      } else if (m === "tRNA") {
        var cx0 = 140, T = c.c1, stem = function (xa, ya, xb, yb) { api.line(xa, ya, {color: T, width: 3}); api.line(xb, yb, {color: T, width: 3}); };
        // acceptor stem (top), its 5' end and the 3' CCA end carrying the amino acid
        stem([cx0 - 7, 34], [cx0 - 7, 86], [cx0 + 7, 30], [cx0 + 7, 86]);
        for (var r = 0; r < 5; r++) api.line([cx0 - 5, 42 + r * 9], [cx0 + 5, 42 + r * 9], {color: c.muted, width: 1.3});
        api.label([cx0 - 12, 30], "5′", {color: T, size: 12, weight: 700, anchor: "end"});
        api.label([cx0 + 12, 24], "3′ CCA", {color: T, size: 12, weight: 700});
        api.line([cx0 + 60, 24], [cx0 + 72, 24], {color: c.c3, width: 2});
        api.circle([cx0 + 87, 24], 14, {fill: c.c3, fillOpacity: 0.9}); api.label([cx0 + 87, 24.5], "Phe", {color: c.card, size: 12, weight: 800, anchor: "middle"});
        api.label([cx0 + 106, 24], "amino acid", {color: c.c3, size: 12, weight: 650});
        // D arm (left) and T arm (right) off the central junction
        api.line([cx0 - 7, 86], [cx0 - 38, 92], {color: T, width: 3}); api.circle([cx0 - 53, 92], 15, {stroke: T, width: 2.5});
        api.line([cx0 + 7, 86], [cx0 + 38, 92], {color: T, width: 3}); api.circle([cx0 + 53, 92], 15, {stroke: T, width: 2.5});
        api.label([cx0 - 53, 118], "D arm", {color: c.muted, size: 12, anchor: "middle"});
        api.label([cx0 + 53, 118], "T arm", {color: c.muted, size: 12, anchor: "middle"});
        // anticodon arm and loop; the anticodon 3'-AAG-5' (written 5'-GAA-3') pairs with the codon 5'-UUC-3' (Phe)
        stem([cx0 - 7, 86], [cx0 - 7, 124], [cx0 + 7, 86], [cx0 + 7, 124]);
        for (var r2 = 0; r2 < 3; r2++) api.line([cx0 - 5, 100 + r2 * 9], [cx0 + 5, 100 + r2 * 9], {color: c.muted, width: 1.3});
        api.path("M " + (cx0 - 7) + " 124 C " + (cx0 - 40) + " 130 " + (cx0 - 40) + " 152 " + (cx0 - 20) + " 152 H " + (cx0 + 20) + " C " + (cx0 + 40) + " 152 " + (cx0 + 40) + " 130 " + (cx0 + 7) + " 124", {stroke: T, width: 3});
        ["A", "A", "G"].forEach(function (b, j) { nt([cx0 - 18 + j * 18, 152], b); });
        api.label([cx0 - 34, 152], "3′", {color: c.muted, size: 12, anchor: "end"}); api.label([cx0 + 34, 152], "5′", {color: c.muted, size: 12});
        api.label([cx0 + 54, 152], "anticodon", {color: c.ink, size: 12, weight: 650});
        api.line([cx0 - 28, 181], [cx0 + 28, 181], {color: c.muted, width: 2});
        ["U", "U", "C"].forEach(function (b, j) { api.line([cx0 - 18 + j * 18, 162], [cx0 - 18 + j * 18, 171], {color: c.muted, width: 1.2, dash: "2 2"}); nt([cx0 - 18 + j * 18, 181], b); });
        api.label([cx0 - 34, 181], "5′", {color: c.muted, size: 12, anchor: "end"}); api.label([cx0 + 34, 181], "3′", {color: c.muted, size: 12});
        api.label([cx0 + 54, 181], "codon on the mRNA", {color: c.muted, size: 12});
        api.label([316, 72], "≈ 76 nucleotides", {color: T, size: 12, weight: 650, anchor: "middle"});
        api.label([316, 90], "one strand folded", {color: c.muted, size: 12, anchor: "middle"});
        api.label([316, 106], "into a cloverleaf", {color: c.muted, size: 12, anchor: "middle"});
      } else {
        // ribosome: large and small subunit, rRNA folded through both, mRNA threaded between
        api.path("M 70 112 C 60 40 140 22 200 26 C 270 22 342 44 330 112 Z", {fill: c.c1, fillOpacity: 0.12, stroke: c.c1, width: 2});
        api.path("M 92 124 C 110 172 290 172 308 124 Z", {fill: c.c1, fillOpacity: 0.12, stroke: c.c1, width: 2});
        var wig = function (x0, y0, w, amp, n) { var pts = []; for (var t = 0; t <= n; t++) pts.push([x0 + w * t / n, y0 + amp * Math.sin(t * 1.7) + (t % 3 === 0 ? amp * 0.6 : 0)]); api.polyline(pts, {stroke: c.c6, width: 1.8}); };
        wig(98, 58, 204, 9, 34); wig(92, 84, 216, 10, 36); wig(120, 140, 160, 7, 26);
        api.line([24, 118], [376, 118], {color: c.muted, width: 3});
        api.label([28, 104], "mRNA", {color: c.muted, size: 12});
        api.circle([200, 98], 8, {fill: c.c3, fillOpacity: 0.9});
        api.line([207, 103], [318, 136], {color: c.c3, width: 1.4});
        api.label([392, 146], "peptide bonds", {color: c.c3, size: 12, weight: 650, anchor: "end"});
        api.label([392, 161], "form here", {color: c.c3, size: 12, weight: 650, anchor: "end"});
        api.label([200, 14], "large subunit: 28S + 5.8S + 5S rRNA", {color: c.c6, size: 12, weight: 650, anchor: "middle"});
        api.label([200, 180], "small subunit: 18S rRNA (human ribosome)", {color: c.c6, size: 12, weight: 650, anchor: "middle"});
      }
      // the family at a glance
      api.line([8, 196], [392, 196], {color: c.grid, width: 1});
      KEYS.forEach(function (k, i) {
        var x = 8 + i * 97, on = k === m, d = INFO[k];
        api.rect(x, 206, 91, 84, {fill: on ? c.c1 : c.ink, fillOpacity: on ? 0.14 : 0.04, stroke: on ? c.c1 : null, width: 1.6, rx: 8});
        api.label([x + 8, 222], k, {color: on ? c.ink : c.muted, size: 13, weight: 750});
        api.label([x + 8, 240], d.strands + " strand" + (d.strands > 1 ? "s" : ""), {color: on ? c.ink : c.muted, size: 12});
        api.label([x + 8, 256], d.sugar, {color: on ? c.ink : c.muted, size: 12});
        api.label([x + 8, 273], d.bases.replace(/, /g, " "), {color: on ? c.ink : c.muted, size: 12});
      });
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
