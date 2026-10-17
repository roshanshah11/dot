// The three outcomes of a single-base substitution in a coding sequence, read with the standard genetic code: silent
// (same amino acid), missense (another amino acid) or nonsense (a stop codon, so the protein ends early). The window is
// codons 21-28 from the middle of a made-up 40-codon gene (coding strand; mRNA is the same with U for T), so a change
// at codon k that makes a stop leaves k - 1 residues. Each codon has 9 one-base neighbours; the 3 x 3 grid under it
// colors all nine (rows = 1st, 2nd, 3rd base), which shows silent changes piling up at the third base. The bars tally
// this stretch and the whole code: 61 sense codons x 9 = 549 changes, 134 silent, 392 missense, 23 nonsense, all
// counted live. Colors: green = silent, amber = missense, red = nonsense, purple = the chosen change.
(function () {
  var GENE = "AAATGGGGACTGCAGTACGAGTCT", FIRST = 21, LEN = 40, B = "TCAG", ALT = ["A", "C", "G", "T"];
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var NAME = {A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met",
    F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop"};
  function aa(c) { return CODE[16 * B.indexOf(c[0]) + 4 * B.indexOf(c[1]) + B.indexOf(c[2])]; }
  function rna(s) { return s.replace(/T/g, "U"); }
  function kindOf(old, neu) { var a0 = aa(old), a1 = aa(neu); return old === neu ? "none" : a1 === a0 ? "silent" : a1 === "*" ? "nonsense" : "missense"; }
  function tally(codons) {
    var t = {silent: 0, missense: 0, nonsense: 0};
    codons.forEach(function (c) { for (var p = 0; p < 3; p++) ALT.forEach(function (b) { if (b !== c[p]) t[kindOf(c, c.slice(0, p) + b + c.slice(p + 1))]++; }); });
    return t;
  }
  var window8 = [], sense = [];
  for (var i = 0; i < 8; i++) window8.push(GENE.substr(3 * i, 3));
  for (var j = 0; j < 64; j++) { var cj = B[j >> 4] + B[(j >> 2) & 3] + B[j & 3]; if (aa(cj) !== "*") sense.push(cj); }
  var T8 = tally(window8), TALL = tally(sense);
  function model(v) {
    var k = v.codon - FIRST, p = Number(v.pos) - 1, old = window8[k], neu = old.slice(0, p) + v.base + old.slice(p + 1);
    var kind = kindOf(old, neu);
    return {k: k, p: p, old: old, neu: neu, a0: aa(old), a1: aa(neu), kind: kind, len: kind === "nonsense" ? v.codon - 1 : LEN};
  }

  Viz.register("mutation-substitution-outcomes", {
    title: "Substitution outcomes: silent, missense, nonsense",
    subject: "biology",
    shows: "Pick a codon and change one base: the result is silent, missense or nonsense, and the grids of all nine possible changes per codon show that most substitutions are missense while silent ones cluster at the third base",
    params: {
      codon: {kind: "integer", default: 27, min: 21, max: 28, label: "\\text{codon}"},
      pos: {kind: "enum", values: ["1", "2", "3"], names: {"1": "1st", "2": "2nd", "3": "3rd"}, default: "2", label: "\\text{base}"},
      base: {kind: "enum", values: ALT, names: {T: "T (U)"}, default: "T", label: "\\text{becomes}"}
    },
    formula: function (v) {
      var r = model(v);
      var len = r.kind === "nonsense" ? LEN + "\\to" + r.len + "\\ \\text{residues}" : LEN + "\\ \\text{residues}" + (r.kind === "missense" ? ",\\ 1\\ \\text{changed}" : ",\\ \\text{same}");
      return "\\begin{array}{l}\\texttt{" + rna(r.old) + "}\\to\\texttt{" + rna(r.neu) + "}:\\ \\text{" + NAME[r.a0] + "}\\to\\text{" + NAME[r.a1] + "}\\\\ " + len + "\\end{array}";
    },
    status: function (v) {
      var r = model(v), ch = rna(r.old) + " → " + rna(r.neu);
      if (r.kind === "none") return "Base " + v.pos + " of codon " + v.codon + " is already " + rna(v.base) + ": no mutation.";
      if (r.kind === "silent" && r.p < 2) return "<b>Silent</b> even at the " + ["1st", "2nd"][r.p] + " base: " + ch + " still codes " + NAME[r.a0] + ", one of the amino acids with six codons, so the protein is identical.";
      if (r.kind === "silent") return "<b>Silent</b>: " + ch + " still codes " + NAME[r.a0] + ", so the protein is identical; " + T8.silent + " of this stretch's 72 possible changes are silent, mostly at a 3rd base.";
      if (r.kind === "missense") return "<b>Missense</b>: " + ch + " puts " + NAME[r.a1] + " where " + NAME[r.a0] + " was at residue " + v.codon + "; the protein keeps all " + LEN + " residues with one swapped.";
      return "<b>Nonsense</b>: " + ch + " is a stop codon, so translation ends after <b>" + r.len + "</b> of the " + LEN + " residues.";
    },
    examples: [
      {name: "missense: Glu to Val", values: {codon: 27, pos: "2", base: "T"}},
      {name: "first codon (21): Lys to stop", values: {codon: 21, pos: "1", base: "T"}},
      {name: "last codon (28): silent third base", values: {codon: 28, pos: "3", base: "C"}},
      {name: "Trp: two ways to a stop", values: {codon: 22, pos: "3", base: "A"}},
      {name: "Leu: silent first base", values: {codon: 24, pos: "1", base: "T"}},
      {name: "no change", values: {codon: 25, pos: "1", base: "C"}}
    ],
    size: [400, 314],
    draw: function (api, v) {
      var c = api.color, r = model(v), X0 = 36, CW = 45, cx = function (k) { return X0 + k * CW + CW / 2; };
      var COL = {silent: c.c4, missense: c.c3, nonsense: c.c5, none: c.muted};
      api.label([8, 11], "codons 21–28 from the middle of a 40-codon gene", {color: c.muted, size: 12});
      for (var k = 0; k < 8; k++) {
        var on = k === r.k, cod = on ? r.neu : window8[k], a = aa(cod), m = rna(cod);
        api.label([cx(k), 29], String(FIRST + k), {color: on ? c.c6 : c.muted, size: 12, weight: on ? 700 : 500, anchor: "middle"});
        api.rect(cx(k) - 19, 38, 38, 21, {fill: c.ink, fillOpacity: on ? 0.14 : 0.06, stroke: on ? c.c6 : null, width: 1.6, rx: 5});
        for (var q = 0; q < 3; q++) {
          var hit = on && q === r.p && r.kind !== "none";
          api.label([cx(k) + (q - 1) * 10.5, 49], m[q], {color: hit ? c.c6 : c.ink, size: 12.5, weight: hit ? 800 : 550, anchor: "middle"});
        }
        var col = on ? COL[r.kind] : c.c2;
        if (a === "*") { api.rect(cx(k) - 18, 66, 36, 20, {stroke: c.c5, width: 1.8, rx: 6}); api.label([cx(k), 76], "Stop", {color: c.c5, size: 12, weight: 700, anchor: "middle"}); }
        else {
          var gone = r.kind === "nonsense" && k > r.k;   // never translated: the ribosome stopped upstream
          api.circle([cx(k), 76], 14, {fill: on && r.kind === "none" ? c.c2 : col, fillOpacity: gone ? 0.15 : 0.85});
          api.label([cx(k), 76], NAME[a], {color: gone ? c.muted : c.card, size: 12, weight: 700, anchor: "middle", opacity: gone ? 0.6 : 1});
        }
        // all nine one-base changes of this codon: rows = position, columns = the three other bases
        var orig = window8[k];
        for (var p = 0; p < 3; p++) {
          var col3 = 0;
          ALT.forEach(function (b) {
            if (b === orig[p]) return;
            var kd = kindOf(orig, orig.slice(0, p) + b + orig.slice(p + 1)), sel = on && p === r.p && b === v.base;
            api.rect(cx(k) - 19 + col3 * 13, 192 + p * 14, 12, 12, {fill: COL[kd], fillOpacity: 0.85, stroke: sel ? c.c6 : null, width: 2.5, rx: 2});
            col3++;
          });
        }
      }
      ["1st", "2nd", "3rd"].forEach(function (t, p) { api.label([X0 - 4, 198 + p * 14], t, {color: p === r.p ? c.c6 : c.muted, size: 12, anchor: "end"}); });
      api.label([8, 181], "all 9 one-base changes of each codon (rows: which base changes)", {color: c.muted, size: 12});
      // the protein: 40 residues, normal and mutant
      var px0 = 66, ps = 7.1, py = [112, 134];
      api.label([8, py[0]], "normal", {color: c.muted, size: 12});
      api.label([8, py[1]], "mutant", {color: c.muted, size: 12});
      for (var n = 1; n <= LEN; n++) {
        var x = px0 + (n - 1) * ps, win = n >= FIRST && n < FIRST + 8;
        api.rect(x, py[0] - 5, ps - 1.6, 10, {fill: c.c2, fillOpacity: win ? 0.85 : 0.4, rx: 2});
        var lost = r.kind === "nonsense" && n >= v.codon, hitN = n === v.codon && r.kind === "missense";
        if (!lost) api.rect(x, py[1] - 5, ps - 1.6, 10, {fill: hitN ? c.c3 : c.c2, fillOpacity: hitN ? 1 : win ? 0.85 : 0.4, rx: 2});
      }
      api.label([px0 + LEN * ps + 4, py[0]], LEN + " aa", {color: c.c2, size: 12, weight: 650});
      api.label([px0 + (r.kind === "nonsense" ? r.len : LEN) * ps + 4, py[1]], r.len + " aa", {color: r.kind === "nonsense" ? c.c5 : r.kind === "missense" ? c.c3 : c.c2, size: 12, weight: 650});
      var names = {none: "no mutation", silent: "silent: protein unchanged", missense: "missense: one residue swapped", nonsense: "nonsense: protein cut short"};
      api.label([8, 160], names[r.kind], {color: COL[r.kind], size: 14, weight: 750});
      // tallies: this stretch and the whole code
      var bar = function (y, t, title) {
        var tot = t.silent + t.missense + t.nonsense, x = 118, w = 250, at = x;
        api.label([8, y], title, {color: c.muted, size: 12});
        ["silent", "missense", "nonsense"].forEach(function (kd) {
          var ww = w * t[kd] / tot;
          api.rect(at, y - 9, ww - 1.5, 18, {fill: COL[kd], fillOpacity: 0.85, rx: 3});
          var txt = String(t[kd]);
          if (ww > txt.length * 7 + 6) api.label([at + ww / 2, y + 0.5], txt, {color: c.card, size: 12, weight: 700, anchor: "middle"});
          else api.label([at + ww + 3, y + 0.5], txt, {color: COL[kd], size: 12, weight: 700});
          at += ww;
        });
      };
      [["silent", 118], ["missense", 178], ["nonsense", 256]].forEach(function (g) { api.label([g[1], 248], g[0], {color: COL[g[0]], size: 12, weight: 700}); });
      bar(270, T8, "this stretch: 72");
      bar(297, TALL, "whole code: 549");
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
