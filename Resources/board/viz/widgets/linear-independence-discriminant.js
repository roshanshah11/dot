// Two vectors in the plane: the parallelogram they span, its area |det(u, v)|, and the moment they fall onto one line.
Viz.register("linear-independence-discriminant", {
  title: "Span and linear independence",
  subject: "linear-algebra",
  shows: "Drag u and v: the parallelogram they span has area |det(u, v)|; when it collapses to zero the two vectors are dependent and span only a line",
  params: {
    uX: {kind: "number", default: 3, min: -5, max: 5, step: 0.5, label: "u_x"},
    uY: {kind: "number", default: 1, min: -5, max: 5, step: 0.5, label: "u_y"},
    vX: {kind: "number", default: 1, min: -5, max: 5, step: 0.5, label: "v_x"},
    vY: {kind: "number", default: 2.5, min: -5, max: 5, step: 0.5, label: "v_y"}
  },
  formula: function (v) {
    var det = v.uX * v.vY - v.uY * v.vX;
    return "A = |\\det(\\mathbf{u},\\mathbf{v})| = |" + Viz.p(v.uX) + "\\cdot" + Viz.p(v.vY) + " - " + Viz.p(v.uY) + "\\cdot" + Viz.p(v.vX) + "| = " + Viz.n(Math.abs(det));
  },
  status: function (v) {
    var det = v.uX * v.vY - v.uY * v.vX;
    if (v.uX === 0 && v.uY === 0 && v.vX === 0 && v.vY === 0) return "Both vectors are zero: they span only the origin.";
    if (Math.abs(det) < 1e-9) return "<b>Dependent</b>: one is a multiple of the other, so together they span only a line.";
    return "<b>Independent</b>: the parallelogram has area <b>" + Viz.fmt(Math.abs(det)) + "</b>, so u and v span the whole plane.";
  },
  examples: [
    {name: "standard basis", values: {uX: 1, uY: 0, vX: 0, vY: 1}},
    {name: "dependent", values: {uX: 2, uY: 1, vX: 4, vY: 2}},
    {name: "opposite orientation", values: {uX: 1, uY: 3, vX: 3, vY: 1}}
  ],
  size: [380, 300],
  draw: function (api, v) {
    // zoom out far enough that u, v and u + v always fit
    var e = Math.max(5, Math.ceil(Math.max(Math.abs(v.uX + v.vX), Math.abs(v.uY + v.vY), Math.abs(v.uX), Math.abs(v.uY), Math.abs(v.vX), Math.abs(v.vY))) + 1);
    var c = api.color, pl = api.plane({x: [-e * 1.2, e * 1.2], y: [-e, e], tickEvery: e > 7 ? 4 : 2, step: e > 7 ? 2 : 1});
    var O = pl.px([0, 0]), U = pl.px([v.uX, v.uY]), V = pl.px([v.vX, v.vY]), S = pl.px([v.uX + v.vX, v.uY + v.vY]);
    var det = v.uX * v.vY - v.uY * v.vX;
    if (Math.abs(det) < 1e-9) {
      // the span collapses to the line through u (or v)
      var d = (v.uX || v.uY) ? [v.uX, v.uY] : [v.vX, v.vY];
      if (d[0] || d[1]) {
        pl.lineThrough([0, 0], d, {color: c.c5, width: 2.5, dash: "7 5", opacity: 0.85});
        api.label([pl.x(-e * 1.15), pl.y(e * 0.88)], "span is one line", {color: c.c5, size: 13, weight: 600});
      }
    } else {
      api.polygon([O, U, S, V], {fill: c.c2, fillOpacity: 0.18, stroke: c.c2, dash: "5 4"});
      api.label([(O[0] + S[0]) / 2, (O[1] + S[1]) / 2], "area " + api.fmt(Math.abs(det)), {color: c.c2, size: 13, weight: 600, anchor: "middle"});
    }
    api.arrow(O, U, {color: c.c1, label: "u"});
    api.arrow(O, V, {color: c.c3, label: "v"});
    api.point(O, {color: c.ink, r: 3.5});
    var snap = 0.5;
    api.handle(U, {color: c.c1, plane: pl, snap: snap, onDrag: function (q) { api.set({uX: q[0], uY: q[1]}); }});
    api.handle(V, {color: c.c3, plane: pl, snap: snap, onDrag: function (q) { api.set({vX: q[0], vY: q[1]}); }});
  }
});
