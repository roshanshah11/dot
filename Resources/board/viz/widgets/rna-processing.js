// What each RNA processing step buys a eukaryotic mRNA, shown as the checkpoints it must pass from gene to ribosome.
// In time order: the 5' m7G cap goes on after ~20-30 nt; without it nuclear quality control (DXO, then the 5'->3'
// exonuclease Xrn2) degrades the RNA. Splicing removes the introns; an unspliced pre-mRNA is held in the nucleus by
// splicing factors and degraded by the nuclear exosome. 3' cleavage and polyadenylation (~200-250 A) release the RNA
// for export; without them it stays at the gene and the nuclear exosome degrades it. In the cytoplasm the tail is
// shortened by deadenylases; each cytoplasmic poly(A)-binding protein (PABPC1) covers about 27 A, so n = floor(L / 27).
// While PABP holds the tail, eIF4E on the cap and PABP both bind eIF4G (a closed loop) and ribosomes load; once the
// tail is too short for one PABP, decapping follows and Xrn1 degrades the mRNA 5'->3'.
(function () {
  var FOOT = 27, CHECK = ["cap", "spliced", "3′ end", "export", "PABP", "translate"], CX = [44, 102, 160, 210, 276, 350];
  function model(v) {
    var n = v.polyA ? Math.floor(v.tail / FOOT) : 0;
    var fail = !v.cap ? 0 : !v.spliced ? 1 : !v.polyA ? 2 : n < 1 ? 4 : -1;   // first checkpoint it fails, -1 = none
    return {n: n, fail: fail};
  }
  Viz.register("rna-processing", {
    title: "RNA processing: cap, splice, tail",
    subject: "biology",
    shows: "Switch off the 5′ cap, splicing or the poly(A) tail and see where the message is destroyed; shorten the tail to watch the PABPs drop off until decay begins",
    params: {
      cap: {kind: "boolean", default: true, label: "\\text{cap}", on: "added", off: "missing"},
      spliced: {kind: "boolean", default: true, label: "\\text{splicing}", on: "introns out", off: "introns kept"},
      polyA: {kind: "boolean", default: true, label: "\\text{poly(A)}", on: "added", off: "missing"},
      tail: {kind: "integer", default: 200, min: 10, max: 250, step: 5, label: "\\text{tail (A)}"}
    },
    formula: function (v) {
      var m = model(v);
      return "5'\\text{-}" + (v.cap ? "\\text{m}^7\\text{G}" : "\\text{ppp}") + "\\text{-}" + (v.spliced ? "\\text{E}_1\\text{E}_2\\text{E}_3" : "\\text{E}_1\\text{I}_1\\text{E}_2\\text{I}_2\\text{E}_3") +
        "\\text{-}" + (v.polyA ? "\\text{A}_{" + v.tail + "}" : "\\text{(no tail)}") + "\\text{-}3'" +
        "\\newline n_{\\text{PABP}}=" + (v.polyA ? "\\lfloor " + v.tail + "/" + FOOT + "\\rfloor=" + m.n : "0");
    },
    status: function (v) {
      var m = model(v);
      if (m.fail === 0) return "Without a cap the 5′ end is unprotected: nuclear quality control strips it and the exonuclease <b>Xrn2</b> degrades the RNA 5′→3′ before it can leave.";
      if (m.fail === 1) return "With its introns still in, the pre-mRNA stays bound by splicing factors, is <b>held in the nucleus</b> and is degraded by the nuclear exosome.";
      if (m.fail === 2) return "Without 3′ cleavage and a poly(A) tail the RNA is never released for export: it stays at the gene and the <b>nuclear exosome</b> degrades it.";
      if (m.fail === 4) return "A " + v.tail + "-A tail is too short for one PABP (about 27 A each), so decapping enzymes take the cap and <b>Xrn1</b> degrades the mRNA 5′→3′.";
      return "Capped, spliced and tailed, the mRNA is exported; <b>" + m.n + " PABP" + (m.n > 1 ? "s" : "") + "</b> on its " + v.tail + "-A tail and eIF4E on the cap both grip eIF4G, looping it so ribosomes load.";
    },
    examples: [
      {name: "short tail", values: {tail: 10}},
      {name: "full tail", values: {tail: 250}},
      {name: "no cap", values: {cap: false}},
      {name: "introns kept", values: {spliced: false}},
      {name: "no poly(A)", values: {polyA: false}},
      {name: "one PABP left", values: {tail: 30}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = model(v), y = 58;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // the molecule: cap, exons (teal), introns (red), tail (amber) with PABP beads (green)
      var ex = [52, 46, 52], x = 52, segs = [];
      ex.forEach(function (w, i) { segs.push([x, w, "E"]); x += w; if (i < 2 && !v.spliced) { segs.push([x, 42, "I"]); x += 42; } });
      L([20, 18], v.spliced ? "mRNA" : "pre-mRNA", c.muted, {weight: 500});
      if (v.cap) { api.circle([40, y], 8, {fill: c.c6, fillOpacity: 0.9}); L([36, y - 22], "m⁷G cap", c.c6); }
      else { api.line([30, y], [52, y], {color: c.c6, width: 2, dash: "3 3"}); L([30, y - 22], "5′ ppp, no cap", c.c5); }
      segs.forEach(function (q, i) {
        if (q[2] === "E") api.rect(q[0], y - 9, q[1], 18, {fill: c.c1, fillOpacity: 0.85, rx: 3});
        else { api.rect(q[0], y - 3, q[1], 6, {fill: c.c5, fillOpacity: 0.75, rx: 2}); L([q[0] + q[1] / 2, y + 20], "intron", c.c5, {anchor: "middle", weight: 500}); }
      });
      if (v.spliced) L([52 + 75, y + 22], "exons joined", c.c1, {anchor: "middle", weight: 500});
      var tx = x, tw = 100 * v.tail / 250;
      if (v.polyA) {
        api.line([tx, y], [tx + tw, y], {color: c.c3, width: 5});
        for (var k = 0; k < m.n; k++) api.circle([tx + (k + 0.5) * tw * FOOT / v.tail, y], 4.6, {fill: c.c4, stroke: c.card, width: 1.2});
        L([tx + 2, y - 22], "poly(A) " + v.tail + " A", c.c3);
        L([tx + 2, y + 22], m.n ? m.n + " PABP" : "no PABP fits", m.n ? c.c4 : c.c5, {weight: 500});
      } else {
        api.line([tx, y], [tx + 40, y], {color: c.c1, width: 3, opacity: 0.4, dash: "4 3"});
        L([tx + 2, y - 22], "uncut 3′ end", c.c5);
      }
      // the route: nucleus | pore | cytoplasm, with six checkpoints
      var py = 168, stop = m.fail < 0 ? 5 : m.fail;
      api.line([210, 104], [210, py - 13], {color: c.faint, width: 3}); api.line([210, py + 13], [210, 204], {color: c.faint, width: 3});   // stops above the outcome sketch
      api.line([204, py - 13], [216, py - 13], {color: c.faint, width: 3}); api.line([204, py + 13], [216, py + 13], {color: c.faint, width: 3});
      L([16, 116], "nucleus", c.muted, {weight: 500}); L([388, 116], "cytoplasm", c.muted, {anchor: "end", weight: 500});
      api.line([CX[0], py], [CX[stop], py], {color: c.c1, width: 3});
      if (stop < 5) api.line([CX[stop], py], [CX[5], py], {color: c.faint, width: 2, dash: "3 5"});
      CHECK.forEach(function (nm, i) {
        var passed = i < stop || m.fail < 0, failed = i === m.fail, col = failed ? c.c5 : passed ? c.c4 : c.muted;
        api.circle([CX[i], py], 9, {fill: col, fillOpacity: failed || passed ? 0.85 : 0.12, stroke: col, width: 1.4});
        L([CX[i], py], failed ? "✕" : passed ? "✓" : "", c.card, {anchor: "middle", weight: 800});
        L(i === 3 ? [CX[i] + 6, py + 22] : [CX[i], py + 22], i === 3 ? "pore" : nm, col, {anchor: i === 3 ? "start" : "middle", weight: failed ? 700 : 500});
      });
      // the outcome under the route
      if (m.fail < 0) {
        // the closed loop: cap (purple) at the left, the tail's PABPs (green) curling back to it, eIF4G (blue) bridging them
        var o = [306, 250], r = 30, at = function (deg, rr) { var a = deg * Math.PI / 180; return [o[0] + (rr || r) * Math.cos(a), o[1] + (rr || r) * Math.sin(a)]; };
        api.circle(o, r, {stroke: c.c1, width: 3});
        api.circle(at(180), 6.5, {fill: c.c6});
        for (var j = 0; j < Math.min(m.n, 5); j++) api.circle(at(156 - j * 17), 4.6, {fill: c.c4, stroke: c.card, width: 1.2});
        api.path("M " + at(184, r + 9).join(" ") + " A " + (r + 9) + " " + (r + 9) + " 0 0 0 " + at(152, r + 9).join(" "), {stroke: c.c2, width: 4});
        [300, 20].forEach(function (d) { api.circle(at(d, r + 2), 9, {fill: c.ink, fillOpacity: 0.8}); });
        L([o[0] + r + 14, o[1] - 22], "ribosomes", c.ink, {weight: 500});
        L([o[0] - r - 16, o[1] - 8], "eIF4G bridges", c.c2, {anchor: "end", weight: 500});
        L([o[0] - r - 16, o[1] + 10], "cap and PABP", c.c2, {anchor: "end", weight: 500});
      } else {
        var fx = CX[m.fail], who = ["Xrn2 (5′→3′)", "nuclear exosome", "nuclear exosome"][m.fail];
        for (var f = 0; f < 5; f++) api.line([fx - 22 + f * 10, 226 + (f % 2) * 6], [fx - 16 + f * 10, 222 + (f % 2) * 6], {color: c.c1, width: 3, opacity: 0.55});
        api.arrow([fx, py + 32], [fx, 214], {color: c.c5, width: 1.8, halo: false, head: 7});
        // nuclear fates are written inside the nucleus, the cytoplasmic one inside the cytoplasm (clear of the envelope)
        if (m.fail === 4) { L([388, 250], "decapped, then degraded", c.c5, {anchor: "end"}); L([388, 268], "by Xrn1 in the cytoplasm", c.muted, {anchor: "end", weight: 500}); }
        else { L([16, 250], "degraded by " + who, c.c5); L([16, 268], "in the nucleus", c.muted, {weight: 500}); }
      }
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
