// Compound interest: a balance that earns ratePercent each period on everything already in it. Each bar is the balance
// after k periods, split into the principal, the simple interest (r x P every period) and the interest earned on
// earlier interest, which is the whole difference between compounding and simple interest.
// Ranges are narrower than the queue's schema (amount up to $1bn, 100% a period, 1,000 periods): a slider across those
// cannot be read, the number box shows five digits, and the picture is the same shape at any scale.
(function () {
  function grow(v) {
    var P = v.amount, r = v.ratePercent / 100, n = v.periods, A = P * Math.pow(1 + r, n), simple = P * r * n;
    return {P: P, r: r, n: n, A: A, simple: simple, ioi: A - P - simple, dbl: r > 0 ? Math.log(2) / Math.log(1 + r) : Infinity};
  }
  function cash(x) { return "$" + x.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2}); }
  function big(x) { return x >= 1e6 ? Viz.money(x) : cash(x); }
  function tex(x) { return x >= 1e6 ? "\\$" + Viz.money(x).slice(1).replace(/(bn|m)$/, "\\text{$1}") : "\\$" + cash(x).slice(1).replace(/,/g, "{,}"); }
  function short(x) {
    var a = Math.abs(x), f = function (q) { return String(Math.round(q * 10) / 10); };
    return "$" + (a >= 1e9 ? f(x / 1e9) + "bn" : a >= 1e6 ? f(x / 1e6) + "m" : a >= 1e3 ? f(x / 1e3) + "k" : f(x));
  }
  function tint(api) { Array.prototype.forEach.call(api.svg.querySelectorAll("text"), function (t) { t.style.fill = t.getAttribute("fill"); }); }

  Viz.register("compound-interest", {
    title: "Compound interest",
    subject: "finance",
    shows: "Slide the rate and the number of periods: the balance grows by 1 + r each period, and the amber interest on interest is what makes the curve bend upward",
    params: {
      amount: {kind: "number", default: 1000, min: 10, max: 10000, step: 10, label: "P"},
      ratePercent: {kind: "number", default: 5, min: 0, max: 20, step: 0.25, label: "r\\,\\%"},
      periods: {kind: "integer", default: 20, min: 0, max: 50, label: "n"}
    },
    formula: function (v) {
      var g = grow(v);
      return "A=P(1+r)^n=" + tex(g.P).replace(/\.00$/, "") + "\\,(" + Viz.n(1 + g.r, 4) + ")^{" + g.n + "}=" + tex(g.A);
    },
    status: function (v) {
      var g = grow(v);
      if (g.n === 0) return "No periods have passed, so the balance is still the <b>" + big(g.P) + "</b> you put in.";
      if (g.r === 0) return "At 0% nothing compounds: the balance stays at <b>" + big(g.P) + "</b>.";
      return big(g.P) + " grows to <b>" + big(g.A) + "</b> after " + g.n + " period" + (g.n > 1 ? "s" : "") + "; <b>" + big(g.ioi) +
        "</b> of it is interest on interest, and the balance doubles every " + g.dbl.toFixed(1) + " periods (rule of 72: " + (72 / v.ratePercent).toFixed(1) + ").";
    },
    examples: [
      {name: "Minimum supported values", values: {amount: 10, ratePercent: 0, periods: 0}},
      {name: "Maximum supported values", values: {amount: 10000, ratePercent: 20, periods: 50}},
      {name: "8% for 9 periods doubles it", values: {amount: 1000, ratePercent: 8, periods: 9}},
      {name: "one period", values: {periods: 1}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, g = grow(v), x0 = 58, x1 = 392, base = 246, top = 76, n = g.n;
      var maxV = g.A * 1.02, Y = function (q) { return base - q / maxV * (base - top); };
      // y ticks at a round step
      var raw = maxV / 4, e = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e, tk = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
      for (var t = 0; t <= maxV + 1e-9; t += tk) {
        api.line([x0, Y(t)], [x1, Y(t)], {color: c.grid, width: 1});
        api.label([x0 - 6, Y(t)], short(t), {color: c.muted, size: 12, anchor: "end"});
      }
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
      var sp = (x1 - x0) / (n + 1), bw = Math.max(2, Math.min(22, sp * 0.72));
      for (var k = 0; k <= n; k++) {
        var cx = x0 + sp * (k + 0.5), bal = g.P * Math.pow(1 + g.r, k), simp = g.P * g.r * k;
        api.rect(cx - bw / 2, Y(g.P), bw, base - Y(g.P), {fill: c.c2, fillOpacity: 0.8, rx: bw > 6 ? 2 : 0});
        if (simp > 0) api.rect(cx - bw / 2, Y(g.P + simp), bw, Y(g.P) - Y(g.P + simp), {fill: c.c1, fillOpacity: 0.85, rx: 0});
        if (bal - g.P - simp > 0) api.rect(cx - bw / 2, Y(bal), bw, Y(g.P + simp) - Y(bal), {fill: c.c3, fillOpacity: 0.9, rx: 0});
        var every = n <= 10 ? 1 : n <= 25 ? 5 : 10;
        if (k % every === 0 || k === n) api.label([cx, base + 14], String(k), {color: k === n ? c.ink : c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1, base + 30], "periods", {color: c.muted, size: 12, anchor: "end"});
      // simple interest alone would be a straight line through the teal tops
      if (n > 0 && g.r > 0) api.line([x0 + sp * 0.5, Y(g.P)], [x0 + sp * (n + 0.5), Y(g.P + g.simple)], {color: c.c1, width: 1.5, dash: "4 4"});
      // doubling time
      if (g.dbl <= n) {
        var xd = x0 + sp * (g.dbl + 0.5);
        api.line([x0, Y(2 * g.P)], [xd, Y(2 * g.P)], {color: c.ink, width: 1.2, dash: "2 4", opacity: 0.7});
        api.line([xd, Y(2 * g.P)], [xd, base], {color: c.ink, width: 1.2, dash: "2 4", opacity: 0.7});
        var roomLeft = xd - x0 > 100;   // bars left of the doubling point are shorter than 2P, so the space above them is free
        api.label([roomLeft ? xd - 4 : xd + 4, Y(2 * g.P) - 10], "doubles at " + g.dbl.toFixed(1), {color: c.ink, size: 12, weight: 600, anchor: roomLeft ? "end" : "start"});
      }
      api.label([x0 + sp * (n + 0.5), Y(g.A) - 10], big(g.A), {color: c.ink, size: 12.5, weight: 700, anchor: n > 4 ? "end" : "middle"});
      // what the final balance is made of
      api.label([8, 14], "principal " + big(g.P), {color: c.c2, size: 12, weight: 650});
      api.label([8, 31], "simple interest " + big(g.simple), {color: c.c1, size: 12, weight: 650});
      api.label([8, 48], "interest on interest " + big(Math.max(0, g.ioi)), {color: c.c3, size: 12, weight: 650});
      tint(api);
    }
  });
})();
