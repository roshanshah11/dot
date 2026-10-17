// The mean of three observations, two ways. Top: as fair shares. The bars are the values; the part of each bar
// above the mean (amber) exactly fills the gaps below it (blue), so levelling every bar to the mean uses the same
// total. Bottom: as a balance point. On the number line the mean is where the values balance, because the
// deviations to its left (blue) and right (amber) sum to zero. Drag a bar's top, or use the sliders.
(function () {
  var KEYS = ["observation1", "observation2", "observation3"];
  function calc(v) {
    var xs = KEYS.map(function (key) { return v[key]; }), sum = xs[0] + xs[1] + xs[2], m = sum / 3;
    return {xs: xs, sum: sum, m: m, dev: xs.map(function (x) { return x - m; })};
  }
  function sg(x) { return Math.abs(x) < 1e-9 ? "0" : (x > 0 ? "+" : "−") + Viz.fmt(Math.abs(x)); }

  Viz.register("arithmetic-mean", {
    title: "The arithmetic mean",
    subject: "stats",
    shows: "Change the three values: the mean is the equal share of their total, and the balance point where the deviations cancel",
    params: {
      observation1: {kind: "integer", default: 2, min: 1, max: 10, label: "x_1"},
      observation2: {kind: "integer", default: 4, min: 1, max: 10, label: "x_2"},
      observation3: {kind: "integer", default: 7, min: 1, max: 10, label: "x_3"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\bar{x}=\\frac{x_1+x_2+x_3}{3}=\\frac{" + k.xs.join("+") + "}{3}=\\frac{" + k.sum + "}{3}=" + Viz.n(k.m);
    },
    status: function (v) {
      var k = calc(v);
      if (k.xs[0] === k.xs[1] && k.xs[1] === k.xs[2]) return "All three values are " + k.xs[0] + ", so the mean is <b>" + k.xs[0] + "</b> and every deviation is 0.";
      return "The values sum to <b>" + k.sum + "</b>; shared equally that is <b>" + Viz.fmt(k.m) + "</b> each, and the deviations " +
        k.dev.map(sg).join(", ") + " cancel to zero.";
    },
    examples: [
      {name: "Minimum supported values", values: {observation1: 1, observation2: 1, observation3: 1}},
      {name: "Maximum supported values", values: {observation1: 10, observation2: 10, observation3: 10}},
      {name: "one large value pulls the mean", values: {observation1: 1, observation2: 2, observation3: 10}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v), base = 150, u = 11.5, bw = 54, bxs = [92, 192, 292];
      var Yb = function (x) { return base - x * u; }, ym = Yb(k.m);
      api.line([40, base], [340, base], {color: c.axis, width: 1.2});
      k.xs.forEach(function (x, i) {
        var cx = bxs[i], left = cx - bw / 2;
        api.rect(left, Yb(Math.min(x, k.m)), bw, Math.min(x, k.m) * u, {fill: c.muted, fillOpacity: 0.35, rx: 0});
        if (x > k.m + 1e-9) api.rect(left, Yb(x), bw, (x - k.m) * u, {fill: c.c3, fillOpacity: 0.75, rx: 0});
        if (x < k.m - 1e-9) api.rect(left, ym, bw, (k.m - x) * u, {fill: c.c2, fillOpacity: 0.12, stroke: c.c2, dash: "4 3", width: 1.5, rx: 0});
        api.label([cx, base + 14], "x_" + (i + 1) + " = " + x, {color: c.ink, size: 12.5, anchor: "middle", weight: 600});
        api.handle([cx, Yb(x)], {color: c.ink, r: 6, onDrag: function (q) {
          var patch = {}; patch[KEYS[i]] = Math.max(1, Math.min(10, Math.round((base - q[1]) / u))); api.set(patch);
        }});
      });
      api.line([40, ym], [340, ym], {color: c.c1, width: 2.5, dash: "7 4"});
      api.label([346, ym], "x̄ " + api.fmt(k.m), {color: c.c1, size: 13, weight: 700});
      var sur = k.dev.reduce(function (a, d) { return a + Math.max(0, d); }, 0);
      if (sur > 1e-9) {
        api.label([40, 16], "above the mean: " + api.fmt(sur), {color: c.c3, size: 12, weight: 650});
        api.label([340, 16], "gaps below it: " + api.fmt(sur), {color: c.c2, size: 12, weight: 650, anchor: "end"});
      }
      // the balance: deviations from the mean on a number line
      var X = function (x) { return 40 + (x / 10) * 300; }, yl = 236;   // right margin left free for the deviation labels
      api.line([X(0), yl], [X(10), yl], {color: c.axis, width: 1.4});
      for (var t = 0; t <= 10; t++) {
        api.line([X(t), yl - 3], [X(t), yl + 3], {color: c.axis, width: 1});
        api.label([X(t), yl + 28], String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.polygon([[X(k.m), yl + 2], [X(k.m) - 9, yl + 17], [X(k.m) + 9, yl + 17]], {fill: c.c1, fillOpacity: 0.9});
      var seen = {};
      k.xs.forEach(function (x, i) {
        var stack = seen[x] = (seen[x] || 0) + 1, d = k.dev[i], ya = 222 - i * 15;
        api.circle([X(x), yl - 7 - (stack - 1) * 11], 5, {fill: c.ink, stroke: c.card, width: 1.2});
        if (Math.abs(d) > 1e-9) {
          var col = d > 0 ? c.c3 : c.c2;
          api.arrow([X(k.m), ya - 12], [X(x), ya - 12], {color: col, width: 2.5, halo: false, head: Math.min(9, Math.abs(X(x) - X(k.m)) * 0.7)});
          api.label([X(x) + (d > 0 ? 6 : -6), ya - 12], sg(d), {color: col, size: 12, weight: 650, anchor: d > 0 ? "start" : "end"});
        }
      });
      api.label([X(5) + 16, 282], "the mean is the balance point: the deviations sum to 0", {color: c.muted, size: 12, anchor: "middle"});
    }
  });
})();
