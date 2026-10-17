// Null space and column space of a 3x3 matrix A, drawn in 3D: the null space (every x with Ax = 0) in the input,
// the column space (every Ax) in the output. Rank-nullity: dim Null A + rank A = 3.
(function () {
  // one matrix per rank, with the null-space basis and the pivot columns worked out by hand (checked: A n = 0)
  var CASES = {
    1: {A: [[1, -1, 1], [1, -1, 1], [1, -1, 1]], nul: [[1, 1, 0], [0, 1, 1]], piv: [0]},
    2: {A: [[1, 0, 1], [0, 1, 1], [1, 1, 2]], nul: [[-1, -1, 1]], piv: [0, 1]},
    3: {A: [[1, 0, 1], [0, 1, 1], [1, 1, 0]], nul: [], piv: [0, 1, 2]}
  };
  var colOf = function (A, j) { return [A[0][j], A[1][j], A[2][j]]; };
  var unit = function (p) { var n = Math.hypot(p[0], p[1], p[2]); return [p[0] / n, p[1] / n, p[2] / n]; };
  var dot = function (p, q) { return p[0] * q[0] + p[1] * q[1] + p[2] * q[2]; };
  function ortho(vs) { // Gram-Schmidt, for a square-looking patch of a plane
    var a = unit(vs[0]), b = vs[1], d = dot(a, b), w = unit([b[0] - d * a[0], b[1] - d * a[1], b[2] - d * a[2]]);
    return [a, w];
  }
  // The default view (+14°) puts x at 6°, y at 121°, z at 90° on screen, (1,1,1) at 63°, the rank-2 null line at 150°
  // and a₂ = (0,1,1) at 100°: every column-space and null-space direction stays at least 10° off every axis.
  var vec = function (p) { return "\\begin{pmatrix}" + p.join("\\\\") + "\\end{pmatrix}"; };
  Viz.register("null-space", {
    title: "Null space and column space",
    subject: "linear-algebra",
    shows: "Change the rank of a 3×3 matrix: the solutions of Ax = 0 shrink from a plane to a line to just 0 while the columns grow from a line to a plane to all of space",
    params: {
      rank: {kind: "integer", default: 1, min: 1, max: 3, label: "\\operatorname{rank}A"},
      view: {kind: "number", default: 14, min: -60, max: 60, step: 1, label: "view"}
    },
    formula: function (v) {
      var K = CASES[v.rank], A = K.A, m = "A=\\begin{pmatrix}" + A.map(function (r) { return r.join("&"); }).join("\\\\") + "\\end{pmatrix},\\ ";
      if (!K.nul.length) return m + "\\operatorname{Null}(A)=\\{\\mathbf{0}\\}";
      return m + "\\operatorname{Null}(A)=\\operatorname{span}\\left\\{" + K.nul.map(vec).join(",") + "\\right\\}";
    },
    status: function (v) {
      var r = v.rank, d = 3 - r, sh = ["just the point 0", "a line", "a plane"], cs = ["", "a line", "a plane", "all of 3D space"];
      return "Rank " + r + ": " + r + " pivot" + (r > 1 ? "s" : "") + " and " + d + " free variable" + (d === 1 ? "" : "s") + ", so Ax = 0 has <b>" + sh[d] + "</b> of solutions (dim " + d +
        ") and the columns span <b>" + cs[r] + "</b>; " + d + " + " + r + " = 3.";
    },
    examples: [
      {name: "minimum supported values", values: {rank: 1}},
      {name: "rank two: null-space line and column-space plane", values: {rank: 2}},
      {name: "maximum supported values", values: {rank: 3}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, K = CASES[v.rank], W = api.w, H = api.h, half = W / 2, s = 48, el = 0.42, az = v.view * Math.PI / 180, L = 1.8;
      var proj = function (cx, cy) { // orthographic view: turn about z by the view angle, tilt down by el
        return function (p) {
          var x1 = p[0] * Math.cos(az) - p[1] * Math.sin(az), y1 = p[0] * Math.sin(az) + p[1] * Math.cos(az);
          return [cx + s * x1, cy - s * (p[2] * Math.cos(el) + y1 * Math.sin(el))];
        };
      };
      var PL = proj(half / 2, 156), PR = proj(half + half / 2, 156), O1 = PL([0, 0, 0]), O2 = PR([0, 0, 0]);
      var segs = [], boxes = [[half / 2 - 50, 8, half / 2 + 50, 26], [half * 1.5 - 58, 8, half * 1.5 + 58, 26], [0, H - 26, W, H]];
      var seg = function (a, b, g) { segs.push([a, b, g]); };
      var halo = function (t) { ["stroke", c.card, "stroke-width", 3, "stroke-linejoin", "round", "paint-order", "stroke"].forEach(function (x, i, l) { if (i % 2 === 0) t.setAttribute(x, l[i + 1]); }); return t; };
      var meets = function (bx, sg) { // Liang-Barsky: does segment sg cross box bx grown by its half width?
        var x0 = sg[0][0], y0 = sg[0][1], dx = sg[1][0] - x0, dy = sg[1][1] - y0, t0 = 0, t1 = 1, g = sg[2];
        var pq = [[-dx, x0 - bx[0] + g], [dx, bx[2] + g - x0], [-dy, y0 - bx[1] + g], [dy, bx[3] + g - y0]];
        for (var i = 0; i < 4; i++) {
          var pp = pq[i][0], qq = pq[i][1];
          if (Math.abs(pp) < 1e-12) { if (qq < 0) return false; } else if (pp < 0) t0 = Math.max(t0, qq / pp); else t1 = Math.min(t1, qq / pp);
        }
        return t0 <= t1;
      };
      // a label hugging the tip of O->T: the closest clear spot on rings around the tip, straight out past it preferred
      var tag = function (O, T, text, o) {
        var len = Math.hypot(T[0] - O[0], T[1] - O[1]) || 1, d = [(T[0] - O[0]) / len, (T[1] - O[1]) / len], w = text.length * o.size * 0.6 + 2, h = o.size + 2;
        var lo = O[0] < half ? 4 : half + 4, hi = O[0] < half ? half - 4 : W - 4, cands = [];
        for (var i = 0; i < 24; i++) {
          var u = [Math.cos(i * Math.PI / 12), Math.sin(i * Math.PI / 12)], ext = w / 2 * Math.abs(u[0]) + h / 2 * Math.abs(u[1]);
          var turn = Math.acos(Math.max(-1, Math.min(1, u[0] * d[0] + u[1] * d[1])));
          for (var r = 3; r <= 27; r += 3) {
            var cx = T[0] + u[0] * (ext + r), cy = T[1] + u[1] * (ext + r);
            cands.push({at: [cx, cy], box: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], cost: r + turn * 9});
          }
        }
        cands.sort(function (x, y) { return x.cost - y.cost; });
        var g = o.gap || 0, pick = cands.filter(function (k) {
          var bx = k.box, gb = [bx[0] - g, bx[1] - g, bx[2] + g, bx[3] + g]; // keep "gap" px further from vectors and labels
          return bx[0] >= lo && bx[2] <= hi && bx[1] >= 4 && bx[3] <= H - 4 && !segs.some(function (sg) { return meets(sg[3] ? gb : bx, sg); }) &&
            !boxes.some(function (q) { return gb[0] < q[2] && q[0] < gb[2] && gb[1] < q[3] && q[1] < gb[3]; });
        })[0] || cands[0];
        boxes.push(pick.box);
        var t = api.label(pick.at, text, {color: o.color, size: o.size, weight: o.weight || 650, anchor: "middle"});
        if (o.halo) halo(t);
      };
      var axes = function (P) { // positive half solid with a head, negative half faint and dashed: a cue for depth
        var O = P([0, 0, 0]);
        [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach(function (e) {
          var neg = P([-L * e[0], -L * e[1], -L * e[2]]), pos = P([L * e[0], L * e[1], L * e[2]]);
          api.line(neg, O, {color: c.axis, width: 1.1, dash: "2 4", opacity: 0.55});
          api.line(O, pos, {color: c.axis, width: 1.4, arrow: true});
          seg(neg, pos, 1.5);
        });
      };
      var patch = function (P, B, r, col) {
        var q = function (a, b) { return P([a * B[0][0] + b * B[1][0], a * B[0][1] + b * B[1][1], a * B[0][2] + b * B[1][2]]); };
        var cs = [q(-r, -r), q(r, -r), q(r, r), q(-r, r)];
        api.polygon(cs, {fill: col, fillOpacity: 0.2, stroke: col, width: 1.4});
        cs.forEach(function (p, i) { seg(p, cs[(i + 1) % 4], 1.5); });
        for (var k = -1; k <= 1; k++) { api.line(q(k * r / 2, -r), q(k * r / 2, r), {color: col, width: 1, opacity: 0.35}); api.line(q(-r, k * r / 2), q(r, k * r / 2), {color: col, width: 1, opacity: 0.35}); }
      };
      var lineThru = function (P, d, col) {
        var u = unit(d), a = P([-1.75 * u[0], -1.75 * u[1], -1.75 * u[2]]), b = P([1.75 * u[0], 1.75 * u[1], 1.75 * u[2]]);
        api.line(a, b, {color: col, width: 3.5, opacity: 0.9}); seg(a, b, 3);
      };
      var vector = function (O, T, col) { api.arrow(O, T, {color: col, width: 2.5}); segs.push([O, T, 3, true]); };
      api.label([half / 2, 17], "input: Ax = 0", {color: c.muted, size: 12.5, anchor: "middle"});
      api.label([half + half / 2, 17], "output: every Ax", {color: c.muted, size: 12.5, anchor: "middle"});
      // A carries the input space to the output space
      api.label([half, 15], "A", {color: c.ink, size: 14, weight: 700, anchor: "middle"});
      api.arrow([half - 13, 31], [half + 13, 31], {color: c.ink, width: 2, halo: false});
      api.line([half, 44], [half, H - 14], {color: c.grid, width: 1});
      // input: the null space in red
      axes(PL);
      var nd = 3 - v.rank, nTips = K.nul.map(function (n) { return PL(n); });
      if (nd === 2) patch(PL, ortho(K.nul), 1.4, c.c5);
      if (nd === 1) lineThru(PL, K.nul[0], c.c5);
      nTips.forEach(function (T) { vector(O1, T, c.c5); });
      api.point(O1, {color: nd ? c.ink : c.c5, r: nd ? 3 : 5.5});
      // output: the column space in blue, with the pivot columns
      axes(PR);
      var cols = K.piv.map(function (j) { return colOf(K.A, j); }), cTips = cols.map(function (a) { return PR(a); });
      if (v.rank === 1) lineThru(PR, cols[0], c.c2);
      if (v.rank === 2) patch(PR, ortho(cols), 1.4, c.c2);
      if (v.rank === 3) {
        // all of space: shade a cube around the origin, smaller than the axes so their names sit outside it; the three
        // edges at the corner farthest from the eye are hidden, so they are dashed and faint (and labels may cross them)
        var C3 = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(function (p) { return [p[0] * 1.2, p[1] * 1.2, p[2] * 1.2]; });
        var depth = function (p) { return (p[0] * Math.sin(az) + p[1] * Math.cos(az)) * Math.cos(el) - p[2] * Math.sin(el); }, far = 0;
        C3.forEach(function (p, i) { if (depth(p) > depth(C3[far])) far = i; });
        var cube = C3.map(PR);
        [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]].forEach(function (f) { api.polygon(f.map(function (i) { return cube[i]; }), {fill: c.c2, fillOpacity: 0.05}); });
        [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(function (e) {
          var hidden = e[0] === far || e[1] === far;
          api.line(cube[e[0]], cube[e[1]], {color: c.c2, width: 1, opacity: hidden ? 0.45 : 0.8, dash: hidden ? "3 4" : null});
          if (!hidden) seg(cube[e[0]], cube[e[1]], 1);
        });
      }
      cTips.forEach(function (T) { vector(O2, T, c.c2); });
      api.point(O2, {color: c.ink, r: 3});
      api.label([half / 2, H - 14], nd === 0 ? "Null(A) = {0}" : nd === 1 ? "Null(A): a line" : "Null(A): a plane", {color: c.c5, size: 13, weight: 650, anchor: "middle"});
      api.label([half + half / 2, H - 14], v.rank === 1 ? "Col(A): a line" : v.rank === 2 ? "Col(A): a plane" : "Col(A): all of 3D", {color: c.c2, size: 13, weight: 650, anchor: "middle"});
      // names: the vectors first, then the axes last with a halo, each on a spot that is clear
      nTips.forEach(function (T, i) { tag(O1, T, K.nul.length > 1 ? "n_" + (i + 1) : "n", {color: c.c5, size: 13, halo: true}); });
      cTips.forEach(function (T, i) { tag(O2, T, "a_" + (K.piv[i] + 1), {color: c.c2, size: 13, halo: true}); });
      [PL, PR].forEach(function (P) {
        var O = P([0, 0, 0]);
        [[L, 0, 0, "x"], [0, L, 0, "y"], [0, 0, L, "z"]].forEach(function (a) { tag(O, P(a), a[3], {color: c.muted, size: 12.5, weight: 500, halo: true, gap: 10}); });
      });
      // labels take the color of what they name (the stylesheet would paint them all ink)
      Array.prototype.forEach.call(api.svg.querySelectorAll("text"), function (t) { t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
