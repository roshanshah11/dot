// v_f = v_i + a t on a velocity-time graph. The line starts at v_i and its slope is a, so after t seconds it has
// risen a t: the run t (dashed) and the rise a t (amber arrow) are the formula's two pieces. When v_i and a have
// opposite signs and t is long enough, the line crosses v = 0: the object stops there and then moves the other way.
// The v axis zooms to fit v_i, v_f and 0; the t axis is fixed at 0 to 10 s so dragging t visibly moves the end.
(function () {
  function calc(v) {
    var vi = v.initialVelocityMetersPerSecond, a = v.accelerationMetersPerSecondSquared, t = v.timeSeconds, vf = vi + a * t;
    return {vi: vi, a: a, t: t, dv: a * t, vf: vf, stop: a !== 0 && vi * vf < 0 ? -vi / a : null};
  }
  function range(lo, hi) {
    if (hi - lo < 4) hi = lo + 4;
    var st = [1, 2, 5, 10, 20].filter(function (s) { return (hi - lo) / s <= 6; })[0] || 20;
    return {lo: Math.floor(lo / st) * st, hi: Math.ceil(hi / st) * st, step: st};
  }
  var f3 = function (x) { return Viz.fmt(x, 3); };

  Viz.register("kinematics-velocity", {
    title: "Velocity under constant acceleration",
    subject: "physics",
    shows: "Slide v_i, a and t: the velocity line starts at v_i, climbs by a every second, and after t seconds has gained a·t",
    params: {
      initialVelocityMetersPerSecond: {kind: "number", default: 2, min: -6, max: 10, step: 0.5, label: "v_i\\ (\\text{m/s})"},
      accelerationMetersPerSecondSquared: {kind: "number", default: 1, min: -2, max: 4, step: 0.25, label: "a\\ (\\text{m/s}^2)"},
      timeSeconds: {kind: "number", default: 5, min: 1, max: 9, step: 0.5, label: "t\\ (\\text{s})"}
    },
    formula: function (v) {
      var k = calc(v);
      return "v_f=v_i+at=" + Viz.n(k.vi) + "+" + Viz.p(k.a) + "\\cdot" + Viz.n(k.t) + "=" + Viz.n(k.vf, 3) + "\\ \\text{m/s}";
    },
    status: function (v) {
      var k = calc(v);
      if (k.a === 0) return "No acceleration: the velocity stays <b>" + f3(k.vi) + " m/s</b> the whole " + f3(k.t) + " s.";
      if (k.stop != null) return "It slows to a stop at <b>t = " + f3(k.stop) + " s</b>, then speeds up the other way to <b>" + f3(k.vf) + " m/s</b> at " + f3(k.t) + " s.";
      if (k.vf === 0) return "It loses " + f3(Math.abs(k.a)) + " m/s each second and comes to rest <b>exactly at " + f3(k.t) + " s</b>.";
      if (k.vi === 0) return "From rest it gains " + f3(Math.abs(k.a)) + " m/s each second: <b>" + f3(k.vf) + " m/s</b> after " + f3(k.t) + " s.";
      var faster = k.vi * k.a > 0;
      return (faster ? "Speeding up" : "Slowing down") + ": over " + f3(k.t) + " s, v changes by a·t = <b>" +
        f3(k.dv) + " m/s</b>, ending at <b>" + f3(k.vf) + " m/s</b>.";
    },
    examples: [
      {name: "Minimum supported values", values: {initialVelocityMetersPerSecond: -6, accelerationMetersPerSecondSquared: -2, timeSeconds: 1}},
      {name: "Maximum supported values", values: {initialVelocityMetersPerSecond: 10, accelerationMetersPerSecondSquared: 4, timeSeconds: 9}},
      {name: "braking through zero", values: {initialVelocityMetersPerSecond: 8, accelerationMetersPerSecondSquared: -2, timeSeconds: 7}},
      {name: "no acceleration", values: {initialVelocityMetersPerSecond: 3, accelerationMetersPerSecondSquared: 0, timeSeconds: 6}},
      {name: "from rest", values: {initialVelocityMetersPerSecond: 0, accelerationMetersPerSecondSquared: 2, timeSeconds: 4}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 56, x1 = 384, yT = 18, yB = 244;
      var R = range(Math.min(0, k.vi, k.vf), Math.max(0, k.vi, k.vf));
      var X = function (t) { return x0 + (x1 - x0) * t / 10; };
      var Y = function (u) { return (yB - 30) - (yB - 30 - (yT + 10)) * (u - R.lo) / (R.hi - R.lo); };
      for (var u = R.lo; u <= R.hi + 1e-9; u += R.step) {
        api.line([x0, Y(u)], [x1, Y(u)], {color: Math.abs(u) < 1e-9 ? c.axis : c.grid, width: Math.abs(u) < 1e-9 ? 1.4 : 1});
        api.label([x0 - 7, Y(u)], api.fmt(u), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([x0 + 6, yT - 6], "v (m/s)", {color: c.muted, size: 12});
      api.line([x0, yB], [x1, yB], {color: c.axis, width: 1.2});
      api.line([x0, yT], [x0, yB], {color: c.axis, width: 1.2});
      for (var s = 0; s <= 10; s++) {
        api.line([X(s), yB], [X(s), yB + 4], {color: c.axis, width: 1});
        if (s % 2 === 0 && Math.abs(s - k.t) > 1.3) api.label([X(s), yB + 15], s === 10 ? "10 s" : String(s), {color: c.muted, size: 12, anchor: "middle"});
      }
      // where t sits on the time axis
      var E = [X(k.t), Y(k.vf)], S = [x0, Y(k.vi)];
      api.line([E[0], yB], [E[0], E[1]], {color: c.faint, width: 1, dash: "2 4"});
      api.label([E[0], yB + 15], "t = " + api.fmt(k.t) + " s", {color: c.c1, size: 12.5, weight: 650, anchor: "middle"});
      // run (dashed at v_i) and rise (a t)
      api.line(S, [E[0], S[1]], {color: c.muted, width: 1.5, dash: "5 4"});
      var rise = Math.abs(E[1] - S[1]), atRight = false, atY = 0;
      if (rise > 6) {
        api.arrow([E[0], S[1]], E, {color: c.c3, width: 2.5, halo: false});
        if (rise > 26) {
          var lab = "a·t = " + api.fmt(k.dv, 3) + " m/s", est = lab.length * 12.5 * 0.56, right = E[0] + 9 + est < 396;
          atRight = right; atY = (S[1] + E[1]) / 2;
          api.label([E[0] + (right ? 9 : -9), (S[1] + E[1]) / 2], lab, {color: c.c3, size: 12.5, weight: 650, anchor: right ? "start" : "end"});
        }
      }
      // the velocity line itself
      api.line(S, E, {color: c.c1, width: 3});
      if (k.stop != null) {
        // the label goes where the line leaves room: left of the crossing, else between line and arrow, else past the arrow
        var Z = [X(k.stop), Y(0)], zl = "stops at " + api.fmt(k.stop, 2) + " s", w = zl.length * 12 * 0.56, side = k.a > 0 ? -12 : 13;
        api.point(Z, {color: c.c5, r: 5});
        var at = Z[0] - 8 - w > x0 + 4 ? [Z[0] - 8, Z[1] + side, "end"] : Z[0] + 8 + w < E[0] - 6 ? [Z[0] + 8, Z[1] - side, "start"] :
          [E[0] + 10, [-12, 13, -26, 27].map(function (d) { return Z[1] + d; }).filter(function (y) { return !atRight || Math.abs(y - atY) >= 19; })[0], "start"];
        api.label([at[0], at[1]], zl, {color: c.c5, size: 12, weight: 600, anchor: at[2]});
      }
      var below = k.a > 0;
      api.label([x0 + 8, S[1] + (below ? 14 : -13)], "v_i = " + api.fmt(k.vi) + " m/s", {color: c.c1, size: 12.5, weight: 650});
      var vfl = "final v = " + api.fmt(k.vf, 3) + " m/s";
      if (k.a === 0) api.label([E[0] + (E[0] > 300 ? -12 : 12), E[1] + 14], vfl, {color: c.c1, size: 12.5, weight: 650, anchor: E[0] > 300 ? "end" : "start"});
      else {
        var lft = k.t >= 4;
        api.label([E[0] + (lft ? -10 : 10), E[1] + (k.a > 0 ? -12 : 13)], vfl, {color: c.c1, size: 12.5, weight: 650, anchor: lft ? "end" : "start"});
      }
      // drag the start up and down (v_i) and the end along time (t)
      api.handle(S, {color: c.c1, r: 6, onDrag: function (q) {
        var u = R.lo + (R.hi - R.lo) * ((yB - 30) - q[1]) / (yB - 30 - (yT + 10));
        api.set({initialVelocityMetersPerSecond: Math.max(-6, Math.min(10, Math.round(u * 2) / 2))});
      }});
      api.handle(E, {color: c.c1, r: 6, onDrag: function (q) {
        api.set({timeSeconds: Math.max(1, Math.min(9, Math.round((q[0] - x0) / (x1 - x0) * 20) / 2))});
      }});
    }
  });
})();
