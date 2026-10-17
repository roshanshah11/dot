// Sanger (dye-terminator) sequencing. Polymerase copies the template from a primer; at each base a fraction q of the
// nucleotides on offer are dye-labeled ddNTPs, which lack the 3'-OH and stop the chain. So a copy stops at base k with
// probability q(1-q)^(k-1): there is a fragment ending at every base, and sorting them by size reads the sequence.
// Peak k relative to peak 1 is (1-q)^(k-1). Dye colors follow the usual convention (A green, C blue, T red), G in amber.
(function () {
  var READ = "GACTTAGCATCG", COMP = {A: "T", T: "A", G: "C", C: "G"};
  var TEMPLATE = READ.split("").map(function (b) { return COMP[b]; }).join("");
  var PRIMER = "TGC";
  function pctTxt(x) { return x < 0.01 ? (x * 100).toFixed(1) + "%" : Math.round(x * 100) + "%"; }

  Viz.register("sanger-sequencing", {
    title: "Sanger sequencing",
    subject: "biology",
    shows: "Step from one copy stopped by a ddNTP, to fragments ending at every base, to the capillary read; slide the ddNTP fraction to see how far the read reaches",
    params: {
      q: {kind: "number", default: 0.1, min: 0.01, max: 0.4, step: 0.01, label: "q"}
    },
    steps: ["one copy, stopped by a ddNTP", "fragments end at every base", "capillary sorts them by size"],
    stepMs: 1800,
    formula: function (v) {
      var r = Math.pow(1 - v.q, 11);
      return "P(k)=q(1-q)^{k-1},\\quad (1-q)^{11}=" + Viz.n(1 - v.q, 2) + "^{11}=" + Viz.n(r, r < 0.01 ? 4 : 2);
    },
    status: function (v) {
      var s = v.step || 1, reach = pctTxt(Math.pow(1 - v.q, 11)), q = Math.round(v.q * 100);
      var med = Math.ceil(Math.log(0.5) / Math.log(1 - v.q));
      if (s === 1) return "Polymerase extends the primer until it adds a ddNTP (chance <b>" + q + "%</b> at each base), which has no 3′-OH, so " +
        (med <= 12 ? "half the copies stop by base <b>" + med + "</b>." : "with so little ddNTP most copies run past base 12.");
      if (s === 2) return "Millions of copies stop at different places, so a fragment ends at every base with its ddNTP's dye; at q = " + q + "% only <b>" + reach + "</b> of copies reach base 12.";
      return "The capillary sorts fragments by length, shortest first, and the detector reads each dye in turn: the peaks spell <b>" + READ + "</b>, fading to " + reach + " by base 12.";
    },
    examples: [
      {name: "little ddNTP: even peaks", values: {q: 0.01, step: 3}},
      {name: "too much ddNTP: short read", values: {q: 0.4, step: 2}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, q = v.q;
      var DYE = {A: c.c4, C: c.c2, G: c.c3, T: c.c5};
      var X = function (i) { return 40 + i * 22; };   // 3 primer-site cells, then bases 1..12
      var rel = function (k) { return Math.pow(1 - q, k - 1); };
      if (s === 1) {
        var med = Math.ceil(Math.log(0.5) / Math.log(1 - q)), stop = med <= 12 ? med : 0;
        api.label([X(7), 16], "template", {color: c.muted, size: 12, anchor: "middle"});
        api.line([X(0) - 10, 34], [X(14) + 10, 34], {color: c.muted, width: 3});
        api.label([X(0) - 16, 34], "3′", {color: c.muted, size: 12, anchor: "end"});
        api.label([X(14) + 16, 34], "5′", {color: c.muted, size: 12});
        (PRIMER.split("").map(function (b) { return COMP[b]; }).join("") + TEMPLATE).split("").forEach(function (b, i) {
          api.label([X(i), 48], b, {color: c.muted, size: 12.5, anchor: "middle"});
        });
        var last = stop ? 2 + stop : 14;
        api.line([X(0) - 10, 92], [X(2) + 8, 92], {color: c.ink, width: 3});
        api.line([X(2) + 8, 92], [X(last) + 8, 92], {color: c.faint, width: 3});
        api.label([X(0) - 16, 92], "5′", {color: c.ink, size: 12, anchor: "end"});
        PRIMER.split("").forEach(function (b, i) { api.label([X(i), 78], b, {color: c.ink, size: 12.5, anchor: "middle"}); });
        api.label([X(1), 108], "primer", {color: c.ink, size: 12, anchor: "middle"});
        for (var k = 1; k <= 12; k++) {
          var b = READ[k - 1], x = X(2 + k);
          if (k <= last - 2) {
            api.line([x, 56], [x, 68], {color: c.faint, width: 1});
            if (k === stop) api.rect(x - 9, 69, 18, 18, {fill: DYE[b], fillOpacity: 0.28, stroke: DYE[b], width: 1.5, rx: 4});
            api.label([x, 78], b, {color: DYE[b], size: 12.5, weight: 650, anchor: "middle"});
          } else api.label([x, 78], "·", {color: c.faint, size: 13, anchor: "middle"});
        }
        if (stop) api.label([X(2 + stop), 116], "dd" + READ[stop - 1] + "TP: no 3′-OH, chain stops", {color: DYE[READ[stop - 1]], size: 12, anchor: "middle"});
        else api.label([X(8), 116], "too little ddNTP: most copies run on", {color: c.muted, size: 12, anchor: "middle"});
        api.arrow([X(10), 132], [X(13), 132], {color: c.muted, width: 1.6, halo: false, head: 8});
        api.label([X(9.7), 132], "copying runs 5′ → 3′", {color: c.muted, size: 12, anchor: "end"});
      } else if (s === 2) {
        api.label([386, 26], "a fragment ends at every base", {color: c.muted, size: 12, anchor: "end"});
        api.label([386, 44], "its last base carries the dye", {color: c.muted, size: 12, anchor: "end"});
        for (var r = 1; r <= 12; r++) {
          var y = 20 + (r - 1) * 9.6, op = 0.18 + 0.82 * rel(r), xe = X(2 + r);
          api.line([X(0) - 8, y], [X(2) + 8, y], {color: c.ink, width: 3, opacity: 0.55 * op + 0.2});
          if (r > 1) api.line([X(2) + 8, y], [xe - 6, y], {color: c.muted, width: 3, opacity: op});
          api.rect(xe - 5, y - 4, 10, 8, {fill: DYE[READ[r - 1]], rx: 2, opacity: op});
        }
        api.label([X(14) + 16, 20 + 11 * 9.6], "12", {color: c.muted, size: 12, anchor: "middle"});
        api.label([X(3) + 16, 20], "1", {color: c.muted, size: 12, anchor: "middle"});
      } else {
        api.rect(30, 60, 330, 24, {fill: c.faint, fillOpacity: 0.12, stroke: c.muted, width: 1.2, rx: 12});
        api.label([18, 72], "−", {color: c.ink, size: 16, anchor: "middle", weight: 650});
        api.label([382, 72], "+", {color: c.ink, size: 16, anchor: "middle", weight: 650});
        for (var f = 1; f <= 12; f++) {
          var bx = 314 - (f - 1) * 22.5;
          api.rect(bx - 3, 63, 6, 18, {fill: DYE[READ[f - 1]], rx: 2, opacity: 0.2 + 0.8 * rel(f)});
        }
        api.line([340, 32], [340, 98], {color: c.ink, width: 1.5, dash: "3 3"});
        api.label([392, 20], "laser + detector", {color: c.ink, size: 12, anchor: "end"});
        api.label([30, 42], "shortest run fastest", {color: c.muted, size: 12});
        api.arrow([162, 42], [262, 42], {color: c.muted, width: 1.6, halo: false, head: 8});
        api.label([60, 110], "long", {color: c.muted, size: 12, anchor: "middle"});
        api.label([300, 110], "short", {color: c.muted, size: 12, anchor: "middle"});
      }
      // the chromatogram: one peak per base, height relative to the first
      var base = 262, H = 84;
      api.line([20, 146], [380, 146], {color: c.grid, width: 1});
      api.label([24, 162], "signal at the detector (relative)", {color: c.muted, size: 12});
      api.line([28, base], [372, base], {color: c.axis, width: 1.2});
      for (var p = 1; p <= 12; p++) {
        var px = 48 + (p - 1) * 28, h = H * rel(p), col = DYE[READ[p - 1]], d = "M " + (px - 16) + " " + base;
        for (var t = -16; t <= 16; t += 1) d += " L " + (px + t) + " " + (base - h * Math.exp(-t * t / (2 * 36))).toFixed(2);
        api.path(d, {stroke: col, width: 2, fill: col, fillOpacity: 0.22});
        api.label([px, base + 14], READ[p - 1], {color: col, size: 13, weight: 650, anchor: "middle"});
      }
      var lastH = H * rel(12);
      api.label([48 + 11 * 28 + 6, base - lastH - 12], pctTxt(rel(12)) + " of peak 1", {color: c.ink, size: 12, anchor: "end"});
      // viz.css paints every svg label ink (it overrides the fill attribute); keep each label's own color
      api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
