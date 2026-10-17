// Bayes' theorem as areas. The unit square is everyone: a column of width P(A) for A and one of width 1 − P(A) for
// not A. Inside each column the shaded height is the chance of B there, so the two shaded blocks have areas
// P(B|A)P(A) and P(B|¬A)P(¬A), and together they are P(B). Learning B throws away everything unshaded; the bar on the
// right restacks the two B blocks to height 1, and the share that came from A is P(A|B).
(function () {
  function calc(v) {
    var ab = v.pBGivenA * v.pA, nab = v.pBGivenNotA * (1 - v.pA), pb = ab + nab;
    return {ab: ab, nab: nab, pb: pb, post: ab / pb, lr: v.pBGivenA / v.pBGivenNotA};
  }
  var d2 = function (x) { return Viz.n(x, 2); }, d3 = function (x) { return Viz.n(x, 3); };

  Viz.register("bayes-theorem", {
    title: "Bayes' theorem as areas",
    subject: "stats",
    shows: "Set the prior and the two likelihoods: the shaded blocks are the ways B can happen, and P(A|B) is the share of them that came from A",
    params: {
      pA: {kind: "number", default: 0.2, min: 0.1, max: 0.9, step: 0.01, label: "P(A)"},
      pBGivenA: {kind: "number", default: 0.85, min: 0.1, max: 0.9, step: 0.01, label: "P(B|A)"},
      pBGivenNotA: {kind: "number", default: 0.1, min: 0.1, max: 0.9, step: 0.01, label: "P(B|\\neg A)"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}P(A\\mid B)=\\dfrac{P(B\\mid A)P(A)}{P(B)}\\\\[6pt]=\\dfrac{" + d2(v.pBGivenA) + "\\cdot" + d2(v.pA) + "}{" + d2(v.pBGivenA) + "\\cdot" + d2(v.pA) +
        "+" + d2(v.pBGivenNotA) + "\\cdot" + d2(1 - v.pA) + "}=\\dfrac{" + d3(k.ab) + "}{" + d3(k.pb) + "}=" + d3(k.post) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), from = Viz.fmt(v.pA, 2), to = Viz.fmt(k.post, 2);
      if (Math.abs(v.pBGivenA - v.pBGivenNotA) < 1e-9) return "B is just as likely with or without A, so seeing B tells you nothing: P(A|B) stays <b>" + to + "</b>.";
      if (k.lr > 1) return "B is <b>" + Viz.fmt(k.lr, 2) + "×</b> as likely when A is true, so seeing B raises the chance of A from " + from + " to <b>" + to + "</b>.";
      return "B is less likely when A is true (" + Viz.fmt(k.lr, 2) + "× as likely), so seeing B lowers the chance of A from " + from + " to <b>" + to + "</b>.";
    },
    examples: [
      {name: "rare condition, good test", values: {pA: 0.1, pBGivenA: 0.9, pBGivenNotA: 0.1}},
      {name: "evidence tells nothing", values: {pA: 0.4, pBGivenA: 0.5, pBGivenNotA: 0.5}},
      {name: "evidence against A", values: {pA: 0.6, pBGivenA: 0.2, pBGivenNotA: 0.7}},
      {name: "all at minimum", values: {pA: 0.1, pBGivenA: 0.1, pBGivenNotA: 0.1}},
      {name: "all at maximum", values: {pA: 0.9, pBGivenA: 0.9, pBGivenNotA: 0.9}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v), S = 190, x0 = 52, y0 = 40, wA = S * v.pA, hA = S * v.pBGivenA, hN = S * v.pBGivenNotA, yb = y0 + S;
      // the square: everyone, split by A
      api.label([x0, 14], "everyone (area 1)", {color: c.muted, size: 12});
      api.rect(x0, y0, wA, S - hA, {fill: c.c1, fillOpacity: 0.07, rx: 0});
      api.rect(x0 + wA, y0, S - wA, S - hN, {fill: c.c3, fillOpacity: 0.07, rx: 0});
      api.rect(x0, yb - hA, wA, hA, {fill: c.c1, fillOpacity: 0.75, rx: 0});
      api.rect(x0 + wA, yb - hN, S - wA, hN, {fill: c.c3, fillOpacity: 0.75, rx: 0});
      api.rect(x0, y0, S, S, {stroke: c.axis, width: 1.2, rx: 0});
      api.line([x0 + wA, y0], [x0 + wA, yb], {color: c.ink, width: 1.5});
      // column widths on top; the B heights as ticks on the outer edges (left for A, right for not A)
      api.label([x0 + wA / 2, y0 - 10], "A " + api.fmt(v.pA, 2), {color: c.c1, size: 12, weight: 650, anchor: "middle"});
      api.label([x0 + wA + (S - wA) / 2, y0 - 10], "not A " + api.fmt(1 - v.pA, 2), {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      api.line([x0 - 5, yb - hA], [x0, yb - hA], {color: c.c1, width: 2});
      api.label([x0 - 8, yb - hA], api.fmt(v.pBGivenA, 2), {color: c.c1, size: 12.5, weight: 700, anchor: "end"});
      api.line([x0 + S, yb - hN], [x0 + S + 5, yb - hN], {color: c.c3, width: 2});
      api.label([x0 + S + 8, yb - hN], api.fmt(v.pBGivenNotA, 2), {color: c.c3, size: 12.5, weight: 700});
      api.label([x0 + S / 2, yb + 16], "shaded = B, total area P(B) = " + api.fmt(k.pb, 3), {color: c.muted, size: 12, anchor: "middle"});
      api.label([x0 + S / 2, yb + 33], "shaded height = P(B | that column)", {color: c.muted, size: 12, anchor: "middle"});
      // the two B blocks restacked to height 1: what is left once you know B happened
      var bx = 292, bw = 34, hp = S * k.post;
      api.label([bx + bw / 2, 14], "only B, rescaled", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      api.rect(bx, yb - hp, bw, hp, {fill: c.c1, fillOpacity: 0.9, rx: 0});
      api.rect(bx, y0, bw, S - hp, {fill: c.c3, fillOpacity: 0.9, rx: 0});
      api.rect(bx, y0, bw, S, {stroke: c.axis, width: 1.2, rx: 0});
      // labels beside the bar, pushed apart if a block is thin
      var yA = yb - hp / 2, yN = y0 + (S - hp) / 2;
      if (yA - yN < 36) { var mid = (yA + yN) / 2; yA = mid + 18; yN = mid - 18; }
      if (yA > yb - 8) { yN -= yA - (yb - 8); yA = yb - 8; }
      if (yN < y0 + 8) { yA += y0 + 8 - yN; yN = y0 + 8; }
      api.label([bx + bw + 7, yA - 8], "P(A|B)", {color: c.c1, size: 12, weight: 600});
      api.label([bx + bw + 7, yA + 8], api.fmt(k.post, 3), {color: c.c1, size: 14, weight: 750});
      api.label([bx + bw + 7, yN - 8], "P(¬A|B)", {color: c.c3, size: 12, weight: 600});
      api.label([bx + bw + 7, yN + 8], api.fmt(1 - k.post, 3), {color: c.c3, size: 14, weight: 750});
      api.label([bx + bw / 2, yb + 16], "height 1", {color: c.muted, size: 12, anchor: "middle"});
    }
  });
})();
