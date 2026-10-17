// A silent (synonymous) substitution: one base of a codon changes but the new codon still names the same amino acid,
// so the protein is unchanged. The genetic code is redundant: 61 sense codons for 20 amino acids, and most of the slack
// sits at the third base (Ala = GCN, any third base). Leu, Arg and Ser have six codons, so a first-base change can be
// silent too (CUA -> UUA, both Leu); Met (AUG) and Trp (UGG) have one codon each, so nothing in them is silent. The grid
// tries all four bases at each position and colors the codons that keep the amino acid; s_i counts the silent changes
// at position i out of the 3 alternatives there. Everything is read live from the standard code (DNA coding strand =
// mRNA with T for U). Colors: green = same amino acid (silent), amber = another amino acid, red = stop, purple = the
// changed base.
(function () {
  var B = "TCAG", CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var NAME = {A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met",
    F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop"};
  var ORD = ["T", "C", "A", "G"];   // rows in codon-table order (U C A G)
  function aa(c) { return CODE[16 * B.indexOf(c[0]) + 4 * B.indexOf(c[1]) + B.indexOf(c[2])]; }
  function rna(s) { return s.replace(/T/g, "U"); }
  function aaName(a) { return NAME[a]; }
  function synonyms(a) { var out = []; for (var i = 0; i < 64; i++) if (CODE[i] === a) out.push(B[i >> 4] + B[(i >> 2) & 3] + B[i & 3]); return out; }
  function model(v) {
    var p = Number(v.pos) - 1, old = v.codon, neu = old.slice(0, p) + v.base + old.slice(p + 1), a0 = aa(old), a1 = aa(neu);
    var s = [0, 0, 0];
    for (var q = 0; q < 3; q++) ORD.forEach(function (b) { if (b !== old[q] && aa(old.slice(0, q) + b + old.slice(q + 1)) === a0) s[q]++; });
    var kind = old === neu ? "none" : a1 === a0 ? "silent" : a1 === "*" ? "nonsense" : "missense";
    return {p: p, old: old, neu: neu, a0: a0, a1: a1, s: s, kind: kind, syn: synonyms(a0)};
  }
  var ORDINAL = ["1st", "2nd", "3rd"];

  Viz.register("mutation-silent-substitution", {
    title: "Silent substitution",
    subject: "biology",
    shows: "Change one base of a codon: when the new codon names the same amino acid the change is silent, which happens mostly at the third base because the genetic code has several codons for most amino acids",
    params: {
      codon: {kind: "enum", values: ["GCT", "CTA", "GAA", "ATT", "ATG"], default: "GCT", label: "\\text{codon}",
        names: {GCT: "GCT Ala", CTA: "CTA Leu", GAA: "GAA Glu", ATT: "ATT Ile", ATG: "ATG Met"}},
      pos: {kind: "enum", values: ["1", "2", "3"], names: {"1": "1st", "2": "2nd", "3": "3rd"}, default: "3", label: "\\text{base}"},
      base: {kind: "enum", values: ["A", "C", "G", "T"], names: {T: "T (U)"}, default: "C", label: "\\text{becomes}"}
    },
    formula: function (v) {
      var r = model(v), tot = r.s[0] + r.s[1] + r.s[2];
      return "\\begin{array}{l}\\texttt{" + rna(r.old) + "}\\to\\texttt{" + rna(r.neu) + "}:\\ \\text{" + aaName(r.a0) + "}\\to\\text{" + aaName(r.a1) + "}" +
        (r.kind === "silent" ? "\\ \\text{(silent)}" : r.kind === "none" ? "\\ \\text{(no change)}" : "") +
        "\\\\ s_1+s_2+s_3=" + r.s[0] + "+" + r.s[1] + "+" + r.s[2] + "=" + tot + "\\text{ of }9\\end{array}";
    },
    status: function (v) {
      var r = model(v), ch = rna(r.old) + " → " + rna(r.neu), n = r.syn.length, o = ORDINAL[r.p];
      if (r.kind === "none") return "The " + o + " base of " + rna(r.old) + " is already " + rna(v.base) + ": nothing changes.";
      if (r.kind === "silent") {
        if (r.p === 2) return "<b>Silent</b>: " + ch + " still codes " + aaName(r.a0) + ", so the protein is unchanged; " + aaName(r.a0) + " has <b>" + n + "</b> codons and they differ " + (r.syn.every(function (x) { return x.slice(0, 2) === r.old.slice(0, 2); }) ? "only" : "mostly") + " in the 3rd base.";
        return "<b>Silent</b> even at the " + o + " base: " + ch + " still codes " + aaName(r.a0) + ", one of three amino acids with <b>6</b> codons.";
      }
      var tail = n === 1 ? "; " + aaName(r.a0) + " has only one codon, so <b>no</b> change to it can be silent." : r.s[r.p] === 0 ? "; no change at the " + o + " base of this codon is silent." : ".";
      if (r.kind === "nonsense") return "<b>Not silent</b>: " + ch + " is a stop codon (nonsense), so the protein is cut short" + tail;
      return "<b>Not silent</b>: " + ch + " codes " + aaName(r.a1) + " instead of " + aaName(r.a0) + " (missense)" + tail;
    },
    examples: [
      {name: "fourfold site: any third base keeps Ala", values: {codon: "GCT", pos: "3", base: "G"}},
      {name: "Leu: a silent first-base change", values: {codon: "CTA", pos: "1", base: "T"}},
      {name: "Glu: third base to C is missense", values: {codon: "GAA", pos: "3", base: "C"}},
      {name: "Glu to stop", values: {codon: "GAA", pos: "1", base: "T"}},
      {name: "Ile: AUU to AUG becomes Met", values: {codon: "ATT", pos: "3", base: "G"}},
      {name: "Met: nothing is silent", values: {codon: "ATG", pos: "3", base: "A"}},
      {name: "no change", values: {codon: "GCT", pos: "1", base: "G"}}
    ],
    size: [400, 304],
    draw: function (api, v) {
      var c = api.color, r = model(v);
      var tone = function (a) { return a === r.a0 ? c.c4 : a === "*" ? c.c5 : c.c3; };
      // before and after
      var block = function (cx, cod, mark, title) {
        api.label([cx, 12], title, {color: c.muted, size: 12, anchor: "middle"});
        api.label([cx, 31], "DNA " + cod, {color: c.muted, size: 12, anchor: "middle"});
        var m = rna(cod);
        for (var j = 0; j < 3; j++) {
          var hit = mark && j === r.p && r.kind !== "none";
          if (hit) api.rect(cx + (j - 1) * 19 - 9, 42, 18, 24, {fill: c.c6, fillOpacity: 0.22, rx: 4});
          api.label([cx + (j - 1) * 19, 55], m[j], {color: hit ? c.c6 : c.ink, size: 20, weight: hit ? 800 : 650, anchor: "middle"});
        }
        var a = aa(cod);
        if (a === "*") { api.rect(cx - 22, 78, 44, 26, {stroke: c.c5, width: 2, rx: 8}); api.label([cx, 91], "Stop", {color: c.c5, size: 13, weight: 700, anchor: "middle"}); }
        else { api.circle([cx, 91], 17, {fill: tone(a), fillOpacity: 0.9}); api.label([cx, 91], aaName(a), {color: c.card, size: 12.5, weight: 700, anchor: "middle"}); }
      };
      block(90, r.old, false, "before");
      block(310, r.neu, true, "after");
      api.label([22, 55], "mRNA", {color: c.muted, size: 12});
      api.arrow([150, 55], [250, 55], {color: c.c6, width: 2.5, halo: false});
      api.label([200, 39], ORDINAL[r.p] + " base " + rna(r.old[r.p]) + " → " + rna(v.base), {color: c.c6, size: 12.5, weight: 650, anchor: "middle"});
      var verdict = {none: ["no change", c.muted], silent: ["same amino acid: silent", c.c4], missense: ["different amino acid", c.c3], nonsense: ["stop: protein cut short", c.c5]}[r.kind];
      api.label([200, 91], verdict[0], {color: verdict[1], size: 12.5, weight: 700, anchor: "middle"});
      // every base at every position
      api.line([12, 116], [388, 116], {color: c.grid, width: 1});
      var X = [72, 200, 328], cw = 116;
      ORDINAL.forEach(function (t, q) {
        api.label([X[q], 130], t + " base", {color: q === r.p ? c.c6 : c.muted, size: 12, weight: q === r.p ? 700 : 500, anchor: "middle"});
        ORD.forEach(function (b, row) {
          var cod = r.old.slice(0, q) + b + r.old.slice(q + 1), a = aa(cod), y = 150 + row * 24, orig = b === r.old[q], sel = q === r.p && b === v.base;
          var same = a === r.a0;
          api.rect(X[q] - cw / 2 + 2, y - 10, cw - 4, 21, {fill: orig ? c.ink : same ? c.c4 : c.ink, fillOpacity: orig ? 0.04 : same ? 0.22 : 0.05,
            stroke: sel ? c.c6 : a === "*" ? c.c5 : orig ? c.muted : null, width: sel ? 2.2 : 1.2, dash: orig && !sel ? "3 3" : null, rx: 5});
          var m = rna(cod);
          for (var j = 0; j < 3; j++) api.label([X[q] - 46 + j * 10, y + 0.5], m[j], {color: j === q && !orig ? c.c6 : c.muted, size: 12.5, weight: j === q ? 750 : 500, anchor: "middle"});
          api.label([X[q] - 10, y + 0.5], aaName(a), {color: orig ? c.muted : tone(a), size: 12.5, weight: 700});
          if (orig) api.label([X[q] + 54, y + 0.5], "now", {color: c.muted, size: 12, anchor: "end"});
        });
        api.label([X[q], 252], "s" + "_" + (q + 1) + " = " + r.s[q] + " of 3 silent", {color: r.s[q] ? c.c4 : c.muted, size: 12, weight: 650, anchor: "middle"});
      });
      // the amino acid's codon family
      api.label([12, 280], aaName(r.a0) + ": " + r.syn.length + " codon" + (r.syn.length > 1 ? "s" : ""), {color: c.c4, size: 12.5, weight: 700});
      r.syn.forEach(function (cod, i) {
        var x = 134 + i * 45, on = cod === r.neu || cod === r.old;
        api.rect(x - 20, 270, 40, 20, {fill: c.c4, fillOpacity: on ? 0.3 : 0.1, stroke: cod === r.neu && r.kind === "silent" ? c.c6 : null, width: 1.8, rx: 5});
        api.label([x, 280.5], rna(cod), {color: c.ink, size: 12.5, weight: 600, anchor: "middle"});
      });
      // viz.css paints svg text with the ink color; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
