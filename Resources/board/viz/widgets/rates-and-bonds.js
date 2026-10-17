// Bond prices against yields: a 10-year and a 2-year bond, both with 5% annual coupons and $1,000 par, priced at
// a 5% yield (par) and then at 5% + the change. The dashed line is the modified-duration estimate at 5%; the
// curve bowing above it is convexity, which is why price gains beat price losses for the same move in yield.
Viz.register("rates-and-bonds", {
  title: "Rates up, bond prices down",
  subject: "finance",
  shows: "Move the yield: every bond's price slides the other way along a curve, a long bond moves far more than a short one, and the curve bends above the duration line",
  params: {
    yieldChangePercentagePoints: {kind: "number", default: 0, min: -3, max: 3, step: 0.25, label: "\\Delta y\\,(\\text{pts})"}
  },
  price: function (y, n) { var p = 0; for (var t = 1; t <= n; t++) p += 50 / Math.pow(1 + y, t); return p + 1000 / Math.pow(1 + y, n); },
  // modified duration of the 5% bond at a 5% yield (Macaulay / (1 + y))
  modDur: function (n) { var s = 0; for (var t = 1; t <= n; t++) s += t * (t === n ? 1050 : 50) / Math.pow(1.05, t); return s / 1000 / 1.05; },
  formula: function (v) {
    var y = 0.05 + v.yieldChangePercentagePoints / 100, P = Viz.get("rates-and-bonds").price(y, 10), g = Viz.n(1 + y, 4);
    return "P=\\sum_{t=1}^{10}\\frac{50}{(" + g + ")^t}+\\frac{1{,}000}{(" + g + ")^{10}}=\\$" + P.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace(/,/g, "{,}");
  },
  status: function (v) {
    var s = Viz.get("rates-and-bonds"), d = v.yieldChangePercentagePoints, y = 0.05 + d / 100;
    var p10 = s.price(y, 10), p2 = s.price(y, 2), c10 = p10 / 1000 - 1, c2 = p2 / 1000 - 1, est = -s.modDur(10) * d / 100;
    var pc = function (x) { return (x > 0 ? "+" : "−") + Viz.fmt(Math.abs(x) * 100, 1) + "%"; };
    if (Math.abs(d) < 1e-9) return "At a 5% yield a 5% coupon bond trades at par, <b>$1,000</b>; from here price and yield move in opposite directions.";
    return "Yield " + (d > 0 ? "up " : "down ") + Viz.fmt(Math.abs(d)) + " pt to " + Viz.fmt(y * 100, 2) + "%: the 10-year " + (d > 0 ? "falls" : "rises") +
      " <b>" + pc(c10) + "</b> to $" + p10.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " (the 2-year only " + pc(c2) + "); duration alone predicts " + pc(est) + ".";
  },
  examples: [
    {name: "Minimum supported values", values: {yieldChangePercentagePoints: -3}},
    {name: "Maximum supported values", values: {yieldChangePercentagePoints: 3}},
    {name: "one point up", values: {yieldChangePercentagePoints: 1}}
  ],
  size: [400, 290],
  draw: function (api, v) {
    var c = api.color, s = Viz.get("rates-and-bonds"), d = v.yieldChangePercentagePoints, y = 0.05 + d / 100;
    var X = function (pctY) { return 62 + (pctY - 1.5) / 7 * 326; }, Y = function (P) { return 248 - (P - 740) / 560 * 222; };
    var P10 = s.price(y, 10), P2 = s.price(y, 2), D = s.modDur(10), Pest = 1000 * (1 - D * d / 100);
    var up = P10 > 1000 + 1e-9, down = P10 < 1000 - 1e-9, pcol = up ? c.c4 : down ? c.c5 : c.ink;
    // axes and light gridlines
    api.line([X(1.5), Y(740)], [X(8.5) + 4, Y(740)], {color: c.axis, width: 1.4, arrow: true});
    api.line([X(1.5), Y(740)], [X(1.5), Y(1300) - 4], {color: c.axis, width: 1.4, arrow: true});
    for (var p = 800; p <= 1250; p += 100) {
      api.line([X(1.5), Y(p)], [X(8.5), Y(p)], {color: c.grid, width: 1});
      if (Math.abs(Y(p) - Y(P10)) > 13 && (Math.abs(Y(p) - Y(1000)) > 13 || p === 1000)) api.label([X(1.5) - 6, Y(p)], "$" + p.toLocaleString("en-US"), {color: c.muted, size: 12, anchor: "end"});
    }
    for (var q = 2; q <= 8; q += 1) api.label([X(q), 262], q + "%", {color: Math.abs(q - y * 100) < 0.13 ? pcol : c.muted, size: 12, anchor: "middle"});
    api.label([X(8.5), 280], "yield to maturity", {color: c.muted, size: 12, anchor: "end"});
    api.label([X(1.5) - 4, 12], "price", {color: c.muted, size: 12});
    // the curves, sampled over the slider's range of yields
    var curve = function (n) { var pts = []; for (var k = 0; k <= 60; k++) { var yy = 2 + k * 0.1; pts.push([X(yy), Y(s.price(yy / 100, n))]); } return pts; };
    api.polyline(curve(2), {stroke: c.c6, width: 2, opacity: 0.85});
    api.line([X(2), Y(1000 * (1 + D * 0.03))], [X(8), Y(1000 * (1 - D * 0.03))], {color: c.c3, width: 1.6, dash: "6 5", opacity: 0.9});
    api.polyline(curve(10), {stroke: c.c2, width: 3.2});
    // a key row: the curves cross and crowd each other, so names on the lines collide at the extremes
    var key = [["10-year bond", c.c2, null], ["2-year bond", c.c6, null], ["duration", c.c3, "5 4"]], kx = 106;
    key.forEach(function (e) {
      api.line([kx, 12], [kx + 14, 12], {color: e[1], width: 2.5, dash: e[2]});
      api.label([kx + 19, 12], e[0], {color: e[1], size: 12, weight: 600});
      kx += 19 + e[0].length * 6.7 + 14;
    });
    // from par at 5% to the new yield: the move in yield along the axis, the move in price up the side
    var B = [X(5), Y(1000)], N = [X(y * 100), Y(P10)];
    api.line([X(1.5), N[1]], N, {color: pcol, width: 1.2, dash: "3 4", opacity: 0.85});
    api.line(N, [N[0], Y(740)], {color: pcol, width: 1.2, dash: "3 4", opacity: 0.85});
    api.label([X(1.5) - 6, N[1]], "$" + Math.round(P10).toLocaleString("en-US"), {color: pcol, size: 12.5, weight: 650, anchor: "end"});
    if (Math.abs(N[1] - B[1]) > 18) api.arrow([X(1.5) + 10, B[1]], [X(1.5) + 10, N[1]], {color: pcol, width: 2.5, halo: false, head: 8});
    if (Math.abs(N[0] - B[0]) > 18) api.arrow([B[0], Y(740) - 9], [N[0], Y(740) - 9], {color: c.ink, width: 2, halo: false, head: 7});
    // convexity: the gap between the true price and the duration estimate
    if (Math.abs(Y(Pest) - N[1]) > 3) {
      api.line([N[0], Y(Pest)], N, {color: c.c3, width: 3});
    }
    // the upper right of the plot is always empty: say how far the true price sits above the duration estimate
    if (P10 - Pest >= 0.5) api.label([X(8.5), Y(1215)], "convexity: +$" + Math.round(P10 - Pest) + " over duration", {color: c.c3, size: 12, weight: 600, anchor: "end"});
    api.point(B, {color: c.muted, r: 4});
    api.point([N[0], Y(P2)], {color: c.c6, r: 4.5, stroke: c.card});
    api.point(N, {color: pcol, r: 6, stroke: c.card});
    // viz.css sets every svg text to ink, which beats the fill attribute; an inline style keeps each label in its own color
    api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
  }
});
