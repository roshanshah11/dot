// The extracellular matrix above one cell, and what each part does under load. Collagen fibers (crimped at rest)
// carry tension; elastin coils stretch and recoil; proteoglycans (a core protein with negatively charged GAG chains)
// hold water as a gel that resists squeezing; fibronectin ties the matrix to integrins, which cross the membrane and
// grip actin. Pull or squeeze the slab, or take one part away, and see what fails. Sizes and strains are schematic.
(function () {
  var STATUS = {
    none: {
      rest: "Crimped <b>collagen</b> fibers, coiled <b>elastin</b> and a water-holding <b>proteoglycan</b> gel make the matrix; fibronectin ties it to integrins, which grip actin inside the cell.",
      stretch: "Pulled: elastin extends and the crimped collagen straightens until the stiff <b>collagen</b> takes the load and stops the stretch; on release, <b>elastin recoils</b>.",
      compress: "Squeezed: the proteoglycans' negative GAG chains hold water, and that swollen <b>gel pushes back</b>, so the matrix gives only a little (as in cartilage)."
    },
    collagen: {
      rest: "With no <b>collagen</b>, only elastin and the gel hold the matrix together: it has almost no tensile strength.",
      stretch: "<b>Tears</b>: with no collagen to bear the tension the matrix rips (weak collagen is why scurvy and Ehlers-Danlos syndrome make skin and vessels fragile).",
      compress: "Squeezed: the gel still pushes back, because resisting compression is the proteoglycans' job, not collagen's."
    },
    elastin: {
      rest: "With no <b>elastin</b> the matrix looks normal at rest, but nothing will pull it back after a stretch.",
      stretch: "Pulled: collagen still limits the stretch, but with no elastin there is <b>no recoil</b>, so the tissue stays long when let go (sagging skin, emphysema lungs).",
      compress: "Squeezed: the proteoglycan gel still pushes back; elastin matters for stretch and recoil, not for compression."
    },
    proteoglycans: {
      rest: "With no <b>proteoglycans</b> there is little bound water between the fibers, so nothing fills the matrix to resist squeezing.",
      stretch: "Pulled: collagen and elastin still handle tension; the missing gel only shows when the matrix is squeezed.",
      compress: "<b>Collapses</b>: with no water-holding gel to push back, the matrix flattens (losing proteoglycan from cartilage is part of osteoarthritis)."
    },
    fibronectin: {
      rest: "With no <b>fibronectin</b> these integrins have nothing to grab, so the cell loosens from the matrix; anchorage-dependent cells that lose their grip die (anoikis).",
      stretch: "Pulled: the matrix stretches, but with no fibronectin bridge the force never reaches the cell's actin, so the cell <b>cannot sense</b> it.",
      compress: "Squeezed: the gel resists, but the cell sits loose under the matrix with no fibronectin bridge to its integrins."
    }
  };

  Viz.register("extracellular-matrix-structure", {
    title: "The extracellular matrix",
    subject: "biology",
    shows: "Pull or squeeze the matrix, or remove one part: collagen bears tension, elastin recoils, the proteoglycan gel resists compression, and fibronectin and integrins tie it all to the cell's actin",
    params: {
      load: {kind: "enum", values: ["rest", "stretch", "compress"], names: {rest: "at rest", stretch: "pull", compress: "squeeze"}, default: "rest", label: "\\text{load}"},
      missing: {kind: "enum", values: ["none", "collagen", "elastin", "proteoglycans", "fibronectin"], default: "none", label: "\\text{remove}"}
    },
    formula: function (v) {
      var x = function (k, t) { return v.missing === k ? "\\cancel{\\text{" + t + "}}" : "\\text{" + t + "}"; };
      if (v.load === "stretch") return "\\text{tension}\\to" + x("collagen", "collagen") + (v.missing === "collagen" ? "\\ \\text{(tears)}" : "") +
        "\\newline\\text{recoil}\\to" + x("elastin", "elastin") + (v.missing === "elastin" ? "\\ \\text{(none)}" : "");
      if (v.load === "compress") return "\\text{compression}\\to" + x("proteoglycans", "proteoglycan gel") +
        "\\newline\\text{GAG}^{-}\\text{ chains hold Na}^{+}\\text{ and water}";
      return x("collagen", "collagen") + "\\to" + x("fibronectin", "fibronectin") + "\\to\\newline" + "\\text{integrin}\\to\\text{actin (cell)}";
    },
    status: function (v) { return STATUS[v.missing][v.load]; },
    examples: [
      {name: "intact, pulled", values: {load: "stretch", missing: "none"}},
      {name: "intact, squeezed", values: {load: "compress", missing: "none"}},
      {name: "no collagen, pulled: tears", values: {load: "stretch", missing: "collagen"}},
      {name: "no elastin, pulled: no recoil", values: {load: "stretch", missing: "elastin"}},
      {name: "no proteoglycans, squeezed: collapses", values: {load: "compress", missing: "proteoglycans"}},
      {name: "no fibronectin: cell loose", values: {load: "rest", missing: "fibronectin"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, L = v.load, M = v.missing, has = function (k) { return M !== k; };
      var torn = L === "stretch" && M === "collagen";
      var wf = L === "stretch" ? 1.1 : L === "compress" ? 1.03 : 1;
      var hf = L === "compress" ? (has("proteoglycans") ? 0.85 : 0.5) : L === "stretch" ? 0.95 : 1;
      var cx = 200, half = 160 * wf, x0 = cx - half, x1 = cx + half, bot = 176, H = 132 * hf, top = bot - H;
      var X = function (f) { return cx + (f - 0.5) * 2 * half; }, Yf = function (f) { return top + f * H; };
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      api.rect(x0, top, x1 - x0, H, {fill: c.ink, fillOpacity: 0.035, stroke: c.faint, width: 1, rx: 8});
      T(L === "compress" ? [14, 12] : [x0 + 6, top - 9], "extracellular matrix", c.muted, {weight: 500});
      // proteoglycans: bottlebrushes (core protein + GAG bristles) in a halo of bound water
      if (has("proteoglycans")) [0.1, 0.29, 0.71, 0.9].forEach(function (f, i) {
        var px = X(f), py = Yf(0.66), sq = L === "compress" ? 0.6 : 1;
        api.path("M " + (px - 22) + " " + py + " A 22 " + (13 * sq) + " 0 1 0 " + (px + 22) + " " + py + " A 22 " + (13 * sq) + " 0 1 0 " + (px - 22) + " " + py, {fill: c.c2, fillOpacity: 0.13});
        api.line([px - 15, py], [px + 15, py], {color: c.c2, width: 2});
        for (var k = -2; k <= 2; k++) api.line([px + k * 6, py - 7 * sq], [px + k * 6, py + 7 * sq], {color: c.c2, width: 1.3});
        
        if (L === "compress") api.arrow([px, py - 2], [px, py - 13 - 7 * sq], {color: c.c2, width: 1.8, head: 7, halo: false});
      });
      if (has("proteoglycans")) T([cx, Yf(0.66) + 1], "proteoglycans", c.c2, {anchor: "middle"});
      // collagen: thick fibers, crimped at rest, straight and taut when pulled
      var amp = L === "stretch" ? 0.4 : L === "compress" ? 5.5 : 4;
      var fiber = function (yf, a, b) {
        var pts = [], y0 = Yf(yf), lam = 34 * wf;
        for (var x = a; x <= b + 0.1; x += 3) pts.push([x, y0 + amp * Math.sin(2 * Math.PI * (x - x0) / lam)]);
        api.polyline(pts, {stroke: c.c3, width: 4.5});
      };
      if (has("collagen")) [0.18, 0.88].forEach(function (yf) { fiber(yf, x0 + 8, x1 - 8); });
      if (has("collagen")) T(L === "compress" ? [x0 + 6, top - 9] : [x0 + 10, Yf(0.18) - 12], "collagen", c.c3, {weight: 650});
      // elastin: cross-linked coils that extend under tension
      if (has("elastin")) [[0.1, 0.44], [0.56, 0.9]].forEach(function (s, i) {
        var a = X(s[0]), b = X(s[1]), y0 = Yf(0.42), ae = Math.min(L === "stretch" ? 2.5 : 6, H * 0.08), turns = 7, pts = [];
        for (var t = 0; t <= 1.0001; t += 1 / 140) pts.push([a + (b - a) * t, y0 + ae * Math.sin(2 * Math.PI * turns * t)]);
        api.polyline(pts, {stroke: c.c6, width: 2});
        api.circle([a, y0], 3, {fill: c.c6}); api.circle([b, y0], 3, {fill: c.c6});
        if (i === 0 && H > 80) T([(a + b) / 2, y0 - 14], "elastin", c.c6, {anchor: "middle", weight: 650});
      });
      // the tear
      if (torn) {
        var tx = X(0.8), j = [[tx - 4, top - 2], [tx + 6, top + H * 0.25], [tx - 5, top + H * 0.5], [tx + 7, top + H * 0.75], [tx - 3, bot + 2]];
        api.polygon(j.concat(j.slice().reverse().map(function (q) { return [q[0] + 12, q[1]]; })), {fill: c.card, fillOpacity: 1});
        api.polyline(j, {stroke: c.c5, width: 2}); api.polyline(j.map(function (q) { return [q[0] + 12, q[1]]; }), {stroke: c.c5, width: 2});
        T([tx + 22, top + 12], "tears", c.c5, {weight: 700});
      }
      // membrane, integrins, fibronectin bridges and actin
      var m0 = 204, m1 = 216;
      api.rect(14, m0, 372, m1 - m0, {fill: c.ink, fillOpacity: 0.06, rx: 3});
      api.line([14, m0], [386, m0], {color: c.muted, width: 1.3}); api.line([14, m1], [386, m1], {color: c.muted, width: 1.3});
      api.line([20, 244], [380, 244], {color: c.muted, width: 2.5, dash: "10 3"});
      T([380, 258], "actin", c.muted, {anchor: "end", weight: 500});
      T([20, 278], "cell (cytosol)", c.muted, {weight: 500});
      [110, 200, 290].forEach(function (ix, i) {
        api.line([ix - 3, m0 - 10], [ix - 3, m1 + 8], {color: c.c1, width: 3.5});
        api.line([ix + 3, m0 - 10], [ix + 3, m1 + 8], {color: c.c1, width: 3.5});
        api.line([ix, m1 + 8], [ix, 244], {color: c.c1, width: 1.5, dash: "2 2"});
        var fx = cx + (ix - cx) * wf, fy = Yf(0.88) + 3;
        if (has("fibronectin")) {
          api.line([fx, fy], [ix, m0 - 11], {color: c.c4, width: 3});
          api.circle([ix, m0 - 12], 3.2, {fill: c.c4});
        } else api.label([ix, m0 - 15], "?", {color: c.c5, size: 13, weight: 700, anchor: "middle"});
        if (i === 2) T([ix + 9, 228], "integrin", c.c1, {anchor: "start"});
        if (i === 0 && has("fibronectin")) T([ix - 8, (fy + m0) / 2 - 1], "fibronectin", c.c4, {anchor: "end"});
      });
      if (!has("fibronectin")) T([110 - 10, 228], "nothing to grab", c.c5, {anchor: "end"});
      // the load, as arrows on the slab
      if (L === "stretch") {
        api.arrow([cx - 40, 14], [cx - 110, 14], {color: c.ink, width: 2.2, halo: false}); api.arrow([cx + 40, 14], [cx + 110, 14], {color: c.ink, width: 2.2, halo: false});
        T([cx, 14], "pull", c.ink, {anchor: "middle"});
        if (!torn) T([x1 - 4, top - 9], has("elastin") ? "elastin recoils on release" : "no recoil on release", has("elastin") ? c.c6 : c.c5, {anchor: "end"});
      }
      if (L === "compress") [cx - 90, cx, cx + 90].forEach(function (x) { api.arrow([x, top - 30], [x, top - 4], {color: c.ink, width: 2.2, halo: false}); });
      if (L === "compress") T([cx + 100, top - 22], has("proteoglycans") ? "gel pushes back" : "collapses", has("proteoglycans") ? c.c2 : c.c5, {anchor: "start"});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
