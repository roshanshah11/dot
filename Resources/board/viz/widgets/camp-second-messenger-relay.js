// cAMP as a second messenger, drawn as a tank that fills and drains. Hormone binds a Gs-coupled receptor
// (occupancy theta = [H] / ([H] + Kd), Kd = 10 nM here); active Gas-GTP switches on adenylyl cyclase, which turns ATP
// into cAMP at v = Vmax (b + (1 - b) g), g = theta (Vmax = 2 uM/s, basal fraction b = 0.05); phosphodiesterase (PDE)
// clears cAMP to AMP at k_PDE [cAMP]. The level settles where inflow equals outflow: [cAMP]* = v / k_PDE.
// cAMP frees PKA's catalytic subunits (2 per R2C2 holoenzyme, 4 cAMP each); the active fraction uses an apparent
// Hill curve, c^1.5 / (c^1.5 + 1 uM^1.5), a schematic fit, not a measurement. Cholera toxin ADP-ribosylates Gas so it
// cannot hydrolyse its GTP: g = 1 with or without hormone. A PDE inhibitor (IBMX, theophylline) lowers k_PDE.
(function () {
  var KD = 10, VMAX = 2, B = 0.05, KA = 1, H = 1.5;
  function model(v) {
    var th = v.L / (v.L + KD), g = v.toxin ? 1 : th, rate = VMAX * (B + (1 - B) * g), c = rate / v.k;
    var a = Math.pow(c, H) / (Math.pow(c, H) + Math.pow(KA, H));
    return {th: th, g: g, rate: rate, c: c, a: a};
  }
  var f2 = function (x) { return x >= 10 ? Viz.n(x, 1) : Viz.n(x, 2); };
  Viz.register("camp-second-messenger-relay", {
    title: "cAMP: a second messenger in balance",
    subject: "biology",
    shows: "Raise the hormone, slow the phosphodiesterase or add cholera toxin: adenylyl cyclase fills the cAMP pool, PDE drains it, and the level where the two match decides how much PKA turns on",
    params: {
      L: {kind: "number", default: 10, min: 0, max: 100, step: 1, label: "[H]\\ (\\text{nM})"},
      k: {kind: "number", default: 1, min: 0.1, max: 4, step: 0.1, label: "k_{\\text{PDE}}"},   // per second
      toxin: {kind: "boolean", default: false, label: "\\text{toxin}", on: "cholera toxin", off: "none"}
    },
    formula: function (v) {
      var m = model(v);
      return (v.toxin ? "v=V_{\\max}\\ (G\\alpha_s\\text{ locked on})=" : "v=V_{\\max}(b+(1-b)\\,\\theta)=") + f2(m.rate) + "\\ \\mu\\text{M/s}" +
        "\\newline[\\text{cAMP}]^{*}=\\frac{v}{k_{\\text{PDE}}}=\\frac{" + f2(m.rate) + "}{" + Viz.n(v.k, 1) + "\\ \\text{s}^{-1}}=" + f2(m.c) + "\\ \\mu\\text{M}";
    },
    status: function (v) {
      var m = model(v), pk = Math.round(m.a * 100);
      if (v.toxin) return "Cholera toxin keeps Gαs bound to GTP, so cyclase runs flat out whatever the hormone does: cAMP climbs to <b>" + Viz.fmt(m.c, 2) + " µM</b> and <b>" + pk + "%</b> of PKA stays on.";
      if (v.L === 0) return "No hormone: only basal cyclase activity, so cAMP settles at <b>" + Viz.fmt(m.c, 2) + " µM</b>, where PDE clears it as fast as it trickles in, and <b>" + pk + "%</b> of PKA is active.";
      return "Hormone fills <b>" + Math.round(m.th * 100) + "%</b> of the receptors; cAMP rises until PDE removes it as fast as cyclase makes it, at <b>" + Viz.fmt(m.c, 2) + " µM</b>, which switches on <b>" + pk + "%</b> of PKA.";
    },
    examples: [
      {name: "no hormone", values: {L: 0, k: 1, toxin: false}},
      {name: "saturating hormone", values: {L: 100, k: 1}},
      {name: "PDE inhibitor (slow PDE)", values: {L: 10, k: 0.1}},
      {name: "fast PDE", values: {L: 10, k: 4}},
      {name: "cholera toxin, no hormone", values: {L: 0, toxin: true}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = model(v), m0 = 54, m1 = 72;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // outside, membrane, cytosol
      api.rect(6, m0, 388, m1 - m0, {fill: c.muted, fillOpacity: 0.2, rx: 3});
      L([392, 12], "outside", c.muted, {anchor: "end", weight: 500});
      L([392, 86], "cytosol", c.muted, {anchor: "end", weight: 500});
      // hormone molecules: about one drawn per 10 nM
      var nH = Math.round(v.L / 10), RX = 34;
      var spots = [[96, 20], [150, 34], [206, 18], [122, 42], [252, 30], [180, 14], [72, 36], [230, 42], [276, 16], [300, 38]];
      for (var i = 0; i < nH; i++) api.polygon([[spots[i][0] - 6, spots[i][1] - 5], [spots[i][0] + 6, spots[i][1] - 5], [spots[i][0], spots[i][1] + 5]], {fill: c.c5, fillOpacity: 0.9});
      if (nH) L([spots[0][0] + 10, spots[0][1] - 10], "hormone", c.c5);
      // receptor, with the bound fraction
      for (var k = 0; k < 7; k++) api.rect(RX - 14 + k * 4, m0 - 5, 3, m1 - m0 + 10, {fill: c.c2, rx: 1});
      if (v.L > 0) api.polygon([[RX - 6, m0 - 18], [RX + 6, m0 - 18], [RX, m0 - 8]], {fill: c.c5, fillOpacity: 0.3 + 0.7 * m.th});
      L([RX, m1 + 16], "receptor", c.c2, {anchor: "middle"});
      L([RX, m1 + 31], Math.round(m.th * 100) + "% bound", c.c2, {anchor: "middle", weight: 500});
      // G alpha s, on in proportion to g
      var GX = 100, gOn = m.g > 0.02;
      api.circle([GX, m1 + 12], 11, {fill: c.c4, fillOpacity: 0.12 + 0.6 * m.g, stroke: c.c4, width: 1.6});
      L([GX, m1 + 31], v.toxin ? "Gαs locked" : gOn ? "Gαs·GTP" : "Gαs·GDP", v.toxin ? c.c5 : c.c4, {anchor: "middle"});
      if (gOn) api.arrow([RX + 13, m1 + 10], [GX - 13, m1 + 11], {color: c.c4, width: 1.8, halo: false, head: 8});
      // adenylyl cyclase in the membrane, inflow arrow width set by its rate
      var AX = 162, wIn = 1.5 + 2.4 * m.rate;
      api.rect(AX - 20, m0 - 4, 40, m1 - m0 + 8, {fill: c.c1, fillOpacity: 0.15 + 0.35 * (m.rate / VMAX), stroke: c.c1, width: 1.5, rx: 6});
      L([AX, m0 - 12], "adenylyl cyclase", c.c1, {anchor: "middle"});
      api.arrow([GX + 12, m1 + 6], [AX - 22, m1 - 2], {color: c.c4, width: 1.6, halo: false, head: 7, opacity: gOn ? 1 : 0.25});
      api.line([AX, m1 + 4], [AX, 110], {color: c.c1, width: wIn});
      api.path("M " + (AX - 5 - wIn) + " 104 L " + AX + " 114 L " + (AX + 5 + wIn) + " 104 Z", {fill: c.c1});
      L([AX + 12, 92], "ATP → cAMP", c.c1, {weight: 500});
      L([AX + 12, 106], api.fmt(m.rate, 2) + " µM/s", c.c1);
      // the cAMP tank on a log scale, 0.05 to 30 uM
      var T0 = 130, T1 = 194, ty0 = 270, ty1 = 122, lo = Math.log10(0.05), hi = Math.log10(30);
      var ly = function (u) { return ty0 - (Math.log10(Math.max(0.05, Math.min(30, u))) - lo) / (hi - lo) * (ty0 - ty1); };
      api.rect(T0, ly(m.c), T1 - T0, ty0 - ly(m.c), {fill: c.c1, fillOpacity: 0.32, rx: 0});
      api.line([T0, ly(m.c)], [T1, ly(m.c)], {color: c.c1, width: 2.5});
      api.path("M " + T0 + " " + ty1 + " L " + T0 + " " + ty0 + " L " + T1 + " " + ty0 + " L " + T1 + " " + ty1, {stroke: c.muted, width: 1.6});
      [0.1, 1, 10].forEach(function (u) { api.line([T0 - 4, ly(u)], [T0, ly(u)], {color: c.muted, width: 1.2}); L([T0 - 7, ly(u)], u + " µM", c.muted, {anchor: "end", weight: 500}); });
      L([T0 - 7, ty0 + 12], "log scale", c.muted, {anchor: "end", weight: 500});
      var lab = ly(m.c) - 10 < ty1 + 4 ? ly(m.c) + 13 : ly(m.c) - 10;
      L([(T0 + T1) / 2, lab], "cAMP " + api.fmt(m.c, m.c >= 10 ? 1 : 2) + " µM", c.c1, {anchor: "middle", size: 12.5, weight: 650});
      // PDE drains it: outflow k [cAMP], equal to the inflow at steady state
      var PY = 256, PX = 228;
      api.line([T1, PY], [PX - 16, PY], {color: c.c1, width: wIn});
      api.rect(PX - 16, PY - 13, 32, 26, {fill: c.c6, fillOpacity: 0.25, stroke: c.c6, width: 1.5, rx: 6});
      L([PX, PY], "PDE", c.c6, {anchor: "middle", weight: 700});
      api.arrow([PX + 17, PY], [PX + 56, PY], {color: c.c6, width: Math.max(1.5, wIn * 0.8), halo: false, head: 8});
      L([PX + 60, PY], "AMP", c.c6);
      L([PX - 18, PY + 26], "out = " + api.fmt(v.k, 1) + " × " + api.fmt(m.c, m.c >= 10 ? 1 : 2) + " = in", c.c6, {weight: 500});
      // PKA: four R2C2 holoenzymes, freed catalytic subunits drift right
      var free = Math.round(8 * m.a), X0 = 264, Y0 = 122;
      L([X0 - 4, Y0 - 18], "PKA  " + Math.round(m.a * 100) + "% active", c.c3, {size: 12.5, weight: 650});
      for (var h = 0; h < 4; h++) {
        var y = Y0 + h * 24;
        api.rect(X0 + 14, y - 8, 14, 16, {fill: c.c2, fillOpacity: 0.4, stroke: c.c2, width: 1.2, rx: 4});
        api.rect(X0 + 30, y - 8, 14, 16, {fill: c.c2, fillOpacity: 0.4, stroke: c.c2, width: 1.2, rx: 4});
        for (var s = 0; s < 2; s++) {
          var idx = h * 2 + s, out = idx < free, x = out ? 334 + s * 28 : (s ? X0 + 46 : X0 - 4);
          api.circle([x + 8, y], 8, {fill: c.c3, fillOpacity: out ? 0.85 : 0.25, stroke: c.c3, width: 1.4});
          if (out) [-3, 3].forEach(function (d) { api.circle([X0 + 21 + (s ? 16 : 0) + d, y - 2], 2, {fill: c.c1}); });
        }
      }
      L([X0 + 29, Y0 + 94], "R₂ + cAMP", c.c2, {anchor: "middle", weight: 500});
      L([356, Y0 + 94], free ? "free C" : "none free", c.c3, {anchor: "middle", weight: 500});
      if (free) L([392, Y0 + 110], "→ phosphorylate targets", c.c3, {anchor: "end", weight: 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
