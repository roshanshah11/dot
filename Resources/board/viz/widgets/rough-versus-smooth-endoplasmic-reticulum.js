// Rough versus smooth ER, told through what each makes, in the cell type that specializes in it. Rough ER (ribosomes on
// its cytosolic face, sheets continuous with the nuclear envelope) makes proteins that are secreted, embedded in
// membranes or sent to lysosomes: an SRP-guided ribosome threads the chain through the translocon. Smooth ER (tubules,
// no ribosomes) makes lipids and steroids, holds drug-metabolizing enzymes, and stores Ca2+ (the sarcoplasmic reticulum).
// Insulin (pancreatic beta cell, mostly rough ER): signal peptide cut in the ER, three disulfide bonds, proinsulin cut to
// insulin + C-peptide in secretory granules. A membrane receptor (hepatocyte): a stop-transfer stretch anchors it in the
// ER membrane, N-glycans go on in the lumen, vesicles carry it via the Golgi to the surface. Testosterone (Leydig cell,
// mostly smooth ER): P450scc in mitochondria makes pregnenolone; 3beta-HSD, CYP17A1 and 17beta-HSD3 in the ER finish it;
// steroids leave by diffusion, not in vesicles. Drug detox (hepatocyte): P450 monooxygenation R-H + O2 + NADPH + H+ ->
// R-OH + H2O + NADP+, then UGT adds glucuronic acid. Muscle: SERCA pumps 2 Ca2+ per ATP into the SR; at an action
// potential RyR1 releases it (cytosolic Ca2+ rises about a hundredfold from ~0.1 uM), troponin C binds it, SERCA re-pumps.
(function () {
  var P = {
    insulin: {cell: "pancreatic β cell", rer: 5, ser: 1, er: "rough", from: [196, 52], pts: [[136, 81], [129, 136], [366, 186]],
      what: ["preproinsulin", "proinsulin", "insulin granules"],
      tex: ["\\text{ribosome}+\\text{SRP}\\to\\text{translocon}\\to\\text{RER lumen}", "\\text{preproinsulin}\\xrightarrow{\\text{signal peptidase}}\\text{proinsulin}\\ (3\\ \\text{S–S})",
            "\\text{proinsulin}\\xrightarrow{\\text{granule proteases}}\\text{insulin}+\\text{C-peptide}"],
      say: ["A ribosome making preproinsulin is steered by SRP to the <b>rough ER</b>, and the chain is threaded through the translocon into the lumen.",
            "Inside the rough ER the signal peptide is cut off and the chain folds with <b>three disulfide bonds</b>: proinsulin.",
            "Vesicles carry proinsulin to the Golgi and into <b>secretory granules</b>, where it is cut to insulin and C-peptide, ready to be released."]},
    receptor: {cell: "hepatocyte", rer: 3, ser: 4, er: "rough", from: [190, 48], pts: [[121, 90], [332, 108], [392, 50]],
      what: ["receptor chain", "glycosylated", "at the surface"],
      tex: ["\\text{signal}\\to\\text{translocon};\\ \\text{stop-transfer}\\to\\text{stays in membrane}", "\\text{N-X-S/T}+\\text{glycan}\\xrightarrow{\\text{OST}}\\text{glycoprotein}",
            "\\text{RER}\\to\\text{Golgi}\\to\\text{plasma membrane}"],
      say: ["A ribosome on the <b>rough ER</b> makes the receptor; a hydrophobic stop-transfer stretch stays in the ER membrane as its anchor.",
            "Sugar chains are added on the lumen side, then a vesicle buds off and carries the receptor <b>in its membrane</b> to the Golgi.",
            "A vesicle fuses with the plasma membrane, so the side that faced the ER lumen, sugars and all, now faces <b>outside the cell</b>."]},
    steroid: {cell: "Leydig cell", rer: 1, ser: 6, er: "smooth", from: [323, 216], pts: [[323, 169], [236, 112], [392, 150]],
      what: ["pregnenolone", "testosterone", "testosterone out"],
      tex: ["\\text{cholesterol}\\xrightarrow{\\text{P450scc (mitochondrion)}}\\text{pregnenolone}", "\\text{pregnenolone}\\xrightarrow{3\\beta\\text{-HSD, CYP17, }17\\beta\\text{-HSD}}\\text{testosterone}",
            "\\text{testosterone}\\to\\text{blood, by diffusion}"],
      say: ["Cholesterol is cut to pregnenolone in a mitochondrion; this Leydig cell is packed with <b>smooth ER</b> and has little rough ER.",
            "Enzymes in the <b>smooth ER</b> membrane turn pregnenolone into testosterone, step by step, with no ribosomes involved.",
            "Testosterone is fat-soluble, so it simply <b>diffuses out</b> through the plasma membrane; no vesicles and no Golgi."]},
    detox: {cell: "hepatocyte", rer: 3, ser: 4, er: "smooth", from: [236, 8], pts: [[236, 88], [236, 136], [300, 216]],
      what: ["fat-soluble drug", "R–OH + glucuronide", "to bile"],
      tex: ["\\text{fat-soluble drug}\\to\\text{SER membrane}", "\\text{R–H}+\\text{O}_2+\\text{NADPH}+\\text{H}^+\\xrightarrow{\\text{P450}}\\text{R–OH}+\\text{H}_2\\text{O}+\\text{NADP}^+",
            "\\text{R–OH}\\xrightarrow{\\text{UGT}}\\text{R–O–glucuronide}\\to\\text{bile, urine}"],
      say: ["A fat-soluble drug slips into the liver cell and dissolves in the <b>smooth ER</b> membrane, where the detox enzymes sit.",
            "<b>Cytochrome P450</b> adds an –OH using O₂ and NADPH, and UGT then attaches glucuronic acid, so the drug becomes water-soluble.",
            "The water-soluble product is pumped into <b>bile</b> or blood and excreted; long drug exposure makes the smooth ER grow."]},
    calcium: {cell: "skeletal muscle fiber", er: "smooth", sr: true,
      what: ["Ca²⁺ stored", "Ca²⁺ released", "bound, then re-pumped"],
      tex: ["\\text{SERCA: } 2\\,\\text{Ca}^{2+}\\text{ into the SR per ATP}", "\\text{RyR1 opens: }[\\text{Ca}^{2+}]_{\\text{cytosol}}\\ \\times\\!\\sim\\!100",
            "\\text{Ca}^{2+}+\\text{troponin C}\\to\\text{contraction};\\ \\text{SERCA re-pumps}"],
      say: ["At rest SERCA pumps (2 Ca²⁺ per ATP) keep Ca²⁺ inside the <b>sarcoplasmic reticulum</b>, the muscle cell's smooth ER.",
            "An action potential runs down the T-tubules and opens <b>ryanodine receptors</b>, so Ca²⁺ floods out and cytosolic Ca²⁺ rises about a hundredfold.",
            "Ca²⁺ binds troponin C and the sarcomeres <b>contract</b>; SERCA then pumps it back into the SR and the muscle relaxes."]}
  };
  function wave(x0, x1, y, amp, ph) { var d = "M " + x0 + " " + y.toFixed(1); for (var x = x0 + 5; x <= x1; x += 5) d += " L " + x + " " + (y + amp * Math.sin((x - x0) / 9 + ph)).toFixed(1); return d; }
  Viz.register("rough-versus-smooth-endoplasmic-reticulum", {
    title: "Rough versus smooth ER",
    subject: "biology",
    shows: "Pick a product and step it through its cell: proteins to secrete or embed come off ribosomes on the rough ER; steroids, drug detox and Ca²⁺ storage belong to the smooth ER",
    params: {
      product: {kind: "enum", values: ["insulin", "receptor", "steroid", "detox", "calcium"], names: {calcium: "Ca²⁺"}, default: "insulin", label: "\\text{product}"}
    },
    steps: ["made", "processed", "delivered"],
    stepMs: 1900,
    formula: function (v) { return P[v.product].tex[(v.step || 1) - 1]; },
    status: function (v) { return P[v.product].say[(v.step || 1) - 1]; },
    examples: [
      {name: "insulin in the rough ER", values: {product: "insulin", step: 2}},
      {name: "receptor reaches the surface", values: {product: "receptor", step: 3}},
      {name: "steroid in the smooth ER", values: {product: "steroid", step: 2}},
      {name: "drug detox", values: {product: "detox", step: 2}},
      {name: "muscle Ca²⁺ release", values: {product: "calcium", step: 2}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, p = P[v.product], s = v.step || 1;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      api.rect(8, 8, 384, 208, {stroke: c.muted, width: 1.5, rx: 26});
      if (!p.sr) {
        var N = [62, 124], polar = function (deg, r) { var a = deg * Math.PI / 180; return [N[0] + r * Math.cos(a), N[1] + r * Math.sin(a)]; };
        api.circle(N, 36, {fill: c.muted, fillOpacity: 0.14, stroke: c.muted, width: 1.5});
        L(N, "nucleus", c.muted, {anchor: "middle", weight: 500});
        for (var k = 0; k < p.rer; k++) {   // rough ER sheets wrap the nucleus, studded with ribosomes
          var r = 46 + 9 * k;
          api.path("M " + polar(-60, r).join(" ") + " A " + r + " " + r + " 0 0 1 " + polar(60, r).join(" "), {stroke: c.c2, width: 4.5});
          for (var a = -56; a <= 56; a += 8) api.circle(polar(a, r + 4), 1.7, {fill: c.ink});
        }
        L(polar(-64, 50 + 9 * p.rer), "rough ER", c.c2, {anchor: "middle"});
        for (var j = 0; j < p.ser; j++) api.path(wave(176, 290, 124 + (j - (p.ser - 1) / 2) * 24, 6, j), {stroke: c.c1, width: 4.5});
        L([233, 124 + (p.ser - 1) / 2 * 24 + 18], "smooth ER", c.c1, {anchor: "middle"});
        for (var g = 0; g < 4; g++) api.path("M 310 " + (84 + g * 11) + " Q 332 " + (98 + g * 11) + " 354 " + (84 + g * 11), {stroke: c.c3, width: 4});
        L([332, 70], "Golgi", c.c3, {anchor: "middle"});
        if (v.product === "steroid") {
          api.rect(298, 158, 50, 22, {stroke: c.c4, width: 1.6, rx: 11});
          [310, 322, 334].forEach(function (x) { api.line([x, 162], [x, 176], {color: c.c4, width: 1.2}); });
          L([323, 194], "mitochondrion", c.c4, {anchor: "middle", weight: 500});
        }
        // the product's route so far (dashed), this step's move (arrow), and where it is now
        var trail = [p.from].concat(p.pts.slice(0, s));
        api.polyline(trail.slice(0, -1), {stroke: c.c5, width: 1.5, dash: "3 4", opacity: 0.6});
        api.arrow(trail[s - 1], trail[s], {color: c.c5, width: 2.2, halo: false, head: 8});
        var at = p.pts[s - 1];
        if (v.product === "insulin" && s === 3) [[-14, -10], [-2, -18], [-8, 4]].forEach(function (d) { api.circle([at[0] + d[0], at[1] + d[1]], 6, {fill: c.c5, fillOpacity: 0.35, stroke: c.c5, width: 1.4}); });
        else api.circle(at, 5.5, {fill: c.c5});
        L([380, 24], "→ " + p.what[s - 1], c.c5, {anchor: "end"});   // a fixed caption: the marker moves through crowded places
        L([20, 24], p.cell, c.ink, {weight: 650});
      } else {
        // a muscle fiber: myofibrils (muted, striated), sarcoplasmic reticulum (teal) between them, T-tubules (dashed)
        var bands = [52, 116, 180], z = s === 3 ? 30 : 40;
        bands.forEach(function (y) {
          api.rect(22, y - 16, 356, 32, {fill: c.muted, fillOpacity: s === 3 ? 0.3 : 0.16, rx: 4});
          for (var x = 22 + z; x < 378; x += z) api.line([x, y - 16], [x, y + 16], {color: c.muted, width: 1.4});
        });
        [84, 148].forEach(function (y) { api.line([24, y], [376, y], {color: c.c1, width: 7, opacity: 0.85}); });
        [130, 270].forEach(function (x) { api.line([x, 14], [x, 212], {color: c.ink, width: 1.4, dash: "4 4", opacity: 0.7}); });
        L([136, 22], "T-tubule", c.ink, {weight: 500});
        L([150, 98], "SR (smooth ER)", c.c1);
        L([370, 22], p.cell, c.ink, {anchor: "end", weight: 650});
        var ca = [];
        for (var i = 0; i < 14; i++) ca.push([40 + i * 25, i % 2 ? 148 : 84]);
        ca.forEach(function (q, i) {
          var pos = s === 1 ? q : s === 2 ? [q[0] + 6, q[1] + (i % 4 < 2 ? -20 : 20)] : [q[0] + 4, q[1] + (i % 4 < 2 ? -30 : 30)];
          api.circle(pos, 3.6, {fill: c.c5});
        });
        if (s === 2) [130, 270].forEach(function (x) { [84, 148].forEach(function (y) { api.arrow([x + 4, y], [x + 4, y + (y === 84 ? -24 : 24)], {color: c.c5, width: 2, halo: false, head: 7}); }); });
        if (s === 3) [200, 330].forEach(function (x) { api.arrow([x, 120], [x, 144], {color: c.c1, width: 2, halo: false, head: 7}); });
        L([200, s === 1 ? 202 : 202], s === 1 ? "Ca²⁺ held inside the SR" : s === 2 ? "Ca²⁺ floods the cytosol" : "sarcomeres shorten; SERCA re-pumps", c.c5, {anchor: "middle"});
      }
      // which ER this product uses
      [["rough", "rough ER · ribosomes", "proteins to secrete, embed", "or send to lysosomes", c.c2, 8], ["smooth", "smooth ER · no ribosomes", "lipids and steroids, drug", "detox, Ca²⁺ store", c.c1, 204]].forEach(function (b) {
        var on = p.er === b[0];
        api.rect(b[5], 230, 188, 64, {fill: b[4], fillOpacity: on ? 0.16 : 0.03, stroke: on ? b[4] : c.grid, width: on ? 2 : 1, rx: 8});
        L([b[5] + 10, 246], b[1], on ? b[4] : c.muted, {weight: on ? 700 : 500});
        L([b[5] + 10, 264], b[2], on ? c.ink : c.muted, {weight: 500});
        L([b[5] + 10, 280], b[3], on ? c.ink : c.muted, {weight: 500});
      });
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
