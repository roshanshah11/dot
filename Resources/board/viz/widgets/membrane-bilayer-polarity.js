// Why a bilayer has a polar outside and a nonpolar inside, and what that does to an ion. Phospholipids are
// amphipathic: polar heads (phosphate, choline) face the water on both sides and the nonpolar fatty-acid tails hide in
// the middle, a core about 3 nm thick. The local dielectric constant falls from about 80 in water to about 2 in the
// hydrocarbon core; it is drawn as a smooth switch centred on the head groups (an implicit-membrane model, not a
// measured profile): eps(z) = 2 + 78 / (1 + exp(-(|z| - 2.0) / 0.25)), z in nm from the bilayer centre.
// The Born energy of moving an ion of charge q and radius a from water to depth z:
//   dG = (q^2 e^2 N_A / (8 pi eps0 a)) (1/eps(z) - 1/80) = 347 q^2 (1/eps - 1/80) kJ/mol for a = 0.2 nm,
// about 170 kJ/mol for a monovalent ion in the core (roughly 65 RT at 37 C), which is why ions do not cross bare lipid.
(function () {
  var K = 347, Y0 = 146, PX = 34;   // kJ/mol for q = 1, a = 0.2 nm; px per nm, centre line y
  function eps(z) {   // rounded the way it is shown, so the arithmetic in the formula is exact
    var e = 2 + 78 / (1 + Math.exp(-(Math.abs(z) - 2.0) / 0.25));
    return e < 10 ? Math.round(e * 100) / 100 : Math.round(e * 10) / 10;
  }
  function dG(z, q) { return K * q * q * (1 / eps(z) - 1 / 80); }
  function Y(z) { return Y0 - z * PX; }
  function region(z) { var a = Math.abs(z); return a > 2.6 ? "water" : a > 1.5 ? "heads" : "core"; }
  Viz.register("membrane-bilayer-polarity", {
    title: "Bilayer polarity: polar faces, nonpolar core",
    subject: "biology",
    shows: "Move an ion through the bilayer: polar heads face the water on both sides, the tails make a nonpolar core, and the energy to put a charge there climbs to about 170 kJ/mol (Born model)",
    params: {
      z: {kind: "number", default: 0, min: -3.5, max: 3.5, step: 0.1, label: "z\\ (\\text{nm})"},
      q: {kind: "integer", default: 1, min: 1, max: 2, label: "q"}
    },
    formula: function (v) {
      var e = eps(v.z);
      return "\\Delta G=347\\,q^2\\Big(\\tfrac{1}{\\varepsilon}-\\tfrac{1}{80}\\Big)\\newline=347\\cdot" + v.q + "^2\\Big(\\tfrac{1}{" + Viz.n(e, e < 10 ? 2 : 1) + "}-\\tfrac{1}{80}\\Big)=" + Viz.n(dG(v.z, v.q), 0) + "\\ \\tfrac{\\text{kJ}}{\\text{mol}}";
    },
    status: function (v) {
      var r = region(v.z), g = Viz.fmt(dG(v.z, v.q), 0), side = v.z > 0 ? "outside the cell" : "of the cytosol";
      if (r === "water") return "In the water " + side + " (ε ≈ " + Viz.fmt(eps(v.z), 0) + ") polar water molecules surround the ion, so being here costs " + (dG(v.z, v.q) < 1 ? "essentially <b>nothing</b>." : "only <b>" + g + " kJ/mol</b>.");
      if (r === "heads") return "Among the polar head groups (ε ≈ " + Viz.fmt(eps(v.z), 0) + ") the ion keeps some water around it: <b>" + g + " kJ/mol</b>, and the cost climbs steeply toward the core.";
      return "In the nonpolar tail core (ε ≈ " + Viz.fmt(eps(v.z), 1) + ") nothing steadies the charge: <b>" + g + " kJ/mol</b> (about " + Viz.fmt(dG(v.z, v.q) / 2.58, 0) + " RT), so ions essentially never cross bare lipid and need channels or carriers.";
    },
    examples: [
      {name: "in the outside water", values: {z: 3.5, q: 1}},
      {name: "at the head groups", values: {z: 2.0, q: 1}},
      {name: "in the core", values: {z: 0, q: 1}},
      {name: "divalent ion in the core", values: {z: 0, q: 2}},
      {name: "cytosol side", values: {z: -3.5, q: 2}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, L = 12, R = 160;
      // water on both faces
      api.rect(L, Y(3.5), R - L, Y(2.4) - Y(3.5), {fill: c.c2, fillOpacity: 0.16, rx: 0});
      api.rect(L, Y(-2.4), R - L, Y(-3.5) - Y(-2.4), {fill: c.c2, fillOpacity: 0.16, rx: 0});
      [3.0, -3.0].forEach(function (zw) { for (var w = 0; w < 4; w++) api.path("M " + (24 + w * 36) + " " + Y(zw) + " q 4 -4 8 0 t 8 0", {stroke: c.c2, width: 1.4, opacity: 0.8}); });
      // phospholipids: polar head on the water side, two nonpolar tails pointing in
      for (var i = 0; i < 5; i++) {
        var x = 28 + i * 28;
        [1, -1].forEach(function (sgn) {
          [-4.5, 4.5].forEach(function (dx) {
            var d = "M " + (x + dx) + " " + Y(sgn * 1.8);
            for (var k = 1; k <= 6; k++) d += " L " + (x + dx + (k % 2 ? 2.6 : -2.6)) + " " + Y(sgn * (1.8 - k * 0.27));
            api.path(d, {stroke: c.c3, width: 1.8});
          });
          api.circle([x, Y(sgn * 2.05)], 8.5, {fill: c.c2, fillOpacity: 0.55, stroke: c.c2, width: 1.2});
        });
      }
      // names of the layers, beside the bilayer
      var nm = function (z, t, col) { api.label([168, Y(z)], t, {color: col, size: 12}); };
      nm(3.05, "water: outside", c.c2); nm(2.05, "polar heads", c.c2); nm(0.55, "nonpolar", c.c3); nm(0.12, "tails", c.c3);
      nm(-0.75, "ε ≈ 2", c.c3); nm(-2.05, "polar heads", c.c2); nm(-3.05, "water: cytosol", c.c2);
      // the energy profile on the right, same depth scale
      var P0 = 270, P1 = 392, GMAX = 700, gx = function (g) { return P0 + (P1 - P0) * g / GMAX; };
      api.line([P0, Y(3.5)], [P0, Y(-3.5)], {color: c.axis, width: 1.2});
      api.line([P0, Y(-3.5) + 4], [P1, Y(-3.5) + 4], {color: c.axis, width: 1.2});
      [0, 350, 700].forEach(function (g) { api.label([gx(g), Y(-3.5) + 16], String(g), {color: c.muted, size: 12, anchor: g === 0 ? "start" : g === 700 ? "end" : "middle"}); });
      api.label([(P0 + P1) / 2, 293], "ΔG for the ion, kJ/mol", {color: c.muted, size: 12, anchor: "middle"});
      if (v.q === 2) {
        var one = []; for (var z1 = -3.5; z1 <= 3.5001; z1 += 0.05) one.push([gx(dG(z1, 1)), Y(z1)]);
        api.polyline(one, {stroke: c.c5, width: 1.2, dash: "3 3", opacity: 0.6});
        api.label([gx(dG(0, 1)) + 4, Y(0.9)], "q = 1", {color: c.c5, size: 12, opacity: 0.8});
      }
      var pts = []; for (var z = -3.5; z <= 3.5001; z += 0.05) pts.push([gx(dG(z, v.q)), Y(z)]);
      api.polyline(pts, {stroke: c.c5, width: 2.4});
      // the probe: the ion at depth z in the bilayer, and its point on the curve
      var y = Y(v.z), g = dG(v.z, v.q);
      api.line([L, y], [R, y], {color: c.muted, width: 1, dash: "2 4"});
      api.line([P0, y], [P1, y], {color: c.muted, width: 1, dash: "2 4"});
      api.circle([84, y], 9, {fill: c.c5, stroke: c.card, width: 2});
      api.label([84, y + 0.5], v.q === 1 ? "+" : "2+", {color: c.card, size: 12, weight: 700, anchor: "middle"});
      api.point([gx(g), y], {color: c.c5, r: 4.5});
      api.label([(P0 + P1) / 2, 13], "here: " + Viz.fmt(g, 0) + " kJ/mol", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
