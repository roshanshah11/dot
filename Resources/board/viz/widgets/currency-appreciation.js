// Why a currency appreciates: three events in the market for US dollars (priced in euros per dollar).
// The queue gives `event` as an integer 0..2; a slider for three named events is a worse control, so it is an
// enum of the events here (0 = rates, 1 = imports, 2 = inflation). Linear curves with equal slopes of
// 0.04 € per $bn; `shift_magnitude` moves a curve sideways by that many $bn a day at every rate.
Viz.register("currency-appreciation", {
  title: "Why a currency appreciates",
  subject: "finance",
  shows: "Pick an event and its size: demand for dollars rises or supply falls, the market clears at more euros per dollar, and the dollar appreciates",
  params: {
    event: {kind: "enum", values: ["US rates rise", "US imports fall", "US inflation falls"], default: "US rates rise", label: "\\text{event}"},
    shift_magnitude: {kind: "number", default: 2, min: 0.2, max: 5.5, step: 0.1, label: "\\text{shift}"}
  },
  // horizontal shifts of demand (right +) and supply (left +) for each event
  moves: function (v) {
    var m = v.shift_magnitude;
    return {"US rates rise": [m, 0], "US imports fall": [0, m], "US inflation falls": [m, m]}[v.event];
  },
  eq: function (v) {
    var mv = Viz.get("currency-appreciation").moves(v);
    return {q: 6 + (mv[0] - mv[1]) / 2, e: 0.9 + 0.04 * (mv[0] + mv[1]) / 2};
  },
  formula: function (v) {
    var E = Viz.get("currency-appreciation").eq(v);
    return "\\%\\Delta e=\\frac{e_1-e_0}{e_0}=\\frac{" + E.e.toFixed(3) + "-0.900}{0.900}=+" + Viz.n((E.e / 0.9 - 1) * 100, 1) + "\\%";
  },
  status: function (v) {
    var E = Viz.get("currency-appreciation").eq(v), tail = " the dollar appreciates <b>" + Viz.fmt((E.e / 0.9 - 1) * 100, 1) + "%</b>, from €0.900 to €" + E.e.toFixed(3) + ".";
    return {
      "US rates rise": "Higher US rates draw foreign savers into US bonds, so demand for dollars shifts right and" + tail,
      "US imports fall": "Americans buy fewer foreign goods and so sell fewer dollars: supply of dollars shifts left and" + tail,
      "US inflation falls": "Lower US inflation makes US goods cheaper abroad and imports dearer at home, so demand for dollars rises, supply falls, and" + tail
    }[v.event];
  },
  examples: [
    {name: "imports fall a lot", values: {event: "US imports fall", shift_magnitude: 5.5}},
    {name: "inflation falls, small shift", values: {event: "US inflation falls", shift_magnitude: 0.2}},
    {name: "inflation falls, big shift", values: {event: "US inflation falls", shift_magnitude: 5.5}}
  ],
  size: [400, 290],
  draw: function (api, v) {
    var c = api.color, k = 0.04, s = Viz.get("currency-appreciation"), mv = s.moves(v), E = s.eq(v);
    var pl = api.plane({x: [0, 12], y: [0.75, 1.2], box: [58, 26, 330, 222], equal: false, grid: false, axes: false});
    var O = pl.px([0, 0.75]);
    api.line(O, [pl.x(12) + 4, O[1]], {color: c.axis, width: 1.4, arrow: true});
    api.line(O, [O[0], pl.y(1.2) - 4], {color: c.axis, width: 1.4, arrow: true});
    api.label([O[0] - 4, 12], "€ per $", {color: c.muted, size: 12});
    api.label([pl.x(12), O[1] + 30], "dollars traded ($bn a day)", {color: c.muted, size: 12, anchor: "end"});
    // every curve, guide, arrow and tag is registered so the curve names can be placed clear of all of them
    var segs = [], boxes = [], ln = function (a, b, o) { segs.push([a, b]); return api.line(a, b, o); };
    // demand through (6 + dShift, 0.90) slope -k; supply through (6 - sShift, 0.90) slope +k; ends in px, low x first
    var curve = function (x0, slope) { var t = pl.through([x0, 0.9], [1, slope * k]); return [pl.px(t[0]), pl.px(t[1])]; };
    var D0 = curve(6, -1), S0 = curve(6, 1), D1 = curve(6 + mv[0], -1), S1 = curve(6 - mv[1], 1);
    if (mv[0]) ln(D0[0], D0[1], {color: c.c2, width: 1.5, dash: "5 5", opacity: 0.5});
    if (mv[1]) ln(S0[0], S0[1], {color: c.c3, width: 1.5, dash: "5 5", opacity: 0.5});
    ln(D1[0], D1[1], {color: c.c2, width: 3});
    ln(S1[0], S1[1], {color: c.c3, width: 3});
    // old and new equilibrium with their guides
    var P0 = pl.px([6, 0.9]), P1 = pl.px([E.q, E.e]);
    ln([O[0], P1[1]], P1, {color: c.c4, width: 1.2, dash: "3 4", opacity: 0.85});
    ln(P1, [P1[0], O[1]], {color: c.c4, width: 1.2, dash: "3 4", opacity: 0.85});
    ln([O[0], P0[1]], P0, {color: c.muted, width: 1, dash: "3 4", opacity: 0.6});
    // the shift, drawn at the old rate from the old equilibrium: at e0 buyers now want more dollars than sellers offer.
    // The supply arrow stops 14 px past the green rate arrow on the axis so the two heads never meet.
    var Pd = pl.px([6 + mv[0], 0.9]), Ps = pl.px([6 - mv[1], 0.9]), Q0 = P0, sx = Math.max(Ps[0], O[0] + 24);
    var tag = function (x, y, text, color, anchor) {
      var w = text.length * 6.9 + 8, x0 = anchor === "end" ? x - w + 4 : x - 4;
      api.rect(x0, y - 9, w, 18, {fill: c.card, fillOpacity: 0.88, rx: 4});
      api.label([x, y], text, {color: color, size: 12, weight: 600, anchor: anchor});
      boxes.push([x0, y - 9, x0 + w, y + 9]);
    };
    if (mv[0] && Pd[0] - Q0[0] > 12) { api.arrow(Q0, Pd, {color: c.c2, width: 2.5, halo: false, head: 8}); boxes.push([Q0[0], Q0[1] - 7, Pd[0] + 2, Q0[1] + 7]); }
    if (mv[1] && Q0[0] - sx > 12) { api.arrow(Q0, [sx, Q0[1]], {color: c.c3, width: 2.5, halo: false, head: 8}); boxes.push([sx - 2, Q0[1] - 7, Q0[0], Q0[1] + 7]); }
    if (mv[0]) tag(Q0[0] + 6, Q0[1] + 16, "demand for $ ↑", c.c2, "start");
    if (mv[1]) tag(Q0[0] - 6, Q0[1] + 16, "supply of $ ↓", c.c3, "end");
    // the rate gain is the green arrow on the axis
    api.label([O[0] - 6, P1[1]], "€" + E.e.toFixed(3), {color: c.c4, size: 12.5, weight: 650, anchor: "end"});
    if (P0[1] - P1[1] > 14) api.label([O[0] - 6, P0[1]], "€0.900", {color: c.muted, size: 12, anchor: "end"});
    if (P0[1] - P1[1] > 16) { api.arrow([O[0] + 10, P0[1]], [O[0] + 10, P1[1]], {color: c.c4, width: 2.5, halo: false, head: 8}); boxes.push([O[0] + 3, P1[1] - 2, O[0] + 17, P0[1]]); }
    api.label([P1[0], O[1] + 13], "$" + Viz.fmt(E.q, 2) + "bn", {color: c.c4, size: 12, anchor: "middle"});
    api.point(P0, {color: c.muted, r: 4});
    api.point(P1, {color: c.c4, r: 6, stroke: c.card});
    boxes.push([P0[0] - 6, P0[1] - 6, P0[0] + 6, P0[1] + 6], [P1[0] - 8, P1[1] - 8, P1[0] + 8, P1[1] + 8]);
    var head = "dollar appreciates +" + Viz.fmt((E.e / 0.9 - 1) * 100, 1) + "%";
    api.label([396, 12], head, {color: c.c4, size: 12.5, weight: 650, anchor: "end"});
    boxes.push([396 - head.length * 7.4, 4, 396, 20]);
    // curve names: each tries spots off the curve's pixel normal (12-16 px out) near either end, on a preferred side,
    // and takes the first one inside the plot and clear of every registered curve, guide, arrow, tag and name
    var crosses = function (b, s) {           // segment s against box b (Liang-Barsky)
      var p = s[0], d = [s[1][0] - p[0], s[1][1] - p[1]], t0 = 0, t1 = 1;
      for (var i = 0; i < 2; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (p[i] < b[i] || p[i] > b[i + 2]) return false; continue; }
        var ta = (b[i] - p[i]) / d[i], tb = (b[i + 2] - p[i]) / d[i];
        t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
        if (t0 > t1) return false;
      }
      return true;
    };
    var clear = function (b) {
      if (b[0] < O[0] + 3 || b[2] > api.w - 2 || b[1] < 4 || b[3] > O[1] - 3) return false;
      var g = [b[0] - 2, b[1] - 2, b[2] + 2, b[3] + 2];
      return !boxes.some(function (o) { return b[0] < o[2] && o[0] < b[2] && b[1] < o[3] && o[1] < b[3]; }) &&
        !segs.some(function (s) { return crosses(g, s); });
    };
    // prefs: [end (1 = right/high-x end, 0 = left end), side (+1 along n = (-dy, dx), -1 the other way)];
    // ends: try every end and side close to its end before moving inward (else move inward on one side first)
    var name = function (sg, text, prefs, o, ends) {
      var A = sg[0], B = sg[1], L = Math.hypot(B[0] - A[0], B[1] - A[1]), d = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], n = [-d[1], d[0]];
      var w = text.length * o.size * 0.62 + 2, h = o.size + 2, off = (w * Math.abs(n[0]) + h * Math.abs(n[1])) / 2 + 5, first = null, done = false;
      for (var a = 0; a < 3 * prefs.length && !done; a++) {
        var i = ends ? a % prefs.length : Math.floor(a / 3), j = ends ? Math.floor(a / prefs.length) : a % 3;
        var e = prefs[i][0] ? B : A, back = (prefs[i][0] ? -1 : 1) * Math.min(16 + 30 * j, L / 2);
        var at = [e[0] + d[0] * back + prefs[i][1] * n[0] * off, e[1] + d[1] * back + prefs[i][1] * n[1] * off];
        var b = [at[0] - w / 2, at[1] - h / 2, at[0] + w / 2, at[1] + h / 2];
        if (!first) first = at;
        if (clear(b)) { first = at; boxes.push(b); done = true; }
      }
      api.label(first, text, Object.assign({anchor: "middle"}, o));
    };
    // demand's n points down-left, supply's down-right; the dashed old curves sit outside the band between old and new
    name(D1, mv[0] ? "D₁" : "D", [[1, -1], [0, 1], [0, -1], [1, 1]], {color: c.c2, size: 14, weight: 700}, true);
    name(S1, mv[1] ? "S₁" : "S", [[1, 1], [0, -1], [0, 1], [1, -1]], {color: c.c3, size: 14, weight: 700}, true);
    if (mv[0]) name(D0, "D₀", [[1, 1], [1, -1], [0, 1], [0, -1]], {color: c.c2, size: 13, weight: 600, opacity: 0.75});
    if (mv[1]) name(S0, "S₀", [[1, 1], [0, 1], [1, -1], [0, -1]], {color: c.c3, size: 13, weight: 600, opacity: 0.75});
    // viz.css sets every svg text to ink, which beats the fill attribute; an inline style keeps each label in its own color
    api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
  }
});
