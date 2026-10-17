// Newton's second law, a = F_net / m. Top: a block (drawn bigger for more mass) pushed by the net force F, with its
// acceleration drawn to scale above it. Bottom: the same a read two ways, a against F at this mass (a straight line
// through 0, slope 1/m) and a against m at this force (the hyperbola F/m), each with the current setting marked.
(function () {
  function tint(api) { api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; }); }   // viz.css paints text ink

  Viz.register("newton-second-law", {
    title: "Newton's second law: F = ma",
    subject: "physics",
    shows: "Change the net force and the mass: the acceleration is F/m, so it grows in step with the force and shrinks as the mass grows",
    params: {
      netForceNewtons: {kind: "number", default: 8, min: 2, max: 12, step: 0.5, label: "F_{\\mathrm{net}}\\ (\\mathrm{N})"},
      massKilograms: {kind: "number", default: 2, min: 1, max: 4, step: 0.1, label: "m\\ (\\mathrm{kg})"}
    },
    formula: function (v) {
      var a = v.netForceNewtons / v.massKilograms;
      return "a=\\frac{F_{\\mathrm{net}}}{m}=\\frac{" + Viz.n(v.netForceNewtons, 1) + "\\ \\mathrm{N}}{" + Viz.n(v.massKilograms, 1) + "\\ \\mathrm{kg}}=" + Viz.n(a, 2) + "\\ \\mathrm{m/s^2}";
    },
    status: function (v) {
      var F = v.netForceNewtons, m = v.massKilograms, a = F / m;
      return Viz.fmt(F, 1) + " N on " + Viz.fmt(m, 1) + " kg gives <b>a = " + Viz.fmt(a, 2) + " m/s²</b>: each newton adds " + Viz.fmt(1 / m, 3) +
        " m/s² to this mass, so doubling F would double a and doubling m would halve it.";
    },
    examples: [
      {name: "Minimum supported values", values: {netForceNewtons: 2, massKilograms: 1}},
      {name: "Maximum supported values", values: {netForceNewtons: 12, massKilograms: 4}},
      {name: "big push, light block", values: {netForceNewtons: 12, massKilograms: 1}},
      {name: "gentle push, heavy block", values: {netForceNewtons: 2, massKilograms: 4}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, F = v.netForceNewtons, m = v.massKilograms, a = F / m;
      // the block on a frictionless floor (so the push is the net force)
      var yG = 116, bw = 34 + 14 * m, bh = 26 + 7 * m, bx = 150;
      api.line([20, yG], [380, yG], {color: c.axis, width: 1.5});
      api.label([380, yG + 14], "frictionless floor", {color: c.muted, size: 12, anchor: "end"});
      api.rect(bx, yG - bh, bw, bh, {fill: c.c2, fillOpacity: 0.3, stroke: c.c2, rx: 4});
      api.label([bx + bw / 2, yG - bh / 2], api.fmt(m, 1) + " kg", {color: c.c2, size: 13, weight: 650, anchor: "middle"});
      api.arrow([bx - 2 - 10 * F, yG - bh / 2], [bx - 2, yG - bh / 2], {color: c.c3, width: 3.5});
      api.label([bx - 6, yG - bh / 2 - 16], "F = " + api.fmt(F, 1) + " N", {color: c.c3, size: 13, weight: 650, anchor: "end"});
      var ay = yG - bh - 18, ax = bx + bw / 2;
      api.arrow([ax, ay], [ax + 12 * a, ay], {color: c.c1, width: 3.5, label: "a = " + api.fmt(a, 2) + " m/s²", labelAt: "mid", labelOffset: [0, -14], labelSize: 13});
      // two small graphs: a vs F (this m) and a vs m (this F); a axis 0..12 m/s² on both
      var gy0 = 274, gy1 = 168, aMax = 12;
      var Y = function (q) { return gy0 - (gy0 - gy1) * q / aMax; };
      function frame(x0, x1, xMax, xMin, xTicks, xName, title) {
        var X = function (q) { return x0 + (x1 - x0) * (q - xMin) / (xMax - xMin); };
        api.line([x0, gy0], [x1 + 6, gy0], {color: c.axis, width: 1.2, arrow: true});
        api.line([x0, gy0], [x0, gy1 - 8], {color: c.axis, width: 1.2, arrow: true});
        xTicks.forEach(function (t, i) { var last = i === xTicks.length - 1; api.label([X(t) + (last ? 6 : 0), gy0 + 12], last ? t + " " + xName : String(t), {color: c.muted, size: 12, anchor: last ? "end" : "middle"}); });
        [0, 6, 12].forEach(function (t) { api.label([x0 - 6, Y(t)], String(t), {color: c.muted, size: 12, anchor: "end"}); if (t) api.line([x0, Y(t)], [x1, Y(t)], {color: c.grid, width: 1}); });
        api.label([x0 - 4, gy1 - 20], title, {color: c.muted, size: 12});
        return X;
      }
      var XF = frame(46, 182, 12, 0, [0, 4, 8, 12], "N", "a (m/s²) vs F, m = " + api.fmt(m, 1) + " kg");
      api.line([XF(0), Y(0)], [XF(12), Y(12 / m)], {color: c.c3, width: 2.2});
      api.line([XF(F), Y(0)], [XF(F), Y(a)], {color: c.c3, width: 1, dash: "3 3"});
      api.line([XF(0), Y(a)], [XF(F), Y(a)], {color: c.c1, width: 1, dash: "3 3"});
      api.point([XF(F), Y(a)], {color: c.c1, r: 4.5});
      var XM = frame(244, 370, 4, 0, [0, 1, 2, 3, 4], "kg", "a vs m, F = " + api.fmt(F, 1) + " N");
      var curve = [];
      for (var q = Math.max(F / aMax, 0.05); q <= 4.0001; q += 0.05) curve.push([XM(q), Y(F / q)]);
      api.polyline(curve, {stroke: c.c2, width: 2.2});
      api.line([XM(m), Y(0)], [XM(m), Y(a)], {color: c.c2, width: 1, dash: "3 3"});
      api.line([XM(0), Y(a)], [XM(m), Y(a)], {color: c.c1, width: 1, dash: "3 3"});
      api.point([XM(m), Y(a)], {color: c.c1, r: 4.5});
      tint(api);
    }
  });
})();
