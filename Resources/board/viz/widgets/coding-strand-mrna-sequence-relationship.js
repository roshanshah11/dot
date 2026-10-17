// The coding strand and the mRNA read the same, 5' to 3', except that RNA has U where DNA has T: the mRNA is built
// on the template strand, so it ends up a copy of the template's partner. Sequence: the first ten codons of human
// beta-globin (HBB), with the optional A to T change in codon 7 behind sickle-cell anemia (Glu6Val in the mature protein).
Viz.register("coding-strand-mrna-sequence-relationship", {
  title: "Coding strand and mRNA: same sequence, U for T",
  subject: "biology",
  shows: "Slide along the first codons of beta-globin: the mRNA matches the coding strand letter for letter, with U in place of T",
  params: {
    codon: {kind: "integer", default: 3, min: 1, max: 10, label: "\\text{codon}"},
    sickle: {kind: "boolean", default: false, label: "\\text{base 20}", on: "A→T (sickle)", off: "normal (A)"}
  },
  formula: function (v) {
    var dna = "ATGGTGCATCTGACTCCTGAGGAGAAGTCT"; if (v.sickle) dna = dna.slice(0, 19) + "T" + dna.slice(20);
    var cod = dna.substr((v.codon - 1) * 3, 3), rna = cod.replace(/T/g, "U");
    var code = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG", b = "UCAG";
    var names = {F: "Phe", L: "Leu", S: "Ser", Y: "Tyr", C: "Cys", W: "Trp", P: "Pro", H: "His", Q: "Gln", R: "Arg", I: "Ile", M: "Met", T: "Thr", N: "Asn", K: "Lys", V: "Val", A: "Ala", D: "Asp", E: "Glu", G: "Gly", "*": "stop"};
    var aa = names[code[16 * b.indexOf(rna[0]) + 4 * b.indexOf(rna[1]) + b.indexOf(rna[2])]];
    return "\\text{codon " + v.codon + ": }\\texttt{" + cod + "}\\xrightarrow{\\;T\\to U\\;}\\texttt{" + rna + "}\\to\\text{" + aa + "}";
  },
  status: function (v) {
    var dna = "ATGGTGCATCTGACTCCTGAGGAGAAGTCT"; if (v.sickle) dna = dna.slice(0, 19) + "T" + dna.slice(20);
    var cod = dna.substr((v.codon - 1) * 3, 3), rna = cod.replace(/T/g, "U");
    var code = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG", b = "UCAG";
    var names = {F: "Phe", L: "Leu", S: "Ser", Y: "Tyr", C: "Cys", W: "Trp", P: "Pro", H: "His", Q: "Gln", R: "Arg", I: "Ile", M: "Met", T: "Thr", N: "Asn", K: "Lys", V: "Val", A: "Ala", D: "Asp", E: "Glu", G: "Gly", "*": "stop"};
    var aa = names[code[16 * b.indexOf(rna[0]) + 4 * b.indexOf(rna[1]) + b.indexOf(rna[2])]];
    if (v.sickle && v.codon === 7) return "Codon 7 now reads <b>GTG</b> on the coding strand and <b>GUG</b> in the mRNA, so Glu becomes <b>Val</b>: the sickle-cell change (Glu6Val once Met is removed).";
    var t = (cod.match(/T/g) || []).length;
    return "Codon " + v.codon + " reads <b>" + cod + "</b> on the coding strand and <b>" + rna + "</b> in the mRNA, " +
      (t ? "the same letters with " + (t > 1 ? t + " Ts" : "the T") + " written as U, " : "letter for letter the same, ") + "and it codes for <b>" + aa + "</b>" + (v.codon === 1 ? ", the start codon." : ".");
  },
  examples: [
    {name: "start codon", values: {codon: 1}},
    {name: "sickle-cell codon", values: {codon: 7, sickle: true}},
    {name: "last codon shown", values: {codon: 10}}
  ],
  size: [400, 260],
  draw: function (api, v) {
    var c = api.color, dna = "ATGGTGCATCTGACTCCTGAGGAGAAGTCT";
    if (v.sickle) dna = dna.slice(0, 19) + "T" + dna.slice(20);
    var comp = {A: "T", T: "A", G: "C", C: "G"}, rna = dna.replace(/T/g, "U");
    var code = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG", b = "UCAG";
    var names = {F: "Phe", L: "Leu", S: "Ser", Y: "Tyr", C: "Cys", W: "Trp", P: "Pro", H: "His", Q: "Gln", R: "Arg", I: "Ile", M: "Met", T: "Thr", N: "Asn", K: "Lys", V: "Val", A: "Ala", D: "Asp", E: "Glu", G: "Gly", "*": "stop"};
    var x = function (i) { return 50 + i * 9.8 + Math.floor(i / 3) * 3.6; };
    var k = v.codon - 1, yC = 50, yT = 74, yR = 142, yA = 168;
    // the selected codon, through every row
    var bw = x(3 * k + 2) - x(3 * k) + 14;
    api.rect(x(3 * k) - 7, yC - 13, bw, yT - yC + 25, {rx: 6, fill: c.ink, fillOpacity: 0.07, stroke: c.ink, width: 1.2});
    api.rect(x(3 * k) - 7, yR - 13, bw, yA - yR + 25, {rx: 6, fill: c.ink, fillOpacity: 0.07, stroke: c.ink, width: 1.2});
    api.label([50, 28], "coding strand", {color: c.c1, size: 12.5, weight: 650});
    api.label([50, 94], "template strand: RNA polymerase reads this", {color: c.c2, size: 12});
    api.label([50, 122], "mRNA: copies the coding strand, U for T", {color: c.c3, size: 12});
    api.label([36, yC], "5′", {color: c.c1, size: 12, anchor: "end"}); api.label([384, yC], "3′", {color: c.c1, size: 12});
    api.label([36, yT], "3′", {color: c.c2, size: 12, anchor: "end"}); api.label([384, yT], "5′", {color: c.c2, size: 12});
    api.label([36, yR], "5′", {color: c.c3, size: 12, anchor: "end"}); api.label([384, yR], "3′", {color: c.c3, size: 12});
    for (var i = 0; i < 30; i++) {
      var mut = v.sickle && i === 19, sel = Math.floor(i / 3) === k;
      api.label([x(i), yC], dna[i], {color: mut ? c.c5 : c.c1, size: 13, weight: sel ? 750 : 550, anchor: "middle"});
      api.label([x(i), yT], comp[dna[i]], {color: mut ? c.c5 : c.c2, size: 13, weight: sel ? 750 : 450, anchor: "middle", opacity: sel ? 1 : 0.75});
      api.label([x(i), yR], rna[i], {color: mut ? c.c5 : c.c3, size: 13, weight: sel ? 750 : 550, anchor: "middle"});
      if (dna[i] === "T") { api.circle([x(i), yC + 10], 1.9, {fill: c.c6}); api.circle([x(i), yR + 10], 1.9, {fill: c.c6}); }
    }
    for (var j = 0; j < 10; j++) {
      var cod = rna.substr(j * 3, 3), aa = names[code[16 * b.indexOf(cod[0]) + 4 * b.indexOf(cod[1]) + b.indexOf(cod[2])]];
      api.label([x(3 * j + 1), yA], aa, {color: j === k ? c.ink : c.muted, size: 12, weight: j === k ? 700 : 450, anchor: "middle"});
    }
    // what the highlighted codon says
    var sc = dna.substr(3 * k, 3), sr = rna.substr(3 * k, 3), saa = names[code[16 * b.indexOf(sr[0]) + 4 * b.indexOf(sr[1]) + b.indexOf(sr[2])]];
    api.label([200, 212], "coding " + sc + "  →  mRNA " + sr + "  →  " + saa, {color: c.ink, size: 14, weight: 650, anchor: "middle"});
    api.label([200, 238], v.sickle ? "base 20 changed A → T (red): GAG → GUG, Glu → Val" : "purple dot: a T in DNA is a U in the mRNA",
      {color: v.sickle ? c.c5 : c.c6, size: 12, anchor: "middle"});
    // viz.css paints every svg text ink, over the fill attribute; restate each label's color inline
    api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
  }
});
