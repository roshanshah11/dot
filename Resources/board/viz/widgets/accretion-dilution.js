// Accretion / dilution: what a deal does to the acquirer's EPS, as a per-share bridge from standalone to pro forma.
// Fixed case, so the sliders stay about the deal: acquirer net income $500m on 250m shares at $40 (EPS $2.00,
// P/E 20x), target net income $60m, tax 25%. Price paid = offer P/E x target net income; the stock part is paid
// in new acquirer shares at $40, the cash part is borrowed at i. No fees, write-ups or interest on cash: the first pass.
// The bridge is exact: EPS_PF = EPS_A + (NI_T + S(1-t) - I(1-t)) / N_PF - (EPS_A - NI_A / N_PF).
(function () {
  var NI_A = 500, N_A = 250, P_A = 40, NI_T = 60, TAX = 0.25;
  function deal(v) {
    var price = v.offerPE * NI_T, stock = price * v.stockPct / 100, cash = price - stock;
    var dN = stock / P_A, interest = cash * v.rate / 100, n = N_A + dN;
    var ni = NI_A + NI_T + (v.syn - interest) * (1 - TAX), eps0 = NI_A / N_A, eps = ni / n;
    var parts = [NI_T / n, v.syn * (1 - TAX) / n, -interest * (1 - TAX) / n, -(eps0 - NI_A / n)];
    var be = (eps0 * n - (NI_A + NI_T - interest * (1 - TAX))) / (1 - TAX);   // pre-tax synergies for EPS_PF = EPS_A
    var yieldBought = (NI_T + v.syn * (1 - TAX)) / price;
    var cost = (v.stockPct / 100) * (1 / (P_A * N_A / NI_A)) + (1 - v.stockPct / 100) * v.rate / 100 * (1 - TAX);
    return {price: price, stock: stock, cash: cash, dN: dN, interest: interest, n: n, ni: ni, eps0: eps0, eps: eps,
            parts: parts, acc: eps / eps0 - 1, be: be, yieldBought: yieldBought, cost: cost};
  }
  function m(x) { return "$" + Math.round(x).toLocaleString("en-US") + "m"; }
  function tint(api) { Array.prototype.forEach.call(api.svg.querySelectorAll("text"), function (t) { t.style.fill = t.getAttribute("fill"); }); }

  Viz.register("accretion-dilution", {
    title: "Accretion / dilution: acquirer EPS after a deal",
    subject: "finance",
    shows: "Acquirer EPS before and after a deal as the stock/cash mix, the price paid and synergies change",
    params: {
      stockPct: {kind: "integer", default: 50, min: 0, max: 100, step: 5, label: "\\%\\,\\text{stock}"},
      offerPE: {kind: "number", default: 16, min: 8, max: 40, step: 0.5, label: "P/E_{\\text{offer}}"},
      syn: {kind: "number", default: 20, min: 0, max: 100, step: 5, label: "\\text{syn.}"},
      rate: {kind: "number", default: 6, min: 0, max: 12, step: 0.25, label: "i\\,\\%"}
    },
    formula: function (v) {
      var d = deal(v);
      return "EPS_{PF}=\\frac{NI_A+NI_T+(S-I)(1-t)}{N_A+\\Delta N}=\\frac{" + Viz.n(d.ni, 1).replace(/(\d)(?=(\d{3})+(\.|$))/g, "$1{,}") + "}{" + Viz.n(d.n, 1) + "}=\\$" + d.eps.toFixed(2);
    },
    status: function (v) {
      var d = deal(v), pct = Math.abs(d.acc * 100).toFixed(1) + "%";
      if (Math.abs(d.acc) < 0.0005) return "<b>Breakeven</b>: pro forma EPS equals the standalone $" + d.eps0.toFixed(2) + ", because the earnings bought exactly cover the cost of paying.";
      if (d.acc > 0) return "<b>Accretive</b> by <b>" + pct + "</b>: pro forma EPS $" + d.eps.toFixed(2) + " vs $" + d.eps0.toFixed(2) + " standalone" +
        (d.be <= 0 ? ", even with no synergies." : ", but only with at least " + m(d.be) + " of pre-tax synergies.");
      return "<b>Dilutive</b> by <b>" + pct + "</b>: it would take <b>" + m(d.be) + "</b> of pre-tax synergies to get back to $" + d.eps0.toFixed(2) + ".";
    },
    examples: [
      {name: "all stock at the acquirer's own P/E (breakeven)", values: {stockPct: 100, offerPE: 20, syn: 0}},
      {name: "all stock, paying a richer P/E (dilutive)", values: {stockPct: 100, offerPE: 30, syn: 0}},
      {name: "all cash, cheap debt (accretive)", values: {stockPct: 0, offerPE: 16, syn: 0, rate: 4}},
      {name: "all cash, expensive debt, full price", values: {stockPct: 0, offerPE: 40, syn: 0, rate: 12}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, d = deal(v), x0 = 46, x1 = 398, base = 240, top = 70, cw = (x1 - x0) / 6, bw = 34;
      // column k spans [from, to] in $/share; 0 and 5 are whole bars, 1-4 float on the running total
      var cols = [], run = d.eps0;
      cols.push([null, d.eps0]);
      d.parts.forEach(function (p) { cols.push([run, run + p]); run += p; });
      cols.push([null, d.eps]);
      var vals = [d.eps0, d.eps]; cols.forEach(function (k) { if (k[0] != null) vals.push(k[0], k[1]); });
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), span = Math.max(hi - lo, 0.1);
      var steps = [0.05, 0.1, 0.2, 0.25, 0.5, 1], tk = steps.filter(function (s) { return (hi - lo + span) / s <= 5; })[0] || 1;
      var floor = Math.max(0, Math.floor((lo - 0.75 * span) / tk) * tk), ceil = hi + 0.3 * span;
      var Y = function (val) { return base - (val - floor) / (ceil - floor) * (base - top); };
      // axis, ticks and a break mark when the axis does not start at zero
      api.line([x0, top - 6], [x0, base], {color: c.axis, width: 1.2});
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
      for (var t = Math.ceil(floor / tk) * tk; t <= ceil + 1e-9; t += tk) {
        api.line([x0 - 4, Y(t)], [x0, Y(t)], {color: c.axis, width: 1});
        api.label([x0 - 7, Y(t)], "$" + t.toFixed(2), {color: c.muted, size: 12, anchor: "end"});
      }
      if (floor > 0) { api.line([x0 - 5, base - 13], [x0 + 5, base - 17], {color: c.muted, width: 1.4}); api.line([x0 - 5, base - 8], [x0 + 5, base - 12], {color: c.muted, width: 1.4}); }
      var good = d.acc >= -0.0005, verdict = good ? c.c4 : c.c5;
      var names = [["acquirer", "EPS"], ["target", "NI"], ["synergy", "× (1 − t)"], ["interest", "× (1 − t)"], ["new", "shares"], ["pro forma", "EPS"]];
      cols.forEach(function (k, i) {
        var cx = x0 + cw * (i + 0.5), whole = k[0] == null;
        var a = whole ? floor : k[0], b = k[1], up = b >= a;
        var color = i === 0 ? c.c2 : i === 5 ? verdict : up ? c.c1 : c.c3;
        var yt = Y(Math.max(a, b)), yb = Y(Math.min(a, b));
        api.rect(cx - bw / 2, yt, bw, Math.max(1.5, yb - yt), {fill: color, fillOpacity: whole ? 0.9 : 0.8, rx: 3});
        if (i < 5) { var nx = x0 + cw * (i + 1.5); api.line([cx + bw / 2, Y(b)], [nx - bw / 2, Y(b)], {color: c.faint, width: 1, dash: "3 3"}); }
        var zero = !whole && Math.abs(b - a) < 0.005;
        var txt = whole ? "$" + b.toFixed(2) : zero ? "$0" : (up ? "+" : "−") + "$" + Math.abs(b - a).toFixed(2);
        api.label([cx, whole || up ? yt - 10 : yb + 11], txt, {color: whole ? c.ink : zero ? c.muted : color, size: 12, weight: 650, anchor: "middle"});
        api.label([cx, base + 14], names[i][0], {color: c.muted, size: 12, anchor: "middle"});
        api.label([cx, base + 29], names[i][1], {color: c.muted, size: 12, anchor: "middle"});
      });
      // the verdict over the pro forma bar
      var px = x0 + cw * 5.5;
      api.label([px, Y(d.eps) - 27], (d.acc >= 0 ? "+" : "−") + Math.abs(d.acc * 100).toFixed(1) + "%", {color: verdict, size: 13, weight: 700, anchor: "middle"});
      // the rule behind it: earnings bought (teal) against the cost of the money paid (amber)
      api.label([8, 14], "earnings bought: " + (d.yieldBought * 100).toFixed(1) + "% of the " + m(d.price) + " price", {color: c.c1, size: 12, weight: 600});
      api.label([8, 32], "cost of paying: " + (d.cost * 100).toFixed(1) + "% (stock 5.0%, debt " + (v.rate * (1 - TAX)).toFixed(1) + "% after tax)", {color: c.c3, size: 12, weight: 600});
      tint(api);
    }
  });
})();
