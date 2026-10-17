// A simple pendulum released from rest at angle theta0. The textbook period T = 2 pi sqrt(L / g) is the small-angle
// limit; the exact period of the frictionless pendulum is T0 / AGM(1, cos(theta0 / 2)) (the complete elliptic integral
// written with the arithmetic-geometric mean), so the widget shows both and how far apart they drift at big angles.
// The swing itself is integrated from theta'' = -(g / L) sin theta with RK4 (dt = 2 ms), not taken from the
// small-angle cosine, so the solid curve and the bob are the real motion. g = 9.81 m/s^2; mass cancels out.
// Dot's extra beyond the queue's two params: the time t, which places the bob and the marker on the graph.
(function () {
  var G = 9.81, TW = 6, DT = 0.002, PXM = 82;
  function agm(a, b) { for (var i = 0; i < 12; i++) { var a1 = (a + b) / 2; b = Math.sqrt(a * b); a = a1; } return a; }
  function calc(v) {
    var L = v.lengthMeters, th0 = v.startingAngleDegrees * Math.PI / 180, w2 = G / L;
    var T0 = 2 * Math.PI * Math.sqrt(L / G), T = T0 / agm(1, Math.cos(th0 / 2));
    // RK4 on (theta, omega); keep every 10th step (every 0.02 s)
    var th = th0, om = 0, pts = [[0, th0, 0]], n = Math.round(TW / DT);
    var f = function (a) { return -w2 * Math.sin(a); };
    for (var i = 1; i <= n; i++) {
      var k1t = om, k1o = f(th), k2t = om + DT / 2 * k1o, k2o = f(th + DT / 2 * k1t);
      var k3t = om + DT / 2 * k2o, k3o = f(th + DT / 2 * k2t), k4t = om + DT * k3o, k4o = f(th + DT * k3t);
      th += DT / 6 * (k1t + 2 * k2t + 2 * k3t + k4t); om += DT / 6 * (k1o + 2 * k2o + 2 * k3o + k4o);
      if (i % 10 === 0) pts.push([i * DT, th, om]);
    }
    var j = Math.min(pts.length - 2, Math.floor(v.time / 0.02)), u = v.time / 0.02 - j;
    var now = [pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u, pts[j][2] + (pts[j + 1][2] - pts[j][2]) * u];
    return {L: L, th0: th0, T0: T0, T: T, pts: pts, th: now[0], om: now[1], err: (T - T0) / T0};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };

  Viz.register("simple-pendulum", {
    title: "Simple pendulum: period and the small-angle rule",
    subject: "physics",
    shows: "Slide the length and the release angle: the period grows with the square root of L, and T = 2π√(L/g) holds only for small swings",
    params: {
      lengthMeters: {kind: "number", default: 1.2, min: 0.5, max: 2, step: 0.05, label: "L\\ (\\text{m})"},
      startingAngleDegrees: {kind: "number", default: 35, min: 5, max: 60, step: 1, label: "\\theta_0\\ (^\\circ)"},
      time: {kind: "number", default: 0.4, min: 0, max: 6, step: 0.05, label: "t\\ (\\text{s})"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}T\\approx2\\pi\\sqrt{\\tfrac{L}{g}}=2\\pi\\sqrt{\\tfrac{" + Viz.n(v.lengthMeters) + "}{9.81}}=" + Viz.n(k.T0, 3) + "\\ \\text{s}\\\\" +
        "\\text{exact at }" + Viz.n(v.startingAngleDegrees, 0) + "^\\circ:\\ T=" + Viz.n(k.T, 3) + "\\ \\text{s}\\ (+" + Viz.n(k.err * 100, 2) + "\\%)\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      var gap = k.err < 0.002 ? ", so at " + f(v.startingAngleDegrees, 0) + "° the small-angle formula is within <b>" + f(k.err * 100, 2) + "%</b>"
        : ", <b>" + f(k.err * 100, 1) + "%</b> longer than the small-angle formula's " + f(k.T0, 3) + " s, because the pull back along the arc grows like sin θ, not θ";
      return "One full swing, there and back, takes <b>" + f(k.T, 3) + " s</b>" + gap + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {lengthMeters: 0.5, startingAngleDegrees: 5}},
      {name: "Maximum supported values", values: {lengthMeters: 2, startingAngleDegrees: 60}},
      {name: "one period later, back at the start", values: {lengthMeters: 1, startingAngleDegrees: 20, time: 2.02}},
      {name: "passing the bottom", values: {lengthMeters: 1.5, startingAngleDegrees: 45, time: 0.65}}
    ],
    size: [400, 336],
    draw: function (api, v) {
      var c = api.color, k = calc(v), P = [200, 20], R = k.L * PXM;
      var at = function (a, r) { return [P[0] + r * Math.sin(a), P[1] + r * Math.cos(a)]; };
      // support and the vertical
      api.line([P[0] - 40, P[1]], [P[0] + 40, P[1]], {color: c.muted, width: 2.5});
      for (var h = -36; h <= 36; h += 9) api.line([P[0] + h, P[1]], [P[0] + h - 6, P[1] - 7], {color: c.muted, width: 1});
      api.line(P, [P[0], P[1] + R + 16], {color: c.faint, width: 1, dash: "3 4"});
      // the swing: arc from -theta0 to +theta0, release position as a hollow ghost
      var arc = []; for (var i = 0; i <= 60; i++) arc.push(at(-k.th0 + 2 * k.th0 * i / 60, R));
      api.polyline(arc, {stroke: c.faint, width: 1.3, dash: "2 4"});
      api.line(P, at(k.th0, R), {color: c.faint, width: 1});
      api.circle(at(k.th0, R), 8, {stroke: c.muted, width: 1.5, dash: "3 2"});
      var ar = Math.min(34, R * 0.42), ang = []; for (var j = 0; j <= 20; j++) ang.push(at(k.th0 * j / 20, ar));
      api.polyline(ang, {stroke: c.c3, width: 1.8});
      var ae = at(k.th0, ar);
      api.label([ae[0] + 7, ae[1] + 3], "θ₀ " + f(v.startingAngleDegrees, 0) + "°", {color: c.c3, size: 12.5, weight: 650});
      // the string and bob now
      var B = at(k.th, R);
      api.line(P, B, {color: c.ink, width: 1.8});
      api.circle(B, 9, {fill: c.c2, fillOpacity: 1, stroke: c.card, width: 2});
      var mid = at(k.th, R * 0.55);
      api.label([mid[0] - 9, mid[1]], "L = " + f(k.L) + " m", {color: c.ink, size: 12.5, anchor: "end"});
      // velocity: tangent to the arc, length grows with speed; its size written under the bob
      var sp = k.om * k.L, sg = sp < 0 ? -1 : 1;
      if (Math.abs(sp) > 0.08) {
        var len = 16 * Math.abs(sp), tx = Math.cos(k.th) * sg, ty = -Math.sin(k.th) * sg;
        api.arrow([B[0] + tx * 11, B[1] + ty * 11], [B[0] + tx * (len + 11), B[1] + ty * (len + 11)], {color: c.c1, width: 2.5, halo: false});
        var ro = [Math.sin(k.th), Math.cos(k.th)], lb = [B[0] + 16 * ro[0] - 16 * tx, B[1] + 16 * ro[1] - 16 * ty];
        api.label(lb, "v " + f(Math.abs(sp), 1) + " m/s", {color: c.c1, size: 12, weight: 650, anchor: lb[0] >= B[0] ? "start" : "end"});
      } else {
        api.label(at(k.th, R + 22), "at rest", {color: c.c1, size: 12, weight: 650, anchor: "middle"});
      }
      // theta(t): real motion (solid) against the small-angle cosine (dashed)
      var gx0 = 40, gx1 = 388, gc = 258, gh = 28;
      var X = function (t) { return gx0 + (gx1 - gx0) * t / TW; }, Y = function (a) { return gc - gh * a / k.th0; };
      api.line([gx0, gc], [gx1, gc], {color: c.axis, width: 1.2});
      api.line([gx0, gc - gh - 6], [gx0, gc + gh + 6], {color: c.axis, width: 1.2});
      [k.th0, -k.th0].forEach(function (a) { api.line([gx0, Y(a)], [gx1, Y(a)], {color: c.grid, width: 1}); });
      api.label([gx0 - 5, Y(k.th0)], "+" + f(v.startingAngleDegrees, 0) + "°", {color: c.muted, size: 12, anchor: "end"});
      api.label([gx0 - 5, Y(-k.th0)], "−" + f(v.startingAngleDegrees, 0) + "°", {color: c.muted, size: 12, anchor: "end"});
      for (var t = 1; t <= TW; t++) api.label([X(t), gc + gh + 16], String(t), {color: c.muted, size: 12, anchor: "middle"});
      api.label([gx0 - 5, gc + gh + 16], "t (s)", {color: c.muted, size: 12, anchor: "end"});
      var approx = []; for (var q = 0; q <= 300; q++) { var tt = TW * q / 300; approx.push([X(tt), Y(k.th0 * Math.cos(2 * Math.PI * tt / k.T0))]); }
      api.polyline(approx, {stroke: c.c6, width: 1.6, dash: "5 4"});
      api.polyline(k.pts.map(function (p) { return [X(p[0]), Y(p[1])]; }), {stroke: c.c2, width: 2.2});
      // one exact period, bracketed above the curve; the legend for the dashed curve on the same row
      var by = gc - gh - 13;
      api.line([X(0), by], [X(k.T), by], {color: c.c2, width: 1.5});
      [0, k.T].forEach(function (t) { api.line([X(t), by - 4], [X(t), by + 4], {color: c.c2, width: 1.5}); });
      api.label([X(k.T) + 6, by], "T = " + f(k.T, 3) + " s", {color: c.c2, size: 12.5, weight: 650});
      api.label([gx1, gc + gh + 34], "dashed: small-angle 2π√(L/g)", {color: c.c6, size: 12, anchor: "end"});
      // now
      api.line([X(v.time), gc - gh - 4], [X(v.time), gc + gh + 4], {color: c.faint, width: 1});
      api.circle([X(v.time), Y(k.th)], 4.5, {fill: c.c2, fillOpacity: 1, stroke: c.card, width: 1.5});
    }
  });
})();
