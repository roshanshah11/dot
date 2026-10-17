// The three cytoskeletal filaments side by side. Top row: cross-sections to scale (2.4 px per nm): an actin filament
// about 7 nm (two strands of G-actin), an intermediate filament about 10 nm (a rope of coiled-coil proteins), a
// microtubule about 25 nm (a hollow ring of 13 protofilaments of alpha-beta tubulin). Below: a side view of the one
// picked. Actin and microtubules are polar (a fast-growing + end), bind a nucleotide (ATP, GTP) and carry motors
// (myosins on actin; kinesins toward +, dyneins toward - on microtubules). Intermediate filaments have no polarity,
// no nucleotide and no motors; they are built for tensile strength (keratin, vimentin, neurofilaments, nuclear lamins)
// and stretch to 2-3 times their length before breaking, where actin and microtubules snap.
(function () {
  var F = {
    actin: {name: "actin filament", d: 7, sub: "subunit: G-actin + ATP  ·  + and − ends", jobs: "jobs: muscle, cell crawling, cytokinesis, microvilli",
            tex: "d\\approx7\\,\\text{nm}\\newline\\text{2 strands of G-actin}\\cdot\\text{ATP},\\ \\text{polar}"},
    intermediate: {name: "intermediate filament", d: 10, sub: "subunit: coiled-coil dimers  ·  no polarity", jobs: "jobs: tensile strength, nuclear lamina, desmosomes",
            tex: "d\\approx10\\,\\text{nm}\\newline\\text{coiled-coil rope, no nucleotide}"},
    microtubule: {name: "microtubule", d: 25, sub: "subunit: αβ-tubulin + GTP  ·  13 protofilaments", jobs: "jobs: mitotic spindle, cilia, organelle transport",
            tex: "d\\approx25\\,\\text{nm}\\newline 13\\ \\alpha\\beta\\text{-tubulin protofilaments}\\cdot\\text{GTP}"}
  };
  var TEXT = {
    actin: "Actin filaments are the thinnest (about <b>7 nm</b>), a two-stranded helix of ATP-bound actin that grows fastest at its + end, and myosin motors pull on them to contract muscle, crawl and pinch a dividing cell in two.",
    intermediate: "Intermediate filaments (about <b>10 nm</b>) are ropes of keratin, vimentin or lamins with no polarity, no nucleotide and no motors, so they do one job: bear tension, stretching 2 to 3 times before they break.",
    microtubule: "Microtubules are the widest (about <b>25 nm</b>), hollow tubes of GTP-bound tubulin that grow and shrink at the + end, with kinesin walking toward + and dynein toward − to haul cargo and build the spindle."
  };

  Viz.register("cytoskeletal-filament-comparison", {
    title: "Three cytoskeletal filaments",
    subject: "biology",
    shows: "Pick a filament: actin (7 nm) and microtubules (25 nm) are polar, use ATP or GTP and carry motors, while intermediate filaments (10 nm) are unpolarized ropes built to bear tension",
    params: {
      fil: {kind: "enum", values: ["actin", "intermediate", "microtubule"], names: {actin: "actin", intermediate: "intermediate", microtubule: "microtubule"}, default: "actin", label: "\\text{filament}"}
    },
    formula: function (v) { return F[v.fil].tex; },
    status: function (v) { return TEXT[v.fil]; },
    examples: [
      {name: "actin filament", values: {fil: "actin"}},
      {name: "intermediate filament", values: {fil: "intermediate"}},
      {name: "microtubule", values: {fil: "microtubule"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, sel = v.fil, COL = {actin: c.c3, intermediate: c.c6, microtubule: c.c1}, k = 2.4, cy = 62;
      var op = function (f) { return f === sel ? 1 : 0.35; };
      // cross-sections, to scale
      var cx = {actin: 64, intermediate: 176, microtubule: 314};
      var g = api.group({opacity: op("actin")});
      [-3.5, 3.5].forEach(function (o) { api.circle([cx.actin + o, cy], 4.6, {fill: COL.actin, fillOpacity: 0.8, stroke: COL.actin, width: 1, parent: g}); });
      g = api.group({opacity: op("intermediate")});
      for (var i = 0; i < 8; i++) { var a = 2 * Math.PI * i / 8; api.circle([cx.intermediate + 8.4 * Math.cos(a), cy + 8.4 * Math.sin(a)], 3.6, {fill: COL.intermediate, fillOpacity: 0.8, parent: g}); }
      g = api.group({opacity: op("microtubule")});
      for (i = 0; i < 13; i++) { a = 2 * Math.PI * i / 13; api.circle([cx.microtubule + 24 * Math.cos(a), cy + 24 * Math.sin(a)], 5.8, {fill: COL.microtubule, fillOpacity: 0.8, parent: g}); }
      ["actin", "intermediate", "microtubule"].forEach(function (f) {
        api.label([cx[f], cy + 46], (f === "intermediate" ? "IF" : f) + " ≈ " + F[f].d + " nm", {color: COL[f], size: 12, weight: f === sel ? 700 : 500, anchor: "middle", opacity: f === sel ? 1 : 0.6});
      });
      api.label([cx.microtubule + 44, cy - 28], "hollow", {color: c.muted, size: 12, opacity: op("microtubule")});
      api.line([16, 124], [384, 124], {color: c.grid, width: 1});
      api.label([16, 142], "side view: " + F[sel].name, {color: COL[sel], size: 12.5, weight: 700});
      var y0 = 190, x0 = 54, x1 = 330, col = COL[sel];
      if (sel === "actin") {
        for (var j = 0; j < 21; j++) {
          var x = x0 + j * 13.5, ph = 2 * Math.PI * j / 13;
          api.circle([x, y0 - 5.5 * Math.cos(ph)], 7, {fill: col, fillOpacity: 0.85, stroke: c.card, width: 1});
          api.circle([x + 6.7, y0 + 5.5 * Math.cos(ph)], 7, {fill: col, fillOpacity: 0.55, stroke: c.card, width: 1});
        }
        api.path("M 206 174 l 10 -14 l 22 -3", {stroke: c.c2, width: 4});
        api.path("M 197 177 a 9 6 0 1 0 18 0 a 9 6 0 1 0 -18 0", {fill: c.c2});
        api.arrow([246, 158], [282, 158], {color: c.c2, width: 2, halo: false, head: 8});
        api.label([384, 142], "myosin walks toward +", {color: c.c2, size: 12, anchor: "end"});
        api.circle([366, y0], 7, {fill: col, fillOpacity: 0.85});
        api.arrow([358, y0 + 2], [x1 + 18, y0 + 2], {color: col, width: 1.6, halo: false, head: 7});
        api.label([352, y0 + 22], "ATP-actin adds", {color: col, size: 12, anchor: "middle"});
      } else if (sel === "intermediate") {
        for (j = 0; j < 4; j++) {
          var pts = [];
          for (var x2 = x0; x2 <= x1 + 20; x2 += 4) pts.push([x2, y0 + 9 * Math.sin(2 * Math.PI * (x2 - x0) / 46 + j * Math.PI / 2)]);
          api.polyline(pts, {stroke: col, width: 3, opacity: 0.9});
        }
        api.line([x0 - 2, y0 - 26], [x0 - 26, y0 - 26], {color: c.ink, width: 2, arrow: true});
        api.line([x1 + 22, y0 - 26], [x1 + 46, y0 - 26], {color: c.ink, width: 2, arrow: true});
        api.label([(x0 + x1) / 2 + 10, y0 - 26], "stretches 2–3× before breaking", {color: c.ink, size: 12, anchor: "middle"});
        api.label([(x0 + x1) / 2 + 10, y0 + 26], "same at both ends: no + or −, no motor walks it", {color: c.muted, size: 12, anchor: "middle"});
      } else {
        for (var r = 0; r < 6; r++) {
          for (j = 0; j < 17; j++) {
            var xx = x0 + j * 16 + (r % 2) * 5, yy = y0 - 22 + r * 7.6;
            if (xx + 15 > x1 + 6) continue;
            api.rect(xx, yy, 7.4, 6.4, {fill: col, fillOpacity: 0.45, rx: 1.5});
            api.rect(xx + 7.6, yy, 7.4, 6.4, {fill: col, fillOpacity: 0.9, rx: 1.5});
          }
        }
        api.rect(x1 - 2, y0 - 23, 8, 46, {fill: c.c4, fillOpacity: 0.5, rx: 2});
        api.label([x1 + 12, y0 + 34], "GTP cap", {color: c.c4, size: 12, anchor: "middle"});
        api.circle([170, y0 - 34], 6, {fill: c.c2}); api.circle([180, y0 - 34], 6, {fill: c.c2});
        api.line([175, y0 - 28], [175, y0 - 24], {color: c.c2, width: 2});
        api.arrow([194, y0 - 36], [232, y0 - 36], {color: c.c2, width: 2, halo: false, head: 8});
        api.label([214, y0 - 50], "kinesin → +", {color: c.c2, size: 12, anchor: "middle"});
        api.circle([150, y0 + 34], 7, {fill: c.c5}); api.line([150, y0 + 27], [150, y0 + 24], {color: c.c5, width: 2});
        api.arrow([136, y0 + 36], [100, y0 + 36], {color: c.c5, width: 2, halo: false, head: 8});
        api.label([164, y0 + 38], "dynein → −", {color: c.c5, size: 12});
      }
      if (sel !== "intermediate") {
        api.label([x0 - 14, y0], "−", {color: c.ink, size: 18, weight: 700, anchor: "middle"});
        api.label([sel === "actin" ? x1 + 8 : x1 + 30, sel === "actin" ? y0 - 24 : y0], "+", {color: c.ink, size: 18, weight: 700, anchor: "middle"});
      }
      api.label([16, 262], F[sel].sub, {color: c.ink, size: 12});
      api.label([16, 282], F[sel].jobs, {color: c.muted, size: 12});
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
