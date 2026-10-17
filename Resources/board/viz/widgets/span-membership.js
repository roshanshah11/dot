// Is b in span{v1, v2}? In R3 two vectors span a plane (or a line, if parallel). Row reduce [v1 v2 | b]:
// a consistent system hands you the weights, and b is reached by walking c1 v1 then c2 v2; an inconsistent one
// has a row 0 0 | 1, and the picture shows b hovering off the plane, with its distance to the closest point.
(function () {
  var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  var lin = function (s, a, t, b) { return [s * a[0] + t * b[0], s * a[1] + t * b[1], s * a[2] + t * b[2]]; };
  var len = function (a) { return Math.sqrt(dot(a, a)); };
  var cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  var unit = function (a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  var lastView = new WeakMap(); // per figure
  var clear = function (p, pts) { return Math.min.apply(null, pts.map(function (q) { return Math.hypot(q[0] - p[0], q[1] - p[1]); }).concat([999])); };
  function vecs(v) { return {v1: [v.v1x, v.v1y, v.v1z], v2: [v.v2x, v.v2y, v.v2z], b: [v.bx, v.by, v.bz]}; }
  // weights c (least squares when b is off the span), closest point p, distance, and whether v1, v2 are independent
  function solve(v) {
    var q = vecs(v), a = dot(q.v1, q.v1), m = dot(q.v1, q.v2), d = dot(q.v2, q.v2), det = a * d - m * m, c;
    var indep = det > 1e-9 * Math.max(1, a * d);
    if (indep) { var r1 = dot(q.v1, q.b), r2 = dot(q.v2, q.b); c = [(d * r1 - m * r2) / det, (a * r2 - m * r1) / det]; }
    else if (a > 1e-12) c = [dot(q.b, q.v1) / a, 0];
    else if (d > 1e-12) c = [0, dot(q.b, q.v2) / d];
    else c = [0, 0];
    var p = lin(c[0], q.v1, c[1], q.v2), dist = len(lin(1, q.b, -1, p));
    return {q: q, c: c, p: p, dist: dist, inSpan: dist < 1e-6, indep: indep, zero: a < 1e-12 && d < 1e-12};
  }
  function rref(M) {
    M = M.map(function (r) { return r.slice(); });
    var row = 0;
    for (var col = 0; col < 3 && row < 3; col++) {
      var best = row;
      for (var i = row + 1; i < 3; i++) if (Math.abs(M[i][col]) > Math.abs(M[best][col])) best = i;
      if (Math.abs(M[best][col]) < 1e-9) continue;
      var t = M[row]; M[row] = M[best]; M[best] = t;
      var pv = M[row][col]; M[row] = M[row].map(function (x) { return x / pv; });
      for (i = 0; i < 3; i++) if (i !== row) { var f = M[i][col]; M[i] = M[i].map(function (x, k) { return x - f * M[row][k]; }); }
      row++;
    }
    return M.map(function (r) { return r.map(function (x) { return Math.abs(x) < 1e-9 ? 0 : x; }); });
  }
  function combo(c) { return Viz.fmt(c[0]) + "v₁ " + (c[1] < 0 ? "− " + Viz.fmt(-c[1]) : "+ " + Viz.fmt(c[1])) + "v₂"; }

  Viz.register("span-membership", {
    title: "Is b in the span?",
    subject: "linear-algebra",
    shows: "Is b in the span of v1, v2: solve for the weights or show the system has none",
    params: {
      v1x: {kind: "number", default: 1, min: -4, max: 4, step: 0.5, label: "v_{1x}"},
      v1y: {kind: "number", default: 0, min: -4, max: 4, step: 0.5, label: "v_{1y}"},
      v1z: {kind: "number", default: 1, min: -4, max: 4, step: 0.5, label: "v_{1z}"},
      v2x: {kind: "number", default: 0, min: -4, max: 4, step: 0.5, label: "v_{2x}"},
      v2y: {kind: "number", default: 1, min: -4, max: 4, step: 0.5, label: "v_{2y}"},
      v2z: {kind: "number", default: 1, min: -4, max: 4, step: 0.5, label: "v_{2z}"},
      bx: {kind: "number", default: 2, min: -4, max: 4, step: 0.5, label: "b_x"},
      by: {kind: "number", default: -1, min: -4, max: 4, step: 0.5, label: "b_y"},
      bz: {kind: "number", default: 1, min: -4, max: 4, step: 0.5, label: "b_z"},
      view: {kind: "number", default: 0, min: -60, max: 60, step: 1, label: "view", control: false}
    },
    formula: function (v) {
      var q = vecs(v), R = rref([0, 1, 2].map(function (i) { return [q.v1[i], q.v2[i], q.b[i]]; }));
      return "\\operatorname{rref}\\,[\\,\\mathbf v_1\\ \\mathbf v_2\\mid\\mathbf b\\,]=\\left(\\begin{array}{cc|c}" + R.map(function (r) { return r.map(function (x) { return Viz.n(x); }).join("&"); }).join("\\\\") + "\\end{array}\\right)";
    },
    status: function (v) {
      var s = solve(v), off = Viz.fmt(s.dist);
      if (s.zero) return "Both vectors are zero, so their span is just {0}" + (s.inSpan ? " and b = 0 is in it." : ": b is <b>not in the span</b>.");
      if (!s.indep) return "v₁ and v₂ are parallel, so they span only a line; " + (s.inSpan ? "b is on it, so <b>b is in the span</b>, with many weight pairs (one is b = " + combo(s.c) + ")." : "b is " + off + " away from it, so <b>b is not in the span</b>.");
      if (s.inSpan) return "<b>Yes</b>: the system is consistent and b = <b>" + combo(s.c) + "</b>, so b lies in the plane v₁ and v₂ span.";
      return "<b>No</b>: the reduced matrix has a row 0 0 | 1, so no weights exist; b sits <b>" + off + "</b> off the plane, nearest to " + combo(s.c) + ".";
    },
    examples: [
      {name: "b off the plane", values: {bx: 2, by: -1, bz: 3}},
      {name: "parallel vectors, b on their line", values: {v2x: 2, v2y: 0, v2z: 2, bx: 3, by: 0, bz: 3}},
      {name: "parallel vectors, b off the line", values: {v2x: -1, v2y: 0, v2z: -1, bx: 1, by: 2, bz: 0}},
      {name: "turned view", values: {bx: -1, by: 3, bz: 2, view: -45}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      var c = api.color, s = solve(v), q = s.q, O3 = [0, 0, 0], mid = lin(s.c[0], q.v1, 0, q.v2), drop = lin(1, q.b, -1, s.p);
      // e1 (and e2) run along the span; n is the plane's normal (or, for a line, the normal of the line-and-b plane)
      var e1 = null, e2 = null, n = null;
      if (s.indep) { e1 = unit(q.v1); e2 = unit(lin(1, q.v2, -dot(q.v2, e1), e1)); n = unit(cross(q.v1, q.v2)); }
      else if (!s.zero) { e1 = unit(len(q.v1) > 1e-9 ? q.v1 : q.v2); if (!s.inSpan) n = unit(cross(e1, drop)); }
      // the patch: just the part of the plane (or line) around what is drawn on it, not a fixed square
      var onSpan = [O3, q.v1, q.v2, s.p, mid], keys = onSpan.concat([q.b]), corners = [];
      if (e1) {
        var co = onSpan.map(function (k) { return [dot(k, e1), e2 ? dot(k, e2) : 0]; }), lo = [0, 0], hi = [0, 0];
        co.forEach(function (k) { for (var i = 0; i < 2; i++) { lo[i] = Math.min(lo[i], k[i]); hi[i] = Math.max(hi[i], k[i]); } });
        var span = Math.max(hi[0] - lo[0], hi[1] - lo[1], 1), m = 0.1 * span + 0.2;
        for (var i = 0; i < 2; i++) { var grow = Math.max(0, 0.55 * span - (hi[i] - lo[i])) / 2; lo[i] -= grow + m; hi[i] += grow + m; }
        corners = e2 ? [[lo[0], lo[1]], [hi[0], lo[1]], [hi[0], hi[1]], [lo[0], hi[1]]].map(function (k) { return lin(k[0], e1, k[1], e2); })
                     : [lin(lo[0], e1, 0, e1), lin(hi[0], e1, 0, e1)];
      }
      var L = Math.max(1.2, 0.6 * Math.max.apply(null, keys.map(len))), AX = [[L, 0, 0], [0, L, 0], [0, 0, L]];
      var stub = function (a) { return lin(-0.3, a, 0, a); }, cloud = keys.concat(corners, AX.map(function (a) { return lin(1.2, a, 0, a); }), AX.map(stub)); // room for the axis names
      var box = [18, 32, api.w - 36, api.h - 32 - 40];
      // choose the camera from the geometry: the plane seen about 55 degrees off its normal (a line face-on to b's
      // drop), arrows not foreshortened or stacked, and the picture as large as the box allows; the knob turns from there
      var vecsOnScreen = [q.v1, q.v2, q.b, drop].filter(function (k) { return len(k) > 1e-6; });
      function cam(phi, th) {
        var r = [-Math.sin(phi), Math.cos(phi), 0], u = [-Math.sin(th) * Math.cos(phi), -Math.sin(th) * Math.sin(phi), Math.cos(th)];
        var P = function (p) { return [dot(p, r), dot(p, u)]; }, pts = cloud.map(P);
        var xs = pts.map(function (t) { return t[0]; }), ys = pts.map(function (t) { return t[1]; });
        var b0 = [Math.min.apply(null, xs), Math.max.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, ys)];
        var k = Math.min(box[2] / Math.max(b0[1] - b0[0], 1e-6), box[3] / Math.max(b0[3] - b0[2], 1e-6));
        return {P: P, k: k, b0: b0, w: [Math.cos(th) * Math.cos(phi), Math.cos(th) * Math.sin(phi), Math.sin(th)]};
      }
      function score(C, th, phi) {
        var turn = Math.abs(((phi - 45) % 360 + 540) % 360 - 180) / 180; // 0 at the usual view, 1 opposite it
        var sc = Math.log(C.k) * 2 - Math.pow((th - 25) / 30, 2) - 1.2 * turn * turn;
        if (n) { var a = Math.acos(Math.min(1, Math.abs(dot(C.w, n)))) * 180 / Math.PI; sc -= Math.pow((a - (s.indep ? 55 : 22)) / 12, 2); }
        else if (e1) sc -= Math.pow(Math.abs(dot(C.w, e1)) / 0.3, 2);
        var sv = vecsOnScreen.map(C.P), worst = 1;
        vecsOnScreen.forEach(function (a, i) {
          var ratio = Math.hypot(sv[i][0], sv[i][1]) / len(a); if (ratio < 0.55) sc -= (0.55 - ratio) * 8;
          for (var j = i + 1; j < sv.length; j++) {
            if (len(cross(a, vecsOnScreen[j])) < 0.15 * len(a) * len(vecsOnScreen[j])) continue; // parallel in 3D: nothing to gain
            worst = Math.min(worst, Math.abs(sv[i][0] * sv[j][1] - sv[i][1] * sv[j][0]) / (Math.hypot(sv[i][0], sv[i][1]) * Math.hypot(sv[j][0], sv[j][1]) + 1e-9));
          }
        });
        return sc + 4 * Math.min(0.5, worst);
      }
      // the last view gets a head start, so dragging a slider does not make the camera jump between near-equal views
      var base = [45, 25], best = -Infinity, prev = lastView.get(api.svg);
      for (var ph = 0; ph < 360; ph += 5) for (var th = 5; th <= 60; th += 5) {
        var sc = score(cam(ph * Math.PI / 180, th * Math.PI / 180), th, ph);
        if (prev && Math.abs(((ph - prev[0]) % 360 + 540) % 360 - 180) <= 10 && Math.abs(th - prev[1]) <= 10) sc += 0.8;
        if (sc > best + 1e-9) { best = sc; base = [ph, th]; }
      }
      lastView.set(api.svg, base);
      var C = cam((base[0] + v.view) * Math.PI / 180, base[1] * Math.PI / 180), k = C.k, b0 = C.b0;
      var ox = box[0] + (box[2] - k * (b0[1] - b0[0])) / 2 - k * b0[0], oy = box[1] + (box[3] - k * (b0[3] - b0[2])) / 2 + k * b0[3];
      var X = function (p) { var t = C.P(p); return [ox + k * t[0], oy - k * t[1]]; }, O = X(O3);
      // marks: points along everything drawn, so each label can go where it is clearest
      var marks = [], placed = [], seg = function (A, B) { var nn = Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / 9); for (var i = 0; i <= nn; i++) marks.push([A[0] + (B[0] - A[0]) * i / nn, A[1] + (B[1] - A[1]) * i / nn]); };
      [q.v1, q.v2, q.b].forEach(function (k3) { seg(O, X(k3)); });
      if (e1 && !e2) seg(X(corners[0]), X(corners[1]));
      if (len(mid) > 1e-9) { seg(O, X(mid)); seg(X(mid), X(s.p)); }
      if (!s.inSpan) seg(X(s.p), X(q.b));
      AX.forEach(function (a, i) { // axis names past the end, or a little further out if a vector is there
        api.line(X(stub(a)), X(a), {color: c.axis, width: 1.2});
        var at = [1.12, 1.24, 1.36].map(function (f) { return X(lin(f, a, 0, a)); }).sort(function (p1, p2) { return Math.min(14, clear(p2, marks)) - Math.min(14, clear(p1, marks)); })[0];
        api.label(at, "xyz"[i], {color: c.muted, size: 12.5, anchor: "middle"}); placed.push(at);
      });
      var room = function (P) { return Math.min(clear(P, marks), clear(P, placed) - 8); }; // clearance from marks and labels
      if (e2) {
        api.polygon(corners.map(X), {fill: c.c2, fillOpacity: 0.13, stroke: c.c2, width: 1, opacity: 0.9});
        for (var g = 1; g <= 3; g++) {
          api.line(X(lin(1 - g / 4, corners[0], g / 4, corners[1])), X(lin(1 - g / 4, corners[3], g / 4, corners[2])), {color: c.c2, width: 0.8, opacity: 0.3});
          api.line(X(lin(1 - g / 4, corners[0], g / 4, corners[3])), X(lin(1 - g / 4, corners[1], g / 4, corners[2])), {color: c.c2, width: 0.8, opacity: 0.3});
        }
        var far = corners.map(function (k3) { return lin(0.88, k3, 0.12, lin(0.5, corners[0], 0.5, corners[2])); }).map(X)
          .sort(function (a, b) { return room(b) - room(a); })[0];
        api.label(far, "span", {color: c.c2, size: 12.5, weight: 600, anchor: "middle"}); placed.push(far);
      } else if (e1) {
        api.line(X(corners[0]), X(corners[1]), {color: c.c2, width: 2.5, dash: "7 5"});
        api.label([10, 14], "span: a line", {color: c.c2, size: 13, weight: 700});
      }
      if (s.zero) api.label([10, 14], "span: {0}", {color: c.c2, size: 13, weight: 700});
      // the walk c1 v1 then c2 v2, ending at b or at the closest point p
      if (len(mid) > 1e-9) api.line(O, X(mid), {color: c.c1, width: 2.2, dash: "6 4"});
      if (len(lin(1, s.p, -1, mid)) > 1e-9) api.line(X(mid), X(s.p), {color: c.c3, width: 2.2, dash: "6 4"});
      if (!s.inSpan) { // the perpendicular drop from b to its foot p, with a right-angle tick and its length
        var P0 = X(s.p), B0 = X(q.b), hu = unit(drop), back = lin(-1, s.p, 0, s.p);
        var t = e2 ? lin(1, back, -dot(back, n), n) : e1 ? lin(dot(back, e1), e1, 0, e1) : [0, 0, 0];
        t = len(t) > 1e-6 ? unit(t) : e1 || [1, 0, 0];
        var sz = 9 / k, tk = [lin(1, s.p, sz, t), lin(1, lin(1, s.p, sz, t), sz, hu), lin(1, s.p, sz, hu)];
        api.line(P0, B0, {color: c.c5, width: 2, dash: "3 3"});
        if (s.dist * k > 22) api.polyline(tk.map(X), {stroke: c.c5, width: 1.4});
        api.point(P0, {color: c.c5, r: 3.5});
        var mdp = [(P0[0] + B0[0]) / 2, (P0[1] + B0[1]) / 2], dl = Math.hypot(B0[0] - P0[0], B0[1] - P0[1]) || 1, pn = [-(B0[1] - P0[1]) / dl, (B0[0] - P0[0]) / dl];
        var at = [[mdp[0] + 16 * pn[0], mdp[1] + 16 * pn[1]], [mdp[0] - 16 * pn[0], mdp[1] - 16 * pn[1]]].sort(function (a, b) { return room(b) - room(a); })[0];
        api.label(at, api.fmt(s.dist), {color: c.c5, size: 13, weight: 700, anchor: "middle"}); placed.push(at);
      }
      // arrows, longest first so a short one stays visible on top; each label goes where it is clearest
      // (on a shared line the labels alternate sides of it)
      [[q.b, c.c6, "b"], [q.v2, c.c3, "v_2"], [q.v1, c.c1, "v_1"]].sort(function (a, b) { return len(b[0]) - len(a[0]); }).forEach(function (a, j) {
        if (len(a[0]) < 1e-9) return;
        var T = X(a[0]), d = Math.hypot(T[0] - O[0], T[1] - O[1]) || 1, ux = (T[0] - O[0]) / d, uy = (T[1] - O[1]) / d, sd = s.indep || j % 2 ? 1 : -1;
        var side = [[-19 * uy * sd, 19 * ux * sd], [19 * uy * sd, -19 * ux * sd]], ahead = [14 * ux, 14 * uy];
        var cand = (s.indep ? [ahead].concat(side) : side.concat([ahead])).concat([[10 * ux - 15 * uy, 10 * uy + 15 * ux], [10 * ux + 15 * uy, 10 * uy - 15 * ux]]);
        var bestOff = cand[0], bd = -Infinity;
        cand.forEach(function (o, i) { var P1 = [T[0] + o[0], T[1] + o[1]], dd = Math.min(20, clear(P1, marks), clear(P1, placed) - 8) - i * 0.5; if (dd > bd) { bd = dd; bestOff = o; } });
        api.arrow(O, T, {color: a[1], label: a[2], labelOffset: bestOff}); placed.push([T[0] + bestOff[0], T[1] + bestOff[1]]);
      });
      api.point(O, {r: 3});
      api.label([api.w - 10, 14], s.inSpan ? "b ∈ span" : "b ∉ span, off by " + api.fmt(s.dist), {color: s.inSpan ? c.c4 : c.c5, size: 13, weight: 700, anchor: "end"});
      // drag the knob to turn the view
      var tx = function (deg) { return 200 + deg / 60 * 90; }, ty = api.h - 16;
      api.line([tx(-60), ty], [tx(60), ty], {color: c.grid, width: 3});
      api.label([tx(-60) - 8, ty], "turn", {color: c.muted, size: 12, anchor: "end"});
      api.handle([tx(v.view), ty], {color: c.muted, r: 6, onDrag: function (p) { api.set({view: Math.round((p[0] - 200) / 90 * 60)}); }});
    }
  });
})();
