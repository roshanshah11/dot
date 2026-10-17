// The dot product two ways: componentwise, and |a||b|cos θ. The shadow of a on b's line has signed length
// |a| cos θ, so a·b = |b| × shadow; the cos θ strip shows why the sign follows the angle. The view fits the vectors,
// so it rescales as a tip is dragged past a whole unit.
Viz.register("vector-dot-product", {
  title: "The dot product and the angle",
  subject: "linear-algebra",
  shows: "Drag a and b: a·b is ax·bx + ay·by and also |a||b|cos θ, so it is positive for an acute angle, zero at 90° and negative past it",
  params: {
    ax: {kind: "number", default: 1, min: -5, max: 5, step: 0.5, label: "a_x"},
    ay: {kind: "number", default: 3, min: -5, max: 5, step: 0.5, label: "a_y"},
    bx: {kind: "number", default: 4, min: -5, max: 5, step: 0.5, label: "b_x"},
    by: {kind: "number", default: 1, min: -5, max: 5, step: 0.5, label: "b_y"}
  },
  formula: function (v) {
    var d = v.ax * v.bx + v.ay * v.by, na = Math.hypot(v.ax, v.ay), nb = Math.hypot(v.bx, v.by);
    var s = "\\mathbf a\\cdot\\mathbf b=" + Viz.p(v.ax) + "\\cdot" + Viz.p(v.bx) + "+" + Viz.p(v.ay) + "\\cdot" + Viz.p(v.by) + "=" + Viz.n(d);
    if (na < 1e-9 || nb < 1e-9) return s;
    var th = Math.acos(Math.max(-1, Math.min(1, d / (na * nb)))) * 180 / Math.PI;
    return s + "={" + Viz.n(na) + "\\cdot" + Viz.n(nb) + "\\cdot\\cos" + Viz.n(th, 1) + "^\\circ}";
  },
  status: function (v) {
    var d = v.ax * v.bx + v.ay * v.by, na = Math.hypot(v.ax, v.ay), nb = Math.hypot(v.bx, v.by);
    if (na < 1e-9 || nb < 1e-9) return "One vector is <b>zero</b>, so a·b = 0 and the angle is undefined.";
    var th = Math.acos(Math.max(-1, Math.min(1, d / (na * nb)))) * 180 / Math.PI, deg = Viz.fmt(th, 0) + "°";
    if (Math.abs(d) < 1e-9) return "<b>Perpendicular</b> (θ = 90°): a·b = 0, so a has no part along b.";
    if (th < 1e-6) return "<b>Same direction</b> (θ = 0°): cos θ = 1, so a·b = |a||b| = <b>" + Viz.fmt(d) + "</b>, as big as it can get.";
    if (th > 180 - 1e-6) return "<b>Opposite</b> (θ = 180°): cos θ = −1, so a·b = −|a||b| = <b>" + Viz.fmt(d) + "</b>.";
    if (d > 0) return "<b>Acute</b> (θ = " + deg + "): a·b = <b>" + Viz.fmt(d) + "</b> > 0, so a leans along b.";
    return "<b>Obtuse</b> (θ = " + deg + "): a·b = <b>" + Viz.fmt(d) + "</b> < 0, so a leans against b.";
  },
  examples: [
    {name: "perpendicular", values: {ax: 2, ay: 1, bx: -1, by: 2}},
    {name: "obtuse", values: {ax: -3, ay: 1, bx: 4, by: 1}},
    {name: "same direction", values: {ax: 1, ay: 1, bx: 3, by: 3}}
  ],
  size: [380, 300],
  draw: function (api, v) {
    var c = api.color, W = api.w, H = api.h;
    var d = v.ax * v.bx + v.ay * v.by, na = Math.hypot(v.ax, v.ay), nb = Math.hypot(v.bx, v.by);
    var ok = na > 1e-9 && nb > 1e-9, cosT = ok ? Math.max(-1, Math.min(1, d / (na * nb))) : 0, t = nb > 1e-9 ? d / (nb * nb) : 0;
    var signCol = Math.abs(d) < 1e-9 ? c.muted : d > 0 ? c.c4 : c.c5;
    // fit the view to what is drawn (the origin, both tips and the foot of the drop) with a unit of margin, then widen
    // the short side so the grid fills its box: the marks get the room instead of empty quadrants
    var bw = W - 28, bh = H - 66, xs = [0, v.ax, v.bx, t * v.bx], ys = [0, v.ay, v.by, t * v.by], X0, X1, Y0, Y1;
    var fit = function () {
      X0 = Math.floor(Math.min.apply(null, xs)) - 1; X1 = Math.ceil(Math.max.apply(null, xs)) + 1;
      Y0 = Math.floor(Math.min.apply(null, ys)) - 1; Y1 = Math.ceil(Math.max.apply(null, ys)) + 1;
    };
    fit();
    if (ok && Math.abs(d) > 1e-9) { // keep room for the shadow's value, which sits past the bar on the side away from a
      var sc = 0.9 * Math.min(bw / (X1 - X0), bh / (Y1 - Y0)), nd = [-v.by / nb, v.bx / nb], aw = v.ax * nd[0] + v.ay * nd[1] > 0 ? -1 : 1;
      var hw = (("|a| cos θ = " + api.fmt(d / nb)).length * 7 + 8) / 2, gap = (Math.abs(nd[0]) * hw + Math.abs(nd[1]) * 9.4 + 14) / sc;
      var mx = t * v.bx / 2 + aw * nd[0] * gap, my = t * v.by / 2 + aw * nd[1] * gap;
      xs.push(mx - hw / sc, mx + hw / sc); ys.push(my - 10 / sc, my + 10 / sc);
      fit();
    }
    var gx = Math.max(0, (Y1 - Y0) * bw / bh - (X1 - X0)) / 2, gy = Math.max(0, (X1 - X0) * bh / bw - (Y1 - Y0)) / 2;
    var pl = api.plane({x: [X0 - gx, X1 + gx], y: [Y0 - gy, Y1 + gy], box: [14, 8, bw, bh], ticks: false, step: 1});
    var O = pl.px([0, 0]), A = pl.px([v.ax, v.ay]), B = pl.px([v.bx, v.by]), F = pl.px([t * v.bx, t * v.by]);
    var unit = function (P, Q) { var l = Math.hypot(Q[0] - P[0], Q[1] - P[1]); return l > 1e-9 ? [(Q[0] - P[0]) / l, (Q[1] - P[1]) / l, l] : [1, 0, 0]; };
    var uA = unit(O, A), uB = unit(O, B), nA = [-uA[1], uA[0]], nB = [-uB[1], uB[0]];
    var dot = function (p, q) { return p[0] * q[0] + p[1] * q[1]; }, at = function (P, u, k, n, m) { return [P[0] + u[0] * k + n[0] * m, P[1] + u[1] * k + n[1] * m]; };
    var crossAB = dot([A[0] - O[0], A[1] - O[1]], nB), side = crossAB > 0 ? -1 : 1; // side of b's line away from a
    var sideA = dot([B[0] - O[0], B[1] - O[1]], nA) > 1e-6 ? -1 : dot([B[0] - O[0], B[1] - O[1]], nA) < -1e-6 ? 1 : -side * dot(nA, nB);
    // label placement: each label takes the cheapest candidate spot, avoiding the boxes and segments listed so far
    var tw = function (s, z) { return s.length * z * 0.56 + 8; }, box = function (q, w, h) { return [q[0] - w / 2, q[1] - h, q[0] + w / 2, q[1] + h]; };
    var meets = function (a, b) { return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]; };
    var crosses = function (sg, b) { // does the segment pass through the box (Liang-Barsky)
      var t0 = 0, t1 = 1, dx = sg[1][0] - sg[0][0], dy = sg[1][1] - sg[0][1], p = [-dx, dx, -dy, dy], q = [sg[0][0] - b[0], b[2] - sg[0][0], sg[0][1] - b[1], b[3] - sg[0][1]];
      for (var i = 0; i < 4; i++) { if (p[i] === 0) { if (q[i] < 0) return false; continue; } var r = q[i] / p[i]; if (p[i] < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r); if (t0 > t1) return false; }
      return true;
    };
    var xR = pl.x(X1 + gx), yT = pl.y(Y1 + gy); // the axis letters (and arrow tips) the plane draws there
    var boxes = [[O[0] - 5, O[1] - 5, O[0] + 5, O[1] + 5], [xR - 14, O[1] - 20, xR + 8, O[1] + 5], [O[0] - 5, yT - 8, O[0] + 20, yT + 15]], segs = [];
    var segA = {s: [O, A], pad: 5}, segB = {s: [O, B], pad: 5};
    segs.push({s: [[pl.x(X0 - gx), O[1]], [xR, O[1]]], pad: -3, cost: 12}, {s: [[O[0], pl.y(Y0 - gy)], [O[0], yT]], pad: -3, cost: 12}); // axes: grazing is fine, and a plated tag may cross
    if (uA[2] > 1) segs.push(segA); if (uB[2] > 1) segs.push(segB);
    var place = function (cands, text, size, own, plated) { // cands: [x, y, preference]; own: the arrow being named
      var w = tw(text, size), best = null;
      cands.forEach(function (q) {
        var b = box(q, w, size * 0.75), k = q[2] + (b[0] < 2 || b[1] < 2 || b[2] > W - 2 || b[3] > bh + 12 ? 1000 : 0);
        boxes.forEach(function (o) { if (meets(b, o)) k += 100; });
        segs.forEach(function (g) { if (g !== own && !(plated && g.cost) && crosses(g.s, [b[0] - g.pad, b[1] - g.pad, b[2] + g.pad, b[3] + g.pad])) k += g.cost || 60; });
        if (!best || k < best[2]) best = [q[0], q[1], k];
      });
      boxes.push(box(best, w, size * 0.75));
      return best;
    };
    var tag = function (q, text, o) { // a label on a card-colored plate so grid and axes do not cut through it
      var w = tw(text, o.size);
      api.rect(q[0] - w / 2, q[1] - o.size * 0.75, w, o.size * 1.5, {fill: c.card, fillOpacity: 0.85, rx: 4});
      api.label(q, text, Object.assign({anchor: "middle"}, o));
    };
    var bar = null, drop = ok && Math.hypot(A[0] - F[0], A[1] - F[1]) > 3, arcR = Math.max(18, Math.min(30, 0.3 * Math.min(uA[2], uB[2])));
    if (ok) {
      // b's line, and the drop from a's tip to its foot F on that line
      pl.lineThrough([0, 0], [v.bx, v.by], {color: c.faint, width: 1.2, dash: "3 5"});
      if (drop) { api.line(A, F, {color: c.muted, width: 1.3, dash: "4 4"}); segs.push({s: [A, F], pad: 3}); }
      // the shadow O→F (signed length |a| cos θ) as a dimension bar beside b's line, on the side away from a, so b's
      // arrow does not hide it; end ticks mark O and F
      if (Math.hypot(F[0] - O[0], F[1] - O[1]) > 2) {
        bar = [at(O, nB, 0, nB, side * 8), at(F, nB, 0, nB, side * 8)];
        api.line(bar[0], bar[1], {color: signCol, width: 4});
        [O, F].forEach(function (P) { api.line(at(P, nB, side * 3, nB, 0), at(P, nB, side * 13, nB, 0), {color: signCol, width: 1.6}); });
        segs.push({s: bar, pad: 3}, {s: [at(F, nB, side * 3, nB, 0), at(F, nB, side * 13, nB, 0)], pad: 2});
        if (Math.hypot(A[0] - F[0], A[1] - F[1]) > 10) { // right-angle mark at the foot, on a's side
          var s = 8, pu = unit(F, A), dir = t > 0 ? -1 : 1;
          api.polyline([at(F, uB, dir * s, pu, 0), at(F, uB, dir * s, [pu[0], pu[1]], s), at(F, uB, 0, [pu[0], pu[1]], s)], {stroke: c.muted, width: 1.2});
          boxes.push([F[0] - 11, F[1] - 11, F[0] + 11, F[1] + 11]);
        }
      }
      // the angle between them (a square corner at exactly 90°)
      var ta = Math.atan2(uA[1], uA[0]), tb = Math.atan2(uB[1], uB[0]), dt = ta - tb;
      while (dt > Math.PI) dt -= 2 * Math.PI;
      while (dt < -Math.PI) dt += 2 * Math.PI;
      if (Math.abs(d) < 1e-9) api.polyline([at(O, uB, 12, uA, 0), at(O, uB, 12, uA, 12), at(O, uA, 12, uB, 0)], {stroke: c.ink, width: 1.6});
      else if (Math.abs(dt) > 0.02) { var arc = []; for (var i = 0; i <= 24; i++) { var an = tb + dt * i / 24; arc.push([O[0] + arcR * Math.cos(an), O[1] + arcR * Math.sin(an)]); } api.polyline(arc, {stroke: c.ink, width: 1.6}); [0, 8, 16].forEach(function (j) { segs.push({s: [arc[j], arc[j + 8]], pad: 2}); }); }
    }
    api.arrow(O, B, {color: c.c3});
    api.arrow(O, A, {color: c.c1});
    api.point(O, {color: c.ink, r: 3.5});
    // a and b name their arrows beside the tip, on the side away from the other vector unless something is there
    var name = function (P, u, n, sd, text, color, own) {
      if (u[2] < 1) return;
      var q = place([at(P, u, 10, n, -sd * 13).concat(0), at(P, u, 4, n, -sd * 16).concat(2), at(P, u, 17, n, 0).concat(3), at(P, u, 16, n, sd * 9).concat(4),
        at(P, u, 10, n, sd * 13).concat(5), at(P, u, 25, n, 0).concat(6), at(P, u, 16, n, -sd * 9).concat(4), at(P, u, 6, n, -sd * 28).concat(3)], text, 14, own);
      api.label(q, text, {color: color, weight: 650, size: 14, anchor: "middle"});
    };
    name(B, uB, nB, -side, "b", c.c3, segB);
    name(A, uA, nA, -sideA, "a", c.c1, segA);
    boxes.push([A[0] - 9, A[1] - 9, A[0] + 9, A[1] + 9], [B[0] - 9, B[1] - 9, B[0] + 9, B[1] + 9]); // the drag handles
    if (ok && bar && Math.abs(d) > 1e-9) { // the shadow's value beside the bar, further out on the same side
      var stxt = "|a| cos θ = " + api.fmt(d / nb), sw = tw(stxt, 12.5), off = Math.abs(nB[0]) * sw / 2 + Math.abs(nB[1]) * 9.4 + 12, sc = [];
      [0.5, 0.3, 0.7, 0.15, 0.85].forEach(function (f, i) { for (var j = 0; j < 3; j++) {
        sc.push(at(O, [F[0] - O[0], F[1] - O[1]], f, nB, side * (off + j * 16)).concat(i + j * 2));
        sc.push(at(O, [F[0] - O[0], F[1] - O[1]], f, nB, -side * (off + j * 16)).concat(12 + i + j * 2));
      } });
      tag(place(sc, stxt, 12.5, null, true), stxt, {color: signCol, size: 12.5, weight: 650});
    }
    if (ok && Math.abs(dt) > 0.02) { // θ: on the bisector, stepping out until it clears the arrows, the drop and the bar; else past an arc end
      var ttxt = "θ = " + api.fmt(Math.acos(cosT) * 180 / Math.PI, 0) + "°", thw = tw(ttxt, 12.5), am = tb + dt / 2, um = [Math.cos(am), Math.sin(am)], tc = [];
      for (var r = arcR + 16; r <= arcR + 110; r += 6) tc.push(at(O, um, r, um, 0).concat((r - arcR - 16) / 6));
      [[uB, nB, side], [uA, nA, sideA]].forEach(function (e, k) {
        var sup = Math.abs(e[1][0]) * thw / 2 + Math.abs(e[1][1]) * 9.4 + 7;
        for (var r = arcR; r <= arcR + 64; r += 8) tc.push(at(O, e[0], r, e[1], e[2] * sup).concat(20 + k * 4 + (r - arcR) / 8));
      });
      var tq = place(tc, ttxt, 12.5, null, true);
      tag(tq, ttxt, {color: c.ink, size: 12.5});
    }
    // the cos θ strip: where this angle sits between opposite (−1) and same direction (+1)
    var x0 = 70, x1 = W - 70, y = H - 30, X = function (q) { return x0 + (q + 1) / 2 * (x1 - x0); };
    api.line([x0, y], [x1, y], {color: c.axis, width: 1.4});
    [-1, 0, 1].forEach(function (q) { api.line([X(q), y - 5], [X(q), y + 5], {color: c.axis, width: 1.2}); });
    api.label([x0 - 8, y], "−1", {color: c.muted, size: 12, anchor: "end"});
    api.label([x1 + 8, y], "+1", {color: c.muted, size: 12});
    api.label([X(0), y + 16], "0 (90°)", {color: c.muted, size: 12, anchor: "middle"});
    if (ok) {
      if (Math.abs(cosT) > 1e-9) api.line([X(0), y], [X(cosT), y], {color: signCol, width: 6});
      api.point([X(cosT), y], {color: signCol, r: 5.5});
      api.label([X(cosT), y - 15], "cos θ = " + api.fmt(cosT), {color: signCol, size: 12.5, weight: 650, anchor: "middle"});
    }
    api.handle(A, {color: c.c1, plane: pl, snap: 0.5, onDrag: function (q) { api.set({ax: q[0], ay: q[1]}); }});
    api.handle(B, {color: c.c3, plane: pl, snap: 0.5, onDrag: function (q) { api.set({bx: q[0], by: q[1]}); }});
  }
});
