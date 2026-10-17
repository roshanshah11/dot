// LBO returns: buy a company with $100m of EBITDA at an entry multiple, fund it with debt (a multiple of EBITDA)
// and equity, grow EBITDA, sweep every dollar of free cash flow into paying down debt, sell at the exit multiple.
// Fixed so the sliders stay about the four drivers: interest 8% on debt outstanding, tax 25%, unlevered free cash
// flow = 45% of EBITDA (after taxes, capex and working capital); levered FCF = that minus after-tax interest.
// No fees, no dividends, cash earns nothing. The equity bridge is exact:
// exit equity - entry equity = entry x (EBITDA_n - EBITDA_0) + (exit - entry) x EBITDA_n + (D_0 - ND_n).
(function () {
  var E0 = 100, RATE = 0.08, TAX = 0.25, CONV = 0.45;
  function lbo(v) {
    var ev0 = v.entry * E0, d0 = v.lev * E0, eq0 = ev0 - d0, nd = d0, e = E0;
    for (var t = 1; t <= v.n; t++) {
      e = E0 * Math.pow(1 + v.g, t);
      nd -= CONV * e - RATE * (1 - TAX) * Math.max(nd, 0);
    }
    var evn = v.exit * e, eqn = evn - nd, moic = Math.max(eqn, 0) / eq0;
    return {ev0: ev0, d0: d0, eq0: eq0, en: e, evn: evn, nd: nd, eqn: eqn, moic: moic, irr: Math.pow(moic, 1 / v.n) - 1,
            growth: v.entry * (e - E0), mult: (v.exit - v.entry) * e, paydown: d0 - nd};
  }
  function k(x) { return (x < -0.5 ? "−" : "") + Math.abs(Math.round(x)).toLocaleString("en-US"); }
  function kt(x) { return k(x).replace("−", "-").replace(/,/g, "{,}"); }
  function sgn(x) { return Math.round(x) > 0 ? "+" + k(x) : Math.round(x) < 0 ? k(x) : "0"; }
  function tint(api) { Array.prototype.forEach.call(api.svg.querySelectorAll("text"), function (t) { t.style.fill = t.getAttribute("fill"); }); }

  Viz.register("lbo-returns", {
    title: "LBO returns: IRR and MOIC",
    subject: "finance",
    shows: "Entry multiple, leverage, EBITDA growth and exit multiple turn into the equity's MOIC and IRR, split into growth, multiple and debt paydown",
    params: {
      entry: {kind: "number", default: 10, min: 7, max: 15, step: 0.5, label: "\\text{entry}"},
      lev: {kind: "number", default: 5, min: 0, max: 6, step: 0.25, label: "\\text{debt}"},
      g: {kind: "number", default: 0.06, min: -0.05, max: 0.15, step: 0.005, label: "g"},
      exit: {kind: "number", default: 10, min: 5, max: 15, step: 0.5, label: "\\text{exit}"},
      n: {kind: "integer", default: 5, min: 3, max: 7, label: "n"}
    },
    formula: function (v) {
      var d = lbo(v);
      return "MOIC=\\frac{" + kt(d.evn) + "-" + (d.nd < 0 ? "(" + kt(d.nd) + ")" : kt(d.nd)) + "}{" + kt(d.ev0) + "-" + kt(d.d0) + "}=" + d.moic.toFixed(2) +
        "\\times,\\ IRR=" + d.moic.toFixed(2) + "^{1/" + v.n + "}-1=" + (d.irr * 100).toFixed(1) + "\\%";
    },
    status: function (v) {
      var d = lbo(v);
      if (d.eqn <= 0) return "<b>Equity wiped out</b>: the business sells for $" + k(d.evn) + "m but $" + k(d.nd) + "m of debt comes first, so MOIC is <b>0×</b>.";
      return "Equity goes from $" + k(d.eq0) + "m to <b>$" + k(d.eqn) + "m</b> in " + v.n + " years: EBITDA growth " + sgn(d.growth) + ", multiple " + sgn(d.mult) +
        ", debt paydown " + sgn(d.paydown) + " ($m).";
    },
    examples: [
      {name: "no leverage", values: {lev: 0}},
      {name: "max leverage, multiple contraction", values: {entry: 12, lev: 6, g: 0.03, exit: 9}},
      {name: "wiped out", values: {entry: 7, lev: 6, g: -0.05, exit: 5, n: 7}},
      {name: "everything goes right", values: {entry: 7, lev: 6, g: 0.15, exit: 15, n: 7}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, d = lbo(v), x0 = 18, x1 = 394, cw = (x1 - x0) / 4, bw = 54, base = 230, top = 66;
      var tops = [d.ev0, d.ev0 + d.growth, d.evn, d.nd, d.eqn > d.evn ? d.eqn : 0];
      var hi = Math.max.apply(null, tops) * 1.04, Y = function (x) { return base - x / hi * (base - top); };
      var X = function (i) { return x0 + cw * (i + 0.5); };
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
      // a stacked capital-structure bar: debt (blue) under equity (teal)
      var seg = function (i, from, to, col, name) {
        var yt = Y(Math.max(from, to)), yb = Y(Math.min(from, to)), h = yb - yt, cx = X(i);
        if (h < 0.5) return;
        api.rect(cx - bw / 2, yt, bw, h, {fill: col, fillOpacity: 0.85, rx: 2});
        api.line([cx - bw / 2, yt], [cx + bw / 2, yt], {color: c.card, width: 1.5});
        if (h >= 32) { api.label([cx, (yt + yb) / 2 - 8], name, {color: c.card, size: 12, weight: 600, anchor: "middle"}); api.label([cx, (yt + yb) / 2 + 8], k(to - from), {color: c.card, size: 12, weight: 700, anchor: "middle"}); }
        else if (h >= 15) api.label([cx, (yt + yb) / 2], k(to - from), {color: c.card, size: 12, weight: 700, anchor: "middle"});
      };
      seg(0, 0, d.d0, c.c2, "debt");
      seg(0, d.d0, d.ev0, c.c1, "equity");
      api.label([X(0), Y(d.ev0) - 10], "EV " + k(d.ev0), {color: c.ink, size: 12, weight: 650, anchor: "middle"});
      // the two ways enterprise value changes: EBITDA growth at the entry multiple, then the multiple moving
      [[d.ev0, d.ev0 + d.growth], [d.ev0 + d.growth, d.evn]].forEach(function (p, j) {
        var i = j + 1, up = p[1] >= p[0], col = Math.abs(p[1] - p[0]) < 0.5 ? c.muted : up ? c.c4 : c.c5;
        var yt = Y(Math.max(p[0], p[1])), yb = Y(Math.min(p[0], p[1]));
        api.rect(X(i) - bw / 2, yt, bw, Math.max(1.5, yb - yt), {fill: col, fillOpacity: 0.75, rx: 2});
        api.line([X(i - 1) + bw / 2, Y(p[0])], [X(i) - bw / 2, Y(p[0])], {color: c.faint, width: 1, dash: "3 3"});
        api.label([X(i), up ? yt - 10 : yb + 11], sgn(p[1] - p[0]), {color: col, size: 12.5, weight: 650, anchor: "middle"});
      });
      api.line([X(2) + bw / 2, Y(d.evn)], [X(3) - bw / 2, Y(d.evn)], {color: c.faint, width: 1, dash: "3 3"});
      // exit: net debt under equity; net cash adds to equity; debt above EV takes the whole sale and wipes equity out
      if (d.nd >= d.evn) {
        seg(3, 0, d.evn, c.c2, "lenders");
        var yu = Y(d.nd), ye = Y(d.evn);
        api.rect(X(3) - bw / 2, yu, bw, ye - yu, {fill: c.c2, fillOpacity: 0.18, stroke: c.c5, dash: "4 3", rx: 2});
        if (ye - yu >= 15) api.label([X(3), (yu + ye) / 2], "−" + k(d.nd - d.evn), {color: c.c5, size: 12, weight: 700, anchor: "middle"});
        api.label([X(3), yu - 10], "debt " + k(d.nd) + " > EV " + k(d.evn), {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      } else if (d.nd >= 0) {
        seg(3, 0, d.nd, c.c2, "debt");
        seg(3, d.nd, d.evn, c.c1, "equity");
        api.label([X(3), Y(d.evn) - 10], "EV " + k(d.evn), {color: c.ink, size: 12, weight: 650, anchor: "middle"});
      } else {
        seg(3, 0, d.evn, c.c1, "EV");
        seg(3, d.evn, d.eqn, c.c1, "cash");
        api.label([X(3), Y(d.eqn) - 10], "equity " + k(d.eqn), {color: c.c1, size: 12, weight: 650, anchor: "middle"});
      }
      // debt paid down: the blue top falls from entry to exit
      if (d.d0 > 0 || d.nd > 0) {
        var ya = Y(d.d0), yb2 = Y(Math.max(d.nd, 0));
        api.line([X(0) + bw / 2, ya], [X(3) - bw / 2, yb2], {color: c.c2, width: 1.5, dash: "5 4"});
      }
      var names = [["entry", v.entry.toFixed(1) + "× EBITDA"], ["EBITDA", "growth"], ["multiple", v.exit === v.entry ? "unchanged" : "change"], ["exit", v.exit.toFixed(1) + "× EBITDA"]];
      names.forEach(function (nm, i) {
        api.label([X(i), base + 14], nm[0], {color: c.muted, size: 12, anchor: "middle"});
        api.label([X(i), base + 29], nm[1], {color: c.muted, size: 12, anchor: "middle"});
      });
      api.label([x0, 16], "MOIC " + d.moic.toFixed(2) + "×", {color: c.c1, size: 15, weight: 700});
      api.label([x0 + 118, 16], "IRR " + (d.irr <= -0.9999 ? "−100" : (d.irr * 100).toFixed(1).replace("-", "−")) + "%", {color: c.c1, size: 15, weight: 700});
      api.label([x0, 38], "$m · EBITDA " + k(E0) + " → " + k(d.en), {color: c.muted, size: 12});
      api.label([x0 + 150, 38], "net debt " + k(d.d0) + " → " + k(d.nd), {color: c.c2, size: 12});
      tint(api);
    }
  });
})();
