// Work W = F d cos(theta). Top: a block slides d metres along the floor while a constant force F pulls on it at angle
// theta above the direction of motion. The force splits into F cos(theta) along the motion (amber, the only part that
// does work) and F sin(theta) across it (dashed, does none). Bottom: F cos(theta) plotted against position over the
// same d, drawn to the same horizontal scale as the slide above, so the work is the area of the amber rectangle:
// above the axis (positive work) when theta < 90 degrees, zero at 90, below (negative work) past 90.
(function () {
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };
  function calc(v) { var th = v.angle * Math.PI / 180, cs = Math.abs(v.angle - 90) < 1e-9 ? 0 : Math.cos(th); return {th: th, cs: cs, sn: Math.sin(th), Fp: v.force * cs, W: v.force * v.displacement * cs}; }
  function tint(api) { api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; }); }   // viz.css paints text ink

  Viz.register("work-done-by-force", {
    title: "Work done by a force at an angle",
    subject: "physics",
    shows: "Tilt the force, change its size and the distance: only the part of F along the motion does work, so W = F d cos θ shrinks to 0 at 90° and turns negative past it",
    params: {
      force: {kind: "number", default: 6, min: 1, max: 10, step: 0.1, label: "F\\ (\\mathrm{N})"},
      displacement: {kind: "number", default: 4, min: 1, max: 8, step: 0.1, label: "d\\ (\\mathrm{m})"},
      angle: {kind: "number", default: 35, min: 0, max: 180, step: 1, label: "\\theta\\ (^\\circ)"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}W=Fd\\cos\\theta=(F\\cos\\theta)\\,d\\\\[3pt]\\phantom{W}=" + Viz.n(v.force, 2) + "\\cdot" + Viz.n(v.displacement, 2) + "\\cdot\\cos" + Viz.n(v.angle, 1) +
        "^\\circ=" + Viz.n(k.W, 2) + "\\ \\mathrm{J}\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (k.cs === 0) return "<b>W = 0</b>: the force is perpendicular to the motion, so no part of it acts along the path.";
      if (k.cs > 0) return "The force's component along the motion is F cos θ = " + f(k.Fp) + " N, so over " + f(v.displacement) + " m it does <b>" + f(k.W) + " J</b> of positive work" +
        (v.angle === 0 ? ", all of F pulling straight along." : "; the sideways part F sin θ does none.");
      return "Its component along the motion points backward (F cos θ = " + f(k.Fp) + " N), so it does <b>" + f(k.W) + " J</b>: negative work that takes energy out, like friction or braking.";
    },
    examples: [
      {name: "Minimum supported values", values: {force: 1, displacement: 1, angle: 0}},
      {name: "Maximum supported values", values: {force: 10, displacement: 8, angle: 180}},
      {name: "perpendicular: no work", values: {angle: 90}},
      {name: "obtuse: negative work", values: {force: 8, displacement: 6, angle: 130}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, k = calc(v), F = v.force, d = v.displacement;
      // scene: the block starts at xs and ends d metres later; 31 px per metre, the same scale as the graph below
      var xs = 130, ppm = 31, floor = 136, bw = 34, bh = 28, xe = xs + d * ppm, cy = floor - bh / 2;
      api.line([16, floor], [390, floor], {color: c.axis, width: 1.5});
      api.rect(xe - bw / 2, floor - bh, bw, bh, {fill: "none", stroke: c.muted, dash: "4 3", rx: 3, opacity: 0.7});
      api.rect(xs - bw / 2, floor - bh, bw, bh, {fill: c.c2, fillOpacity: 0.3, stroke: c.c2, rx: 3});
      api.arrow([xs, floor + 30], [xe, floor + 30], {color: c.c2, width: 2.5, halo: false});
      api.label([(xs + xe) / 2, floor + 44], "d = " + f(d) + " m", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      // the force at the block (10 px per newton), its two components, the angle
      var Lf = 10 * F, ux = Math.cos(k.th), uy = Math.sin(k.th), tip = [xs + Lf * ux, cy - Lf * uy], par = [xs + Lf * k.cs, cy];
      // when F lies almost along the floor its component would hide under it: draw that one a few px lower
      if (Math.abs(k.cs) > 1e-9) api.arrow([xs, cy + (uy < 0.1 ? 8 : 0)], [par[0], cy + (uy < 0.1 ? 8 : 0)], {color: c.c3, width: 3.5, halo: false});
      if (uy > 0.02 && Math.abs(k.cs) > 1e-9) api.line(par, tip, {color: c.muted, width: 1.5, dash: "4 3"});
      api.arrow([xs, cy], tip, {color: c.c5, width: 3});
      var flat = Math.abs(ux) > 0.9;   // nearly along the floor: name F above its middle instead of past its tip
      if (flat) api.label([(xs + tip[0]) / 2, floor - bh - 10], "F = " + f(F) + " N", {color: c.c5, size: 13, weight: 700, anchor: "middle"});
      else api.label([tip[0] + 10 * ux, tip[1] - 10 * uy - 4], "F = " + f(F) + " N", {color: c.c5, size: 13, weight: 700, anchor: ux > 0.3 ? "start" : ux < -0.3 ? "end" : "middle"});
      if (Math.abs(k.cs) > 1e-9) api.label([par[0], floor + 13], "F cos θ = " + f(k.Fp) + " N", {color: c.c3, size: 12.5, weight: 650, anchor: k.cs > 0 ? "start" : "end"});
      if (uy > 0.3 && Math.abs(k.cs) > 0.15) api.label([par[0] + (ux > 0 ? 6 : -6), (cy + tip[1]) / 2], "F sin θ", {color: c.muted, size: 12, anchor: ux > 0 ? "start" : "end"});
      if (v.angle > 0.5) {
        var ar = 24, n = Math.max(2, Math.round(v.angle / 6)), pts = [];
        for (var i = 0; i <= n; i++) { var a = k.th * i / n; pts.push([xs + ar * Math.cos(a), cy - ar * Math.sin(a)]); }
        api.polyline(pts, {stroke: c.ink, width: 1.4});
        var mid = k.th / 2;
        api.label([xs + (ar + 9) * Math.cos(mid), cy - (ar + 9) * Math.sin(mid)], "θ", {color: c.ink, size: 13, anchor: "middle", italic: true});
      }
      // graph: F cos(theta) against position; the work is the signed area over the displacement
      var base = 258, sy = 5.5, gx0 = xs, gx1 = xs + 8 * ppm, Yg = function (q) { return base - sy * q; };
      api.line([gx0, Yg(10)], [gx0, Yg(-10)], {color: c.axis, width: 1.2});
      api.line([gx0, base], [gx1 + 8, base], {color: c.axis, width: 1.2});
      [-10, 10].forEach(function (q) { api.line([gx0, Yg(q)], [gx1, Yg(q)], {color: c.grid, width: 1}); api.label([gx0 - 6, Yg(q)], api.fmt(q), {color: c.muted, size: 12, anchor: "end"}); });
      api.label([gx0 - 6, base], "0", {color: c.muted, size: 12, anchor: "end"});
      api.label([16, Yg(10)], "F cos θ (N)", {color: c.c3, size: 12.5, weight: 650});
      api.label([16, Yg(10) + 16], "against x", {color: c.muted, size: 12});
      var below = k.Fp < -1e-9;
      for (var m = 2; m <= 8; m += 2) api.label([gx0 + m * ppm, base + (below ? -12 : 13)], m === 8 ? "8 m" : String(m), {color: c.muted, size: 12, anchor: "middle"});
      if (Math.abs(k.Fp) > 1e-9) {
        api.rect(gx0, Math.min(Yg(k.Fp), base), d * ppm, Math.abs(Yg(k.Fp) - base), {fill: c.c3, fillOpacity: 0.3, stroke: c.c3, width: 1.5, rx: 0});
        // the W label goes inside only when the rectangle is at least 24 px tall and wide enough; otherwise beside it
        // on the right, or centred just outside its edge when the right has no room
        var wl = "W = " + f(k.W) + " J", tall = Math.abs(Yg(k.Fp) - base) >= 24, wide = d * ppm > 96, room = gx0 + d * ppm + 8 + wl.length * 13 * 0.56 <= 396;
        if (tall && wide) api.label([gx0 + d * ppm / 2, (Yg(k.Fp) + base) / 2], wl, {color: c.c3, size: 13, weight: 700, anchor: "middle"});
        else if (room) api.label([gx0 + d * ppm + 8, Yg(k.Fp) + (below ? 9 : -9)], wl, {color: c.c3, size: 13, weight: 700});
        else api.label([gx0 + d * ppm / 2, Yg(k.Fp) + (below ? 10 : -10)], wl, {color: c.c3, size: 13, weight: 700, anchor: "middle"});
      } else {
        api.line([gx0, base], [gx0 + d * ppm, base], {color: c.c3, width: 3});
        api.label([gx0 + d * ppm / 2, base - 14], "W = 0 J: no area", {color: c.c3, size: 13, weight: 700, anchor: "middle"});
      }
      tint(api);
    }
  });
})();
