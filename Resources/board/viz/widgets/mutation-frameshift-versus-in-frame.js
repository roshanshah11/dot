// Frameshift or in frame: the ribosome reads triplets from the AUG, so what matters about an insertion or deletion is its
// size modulo 3. Adding or removing 3 or 6 bases removes or adds whole codons and every later codon is read as before;
// any other size moves the cut points of every later codon, so the amino acids are wrong from the site until a stop
// codon turns up in the new frame. The gene is a made-up message (AUG, nine more sense codons, the stop UGA, then 3' UTR);
// the change happens right after codon 4 (base 12): a deletion removes the next |d| bases, an insertion adds the first d
// letters of GCCGCC. Everything is translated live with the standard genetic code.
// Colors: teal = in frame (multiples of 3, residues read as before), red = frameshift and the residues it changes,
// amber = stop codons, muted = the normal message.
(function () {
  var SEQ = "AUGGUCUACGUGAAUGAUGAUCUAACUAAGUGA" + "GUGAGCAUGCGGCCUAAUGAU", SITE = 12, ADD = "GCCGCC", SHOW = 36, B = "UCAG";
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var NAME = {A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met",
    F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop"};
  function aa(c) { return CODE[16 * B.indexOf(c[0]) + 4 * B.indexOf(c[1]) + B.indexOf(c[2])]; }
  function translate(s) {
    var out = [];
    for (var k = 0; k + 3 <= s.length; k += 3) { out.push(aa(s.substr(k, 3))); if (out[out.length - 1] === "*") return {aa: out, stop: true, len: out.length - 1}; }
    return {aa: out, stop: false, len: out.length};
  }
  var O = translate(SEQ);
  function model(v) {
    var d = v.delta, m = d < 0 ? SEQ.slice(0, SITE) + SEQ.slice(SITE - d) : SEQ.slice(0, SITE) + ADD.slice(0, d) + SEQ.slice(SITE);
    var t = translate(m), inFrame = Math.abs(d) % 3 === 0, a = 0, b = 0;
    while (a < O.aa.length && a < t.aa.length && O.aa[a] === t.aa[a]) a++;
    while (b < Math.min(O.aa.length, t.aa.length) - a && O.aa[O.aa.length - 1 - b] === t.aa[t.aa.length - 1 - b]) b++;
    return {d: d, m: m, t: t, inFrame: inFrame, a: a, lost: O.aa.slice(a, O.aa.length - b), got: t.aa.slice(a, t.aa.length - b)};
  }
  function names(list, from) { return list.map(function (x, j) { return NAME[x] + (from == null ? "" : from + j); }).join("-"); }

  Viz.register("mutation-frameshift-versus-in-frame", {
    title: "Frameshift or in frame?",
    subject: "biology",
    shows: "Add or remove 1 to 6 bases after codon 4: only multiples of 3 keep the triplets in step, so the protein just gains or loses amino acids; any other size garbles everything after the site until a stop",
    params: {
      delta: {kind: "integer", default: -1, min: -6, max: 6, label: "d\\ \\text{(bases)}"}
    },
    formula: function (v) {
      var r = model(v), D = Math.abs(v.delta);
      if (!v.delta) return "d=0:\\ \\text{nothing added or removed}";
      return "\\begin{array}{l}d=" + v.delta + ":\\ " + D + "\\bmod 3=" + (D % 3) + (r.inFrame ? "" : "\\ne 0") +
        "\\\\ \\Rightarrow\\text{" + (r.inFrame ? "in frame" : "frameshift") + "},\\ " + O.len + "\\to " + r.t.len + "\\text{ aa}\\end{array}";
    },
    status: function (v) {
      var r = model(v), D = Math.abs(v.delta), what = (v.delta < 0 ? "Removing " : "Adding ") + D + " base" + (D === 1 ? "" : "s");
      if (!v.delta) return "No bases added or removed: the codons and the <b>" + O.len + "-amino-acid</b> chain are the normal ones.";
      if (r.inFrame) return what + " is a multiple of 3, so the frame is kept: the chain " + (v.delta < 0 ? "loses " + names(r.lost) : "gains " + names(r.got)) +
        " and every later codon reads as before, <b>" + r.t.len + " amino acids</b> instead of " + O.len + ".";
      var after = r.t.aa.slice(4, r.t.len), sc = r.m.substr(3 * (r.t.aa.length - 1), 3);
      if (!after.length) return what + " is not a multiple of 3, so every codon from 5 on is cut out of step, and codon 5 is now " + sc +
        ", a stop: the chain ends after <b>" + r.t.len + " amino acids</b> instead of " + O.len + ".";
      return what + " is not a multiple of 3, so every codon from 5 on is cut out of step: the chain reads " + names(after) + " and then " +
        sc + " stops it after <b>" + r.t.len + " amino acids</b> instead of " + O.len + ".";
    },
    examples: [
      {name: "remove 6: in frame", values: {delta: -6}},
      {name: "remove 3: in frame", values: {delta: -3}},
      {name: "remove 1: frameshift", values: {delta: -1}},
      {name: "no change", values: {delta: 0}},
      {name: "add 2: frameshift", values: {delta: 2}},
      {name: "add 6: in frame", values: {delta: 6}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, r = model(v), d = v.delta;
      // the rule: a number line of sizes, multiples of 3 in teal
      var nx = function (q) { return 52 + (q + 6) * 25; }, yL = 34;
      api.label([8, 12], "bases added (+) or removed (−) after codon 4", {color: c.muted, size: 12});
      api.line([nx(-6) - 10, yL], [nx(6) + 10, yL], {color: c.axis, width: 1.2});
      for (var q = -6; q <= 6; q++) {
        var ok = q % 3 === 0, here = q === d;
        api.circle([nx(q), yL], here ? 7 : 4.5, {fill: ok ? c.c1 : c.c5, fillOpacity: here ? 1 : 0.55, stroke: here ? c.ink : null, width: 2});
        if (q % 3 === 0 || here) api.label([nx(q), yL + 17], (q > 0 ? "+" : "") + api.fmt(q), {color: here ? c.ink : c.muted, size: 12, weight: here ? 700 : 500, anchor: "middle"});
      }
      // the normal message and the changed one, on the same triplet grid from the AUG
      var X = function (i) { return 26 + i * 9.1 + Math.floor(i / 3) * 2.6; }, yN = 82, yNa = 100, yM = 140, yMa = 158;
      var box = function (k, y, o) { api.rect(X(3 * k) - 5, y - 10, 2 * 9.1 + 10, 20, o); };
      api.label([8, 64], "normal", {color: c.muted, size: 12});
      for (var k = 0; k < SHOW / 3; k++) {
        box(k, yN, {fill: c.ink, fillOpacity: k < O.aa.length ? (k % 2 ? 0.05 : 0.1) : 0});
        api.label([X(3 * k + 1), yNa], NAME[O.aa[k]] || "", {color: O.aa[k] === "*" ? c.c3 : c.muted, size: 12, anchor: "middle", opacity: k < O.aa.length ? 1 : 0});
      }
      for (var i = 0; i < SHOW; i++) {
        var cut = d < 0 && i >= SITE && i < SITE - d;
        api.label([X(i), yN], SEQ[i], {color: cut ? c.c5 : c.muted, size: 12.5, weight: cut ? 800 : 500, anchor: "middle"});
        if (cut) api.line([X(i) - 4, yN], [X(i) + 4, yN], {color: c.c5, width: 1.6});
      }
      var sx = (X(SITE - 1) + X(SITE)) / 2;
      api.line([sx, yN - 14], [sx, yM + 14], {color: c.c5, width: 1.2, dash: "3 3", opacity: 0.7});
      var col = !d ? c.muted : r.inFrame ? c.c1 : c.c5;
      api.label([8, 122], !d ? "unchanged" : r.inFrame ? "in frame: later codons as before" : "frameshift: later codons cut out of step", {color: col, size: 12, weight: 650});
      var stopK = r.t.stop ? r.t.aa.length - 1 : Infinity;
      for (k = 0; k < SHOW / 3; k++) {
        var j = k - r.a, changed = d && j >= 0 && j < r.got.length && !(k === stopK), isStop = k === stopK, after = k > stopK;
        var shifted = d && !r.inFrame && k >= 4 && k < stopK;
        box(k, yM, {fill: isStop ? c.c3 : changed || shifted ? c.c5 : c.ink, fillOpacity: isStop ? 0.85 : changed || shifted ? 0.2 : after ? 0 : (k % 2 ? 0.05 : 0.1)});
        if (!after) api.label([X(3 * k + 1), yMa], NAME[r.t.aa[k]], {color: isStop ? c.c3 : changed || shifted ? c.c5 : c.c1, size: 12, weight: 650, anchor: "middle"});
      }
      for (i = 0; i < SHOW; i++) {
        var added = d > 0 && i >= SITE && i < SITE + d, inStop = 3 * stopK <= i && i < 3 * stopK + 3;
        api.label([X(i), yM], r.m[i], {color: inStop ? c.card : added ? c.c5 : c.ink, size: 12.5, weight: added ? 800 : 600, anchor: "middle", opacity: i >= 3 * (stopK + 1) ? 0.4 : 1});
      }
      // protein length
      var seg = 22, x0 = 110;
      var bar = function (y, list, len, ref, title, tc) {
        api.label([8, y], title, {color: tc, size: 12, weight: 650});
        for (var j2 = 0; j2 < len; j2++) {
          var same = !ref || (r.inFrame ? !(j2 >= r.a && j2 < r.a + r.got.length) : j2 < 4);
          api.rect(x0 + j2 * seg, y - 8, seg - 3, 16, {fill: !ref ? c.muted : same ? c.c1 : c.c5, fillOpacity: ref ? 0.85 : 0.45, rx: 4});
        }
        api.rect(x0 + len * seg, y - 8, 6, 16, {fill: c.c3, rx: 2});
      };
      bar(200, O.aa, O.len, false, "normal: " + O.len + " aa", c.muted);
      bar(230, r.t.aa, r.t.len, true, "now: " + r.t.len + " aa", c.ink);
      api.label([8, 266], d ? (r.inFrame ? (d < 0 ? "lost: " + names(r.lost, r.a + 1) : "added: " + names(r.got)) + ", nothing else changes"
        : r.t.len > 4 ? "residues 5 to " + r.t.len + " are wrong, then a premature stop" : "a premature stop right at codon 5") : "the normal chain", {color: col, size: 12.5, weight: 650});
      api.label([8, 288], "teal: in step", {color: c.c1, size: 12});
      api.label([96, 288], "red: added or out of step", {color: c.c5, size: 12});
      api.label([262, 288], "amber: stop", {color: c.c3, size: 12});
      // viz.css paints svg text with the ink color; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
