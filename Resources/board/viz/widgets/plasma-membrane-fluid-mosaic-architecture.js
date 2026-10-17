// The parts of a plasma membrane and how many of each: a fluid bilayer with proteins set in it like tiles in a mosaic.
// Cross-section: integral proteins span the bilayer (each spanning alpha-helix has about 20 mostly nonpolar residues,
// enough for the ~3 nm tail core), peripheral proteins bind one face by ionic and hydrogen bonds, sugar chains on
// glycoproteins and glycolipids face only the outside (the glycocalyx, so the two leaflets differ), cholesterol sits
// between phospholipids in both leaflets, and actin/spectrin filaments inside anchor some integral proteins.
// The mosaic in numbers: protein share of membrane mass m runs from under 25 % (myelin) through about 50 % (typical
// plasma membrane) to about 75 % (inner mitochondrial membrane) (Alberts, Molecular Biology of the Cell). Taking a
// 40 kDa protein and an 800 Da phospholipid, lipids per protein = (1 - m) / m x 50: about 50 at m = 0.5.
// Top view: a 38 x 9 patch of lipid-head sites, each protein covering 3 x 3 sites; P proteins leave 342 - 9P heads per
// leaflet, so P = 2 (342 - 9P) / ratio, P = 684 / (ratio + 18), rounded (a schematic footprint, not a measured area).
// The caption prints the ratio the rounded patch shows, 2 (342 - 9P) / P, within about 5% of the formula above 15%.
(function () {
  var SLOTS = (function () {   // the 36 aligned 3 x 3 blocks of the patch, in a fixed shuffled order
    var s = [], seed = 7;
    for (var r = 0; r < 3; r++) for (var q = 0; q < 12; q++) s.push([q, r]);
    for (var i = s.length - 1; i > 0; i--) { seed = (seed * 9301 + 49297) % 233280; var j = Math.floor(seed / 233280 * (i + 1)), t = s[i]; s[i] = s[j]; s[j] = t; }
    return s;
  })();
  function ratio(m) { return (1 - m) / m * 50; }
  function count(m) { return Math.round(684 / (ratio(m) + 18)); }
  var SAY = {
    integral: "<b>Integral proteins</b> cross the whole bilayer, each crossing an α-helix of about 20 mostly nonpolar amino acids, enough to span the 3 nm tail core",
    peripheral: "<b>Peripheral proteins</b> sit on one face, held by ionic and hydrogen bonds to lipid heads or integral proteins, so a salt wash strips them off without breaking the bilayer",
    glycocalyx: "<b>Sugar chains</b> on glycoproteins and glycolipids face only the outside, forming the glycocalyx that cells use to recognize each other, so the two leaflets differ",
    cholesterol: "<b>Cholesterol</b> slips between phospholipids in both leaflets with its rigid rings beside the tails, stiffening a warm membrane and keeping a cold one from freezing into a gel",
    cytoskeleton: "Inside, <b>actin and spectrin</b> filaments hold some integral proteins through linker proteins, so those drift far less than the lipids, which swap places with a neighbor about 10⁷ times a second"
  };
  function kind(m) { return m < 0.3 ? "close to myelin (under 25%)" : m <= 0.65 ? "like a typical plasma membrane (about half)" : "close to the inner mitochondrial membrane (about 75%)"; }
  function rtxt(m) { var r = ratio(m); return Viz.fmt(r, r < 20 ? 1 : 0); }
  Viz.register("plasma-membrane-fluid-mosaic-architecture", {
    title: "Fluid mosaic: the parts of a membrane",
    subject: "biology",
    shows: "Pick a part of the plasma membrane and set how much of it is protein: integral and peripheral proteins, outward-facing sugars, cholesterol and the cytoskeleton, with the mosaic of proteins among about 50 lipids each in a typical membrane",
    params: {
      part: {kind: "enum", values: ["integral", "peripheral", "glycocalyx", "cholesterol", "cytoskeleton"], default: "integral", label: "\\text{part}",
        names: {integral: "integral", peripheral: "peripheral", glycocalyx: "sugars", cholesterol: "cholesterol", cytoskeleton: "cytoskeleton"}},
      protein: {kind: "number", default: 50, min: 15, max: 80, step: 5, label: "\\text{protein \\%}"}
    },
    formula: function (v) {
      var m = v.protein / 100;
      return "\\frac{\\text{lipids}}{\\text{protein}}=\\frac{1-m}{m}\\cdot\\frac{40\\,000}{800}\\newline=\\frac{" + Viz.n(1 - m, 2) + "}{" + Viz.n(m, 2) + "}\\cdot 50=" + rtxt(m);
    },
    status: function (v) {
      var m = v.protein / 100;
      return SAY[v.part] + "; at " + v.protein + "% protein by mass there is about <b>1 protein per " + rtxt(m) + " lipids</b>, " + kind(m) + ".";
    },
    examples: [
      {name: "typical plasma membrane", values: {part: "integral", protein: 50}},
      {name: "myelin: mostly lipid", values: {part: "cholesterol", protein: 20}},
      {name: "inner mitochondrial membrane", values: {part: "integral", protein: 75}},
      {name: "the glycocalyx", values: {part: "glycocalyx", protein: 50}},
      {name: "peripheral proteins", values: {part: "peripheral", protein: 15}},
      {name: "anchored to the cytoskeleton", values: {part: "cytoskeleton", protein: 80}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, P = v.part, col = {integral: c.c2, peripheral: c.c6, glycocalyx: c.c4, cholesterol: c.c3, cytoskeleton: c.c5};
      var op = function (k) { return P === k ? 1 : 0.4; }, H1 = 60, H2 = 126;
      var G = function (k) { return api.group({opacity: op(k)}); };
      api.label([8, 12], "outside", {color: c.muted, size: 12});
      api.label([392, 178], "cytoplasm", {color: c.muted, size: 12, anchor: "end"});
      // phospholipids: heads on both faces, tails inward; gaps where proteins sit
      var gaps = [[78, 132], [222, 246]];
      for (var x = 12; x <= 390; x += 10) {
        if (gaps.some(function (gp) { return x > gp[0] && x < gp[1]; })) continue;
        [[H1, 1], [H2, -1]].forEach(function (hs) {
          [-2, 2].forEach(function (dx) { api.line([x + dx, hs[0] + hs[1] * 5], [x + dx, hs[0] + hs[1] * 30], {color: c.faint, width: 1.3}); });
          api.circle([x, hs[0]], 4.4, {fill: c.muted, fillOpacity: 0.75});
        });
      }
      // cholesterol: small rigid rings beside the tails, in both leaflets
      var gc = G("cholesterol");
      [[46, 1], [176, 1], [336, 1], [106 + 60, -1], [286, -1], [26, -1]].forEach(function (q) {
        var y = q[1] > 0 ? H1 + 8 : H2 - 22;
        api.rect(q[0] - 3, y, 6, 14, {fill: col.cholesterol, rx: 2, parent: gc});
      });
      if (P === "cholesterol") api.label([46, 40], "cholesterol", {color: col.cholesterol, size: 12.5, weight: 650, anchor: "middle"});
      // integral proteins: a multi-pass channel and a single-pass glycoprotein
      var gi = G("integral");
      [86, 100, 114].forEach(function (hx) { api.rect(hx - 6, H1 - 14, 12, H2 - H1 + 28, {fill: col.integral, fillOpacity: 0.75, rx: 6, parent: gi}); });
      api.rect(231, H1 - 6, 12, H2 - H1 + 12, {fill: col.integral, fillOpacity: 0.75, rx: 6, parent: gi});
      api.circle([237, H1 - 18], 13, {fill: col.integral, fillOpacity: 0.75, parent: gi});
      if (P === "integral") { api.label([100, 32], "integral proteins", {color: col.integral, size: 12.5, weight: 650, anchor: "middle"}); api.line([150, 32], [228, H1 - 22], {color: col.integral, width: 1, dash: "2 3"}); }
      // peripheral protein on the inner face, bound to the multi-pass protein
      var gp = G("peripheral");
      api.rect(124, H2 + 8, 40, 18, {fill: col.peripheral, fillOpacity: 0.8, rx: 9, parent: gp});
      api.rect(350, H2 + 6, 30, 16, {fill: col.peripheral, fillOpacity: 0.8, rx: 8, parent: gp});   // clear of the linker label
      if (P === "peripheral") api.label([124, 179], "peripheral (inner face)", {color: col.peripheral, size: 12.5, weight: 650});
      // sugars: a branched chain on the glycoprotein, a short one on a glycolipid, outside only
      var gs = G("glycocalyx"), tree = function (pts) { pts.forEach(function (q, i) { if (i) api.line(pts[q[2]], q, {color: col.glycocalyx, width: 1.5, parent: gs}); }); pts.forEach(function (q) { api.circle(q, 3.6, {fill: col.glycocalyx, parent: gs}); }); };
      tree([[237, 29, 0], [237, 20, 0], [229, 12, 1], [245, 12, 1]]);
      tree([[316, H1 - 8, 0], [316, H1 - 17, 0], [324, H1 - 25, 1], [308, H1 - 25, 1]]);
      api.circle([316, H1], 4.4, {fill: col.glycocalyx, fillOpacity: 0.6, parent: gs});
      if (P === "glycocalyx") api.label([316, 18], "sugars face out", {color: col.glycocalyx, size: 12.5, weight: 650, anchor: "start"});
      // cytoskeleton: an actin filament under the membrane, tied to the glycoprotein by a linker
      var gk = G("cytoskeleton");
      for (var b = 14; b <= 386; b += 9) api.circle([b, 160 + (Math.round(b / 9) % 2) * 3], 4, {fill: col.cytoskeleton, fillOpacity: 0.7, parent: gk});
      api.line([237, H2 + 6], [237, 156], {color: col.cytoskeleton, width: 2.5, parent: gk});
      if (P === "cytoskeleton") api.label([250, 146], "linker to actin", {color: col.cytoskeleton, size: 12.5, weight: 650});
      // top view of the outer leaflet: the mosaic, protein count set by the mass share
      var m = v.protein / 100, n = count(m), taken = {};
      SLOTS.slice(0, n).forEach(function (s) { for (var dq = 0; dq < 3; dq++) for (var dr = 0; dr < 3; dr++) taken[(s[0] * 3 + dq) + "," + (s[1] * 3 + dr)] = 1; });
      // the ratio this patch shows: its free heads (one leaflet) times two leaflets, per protein
      var each = Math.round(2 * (342 - 9 * n) / n), GY = 214;
      api.label([8, 200], "from outside: " + n + " protein" + (n === 1 ? "" : "s") + ", about " + each + " lipids each (both leaflets)", {color: c.muted, size: 12});
      for (var r = 0; r < 9; r++) for (var q = 0; q < 38; q++) if (!taken[q + "," + r]) api.circle([16 + q * 10, GY + r * 10], 3.4, {fill: c.muted, fillOpacity: 0.55});
      SLOTS.slice(0, n).forEach(function (s, i) {
        var x0 = 16 + s[0] * 30 - 4, y0 = GY + s[1] * 30 - 4;
        api.rect(x0, y0, 28, 28, {fill: col.integral, fillOpacity: P === "integral" ? 0.85 : 0.5, rx: 10});
        if (i % 2 === 0) api.circle([x0 + 14, y0 + 14], 4, {fill: col.glycocalyx, fillOpacity: P === "glycocalyx" ? 1 : 0.5});
      });
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints svg text ink
    }
  });
})();
