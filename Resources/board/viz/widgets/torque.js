// Torque about a pivot from a force F applied at distance r along a wrench, at angle theta measured counterclockwise
// from the wrench's direction to the force. tau = r F sin(theta), counterclockwise positive, read two equivalent
// ways: r times the perpendicular part of the force (F sin theta), or F times the lever arm (r sin theta, the
// perpendicular distance from the pivot to the force's line of action). The queue entry has no parameter schema;
// these are Dot's: r, F, theta (0 to 360 degrees, so the turn can go either way) and which reading to draw.
// Drag the force's arrowhead to set F and theta. Below the wrench, a strip plots tau(theta) = rF sin theta over a full
// turn (scaled to the strip's height, peak labeled with its value) with the current angle marked on it.
(function () {
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };
  function calc(v) {
    var th = v.thetaDeg * Math.PI / 180, s = Math.abs(Math.sin(th)) < 1e-9 ? 0 : Math.sin(th), co = Math.abs(Math.cos(th)) < 1e-9 ? 0 : Math.cos(th);
    return {th: th, s: s, co: co, tau: v.r * v.F * s, fperp: v.F * s, rperp: v.r * s};
  }

  Viz.register("torque", {
    title: "Torque on a wrench",
    subject: "physics",
    shows: "Change r, F and the angle: only the part of the force perpendicular to the wrench turns it, so τ peaks at 90° and vanishes along the arm",
    params: {
      r: {kind: "number", default: 3, min: 0.5, max: 4, step: 0.1, label: "r\\ (\\text{m})"},
      F: {kind: "number", default: 6, min: 0, max: 10, step: 0.5, label: "F\\ (\\text{N})"},
      thetaDeg: {kind: "number", default: 60, min: 0, max: 360, step: 5, label: "\\theta\\ (^\\circ)"},
      view: {kind: "enum", values: ["force", "arm"], names: {force: "F⊥ = F sin θ", arm: "r⊥ = r sin θ"}, default: "force", label: "\\text{read as}"}
    },
    formula: function (v) {
      var k = calc(v), tail = v.view === "force" ? "=rF_\\perp=" + Viz.n(v.r) + (k.fperp < 0 ? "" : "\\cdot") + Viz.p(k.fperp, 2) : "=r_\\perp F=" + Viz.p(k.rperp, 2) + "\\cdot" + Viz.n(v.F);
      return "\\begin{array}{l}\\tau=rF\\sin\\theta=" + Viz.n(v.r) + "\\cdot" + Viz.n(v.F) + "\\cdot\\sin" + Viz.n(v.thetaDeg, 0) + "^\\circ\\\\" + tail + "=" + Viz.n(k.tau, 2) + "\\,\\text{N}{\\cdot}\\text{m}\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (v.F === 0) return "No force, so <b>no torque</b>: nothing turns the wrench.";
      if (k.s === 0) return "The force points straight " + (k.co > 0 ? "out along" : "back along") + " the wrench (θ = " + f(v.thetaDeg, 0) + "°), so it has no perpendicular part and <b>τ = 0</b>: it only " + (k.co > 0 ? "pulls on" : "pushes into") + " the pivot.";
      var dir = k.tau > 0 ? "counterclockwise" : "clockwise", max = v.r * v.F;
      return "τ = <b>" + f(Math.abs(k.tau)) + " N·m " + dir + "</b>" + (Math.abs(Math.abs(k.s) - 1) < 1e-9 ? ": the force is perpendicular to the wrench, the most this force can do at this r." :
        ", " + Math.round(100 * Math.abs(k.s)) + "% of the " + f(max) + " N·m the same push would give at 90°.");
    },
    examples: [
      {name: "perpendicular: the most", values: {r: 3, F: 6, thetaDeg: 90}},
      {name: "θ = 0°: along the arm, no torque", values: {r: 3, F: 6, thetaDeg: 0}},
      {name: "slanted push, lever-arm view", values: {r: 3.5, F: 8, thetaDeg: 40, view: "arm"}},
      {name: "clockwise", values: {r: 2.5, F: 7, thetaDeg: 240}},
      {name: "short wrench, weak push", values: {r: 0.5, F: 1, thetaDeg: 120}},
      {name: "long wrench, hardest push", values: {r: 4, F: 10, thetaDeg: 300, view: "arm"}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      // Lengths are drawn as 70 + 37 r px and 26 + 7.4 F px so a short wrench or a weak push stays readable; every
      // component and the lever arm are projections of the drawn vectors, so each picture is consistent in itself.
      var c = api.color, k = calc(v), P = [80, 112], L = 70 + 37 * v.r, T = [P[0] + L, P[1]];
      var Fpx = v.F > 0 ? 26 + 7.4 * v.F : 0, dir = [k.co, -k.s], Fend = [T[0] + dir[0] * Fpx, T[1] + dir[1] * Fpx];
      var armView = v.view === "arm";
      // where the force's label and the angle's label go (worked out first so the line of action can skip them): the
      // force label clears the drag handle on the tip, beside a near-vertical force, above a near-horizontal one,
      // otherwise just beyond the tip by its own half-extent; theta sits at the arc's middle, outside a small angle
      // (so it misses the arrow), at 45 degrees for an obtuse one in the force view (clear of the F-perp arrow), and
      // straight above the wrench's end for a reflex one (whose middle points back along it)
      var flab = (!armView && Math.abs(k.co) <= 0.02 ? "F = F⊥ = " : "F = ") + f(v.F) + " N", hw = flab.length * 12.5 * 0.56 / 2;
      var reach = 10 + hw * Math.abs(dir[0]) + 7 * Math.abs(dir[1]);
      var foff = Math.abs(dir[0]) < 0.3 ? [hw + 10, dir[1] * 3] : Math.abs(dir[1]) < 0.3 ? [dir[0] * 8, k.s < 0 ? 16 : -16] : [dir[0] * reach, dir[1] * reach];
      var ra = 17, mid = (v.thetaDeg > 180 ? 90 : v.thetaDeg < 40 ? v.thetaDeg + 20 : v.thetaDeg > 90 && !armView ? 45 : v.thetaDeg / 2) * Math.PI / 180;
      var thAt = [T[0] + (ra + 10) * Math.cos(mid), T[1] - (ra + 10) * Math.sin(mid)];
      var boxes = [[Fend[0] + foff[0], Fend[1] + foff[1], hw + 3, 10]];
      if (v.thetaDeg > 0 && v.thetaDeg < 360) boxes.push([thAt[0], thAt[1], 8, 10]);
      // line of action, clipped to the figure and broken where it would run through either label
      if (v.F > 0) {
        var ts = [], B = [8, 8, 392, 232];
        [[0, B[0]], [0, B[2]], [1, B[1]], [1, B[3]]].forEach(function (e) { if (Math.abs(dir[e[0]]) > 1e-9) ts.push((e[1] - T[e[0]]) / dir[e[0]]); });
        var tIn = ts.filter(function (t) { var q = [T[0] + dir[0] * t, T[1] + dir[1] * t]; return q[0] >= B[0] - 0.01 && q[0] <= B[2] + 0.01 && q[1] >= B[1] - 0.01 && q[1] <= B[3] + 0.01; });
        if (tIn.length >= 2) {
          var slab = function (o, d, a, b) { if (Math.abs(d) < 1e-9) return o >= a && o <= b ? [-1e9, 1e9] : [1, 0]; var u = (a - o) / d, w = (b - o) / d; return [Math.min(u, w), Math.max(u, w)]; };
          var cuts = boxes.map(function (bx) {
            var sx = slab(T[0], dir[0], bx[0] - bx[2], bx[0] + bx[2]), sy = slab(T[1], dir[1], bx[1] - bx[3], bx[1] + bx[3]);
            return [Math.max(sx[0], sy[0]), Math.min(sx[1], sy[1])];
          }).filter(function (cu) { return cu[0] < cu[1]; }).sort(function (a, b) { return a[0] - b[0]; });
          var t0 = Math.min.apply(null, tIn), hi = Math.max.apply(null, tIn);
          cuts.concat([[hi, hi]]).forEach(function (cu) {
            var t1 = Math.min(cu[0], hi);
            if (t1 > t0 + 1) api.line([T[0] + dir[0] * t0, T[1] + dir[1] * t0], [T[0] + dir[0] * t1, T[1] + dir[1] * t1], {color: c.faint, width: 1, dash: "2 5"});
            t0 = Math.max(t0, cu[1]);
          });
        }
      }
      // the wrench and the bolt it turns
      api.line(P, T, {color: c.muted, width: 12});
      api.line(P, T, {color: c.card, width: 6, opacity: 0.35});
      var hex = []; for (var i = 0; i < 6; i++) hex.push([P[0] + 15 * Math.cos(i * Math.PI / 3 + Math.PI / 6), P[1] + 15 * Math.sin(i * Math.PI / 3 + Math.PI / 6)]);
      api.polygon(hex, {fill: c.muted, fillOpacity: 0.9, stroke: c.ink, width: 1.4});
      api.circle(P, 3.5, {fill: c.ink});
      // r goes on the side of the wrench that the force (or the lever arm) leaves free
      var above = armView && v.F > 0 && Math.abs(k.co) > 0.02 ? k.s * k.co > 0 : k.s < 0;
      api.label([(P[0] + T[0]) / 2, P[1] + (above ? -19 : 21)], "r = " + f(v.r) + " m", {color: c.ink, size: 12.5, anchor: "middle"});
      if (v.F > 0 && !armView) {
        // components at the point of application: along the arm (does nothing) and perpendicular (turns it)
        if (Math.abs(k.co) > 0.02) api.line(T, [T[0] + k.co * Fpx, T[1]], {color: c.muted, width: 2, dash: "4 3"});
        if (Math.abs(k.s) > 0.02 && Math.abs(k.co) > 0.02) {
          var tipY = T[1] - k.s * Fpx;
          api.arrow(T, [T[0], tipY], {color: c.c3, width: 2.6, halo: false, dash: "5 3"});
          api.line([T[0] + k.co * Fpx, T[1]], Fend, {color: c.faint, width: 1, dash: "2 3"});
          // the label stays clear of the wrench's bar even when the perpendicular part is short
          var ly = k.s > 0 ? Math.min(tipY + 4, T[1] - (k.co < 0 ? 42 : 14)) : Math.max(tipY - 4, T[1] + 14);
          api.label([T[0] + (k.co > 0 ? -8 : 8), ly], "F⊥ = " + f(Math.abs(k.fperp)) + " N", {color: c.c3, size: 12.5, weight: 650, anchor: k.co > 0 ? "end" : "start"});
          // name the along-arm part where it sticks out past the wrench's end, below it (the side the force leaves free)
          if (k.s > 0 && k.co * Fpx >= 24) api.label([T[0] + k.co * Fpx / 2, T[1] + 14], "F∥ = " + f(v.F * k.co) + " N", {color: c.muted, size: 12, anchor: "middle"});
        }
      } else if (v.F > 0 && Math.abs(k.s) > 0.02) {
        // lever arm: perpendicular from the pivot to the line of action
        var foot = [P[0] + L * k.s * k.s, P[1] + L * k.s * k.co];
        api.line(P, foot, {color: c.c4, width: 2.6, dash: "6 3"});
        var d = [foot[0] - P[0], foot[1] - P[1]], dl = Math.hypot(d[0], d[1]) || 1; d = [d[0] / dl, d[1] / dl];
        if (Math.abs(k.co) > 0.02) {
          var w = [dir[0] * 8, dir[1] * 8];
          api.polyline([[foot[0] - d[0] * 8, foot[1] - d[1] * 8], [foot[0] - d[0] * 8 + w[0], foot[1] - d[1] * 8 + w[1]], [foot[0] + w[0], foot[1] + w[1]]], {stroke: c.c4, width: 1.4});
        }
        var nrm = [-d[1], d[0]]; if (nrm[0] * (T[0] - P[0]) + nrm[1] * (T[1] - P[1]) > 0) nrm = [d[1], -d[0]];
        var lm = [(P[0] + foot[0]) / 2 + nrm[0] * 12, (P[1] + foot[1]) / 2 + nrm[1] * 12];
        api.label(lm, "r⊥ = " + f(Math.abs(k.rperp)) + " m", {color: c.c4, size: 12.5, weight: 650, anchor: Math.abs(nrm[0]) < 0.3 ? "middle" : nrm[0] < 0 ? "end" : "start"});
      }
      // the angle from the wrench's direction to the force
      if (v.F > 0 && v.thetaDeg > 0 && v.thetaDeg < 360) {
        var arc = [], n = Math.max(2, Math.round(v.thetaDeg / 6));
        for (var j = 0; j <= n; j++) { var a = k.th * j / n; arc.push([T[0] + ra * Math.cos(a), T[1] - ra * Math.sin(a)]); }
        api.polyline(arc, {stroke: c.ink, width: 1.3});
        api.label(thAt, "θ", {color: c.ink, size: 13, weight: 650, anchor: "middle"});
      }
      // the force
      if (v.F > 0) api.arrow(T, Fend, {color: c.c1, width: 3.2, label: flab, labelSize: 12.5, labelOffset: foff});
      api.point(T, {color: c.ink, r: 3.5});
      // which way it turns: an arc behind the bolt (nothing else is drawn left of the pivot) and the value
      if (Math.abs(k.tau) > 1e-9) {
        var rr = 30, pts = [];
        for (var q = 0; q <= 24; q++) { var bb = (115 + 130 * q / 24) * Math.PI / 180; pts.push([P[0] + rr * Math.cos(bb), P[1] - rr * Math.sin(bb)]); }
        if (k.tau < 0) pts.reverse();
        api.path("M " + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" L "), {stroke: c.c2, width: 2.6, arrow: true});
      }
      // tau(theta) = rF sin theta over a full turn, counterclockwise up; the curve fills the strip whatever r and F are
      var SX0 = 46, SX1 = 386, ZC = 295, A = 21, rF = v.r * v.F, amp = rF > 0 ? A : 0;
      var SX = function (deg) { return SX0 + (SX1 - SX0) * deg / 360; }, SY = function (deg) { return ZC - amp * Math.sin(deg * Math.PI / 180); };
      api.label([10, 240], "τ = " + f(Math.abs(k.tau)) + " N·m" + (Math.abs(k.tau) > 1e-9 ? (k.tau > 0 ? " counterclockwise" : " clockwise") : ""), {color: c.c2, size: 13, weight: 700});
      api.label([392, ZC - A - 12], "τ(θ) = rF sin θ", {color: c.muted, size: 12, anchor: "end"});
      var curve = []; for (var g = 0; g <= 120; g++) curve.push([SX(3 * g), SY(3 * g)]);
      api.polygon([[SX0, ZC]].concat(curve, [[SX1, ZC]]), {fill: c.c2, fillOpacity: 0.12, stroke: "none"});
      api.line([SX0, ZC], [SX1, ZC], {color: c.axis, width: 1.2});
      api.polyline(curve, {stroke: c.c2, width: 2});
      api.label([SX0 - 5, ZC - 12], "ccw", {color: c.muted, size: 12, anchor: "end"});
      api.label([SX0 - 5, ZC + 12], "cw", {color: c.muted, size: 12, anchor: "end"});
      // the peak and trough, and the three zeros (each zero's label sits on the side the curve leaves free)
      api.label([SX(90), ZC - amp - 12], "rF = " + f(rF) + " N·m at 90°", {color: c.c2, size: 12, weight: 650, anchor: "middle"});
      if (amp > 0) api.label([SX(270), ZC + amp + 10], "−" + f(rF) + " at 270°", {color: c.c2, size: 12, anchor: "middle"});
      [[0, 4, 11, "start"], [180, 4, -11, "start"], [360, -4, -11, "end"]].forEach(function (z) {
        api.circle([SX(z[0]), ZC], 3, {fill: c.card, fillOpacity: 1, stroke: c.ink, width: 1.4});
        api.label([SX(z[0]) + z[1], ZC + z[2]], z[0] + "°", {color: c.muted, size: 12, anchor: z[3]});
      });
      // the current angle: a stem from the axis up (or down) to tau at this theta
      if (Math.abs(SY(v.thetaDeg) - ZC) > 1) api.line([SX(v.thetaDeg), ZC], [SX(v.thetaDeg), SY(v.thetaDeg)], {color: c.c2, width: 2});
      api.circle([SX(v.thetaDeg), SY(v.thetaDeg)], 5, {fill: c.c2, fillOpacity: 1, stroke: c.card, width: 1.5});
      api.handle(Fend, {color: c.c1, r: 6, onDrag: function (q) {
        var dx = q[0] - T[0], dy = T[1] - q[1], F = Math.max(0, Math.min(10, Math.round((Math.hypot(dx, dy) - 26) / 7.4 * 2) / 2));
        var deg = Math.round(((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360 / 5) * 5;
        api.set({F: F, thetaDeg: deg >= 360 ? 0 : deg});
      }});
    }
  });
})();
