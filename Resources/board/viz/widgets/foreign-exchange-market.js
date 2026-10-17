// The market for euros, priced in dollars. Demand comes from holders of dollars who want euros (for European
// goods or assets); supply from holders of euros who want dollars. Linear curves with equal slopes (20 €bn per
// $1 of rate, i.e. 0.05 $ per €bn); a shift moves a curve sideways by that many €bn a day at every rate.
// demand_shift defaults to 2, not the queue's 0: an unshifted cross teaches nothing about appreciation, which is
// the whole point here. 0/0 stays as the "at rest" example.
Viz.register("foreign-exchange-market", {
  title: "The foreign exchange market",
  subject: "finance",
  shows: "Shift the demand for and supply of euros: the exchange rate settles where they cross, and the euro appreciates when demand rises or supply falls",
  params: {
    demand_shift: {kind: "number", default: 2, min: -2.8, max: 2.8, step: 0.2, label: "\\Delta D"},
    supply_shift: {kind: "number", default: 0, min: -2.8, max: 2.8, step: 0.2, label: "\\Delta S"}
  },
  eq: function (v) { return {q: 5 + (v.demand_shift + v.supply_shift) / 2, e: 1.10 + 0.05 * (v.demand_shift - v.supply_shift) / 2}; },
  formula: function (v) {
    var E = Viz.get("foreign-exchange-market").eq(v), ch = (E.e / 1.10 - 1) * 100;
    // three short lines so the working fits the side panel: the rule, the live shifts, the rate and its % change
    return "\\begin{aligned}e^*&=1.10+0.05\\cdot\\frac{\\Delta D-\\Delta S}{2}\\\\&=1.10+0.05\\cdot\\frac{" + Viz.n(v.demand_shift, 1) + "-" + Viz.p(v.supply_shift, 1) +
      "}{2}\\\\&=\\$" + E.e.toFixed(3) + "\\quad(\\%\\Delta e=" + (ch > 0.05 ? "+" : "") + Viz.n(ch, 1) + "\\%)\\end{aligned}";
  },
  status: function (v) {
    var E = Viz.get("foreign-exchange-market").eq(v), d = v.demand_shift, s = v.supply_shift, ch = E.e / 1.10 - 1;
    var why = [];
    if (Math.abs(d) > 1e-9) why.push(d > 0 ? "more demand for euros" : "less demand for euros");
    if (Math.abs(s) > 1e-9) why.push(s > 0 ? "more euros on offer" : "fewer euros on offer");
    if (!why.length) return "At <b>$1.100</b> per euro, the €5bn a day buyers want is exactly what sellers offer.";
    var cause = why.join(" and ");
    cause = cause.charAt(0).toUpperCase() + cause.slice(1);
    if (Math.abs(E.e - 1.10) < 1e-9) return cause + " cancel out on price: the rate holds at <b>$1.100</b> and volume moves to €" + Viz.fmt(E.q, 1) + "bn a day.";
    return cause + ": the euro " + (ch > 0 ? "appreciates" : "depreciates") + " to <b>$" + E.e.toFixed(3) + "</b> (" +
      (ch > 0 ? "+" : "−") + Viz.fmt(Math.abs(ch) * 100, 1) + "%), so one dollar now buys €" + (1 / E.e).toFixed(3) + ".";
  },
  examples: [
    {name: "at rest", values: {demand_shift: 0, supply_shift: 0}},
    {name: "supply of euros rises", values: {demand_shift: 0, supply_shift: 2.8}},
    {name: "both rise together", values: {demand_shift: 2, supply_shift: 2}},
    {name: "extreme appreciation", values: {demand_shift: 2.8, supply_shift: -2.8}}
  ],
  size: [400, 290],
  draw: function (api, v) {
    var c = api.color, k = 0.05, d = v.demand_shift, s = v.supply_shift, E = Viz.get("foreign-exchange-market").eq(v);
    var pl = api.plane({x: [0, 11], y: [0.8, 1.4], box: [58, 26, 330, 222], equal: false, grid: false, axes: false});
    var O = pl.px([0, 0.8]), dOn = Math.abs(d) > 1e-9, sOn = Math.abs(s) > 1e-9;
    api.line(O, [pl.x(11) + 4, O[1]], {color: c.axis, width: 1.4, arrow: true});
    api.line(O, [O[0], pl.y(1.4) - 4], {color: c.axis, width: 1.4, arrow: true});
    api.label([O[0] - 4, 12], "$ per €", {color: c.muted, size: 12});
    api.label([pl.x(11), O[1] + 30], "euros traded (€bn a day)", {color: c.muted, size: 12, anchor: "end"});
    // every curve, guide, arrow, handle and tag is registered so the names can be placed clear of all of them
    var segs = [], boxes = [], ln = function (a, b, o) { segs.push([a, b, !!o.dash && o.width < 2]); return api.line(a, b, o); };
    // a curve through (5 + shift, 1.10) with slope -k (demand) or +k (supply), clipped to the plane; px ends, low x first
    var curve = function (shift, slope) { var t = pl.through([5 + shift, 1.10], [1, slope * k]); return [pl.px(t[0]), pl.px(t[1])]; };
    var D0 = curve(0, -1), S0 = curve(0, 1), D1 = curve(d, -1), S1 = curve(s, 1);
    if (dOn) ln(D0[0], D0[1], {color: c.c2, width: 1.5, dash: "5 5", opacity: 0.5});
    if (sOn) ln(S0[0], S0[1], {color: c.c3, width: 1.5, dash: "5 5", opacity: 0.5});
    ln(D1[0], D1[1], {color: c.c2, width: 3});
    ln(S1[0], S1[1], {color: c.c3, width: 3});
    // outcome color: green when the euro gains, red when it loses
    var up = E.e > 1.10 + 1e-9, down = E.e < 1.10 - 1e-9, oc = up ? c.c4 : down ? c.c5 : c.ink;
    var P1 = pl.px([E.q, E.e]), P0 = pl.px([5, 1.10]);
    ln([O[0], P1[1]], P1, {color: oc, width: 1.2, dash: "3 4", opacity: 0.8});
    ln(P1, [P1[0], O[1]], {color: oc, width: 1.2, dash: "3 4", opacity: 0.8});
    api.label([O[0] - 6, P1[1]], "$" + E.e.toFixed(3), {color: oc, size: 12.5, weight: 650, anchor: "end"});
    api.label([P1[0], O[1] + 13], "€" + Viz.fmt(E.q, 1) + "bn", {color: oc, size: 12, anchor: "middle"});
    // drag either curve sideways: its handle rides on it at a rate set by the OTHER curve's shift (so it holds still
    // while dragged), chosen so the handle stays in the plot and never lands on the equilibrium for any drag
    var rD = s >= 0.8 ? 1.18 : 0.98, rS = d >= 0.8 ? 1.02 : 1.22, xD = 5 + (1.10 - rD) / 0.05, xS = 5 + (rS - 1.10) / 0.05;
    var hD = pl.px([xD + d, rD]), hS = pl.px([xS + s, rS]);
    // marks: dots a tag must never cover (tags carry a backing card, so they may cross lines)
    var sq = function (p, r) { return [p[0] - r, p[1] - r, p[0] + r, p[1] + r]; }, marks = [sq(hD, 8), sq(hS, 8), sq(P1, 8), sq(P0, 6)];
    boxes.push.apply(boxes, marks);
    var hits = function (b, list) { return list.some(function (o) { return b[0] < o[2] && o[0] < b[2] && b[1] < o[3] && o[1] < b[3]; }); };
    // a tag tries the rows in ys (offsets from y), each nudged 0, 24 or 48 px the way its arrow points, and takes
    // the first spot that covers no dot and no earlier tag
    var tag = function (x, y, ys, text, color, anchor) {
      var w = text.length * 6.9 + 8, sg = anchor === "end" ? -1 : 1, xx = x, yy = y + ys[0];
      for (var i = 0, ok = false; i < 3 * ys.length && !ok; i++) {
        var tx = x + sg * 24 * (i % 3), x0 = sg < 0 ? tx - w + 4 : tx - 4, ty0 = y + ys[Math.floor(i / 3)];
        if (!hits([x0, ty0 - 9, x0 + w, ty0 + 9], marks) && x0 > O[0] + 2 && x0 + w < api.w - 2) { xx = tx; yy = ty0; ok = true; }
      }
      var bx = sg < 0 ? xx - w + 4 : xx - 4;
      api.rect(bx, yy - 9, w, 18, {fill: c.card, fillOpacity: 0.88, rx: 4});
      api.label([xx, yy], text, {color: color, size: 12, weight: 600, anchor: anchor});
      marks.push([bx, yy - 9, bx + w, yy + 9]); boxes.push([bx, yy - 9, bx + w, yy + 9]);
    };
    if (dOn || sOn) {
      ln([O[0], P0[1]], P0, {color: c.muted, width: 1, dash: "3 4", opacity: 0.6});
      if (Math.abs(P1[1] - P0[1]) > 15) api.label([O[0] - 6, P0[1]], "$1.100", {color: c.muted, size: 12, anchor: "end"});
      if (Math.abs(P1[1] - P0[1]) > 18) {
        api.arrow([O[0] + 10, P0[1]], [O[0] + 10, P1[1]], {color: oc, width: 2.5, halo: false, head: 8});
        boxes.push([O[0] + 3, Math.min(P0[1], P1[1]) - 2, O[0] + 17, Math.max(P0[1], P1[1]) + 2]);
      }
      // each shift drawn at the old rate from the old equilibrium (nudged apart when both point the same way),
      // its tag preferring the side away from the new equilibrium
      var same = dOn && sOn && d * s > 0, ty = P1[1] > P0[1] + 1 ? -1 : 1;
      [[d, c.c2, same ? -4 : 0, "demand for € "], [s, c.c3, same ? 4 : 0, "supply of € "]].forEach(function (m) {
        if (Math.abs(m[0]) < 1e-9) return;
        var y = P0[1] + m[2], end = pl.x(5 + m[0]);
        if (Math.abs(end - P0[0]) > 12) {
          api.arrow([P0[0], y], [end, y], {color: m[1], width: 2.5, halo: false, head: 8});
          boxes.push([Math.min(P0[0], end) - 2, y - 7, Math.max(P0[0], end) + 2, y + 7]);
        }
        tag(P0[0] + (m[0] > 0 ? 6 : -6), P0[1], [16 * ty, 34 * ty, -16 * ty, -34 * ty], m[3] + (m[0] > 0 ? "↑" : "↓"), m[1], m[0] > 0 ? "start" : "end");
      });
      api.point(P0, {color: c.muted, r: 4});
      if (up || down) {
        var head = (up ? "euro appreciates +" : "euro depreciates −") + Viz.fmt(Math.abs(E.e / 1.10 - 1) * 100, 1) + "%";
        api.label([396, 12], head, {color: oc, size: 12.5, weight: 650, anchor: "end"});
        boxes.push([396 - head.length * 7.4, 4, 396, 20]);
      }
    }
    api.point(P1, {color: oc, r: 6, stroke: c.card});
    api.handle(hD, {color: c.c2, r: 6, onDrag: function (q) { api.set({demand_shift: Math.max(-2.8, Math.min(2.8, Math.round((pl.invert(q)[0] - xD) * 5) / 5))}); }});
    api.handle(hS, {color: c.c3, r: 6, onDrag: function (q) { api.set({supply_shift: Math.max(-2.8, Math.min(2.8, Math.round((pl.invert(q)[0] - xS) * 5) / 5))}); }});
    // label placement: candidate spots off a curve's pixel normal; the first one inside the plot and clear of every
    // registered curve, guide, arrow, handle, tag and name wins
    var crosses = function (b, sg) {          // segment sg against box b (Liang-Barsky)
      var p = sg[0], dd = [sg[1][0] - p[0], sg[1][1] - p[1]], t0 = 0, t1 = 1;
      for (var i = 0; i < 2; i++) {
        if (Math.abs(dd[i]) < 1e-9) { if (p[i] < b[i] || p[i] > b[i + 2]) return false; continue; }
        var ta = (b[i] - p[i]) / dd[i], tb = (b[i + 2] - p[i]) / dd[i];
        t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
        if (t0 > t1) return false;
      }
      return true;
    };
    // soft: a label on its own backing card may cover the thin dashed guides and old curves
    var clear = function (b, soft) {
      if (b[0] < O[0] + 3 || b[2] > api.w - 2 || b[1] < 4 || b[3] > O[1] - 3) return false;
      var g = [b[0] - 2, b[1] - 2, b[2] + 2, b[3] + 2];
      return !hits(b, boxes) && !segs.some(function (sg) { return !(soft && sg[2]) && crosses(g, sg); });
    };
    // cands: [[point on the curve, side]]; the label's centre sits off the point along side * n, n = (-dy, dx)
    var place = function (sg, cands, text, o, gap, soft) {
      var A = sg[0], B = sg[1], L = Math.hypot(B[0] - A[0], B[1] - A[1]), u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], n = [-u[1], u[0]];
      var w = text.length * o.size * 0.62 + 2, h = o.size + 2, off = (w * Math.abs(n[0]) + h * Math.abs(n[1])) / 2 + gap, first = null;
      // a clear spot first; only then one that covers a thin dashed line (soft labels carry a backing card)
      for (var k = 0, done = false; k < (soft ? 2 : 1) && !done; k++) for (var i = 0; i < cands.length && !done; i++) {
        var at = [cands[i][0][0] + cands[i][1] * n[0] * off, cands[i][0][1] + cands[i][1] * n[1] * off];
        var b = [at[0] - w / 2, at[1] - h / 2, at[0] + w / 2, at[1] + h / 2];
        if (!first) first = at;
        if (clear(b, k > 0)) { first = at; boxes.push(b); done = true; }
      }
      if (soft) api.rect(first[0] - w / 2 - 2, first[1] - h / 2, w + 4, h, {fill: c.card, fillOpacity: 0.88, rx: 4});
      api.label(first, text, Object.assign({anchor: "middle"}, o));
    };
    // spots near the ends: prefs [end (1 = high-x end), side]; ends = try every end close in before moving inward
    var name = function (sg, text, prefs, o, ends) {
      var A = sg[0], B = sg[1], L = Math.hypot(B[0] - A[0], B[1] - A[1]), u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], cands = [];
      for (var a = 0; a < 3 * prefs.length; a++) {
        var i = ends ? a % prefs.length : Math.floor(a / 3), j = ends ? Math.floor(a / prefs.length) : a % 3;
        var e = prefs[i][0] ? B : A, back = (prefs[i][0] ? -1 : 1) * Math.min(16 + 30 * j, L / 2);
        cands.push([[e[0] + u[0] * back, e[1] + u[1] * back], prefs[i][1]]);
      }
      place(sg, cands, text, o, 5);
    };
    // the handle tags first (they have to sit by their dot), then the names; demand's n points down-left, supply's
    // down-right, and each dashed old curve is named outside the band between old and new
    var near = function (sg, h) {
      var u = [sg[1][0] - sg[0][0], sg[1][1] - sg[0][1]], L = Math.hypot(u[0], u[1]), out = [];
      [0, 20, -20, 40, -40].forEach(function (t) { [-1, 1].forEach(function (sd) { out.push([[h[0] + u[0] / L * t, h[1] + u[1] / L * t], sd]); }); });
      return out;
    };
    place(D1, near(D1, hD), "drag D", {color: c.c2, size: 12, weight: 600}, 10, true);
    place(S1, near(S1, hS), "drag S", {color: c.c3, size: 12, weight: 600}, 10, true);
    name(D1, dOn ? "D₁" : "D", [[1, -1], [0, 1], [0, -1], [1, 1]], {color: c.c2, size: 14, weight: 700}, true);
    name(S1, sOn ? "S₁" : "S", [[1, 1], [0, -1], [0, 1], [1, -1]], {color: c.c3, size: 14, weight: 700}, true);
    if (dOn) name(D0, "D₀", d > 0 ? [[1, 1], [1, -1], [0, 1], [0, -1]] : [[1, -1], [1, 1], [0, -1], [0, 1]], {color: c.c2, size: 13, weight: 600, opacity: 0.75});
    if (sOn) name(S0, "S₀", s < 0 ? [[1, 1], [0, 1], [1, -1], [0, -1]] : [[1, -1], [0, -1], [1, 1], [0, 1]], {color: c.c3, size: 13, weight: 600, opacity: 0.75});
    // viz.css sets every svg text to ink, which beats the fill attribute; an inline style keeps each label in its own color
    api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
  }
});
