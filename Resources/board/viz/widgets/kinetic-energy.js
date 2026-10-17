// KE = (1/2) m v^2 as a curve: kinetic energy against velocity for this mass is a parabola, so the sign of v (the
// direction, shown by the cart's arrow) does not matter, and doubling the speed quadruples the energy (the grey
// marker at half the speed sits at a quarter of the height). The energy axis is fixed at 0 to 500 J, a little above
// the most the sliders allow (9 kg at 10 m/s = 450 J), so a heavier cart visibly steepens the curve and the top
// point keeps room for its label. Labels are placed by a small scorer that keeps them off the curve and each other.
(function () {
  function ke(m, v) { return 0.5 * m * v * v; }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };
  var TOP = 500, PH = 162; // energy at the top gridline; plot height in px
  // the half-speed marker is drawn when it sits clearly below the point (more than 8 px) and apart from it
  function showHalf(m, v) { var E = ke(m, v); return v !== 0 && 0.75 * E / TOP * PH > 8 && Math.abs(v) >= 1.5; }

  Viz.register("kinetic-energy", {
    title: "Kinetic energy",
    subject: "physics",
    shows: "Slide the mass and the velocity: KE = ½mv² grows with the square of the speed, and the direction of motion doesn't matter",
    params: {
      mass: {kind: "number", default: 5, min: 1, max: 9, step: 0.5, label: "m\\ (\\text{kg})"},
      velocity: {kind: "number", default: 8, min: -10, max: 10, step: 0.5, label: "v\\ (\\text{m/s})"}
    },
    formula: function (v) {
      return "\\mathrm{KE}=\\tfrac12mv^2=\\tfrac12\\cdot" + Viz.n(v.mass) + "\\cdot" + Viz.p(v.velocity) + "^2=" + Viz.n(ke(v.mass, v.velocity)) + "\\ \\text{J}";
    },
    status: function (v) {
      var E = ke(v.mass, v.velocity), head = f(v.mass) + " kg at " + f(Math.abs(v.velocity)) + " m/s " + (v.velocity < 0 ? "(moving left) " : "") + "carries <b>" + f(E) + " J</b>";
      if (v.velocity === 0) return "At rest the cart has <b>no kinetic energy</b>, whatever its mass (" + f(v.mass) + " kg).";
      if (!showHalf(v.mass, v.velocity)) return head + ", low on the parabola: KE grows with v², so it climbs steeply only at higher speeds.";
      return head + "; at half that speed (grey dot) it has a quarter, <b>" + f(E / 4) + " J</b>, so doubling the speed quadruples KE.";
    },
    examples: [
      {name: "at rest", values: {mass: 5, velocity: 0}},
      {name: "every input at its minimum", values: {mass: 1, velocity: -10}},
      {name: "every input at its maximum", values: {mass: 9, velocity: 10}},
      {name: "same speed, other direction", values: {mass: 5, velocity: -6}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, m = v.mass, vel = v.velocity, E = ke(m, vel), s = vel > 0 ? 1 : -1;
      var x0 = 58, x1 = 384, yT = 92, yB = yT + PH, X = function (u) { return x0 + (x1 - x0) * (u + 10) / 20; }, Y = function (j) { return yB - PH * j / TOP; };
      var halo = function (t) { ["stroke", c.card, "stroke-width", 3, "stroke-linejoin", "round", "paint-order", "stroke"].forEach(function (x, i, l) { if (i % 2 === 0) t.setAttribute(x, l[i + 1]); }); return t; };
      // the cart on its track: size grows with mass, the arrow is the velocity
      var tY = 52, cw = 22 + 3.2 * m, ch = 12 + 0.9 * m, cx = 200;
      api.line([20, tY + 6], [380, tY + 6], {color: c.axis, width: 1.4});
      api.rect(cx - cw / 2, tY - ch, cw, ch, {fill: c.c2, fillOpacity: 0.5, stroke: c.c2, rx: 4, width: 1.5});
      api.circle([cx - cw / 2 + 6, tY + 2], 3.5, {fill: c.c2});
      api.circle([cx + cw / 2 - 6, tY + 2], 3.5, {fill: c.c2});
      api.label([cx, tY - ch - 10], f(m) + " kg", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      if (vel !== 0) {
        var a0 = cx + s * (cw / 2 + 6), a1 = a0 + s * 7.5 * Math.abs(vel);
        api.arrow([a0, tY - ch / 2], [a1, tY - ch / 2], {color: c.c1, width: 3, halo: false});
        api.label([a1 + s * 8, tY - ch / 2], "v = " + f(vel) + " m/s", {color: c.c1, size: 12.5, weight: 650, anchor: s > 0 ? "start" : "end"});
      } else api.label([cx + cw / 2 + 10, tY - ch / 2], "v = 0", {color: c.c1, size: 12.5, weight: 650});
      // axes
      for (var j = 0; j <= TOP; j += 100) {
        api.line([x0, Y(j)], [x1, Y(j)], {color: j ? c.grid : c.axis, width: j ? 1 : 1.3});
        api.label([x0 - 7, Y(j)], String(j), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([x0 - 7, yT - 12], "KE (J)", {color: c.muted, size: 12, anchor: "start"});
      api.line([X(0), yB], [X(0), yT], {color: c.axis, width: 1});
      [-10, -5, 0, 5, 10].forEach(function (u) { api.label([X(u), yB + 14], String(u).replace("-", "−"), {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([x1, yB + 28], "v (m/s)", {color: c.muted, size: 12, anchor: "end"});
      // the parabola for this mass; its legend sits in the header row on the side away from the point
      var pts = [];
      for (var u = -10; u <= 10.001; u += 0.25) pts.push([X(u), Y(ke(m, u))]);
      api.polyline(pts, {stroke: c.c3, width: 2.5});
      var lg = "curve: KE = ½·" + f(m) + "·v²";
      api.label(vel > 0 ? [x0 + 46, yT - 12] : [x1, yT - 12], lg, {color: c.c3, size: 12.5, weight: 650, anchor: vel > 0 ? "start" : "end"});
      var P = [X(vel), Y(E)], H = [X(vel / 2), Y(E / 4)], half = showHalf(m, vel);
      if (vel !== 0) {
        // same speed the other way: same energy
        api.line([X(-vel), Y(E)], P, {color: c.faint, width: 1, dash: "3 4"});
        api.circle([X(-vel), Y(E)], 5, {stroke: c.c3, width: 1.8});
        api.line([P[0], Y(E)], [P[0], yB], {color: c.c1, width: 1.2, dash: "4 4"});
      }
      // the point's label goes toward v = 0 (inside the U, above the arc), lifted until the curve under it clears
      var pl = "KE = " + f(E) + " J", pw = pl.length * 13 * 0.52, pr = vel <= 0, pxs = pr ? [P[0] + 10, P[0] + 10 + pw] : [P[0] - 10 - pw, P[0] - 10];
      var um = Math.min(10, Math.max.apply(null, pxs.map(function (x) { return Math.abs((x - X(0)) / (x1 - x0) * 20); })));
      var py = Math.min(P[1] - (vel === 0 ? 26 : 14), Y(ke(m, um)) - 10), pbox = [pxs[0], py - 7, pxs[1], py + 7];
      if (half) {
        // half the speed, a quarter of the energy: score a few spots for its label and take the clearest
        api.circle(H, 4, {fill: c.muted});
        var hl = "v/2: " + f(E / 4) + " J", hw = hl.length * 12 * 0.52, tri = [];
        var hit = function (b, q, pad) { return q[0] > b[0] - pad && q[0] < b[2] + pad && q[1] > b[1] - pad && q[1] < b[3] + pad; };
        var cost = function (b) {
          var k = 0, t;
          if (b[0] < x0 + 2 || b[2] > 397 || b[3] > yB + 1 || b[1] < yT - 4) k += 50;
          pts.forEach(function (q) { if (hit(b, q, 2)) k += 10; });
          if (b[0] < pbox[2] + 4 && pbox[0] < b[2] + 4 && b[1] < pbox[3] + 2 && pbox[1] < b[3] + 2) k += 40;
          [P, H, [X(-vel), P[1]]].forEach(function (q) { if (hit(b, q, 5)) k += 30; });
          for (t = 0; t <= 1; t += 0.05) {   // thin lines: the v = 0 axis, the dashed v line and the mirror line (haloed text can cross them)
            if (hit(b, [X(0), yT + t * PH], 0)) k += 0.3;
            if (hit(b, [P[0], P[1] + t * (yB - P[1])], 0)) k += 0.3;
            if (hit(b, [X(-vel) + t * (P[0] - X(-vel)), P[1]], 0)) k += 0.3;
          }
          return k;
        };
        var add = function (x, y, anc, lead) { tri.push({x: x, y: y, anc: anc, lead: lead, b: anc === "end" ? [x - hw, y - 6, x, y + 6] : anc === "middle" ? [x - hw / 2, y - 6, x + hw / 2, y + 6] : [x, y - 6, x + hw, y + 6]}); };
        var inA = s > 0 ? "end" : "start", outA = s > 0 ? "start" : "end";
        add(H[0] - 6 * s, H[1] - 12, inA);                        // above the arc, toward v = 0
        add(H[0] + 7 * s, H[1] + 13, outA);                       // under the arc, outward
        add(H[0] - 8 * s, (yB + P[1]) / 2, inA);                  // beside it, between the axis and the mirror line
        add(P[0] + 6 * s, H[1], outA, true);                      // past the dashed v line, with a leader
        add(H[0], P[1] - 13, "middle", true);                     // above the mirror line, with a leader
        tri.forEach(function (q) { q.k = cost(q.b) + (q.lead ? 1.5 : 0); });
        var best = tri.reduce(function (a, b) { return b.k < a.k ? b : a; });
        if (best.lead) api.line(best.y === H[1] ? [H[0] + 5 * s, H[1]] : [H[0], H[1] - 5], best.y === H[1] ? [P[0] + 3 * s, H[1]] : [H[0], best.y + 7], {color: c.muted, width: 1, dash: "2 3"});
        halo(api.label([best.x, best.y], hl, {color: c.muted, size: 12, anchor: best.anc}));
      }
      api.point(P, {color: c.c3, r: 6});
      api.label([pr ? pbox[0] : pbox[2], py], pl, {color: c.c3, size: 13, weight: 700, anchor: pr ? "start" : "end"});
      api.handle(P, {color: c.c3, r: 6, onDrag: function (q) {
        api.set({velocity: Math.max(-10, Math.min(10, Math.round(((q[0] - x0) / (x1 - x0) * 20 - 10) * 2) / 2))});
      }});
    }
  });
})();
