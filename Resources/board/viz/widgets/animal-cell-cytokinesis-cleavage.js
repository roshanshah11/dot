// Cytokinesis in an animal cell: the spindle's midzone marks the equator, a contractile ring of actin and myosin II
// assembles under the membrane there, tightens into a cleavage furrow, closes on the midbody, and the bridge is cut.
// The furrow always bisects the spindle, so moving the spindle off-center moves the furrow and gives unequal
// daughters (an oocyte does this to make a tiny polar body). The cell is modeled as an ellipsoid of revolution cut
// perpendicular to its long axis at fraction p of its length: V1/V = (2 + 3t - t^3)/4 with t = 2p - 1.
// After abscission each daughter is drawn as a sphere of its own volume (radius proportional to the cube root).
(function () {
  function split(p) { var t = 2 * p - 1; return (2 + 3 * t - t * t * t) / 4; }
  var TEXT = ["In late anaphase the spindle pulls the chromosomes to the poles, and its midzone marks where the cell will divide",
              "A ring of actin filaments and myosin II assembles under the membrane at the equator, right over the spindle midzone",
              "Myosin II slides the actin filaments past each other, so the ring tightens like a drawstring and pulls the membrane into a cleavage furrow",
              "The furrow closes to a thin bridge around the midbody, the bundled remains of the spindle midzone, while the nuclei re-form",
              "Abscission: ESCRT-III proteins cut the bridge, leaving two separate daughter cells"];

  Viz.register("animal-cell-cytokinesis-cleavage", {
    title: "Cytokinesis: the cleavage furrow",
    subject: "biology",
    shows: "Step through cytokinesis in an animal cell: a contractile ring of actin and myosin forms over the spindle midzone and pinches the cell in two; move the spindle to make unequal daughters",
    params: {
      p: {kind: "number", default: 0.5, min: 0.25, max: 0.75, step: 0.05, label: "p"}
    },
    steps: ["anaphase: the spindle sets the plane", "contractile ring assembles", "furrow ingression", "midbody", "abscission"],
    stepMs: 1700,
    formula: function (v) {
      var t = 2 * v.p - 1;
      return "\\frac{V_1}{V}=\\frac{2+3t-t^3}{4},\\quad t=2p-1\\newline t=" + Viz.n(t, 2) + "\\ \\Rightarrow\\ \\frac{V_1}{V}=" + split(v.p).toFixed(2);
    },
    status: function (v) {
      var f = split(v.p), s = v.step || 1, a = Math.round(f * 100), b = 100 - a;
      return TEXT[s - 1] + "; with the spindle at p = " + v.p.toFixed(2) + " the daughters get <b>" + a + "%</b> and <b>" + b + "%</b> of the cytoplasm" +
        (Math.abs(v.p - 0.5) < 1e-9 ? "." : ", because the furrow follows the off-center spindle.");
    },
    examples: [
      {name: "symmetric division, ring forming", values: {p: 0.5, step: 2}},
      {name: "spindle far left", values: {p: 0.25, step: 5}},
      {name: "spindle far right", values: {p: 0.75, step: 3}},
      {name: "midbody", values: {p: 0.5, step: 4}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, cx = 200, cy = 110, A = 150, B = 76, f1 = split(v.p);
      var xs = cx + A * (2 * v.p - 1), Ls = Math.min(82, Math.min(xs - (cx - A), cx + A - xs) - 22), P1 = xs - Ls, P2 = xs + Ls;
      var chrom = function (x, y, dir) { api.path("M " + (x - 6 * dir) + " " + (y - 5) + " L " + x + " " + y + " L " + (x - 6 * dir) + " " + (y + 5), {stroke: c.c6, width: 3}); };
      var pole = function (x, dir) {
        for (var k = -2; k <= 2; k++) { var an = Math.PI * (dir < 0 ? 1 : 0) + k * 0.42; api.line([x, cy], [x + 17 * Math.cos(an), cy + 17 * Math.sin(an)], {color: c.c2, width: 1.2, opacity: 0.7}); }
        api.circle([x, cy], 4.5, {fill: c.c3});
      };
      var nucleus = function (x, r, solid) {
        api.circle([x, cy], r, {stroke: c.c6, width: 1.6, dash: solid ? null : "3 3", fill: c.c6, fillOpacity: solid ? 0.12 : 0.04});
        [[-0.3, -0.25], [0.25, -0.1], [-0.1, 0.3], [0.3, 0.32]].forEach(function (q) { api.circle([x + q[0] * r, cy + q[1] * r], 2.2, {fill: c.c6}); });
      };
      if (s < 5) {
        // the cell outline: an ellipse pinched by a Gaussian waist at the furrow
        var d = [0, 0.04, 0.55, 0.91][s - 1], top = [], bot = [];
        for (var i = 0; i <= 120; i++) {
          var x = cx - A + 2 * A * i / 120, u = (x - cx) / A, h = B * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - d * Math.exp(-Math.pow((x - xs) / 20, 2)));
          top.push([x, cy - h]); bot.unshift([x, cy + h]);
        }
        api.polygon(top.concat(bot), {fill: c.ink, fillOpacity: 0.05, stroke: c.ink, width: 2});
        var neck = B * Math.sqrt(1 - Math.pow((xs - cx) / A, 2)) * (1 - d);
        // spindle microtubules (interpolar ones overlap at the midzone), then the poles
        if (s < 4) [-16, -6, 6, 16].forEach(function (dy) {
          api.line([P1, cy], [xs + 12, cy + dy * (s === 3 ? 0.45 : 1)], {color: c.c2, width: 1.3, opacity: 0.55});
          api.line([P2, cy], [xs - 12, cy + dy * (s === 3 ? 0.45 : 1)], {color: c.c2, width: 1.3, opacity: 0.55});
        });
        pole(P1, -1); pole(P2, 1);
        // telophase nuclei re-form between each pole and the midzone, so the centrosome sits beside its nucleus
        var rn = Math.min(22, 0.3 * Ls), N1 = P1 + rn + 8, N2 = P2 - rn - 8, bund = Math.max(5, Math.min(26, Ls - 2 * rn - 12));
        if (s === 1) {
          [-18, -6, 6, 18].forEach(function (dy) {
            api.line([P1, cy], [xs - 0.45 * Ls, cy + dy], {color: c.c2, width: 1, opacity: 0.8});
            api.line([P2, cy], [xs + 0.45 * Ls, cy + dy], {color: c.c2, width: 1, opacity: 0.8});
            chrom(xs - 0.45 * Ls, cy + dy, -1); chrom(xs + 0.45 * Ls, cy + dy, 1);
          });
          // label the chromosome set and the pole in the larger half; the midzone line breaks around the label
          var side = v.p >= 0.5 ? -1 : 1, chx = xs + side * 0.45 * Ls;
          api.line([xs, cy - B - 6], [xs, cy + 33], {color: c.muted, width: 1.3, dash: "5 4"});
          api.line([xs, cy + 51], [xs, cy + B + 6], {color: c.muted, width: 1.3, dash: "5 4"});
          api.label([xs, 22], "spindle midzone = future furrow", {color: c.muted, size: 12, anchor: "middle"});
          api.label([chx, cy + 42], "chromosomes", {color: c.c6, size: 12, anchor: "middle"});
          api.label([side < 0 ? P1 : P2, cy - 40], "spindle pole", {color: c.c3, size: 12, anchor: "middle"});
          api.line([side < 0 ? P1 : P2, cy - 33], [side < 0 ? P1 : P2, cy - 8], {color: c.c3, width: 1, opacity: 0.7});
        } else if (s === 2) {
          [-12, -4, 4, 12].forEach(function (dy) { chrom(P1 + 13, cy + dy, -1); chrom(P2 - 13, cy + dy, 1); });
        } else {
          nucleus(N1, rn, s === 4); nucleus(N2, rn, s === 4);
        }
        // the ring label sits in the empty band above the cell, kept inside the viewBox
        var ringTxt = "contractile ring: actin + myosin II", rw = ringTxt.length * 12 * 0.52, ly = cy - B - 14;
        var lx = Math.max(12 + rw / 2, Math.min(388 - rw / 2, xs));
        if (s >= 2) {   // the contractile ring, seen edge-on as a thin loop at the furrow
          api.path("M " + xs + " " + (cy - neck) + " A 6 " + Math.max(1, neck) + " 0 0 1 " + xs + " " + (cy + neck), {stroke: c.c5, width: 2, dash: "2 3"});
          api.path("M " + xs + " " + (cy + neck) + " A 6 " + Math.max(1, neck) + " 0 0 1 " + xs + " " + (cy - neck), {stroke: c.c5, width: 3.5});
          if (s <= 3) api.label([lx, ly], ringTxt, {color: c.c5, size: 12, anchor: "middle"});
          if (s === 2) api.line([xs, ly + 8], [xs, cy - neck - 3], {color: c.c5, width: 1, opacity: 0.7});
        }
        if (s === 3) {
          api.arrow([xs, ly + 9], [xs, cy - neck - 6], {color: c.c5, width: 2.5, halo: false});
          api.arrow([xs, cy + neck + 30], [xs, cy + neck + 6], {color: c.c5, width: 2.5, halo: false});
          api.label([xs, cy + neck + 41], "furrow", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
        }
        if (s === 4) {
          api.line([xs - bund, cy], [xs + bund, cy], {color: c.c2, width: 3, opacity: 0.55});
          api.circle([xs, cy], 5, {fill: c.ink});
          api.label([xs, cy - B - 8], "midbody", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
          api.line([xs, cy - B - 1], [xs, cy - 7], {color: c.ink, width: 1, opacity: 0.6});
        }
      } else {
        // two daughters, each a sphere of its own volume
        var R = Math.cbrt(A * B * B), r1 = R * Math.cbrt(f1), r2 = R * Math.cbrt(1 - f1), gap = 12;
        var c1x = cx - (2 * r1 + gap + 2 * r2) / 2 + r1, c2x = c1x + r1 + gap + r2;
        [[c1x, r1, c.c1], [c2x, r2, c.c4]].forEach(function (q) {
          api.circle([q[0], cy], q[1], {fill: q[2], fillOpacity: 0.07, stroke: q[2], width: 2});
          nucleus(q[0], q[1] * 0.3, true);
          api.circle([q[0] + q[1] * 0.45, cy - q[1] * 0.4], 3.5, {fill: c.c3});
        });
        api.circle([c1x + r1 + gap / 2, cy], 3, {fill: c.ink, opacity: 0.6});
      }
      // how the cytoplasm is split
      var bx = 40, bw = 320, mid = bx + bw * f1;
      api.label([bx, 214], "daughter 1 · " + Math.round(f1 * 100) + "%", {color: c.c1, size: 12.5, weight: 650});
      api.label([bx + bw, 214], Math.round((1 - f1) * 100) + "% · daughter 2", {color: c.c4, size: 12.5, weight: 650, anchor: "end"});
      api.rect(bx, 224, mid - bx - 1, 16, {fill: c.c1, fillOpacity: 0.75, rx: 4});
      api.rect(mid + 1, 224, bx + bw - mid - 1, 16, {fill: c.c4, fillOpacity: 0.75, rx: 4});
      api.label([cx, 260], "share of the cytoplasm, set by where the spindle sits (p = " + v.p.toFixed(2) + ")", {color: c.muted, size: 12, anchor: "middle"});
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
