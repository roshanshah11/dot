// Straight-line depreciation: an asset bought for C loses the same (C - S) / L of book value every year
// until it reaches its salvage value S. Each bar is the cost split into book value (what is left on the
// balance sheet) and accumulated depreciation (what has been expensed so far); the bars never change height.
Viz.register("straight-line-depreciation", {
  title: "Straight-line depreciation",
  subject: "finance",
  shows: "Slide cost, salvage, life and age: book value drops by the same (C − S)/L every year until it reaches salvage, and accumulated depreciation fills the gap",
  params: {
    costUsd: {kind: "number", default: 60000, min: 20000, max: 100000, step: 1000, label: "C"},
    salvageFraction: {kind: "number", default: 0.1, min: 0, max: 0.5, step: 0.01, label: "S/C"},
    usefulLifeYears: {kind: "integer", default: 5, min: 3, max: 10, label: "L"},
    ageFraction: {kind: "number", default: 0.4, min: 0, max: 1, step: 0.01, label: "t/L"}
  },
  formula: function (v) {
    var S = v.costUsd * v.salvageFraction, D = (v.costUsd - S) / v.usefulLifeYears;
    var k = function (x) { return x.toLocaleString("en-US", {maximumFractionDigits: 2}).replace(/,/g, "{,}"); };
    return "D=\\frac{C-S}{L}=\\frac{" + k(v.costUsd) + "-" + k(S) + "}{" + v.usefulLifeYears + "}=\\$" + k(D) + "\\,/\\text{yr}";
  },
  status: function (v) {
    var C = v.costUsd, S = C * v.salvageFraction, L = v.usefulLifeYears, D = (C - S) / L, t = v.ageFraction * L;
    var m = function (x) { return Viz.money(Math.round(x), 0); };
    if (v.ageFraction <= 0) return "Brand new: book value equals cost, <b>" + m(C) + "</b>, and nothing has been expensed yet.";
    if (v.ageFraction >= 1) return "Fully depreciated after " + L + " years: book value has reached salvage, <b>" + m(S) + "</b>, and stops falling.";
    return "At " + Viz.fmt(t, 1) + " years (" + Math.round(v.ageFraction * 100) + "% of its life) it has " + m(D * t) +
      " of accumulated depreciation, leaving a book value of <b>" + m(C - D * t) + "</b>.";
  },
  examples: [
    {name: "no salvage, long life", values: {salvageFraction: 0, usefulLifeYears: 10, ageFraction: 0.5}},
    {name: "fully depreciated", values: {ageFraction: 1}},
    {name: "brand new, cheap asset", values: {costUsd: 20000, salvageFraction: 0.5, usefulLifeYears: 3, ageFraction: 0}}
  ],
  size: [400, 280],
  draw: function (api, v) {
    var c = api.color, C = v.costUsd, S = C * v.salvageFraction, L = v.usefulLifeYears, D = (C - S) / L, t = v.ageFraction * L;
    // the value axis follows the cost: the smallest round step that covers 1.2 C in at most five gridlines, so a
    // $20k asset fills the plot as well as a $100k one (headroom stays 1.2-1.5x)
    var step = [2500, 5000, 10000, 20000, 25000].filter(function (st) { return Math.ceil(C * 1.2 / st - 1e-9) <= 5; })[0];
    var x0 = 54, x1 = 318, top = 44, base = 236, maxV = step * Math.ceil(C * 1.2 / step - 1e-9);
    var Y = function (val) { return base - (base - top) * val / maxV; };
    var X = function (yr) { return x0 + 16 + yr * (x1 - x0 - 32) / L; };
    var bw = Math.min(24, (x1 - x0 - 32) / L * 0.56);
    // legend row: the two parts every bar is split into
    api.rect(x0, 9, 11, 11, {fill: c.c2, fillOpacity: 0.7, rx: 2});
    api.label([x0 + 17, 15], "book value", {color: c.c2, size: 12});
    api.rect(x0 + 104, 9, 11, 11, {fill: c.c3, fillOpacity: 0.8, rx: 2});
    api.label([x0 + 121, 15], "accumulated depreciation", {color: c.c3, size: 12});
    // value axis with light gridlines
    for (var g = 0; g <= maxV + 1; g += step) {
      api.line([x0, Y(g)], [x1, Y(g)], {color: c.grid, width: 1});
      api.label([x0 - 7, Y(g)], g === 0 ? "$0" : "$" + Viz.fmt(g / 1000, 1) + "k", {color: c.muted, size: 12, anchor: "end"});
    }
    api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
    // one bar per year end: book value (blue) under accumulated depreciation (amber); every bar is the full cost
    var every = L <= 6 ? 1 : 2;
    for (var yr = 0; yr <= L; yr++) {
      var bv = C - D * yr, x = X(yr);
      api.rect(x - bw / 2, Y(bv), bw, base - Y(bv), {fill: c.c2, fillOpacity: 0.5, rx: 2});
      if (yr > 0) api.rect(x - bw / 2, Y(C), bw, Y(bv) - Y(C), {fill: c.c3, fillOpacity: 0.65, rx: 2});
      if (yr % every === 0 || yr === L) api.label([x, base + 14], String(yr), {color: c.muted, size: 12, anchor: "middle"});
    }
    api.label([x1, base + 31], "years owned", {color: c.muted, size: 12, anchor: "end"});
    // cost and salvage levels, named in the right gutter (pushed apart when they get close)
    var yC = Y(C), yS = Y(S);
    api.line([x0, yC], [x1 + 6, yC], {color: c.ink, width: 1, dash: "2 4", opacity: 0.5});
    api.line([x0, yS], [x1 + 6, yS], {color: c.c2, width: 1.2, dash: "4 4", opacity: 0.8});
    var lyS = Math.min(base - 8, yS), lyC = Math.min(yC, lyS - 32);
    api.label([x1 + 12, lyC - 7], "cost", {color: c.muted, size: 12});
    api.label([x1 + 12, lyC + 8], api.money(C, 0), {color: c.ink, size: 12.5, weight: 650});
    api.label([x1 + 12, lyS - 7], "salvage", {color: c.muted, size: 12});
    api.label([x1 + 12, lyS + 8], api.money(Math.round(S), 0), {color: c.c2, size: 12.5, weight: 650});
    // the book-value line from cost down to salvage
    api.line([X(0), yC], [X(L), yS], {color: c.c2, width: 2.5});
    // today: the asset at age t, its book value read off the line
    var xt = X(t), bvt = C - D * t, pt = [xt, Y(bvt)];
    api.line([xt, base], [xt, yC - 4], {color: c.ink, width: 1.5, dash: "3 4", opacity: 0.75});
    api.point(pt, {color: c.c2, r: 5.5, stroke: c.card});
    var wL = ("book value " + api.money(Math.round(bvt), 0)).length * 7 + 8, right = v.ageFraction < 0.5;
    if (right && xt + 10 + wL > x1 + 8) right = false;
    if (!right && xt - 10 - wL < x0 - 6) right = true;
    var anc = right ? "start" : "end", lx = right ? Math.min(xt + 10, x1 + 8 - wL) : Math.max(xt - 10, x0 - 6 + wL);
    // above the bars (its card may rise past the plot top as long as it clears the legend row), otherwise just under
    // the point on a backing card; with the axis at 1.2-1.5x cost there is always room above
    var above = yC - 42 >= 24, ly = above ? yC - 32 : Math.max(top + 14, Math.min(base - 34, pt[1] + 20));
    if (above) api.line([xt, yC - 4], [xt, ly + 8], {color: c.ink, width: 1.5, dash: "3 4", opacity: 0.75});
    var t1 = "book value " + api.money(Math.round(bvt), 0), t2 = "at age " + api.fmt(t, 1) + " yr", wB = t1.length * 12.5 * 0.56 + 10;
    api.rect(right ? lx - 4 : lx - wB + 4, ly - 10, wB, 36, {fill: c.card, fillOpacity: 0.9, rx: 5});
    api.label([lx, ly], t1, {color: c.c2, size: 12.5, weight: 650, anchor: anc});
    api.label([lx, ly + 16], t2, {color: c.ink, size: 12, anchor: anc});
    // viz.css sets every svg text to ink, which beats the fill attribute; an inline style keeps each label in its own color
    api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
  }
});
