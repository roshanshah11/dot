// Col A is everything A can output. Ax = x1 a1 + x2 a2 + x3 a3, a walk along the columns, so Ax always
// lands in their span. Pick the rank: the columns of a fixed 3 x 3 matrix span a line (rank 1), a plane
// (rank 2) or all of R3 (rank 3). Slide x and watch Ax move, but never leave Col A.
(function () {
  var MATS = { // columns a1, a2, a3 for each rank
    1: [[0.5, 1, 1], [1, 2, 2], [-0.5, -1, -1]], // all multiples of (1, 2, 2); not (1, 1, 1), which points at the camera
    2: [[1, 0, 1], [0, 1, 1], [1, 1, 2]],      // a3 = a1 + a2: the plane z = x + y
    3: [[1, 0, 0], [0.5, 1, 0], [0, 0.5, 1]]   // independent, det = 1
  };
  var CAP = {1: "Col A: a line", 2: "Col A: a plane", 3: "Col A: all of R³, so every b is reachable"};
  var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  var lin = function (s, a, t, b) { return [s * a[0] + t * b[0], s * a[1] + t * b[1], s * a[2] + t * b[2]]; };
  var len = function (a) { return Math.sqrt(dot(a, a)); };
  var cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  var unit = function (a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  var lastView = new WeakMap(); // per figure
  // clearance of a label centred at P (half-width hw, half-height 8) from marks and from labels placed so far
  function sep(P, hw, marks, placed, own) {
    var d = 99;
    marks.forEach(function (q) { if (q[2] !== own) d = Math.min(d, Math.max(Math.abs(q[0] - P[0]) - hw, Math.abs(q[1] - P[1]) - 8)); });
    placed.forEach(function (q) { d = Math.min(d, Math.max(Math.abs(q[0] - P[0]) - hw - q[2], Math.abs(q[1] - P[1]) - 16)); });
    return d;
  }
  function walk(v) {
    var A = MATS[v.rank], x = [v.inputX, v.inputY, v.inputZ], p1 = lin(x[0], A[0], 0, A[0]), p2 = lin(1, p1, x[1], A[1]), ax = lin(1, p2, x[2], A[2]);
    return {A: A, x: x, p1: p1, p2: p2, ax: ax.map(function (t) { return Math.abs(t) < 1e-12 ? 0 : t; })};
  }
  function vec(a) { return "\\begin{pmatrix}" + a.map(function (t) { return Viz.n(t); }).join("\\\\") + "\\end{pmatrix}"; }
  function trip(a) { return "(" + a.map(function (t) { return Viz.fmt(t); }).join(", ") + ")"; }

  Viz.register("column-space", {
    title: "Column space",
    subject: "linear-algebra",
    shows: "Ax is a combination of the columns of A, so every output lands in Col A: a line, a plane or all of R3 depending on the rank",
    params: {
      // default rank 2, x = (0.5, -1, 0.5), not the queue's rank 1, x = (1, 0, 0): on a line every column and Ax overlap,
      // and with x = (1, 0, 0) Ax is a1 exactly. Here Ax = a1 - 0.5 a2 = (1, -0.5, 0.5) is parallel to no column (it sits
      // 30 degrees outside their fan), all three legs of the walk show, and it still lands in the plane. (0.5, 1, -0.5)
      // would give Ax = 0.5 a2, hidden under a2.
      rank: {kind: "integer", default: 2, min: 1, max: 3, label: "\\text{rank}"},
      inputX: {kind: "number", default: 0.5, min: -1.5, max: 1.5, step: 0.05, label: "x_1"},
      inputY: {kind: "number", default: -1, min: -1.5, max: 1.5, step: 0.05, label: "x_2"},
      inputZ: {kind: "number", default: 0.5, min: -1.5, max: 1.5, step: 0.05, label: "x_3"},
      view: {kind: "number", default: 0, min: -60, max: 60, step: 1, label: "view", control: false}
    },
    formula: function (v) {
      var w = walk(v), A = w.A, M = "\\begin{pmatrix}" + [0, 1, 2].map(function (i) { return A.map(function (col) { return Viz.n(col[i]); }).join("&"); }).join("\\\\") + "\\end{pmatrix}";
      return "\\underset{A}{" + M + "}\\underset{\\mathbf x}{" + vec(w.x) + "}=\\underset{A\\mathbf x\\,\\in\\,\\operatorname{Col}A}{" + vec(w.ax) + "}";
    },
    status: function (v) {
      var t = trip(walk(v).ax);
      if (v.rank === 1) return "Rank 1: every column is a multiple of (1, 2, 2), so Col A is a line, and Ax = <b>" + t + "</b> lands on it, as every Ax must.";
      if (v.rank === 2) return "Rank 2: a₃ = a₁ + a₂, so Col A is the plane z = x + y, and Ax = <b>" + t + "</b> lies in it, as every Ax must.";
      return "Rank 3: the columns are independent, so Col A is all of R³ and every target is reachable; here Ax = <b>" + t + "</b>.";
    },
    examples: [
      {name: "Minimum supported values", values: {rank: 1, inputX: -1.5, inputY: -1.5, inputZ: -1.5}},
      {name: "Rank two: a column-space plane", values: {rank: 2, inputX: 0.5, inputY: 1, inputZ: 0}},
      {name: "Rank three: full three-dimensional column space", values: {rank: 3, inputX: 0.5, inputY: 0.5, inputZ: 0.5}},
      {name: "Maximum supported values", values: {rank: 3, inputX: 1.5, inputY: 1.5, inputZ: 1.5}},
      {name: "Rank two, turned", values: {rank: 2, inputX: 1, inputY: -1, inputZ: 0.5, view: 30}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, w = walk(v), A = w.A, O3 = [0, 0, 0], keys = A.concat([w.p1, w.p2, w.ax]);
      // e1 (and e2) run along Col A when it is a line (or plane); n is the plane's normal
      var e1 = v.rank === 1 ? unit(A[1]) : v.rank === 2 ? unit(A[0]) : null, e2 = null, n = null, shape = [];
      if (v.rank === 2) { e2 = unit(lin(1, A[1], -dot(A[1], e1), e1)); n = unit(cross(A[0], A[1])); }
      if (e1) { // Col A drawn just around what lies in it: a segment of the line, or a patch of the plane
        var lo = [0, 0], hi = [0, 0];
        keys.forEach(function (k) { var q = [dot(k, e1), e2 ? dot(k, e2) : 0]; for (var i = 0; i < 2; i++) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); } });
        var span = Math.max(hi[0] - lo[0], hi[1] - lo[1], 1), m = 0.12 * span + 0.25;
        for (var i = 0; i < 2; i++) { var grow = e2 ? Math.max(0, 0.55 * span - (hi[i] - lo[i])) / 2 : 0; lo[i] -= grow + m; hi[i] += grow + m; }
        shape = e2 ? [[lo[0], lo[1]], [hi[0], lo[1]], [hi[0], hi[1]], [lo[0], hi[1]]].map(function (q) { return lin(q[0], e1, q[1], e2); }) : [lin(lo[0], e1, 0, e1), lin(hi[0], e1, 0, e1)];
      }
      var L = Math.max(1.2, 0.6 * Math.max.apply(null, keys.map(len))), AX = [[L, 0, 0], [0, L, 0], [0, 0, L]];
      var stub = function (a) { return lin(-0.3, a, 0, a); };
      var cloud = keys.concat(shape, AX.map(function (a) { return lin(1.2, a, 0, a); }), AX.map(stub)); // room for the axis names
      var box = [16, 30, api.w - 32, api.h - 30 - 40], shown = A.concat([w.ax]).filter(function (k) { return len(k) > 1e-6; });
      // the camera comes from the geometry: a plane seen about 55 degrees off its normal, a line side-on, columns and Ax
      // not stacked or foreshortened, and the picture as large as the box allows; the knob turns from there
      function cam(phi, th) {
        var r = [-Math.sin(phi), Math.cos(phi), 0], u = [-Math.sin(th) * Math.cos(phi), -Math.sin(th) * Math.sin(phi), Math.cos(th)];
        var P = function (p) { return [dot(p, r), dot(p, u)]; }, pts = cloud.map(P);
        var xs = pts.map(function (t) { return t[0]; }), ys = pts.map(function (t) { return t[1]; });
        var b0 = [Math.min.apply(null, xs), Math.max.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, ys)];
        return {P: P, b0: b0, k: Math.min(box[2] / Math.max(b0[1] - b0[0], 1e-6), box[3] / Math.max(b0[3] - b0[2], 1e-6)), w: [Math.cos(th) * Math.cos(phi), Math.cos(th) * Math.sin(phi), Math.sin(th)]};
      }
      function score(C, ph, th) {
        var turn = Math.abs(((ph - 45) % 360 + 540) % 360 - 180) / 180, sc = 2 * Math.log(C.k) - Math.pow((th - 25) / 30, 2) - 1.2 * turn * turn;
        if (n) sc -= Math.pow((Math.acos(Math.min(1, Math.abs(dot(C.w, n)))) * 180 / Math.PI - 55) / 12, 2);
        else if (e1) sc -= Math.pow(Math.abs(dot(C.w, e1)) / 0.3, 2);
        var sv = shown.map(C.P), worst = 1;
        shown.forEach(function (a, i) {
          var ratio = Math.hypot(sv[i][0], sv[i][1]) / len(a); if (ratio < 0.55) sc -= (0.55 - ratio) * 8;
          for (var j = i + 1; j < sv.length; j++) if (len(cross(a, shown[j])) > 0.15 * len(a) * len(shown[j]))
            worst = Math.min(worst, Math.abs(sv[i][0] * sv[j][1] - sv[i][1] * sv[j][0]) / (Math.hypot(sv[i][0], sv[i][1]) * Math.hypot(sv[j][0], sv[j][1]) + 1e-9));
        });
        return sc + 4 * Math.min(0.5, worst);
      }
      var base = [45, 25], best = -Infinity, prev = lastView.get(api.svg); // the last view gets a head start, so drags do not jump
      for (var ph = 0; ph < 360; ph += 5) for (var th = 5; th <= 60; th += 5) {
        var sc = score(cam(ph * Math.PI / 180, th * Math.PI / 180), ph, th);
        if (prev && prev[2] === v.rank && Math.abs(((ph - prev[0]) % 360 + 540) % 360 - 180) <= 10 && Math.abs(th - prev[1]) <= 10) sc += 0.8;
        if (sc > best + 1e-9) { best = sc; base = [ph, th]; }
      }
      lastView.set(api.svg, base.concat([v.rank]));
      var C = cam((base[0] + v.view) * Math.PI / 180, base[1] * Math.PI / 180), k = C.k, b0 = C.b0;
      var ox = box[0] + (box[2] - k * (b0[1] - b0[0])) / 2 - k * b0[0], oy = box[1] + (box[3] - k * (b0[3] - b0[2])) / 2 + k * b0[3];
      var X = function (p) { var t = C.P(p); return [ox + k * t[0], oy - k * t[1]]; }, O = X(O3);
      // marks: points along every arrow and walk leg (tagged with whose label they belong to), for the label pass
      var marks = [], placed = [], seg = function (P0, P1, own) { var nn = Math.ceil(Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) / 8) || 1; for (var i = 0; i <= nn; i++) marks.push([P0[0] + (P1[0] - P0[0]) * i / nn, P0[1] + (P1[1] - P0[1]) * i / nn, own]); };
      A.forEach(function (a, i) { seg(O, X(a), i); });
      seg(O, X(w.ax), 3); seg(O, X(w.p1), -1); seg(X(w.p1), X(w.p2), -1); seg(X(w.p2), X(w.ax), -1);
      if (shape.length === 2) seg(X(shape[0]), X(shape[1]), -1);
      AX.forEach(function (a, i) { // axis names past the end, or a little further out if a vector is there
        api.line(X(stub(a)), X(a), {color: c.axis, width: 1.2});
        var at = [1.12, 1.24, 1.36].map(function (f) { return X(lin(f, a, 0, a)); }).sort(function (p1, p2) { return Math.min(10, sep(p2, 5, marks, [])) - Math.min(10, sep(p1, 5, marks, [])); })[0];
        api.label(at, "xyz"[i], {color: c.muted, size: 12.5, anchor: "middle"}); placed.push([at[0], at[1], 4]);
      });
      // Col A: the line or the plane patch (rank 3 fills space, so the caption says it and nothing is boxed in)
      if (v.rank === 1) api.line(X(shape[0]), X(shape[1]), {color: c.c2, width: 3, opacity: 0.85});
      else if (v.rank === 2) {
        api.polygon(shape.map(X), {fill: c.c2, fillOpacity: 0.14, stroke: c.c2, width: 1});
        for (var g = 1; g <= 3; g++) {
          api.line(X(lin(1 - g / 4, shape[0], g / 4, shape[1])), X(lin(1 - g / 4, shape[3], g / 4, shape[2])), {color: c.c2, width: 0.8, opacity: 0.3});
          api.line(X(lin(1 - g / 4, shape[0], g / 4, shape[3])), X(lin(1 - g / 4, shape[1], g / 4, shape[2])), {color: c.c2, width: 0.8, opacity: 0.3});
        }
      }
      api.label([10, 14], CAP[v.rank], {color: c.c2, size: 13, weight: 700, raw: true});
      // the columns, then the walk x1 a1 + x2 a2 + x3 a3 that ends at Ax
      var cols = [c.c1, c.c3, c.c4], order = v.rank === 1 ? [1, 0, 2] : [0, 1, 2];
      order.forEach(function (i) { api.arrow(O, X(A[i]), {color: cols[i], width: 2.4, opacity: 0.9}); });
      [[O3, w.p1], [w.p1, w.p2], [w.p2, w.ax]].forEach(function (sg, i) {
        if (len(lin(1, sg[1], -1, sg[0])) > 1e-9) api.line(X(sg[0]), X(sg[1]), {color: cols[i], width: 2.2, dash: "6 4"});
      });
      if (len(w.ax) > 1e-9) api.arrow(O, X(w.ax), {color: c.c6, width: 3.2});
      api.point(O, {r: 3});
      // labels: each takes the clearest spot around its tip; on a line the three columns share one label
      var put = function (T, from, text, hw, own) {
        var d = Math.hypot(T[0] - from[0], T[1] - from[1]) || 1, ux = (T[0] - from[0]) / d, uy = (T[1] - from[1]) / d;
        var r = hw * Math.abs(uy) + 8 * Math.abs(ux) + 7, f = hw * Math.abs(ux) + 8 * Math.abs(uy) + 7, best = null, bs = -Infinity;
        [[f * ux, f * uy], [-r * uy, r * ux], [r * uy, -r * ux], [0.7 * (f * ux - r * uy), 0.7 * (f * uy + r * ux)], [0.7 * (f * ux + r * uy), 0.7 * (f * uy - r * ux)],
         [-0.5 * f * ux - r * uy, -0.5 * f * uy + r * ux], [-0.5 * f * ux + r * uy, -0.5 * f * uy - r * ux]].forEach(function (o, i) {
          var P = [Math.max(hw + 3, Math.min(api.w - hw - 3, T[0] + o[0])), Math.max(24, Math.min(api.h - 42, T[1] + o[1]))];
          var s2 = Math.min(9, sep(P, hw, marks, placed, own)) - i * 0.4; if (s2 > bs) { bs = s2; best = P; }
        });
        placed.push([best[0], best[1], hw]); return best;
      };
      if (v.rank === 1) { // "a1, a2, a3 all on this line", each name in its column's color, beside the line
        var bits = [["a₁, ", c.c1], ["a₂, ", c.c3], ["a₃ ", c.c4], ["all on this line", c.c2]], S0 = X(shape[0]), S1 = X(shape[1]);
        var at = put(S1[1] < S0[1] ? S1 : S0, S1[1] < S0[1] ? S0 : S1, "", 80, -9), t = api.label(at, "", {size: 13, weight: 650, anchor: "middle", clamp: false});
        bits.forEach(function (b) { var ts = document.createElementNS("http://www.w3.org/2000/svg", "tspan"); ts.setAttribute("fill", b[1]); ts.textContent = b[0]; t.appendChild(ts); });
      } else A.forEach(function (a, i) { api.label(put(X(a), O, "", 9, i), "a_" + (i + 1), {color: cols[i], size: 14, weight: 650, anchor: "middle"}); });
      if (len(w.ax) > 1e-9) api.label(put(X(w.ax), O, "", 11, 3), "Ax", {color: c.c6, size: 14, weight: 700, anchor: "middle"});
      else api.label(put(O, [O[0] - 1, O[1] + 1], "", 24, 3), "Ax = 0", {color: c.c6, size: 13, weight: 700, anchor: "middle"});
      // drag the knob to turn the view
      var tx = function (deg) { return 200 + deg / 60 * 90; }, ty = api.h - 16;
      api.line([tx(-60), ty], [tx(60), ty], {color: c.grid, width: 3});
      api.label([tx(-60) - 8, ty], "turn", {color: c.muted, size: 12, anchor: "end"});
      api.handle([tx(v.view), ty], {color: c.muted, r: 6, onDrag: function (p) { api.set({view: Math.round((p[0] - 200) / 90 * 60)}); }});
    }
  });
})();
