// In-frame insertions and deletions: removing or adding a multiple of 3 bases leaves the reading frame intact, so the
// protein loses or gains whole amino acids and, when the cut falls inside a codon, one joined codon may code something
// else (or even a stop); everything downstream is read exactly as before. The window is real: human CFTR coding strand,
// codons 503-514 (NM_000492.4, numbered from the initiator Met), with codons 515-520 read off-screen when the frame needs
// them. Deleting CTT (c.1521_1523) leaves ATC ATT GGT: Ile507 is still Ile (ATC -> ATT) and Phe508 is gone, the most
// common cystic fibrosis allele, F508del. Deleting ATC (c.1519_1521) is I507del, another CF allele. An insertion here is
// a tandem duplication of the chosen bases. The protein change is named the usual way: the longest unchanged start and
// end are trimmed, so a deletion inside a repeat is called at its 3'-most residue. Full-length CFTR is 1480 amino acids.
// Colors: red = bases and residues the indel removes, adds or changes, teal = residues read as before, amber = a stop.
(function () {
  var W = "AAAGAAAATATCATCTTTGGTGTTTCCTATGATGAA" + "TATAGATACAGAAGCGTC", SHOW = 36, FIRST = 503, FULL = 1480, B = "TCAG";
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var NAME = {A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met",
    F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop"};
  function aa(c) { return CODE[16 * B.indexOf(c[0]) + 4 * B.indexOf(c[1]) + B.indexOf(c[2])]; }
  function codons(s) { var out = []; for (var k = 0; k + 3 <= s.length; k += 3) out.push(aa(s.substr(k, 3))); return out; }
  var O = codons(W), F508DEL = W.slice(0, 14) + W.slice(17), I507DEL = W.slice(0, 12) + W.slice(15);
  function model(v) {
    var n = Number(v.size), i = v.pos - 1, del = v.kind === "deletion";
    var m = del ? W.slice(0, i) + W.slice(i + n) : W.slice(0, i + n) + W.substr(i, n) + W.slice(i + n);
    var M = codons(m), a = 0, b = 0;
    while (a < O.length && a < M.length && O[a] === M[a]) a++;
    while (b < Math.min(O.length, M.length) - a && O[O.length - 1 - b] === M[M.length - 1 - b]) b++;
    var lost = O.slice(a, O.length - b), got = M.slice(a, M.length - b), stop = got.indexOf("*");
    return {n: n, i: i, del: del, m: m, M: M, a: a, lost: lost, got: got, stop: stop, d: (del ? -1 : 1) * n / 3,
      name: m === F508DEL ? "F508del" : m === I507DEL ? "I507del" : null, bases: W.substr(i, n)};
  }
  function res(list, from) { return list.map(function (x, j) { return NAME[x] + (from + j); }).join("-"); }

  Viz.register("mutation-in-frame-indels", {
    title: "In-frame insertions and deletions",
    subject: "biology",
    shows: "Delete or duplicate 3 or 6 bases in the CFTR gene: the frame survives, so the protein just loses or gains whole amino acids (CTT gone is F508del, the common cystic fibrosis allele)",
    params: {
      kind: {kind: "enum", values: ["deletion", "insertion"], default: "deletion", label: "\\text{change}"},
      size: {kind: "enum", values: ["3", "6"], names: {"3": "3 bases", "6": "6 bases"}, default: "3", label: "\\text{size}"},
      pos: {kind: "integer", default: 15, min: 1, max: 30, label: "\\text{from base } p"}
    },
    formula: function (v) {
      var r = model(v), len = r.stop >= 0 ? FIRST + r.a + r.stop - 1 : FULL + r.d;
      return "\\begin{array}{l}" + (r.del ? "-" : "+") + r.n + "\\text{ bases}:\\ " + r.n + "\\equiv 0 \\pmod 3\\\\ \\Rightarrow\\text{in frame},\\ " +
        FULL + "\\to " + len + "\\text{ aa}" + (r.stop >= 0 ? "\\text{ (stop)}" : "") + "\\end{array}";
    },
    status: function (v) {
      var r = model(v), at = FIRST + r.a, what = (r.del ? "Deleting " : "Duplicating ") + r.bases + " (" + r.n + " bases)";
      if (r.stop >= 0) return what + " keeps the frame, but the joined codon reads <b>" + r.m.substr(3 * (r.a + r.stop), 3) + ", a stop</b>: the chain ends after residue " +
        (at + r.stop - 1) + ", so most of CFTR's " + FULL + " amino acids are never made.";
      var tail = "; every residue after it is read as before, so CFTR has <b>" + (FULL + r.d) + "</b> amino acids instead of " + FULL + ".";
      if (r.name === "F508del") return "<b>F508del</b>: deleting CTT leaves ATC ATT GGT, so Ile507 stays Ile and only <b>Phe508</b> is lost" + tail;
      if (r.name === "I507del") return "<b>I507del</b>: deleting ATC removes one of the two isoleucines, <b>Ile507</b>" + tail;
      if (!r.got.length && r.del && r.lost.join("") === "F" && at === 508) return what + " removes <b>Phe508</b>, the same protein change as F508del made by a different DNA change" + tail;
      if (!r.got.length) return what + " removes " + (r.lost.length === 1 ? "one whole amino acid, <b>" : "whole amino acids, <b>") + res(r.lost, at) + "</b>" + tail;
      if (!r.lost.length) return what + " adds <b>" + r.got.map(function (x) { return NAME[x]; }).join("-") + "</b> between residues " + (at - 1) + " and " + at + tail;
      return what + " splits codons: <b>" + res(r.lost, at) + "</b> become" + (r.lost.length === 1 ? "s" : "") + " <b>" + r.got.map(function (x) { return NAME[x]; }).join("-") + "</b>" + tail;
    },
    examples: [
      {name: "F508del (cystic fibrosis)", values: {kind: "deletion", size: "3", pos: 15}},
      {name: "I507del", values: {kind: "deletion", size: "3", pos: 13}},
      {name: "the cut splits codons", values: {kind: "deletion", size: "6", pos: 5}},
      {name: "joined codon is a stop", values: {kind: "deletion", size: "6", pos: 29}},
      {name: "3-base duplication", values: {kind: "insertion", size: "3", pos: 16}},
      {name: "6-base duplication", values: {kind: "insertion", size: "6", pos: 1}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, r = model(v), n = r.n, i0 = r.i;
      var X = function (i) { return 24 + i * 9.1 + Math.floor(i / 3) * 2.9; }, CX = function (k) { return X(3 * k + 1); };
      var yN = 50, yNa = 70, yM = 126, yMa = 146, nCod = SHOW / 3;
      api.label([8, 12], "CFTR coding strand, 5′ → 3′ (codon numbers above)", {color: c.muted, size: 12});
      for (var k = 0; k < nCod; k += 2) api.label([CX(k), 30], String(FIRST + k), {color: c.muted, size: 12, anchor: "middle"});
      // the normal window; the indel's bases in red
      for (k = 0; k < nCod; k++) {
        var gone = k >= r.a && k < r.a + r.lost.length;
        api.rect(X(3 * k) - 5, yN - 10, 28.2, 20, {fill: gone ? c.c5 : c.ink, fillOpacity: gone ? 0.2 : (k % 2 ? 0.05 : 0.1), rx: 4});
        api.label([CX(k), yNa], NAME[O[k]], {color: gone ? c.c5 : c.muted, size: 12, weight: gone ? 700 : 500, anchor: "middle"});
        if (gone && r.del) api.line([CX(k) - 12, yNa], [CX(k) + 12, yNa], {color: c.c5, width: 1.6});
      }
      for (var i = 0; i < SHOW; i++) {
        var hit = i >= i0 && i < i0 + n;
        api.label([X(i), yN], W[i], {color: hit ? c.c5 : c.muted, size: 12.5, weight: hit ? 800 : 500, anchor: "middle"});
      }
      api.rect(X(i0) - 5.5, yN - 11, X(Math.min(i0 + n - 1, SHOW - 1)) - X(i0) + 11, 22, {stroke: c.c5, width: 2, rx: 4, dash: r.del ? null : "3 2"});
      // residues read as before slide whole codons left or right: they stay in frame
      var shift = r.got.length - r.lost.length;
      for (k = r.a + r.lost.length; k < nCod; k++) {
        var to = k + shift;
        if (to >= 0 && to < nCod && (r.stop < 0)) api.line([CX(k), yNa + 9], [CX(to), yM - 13], {color: c.c1, width: 1.3, opacity: 0.6});
      }
      for (k = 0; k < r.a && k < nCod; k++) api.line([CX(k), yNa + 9], [CX(k), yM - 13], {color: c.c1, width: 1.3, opacity: 0.25});
      // the changed window
      var newLo = r.del ? -1 : i0 + n, newHi = r.del ? -1 : i0 + 2 * n;
      for (k = 0; k < nCod; k++) {
        var j = k - r.a, changed = j >= 0 && j < r.got.length, isStop = r.stop >= 0 && j === r.stop, after = r.stop >= 0 && j > r.stop;
        api.rect(X(3 * k) - 5, yM - 10, 28.2, 20, {fill: isStop ? c.c3 : changed ? c.c5 : c.ink, fillOpacity: isStop ? 0.85 : changed ? 0.22 : after ? 0 : (k % 2 ? 0.05 : 0.1), rx: 4});
        if (k < r.M.length) api.label([CX(k), yMa], NAME[r.M[k]], {color: isStop ? c.c3 : changed ? c.c5 : c.c1, size: 12, weight: changed || isStop ? 700 : 600,
          anchor: "middle", opacity: after ? 0.35 : 1});
      }
      for (i = 0; i < SHOW; i++) {
        var nw = i >= newLo && i < newHi, past = r.stop >= 0 && i >= 3 * (r.a + r.stop + 1), st = r.stop >= 0 && Math.floor(i / 3) === r.a + r.stop;
        api.label([X(i), yM], r.m[i], {color: st ? c.card : nw ? c.c5 : c.ink, size: 12.5, weight: nw ? 800 : 600, anchor: "middle", opacity: past ? 0.4 : 1});
      }
      if (!r.del) api.label([(X(newLo) + X(Math.min(newHi - 1, SHOW - 1))) / 2, yM - 20], "copy", {color: c.c5, size: 12, weight: 700, anchor: "middle"});
      api.label([8, 168], (r.del ? "after the deletion" : "after the duplication") + ": triplets still start where they did", {color: c.c1, size: 12, weight: 600});
      // the whole protein: one residue lost or gained in 1480, or cut short by a stop
      var x0 = 96, x1 = 384, sx = function (q) { return x0 + (x1 - x0) * q / (FULL + 2); }, site = FIRST + r.a;
      api.label([8, 198], "normal", {color: c.muted, size: 12, weight: 650});
      api.rect(x0, 191, x1 - x0, 14, {fill: c.muted, fillOpacity: 0.4, rx: 4});
      api.label([x1, 213], FULL + " aa", {color: c.muted, size: 12, anchor: "end"});
      var len = r.stop >= 0 ? site + r.stop - 1 : FULL + r.d;
      api.label([8, 234], "now", {color: c.ink, size: 12, weight: 650});
      api.rect(x0, 227, sx(len) - x0, 14, {fill: c.c1, fillOpacity: 0.8, rx: 4});
      if (r.stop >= 0) {
        api.rect(sx(len), 227, x1 - sx(len), 14, {stroke: c.muted, width: 1, dash: "3 3", rx: 4, opacity: 0.6});
        api.rect(sx(len), 225, 5, 18, {fill: c.c3, rx: 2});
      } else api.rect(sx(site) - 2, 223, 4, 22, {fill: c.c5, rx: 1.5});
      api.label([sx(site), 262], (r.stop >= 0 ? "stop after residue " + len : "residue " + site + (r.del ? (r.got.length ? ": changed" : ": lost") : ": inserted")),
        {color: r.stop >= 0 ? c.c3 : c.c5, size: 12, weight: 650, anchor: "middle"});
      api.label([x1, 249], len + " aa", {color: c.ink, size: 12, anchor: "end"});
      // viz.css paints svg text with the ink color; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
