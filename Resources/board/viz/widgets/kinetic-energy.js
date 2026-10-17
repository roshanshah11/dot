// KE = (1/2) m v^2 as a curve: kinetic energy against velocity for this mass is a parabola, so the sign of v (the
// direction, shown by the cart's arrow) does not matter, and doubling the speed quadruples the energy (the faint
// marker at half the speed sits at a quarter of the height). The energy axis is fixed at 0 to 450 J, the most the
// sliders allow (9 kg at 10 m/s), so a heavier cart visibly steepens the curve.
(function () {
  function ke(m, v) { return 0.5 * m * v * v; }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };

  Viz.register("kinetic-energy", {
    title: "Kinetic energy",
    subject: "physics",
    shows: "Slide the mass and the velocity: KE = ½mv² grows with the square of the speed, and the direction of motion doesn't matter",
    params: {
      mass: {kind: "number", default: 5, min: 1, max: 9, step: 0.5, label: "m\\ (\\text{kg})"},
      velocity: {kind: "number", default: 0, min: -10, max: 10, step: 0.5, label: "v\\ (\\text{m/s})"}
    },
    formula: function (v) {
      return "\\mathrm{KE}=\\tfrac12mv^2=\\tfrac12\\cdot" + Viz.n(v.mass) + "\\cdot" + Viz.p(v.velocity) + "^2=" + Viz.n(ke(v.mass, v.velocity)) + "\\ \\text{J}";
    },
    status: function (v) {
      var E = ke(v.mass, v.velocity);
      if (v.velocity === 0) return "At rest the cart has <b>no kinetic energy</b>, whatever its mass (" + f(v.mass) + " kg).";
      return f(v.mass) + " kg at " + f(Math.abs(v.velocity)) + " m/s " + (v.velocity < 0 ? "(moving left) " : "") + "carries <b>" + f(E) +
        " J</b>; at twice the speed it would carry four times as much, <b>" + f(4 * E) + " J</b>.";
    },
    examples: [
      {name: "at rest", values: {mass: 5, velocity: 0}},
      {name: "every input at its minimum", values: {mass: 1, velocity: -10}},
      {name: "every input at its maximum", values: {mass: 9, velocity: 10}},
      {name: "same speed, other direction", values: {mass: 5, velocity: -6}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, m = v.mass, vel = v.velocity, E = ke(m, vel);
      var x0 = 58, x1 = 384, yT = 92, yB = 254, X = function (u) { return x0 + (x1 - x0) * (u + 10) / 20; }, Y = function (j) { return yB - (yB - yT) * j / 450; };
      // the cart on its track: size grows with mass, the arrow is the velocity
      var tY = 52, cw = 22 + 3.2 * m, ch = 12 + 0.9 * m, cx = 200;
      api.line([20, tY + 6], [380, tY + 6], {color: c.axis, width: 1.4});
      api.rect(cx - cw / 2, tY - ch, cw, ch, {fill: c.c2, fillOpacity: 0.5, stroke: c.c2, rx: 4, width: 1.5});
      api.circle([cx - cw / 2 + 6, tY + 2], 3.5, {fill: c.c2});
      api.circle([cx + cw / 2 - 6, tY + 2], 3.5, {fill: c.c2});
      api.label([cx, tY - ch - 10], f(m) + " kg", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      if (vel !== 0) {
        var dir = vel > 0 ? 1 : -1, a0 = cx + dir * (cw / 2 + 6), a1 = a0 + dir * 7.5 * Math.abs(vel);
        api.arrow([a0, tY - ch / 2], [a1, tY - ch / 2], {color: c.c1, width: 3, halo: false});
        api.label([a1 + dir * 8, tY - ch / 2], "v = " + f(vel) + " m/s", {color: c.c1, size: 12.5, weight: 650, anchor: dir > 0 ? "start" : "end"});
      } else api.label([cx + cw / 2 + 10, tY - ch / 2], "v = 0", {color: c.c1, size: 12.5, weight: 650});
      // axes
      for (var j = 0; j <= 400; j += 100) {
        api.line([x0, Y(j)], [x1, Y(j)], {color: j ? c.grid : c.axis, width: j ? 1 : 1.3});
        api.label([x0 - 7, Y(j)], String(j), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([x0 - 7, yT - 12], "KE (J)", {color: c.muted, size: 12, anchor: "start"});
      api.line([X(0), yB], [X(0), yT - 4], {color: c.axis, width: 1});
      [-10, -5, 5, 10].forEach(function (u) { api.label([X(u), yB + 14], String(u).replace("-", "−"), {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([X(0), yB + 14], "0", {color: c.muted, size: 12, anchor: "middle"});
      api.label([x1, yB + 28], "v (m/s)", {color: c.muted, size: 12, anchor: "end"});
      // the parabola for this mass
      var pts = [];
      for (var u = -10; u <= 10.001; u += 0.25) pts.push([X(u), Y(ke(m, u))]);
      api.polyline(pts, {stroke: c.c3, width: 2.5});
      api.label([x1, yT - 12], "curve: KE = ½·" + f(m) + "·v²", {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
      var P = [X(vel), Y(E)];
      if (vel !== 0) {
        // same speed the other way: same energy; half the speed: a quarter of it
        api.line([X(-vel), Y(E)], P, {color: c.faint, width: 1, dash: "3 4"});
        api.circle([X(-vel), Y(E)], 5, {stroke: c.c3, width: 1.8});
        api.line([P[0], Y(E)], [P[0], yB], {color: c.c1, width: 1.2, dash: "4 4"});
        if (Y(E / 4) - Y(E) > 26) {
          var H = [X(vel / 2), Y(E / 4)];
          api.circle(H, 4, {fill: c.muted});
          api.label([H[0] + (vel > 0 ? -8 : 8), H[1] - 12], "v/2: " + f(E / 4) + " J", {color: c.muted, size: 12, anchor: vel > 0 ? "end" : "start"});
        }
      }
      api.point(P, {color: c.c3, r: 6});
      var right = vel <= 2;
      api.label([P[0] + (right ? 10 : -10), Math.max(P[1] - 14, yT + 6)], "KE = " + f(E) + " J", {color: c.c3, size: 13, weight: 700, anchor: right ? "start" : "end"});
      api.handle(P, {color: c.c3, r: 6, onDrag: function (q) {
        api.set({velocity: Math.max(-10, Math.min(10, Math.round(((q[0] - x0) / (x1 - x0) * 20 - 10) * 2) / 2))});
      }});
    }
  });
})();
