// Animal cell versus plant cell. Pick the cell type, then whether to light up what only that type has or what the
// two share. Plant cells add a cellulose wall, chloroplasts, a large central vacuole and plasmodesmata through the
// wall; animal cells have centrioles (in the centrosome) and lysosomes. Both have a nucleus, ER, Golgi, mitochondria,
// peroxisomes and a plasma membrane. One color per organelle; the group not chosen is drawn faint and unlabelled.
// Shapes and sizes are schematic (a real central vacuole can fill 80-90% of a plant cell).
(function () {
  function smooth(p) {   // closed Catmull-Rom curve through the points
    var n = p.length, d = "M " + p[0][0].toFixed(1) + " " + p[0][1].toFixed(1);
    for (var i = 0; i < n; i++) {
      var a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n], e = p[(i + 2) % n];
      d += " C " + (b[0] + (c[0] - a[0]) / 6).toFixed(1) + " " + (b[1] + (c[1] - a[1]) / 6).toFixed(1) + " " + (c[0] - (e[0] - b[0]) / 6).toFixed(1) + " " +
        (c[1] - (e[1] - b[1]) / 6).toFixed(1) + " " + c[0].toFixed(1) + " " + c[1].toFixed(1);
    }
    return d + " Z";
  }
  var ell = function (cx, cy, a, b) { return "M " + (cx - a) + " " + cy + " A " + a + " " + b + " 0 1 0 " + (cx + a) + " " + cy + " A " + a + " " + b + " 0 1 0 " + (cx - a) + " " + cy + " Z"; };
  var TEX = {
    "animal|differences": "\\text{animal only}=\\{\\text{centrioles, lysosomes}\\}\\newline\\text{no wall, no chloroplasts}",
    "plant|differences": "\\text{plant only}=\\{\\text{cell wall, chloroplasts,}\\newline\\text{central vacuole, plasmodesmata}\\}",
    "shared": "\\text{both}=\\{\\text{nucleus, ER, Golgi, mitochondria,}\\newline\\text{peroxisomes, plasma membrane}\\}"
  };
  Viz.register("cell-organelles", {
    title: "Animal and plant cell organelles",
    subject: "biology",
    shows: "Switch between an animal and a plant cell and light up what only that type has (wall, chloroplasts, central vacuole versus centrioles and lysosomes) or what both share",
    params: {
      cell_type: {kind: "enum", values: ["animal", "plant"], default: "animal", label: "\\text{cell}"},
      show: {kind: "enum", values: ["differences", "shared"], default: "differences", label: "\\text{light up}", names: {differences: "only this type", shared: "shared parts"}}
    },
    formula: function (v) { return v.show === "shared" ? TEX.shared : TEX[v.cell_type + "|differences"]; },
    status: function (v) {
      if (v.show === "shared") return "Both are eukaryotic cells: each has a <b>nucleus</b>, ER and Golgi, <b>mitochondria</b> (plants respire too, day and night), peroxisomes and a plasma membrane.";
      if (v.cell_type === "plant") return "A plant cell adds a rigid <b>cellulose wall</b> with plasmodesmata, <b>chloroplasts</b> for photosynthesis and a <b>central vacuole</b> whose water pressure keeps the cell turgid; it has no centrioles.";
      return "An animal cell has no wall, so it can change shape; it has <b>centrioles</b> in its centrosome and <b>lysosomes</b> to digest, and no chloroplasts or large central vacuole.";
    },
    examples: [
      {name: "animal: only-animal parts", values: {cell_type: "animal", show: "differences"}},
      {name: "plant: only-plant parts", values: {cell_type: "plant", show: "differences"}},
      {name: "plant: shared parts", values: {cell_type: "plant", show: "shared"}},
      {name: "animal: shared parts", values: {cell_type: "animal", show: "shared"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, plant = v.cell_type === "plant", want = v.show === "shared" ? "shared" : v.cell_type, labels = [];
      var on = function (grp) { return grp === want; };
      var G = function (grp, rot) { return api.group({opacity: on(grp) ? 1 : 0.28, transform: rot || null}); };
      var tag = function (grp, name, color, at) { if (on(grp)) labels.push({name: name, color: color, at: at}); };
      var mito = function (x, y, ang, named) {
        var g = G("shared", "rotate(" + ang + " " + x + " " + y + ")");
        api.path(ell(x, y, 15, 7.5), {stroke: c.c5, width: 1.6, fill: c.c5, fillOpacity: 0.25, parent: g});
        api.path("M " + (x - 10) + " " + y + " l 3 -4 l 3 7 l 3 -7 l 3 7 l 3 -7 l 3 4", {stroke: c.c5, width: 1.2, parent: g});
        if (named) tag("shared", "mitochondrion", c.c5, [x, y]);
      };
      var golgi = function (x, y) {
        var g = G("shared");
        for (var k = 0; k < 4; k++) api.path("M " + (x - 17 + k) + " " + (y + k * 5.5) + " Q " + x + " " + (y + k * 5.5 - 9) + " " + (x + 17 - k) + " " + (y + k * 5.5), {stroke: c.c1, width: 2.6, parent: g});
        api.circle([x + 21, y + 4], 2.6, {fill: c.c1, parent: g}); api.circle([x + 19, y + 17], 2.2, {fill: c.c1, parent: g});
        tag("shared", "Golgi", c.c1, [x + 10, y - 2]);
      };
      var er = function (x, y, r0, a0, a1) {   // rough ER: curved sheets beside the nucleus, studded with ribosomes
        var g = G("shared");
        [0, 7, 14].forEach(function (dr) {
          var r = r0 + dr, pts = [];
          for (var a = a0; a <= a1 + 1e-9; a += 6) { var t = a * Math.PI / 180; pts.push([x + r * Math.cos(t), y + r * Math.sin(t)]); }
          api.polyline(pts, {stroke: c.c1, width: 1.6, parent: g});
          pts.forEach(function (q, i) { if (i % 2) api.circle(q, 1.6, {fill: c.c1, parent: g}); });
        });
        var tm = (a0 + a1) / 2 * Math.PI / 180;
        tag("shared", "rough ER", c.c1, [x + (r0 + 14) * Math.cos(tm), y + (r0 + 14) * Math.sin(tm)]);
      };
      var nucleus = function (x, y, r) {
        var g = G("shared");
        api.circle([x, y], r, {fill: c.c6, fillOpacity: 0.16, stroke: c.c6, width: 1.6, parent: g});
        api.circle([x, y], r - 3, {stroke: c.c6, width: 0.9, parent: g});
        api.circle([x - r * 0.2, y - r * 0.15], r * 0.3, {fill: c.c6, fillOpacity: 0.6, parent: g});
        tag("shared", "nucleus", c.c6, [x + r * 0.5, y + r * 0.5]);
      };
      var perox = function (x, y) { var g = G("shared"); api.circle([x, y], 5.5, {fill: c.muted, fillOpacity: 0.25, stroke: c.muted, width: 1.2, parent: g}); api.rect(x - 2, y - 2, 4, 4, {fill: c.muted, rx: 0.5, parent: g}); tag("shared", "peroxisome", c.muted, [x, y]); };
      if (!plant) {
        var pts = [];
        for (var k = 0; k < 12; k++) { var t = k * Math.PI / 6, rr = 1 + 0.06 * Math.sin(3 * t) + 0.04 * Math.cos(5 * t); pts.push([130 + 110 * rr * Math.cos(t), 152 + 106 * rr * Math.sin(t)]); }
        var gm = G("shared"); api.path(smooth(pts), {stroke: c.ink, width: 2, fill: c.ink, fillOpacity: 0.035, parent: gm});
        tag("shared", "plasma membrane", c.ink, pts[0]);
        nucleus(112, 152, 36); er(112, 152, 46, -75, 15); golgi(190, 112); perox(150, 64);
        mito(58, 96, 30); mito(70, 214, -20); mito(196, 204, 60, true);
        var gl = G("animal");
        [[164, 236], [40, 160], [214, 160]].forEach(function (q) { api.circle(q, 7, {fill: c.c2, fillOpacity: 0.45, stroke: c.c2, width: 1.4, parent: gl}); api.circle([q[0] - 2, q[1] + 1], 1.4, {fill: c.c2, parent: gl}); });
        tag("animal", "lysosome", c.c2, [214, 160]);
        var gc = G("animal");
        api.rect(160, 184, 12, 5, {fill: c.ink, rx: 1.5, parent: gc}); api.rect(176, 180, 5, 12, {fill: c.ink, rx: 1.5, parent: gc});
        api.circle([171, 187], 15, {stroke: c.ink, width: 1, dash: "2 3", parent: gc});
        tag("animal", "centrioles", c.ink, [180, 196]);
        if (want === "animal") labels.push({name: "no cell wall,", color: c.muted, note: true}, {name: "no chloroplasts,", color: c.muted, note: true}, {name: "no big vacuole", color: c.muted, note: true});
      } else {
        var gw = G("plant");
        api.rect(16, 28, 232, 246, {stroke: c.c3, width: 8, rx: 8, fill: c.c3, fillOpacity: 0.04, parent: gw});
        [[16, 104], [16, 196], [248, 120], [248, 214]].forEach(function (q) { api.line([q[0] - 5, q[1]], [q[0] + 5, q[1]], {color: c.card, width: 4, parent: gw}); api.line([q[0] - 6, q[1]], [q[0] + 6, q[1]], {color: c.ink, width: 1.2, parent: gw}); });
        tag("plant", "cellulose wall", c.c3, [250, 60]);
        tag("plant", "plasmodesmata", c.ink, [250, 214]);
        var gm2 = G("shared"); api.rect(25, 37, 214, 228, {stroke: c.ink, width: 1.4, rx: 5, parent: gm2});
        tag("shared", "plasma membrane", c.ink, [239, 250]);
        var gv = G("plant");
        api.rect(58, 82, 136, 132, {fill: c.c2, fillOpacity: 0.18, stroke: c.c2, width: 1.8, rx: 28, parent: gv});
        tag("plant", "central vacuole", c.c2, [190, 104]);
        nucleus(208, 70, 22); er(208, 70, 30, 100, 190); golgi(176, 238); perox(96, 240);
        mito(102, 56, 10); mito(220, 192, -30, true);
        [[46, 60, 0], [40, 150, 90], [48, 238, 0], [134, 244, 0], [222, 150, 90], [150, 56, 0]].forEach(function (q) {
          var g = G("plant", "rotate(" + q[2] + " " + q[0] + " " + q[1] + ")");
          api.path(ell(q[0], q[1], 15, 8), {fill: c.c4, fillOpacity: 0.3, stroke: c.c4, width: 1.5, parent: g});
          [-7, 0, 7].forEach(function (dx) { [-2.5, 0, 2.5].forEach(function (dy) { api.line([q[0] + dx - 2.5, q[1] + dy], [q[0] + dx + 2.5, q[1] + dy], {color: c.c4, width: 1.2, parent: g}); }); });
        });
        tag("plant", "chloroplast", c.c4, [222, 150]);
        if (want === "plant") labels.push({name: "no centrioles", color: c.muted, note: true});
      }
      // labels in a column on the right, sorted top to bottom, each with a leader to its organelle
      var real = labels.filter(function (l) { return !l.note; }).sort(function (a, b) { return a.at[1] - b.at[1]; });
      var notes = labels.filter(function (l) { return l.note; });
      var gap = Math.min(36, 220 / Math.max(1, real.length - 1)), tall = gap * (real.length - 1) + (notes.length ? 26 + 15 * (notes.length - 1) : 0), y0 = 150 - tall / 2;
      real.forEach(function (l, i) {
        var y = y0 + i * gap;
        api.line([l.at[0], l.at[1]], [262, y], {color: l.color, width: 1, opacity: 0.7});
        api.circle(l.at, 2.5, {fill: l.color});
        api.label([266, y], l.name, {color: l.color, size: 12, weight: 650});
      });
      notes.forEach(function (l, i) { api.label([266, y0 + gap * (real.length - 1) + 26 + 15 * i], l.name, {color: l.color, size: 12}); });
      api.label([132, 14], plant ? "plant cell" : "animal cell", {color: c.ink, size: 13, weight: 700, anchor: "middle"});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
