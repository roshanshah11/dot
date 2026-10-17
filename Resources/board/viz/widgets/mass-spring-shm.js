// A mass on a spring, lifted A above its equilibrium and let go at t = 0: x(t) = A cos(2 pi t / T) with
// T = 2 pi sqrt(m / k). The spring hangs on the left, drawn on the same vertical scale as the graph on the right, so
// the block's height at time t is the curve's height at t (dashed link). The amplitude changes the size of the swing
// but not the period. Spring stroke thickens with k and the block grows with m. Gravity only shifts where the
// equilibrium sits, not T. Dot's extra t (draggable on the curve) places the block.
(function () {
  var TW = 5, PXM = 180; // seconds on the graph; pixels per metre of displacement
  function calc(v) {
    var w = Math.sqrt(v.springConstantNewtonsPerMeter / v.massKilograms), A = v.amplitudeMeters;
    return {w: w, T: 2 * Math.PI / w, x: A * Math.cos(w * v.time), vel: -A * w * Math.sin(w * v.time), vmax: A * w};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 3 : d); };

  Viz.register("mass-spring-shm", {
    title: "Mass on a spring: simple harmonic motion",
    subject: "physics",
    shows: "Slide the mass, stiffness and amplitude: the period T = 2π√(m/k) depends on m and k only, never on how far it swings",
    params: {
      massKilograms: {kind: "number", default: 1.5, min: 0.5, max: 5, step: 0.1, label: "m\\ (\\text{kg})"},
      springConstantNewtonsPerMeter: {kind: "number", default: 40, min: 10, max: 100, step: 1, label: "k\\ (\\text{N/m})"},
      amplitudeMeters: {kind: "number", default: 0.25, min: 0.05, max: 0.5, step: 0.01, label: "A\\ (\\text{m})"},
      time: {kind: "number", default: 0.25, min: 0, max: 5, step: 0.01, label: "t\\ (\\text{s})"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}T=2\\pi\\sqrt{\\tfrac{m}{k}}=2\\pi\\sqrt{\\tfrac{" + Viz.n(v.massKilograms) + "}{" + Viz.n(v.springConstantNewtonsPerMeter) + "}}=" + Viz.n(k.T, 3) + "\\ \\text{s}\\\\" +
        "x(t)=A\\cos\\tfrac{2\\pi t}{T}\\\\\\quad=" + Viz.n(v.amplitudeMeters) + "\\cos(" + Viz.n(k.w * v.time, 3) + ")=" + Viz.n(k.x, 3) + "\\ \\text{m}\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      return "One full swing takes <b>" + f(k.T) + " s</b> (f = " + f(1 / k.T) + " Hz) at any amplitude; the block passes the middle at <b>" +
        f(k.vmax, 2) + " m/s</b> = Aω, and " + (Math.abs(k.vel) < 1e-3 ? "is momentarily at rest now." : "is moving " + (k.vel > 0 ? "up" : "down") + " at " + f(Math.abs(k.vel), 2) + " m/s now.");
    },
    examples: [
      {name: "Minimum supported values", values: {massKilograms: 0.5, springConstantNewtonsPerMeter: 10, amplitudeMeters: 0.05}},
      {name: "Maximum supported values", values: {massKilograms: 5, springConstantNewtonsPerMeter: 100, amplitudeMeters: 0.5}},
      {name: "fastest: light mass, stiff spring", values: {massKilograms: 0.5, springConstantNewtonsPerMeter: 100, amplitudeMeters: 0.3}},
      {name: "slowest: heavy mass, soft spring", values: {massKilograms: 5, springConstantNewtonsPerMeter: 10, amplitudeMeters: 0.3, time: 2.2}},
      {name: "passing the middle", values: {massKilograms: 1, springConstantNewtonsPerMeter: 40, amplitudeMeters: 0.4, time: 0.25}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v), A = v.amplitudeMeters, m = v.massKilograms, ks = v.springConstantNewtonsPerMeter;
      var cy = 150, sx = 70, gx0 = 150, gx1 = 386, Y = function (x) { return cy - PXM * x; }, Tx = function (t) { return gx0 + (gx1 - gx0) * t / TW; };
      // ceiling
      api.line([30, 16], [110, 16], {color: c.muted, width: 2});
      for (var h = 34; h <= 110; h += 10) api.line([h, 16], [h - 8, 8], {color: c.muted, width: 1});
      // equilibrium and amplitude guides across both halves
      api.line([22, cy], [gx1, cy], {color: c.axis, width: 1.2});
      api.line([110, Y(A)], [gx1, Y(A)], {color: c.faint, width: 1, dash: "3 4"});
      api.line([110, Y(-A)], [gx1, Y(-A)], {color: c.faint, width: 1, dash: "3 4"});
      if (A * PXM >= 15) {
        api.label([gx0 - 6, Y(A)], "+A", {color: c.muted, size: 12, anchor: "end"});
        api.label([gx0 - 6, Y(-A)], "−A", {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([gx0 - 6, cy], "0", {color: c.muted, size: 12, anchor: "end"});
      // block (side grows with sqrt m) and spring (zigzag to the block's top)
      var bs = 22 + 9 * Math.sqrt(m), by = Y(k.x), top = by - bs / 2, coils = 10, zz = [[sx, 16], [sx, 22]];
      var span = top - 6 - 22;
      for (var i = 1; i < 2 * coils; i++) zz.push([sx + (i % 2 ? 10 : -10), 22 + span * i / (2 * coils)]);
      zz.push([sx, top - 6], [sx, top]);
      api.polyline(zz, {stroke: c.c3, width: 1 + ks / 40});
      api.rect(sx - bs / 2, top, bs, bs, {fill: c.c2, fillOpacity: 0.85, stroke: c.c2, rx: 4});
      if (Math.abs(k.vel) > 0.05) {
        // the velocity arrow: 25 px per m/s (capped at 60 px), named at its tip; its value is in the readout line on top
        // (shortened only where it would run into the ceiling or the bottom edge)
        var dn = k.vel < 0, al = Math.max(16, Math.min(60, 25 * Math.abs(k.vel), dn ? 284 - by : by - 26)) * (dn ? 1 : -1);
        var ax = sx + bs / 2 + 12, vx = ax, vy = by + al + (dn ? 10 : -10), va = "middle";
        api.arrow([ax, by], [ax, by + al], {color: c.c1, width: 2.5, halo: false});
        if (dn ? vy > 279 : vy < 28) { vx = ax + 7; vy = by + al + (dn ? -6 : 6); va = "start"; }   // no room past the tip: beside it
        else if (Math.abs(vy - cy) < 8) vy = dn ? Math.max(vy, cy + 9) : Math.min(vy, cy - 9);   // off the equilibrium line
        api.label([vx, vy], "v", {color: c.c1, size: 12.5, weight: 700, italic: true, anchor: va});
      }
      api.label([12, 267.5], "m = " + f(m, 2) + " kg", {color: c.c2, size: 12.5, weight: 650});   // clear of the block at its lowest
      api.label([12, 281], "k = " + f(ks, 0) + " N/m", {color: c.c3, size: 12.5, weight: 650});
      // x(t) over five seconds, on the same vertical scale
      api.line([gx0, Y(0.5) - 6], [gx0, Y(-0.5) + 6], {color: c.axis, width: 1});
      for (var t = 0; t <= TW; t++) {
        api.line([Tx(t), Y(-0.5) + 6], [Tx(t), Y(-0.5) + 10], {color: c.axis, width: 1});
        api.label([Tx(t), Y(-0.5) + 22], String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([gx1, Y(-0.5) + 38], "t (s)", {color: c.muted, size: 12, anchor: "end"});
      var pts = [];
      for (var j = 0; j <= 1000; j++) { var tt = TW * j / 1000; pts.push([Tx(tt), Y(A * Math.cos(k.w * tt))]); }
      api.polyline(pts, {stroke: c.c2, width: 2});
      // one period, bracketed above the curve
      var yb = Math.min(Y(A) - 12, cy - 34), te = Math.min(k.T, TW);
      api.line([Tx(0), yb], [Tx(te), yb], {color: c.c4, width: 2});
      api.line([Tx(0), yb - 5], [Tx(0), yb + 5], {color: c.c4, width: 2});
      api.line([Tx(te), yb - 5], [Tx(te), yb + 5], {color: c.c4, width: 2});
      var wide = Tx(te) - Tx(0) > 92;
      api.label(wide ? [(Tx(0) + Tx(te)) / 2, yb - 12] : [Tx(te) + 8, yb], "T = " + f(k.T) + " s", {color: c.c4, size: 12.5, weight: 650, anchor: wide ? "middle" : "start"});
      // now: the block's height carried to the curve
      var P = [Tx(v.time), by];
      api.line([sx + bs / 2 + 2, by], P, {color: c.faint, width: 1.2, dash: "4 4"});
      api.line([P[0], yb + 7], [P[0], Y(-0.5) + 6], {color: c.c1, width: 1, opacity: 0.45});   // starts under the T bracket and its label
      // the reading at t on its own line above the graph, where nothing sits behind it (the T bracket stays below y = 36)
      api.label([gx1, 14], "t = " + f(v.time, 2) + " s:  x = " + f(k.x, 3) + " m,  v = " + f(k.vel, 2) + " m/s", {color: c.c1, size: 12.5, weight: 650, anchor: "end"});
      api.handle(P, {color: c.c1, r: 6, onDrag: function (q) {
        api.set({time: Math.round(Math.max(0, Math.min(TW, (q[0] - gx0) / (gx1 - gx0) * TW)) * 100) / 100});
      }});
    }
  });
})();
