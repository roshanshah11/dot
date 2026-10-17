// Translation on the ribosome: the mRNA is read 5' to 3' one codon at a time. Each tRNA's anticodon pairs antiparallel
// with the codon in the A site, a peptide bond moves the growing chain onto the newest amino acid, and translocation
// shifts the ribosome one codon (A -> P -> E). A stop codon has no tRNA: a release factor frees the chain.
// The variants are single-base changes to one short reading frame (GAG -> GUG is the sickle-cell change; UGG -> UGA is
// a nonsense mutation), so the amino acids, anticodons and stop position are all computed from the codons.
(function () {
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG", B = "UCAG";
  var NAME = {F: "Phe", L: "Leu", S: "Ser", Y: "Tyr", C: "Cys", W: "Trp", P: "Pro", H: "His", Q: "Gln", R: "Arg", I: "Ile", M: "Met",
              T: "Thr", N: "Asn", K: "Lys", V: "Val", A: "Ala", D: "Asp", E: "Glu", G: "Gly", "*": "stop"};
  var ORF = {normal: "AUG GAG AAA UGG GCU UAA", missense: "AUG GUG AAA UGG GCU UAA", nonsense: "AUG GAG AAA UGA GCU UAA"};
  var PAIR = {A: "U", U: "A", G: "C", C: "G"};
  function aa(codon) { return NAME[CODE[16 * B.indexOf(codon[0]) + 4 * B.indexOf(codon[1]) + B.indexOf(codon[2])]]; }
  function model(v) {
    var codons = ORF[v.variant].split(" "), names = codons.map(aa), stop = names.indexOf("stop") + 1;   // 1-based stop codon
    var s = v.step || 1, p = s <= 3 ? 1 : s === 4 ? 2 : stop - 1;                                         // codon in the P site
    var chain = s === 1 || s === 2 ? 1 : s === 3 ? 2 : s === 4 ? 2 : stop - 1;                            // amino acids joined so far
    return {codons: codons, names: names, stop: stop, p: p, chain: names.slice(0, chain), protein: names.slice(0, stop - 1)};
  }
  function anti(codon) { return codon.split("").map(function (b) { return PAIR[b]; }).join(""); }   // written 3' -> 5' under the codon

  Viz.register("mrna-translation", {
    title: "Translation: mRNA to protein",
    subject: "biology",
    shows: "Step the ribosome along the mRNA: tRNAs pair with each codon, the chain moves onto the newest amino acid, and a stop codon ends it; try a one-base mutation",
    params: {
      variant: {kind: "enum", values: ["normal", "missense", "nonsense"], default: "normal", label: "\\text{mRNA}"}
    },
    steps: ["initiation at AUG", "a tRNA enters the A site", "peptide bond forms", "translocation", "elongation repeats", "termination at the stop codon"],
    stepMs: 1700,
    formula: function (v) {
      var m = model(v);
      return "\\begin{array}{l}5'\\,\\texttt{" + m.codons.join("\\,") + "}\\,3'\\\\ \\to\\ \\text{" + m.protein.join("-") + "}\\ (" + m.protein.length + "\\text{ aa})\\end{array}";
    },
    status: function (v) {
      var m = model(v), s = v.step || 1, c2 = m.codons[1];
      if (s === 1) return "The initiator tRNA carrying <b>Met</b> pairs with the start codon AUG in the P site, and the large subunit closes over it.";
      if (s === 2) return "The tRNA whose anticodon (3′-" + anti(c2) + "-5′) pairs with codon <b>" + c2 + "</b> brings <b>" + m.names[1] + "</b> into the A site.";
      if (s === 3) return "A peptide bond moves Met onto " + m.names[1] + ", so the A-site tRNA now holds the chain <b>" + m.chain.join("-") + "</b>.";
      if (s === 4) return "The ribosome shifts one codon toward 3′: the empty tRNA moves to the E site and leaves, and codon <b>" + m.codons[2] + "</b> waits in the A site.";
      if (s === 5) return "Repeating that cycle once per codon builds <b>" + m.chain.join("-") + "</b>, and stop codon <b>" + m.codons[m.stop - 1] + "</b> reaches the A site.";
      var lead = "No tRNA pairs with " + m.codons[m.stop - 1] + ", so a release factor takes the A site and lets go of ";
      if (v.variant === "nonsense") return lead + "a protein cut short at <b>" + m.protein.length + "</b> amino acids, because UGG became the stop codon UGA.";
      if (v.variant === "missense") return lead + "a full-length protein with <b>Val</b> where Glu belongs, because GAG became GUG.";
      return lead + "the finished <b>" + m.protein.length + "-amino-acid</b> protein.";
    },
    examples: [
      {name: "normal, finished", values: {variant: "normal", step: 6}},
      {name: "missense: Glu to Val", values: {variant: "missense", step: 3}},
      {name: "nonsense: early stop", values: {variant: "nonsense", step: 6}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, m = model(v), s = v.step || 1, p = m.p;
      var cx = function (i) { return 95 + (i - 1) * 48; }, yC = 236, yAn = 214, mut = {missense: 2, nonsense: 4}[v.variant];
      // ribosome: E, P, A sites over codons p-1, p, p+1; the subunits part at termination
      var rx0 = cx(p - 1) - 25, rw = 150, lift = s === 6 ? 14 : 0;
      api.rect(rx0, 112 - lift, rw, 106, {rx: 42, fill: c.muted, fillOpacity: 0.13, stroke: c.faint, width: 1.2});
      api.rect(rx0 + 8, 222 + lift / 2, rw - 16, 44, {rx: 20, fill: c.muted, fillOpacity: 0.13, stroke: c.faint, width: 1.2});
      api.label([rx0 + (rx0 > 120 ? -8 : rw + 8), 128 - lift], "ribosome", {color: c.muted, size: 12, anchor: rx0 > 120 ? "end" : "start"});
      ["E", "P", "A"].forEach(function (t, k) { api.label([cx(p - 1 + k), 258 + lift / 2], t, {color: c.muted, size: 12, weight: 650, anchor: "middle"}); });
      // the mRNA: 5' leader, six codons, 3' end
      api.line([24, 247], [372, 247], {color: c.c3, width: 2.5});
      api.label([18, 236], "5′", {color: c.c3, size: 12.5, weight: 650});
      api.label([52, 236], "···", {color: c.c3, size: 12.5, anchor: "middle"});
      api.label([388, 236], "3′", {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
      m.codons.forEach(function (cod, i) {
        var read = i + 1 <= m.stop, x = cx(i + 1);
        cod.split("").forEach(function (b, j) {
          api.label([x + (j - 1) * 13, yC], b, {color: c.c3, size: 13.5, weight: 700, anchor: "middle", opacity: read ? 1 : 0.4});
        });
        if (i + 1 === mut) api.rect(x - 22, yC - 11, 44, 22, {rx: 5, stroke: c.c6, width: 1.4, dash: "3 2"});
      });
      if (mut && s === 1) api.label([cx(mut), 284], "mutated codon", {color: c.c6, size: 12, anchor: "middle"});
      // a tRNA in a site: stem, body, anticodon paired base by base with the codon underneath
      function trna(i, opts) {
        var x = cx(i) + (opts.dx || 0), dy = opts.dy || 0, g = api.group({opacity: opts.fade ? 0.45 : 1});
        api.rect(x - 4, 146 + dy, 8, 22, {rx: 3, fill: c.c2, fillOpacity: 0.85, parent: g});
        api.rect(x - 17, 166 + dy, 34, 38, {rx: 10, fill: c.c2, fillOpacity: 0.22, stroke: c.c2, width: 1.6, parent: g});
        anti(m.codons[i - 1]).split("").forEach(function (b, j) {
          api.label([x + (j - 1) * 13, yAn + dy], b, {color: c.c2, size: 13, weight: 700, anchor: "middle", parent: g});
          if (!dy) api.line([x + (j - 1) * 13, 221], [x + (j - 1) * 13, 228], {color: c.ink, width: 1.3, opacity: 0.7, parent: g});
        });
        return [x, 140 + dy];
      }
      function chain(top, names, dir) {   // newest amino acid on the tRNA, older ones trail up and away
        var pts = names.map(function (n, j) { var k = names.length - 1 - j; return [top[0] + dir * 27 * k, top[1] - 25 * k]; });
        for (var j = 1; j < pts.length; j++) api.line(pts[j - 1], pts[j], {color: c.c4, width: 2.5});
        pts.forEach(function (q, j) {
          api.rect(q[0] - 19, q[1] - 11, 38, 22, {rx: 11, fill: c.card}); api.rect(q[0] - 19, q[1] - 11, 38, 22, {rx: 11, fill: c.c4, fillOpacity: 0.25, stroke: c.c4, width: 1.6});
          api.label(q, names[j], {color: c.ink, size: 12, weight: 650, anchor: "middle"});
        });
        return pts;
      }
      var lead = p >= 4 ? -1 : 1;   // trail the chain toward whichever side has room
      if (s === 4 || s === 5) trna(p - 1, {fade: true, dx: -10, dy: -10});                  // empty tRNA in the E site, on its way out
      var P = trna(p, {});
      api.label([cx(p) - 22, yAn], "3′", {color: c.c2, size: 12, weight: 650, anchor: "end"});   // anticodon runs 3' -> 5', antiparallel
      if (s !== 2 && s !== 3) api.label([cx(p) + 20, yAn], "5′", {color: c.c2, size: 12, weight: 650});   // (no room beside an A-site tRNA)
      if (s <= 2) api.label([cx(1) - 22, 186], "tRNA", {color: c.c2, size: 12, weight: 650, anchor: "end"});
      if (s === 1) chain(P, ["Met"], 1);
      if (s === 2) { chain(P, ["Met"], 1); chain(trna(2, {}), [m.names[1]], 1); }
      if (s === 3) {
        var A = trna(2, {});
        chain(A, m.chain, -1);
        api.label([172, 98], "peptide bond", {color: c.c6, size: 12.5, weight: 650});
        api.line([170, 104], [137, 124], {color: c.c6, width: 1.5, arrow: true});
      }
      if (s === 4 || s === 5) chain(P, m.chain, lead);
      if (s === 4) api.label([cx(p + 1), 190], "empty", {color: c.muted, size: 12, anchor: "middle"});
      if (s === 5) api.label([cx(p + 1), 190], "stop", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      if (s === 2 || s === 4 || s === 5) api.rect(cx(p + 1) - 21, yC - 12, 42, 24, {rx: 5, stroke: s === 5 ? c.c5 : c.ink, width: 1.3, dash: "4 3"});
      if (s === 6) {
        var ax = cx(p + 1);   // release factor fills the A site
        api.rect(ax - 17, 150, 34, 56, {rx: 8, fill: c.c5, fillOpacity: 0.3, stroke: c.c5, width: 1.6});
        api.label([ax, 178], "RF", {color: c.c5, size: 12.5, weight: 700, anchor: "middle"});
        m.protein.forEach(function (n, j) {   // the freed chain, N-terminus (Met) first; bonds run pill edge to pill edge
          var q = [44 + j * 44, 58];
          if (j) api.line([q[0] - 44 + 19, 58], [q[0] - 19, 58], {color: c.c4, width: 2.5});
          api.rect(q[0] - 19, q[1] - 11, 38, 22, {rx: 11, fill: c.card}); api.rect(q[0] - 19, q[1] - 11, 38, 22, {rx: 11, fill: c.c4, fillOpacity: 0.25, stroke: c.c4, width: 1.6});
          api.label(q, n, {color: c.ink, size: 12, weight: 650, anchor: "middle"});
        });
        api.label([27, 28], "released protein: " + m.protein.length + " amino acids", {color: c.c4, size: 12.5, weight: 650});
      }
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
