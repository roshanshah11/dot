// Complementary base pairing: A pairs with T (with U when the partner strand is RNA) through 2 hydrogen bonds, G pairs
// with C through 3. Each pair is a two-ring purine (A, G) with a one-ring pyrimidine (T, C, U), so every rung of the
// ladder is the same width (about 2 nm), and the strands run antiparallel (5' to 3' against 3' to 5').
// Consequences drawn here: in double-stranded DNA %A = %T and %G = %C (Chargaff), and the more G-C pairs, the more
// hydrogen bonds hold the strands, so the higher the melting temperature. For a short DNA duplex the Wallace rule
// estimates Tm = 2 (A + T) + 4 (G + C) degrees C, counting one strand (a rough guide for 14-20 nt primers); it does not
// apply to a DNA-RNA hybrid, so that case shows the GC share instead.
// The top-strand sequence is made from the sliders: n bases, round(n * GC / 100) of them G or C, spread evenly.
(function () {
  function seq(v) {
    var nGC = Math.round(v.n * v.gc / 100), top = [];
    for (var i = 0; i < v.n; i++) {
      var isGC = Math.floor((i + 1) * nGC / v.n) > Math.floor(i * nGC / v.n);
      top.push(isGC ? (i % 3 === 1 ? "C" : "G") : (i % 3 === 2 ? "T" : "A"));
    }
    var rna = v.partner === "RNA", pair = {A: rna ? "U" : "T", T: "A", G: "C", C: "G"};
    return {top: top, bot: top.map(function (b) { return pair[b]; }), nGC: nGC, nAT: v.n - nGC, H: 2 * (v.n - nGC) + 3 * nGC, Tm: 2 * (v.n - nGC) + 4 * nGC};
  }

  Viz.register("complementary-base-pairing", {
    title: "Complementary base pairing",
    subject: "biology",
    shows: "Change the GC share and the partner strand: A always pairs with T (or U in RNA) by 2 hydrogen bonds and G with C by 3, a purine with a pyrimidine so every rung is the same width, and more G–C means a stronger duplex",
    params: {
      gc: {kind: "number", default: 40, min: 0, max: 100, step: 10, label: "\\%\\,\\text{GC}"},
      n: {kind: "integer", default: 10, min: 8, max: 16, label: "n\\,(\\text{bp})"},   // below ~8 bp the Wallace rule means nothing
      partner: {kind: "enum", values: ["DNA", "RNA"], names: {DNA: "DNA strand", RNA: "RNA strand"}, default: "DNA", label: "\\text{partner}"}
    },
    formula: function (v) {
      var q = seq(v), AT = v.partner === "RNA" ? "A{-}U" : "A{-}T";
      var l1 = "H=2\\times" + q.nAT + "\\,(\\text{" + AT + "})+3\\times" + q.nGC + "\\,(\\text{G{-}C})=" + q.H;
      var l2 = v.partner === "RNA" ? "\\text{GC}=\\tfrac{" + q.nGC + "}{" + v.n + "}=" + Viz.n(100 * q.nGC / v.n, 0) + "\\%"
                                   : "T_m\\approx2\\cdot" + q.nAT + "+4\\cdot" + q.nGC + "=" + q.Tm + "\\,^\\circ\\text{C}\\ \\text{(Wallace)}";
      return l1 + "\\newline " + l2;
    },
    status: function (v) {
      var q = seq(v);
      if (v.partner === "RNA") return "Against RNA, adenine pairs with <b>uracil</b> (2 hydrogen bonds) because RNA has no thymine; with " + q.nGC + " G–C pairs at 3 bonds each, this hybrid is held by <b>" + q.H + "</b> hydrogen bonds.";
      if (!q.nGC) return "All " + v.n + " pairs are A–T at 2 hydrogen bonds each, only <b>" + q.H + "</b> bonds, so this duplex separates easily (Wallace estimate Tm about <b>" + q.Tm + " °C</b>).";
      if (q.nGC === v.n) return "All " + v.n + " pairs are G–C at 3 hydrogen bonds each, <b>" + q.H + "</b> bonds, the most this length can have (Wallace estimate Tm about <b>" + q.Tm + " °C</b>).";
      return q.nGC + " of " + v.n + " pairs are G–C, with 3 hydrogen bonds each against 2 for A–T, so <b>" + q.H + "</b> bonds hold the strands and the Wallace estimate puts the Tm near <b>" + q.Tm + " °C</b>.";
    },
    examples: [
      {name: "all A–T, shortest", values: {gc: 0, n: 8, partner: "DNA"}},
      {name: "all G–C, longest", values: {gc: 100, n: 16, partner: "DNA"}},
      {name: "pairing with RNA", values: {gc: 40, n: 10, partner: "RNA"}},
      {name: "half GC", values: {gc: 50, n: 12, partner: "DNA"}}
    ],
    size: [400, 306],
    draw: function (api, v) {
      var c = api.color, q = seq(v), n = v.n, rna = v.partner === "RNA";
      var BASE = {A: c.c4, T: c.c5, U: c.c6, G: c.c3, C: c.c2}, HB = c.c1;
      var yT = 70, yB = 146, x0 = 44, W = 312, w = W / n, bw = Math.min(20, w * 0.62);
      var len = function (b) { return b === "A" || b === "G" ? 34 : 22; };   // purine (two rings) longer than pyrimidine
      // backbones
      api.line([x0 - 4, yT], [x0 + W + 4, yT], {color: c.muted, width: 4});
      api.line([x0 - 4, yB], [x0 + W + 4, yB], {color: rna ? c.c6 : c.muted, width: 4, opacity: rna ? 0.7 : 1});
      api.label([x0 - 12, yT], "5′", {color: c.muted, size: 12.5, anchor: "end", raw: true});
      api.label([x0 + W + 12, yT], "3′", {color: c.muted, size: 12.5, raw: true});
      api.label([x0 - 12, yB], "3′", {color: c.muted, size: 12.5, anchor: "end", raw: true});
      api.label([x0 + W + 12, yB], "5′", {color: c.muted, size: 12.5, raw: true});
      api.label([x0, yT - 21], "DNA strand", {color: c.muted, size: 12});
      api.label([x0, yB + 20], rna ? "RNA strand (U instead of T)" : "DNA strand", {color: rna ? c.c6 : c.muted, size: 12});
      // key: bar length is ring count, so every rung (one long + one short) spans the same width
      api.rect(x0, 7, 8, 14, {fill: c.muted, rx: 2});
      api.rect(x0, 25, 8, 9, {fill: c.muted, rx: 2});
      api.label([x0 + 14, 14], "long bar = purine (A, G): 2 rings", {color: c.muted, size: 12});
      api.label([x0 + 14, 30], "short bar = pyrimidine (C, T, U): 1 ring", {color: c.muted, size: 12});
      api.label([x0 + W, yT - 21], "every rung: 1 long + 1 short", {color: c.ink, size: 12, anchor: "end"});
      for (var i = 0; i < n; i++) {
        var x = x0 + (i + 0.5) * w, t = q.top[i], b = q.bot[i], lt = len(t), lb = len(b);
        var g0 = yT + 3 + lt, g1 = yB - 3 - lb;
        api.rect(x - bw / 2, yT + 3, bw, lt, {fill: BASE[t], rx: 3});
        api.rect(x - bw / 2, g1, bw, lb, {fill: BASE[b], rx: 3});
        api.label([x, yT + 3 + lt / 2], t, {color: c.card, size: 12, weight: 750, anchor: "middle"});
        api.label([x, g1 + lb / 2], b, {color: c.card, size: 12, weight: 750, anchor: "middle"});
        var k = t === "G" || t === "C" ? 3 : 2, offs = k === 3 ? [-0.3, 0, 0.3] : [-0.2, 0.2];
        offs.forEach(function (o) { api.line([x + o * bw, g0 + 2], [x + o * bw, g1 - 2], {color: HB, width: 1.8, dash: "2 2"}); });
      }
      // hydrogen-bond tally: 2 per A-T (or A-U) pair, 3 per G-C pair, against the most this length could have (3n)
      var by = 218, sc = 312 / (3 * 16), atW = 2 * q.nAT * sc, gcW = 3 * q.nGC * sc;
      api.label([x0, by - 22], "hydrogen bonds holding the strands", {color: c.muted, size: 12});
      api.rect(x0, by - 7, 3 * n * sc, 14, {fill: "none", stroke: c.grid, width: 1, rx: 3});
      if (atW) api.rect(x0, by - 7, atW, 14, {fill: HB, fillOpacity: 0.35, rx: 3});
      if (gcW) api.rect(x0 + atW, by - 7, gcW, 14, {fill: HB, rx: 3});
      api.label([x0 + atW + gcW + 8, by], String(q.H), {color: HB, size: 13, weight: 700});
      api.label([x0, by + 22], (rna ? "A–U" : "A–T") + ": 2 × " + q.nAT + "  ·  G–C: 3 × " + q.nGC, {color: HB, size: 12});
      // composition: pooled percentages for a DNA duplex (Chargaff); per-strand counts for a hybrid, since DNA A and
      // RNA A are different partners and pooling them would hide the matches
      var cnt = {}, top = {}, bot = {};
      q.top.forEach(function (b) { top[b] = (top[b] || 0) + 1; cnt[b] = (cnt[b] || 0) + 1; });
      q.bot.forEach(function (b) { bot[b] = (bot[b] || 0) + 1; cnt[b] = (cnt[b] || 0) + 1; });
      var k = function (o, b) { return o[b] || 0; };
      if (rna) {
        api.label([x0, 274], "DNA A " + k(top, "A") + " = RNA U " + k(bot, "U") + "  ·  DNA T " + k(top, "T") + " = RNA A " + k(bot, "A") + "  ·  G " + k(cnt, "G") + " = C " + k(cnt, "C"), {color: c.ink, size: 12});
        api.label([x0, 292], "each DNA base matches its partner: A–U, T–A, G–C", {color: c.muted, size: 12});
      } else {
        var parts = ["A", "T", "G", "C"].filter(function (b) { return cnt[b]; }).map(function (b) { return b + " " + Math.round(100 * cnt[b] / (2 * n)) + "%"; });
        api.label([x0, 274], "both strands: " + parts.join(" · "), {color: c.ink, size: 12});
        api.label([x0, 292], "Chargaff: A = T and G = C", {color: c.muted, size: 12});
      }
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
