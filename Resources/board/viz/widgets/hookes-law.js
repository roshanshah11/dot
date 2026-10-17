// Hooke's law, F = -kx: a block on a frictionless floor tied to a wall by a spring. Pull it out (x > 0) and the spring
// pulls back; push it in (x < 0) and the spring pushes out. The restoring force always points toward x = 0 and grows in
// step with x. Below, the same law as a graph: a straight line through the origin with slope -k, the current (x, F) on
// it, and the shaded triangle under it from 0 to x, which is the energy the spring holds, U = kx^2 / 2.
(function () {
  var XS = 400, EQ = 196, BW = 44;              // px per metre on the floor, the block's left face at x = 0, block width
  function calc(v) { return {k: v.k, x: v.x, F: -v.k * v.x, U: 0.5 * v.k * v.x * v.x}; }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };

  Viz.register("hookes-law", {
    title: "Hooke's law: the spring pulls back",
    subject: "physics",
    shows: "Drag the block or slide k and x: the spring's force always points back toward x = 0 and is k times as big as the stretch",
    params: {
      k: {kind: "number", default: 100, min: 10, max: 200, step: 5, label: "k\\ (\\text{N/m})"},
      x: {kind: "number", default: 0.12, min: -0.3, max: 0.3, step: 0.01, label: "x\\ (\\text{m})"}
    },
    formula: function (v) {
      var q = calc(v);
      return "\\begin{array}{l}F=-kx=-" + Viz.n(q.k) + "\\cdot" + Viz.p(q.x) + "=" + Viz.n(q.F, 2) + "\\ \\text{N}\\\\" +
        "U=\\tfrac12kx^2=\\tfrac12\\cdot" + Viz.n(q.k) + "\\cdot" + Viz.p(q.x) + "^2=" + Viz.n(q.U, 3) + "\\ \\text{J}\\end{array}";
    },
    status: function (v) {
      var q = calc(v);
      if (q.x === 0) return "At <b>x = 0</b> the spring is at its natural length, so it exerts <b>no force</b> and stores no energy.";
      return (q.x > 0 ? "Stretched " : "Compressed ") + f(Math.abs(q.x)) + " m, the spring " + (q.x > 0 ? "pulls" : "pushes") + " the block back toward x = 0 with <b>" +
        f(Math.abs(q.F)) + " N</b> (F = " + f(q.F) + " N) and stores <b>" + f(q.U, 3) + " J</b>.";
    },
    examples: [
      {name: "Minimum supported values", values: {k: 10, x: -0.3}},
      {name: "Maximum supported values", values: {k: 200, x: 0.3}},
      {name: "relaxed spring", values: {k: 100, x: 0}},
      {name: "stiff spring, compressed", values: {k: 150, x: -0.2}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, q = calc(v);
      // ---- the spring and block ---------------------------------------------------------------------------------
      var floor = 104, bx = EQ + q.x * XS, by = floor - 38, wall = 26;
      api.rect(10, 34, wall - 10, floor - 34, {fill: c.muted, fillOpacity: 0.25, rx: 2});
      api.line([wall, 34], [wall, floor], {color: c.muted, width: 2});
      api.line([10, floor], [390, floor], {color: c.axis, width: 1.4});
      // zigzag coil: a fixed number of turns between the wall and the block, so it bunches up or spreads out
      var y0 = floor - 19, x0 = wall, x1 = bx, lead = 8, turns = 12, amp = 10, pts = [[x0, y0], [x0 + lead, y0]];
      var span = x1 - x0 - 2 * lead;
      for (var i = 0; i < turns; i++) pts.push([x0 + lead + span * (i + 0.5) / turns, y0 + (i % 2 ? amp : -amp)]);
      pts.push([x1 - lead, y0], [x1, y0]);
      api.polyline(pts, {stroke: c.c2, width: 1.4 + 2.6 * (q.k - 10) / 190});
      // k sits on the spring when the spring is long enough to hold it, else in the top-left corner
      var kl = "k = " + f(q.k, 0) + " N/m", roomy = bx - wall > kl.length * 7 + 14;
      api.label(roomy ? [(wall + bx) / 2, y0 - amp - 10] : [wall + 2, 18], kl, {color: c.c2, size: 12.5, weight: 650, anchor: roomy ? "middle" : "start"});
      api.rect(bx, by, BW, 38, {fill: c.ink, fillOpacity: 0.16, stroke: c.ink, width: 1.5, rx: 4});
      // equilibrium mark and the displacement x (teal)
      api.line([EQ, 52], [EQ, floor + 22], {color: c.faint, width: 1.2, dash: "4 4"});
      api.label([EQ, floor + 30], "x = 0", {color: c.muted, size: 12, anchor: "middle"});
      if (Math.abs(q.x) >= 0.015) {
        api.arrow([EQ, floor + 14], [bx, floor + 14], {color: c.c1, width: 2.5, halo: false, head: 9});
        api.label([bx + (q.x > 0 ? 8 : -8), floor + 14], "x = " + f(q.x) + " m", {color: c.c1, size: 12.5, weight: 650, anchor: q.x > 0 ? "start" : "end"});
      }
      // the restoring force (red), drawn above the block and pointing back toward x = 0
      var cx = bx + BW / 2, fl = q.F * 2.4;
      if (Math.abs(fl) >= 4) {
        api.arrow([cx, by - 14], [cx + fl, by - 14], {color: c.c5, width: 3, head: 10});
        api.label([cx + fl / 2, by - 30], "F = " + f(q.F) + " N", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      } else api.label([cx, by - 18], "F = 0", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      api.handle([cx, by + 19], {color: c.c1, r: 6, onDrag: function (p) {
        api.set({x: Math.max(-0.3, Math.min(0.3, Math.round((p[0] - BW / 2 - EQ) / XS * 100) / 100))});
      }});
      // ---- the F-x graph ------------------------------------------------------------------------------------------
      // same horizontal scale as the floor, so the point on the line sits right under the block's face
      var gx0 = EQ - 0.3 * XS, gx1 = EQ + 0.3 * XS, gy0 = 160, gy1 = 292, gm = EQ, ym = (gy0 + gy1) / 2;
      var X = function (x) { return gm + x * XS; }, Y = function (F) { return ym - F / 60 * (ym - gy0 - 6); };
      api.line([gx0 - 10, ym], [gx1 + 34, ym], {color: c.axis, width: 1.3, arrow: true});
      api.line([gm, gy1], [gm, gy0 - 6], {color: c.axis, width: 1.3, arrow: true});
      api.label([gx1 + 36, ym + 13], "x (m)", {color: c.muted, size: 12, anchor: "end"});
      api.label([gm + 8, gy0 - 4], "F (N)", {color: c.muted, size: 12});
      // x ticks sit on the side of the axis away from the energy triangle (below on the left, above on the right)
      [-0.3, 0.3].forEach(function (t) { api.label([X(t), ym + (t < 0 ? 13 : -12)], f(t, 1), {color: c.muted, size: 12, anchor: "middle"}); });
      [-60, 60].forEach(function (t) {
        api.line([gm - 3, Y(t)], [gm + 3, Y(t)], {color: c.axis, width: 1});
        api.label([gm - 7, Y(t)], f(t, 0), {color: c.muted, size: 12, anchor: "end"});
      });
      // stored energy: the triangle between the line and the x axis from 0 to x
      if (Math.abs(q.x) > 1e-9) api.polygon([[X(0), Y(0)], [X(q.x), Y(0)], [X(q.x), Y(q.F)]], {fill: c.c6, fillOpacity: 0.28});
      api.line([X(-0.3), Y(0.3 * q.k)], [X(0.3), Y(-0.3 * q.k)], {color: c.c2, width: 2.5});
      api.label([X(-0.3) + 2, Y(0.3 * q.k) - 12], "slope −k", {color: c.c2, size: 12.5, weight: 650});
      var P = [X(q.x), Y(q.F)];
      api.line([P[0], Y(0)], P, {color: c.c5, width: 1.5, dash: "3 3"});
      api.point(P, {color: c.ink, r: 4.5});
      // its label sits in the empty quadrant right across the x axis from the triangle
      if (q.U > 0.004) api.label([X(q.x / 2), ym + (q.x > 0 ? -12 : 12)], "U = " + f(q.U, 2) + " J", {color: c.c6, size: 12, weight: 650, anchor: "middle"});
    }
  });
})();
