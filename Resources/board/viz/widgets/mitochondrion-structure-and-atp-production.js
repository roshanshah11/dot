// A mitochondrion and the inner-membrane machinery that makes most of a cell's ATP. Electrons from NADH enter at
// complex I, from FADH2 at complex II; they pass through ubiquinone (Q), complex III, cytochrome c and complex IV to O2.
// Pumped protons per pair of electrons: I 4, III 4, IV 2, so 10 per NADH and 6 per FADH2 (II pumps none). ATP synthase
// plus the ATP/ADP and phosphate carriers use about 4 H+ per ATP delivered to the cytosol: 2.5 ATP per NADH, 1.5 per
// FADH2 (Lehninger's P/O ratios). Per glucose: glycolysis, pyruvate dehydrogenase and the Krebs cycle give 10 NADH and
// 2 FADH2 with the malate-aspartate shuttle; the glycerol 3-phosphate shuttle hands the 2 cytosolic NADH to FAD
// instead (8 NADH, 4 FADH2). Substrate-level ATP: 2 from glycolysis, 2 (as GTP or ATP) from the Krebs cycle. So 32 or
// 30 ATP. Protons that leak back (UCP1 in brown fat, or an uncoupler such as DNP) release their energy as heat.
// Cyanide blocks complex IV: no electron flow, no pumping, the Krebs cycle stalls, and only glycolysis's 2 ATP remain.
(function () {
  function yieldOf(v) {
    var ma = v.shuttle === "malate-aspartate", nadh = ma ? 10 : 8, fadh = ma ? 2 : 4;
    var H = v.cyanide ? 0 : 10 * nadh + 6 * fadh, ox = (1 - v.leak) * H / 4, sub = v.cyanide ? 2 : 4;
    return {nadh: nadh, fadh: fadh, H: H, ox: ox, sub: sub, total: sub + ox, leaked: v.leak * H};
  }
  Viz.register("mitochondrion-structure-and-atp-production", {
    title: "Mitochondrion: structure and ATP production",
    subject: "biology",
    shows: "The folded inner membrane carries the electron transport chain: complexes I, III and IV pump 10 protons per NADH into the intermembrane space and ATP synthase spends about 4 per ATP; change the shuttle, let protons leak or block complex IV and watch the yield per glucose",
    params: {
      shuttle: {kind: "enum", values: ["malate-aspartate", "glycerol-phosphate"], default: "malate-aspartate", label: "\\text{shuttle}", names: {"malate-aspartate": "malate–aspartate", "glycerol-phosphate": "glycerol 3-P"}},
      leak: {kind: "number", default: 0, min: 0, max: 1, step: 0.05, label: "\\text{H}^+\\ \\text{leak}"},
      cyanide: {kind: "boolean", default: false, label: "\\text{cyanide}", on: "complex IV blocked", off: "none"}
    },
    formula: function (v) {
      var y = yieldOf(v);
      if (v.cyanide) return "H^+_{\\text{pumped}}=0\\ \\ (\\text{IV blocked})\\newline \\text{ATP}=2\\ \\ (\\text{glycolysis only})";
      return "H^+_{\\text{pumped}}=10\\cdot" + y.nadh + "+6\\cdot" + y.fadh + "=" + y.H + "\\newline \\text{ATP}=4+\\dfrac{(1-" + Viz.n(v.leak) + ")\\cdot" + y.H + "}{4}=" + Viz.n(y.total, 1);
    },
    status: function (v) {
      var y = yieldOf(v);
      if (v.cyanide) return "Cyanide stops complex IV, so electrons back up through III and I, <b>no protons</b> are pumped, the Krebs cycle stalls and only glycolysis's <b>2 ATP</b> per glucose remain.";
      if (v.leak >= 0.999) return "Fully uncoupled: all " + y.H + " pumped protons run back through the leak as <b>heat</b>; oxygen is still used but ATP synthase makes nothing, leaving <b>4 ATP</b> per glucose.";
      var s = "Per glucose: <b>" + Viz.fmt(y.total, 1) + " ATP</b>, " + Viz.fmt(y.ox, 1) + " of them from ATP synthase spending " + Viz.fmt(y.H - y.leaked, 1) + " of the " + y.H + " pumped protons";
      if (v.leak > 0) return s + "; the other " + Viz.fmt(y.leaked, 1) + " leak back as <b>heat</b>.";
      return s + (v.shuttle === "malate-aspartate" ? " (malate–aspartate shuttle: cytosolic NADH counts as NADH)." : " (glycerol 3-P shuttle: cytosolic NADH enters as FADH₂, pumping 6 protons instead of 10).");
    },
    examples: [
      {name: "coupled, malate–aspartate: 32 ATP", values: {leak: 0}},
      {name: "glycerol 3-phosphate shuttle: 30 ATP", values: {shuttle: "glycerol-phosphate"}},
      {name: "fully uncoupled (leak at maximum)", values: {leak: 1}},
      {name: "brown fat, half the protons leak", values: {leak: 0.5}},
      {name: "cyanide", values: {cyanide: true}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      var c = api.color, y = yieldOf(v);
      // ---- the organelle: outer membrane, inner membrane folded into cristae, matrix ----
      var X = 12, Y = 12, W = 214, H = 118;
      api.rect(X, Y, W, H, {stroke: c.ink, width: 2, rx: 56});
      api.rect(X + 8, Y + 8, W - 16, H - 16, {fill: c.c1, fillOpacity: 0.12, stroke: c.c1, width: 2, rx: 48});
      [56, 88, 120, 152, 184].forEach(function (x, i) {
        var top = i % 2 === 0, y0 = top ? Y + 8 : Y + H - 8, tip = top ? Y + 72 : Y + H - 72;
        api.path("M " + (x - 4) + " " + y0 + " L " + (x - 4) + " " + tip + " Q " + x + " " + (tip + (top ? 7 : -7)) + " " + (x + 4) + " " + tip + " L " + (x + 4) + " " + y0,
          {stroke: c.c1, width: 2, fill: c.card});
        for (var k = 0; k < 3; k++) {   // ATP synthase heads face the matrix along each crista
          var yy = y0 + (tip - y0) * (0.35 + k * 0.25);
          api.circle([x - 8, yy], 2.2, {fill: c.c3}); api.circle([x + 8, yy], 2.2, {fill: c.c3});
        }
      });
      api.circle([70, Y + 94], 6, {stroke: c.c6, width: 2}); api.circle([194, Y + 86], 5, {stroke: c.c6, width: 2});
      [[104, 86], [136, 22], [72, 28], [168, 96]].forEach(function (q) { api.circle([q[0], Y + q[1]], 1.8, {fill: c.muted}); });
      var lab = function (txt, col, ly, to) {
        api.line([X + W + 6, ly], to, {color: col, width: 1, opacity: 0.6});
        api.label([X + W + 10, ly], txt, {color: col, size: 12, weight: 600});
      };
      lab("outer membrane", c.ink, 18, [196, 18]);
      lab("intermembrane space", c.muted, 42, [222, 64]);
      lab("inner membrane: cristae", c.c1, 66, [188, 60]);
      lab("matrix: Krebs cycle", c.c1, 90, [204, 78]);
      lab("mtDNA", c.c6, 114, [199, Y + 88]);
      api.label([X + W + 10, 136], "ATP synthase heads", {color: c.c3, size: 12, weight: 600});
      // ---- zoom on one stretch of inner membrane (a schematic; the order along the membrane is arbitrary) ----
      var mT = 214, mB = 242, on = !v.cyanide, eo = on ? 0.95 : 0.35;
      api.rect(8, 150, 312, 186, {fill: c.ink, fillOpacity: 0.03, rx: 8});
      api.label([16, 162], "intermembrane space: high [H⁺]", {color: c.muted, size: 12, raw: true});
      api.label([16, 328], "matrix: low [H⁺]", {color: c.muted, size: 12, raw: true});
      api.rect(10, mT, 308, mB - mT, {fill: c.c1, fillOpacity: 0.2, rx: 2});
      // electron path first, so the complexes sit over it
      api.polyline([[72, 290], [72, 236], [136, 230], [166, 228], [199, 204], [222, 228], [222, 290]], {stroke: c.c2, width: 2, dash: "4 3", opacity: eo});
      api.polyline([[112, 302], [112, 240], [136, 232]], {stroke: c.c2, width: 2, dash: "4 3", opacity: eo});
      var box = function (x, w, t, b, name, ny) {
        api.rect(x - w / 2, t, w, b - t, {fill: c.muted, fillOpacity: 0.6, rx: 5});
        api.label([x - (ny ? 0 : 7), ny || t + 9], name, {color: c.ink, size: 12, weight: 700, anchor: "middle"});
      };
      box(72, 32, 196, 262, "I"); box(112, 22, 222, 260, "II", 250); box(166, 30, 198, 258, "III"); box(226, 30, 198, 258, "IV");
      api.circle([136, 230], 7.5, {fill: c.c2, fillOpacity: 0.9}); api.label([136, 230.5], "Q", {color: c.card, size: 12, weight: 800, anchor: "middle"});
      api.circle([199, 202], 6.5, {fill: c.c2, fillOpacity: 0.9}); api.label([199, 188], "cyt c", {color: c.c2, size: 12, anchor: "middle"});
      api.label([72, 302], "NADH", {color: c.c2, size: 12, anchor: "middle", weight: 600});
      api.label([112, 314], "FADH_2", {color: c.c2, size: 12, anchor: "middle", weight: 600});
      api.label([214, 302], "O_2 → H_2O", {color: c.c2, size: 12, anchor: "middle", weight: 600});
      // pumped protons, matrix to intermembrane space, through I, III and IV
      [[80, 4], [174, 4], [234, 2]].forEach(function (p) {
        api.arrow([p[0], 278], [p[0], 182], {color: c.c5, width: 2, halo: false, opacity: on ? 1 : 0.25});
        if (on) api.label([p[0], 174], p[1] + "H⁺", {color: c.c5, size: 12, weight: 650, anchor: "middle", raw: true});
      });
      if (v.cyanide) {
        api.line([212, 214], [240, 244], {color: c.c5, width: 3}); api.line([240, 214], [212, 244], {color: c.c5, width: 3});
        api.label([234, 174], "CN⁻ blocks IV", {color: c.c5, size: 12, weight: 700, raw: true, anchor: "middle"});
      }
      // proton leak (UCP1 or an uncoupler): back to the matrix without making ATP
      api.rect(22, mT - 4, 12, mB - mT + 8, {fill: c.c5, fillOpacity: 0.4, rx: 3});
      api.label([28, 180], "leak", {color: c.c5, size: 12, anchor: "middle"});
      if (on && v.leak > 0) {
        api.arrow([28, 188], [28, 284], {color: c.c5, width: 1.5 + 4 * v.leak, halo: false});
        api.label([28, 302], "heat", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      }
      // ATP synthase: F0 in the membrane, F1 head in the matrix
      var flow = on ? 1 - v.leak : 0;
      api.rect(269, mT - 6, 22, mB - mT + 12, {fill: c.c3, fillOpacity: 0.6, rx: 4});
      api.line([280, mB + 6], [280, 262], {color: c.c3, width: 4});
      api.circle([280, 276], 15, {fill: c.c3, fillOpacity: flow > 0 ? 0.9 : 0.35});
      api.label([280, 276.5], "ATP", {color: c.card, size: 12, weight: 800, anchor: "middle"});
      if (flow > 0) api.arrow([306, 182], [306, 268], {color: c.c5, width: 1.5 + 4 * flow, halo: false});
      api.label([282, 318], "ATP synthase", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      // ---- the tally per glucose ----
      var bx = 336, bw = 20, base = 316, top = 186, sc = (base - top) / 33;
      api.label([362, 160], "ATP per", {color: c.muted, size: 12, anchor: "middle"});
      api.label([362, 174], "glucose", {color: c.muted, size: 12, anchor: "middle"});
      api.rect(bx, base - 32 * sc, bw, 32 * sc, {stroke: c.faint, dash: "3 3", rx: 3});
      api.rect(bx, base - y.sub * sc, bw, y.sub * sc, {fill: c.muted, fillOpacity: 0.8, rx: 2});
      if (y.ox > 0) api.rect(bx, base - y.total * sc, bw, y.ox * sc, {fill: c.c3, fillOpacity: 0.9, rx: 2});
      api.label([bx + bw + 5, base - y.total * sc - 2], Viz.fmt(y.total, 1), {color: c.ink, size: 14, weight: 750});
      if (y.ox > 3) api.label([bx + bw + 5, base - y.sub * sc / 2 + 3], "2+2", {color: c.muted, size: 12});
      if (y.ox > 6) api.label([bx + bw + 5, base - y.sub * sc - y.ox * sc / 2 + 6], Viz.fmt(y.ox, 1), {color: c.c3, size: 12, weight: 650});
      api.label([bx + bw / 2, base + 13], "max 32", {color: c.faint, size: 12, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
