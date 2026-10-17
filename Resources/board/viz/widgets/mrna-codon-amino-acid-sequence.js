// Reading an mRNA: from the start codon AUG the ribosome reads three bases at a time, each codon names one amino acid
// (the standard genetic code), and the first stop codon (UAA, UAG, UGA) ends the chain. The reading frame is set by
// where reading starts, so starting one or two bases late regroups every codon. One-base changes to one 24-base message:
// silent (GCA -> GCG, still Ala), missense (GAG -> GUG, Glu -> Val, the same swap as sickle-cell hemoglobin), nonsense
// (CAA -> UAA, a stop), and an insertion or deletion of one base, which shifts the frame downstream. Every codon and amino
// acid below is computed from the bases, and the normal chain is shown under the current one for comparison.
(function () {
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG", B = "UCAG";
  var NAME = {F: "Phe", L: "Leu", S: "Ser", Y: "Tyr", C: "Cys", W: "Trp", P: "Pro", H: "His", Q: "Gln", R: "Arg", I: "Ile", M: "Met",
              T: "Thr", N: "Asn", K: "Lys", V: "Val", A: "Ala", D: "Asp", E: "Glu", G: "Gly", "*": "stop"};
  var SEQ = "AUGCAAUUAGAGCUUAGAGCAUAA";
  var SUB = {silent: [20, "G"], missense: [10, "U"], nonsense: [3, "U"]};
  function tr(cod) { return NAME[CODE[16 * B.indexOf(cod[0]) + 4 * B.indexOf(cod[1]) + B.indexOf(cod[2])]]; }
  function read(s, off) {   // codons from offset off; protein up to (not including) the first stop
    var cods = [], aas = [], stop = -1;
    for (var i = off; i + 3 <= s.length; i += 3) { cods.push({at: i, c: s.substr(i, 3)}); aas.push(tr(s.substr(i, 3))); if (stop < 0 && aas[aas.length - 1] === "stop") stop = aas.length - 1; }
    return {cods: cods, aas: aas, stop: stop, protein: stop < 0 ? aas : aas.slice(0, stop)};
  }
  function model(v) {
    var s = SEQ, mark = null, map = function (p) { return p; };
    if (SUB[v.mutation]) { var q = SUB[v.mutation]; mark = {at: q[0], from: SEQ[q[0]], to: q[1]}; s = SEQ.slice(0, q[0]) + q[1] + SEQ.slice(q[0] + 1); }
    if (v.mutation === "insertion") { s = SEQ.slice(0, 7) + "A" + SEQ.slice(7); mark = {at: 7, ins: "A"}; map = function (p) { return p >= 7 ? p + 1 : p; }; }
    if (v.mutation === "deletion") { s = SEQ.slice(0, 7) + SEQ.slice(8); mark = {at: 6.5, del: "U"}; map = function (p) { return p > 7 ? p - 1 : p === 7 ? 6.5 : p; }; }
    return {s: s, mark: mark, map: map, cur: read(s, Number(v.frame) - 1), normal: read(SEQ, 0)};
  }

  Viz.register("mrna-codon-amino-acid-sequence", {
    title: "Reading an mRNA: codons to amino acids",
    subject: "biology",
    shows: "Change one base or shift the reading frame: the mRNA is read three bases at a time from AUG, each codon names an amino acid, and a stop codon ends the chain",
    params: {
      mutation: {kind: "enum", values: ["none", "silent", "missense", "nonsense", "insertion", "deletion"], default: "none", label: "\\text{change}"},
      frame: {kind: "enum", values: ["1", "2", "3"], names: {"1": "from AUG", "2": "+1 base", "3": "+2 bases"}, default: "1", label: "\\text{frame}"}
    },
    formula: function (v) {
      var m = model(v), cods = m.cur.cods.slice(0, m.cur.stop < 0 ? m.cur.cods.length : m.cur.stop + 1).map(function (x) { return x.c; });
      var prot = m.cur.protein.length ? "\\text{" + m.cur.protein.join("-") + "}" : "\\text{nothing}";
      return "\\begin{array}{l}\\texttt{" + cods.join("\\,") + "}\\\\ \\to " + prot + (m.cur.stop < 0 ? "\\ \\text{(no stop)}" : "") + "\\end{array}";
    },
    status: function (v) {
      var m = model(v), n = m.cur.protein.length, nn = m.normal.protein.length, stopCod = m.cur.stop >= 0 ? m.cur.cods[m.cur.stop].c : null;
      var aa = function (k) { return "<b>" + k + " amino acid" + (k === 1 ? "" : "s") + "</b>"; };
      if (v.frame !== "1") return "Starting " + (v.frame === "2" ? "one base" : "two bases") + " late regroups every codon, so the same letters give " +
        (n ? m.cur.protein.join("-") : "no amino acid") + (stopCod ? " and then " + stopCod + ", a stop: " + aa(n) + " instead of " + nn + "." : " with no stop in sight.");
      if (v.mutation === "silent") return "GCA → GCG still codes alanine (the third base often doesn't matter), so the protein is <b>unchanged</b>: " + aa(n) + ".";
      if (v.mutation === "missense") return "GAG → GUG swaps glutamate for <b>valine</b>, one amino acid in " + n + ", the same swap that causes sickle-cell hemoglobin.";
      if (v.mutation === "nonsense") return "CAA → UAA turns codon 2 into a stop, so the chain ends after " + aa(n) + " instead of " + nn + ".";
      if (v.mutation === "insertion") return "One extra A shifts the reading frame from codon 3 on: the chain reads " + m.cur.protein.join("-") + " and hits a stop early, " + aa(n) + " instead of " + nn + ".";
      if (v.mutation === "deletion") return "Losing one U shifts the frame so codon 3 becomes " + stopCod + ", a stop: only " + aa(n) + " instead of " + nn + ".";
      return "Read from AUG three bases at a time, the message codes " + aa(n) + " and ends at the stop codon " + stopCod + ".";
    },
    examples: [
      {name: "the normal message", values: {mutation: "none", frame: "1"}},
      {name: "missense (Glu to Val)", values: {mutation: "missense"}},
      {name: "nonsense", values: {mutation: "nonsense"}},
      {name: "frameshift by insertion", values: {mutation: "insertion"}},
      {name: "frameshift by deletion", values: {mutation: "deletion"}},
      {name: "shifted reading frame", values: {mutation: "none", frame: "2"}}
    ],
    size: [400, 252],
    draw: function (api, v) {
      var c = api.color, m = model(v), x = function (i) { return 22 + i * 14.4; }, yM = 66, yA = 114, yN = 196;
      api.label([10, 26], "mRNA, read 5′ → 3′ in threes", {color: c.muted, size: 12});
      // codon boxes (alternating shade) and the letters
      var cur = m.cur, last = cur.stop < 0 ? cur.cods.length - 1 : cur.stop;
      cur.cods.forEach(function (cd, k) {
        api.rect(x(cd.at) - 7, yM - 12, 43.2 - 1.5, 24, {fill: c.c1, fillOpacity: k > last ? 0.03 : k % 2 ? 0.2 : 0.09, rx: 4});
      });
      var inCodon = function (i) { return cur.cods.some(function (cd) { return i >= cd.at && i < cd.at + 3; }); };
      for (var i = 0; i < m.s.length; i++) {
        var after = cur.stop >= 0 && i >= cur.cods[cur.stop].at + 3;
        api.label([x(i), yM], m.s[i], {color: c.c1, size: 13.5, weight: 650, anchor: "middle", opacity: !inCodon(i) || after ? 0.4 : 1});
      }
      api.label([x(0) - 13, yM], "5′", {color: c.muted, size: 12, anchor: "middle"});
      api.label([x(m.s.length - 1) + 13, yM], "3′", {color: c.muted, size: 12, anchor: "middle"});
      // the changed base
      if (m.mark) {
        var mx = x(m.mark.at);
        if (m.mark.del) { api.line([mx, yM - 14], [mx, yM + 14], {color: c.c5, width: 2}); api.label([mx, yM - 24], "U deleted", {color: c.c5, size: 12, anchor: "middle"}); }
        else {
          api.rect(mx - 7.5, yM - 12, 15, 24, {stroke: c.c5, width: 2, rx: 4});
          api.label([mx, yM - 24], m.mark.ins ? "A inserted" : m.mark.from + " → " + m.mark.to, {color: c.c5, size: 12, anchor: "middle"});
        }
      }
      // amino acids under their codons: blue = as in the normal chain, amber = changed; the stop codon in red
      var beads = [];
      cur.cods.forEach(function (cd, k) {
        if (k > last) return;
        var cx = x(cd.at + 1), name = cur.aas[k];
        if (name === "stop") {
          api.rect(cx - 19, yA - 12, 38, 24, {fill: c.c5, fillOpacity: 0.85, rx: 7});
          api.label([cx, yA], "stop", {color: c.card, size: 12, weight: 700, anchor: "middle"});
          return;
        }
        var same = v.frame === "1" && m.normal.aas[k] === name && !(v.mutation === "insertion" && k >= 2);
        beads.push([cx, yA]);
        api.circle([cx, yA], 17, {fill: same ? c.c2 : c.c3, fillOpacity: 0.85});
        api.label([cx, yA], name, {color: c.card, size: 12, weight: 700, anchor: "middle"});
      });
      for (var b = 1; b < beads.length; b++) api.line([beads[b - 1][0] + 17, yA], [beads[b][0] - 17, yA], {color: c.ink, width: 2, opacity: 0.6});
      api.label([10, yA + 30], cur.protein.length + " amino acid" + (cur.protein.length === 1 ? "" : "s") + (cur.stop < 0 ? ", no stop codon" : ", then stop"), {color: c.ink, size: 12.5, weight: 650});
      // the normal chain, under the same bases, for comparison
      api.label([10, yN - 26], "normal (from AUG, no change)", {color: c.muted, size: 12});
      var nb = [];
      m.normal.cods.forEach(function (cd, k) {
        var cx = (x(m.map(cd.at)) + x(m.map(cd.at + 1)) + x(m.map(cd.at + 2))) / 3, name = m.normal.aas[k];
        if (name === "stop") { api.rect(cx - 17, yN - 10, 34, 20, {stroke: c.c5, width: 1.3, rx: 6}); api.label([cx, yN], "stop", {color: c.c5, size: 12, anchor: "middle"}); return; }
        nb.push(cx);
        api.circle([cx, yN], 14, {stroke: c.muted, width: 1.3, fill: c.ink, fillOpacity: 0.04});
        api.label([cx, yN], name, {color: c.muted, size: 12, anchor: "middle"});
      });
      for (b = 1; b < nb.length; b++) api.line([nb[b - 1] + 14, yN], [nb[b] - 14, yN], {color: c.muted, width: 1.3, opacity: 0.6});
      api.label([10, 236], "blue = same as normal", {color: c.c2, size: 12});
      api.label([150, 236], "amber = changed", {color: c.c3, size: 12});
      // viz.css paints svg text ink over the fill attribute; restate each label's color inline
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
