// A nonsense mutation turns a sense codon into a stop (UAA, UAG, UGA), so translation ends early. Where the premature
// stop sits decides what happens: a stop more than about 50 nt before the last exon-exon junction marks the mRNA for
// nonsense-mediated decay (NMD), so little or no protein is made; a stop past that point escapes NMD and a shortened
// chain is made. The gene is real: human beta-globin (HBB, NM_000518.5), 146 residues numbered the traditional way
// (initiator Met = codon 0, so codon n is c.3n+1..3n+3). Exon 1 ends at c.92, exon 2 at c.315, exon 3 runs to the stop
// TAA at c.442-444. NMD is called when 315 - (3n + 3) > 50, i.e. a stop at codon 87 or earlier. Known examples:
// codon 17 AAG -> TAG and codon 39 CAG -> TAG (beta0-thalassemia), codon 121 GAA -> TAA (dominant beta-thalassemia:
// the short chains are made and precipitate), codon 145 TAT -> TAA (Hb McKees Rocks, high oxygen affinity).
// Colors: amber = the stop, red = NMD (mRNA destroyed), teal = the part of the chain that is made, muted = what is lost.
(function () {
  var CDS = "ATGGTGCATCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGTGGTGAGGCCCTGGGCAGGCTGCTGGTGGTCTACCCTTGG" +
    "ACCCAGAGGTTCTTTGAGTCCTTTGGGGATCTGTCCACTCCTGATGCTGTTATGGGCAACCCTAAGGTGAAGGCTCATGGCAAGAAAGTGCTCGGTGCCTTTAGTGATGGCCTGGCTCAC" +
    "CTGGACAACCTCAAGGGCACCTTTGCCACACTGAGTGAGCTGCACTGTGACAAGCTGCACGTGGATCCTGAGAACTTCAGGCTCCTGGGCAACGTGCTGGTCTGTGTGCTGGCCCATCAC" +
    "TTTGGCAAAGAATTCACCCCACCAGTGCAGGCTGCCTATCAGAAAGTGGTGGCTGGTGTGGCTAATGCCCTGGCCCACAAGTATCACTAA";
  var B = "TCAG", CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG", EX1 = 92, EX2 = 315, LEN = 146;
  var NAME = {A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met",
    F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop"};
  var KNOWN = {17: "a common β⁰-thalassemia allele in Southeast Asia", 39: "the common Mediterranean β⁰-thalassemia allele",
    121: "a cause of dominant β-thalassemia: the short chains are made and precipitate", 145: "Hb McKees Rocks: the chain lacks only its last two residues and holds oxygen too tightly"};
  function aa(c) { return CODE[16 * B.indexOf(c[0]) + 4 * B.indexOf(c[1]) + B.indexOf(c[2])]; }
  function model(v) {
    var n = v.codon, cod = CDS.substr(3 * n, 3), best = 3, to = [];
    ["TAA", "TAG", "TGA"].forEach(function (s) {
      var d = 0; for (var i = 0; i < 3; i++) if (s[i] !== cod[i]) d++;
      if (d < best) { best = d; to = [s]; } else if (d === best) to.push(s);
    });
    var dist = EX2 - (3 * n + 3), exon = 3 * n + 3 <= EX1 ? "1" : 3 * n + 1 > EX2 ? "3" : 3 * n + 1 > EX1 ? "2" : "1–2";
    return {n: n, cod: cod, a: aa(cod), steps: best, to: to, dist: dist, nmd: dist > 50, made: n - 1, exon: exon};
  }

  Viz.register("mutation-nonsense-premature-stop", {
    title: "Nonsense mutation: a premature stop",
    subject: "biology",
    shows: "Slide a premature stop codon along the beta-globin gene: the chain is cut short at that codon, and a stop well before the last exon junction gets the mRNA destroyed by nonsense-mediated decay",
    params: {
      codon: {kind: "integer", default: 39, min: 1, max: 146, label: "\\text{codon } n"}
    },
    formula: function (v) {
      var r = model(v);
      return "\\begin{array}{l}\\text{chain}=n-1=" + r.made + "\\text{ of }" + LEN + "\\\\ d=315-(3n+3)=" + r.dist + "\\text{ nt}\\\\ " +
        (r.nmd ? "d>50\\Rightarrow\\text{NMD}" : "d\\le 50\\Rightarrow\\text{no NMD}") + "\\end{array}";
    },
    status: function (v) {
      var r = model(v), k = KNOWN[r.n] ? " (" + r.cod + " → " + r.to[0] + " here is " + KNOWN[r.n] + ")" : "";
      if (r.nmd) return "A stop at codon " + r.n + " sits " + r.dist + " nt before the last exon junction, so <b>nonsense-mediated decay</b> destroys the mRNA and almost no β chain is made" + k + ".";
      if (LEN - r.made <= 6) return "A stop at codon " + r.n + " is past the NMD boundary and near the end: the β chain is made with <b>" + r.made + " of 146</b> residues, missing only the last " + (LEN - r.made) + k + ".";
      return "A stop at codon " + r.n + " is past the NMD boundary (exon " + r.exon + "), so the mRNA is translated into a <b>shortened β chain of " + r.made + "</b> residues, missing the last " + (LEN - r.made) + k + ".";
    },
    examples: [
      {name: "codon 39 (β⁰-thalassemia)", values: {codon: 39}},
      {name: "codon 17", values: {codon: 17}},
      {name: "last codon that triggers NMD", values: {codon: 87}},
      {name: "first codon that escapes NMD", values: {codon: 88}},
      {name: "codon 121 (dominant)", values: {codon: 121}},
      {name: "codon 145 (Hb McKees Rocks)", values: {codon: 145}},
      {name: "codon 1", values: {codon: 1}},
      {name: "codon 146", values: {codon: 146}}
    ],
    size: [400, 306],
    draw: function (api, v) {
      var c = api.color, r = model(v), x0 = 20, x1 = 380, nx = function (q) { return x0 + (x1 - x0) * q / 444; };
      // the coding part of the mRNA, in three exons
      api.label([8, 12], "HBB mRNA, coding part (444 nt) in 3 exons", {color: c.muted, size: 12});
      var yE = 70, ex = [[1, EX1], [EX1 + 1, EX2], [EX2 + 1, 444]];
      ex.forEach(function (e, i) {
        api.rect(nx(e[0] - 1) + (i ? 1.5 : 0), yE - 11, nx(e[1]) - nx(e[0] - 1) - (i ? 1.5 : 0) - (i < 2 ? 1.5 : 0), 22, {fill: c.ink, fillOpacity: 0.12, stroke: c.muted, width: 1, rx: 4});
        api.label([(nx(e[0]) + nx(e[1])) / 2, yE], "exon " + (i + 1), {color: c.muted, size: 12, anchor: "middle"});
      });
      // the NMD rule: a band under the exons, red where a stop triggers decay
      var cut = nx(EX2 - 50);
      api.rect(x0, yE + 18, cut - x0, 8, {fill: c.c5, fillOpacity: 0.55, rx: 3});
      api.rect(cut, yE + 18, x1 - cut, 8, {fill: c.c1, fillOpacity: 0.55, rx: 3});
      api.line([nx(EX2), yE - 14], [nx(EX2), yE + 32], {color: c.muted, width: 1.2, dash: "3 3"});
      api.label([x0, yE + 40], "stop here: NMD", {color: c.c5, size: 12, weight: 600});
      api.label([x1, yE + 40], "escapes NMD", {color: c.c1, size: 12, weight: 600, anchor: "end"});
      api.label([cut, yE + 56], "boundary: 50 nt before the last exon junction", {color: c.muted, size: 12, anchor: "middle"});
      api.line([cut, yE + 16], [cut, yE + 46], {color: c.muted, width: 1});
      // the premature stop
      var sx = nx(3 * r.n + 2), oct = [];
      for (var q = 0; q < 8; q++) oct.push([sx + 9 * Math.cos(Math.PI / 8 + q * Math.PI / 4), yE - 26 + 9 * Math.sin(Math.PI / 8 + q * Math.PI / 4)]);
      api.line([sx, yE - 20], [sx, yE + 12], {color: c.c3, width: 2.5});
      api.polygon(oct, {fill: c.c3, fillOpacity: 1, stroke: c.card, width: 1.5});
      api.label([sx, yE - 44], "codon " + r.n, {color: c.c3, size: 12, weight: 700, anchor: "middle"});
      // the codon itself
      var line = r.steps === 1 ? r.cod + " → " + r.to.join(" or ") + " (" + NAME[r.a] + " → stop)" :
        r.cod + " (" + NAME[r.a] + "), " + r.steps + " base changes from any stop";
      api.label([8, 150], "codon " + r.n + ": " + line, {color: c.ink, size: 12.5, weight: 600});
      // the protein: what is made, what is lost
      var px = function (k) { return x0 + (x1 - x0) * k / LEN; }, yP = 194;
      api.label([8, 174], "β chain (146 residues)", {color: c.muted, size: 12});
      api.rect(x0, yP - 9, x1 - x0, 18, {stroke: c.muted, width: 1, dash: "3 3", rx: 5});
      if (r.made > 0) api.rect(x0, yP - 9, px(r.made) - x0, 18, {fill: c.c1, fillOpacity: r.nmd ? 0.18 : 0.85, rx: 5});
      api.rect(px(r.made) - 1.5, yP - 12, 3, 24, {fill: c.c3, rx: 1});
      [1, 50, 100, 146].forEach(function (t) { api.label([px(t - 0.5), yP + 22], String(t), {color: c.muted, size: 12, anchor: "middle"}); });
      // outcome
      var yO = 240;
      if (r.nmd) {
        api.label([8, yO], "mRNA destroyed by NMD", {color: c.c5, size: 13.5, weight: 700});
        api.label([8, yO + 22], "almost no β chain is made (the faint bar)", {color: c.ink, size: 12.5});
        api.label([8, yO + 44], "both copies like this: β⁰-thalassemia", {color: c.muted, size: 12.5});
      } else {
        api.label([8, yO], "mRNA translated: " + r.made + " of 146 residues made", {color: c.c1, size: 13.5, weight: 700});
        api.label([8, yO + 22], "last " + (LEN - r.made) + " residue" + (LEN - r.made === 1 ? "" : "s") + " missing", {color: c.ink, size: 12.5});
        api.label([8, yO + 44], LEN - r.made <= 6 ? "nearly whole: it may fold but work differently" : "short chains are often unstable", {color: c.muted, size: 12.5});
      }
      // viz.css paints svg text with the ink color; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
