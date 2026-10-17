// The exponential distribution of a waiting time T with rate lambda (events per minute). The density
// f(t) = lambda e^(-lambda t) starts at height lambda and decays; the area left of t (blue) is P(T <= t) = 1 - e^(-lambda t)
// and the area right of it (amber, continuing past the 12-minute edge) is P(T > t) = e^(-lambda t). The vertical scale
// is fixed, so a bigger rate is visibly a taller, faster-decaying curve; the mean wait 1/lambda is the dashed line.
// The default wait is 3 min (not the queue's 5) so at lambda = 0.5 the amber tail is 22%, big enough to see.
(function () {
  function calc(v) {
    var l = v.rate, t = v.waiting_time, s = Math.exp(-l * t);
    return {l: l, t: t, f: l * s, surv: s, cdf: 1 - s, mean: 1 / l};
  }
  function pc(p) {   // a percent with enough digits that 99.9994% never rounds to 100% or 0.0006% to 0%
    var x = p * 100;
    if (100 - x < 0.1 && x < 100) return x.toFixed(Math.min(6, Math.ceil(-Math.log10(100 - x)) + 1)) + "%";
    return (x >= 10 ? x.toFixed(1) : x >= 0.1 ? x.toFixed(2) : Number(x.toPrecision(2)).toString()) + "%";
  }
  function tex(p) {   // a probability or density in LaTeX: 4 decimals, or scientific notation when tiny
    if (p >= 0.001 || p === 0) return Viz.n(p, 4);
    var e = Math.floor(Math.log10(p)); return Viz.n(p / Math.pow(10, e), 1) + "\\times10^{" + e + "}";
  }
  var f2 = function (x) { return Viz.fmt(x, 2); };

  Viz.register("exponential-distribution", {
    title: "Exponential distribution: waiting times",
    subject: "stats",
    shows: "Slide the rate and the wait: the density starts at λ and decays, the area past t is the chance of waiting longer than t, and the mean wait is 1/λ",
    params: {
      rate: {kind: "number", default: 0.5, min: 0.25, max: 1, step: 0.05, label: "\\lambda\\ (/\\text{min})"},
      waiting_time: {kind: "number", default: 3, min: 0, max: 12, step: 0.1, label: "t\\ (\\text{min})"}
    },
    formula: function (v) {
      var k = calc(v), t = Viz.n(k.t, 1), l = Viz.n(k.l, 2);
      return "\\begin{array}{l}f(t)=\\lambda e^{-\\lambda t},\\quad P(T>t)=e^{-\\lambda t}\\\\f(" + t + ")=" + l + "\\cdot e^{-" + l + "\\cdot" + t + "}=" + tex(k.f) +
        "\\\\P(T>" + t + ")=e^{-" + Viz.n(k.l * k.t, 3) + "}=" + tex(k.surv) + "\\\\\\mathbb{E}[T]=1/\\lambda=" + Viz.n(k.mean, 2) + "\\ \\text{min}\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (k.t === 0) return "Every wait is longer than 0 minutes, so P(T > 0) = <b>1</b>; at λ = " + f2(k.l) + " per minute the mean wait is <b>" + f2(k.mean) + " min</b>.";
      return "At λ = " + f2(k.l) + " per minute the mean wait is <b>" + f2(k.mean) + " min</b>; the chance you are still waiting after <b>" +
        Viz.fmt(k.t, 1) + " min</b> is <b>" + pc(k.surv) + "</b>.";
    },
    examples: [
      {name: "Minimum supported values", values: {rate: 0.25, waiting_time: 0}},
      {name: "Maximum supported values", values: {rate: 1, waiting_time: 12}},
      {name: "wait equal to the mean", values: {rate: 0.25, waiting_time: 4}},
      {name: "fast rate, short wait", values: {rate: 1, waiting_time: 1}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 46, x1 = 382, yB = 226, yT = 36;
      var X = function (t) { return x0 + (x1 - x0) * t / 12; }, Y = function (d) { return yB - (yB - yT) * d; };
      var dens = function (t) { return k.l * Math.exp(-k.l * t); };
      var curve = function (a, b) { var pts = []; for (var i = 0; i <= 60; i++) { var t = a + (b - a) * i / 60; pts.push([X(t), Y(dens(t))]); } return pts; };
      // grid and axes
      [0.25, 0.5, 0.75, 1].forEach(function (d) {
        api.line([x0, Y(d)], [x1, Y(d)], {color: c.grid, width: 1});
        api.label([x0 - 6, Y(d)], Viz.fmt(d, 2), {color: c.muted, size: 12, anchor: "end"});
      });
      api.label([x0 + 6, yT - 14], "density f(t)", {color: c.muted, size: 12});
      // areas: done by t (blue), still waiting (amber)
      if (k.t > 0) api.polygon([[X(0), yB]].concat(curve(0, k.t)).concat([[X(k.t), yB]]), {fill: c.c2, fillOpacity: 0.5});
      if (k.t < 12) {   // the tail: a stronger amber fill plus an amber edge just inside the teal curve, so it reads as amber, not olive
        api.polygon([[X(k.t), yB]].concat(curve(k.t, 12)).concat([[X(12), yB]]), {fill: c.c3, fillOpacity: 0.6});
        api.polyline(curve(k.t, 12).map(function (q) { return [q[0], Math.min(q[1] + 2.6, yB - 0.6)]; }), {stroke: c.c3, width: 1.6});
      }
      api.polyline(curve(0, 12), {stroke: c.c1, width: 2.5});
      api.line([x0, yB], [x1 + 8, yB], {color: c.axis, width: 1.4});
      api.line([x0, yB], [x0, yT - 4], {color: c.axis, width: 1.4});
      var tLab = "t = " + Viz.fmt(k.t, 1) + " min", tw = tLab.length * 7 / 2 + 3, tx = Math.max(tw, Math.min(api.w - tw, X(k.t)));   // where the t label lands after clamping
      for (var s = 0; s <= 12; s += 2) {
        api.line([X(s), yB], [X(s), yB + 4], {color: c.axis, width: 1});
        if (Math.abs(X(s) - tx) > tw + 8) api.label([X(s), yB + 14], String(s), {color: c.muted, size: 12, anchor: "middle"});
      }
      // the mean wait
      api.line([X(k.mean), yB], [X(k.mean), yT], {color: c.ink, width: 1.5, dash: "4 4"});
      api.label([X(k.mean) + 5, yT + 4], "mean 1/λ = " + f2(k.mean) + " min", {color: c.ink, size: 12.5, weight: 600});   // at the top of its line, clear of the t label
      // the chosen wait t and the density there
      var P = [X(k.t), Y(k.f)], right = P[0] < 290;
      api.line([P[0], yB], P, {color: c.c1, width: 2});
      api.point(P, {color: c.c1, r: 4.5});
      var fl = api.label([P[0] + (right ? 9 : -9), P[1] + (k.f > 0.8 ? 18 : -12)], k.f < 0.001 ? "f(t) < 0.001" : "f(t) = " + Viz.fmt(k.f, 3),   // near the top it goes below-right, clear of the titles
        {color: c.c1, size: 12.5, weight: 650, anchor: right ? "start" : "end"});
      fl.setAttribute("stroke", c.card); fl.setAttribute("stroke-width", 4); fl.setAttribute("paint-order", "stroke");   // a halo where the mean line passes behind it
      api.label([P[0], yB + 19], tLab, {color: c.c1, size: 12.5, weight: 650, anchor: "middle"});
      // the two probabilities
      api.label([x1, 50], "P(T ≤ t) = " + pc(k.cdf), {color: c.c2, size: 13, weight: 700, anchor: "end"});
      api.label([x1, 70], "P(T > t) = " + pc(k.surv), {color: c.c3, size: 13, weight: 700, anchor: "end"});
      api.handle([P[0], yB], {color: c.c1, r: 6, onDrag: function (q) {
        api.set({waiting_time: Math.max(0, Math.min(12, Math.round((q[0] - x0) / (x1 - x0) * 120) / 10))});
      }});
      // viz.css sets every svg text's fill to ink, which beats the fill attribute api.label writes: restate it inline
      api.svg.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
