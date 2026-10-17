// Absorption vs variable costing. Absorption costing puts fixed manufacturing overhead into each unit made, so units
// that go into inventory carry their overhead with them to a later period; variable costing expenses all of it now.
// Fixed case: price $40, variable manufacturing cost $15/unit, fixed selling and admin $3,000, fixed manufacturing
// overhead $8,000 a period. Overhead per unit follows the GAAP inventory rule (ASC 330): $8,000 over normal capacity of
// 1,000 units = $8/unit, and below normal the unabsorbed overhead is expensed; above normal the rate falls to
// $8,000 / units made so inventory never carries more overhead than was spent. No beginning inventory when making at
// least what is sold; selling more draws on old stock made at normal capacity, which carries $8/unit.
// So OI_A - OI_V = (made - sold) x FOH_u, with FOH_u this period's rate when inventory builds and $8 when it falls.
(function () {
  var PRICE = 40, VC = 15, F = 8000, NORMAL = 1000, OLD = F / NORMAL, SGA = 3000;
  function costing(v) {
    var P = v.unitsProduced, S = v.unitsSold, dI = P - S, rate = F / Math.max(P, NORMAL);
    var oiV = S * (PRICE - VC) - F - SGA;
    // absorption income statement, line by line: units sold from this period's production carry `rate`,
    // units sold out of old stock carry $8; overhead not absorbed by production (below normal) is expensed
    var fromNew = Math.min(P, S), fromOld = Math.max(0, S - P);
    var cogs = fromNew * (VC + rate) + fromOld * (VC + OLD), unabsorbed = F - rate * P;
    var oiA = S * PRICE - cogs - unabsorbed - SGA;
    return {P: P, S: S, dI: dI, rate: rate, foh: dI >= 0 ? rate : OLD, oiV: oiV, oiA: oiA, diff: oiA - oiV};
  }
  function exact(x) { return Math.abs(x * 100 - Math.round(x * 100)) < 1e-6; }
  function r$(x) { return "$" + (Math.abs(x - Math.round(x)) < 0.005 ? Math.round(x) : x.toFixed(2)); }
  function usd(x) { return (x < 0 ? "−$" : "$") + Math.abs(Math.round(x)).toLocaleString("en-US"); }
  function u(x) { return Math.abs(Math.round(x)).toLocaleString("en-US"); }
  function tint(api) { Array.prototype.forEach.call(api.svg.querySelectorAll("text"), function (t) { t.style.fill = t.getAttribute("fill"); }); }

  Viz.register("absorption-variable-costing-inventory-profit", {
    title: "Absorption vs variable costing: profit and inventory",
    subject: "finance",
    shows: "Make more than you sell and absorption costing parks fixed overhead in inventory with every unsold unit, so it reports more profit than variable costing",
    params: {
      unitsProduced: {kind: "integer", default: 800, min: 100, max: 10000, step: 50, label: "\\text{made}"},
      unitsSold: {kind: "integer", default: 600, min: 100, max: 10000, step: 50, label: "\\text{sold}"}
    },
    formula: function (v) {
      var d = costing(v);
      return "OI_A-OI_V=\\Delta I\\times FOH_u=(" + d.P + "-" + d.S + ")\\times " + (exact(d.foh) ? r$(d.foh).slice(1) : "\\tfrac{8{,}000}{" + d.P + "}") + "=" + (d.diff < 0 ? "-" : "") + u(d.diff).replace(/,/g, "{,}");
    },
    status: function (v) {
      var d = costing(v);
      if (d.dI === 0) return "Production equals sales, so both methods expense the same fixed overhead and report the <b>same profit</b>.";
      if (d.dI > 0) return "Absorption profit is <b>" + usd(d.diff) + " higher</b>: each of the " + u(d.dI) + " unsold units carries " + r$(d.rate) + " of fixed overhead into inventory instead of this period's expenses.";
      return "Absorption profit is <b>" + usd(-d.diff) + " lower</b>: the " + u(-d.dI) + " units sold out of inventory release the $8 of fixed overhead each carried from an earlier period.";
    },
    examples: [
      {name: "Minimum supported values", values: {unitsProduced: 100, unitsSold: 100}},
      {name: "Maximum supported values", values: {unitsProduced: 10000, unitsSold: 10000}},
      {name: "selling out of inventory", values: {unitsProduced: 600, unitsSold: 900}},
      {name: "big inventory build", values: {unitsProduced: 3000, unitsSold: 500}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, d = costing(v), x0 = 92, x1 = 390, bh = 18;
      // units: made vs sold; the gap between them is the change in inventory
      var um = Math.max(d.P, d.S), ux = function (q) { return x0 + q / um * (x1 - x0); };
      api.label([8, 14], "units", {color: c.ink, size: 12.5, weight: 650});
      var lo = Math.min(d.P, d.S);
      api.label([x0 - 8, 38], "made", {color: c.c2, size: 12, weight: 600, anchor: "end"});
      api.rect(x0, 29, ux(d.P) - x0, bh, {fill: c.c2, fillOpacity: 0.85, rx: 3});
      api.label([x0 - 8, 62], "sold", {color: c.c1, size: 12, weight: 600, anchor: "end"});
      api.rect(x0, 53, ux(d.S) - x0, bh, {fill: c.c1, fillOpacity: 0.85, rx: 3});
      api.label([x0 + 6, 38], u(d.P), {color: c.card, size: 12, weight: 700});
      api.label([x0 + 6, 62], u(d.S), {color: c.card, size: 12, weight: 700});
      if (d.dI !== 0) {
        var yy = d.dI > 0 ? 29 : 53;
        api.rect(ux(lo), yy, ux(um) - ux(lo), bh, {fill: c.c3, fillOpacity: 0.9, rx: 3});
        api.line([ux(lo), 24], [ux(lo), 76], {color: c.faint, width: 1, dash: "3 3"});
        api.label([(ux(lo) + ux(um)) / 2, 86], (d.dI > 0 ? "+" + u(d.dI) + " into inventory" : u(-d.dI) + " out of inventory"), {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      }
      // operating income under each method, on one scale; the amber piece is the fixed overhead that moved with inventory
      var vals = [0, d.oiV, d.oiA], omin = Math.min.apply(null, vals), omax = Math.max.apply(null, vals);
      var padL = omin < 0 ? 58 : 0, padR = omax > 0 ? 58 : 0;   // room for the value labels at either end
      var ox = function (q) { return x0 + padL + (q - omin) / ((omax - omin) || 1) * (x1 - x0 - padL - padR); };
      api.label([8, 114], "operating income", {color: c.ink, size: 12.5, weight: 650});
      var z0 = ox(0);
      var bar = function (y, from, to, col, op, dash) {
        var a = Math.min(ox(from), ox(to)), b = Math.max(ox(from), ox(to));
        api.rect(a, y, Math.max(1.5, b - a), bh, dash ? {fill: c.card, stroke: col, dash: "4 3", rx: 3} : {fill: col, fillOpacity: op, rx: 3});
      };
      var end = function (y, val, col, at) {   // the value, just past the far end of what the row draws
        var right = at >= 0;
        api.label([ox(at) + (right ? 6 : -6), y + bh / 2], usd(val), {color: col, size: 12, weight: 700, anchor: right ? "start" : "end"});
      };
      api.label([x0 - 8, 139], "variable", {color: c.c6, size: 12, weight: 600, anchor: "end"});
      bar(130, 0, d.oiV, c.c6, 0.85);
      api.label([x0 - 8, 167], "absorption", {color: c.c4, size: 12, weight: 600, anchor: "end"});
      if (d.dI >= 0) { bar(158, 0, d.oiV, c.c4, 0.85); if (d.dI > 0) bar(158, d.oiV, d.oiA, c.c3, 0.95); }
      else { bar(158, 0, d.oiA, c.c4, 0.85); bar(158, d.oiA, d.oiV, c.c3, 1, true); }
      end(130, d.oiV, c.c6, d.oiV);
      var far = Math.abs(d.oiA) > Math.abs(d.oiV) || (d.oiA >= 0) !== (d.oiV >= 0) ? d.oiA : d.oiV;
      end(158, d.oiA, c.c4, far);
      api.line([z0, 124], [z0, 182], {color: c.axis, width: 1.2});
      if (d.dI !== 0) api.label([(ox(d.oiV) + ox(d.oiA)) / 2, 194], (d.dI > 0 ? "+" : "−") + u(d.dI) + " × " + r$(d.foh) + (exact(d.foh) ? " = " : " ≈ ") + (d.diff > 0 ? "+" : "−") + usd(Math.abs(d.diff)).replace("$", "$"), {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      // the fixed overhead's two paths
      api.label([8, 222], "variable: all $8,000 of fixed overhead expensed now", {color: c.c6, size: 12});
      api.label([8, 240], "absorption: " + r$(d.rate) + " rides in each unit made, expensed when sold", {color: c.c4, size: 12});
      api.label([8, 262], "FOH_u = $8,000 ÷ max(units made, 1,000 normal)", {color: c.muted, size: 12});
      api.label([8, 280], "price $40 · variable cost $15/unit · fixed S&A $3,000", {color: c.muted, size: 12});
      tint(api);
    }
  });
})();
