// WACC: what a company pays, on average, for each dollar of capital. Each block's width is that source's share of
// capital and its height is that source's cost, so the blocks' total area is WACC and the dashed line at WACC is
// their average height; the column on the left stacks those two areas (share times cost) into WACC itself.
// The equity block is built by CAPM (risk-free floor plus beta times the premium); the debt block is the pre-tax
// rate with the tax shield cut off the top.
// No queue schema: six inputs, because each of the three pieces (weights, after-tax debt, CAPM equity) needs its own.
// beta is the equity beta at the mix shown; the widget does not relever it as D/V moves.
(function () {
  function calc(v) {
    var ev = 1 - v.dv, prem = v.beta * v.erp, re = v.rf + prem, rdAt = v.rd * (1 - v.t);
    return {ev: ev, prem: prem, re: re, rdAt: rdAt, wacc: ev * re + v.dv * rdAt};
  }
  // percent to two places, halves rounded up (0.095 × 0.93 is 8.835%, which floats store as 8.83499...)
  function P(x) { return Viz.n(x * 100 + 1e-9, 2) + "\\%"; }   // for LaTeX
  function T(x) { return Viz.fmt(x * 100 + 1e-9, 2) + "%"; }   // for text

  Viz.register("wacc", {
    title: "WACC: the blended cost of capital",
    subject: "finance",
    shows: "Slide the mix, beta and the debt terms: each source's cost is weighted by its share of capital, and WACC is the average height of the two blocks",
    params: {
      dv: {kind: "number", default: 0.3, min: 0, max: 0.8, step: 0.01, label: "D/V"},
      rf: {kind: "number", default: 0.045, min: 0, max: 0.08, step: 0.005, label: "r_f"},
      beta: {kind: "number", default: 1.2, min: 0, max: 2.5, step: 0.05, label: "\\beta"},
      erp: {kind: "number", default: 0.055, min: 0.03, max: 0.08, step: 0.005, label: "\\text{ERP}"},
      rd: {kind: "number", default: 0.06, min: 0.01, max: 0.15, step: 0.005, label: "R_d"},
      t: {kind: "number", default: 0.25, min: 0, max: 0.4, step: 0.01, label: "t"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}R_e=r_f+\\beta\\cdot\\text{ERP}\\\\\\quad=" + P(v.rf) + "+" + Viz.n(v.beta, 2) + "\\cdot" + P(v.erp) + "=" + P(k.re) +
        "\\\\R_d(1-t)=" + P(v.rd) + "\\cdot(1-" + Viz.n(v.t, 2) + ")=" + P(k.rdAt) +
        "\\\\\\text{WACC}=\\tfrac{E}{V}R_e+\\tfrac{D}{V}R_d(1-t)\\\\\\quad=" + Viz.n(k.ev, 2) + "\\cdot" + P(k.re) + "+" + Viz.n(v.dv, 2) + "\\cdot" + P(k.rdAt) +
        "\\\\\\quad=" + P(k.ev * k.re) + "+" + P(v.dv * k.rdAt) + "=" + P(k.wacc) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), share = Viz.fmt(v.dv * 100, 0) + "%";
      if (v.dv === 0) return "With no debt, WACC is just the cost of equity: <b>" + T(k.wacc) + "</b>.";
      if (Math.abs(k.rdAt - k.re) < 1e-9) return "Debt after tax and equity both cost <b>" + T(k.re) + "</b>, so WACC is <b>" + T(k.wacc) + "</b> whatever the mix.";
      if (k.rdAt < k.re) return "Debt costs <b>" + T(k.rdAt) + "</b> after tax against <b>" + T(k.re) + "</b> for equity, so funding " + share +
        " with debt pulls WACC down to <b>" + T(k.wacc) + "</b>.";
      return "Debt costs more than equity here (<b>" + T(k.rdAt) + "</b> after tax against <b>" + T(k.re) + "</b>), so " + share +
        " debt lifts WACC to <b>" + T(k.wacc) + "</b>, the reverse of the usual case.";
    },
    examples: [
      {name: "all equity", values: {dv: 0}},
      {name: "heavily levered", values: {dv: 0.8, beta: 2, rd: 0.1}},
      {name: "no taxes", values: {t: 0}},
      {name: "debt dearer than equity", values: {beta: 0.2, rd: 0.12, t: 0}},
      {name: "every input at its maximum", values: {dv: 0.8, rf: 0.08, beta: 2.5, erp: 0.08, rd: 0.15, t: 0.4}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, k = calc(v), cL = 44, cR = 86, x0 = 98, x1 = 282, W = x1 - x0, base = 252, top = 32;
      // zoom the rate axis to the tallest block, in fixed stops so it does not jitter while sliding
      var hi = Math.max(k.re, v.rd), ymax = [0.1, 0.12, 0.15, 0.2, 0.25, 0.3].filter(function (m) { return m >= hi * 1.06; })[0] || 0.3;
      var Y = function (r) { return base - (base - top) * r / ymax; }, tick = ymax <= 0.12 ? 0.02 : 0.05;
      for (var i = 0; i * tick <= ymax + 1e-9; i++) {
        if (i) api.line([cL, Y(i * tick)], [x1, Y(i * tick)], {color: c.grid, width: 1});
        api.label([cL - 7, Y(i * tick)], T(i * tick), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([6, 11], "cost per year", {color: c.muted, size: 12});
      var xE = x0 + W * k.ev, wE = W * k.ev, wD = W * v.dv, yW = Y(k.wacc);
      // a label inside a box, only when it fits, kept off the WACC line
      function inside(x, w, yTop, yBot, text, short, mid) {
        var h = yBot - yTop, fits = function (s) { return s && s.length * 6.3 + 10 <= w; };
        var s = fits(text) ? text : fits(short) ? short : null;
        if (!s || h < 16) return;
        var spots = [(yTop + yBot) / 2, yTop + 9, yBot - 9].filter(function (y) { return Math.abs(y - yW) >= 10; });
        if (spots.length) api.label([mid ? x + w / 2 : x + 7, spots[0]], s, {color: c.ink, size: 12, anchor: mid ? "middle" : "start"});
      }
      // equity: the risk-free floor, then beta times the premium on top (CAPM)
      if (wE > 0) {
        api.rect(x0, Y(v.rf), wE - 1, base - Y(v.rf), {fill: c.c1, fillOpacity: 0.2, rx: 0});
        api.rect(x0, Y(k.re), wE - 1, Y(v.rf) - Y(k.re), {fill: c.c1, fillOpacity: 0.45, rx: 0});
        api.rect(x0, Y(k.re), wE - 1, base - Y(k.re), {stroke: c.c1, width: 1.5, rx: 0});
        if (v.rf > 0 && k.prem > 0) api.line([x0, Y(v.rf)], [x0 + wE - 1, Y(v.rf)], {color: c.c1, width: 1, dash: "3 3", opacity: 0.8});
        inside(x0, wE, Y(k.re), Y(v.rf), "β × ERP " + T(k.prem), "β × ERP");
        inside(x0, wE, Y(v.rf), base, "risk-free " + T(v.rf), "risk-free");
      }
      // debt: the after-tax cost, with the tax shield (rate times t) drawn dashed above it
      if (wD > 0) {
        api.rect(xE + 1, Y(k.rdAt), wD - 1, base - Y(k.rdAt), {fill: c.c2, fillOpacity: 0.45, stroke: c.c2, width: 1.5, rx: 0});
        if (v.t > 0) api.rect(xE + 1, Y(v.rd), wD - 1, Y(k.rdAt) - Y(v.rd), {fill: c.c2, fillOpacity: 0.08, stroke: c.c2, width: 1.2, dash: "4 3", rx: 0});
        inside(xE + 1, wD, Y(v.rd), Y(k.rdAt), "tax shield", null);
        api.line([xE, Y(k.re)], [x1, Y(k.re)], {color: c.c1, width: 1, dash: "2 4", opacity: 0.7});
      }
      // the blend: each block's area (share times cost) stacked into one full-width column
      var yEq = Y(v.dv * k.rdAt);
      if (v.dv > 0) api.rect(cL, yEq, cR - cL, base - yEq, {fill: c.c2, fillOpacity: 0.45, stroke: c.c2, width: 1.2, rx: 0});
      api.rect(cL, yW, cR - cL, yEq - yW, {fill: c.c1, fillOpacity: 0.45, stroke: c.c1, width: 1.2, rx: 0});
      inside(cL, cR - cL, yW, yEq, T(k.ev * k.re), null, true);
      if (v.dv > 0) inside(cL, cR - cL, yEq, base, T(v.dv * k.rdAt), null, true);
      api.line([cL - 2, base], [x1 + 2, base], {color: c.axis, width: 1.2});
      api.line([cL, yW], [x1, yW], {color: c.c3, width: 2.5, dash: "7 5"});
      // the rate ladder on the right: each label at its height, nudged apart when two are close
      var items = [{y: Y(k.re), text: "equity " + T(k.re), color: c.c1, weight: 650},
                   {y: yW, text: "WACC " + T(k.wacc), color: c.c3, weight: 700}];
      if (wD > 0) {
        if (v.t > 0) items.push({y: Y(v.rd), text: "debt " + T(v.rd), color: c.c2, weight: 500, opacity: 0.8});
        items.push({y: Y(k.rdAt), text: (v.t > 0 ? "after tax " : "debt ") + T(k.rdAt), color: c.c2, weight: 650});
      }
      items.sort(function (a, b) { return a.y - b.y; });
      items.forEach(function (it, j) { it.ly = Math.max(it.y, j ? items[j - 1].ly + 15 : 10); });
      for (var j = items.length - 1; j >= 0; j--) items[j].ly = Math.min(items[j].ly, j < items.length - 1 ? items[j + 1].ly - 15 : base);
      items.forEach(function (it) {
        api.line([x1 + 3, it.y], [x1 + 9, it.ly], {color: it.color, width: 1.2, opacity: it.opacity});
        api.label([x1 + 12, it.ly], it.text, {color: it.color, size: 12, weight: it.weight, opacity: it.opacity});
      });
      // the capital structure itself, under the axis: equity's share, then debt's
      var by = base + 9, ly = base + 30;
      if (wE > 0) api.rect(x0, by, wE - 1, 7, {fill: c.c1, rx: 2});
      if (wD > 0) api.rect(xE + 1, by, wD - 1, 7, {fill: c.c2, rx: 2});
      api.label([(cL + cR) / 2, ly], "WACC", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      var eT = "equity " + Viz.fmt(k.ev * 100, 0) + "%", dT = "debt " + Viz.fmt(v.dv * 100, 0) + "%";
      var eHalf = eT.length * 3.5, dHalf = dT.length * 3.5;
      var cE = Math.max(cR + 8 + eHalf, x0 + wE / 2), cD = Math.min(396 - dHalf, xE + wD / 2);
      if (wD > 0 && cD - dHalf < cE + eHalf + 10) { cD = Math.min(396 - dHalf, cE + eHalf + 10 + dHalf); cE = Math.min(cE, cD - dHalf - 10 - eHalf); }
      api.label([cE, ly], eT, {color: c.c1, size: 12.5, weight: 650, anchor: "middle"});
      if (wD > 0) api.label([cD, ly], dT, {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      api.label([(x0 + x1) / 2, ly + 22], "share of capital, V = D + E", {color: c.muted, size: 12, anchor: "middle"});
    }
  });
})();
