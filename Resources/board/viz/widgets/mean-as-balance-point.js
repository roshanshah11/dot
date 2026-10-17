// The mean as the balance point of a beam. Five equal weights sit on a weightless ruler at the data values; the
// fulcrum is wherever you put it. Each weight turns the beam by its distance from the fulcrum (x_i − f), so the net
// turning effect is Σ(x_i − f) = Σx_i − n·f, which is zero exactly when f = Σx_i / n, the mean. Off the mean the beam
// tips toward the heavier side; the drawn tilt grows with the net torque and saturates at 10° (a picture of the
// direction and size, not a dynamics simulation). Below: the total distance of the weights on each side of the
// fulcrum; the bars match only at the mean. Drag the blocks along the beam, or drag the fulcrum.
// Dot's design: the queue gives no parameters. f drives the idea; the five values are draggable (control: false).
(function () {
  var KEYS = ["x1", "x2", "x3", "x4", "x5"];
  function calc(v) {
    var xs = KEYS.map(function (k) { return v[k]; }), sum = xs.reduce(function (s, x) { return s + x; }, 0);
    var left = 0, right = 0;
    xs.forEach(function (x) { if (x < v.f) left += v.f - x; else right += x - v.f; });
    return {xs: xs, sum: sum, mean: sum / 5, net: sum - 5 * v.f, left: left, right: right};
  }
  function bal(k) { return Math.abs(k.net) < 1e-6; }

  var params = {f: {kind: "number", default: 5, min: 0, max: 10, step: 0.1, label: "f"}};
  [1, 2, 2, 6, 9].forEach(function (d, i) { params[KEYS[i]] = {kind: "integer", default: d, min: 0, max: 10, label: "x_" + (i + 1), control: false}; });

  Viz.register("mean-as-balance-point", {
    title: "The mean as a balance point",
    subject: "stats",
    shows: "Move the fulcrum: the beam balances only at the mean, where the distances to the left and right weigh the same",
    params: params,
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\sum_i (x_i-f)=\\sum_i x_i-nf\\\\\\quad=" + k.sum + "-5\\cdot" + Viz.p(v.f) + "=" + Viz.n(k.net) +
        "\\\\[4pt]\\text{balanced when } f=\\bar x=\\tfrac{" + k.sum + "}{5}=" + Viz.n(k.mean) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (bal(k)) return "<b>Balanced</b>: the fulcrum is at the mean " + Viz.fmt(k.mean) + ", where the left distances (" + Viz.fmt(k.left) +
        ") equal the right ones (" + Viz.fmt(k.right) + ").";
      var dir = k.net > 0 ? "right" : "left";
      return "Tips <b>" + dir + "</b>: the deviations sum to " + (k.net > 0 ? "+" : "−") + Viz.fmt(Math.abs(k.net)) + ", so the fulcrum must move " +
        dir + " by <b>" + Viz.fmt(Math.abs(k.net) / 5) + "</b> to the mean " + Viz.fmt(k.mean) + ".";
    },
    examples: [
      {name: "fulcrum at the mean", values: {f: 4}},
      {name: "fulcrum at 0", values: {f: 0}},
      {name: "fulcrum at 10", values: {f: 10}},
      {name: "all weights at 0", values: {x1: 0, x2: 0, x3: 0, x4: 0, x5: 0, f: 0}},
      {name: "all weights at 10", values: {x1: 10, x2: 10, x3: 10, x4: 10, x5: 10, f: 10}},
      {name: "symmetric data", values: {x1: 2, x2: 4, x3: 5, x4: 6, x5: 8, f: 5}}
    ],
    size: [400, 298],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 34, s = 33.2, py = 104, ground = 190, ghost = 26;
      var th = (10 * Math.PI / 180) * Math.tanh(k.net / 8), co = Math.cos(th), si = Math.sin(th);
      var px = x0 + v.f * s;
      var B = function (x, up) { var d = (x - v.f) * s; return [px + d * co + up * si, py + d * si - up * co]; };   // beam coords to px
      // ground and fulcrum
      api.line([14, ground], [386, ground], {color: c.axis, width: 1.4});
      api.polygon([[px, py + 5], [px - 16, ground], [px + 16, ground]], {fill: bal(k) ? c.c1 : c.muted, fillOpacity: 0.85});
      api.label([px, ground + 13], "f = " + api.fmt(v.f), {color: bal(k) ? c.c1 : c.ink, size: 12.5, weight: 650, anchor: "middle"});
      // the beam: a ruler 0..10 that turns about the fulcrum
      api.polygon([B(-0.25, 0), B(10.25, 0), B(10.25, -7), B(-0.25, -7)], {fill: c.ink, fillOpacity: 0.16, stroke: c.faint, width: 1});
      // tick numbers sit 19 below the beam's top edge (12 below its underside, clear of the beam end at a 10° tilt);
      // the one over the fulcrum is skipped (the "f = …" label names that spot), and so is one that would land on the
      // dashed ghost fulcrum at the mean (its own label names that spot)
      for (var t = 0; t <= 10; t++) {
        api.line(B(t, 0), B(t, -4), {color: c.muted, width: 1});
        var at = B(t, -19), onGhost = !bal(k) && Math.abs(t - k.mean) < 0.5 && at[1] + 6 > ground - ghost;
        if (t % 2 === 0 && Math.abs(t - v.f) >= 0.5 && !onGhost) api.label(at, String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.point(B(v.f, -3.5), {color: c.ink, r: 3});
      // the mean: where the fulcrum has to go (a dashed ghost fulcrum on the ground)
      if (!bal(k)) {
        var mx = x0 + k.mean * s;
        api.polygon([[mx, ground - ghost], [mx - 12, ground], [mx + 12, ground]], {fill: c.c1, fillOpacity: 0.12, stroke: c.c1, dash: "4 3", width: 1.5});
        api.label([mx, ground + 28], "balances at x̄ = " + api.fmt(k.mean), {color: c.c1, size: 12.5, weight: 650, anchor: "middle"});
      }
      // weights: unit blocks stacked on the beam
      var seen = {};
      k.xs.forEach(function (x, i) {
        var n = seen[x] = (seen[x] || 0) + 1, lo = 2 + (n - 1) * 15, col = x < v.f ? c.c2 : x > v.f ? c.c3 : c.muted;
        var w = 0.36;
        api.polygon([B(x - w, lo), B(x + w, lo), B(x + w, lo + 14), B(x - w, lo + 14)], {fill: col, fillOpacity: 0.9, stroke: c.card, width: 1});
        api.handle(B(x, lo + 7), {color: col, r: 4, onDrag: function (q) {
          var t = Math.round(((q[0] - px) * co + (q[1] - py) * si) / s + v.f), patch = {};
          patch[KEYS[i]] = Math.max(0, Math.min(10, t)); api.set(patch);
        }});
      });
      if (!bal(k)) api.label(k.net > 0 ? [388, 14] : [12, 14], k.net > 0 ? "tips right ↘" : "↙ tips left",
        {color: k.net > 0 ? c.c3 : c.c2, size: 12.5, weight: 650, anchor: k.net > 0 ? "end" : "start"});
      api.handle([px, ground - 22], {color: bal(k) ? c.c1 : c.ink, r: 6, onDrag: function (q) {
        api.set({f: Math.max(0, Math.min(10, Math.round((q[0] - x0) / s * 10) / 10))});
      }});
      // the two pulls: total distance left of f and right of f
      var bx = 200, sc = Math.min(8, 160 / Math.max(k.left, k.right, 1)), yb = 262;
      api.label([bx - 6, 242], "left of f: " + api.fmt(k.left), {color: c.c2, size: 12, weight: 650, anchor: "end"});
      api.label([bx + 6, 242], "right of f: " + api.fmt(k.right), {color: c.c3, size: 12, weight: 650});
      api.rect(bx - k.left * sc, yb - 8, k.left * sc, 16, {fill: c.c2, fillOpacity: 0.85, rx: 3});
      api.rect(bx, yb - 8, k.right * sc, 16, {fill: c.c3, fillOpacity: 0.85, rx: 3});
      api.line([bx, yb - 14], [bx, yb + 14], {color: c.ink, width: 2});
      api.label([bx, 286], bal(k) ? "equal: the deviations sum to 0" : "net " + (k.net > 0 ? "+" : "−") + api.fmt(Math.abs(k.net)) + " to the " + (k.net > 0 ? "right" : "left"),
        {color: bal(k) ? c.c1 : c.muted, size: 12, anchor: "middle", weight: 600});
    }
  });
})();
