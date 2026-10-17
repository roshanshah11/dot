// Delta x = v_i t + a t^2 / 2 as an area. On the velocity-time graph the displacement is the signed area under the
// line, and that area splits into a rectangle v_i x t (where v_i alone would take you) and a triangle (1/2)(a t)(t)
// (what the acceleration adds or takes away). Below, two rows. "motion" is where the object really goes: a dot every
// second, and after a turnaround the return leg runs just under the outbound one. The second row lays the two pieces
// of the sum end to end in the area colours; when the object turns around it gets its own scale, because v_i t can run
// far past anywhere the object goes. The queue's spec for this id carried a chemistry parameter (reactionExample:
// gas-forming / precipitate-forming) that has nothing to do with the formula, so this widget uses the formula's own
// inputs, named and ranged like kinematics-position and kinematics-velocity.
(function () {
  function calc(v) {
    var vi = v.initialVelocityMetersPerSecond, a = v.accelerationMetersPerSecondSquared, t = v.timeSeconds;
    var rect = vi * t, tri = 0.5 * a * t * t, dx = rect + tri, ts = a !== 0 && -vi / a > 0 && -vi / a < t ? -vi / a : null;
    var x = function (s) { return vi * s + 0.5 * a * s * s; };
    return {vi: vi, a: a, t: t, vf: vi + a * t, rect: rect, tri: tri, dx: dx, ts: ts, x: x, dist: ts == null ? Math.abs(dx) : Math.abs(x(ts)) + Math.abs(dx - x(ts))};
  }
  function range(lo, hi) {
    if (hi - lo < 4) hi = lo + 4;
    var st = [1, 2, 5, 10, 20].filter(function (s) { return (hi - lo) / s <= 6; })[0] || 20;
    return {lo: Math.floor(lo / st) * st, hi: Math.ceil(hi / st) * st, step: st};
  }
  function scaler(pts) {                         // a track from x = 96 to 380 that just fits these positions
    var lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts); if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
    return function (m) { return 96 + 284 * (m - lo) / (hi - lo); };
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
  var box = function (x, y, s, anchor, size) { var w = wid(s, size), l = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x; return [l - 3, y - 8, l + w + 3, y + 8]; };
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

  Viz.register("kinematics-displacement-uniform-acceleration", {
    title: "Displacement under constant acceleration",
    subject: "physics",
    shows: "Slide vᵢ, a and t: the area under the velocity line is a rectangle vᵢ·t plus a triangle ½at², and together they are the displacement",
    params: {
      initialVelocityMetersPerSecond: {kind: "number", default: 3, min: -6, max: 10, step: 0.5, label: "v_i\\ (\\text{m/s})"},
      accelerationMetersPerSecondSquared: {kind: "number", default: 1.5, min: -2, max: 4, step: 0.25, label: "a\\ (\\text{m/s}^2)"},
      timeSeconds: {kind: "number", default: 4, min: 1, max: 9, step: 0.5, label: "t\\ (\\text{s})"}
    },
    formula: function (v) {
      var q = calc(v);
      return "\\begin{aligned}\\Delta x&=v_i t+\\tfrac12at^2\\\\&=" + Viz.p(q.vi) + "\\cdot" + Viz.n(q.t) + "+\\tfrac12\\cdot" + Viz.p(q.a) + "\\cdot" + Viz.n(q.t) + "^2\\\\&=" +
        Viz.n(q.rect, 3) + (q.tri < 0 ? "-" : "+") + Viz.n(Math.abs(q.tri), 3) + "=" + Viz.n(q.dx, 3) + "\\ \\text{m}\\end{aligned}";
    },
    status: function (v) {
      var q = calc(v);
      if (q.a === 0) return "No acceleration, so the triangle vanishes: Δx = vᵢ·t = <b>" + f(q.dx) + " m</b>.";
      if (q.vi === 0) return "Starting from rest the rectangle vanishes: all of Δx = ½at² = <b>" + f(q.dx) + " m</b> comes from accelerating.";
      if (q.ts != null) {
        var l1 = q.x(q.ts), l2 = q.dx - l1, way = function (d) { return f(Math.abs(d)) + " m " + (d > 0 ? "forward" : "back"); };
        return "It reverses at <b>t = " + f(q.ts) + " s</b>: " + way(l1) + ", then " + way(l2) + ", so <b>Δx = " + f(q.dx) + " m</b> though it travels " + f(q.dist) + " m.";
      }
      return "vᵢ alone would cover " + f(q.rect) + " m; the acceleration " + (q.tri * q.rect > 0 ? "adds" : "takes away") + " " + f(Math.abs(q.tri)) + " m, so <b>Δx = " + f(q.dx) + " m</b>.";
    },
    examples: [
      {name: "Minimum supported values", values: {initialVelocityMetersPerSecond: -6, accelerationMetersPerSecondSquared: -2, timeSeconds: 1}},
      {name: "Maximum supported values", values: {initialVelocityMetersPerSecond: 10, accelerationMetersPerSecondSquared: 4, timeSeconds: 9}},
      {name: "from rest", values: {initialVelocityMetersPerSecond: 0, accelerationMetersPerSecondSquared: 2, timeSeconds: 5}},
      {name: "braking then reversing", values: {initialVelocityMetersPerSecond: 8, accelerationMetersPerSecondSquared: -2, timeSeconds: 7}},
      {name: "back where it started", values: {initialVelocityMetersPerSecond: -4, accelerationMetersPerSecondSquared: 2, timeSeconds: 4}},
      {name: "no acceleration", values: {initialVelocityMetersPerSecond: 5, accelerationMetersPerSecondSquared: 0, timeSeconds: 6}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      cur = api;
      var c = api.color, q = calc(v), x0 = 56, x1 = 384, pT = 40, pB = 170;
      var R = range(Math.min(0, q.vi, q.vf), Math.max(0, q.vi, q.vf));
      var X = function (t) { return x0 + (x1 - x0) * t / 10; }, Y = function (u) { return pB - (pB - pT) * (u - R.lo) / (R.hi - R.lo); };
      for (var u = R.lo; u <= R.hi + 1e-9; u += R.step) {
        api.line([x0, Y(u)], [x1, Y(u)], {color: Math.abs(u) < 1e-9 ? c.axis : c.grid, width: Math.abs(u) < 1e-9 ? 1.4 : 1});
        api.label([x0 - 7, Y(u)], api.fmt(u), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([x0 - 7, pT - 16], "v (m/s)", {color: c.muted, size: 12, anchor: "end"});
      api.line([x0, pT], [x0, pB], {color: c.axis, width: 1.2});
      // time ticks: keep every one the t label does not cover (0 always survives, since t >= 1)
      var tl = "t = " + f(q.t) + " s";
      for (var s = 0; s <= 10; s += 2) {
        var sl = s === 10 ? "10 s" : String(s);
        if (Math.abs(X(s) - X(q.t)) >= (wid(tl) + wid(sl, 12)) / 2 + 5) api.label([X(s), pB + 14], sl, {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([X(q.t), pB + 14], tl, {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      // the two areas: rectangle 0..v_i (blue) and triangle v_i..v_f (amber)
      var y0 = Y(0), yi = Y(q.vi), yf = Y(q.vf), xt = X(q.t), top = [], inside = [];
      if (q.vi !== 0) api.polygon([[x0, y0], [xt, y0], [xt, yi], [x0, yi]], {fill: c.c2, fillOpacity: 0.32, stroke: c.c2, width: 1.2});
      // when the triangle has the opposite sign it overlaps the rectangle (it is subtracted): dashed, labels go to the top row
      var opp = q.rect * q.tri < 0;
      if (q.a !== 0) api.polygon([[x0, yi], [xt, yi], [xt, yf]], {fill: c.c3, fillOpacity: opp ? 0.3 : 0.38, stroke: c.c3, width: opp ? 1.8 : 1.2, dash: opp ? "5 3" : null});
      api.line([x0, yi], [xt, yf], {color: c.c1, width: 3});
      api.line([xt, Math.min(y0, yf, yi)], [xt, pB], {color: c.faint, width: 1, dash: "2 4"});
      // labels inside the graph stay off the line, the v = 0 axis, the base of the areas and the t marker
      var segs = [[[x0, yi], [xt, yf]], [[x0, y0], [x1, y0]], [[x0, yi], [xt, yi]], [[xt, Math.min(y0, yi, yf)], [xt, pB]]];
      var clear = function (r) {
        return r[0] >= 0 && r[2] <= 401 && r[1] >= 24 && r[3] <= pB + 4 &&
          !segs.some(function (sg) { return cross(sg[0], sg[1], r); }) && !inside.some(function (o) { return hit(r, o); });
      };
      // v_i names the dot at t = 0: beside it on the side away from the line, unless that is crowded (then the top row)
      var vil = "v_i = " + f(q.vi) + " m/s", vy = yi + (q.a > 0 ? 13 : -12), vb = box(x0 + 8, vy, vil, "start"), viOK = q.vi !== q.vf && clear(vb);
      var rl = "v_i·t = " + f(q.rect) + " m", trl = "½at² = " + f(q.tri) + " m";
      if (q.vi !== 0) {
        var rx = (x0 + xt) / 2, ry = (y0 + yi) / 2;
        if (!opp && Math.abs(y0 - yi) >= 20 && xt - x0 >= rl.length * 7 + 8) {
          if (viOK && hit(vb, box(rx, ry, rl, "middle"))) {        // v_i sits inside the rectangle: centre this in what is left
            var b0 = q.vi > 0 ? vb[3] : y0, b1 = q.vi > 0 ? y0 : vb[1];
            if (b1 - b0 >= 16) ry = (b0 + b1) / 2; else viOK = false;
          }
          api.label([rx, ry], rl, {color: c.c2, size: 12.5, weight: 700, anchor: "middle"});
          inside.push(box(rx, ry, rl, "middle"));
        } else top.push([rl, c.c2]);
      }
      if (q.a !== 0) {
        // just inside the triangle along its base, right-aligned to the vertical side, where it is widest
        var h = Math.abs(yf - yi), ty = yi + (yf < yi ? -11 : 11);
        if (!opp && h >= 22 && (xt - x0) * (1 - 18 / h) >= wid(trl) + 10) {
          api.label([xt - 6, ty], trl, {color: c.c3, size: 12.5, weight: 700, anchor: "end"});
          inside.push(box(xt - 6, ty, trl, "end"));
        } else top.push([trl, c.c3]);
      }
      // the end velocity: right of the end point if it fits, else left of it on the side away from the line
      // (the short "v = ..." form only when the full one fits nowhere)
      var vfl = (q.vi === q.vf ? "v = " : "final v = ") + f(q.vf) + " m/s", up = q.a > 0 ? -1 : 1, cands = [];
      [vfl, "v = " + f(q.vf) + " m/s", "v = " + f(q.vf)].forEach(function (s, i) {
        if (xt + 6 + wid(s) < 398) [Math.max(36, Math.min(yf, pB - 10)), yf - 12, yf + 12, yf - 24, yf + 24].forEach(function (y) { cands.push([xt + 6, y, "start", s]); });
        if (i < 2) [12, 24, 36, 48].forEach(function (d) { cands.push([xt - 8, yf + up * d, "end", s], [xt - 8, yf - up * d, "end", s]); });
      });
      var vfc = cands.filter(function (k) { return clear(box(k[0], k[1], k[3], k[2])); })[0], vok = !!vfc;
      vfc = vfc || cands[0];
      api.label([vfc[0], vfc[1]], vfc[3], {color: c.c1, size: 12.5, weight: 650, anchor: vfc[2], clamp: !vok});   // a checked spot is already inside
      inside.push(box(vfc[0], vfc[1], vfc[3], vfc[2]));
      if (q.vi !== q.vf) {
        api.point([x0, yi], {color: c.c1, r: 4.5});
        if (viOK && !inside.some(function (r) { return hit(vb, r); })) api.label([x0 + 8, vy], vil, {color: c.c1, size: 12.5, weight: 700});
        else top.unshift([vil, c.c1]);
      }
      var tx = x0 + 6;
      top.forEach(function (p) { api.label([tx, 14], p[0], {color: p[1], size: 12.5, weight: 700}); tx += p[0].length * 7 + 14; });

      // ---- motion: a dot every second; after a turnaround the return leg runs just under the outbound one ----------
      var ym = 218, yr = 230, yp = 284, turn = q.ts != null, xs = turn ? q.x(q.ts) : 0, yEnd = turn ? yr : ym;
      var M = scaler(turn ? [0, xs, q.dx] : [0, q.rect, q.dx]), Pz = turn ? scaler([0, q.rect, q.dx]) : M;
      api.label([8, turn ? (ym + yr) / 2 : ym], "motion", {color: c.c1, size: 12.5, weight: 650});
      api.line([92, ym], [384, ym], {color: c.axis, width: 1.1});
      var marks = [];
      if (turn) {
        // sign and magnitude formatted apart, so the distance rounds exactly as it does in the status line
        var sx = M(xs), tlab = "turns at " + (xs < 0 ? "−" : "") + f(Math.abs(xs)) + " m, t = " + f(q.ts) + " s";
        var ta = sx > 300 ? "end" : sx < 160 ? "start" : "middle", tpx = sx + (ta === "end" ? 6 : ta === "start" ? -6 : 0);
        api.path("M " + M(0) + " " + ym + " L " + sx + " " + ym + " A 6 6 0 0 " + (xs > 0 ? 1 : 0) + " " + sx + " " + yr + " L " + M(q.dx) + " " + yr, {stroke: c.c1, width: 2, opacity: 0.55});
        api.label([tpx, ym - 14], tlab, {color: c.ink, size: 12.5, weight: 650, anchor: ta});
        marks.push(box(tpx, ym - 14, tlab, ta));
      } else api.line([M(0), ym], [M(q.dx), ym], {color: c.c1, width: 2, opacity: 0.55});
      for (var k = 0; k <= Math.floor(q.t + 1e-9); k++) api.circle([M(q.x(k)), turn && k > q.ts + 1e-9 ? yr : ym], 3.5, {fill: c.c1, fillOpacity: 0.55});
      api.point([M(0), ym], {color: c.ink, r: 4.5});
      api.point([M(q.dx), yEnd], {color: c.c1, r: 6});
      // the displacement label: under the end dot after a turnaround (the turn label has the space above), else above it
      var dl = "Δx = " + f(q.dx) + " m", ex = M(q.dx), da = ex > 300 ? "end" : ex < 140 ? "start" : "middle";
      var dpx = ex + (da === "end" ? 4 : da === "start" ? -4 : 0), dpy = turn ? yr + 15 : ym - 15;
      api.label([dpx, dpy], dl, {color: c.c1, size: 13, weight: 700, anchor: da});
      marks.push(box(dpx, dpy, dl, da, 13));
      var sb = box(M(0), ym - 14, "start", "middle", 12);
      if ((Math.abs(ex - M(0)) > 6 || turn) && !marks.some(function (r) { return hit(sb, r); })) api.label([M(0), ym - 14], "start", {color: c.muted, size: 12, anchor: "middle"});

      // ---- the sum: v_i t (blue) then (1/2) a t^2 (amber) laid end to end, landing on the displacement -------------
      api.label([8, yp], "v_i·t + ½at²", {color: c.ink, size: 12.5, weight: 650});
      api.line([92, yp], [384, yp], {color: c.grid, width: 1});
      var ya = q.rect * q.tri >= 0 ? yp : yp + 12, p0 = Pz(0), pr = Pz(q.rect), pd = Pz(q.dx);
      api.point([p0, yp], {color: c.ink, r: 3.5});
      if (Math.abs(pr - p0) > 6) api.arrow([p0, yp], [pr, yp], {color: c.c2, width: 2.5, halo: false, head: 9});
      if (Math.abs(pd - pr) > 6) api.arrow([pr, ya], [pd, ya], {color: c.c3, width: 2.5, halo: false, head: 9});
      api.point([pd, ya], {color: c.c1, r: 4.5});
      if (q.vi !== 0) api.label([(p0 + pr) / 2, yp - 13], rl, {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      if (q.a !== 0) api.label([(pr + pd) / 2, ya + 15], trl, {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      var right = q.dx >= q.rect && q.a !== 0 || q.a === 0 && q.dx >= 0;
      if (right ? pd + 26 < 396 : pd - 26 > 92) api.label([pd + (right ? 9 : -9), ya], "Δx", {color: c.c1, size: 12.5, weight: 700, anchor: right ? "start" : "end"});
      api.label([200, 330], turn ? "dots every second; the sum row has its own scale" : "dots: position every second", {color: c.muted, size: 12, anchor: "middle"});
    }
  });
})();
