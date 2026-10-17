// w = a u + b v, built tip to tail: walk a steps along u, then b steps along v. The faint lattice is every
// combination with whole-number coefficients; the shaded parallelogram is everything the sliders can reach. Both are
// labelled in the empty corner below the region, and the u/v key sits in the empty corner above it.
(function () {
  var U = [2, 0.5], V = [-0.5, 1.5];
  Viz.register("linear-combination", {
    title: "Linear combination of two vectors",
    subject: "linear-algebra",
    shows: "Slide a and b, or drag w: w = a u + b v is a walk of a steps along u then b steps along v; negative coefficients walk backwards",
    params: {
      coefficientA: {kind: "number", default: 1, min: -2, max: 2, step: 0.05, label: "a"},
      coefficientB: {kind: "number", default: 1, min: -2, max: 2, step: 0.05, label: "b"}
    },
    formula: function (v) {
      var a = v.coefficientA, b = v.coefficientB, w = [a * U[0] + b * V[0], a * U[1] + b * V[1]];
      var col = function (q) { return "\\begin{pmatrix}" + Viz.n(q[0]) + "\\\\" + Viz.n(q[1]) + "\\end{pmatrix}"; };
      return "\\vec{w}=a\\vec{u}+b\\vec{v}=" + Viz.p(a) + col(U) + "+" + Viz.p(b) + col(V) + "=" + col(w);
    },
    status: function (v) {
      var a = v.coefficientA, b = v.coefficientB, w = [a * U[0] + b * V[0], a * U[1] + b * V[1]];
      var walk = function (k, name) { return Math.abs(k) < 1e-9 ? "no steps along " + name : Viz.fmt(Math.abs(k)) + " step" + (Math.abs(Math.abs(k) - 1) < 1e-9 ? "" : "s") + (k < 0 ? " backwards" : "") + " along " + name; };
      if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) return "Both coefficients are 0, so w is the <b>zero vector</b>.";
      return "w = <b>(" + Viz.fmt(w[0]) + ", " + Viz.fmt(w[1]) + ")</b>: " + walk(a, "u") + ", then " + walk(b, "v") + ".";
    },
    examples: [
      {name: "minimum supported values", values: {coefficientA: -2, coefficientB: -2}},
      {name: "maximum supported values", values: {coefficientA: 2, coefficientB: 2}},
      {name: "u alone", values: {coefficientA: 1, coefficientB: 0}},
      {name: "mixed signs", values: {coefficientA: 1.5, coefficientB: -1}}
    ],
    size: [380, 300],
    draw: function (api, v) {
      var c = api.color, a = v.coefficientA, b = v.coefficientB;
      var pl = api.plane({x: [-5.3, 5.3], y: [-4.25, 4.25], ticks: false, labels: false, step: 1});
      var P = function (s, t) { return pl.px([s * U[0] + t * V[0], s * U[1] + t * V[1]]); };
      var halo = function (t) { ["stroke", c.card, "stroke-width", 3, "stroke-linejoin", "round", "paint-order", "stroke"].forEach(function (x, i, l) { if (i % 2 === 0) t.setAttribute(x, l[i + 1]); }); return t; };
      // reachable region (|a|, |b| <= 2) and the whole-number lattice of u and v
      api.polygon([P(-2, -2), P(2, -2), P(2, 2), P(-2, 2)], {fill: c.c2, fillOpacity: 0.06, stroke: c.c2, width: 1, dash: "3 4"});
      for (var k = -2; k <= 2; k++) {
        api.line(P(k, -2), P(k, 2), {color: c.c3, width: 1, opacity: 0.33});
        api.line(P(-2, k), P(2, k), {color: c.c1, width: 1, opacity: 0.33});
      }
      // name both, along the region's lower edge (parallel to u) in the empty corner outside it
      var e0 = P(-2, -2), e1 = P(2, -2), eL = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]), ed = [(e1[0] - e0[0]) / eL, (e1[1] - e0[1]) / eL], en = [-ed[1], ed[0]];
      [[11, "reachable with |a|, |b| ≤ 2", c.c2], [27, "grid: whole-number a, b", c.muted]].forEach(function (r) {
        var q = [e0[0] + ed[0] * eL * 0.66 + en[0] * r[0], e0[1] + ed[1] * eL * 0.66 + en[1] * r[0]];
        halo(api.label(q, r[1], {color: r[2], size: 12, anchor: "middle", clamp: false}))
          .setAttribute("transform", "rotate(" + (Math.atan2(ed[1], ed[0]) * 180 / Math.PI).toFixed(2) + " " + q[0].toFixed(1) + " " + q[1].toFixed(1) + ")");
      });
      // a key with u and v at true scale, in the empty corner above the region's upper edge
      var K = [26, 56], s0 = pl.sx, Ut = [K[0] + U[0] * s0, K[1] - U[1] * s0], Vt = [K[0] + V[0] * s0, K[1] - V[1] * s0];
      api.arrow(K, Ut, {color: c.c1, width: 2, halo: false});
      api.arrow(K, Vt, {color: c.c3, width: 2, halo: false});
      api.label([Ut[0] + 7, Ut[1] - 1], "u = (2, 0.5)", {color: c.c1, size: 12, weight: 600});
      api.label([Vt[0] + 8, Vt[1] + 1], "v = (−0.5, 1.5)", {color: c.c3, size: 12, weight: 600});
      var O = pl.px([0, 0]), A = P(a, 0), W = P(a, b);
      // walk labels keep clear of the walk, the axes, the key and each other
      var segs = [[O, A, 5], [A, W, 5], [O, W, 4], [[pl.x(-5.3), O[1]], [pl.x(5.3) + 6, O[1]], 2], [[O[0], pl.y(-4.25)], [O[0], pl.y(4.25) - 6], 2]];
      var boxes = [[0, 0, 128, 62], [W[0] - 9, W[1] - 9, W[0] + 9, W[1] + 9]], R = [P(-2, -2), P(2, -2), P(2, 2), P(-2, 2)];
      var edges = R.map(function (q, i) { return [q, R[(i + 1) % 4], 1]; }); // the region's dashed edge: avoided when possible
      var meets = function (bx, sg) { // Liang-Barsky: does segment sg cross box bx grown by its half width?
        var x0 = sg[0][0], y0 = sg[0][1], dx = sg[1][0] - x0, dy = sg[1][1] - y0, t0 = 0, t1 = 1, g = sg[2];
        var pq = [[-dx, x0 - bx[0] + g], [dx, bx[2] + g - x0], [-dy, y0 - bx[1] + g], [dy, bx[3] + g - y0]];
        for (var i = 0; i < 4; i++) {
          var pp = pq[i][0], qq = pq[i][1];
          if (Math.abs(pp) < 1e-12) { if (qq < 0) return false; } else if (pp < 0) t0 = Math.max(t0, qq / pp); else t1 = Math.min(t1, qq / pp);
        }
        return t0 <= t1;
      };
      var place = function (p, q, from, pref, text, col, size) {
        // beside segment pq, on the side away from "from": the centre sits off the line by the label's half extent
        // along the normal + 8 px; the cheapest spot with nothing under it wins (further out, slid along, other side)
        var L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, d = [(q[0] - p[0]) / L, (q[1] - p[1]) / L], n = [-d[1], d[0]], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        var side = (from[0] - m[0]) * n[0] + (from[1] - m[1]) * n[1], w = text.length * size * 0.62 + 2, h = size + 2, cands = [];
        side = Math.abs(side) < 2 ? pref : side > 0 ? -1 : 1;
        var base = w / 2 * Math.abs(n[0]) + h / 2 * Math.abs(n[1]) + 8;
        [side, -side].forEach(function (sd, flip) {
          for (var extra = 0; extra <= 36; extra += 3) [0, -0.3, 0.3, -0.5, 0.5].forEach(function (t, i) {
            var cx = m[0] + sd * n[0] * (base + extra) + d[0] * t * L, cy = m[1] + sd * n[1] * (base + extra) + d[1] * t * L;
            cands.push({at: [cx, cy], box: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], cost: extra + 8 * i + 60 * flip});
          });
        });
        cands.sort(function (x, y) { return x.cost - y.cost; });
        var ok = function (bx, lines) {
          return bx[0] >= 2 && bx[2] <= api.w - 2 && bx[1] >= 2 && bx[3] <= api.h - 2 && !lines.some(function (sg) { return meets(bx, sg); }) &&
            !boxes.some(function (o) { return bx[0] < o[2] && o[0] < bx[2] && bx[1] < o[3] && o[1] < bx[3]; });
        };
        var pick = cands.filter(function (k) { return ok(k.box, segs.concat(edges)); })[0] || cands.filter(function (k) { return ok(k.box, segs); })[0] || cands[0];
        boxes.push(pick.box);
        halo(api.label(pick.at, text, {color: col, size: size, weight: 650, anchor: "middle"}));
      };
      var coef = function (k, name) { return Math.abs(k - 1) < 1e-9 ? name : Math.abs(k + 1) < 1e-9 ? "−" + name : api.fmt(k) + name; };
      // the walk: a u from the origin, then b v from its tip, then w straight from the origin
      if (Math.abs(a) > 1e-9) api.arrow(O, A, {color: c.c1, width: 3.5});
      if (Math.abs(b) > 1e-9) api.arrow(A, W, {color: c.c3, width: 3.5});
      var wLong = Math.hypot(W[0] - O[0], W[1] - O[1]) > 4;
      if (wLong) api.arrow(O, W, {color: c.c6, width: 3, dash: "7 5"});
      if (Math.abs(a) > 1e-9) place(O, A, W, 1, coef(a, "u"), c.c1, 13);
      if (Math.abs(b) > 1e-9) place(A, W, O, 1, coef(b, "v"), c.c3, 13);
      if (wLong) place(O, W, A, -1, "w", c.c6, 15);
      api.point(O, {color: c.ink, r: 3.5});
      api.handle(W, {color: c.c6, plane: pl, onDrag: function (q) {
        // solve [u v][a b]^T = q for the coefficients
        var det = U[0] * V[1] - U[1] * V[0], na = (q[0] * V[1] - q[1] * V[0]) / det, nb = (U[0] * q[1] - U[1] * q[0]) / det;
        api.set({coefficientA: Math.round(na * 20) / 20, coefficientB: Math.round(nb * 20) / 20});
      }});
      // labels take the color of what they name (the stylesheet would paint them all ink)
      Array.prototype.forEach.call(api.svg.querySelectorAll("text"), function (t) { t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
