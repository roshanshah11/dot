// A 1 kg ball dropped from rest at h0 (no air resistance), shown at five heights on the way down. Potential energy
// m g h (blue) turns into kinetic energy (1/2) m v^2 (amber); their sum, the total m g h0 (teal), never changes.
// Bars share one scale (the most the slider allows, m g 10 m), so a higher start visibly means more energy.
// The queue gives only the start height; the five steps are equal fractions of the drop, which play as the fall.
(function () {
  var G = 9.81, M = 1, FR = [0, 0.25, 0.5, 0.75, 1];
  function calc(v) {
    var h0 = v.startHeightMeters, s = v.step || 1, h = h0 * (1 - FR[s - 1]), E = M * G * h0, pe = M * G * h;
    return {h0: h0, s: s, h: h, E: E, pe: pe, ke: E - pe, v: Math.sqrt(2 * G * (h0 - h))};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };

  Viz.register("kinetic-and-potential-energy", {
    title: "Potential energy into kinetic energy",
    subject: "physics",
    shows: "Drop the ball and step down: potential energy mgh drains into kinetic energy ½mv² while their total stays mgh₀",
    params: {
      startHeightMeters: {kind: "number", default: 6, min: 2, max: 10, step: 0.5, label: "h_0\\ (\\text{m})"}
    },
    steps: ["released from rest", "a quarter of the way down", "halfway down", "three quarters down", "just before the ground"],
    stepMs: 1200,
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}PE=mgh=" + M + "\\cdot" + G + "\\cdot" + Viz.n(k.h, 3) + "=" + Viz.n(k.pe) + "\\ \\text{J}\\\\" +
        "KE=\\tfrac12mv^2=\\tfrac12\\cdot" + M + "\\cdot" + Viz.n(k.v) + "^2=" + Viz.n(k.ke) + "\\ \\text{J}\\\\" +
        "E_{\\text{total}}=PE+KE=" + Viz.n(k.E) + "\\ \\text{J}\\end{array}";
    },
    status: function (v) {
      var k = calc(v), tot = "<b>" + f(k.E) + " J</b>";
      if (k.s === 1) return "At rest at " + f(k.h0) + " m, all " + tot + " is potential energy; none is kinetic yet.";
      if (k.s === 5) return "At the ground all " + tot + " is kinetic, so it hits at v = √(2gh₀) = <b>" + f(k.v, 2) + " m/s</b>.";
      return "After falling " + f(k.h0 - k.h, 2) + " m, <b>" + Math.round(FR[k.s - 1] * 100) + "%</b> of the energy has become motion (KE " +
        f(k.ke) + " J, PE " + f(k.pe) + " J); the total is still " + tot + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {startHeightMeters: 2}},
      {name: "Maximum supported values", values: {startHeightMeters: 10}},
      {name: "halfway down", values: {startHeightMeters: 6, step: 3}},
      {name: "at the ground from 10 m", values: {startHeightMeters: 10, step: 5}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      // one vertical scale for both halves: 20 px per metre of height and per 9.81 J (m g x 1 m), so the PE bar is
      // exactly as tall as the ball is high and the total bar reaches the start line
      var c = api.color, k = calc(v), yG = 262, Hpx = 200, Y = function (m) { return yG - Hpx * m / 10; }, bx = 104;
      api.line([36, yG], [150, yG], {color: c.axis, width: 1.5});
      for (var m = 0; m <= 10; m += 2) {
        api.line([30, Y(m)], [36, Y(m)], {color: c.axis, width: 1});
        api.label([26, Y(m)], String(m), {color: c.muted, size: 12, anchor: "end"});
      }
      api.line([36, Y(0)], [36, Y(10)], {color: c.axis, width: 1});
      api.label([10, Y(10) - 18], "height (m)", {color: c.muted, size: 12});
      api.line([40, Y(k.h0)], [388, Y(k.h0)], {color: c.c1, width: 1.2, dash: "5 4", opacity: 0.85});
      api.label([136, Y(k.h0) - 9], "h₀ = " + f(k.h0) + " m", {color: c.c1, size: 12, weight: 650});
      for (var i = 0; i < k.s - 1; i++) api.circle([bx, Y(k.h0 * (1 - FR[i])) - 9], 8, {stroke: c.faint, width: 1.2, dash: "3 3"});
      var B = [bx, Y(k.h) - 9];
      api.line([118, Y(k.h)], [228, Y(k.h)], {color: c.c2, width: 1, dash: "1 4", opacity: 0.9});
      api.circle(B, 9, {fill: c.ink, fillOpacity: 0.9});
      var len = 4.2 * k.v;
      if (len > 2) api.arrow([bx + 20, B[1] - len], [bx + 20, B[1]], {color: c.c3, width: 2.5, halo: false});
      api.label([bx + 28, Math.max(B[1], Y(k.h0) + 7)], "v = " + f(k.v) + " m/s", {color: c.c3, size: 12, weight: 650});
      api.label([bx - 14, B[1]], "h = " + f(k.h), {color: c.c2, size: 12, weight: 650, anchor: "end"});
      // energy bars
      var bw = 44, xs = [254, 310, 366];
      api.line([230, yG], [390, yG], {color: c.axis, width: 1.5});
      api.rect(xs[0] - bw / 2, Y(k.h), bw, yG - Y(k.h), {fill: c.c2, fillOpacity: 0.8, rx: 2});
      api.rect(xs[1] - bw / 2, Y(k.h0 - k.h), bw, yG - Y(k.h0 - k.h), {fill: c.c3, fillOpacity: 0.85, rx: 2});
      api.rect(xs[2] - bw / 2, Y(k.h), bw, yG - Y(k.h), {fill: c.c2, fillOpacity: 0.8, rx: 0});
      api.rect(xs[2] - bw / 2, Y(k.h0), bw, Y(k.h) - Y(k.h0), {fill: c.c3, fillOpacity: 0.85, rx: 0});
      api.rect(xs[2] - bw / 2 - 2, Y(k.h0) - 2, bw + 4, yG - Y(k.h0) + 2, {stroke: c.c1, width: 2, rx: 3});
      api.label([xs[0], Y(k.h) - 10], f(k.pe), {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      api.label([xs[1], Y(k.h0 - k.h) - 10], f(k.ke), {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      api.label([xs[2], Y(k.h0) - 14], f(k.E), {color: c.c1, size: 12.5, weight: 650, anchor: "middle"});
      api.label([xs[0], yG + 14], "PE", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      api.label([xs[1], yG + 14], "KE", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      api.label([xs[2], yG + 14], "total", {color: c.c1, size: 12.5, weight: 650, anchor: "middle"});
      api.label([388, 14], "energy in J, for m = 1 kg", {color: c.muted, size: 12, anchor: "end"});
    }
  });
})();
