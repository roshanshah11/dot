// A tRNA's anticodon base-pairs with an mRNA codon, antiparallel: codon 5'-AUG-3' meets anticodon 3'-UAC-5'
// (written 5'-CAU-3'), and the tRNA carries the amino acid that codon stands for. Wobble: the anticodon's 5' base
// may pair loosely with the codon's 3rd base (G reads C or U, U reads A or G, inosine reads U, C or A), but only
// where every codon it would read means the same amino acid. Stop codons have no tRNA; a release factor binds.
Viz.register("codon-anticodon-pairing", {
  title: "Codon and anticodon pairing",
  subject: "biology",
  shows: "Build a codon base by base: the tRNA's anticodon pairs with it antiparallel and brings the matching amino acid; turn on wobble to see one tRNA read several codons",
  params: {
    b1: {kind: "enum", values: ["U", "C", "A", "G"], default: "A", label: "1^{st}"},
    b2: {kind: "enum", values: ["U", "C", "A", "G"], default: "U", label: "2^{nd}"},
    b3: {kind: "enum", values: ["U", "C", "A", "G"], default: "G", label: "3^{rd}"},
    wobble: {kind: "boolean", default: false, label: "\\text{wobble}", on: "shown", off: "exact pairs"}
  },
  model: function (v) {   // everything the figure, formula and status need, computed from the three bases
    var code = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG", B = "UCAG";
    var names = {F: "Phe", L: "Leu", S: "Ser", Y: "Tyr", C: "Cys", W: "Trp", P: "Pro", H: "His", Q: "Gln", R: "Arg", I: "Ile", M: "Met", T: "Thr", N: "Asn", K: "Lys", V: "Val", A: "Ala", D: "Asp", E: "Glu", G: "Gly", "*": "stop"};
    var tr = function (s) { return code[16 * B.indexOf(s[0]) + 4 * B.indexOf(s[1]) + B.indexOf(s[2])]; };
    var pair = {A: "U", U: "A", G: "C", C: "G"}, codon = v.b1 + v.b2 + v.b3, aa = tr(codon);
    var anti = [pair[v.b1], pair[v.b2], pair[v.b3]], reads = [codon], clash = null;
    if (v.wobble && aa !== "*") {
      var rules = {G: "UC", I: "UCA", U: "AG"}, best = null;
      ["I", "G", "U"].forEach(function (w) {
        if (rules[w].indexOf(v.b3) < 0) return;
        var set = rules[w].split("").map(function (x) { return v.b1 + v.b2 + x; }), bad = set.filter(function (s) { return tr(s) !== aa; });
        if (!bad.length && (!best || set.length > best.set.length)) best = {w: w, set: set};
        else if (bad.length && !clash) clash = bad[0];
      });
      if (best) { anti[2] = best.w; reads = best.set.sort(function (a, b) { return B.indexOf(a[2]) - B.indexOf(b[2]); }); clash = null; }
    }
    return {codon: codon, aa: aa, name: names[aa], anti: anti, reads: reads, clash: clash, clashName: clash ? names[tr(clash)] : null, stop: aa === "*"};
  },
  formula: function (v) {
    var m = Viz.get("codon-anticodon-pairing").model(v);
    if (m.stop) return "5'\\text{-}\\texttt{" + m.codon + "}\\text{-}3'\\ :\\ \\text{no tRNA}\\ \\to\\ \\text{stop}";
    return "5'\\text{-}\\texttt{" + m.codon + "}\\text{-}3'\\ :\\ 3'\\text{-}\\texttt{" + m.anti.join("") + "}\\text{-}5'\\ \\to\\ \\text{" + m.name + "}";
  },
  status: function (v) {
    var m = Viz.get("codon-anticodon-pairing").model(v);
    if (m.stop) return "<b>" + m.codon + "</b> is a stop codon: no tRNA pairs with it, so a release factor binds and the finished protein is let go.";
    if (v.wobble && m.reads.length > 1) return "With <b>" + m.anti[2] + "</b> at its wobble position this tRNA reads <b>" + m.reads.join(", ") + "</b>, all " + m.name + ", so fewer tRNAs cover the code.";
    if (v.wobble && m.clash) return "A loose wobble base here would also read <b>" + m.clash + "</b> (" + m.clashName + "), so " + m.codon + " needs a tRNA that pairs exactly.";
    return "Codon <b>" + m.codon + "</b> pairs base by base, antiparallel, with anticodon 3′-" + m.anti.join("") + "-5′, so this tRNA brings <b>" + m.name + "</b>" + (m.codon === "AUG" ? ", the start amino acid." : ".");
  },
  examples: [
    {name: "start codon", values: {b1: "A", b2: "U", b3: "G"}},
    {name: "stop codon", values: {b1: "U", b2: "A", b3: "A"}},
    {name: "inosine wobble", values: {b1: "G", b2: "C", b3: "U", wobble: true}},
    {name: "G-U wobble", values: {b1: "U", b2: "U", b3: "C", wobble: true}}
  ],
  size: [400, 280],
  draw: function (api, v) {
    var c = api.color, m = Viz.get("codon-anticodon-pairing").model(v);
    var X = [96, 120, 144], yA = 190, yC = 236;
    // the mRNA
    api.line([16, 250], [384, 250], {color: c.c3, width: 3});
    api.label([20, 266], "5′ mRNA", {color: c.c3, size: 12});
    api.label([380, 266], "3′", {color: c.c3, size: 12, anchor: "end"});
    [-4, -3, -2, 2, 3, 4].forEach(function (d) { api.label([120 + d * 24, yC], "·", {color: c.faint, size: 16, weight: 700, anchor: "middle"}); });
    m.codon.split("").forEach(function (b, i) { api.label([X[i], yC], b, {color: c.c3, size: 17, weight: 750, anchor: "middle"}); });
    api.rect(X[0] - 14, yC - 13, X[2] - X[0] + 28, 26, {rx: 6, stroke: c.c3, width: 1.2, dash: "3 3"});
    if (m.stop) {
      api.rect(62, 92, 116, 118, {rx: 26, fill: c.c5, fillOpacity: 0.18, stroke: c.c5, width: 2});
      api.label([120, 140], "release", {color: c.c5, size: 13, weight: 650, anchor: "middle"});
      api.label([120, 158], "factor", {color: c.c5, size: 13, weight: 650, anchor: "middle"});
    } else {
      // a cloverleaf tRNA drawn mirror-image, so it runs antiparallel to the 5'->3' mRNA below: the chain starts at the
      // 5' end (top right), goes down past the D loop (right) into the anticodon loop at x 132, leaves it at x 108, passes
      // the T loop (left) and ends at the 3' acceptor end (top left), which carries the amino acid. Along the loop the
      // bases therefore read 3'->5' from left to right, over the codon's 5'->3'.
      var t = c.c2;
      api.polyline([[132, 58], [132, 104], [150, 112]], {stroke: t, width: 2.4}); api.circle([166, 118], 15, {stroke: t, width: 2.4});
      api.polyline([[150, 124], [132, 136], [132, 178]], {stroke: t, width: 2.4});
      api.polyline([[108, 178], [108, 136], [90, 124]], {stroke: t, width: 2.4}); api.circle([74, 118], 15, {stroke: t, width: 2.4});
      api.polyline([[90, 112], [108, 104], [108, 58], [100, 38]], {stroke: t, width: 2.4});
      for (var y = 66; y <= 98; y += 8) api.line([110, y], [130, y], {color: t, width: 1.2, opacity: 0.6});
      for (y = 144; y <= 172; y += 7) api.line([110, y], [130, y], {color: t, width: 1.2, opacity: 0.6});
      api.rect(80, 176, 80, 28, {rx: 13, stroke: t, width: 2.4});
      m.anti.forEach(function (b, i) { api.label([X[i], yA], b, {color: i === 2 && b !== {A: "U", U: "A", G: "C", C: "G"}[v.b3] ? c.c6 : t, size: 17, weight: 750, anchor: "middle"}); });
      api.label([70, yA], "3′", {color: t, size: 12, anchor: "end"}); api.label([170, yA], "5′", {color: t, size: 12});
      api.label([140, 52], "5′", {color: t, size: 12}); api.label([92, 46], "3′", {color: t, size: 12, anchor: "end"});
      api.label([40, 84], "tRNA", {color: t, size: 13, weight: 650, anchor: "middle"});
      api.circle([90, 24], 13, {fill: c.c4});
      api.label([72, 24], m.name, {color: c.c4, size: 14, weight: 700, anchor: "end"});
      // hydrogen bonds: A-U 2, G-C 3, wobble pairs 2 (dashed purple)
      m.anti.forEach(function (ab, i) {
        var cb = m.codon[i], wc = {A: "U", U: "A", G: "C", C: "G"}[cb] === ab, n = wc && /G|C/.test(cb) ? 3 : 2;
        for (var j = 0; j < n; j++) api.line([X[i] - (n - 1) * 3 + j * 6, yA + 15], [X[i] - (n - 1) * 3 + j * 6, yC - 12], {color: wc ? c.ink : c.c6, width: 1.6, dash: wc ? null : "3 2"});
      });
    }
    // the reading, on the right
    var R = 214;
    api.label([R, 40], "codon 5′-" + m.codon + "-3′", {color: c.c3, size: 13, weight: 650});
    if (m.stop) {
      api.label([R, 64], "stop codon", {color: c.c5, size: 13, weight: 650});
      api.label([R, 86], "no anticodon matches", {color: c.ink, size: 12});
      api.label([R, 106], "translation ends here", {color: c.muted, size: 12});
    } else {
      api.label([R, 64], "anticodon 3′-" + m.anti.join("") + "-5′", {color: c.c2, size: 13, weight: 650});
      api.label([R, 84], "written 5′→3′: " + m.anti.slice().reverse().join(""), {color: c.muted, size: 12});
      api.label([R, 108], "carries " + m.name, {color: c.c4, size: 13, weight: 650});
      if (v.wobble) {
        if (m.reads.length > 1) {
          api.label([R, 136], "wobble: one tRNA reads", {color: c.c6, size: 12, weight: 600});
          m.reads.forEach(function (s, i) { api.rect(R + i * 52, 148, 46, 22, {rx: 6, stroke: c.c6, width: 1.4, fill: c.c6, fillOpacity: s === m.codon ? 0.25 : 0.06});
            api.label([R + 23 + i * 52, 159], s, {color: c.ink, size: 12.5, weight: 650, anchor: "middle"}); });
          if (m.anti[2] === "I") api.label([R, 186], "I = inosine", {color: c.muted, size: 12});
        } else {
          api.label([R, 136], "no wobble here:", {color: c.c6, size: 12, weight: 600});
          api.label([R, 156], (m.clash || "") + " would mean " + (m.clashName || "another amino acid"), {color: c.muted, size: 12});
        }
      } else api.label([R, 136], "every pair Watson-Crick", {color: c.muted, size: 12});
    }
    if (!m.stop) api.label([R, 210], "the strands run antiparallel", {color: c.muted, size: 12});
    // viz.css paints every svg text ink, over the fill attribute; restate each label's color inline
    api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
  }
});
