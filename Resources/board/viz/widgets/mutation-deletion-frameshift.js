// Deleting one or two bases from a gene: the ribosome still reads the mRNA in triplets from the AUG, so every base after
// the gap slides one (or two) places to the left and each later codon is cut from different letters. Because 1 and 2 are
// not multiples of 3 the frame never recovers: the amino acids after the deletion are wrong until a stop codon turns up
// in the new frame, usually soon (premature stop, short protein). The gene is a made-up message: AUG, nine more sense
// codons, the stop UGA, then 3' UTR (only the first 36 bases are drawn; the rest is read when the frame runs on).
// Everything is translated live with the standard genetic code.
// Colors: red = the deleted bases and the amino acids the shift changed, teal = amino acids that are still right,
// amber = stop codons, muted = the normal message for comparison.
(function () {
  var SEQ = "AUGGUCUACGUGAAUGAUGAUCUAACUAAGUGA" + "GUGAGCAUGCGGCCUAAUGAU", SHOW = 36, B = "UCAG";
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var NAME = {A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met",
    F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop"};
  function aa(c) { return CODE[16 * B.indexOf(c[0]) + 4 * B.indexOf(c[1]) + B.indexOf(c[2])]; }
  function translate(s) {   // codons from the AUG until the first stop (included)
    var out = [];
    for (var k = 0; k + 3 <= s.length; k += 3) { out.push(aa(s.substr(k, 3))); if (out[out.length - 1] === "*") return {aa: out, stop: true, len: out.length - 1}; }
    return {aa: out, stop: false, len: out.length};
  }
  function model(v) {
    var n = Number(v.count), i = v.pos - 1, m = SEQ.slice(0, i) + SEQ.slice(i + n);
    var o = translate(SEQ), t = translate(m), k = Math.floor(i / 3), wrong = 0;
    for (var j = k; j < t.len; j++) if (t.aa[j] !== o.aa[j]) wrong++;
    return {n: n, i: i, m: m, o: o, t: t, k: k, wrong: wrong, gone: SEQ.substr(i, n)};
  }
  function names(list) { return list.map(function (a) { return NAME[a]; }).join("-"); }

  Viz.register("mutation-deletion-frameshift", {
    title: "Deletion frameshift",
    subject: "biology",
    shows: "Delete one or two bases anywhere after the start codon: every later base slides left, the triplets regroup, and the chain is wrong from there until a premature stop",
    params: {
      pos: {kind: "integer", default: 11, min: 4, max: 30, label: "\\text{base } p"},
      count: {kind: "enum", values: ["1", "2"], names: {"1": "1 base", "2": "2 bases"}, default: "1", label: "\\text{delete}"}
    },
    formula: function (v) {
      var r = model(v);
      return "\\begin{array}{l}-" + r.n + "\\text{ base" + (r.n > 1 ? "s" : "") + "}:\\ " + r.n + "\\not\\equiv 0 \\pmod 3\\\\ \\Rightarrow\\text{frameshift},\\ " +
        r.o.len + "\\to " + r.t.len + (r.t.stop ? "" : "+") + "\\text{ aa}\\end{array}";
    },
    status: function (v) {
      var r = model(v), j0 = r.k;
      while (j0 < r.t.len && r.t.aa[j0] === r.o.aa[j0]) j0++;   // the first codon whose amino acid really changes
      var cod = j0 + 1, after = r.t.aa.slice(j0, r.t.len), before = r.o.aa.slice(j0, Math.min(r.o.len, j0 + Math.max(1, after.length)));
      var lead = "Deleting " + r.gone + " (base" + (r.n > 1 ? "s " + v.pos + "–" + (v.pos + 1) : " " + v.pos) + ") pulls every later base " + (r.n > 1 ? "two places" : "one place") + " left";
      if (!r.t.stop) return lead + ": from codon " + cod + " the chain reads " + names(after.slice(0, 5)) + "… and no stop turns up in this stretch, so it runs on into the 3′ UTR.";
      var stopCod = r.t.aa.length, sc = r.m.substr(3 * (stopCod - 1), 3);
      if (!after.length) return lead + ", so codon " + cod + " becomes " + sc + ", a stop: the chain ends after <b>" + r.t.len + " amino acid" + (r.t.len === 1 ? "" : "s") + "</b> instead of " + r.o.len + ".";
      if (r.t.len > r.o.len) return lead + ", so the old stop UGA is no longer read: from codon " + cod + " the chain reads on as " + names(after) + " until " + sc +
        " ends it at <b>" + r.t.len + " amino acids</b> instead of " + r.o.len + ", a longer protein with a wrong tail.";
      return lead + ": from codon " + cod + " the chain reads " + names(after) + " instead of " + names(before) + ", then " + sc +
        " stops it after <b>" + r.t.len + " amino acids</b> instead of " + r.o.len + ".";
    },
    examples: [
      {name: "one base, early", values: {pos: 4, count: "1"}},
      {name: "one base, mid-gene", values: {pos: 11, count: "1"}},
      {name: "two bases", values: {pos: 14, count: "2"}},
      {name: "stop codon broken: a longer chain", values: {pos: 30, count: "2"}}
    ],
    size: [400, 262],
    draw: function (api, v) {
      var c = api.color, r = model(v), i0 = r.i, n = r.n;
      var X = function (i) { return 26 + i * 9.1 + Math.floor(i / 3) * 2.6; };
      var yN = 34, yNa = 54, yM = 110, yMa = 130;
      var box = function (k, y, o) { api.rect(X(3 * k) - 5, y - 10, 2 * 9.1 + 10, 20, o); };
      // the normal message
      var gx = (X(i0) + X(i0 + n - 1)) / 2;
      api.label(gx < 150 ? [392, 13] : [8, 13], "normal mRNA", {color: c.muted, size: 12, anchor: gx < 150 ? "end" : "start"});
      for (var k = 0; k * 3 < SHOW; k++) box(k, yN, {fill: c.ink, fillOpacity: k < r.o.aa.length ? (k % 2 ? 0.05 : 0.1) : 0});
      for (var i = 0; i < SHOW; i++) {
        var gone = i >= i0 && i < i0 + n;
        api.label([X(i), yN], SEQ[i], {color: gone ? c.c5 : c.muted, size: 12.5, weight: gone ? 800 : 500, anchor: "middle"});
      }
      api.rect(X(i0) - 5.5, yN - 11, (X(i0 + n - 1) - X(i0)) + 11, 22, {stroke: c.c5, width: 2, rx: 4});
      api.label([gx, 13], "deleted", {color: c.c5, size: 12, weight: 700, anchor: "middle"});
      r.o.aa.forEach(function (a, k) {
        if (3 * k + 3 > SHOW) return;
        api.label([X(3 * k + 1), yNa], NAME[a], {color: a === "*" ? c.c3 : c.muted, size: 12, anchor: "middle"});
      });
      // the slide: each later base drops into the slot n places to its left
      for (i = i0 + n; i < SHOW; i++) api.line([X(i), yN + 28], [X(i - n), yM - 13], {color: c.c5, width: 1, opacity: 0.45});
      // the mutated message, cut on the same triplet grid from the AUG
      var stopK = r.t.stop ? r.t.aa.length - 1 : Infinity;
      for (k = 0; k * 3 < SHOW; k++) {
        var hit = k >= r.k && k < stopK, isStop = k === stopK;
        box(k, yM, {fill: isStop ? c.c3 : hit ? c.c5 : c.ink, fillOpacity: isStop ? 0.85 : hit ? 0.2 : k > stopK ? 0 : (k % 2 ? 0.05 : 0.1)});
      }
      for (i = 0; i < SHOW && i < r.m.length; i++) {
        var past = r.t.stop && i >= 3 * r.t.aa.length, inStop = 3 * stopK <= i && i < 3 * stopK + 3;
        api.label([X(i), yM], r.m[i], {color: inStop ? c.card : c.ink, size: 12.5, weight: 600, anchor: "middle", opacity: past ? 0.4 : 1});
      }
      r.t.aa.forEach(function (a, k) {
        if (3 * k + 3 > SHOW) return;
        var bad = a !== r.o.aa[k];
        api.label([X(3 * k + 1), yMa], NAME[a], {color: a === "*" ? c.c3 : bad ? c.c5 : c.c1, size: 12, weight: bad || a === "*" ? 700 : 600, anchor: "middle"});
      });
      if (!r.t.stop || 3 * r.t.aa.length > SHOW) api.label([392, yMa], "…", {color: c.c5, size: 14, weight: 700, anchor: "end"});
      api.label([8, 152], "after the deletion: codons " + (r.k + 1) + " on are cut from shifted letters", {color: c.c5, size: 12, weight: 600});
      // protein length, normal versus now
      var seg = Math.min(22, 270 / Math.max(r.o.len, r.t.len + 1)), x0 = 112;
      var bar = function (y, list, len, stopped, ref, title, col) {
        api.label([8, y], title, {color: col, size: 12, weight: 650});
        for (var j = 0; j < len; j++) {
          var bad = ref && list[j] !== ref[j];
          api.rect(x0 + j * seg, y - 8, seg - 3, 16, {fill: ref ? (bad ? c.c5 : c.c1) : c.muted, fillOpacity: ref ? 0.85 : 0.45, rx: 4});
        }
        if (stopped) api.rect(x0 + len * seg, y - 8, 6, 16, {fill: c.c3, fillOpacity: 0.95, rx: 2});
        else api.label([x0 + len * seg + 2, y], "…", {color: c.c5, size: 14, weight: 700});
      };
      bar(186, r.o.aa, r.o.len, true, null, "normal: " + r.o.len + " aa", c.muted);
      bar(214, r.t.aa, r.t.len, r.t.stop, r.o.aa, "now: " + r.t.len + (r.t.stop ? "" : "+") + " aa", c.ink);
      if (r.t.len < r.o.len) api.rect(x0 + r.t.len * seg + 8, 206, (r.o.len - r.t.len) * seg - 8, 16, {stroke: c.muted, width: 1, dash: "3 3", rx: 4, opacity: 0.6});
      api.label([8, 246], "teal: still right", {color: c.c1, size: 12});
      api.label([118, 246], "red: changed by the shift", {color: c.c5, size: 12});
      api.label([290, 246], "amber: stop", {color: c.c3, size: 12});
      // viz.css paints svg text with the ink color; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
