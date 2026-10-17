// Two coordinate systems side by side. Left: v measured in B, where b1 and b2 are the unit steps, so the grid is
// square. Right: the same v in standard coordinates, where the B grid is slanted. P = [b1 b2] carries the left
// picture onto the right one (P [v]_B = v), and P^-1 carries it back. Drag v in either panel, or b1, b2.
// The queue's default is the standard basis, where both panels look identical; the default here is its
// "alternative custom basis" fixture (b1 = (1, 1), b2 = (1, -1)), which teaches the idea at first sight.
(function () {
  function coords(v) { // [v]_B = P^-1 v, or null when b1, b2 are parallel
    var det = v.basis1X * v.basis2Y - v.basis2X * v.basis1Y;
    if (Math.abs(det) < 1e-9) return null;
    return [(v.vectorX * v.basis2Y - v.basis2X * v.vectorY) / det, (v.basis1X * v.vectorY - v.vectorX * v.basis1Y) / det];
  }
  function seg(a, b, xr, yr) { // the part of segment a-b inside the plane, or null
    var t0 = 0, t1 = 1, d = [b[0] - a[0], b[1] - a[1]];
    var lim = [[-d[0], a[0] - xr[0]], [d[0], xr[1] - a[0]], [-d[1], a[1] - yr[0]], [d[1], yr[1] - a[1]]];
    for (var i = 0; i < 4; i++) {
      var P = lim[i][0], Q = lim[i][1];
      if (Math.abs(P) < 1e-12) { if (Q < 0) return null; } else if (P < 0) t0 = Math.max(t0, Q / P); else t1 = Math.min(t1, Q / P);
    }
    return t0 > t1 || Math.hypot(d[0], d[1]) < 1e-12 ? null : [[a[0] + t0 * d[0], a[1] + t0 * d[1]], [a[0] + t1 * d[0], a[1] + t1 * d[1]]];
  }
  // b1, b2 parallel: is v on their line (infinitely many weight pairs) or off it (none)?
  function onLine(v) {
    var d = (v.basis1X || v.basis1Y) ? [v.basis1X, v.basis1Y] : [v.basis2X, v.basis2Y];
    return (d[0] || d[1]) ? Math.abs(d[0] * v.vectorY - d[1] * v.vectorX) < 1e-9 : !v.vectorX && !v.vectorY;
  }
  // clearance of a label centred at P (half-width hw, half-height 8) from marks and from labels placed so far
  function sep(P, hw, marks, placed, own) {
    var d = 99;
    marks.forEach(function (q) { if (q[2] !== own) d = Math.min(d, Math.max(Math.abs(q[0] - P[0]) - hw, Math.abs(q[1] - P[1]) - 8)); });
    placed.forEach(function (q) { d = Math.min(d, Math.max(Math.abs(q[0] - P[0]) - hw - q[2], Math.abs(q[1] - P[1]) - 16)); });
    return d;
  }
  function nice(x) { var e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; }
  var num = {kind: "number", min: -4, max: 4, step: 0.5};

  Viz.register("change-of-basis", {
    title: "Change of basis",
    subject: "linear-algebra",
    shows: "The same vector in B-coordinates and in standard coordinates: P, whose columns are b1 and b2, turns one into the other",
    params: {
      vectorX: {kind: "number", default: 3, min: -5, max: 5, step: 0.5, label: "v_x"},
      vectorY: {kind: "number", default: 1, min: -5, max: 5, step: 0.5, label: "v_y"},
      basis1X: Object.assign({default: 1, label: "b_{1x}"}, num), basis1Y: Object.assign({default: 1, label: "b_{1y}"}, num),
      basis2X: Object.assign({default: 1, label: "b_{2x}"}, num), basis2Y: Object.assign({default: -1, label: "b_{2y}"}, num)
    },
    formula: function (v) {
      var c = coords(v), P = "\\begin{pmatrix}" + Viz.n(v.basis1X) + "&" + Viz.n(v.basis2X) + "\\\\" + Viz.n(v.basis1Y) + "&" + Viz.n(v.basis2Y) + "\\end{pmatrix}";
      if (!c) return "P_B=" + P + ",\\ \\det P_B=0";
      // each factor named underneath: P_B [v]_B = v
      return "\\underset{P_B}{" + P + "}\\underset{[\\mathbf v]_B}{\\begin{pmatrix}" + Viz.n(c[0]) + "\\\\" + Viz.n(c[1]) + "\\end{pmatrix}}=\\underset{\\mathbf v}{\\begin{pmatrix}" + Viz.n(v.vectorX) + "\\\\" + Viz.n(v.vectorY) + "\\end{pmatrix}}";
    },
    status: function (v) {
      var c = coords(v), std = "(" + Viz.fmt(v.vectorX) + ", " + Viz.fmt(v.vectorY) + ")";
      if (!c) return "b₁ and b₂ are parallel, so det P = 0 and B is not a basis; " +
        (onLine(v) ? "v lies on their line, so it has <b>infinitely many</b> B-coordinates, none unique." : "v is off their line, so it has <b>no</b> B-coordinates.");
      var t2 = c[1] < 0 ? "− " + Viz.fmt(-c[1]) : "+ " + Viz.fmt(c[1]);
      var cb = "(" + Viz.fmt(c[0]) + ", " + Viz.fmt(c[1]) + ")";
      return "In B-coordinates v is <b>" + cb + "</b>: P has columns b₁ and b₂, so P" + cb + " = " + Viz.fmt(c[0]) + "b₁ " + t2 + "b₂ = <b>" + std + "</b>, and P⁻¹ undoes it.";
    },
    examples: [
      {name: "Standard basis decomposition", values: {vectorX: 3, vectorY: 1, basis1X: 1, basis1Y: 0, basis2X: 0, basis2Y: 1}},
      {name: "Alternative custom basis", values: {vectorX: 3, vectorY: 1, basis1X: 1, basis1Y: 1, basis2X: 1, basis2Y: -1}},
      {name: "Minimum supported values", values: {vectorX: -5, vectorY: -5, basis1X: -4, basis1Y: -4, basis2X: -4, basis2Y: -4}},
      {name: "Maximum supported values", values: {vectorX: 5, vectorY: 5, basis1X: 4, basis1Y: 4, basis2X: 4, basis2Y: 4}},
      {name: "Rotated basis", values: {basis1X: 0, basis1Y: 1, basis2X: -1, basis2Y: 0}},
      {name: "Dependent basis vectors", values: {basis1X: 2, basis1Y: 1, basis2X: 4, basis2Y: 2}},
      {name: "Negative custom coordinates", values: {vectorX: -3, vectorY: 2}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var col = api.color, c = coords(v), b1 = [v.basis1X, v.basis1Y], b2 = [v.basis2X, v.basis2Y], V = [v.vectorX, v.vectorY];
      // two panels above, the P / P^-1 caption below them, so no label in a panel can reach the caption
      var boxL = [6, 28, 186, 196], boxR = [208, 28, 186, 196];
      // right: standard coordinates, zoomed to hold v, b1 and b2
      var eR = Math.max(3, Math.abs(V[0]), Math.abs(V[1]), Math.abs(b1[0]), Math.abs(b1[1]), Math.abs(b2[0]), Math.abs(b2[1])) + 0.7;
      var R = api.plane({x: [-eR, eR], y: [-eR, eR], box: boxR, step: eR > 6 ? 2 : 1, ticks: false, labels: false});
      // left: B-coordinates, zoomed to hold [v]_B (it can be large when b1, b2 are nearly parallel)
      var eL = c ? Math.max(2.4, Math.abs(c[0]), Math.abs(c[1])) * 1.15 + 0.3 : 3, stL = nice(eL / 3.2);
      var L = api.plane({x: [-eL, eL], y: [-eL, eL], box: boxL, step: stL, grid: false, axes: !!c, ticks: false, xLabel: "c_1", yLabel: "c_2"});
      var on = !c && onLine(v);
      api.label([99, 14], c ? "in B: (" + api.fmt(c[0]) + ", " + api.fmt(c[1]) + ")" : on ? "in B: not unique" : "in B: none", {color: c ? col.c6 : col.c5, size: 13, weight: 650, anchor: "middle"});
      api.label([301, 14], "standard: (" + api.fmt(V[0]) + ", " + api.fmt(V[1]) + ")", {color: col.c6, size: 13, weight: 650, anchor: "middle"});
      var OL = L.px([0, 0]), OR = R.px([0, 0]);
      // marks: points along every arrow and walk leg (tagged with the label they belong to), and the labels to place
      var marks = c ? [[L.x(eL) - 9, L.y(0) - 11, -1], [L.x(0) + 14, L.y(eL) + 6, -1]] : [], items = [], mark = function (A, B, own) { var n = Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / 8) || 1; for (var i = 0; i <= n; i++) marks.push([A[0] + (B[0] - A[0]) * i / n, A[1] + (B[1] - A[1]) * i / n, own]); };
      var vec = function (O, T, color, text, width, box) { api.arrow(O, T, {color: color, width: width}); mark(O, T, items.length); items.push([O, T, color, text, box]); };
      if (c) {
        // the same grid twice: square on the left, slanted by P on the right (teal lines run along b1, amber along b2)
        for (var k = -Math.ceil(eL / stL); k <= Math.ceil(eL / stL); k++) {
          var g = k * stL, wgt = {width: k ? 1 : 1.6, opacity: k ? 0.3 : 0.55};
          if (Math.abs(g) <= eL) {
            api.line(L.px([-eL, g]), L.px([eL, g]), Object.assign({color: col.c1}, wgt));
            api.line(L.px([g, -eL]), L.px([g, eL]), Object.assign({color: col.c3}, wgt));
          }
          var p = R.through([g * b2[0], g * b2[1]], b1), q = R.through([g * b1[0], g * b1[1]], b2);
          if (p) api.line(R.px(p[0]), R.px(p[1]), Object.assign({color: col.c1}, wgt));
          if (q) api.line(R.px(q[0]), R.px(q[1]), Object.assign({color: col.c3}, wgt));
        }
        // the walk: c1 along b1, then c2 along b2, in both pictures
        var mid = [c[0] * b1[0], c[0] * b1[1]], legs = [[L, [0, 0], [c[0], 0], col.c1], [L, [c[0], 0], c, col.c3], [R, [0, 0], mid, col.c1], [R, mid, V, col.c3]];
        legs.forEach(function (lg) {
          var s = seg(lg[1], lg[2], lg[0].xr, lg[0].yr); if (!s) return;
          api.line(lg[0].px(s[0]), lg[0].px(s[1]), {color: lg[3], width: 2.2, dash: "6 4"}); mark(lg[0].px(s[0]), lg[0].px(s[1]), -1);
        });
        vec(OL, L.px([1, 0]), col.c1, "b_1", 2.5, boxL);
        vec(OL, L.px([0, 1]), col.c3, "b_2", 2.5, boxL);
        vec(OL, L.px(c), col.c6, "v", 3, boxL);
        api.handle(L.px(c), {color: col.c6, plane: L, snap: stL >= 1 ? 0.5 : stL / 2, r: 6, onDrag: function (q) {
          api.set({vectorX: q[0] * b1[0] + q[1] * b2[0], vectorY: q[0] * b1[1] + q[1] * b2[1]});
        }});
      } else {
        api.label([99, 108], "b₁, b₂ parallel: not a basis", {color: col.c5, size: 12.5, weight: 600, anchor: "middle", raw: true});
        api.label([99, 130], on ? "v is on their line:" : "v is off their line:", {color: col.c5, size: 12.5, weight: 600, anchor: "middle", raw: true});
        api.label([99, 148], on ? "B-coordinates not unique" : "no B-coordinates", {color: col.c5, size: 12.5, weight: 600, anchor: "middle", raw: true});
        var d = (b1[0] || b1[1]) ? b1 : b2;
        if (d[0] || d[1]) R.lineThrough([0, 0], d, {color: col.c5, width: 2.5, dash: "7 5", opacity: 0.85});
      }
      var same = b1[0] === b2[0] && b1[1] === b2[1];
      if (same) { // one arrow in both colors, named once
        api.arrow(OR, R.px(b2), {color: col.c3, width: 6}); api.arrow(OR, R.px(b1), {color: col.c1, width: 2.2, halo: false});
        mark(OR, R.px(b1), items.length); items.push([OR, R.px(b1), col.c1, "b_1 = b_2", boxR]);
      } else {
        vec(OR, R.px(b1), col.c1, "b_1", 2.5, boxR);
        vec(OR, R.px(b2), col.c3, "b_2", 2.5, boxR);
      }
      vec(OR, R.px(V), col.c6, "v", 3, boxR);
      var drag = function (kx, ky) { return function (q) { var o = {}; o[kx] = q[0]; o[ky] = q[1]; api.set(o); }; };
      api.handle(R.px(b1), {color: col.c1, plane: R, snap: 0.5, r: 5.5, onDrag: drag("basis1X", "basis1Y")});
      api.handle(R.px(b2), {color: col.c3, plane: R, snap: 0.5, r: 5.5, onDrag: drag("basis2X", "basis2Y")});
      api.handle(R.px(V), {color: col.c6, plane: R, snap: 0.5, r: 6, onDrag: drag("vectorX", "vectorY")});
      // labels last, over the handles: each takes the clearest spot around its tip, kept inside its panel; with
      // b1 and b2 parallel the labels alternate sides of the shared line
      var placed = [];
      items.forEach(function (it, j) {
        var O = it[0], T = it[1], len = Math.hypot(T[0] - O[0], T[1] - O[1]) || 1, ux = (T[0] - O[0]) / len, uy = (T[1] - O[1]) / len;
        var hw = it[3].replace(/_\d/g, "x").length * 4 + 2, box = it[4], sd = c || j % 2 ? 1 : -1;
        // how far the label's centre must sit, across the arrow (r) and past its tip (f), for its box to clear it
        var r = hw * Math.abs(uy) + 8 * Math.abs(ux) + 7, f = hw * Math.abs(ux) + 8 * Math.abs(uy) + 7;
        var side = [[-r * uy * sd, r * ux * sd], [r * uy * sd, -r * ux * sd]], ahead = [f * ux, f * uy];
        var cand = (c ? [ahead].concat(side) : side.concat([ahead])).concat([[0.7 * (f * ux - r * uy), 0.7 * (f * uy + r * ux)], [0.7 * (f * ux + r * uy), 0.7 * (f * uy - r * ux)],
                    [-8 * ux - r * uy, -8 * uy + r * ux], [-8 * ux + r * uy, -8 * uy - r * ux]]);
        var best = null, bs = -Infinity;
        cand.forEach(function (o, i) {
          var P = [Math.max(box[0] + hw + 2, Math.min(box[0] + box[2] - hw - 2, T[0] + o[0])), Math.max(box[1] + 8, Math.min(box[1] + box[3] - 8, T[1] + o[1]))];
          var sc = Math.min(9, sep(P, hw, marks, placed, j)) - i * 0.4; if (sc > bs) { bs = sc; best = P; }
        });
        placed.push([best[0], best[1], hw]);
        api.label(best, it[3], {color: it[2], size: 14, weight: 650, anchor: "middle"});
      });
      // P carries the left picture to the right one; P^-1 brings it back
      var y = 252;
      api.arrow([150, y - 6], [250, y - 6], {color: c ? col.ink : col.faint, width: 1.6, halo: false, head: 8});
      api.label([200, y - 18], "P = [b₁ b₂]", {color: c ? col.ink : col.faint, size: 12.5, anchor: "middle", raw: true});
      if (c) {
        api.arrow([250, y + 10], [150, y + 10], {color: col.muted, width: 1.6, halo: false, head: 8});
        api.label([200, y + 23], "P⁻¹", {color: col.muted, size: 12.5, anchor: "middle", raw: true});
      }
    }
  });
})();
