// Start from a map described in words (rotate, reflect, project) and build its matrix: follow e1 and e2,
// write where they land as the two columns. The letter F rides along so the whole map is visible, and
// the matrix on the right is colored column by column to match the arrows.
(function () {
  var D = Math.PI / 180;
  function matrix(v) { // [[a, b], [c, d]] for the chosen map
    var t = v.theta * D, cs = Math.cos(t), sn = Math.sin(t);
    if (v.map === "rotation") return [[cs, -sn], [sn, cs]];
    if (v.map === "reflection") return [[Math.cos(2 * t), Math.sin(2 * t)], [Math.sin(2 * t), -Math.cos(2 * t)]];
    return [[cs * cs, cs * sn], [cs * sn, sn * sn]];
  }
  function clean(x) { return Math.abs(x) < 5e-10 ? 0 : x; }
  function pair(x, y) { return "(" + Viz.fmt(clean(x)) + ", " + Viz.fmt(clean(y)) + ")"; }

  Viz.register("matrix-of-a-map", {
    title: "The matrix of a linear map",
    subject: "linear-algebra",
    shows: "The columns of the matrix are the images of the basis vectors",
    params: {
      map: {kind: "enum", values: ["rotation", "reflection", "projection"], default: "rotation", label: "map"},
      theta: {kind: "number", default: 30, min: -180, max: 180, step: 5, label: "\\theta^\\circ"}
    },
    formula: function (v) {
      var M = matrix(v), n = function (x) { return Viz.n(clean(x)); };
      return "[T]=\\big[\\,T\\mathbf e_1\\;\\;T\\mathbf e_2\\,\\big]=\\begin{pmatrix}" + n(M[0][0]) + "&" + n(M[0][1]) + "\\\\" + n(M[1][0]) + "&" + n(M[1][1]) + "\\end{pmatrix}";
    },
    status: function (v) {
      var M = matrix(v), a = pair(M[0][0], M[1][0]), b = pair(M[0][1], M[1][1]), th = Viz.fmt(v.theta, 1) + "°";
      if (v.map === "rotation") return "Rotating by " + th + " sends e₁ to <b>" + a + "</b> and e₂ to <b>" + b + "</b>; those are the columns, and det = 1 (areas kept).";
      if (v.map === "reflection") return "Reflecting across the line at " + th + " sends e₁ to <b>" + a + "</b> and e₂ to <b>" + b + "</b>; det = −1 because the F comes out mirrored.";
      return "Projecting onto the line at " + th + " drops e₁ to <b>" + a + "</b> and e₂ to <b>" + b + "</b>; both land on one line, so det = 0.";
    },
    examples: [
      {name: "rotate 90 degrees", values: {map: "rotation", theta: 90}},
      {name: "reflect across y = x", values: {map: "reflection", theta: 45}},
      {name: "project onto the x-axis", values: {map: "projection", theta: 0}},
      {name: "rotate 180 degrees", values: {map: "rotation", theta: 180}}
    ],
    size: [400, 270],
    draw: function (api, v) {
      var c = api.color, M = matrix(v), T = function (q) { return [M[0][0] * q[0] + M[0][1] * q[1], M[1][0] * q[0] + M[1][1] * q[1]]; };
      var pl = api.plane({x: [-1.45, 1.45], y: [-1.45, 1.45], box: [6, 6, 262, 258], step: 0.5, ticks: false, labels: false});
      var O = pl.px([0, 0]), t = v.theta * D, dir = [Math.cos(t), Math.sin(t)];
      api.circle(O, pl.sx, {stroke: c.faint, width: 1, dash: "2 4"});
      // the line the map is built from, or the rotation angle
      if (v.map === "rotation") {
        if (Math.abs(v.theta) > 0.5) {
          var r = 0.32 * pl.sx, large = Math.abs(v.theta) > 180 ? 1 : 0, sweep = v.theta > 0 ? 0 : 1;
          api.path("M " + (O[0] + r) + " " + O[1] + " A " + r + " " + r + " 0 " + large + " " + sweep + " " + (O[0] + r * dir[0]) + " " + (O[1] - r * dir[1]), {stroke: c.c6, width: 2});
          var h = t / 2;
          api.label([O[0] + (r + 13) * Math.cos(h), O[1] - (r + 13) * Math.sin(h)], "θ", {color: c.c6, size: 14, weight: 650, anchor: "middle"});
        }
      } else {
        pl.lineThrough([0, 0], dir, {color: c.c6, width: 2, dash: "7 5"});
        var end = pl.through([0, 0], dir)[0]; // the far end from the F, so the label stays clear of the arrows
        var lp = pl.px([end[0] * 0.8, end[1] * 0.8]);
        api.label([lp[0] - 13 * dir[1], lp[1] - 13 * dir[0]], v.map === "reflection" ? "mirror" : "line", {color: c.c6, size: 12.5, weight: 600, anchor: "middle"});
        // each basis vector travels at right angles to (reflection) or onto (projection) the line
        [[1, 0], [0, 1]].forEach(function (e) { api.line(pl.px(e), pl.px(T(e)), {color: c.muted, width: 1.2, dash: "3 3"}); });
      }
      // the letter F before (dashed) and after (filled): it shows whether the map flips or flattens
      var F = [[0.2, 0], [0.4, 0], [0.4, 0.45], [0.7, 0.45], [0.7, 0.62], [0.4, 0.62], [0.4, 0.8], [0.85, 0.8], [0.85, 1], [0.2, 1]];
      api.polygon(F.map(pl.px), {stroke: c.muted, dash: "3 3", width: 1, fillOpacity: 0});
      api.polygon(F.map(function (q) { return pl.px(T(q)); }), {fill: c.c2, fillOpacity: 0.28, stroke: c.c2, width: 1.5});
      // e1, e2 and where they land
      var Te1 = T([1, 0]), Te2 = T([0, 1]), near = function (e) { return [Te1, Te2].some(function (q) { return Math.hypot(q[0] - e[0], q[1] - e[1]) < 0.15; }); };
      api.arrow(O, pl.px([1, 0]), {color: c.muted, width: 1.6, halo: false, head: 8, label: near([1, 0]) ? "" : "e_1", labelOffset: [8, 12], labelSize: 12.5});
      api.arrow(O, pl.px([0, 1]), {color: c.muted, width: 1.6, halo: false, head: 8, label: near([0, 1]) ? "" : "e_2", labelOffset: [-14, 4], labelSize: 12.5});
      var side = v.map === "projection" ? -1 : 1, u2 = [Te2[0], Te2[1]], L2 = Math.hypot(u2[0], u2[1]) || 1;
      api.arrow(O, pl.px(Te1), {color: c.c1, label: "T(e_1)"});
      api.arrow(O, pl.px(Te2), {color: c.c3, label: "T(e_2)", labelOffset: side < 0 ? [14 * u2[1] / L2, 14 * u2[0] / L2 + 4] : null});
      api.point(O, {r: 3});
      [[Te1, c.c1, "T(e_1) = 0", 16], [Te2, c.c3, "T(e_2) = 0", -16]].forEach(function (z) { // a basis vector crushed to 0
        if (Math.hypot(z[0][0], z[0][1]) < 1e-6) api.point(O, {color: z[1], r: 5, label: z[2], dx: 8, dy: z[3], size: 12.5});
      });
      // the matrix, column by column in the arrows' colors
      var x1 = 318, x2 = 370, yTop = 104, yBot = 170;
      api.label([344, 80], "[T]", {color: c.ink, size: 14, weight: 650, anchor: "middle"});
      api.path("M 294 " + yTop + " h -6 v " + (yBot - yTop) + " h 6", {stroke: c.ink, width: 1.6});
      api.path("M 394 " + yTop + " h 6 v " + (yBot - yTop) + " h -6", {stroke: c.ink, width: 1.6});
      api.label([x1, 122], api.fmt(clean(M[0][0])), {color: c.c1, size: 14, weight: 650, anchor: "middle"});
      api.label([x1, 152], api.fmt(clean(M[1][0])), {color: c.c1, size: 14, weight: 650, anchor: "middle"});
      api.label([x2, 122], api.fmt(clean(M[0][1])), {color: c.c3, size: 14, weight: 650, anchor: "middle"});
      api.label([x2, 152], api.fmt(clean(M[1][1])), {color: c.c3, size: 14, weight: 650, anchor: "middle"});
      api.label([x1, 190], "T(e_1)", {color: c.c1, size: 12, anchor: "middle"});
      api.label([x2, 190], "T(e_2)", {color: c.c3, size: 12, anchor: "middle"});
      var det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
      api.label([344, 222], "det = " + api.fmt(clean(det)), {color: c.muted, size: 12.5, anchor: "middle"});
    }
  });
})();
