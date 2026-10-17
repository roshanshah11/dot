// Uniform circular motion seen from above: a mass on a circle of radius r moving at speed v needs a net force
// F = m v^2 / r pointing at the centre. The circle is drawn at 26 px per metre until it fills the panel (r = 3.5 m),
// then the view zooms out to keep r = 5 m inside; the "1 m" bar always shows the scale. The force arrow shows the
// direction only, because F runs from 0 to 320 N across the sliders; its size is read on the right, where F is
// plotted against v. That chart's force axis steps through 10, 20, 40 ... 320 N, the smallest that holds m 8^2 / r,
// so the parabola (the v^2) always fills at least half the height, and the hollow dot marks the claim in the status:
// at twice the speed the force is four times as large.
(function () {
  var fN = function (x) { return Viz.fmt(x, x < 1 ? 2 : 1); };   // forces under 1 N keep two decimals, never "0 N"
  Viz.register("centripetal-force-mvr", {
    title: "Centripetal force in circular motion",
    subject: "physics",
    shows: "Change the mass, speed and radius: the pull toward the centre grows with m and with v squared, and falls as the circle widens",
    params: {
      massKilograms: {kind: "number", default: 2, min: 0.5, max: 5, step: 0.1, label: "m\\ (\\text{kg})"},
      speedMetersPerSecond: {kind: "number", default: 4, min: 0, max: 8, step: 0.1, label: "v\\ (\\text{m/s})"},
      radiusMeters: {kind: "number", default: 2, min: 1, max: 5, step: 0.1, label: "r\\ (\\text{m})"}
    },
    formula: function (v) {
      var m = v.massKilograms, s = v.speedMetersPerSecond, r = v.radiusMeters, F = m * s * s / r;
      return "\\begin{array}{l}F_c=\\dfrac{mv^2}{r}=\\dfrac{" + Viz.n(m) + "\\cdot " + Viz.n(s) + "^2}{" + Viz.n(r) + "}=" + Viz.n(F, F < 1 ? 2 : 1) + "\\ \\text{N}\\\\[4pt]" +
        "a_c=\\dfrac{v^2}{r}=" + Viz.n(s * s / r, 2) + "\\ \\text{m/s}^2\\end{array}";
    },
    status: function (v) {
      var m = v.massKilograms, s = v.speedMetersPerSecond, r = v.radiusMeters, F = m * s * s / r;
      if (s === 0) return "At rest the mass needs <b>no</b> centripetal force: F = 0, and nothing has to pull it toward the centre.";
      return "Keeping " + Viz.fmt(m) + " kg on this circle takes <b>" + fN(F) + " N</b> toward the centre; at twice the speed it would take <b>" + fN(4 * F) +
        " N</b>, four times as much.";
    },
    examples: [
      {name: "Minimum supported values", values: {massKilograms: 0.5, speedMetersPerSecond: 0, radiusMeters: 1}},
      {name: "Maximum supported values", values: {massKilograms: 5, speedMetersPerSecond: 8, radiusMeters: 5}},
      {name: "tight fast turn (largest force)", values: {massKilograms: 5, speedMetersPerSecond: 8, radiusMeters: 1}},
      {name: "double the speed", values: {massKilograms: 2, speedMetersPerSecond: 8, radiusMeters: 2}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, m = v.massKilograms, s = v.speedMetersPerSecond, r = v.radiusMeters, F = m * s * s / r;
      // left: the circle from above, 26 px per metre, zoomed out only when that would overflow the panel
      var k = Math.min(26, 92 / r), C = [104, 162], rp = r * k, B = [C[0], C[1] - rp], br = 5 + 3.2 * Math.cbrt(m);
      // a label on a card-coloured plate, so the dashed circle never runs through its letters
      var tag = function (at, text, col, anchor) {
        var w = text.length * 12.5 * 0.56 + 6, x = anchor === "end" ? at[0] - w + 3 : at[0] - 3;
        api.rect(x, at[1] - 9, w, 18, {fill: c.card, rx: 4});
        api.label(at, text, {color: col, size: 12.5, weight: 650, anchor: anchor});
      };
      api.label([12, 14], "seen from above", {color: c.muted, size: 12});
      api.label([12, 31], s > 0 ? "one lap: " + api.fmt(2 * Math.PI * r / s, 2) + " s" : "at rest: no lap, F = 0", {color: c.muted, size: 12});
      api.circle(C, rp, {stroke: c.muted, width: 1.5, dash: "5 4"});
      api.point(C, {color: c.muted, r: 3});
      // radius drawn to the lower right so it never meets the force arrow
      var ang = Math.PI / 8, E = [C[0] + rp * Math.sin(ang), C[1] + rp * Math.cos(ang)];
      api.line(C, E, {color: c.muted, width: 1.5});
      api.label([E[0] + 5, E[1] + 9], "r = " + api.fmt(r) + " m", {color: c.muted, size: 12, anchor: "start"});
      // the scale bar
      api.line([12, 278], [12 + k, 278], {color: c.muted, width: 1.5});
      [12, 12 + k].forEach(function (x) { api.line([x, 274], [x, 282], {color: c.muted, width: 1.5}); });
      api.label([18 + k, 278], "1 m", {color: c.muted, size: 12});
      if (s > 0) {
        api.arrow(B, [B[0] + s * 11, B[1]], {color: c.c1, width: 3});
        api.label([B[0] + br + 2, B[1] - br - 3], "v = " + api.fmt(s) + " m/s", {color: c.c1, size: 12.5, weight: 650});
        var aLen = Math.min(36, rp - 10);
        api.arrow([B[0], B[1] + 10], [B[0], B[1] + 10 + aLen], {color: c.c5, width: 3, halo: false});
        tag([B[0] - 8, B[1] + 12 + aLen / 2], "F = " + fN(F) + " N", c.c5, "end");
      }
      api.circle(B, br, {fill: c.c2, stroke: c.card, width: 1.5});
      api.label([B[0] - br - 4, B[1] - br - 3], api.fmt(m) + " kg", {color: c.c2, size: 12.5, weight: 650, anchor: "end"});
      // right: F against v for this mass and radius; the force axis is the smallest doubling step that holds v = 8
      var top = m * 64 / r, Fmax = 10;
      while (Fmax < top - 1e-9) Fmax *= 2;
      var gx0 = 235, gx1 = 384, gy0 = 236, gy1 = 36, tk = Fmax % 4 ? Fmax / 2 : Fmax / 4;
      var GX = function (sp) { return gx0 + (gx1 - gx0) * sp / 8; }, GY = function (f) { return gy0 - (gy0 - gy1) * f / Fmax; };
      for (var t = 0; t <= Fmax + 1e-9; t += tk) {
        api.line([gx0, GY(t)], [gx1, GY(t)], {color: c.grid, width: 1});
        api.label([gx0 - 6, GY(t)], String(t), {color: c.muted, size: 12, anchor: "end"});
      }
      for (var q = 0; q <= 8; q += 2) api.label([GX(q), gy0 + 14], String(q), {color: c.muted, size: 12, anchor: "middle"});
      api.line([gx0, gy0], [gx1, gy0], {color: c.axis, width: 1.2});
      api.line([gx0, gy0], [gx0, gy1 - 6], {color: c.axis, width: 1.2});
      api.label([gx0 - 6, gy1 - 16], "F (N)", {color: c.muted, size: 12, anchor: "middle"});
      api.label([gx1, gy0 + 30], "v (m/s)", {color: c.muted, size: 12, anchor: "end"});
      var curve = [];
      for (var sp = 0; sp <= 8.0001; sp += 0.1) curve.push([GX(sp), GY(m * sp * sp / r)]);
      api.polyline(curve, {stroke: c.c5, width: 2.2});
      var legend = "F = mv²/r", placed = [[gx0 + 8, gy1 + 15, gx0 + 12 + legend.length * 7, gy1 + 29]];
      api.label([gx0 + 8, gy1 + 22], legend, {color: c.c5, size: 12.5, weight: 600});
      // a value label beside its dot, at the first spot that misses the curve, the axes, the dots and the labels already
      // down; in the crowded corner near v = 0 there may be none, and then it goes in a key under the formula, by its marker
      var key = [];
      var place = function (text, spots, dots, hollow) {
        var w = text.length * 12.5 * 0.56 + 2, pick = null;
        spots.forEach(function (o) {
          if (pick) return;
          var x0 = o[2] === "end" ? o[0] - w : o[2] === "middle" ? o[0] - w / 2 : o[0], b = [x0, o[1] - 7, x0 + w, o[1] + 7];
          var hit = function (pt, pad) { return pt[0] > b[0] - pad && pt[0] < b[2] + pad && pt[1] > b[1] - pad && pt[1] < b[3] + pad; };
          var bad = b[0] < gx0 + 3 || b[2] > api.w - 2 || b[3] > gy0 - 2 || b[1] < 4 || curve.some(function (pt) { return hit(pt, 2); }) ||
            dots.some(function (pt) { return hit(pt, 6); }) || placed.some(function (o2) { return b[0] < o2[2] && o2[0] < b[2] && b[1] < o2[3] && o2[1] < b[3]; });
          if (!bad) pick = {o: o, b: b};
        });
        if (!pick) { key.push([text, hollow]); return; }
        placed.push(pick.b);
        api.label([pick.o[0], pick.o[1]], text, {color: c.c5, size: 12.5, weight: 650, anchor: pick.o[2]});
      };
      var P = [GX(s), GY(F)], dbl = s > 0 && 2 * s <= 8 + 1e-9, P2 = [GX(2 * s), GY(4 * F)], dots = dbl ? [P, P2] : [P];
      api.line([P[0], gy0], P, {color: c.c1, width: 1.2, dash: "3 3"});
      api.line([gx0, P[1]], P, {color: c.c5, width: 1.2, dash: "3 3"});
      if (dbl) {
        api.line([P2[0], gy0], P2, {color: c.c1, width: 1.2, dash: "3 3"});
        api.circle(P2, 4.5, {fill: c.card, stroke: c.c5, width: 2});
      }
      api.point(P, {color: c.c5, r: 5});
      // up and to the left of a dot is above a rising parabola; near v = 0 there is no room there, so other spots follow
      var near = function (D) { return [[D[0] - 8, D[1] - 11, "end"], [D[0] + 8, D[1] - 11, "start"], [D[0], D[1] - 15, "middle"], [D[0] + 9, D[1] + 4, "start"]]; };
      if (dbl) place("2v: " + fN(4 * F) + " N", near(P2), dots, true);
      place(fN(F) + " N", near(P), dots, false);
      key.forEach(function (q, i) {
        var y = gy1 + 44 + 18 * i;
        api.circle([gx0 + 14, y], 4.5, q[1] ? {fill: c.card, stroke: c.c5, width: 2} : {fill: c.c5});
        api.label([gx0 + 25, y], q[0], {color: c.c5, size: 12.5, weight: 650});
      });
    }
  });
})();
