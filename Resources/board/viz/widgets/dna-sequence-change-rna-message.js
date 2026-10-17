// A one-base change in DNA, followed into the mRNA and the protein. The coding strand reads like the mRNA (U for T);
// the ribosome reads it in triplets from AUG. A substitution changes one codon: silent (same amino acid), missense
// (another amino acid), nonsense (a stop) or stop-loss (the stop becomes a sense codon). An insertion or deletion of
// one base shifts the reading frame (1 is not a multiple of 3), so every codon after it is read out of step until a
// new stop turns up. The gene is a made-up 7-amino-acid ORF (ATG...TAA) followed by six bases of 3' sequence.
// Colors: red = the change and the amino acids it alters, teal = mRNA, amber = stop codons.
(function () {
  var S0 = "ATGGCTTGGAAAGAGTGCCTGTAAGTTGAC", B = "TCAG";
  var AA = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var NAME = {F: "Phe", L: "Leu", S: "Ser", Y: "Tyr", C: "Cys", W: "Trp", P: "Pro", H: "His", Q: "Gln", R: "Arg", I: "Ile", M: "Met",
              T: "Thr", N: "Asn", K: "Lys", V: "Val", A: "Ala", D: "Asp", E: "Glu", G: "Gly", "*": "Stop"};
  function aa(cod) { cod = cod.replace(/U/g, "T"); return AA[16 * B.indexOf(cod[0]) + 4 * B.indexOf(cod[1]) + B.indexOf(cod[2])]; }
  function mutate(v) {
    var i = v.pos - 1;
    if (v.change === "substitution") return S0.slice(0, i) + v.base + S0.slice(i + 1);
    if (v.change === "insertion") return S0.slice(0, i) + v.base + S0.slice(i);
    return S0.slice(0, i) + S0.slice(i + 1);
  }
  function translate(s) {   // codons from the start until a stop or the end of the window
    var out = [];
    for (var k = 0; k + 3 <= s.length; k += 3) { var a = aa(s.substr(k, 3)); out.push(a); if (a === "*") break; }
    return {aa: out, stopped: out[out.length - 1] === "*", len: out[out.length - 1] === "*" ? out.length - 1 : out.length};
  }
  function rna(s) { return s.replace(/T/g, "U"); }
  function verdict(v) {
    var m = mutate(v), o = translate(S0), t = translate(m), k = Math.floor((v.pos - 1) / 3);
    var r = {m: m, o: o, t: t, k: k, oc: rna(S0.substr(3 * k, 3)), mc: rna(m.substr(3 * k, 3))};
    if (v.change === "substitution") {
      var a0 = aa(r.oc), a1 = aa(r.mc);
      r.kind = r.oc === r.mc ? "no change" : a0 === a1 ? "silent" : a1 === "*" ? "nonsense" : a0 === "*" ? "stop lost" : "missense";
      r.a0 = a0; r.a1 = a1;
    } else r.kind = t.aa.join("") === o.aa.join("") ? "frameshift, protein unchanged" : "frameshift";
    return r;
  }
  Viz.register("dna-sequence-change-rna-message", {
    title: "Mutations: from DNA to protein",
    subject: "biology",
    shows: "Change one base of a gene: see the new mRNA codon and the protein it makes, from a silent change to a missense, a premature stop or a frameshift",
    params: {
      change: {kind: "enum", values: ["substitution", "insertion", "deletion"], default: "substitution", label: "\\text{change}"},
      pos: {kind: "integer", default: 14, min: 4, max: 24, label: "\\text{base}\\ p"},
      base: {kind: "enum", values: ["A", "C", "G", "T"], default: "T", label: "\\text{new}"}
    },
    formula: function (v) {
      var r = verdict(v);
      if (v.change !== "substitution") return "\\Delta=" + (v.change === "insertion" ? "+1" : "-1") + "\\text{ base},\\ 1\\not\\equiv 0 \\pmod 3\\Rightarrow\\text{frame shifts at codon }" + (r.k + 1);
      if (r.kind === "no change") return "\\text{codon }" + (r.k + 1) + ":\\ \\texttt{" + r.oc + "}\\ \\text{(no change)}";
      return "\\text{codon }" + (r.k + 1) + ":\\ \\texttt{" + r.oc + "}\\to\\texttt{" + r.mc + "}\\ \\ (\\text{" + NAME[r.a0] + "}\\to\\text{" + NAME[r.a1] + "})";
    },
    status: function (v) {
      var r = verdict(v), c = r.k + 1;
      if (r.kind === "no change") return "Base " + v.pos + " is already " + v.base + ": nothing changes in the mRNA or the protein.";
      if (r.kind === "silent") return "<b>Silent</b>: codon " + c + " " + r.oc + " → " + r.mc + " still means " + (r.a0 === "*" ? "stop" : NAME[r.a0]) + ", so the protein is unchanged.";
      if (r.kind === "missense") return "<b>Missense</b>: codon " + c + " " + r.oc + " → " + r.mc + " puts " + NAME[r.a1] + " where " + NAME[r.a0] + " was; one amino acid changes.";
      if (r.kind === "nonsense") return "<b>Nonsense</b>: codon " + c + " " + r.oc + " → " + r.mc + " is a stop, so the protein ends after <b>" + r.t.len + "</b> amino acids instead of 7.";
      if (r.kind === "stop lost") return "<b>Stop lost</b>: " + r.oc + " → " + r.mc + " codes " + NAME[r.a1] + ", so the ribosome reads on past the old end into the 3′ sequence.";
      var did = v.change === "insertion" ? "Inserting" : "Deleting";
      if (r.kind === "frameshift, protein unchanged") return did + " a base inside the stop codon still leaves a stop there, so the protein is <b>unchanged</b>.";
      return "<b>Frameshift</b>: " + did.toLowerCase() + " one base at " + v.pos + " puts every codon from " + c + " out of step; " +
        (r.t.stopped ? "a stop now comes after <b>" + r.t.len + "</b> amino acids (was 7)." : "no stop turns up in view, so the protein runs on.");
    },
    examples: [
      {name: "missense", values: {change: "substitution", pos: 14, base: "T"}},
      {name: "silent", values: {change: "substitution", pos: 12, base: "G"}},
      {name: "nonsense", values: {change: "substitution", pos: 8, base: "A"}},
      {name: "stop lost", values: {change: "substitution", pos: 22, base: "C"}},
      {name: "insertion: frameshift", values: {change: "insertion", pos: 4, base: "A"}},
      {name: "deletion: frameshift", values: {change: "deletion", pos: 24}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, r = verdict(v), m = r.m, ins = v.change === "insertion", del = v.change === "deletion", i0 = v.pos - 1;
      var X = function (i) { return 24 + i * 10.6 + Math.floor(i / 3) * 3; };
      var codonBoxes = function (s, nCod, y) {
        for (var k = 0; k * 3 + 3 <= s.length; k++) {
          var inside = k < nCod;
          api.rect(X(3 * k) - 5.5, y - 10, 3 * 10.6 + 0.4, 20, {fill: c.ink, fillOpacity: inside ? (k % 2 ? 0.05 : 0.11) : 0, rx: 4});
        }
      };
      var protein = function (p, s, y, ref) {
        p.aa.forEach(function (a, k) {
          var changed = ref && (ref.aa[k] !== a), stop = a === "*";
          api.label([X(3 * k + 1), y], NAME[a], {color: stop ? c.c3 : changed ? c.c5 : ref ? c.ink : c.muted, size: 12, weight: changed || stop ? 700 : 500, anchor: "middle"});
        });
        if (!p.stopped) api.label([X(3 * p.aa.length + 1) - 6, y], "…", {color: c.c5, size: 14, weight: 700, anchor: "middle"});
      };
      // ---- original gene ----
      api.label([16, 16], "original coding strand (5′ → 3′) and its protein", {color: c.muted, size: 12});
      codonBoxes(S0, r.o.aa.length, 40);
      for (var i = 0; i < S0.length; i++) {
        var hit = i === i0 && !ins;
        api.label([X(i), 40], S0[i], {color: hit ? c.c5 : c.ink, size: 12.5, weight: hit ? 800 : 500, anchor: "middle", opacity: i >= 24 ? 0.45 : 0.85});
        if (hit) api.line([X(i) - 4, 50], [X(i) + 4, 50], {color: c.c5, width: 2});
      }
      if (ins) api.line([(X(i0 - 1) + X(i0)) / 2, 30], [(X(i0 - 1) + X(i0)) / 2, 50], {color: c.c5, width: 1.6, dash: "2 2"});
      protein(r.o, S0, 62, null);
      // ---- mutated gene, its mRNA and its protein ----
      api.label([16, 88], v.change === "substitution" ? "after the change: coding strand, mRNA, protein" : "after the " + v.change + ": codons regroup from here on", {color: c.c5, size: 12, weight: 600});
      var nCod = r.t.aa.length;
      codonBoxes(m, nCod, 116); codonBoxes(m, nCod, 140);
      for (var j = 0; j < m.length; j++) {
        var mark = (j === i0 && !del), utr = j >= 3 * nCod;
        api.label([X(j), 116], m[j], {color: mark ? c.c5 : c.ink, size: 12.5, weight: mark ? 800 : 500, anchor: "middle", opacity: utr ? 0.45 : 0.85});
        api.label([X(j), 140], rna(m)[j], {color: mark ? c.c5 : c.c1, size: 12.5, weight: mark ? 800 : 600, anchor: "middle", opacity: utr ? 0.45 : 1});
      }
      if (ins) api.label([X(i0), 102], "+", {color: c.c5, size: 13, weight: 800, anchor: "middle"});
      if (del) {
        var dx = X(i0) - 6;
        api.line([dx, 104], [dx, 150], {color: c.c5, width: 1.6, dash: "2 2"});
        api.label([dx, 100], "∆", {color: c.c5, size: 12, weight: 800, anchor: "middle"});
      }
      protein(r.t, m, 164, r.o);
      api.label([388, 182], "teal: mRNA, U for T", {color: c.c1, size: 12, anchor: "end"});
      // ---- the protein as beads, before and after ----
      var bead = function (n, y, list, ref, label, col) {
        api.label([16, y], label, {color: col, size: 12, weight: 650});
        for (var k = 0; k < n; k++) {
          var ch = ref && ref.aa[k] !== list[k];
          api.circle([118 + k * 22, y], 8, {fill: ch ? c.c5 : ref ? c.ink : c.muted, fillOpacity: ch ? 0.9 : 0.55});
        }
      };
      bead(r.o.len, 222, r.o.aa, null, "original: " + r.o.len + " aa", c.muted);
      bead(r.t.len, 250, r.t.aa, r.o, (r.t.stopped ? "now: " + r.t.len + " aa" : "now: " + r.t.len + "+ aa"), c.ink);
      if (!r.t.stopped) api.label([118 + r.t.len * 22 - 4, 250], "… runs on", {color: c.c5, size: 12, weight: 650});
      api.label([200, 284], r.kind.toUpperCase(), {color: r.kind === "silent" || r.kind === "no change" || r.kind === "frameshift, protein unchanged" ? c.c4 : c.c5, size: 14, weight: 750, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
