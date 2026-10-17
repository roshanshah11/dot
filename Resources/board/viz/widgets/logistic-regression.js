// Logistic regression is a straight line squashed into a probability. Top: the log-odds eta = b0 + b1 x, a line
// (clipped to -6..6). Bottom: P(Y = 1 | x) = 1 / (1 + e^(-eta)), the S-curve. Where the line crosses 0 the curve
// crosses 1/2 (the decision boundary x = -b0/b1), and there the curve is steepest, with slope b1/4 (amber tangent).
// Dot's extra x (draggable) reads both panels at one input: log-odds, odds e^eta, and the probability.
(function () {
  function sig(z) { return 1 / (1 + Math.exp(-z)); }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 3 : d); };

  Viz.register("logistic-regression", {
    title: "Logistic regression curve",
    subject: "stats",
    shows: "Slide β₀ and β₁: the log-odds β₀ + β₁x is a straight line, and the logistic function bends it into a probability between 0 and 1",
    params: {
      intercept: {kind: "number", default: -0.5, min: -2, max: 2, step: 0.1, label: "\\beta_0"},
      coefficient: {kind: "number", default: 1.2, min: -2.5, max: 2.5, step: 0.1, label: "\\beta_1"},
      x: {kind: "number", default: 1, min: -6, max: 6, step: 0.1, label: "x"}
    },
    formula: function (v) {
      var z = v.intercept + v.coefficient * v.x;
      return "\\begin{array}{l}P(Y=1\\mid x)=\\dfrac{1}{1+e^{-(\\beta_0+\\beta_1x)}}\\\\[4pt]\\quad=\\dfrac{1}{1+e^{-(" + Viz.n(v.intercept) + (v.coefficient < 0 ? "" : "+") + Viz.n(v.coefficient) +
        "\\cdot" + Viz.p(v.x) + ")}}=" + Viz.n(sig(z), 3) + "\\end{array}";
    },
    status: function (v) {
      var z = v.intercept + v.coefficient * v.x, P = sig(z);
      if (v.coefficient === 0) return "With β₁ = 0, x has no effect: P(Y=1) is <b>" + f(sig(v.intercept)) + "</b> at every x.";
      var xb = -v.intercept / v.coefficient, off = Math.abs(xb) > 6 ? " (off this chart)" : "";
      return "At x = " + f(v.x, 2) + " the log-odds are " + f(z, 2) + ", odds <b>" + (z >= 0 ? f(Math.exp(z), 2) + " to 1" : "1 to " + f(Math.exp(-z), 2)) + "</b>, so P(Y=1) = <b>" + f(P) + "</b>; P " +
        (v.coefficient > 0 ? "rises" : "falls") + " through 0.5 at x = " + f(xb, 2) + off + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {intercept: -2, coefficient: -2.5}},
      {name: "Maximum supported values", values: {intercept: 2, coefficient: 2.5}},
      {name: "no effect of x", values: {intercept: 0.8, coefficient: 0}},
      {name: "boundary at zero", values: {intercept: 0, coefficient: 1, x: 0}},
      {name: "gentle slope, boundary off the chart", values: {intercept: 2, coefficient: 0.2, x: -4}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, b0 = v.intercept, b1 = v.coefficient, x0 = 40, x1 = 384, X = function (x) { return x0 + (x1 - x0) * (x + 6) / 12; };
      var tT = 22, tB = 92, E = function (z) { return (tT + tB) / 2 - (tB - tT) / 12 * Math.max(-6, Math.min(6, z)); };
      var pT = 124, pB = 262, Y = function (p) { return pB - (pB - pT) * p; };
      var z = b0 + b1 * v.x, P = sig(z), xb = b1 !== 0 ? -b0 / b1 : null, inB = xb != null && Math.abs(xb) <= 6;
      // top panel: the log-odds line
      api.line([x0, E(0)], [x1, E(0)], {color: c.axis, width: 1.2});
      api.line([x0, tT], [x0, tB], {color: c.axis, width: 1});
      [-6, 6].forEach(function (q) { api.label([x0 - 6, E(q)], String(q).replace("-", "−"), {color: c.muted, size: 12, anchor: "end"}); });
      api.label([x0 - 6, E(0)], "0", {color: c.muted, size: 12, anchor: "end"});
      var lp = [], lall = [];
      for (var xx = -6; xx <= 6.001; xx += 0.05) { var zz = b0 + b1 * xx; if (Math.abs(zz) <= 6) { lp.push([X(xx), E(zz)]); lall.push([X(xx), E(zz)]); } else if (lp.length) { api.polyline(lp, {stroke: c.c6, width: 2.4}); lp = []; } }
      if (lp.length > 1) api.polyline(lp, {stroke: c.c6, width: 2.4});
      api.label([x0 + 6, tT - 10], "log-odds  η = β₀ + β₁x", {color: c.c6, size: 12.5, weight: 650});
      // bottom panel: the probability
      [0, 0.5, 1].forEach(function (p) {
        api.line([x0, Y(p)], [x1, Y(p)], {color: p === 0 ? c.axis : c.grid, width: p === 0 ? 1.2 : 1, dash: p === 0.5 ? "4 4" : null});
        api.label([x0 - 6, Y(p)], String(p), {color: c.muted, size: 12, anchor: "end"});
      });
      api.line([x0, pT], [x0, pB], {color: c.axis, width: 1});
      for (var t = -6; t <= 6; t += 2) api.label([X(t), pB + 14], String(t).replace("-", "−"), {color: c.muted, size: 12, anchor: "middle"});
      api.label([x1, pB + 29], "x", {color: c.muted, size: 12.5, anchor: "end", italic: true});
      // its title sits on the side away from the reading x, so a point near the top keeps room for its label
      var tl = v.x >= 0, tw = 12 * 12.5 * 0.5;
      api.label([tl ? x0 + 6 : x1, pT - 12], "P(Y = 1 | x)", {color: c.c2, size: 12.5, weight: 650, anchor: tl ? "start" : "end"});
      var tbox = tl ? [x0 + 6, pT - 19, x0 + 6 + tw, pT - 5] : [x1 - tw, pT - 19, x1, pT - 5];
      var halo = function (t) { ["stroke", c.card, "stroke-width", 3, "stroke-linejoin", "round", "paint-order", "stroke"].forEach(function (a, i, l) { if (i % 2 === 0) t.setAttribute(a, l[i + 1]); }); return t; };
      // a vertical guide through both panels, broken where it would run through the bottom title
      var guide = function (x, ya, o) {
        if (x > tbox[0] - 2 && x < tbox[2] + 2 && ya < tbox[1]) { api.line([x, ya], [x, tbox[1] - 2], o); api.line([x, tbox[3] + 2], [x, pB], o); }
        else api.line([x, ya], [x, pB], o);
      };
      // the boundary labels go on the side of x_b away from the reading line at x, in the half the curve leaves empty
      // there (below 0.5 on the side where P is above it, and the reverse); the point's label then takes a free corner
      var boxes = [tbox, [x0 + 6, tT - 17, x0 + 6 + 22 * 12.5 * 0.5, tT - 3]], ov = function (a, b) { return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]; };
      if (inB) {
        guide(X(xb), E(0), {color: c.c3, width: 1.4, dash: "5 4"});
        boxes.push([X(xb) - 1, E(0), X(xb) + 1, pB]);   // the point labels keep off the boundary guide
        api.point([X(xb), E(0)], {color: c.c3, r: 3.5});
        var l1 = "P = 0.5 at x = " + f(xb, 2), bv = f(b1 / 4, 3);
        var bbox = function (rt, long) {
          var up = rt === (b1 < 0), y1 = up ? Y(0.68) - 12 : Y(0.32) + 12, l2 = (long ? "tangent slope" : "slope") + " β₁/4 = " + bv, bw = Math.max(l1.length, l2.length) * 12 * 0.56;
          return {rt: rt, y1: y1, l2: l2, b: rt ? [X(xb) + 8, y1 - 7, X(xb) + 8 + bw, y1 + 22] : [X(xb) - 8 - bw, y1 - 7, X(xb) - 8, y1 + 22]};
        };
        var sp0 = [], pref = v.x <= xb, cands = [];
        for (var u = -6; u <= 6.001; u += 0.1) sp0.push([X(u), Y(sig(b0 + b1 * u))]);
        var hits = function (b, pts) { return pts.some(function (q) { return q[0] > b[0] - 1 && q[0] < b[2] + 1 && q[1] > b[1] - 1 && q[1] < b[3] + 1; }); };
        // inside the plot first, then allowed across the y axis (haloed); never across the reading line or the curve
        [x0 + 2, 6].forEach(function (lo) { [true, false].forEach(function (lg) { [pref, !pref].forEach(function (rt) { var q = bbox(rt, lg); q.lo = lo; cands.push(q); }); }); });
        var bc = cands.filter(function (q) { return q.b[0] >= q.lo && q.b[2] <= 397 && !(q.b[0] - 3 < X(v.x) && X(v.x) < q.b[2] + 3) && !hits(q.b, sp0); })[0] ||
          cands.filter(function (q) { return q.b[0] >= 6 && q.b[2] <= 397 && !hits(q.b, sp0); })[0] || bbox(xb < 2.5, false);
        boxes.push(bc.b);
        halo(api.label([bc.rt ? bc.b[0] : bc.b[2], bc.y1], l1, {color: c.c3, size: 12, weight: 600, anchor: bc.rt ? "start" : "end"}));
        halo(api.label([bc.rt ? bc.b[0] : bc.b[2], bc.y1 + 15], bc.l2, {color: c.c3, size: 12, anchor: bc.rt ? "start" : "end"}));
      }
      var sp = [];
      for (var s = -6; s <= 6.001; s += 0.05) sp.push([X(s), Y(sig(b0 + b1 * s))]);
      api.polyline(sp, {stroke: c.c2, width: 2.8});
      if (inB) {
        // tangent at the boundary, slope b1/4 per unit of x, drawn from P = 0.05 to 0.95, thin and light, so its ends
        // visibly leave the S (the curve is only at 0.14 and 0.86 there)
        var hw = 1.8 / Math.abs(b1), ta = Math.max(-6, xb - hw), tb = Math.min(6, xb + hw), tan = function (x) { return 0.5 + b1 / 4 * (x - xb); };
        api.line([X(ta), Y(tan(ta))], [X(tb), Y(tan(tb))], {color: c.c3, width: 1.4, dash: "6 3", opacity: 0.85});
        for (var w = 0; w <= 1; w += 0.05) sp.push([X(ta + (tb - ta) * w), Y(tan(ta + (tb - ta) * w))]);   // an obstacle for the P label
      }
      // the reading at x, carried through both panels
      var Pz = [X(v.x), Y(P)], Ez = [X(v.x), E(z)];
      guide(Pz[0], tT, {color: c.c1, width: 1, dash: "2 4", opacity: 0.8});
      if (Math.abs(z) <= 6) api.point(Ez, {color: c.c1, r: 4.5});
      // labels take a corner the line or curve leaves empty: up-left or down-right of a rising one, mirrored for a falling one
      var corners = function (at, txt, size, dxp, dyp, lo, hi, avoid, pts) {
        var w = txt.length * size * 0.56, mk = function (dx, dy) {   // the framework's own width estimate, so nothing gets shifted
          var x = at[0] + dx * dxp, y = at[1] + dy * dyp;
          return {x: x, y: y, dx: dx, b: dx > 0 ? [x, y - 7, x + w, y + 7] : dx < 0 ? [x - w, y - 7, x, y + 7] : [x - w / 2, y - 7, x + w / 2, y + 7]};
        };
        // the free corners first, then beside the point or a row further off, then centred above or below it (across the haloed reading line)
        var pc = (b1 > 0 ? [[-1, -1], [1, 1], [1, -1], [-1, 1]] : [[1, -1], [-1, 1], [-1, -1], [1, 1]]).concat([[1, 0], [-1, 0], [1, 2], [-1, 2], [1, -2], [-1, -2], [0, -1.2], [0, 1.2]]).map(function (d) { return mk(d[0], d[1]); });
        var ok = function (q) { return q.b[0] >= x0 + 2 && q.b[2] <= 397 && q.b[1] >= lo && q.b[3] <= hi; };
        var free = function (q) { return ok(q) && !boxes.some(function (b) { return ov(b, q.b); }) && !pts.some(function (p) { return p[0] > q.b[0] - 1 && p[0] < q.b[2] + 1 && p[1] > q.b[1] - 1 && p[1] < q.b[3] + 1; }); };
        return pc.filter(function (q) { return free(q) && !(q.b[1] - 2 < avoid && avoid < q.b[3] + 2); })[0] || pc.filter(free)[0] || pc.filter(ok)[0] || pc[0];
      };
      var anc = function (q) { return q.dx > 0 ? "start" : q.dx < 0 ? "end" : "middle"; };
      var eq = corners(Ez, "η = " + f(z, 2), 12, 8, 11, 4, pT - 6, E(0), lall);
      halo(api.label([eq.x, Math.max(10, Math.min(pT - 13, eq.y))], "η = " + f(z, 2), {color: c.c1, size: 12, weight: 650, anchor: anc(eq)}));
      var pq = corners(Pz, "P = " + f(P), 12.5, 10, 13, tB + 6, pB - 2, Y(0.5), sp);
      halo(api.label([pq.x, pq.y], "P = " + f(P), {color: c.c1, size: 12.5, weight: 700, anchor: anc(pq)}));
      api.handle(Pz, {color: c.c1, r: 6, onDrag: function (q) {
        api.set({x: Math.max(-6, Math.min(6, Math.round(((q[0] - x0) / (x1 - x0) * 12 - 6) * 10) / 10))});
      }});
    }
  });
})();
