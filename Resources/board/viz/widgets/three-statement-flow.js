// One transaction through the three statements, the way the interview question walks it: income statement first,
// then the cash flow statement starting from net income, then the balance sheet, which must balance.
// Assumptions: book and tax depreciation are the same, taxes are paid in cash in the period, interest is paid in cash,
// dividends come straight out of retained earnings. The balance sheet is drawn with liabilities + equity on the left
// (under the income statement, where net income lands in retained earnings) and assets on the right (under the cash
// flow statement, where the change in cash lands).
(function () {
  function flows(v) {
    var A = v.amount, t = v.tax, z = {exp: 0, pre: 0, taxes: 0, ni: 0, da: 0, capex: 0, fin: 0, cash: 0, ppe: 0, debt: 0, re: 0};
    if (v.event === "depreciation") { z.exp = A; z.pre = -A; z.taxes = -t * A; z.ni = -(1 - t) * A; z.da = A; z.cash = t * A; z.ppe = -A; z.re = z.ni; }
    if (v.event === "interest") { z.exp = A; z.pre = -A; z.taxes = -t * A; z.ni = -(1 - t) * A; z.cash = z.ni; z.re = z.ni; }
    if (v.event === "capex") { z.capex = -A; z.cash = -A; z.ppe = A; }
    if (v.event === "debt raise") { z.fin = A; z.cash = A; z.debt = A; }
    if (v.event === "dividend") { z.fin = -A; z.cash = -A; z.re = -A; }
    return z;
  }
  function sg(x) { var r = Math.round(x * 10) / 10; return r === 0 ? "0" : (r > 0 ? "+" : "−") + Math.abs(r).toLocaleString("en-US"); }
  function d$(x) { return "$" + Math.abs(Math.round(x * 10) / 10).toLocaleString("en-US"); }
  function tint(api) { Array.prototype.forEach.call(api.svg.querySelectorAll("text"), function (t) { t.style.fill = t.getAttribute("fill"); }); }

  Viz.register("three-statement-flow", {
    title: "One transaction through the three statements",
    subject: "finance",
    shows: "Pick a transaction (depreciation, capex, a debt raise, interest, a dividend) and step it through the income statement, the cash flow statement and the balance sheet",
    params: {
      event: {kind: "enum", values: ["depreciation", "capex", "debt raise", "interest", "dividend"], default: "depreciation", label: "event"},
      amount: {kind: "number", default: 100, min: 10, max: 200, step: 10, label: "\\$"},
      tax: {kind: "number", default: 0.25, min: 0, max: 0.5, step: 0.01, label: "t"}
    },
    steps: ["income statement", "cash flow statement", "balance sheet"],
    stepMs: 1800,
    formula: function (v) {
      var z = flows(v), A = Viz.n(v.amount, 0), T = Viz.n(v.tax, 2), n = function (x) { return sg(x).replace("−", "-"); };
      if (v.event === "depreciation") return "\\Delta NI=-D(1-t)=-" + A + "(1-" + T + ")=" + n(z.ni) + ",\\ \\Delta\\text{cash}=tD=" + n(z.cash);
      if (v.event === "interest") return "\\Delta NI=-I(1-t)=-" + A + "(1-" + T + ")=" + n(z.ni) + "=\\Delta\\text{cash}";
      if (v.event === "capex") return "\\Delta\\text{cash}=-" + A + ",\\ \\Delta\\text{PP\\&E}=+" + A + ",\\ \\Delta NI=0";
      if (v.event === "debt raise") return "\\Delta\\text{cash}=\\Delta\\text{debt}=+" + A + ",\\ \\Delta NI=0";
      return "\\Delta\\text{cash}=\\Delta RE=-" + A + ",\\ \\Delta NI=0";
    },
    status: function (v) {
      var z = flows(v), s = v.step || 1, e = v.event, A = d$(v.amount);
      var taxed = e === "depreciation" || e === "interest";
      if (s === 1) {
        if (taxed) return "Pre-tax income falls " + A + " and taxes fall " + d$(z.taxes) + ", so net income falls <b>" + d$(z.ni) + "</b>.";
        return {capex: "Buying equipment is not an expense, so the income statement <b>does not change</b> (depreciation comes later).",
                "debt raise": "Borrowing is not income, so the income statement <b>does not change</b> (interest comes later).",
                dividend: "A dividend is a payout of profit, not an expense, so the income statement <b>does not change</b>."}[e];
      }
      if (s === 2) {
        if (e === "depreciation") return "Start from net income " + sg(z.ni) + ", add back the " + A + " of non-cash D&A: cash " + (z.cash > 0 ? "rises <b>" + d$(z.cash) + "</b>, the tax saved." : "is <b>unchanged</b> with no tax.");
        if (e === "interest") return "Interest is paid in cash, so nothing is added back: cash falls <b>" + d$(z.cash) + "</b>.";
        return {capex: "Capex is an investing outflow: cash falls <b>" + A + "</b>.", "debt raise": "A financing inflow: cash rises <b>" + A + "</b>.",
                dividend: "A financing outflow: cash falls <b>" + A + "</b>."}[e];
      }
      var assets = z.cash + z.ppe;
      return "Assets " + sg(assets) + " and liabilities + equity " + sg(z.debt + z.re) + ": the balance sheet <b>balances</b>" +
        (e === "dividend" ? " (the dividend comes straight out of retained earnings)." : e === "capex" ? " (cash just turned into PP&E)." : ".");
    },
    examples: [
      {name: "depreciation, all three statements", values: {event: "depreciation", step: 3}},
      {name: "capex on the cash flow statement", values: {event: "capex", step: 2}},
      {name: "debt raise, balance sheet", values: {event: "debt raise", step: 3}},
      {name: "interest at zero tax", values: {event: "interest", tax: 0, step: 3}},
      {name: "dividend", values: {event: "dividend", step: 3, amount: 50}}
    ],
    size: [400, 246],
    draw: function (api, v) {
      var c = api.color, z = flows(v), s = v.step || 1, e = v.event, RH = 18;
      var groups = [1, 2, 3].map(function (k) { var g = api.group(); if (s < k) g.setAttribute("opacity", 0.3); return g; });
      // one statement panel: a title and rows of [label, change]; values only once the step reaches it
      var panel = function (g, x, y, w, title, rows, k) {
        api.rect(x, y, w, 26 + rows.length * RH, {fill: c.ink, fillOpacity: 0.035, stroke: s === k ? c.accent : c.grid, width: s === k ? 1.5 : 1, rx: 8, parent: g});
        api.label([x + 8, y + 13], title, {color: c.ink, size: 12.5, weight: 650, parent: g});
        var pos = {};
        rows.forEach(function (r, i) {
          var yy = y + 34 + i * RH, val = r[1], live = s >= k, moved = Math.abs(val) > 0.05;
          if (live && moved) api.rect(x + 4, yy - 8, w - 8, 16, {fill: val > 0 ? c.c1 : c.c3, fillOpacity: 0.12, rx: 4, parent: g});
          api.label([x + 10, yy], r[0], {color: r[2] ? c.ink : c.muted, size: 12, weight: r[2] ? 650 : 500, parent: g});
          api.label([x + w - 10, yy], live ? sg(val) : "·", {color: !live || !moved ? c.muted : val > 0 ? c.c1 : c.c3, size: 12, weight: 650, anchor: "end", parent: g});
          pos[r[3] || i] = yy;
        });
        return pos;
      };
      var L = 6, W2 = 170, R = 400 - 6 - W2;
      var expName = e === "depreciation" ? "D&A expense" : e === "interest" ? "Interest expense" : "Expenses";
      var is = panel(groups[0], L, 4, W2, "Income statement", [[expName, z.exp], ["Pre-tax income", z.pre], ["Taxes", z.taxes], ["Net income", z.ni, true, "ni"]], 1);
      var finName = e === "debt raise" ? "Debt issued" : e === "dividend" ? "Dividends paid" : "Financing";
      var cf = panel(groups[1], R, 4, W2, "Cash flow statement", [["Net income", z.ni, false, "ni"], ["+ D&A (non-cash)", z.da], ["Capex", z.capex], [finName, z.fin], ["Change in cash", z.cash, true, "cash"]], 2);
      var le = panel(groups[2], L, 158, W2, "Liabilities + equity", [["Debt", z.debt], ["Retained earnings", z.re, false, "re"], ["Total L + E", z.debt + z.re, true]], 3);
      var as = panel(groups[2], R, 158, W2, "Assets", [["Cash", z.cash, false, "cash"], ["PP&E", z.ppe], ["Total assets", z.cash + z.ppe, true]], 3);
      // the links: net income into the cash flow statement, cash and net income into the balance sheet
      var flow = function (a, b, live) {
        api.path("M " + a[0] + " " + a[1] + " C " + (a[0] + b[0]) / 2 + " " + a[1] + ", " + (a[0] + b[0]) / 2 + " " + b[1] + ", " + b[0] + " " + b[1],
          {stroke: live ? c.accent : c.faint, width: live ? 2 : 1.2, dash: live ? null : "3 4", arrow: live});
      };
      flow([L + W2 + 2, is.ni], [R - 4, cf.ni], s >= 2);
      var x1 = R + 60, x2 = L + 60;
      api.line([x1, cf.cash + 9], [x1, 155], {color: s >= 3 ? c.accent : c.faint, width: s >= 3 ? 2 : 1.2, dash: s >= 3 ? null : "3 4", arrow: s >= 3});
      api.line([x2, is.ni + 9], [x2, 155], {color: s >= 3 && z.ni !== 0 ? c.accent : c.faint, width: s >= 3 && z.ni !== 0 ? 2 : 1.2, dash: s >= 3 && z.ni !== 0 ? null : "3 4", arrow: s >= 3 && z.ni !== 0});
      if (s >= 3) {
        api.label([x1 + 8, (cf.cash + 155) / 2 + 2], "cash", {color: c.accent, size: 12, weight: 600});
        api.label([x2 + 8, (is.ni + 155) / 2 + 2], z.ni !== 0 ? "NI → RE" : e === "dividend" ? "RE: dividend, not NI" : "no NI", {color: c.accent, size: 12, weight: 600});
        api.label([200, 228], "=", {color: c.c4, size: 18, weight: 700, anchor: "middle"});
      }
      tint(api);
    }
  });
})();
