// Is this subset of R2 a subspace? Three tests: it holds 0, sums of its vectors stay in it, multiples stay in it.
// Pick a candidate set, turn it by theta and shift it up by s; u and w are dragged along the set, c scales u.
// The checklist tests these u, w, c; the verdict comes from testing a whole grid of members, so it is about the set.
// (R2 only: every failure mode the R3 versions show already appears here, and the plane keeps the picture exact.)
(function () {
  var D = Math.PI / 180, TOL = 1e-7;
  var BASE = {line: "\\{y=0\\}", quadrant: "\\{x\\ge0,\\ y\\ge0\\}", axes: "\\{xy=0\\}", disk: "\\{x^2+y^2\\le4\\}", parabola: "\\{y=x^2/2\\}"};
  function shape(v) {
    var t = v.theta * D, cs = Math.cos(t), sn = Math.sin(t), s = [0, v.shift];
    var toL = function (p) { var x = p[0] - s[0], y = p[1] - s[1]; return [cs * x + sn * y, -sn * x + cs * y]; };
    var toW = function (l) { return [s[0] + cs * l[0] - sn * l[1], s[1] + sn * l[0] + cs * l[1]]; };
    var inL = {
      line: function (l) { return Math.abs(l[1]) < TOL; },
      quadrant: function (l) { return l[0] > -TOL && l[1] > -TOL; },
      axes: function (l) { return Math.abs(l[0]) < TOL || Math.abs(l[1]) < TOL; },
      disk: function (l) { return l[0] * l[0] + l[1] * l[1] <= 4 + TOL; },
      parabola: function (l) { return Math.abs(l[1] - l[0] * l[0] / 2) < TOL; }
    }[v.set];
    var snapL = {
      line: function (l) { return [l[0], 0]; },
      quadrant: function (l) { return [Math.max(0, l[0]), Math.max(0, l[1])]; },
      axes: function (l) { return Math.abs(l[0]) < Math.abs(l[1]) ? [0, l[1]] : [l[0], 0]; },
      disk: function (l) { var r = Math.hypot(l[0], l[1]); return r > 2 ? [2 * l[0] / r, 2 * l[1] / r] : l; },
      parabola: function (l) { var x = Math.max(-2.4, Math.min(2.4, l[0])); return [x, x * x / 2]; }
    }[v.set];
    return {toL: toL, toW: toW, s: s, d1: [cs, sn], d2: [-sn, cs], has: function (p) { return inL(toL(p)); }, snap: function (p) { return toW(snapL(toL(p))); }};
  }
  // which tests fail anywhere: members from a grid, all their pairwise sums, and a few scalars
  function verdict(v, S) {
    var pts = [], fail = {zero: !S.has([0, 0]), sum: false, scal: false};
    for (var x = -3; x <= 3; x++) for (var y = -3; y <= 3; y++) pts.push(S.snap([x, y]));
    for (var i = 0; i < pts.length; i++) {
      [-1, 2, 0.5, -2].forEach(function (k) { if (!S.has([k * pts[i][0], k * pts[i][1]])) fail.scal = true; });
      for (var j = i; j < pts.length && !fail.sum; j++) if (!S.has([pts[i][0] + pts[j][0], pts[i][1] + pts[j][1]])) fail.sum = true;
    }
    return fail;
  }
  function nearest(v, S, pt) { // the member of S closest to pt, and how far it is
    var l = S.toL(pt), q;
    if (v.set === "line") q = [l[0], 0];
    else if (v.set === "quadrant") q = [Math.max(0, l[0]), Math.max(0, l[1])];
    else if (v.set === "axes") q = Math.abs(l[0]) < Math.abs(l[1]) ? [0, l[1]] : [l[0], 0];
    else if (v.set === "disk") { var r = Math.hypot(l[0], l[1]); q = r > 2 ? [2 * l[0] / r, 2 * l[1] / r] : l; }
    else { var bt = 0, bd = Infinity; for (var t = -6; t <= 6; t += 0.001) { var d = Math.hypot(t - l[0], t * t / 2 - l[1]); if (d < bd) { bd = d; bt = t; } } q = [bt, bt * bt / 2]; }
    return {at: S.toW(q), gap: Math.hypot(q[0] - l[0], q[1] - l[1])};
  }
  function picks(v, S) {
    var u = S.snap([v.ux, v.uy]), w = S.snap([v.wx, v.wy]), sum = [u[0] + w[0], u[1] + w[1]], cu = [v.c * u[0], v.c * u[1]];
    return {u: u, w: w, sum: sum, cu: cu, zero: S.has([0, 0]), sumIn: S.has(sum), cuIn: S.has(cu)};
  }

  Viz.register("subspace-test", {
    title: "Subspace test",
    subject: "linear-algebra",
    shows: "Is a subset of R2 a subspace: check it holds the zero vector and is closed under addition and scalar multiplication",
    params: {
      set: {kind: "enum", values: ["line", "quadrant", "axes", "disk", "parabola"], default: "line", label: "set", names: {axes: "both axes"}},
      theta: {kind: "number", default: 30, min: -90, max: 90, step: 5, label: "\\theta^\\circ"},
      shift: {kind: "number", default: 1, min: -2, max: 2, step: 0.25, label: "\\text{shift}"},
      c: {kind: "number", default: 2, min: -2, max: 2, step: 0.25, label: "c"},
      ux: {kind: "number", default: 2, min: -3, max: 3, control: false}, uy: {kind: "number", default: 2.5, min: -3, max: 3, control: false},
      wx: {kind: "number", default: -2, min: -3, max: 3, control: false}, wy: {kind: "number", default: 0.5, min: -3, max: 3, control: false}
    },
    formula: function (v) {
      var rot = Math.abs(v.theta) > 1e-9 && v.set !== "disk" ? "R_{" + Viz.n(v.theta) + "^\\circ}" : "", sh = Math.abs(v.shift) > 1e-9 ? "+\\begin{pmatrix}0\\\\" + Viz.n(v.shift) + "\\end{pmatrix}" : "";
      return "S=" + rot + BASE[v.set] + sh;
    },
    // names each failing test with its evidence: how far S misses 0, and how far this u + w and cu land off S
    status: function (v) {
      var S = shape(v), f = verdict(v, S), k = picks(v, S), cu = Viz.fmt(v.c) + "u", parts = [];
      var by = function (p) { return "<b>" + Viz.fmt(nearest(v, S, p).gap) + "</b>"; };
      f.sum = f.sum || !k.sumIn; f.scal = f.scal || !k.cuIn;
      if (!f.zero && !f.sum && !f.scal) return "<b>A subspace</b>: S is a line through 0, so it holds 0 and every sum and multiple of its vectors stays on it.";
      if (f.zero) parts.push("S misses 0 by " + by([0, 0]));
      if (f.sum) parts.push(k.sumIn ? "sums can leave S, though this u + w stays in" : "sums leave S (u + w lands " + by(k.sum) + " off it)");
      if (f.scal) parts.push(k.cuIn ? "multiples can leave S, though this " + cu + " stays in" : "multiples leave S (" + cu + " lands " + by(k.cu) + " off it)");
      return "<b>Not a subspace</b>: " + parts.join("; ") + ".";
    },
    examples: [
      {name: "line through 0", values: {set: "line", shift: 0}},
      {name: "quadrant: fails for c < 0", values: {set: "quadrant", theta: 0, shift: 0, c: -1, ux: 2, uy: 1, wx: 1, wy: 2}},
      {name: "both axes: sums leave", values: {set: "axes", theta: 0, shift: 0, c: 1.5, ux: 2, uy: 0, wx: 0, wy: 2}},
      {name: "disk: multiples leave", values: {set: "disk", shift: 0, c: 2, ux: 1.5, uy: 1, wx: -1, wy: 1}},
      {name: "parabola", values: {set: "parabola", theta: 0, shift: 0, c: -1, ux: 1, uy: 0.5, wx: -2, wy: 2}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, S = shape(v), k = picks(v, S), f0 = !k.zero ? nearest(v, S, [0, 0]) : null;
      // zoom to what is drawn: u, w, u + w, cu and the set near 0 (shift + 2.4 holds the disk and the parabola's bend)
      var ext = [k.u, k.w, k.sum, k.cu].reduce(function (m, p) { return Math.max(m, Math.abs(p[0]) / 1.33, Math.abs(p[1])); }, 0);
      var big = Math.max(3, Math.abs(v.shift) + 2.4, ext) + 0.5;
      var pl = api.plane({x: [-big * 1.33, big * 1.33], y: [-big, big], ticks: false, labels: false, step: big > 6 ? 2 : 1});
      var X = pl.xr, Y = pl.yr, blue = {color: c.c2, width: 3, opacity: 0.9};
      // the candidate set S, clipped to the plane
      if (v.set === "line") pl.lineThrough(S.s, S.d1, blue);
      else if (v.set === "axes") { pl.lineThrough(S.s, S.d1, blue); pl.lineThrough(S.s, S.d2, blue); }
      else if (v.set === "disk") api.circle(pl.px(S.s), 2 * pl.sx, {fill: c.c2, fillOpacity: 0.16, stroke: c.c2, width: 2});
      else if (v.set === "quadrant") {
        var B = 60, poly = clip([S.s, S.toW([B, 0]), S.toW([B, B]), S.toW([0, B])], X, Y);
        if (poly.length > 2) api.polygon(poly.map(pl.px), {fill: c.c2, fillOpacity: 0.16});
        [S.d1, S.d2].forEach(function (d) { var e = seg(S.s, [S.s[0] + B * d[0], S.s[1] + B * d[1]], X, Y); if (e) api.line(pl.px(e[0]), pl.px(e[1]), {color: c.c2, width: 2.5}); });
      } else {
        var run = [], flush = function () { if (run.length > 1) api.polyline(run, {stroke: c.c2, width: 3}); run = []; };
        for (var t = -9; t <= 9; t += 0.03) {
          var p = S.toW([t, t * t / 2]);
          if (p[0] >= X[0] && p[0] <= X[1] && p[1] >= Y[0] && p[1] <= Y[1]) run.push(pl.px(p)); else flush();
        }
        flush();
      }
      // marks: points along everything drawn, so each label goes where it is clearest
      // (a mark owned by an arrow, its shaft, ring or handle, does not count against that arrow's own label)
      var O = pl.px([0, 0]), marks = [], line = function (A, Bp, own) { var n = Math.ceil(Math.hypot(Bp[0] - A[0], Bp[1] - A[1]) / 8); for (var i = 0; i <= n; i++) marks.push([A[0] + (Bp[0] - A[0]) * i / n, A[1] + (Bp[1] - A[1]) * i / n, own]); };
      [k.sum, k.cu, k.u, k.w].forEach(function (p, i) { line(O, pl.px(p), i); });
      var edge = function (f, lo, hi) { for (var t = lo; t <= hi; t += 0.15) { var q = f(t); if (q[0] >= X[0] && q[0] <= X[1] && q[1] >= Y[0] && q[1] <= Y[1]) marks.push(pl.px(q).concat([-2])); } };
      if (v.set === "disk") edge(function (t) { return [S.s[0] + 2 * Math.cos(t), S.s[1] + 2 * Math.sin(t)]; }, 0, 2 * Math.PI);
      else if (v.set === "parabola") edge(function (t) { return S.toW([t, t * t / 2]); }, -9, 9);
      else {
        var lo = v.set === "quadrant" ? 0 : -3 * big;
        edge(function (t) { return S.toW([t, 0]); }, lo, 3 * big);
        if (v.set !== "line") edge(function (t) { return S.toW([0, t]); }, lo, 3 * big);
      }
      line(pl.px(k.u), pl.px(k.sum)); line(pl.px(k.w), pl.px(k.sum));
      if (f0) line(O, pl.px(f0.at));
      [[[0, 0], 8, -1], [k.sum, 10, 0], [k.cu, 10, 1], [k.u, 7, 2], [k.w, 7, 3]].forEach(function (r) { // rings and handles
        var C = pl.px(r[0]); for (var a = 0; a < 8; a++) marks.push([C[0] + r[1] * Math.cos(a * Math.PI / 4), C[1] + r[1] * Math.sin(a * Math.PI / 4), r[2]]);
      });
      for (var bx = 8; bx <= 116; bx += 9) for (var by = 8; by <= 74; by += 9) marks.push([bx, by]); // the checklist box
      // the label S, at the member farthest from the arrows
      var best = null, bd = -Infinity;
      [[1, 1], [-1, 1], [-1, -1], [1, -1], [0.3, 0.9], [-0.3, -0.9]].forEach(function (q) {
        var m = S.snap([q[0] * X[1] * 0.7, q[1] * Y[1] * 0.7]);
        if (m[0] < X[0] + 0.5 || m[0] > X[1] - 0.5 || m[1] < Y[0] + 0.5 || m[1] > Y[1] - 0.5) return;
        var at = [pl.px(m)[0] + 10, pl.px(m)[1] - 12], dmin = sep(at, 8, marks, [], -2);
        if (dmin > bd) { bd = dmin; best = at; }
      });
      var placed = [];
      if (best) { api.label(best, "S", {color: c.c2, size: 15, weight: 700}); placed.push([best[0], best[1], 10]); }
      // one placement pass over the four arrow labels: each takes the clearest of a few spots around its tip
      var items = [[k.sum, "u + w", true], [k.cu, api.fmt(v.c) + "u", true], [k.u, "u", false], [k.w, "w", false]].map(function (it, self) {
        var T = pl.px(it[0]), L = Math.hypot(T[0] - O[0], T[1] - O[1]) || 1, ux = (T[0] - O[0]) / L, uy = (T[1] - O[1]) / L, hw = it[1].length * 3.9 + 2, r = it[2] ? 21 : 16;
        var cand = [[r * ux - 2 * uy, r * uy], [-18 * uy, 18 * ux], [18 * uy, -18 * ux], [13 * ux - 15 * uy, 13 * uy + 15 * ux], [13 * ux + 15 * uy, 13 * uy - 15 * ux], [-6 * ux - 18 * uy, -6 * uy + 18 * ux], [-6 * ux + 18 * uy, -6 * uy - 18 * ux],
                    [-30 * uy, 30 * ux], [30 * uy, -30 * ux], [30 * ux, 30 * uy]]; // farther out, for a crowded tip
        var bestOff = cand[0], bs = -Infinity;
        cand.forEach(function (o, i) { var P = [T[0] + o[0], T[1] + o[1]], sc = Math.min(10, sep(P, hw, marks, placed, self)) - i * 0.4; if (sc > bs) { bs = sc; bestOff = o; } });
        placed.push([T[0] + bestOff[0], T[1] + bestOff[1], hw]);
        return bestOff;
      });
      // u, w, u + w (with its parallelogram), c u; a ring at each tip says in S (green) or not (red)
      var ring = function (p, ok) { api.circle(pl.px(p), 9, {stroke: ok ? c.c4 : c.c5, width: 2.2}); };
      api.line(pl.px(k.u), pl.px(k.sum), {color: c.c3, width: 1.2, dash: "4 4", opacity: 0.7});
      api.line(pl.px(k.w), pl.px(k.sum), {color: c.c3, width: 1.2, dash: "4 4", opacity: 0.7});
      if (f0 && f0.gap * pl.sx > 4) api.line(O, pl.px(f0.at), {color: c.c5, width: 1.6, dash: "2 3"}); // how far S misses 0
      api.arrow(O, pl.px(k.cu), {color: c.c6, width: 2.5, label: api.fmt(v.c) + "u", labelOffset: items[1]});
      api.arrow(O, pl.px(k.sum), {color: c.c3, width: 2.5, label: "u + w", labelOffset: items[0]});
      api.arrow(O, pl.px(k.u), {color: c.c1, label: "u", labelOffset: items[2]});
      api.arrow(O, pl.px(k.w), {color: c.c1, label: "w", labelOffset: items[3]});
      ring(k.sum, k.sumIn); ring(k.cu, k.cuIn);
      api.circle(O, 7, {stroke: k.zero ? c.c4 : c.c5, width: 2.2}); api.point(O, {r: 3});
      api.handle(pl.px(k.u), {color: c.c1, plane: pl, r: 6, onDrag: function (q) { api.set({ux: q[0], uy: q[1]}); }});
      api.handle(pl.px(k.w), {color: c.c1, plane: pl, r: 6, onDrag: function (q) { api.set({wx: q[0], wy: q[1]}); }});
      // the three tests for these vectors
      api.rect(8, 8, 108, 66, {fill: c.card, fillOpacity: 0.88, rx: 8});
      [["0", k.zero], ["u + w", k.sumIn], [api.fmt(v.c) + "u", k.cuIn]].forEach(function (r, i) {
        api.label([18, 22 + i * 20], r[0] + (r[1] ? " ∈ S" : " ∉ S"), {color: r[1] ? c.c4 : c.c5, size: 13, weight: 650});
      });
    }
  });

  // clearance of a label centred at P (half-width hw, half-height 8) from points and from labels placed so far
  function sep(P, hw, pts, labels, self) {
    var d = 99;
    pts.forEach(function (q) { if (q[2] !== self || self == null) d = Math.min(d, Math.max(Math.abs(q[0] - P[0]) - hw, Math.abs(q[1] - P[1]) - 8)); });
    labels.forEach(function (q) { d = Math.min(d, Math.max(Math.abs(q[0] - P[0]) - hw - q[2], Math.abs(q[1] - P[1]) - 16)); });
    return d;
  }
  // Liang-Barsky: the part of segment a-b inside the rectangle, or null
  function seg(a, b, xr, yr) {
    var t0 = 0, t1 = 1, d = [b[0] - a[0], b[1] - a[1]];
    var lim = [[-d[0], a[0] - xr[0]], [d[0], xr[1] - a[0]], [-d[1], a[1] - yr[0]], [d[1], yr[1] - a[1]]];
    for (var i = 0; i < 4; i++) {
      var P = lim[i][0], Q = lim[i][1];
      if (Math.abs(P) < 1e-12) { if (Q < 0) return null; } else if (P < 0) t0 = Math.max(t0, Q / P); else t1 = Math.min(t1, Q / P);
    }
    return t0 > t1 ? null : [[a[0] + t0 * d[0], a[1] + t0 * d[1]], [a[0] + t1 * d[0], a[1] + t1 * d[1]]];
  }
  // Sutherland-Hodgman: a polygon clipped to the plane's rectangle
  function clip(pts, xr, yr) {
    [[0, xr[0], 1], [0, xr[1], -1], [1, yr[0], 1], [1, yr[1], -1]].forEach(function (e) {
      var out = [], ins = function (p) { return e[2] * (p[e[0]] - e[1]) >= 0; };
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length], ia = ins(a), ib = ins(b);
        if (ia) out.push(a);
        if (ia !== ib) { var t = (e[1] - a[e[0]]) / (b[e[0]] - a[e[0]]); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
      }
      pts = out;
    });
    return pts;
  }
})();
