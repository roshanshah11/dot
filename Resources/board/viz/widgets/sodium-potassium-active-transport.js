// The Na+/K+-ATPase, a P-type pump, in its Post-Albers cycle. Facing the cytosol (E1) it binds 3 Na+; ATP phosphorylates
// an aspartate and the Na+ are occluded; the phosphorylated pump (E2-P) opens outward with low Na+ affinity and lets the
// 3 Na+ go into 145 mM Na+; 2 K+ bind from outside, which triggers loss of the phosphate and occludes them; the pump
// relaxes back to E1 (ATP binding speeds this) and releases the 2 K+ into the cytosol. Per ATP: 3 Na+ out, 2 K+ in,
// so one net positive charge leaves per cycle (electrogenic). Ouabain binds the outward-facing E2-P state from outside,
// competing with K+: the phosphate never leaves and the cycle stops. Typical mammalian concentrations are used.
(function () {
  var CX = 200, MT = 86, MB = 134, PT = 70, PB = 150;
  var GAPS = {in: [2, 8, 18], occ: [2, 10, 2], out: [18, 8, 2]};          // pocket half-widths at top, middle, bottom
  function state(s, ou) { return ou && s >= 4 ? "out" : ["in", "occ", "out", "occ", "in"][s - 1]; }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

  Viz.register("sodium-potassium-active-transport", {
    title: "The sodium-potassium pump",
    subject: "biology",
    shows: "Step through one pump cycle: 3 Na⁺ bind inside, ATP phosphorylates the pump, it flips to release them outside, 2 K⁺ bind, the phosphate leaves and it flips back; set the number of cycles or add ouabain to jam it",
    params: {
      n: {kind: "integer", default: 10, min: 1, max: 100, label: "n\\ (\\text{cycles})"},
      ouabain: {kind: "boolean", default: false, label: "\\text{ouabain}", on: "added", off: "none"}
    },
    steps: ["3 Na⁺ bind inside", "ATP phosphorylates the pump", "flip out: 3 Na⁺ released", "2 K⁺ bind, phosphate leaves", "flip in: 2 K⁺ released"],
    stepMs: 1700,
    formula: function (v) {
      return "3n=" + 3 * v.n + "\\ \\text{Na}^+\\ \\text{out},\\ \\ 2n=" + 2 * v.n + "\\ \\text{K}^+\\ \\text{in}\\newline n=" + v.n + "\\ \\text{ATP},\\ \\ \\text{net}\\ {+" + v.n + "}\\ \\text{charge out}";
    },
    status: function (v) {
      var s = v.step || 1;
      if (v.ouabain && s >= 4) return "Ouabain wedges into the outward-facing pump: K⁺ cannot bind, the phosphate stays on and the cycle <b>stops</b>, so the Na⁺ and K⁺ gradients slowly run down.";
      return [
        "Facing the cytosol, the pump has a high affinity for Na⁺: <b>3 Na⁺</b> bind from inside, where Na⁺ is scarce (12 mM).",
        "ATP hands its phosphate to an aspartate on the pump, ADP leaves, and the <b>3 Na⁺ are locked in</b>.",
        "Phosphorylation flips the pump to face outside and lowers its Na⁺ affinity, so the <b>3 Na⁺ are released</b> into 145 mM Na⁺, against their gradient" + (v.ouabain ? ", and ouabain waiting outside can now bind." : "."),
        "Facing out, the pump binds <b>2 K⁺</b> from outside (5 mM), and that makes it shed the phosphate, locking the K⁺ in.",
        "Without the phosphate the pump flips back to face the cytosol and <b>releases 2 K⁺</b> inside (140 mM), ready to bind Na⁺ again."
      ][s - 1];
    },
    examples: [
      {name: "Na⁺ released outside", values: {step: 3}},
      {name: "K⁺ released inside", values: {step: 5}},
      {name: "ouabain waiting outside", values: {step: 3, ouabain: true}},
      {name: "jammed by ouabain", values: {step: 4, ouabain: true}},
      {name: "one cycle", values: {n: 1, step: 1}},
      {name: "a hundred cycles", values: {n: 100, step: 2}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, st = state(s, v.ouabain), g = GAPS[st], jam = v.ouabain && s >= 4;
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var na = function (at, o) { api.circle(at, 5.2, Object.assign({fill: c.c2}, o || {})); };
      var k = function (at, o) { api.circle(at, 6.2, Object.assign({fill: c.c6}, o || {})); };
      // membrane and the ions on each side (dots show the gradients: Na+ high outside, K+ high inside)
      api.rect(8, MT, 384, MB - MT, {fill: c.ink, fillOpacity: 0.06, rx: 3});
      api.line([8, MT], [392, MT], {color: c.muted, width: 1.2}); api.line([8, MB], [392, MB], {color: c.muted, width: 1.2});
      var r = rng(5), side = function (y0, y1, nNa, nK, rx) {         // left of the pump, or clear of the labels on the right
        for (var i = 0; i < nNa + nK; i++) {
          var x = 14 + r() * (116 + 390 - rx); if (x > 130) x += rx - 130;
          var p = [x, y0 + r() * (y1 - y0)];
          if (i < nNa) na(p, {fillOpacity: 0.55}); else k(p, {fillOpacity: 0.55});
        }
      };
      side(26, 72, 12, 1, 304); side(148, 182, 2, 11, 336);
      T([12, 12], "outside: Na⁺ 145 mM, K⁺ 5 mM", c.muted, {weight: 500});
      T([12, 196], "cytosol: Na⁺ 12 mM, K⁺ 140 mM", c.muted, {weight: 500});
      T([388, 12], "Na⁺", c.c2, {anchor: "end"}); T([354, 12], "K⁺", c.c6, {anchor: "end"});
      // the pump: two halves around a pocket that opens to one side at a time
      [-1, 1].forEach(function (sg) {
        api.polygon([[CX + sg * 48, PT], [CX + sg * g[0], PT], [CX + sg * g[1], (PT + PB) / 2], [CX + sg * g[2], PB], [CX + sg * 48, PB]],
          {fill: c.c1, fillOpacity: 0.3, stroke: c.c1, width: 1.5});
      });
      T([CX + 54, PT - 2], st === "in" ? "open to cytosol" : st === "out" ? "open to outside" : "occluded", c.c1, {weight: 500});
      // ions in or passing through the pocket
      var mid = (PT + PB) / 2;
      if (s === 1) { [mid - 13, mid, mid + 13].forEach(function (y) { na([CX, y]); }); api.line([CX - 24, 178], [CX - 6, mid + 22], {color: c.c2, width: 1.6, arrow: true}); }
      if (s === 2) [mid - 13, mid, mid + 13].forEach(function (y) { na([CX, y]); });
      if (s === 3) {
        [[CX - 22, 56], [CX, 44], [CX + 22, 56]].forEach(function (p) { na(p); api.line([CX, PT + 2], [p[0], p[1] + 8], {color: c.c2, width: 1.4, arrow: true}); });
        if (v.ouabain) T([CX - 32, 40], "3 Na⁺ out", c.c2, {anchor: "end"}); else T([CX + 34, 40], "3 Na⁺ out", c.c2);   // clear of the waiting ouabain
      }
      if (s === 4 && !jam) { [mid - 9, mid + 9].forEach(function (y) { k([CX, y]); }); api.line([CX - 30, 50], [CX - 4, PT - 2], {color: c.c6, width: 1.6, arrow: true}); }
      if (s === 5) {
        [[CX - 16, 172], [CX + 16, 172]].forEach(function (p) { k(p); api.line([CX, PB - 2], [p[0], p[1] - 9], {color: c.c6, width: 1.4, arrow: true}); });
        T([CX + 30, 176], "2 K⁺ in", c.c6);
      }
      // phosphate on the pump's cytosolic domain, ATP / ADP / Pi beside it
      var P = [CX + 34, PB + 4], phos = s === 2 || s === 3 || jam;
      if (phos) { api.circle(P, 7.5, {fill: c.c3}); T([P[0], P[1] + 0.5], "P", c.card, {anchor: "middle", size: 12, weight: 700}); }
      if (s === 1) T([CX + 60, 168], "ATP", c.c3);
      if (s === 2) { api.line([CX + 50, 160], [CX + 78, 174], {color: c.c3, width: 1.4, arrow: true}); T([CX + 82, 176], "ADP", c.c3); }
      if (s === 4 && !jam) { api.circle([CX + 72, 172], 7.5, {fill: c.c3, fillOpacity: 0.6}); T([CX + 72, 172.5], "P", c.card, {anchor: "middle", size: 12, weight: 700}); api.line([CX + 44, 158], [CX + 62, 167], {color: c.c3, width: 1.4, arrow: true}); T([CX + 84, 172], "Pᵢ", c.c3); }
      if (s === 5) T([CX + 56, 156], "ATP binds", c.c3, {weight: 500});
      // ouabain: waiting outside, then wedged in the outward mouth
      if (v.ouabain) {
        var oat = jam ? [CX, PT - 2] : [CX + 70, 48];
        api.rect(oat[0] - 28, oat[1] - 8, 56, 16, {fill: c.c5, fillOpacity: 0.85, rx: 8});
        T([oat[0], oat[1] + 0.5], "ouabain", c.card, {anchor: "middle", size: 12, weight: 700});
        if (jam) {
          k([CX - 54, 38], {fillOpacity: 1}); api.line([CX - 48, 43], [CX - 28, 56], {color: c.c6, width: 1.4, arrow: true});
          api.line([CX - 42, 44], [CX - 32, 54], {color: c.c5, width: 2.2}); api.line([CX - 42, 54], [CX - 32, 44], {color: c.c5, width: 2.2});
          T([CX + 30, 42], "K⁺ blocked", c.c5);
        }
      }
      // tally after n cycles
      var bx = 96, bw = 220, rows = [["Na⁺ out", 3 * v.n, c.c2], ["K⁺ in", 2 * v.n, c.c6], ["ATP used", v.n, c.c3]];
      T([12, 216], "after n = " + v.n + " cycle" + (v.n > 1 ? "s" : "") + (v.ouabain ? ", then ouabain stops it" : ""), c.muted, {weight: 500});
      rows.forEach(function (rw, i) {
        var y = 236 + i * 22, w = Math.max(2, bw * rw[1] / 300);
        T([12, y], rw[0], rw[2]);
        api.rect(bx, y - 7, bw, 14, {fill: c.ink, fillOpacity: 0.05, rx: 3});
        api.rect(bx, y - 7, w, 14, {fill: rw[2], fillOpacity: 0.8, rx: 3});
        T([bx + w + 6, y], String(rw[1]), rw[2]);
      });
      T([12, 304], "net charge moved out: +" + v.n + " (3 out, 2 in per cycle)", c.muted, {weight: 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
