// Resolving a vector into components: a vector of length r at angle theta (degrees, measured counterclockwise from the
// positive x-axis, negative = clockwise) has x = r cos(theta) and y = r sin(theta). The x component runs along the x-axis
// (teal) and the y component stands on its tip (amber), tip to tail, so the three arrows make a right triangle with
// r as its hypotenuse. The plane zooms in steps (1, 1.5, 2, ... 8 times a power of ten) so the vector always fills it; drag the
// tip to set r and theta together.
(function () {
  function nice(x) { // the next of 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10 times a power of ten
    var e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e, s = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < s.length; i++) if (f <= s[i] + 1e-9) return s[i] * e;
    return 10 * e;
  }
  function comp(v) {
    var t = v.angleDeg * Math.PI / 180, x = v.magnitude * Math.cos(t), y = v.magnitude * Math.sin(t);
    if (Math.abs(x) < 1e-9 * v.magnitude) x = 0; if (Math.abs(y) < 1e-9 * v.magnitude) y = 0;   // cos 90°, sin 180° are 0, not 6e-17
    return {x: x, y: y};
  }
  function dg(r) { return r < 1 ? 3 : r < 100 ? 2 : 1; }

  Viz.register("vector-components", {
    title: "Resolving a vector into components",
    subject: "physics",
    shows: "Set the length and the angle, or drag the tip: the vector splits into an x part r cos θ and a y part r sin θ, with signs set by the quadrant",
    params: {
      magnitude: {kind: "number", default: 6, min: 0.1, max: 100, step: 0.1, label: "r"},
      angleDeg: {kind: "number", default: 35, min: -180, max: 180, step: 1, label: "\\theta\\ (°)"}
    },
    formula: function (v) {
      var q = comp(v), d = dg(v.magnitude), r = Viz.n(v.magnitude, 2), th = Viz.n(v.angleDeg, 1);
      return "\\begin{array}{l}x=r\\cos\\theta,\\quad y=r\\sin\\theta\\\\[4pt]x=" + r + "\\cos(" + th + "^\\circ)=" + Viz.n(q.x, d) + "\\\\[2pt]y=" + r + "\\sin(" + th + "^\\circ)=" + Viz.n(q.y, d) + "\\end{array}";
    },
    status: function (v) {
      var q = comp(v), d = dg(v.magnitude), a = v.angleDeg, X = Viz.fmt(q.x, d), Y = Viz.fmt(q.y, d);
      if (q.y === 0) return "On the " + (q.x > 0 ? "positive" : "negative") + " x-axis: all of the length is in <b>x = " + X + "</b> and y = 0.";
      if (q.x === 0) return "Straight " + (q.y > 0 ? "up" : "down") + " the y-axis: all of the length is in <b>y = " + Y + "</b> and x = 0.";
      var quad = q.x > 0 ? (q.y > 0 ? "I" : "IV") : (q.y > 0 ? "II" : "III");
      var dir = (q.y > 0 ? "up" : "down") + " and to the " + (q.x > 0 ? "right" : "left");
      return "Quadrant " + quad + ", pointing " + dir + ": <b>x = " + X + "</b>, <b>y = " + Y + "</b>, and x² + y² = r² = " + Viz.fmt(v.magnitude * v.magnitude, 2) + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {magnitude: 0.1, angleDeg: -180}},
      {name: "Maximum supported values", values: {magnitude: 100, angleDeg: 180}},
      {name: "quadrant II", values: {magnitude: 10, angleDeg: 120}},
      {name: "below the axis (negative angle)", values: {magnitude: 8, angleDeg: -60}},
      {name: "straight up", values: {magnitude: 5, angleDeg: 90}}
    ],
    size: [380, 300],
    draw: function (api, v) {
      var c = api.color, q = comp(v), r = v.magnitude, d = dg(r), e = nice(r * 1.12);
      var pl = api.plane({x: [-e * 1.25, e * 1.25], y: [-e, e], step: e / 4, ticks: false, labels: false});
      // grid every e/4; numbers only at +-e, each axis's numbers on the side away from the vector (the arrows' labels name x and y)
      var O = pl.px([0, 0]), Px = pl.px([q.x, 0]), P = pl.px([q.x, q.y]), ts = q.y < 0 ? -12 : 14;
      [-e, e].forEach(function (t) {
        api.label([pl.x(t), O[1] + ts], api.fmt(t, 3), {color: c.muted, size: 12, anchor: "middle"});
        api.label([O[0] + (q.x > 0 ? -6 : 6), pl.y(t)], api.fmt(t, 3), {color: c.muted, size: 12, anchor: q.x > 0 ? "end" : "start"});
      });
      // dashed projection onto the y-axis, so y can be read there too (skipped when y is too short to need it)
      if (q.x !== 0 && Math.abs(P[1] - Px[1]) >= 28) api.line(P, pl.px([0, q.y]), {color: c.c3, width: 1.2, dash: "3 4", opacity: 0.7});
      // angle arc from the positive x-axis
      var th = v.angleDeg * Math.PI / 180, ar = Math.max(22, Math.min(46, 0.3 * Math.hypot(P[0] - O[0], P[1] - O[1])));
      if (Math.abs(v.angleDeg) > 0.5) {
        var steps = Math.max(8, Math.ceil(Math.abs(v.angleDeg) / 6)), arc = [];
        for (var i = 0; i <= steps; i++) { var a = th * i / steps; arc.push([O[0] + ar * Math.cos(a), O[1] - ar * Math.sin(a)]); }
        api.polyline(arc, {stroke: c.c6, width: 2});
        // the label stays outside the right triangle: up to 90 degrees the triangle fills the arc, so the label goes just past r;
        // beyond 90 the triangle hangs off the far side of r, so the label goes on the arc's bisector
        var past = Math.abs(v.angleDeg) <= 90, ma = past ? th + (th > 0 ? 1 : -1) * 16 * Math.PI / 180 : th / 2, lr = ar + 14;
        var anc = past ? "end" : Math.cos(ma) < -0.3 ? "end" : Math.cos(ma) > 0.3 ? "start" : "middle";   // past r, the text runs away from it
        api.label([O[0] + lr * Math.cos(ma), O[1] - lr * Math.sin(ma)], "θ = " + api.fmt(v.angleDeg, 1) + "°", {color: c.c6, size: 12.5, weight: 650, anchor: anc});
      }
      // the components, tip to tail, then r on top
      if (q.x !== 0) api.arrow(O, Px, {color: c.c1, width: 3, halo: false});
      if (q.y !== 0) api.arrow(Px, P, {color: c.c3, width: 3, halo: false});
      if (q.x !== 0 && q.y !== 0) {   // right-angle mark where the components meet
        var sx = q.x > 0 ? -8 : 8, sy = q.y > 0 ? -8 : 8;
        api.polyline([[Px[0] + sx, Px[1]], [Px[0] + sx, Px[1] + sy], [Px[0], Px[1] + sy]], {stroke: c.muted, width: 1.2});
      }
      api.arrow(O, P, {color: c.c2, width: 3.2});
      // labels: x under (or over) its arrow, y beside its arrow away from r, r beyond the tip
      if (q.x !== 0) api.label([(O[0] + Px[0]) / 2, Px[1] + (q.y > 0 ? 30 : -14)], "x = " + api.fmt(q.x, d), {color: c.c1, size: 13, weight: 700, anchor: "middle"});
      var gap = Math.abs(P[1] - Px[1]) < 28 ? 13 : 8;   // clear of the tip's handle when the y arrow is short
      if (q.y !== 0) api.label([Px[0] + (q.x >= 0 ? gap : -gap), (Px[1] + P[1]) / 2], "y = " + api.fmt(q.y, d), {color: c.c3, size: 13, weight: 700, anchor: q.x >= 0 ? "start" : "end"});
      // r's name past the tip, nudged off the triangle's side (perpendicular, toward the vector's own y side)
      var ux = Math.cos(th), uy = Math.sin(th), sg = q.y < 0 ? -1 : 1, nx = -uy * sg * (ux < 0 ? -1 : 1), ny = ux * sg * (ux < 0 ? -1 : 1);
      if (ny * sg < 0) { nx = -nx; ny = -ny; }
      var shortY = Math.abs(P[1] - Px[1]) < 28, along = shortY ? 4 : 16, side = shortY ? 20 : 12;   // a short y arrow keeps its label by the tip, so r moves up off it
      if (Math.abs(uy) > 0.9) {   // near vertical: beside the tip, on the side away from the y-axis numbers
        var left = q.x <= 0;
        api.label([P[0] + (left ? -12 : 12), P[1] - uy * 10], "r = " + api.fmt(r, 2), {color: c.c2, size: 13, weight: 700, anchor: left ? "end" : "start"});
      } else api.label([P[0] + ux * along + nx * side, P[1] - uy * along - ny * side], "r = " + api.fmt(r, 2), {color: c.c2, size: 13, weight: 700, anchor: ux > 0.3 ? "start" : ux < -0.3 ? "end" : "middle"});
      api.handle(P, {color: c.c2, plane: pl, onDrag: function (m) {
        var R = Math.round(Math.min(100, Math.max(0.1, Math.hypot(m[0], m[1]))) * 10) / 10, A = Math.round(Math.atan2(m[1], m[0]) * 180 / Math.PI);
        api.set({magnitude: R, angleDeg: A});
      }});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
