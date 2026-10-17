// Projecting a onto b: the closest point to a on b's line is (a·b / |b|²) b, and what is left over,
// a − proj, is perpendicular to b. Drag either vector; the coefficient can go negative or past 1.
Viz.register("vector-projection", {
  title: "Projecting one vector onto another",
  subject: "linear-algebra",
  shows: "Drag a and b: the projection is the multiple of b closest to a, (a·b / |b|²) b, and the leftover a − proj meets b's line at a right angle",
  params: {
    ax: {kind: "number", default: 2, min: -5, max: 5, step: 0.5, label: "a_x"},
    ay: {kind: "number", default: 3, min: -5, max: 5, step: 0.5, label: "a_y"},
    bx: {kind: "number", default: 4, min: -5, max: 5, step: 0.5, label: "b_x"},
    by: {kind: "number", default: 1, min: -5, max: 5, step: 0.5, label: "b_y"},
    perp: {kind: "boolean", default: true, label: "\\mathbf a-\\operatorname{proj}", on: "shown", off: "hidden"}
  },
  formula: function (v) {
    var d = v.ax * v.bx + v.ay * v.by, bb = v.bx * v.bx + v.by * v.by;
    if (bb < 1e-12) return "\\operatorname{proj}_{\\mathbf b}\\mathbf a=\\frac{\\mathbf a\\cdot\\mathbf b}{\\lVert\\mathbf b\\rVert^2}\\mathbf b\\ \\text{needs}\\ \\mathbf b\\neq\\mathbf 0";
    var k = d / bb;
    return "\\operatorname{proj}_{\\mathbf b}\\mathbf a=\\frac{\\mathbf a\\cdot\\mathbf b}{\\lVert\\mathbf b\\rVert^2}\\mathbf b=\\frac{" + Viz.n(d) + "}{" + Viz.n(bb) + "}\\begin{pmatrix}" +
      Viz.n(v.bx) + "\\\\" + Viz.n(v.by) + "\\end{pmatrix}=\\begin{pmatrix}" + Viz.n(k * v.bx) + "\\\\" + Viz.n(k * v.by) + "\\end{pmatrix}";
  },
  status: function (v) {
    var d = v.ax * v.bx + v.ay * v.by, bb = v.bx * v.bx + v.by * v.by;
    if (bb < 1e-12) return "b is the <b>zero vector</b>, so there is no line to project onto.";
    var k = d / bb, px = v.ax - k * v.bx, py = v.ay - k * v.by, pn = Math.hypot(px, py);
    if (Math.abs(d) < 1e-9) return "a ⟂ b, so the projection is the <b>zero vector</b>: all of a is perpendicular to b.";
    if (pn < 1e-9) return "a already lies on b's line, so its projection is a itself: <b>" + Viz.fmt(k) + " b</b>.";
    return "a splits into <b>" + Viz.fmt(k) + " b</b> along b" + (k < 0 ? " (pointing against b)" : "") + " plus a perpendicular part of length <b>" + Viz.fmt(pn) + "</b>.";
  },
  examples: [
    {name: "a on b's line", values: {ax: 2, ay: 1, bx: 4, by: 2}},
    {name: "perpendicular", values: {ax: -1, ay: 2, bx: 4, by: 2}},
    {name: "negative coefficient", values: {ax: -3, ay: 2, bx: 4, by: 1}},
    {name: "longer than b", values: {ax: 4.5, ay: 2, bx: 2, by: 0}}
  ],
  size: [380, 290],
  draw: function (api, v) {
    var c = api.color, W = api.w, H = api.h;
    // |proj| and |a − proj| never exceed |a|, so fitting a and b fits everything
    var e = Math.max(4, Math.ceil(Math.max(Math.abs(v.ax), Math.abs(v.ay), Math.abs(v.bx), Math.abs(v.by))) + 1);
    var pl = api.plane({x: [-e * 1.3, e * 1.3], y: [-e, e], box: [14, 10, W - 28, H - 20], ticks: false, step: 1});
    var tag = function (at, text, o) { // a label on a card-colored plate so grid and axes do not cut through it
      var w = text.length * o.size * 0.56 + 8, a = o.anchor || "middle", x = a === "start" ? at[0] - 4 : a === "end" ? at[0] - w + 4 : at[0] - w / 2;
      api.rect(x, at[1] - o.size * 0.75, w, o.size * 1.5, {fill: c.card, fillOpacity: 0.85, rx: 4});
      api.label(at, text, Object.assign({anchor: "middle"}, o));
    };
    var O = pl.px([0, 0]), A = pl.px([v.ax, v.ay]), B = pl.px([v.bx, v.by]);
    var d = v.ax * v.bx + v.ay * v.by, bb = v.bx * v.bx + v.by * v.by;
    if (bb > 1e-12) {
      var k = d / bb, P = pl.px([k * v.bx, k * v.by]);
      pl.lineThrough([0, 0], [v.bx, v.by], {color: c.c3, width: 1.3, dash: "3 5", opacity: 0.55});
      var ends = pl.through([0, 0], [v.bx, v.by]);
      if (ends) api.label(pl.px([ends[0][0] * 0.9, ends[0][1] * 0.9]), "span b", {color: c.c3, size: 12, anchor: "middle", opacity: 0.8});
      var bl = Math.hypot(B[0] - O[0], B[1] - O[1]), ux = (B[0] - O[0]) / bl, uy = (B[1] - O[1]) / bl, nx = -uy, ny = ux;
      var side = (A[0] - O[0]) * nx + (A[1] - O[1]) * ny > 0 ? -1 : 1; // put the proj label on the side away from a
      // a spot beside the segment O→end, on the side away from a, that stays clear of b's label at its tip
      var clear = function (end, text, size, off) {
        var bPos = [B[0] + ux * 10 + side * nx * 13, B[1] + uy * 10 + side * ny * 13], tw = text.length * size * 0.56 + 8, ts = [0.5, 0.3, 0.72, 0.18, 0.86];
        off = Math.max(off, Math.abs(nx) * tw / 2 + Math.abs(ny) * size * 0.75 + 6); // the whole box clears the line
        for (var j = 0; j < 3; j++, off += size + 6) for (var i = 0; i < ts.length; i++) {
          var q = [O[0] + (end[0] - O[0]) * ts[i] + side * nx * off, O[1] + (end[1] - O[1]) * ts[i] + side * ny * off];
          if (Math.abs(q[0] - bPos[0]) > tw / 2 + 9 || Math.abs(q[1] - bPos[1]) > size + 8) return q;
        }
        return [O[0] + (end[0] - O[0]) / 2 + side * nx * off, O[1] + (end[1] - O[1]) / 2 + side * ny * off];
      };
      var gap = Math.hypot(A[0] - P[0], A[1] - P[1]);
      if (v.perp && gap > 3) {
        api.arrow(P, A, {color: c.c5, width: 2.5, dash: "6 4", halo: false});
        var ox = ux * (k >= 0 ? 1 : -1), oy = uy * (k >= 0 ? 1 : -1); // beside the leftover, on the far side from the origin
        tag([(P[0] + A[0]) / 2 + ox * 10, (P[1] + A[1]) / 2 + oy * 10], "a − proj", {color: c.c5, size: 12.5, weight: 650,
          anchor: ox > 0.35 ? "start" : ox < -0.35 ? "end" : "middle"});
        if (Math.hypot(P[0] - O[0], P[1] - O[1]) > 10 && gap > 12) { // right angle where the leftover meets b's line
          var s = 8, gx = (A[0] - P[0]) / gap, gy = (A[1] - P[1]) / gap, dir = k > 0 ? -1 : 1;
          api.polyline([[P[0] + dir * ux * s, P[1] + dir * uy * s], [P[0] + dir * ux * s + gx * s, P[1] + dir * uy * s + gy * s], [P[0] + gx * s, P[1] + gy * s]], {stroke: c.ink, width: 1.3});
        }
      } else if (!v.perp && gap > 3) {
        api.line(A, P, {color: c.faint, width: 1.2, dash: "2 4"});
      }
      // proj drawn wide and under b, so both stay visible when they overlap
      if (Math.hypot(P[0] - O[0], P[1] - O[1]) > 2) api.arrow(O, P, {color: c.c4, width: 6, head: 14});
      else api.point(O, {color: c.c4, r: 6});
      var ptxt = "proj = " + api.fmt(k) + " b";
      tag(clear(P, ptxt, 13, 20), ptxt, {color: c.c4, size: 13, weight: 650});
    }
    var bOff = null; // b's label on the far side of b from a
    if (bb > 1e-12) { var L = Math.hypot(B[0] - O[0], B[1] - O[1]), wx = (B[0] - O[0]) / L, wy = (B[1] - O[1]) / L, s2 = (A[0] - O[0]) * -wy + (A[1] - O[1]) * wx > 0 ? 1 : -1;
      bOff = [wx * 10 + s2 * wy * 13, wy * 10 - s2 * wx * 13]; }
    api.arrow(O, B, {color: c.c3, label: "b", labelOffset: bOff});
    api.arrow(O, A, {color: c.c1, label: "a"});
    api.point(O, {color: c.ink, r: 3.5});
    api.handle(A, {color: c.c1, plane: pl, snap: 0.5, onDrag: function (q) { api.set({ax: q[0], ay: q[1]}); }});
    api.handle(B, {color: c.c3, plane: pl, snap: 0.5, onDrag: function (q) { api.set({bx: q[0], by: q[1]}); }});
  }
});
