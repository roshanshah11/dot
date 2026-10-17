// A box on a frictionless incline. Gravity mg splits into mg sin(theta) along the slope and mg cos(theta) into it; the
// normal force cancels the second, so the net force is mg sin(theta) down the slope and a = F / m = g sin(theta).
// The mass cancels: a heavier box gets a bigger box and longer force arrows (2.4 px per newton), but the teal
// acceleration arrow sliding behind it (10 px per m/s^2) keeps the same length.
(function () {
  var G = 9.81, FS = 2.4, AS = 10;                 // px per newton, px per m/s^2
  function calc(v) {
    var th = v.planeAngleDegrees * Math.PI / 180, m = v.boxMassKilograms;
    return {deg: v.planeAngleDegrees, th: th, m: m, W: m * G, par: m * G * Math.sin(th), perp: m * G * Math.cos(th), a: G * Math.sin(th)};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };

  // Label placement: each label tries its candidate spots in order and takes the first whose box clears every
  // stroke drawn so far and every earlier label (box width estimated like the framework's own clamp).
  function placer(api) {
    var segs = [], boxes = [];
    function cross(a, b, r) {                    // does segment ab touch rectangle r (Liang-Barsky)?
      var dx = b[0] - a[0], dy = b[1] - a[1], t0 = 0, t1 = 1;
      var tests = [[-dx, a[0] - r[0]], [dx, r[2] - a[0]], [-dy, a[1] - r[1]], [dy, r[3] - a[1]]];
      for (var i = 0; i < 4; i++) {
        var p = tests[i][0], qq = tests[i][1];
        if (p === 0) { if (qq < 0) return false; continue; }
        var t = qq / p;
        if (p < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
        if (t0 > t1) return false;
      }
      return true;
    }
    function cost(r) {
      var k = (r[0] < 2 || r[1] < 2 || r[2] > api.w - 2 || r[3] > api.h - 2) ? 100 : 0;
      segs.forEach(function (s) { if (cross(s[0], s[1], r)) k += 10; });
      boxes.forEach(function (b) { if (b[0] - 8 < r[2] && r[0] < b[2] + 8 && b[1] < r[3] && r[1] < b[3]) k += 10; });   // labels keep 8 px apart side to side
      return k;
    }
    return {
      seg: function (a, b) { segs.push([a, b]); },
      path: function (pts) { for (var i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]); },
      label: function (text, cands, o) {
        var size = o.size || 12.5, h = size * 1.15, best = null, w = 0;
        try { var t = api.label([0, -40], text, {size: size, weight: 650, clamp: false}); w = t.getBBox().width; t.remove(); } catch (e) {}
        if (!w) w = String(text).length * size * 0.56;      // not laid out (hidden): fall back to the framework's estimate
        for (var i = 0; i < cands.length; i++) {
          var p = cands[i][0], an = cands[i][1], x0 = an === "end" ? p[0] - w : an === "middle" ? p[0] - w / 2 : p[0];
          var r = [x0 - 3, p[1] - h / 2 - 2, x0 + w + 3, p[1] + h / 2 + 2], k = cost(r);
          if (!best || k < best.k) best = {k: k, p: p, an: an, r: r};
          if (k === 0) break;
        }
        boxes.push(best.r);
        api.label(best.p, text, Object.assign({size: size, weight: 650}, o, {anchor: best.an}));
      }
    };
  }

  Viz.register("inclined-plane-acceleration", {
    title: "Sliding down a frictionless incline",
    subject: "physics",
    shows: "Tilt the slope or change the mass: the pull down the slope is mg sin θ, so the acceleration is g sin θ and the mass cancels out",
    params: {
      planeAngleDegrees: {kind: "number", default: 30, min: 15, max: 45, step: 1, label: "\\theta\\ (^\\circ)"},
      boxMassKilograms: {kind: "number", default: 4, min: 2, max: 6, step: 0.5, label: "m\\ (\\text{kg})"}
    },
    formula: function (v) {
      var q = calc(v);
      // the mass cancels: shown struck through with his numbers
      return "\\begin{array}{l}a=\\dfrac{F_\\parallel}{m}=\\dfrac{mg\\sin\\theta}{m}=\\dfrac{\\cancel{" + Viz.n(q.m) + "}\\cdot9.81\\cdot\\sin" + Viz.n(q.deg) + "^\\circ}{\\cancel{" + Viz.n(q.m) + "}}\\\\[4pt]" +
        "\\quad=g\\sin\\theta=9.81\\cdot" + Viz.n(Math.sin(q.th), 3) + "=" + Viz.n(q.a, 2) + "\\ \\text{m/s}^2\\end{array}";
    },
    status: function (v) {
      var q = calc(v);
      return "On a " + f(q.deg, 0) + "° slope the " + f(q.m, 1) + " kg box is pulled " + f(q.par, 1) + " N down the slope, and " + f(q.par, 1) + " N ÷ " + f(q.m, 1) +
        " kg gives <b>a = " + f(q.a) + " m/s²</b>: " + Math.round(Math.sin(q.th) * 100) + "% of g, the same for <b>any mass</b>.";
    },
    examples: [
      {name: "Minimum supported values", values: {planeAngleDegrees: 15, boxMassKilograms: 2}},
      {name: "Maximum supported values", values: {planeAngleDegrees: 45, boxMassKilograms: 6}},
      {name: "same slope, light box", values: {planeAngleDegrees: 30, boxMassKilograms: 2}},
      {name: "same slope, heavy box", values: {planeAngleDegrees: 30, boxMassKilograms: 6}}
    ],
    size: [400, 330],
    draw: function (api, v) {
      var c = api.color, q = calc(v), cs = Math.cos(q.th), sn = Math.sin(q.th), P = placer(api);
      var d = [cs, sn], nr = [sn, -cs];          // down-slope direction and the outward normal, in screen coordinates
      var at = function (p, u, s) { return [p[0] + u[0] * s, p[1] + u[1] * s]; };
      var mid = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
      // the slope pivots about the box's resting spot; its foot sits on the ground at the right or the bottom
      var Pb = [175, 185], T = at(Pb, d, -160), V = at(Pb, d, Math.min((390 - Pb[0]) / cs, (300 - Pb[1]) / sn)), gy = V[1];
      // wedge and ground as one solid, only its outline stroked, so mg can point down into it
      api.polygon([[0, gy], [T[0], gy], T, V, [api.w, gy], [api.w, api.h], [0, api.h]], {fill: c.muted, fillOpacity: 0.12});
      var outline = [[0, gy], [T[0], gy], T, V, [api.w, gy]];
      api.polyline(outline, {stroke: c.muted, width: 1.5});
      P.path(outline);
      // the angle at the foot of the slope, against a dashed horizontal
      var ar = 40, A1 = [V[0] - ar, gy], A2 = at(V, d, -ar);
      api.line(V, [V[0] - 84, gy], {color: c.faint, width: 1.2, dash: "4 4"});
      api.path("M " + A1[0] + " " + A1[1] + " A " + ar + " " + ar + " 0 0 1 " + A2[0] + " " + A2[1], {stroke: c.ink, width: 1.5});
      P.seg(A1, A2);
      var rl = Math.max(ar + 8, 19 / Math.tan(q.th) + 2);
      P.label("θ = " + f(q.deg, 0) + "°", [[[V[0] - rl, gy - 8], "end"]], {color: c.ink});
      // the box: its side grows with the mass
      var s = 14 + 4.5 * q.m, B0 = at(Pb, d, -s / 2), B1 = at(Pb, d, s / 2), B2 = at(B1, nr, s), B3 = at(B0, nr, s), C = at(Pb, nr, s / 2);
      api.polygon([B0, B1, B2, B3], {fill: c.ink, fillOpacity: 0.08, stroke: c.ink, width: 1.5});
      P.path([B0, B1, B2, B3, B0, B2]); P.seg(B1, B3);
      // the acceleration, sliding along the slope behind the box: g sin(theta) long, whatever the mass
      var head = at(at(Pb, d, -29), nr, 10), tail = at(head, d, -q.a * AS);
      api.arrow(tail, head, {color: c.c1, width: 3});
      P.seg(tail, head);
      // gravity, its component into the slope (dashed), the normal force, and the component along the slope
      var Wt = [C[0], C[1] + q.W * FS], Pt = at(C, d, q.par * FS), Kt = at(C, nr, -q.perp * FS), Nt = at(C, nr, q.perp * FS);
      api.arrow(C, Kt, {color: c.muted, width: 2, halo: false, dash: "6 4", head: 9});
      api.arrow(C, Wt, {color: c.c5, width: 2.8});
      api.arrow(C, Nt, {color: c.c2, width: 2.8});
      api.arrow(C, Pt, {color: c.c3, width: 2.8, head: Math.min(11, 5 + q.par * FS * 0.3)});
      [Kt, Wt, Nt, Pt].forEach(function (p) { P.seg(C, p); });
      // labels, most important first; mg sin(theta) sits past its tip, out along the normal, away from the dashed parts
      P.label("mg sin θ = " + f(q.par, 1) + " N", [[at(Pt, nr, 21), "start"], [at(at(Pt, nr, 21), d, 8), "start"], [at(Pt, nr, 30), "start"]], {color: c.c3});
      P.label("N = mg cos θ = " + f(q.perp, 1) + " N", [[at(Nt, nr, 14), "middle"], [at(Nt, nr, 24), "middle"], [[Nt[0] + 8, Nt[1] - 4], "start"],
        [[Nt[0] - 8, Nt[1] - 4], "end"], [[Nt[0] + 8, Nt[1] + 8], "start"]], {color: c.c2});
      // spots around a point: right, below, left, then the diagonals, at growing distances
      var ring = function (p, rs) {
        var out = [];
        rs.forEach(function (r) { out.push([[p[0] + r, p[1] - 3], "start"], [[p[0], p[1] + r + 6], "middle"], [[p[0] - r, p[1] - 3], "end"],
          [[p[0] + r, p[1] + r], "start"], [[p[0] - r, p[1] + r], "end"], [[p[0] - r, p[1] - r], "end"], [[p[0] + r, p[1] - r], "start"]); });
        return out;
      };
      var K = function (u, dt) { return at(at(C, nr, -q.perp * FS * u), d, dt); };
      P.label("mg cos θ", [[[Kt[0] - 6, Kt[1] + 4], "end"], [K(0.65, -8), "end"], [K(0.8, -8), "end"], [K(0.5, -8), "end"]].concat(ring(Kt, [8, 16, 26, 36])), {color: c.muted});
      P.label("mg = " + f(q.W, 1) + " N", ring(Wt, [8, 16, 26]), {color: c.c5});
      P.label(f(q.m, 1) + " kg", [[at(B0, nr, -13), "end"], [[B3[0] - 4, B3[1] - 8], "end"], [[B2[0] + 6, B2[1] - 8], "start"], [at(B0, nr, -25), "end"],
        [[B3[0] - 4, B3[1] - 18], "end"]], {color: c.ink});
      var am = mid(tail, head), tc = [];
      [21, 28, 36, 44, 52, 60].forEach(function (k) { [0, -16, 16, -32, -48].forEach(function (dt) { tc.push([at(at(am, nr, k), d, dt), "middle"]); }); });
      P.label("a = " + f(q.a) + " m/s²", tc, {color: c.c1, size: 13});
      // drag the top of the slope to change the angle
      api.handle(T, {color: c.ink, r: 6, onDrag: function (p) {
        var deg = Math.atan2(Pb[1] - p[1], Pb[0] - p[0]) * 180 / Math.PI;
        api.set({planeAngleDegrees: Math.max(15, Math.min(45, Math.round(deg)))});
      }});
    }
  });
})();
