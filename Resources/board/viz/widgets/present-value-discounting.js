// A cash flow n years out, pulled back to today one year at a time: each year divides by (1 + r).
Viz.register("present-value-discounting", {
  title: "Present value: discounting a future cash flow",
  subject: "finance",
  shows: "Slide the rate and the years: the future amount shrinks by 1 + r for every year it is pulled back to today",
  params: {
    fv: {kind: "number", default: 1000, min: 100, max: 10000, step: 50, label: "FV"},
    r: {kind: "number", default: 0.08, min: 0, max: 0.25, step: 0.005, label: "r"},
    n: {kind: "integer", default: 5, min: 1, max: 30, label: "n"}
  },
  formula: function (v) {
    var pv = v.fv / Math.pow(1 + v.r, v.n);
    return "PV=\\frac{FV}{(1+r)^n}=\\frac{" + Viz.n(v.fv, 0).replace(/(\d)(?=(\d{3})+$)/g, "$1{,}") + "}{(1+" + Viz.n(v.r, 3) + ")^{" + v.n + "}}=" + Viz.n(pv, 2);
  },
  status: function (v) {
    var pv = v.fv / Math.pow(1 + v.r, v.n), df = 1 / Math.pow(1 + v.r, v.n);
    return "Each dollar " + v.n + " year" + (v.n > 1 ? "s" : "") + " out is worth <b>" + Viz.money(df, 3).replace("$", "$") + "</b> today, so " +
      Viz.money(v.fv, 0) + " is worth <b>" + Viz.money(pv, 2) + "</b>.";
  },
  examples: [{name: "zero rate", values: {r: 0}}, {name: "high rate, long horizon", values: {r: 0.2, n: 30}}],
  size: [400, 280],
  draw: function (api, v) {
    var c = api.color, x0 = 48, x1 = 372, base = 232, top = 40, n = v.n;
    var vals = []; for (var t = 0; t <= n; t++) vals.push(v.fv / Math.pow(1 + v.r, n - t));
    var maxV = v.fv, sx = (x1 - x0) / n, sy = (base - top) / maxV, bw = Math.min(26, sx * 0.62);
    api.line([x0 - 10, base], [x1 + 10, base], {color: c.axis, width: 1.2});
    // bars: the value of the same cash flow seen from each year
    for (var k = 0; k <= n; k++) {
      var h = vals[k] * sy, x = x0 + k * sx;
      var isEnd = k === n, isNow = k === 0;
      api.rect(x - bw / 2, base - h, bw, h, {fill: isEnd ? c.c3 : isNow ? c.c1 : c.c2, fillOpacity: isEnd || isNow ? 0.95 : 0.35, rx: 3});
      var every = n <= 10 ? 1 : n <= 20 ? 2 : 5;
      if (k % every === 0 || isEnd) api.label([x, base + 14], String(k), {color: c.muted, size: 12, anchor: "middle", className: "tick"});
    }
    // the discounting path: an arrow from the future bar back to today
    var path = vals.map(function (val, k) { return [x0 + k * sx, base - val * sy - 8]; });
    api.polyline(path, {stroke: c.faint, width: 1.5, dash: "4 4"});
    api.arrow([x0 + n * sx, base - vals[n] * sy - 22], [x0 + 6, base - vals[0] * sy - 22], {color: c.ink, width: 2, halo: false, label: "÷ (1 + r) each year", labelAt: "mid", labelOffset: [0, -12], labelSize: 12.5});
    api.label([x0 + n * sx, base - vals[n] * sy - 36], "FV " + api.money(v.fv, 0), {color: c.c3, size: 13, weight: 650, anchor: "end"});
    api.label([x0 - 6, base - vals[0] * sy - 38], "PV " + api.money(vals[0], 0), {color: c.c1, size: 13, weight: 650, anchor: "start"});
    api.label([x1 + 10, base + 30], "year", {color: c.muted, size: 12, anchor: "end"});
  }
});
