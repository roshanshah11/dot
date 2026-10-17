// The geometric distribution: X is the trial on which the first success happens, each trial independent with success
// probability p. Top: the one sequence that gives X = k, k - 1 failures then a success, which is why
// P(X = k) = (1 - p)^(k - 1) p. Bottom: the whole distribution for k = 1 to 16 (it continues past 16), every bar
// (1 - p) times the one before, with the chosen k highlighted and the mean 1/p dashed.
(function () {
  function calc(v) {
    var p = v.success_probability, k = v.selected_trial, q = 1 - p;
    return {p: p, q: q, k: k, pk: p * Math.pow(q, k - 1), cdf: 1 - Math.pow(q, k), mean: 1 / p};
  }
  function tex(x) {
    if (x >= 0.0001) return Viz.n(x, 4);
    var e = Math.floor(Math.log10(x)); return Viz.n(x / Math.pow(10, e), 1) + "\\times10^{" + e + "}";
  }
  function pc(x) { var y = x * 100; return y >= 10 ? y.toFixed(1) + "%" : y >= 0.1 ? y.toFixed(2) + "%" : y >= 0.001 ? Number(y.toPrecision(2)) + "%" : "under 0.001%"; }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };

  Viz.register("geometric-distribution", {
    title: "Geometric distribution: waiting for the first success",
    subject: "stats",
    shows: "Set the success chance and pick a trial: the first success lands on trial k only after k − 1 failures, so each bar is (1 − p) times the one before",
    params: {
      success_probability: {kind: "number", default: 0.25, min: 0.05, max: 0.8, step: 0.05, label: "p"},
      selected_trial: {kind: "integer", default: 4, min: 1, max: 16, label: "k"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}P(X=k)=p(1-p)^{k-1}\\\\P(X=" + k.k + ")=" + Viz.n(k.p, 2) + "(" + Viz.n(k.q, 2) + ")^{" + (k.k - 1) + "}\\\\\\quad=" + tex(k.pk) +
        "\\\\\\mathbb{E}[X]=1/p=" + Viz.n(k.mean, 2) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      var tail = "; on average the first success takes <b>" + f(k.mean) + "</b> trials.";
      if (k.k === 1) return "The very first trial succeeds with probability p = <b>" + pc(k.p) + "</b>, the tallest bar" + tail;
      return "The first success lands exactly on trial " + k.k + " with probability <b>" + pc(k.pk) + "</b>: " + (k.k - 1) + " failure" + (k.k > 2 ? "s" : "") +
        " at " + f(k.q) + " each, then a success at " + f(k.p) + tail;
    },
    examples: [
      {name: "Minimum supported values", values: {success_probability: 0.05, selected_trial: 1}},
      {name: "Maximum supported values", values: {success_probability: 0.8, selected_trial: 16}},
      {name: "fair coin, third toss", values: {success_probability: 0.5, selected_trial: 3}},
      {name: "rare success", values: {success_probability: 0.05, selected_trial: 12}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 46, x1 = 386, yB = 256, yT = 104, slot = (x1 - x0) / 16, bw = slot * 0.68;
      // the sequence behind X = k
      var box = 20, gap = 2, sx = Math.max(8, (400 - k.k * (box + gap)) / 2);
      for (var i = 1; i <= k.k; i++) {
        var win = i === k.k, bx = sx + (i - 1) * (box + gap), col = win ? c.c4 : c.c5;
        api.rect(bx, 16, box, box, {fill: col, fillOpacity: win ? 0.9 : 0.25, stroke: col, width: 1.2, rx: 4});
        api.label([bx + box / 2, 26], win ? "S" : "F", {color: win ? c.card : c.c5, size: 12, weight: 700, anchor: "middle"});
      }
      var seq = k.k === 1 ? "success on the first trial, p = " + f(k.p) : (k.k - 1) + " failure" + (k.k > 2 ? "s" : "") + " at 1 − p = " + f(k.q) + ", then a success at p = " + f(k.p);
      api.label([200, 52], seq, {color: c.muted, size: 12, anchor: "middle"});
      // bar chart, y scale fitted to the tallest bar (P(X = 1) = p)
      var top = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8].filter(function (t) { return t >= k.p - 1e-9; })[0];
      var stepY = top <= 0.05 ? 0.01 : top <= 0.2 ? 0.05 : top <= 0.4 ? 0.1 : 0.2;
      var Y = function (y) { return yB - (yB - yT) * y / top; };
      for (var g = stepY; g <= top + 1e-9; g += stepY) {
        api.line([x0, Y(g)], [x1, Y(g)], {color: c.grid, width: 1});
        api.label([x0 - 6, Y(g)], Viz.fmt(g, 2), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([x0 - 30, 74], "bars: P(X = k)", {color: c.muted, size: 12});
      for (var j = 1; j <= 16; j++) {
        var pj = k.p * Math.pow(k.q, j - 1), cx = x0 + (j - 0.5) * slot, sel = j === k.k;
        api.rect(cx - bw / 2, Y(pj), bw, yB - Y(pj), {fill: sel ? c.c3 : c.c2, fillOpacity: sel ? 0.95 : 0.5, rx: 2});
        api.label([cx, yB + 14], String(j), {color: sel ? c.c3 : c.muted, size: 12, weight: sel ? 700 : 500, anchor: "middle"});
      }
      api.line([x0, yB], [x1 + 6, yB], {color: c.axis, width: 1.4});
      api.label([x1 + 6, yB + 32], "trial of the first success", {color: c.muted, size: 12, anchor: "end"});
      // the chosen bar's value (amber, like its bar) and the mean 1/p, each on its own row above the chart
      api.label([x1 + 6, 74], "P(X = " + k.k + ")" + (k.pk >= 0.001 ? " = " + f(k.pk, 3) : " < 0.001"), {color: c.c3, size: 13, weight: 700, anchor: "end"});
      var mx = x0 + (k.mean - 0.5) * slot, ym = yT - 12;
      if (k.mean <= 16.4) {
        api.line([mx, yB], [mx, ym + 6], {color: c.ink, width: 1.5, dash: "4 4"});
        api.label([mx + (mx > 290 ? -5 : 5), ym], "mean 1/p = " + f(k.mean), {color: c.ink, size: 12.5, weight: 600, anchor: mx > 290 ? "end" : "start"});
      } else {
        api.arrow([x1 - 70, ym], [x1 + 4, ym], {color: c.ink, width: 1.8, halo: false, head: 8});
        api.label([x1 - 76, ym], "mean 1/p = " + f(k.mean) + ", off the chart", {color: c.ink, size: 12.5, weight: 600, anchor: "end"});
      }
      // viz.css sets every svg text's fill to ink, which beats the fill attribute api.label writes: restate it inline
      api.svg.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
