// Why phospholipids self-assemble into bilayers and soaps into micelles: the packing parameter (Israelachvili).
// In water the hydrophobic effect buries the tails and leaves the polar heads in contact with water; the shape that
// does this best depends on the molecule's shape, P = v / (a0 lc): v = tail volume, lc = tail length, a0 = head-group
// area at the water interface. For saturated C16 tails (Tanford): v = 27.4 + 26.9 x 16 = 457.8 A^3 per tail and
// lc = 1.5 + 1.265 x 16 = 21.74 A, so P = n_tails x 21.06 A^2 / a0. Shape rules: P < 1/3 cone -> spherical micelles;
// 1/3-1/2 truncated cone -> rod-shaped micelles; 1/2-1 -> bilayers that close into vesicles (flat near 1); P > 1
// inverted cone -> inverted micelles / inverted hexagonal phase (small heads, like PE with unsaturated tails).
// The molecule is drawn as a truncated cone of top area a0, length lc and volume v: P = (1 + y + y^2) / 3 with y the
// bottom-to-top width ratio, so y = (sqrt(12 P - 3) - 1) / 2 (a cone, y = 0, when P <= 1/3).
(function () {
  var VL = 457.8 / 21.74;   // v / lc per tail, A^2
  function P(v) { return v.tails * VL / v.a0; }
  function phase(p) { return p < 1 / 3 ? 0 : p < 0.5 ? 1 : p <= 1 ? 2 : 3; }
  var NAMES = ["spherical micelles", "rod-shaped micelles", "bilayer vesicle", "inverted micelles"];
  var SAY = [
    "the molecule is a cone, so the tails crowd into the center of small <b>spherical micelles</b> with every head facing water",
    "the molecule is a blunt cone, so it packs into <b>rod-shaped micelles</b>, too fat at the tail end to curve into spheres",
    "the molecule is wide enough at the tail end to pack side by side into a <b>bilayer</b>, which closes into a vesicle so no tail edge touches water",
    "the head is narrower than the tails, so the layer curls the other way into <b>inverted micelles</b> around small water cores"
  ];
  Viz.register("phospholipid-bilayer-self-assembly", {
    title: "Why lipids self-assemble into bilayers",
    subject: "biology",
    shows: "Change the number of tails and the head size: the molecule's shape (packing parameter P = v / a0 lc) decides whether it hides its tails from water in micelles, a bilayer that closes into a vesicle, or inverted micelles",
    params: {
      tails: {kind: "integer", default: 2, min: 1, max: 2, label: "\\text{tails}"},
      a0: {kind: "number", default: 65, min: 30, max: 100, step: 1, label: "a_0\\ (\\text{\\AA}^2)"}
    },
    formula: function (v) {
      return "P=\\frac{n\\,v}{a_0\\,l_c}=\\frac{" + v.tails + "\\cdot 457.8}{" + Viz.n(v.a0, 0) + "\\cdot 21.74}=" + P(v).toFixed(2);
    },
    status: function (v) {
      var p = P(v);
      return "P = <b>" + p.toFixed(2) + "</b>: " + SAY[phase(p)] + ".";
    },
    examples: [
      {name: "detergent: one tail, big head", values: {tails: 1, a0: 70}},
      {name: "phosphatidylcholine: bilayer", values: {tails: 2, a0: 65}},
      {name: "big head, two tails: rods", values: {tails: 2, a0: 100}},
      {name: "small head, like PE: inverted", values: {tails: 2, a0: 40}},
      {name: "one tail, tiny head: bilayer", values: {tails: 1, a0: 30}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, p = P(v), ph = phase(p), head = c.c2, tail = c.c3, shape = c.c1;
      var hr = 0.75 * Math.sqrt(v.a0), TL = 18;
      // one small lipid: head at `at`, tails pointing along angle th
      var lipid = function (at, th, o) {
        var ux = Math.cos(th), uy = Math.sin(th), px = -uy, py = ux, h = o && o.hr || hr, len = o && o.len || TL;
        for (var t = 0; t < v.tails; t++) {
          var off = v.tails === 2 ? (t ? 2.3 : -2.3) : 0, x0 = at[0] + ux * h + px * off, y0 = at[1] + uy * h + py * off;
          api.line([x0, y0], [x0 + ux * len, y0 + uy * len], {color: tail, width: 1.6});
        }
        api.circle(at, h, {fill: head, fillOpacity: 0.85});
      };
      // the single molecule, with its effective shape
      api.label([66, 16], "one molecule", {color: c.muted, size: 12, anchor: "middle"});
      var mx = 66, top = 44, len = 84, W = 3.4 * Math.sqrt(v.a0), y = p <= 1 / 3 ? 0 : (Math.sqrt(12 * p - 3) - 1) / 2, B = W * y;
      api.polygon([[mx - W / 2, top], [mx + W / 2, top], [mx + B / 2, top + len], [mx - B / 2, top + len]], {fill: shape, fillOpacity: 0.1, stroke: shape, width: 1.5, dash: "4 3"});
      for (var t = 0; t < v.tails; t++) {
        var ox = v.tails === 2 ? (t ? 5 : -5) : 0, d = "M " + (mx + ox) + " " + (top + 14);
        for (var k = 1; k <= 8; k++) d += " L " + (mx + ox + (k % 2 ? 3 : -3)) + " " + (top + 14 + k * 8.5);
        api.path(d, {stroke: tail, width: 2.4});
      }
      // past P = 1 the head is narrower than the tail end: draw it smaller than the top so the dashed outline shows
      api.circle([mx, top + 2], ph === 3 ? 0.7 * W / 2 : W / 2 - 1, {fill: head, fillOpacity: 0.85});
      var slight = ph === 3 && p < 1.2, ly = top + len + 16;   // just past 1 the taper is only a few percent: say so
      if (slight) { api.label([mx, ly], "slightly", {color: shape, size: 12.5, weight: 650, anchor: "middle"}); ly += 15; }
      api.label([mx, ly], ["cone", "blunt cone", p >= 0.75 ? "near-cylinder" : "truncated cone", "inverted cone"][ph], {color: shape, size: 12.5, weight: 650, anchor: "middle"});
      api.label([mx, ly + 16], "polar head", {color: head, size: 12, anchor: "middle"});
      api.label([mx, ly + 31], v.tails === 2 ? "two nonpolar tails" : "one nonpolar tail", {color: tail, size: 12, anchor: "middle"});
      // what many of them build in water
      var X0 = 132, X1 = 394, Y0 = 26, Y1 = 214, cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2 + 4;
      api.rect(X0, Y0, X1 - X0, Y1 - Y0, {fill: c.c2, fillOpacity: ph === 3 ? 0.02 : 0.08, rx: 8});
      if (ph === 3) api.label([X0 + 8, Y1 - 10], "water in the cores", {color: c.muted, size: 12});
      else api.label([X0 + 8, Y0 + 12], "water", {color: c.muted, size: 12});
      var ring = function (ctr, R, count, inward, o) {
        for (var i = 0; i < count; i++) {
          var a = i / count * Math.PI * 2;
          lipid([ctr[0] + R * Math.cos(a), ctr[1] + R * Math.sin(a)], inward ? a + Math.PI : a, o);
        }
      };
      if (ph === 0) {
        [[cx - 70, cy - 30], [cx + 10, cy + 38], [cx + 76, cy - 34]].forEach(function (m) { ring(m, TL + hr, 12, true); });
      } else if (ph === 1) {
        var Lr = 150, R = TL + hr, n = 9;
        for (var i = 0; i <= n; i++) {
          var x = cx - Lr / 2 + i * Lr / n;
          lipid([x, cy - R], Math.PI / 2); lipid([x, cy + R], -Math.PI / 2);
        }
        for (var e = 0; e < 5; e++) {
          var a1 = -Math.PI / 2 + (e + 1) * Math.PI / 6;
          lipid([cx + Lr / 2 + R * Math.cos(a1), cy + R * Math.sin(a1)], a1 + Math.PI);
          lipid([cx - Lr / 2 - R * Math.cos(a1), cy + R * Math.sin(a1)], Math.PI - a1 + Math.PI);
        }
        api.label([cx, Y1 - 12], "a rod seen from the side, tails in its core", {color: c.muted, size: 12, anchor: "middle"});
      } else if (ph === 2) {
        var Ro = 84, Ri = Ro - 2 * TL - 2 * hr - 3;
        ring([cx - 34, cy], Ro, Math.round(2 * Math.PI * Ro / (2 * hr + 3)), true);
        ring([cx - 34, cy], Ri, Math.max(5, Math.round(2 * Math.PI * Ri / (2 * hr + 3))), false);
        api.label([cx - 34, cy], "water", {color: head, size: 12, anchor: "middle"});
        api.label([X1 - 8, Y1 - 28], "two layers,", {color: c.muted, size: 12, anchor: "end"});
        api.label([X1 - 8, Y1 - 12], "tails inside", {color: c.muted, size: 12, anchor: "end"});
      } else {
        var core = 9, r2 = core + hr, Rc = 2 * (r2 + hr + TL) - 6;
        [[cx - Rc / 2, cy - Rc * 0.29], [cx + Rc / 2, cy - Rc * 0.29], [cx, cy + Rc * 0.58]].forEach(function (m) {
          api.circle(m, core + 1, {fill: c.c2, fillOpacity: 0.45});
          ring(m, r2, Math.round(2 * Math.PI * r2 / (2 * hr + 1)), false);
        });
      }
      api.label([X1 - 8, Y0 + 12], NAMES[ph], {color: shape, size: 12.5, weight: 650, anchor: "end"});
      // the packing-parameter scale
      var S0 = 22, S1 = 380, sx = (S1 - S0) / 1.5, by = 252, cuts = [0, 1 / 3, 0.5, 1, 1.5], tags = ["micelle", "rod", "bilayer", "inverted"];
      for (var j = 0; j < 4; j++) {
        api.rect(S0 + cuts[j] * sx + 1, by - 8, (cuts[j + 1] - cuts[j]) * sx - 2, 16, {fill: j === ph ? shape : c.muted, fillOpacity: j === ph ? 0.45 : 0.15, rx: 3});
        api.label([S0 + (cuts[j] + cuts[j + 1]) / 2 * sx, by - 18], tags[j], {color: j === ph ? shape : c.muted, size: 12, weight: j === ph ? 650 : 500, anchor: "middle"});
      }
      [["0", 0], ["⅓", 1 / 3], ["½", 0.5], ["1", 1], ["1.5", 1.5]].forEach(function (q) { api.label([S0 + q[1] * sx, by + 20], q[0], {color: c.muted, size: 12, anchor: "middle"}); });
      var mxp = S0 + Math.min(1.5, p) * sx;
      api.line([mxp, by - 11], [mxp, by + 11], {color: c.ink, width: 3});
      api.label([mxp, by + 37], "P = " + p.toFixed(2), {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints svg text ink
    }
  });
})();
