// Eigendirections of a 2x2 matrix: the lines A maps onto themselves. The unit circle goes to an ellipse; a probe x
// shows that Ax leaves x's line everywhere except along an eigendirection, where Ax = λx.
(function () {
  function eig(v) {
    var a = v.a11, b = v.a12, c = v.a21, d = v.a22, tr = a + d, det = a * d - b * c, disc = tr * tr / 4 - det;
    var r = {tr: tr, det: det};
    if (disc < -1e-12) { r.kind = "complex"; r.re = tr / 2; r.im = Math.sqrt(-disc); return r; }
    var s = Math.sqrt(Math.max(0, disc));
    var vec = function (l) { // a nonzero solution of (A - lI)v = 0, from whichever row of A - lI is nonzero
      var p = [b, l - a], q = [l - d, c], u = Math.hypot(p[0], p[1]) >= Math.hypot(q[0], q[1]) ? p : q, n = Math.hypot(u[0], u[1]);
      return n > 1e-12 ? [u[0] / n, u[1] / n] : null;
    };
    r.l1 = tr / 2 + s; r.l2 = tr / 2 - s;
    if (s < 1e-9) {
      r.kind = Math.abs(b) < 1e-12 && Math.abs(c) < 1e-12 ? "scalar" : "defective";
      r.v1 = vec(r.l1);
    } else { r.kind = "real"; r.v1 = vec(r.l1); r.v2 = vec(r.l2); }
    return r;
  }
  function term(k, s) {
    if (Math.abs(k) < 1e-12) return "";
    var m = Math.abs(k);
    return (k < 0 ? "-" : "+") + (s && Math.abs(m - 1) < 1e-12 ? "" : Viz.n(m)) + s;
  }
  Viz.register("eigendirections", {
    title: "Eigenvectors: the directions a matrix keeps",
    subject: "linear-algebra",
    shows: "Change A and drag the probe x around the circle: Ax swings off x's line except along an eigendirection, where A only stretches by λ",
    params: {
      a11: {kind: "number", default: 2, min: -2, max: 2, step: 0.25, label: "a_{11}"},
      a12: {kind: "number", default: 1, min: -2, max: 2, step: 0.25, label: "a_{12}"},
      a21: {kind: "number", default: 1, min: -2, max: 2, step: 0.25, label: "a_{21}"},
      a22: {kind: "number", default: 2, min: -2, max: 2, step: 0.25, label: "a_{22}"},
      t: {kind: "number", default: 15, min: 0, max: 360, step: 1, label: "x angle", control: false}
    },
    formula: function (v) {
      var e = eig(v), lam = e.kind === "complex" ? (Math.abs(e.re) > 1e-12 ? Viz.n(e.re) : "") + "\\pm " + (Math.abs(e.im - 1) < 1e-12 ? "" : Viz.n(e.im)) + "i" :
        e.kind === "real" ? Viz.n(e.l1) + ",\\ " + Viz.n(e.l2) : Viz.n(e.l1) + "\\ (\\text{twice})";
      return "A\\mathbf{v}=\\lambda\\mathbf{v}:\\ \\lambda^2" + term(-e.tr, "\\lambda") + term(e.det, "") + "=0\\Rightarrow\\lambda=" + lam;
    },
    status: function (v) {
      var e = eig(v);
      if (e.kind === "complex") return "Complex eigenvalues " + (Math.abs(e.re) > 1e-12 ? Viz.fmt(e.re) + " " : "") + "± " + (Math.abs(e.im - 1) < 1e-12 ? "" : Viz.fmt(e.im)) + "i: A turns every vector, so <b>no real direction</b> stays on its line.";
      if (e.kind === "scalar") return "A = " + Viz.fmt(e.l1) + "I: <b>every</b> vector is an eigenvector with λ = " + Viz.fmt(e.l1) + ".";
      if (e.kind === "defective") return "Repeated λ = <b>" + Viz.fmt(e.l1) + "</b> but only <b>one</b> eigendirection: A shears everything else off its line.";
      var th = v.t * Math.PI / 180, x = [Math.cos(th), Math.sin(th)], Ax = [v.a11 * x[0] + v.a12 * x[1], v.a21 * x[0] + v.a22 * x[1]];
      if (Math.abs(x[0] * Ax[1] - x[1] * Ax[0]) < 1e-9) return "x lies on an eigendirection, so Ax = <b>" + Viz.fmt(x[0] * Ax[0] + x[1] * Ax[1]) + "x</b>: A only stretches it along its own line.";
      var say = function (l) { return Math.abs(l) < 1e-9 ? "crushes it to 0" : l < 0 ? "flips it and scales by " + Viz.fmt(-l) : "scales it by " + Viz.fmt(l); };
      return "Two eigendirections: along v₁ A " + say(e.l1) + " (λ₁ = <b>" + Viz.fmt(e.l1) + "</b>), along v₂ it " + say(e.l2) + " (λ₂ = <b>" + Viz.fmt(e.l2) + "</b>).";
    },
    examples: [
      {name: "minimum (all entries -2)", values: {a11: -2, a12: -2, a21: -2, a22: -2}},
      {name: "maximum (all entries 2)", values: {a11: 2, a12: 2, a21: 2, a22: 2}},
      {name: "rotation: no real eigenvectors", values: {a11: 0, a12: -1, a21: 1, a22: 0}},
      {name: "shear: one eigendirection", values: {a11: 1, a12: 1, a21: 0, a22: 1}},
      {name: "probe on an eigenvector", values: {t: 45}},
      {name: "scalar matrix", values: {a11: 1.5, a12: 0, a21: 0, a22: 1.5}}
    ],
    size: [380, 300],
    draw: function (api, v) {
      var c = api.color, e = eig(v), T = function (q) { return [v.a11 * q[0] + v.a12 * q[1], v.a21 * q[0] + v.a22 * q[1]]; };
      var ring = [], big = 1;
      for (var k = 0; k < 96; k++) { var a = 2 * Math.PI * k / 96, q = T([Math.cos(a), Math.sin(a)]); ring.push(q); big = Math.max(big, Math.hypot(q[0], q[1])); }
      var ext = Math.max(1.7, big * 1.1 + 0.25);
      var pl = api.plane({x: [-ext * 1.25, ext * 1.25], y: [-ext, ext], ticks: false, labels: false, step: ext > 3 ? 1 : 0.5});
      var O = pl.px([0, 0]), R = pl.sx;
      api.circle(O, R, {stroke: c.muted, width: 1.2, dash: "3 4"});
      api.polygon(ring.map(pl.px), {fill: c.c2, fillOpacity: 0.08, stroke: c.c2, width: 1.4});
      // the image ellipse gets a small tag where it reaches farthest, if that is clear of the circle
      var low = ring.reduce(function (m, q) { return q[1] < m[1] ? q : m; }, ring[0]), LP = pl.px(low);
      if (low[1] < -1.2) api.label([LP[0], LP[1] + 11], "image of the circle", {color: c.c2, size: 12, anchor: "middle"});
      var eigen = function (l, u, col, name) {
        if (!u) return;
        pl.lineThrough([0, 0], u, {color: col, width: 1.4, dash: "6 5", opacity: 0.7});
        api.point(pl.px(u), {color: col, r: 3.5});
        var tip = pl.px([l * u[0], l * u[1]]);
        if (Math.abs(l) * R > 6) api.arrow(O, tip, {color: col, width: 3.5});
        // name the line out near the edge of the plane, on the side the stretched arrow points to
        var dir = l < 0 ? -1 : 1, seg = pl.through([0, 0], u), end = seg[0][0] * u[0] * dir + seg[0][1] * u[1] * dir > 0 ? seg[0] : seg[1];
        var L = pl.px([end[0] * 0.86, end[1] * 0.86]), nx = -u[1] * dir, ny = -u[0] * dir;
        api.label([L[0] + nx * 14, L[1] + ny * 14], name + " = " + api.fmt(l), {color: col, size: 13, weight: 650, anchor: "middle"});
      };
      if (e.kind === "real") { eigen(e.l1, e.v1, c.c1, "λ_1"); eigen(e.l2, e.v2, c.c3, "λ_2"); }
      else if (e.kind === "defective") eigen(e.l1, e.v1, c.c1, "λ");
      else if (e.kind === "scalar") {
        for (var j = 0; j < 8; j++) { var b = j * Math.PI / 4, w = [Math.cos(b), Math.sin(b)]; if (Math.abs(e.l1) * R > 6) api.arrow(O, pl.px([e.l1 * w[0], e.l1 * w[1]]), {color: c.c1, width: 2, halo: false}); }
        api.label([api.w - 10, 16], "every direction: λ = " + api.fmt(e.l1), {color: c.c1, size: 12.5, weight: 650, anchor: "end"});
      } else api.label([api.w - 10, 16], "no real eigendirection", {color: c.c5, size: 12.5, weight: 650, anchor: "end"});
      // the probe: x on the unit circle and where A sends it
      var th = v.t * Math.PI / 180, x = [Math.cos(th), Math.sin(th)], Ax = T(x), X = pl.px(x);
      if (Math.hypot(Ax[0], Ax[1]) * R > 6) api.arrow(O, pl.px(Ax), {color: c.c6, width: 2.5, label: "Ax"});
      else api.label([O[0] + 14, O[1] + 14], "Ax = 0", {color: c.c6, size: 12.5, weight: 650});
      api.arrow(O, X, {color: c.ink, width: 2, halo: false});
      api.label(pl.px([x[0] * 1.45, x[1] * 1.45]), "x", {color: c.ink, size: 14, weight: 650, anchor: "middle"});
      api.point(O, {r: 3});
      api.handle(X, {color: c.ink, r: 6, onDrag: function (p) {
        var ang = Math.atan2(-(p[1] - O[1]), p[0] - O[0]) * 180 / Math.PI;
        api.set({t: Math.round((ang + 360) % 360)});
      }});
    }
  });
})();
