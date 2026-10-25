// The sugar-phosphate backbone of one nucleic-acid strand. Sugars (deoxyribose in DNA, ribose in RNA) alternate with
// phosphates; each phosphodiester bond joins the 3' carbon of one sugar, through a phosphate, to the 5' carbon of the
// next, so n nucleotides are held by n - 1 phosphodiester bonds and the strand has a 5' end (here a phosphate, as in
// textbook drawings) and a 3' end (a free 3'-OH, where new nucleotides are added). Bases hang off each sugar's 1' carbon.
// At pH 7 every bridging phosphate carries one negative charge and a 5'-terminal monophosphate about two, so the
// strand's charge is about -(n - 1) - 2. RNA's ribose carries a 2'-OH that can attack the neighbouring phosphodiester
// bond, which is why RNA is hydrolysed far more readily (especially in base) than DNA.
(function () {
  var SEQ = "ATGCGTAC";
  Viz.register("sugar-phosphate-backbone", {
    title: "The sugar-phosphate backbone",
    subject: "biology",
    shows: "Change the strand length and switch DNA to RNA: sugars and phosphates alternate, each phosphodiester bond joins one sugar's 3′ carbon to the next one's 5′ carbon, giving the strand a 5′ and a 3′ end and a negative charge on every link",
    params: {
      n: {kind: "integer", default: 5, min: 2, max: 8, label: "n"},
      acid: {kind: "enum", values: ["DNA", "RNA"], default: "DNA", label: "\\text{strand}"}
    },
    formula: function (v) {
      return "n-1=" + (v.n - 1) + "\\ \\text{phosphodiester bond" + (v.n > 2 ? "s" : "") + "}\\newline \\text{charge}\\approx-(n-1)-2=-" + (v.n + 1) + "\\ \\ (\\text{pH }7)";
    },
    status: function (v) {
      if (v.acid === "RNA") return "RNA uses the same 3′→5′ phosphodiester chain, but on <b>ribose</b>, whose extra <b>2′-OH</b> can attack the neighbouring phosphate, so RNA is cut far more easily than DNA.";
      return "Deoxyribose and phosphate alternate: " + (v.n > 2 ? "each of the <b>" + (v.n - 1) + " phosphodiester bonds</b>" : "the <b>one phosphodiester bond</b>") + " joins one sugar's 3′ carbon to the next sugar's 5′ carbon, so the strand runs <b>5′ → 3′</b> and is negatively charged.";
    },
    examples: [
      {name: "a dinucleotide", values: {n: 2, acid: "DNA"}},
      {name: "eight nucleotides of RNA", values: {n: 8, acid: "RNA"}},
      {name: "DNA, eight nucleotides", values: {n: 8, acid: "DNA"}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, n = v.n, rna = v.acid === "RNA", SX = 150, PX = 98, h = Math.min(46, 256 / n), y0 = 52 + (252 - h * n) / 2 + h / 2;
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var Y = function (i) { return y0 + i * h; };
      var ring = function (y) { return {c4: [SX - 16, y - 3], o: [SX, y - 13], c1: [SX + 16, y - 3], c2: [SX + 10, y + 12], c3: [SX - 10, y + 12], c5: [SX - 21, y - 17]}; };
      var hl = 0;                                                   // the link drawn large on the right joins sugar 1 to sugar 2
      // 5' -> 3' direction
      api.arrow([28, Y(0) - h / 2], [28, Y(n - 1) + 8], {color: c.muted, width: 1.6, halo: false, head: 8});
      T([28, Y(0) - h / 2 - 14], "5′", c.ink, {anchor: "middle", size: 13});
      T([28, Y(n - 1) + 24], "3′", c.ink, {anchor: "middle", size: 13});
      for (var i = 0; i < n; i++) {
        var y = Y(i), r = ring(y), py = y - h / 2, P = [PX, py];
        // phosphate above this sugar: 5' terminal for i = 0, otherwise it bridges sugar i-1 (3') to sugar i (5')
        var link = i - 1 === hl;
        api.line(P, r.c5, {color: link ? c.accent : c.c3, width: link ? 2.6 : 1.8});
        api.line(r.c5, r.c4, {color: c.c1, width: 1.8});
        if (i > 0) { var prev = ring(Y(i - 1)); api.line(prev.c3, P, {color: link ? c.accent : c.c3, width: link ? 2.6 : 1.8}); }
        api.circle(P, 8.5, {fill: c.c3, fillOpacity: 0.9});
        T([PX, py + 0.5], "P", c.card, {anchor: "middle", size: 12, weight: 700});
        T([PX - 13, py - 2], i === 0 ? "2−" : "−", c.c5, {anchor: "end", size: 12, weight: 700});
        // the sugar ring (furanose: C4', O4', C1', C2', C3')
        api.polygon([r.c4, r.o, r.c1, r.c2, r.c3], {fill: c.c1, fillOpacity: 0.22, stroke: c.c1, width: 1.6});
        if (rna) T([r.c2[0] + 5, r.c2[1] + 6], i === 0 ? "2′-OH" : "OH", c.c4, {size: 12, weight: 600});
        // base on C1'
        var b = rna && SEQ[i] === "T" ? "U" : SEQ[i];
        api.line(r.c1, [SX + 42, y - 3], {color: c.c6, width: 1.6});
        api.rect(SX + 42, y - 11, 30, 16, {fill: c.c6, fillOpacity: 0.3, stroke: c.c6, width: 1.2, rx: 3});
        T([SX + 57, y - 2.5], b, c.ink, {anchor: "middle", size: 12, weight: 700});
      }
      var last = ring(Y(n - 1));
      api.line(last.c3, [last.c3[0] - 8, last.c3[1] + 10], {color: c.c1, width: 1.8});
      T([last.c3[0] - 10, last.c3[1] + 18], "3′-OH", c.c1, {anchor: "end"});
      T([PX - 12, Y(0) - h / 2 - 16], "5′ phosphate", c.c3, {anchor: "middle"});
      // carbon numbers on the first sugar
      var f = ring(Y(0));
      T([f.c5[0] + 4, f.c5[1] - 6], "5′", c.c1, {size: 12}); T([f.c3[0] + 1, f.c3[1] + 9], "3′", c.c1, {anchor: "middle", size: 12});
      T([f.c1[0] + 3, f.c1[1] - 10], "1′", c.c1, {size: 12});
      T([SX, Y(0) - h / 2 - 16 < 30 ? 14 : Y(0) - h / 2 - 16], rna ? "ribose" : "deoxyribose", c.c1, {anchor: "start"});
      // the highlighted link, drawn out: sugar 1 C3' - O - P(=O)(O-) - O - C5' sugar 2
      if (n >= 2) {
        var zy = 140, xs = [252, 284, 314, 344, 376];
        T([314, zy - 72], "the orange link:", c.accent, {anchor: "middle"});
        T([314, zy - 56], "one phosphodiester bond", c.accent, {anchor: "middle"});
        ["C3′", "O", "P", "O", "C5′"].forEach(function (t, j) {
          if (j < 4) api.line([xs[j] + 10, zy], [xs[j + 1] - 10, zy], {color: j === 0 || j === 3 ? c.c1 : c.accent, width: 2});
          T([xs[j], zy], t, j === 2 ? c.c3 : j % 4 === 0 ? c.c1 : c.ink, {anchor: "middle", size: 13, weight: 700});
        });
        api.line([314, zy - 9], [314, zy - 25], {color: c.c3, width: 2}); api.line([318, zy - 9], [318, zy - 25], {color: c.c3, width: 2});
        T([316, zy - 34], "O", c.ink, {anchor: "middle", size: 13, weight: 700});
        api.line([314, zy + 9], [314, zy + 24], {color: c.c3, width: 2});
        T([314, zy + 34], "O⁻", c.c5, {anchor: "middle", size: 13, weight: 700});
        T([252, zy + 22], "sugar 1", c.muted, {anchor: "middle", weight: 500});
        T([376, zy + 22], "sugar 2", c.muted, {anchor: "middle", weight: 500});
        T([314, zy + 62], "two ester links through", c.muted, {anchor: "middle", weight: 500});
        T([314, zy + 78], "one phosphate, charge −1", c.muted, {anchor: "middle", weight: 500});
      }
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
