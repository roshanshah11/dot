// FIFO vs LIFO on the same 300 units: three batches of 100 bought at different unit costs, then a sale
// (periodic system: every purchase comes before the sale). Each batch is a block whose width is units and whose
// height is unit cost, so its area is dollars. FIFO expenses blocks from the oldest end, LIFO from the newest end.
Viz.register("fifo-lifo-cost-flow", {
  title: "FIFO vs LIFO cost flow",
  subject: "finance",
  shows: "Slide units sold and flip the cost trend: FIFO expenses the oldest batches first and LIFO the newest, so when costs move the two report different COGS and inventory",
  params: {
    unitsSold: {kind: "integer", default: 180, min: 0, max: 300, step: 5, label: "\\text{sold}"},
    priceTrend: {kind: "enum", values: ["falling", "flat", "rising"], default: "rising", label: "\\text{costs}"}
  },
  costs: function (trend) { return trend === "rising" ? [10, 12, 14] : trend === "falling" ? [14, 12, 10] : [12, 12, 12]; },
  // units taken from each batch (oldest first) when n units are sold under a method
  take: function (n, lifo) {
    var out = [0, 0, 0], left = n, order = lifo ? [2, 1, 0] : [0, 1, 2];
    order.forEach(function (i) { var q = Math.min(100, left); out[i] = q; left -= q; });
    return out;
  },
  formula: function (v) {
    var s = Viz.get("fifo-lifo-cost-flow"), k = s.costs(v.priceTrend);
    var row = function (lifo) {
      var t = s.take(v.unitsSold, lifo), order = lifo ? [2, 1, 0] : [0, 1, 2], parts = [], tot = 0;
      order.forEach(function (i) { if (t[i]) { parts.push(t[i] + "\\cdot" + k[i]); tot += t[i] * k[i]; } });
      return (parts.length ? parts.join("+") + "=" : "") + tot.toLocaleString("en-US").replace(/,/g, "{,}");
    };
    return "\\begin{aligned}\\text{COGS}_{\\text{FIFO}}&=" + row(false) + "\\\\\\text{COGS}_{\\text{LIFO}}&=" + row(true) + "\\end{aligned}";
  },
  status: function (v) {
    var s = Viz.get("fifo-lifo-cost-flow"), k = s.costs(v.priceTrend), cogs = function (lifo) {
      var t = s.take(v.unitsSold, lifo); return t[0] * k[0] + t[1] * k[1] + t[2] * k[2];
    };
    var f = cogs(false), l = cogs(true), m = function (x) { return Viz.money(x, 0); };
    if (v.unitsSold === 0) return "Nothing sold yet: all <b>$3,600</b> of goods is still inventory under both methods.";
    if (v.unitsSold === 300) return "Everything sold: both methods expense the full <b>$3,600</b>, so the choice stops mattering.";
    if (f === l) return "Flat costs: every unit cost $12, so FIFO and LIFO give the same COGS, <b>" + m(f) + "</b>.";
    // the COGS gap moves gross profit dollar for dollar but tax only by the tax rate times the gap, so no tax amount here
    if (l > f) return "Rising costs: LIFO expenses the newest, dearest units, so its COGS is <b>" + m(l - f) + "</b> higher and its gross profit " + m(l - f) + " lower, which also cuts taxable income and the tax bill.";
    return "Falling costs: FIFO expenses the oldest, dearest units, so its COGS is <b>" + m(f - l) + "</b> higher and its gross profit " + m(f - l) + " lower, which also cuts taxable income and the tax bill.";
  },
  examples: [
    {name: "Minimum supported values", values: {unitsSold: 0}},
    {name: "Maximum supported values", values: {unitsSold: 300}},
    {name: "priceTrend: falling", values: {priceTrend: "falling"}},
    {name: "priceTrend: flat", values: {priceTrend: "flat"}}
  ],
  size: [400, 290],
  draw: function (api, v) {
    var c = api.color, s = Viz.get("fifo-lifo-cost-flow"), k = s.costs(v.priceTrend), n = v.unitsSold;
    // hy = 6 px per $ of unit cost: tall enough that the 10 / 12 / 14 steps read from the shape, not just the text
    var xa = 14, xb = 386, ux = (xb - xa) / 300, hy = 6;
    var panel = function (lifo, top) {
      var base = top + 22 + 14 * hy, t = s.take(n, lifo), cogs = 0;
      for (var i = 0; i < 3; i++) {
        var x = xa + i * 100 * ux, w = 100 * ux, h = k[i] * hy, sold = t[i] * ux;
        cogs += t[i] * k[i];
        // sold units sit at the end the method draws from: the left (oldest) side for FIFO, the right for LIFO
        var sx = lifo ? x + w - sold : x, rx = lifo ? x : x + sold;
        if (sold > 0) api.rect(sx, base - h, sold, h, {fill: c.c3, fillOpacity: 0.8, rx: 0});
        if (w - sold > 0) api.rect(rx, base - h, w - sold, h, {fill: c.c2, fillOpacity: 0.5, rx: 0});
        api.rect(x, base - h, w, h, {fill: "none", stroke: c.card, width: 2, rx: 0});
        api.label([x + w / 2, base - h / 2], "100 @ $" + k[i], {color: c.ink, size: 12.5, weight: 600, anchor: "middle"});
      }
      // the sale eats inward from one end
      if (n > 0) {
        var a = lifo ? xb : xa, b = lifo ? xb - n * ux : xa + n * ux;
        api.arrow([a, base + 9], [b, base + 9], {color: c.c3, width: 2.5, halo: false, head: 8});
      }
      api.label([xa, top + 8], lifo ? "LIFO: newest out first" : "FIFO: oldest out first", {color: c.ink, size: 13, weight: 650});
      api.label([xb, top + 8], "inventory " + api.money(3600 - cogs, 0), {color: c.c2, size: 12.5, weight: 600, anchor: "end"});
      api.label([xb - 124, top + 8], "COGS " + api.money(cogs, 0), {color: c.c3, size: 12.5, weight: 600, anchor: "end"});
      return base;
    };
    panel(false, 4);
    var base2 = panel(true, 130);
    api.label([xa + 50 * ux, base2 + 26], "batch 1 · oldest", {color: c.muted, size: 12, anchor: "middle"});
    api.label([xa + 150 * ux, base2 + 26], "batch 2", {color: c.muted, size: 12, anchor: "middle"});
    api.label([xa + 250 * ux, base2 + 26], "batch 3 · newest", {color: c.muted, size: 12, anchor: "middle"});
    api.label([200, base2 + 44], "width = units, height = unit cost, area = dollars", {color: c.muted, size: 12, anchor: "middle"});
    // viz.css sets every svg text to ink, which beats the fill attribute; an inline style keeps each label in its own color
    api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
  }
});
