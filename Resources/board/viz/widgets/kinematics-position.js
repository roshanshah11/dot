// Delta x = (1/2)(v_i + v_f) t: under constant acceleration the average velocity is the plain average of the start and
// end velocities. On the v-t graph the displacement is the trapezoid under the line; cut the corner triangle off one end
// and it fills the gap at the other (the two amber triangles are congruent, meeting at t/2), leaving a rectangle of
// height v-bar. Below, the proof in motion: an object accelerating and one cruising at v-bar, a dot every second, finish
// level at time t.
(function () {
  function calc(v) {
    var vi = v.initialVelocityMetersPerSecond, a = v.accelerationMetersPerSecondSquared, t = v.timeSeconds, vf = vi + a * t, vb = (vi + vf) / 2;
    var ts = a !== 0 && -vi / a > 0 && -vi / a < t ? -vi / a : null, x = function (s) { return vi * s + 0.5 * a * s * s; };
    return {vi: vi, a: a, t: t, vf: vf, vb: vb, dx: vb * t, ts: ts, x: x, dist: ts == null ? Math.abs(vb * t) : Math.abs(x(ts)) + Math.abs(vb * t - x(ts))};
  }
  function range(lo, hi) {
    if (hi - lo < 4) hi = lo + 4;
    var st = [1, 2, 5, 10, 20].filter(function (s) { return (hi - lo) / s <= 6; })[0] || 20;
    return {lo: Math.floor(lo / st) * st, hi: Math.ceil(hi / st) * st, step: st};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };
  var cur = null, cache = {};                    // label widths, measured in the live SVG (the framework's estimate if not laid out)
  var wid = function (s, size) {
    size = size || 12.5;
    var k = size + "|" + s;
    if (cache[k] == null) {
      var w = 0;
      try { var el = cur.label([0, -40], s, {size: size, weight: 700, clamp: false}); w = el.getBBox().width; el.remove(); } catch (e) {}
      if (!w) return String(s).length * size * 0.56;
      cache[k] = w;
    }
    return cache[k];
  };
  var box = function (x, y, s, anchor) { var w = wid(s), l = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x; return [l - 3, y - 8, l + w + 3, y + 8]; };
  var hit = function (p, r) { return p[0] < r[2] && r[0] < p[2] && p[1] < r[3] && r[1] < p[3]; };
  function cross(a, b, r) {                      // does segment ab touch rectangle r (Liang-Barsky)?
    var dx = b[0] - a[0], dy = b[1] - a[1], t0 = 0, t1 = 1, tests = [[-dx, a[0] - r[0]], [dx, r[2] - a[0]], [-dy, a[1] - r[1]], [dy, r[3] - a[1]]];
    for (var i = 0; i < 4; i++) {
      var p = tests[i][0], qq = tests[i][1];
      if (p === 0) { if (qq < 0) return false; continue; }
      var t = qq / p;
      if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
    return true;
  }

  Viz.register("kinematics-position", {
    title: "Displacement from average velocity",
    subject: "physics",
    shows: "Slide vᵢ, a and t: under constant acceleration the average velocity is the plain average of the start and end velocities, so the trapezoid under the line equals a rectangle v̄·t",
    params: {
      initialVelocityMetersPerSecond: {kind: "number", default: 2, min: -6, max: 10, step: 0.5, label: "v_i\\ (\\text{m/s})"},
      accelerationMetersPerSecondSquared: {kind: "number", default: 1, min: -2, max: 4, step: 0.25, label: "a\\ (\\text{m/s}^2)"},
      timeSeconds: {kind: "number", default: 5, min: 1, max: 9, step: 0.5, label: "t\\ (\\text{s})"}
    },
    formula: function (v) {
      var q = calc(v);
      return "\\begin{aligned}v_f&=v_i+at=" + Viz.n(q.vf, 3) + "\\ \\text{m/s}\\\\\\Delta x&=\\tfrac12(v_i+v_f)\\,t\\\\&=\\tfrac12(" + Viz.n(q.vi) + (q.vf < 0 ? "" : "+") + Viz.n(q.vf, 3) +
        ")\\cdot" + Viz.n(q.t) + "=" + Viz.n(q.dx, 3) + "\\ \\text{m}\\end{aligned}";
    },
    status: function (v) {
      var q = calc(v);
      if (q.a === 0) return "No acceleration, so v̄ = vᵢ = " + f(q.vi) + " m/s and the trapezoid is already a rectangle: <b>Δx = " + f(q.dx) + " m</b>.";
      if (q.ts != null) return "It turns around at t = " + f(q.ts) + " s, yet v̄ = (" + f(q.vi) + " + " + (q.vf < 0 ? "(" + f(q.vf) + ")" : f(q.vf)) + ")/2 = " + f(q.vb) + " m/s still gives the net <b>Δx = " + f(q.dx) + " m</b>; the path length is " + f(q.dist) + " m.";
      return "The average velocity is (" + f(q.vi) + " + " + (q.vf < 0 ? "(" + f(q.vf) + ")" : f(q.vf)) + ")/2 = <b>" + f(q.vb) + " m/s</b>, so in " + f(q.t) + " s it moves <b>Δx = " + f(q.dx) + " m</b>, level with a steady " + f(q.vb) + " m/s.";
    },
    examples: [
      {name: "Minimum supported values", values: {initialVelocityMetersPerSecond: -6, accelerationMetersPerSecondSquared: -2, timeSeconds: 1}},
      {name: "Maximum supported values", values: {initialVelocityMetersPerSecond: 10, accelerationMetersPerSecondSquared: 4, timeSeconds: 9}},
      {name: "braking to a stop", values: {initialVelocityMetersPerSecond: 8, accelerationMetersPerSecondSquared: -2, timeSeconds: 4}},
      {name: "turning around", values: {initialVelocityMetersPerSecond: 6, accelerationMetersPerSecondSquared: -2, timeSeconds: 8}},
      {name: "constant velocity", values: {initialVelocityMetersPerSecond: 3, accelerationMetersPerSecondSquared: 0, timeSeconds: 6}}
    ],
    size: [400, 304],
    draw: function (api, v) {
      cur = api;
      var c = api.color, q = calc(v), x0 = 56, x1 = 372, pT = 22, pB = 172;   // x1 leaves room right of t = 9 s for the end label
      var R = range(Math.min(0, q.vi, q.vf), Math.max(0, q.vi, q.vf));
      var X = function (t) { return x0 + (x1 - x0) * t / 10; }, Y = function (u) { return pB - (pB - pT) * (u - R.lo) / (R.hi - R.lo); };
      for (var u = R.lo; u <= R.hi + 1e-9; u += R.step) {
        api.line([x0, Y(u)], [x1, Y(u)], {color: Math.abs(u) < 1e-9 ? c.axis : c.grid, width: Math.abs(u) < 1e-9 ? 1.4 : 1});
        api.label([x0 - 7, Y(u)], api.fmt(u), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([x0 - 7, pT - 12], "v (m/s)", {color: c.muted, size: 12, anchor: "end"});
      api.line([x0, pT], [x0, pB], {color: c.axis, width: 1.2});
      // time ticks: keep every one the t label does not cover (0 always survives, since t >= 1)
      var tl = "t = " + f(q.t) + " s";
      for (var s = 0; s <= 10; s += 2) {
        var sl = s === 10 ? "10 s" : String(s);
        if (Math.abs(X(s) - X(q.t)) >= (wid(tl) + wid(sl, 12)) / 2 + 5) api.label([X(s), pB + 13], sl, {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([X(q.t), pB + 13], tl, {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      var y0 = Y(0), yi = Y(q.vi), yf = Y(q.vf), yb = Y(q.vb), xt = X(q.t), xm = X(q.t / 2);
      // the area under the line, blue where v > 0 and red where v < 0 (it counts negative)
      if (q.ts == null) api.polygon([[x0, y0], [xt, y0], [xt, yf], [x0, yi]], {fill: q.vi + q.vf >= 0 ? c.c2 : c.c5, fillOpacity: 0.28});
      else {
        var xs = X(q.ts);
        api.polygon([[x0, y0], [xs, y0], [x0, yi]], {fill: q.vi > 0 ? c.c2 : c.c5, fillOpacity: 0.28});
        api.polygon([[xs, y0], [xt, y0], [xt, yf]], {fill: q.vf > 0 ? c.c2 : c.c5, fillOpacity: 0.28});
      }
      // the corner triangle cut off one end fills the gap at the other: both amber, meeting at t/2
      if (q.a !== 0) {
        api.polygon([[x0, yi], [x0, yb], [xm, yb]], {fill: c.c3, fillOpacity: 0.45, stroke: c.c3, width: 1});
        api.polygon([[xm, yb], [xt, yb], [xt, yf]], {fill: c.c3, fillOpacity: 0.45, stroke: c.c3, width: 1});
      }
      api.line([x0, yb], [xt, yb], {color: c.c3, width: 2.2, dash: "6 4"});
      api.line([xt, Math.min(y0, yf, yb)], [xt, pB], {color: c.faint, width: 1, dash: "2 4"});
      api.line([x0, yi], [xt, yf], {color: c.c1, width: 3});
      api.point([x0, yi], {color: c.c1, r: 4.5});
      api.point([xm, yb], {color: c.c3, r: 4.5});
      // the end velocity: right of the end point (units dropped if that is what fits), else left of it, away from the
      // line, with the short "v = ..." form only as a last resort (t near 9 s on a line falling to the floor). v-bar goes
      // at the left on the side away from the line, or, when t is short and the left is crowded, right of the end too.
      // Every spot is checked against the line, the v = 0 axis, the v-bar line, the t marker and the earlier labels.
      var segs = [[[x0, yi], [xt, yf]], [[x0, y0], [x1, y0]], [[x0, yb], [xt, yb]], [[xt, Math.min(y0, yf, yb)], [xt, pB]]], used = [];
      var clear = function (r) {
        return r[0] >= 0 && r[2] <= 401 && r[1] >= pT - 10 && r[3] <= pB + 4 &&
          !segs.some(function (sg) { return cross(sg[0], sg[1], r); }) && !used.some(function (o) { return hit(r, o); });
      };
      var put = function (cands, color, weight) {
        var k = cands.filter(function (k) { return clear(box(k[0], k[1], k[3], k[2])); })[0], ok = !!k;
        k = k || cands[0];
        api.label([k[0], k[1]], k[3], {color: color, size: 12.5, weight: weight, anchor: k[2], clamp: !ok});   // a checked spot is already inside
        used.push(box(k[0], k[1], k[3], k[2]));
        return k;
      };
      var vfl = (q.a === 0 ? "v = " : "final v = ") + f(q.vf) + " m/s", up = q.a > 0 ? -1 : 1, vc = [], vfy = Math.max(pT + 4, Math.min(yf, pB - 10));
      [vfl, vfl.replace(" m/s", ""), "v = " + f(q.vf) + " m/s", "v = " + f(q.vf)].forEach(function (lab, i) {
        if (xt + 6 + wid(lab) < 398) [vfy, vfy - 12, vfy + 12].forEach(function (y) { vc.push([xt + 6, y, "start", lab]); });
        if (i !== 1 && i !== 3) [12, 24, 36].forEach(function (d) { vc.push([xt - 8, yf + up * d, "end", lab], [xt - 8, yf - up * d, "end", lab]); });
      });
      var vk = put(vc, c.c1, 650);
      var vbl = "v̄ = " + f(q.vb) + " m/s", side = q.a >= 0 ? -1 : 1, bc = [];
      if (xt - x0 >= 110 || q.a === 0) bc.push([x0 + 6, yb + (side < 0 ? -11 : 12), "start", vbl], [x0 + 6, yb - (side < 0 ? -12 : 11), "start", vbl]);
      [yb, yb - 16, yb + 16, vk[1] - 16, vk[1] + 16, yb - 32, yb + 32].forEach(function (y) { bc.push([xt + 7, y, "start", vbl]); });
      put(bc, c.c3, 700);
      if (q.a !== 0 && xm - x0 > 34) put([[xm + 9, yb - 12 * side, "start", "t/2"], [xm - 9, yb + 12 * side, "end", "t/2"]], c.c3, 600);
      // ---- the motion: accelerating (teal) and steady at v-bar (amber), a dot every second -------------------------
      var pts = [0, q.dx]; if (q.ts != null) pts.push(q.x(q.ts));
      var lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts); if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
      var TX = function (m) { return 92 + 284 * (m - lo) / (hi - lo); }, ya = 226, yv = 254;
      api.line([84, ya], [384, ya], {color: c.axis, width: 1.1});
      api.line([84, yv], [384, yv], {color: c.axis, width: 1.1});
      api.label([8, ya], "actual", {color: c.c1, size: 12.5, weight: 650});
      api.label([8, yv], "steady v̄", {color: c.c3, size: 12.5, weight: 650});
      api.line([TX(q.dx), ya - 10], [TX(q.dx), yv + 10], {color: c.ink, width: 1.2, dash: "3 3"});
      for (var k = 0; k <= Math.floor(q.t + 1e-9); k++) {
        api.circle([TX(q.x(k)), ya], 3.6, {fill: c.c1, fillOpacity: 0.6});
        api.circle([TX(q.vb * k), yv], 3.6, {fill: c.c3, fillOpacity: 0.6});
      }
      api.point([TX(0), ya], {color: c.ink, r: 4}); api.point([TX(0), yv], {color: c.ink, r: 4});
      api.point([TX(q.dx), ya], {color: c.c1, r: 5.5}); api.point([TX(q.dx), yv], {color: c.c3, r: 5.5});
      var dl = "Δx = " + f(q.dx) + " m", px = TX(q.dx), anc = px > 320 ? "end" : px < 150 ? "start" : "middle";
      api.label([px + (anc === "end" ? 4 : anc === "start" ? -4 : 0), ya - 18], dl, {color: c.ink, size: 13, weight: 700, anchor: anc});
      api.label([234, yv + 30], "dots: position every second; both finish level at t", {color: c.muted, size: 12, anchor: "middle"});
    }
  });
})();
