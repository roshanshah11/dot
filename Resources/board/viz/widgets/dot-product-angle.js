// Two vectors and the angle between them: u·v = u1 v1 + u2 v2 = |u||v| cos θ. The dot product is |u| times
// the signed length of v's shadow on u, so its sign says acute (+), right (0) or obtuse (−).
(function () {
  function geo(v) {
    var dot = v.uX * v.vX + v.uY * v.vY, nu = Math.hypot(v.uX, v.uY), nv = Math.hypot(v.vX, v.vY);
    var ok = nu > 1e-9 && nv > 1e-9, cos = ok ? Math.max(-1, Math.min(1, dot / (nu * nv))) : 0;
    return {dot: dot, nu: nu, nv: nv, ok: ok, cos: cos, deg: Math.acos(cos) * 180 / Math.PI, comp: nu > 1e-9 ? dot / nu : 0};
  }
  Viz.register("dot-product-angle", {
    title: "Dot product and the angle between vectors",
    subject: "linear-algebra",
    shows: "Drag u and v: u·v is |u| times the signed length of v's shadow on u, so it is positive for an acute angle, zero at 90° and negative past it",
    params: {
      uX: {kind: "number", default: 4, min: -5, max: 5, step: 0.5, label: "u_1"},
      uY: {kind: "number", default: 1, min: -5, max: 5, step: 0.5, label: "u_2"},
      vX: {kind: "number", default: 1.5, min: -5, max: 5, step: 0.5, label: "v_1"},
      vY: {kind: "number", default: 3, min: -5, max: 5, step: 0.5, label: "v_2"}
    },
    formula: function (v) {
      var g = geo(v), s = "\\mathbf{u}\\cdot\\mathbf{v}=" + Viz.p(v.uX) + "\\cdot" + Viz.p(v.vX) + "+" + Viz.p(v.uY) + "\\cdot" + Viz.p(v.vY) + "=" + Viz.n(g.dot);
      if (!g.ok) return s + ",\\ \\theta\\text{ undefined}";
      return s + "=\\lVert\\mathbf{u}\\rVert\\lVert\\mathbf{v}\\rVert\\cos\\theta=" + Viz.n(g.nu) + "\\cdot" + Viz.n(g.nv) + "\\cos" + Viz.n(g.deg, 1) + "^\\circ";
    },
    status: function (v) {
      var g = geo(v);
      if (!g.ok) return "One vector is zero, so <b>u·v = 0</b> and the angle is undefined.";
      if (Math.abs(g.dot) < 1e-9) return "<b>Perpendicular</b>: u·v = 0, so v casts no shadow on u (θ = 90°).";
      if (g.cos > 1 - 1e-12) return "Same direction (θ = 0°): the shadow is all of v, so u·v = |u||v| = <b>" + Viz.fmt(g.dot) + "</b>.";
      if (g.cos < -1 + 1e-12) return "Opposite directions (θ = 180°): u·v = −|u||v| = <b>" + Viz.fmt(g.dot) + "</b>.";
      if (g.dot > 0) return "Acute angle θ = <b>" + Viz.fmt(g.deg, 1) + "°</b>: v's shadow points along u, so u·v = <b>" + Viz.fmt(g.dot) + "</b> is positive.";
      return "Obtuse angle θ = <b>" + Viz.fmt(g.deg, 1) + "°</b>: v's shadow points back against u, so u·v = <b>" + Viz.fmt(g.dot) + "</b> is negative.";
    },
    examples: [
      {name: "perpendicular", values: {uX: 2, uY: 1, vX: -1, vY: 2}},
      {name: "obtuse", values: {uX: 3, uY: 1, vX: -2.5, vY: 1.5}},
      {name: "same direction", values: {uX: 2, uY: 1, vX: 4, vY: 2}},
      {name: "opposite corners", values: {uX: -5, uY: -5, vX: 5, vY: 5}}
    ],
    size: [380, 300],
    draw: function (api, v) {
      var g = geo(v), c = api.color;
      var e = Math.max(4, Math.ceil(Math.max(Math.abs(v.uX), Math.abs(v.uY), Math.abs(v.vX), Math.abs(v.vY))) + 1);
      var pl = api.plane({x: [-e * 1.2, e * 1.2], y: [-e, e], ticks: false, step: 1});
      var O = pl.px([0, 0]), U = pl.px([v.uX, v.uY]), V = pl.px([v.vX, v.vY]);
      if (g.nu > 1e-9) pl.lineThrough([0, 0], [v.uX, v.uY], {color: c.faint, width: 1.2, dash: "3 5"});
      if (g.ok) {
        // v's shadow on u: the foot of the perpendicular from v's tip, signed by the dot product
        var t = g.dot / (g.nu * g.nu), F = pl.px([t * v.uX, t * v.uY]), sc = g.dot >= 0 ? c.c4 : c.c5;
        var ux = v.uX / g.nu, uy = v.uY / g.nu;
        if (Math.hypot(F[0] - V[0], F[1] - V[1]) > 2) {
          api.line(V, F, {color: c.muted, width: 1.4, dash: "4 4"});
          // right-angle mark where the drop meets the line through u
          var dx = (V[0] - F[0]), dy = (V[1] - F[1]), dl = Math.hypot(dx, dy), m = 8, sx = ux * m, sy = -uy * m;
          if (t > 0) { sx = -sx; sy = -sy; }
          var px = dx / dl * m, py = dy / dl * m;
          if (Math.hypot(F[0] - O[0], F[1] - O[1]) > 10) api.polyline([[F[0] + px, F[1] + py], [F[0] + px + sx, F[1] + py + sy], [F[0] + sx, F[1] + sy]], {stroke: c.muted, width: 1.2});
        }
        if (Math.abs(g.dot) > 1e-9) {
          // the shadow as a dimension bar beside the line through u, on the side away from v
          var side = (v.uX * v.vY - v.uY * v.vX) >= 0 ? 1 : -1, nx = uy * side, ny = ux * side, o = 11;
          var A0 = [O[0] + nx * o, O[1] + ny * o], A1 = [F[0] + nx * o, F[1] + ny * o];
          api.line(A0, A1, {color: sc, width: 5, opacity: 0.9});
          api.line([O[0] + nx * 5, O[1] + ny * 5], [O[0] + nx * 17, O[1] + ny * 17], {color: sc, width: 1.5});
          api.line([F[0] + nx * 5, F[1] + ny * 5], [F[0] + nx * 17, F[1] + ny * 17], {color: sc, width: 1.5});
          var lx = (A0[0] + A1[0]) / 2 + nx * 16, ly = (A0[1] + A1[1]) / 2 + ny * 16;
          api.label([lx, ly], "shadow " + api.fmt(g.comp), {color: sc, size: 12.5, weight: 650, anchor: nx > 0.35 ? "start" : nx < -0.35 ? "end" : "middle"});
        }
        // the angle: an arc from u to v, or a square at 90°
        var a1 = Math.atan2(v.uY, v.uX), a2 = Math.atan2(v.vY, v.vX), d = a2 - a1;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d <= -Math.PI) d += 2 * Math.PI;
        var r = Math.max(16, Math.min(30, 0.45 * Math.min(Math.hypot(U[0] - O[0], U[1] - O[1]), Math.hypot(V[0] - O[0], V[1] - O[1]))));
        if (Math.abs(g.dot) < 1e-9) {
          var q = r * 0.5, b1 = [Math.cos(a1), -Math.sin(a1)], b2 = [Math.cos(a2), -Math.sin(a2)];
          api.polyline([[O[0] + b1[0] * q, O[1] + b1[1] * q], [O[0] + (b1[0] + b2[0]) * q, O[1] + (b1[1] + b2[1]) * q], [O[0] + b2[0] * q, O[1] + b2[1] * q]], {stroke: c.ink, width: 1.6});
        } else if (Math.abs(d) > 1e-6) {
          var pts = [];
          for (var k = 0; k <= 32; k++) { var a = a1 + d * k / 32; pts.push([O[0] + r * Math.cos(a), O[1] - r * Math.sin(a)]); }
          api.polyline(pts, {stroke: c.ink, width: 1.6});
        }
        var am = a1 + d / 2;
        api.label([O[0] + (r + 10) * Math.cos(am), O[1] - (r + 10) * Math.sin(am)], "θ", {color: c.ink, size: 14, weight: 650, anchor: "middle", italic: true});
      }
      api.arrow(O, U, {color: c.c1, label: "u"});
      api.arrow(O, V, {color: c.c3, label: "v"});
      api.point(O, {color: c.ink, r: 3.5});
      api.handle(U, {color: c.c1, plane: pl, snap: 0.5, onDrag: function (q) { api.set({uX: q[0], uY: q[1]}); }});
      api.handle(V, {color: c.c3, plane: pl, snap: 0.5, onDrag: function (q) { api.set({vX: q[0], vY: q[1]}); }});
    }
  });
})();
