// Independent events as areas in a unit square (total probability 1). A takes a vertical strip of width P(A), B a
// horizontal strip of height P(B); because the two cuts are made independently, the overlap is a rectangle and its area
// is width x height, P(A)P(B). Every one of the four cells is a product the same way, and inside B's strip A still takes
// the same share P(A): that is what independence means, P(A | B) = P(A). Drag the corner of the overlap.
(function () {
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };
  var pc = function (x) { return Viz.fmt(x * 100, 1) + "%"; };

  Viz.register("independent-probability-intersection", {
    title: "Independent events: multiply the probabilities",
    subject: "stats",
    shows: "Drag the corner or slide P(A) and P(B): for independent events the overlap is a rectangle, so its area is P(A) times P(B)",
    params: {
      pA: {kind: "number", default: 0.6, min: 0, max: 1, step: 0.01, label: "P(A)"},
      pB: {kind: "number", default: 0.45, min: 0, max: 1, step: 0.01, label: "P(B)"}
    },
    formula: function (v) {
      return "\\begin{aligned}P(A\\cap B)&=P(A)\\,P(B)\\\\&=" + Viz.n(v.pA) + "\\cdot" + Viz.n(v.pB) + "=" + Viz.n(v.pA * v.pB, 4) + "\\end{aligned}";
    },
    status: function (v) {
      var ab = v.pA * v.pB;
      if (v.pA === 0 || v.pB === 0) return (v.pA === 0 ? "A" : "B") + " never happens, so A and B never happen together: <b>P(A ∩ B) = 0</b>.";
      if (v.pA === 1 && v.pB === 1) return "Both events are certain, so they happen together every time: <b>P(A ∩ B) = 1</b>.";
      return "A and B happen together <b>" + pc(ab) + "</b> of the time: B happens " + pc(v.pB) + " of the time, and being independent, A still happens in <b>" + pc(v.pA) + "</b> of those.";
    },
    examples: [
      {name: "Minimum supported values", values: {pA: 0, pB: 0}},
      {name: "Maximum supported values", values: {pA: 1, pB: 1}},
      {name: "two fair coins: both heads", values: {pA: 0.5, pB: 0.5}},
      {name: "two rare events", values: {pA: 0.1, pB: 0.2}},
      {name: "A is certain", values: {pA: 1, pB: 0.3}}
    ],
    size: [380, 296],
    draw: function (api, v) {
      var c = api.color, S = 200, x0 = 112, y0 = 24, yB = y0 + S, wA = v.pA * S, hB = v.pB * S, ab = v.pA * v.pB;
      // the whole sample space
      api.rect(x0, y0, S, S, {fill: c.faint, fillOpacity: 0.06, stroke: c.muted, width: 1.4, rx: 2});
      // A: left strip (blue); B: bottom strip (amber); A and B: the corner rectangle (green)
      if (wA > 0) api.rect(x0, y0, wA, S, {fill: c.c2, fillOpacity: 0.22, rx: 0});
      if (hB > 0) api.rect(x0, yB - hB, S, hB, {fill: c.c3, fillOpacity: 0.2, rx: 0});
      if (wA > 0 && hB > 0) api.rect(x0, yB - hB, wA, hB, {fill: c.c4, fillOpacity: 0.55, stroke: c.c4, width: 2, rx: 0});
      if (wA > 0 && wA < S) api.line([x0 + wA, y0], [x0 + wA, yB], {color: c.c2, width: 2});
      if (hB > 0 && hB < S) api.line([x0, yB - hB], [x0 + S, yB - hB], {color: c.c3, width: 2});
      // the four cells, each a product, labelled when there is room
      var cells = [
        [x0, yB - hB, wA, hB, ab, c.ink], [x0, y0, wA, S - hB, v.pA * (1 - v.pB), c.c2],
        [x0 + wA, yB - hB, S - wA, hB, (1 - v.pA) * v.pB, c.c3], [x0 + wA, y0, S - wA, S - hB, (1 - v.pA) * (1 - v.pB), c.muted]];
      var names = ["A ∩ B", "A only", "B only", "neither"];
      cells.forEach(function (q, i) {
        if (q[2] < 52 || q[3] < 34) return;
        api.label([q[0] + q[2] / 2, q[1] + q[3] / 2 - 8], names[i], {color: q[5], size: 12, weight: 600, anchor: "middle"});
        api.label([q[0] + q[2] / 2, q[1] + q[3] / 2 + 8], f(q[4], 4), {color: q[5], size: i ? 12.5 : 14, weight: i ? 600 : 750, anchor: "middle"});
      });
      // the overlap's value outside the square when the rectangle is too small to hold it
      if ((wA < 52 || hB < 34) && wA > 0 && hB > 0) api.label([x0 + wA + 8, yB - hB - 10], "A ∩ B = " + f(ab, 4), {color: c.c4, size: 12.5, weight: 700});
      // width = P(A) along the bottom, height = P(B) up the left side
      api.line([x0, yB + 10], [x0 + S, yB + 10], {color: c.grid, width: 1});
      if (wA > 0) {
        api.line([x0, yB + 10], [x0 + wA, yB + 10], {color: c.c2, width: 3});
        api.line([x0, yB + 5], [x0, yB + 15], {color: c.c2, width: 2});
        api.line([x0 + wA, yB + 5], [x0 + wA, yB + 15], {color: c.c2, width: 2});
      }
      api.label([x0 + Math.max(wA / 2, 34), yB + 26], "P(A) = " + f(v.pA), {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      if (hB > 0) {
        api.line([x0 - 10, yB], [x0 - 10, yB - hB], {color: c.c3, width: 3});
        api.line([x0 - 15, yB], [x0 - 5, yB], {color: c.c3, width: 2});
        api.line([x0 - 15, yB - hB], [x0 - 5, yB - hB], {color: c.c3, width: 2});
      }
      api.label([x0 - 18, yB - Math.max(hB / 2, 8)], "P(B) = " + f(v.pB), {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
      // what independence means: inside B's strip, A takes the same share as everywhere
      var cap = v.pB > 0 && v.pA > 0 && v.pA < 1 ? "inside B, A still covers " + pc(v.pA) + ": P(A | B) = P(A)" : "the whole square has area 1";
      api.label([x0 + S / 2, yB + 50], cap, {color: c.muted, size: 12, anchor: "middle"});
      api.handle([x0 + wA, yB - hB], {color: c.c4, r: 6.5, onDrag: function (p) {
        api.set({pA: Math.max(0, Math.min(1, Math.round((p[0] - x0) / S * 100) / 100)), pB: Math.max(0, Math.min(1, Math.round((yB - p[1]) / S * 100) / 100))});
      }});
    }
  });
})();
