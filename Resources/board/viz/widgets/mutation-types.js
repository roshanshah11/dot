// The five classic gene mutations on one made-up gene (coding strand 5' -> 3'; mRNA is the same with U for T):
// ATG GCT GAG TGG GTC GCT AAG ATA GTC TAA = Met Ala Glu Trp Val Ala Lys Ile Val, stop. Three substitutions change one base
// (silent GCT -> GCC, still Ala; missense GAG -> GTG, Glu -> Val, the same codon change as sickle-cell beta-globin;
// nonsense TGG -> TAG, a stop), one insertion adds a C after base 7 and one deletion removes base 8. One extra or missing
// base is not a multiple of 3, so every codon after it is read in a new frame until a stop turns up. Every row is
// translated live with the standard code; residues that differ from normal are purple. The panel at the bottom runs all
// five on the same gene so the sizes of the effects can be compared.
(function () {
  var GENE = "ATGGCTGAGTGGGTCGCTAAGATAGTCTAA", UTR = "GCATGACC", B = "TCAG", FULL = GENE + UTR, N0 = 9;
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var NAME = {A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met",
    F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop"};
  var TYPES = ["silent-substitution", "missense-substitution", "nonsense-substitution", "insertion", "deletion"];
  var SHORT = {"silent-substitution": "silent", "missense-substitution": "missense", "nonsense-substitution": "nonsense", insertion: "insertion", deletion: "deletion"};
  var EDIT = {"silent-substitution": {sub: 18, b: "C"}, "missense-substitution": {sub: 8, b: "T"}, "nonsense-substitution": {sub: 11, b: "A"},
              insertion: {ins: 7, b: "C"}, deletion: {del: 8}};   // positions are 1-based bases of the coding strand
  function aa(c) { return CODE[16 * B.indexOf(c[0]) + 4 * B.indexOf(c[1]) + B.indexOf(c[2])]; }
  function rna(s) { return s.replace(/T/g, "U"); }
  function translate(seq) { var p = ""; for (var i = 0; i + 3 <= seq.length; i += 3) { var a = aa(seq.substr(i, 3)); if (a === "*") return {p: p, stop: i / 3}; p += a; } return {p: p, stop: -1}; }
  var NORMAL = translate(FULL).p;
  function mutate(t) {
    var e = EDIT[t], seq, mark = -1, gap = -1;
    if (e.sub) { seq = FULL.slice(0, e.sub - 1) + e.b + FULL.slice(e.sub); mark = e.sub - 1; }
    else if (e.ins) { seq = FULL.slice(0, e.ins) + e.b + FULL.slice(e.ins); mark = e.ins; }
    else { seq = FULL.slice(0, e.del - 1) + FULL.slice(e.del); gap = e.del - 1; }
    var tr = translate(seq), diff = [];
    for (var i = 0; i < tr.p.length; i++) diff.push(tr.p[i] !== NORMAL[i]);
    return {seq: seq, mark: mark, gap: gap, p: tr.p, stop: tr.stop, diff: diff, nDiff: diff.filter(Boolean).length, e: e};
  }

  Viz.register("mutation-types", {
    title: "Types of gene mutation",
    subject: "biology",
    shows: "Pick a mutation type and watch the same gene change: a substitution alters one codon (silent, missense or nonsense), while inserting or deleting one base shifts the reading frame and garbles everything after it",
    params: {
      initial_mutation: {kind: "enum", values: TYPES, default: "missense-substitution", label: "\\text{type}",
        names: {"silent-substitution": "silent", "missense-substitution": "missense", "nonsense-substitution": "nonsense", insertion: "insertion", deletion: "deletion"}}
    },
    formula: function (v) {
      var t = v.initial_mutation, m = mutate(t), e = m.e, len = "\\\\ \\text{protein: }" + N0 + "\\to" + m.p.length + "\\ \\text{aa}";
      if (e.sub) {
        var k = Math.floor((e.sub - 1) / 3), oc = FULL.substr(3 * k, 3), nc = m.seq.substr(3 * k, 3);
        return "\\begin{array}{l}\\texttt{" + rna(oc) + "}\\to\\texttt{" + rna(nc) + "}:\\ \\text{" + NAME[aa(oc)] + "}\\to\\text{" + NAME[aa(nc)] + "}" + len + "\\end{array}";
      }
      return "\\begin{array}{l}" + (e.ins ? "+1" : "-1") + "\\ \\text{base}:\\ 1\\bmod 3\\neq0\\Rightarrow\\text{frameshift}" + len + "\\end{array}";
    },
    status: function (v) {
      var t = v.initial_mutation, m = mutate(t), e = m.e;
      if (e.sub) {
        var k = Math.floor((e.sub - 1) / 3), oc = rna(FULL.substr(3 * k, 3)), nc = rna(m.seq.substr(3 * k, 3)), a0 = NAME[aa(oc.replace(/U/g, "T"))], a1 = NAME[aa(nc.replace(/U/g, "T"))];
        if (t === "silent-substitution") return "<b>Silent</b>: " + oc + " → " + nc + " still codes " + a0 + ", so the protein is exactly the same.";
        if (t === "missense-substitution") return "<b>Missense</b>: " + oc + " → " + nc + " puts " + a1 + " where " + a0 + " was at residue " + (k + 1) + "; the other " + (N0 - 1) + " residues stay the same.";
        return "<b>Nonsense</b>: " + oc + " → " + nc + " is a stop codon, so the protein ends after <b>" + m.p.length + "</b> of its " + N0 + " residues.";
      }
      return "<b>Frameshift</b>: " + (e.ins ? "one inserted base" : "one deleted base") + " puts every later codon out of step, so <b>" + m.nDiff + "</b> residues come out wrong and translation stops after " + m.p.length + " residues instead of " + N0 + ".";
    },
    examples: [
      {name: "silent", values: {initial_mutation: "silent-substitution"}},
      {name: "missense: Glu to Val", values: {initial_mutation: "missense-substitution"}},
      {name: "nonsense: early stop", values: {initial_mutation: "nonsense-substitution"}},
      {name: "insertion: frameshift", values: {initial_mutation: "insertion"}},
      {name: "deletion: frameshift", values: {initial_mutation: "deletion"}}
    ],
    size: [400, 316],
    draw: function (api, v) {
      var c = api.color, t = v.initial_mutation, m = mutate(t), x0 = 16, cw = 37, lw = 9.6, NC = 10;
      var bx = function (i) { return x0 + Math.floor(i / 3) * cw + (i % 3) * lw + lw / 2 + 4; };
      var row = function (seq, y, p, stop, title, mut) {
        api.label([x0 - 6, y - 19], title, {color: c.muted, size: 12, weight: 600});
        for (var q = 0; q < NC; q++) {
          var cod = seq.substr(3 * q, 3);
          if (cod.length < 3) break;
          var after = stop >= 0 && q > stop, isStop = q === stop, changed = mut && !after && !isStop && m.diff[q];
          var cx = bx(3 * q + 1);
          api.rect(cx - 16, y - 9, 32, 18, {fill: isStop ? c.c5 : changed ? c.c6 : c.ink, fillOpacity: isStop ? 0.2 : changed ? 0.18 : after ? 0.02 : 0.06, stroke: isStop ? c.c5 : null, width: 1, rx: 4});
          for (var b = 0; b < 3; b++) {
            var gi = 3 * q + b, hit = mut && gi === m.mark;
            if (hit) api.rect(bx(gi) - 5, y - 8, 10, 16, {fill: c.c6, rx: 2});
            api.label([bx(gi), y + 0.5], rna(cod[b]), {color: hit ? c.card : after ? c.faint : c.ink, size: 12.5, weight: 650, anchor: "middle"});
          }
          api.label([cx, y + 19], after ? "·" : isStop ? "Stop" : NAME[aa(cod)], {color: isStop ? c.c5 : after ? c.faint : changed ? c.c6 : c.muted, size: 12, weight: changed || isStop ? 700 : 500, anchor: "middle"});
        }
      };
      row(FULL, 40, NORMAL, N0, "normal mRNA and protein", false);
      var what = {"silent-substitution": "1 base swapped", "missense-substitution": "1 base swapped", "nonsense-substitution": "1 base swapped", insertion: "1 base inserted", deletion: "1 base deleted"}[t];
      row(m.seq, 106, m.p, m.stop, "mutant: " + what, true);
      // where the edit sits, marked on the normal row
      if (m.gap >= 0) {
        api.rect(bx(m.gap) - 5, 31, 10, 18, {fill: c.c5, fillOpacity: 0.3, rx: 2});
        api.line([bx(m.gap) - 6, 40], [bx(m.gap) + 6, 40], {color: c.c5, width: 2});
        api.label([bx(m.gap), 74], "deleted", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      } else if (m.e.ins) {
        var ix = (bx(m.e.ins - 1) + bx(m.e.ins)) / 2;
        api.path("M " + (ix - 4) + " 54 L " + ix + " 49 L " + (ix + 4) + " 54", {stroke: c.c6, width: 2});
      } else api.rect(bx(m.mark) - 5, 31, 10, 18, {stroke: c.c6, width: 1.5, rx: 2});
      if (!m.e.sub) {
        var fx = m.e.ins ? (bx(m.e.ins - 1) + bx(m.e.ins)) / 2 : bx(m.gap) - lw / 2;
        api.line([fx, 133], [fx, 150], {color: c.c6, width: 1.5});
        api.label([fx + 5, 145], "new reading frame from here →", {color: c.c6, size: 12, weight: 600});
      }
      // all five on the same gene
      api.line([10, 158], [390, 158], {color: c.grid, width: 1});
      api.label([10, 172], "all five on this gene (each block = one amino acid)", {color: c.muted, size: 12});
      TYPES.forEach(function (tt, i) {
        var mm = mutate(tt), y = 194 + i * 24, on = tt === t;
        if (on) api.rect(4, y - 11, 392, 22, {fill: c.c6, fillOpacity: 0.1, stroke: c.c6, width: 1.2, rx: 6});
        api.label([12, y], SHORT[tt], {color: on ? c.ink : c.muted, size: 12.5, weight: on ? 700 : 500});
        for (var j = 0; j < Math.max(N0, mm.p.length); j++) {
          var x = 92 + j * 21;
          if (j < mm.p.length) api.rect(x, y - 7, 18, 14, {fill: mm.diff[j] ? c.c6 : c.c2, fillOpacity: mm.diff[j] ? 0.9 : 0.5, rx: 3});
          else api.rect(x, y - 7, 18, 14, {stroke: c.faint, width: 1, dash: "2 2", rx: 3});
        }
        api.label([92 + N0 * 21 + 6, y], mm.p.length + " aa" + (mm.nDiff ? ", " + mm.nDiff + " wrong" : ""), {color: mm.p.length < N0 ? c.c5 : mm.nDiff ? c.c6 : c.c2, size: 12, weight: 650});
      });
      api.root.querySelectorAll("text").forEach(function (tx) { if (tx.getAttribute("fill")) tx.style.fill = tx.getAttribute("fill"); });
    }
  });
})();
