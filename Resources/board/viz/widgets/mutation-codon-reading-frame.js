// One mRNA, three ways to cut it into codons. The ribosome reads non-overlapping triplets from wherever it starts,
// so the start base s fixes the reading frame: frame = ((s - 1) mod 3) + 1. Starts 1, 4 and 7 give the same codons
// (each later start just drops the codons before it); 2, 5, 8 and 3, 6, 9 cut the same letters into different codons
// and so make a different chain. The message is a made-up 36-base mRNA: from its AUG (frame 1) it codes ten amino
// acids and ends at UGA; frames 2 and 3 run into stop codons within a few codons. Everything is translated live with
// the standard genetic code. Colors: teal = the frame being read and its chain, amber = stop codons, muted = unread.
(function () {
  var MRNA = "AUGGUCUACGUGAAUGAUGAUCUAACUAAGUGAGUG", B = "UCAG";
  var CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  var NAME = {A: "Ala", R: "Arg", N: "Asn", D: "Asp", C: "Cys", Q: "Gln", E: "Glu", G: "Gly", H: "His", I: "Ile", L: "Leu", K: "Lys", M: "Met",
    F: "Phe", P: "Pro", S: "Ser", T: "Thr", W: "Trp", Y: "Tyr", V: "Val", "*": "Stop"};
  function aa(c) { return CODE[16 * B.indexOf(c[0]) + 4 * B.indexOf(c[1]) + B.indexOf(c[2])]; }
  function frameOf(s) { return ((s - 1) % 3) + 1; }
  function read(s) {   // codons from base s (1-based) up to and including the first stop
    var cods = [], stop = -1;
    for (var i = s - 1; i + 3 <= MRNA.length; i += 3) {
      var c = MRNA.substr(i, 3), a = aa(c);
      cods.push({at: i, c: c, a: a});
      if (a === "*") { stop = cods.length - 1; break; }
    }
    return {cods: cods, stop: stop, n: stop < 0 ? cods.length : stop};
  }
  function chain(r) { return r.cods.slice(0, r.n).map(function (x) { return NAME[x.a]; }); }

  Viz.register("mutation-codon-reading-frame", {
    title: "Reading frames: where the codons start",
    subject: "biology",
    shows: "Move the start base: the ribosome cuts the same mRNA into triplets from there, so starts 1, 4, 7 share one frame and starts 2 or 3 read different codons and a different chain",
    params: {
      s: {kind: "integer", default: 1, min: 1, max: 9, label: "\\text{start base } s"}
    },
    formula: function (v) {
      var f = frameOf(v.s), r = read(v.s);
      return "\\begin{array}{l}\\text{frame}=((s-1)\\bmod 3)+1\\\\ \\quad=(" + (v.s - 1) + "\\bmod 3)+1=" + f +
        "\\\\ \\quad\\Rightarrow\\ " + r.n + "\\text{ aa}" + (r.stop >= 0 ? ",\\ \\texttt{" + r.cods[r.stop].c + "}" : "") + "\\end{array}";
    },
    status: function (v) {
      var f = frameOf(v.s), r = read(v.s), p = chain(r), stop = r.stop >= 0 ? r.cods[r.stop].c : null;
      var n = "<b>" + r.n + " amino acid" + (r.n === 1 ? "" : "s") + "</b>";
      if (v.s === 1) return "From the AUG at base 1 the codons are AUG GUC UAC …: " + n + " (" + p[0] + "-" + p[1] + "-…-" + p[p.length - 1] + "), then the stop " + stop + ".";
      if (f === 1) return "Base " + v.s + " is frame 1 again (" + v.s + " − 1 = " + (v.s - 1) + " is a multiple of 3): the same codons as from base 1 minus the first " +
        ((v.s - 1) / 3) + " codon" + (v.s === 4 ? "" : "s") + ", so " + n + " and the same stop " + stop + ".";
      return "Starting at base " + v.s + " cuts the letters in frame " + f + ": they now read " + (p.length ? p.join("-") : "nothing") +
        (stop ? " and then " + stop + ", a stop, so only " + n + " of a different chain." : " with no stop in view.");
    },
    examples: [
      {name: "from the AUG (frame 1)", values: {s: 1}},
      {name: "one base late (frame 2)", values: {s: 2}},
      {name: "two bases late (frame 3)", values: {s: 3}},
      {name: "three bases late: frame 1 again", values: {s: 4}},
      {name: "start at base 9", values: {s: 9}}
    ],
    size: [400, 268],
    draw: function (api, v) {
      var c = api.color, f = frameOf(v.s), r = read(v.s), N = MRNA.length;
      var X = function (i) { return 60 + i * 9.2; }, yB = 50;
      api.label([8, 14], "mRNA, 5′ → 3′", {color: c.muted, size: 12});
      // tick numbers on the first base of every frame-1 codon: 1, 4, 7, ...
      for (var t = 0; t < N; t += 3) api.label([X(t), 32], String(t + 1), {color: c.muted, size: 12, anchor: "middle"});
      for (var i = 0; i < N; i++) {
        var read_ = i >= v.s - 1 && (r.stop < 0 || i < r.cods[r.stop].at + 3);
        api.label([X(i), yB], MRNA[i], {color: read_ ? c.ink : c.muted, size: 13, weight: read_ ? 650 : 500, anchor: "middle"});
      }
      api.label([X(0) - 13, yB], "5′", {color: c.muted, size: 12, anchor: "middle"});
      api.label([X(N - 1) + 6, yB], "3′", {color: c.muted, size: 12, clamp: false});
      // the start marker under base s
      var sx = X(v.s - 1);
      api.polygon([[sx, yB + 9], [sx - 5, yB + 17], [sx + 5, yB + 17]], {fill: c.c1, fillOpacity: 1});
      api.label([sx + 9, yB + 15], "start, s = " + v.s, {color: c.c1, size: 12, weight: 650});
      // the three frames
      [1, 2, 3].forEach(function (fr) {
        var y = 94 + (fr - 1) * 32, on = fr === f;
        api.label([8, y], "frame " + fr, {color: on ? c.c1 : c.muted, size: 12, weight: on ? 700 : 500});
        var stopAt = r.stop >= 0 ? r.cods[r.stop].at : Infinity;
        for (var k = fr - 1; k + 3 <= N; k += 3) {
          var a = aa(MRNA.substr(k, 3)), isStop = a === "*";
          var used = on && k >= v.s - 1 && k <= stopAt, before = on && k < v.s - 1;
          // boxes 25 wide on a 27.6 pitch, so each triplet stands apart from its neighbours
          var w = 25, x0 = X(k + 1) - w / 2;
          if (used) api.rect(x0, y - 11, w, 22, {fill: isStop ? c.c3 : c.c1, fillOpacity: isStop ? 0.85 : 0.22, rx: 5});
          else api.rect(x0, y - 11, w, 22, {stroke: isStop ? c.c3 : c.muted, width: 1, dash: before ? "3 3" : null, rx: 5, opacity: on ? 0.8 : 0.45});
          var tl = api.label([X(k + 1), y], NAME[a], {color: used ? (isStop ? c.card : c.ink) : isStop ? c.c3 : c.muted, size: 12, weight: used ? 650 : 500,
            anchor: "middle", opacity: used ? 1 : on ? 0.75 : 0.6});
          if (isStop) { tl.setAttribute("textLength", 23); tl.setAttribute("lengthAdjust", "spacingAndGlyphs"); }   // "Stop" is the one 4-letter name
        }
      });
      // the chain made from this start
      // beads r = 14 on a step that uses the real width: 10 residues + the stop box end at x = 392
      var p = chain(r), yC = 222, R = 14, step = Math.min(35, 352 / Math.max(1, p.length));
      api.label([8, yC - 26], "chain read from base " + v.s, {color: c.c1, size: 12, weight: 650});
      for (var b = 0; b < p.length; b++) {
        var bx = 8 + R + b * step;
        if (b) api.line([bx - step + R, yC], [bx - R, yC], {color: c.c1, width: 2.5, opacity: 0.8});
        api.circle([bx, yC], R, {fill: c.c1, fillOpacity: 0.85});
        api.label([bx, yC], p[b], {color: c.card, size: 12, weight: 700, anchor: "middle"});
      }
      var ex = 8 + R + p.length * step;
      if (r.stop >= 0) {
        api.rect(ex - R, yC - 11, 34, 22, {fill: c.c3, fillOpacity: 0.85, rx: 6});
        api.label([ex - R + 17, yC], "stop", {color: c.card, size: 12, weight: 700, anchor: "middle"});
      }
      api.label([8, 254], r.n + " amino acid" + (r.n === 1 ? "" : "s") + (f === 1 ? ", the gene's own frame" : ", a different frame: a different chain"), {color: c.ink, size: 12.5, weight: 600});
      // viz.css paints svg text with the ink color; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
