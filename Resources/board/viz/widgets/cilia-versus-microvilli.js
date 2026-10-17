// Cilia and microvilli are both fingers of the apical membrane, built from different filaments for different jobs.
// A motile cilium (airway, oviduct) is about 0.25 µm wide and 5-10 µm long: a 9 + 2 axoneme of microtubules grown from
// a basal body. Dynein arms on one side walk along the neighbouring doublet; nexin links and radial spokes stop the
// doublets sliding past each other, so the slide becomes a bend. It beats: a straight effective stroke whose tip drags
// the mucus, then a bent recovery stroke low in the watery layer underneath, with the other side's dynein arms active.
// A microvillus (intestinal brush border, kidney proximal tubule) is about 0.1 µm wide and 1 µm long: a core of 20-30
// parallel actin filaments crosslinked by villin and fimbrin, tied to the membrane by myosin I and rooted in the
// terminal web. It does not beat; it multiplies membrane area for absorption.
// Side view is to scale (20 px per µm, cilia 6 µm); the two cross-sections are to scale with each other (0.56 px per nm).
(function () {
  Viz.register("cilia-versus-microvilli", {
    title: "Cilia versus microvilli",
    subject: "biology",
    shows: "Step through a beat: the cilium's 9 + 2 microtubules and dynein make it sweep mucus, while the shorter, thinner microvilli are actin bundles that stay still and add absorbing surface",
    params: {
      view: {kind: "enum", values: ["side", "cross"], names: {side: "side view", cross: "cross-section"}, default: "side", label: "\\text{view}"}
    },
    steps: ["effective stroke", "recovery stroke"],
    stepMs: 1500,
    formula: function (v) {
      return v.view === "side" ? "\\frac{L_{\\text{cilium}}}{L_{\\text{microvillus}}}\\approx\\frac{6\\ \\mu\\text{m}}{1\\ \\mu\\text{m}}=6"
                               : "\\frac{d_{\\text{cilium}}}{d_{\\text{microvillus}}}\\approx\\frac{250\\ \\text{nm}}{100\\ \\text{nm}}=2.5";
    },
    status: function (v) {
      var s = v.step || 1;
      if (v.view === "side") return s === 1
        ? "Effective stroke: each cilium stays <b>straight</b> and sweeps forward, its tip dragging the mucus along, while the microvilli next door never move; they only add membrane for absorption."
        : "Recovery stroke: the cilium <b>bends</b> and swings back low, under the mucus, so the net push is one way; a microvillus is about <b>1 µm</b> tall, a sixth of a cilium, and still.";
      return s === 1
        ? "A cilium is a <b>9 + 2</b> ring of microtubules about 250 nm across; dynein arms on one side walk along the next doublet, and because the doublets are tied together the sliding becomes a bend."
        : "For the return stroke the dynein arms on the <b>other side</b> take over; a microvillus is only about 100 nm across, a bundle of <b>20 to 30 actin filaments</b> with nothing in it that beats.";
    },
    examples: [
      {name: "effective stroke, side view", values: {view: "side", step: 1}},
      {name: "recovery stroke, side view", values: {view: "side", step: 2}},
      {name: "9 + 2 axoneme beside an actin bundle", values: {view: "cross", step: 1}},
      {name: "the other dynein arms take over", values: {view: "cross", step: 2}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, CIL = c.c1, ACT = c.c3, DYN = c.c5;
      if (v.view === "side") {
        var Y = 206, L = 120;                                        // apical surface; a 6 µm cilium at 20 px per µm
        api.rect(12, Y, 214, 88, {fill: c.ink, fillOpacity: 0.03, stroke: c.muted, width: 1.2, rx: 8});
        api.rect(238, Y, 150, 88, {fill: c.ink, fillOpacity: 0.03, stroke: c.muted, width: 1.2, rx: 8});
        // mucus on top of the watery layer the cilia beat in
        api.rect(12, 72, 214, 26, {fill: c.muted, fillOpacity: 0.18, rx: 4});
        api.label([18, 62], "mucus", {color: c.muted, size: 12});
        var bases = [88, 108, 128, 148, 168, 188];
        bases.forEach(function (x) {
          api.rect(x - 3, Y + 2, 6, 10, {fill: CIL, fillOpacity: 0.55, rx: 1.5});   // basal body
          var pts = [];
          if (s === 1) {                                              // straight, tilted forward
            var a = 20 * Math.PI / 180;
            pts = [[x, Y], [x + L * Math.sin(a), Y - L * Math.cos(a)]];
          } else {                                                    // an arc of the same length, curled back low
            var phi = 100 * Math.PI / 180, R = L / phi;
            for (var k = 0; k <= 16; k++) { var al = phi * k / 16; pts.push([x - R * (1 - Math.cos(al)), Y - R * Math.sin(al)]); }
          }
          api.polyline(pts, {stroke: CIL, width: 5});
          api.polyline(pts, {stroke: c.card, width: 1.2, opacity: 0.7});   // the axoneme's core line
        });
        if (s === 1) {
          api.arrow([70, 44], [214, 44], {color: c.ink, width: 2, halo: false});
          api.label([142, 30], "tips push the mucus forward", {color: c.ink, size: 12, anchor: "middle"});
        } else {
          api.path("M 206 170 Q 160 116 100 128", {stroke: c.ink, width: 2, arrow: true});
          api.label([128, 108], "swings back low", {color: c.ink, size: 12, anchor: "middle"});
          api.label([142, 36], "tips stay clear of the mucus", {color: c.muted, size: 12, anchor: "middle"});
        }
        api.label([20, 230], "basal bodies", {color: CIL, size: 12});
        api.label([20, 264], "ciliated airway cell", {color: c.muted, size: 12});
        api.label([20, 282], "cilia: 9 + 2 microtubules", {color: CIL, size: 12, weight: 650});
        // brush border: microvilli 1 µm tall, 0.1 µm wide, rooted in the terminal web
        for (var x = 244; x <= 382; x += 5) {
          api.rect(x - 1.3, Y - 20, 2.6, 21, {fill: ACT, rx: 1.3});
        }
        api.rect(240, Y + 3, 146, 6, {fill: ACT, fillOpacity: 0.25, rx: 2});
        api.label([313, 170], "microvilli: still", {color: ACT, size: 12.5, weight: 650, anchor: "middle"});
        api.label([244, 228], "terminal web", {color: ACT, size: 12});
        api.label([244, 264], "intestinal cell", {color: c.muted, size: 12});
        api.label([244, 282], "actin core", {color: ACT, size: 12, weight: 650});
        api.line([340, 250], [360, 250], {color: c.ink, width: 2.5});
        api.label([350, 238], "1 µm", {color: c.ink, size: 12, anchor: "middle"});
      } else {
        var C = [112, 140], k0 = 0.56;                                 // px per nm
        api.label([C[0], 22], "cilium", {color: CIL, size: 13, weight: 650, anchor: "middle"});
        api.circle(C, 125 * k0, {stroke: CIL, width: 2, fill: CIL, fillOpacity: 0.05});
        var activeRight = s === 1;
        for (var i = 0; i < 9; i++) {
          var a = -Math.PI / 2 + 2 * Math.PI * i / 9, ca = Math.cos(a), sa = Math.sin(a), tx = -sa, ty = ca;
          var A = [C[0] + 46 * ca - 4 * tx, C[1] + 46 * sa - 4 * ty], B = [C[0] + 48 * ca + 7 * tx, C[1] + 48 * sa + 7 * ty];
          api.circle(B, 6, {stroke: CIL, width: 1.6});
          api.circle(A, 6.5, {stroke: CIL, width: 1.8, fill: CIL, fillOpacity: 0.25});
          api.line([C[0] + 39 * ca, C[1] + 39 * sa], [C[0] + 24 * ca, C[1] + 24 * sa], {color: c.muted, width: 1.3});   // radial spoke
          var on = activeRight ? ca > 0.15 : ca < -0.15, col = on ? DYN : c.muted;
          [52, 41].forEach(function (r) {                                   // outer and inner dynein arms, reaching to the next doublet
            api.line([C[0] + r * ca - 8 * tx, C[1] + r * sa - 8 * ty], [C[0] + r * ca - 15 * tx, C[1] + r * sa - 15 * ty], {color: col, width: on ? 3 : 1.6});
          });
        }
        api.circle([C[0] - 8, C[1]], 6.5, {stroke: CIL, width: 1.8, fill: CIL, fillOpacity: 0.25});
        api.circle([C[0] + 8, C[1]], 6.5, {stroke: CIL, width: 1.8, fill: CIL, fillOpacity: 0.25});
        api.label([C[0], C[1] + 96], "9 doublets + central pair", {color: CIL, size: 12, anchor: "middle"});
        api.label(activeRight ? [C[0] + 74, C[1] - 70] : [C[0] - 74, C[1] - 70], "active dynein", {color: DYN, size: 12, weight: 650, anchor: activeRight ? "start" : "end"});
        api.arrow(activeRight ? [C[0] + 80, C[1] - 52] : [C[0] - 80, C[1] - 52], activeRight ? [C[0] + 62, C[1] - 38] : [C[0] - 62, C[1] - 38], {color: DYN, width: 2, halo: false, head: 8});
        api.line([C[0] - 70, C[1] + 80], [C[0] + 70, C[1] + 80], {color: c.muted, width: 1.2});
        api.label([C[0], C[1] + 114], "≈ 250 nm across", {color: c.muted, size: 12, anchor: "middle"});
        // microvillus, same scale
        var M = [310, 120], rm = 50 * k0;
        api.label([M[0], 22], "microvillus", {color: ACT, size: 13, weight: 650, anchor: "middle"});
        api.circle(M, rm, {stroke: ACT, width: 2, fill: ACT, fillOpacity: 0.05});
        for (var j = 0; j < 8; j++) { var b = 2 * Math.PI * j / 8 + 0.2; api.line([M[0] + 16 * Math.cos(b), M[1] + 16 * Math.sin(b)], [M[0] + 26 * Math.cos(b), M[1] + 26 * Math.sin(b)], {color: c.muted, width: 1.2}); }
        var dots = [[0, 0]];
        for (j = 0; j < 8; j++) dots.push([6.5 * Math.cos(2 * Math.PI * j / 8), 6.5 * Math.sin(2 * Math.PI * j / 8)]);
        for (j = 0; j < 16; j++) dots.push([13 * Math.cos(2 * Math.PI * j / 16 + 0.2), 13 * Math.sin(2 * Math.PI * j / 16 + 0.2)]);
        dots.forEach(function (d) { api.circle([M[0] + d[0], M[1] + d[1]], 2.1, {fill: ACT}); });
        api.line([M[0] - rm, M[1] + 40], [M[0] + rm, M[1] + 40], {color: c.muted, width: 1.2});
        api.label([M[0], M[1] + 54], "≈ 100 nm", {color: c.muted, size: 12, anchor: "middle"});
        api.label([M[0], M[1] + 80], "20–30 actin filaments", {color: ACT, size: 12, anchor: "middle"});
        api.label([M[0], M[1] + 98], "crosslinked by villin, fimbrin", {color: c.muted, size: 12, anchor: "middle"});
        api.label([M[0], M[1] + 116], "never beats", {color: c.muted, size: 12, anchor: "middle"});
        api.line([290, 274], [346, 274], {color: c.ink, width: 2.5});
        api.label([318, 288], "100 nm", {color: c.ink, size: 12, anchor: "middle"});
      }
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
