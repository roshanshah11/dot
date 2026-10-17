// A missense substitution: one base changes and its codon now names a different amino acid. The window is the start of
// human beta-globin (HBB coding strand, NM_000518.5): GTG CAT CTG ACT CCT GAG GAG AAG = Val His Leu Thr Pro Glu Glu Lys,
// numbered the traditional way (the initiator Met is removed, so the sickle-cell change GAG -> GTG is Glu6Val, HbS;
// GAG -> AAG at codon 6 is Glu6Lys, HbC). What the swap does depends on the side chains: within the same class (Campbell's
// nonpolar GAVLIMFWP, polar STCYNQ, acidic DE, basic KRH) it is called conservative and is usually better tolerated;
// across classes (acidic Glu to hydrophobic Val) it can change how the protein folds or sticks. The 3 x 3 grid lists all
// nine one-base changes of the chosen codon, so you can see which are silent, missense or nonsense.
// Colors: amber = hydrophobic, teal = polar, red = acidic (-), blue = basic (+), purple = the changed base, ink = stop.
(function () {
  var GENE = "GTGCATCTGACTCCTGAGGAGAAG", B = "TCAG", ALT = ["A", "C", "G", "T"];
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var NAME = {A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met",
    F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop"};
  var CLASS = {}; ["GAVLIMFWP:hydrophobic", "STCYNQ:polar", "DE:acidic −", "KRH:basic +"].forEach(function (g) {
    var p = g.split(":"); p[0].split("").forEach(function (x) { CLASS[x] = p[1]; });
  });
  function aa(c) { return CODE[16 * B.indexOf(c[0]) + 4 * B.indexOf(c[1]) + B.indexOf(c[2])]; }
  function col(api, a) { var c = api.color, k = CLASS[a] || ""; return a === "*" ? c.ink : k === "hydrophobic" ? c.c3 : k === "polar" ? c.c1 : k[0] === "a" ? c.c5 : c.c2; }
  function model(v) {
    var k = v.codon - 1, p = Number(v.pos) - 1, old = GENE.substr(3 * k, 3), neu = old.slice(0, p) + v.base + old.slice(p + 1);
    var a0 = aa(old), a1 = aa(neu);
    var kind = old === neu ? "none" : a0 === a1 ? "silent" : a1 === "*" ? "nonsense" : CLASS[a0] === CLASS[a1] ? "conservative" : "radical";
    return {k: k, p: p, old: old, neu: neu, a0: a0, a1: a1, kind: kind};
  }
  function known(r, v) {
    if (v.codon === 6 && r.neu === "GTG") return ": this is <b>HbS</b>, the sickle-cell mutation";
    if (v.codon === 6 && r.neu === "AAG") return ": this is <b>HbC</b>, a milder hemoglobin variant";
    return "";
  }

  Viz.register("mutation-missense-substitution", {
    title: "Missense substitution",
    subject: "biology",
    shows: "Change one base in the first codons of beta-globin: a missense change swaps one amino acid, and how much it matters depends on whether the new side chain is like the old one (GAG to GTG is the sickle-cell Glu6Val)",
    params: {
      codon: {kind: "integer", default: 6, min: 1, max: 8, label: "\\text{codon}"},
      pos: {kind: "enum", values: ["1", "2", "3"], names: {"1": "1st", "2": "2nd", "3": "3rd"}, default: "2", label: "\\text{base}"},
      base: {kind: "enum", values: ALT, default: "T", label: "\\text{becomes}"}
    },
    formula: function (v) {
      var r = model(v);
      return "\\begin{array}{l}\\text{codon }" + v.codon + ":\\ \\texttt{" + r.old + "}\\to\\texttt{" + r.neu + "}\\\\ \\text{" + NAME[r.a0] + "}" + v.codon + "\\to\\text{" +
        (r.a1 === "*" ? "Stop" : NAME[r.a1]) + "}" + (r.kind === "none" || r.kind === "silent" ? "\\ \\text{(same)}" : "") + "\\end{array}";
    },
    status: function (v) {
      var r = model(v), ch = r.old + " → " + r.neu;
      if (r.kind === "none") return "Base " + v.pos + " of codon " + v.codon + " is already " + v.base + ": nothing changes.";
      if (r.kind === "silent") return "<b>Silent</b>, not missense: " + ch + " still codes " + NAME[r.a0] + ", so the β chain is unchanged.";
      if (r.kind === "nonsense") return "<b>Nonsense</b>, not missense: " + ch + " is a stop, so the β chain ends after " + (v.codon - 1) + " residue" + (v.codon === 2 ? "" : "s") + ".";
      var swap = ch + " puts " + NAME[r.a1] + " (" + CLASS[r.a1] + ") where " + NAME[r.a0] + " (" + CLASS[r.a0] + ") was";
      if (r.kind === "conservative") return "<b>Conservative missense</b>: " + swap + ", a similar side chain, so it is usually better tolerated" + known(r, v) + ".";
      return "<b>Missense</b>: " + swap + ", a different kind of side chain" + known(r, v) + ".";
    },
    examples: [
      {name: "sickle cell: Glu6Val", values: {codon: 6, pos: "2", base: "T"}},
      {name: "HbC: Glu6Lys", values: {codon: 6, pos: "1", base: "A"}},
      {name: "conservative: Glu to Asp", values: {codon: 6, pos: "3", base: "C"}},
      {name: "silent third base", values: {codon: 6, pos: "3", base: "A"}},
      {name: "nonsense", values: {codon: 6, pos: "1", base: "T"}},
      {name: "first codon, no change", values: {codon: 1, pos: "1", base: "G"}},
      {name: "last codon", values: {codon: 8, pos: "2", base: "G"}}
    ],
    size: [400, 308],
    draw: function (api, v) {
      var c = api.color, r = model(v), CW = 46, X0 = 16, cx = function (k) { return X0 + k * CW + CW / 2; };
      api.label([8, 12], "β-globin (HBB) coding strand, codons 1–8", {color: c.muted, size: 12});
      for (var k = 0; k < 8; k++) {
        var on = k === r.k, cod = on ? r.neu : GENE.substr(3 * k, 3), a = aa(cod);
        api.label([cx(k), 32], String(k + 1), {color: on ? c.c6 : c.muted, size: 12, weight: on ? 700 : 500, anchor: "middle"});
        api.rect(X0 + k * CW + 3, 42, CW - 6, 22, {fill: c.ink, fillOpacity: on ? 0.16 : 0.07, stroke: on ? c.c6 : null, width: 1.6, rx: 5});
        for (var j = 0; j < 3; j++) {
          var hit = on && j === r.p;
          api.label([cx(k) + (j - 1) * 11, 53], cod[j], {color: hit ? c.c6 : c.ink, size: 13, weight: hit ? 800 : 550, anchor: "middle"});
        }
        if (k) api.line([cx(k - 1) + 15, 86], [cx(k) - 15, 86], {color: c.muted, width: 2, opacity: a === "*" || (on && r.a1 === "*") || k > r.k && r.a1 === "*" ? 0.15 : 0.6});
        var gone = r.a1 === "*" && k > r.k;
        if (a === "*") { api.rect(cx(k) - 18, 75, 36, 22, {stroke: c.ink, width: 1.6, rx: 6}); api.label([cx(k), 86], "Stop", {color: c.ink, size: 12, weight: 700, anchor: "middle"}); continue; }
        api.circle([cx(k), 86], 15, {fill: col(api, a), fillOpacity: gone ? 0.15 : 0.85, stroke: on && r.kind !== "none" ? c.c6 : null, width: 2.5});
        api.label([cx(k), 86], NAME[a], {color: c.card, size: 12, weight: 700, anchor: "middle", opacity: gone ? 0.5 : 1});
      }
      // the swap, large
      var y = 126, k0 = CLASS[r.a0], k1 = r.a1 === "*" ? "chain ends" : CLASS[r.a1];
      api.label([20, y], r.old, {color: c.muted, size: 15, weight: 650});
      api.label([66, y], NAME[r.a0] + v.codon + ", " + k0, {color: col(api, r.a0), size: 13, weight: 650});
      api.label([196, y], "→", {color: c.c6, size: 16, weight: 700, anchor: "middle"});
      api.label([214, y], r.neu, {color: c.ink, size: 15, weight: 700});
      api.label([260, y], (r.a1 === "*" ? "Stop" : NAME[r.a1]) + ", " + k1, {color: col(api, r.a1), size: 13, weight: 700});
      // all nine one-base changes of this codon
      var tally = {silent: 0, missense: 0, nonsense: 0};
      api.label([8, 156], "every one-base change of " + r.old + " (codon " + v.codon + ")", {color: c.muted, size: 12});
      ["1st base", "2nd base", "3rd base"].forEach(function (t, p) {
        api.label([70 + p * 124, 176], t, {color: p === r.p ? c.c6 : c.muted, size: 12, weight: p === r.p ? 700 : 500, anchor: "middle"});
        var row = 0;
        ALT.forEach(function (b) {
          var o = r.old;
          if (b === o[p]) return;
          var nc = o.slice(0, p) + b + o.slice(p + 1), na = aa(nc), y2 = 198 + row * 25, x2 = 70 + p * 124, sel = p === r.p && b === v.base;
          tally[na === r.a0 ? "silent" : na === "*" ? "nonsense" : "missense"]++;
          api.rect(x2 - 56, y2 - 11, 112, 22, {fill: c.ink, fillOpacity: sel ? 0.14 : 0.05, stroke: sel ? c.c6 : null, width: 2, rx: 5});
          for (var q = 0; q < 3; q++) api.label([x2 - 44 + q * 10, y2], nc[q], {color: q === p ? c.c6 : c.muted, size: 12.5, weight: q === p ? 800 : 500, anchor: "middle"});
          api.label([x2 - 6, y2], na === "*" ? "Stop" : NAME[na], {color: col(api, na), size: 12.5, weight: 700});
          if (na === r.a0) api.label([x2 + 50, y2], "same", {color: c.muted, size: 12, anchor: "end"});
          row++;
        });
      });
      api.label([8, 276], tally.silent + " silent, " + tally.missense + " missense, " + tally.nonsense + " nonsense", {color: c.ink, size: 12.5, weight: 650});
      [["hydrophobic", c.c3], ["polar", c.c1], ["acidic −", c.c5], ["basic +", c.c2]].forEach(function (g, i) {
        api.label([8 + i * 92, 297], g[0], {color: g[1], size: 12, weight: 650});
      });
      // viz.css paints svg text with the ink color; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
