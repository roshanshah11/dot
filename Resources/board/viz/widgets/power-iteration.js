// Power iteration on a symmetric 2x2 matrix: multiply by A, rescale to length 1, repeat. The iterate swings onto the
// dominant eigendirection: for symmetric A the tangent of the angle to it shrinks by exactly |λ2/λ1| per step (the angle
// itself does once it is small), and xᵀAx approaches λ1.
(function () {
  var KMAX = 12;
  function run(v) {
    var a = v.a, b = v.b, d = v.d, m = (a + d) / 2, r = Math.hypot((a - d) / 2, b), l1 = m + r, l2 = m - r;
    var big = Math.abs(l1) >= Math.abs(l2) ? l1 : l2, small = big === l1 ? l2 : l1;
    var vecFor = function (l) {
      if (Math.abs(b) > 1e-12) { var n = Math.hypot(b, l - a); return [b / n, (l - a) / n]; }
      return Math.abs(l - a) <= Math.abs(l - d) ? [1, 0] : [0, 1];
    };
    var o = {a: a, b: b, d: d, big: big, small: small, v1: vecFor(big), v2: null, tie: Math.abs(Math.abs(l1) - Math.abs(l2)) < 1e-9, scalar: r < 1e-9, zero: !a && !b && !d};
    o.v2 = o.scalar ? null : [-o.v1[1], o.v1[0]];
    var t = v.start * Math.PI / 180, x = [Math.cos(t), Math.sin(t)], xs = [x], ang = [];
    o.c1 = Math.abs(x[0] * o.v1[0] + x[1] * o.v1[1]);
    for (var k = 0; k <= KMAX; k++) {
      var cur = xs[k];
      ang.push(o.scalar ? 0 : Math.acos(Math.min(1, Math.abs(cur[0] * o.v1[0] + cur[1] * o.v1[1]))) * 180 / Math.PI);
      if (k === KMAX) break;
      var y = [a * cur[0] + b * cur[1], b * cur[0] + d * cur[1]], ny = Math.hypot(y[0], y[1]);
      if (ny < 1e-12) { o.dead = k; break; }
      xs.push([y[0] / ny, y[1] / ny]);
    }
    o.xs = xs; o.ang = ang;
    var kk = Math.min(v.k, xs.length - 1), xk = xs[kk];
    o.kk = kk; o.xk = xk; o.Axk = [a * xk[0] + b * xk[1], b * xk[0] + d * xk[1]];
    o.rq = xk[0] * o.Axk[0] + xk[1] * o.Axk[1];
    return o;
  }
  var subs = function (k) { return String(k).split("").map(function (ch) { return "_" + ch; }).join(""); };
  Viz.register("power-iteration", {
    title: "Power iteration: finding the dominant eigenvector",
    subject: "linear-algebra",
    shows: "Step k up and drag the start x₀: multiplying by A and rescaling pulls x onto the dominant eigendirection, faster when |λ₂/λ₁| is small",
    params: {
      a: {kind: "number", default: 1.5, min: -2, max: 2, step: 0.1, label: "a_{11}"},
      b: {kind: "number", default: 0.5, min: -1.5, max: 1.5, step: 0.1, label: "a_{12}=a_{21}"},
      d: {kind: "number", default: 1, min: -2, max: 2, step: 0.1, label: "a_{22}"},
      k: {kind: "integer", default: 3, min: 0, max: KMAX, label: "k"},
      start: {kind: "number", default: 110, min: 0, max: 359, step: 1, label: "x_0 angle", control: false}
    },
    formula: function (v) {
      var o = run(v), x = o.xk, K = o.kk;
      return "\\mathbf{x}_{k+1}=\\frac{A\\mathbf{x}_k}{\\lVert A\\mathbf{x}_k\\rVert}:\\ \\mathbf{x}_{" + K + "}=\\begin{pmatrix}" + Viz.n(x[0], 3) + "\\\\" + Viz.n(x[1], 3) +
        "\\end{pmatrix},\\ \\mathbf{x}_{" + K + "}^{\\top}A\\mathbf{x}_{" + K + "}=" + Viz.n(o.rq, 3);
    },
    status: function (v) {
      var o = run(v);
      if (o.zero) return "A = 0 sends every vector to 0, so there is nothing to find.";
      if (o.scalar) return "A = " + Viz.fmt(o.a) + "I: every vector is an eigenvector, so x never moves and xᵀAx = <b>" + Viz.fmt(o.big, 3) + "</b> at once.";
      if (o.dead != null && o.dead < v.k) return "x" + "₀₁₂₃₄₅₆₇₈₉"[o.dead] + " lies in the null space, so A x = 0 and the method <b>breaks down</b>.";
      if (o.tie) return "λ = ±" + Viz.fmt(Math.abs(o.big)) + " tie in size: there is <b>no dominant eigenvalue</b>, so x keeps bouncing between two directions.";
      if (o.c1 < 1e-9) return "x₀ has no component along v₁, so every iterate stays on v₂'s line: power iteration needs a start with some v₁ in it.";
      var ratio = Math.abs(o.small / o.big), head = "After " + o.kk + " step" + (o.kk === 1 ? "" : "s") + " x is <b>" + Viz.fmt(o.ang[o.kk], 2) + "°</b> from v₁";
      // x_k is c1 λ1^k v1 + c2 λ2^k v2 with v1 ⟂ v2, so tan(angle to v1) = |c2/c1| |λ2/λ1|^k: an exact ratio per step
      var why = ratio < 1e-9 ? " (λ₂ = 0, so one step lands x on v₁)" : " (tan of that angle shrinks by exactly |λ₂/λ₁| = " + Viz.fmt(ratio, 2) + " each step, the angle too once it is small)";
      return head + why + " and xᵀAx = <b>" + Viz.fmt(o.rq, 3) + "</b> vs λ₁ = " + Viz.fmt(o.big, 3) + (o.big < 0 ? "; λ₁ < 0, so x flips sign each step." : ".");
    },
    examples: [
      {name: "start", values: {k: 0}},
      {name: "slow: eigenvalues close in size", values: {a: 1.2, b: 0.2, d: 1, k: 8}},
      {name: "fast: a small second eigenvalue", values: {a: 2, b: 1, d: 0.5, k: 2}},
      {name: "negative dominant eigenvalue", values: {a: -1.8, b: 0.4, d: 0.6, k: 5}},
      {name: "no dominant eigenvalue", values: {a: 1, b: 0, d: -1, k: 6}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, o = run(v);
      var e = Math.max(1.35, Math.abs(o.big) * 1.08 + 0.12), BOX = [8, 10, 252, 260];
      var pl = api.plane({x: [-e, e], y: [-e, e], box: BOX, ticks: false, labels: false, step: e > 2.4 ? 1 : 0.5});
      var O = pl.px([0, 0]), R = pl.sx, segs = [], boxes = [];
      api.circle(O, R, {stroke: c.muted, width: 1.2, dash: "3 4"});
      for (var ci = 0; ci < 48; ci++) segs.push([pl.px([Math.cos(ci * Math.PI / 24), Math.sin(ci * Math.PI / 24)]), pl.px([Math.cos((ci + 1) * Math.PI / 24), Math.sin((ci + 1) * Math.PI / 24)]), 1]);
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
      var free = function (bx, lines) {
        return bx[0] >= BOX[0] && bx[2] <= BOX[0] + BOX[2] + 6 && bx[1] >= 2 && bx[3] <= BOX[1] + BOX[3] + 8 && !lines.some(function (sg) { return meets(bx, sg); }) &&
          !boxes.some(function (q) { return bx[0] < q[2] && q[0] < bx[2] && bx[1] < q[3] && q[1] < bx[3]; });
      };
      // geometry first (the eigenlines, the iterates, x_k and Ax_k), so every label can keep clear of all of it
      var X0 = pl.px(o.xs[0]), XK = pl.px(o.xk), AX = pl.px(o.Axk), hasAx = Math.hypot(o.Axk[0], o.Axk[1]) > 1e-9;
      for (var j = 0; j <= o.kk; j++) { var Pj = pl.px(o.xs[j]), rj = j ? 5 : 8; boxes.push([Pj[0] - rj, Pj[1] - rj, Pj[0] + rj, Pj[1] + rj]); }
      segs.push([pl.px([-e, 0]), pl.px([e, 0]), 1.5], [pl.px([0, -e]), pl.px([0, e]), 1.5], [O, XK, 3]);
      if (hasAx) segs.push([O, AX, 4], [AX, pl.px(o.xs[o.kk + 1] || o.xk), 2]);
      var lines = [];
      if (!o.scalar && !o.zero) {
        lines = [[o.v1, pl.through([0, 0], o.v1)], [o.v2, pl.through([0, 0], o.v2)]];
        pl.lineThrough([0, 0], o.v2, {color: c.muted, width: 1.2, dash: "5 5", opacity: 0.7});
        pl.lineThrough([0, 0], o.v1, {color: c.c1, width: 1.8, dash: "6 5"});
        lines.forEach(function (l) { segs.push([pl.px(l[1][0]), pl.px(l[1][1]), 2]); });
      }
      var ring = function (T, text, size) { // the closest clear spot around T, straight out from the origin preferred
        var L = Math.hypot(T[0] - O[0], T[1] - O[1]) || 1, d = [(T[0] - O[0]) / L, (T[1] - O[1]) / L], w = text.replace(/_/g, "").length * size * 0.6 + 2, h = size + 2, cands = [];
        for (var i = 0; i < 24; i++) {
          var u = [Math.cos(i * Math.PI / 12), Math.sin(i * Math.PI / 12)], ext = w / 2 * Math.abs(u[0]) + h / 2 * Math.abs(u[1]), turn = Math.acos(Math.max(-1, Math.min(1, u[0] * d[0] + u[1] * d[1])));
          for (var r = 3; r <= 24; r += 3) { var cx = T[0] + u[0] * (ext + r), cy = T[1] + u[1] * (ext + r); cands.push({at: [cx, cy], box: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], cost: r + turn * 9}); }
        }
        cands.sort(function (x, y) { return x.cost - y.cost; });
        var pick = cands.filter(function (k) { return free(k.box, segs); })[0] || cands.filter(function (k) { return free(k.box, segs.slice(48)); })[0] || cands[0];
        boxes.push(pick.box);
        return pick.at;
      };
      var x0At = ring(X0, "x_0", 13), axName = "Ax" + subs(o.kk), axAt = hasAx ? ring(AX, axName, 13) : null;
      var name = function (u, seg, text, col, avoid) {
        // beside the line, off it along its normal by the label's half extent + 8 px, on the side away from the iterates,
        // out past the unit circle; first try the end away from "avoid" (else the upper end), then the other end
        var ends = [seg[0], seg[1]], first;
        if (avoid && Math.hypot(avoid[0], avoid[1]) > 1e-9) first = seg[0][0] * avoid[0] + seg[0][1] * avoid[1] < 0 ? 0 : 1;
        else first = seg[0][1] > seg[1][1] + 1e-9 || (Math.abs(seg[0][1] - seg[1][1]) < 1e-9 && seg[0][0] < seg[1][0]) ? 0 : 1;
        var w = text.length * 12.5 * 0.58 + 4, h = 15, cands = [];
        [first, 1 - first].forEach(function (ei, eo) {
          var end = ends[ei], Le = Math.hypot(end[0], end[1]), dd = [end[0] / Le, end[1] / Le], dp = [dd[0], -dd[1]], np = [-dp[1], dp[0]], S = 0;
          for (var q = 0; q <= o.kk; q++) { // which side of this half-line the iterates sit on (pixels)
            var X = pl.px(o.xs[q]), rx = X[0] - O[0], ry = X[1] - O[1];
            if (rx * dp[0] + ry * dp[1] > 0) S += rx * np[0] + ry * np[1];
          }
          var want = S > 1 ? -1 : S < -1 ? 1 : (np[1] < 0 ? 1 : -1), ext = w / 2 * Math.abs(np[0]) + h / 2 * Math.abs(np[1]) + 8;
          [want, -want].forEach(function (sd, so) {
            for (var t = 0.4; t <= Le + 0.3; t += 0.1) { // just outside the unit circle is best; inside it costs more
              var bp = pl.px([dd[0] * t, dd[1] * t]), cx = bp[0] + np[0] * ext * sd, cy = bp[1] + np[1] * ext * sd;
              cands.push({at: [cx, cy], box: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], cost: eo * 100 + so * 40 + Math.abs(t - 1.45) * (t < 1.25 ? 25 : 10)});
            }
          });
        });
        cands.sort(function (x, y) { return x.cost - y.cost; });
        var pick = cands.filter(function (k) { return free(k.box, segs); })[0] || cands.filter(function (k) { return free(k.box, segs.slice(48)); })[0] || cands[0];
        boxes.push(pick.box);
        halo(api.label(pick.at, text, {color: col, size: 12.5, weight: 650, anchor: "middle"}));
      };
      if (lines.length) {
        name(o.v1, lines[0][1], (o.tie ? "λ = " : "v₁, λ₁ = ") + api.fmt(o.big), c.c1, o.Axk);
        name(o.v2, lines[1][1], (o.tie ? "λ = " : "λ₂ = ") + api.fmt(o.small), c.muted);
      }
      // the trail of iterates on the unit circle
      for (j = 0; j <= o.kk; j++) api.point(pl.px(o.xs[j]), {color: c.c3, r: j === o.kk ? 4.5 : 3.2, opacity: 0.35 + 0.65 * (j + 1) / (o.kk + 1)});
      halo(api.label(x0At, "x_0", {color: c.c3, size: 13, weight: 650, anchor: "middle"}));
      if (hasAx) {
        api.arrow(O, AX, {color: c.c2, width: 2.5});
        api.line(AX, pl.px(o.xs[o.kk + 1] || o.xk), {color: c.muted, width: 1.3, dash: "3 4"});
        halo(api.label(axAt, axName, {color: c.c2, size: 13, weight: 650, anchor: "middle"}));
      }
      api.arrow(O, XK, {color: c.c3, width: 3, halo: false});
      api.point(O, {r: 3});
      api.handle(X0, {color: c.c3, r: 6, onDrag: function (p) {
        api.set({start: Math.round((Math.atan2(-(p[1] - O[1]), p[0] - O[0]) * 180 / Math.PI + 360) % 360)});
      }});
      // the angle to v1 at every step: past steps amber, the steps still to come faint
      var bx = 278, bw = 114, base = 236, bh = 166, wBar = bw / (KMAX + 1), hs = o.ang.map(function (g) { return Math.max(1.5, bh * g / 90); });
      api.label([bx, base - bh - 26], "angle to v₁, 0–90°", {color: c.muted, size: 12});
      api.line([bx, base], [bx + bw, base], {color: c.axis, width: 1.2});
      api.line([bx, base], [bx, base - bh], {color: c.axis, width: 1});
      for (var q = 0; q < o.ang.length; q++) {
        api.rect(bx + q * wBar + 1, base - hs[q], wBar - 2, hs[q], {fill: q <= o.kk ? c.c3 : c.muted, fillOpacity: q === o.kk ? 1 : q < o.kk ? 0.7 : 0.22, rx: 2});
      }
      api.label([bx + 3, base + 13], "0", {color: c.muted, size: 12, anchor: "middle"});
      api.label([bx + bw, base + 13], "k = " + KMAX, {color: c.muted, size: 12, anchor: "end"});
      // the value sits above every bar its text spans (the text is wider than one bar)
      var txt = api.fmt(o.ang[o.kk], 1) + "°", tw = txt.length * 12 * 0.6 + 4, cxv = Math.min(Math.max(bx + (o.kk + 0.5) * wBar, bx + tw / 2 - 4), api.w - tw / 2 - 2);
      var top = 0;
      for (q = 0; q < hs.length; q++) { var x0b = bx + q * wBar, x1b = x0b + wBar; if (x1b > cxv - tw / 2 && x0b < cxv + tw / 2) top = Math.max(top, hs[q]); }
      halo(api.label([cxv, base - top - 10], txt, {color: c.c3, size: 12, weight: 650, anchor: "middle"}));
      // labels take the color of what they name (the stylesheet would paint them all ink)
      Array.prototype.forEach.call(api.svg.querySelectorAll("text"), function (t) { t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
