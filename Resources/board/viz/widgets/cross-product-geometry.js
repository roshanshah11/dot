// a and b lie in a floor plane drawn in 3D; a × b stands straight out of it. Its length is the area of the
// parallelogram they span, |a||b| sin θ (base |a| times height |b| sin θ), its direction follows the right-hand
// rule, and b × a is the same arrow turned the other way. Lengths in the floor and the arrow's length use fixed
// scales (the arrow is an area, so it gets its own ruler), so nothing is rescaled behind his back.
Viz.register("cross-product-geometry", {
  title: "Cross product: area and direction",
  subject: "calculus",
  shows: "Change the lengths and the angle: a × b stands perpendicular to both, its length is the parallelogram's area |a||b| sin θ, and b × a points the other way",
  params: {
    magnitudeA: {kind: "number", default: 3, min: 0.5, max: 6, step: 0.1, label: "\\|\\vec a\\|"},
    magnitudeB: {kind: "number", default: 2.5, min: 0.5, max: 6, step: 0.1, label: "\\|\\vec b\\|"},
    angleDeg: {kind: "number", default: 60, min: 5, max: 175, step: 1, label: "\\theta"},
    order: {kind: "enum", values: ["axb", "bxa"], names: {axb: "a × b", bxa: "b × a"}, default: "axb", label: "order"}
  },
  formula: function (v) {
    var area = v.magnitudeA * v.magnitudeB * Math.sin(v.angleDeg * Math.PI / 180);
    var mag = "\\|\\vec a\\|\\,\\|\\vec b\\|\\sin\\theta=" + Viz.n(v.magnitudeA) + "\\cdot" + Viz.n(v.magnitudeB) + "\\cdot\\sin" + Viz.n(v.angleDeg, 1) + "^\\circ=" + Viz.n(area, 2);
    if (v.order === "axb") return "\\|\\vec a\\times\\vec b\\|=" + mag;
    return "\\begin{array}{l}\\vec b\\times\\vec a=-(\\vec a\\times\\vec b)\\\\\\|\\vec b\\times\\vec a\\|=" + mag + "\\end{array}";
  },
  status: function (v) {
    var th = v.angleDeg, area = v.magnitudeA * v.magnitudeB * Math.sin(th * Math.PI / 180), A = Viz.fmt(area, 2);
    var dir = v.order === "axb" ? "a × b points <b>up</b>" : "b × a points <b>down</b>";
    if (th <= 10 || th >= 170) return "Nearly parallel: the parallelogram is a sliver, so " + dir + " but is short, only <b>" + A + "</b> long.";
    if (th === 90) return "Perpendicular: sin θ = 1, so the area reaches its largest value |a||b| = <b>" + A + "</b>, and " + dir + ".";
    if (v.order === "axb") return "Curl your right hand from a toward b: " + dir + ", perpendicular to both, with length <b>" + A + "</b>, the shaded area.";
    return "Curling from b toward a turns the other way, so " + dir + ": the same length <b>" + A + "</b>, opposite direction.";
  },
  examples: [
    {name: "Minimum supported values", values: {magnitudeA: 0.5, magnitudeB: 0.5, angleDeg: 5}},
    {name: "Maximum supported values", values: {magnitudeA: 6, magnitudeB: 6, angleDeg: 175}},
    {name: "order: bxa", values: {order: "bxa"}},
    {name: "perpendicular, largest area", values: {magnitudeA: 4, magnitudeB: 3, angleDeg: 90}}
  ],
  size: [400, 330],
  draw: function (api, v) {
    var c = api.color, D = Math.PI / 180, th = v.angleDeg * D, a = v.magnitudeA, b = v.magnitudeB;
    var area = a * b * Math.sin(th), up = v.order === "axb" ? 1 : -1;
    // orthographic view: camera azimuth -70°, elevation 25°; x (along a) runs right, y recedes up-right, z is up
    var sa = Math.sin(-70 * D), ca = Math.cos(-70 * D), se = Math.sin(25 * D);
    var s = 19, cx = 135, cy = 168, pz = 3.8;   // 19 px per unit of length; 3.8 px per unit of area on the normal
    var P = function (x, y) { return [cx + s * (-x * sa + y * ca), cy - s * (-x * ca * se - y * sa * se)]; };
    var bx = b * Math.cos(th), by = b * Math.sin(th);
    // the floor tile (the plane of a and b) with a unit grid
    var x0 = Math.floor(Math.min(0, bx) - 0.5), x1 = Math.ceil(Math.max(a, a + bx) + 0.5), y0 = -1, y1 = Math.ceil(by + 0.5);
    api.polygon([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], {fill: c.muted, fillOpacity: 0.06, stroke: c.grid, width: 1});
    for (var gx = x0; gx <= x1; gx++) api.line(P(gx, y0), P(gx, y1), {color: c.grid, width: 1});
    for (var gy = y0; gy <= y1; gy++) api.line(P(x0, gy), P(x1, gy), {color: c.grid, width: 1});
    var O = P(0, 0), Ap = P(a, 0), Bp = P(bx, by), S = P(a + bx, by), C = P((a + bx) / 2, by / 2);
    // the down-pointing b × a goes under the floor, so draw it before the parallelogram
    var tip = [C[0], C[1] - up * area * pz];
    var drawNormal = function () {
      if (area * pz > 2) api.arrow(C, tip, {color: c.c6, width: 3.5});
      else api.point(C, {color: c.c6, r: 3.5});
      var nl = v.order === "axb" ? "a × b" : "b × a";
      api.label([tip[0] + 12, tip[1] + (up > 0 ? 4 : -4)], nl + "  (length " + api.fmt(area, 2) + ")", {color: c.c6, size: 13, weight: 650});
    };
    if (up < 0) drawNormal();
    api.polygon([O, Ap, S, Bp], {fill: c.c2, fillOpacity: 0.22, stroke: c.c2, width: 1.5});
    // height of the parallelogram: from b's tip straight across to a's line
    var F = P(bx, 0);
    if (bx < 0 || bx > a) api.line(bx < 0 ? O : Ap, F, {color: c.faint, width: 1.2, dash: "3 4"});
    if (by * s * 0.4 > 6) {
      api.line(Bp, F, {color: c.c2, width: 1.4, dash: "4 3"});
      var k = Math.min(0.3, by * 0.3), sg = bx > a ? -1 : 1;
      api.polyline([P(bx + sg * k, 0), P(bx + sg * k, k), P(bx, k)], {stroke: c.c2, width: 1.2});
      api.label([(Bp[0] + F[0]) / 2 + 8, (Bp[1] + F[1]) / 2], "h = |b| sin θ", {color: c.c2, size: 12});
    }
    // the angle from a to b, with the turning direction of the product (a toward b, or b toward a)
    var rho = Math.min(1.1, 0.42 * Math.min(a, b)), arc = [];
    for (var i = 0; i <= 24; i++) { var t = th * i / 24; arc.push(P(rho * Math.cos(t), rho * Math.sin(t))); }
    if (up < 0) arc.reverse();
    api.polyline(arc, {stroke: c.ink, width: 1.6, arrow: true});
    var mid = P((rho + 0.55) * Math.cos(th / 2), (rho + 0.55) * Math.sin(th / 2));
    api.label([mid[0] + 2, mid[1] - 2], Viz.fmt(v.angleDeg, 1) + "°", {color: c.ink, size: 12.5, anchor: "middle"});
    api.arrow(O, Ap, {color: c.c1, label: "a"});
    api.arrow(O, Bp, {color: c.c3, label: "b"});
    api.point(O, {color: c.ink, r: 3});
    if (up > 0) drawNormal();
    api.label([12, api.h - 14], "shaded area = " + api.fmt(area, 2) + " = length of " + (up > 0 ? "a × b" : "b × a"), {color: c.c2, size: 12.5});
  }
});
