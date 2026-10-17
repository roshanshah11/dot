// The plasma membrane is the cell's whole border with the world: every nutrient in and every waste out has to cross
// it, while the demand for them scales with the cytoplasm's volume. So membrane per unit volume, A/V, sets how well a
// cell is supplied. For a sphere A/V = 4 pi R^2 / (4/3 pi R^3) = 3 / R: doubling the radius halves it, one reason most
// cells stay small. Cells that must exchange a lot flatten or stretch. Shapes here are spheroids of the same volume as
// a sphere of radius R, with axis ratio q = c / a (c along the axis of symmetry): a = R q^(-1/3), c = R q^(2/3).
//   oblate (q < 1, a disc):  e = sqrt(1 - q^2),    A = 2 pi a^2 (1 + (1 - e^2) / e * atanh e)
//   prolate (q > 1, a rod):  e = sqrt(1 - 1/q^2),  A = 2 pi a^2 (1 + q / e * asin e)
// Check: a red blood cell (about 90 fL, 8 um across, 2 um thick) as an oblate spheroid R = 2.78 um, q = 0.25 gives
// A = 138 um^2 (measured about 136 um^2).
(function () {
  function geom(v) {
    var R = v.R, q = v.q, a = R * Math.pow(q, -1 / 3), cc = R * Math.pow(q, 2 / 3), A;
    if (Math.abs(q - 1) < 1e-9) A = 4 * Math.PI * R * R;
    else if (q < 1) { var e = Math.sqrt(1 - q * q); A = 2 * Math.PI * a * a * (1 + (1 - e * e) / e * 0.5 * Math.log((1 + e) / (1 - e))); }
    else { var e2 = Math.sqrt(1 - 1 / (q * q)); A = 2 * Math.PI * a * a * (1 + q / e2 * Math.asin(e2)); }
    var V = 4 / 3 * Math.PI * R * R * R;
    return {a: a, c: cc, A: A, V: V, ratio: A / V, sphere: 3 / R};
  }
  var big = function (x) { return x >= 100 ? Math.round(x).toLocaleString("en-US") : Viz.fmt(x, x >= 10 ? 1 : 2); };
  var tex = function (x) { return big(x).replace(/,/g, "{,}"); };
  function shapeName(q) { return Math.abs(q - 1) < 1e-9 ? "sphere" : q < 1 ? "disc, " + Viz.fmt(1 / q, 1) + " : 1" : "rod, " + Viz.fmt(q, 1) + " : 1"; }
  Viz.register("plasma-membrane-cell-boundary", {
    title: "The membrane as the cell's boundary",
    subject: "biology",
    shows: "Grow the cell or change its shape: everything it uses crosses the plasma membrane, but membrane area per volume falls as 3/R for a sphere, so big cells run short of boundary unless they flatten or stretch",
    params: {
      R: {kind: "number", default: 10, min: 0.5, max: 50, step: 0.5, label: "R\\ (\\mu\\text{m})"},
      q: {kind: "number", default: 1, min: 0.2, max: 5, step: 0.05, label: "\\text{shape}\\ q"}
    },
    formula: function (v) {
      var g = geom(v);
      return "\\text{sphere: }\\tfrac{A}{V}=\\tfrac{3}{R}=\\tfrac{3}{" + Viz.n(v.R, 1) + "}=" + Viz.n(g.sphere, 3) + "\\ \\mu\\text{m}^{-1}" +
        (Math.abs(v.q - 1) < 1e-9 ? "" : "\\newline\\text{this shape: }\\tfrac{" + tex(g.A) + "}{" + tex(g.V) + "}=" + Viz.n(g.ratio, 3) + "\\ \\mu\\text{m}^{-1}");
    },
    status: function (v) {
      var g = geom(v), per = Viz.fmt(g.ratio, g.ratio < 0.1 ? 3 : 2);
      var lead = "This cell has <b>" + big(g.A) + " µm²</b> of membrane around " + big(g.V) + " µm³ of cytoplasm, <b>" + per + " µm²</b> per µm³";
      if (Math.abs(v.q - 1) < 1e-9) return lead + "; at twice the radius it would have half as much boundary per unit of cytoplasm to feed.";
      return lead + "; as a " + (v.q < 1 ? "flattened disc" : "stretched rod") + " it has <b>" + Viz.fmt(g.ratio / g.sphere, 2) + "×</b> the membrane of a sphere holding the same volume.";
    },
    examples: [
      {name: "bacterium-sized sphere", values: {R: 1, q: 1}},
      {name: "typical animal cell", values: {R: 10, q: 1}},
      {name: "large sphere", values: {R: 50, q: 1}},
      {name: "red blood cell proportions", values: {R: 3, q: 0.25}},
      {name: "flattest disc", values: {R: 10, q: 0.2}},
      {name: "long rod", values: {R: 10, q: 5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, g = geom(v), mem = c.c1, cyto = c.c2, sph = c.muted;
      // the cell grows with R: its longest semi-axis runs from 22 px at 0.5 µm to 76 px at 50 µm on a log scale (100x in
      // size cannot fit linearly), so the scale bar is recomputed for each R and stays true
      var CX = 100, CY = 124, t = (Math.log10(v.R) - Math.log10(0.5)) / 2, Lpx = 22 + 54 * t, k = Lpx / Math.max(g.a, g.c), S0 = v.R * k, rx, ry;
      rx = g.a * k; ry = g.c * k;   // edge-on: a disc lies flat, a rod stands upright along its axis
      var shaped = Math.abs(v.q - 1) > 1e-9;
      if (shaped) api.circle([CX, CY], S0, {stroke: sph, width: 1.2, dash: "4 4"});
      api.path("M " + (CX - rx) + " " + CY + " A " + rx + " " + ry + " 0 1 0 " + (CX + rx) + " " + CY + " A " + rx + " " + ry + " 0 1 0 " + (CX - rx) + " " + CY + " Z", {fill: cyto, fillOpacity: 0.18, stroke: mem, width: 4});
      if (shaped) api.line([CX, CY - ry - 6], [CX, CY + ry + 6], {color: c.faint, width: 1, dash: "2 3"});
      // exchange across the boundary: the number of in/out arrows tracks A/V (5 at 0.3 per µm, 3 more per tenfold, 2 to 10),
      // spaced evenly along the membrane, so a big round cell gets sparse supply for its size
      var nArr = Math.max(2, Math.min(10, Math.round(5 + 3 * Math.log10(g.ratio / 0.3)))), o = 15;
      var pts = [], cum = [0];
      for (var j = 0; j <= 360; j++) { var aj = j / 360 * 2 * Math.PI + 0.3; pts.push([aj, CX + rx * Math.cos(aj), CY + ry * Math.sin(aj)]); if (j) cum.push(cum[j - 1] + Math.hypot(pts[j][1] - pts[j - 1][1], pts[j][2] - pts[j - 1][2])); }
      for (var i = 0, jj = 0; i < nArr; i++) {
        while (cum[jj] < i / nArr * cum[360]) jj++;
        var th = pts[jj][0], px = pts[jj][1], py = pts[jj][2];
        var nx = Math.cos(th) / rx, ny = Math.sin(th) / ry, L = Math.hypot(nx, ny); nx /= L; ny /= L;
        var inward = i % 2 === 0, sx = px + nx * (inward ? o : -o * 0.2), sy = py + ny * (inward ? o : -o * 0.2);
        api.line([sx, sy], [px + nx * (inward ? -o * 0.2 : o), py + ny * (inward ? -o * 0.2 : o)], {color: inward ? c.c4 : c.c3, width: 1.8, arrow: true});
      }
      api.label([CX, 16], shapeName(v.q), {color: mem, size: 13, weight: 650, anchor: "middle"});
      api.label([12, 228], "in: O₂, glucose", {color: c.c4, size: 12});
      api.label([12, 244], "out: CO₂, wastes", {color: c.c3, size: 12});
      api.label([12, 260], nArr + " arrows: their count tracks A/V", {color: c.muted, size: 12});
      if (shaped) api.label([12, 276], "dashed: sphere of equal volume", {color: sph, size: 12});
      // scale bar about half of R, rounded to 1, 2 or 5
      var raw = v.R / 2, e10 = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e10, len = (f < 1.5 ? 1 : f < 3.5 ? 2 : 5) * e10, bw = len * k;
      api.line([12, 292], [12 + bw, 292], {color: c.ink, width: 3});
      api.label([18 + bw, 292], api.fmt(len, 1) + " µm", {color: c.ink, size: 12});
      // A/V against radius, log-log: a sphere's 3/R is a straight line of slope -1
      var X0 = 212, X1 = 390, Y0 = 250, Y1 = 40, lx0 = Math.log10(0.5), lx1 = Math.log10(50), ly0 = Math.log10(0.05), ly1 = Math.log10(10);
      var X = function (r) { return X0 + (Math.log10(r) - lx0) / (lx1 - lx0) * (X1 - X0); }, Y = function (q) { return Y0 - (Math.log10(q) - ly0) / (ly1 - ly0) * (Y0 - Y1); };
      api.line([X0, Y0], [X1, Y0], {color: c.axis, width: 1.2}); api.line([X0, Y0], [X0, Y1], {color: c.axis, width: 1.2});
      [0.1, 1, 10].forEach(function (q) { api.label([X0 - 5, Y(q)], String(q), {color: c.muted, size: 12, anchor: "end"}); });
      [1, 10, 50].forEach(function (r) { api.label([X(r), Y0 + 13], String(r), {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([X1, Y0 + 28], "radius R, µm", {color: c.muted, size: 12, anchor: "end"});
      api.label([X0 - 6, Y1 - 16], "A/V, µm² per µm³", {color: c.muted, size: 12});
      var fac = g.ratio / g.sphere, a0 = [], a1 = [];
      for (var lr = lx0; lr <= lx1 + 1e-9; lr += 0.05) { var r = Math.pow(10, lr); a0.push([X(r), Y(3 / r)]); a1.push([X(r), Y(fac * 3 / r)]); }
      api.polyline(a0, {stroke: sph, width: 1.6, dash: "4 4"});
      if (Math.abs(fac - 1) > 1e-6) api.polyline(a1, {stroke: mem, width: 2.4});
      if (Math.abs(fac - 1) > 1e-6) api.label([X0 + 8, Y0 - 32], "solid: this shape", {color: mem, size: 12, weight: 650});
      api.label([X0 + 8, Y0 - 14], "dashed: sphere, 3/R", {color: sph, size: 12});
      api.point([X(v.R), Y(g.ratio)], {color: mem, r: 5});
      api.label([X1, Y1 + 4], "this cell: " + api.fmt(g.ratio, g.ratio < 0.1 ? 3 : 2), {color: mem, size: 12.5, weight: 650, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (t) { var fl = t.getAttribute("fill"); if (fl) t.style.fill = fl; });   // viz.css paints svg text ink
    }
  });
})();
