// A short futures hedge: a farmer with q = 10,000 bushels sells futures at F0 before harvest. At delivery the
// futures price converges to spot (F_T = S_T), so the futures position pays q(F0 - S_T) and spot sales bring
// q S_T: together exactly q F0 whatever the harvest price. The queue has no params; Dot's are F0, S_T and
// the hedge ratio h (h = 1 is the queue's formula; h < 1 shows how much price risk is left).
Viz.register("futures-hedge-locked-revenue", {
  title: "Futures hedge: locking in revenue",
  subject: "finance",
  shows: "Drag the harvest price: spot sales and the short futures move in opposite directions, so a full hedge always adds up to q times the futures price",
  params: {
    F0: {kind: "number", default: 5, min: 3, max: 7, step: 0.05, label: "F_0"},
    ST: {kind: "number", default: 4.2, min: 2, max: 8, step: 0.05, label: "S_T"},
    h: {kind: "number", default: 1, min: 0, max: 1, step: 0.05, label: "h"}
  },
  q: 10000,
  formula: function (v) {
    var q = 10000, spot = q * v.ST, fut = v.h * q * (v.F0 - v.ST), k = function (x) { return Math.round(x).toLocaleString("en-US").replace(/,/g, "{,}"); };
    var u = function (tex, x) { return "\\underbrace{" + tex + "}_{" + k(x) + "}"; };
    if (v.h >= 1) return u("qS_T", spot) + "+" + u("q(F_0-F_T)", fut) + "=" + u("qF_0", q * v.F0);
    return u("qS_T", spot) + "+" + u(Viz.n(v.h) + "\\,q(F_0-F_T)", fut) + "=" + k(spot + fut);
  },
  status: function (v) {
    var q = 10000, spot = q * v.ST, fut = v.h * q * (v.F0 - v.ST), m = function (x) { return Viz.money(Math.round(x), 0); };
    if (v.h >= 1) return "Spot sales bring " + m(spot) + " and the futures " + (fut >= 0 ? "earn " + m(fut) : "lose " + m(-fut)) +
      ": revenue is locked at <b>" + m(q * v.F0) + "</b>, $" + v.F0.toFixed(2) + " a bushel, at any harvest price.";
    if (v.h <= 0) return "Unhedged: revenue is just spot sales, <b>" + m(spot) + "</b>, and moves $10,000 with every $1 in the price.";
    return Math.round(v.h * 100) + "% hedged: revenue is <b>" + m(spot + fut) + "</b>, and each $1 move in the price still moves it by " + m((1 - v.h) * q) + ".";
  },
  examples: [
    {name: "price collapses, hedged", values: {ST: 2}},
    {name: "price soars, hedged", values: {ST: 8}},
    {name: "unhedged", values: {h: 0, ST: 3}},
    {name: "half hedged", values: {h: 0.5, ST: 6.5, F0: 4}}
  ],
  size: [400, 300],
  draw: function (api, v) {
    var c = api.color, q = 10000, h = v.h, F0 = v.F0, ST = v.ST;
    var Y = function (k) { return 258 - (k + 60) / 145 * 232; };            // k in $ thousands, -60 .. 85
    var X = function (p) { return 58 + (p - 2) / 6 * 200; };                // price in $/bu, 2 .. 8
    var spot = function (p) { return q * p / 1000; }, fut = function (p) { return h * q * (F0 - p) / 1000; };
    var tot = function (p) { return spot(p) + fut(p); };
    var kf = function (x) { return (x < 0 ? "−$" : "$") + Viz.fmt(Math.abs(x), 1) + "k"; };
    for (var g = -50; g <= 75; g += 25) {
      api.line([X(2), Y(g)], [392, Y(g)], {color: g === 0 ? c.axis : c.grid, width: g === 0 ? 1.3 : 1});
      if (g % 50 === 0) api.label([X(2) - 7, Y(g)], g === 0 ? "$0" : kf(g), {color: c.muted, size: 12, anchor: "end"});
    }
    for (var p = 2; p <= 8; p += 2) api.label([X(p), 273], "$" + p, {color: c.muted, size: 12, anchor: "middle"});
    // the axis title sits under the line chart only; a faint divider sets the waterfall apart from the price axis
    api.label([X(5), 291], "harvest price ($/bu) = futures at delivery", {color: c.muted, size: 12, anchor: "middle"});
    api.line([274, Y(85)], [274, 279], {color: c.axis, width: 1, opacity: 0.55});
    // label placement: each label tries a few spots and takes the first inside the chart that crosses none of the
    // three lines (straight, so the box is tested against the line's y over the box's width) and covers no dot or label
    var P = function (x) { return 2 + (x - 58) / 200 * 6; }, fns = [spot, fut, tot, function () { return 0; }], xs = X(ST), taken = [], texts = [];
    var cut = function (b, fn) { var ya = Y(fn(P(b[0]))), yb = Y(fn(P(b[2]))); return Math.max(ya, yb) >= b[1] && Math.min(ya, yb) <= b[3]; };
    var ok = function (b, avoid) {
      return b[0] >= X(2) + 2 && b[2] <= 262 && b[1] >= 10 && b[3] <= 256 && !(avoid && avoid > b[0] - 10 && avoid < b[2] + 10) &&
        !fns.some(function (fn) { return cut(b, fn); }) && !taken.some(function (o) { return b[0] < o[2] && o[0] < b[2] && b[1] < o[3] && o[1] < b[3]; });
    };
    // cands: [[x, y, anchor]]; avoid: an x the label should not straddle (the S_T guide), dropped if nothing else fits
    var lab = function (cands, text, o, avoid) {
      var w = api.sub(text).length * o.size * 0.55, hh = o.size / 2, box = function (cd) {
        var x0 = cd[2] === "end" ? cd[0] - w : cd[0]; return [x0, cd[1] - hh, x0 + w, cd[1] + hh];
      }, pick = cands[0];
      for (var k = 0, done = false; k < 2 && !done; k++) for (var i = 0; i < cands.length && !done; i++)
        if (ok(box(cands[i]), k ? null : avoid)) { pick = cands[i]; done = true; }
      var b = box(pick); taken.push(b); texts.push([b[0] - 3, b[1] - 2, b[2] + 3, b[3] + 2]);
      api.label([pick[0], pick[1]], text, Object.assign({anchor: pick[2]}, o));
    };
    // spots beside a line: at its right end, just left of the S_T dots, then its left end, the preferred side first;
    // y keeps the whole box clear of the line
    var beside = function (fn, text, size, above) {
      var w = text.length * size * 0.55, out = [], r = Math.min(X(8) - 2, xs - 9);
      [[X(8) - 2 - w, X(8) - 2, "end"], [r - w, r, "end"], [X(2) + 4, X(2) + 4 + w, "start"]].forEach(function (e) {
        var ya = Y(fn(P(e[0]))), yb = Y(fn(P(e[1])));
        [above, !above].forEach(function (up) {
          out.push([e[2] === "end" ? e[1] : e[0], up ? Math.min(ya, yb) - 5 - size / 2 - 1 : Math.max(ya, yb) + 5 + size / 2 + 1, e[2]]);
        });
      });
      return out;
    };
    [spot(ST), fut(ST), tot(ST)].forEach(function (k) { taken.push([xs - 7, Y(k) - 7, xs + 7, Y(k) + 7]); });
    taken.push([xs - 9, Y(-60) - 9, xs + 9, Y(-60) + 9]);                      // the S_T handle
    var tl = h >= 1 ? "total, locked" : "total";
    lab(beside(spot, "spot sales", 12, true), "spot sales", {color: c.c2, size: 12, weight: 600});
    lab(beside(tot, tl, 12.5, false), tl, {color: c.c1, size: 12.5, weight: 700});
    lab(beside(fut, "futures P&L", 12, false), "futures P&L", {color: c.c6, size: 12, weight: 600});
    // F0, where the futures position breaks even, is named low in the chart beside its own line, like a mark on the
    // price axis, on whichever side keeps clear of the S_T guide and its handle
    var fl = "F_0 = $" + F0.toFixed(2), fc = [];
    [Y(-54), Y(-45), Y(-36), Y(-27), Y(-18)].forEach(function (y) { fc.push([X(F0) - 5, y, "end"], [X(F0) + 5, y, "start"]); });
    lab(fc, fl, {color: c.c6, size: 12, weight: 600}, xs);
    // the two vertical guides pause wherever a label sits on them
    var vline = function (x, y0, y1, o) {
      var y = y0;
      texts.filter(function (b) { return x > b[0] && x < b[2] && b[3] > y0 && b[1] < y1; }).sort(function (a, b) { return a[1] - b[1]; })
        .forEach(function (b) { if (b[1] > y) api.line([x, y], [x, b[1]], o); y = Math.max(y, b[3]); });
      if (y < y1) api.line([x, y], [x, y1], o);
    };
    vline(X(F0), Y(85), Y(-60), {color: c.c6, width: 1.5, dash: "3 3", opacity: 0.9});
    // the three lines over every harvest price
    api.line([X(2), Y(spot(2))], [X(8), Y(spot(8))], {color: c.c2, width: 2.5});
    api.line([X(2), Y(fut(2))], [X(8), Y(fut(8))], {color: c.c6, width: 2.5});
    api.line([X(2), Y(tot(2))], [X(8), Y(tot(8))], {color: c.c1, width: 4});
    // the harvest price today
    vline(xs, Y(85), Y(-60), {color: c.ink, width: 1.4, dash: "4 4", opacity: 0.8});
    [[spot(ST), c.c2], [fut(ST), c.c6], [tot(ST), c.c1]].forEach(function (d) { api.point([X(ST), Y(d[0])], {color: d[1], r: 4.5, stroke: c.card}); });
    // waterfall on the same dollar scale: spot + futures = total
    var cs = 300, cf = 340, ct = 380, bw = 26, s = spot(ST), f = fut(ST), t = s + f;
    api.rect(cs - bw / 2, Y(s), bw, Y(0) - Y(s), {fill: c.c2, fillOpacity: 0.75, rx: 2});
    api.rect(cf - bw / 2, Y(Math.max(s, t)), bw, Math.max(2, Math.abs(Y(s) - Y(t))), {fill: c.c6, fillOpacity: 0.8, rx: 2});
    api.rect(ct - bw / 2, Y(Math.max(t, 0)), bw, Math.abs(Y(0) - Y(t)), {fill: c.c1, fillOpacity: 0.85, rx: 2});
    api.line([cs + bw / 2, Y(s)], [cf - bw / 2, Y(s)], {color: c.muted, width: 1});
    api.line([cf + bw / 2, Y(t)], [ct - bw / 2, Y(t)], {color: c.muted, width: 1});
    api.label([cs, Y(s) - 10], kf(s), {color: c.c2, size: 12, weight: 600, anchor: "middle"});
    // a gain's label sits on the same row as the total's: lift it a row when the two would touch
    var ft = (f > 0 ? "+" : "") + kf(f), lift = f >= 0 && cf + ft.length * 3.4 > ct - kf(t).length * 3.4 - 3;
    api.label([cf, f >= 0 ? Y(t) - (lift ? 24 : 10) : Y(t) + 11], ft, {color: c.c6, size: 12, weight: 600, anchor: "middle"});
    api.label([ct, Y(Math.max(t, 0)) - 10], kf(t), {color: c.c1, size: 12, weight: 700, anchor: "middle"});
    api.label([cs, 273], "spot", {color: c.muted, size: 12, anchor: "middle"});
    api.label([cf, 273], "futures", {color: c.muted, size: 12, anchor: "middle"});
    api.label([ct, 273], "total", {color: c.muted, size: 12, anchor: "middle"});
    // drag the harvest price along the axis
    api.handle([X(ST), Y(-60)], {color: c.ink, r: 6, onDrag: function (pt) { api.set({ST: Math.round((2 + (pt[0] - 58) / 200 * 6) * 20) / 20}); }});
    // viz.css sets every svg text to ink, which beats the fill attribute; an inline style keeps each label in its own color
    api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
  }
});
