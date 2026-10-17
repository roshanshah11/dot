// Conditional probability as zooming in. Left: the sample space as a unit square, area = probability. B is the blue
// strip of width P(B); A ∩ B is the amber part of that strip, area P(A ∩ B) (height P(A ∩ B)/P(B)). Right: once B is
// known to have happened, B is the whole world, so it is stretched to the full square; the amber share of it is then
// P(A | B) = P(A ∩ B)/P(B). A's part outside B is not drawn because the definition never uses it. The two inputs are
// free sliders, so impossible pairs (P(A ∩ B) > P(B)) and P(B) = 0 are named in red instead of drawn as if valid.
(function () {
  function calc(v) {
    var ok = v.pB > 0 && v.pIntersection <= v.pB + 1e-9;
    return {ok: ok, zeroB: v.pB === 0, over: v.pIntersection > v.pB + 1e-9, cond: v.pB > 0 ? v.pIntersection / v.pB : NaN};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 3 : d); };

  Viz.register("conditional-probability-definition", {
    title: "Conditional probability: P(A | B)",
    subject: "stats",
    shows: "Set P(B) and P(A ∩ B): knowing B happened shrinks the world to B, and P(A | B) is the share of B where A also happens",
    params: {
      pB: {kind: "number", default: 0.65, min: 0, max: 1, step: 0.01, label: "P(B)"},
      pIntersection: {kind: "number", default: 0.3, min: 0, max: 1, step: 0.01, label: "P(A\\!\\cap\\!B)"}
    },
    formula: function (v) {
      var k = calc(v), head = "P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}=";
      if (k.zeroB) return head + "\\frac{" + Viz.n(v.pIntersection) + "}{0}\\ \\text{(undefined)}";
      // an impossible pair keeps its plain quotient here: the status and the red labels in the figure name it
      return head + "\\frac{" + Viz.n(v.pIntersection) + "}{" + Viz.n(v.pB) + "}=" + Viz.n(k.cond, 3);
    },
    status: function (v) {
      var k = calc(v);
      if (k.zeroB) return "P(B) = 0: B never happens, so there is nothing to condition on and P(A | B) is <b>undefined</b>.";
      if (k.over) return "<b>Impossible</b>: A ∩ B is part of B, so P(A ∩ B) = " + f(v.pIntersection, 2) + " can't exceed P(B) = " + f(v.pB, 2) + ".";
      if (v.pIntersection === 0) return "A and B never happen together, so once B has happened, A has probability <b>0</b>.";
      if (Math.abs(v.pIntersection - v.pB) < 1e-9) return "All of B lies inside A, so once B has happened, A is <b>certain</b>: P(A | B) = 1.";
      if (v.pB === 1) return "B is certain, so knowing it changes nothing: P(A | B) = P(A ∩ B) = <b>" + f(k.cond) + "</b>.";
      var ab = f(v.pIntersection, 2), b = f(v.pB, 2);
      return "Once B has happened only B's " + b + " counts: A ∩ B's " + ab + " is " + ab + "/" + b + " of that, so P(A | B) = <b>" + f(k.cond) +
        "</b>, about " + Viz.pct(k.cond, 0) + ".";
    },
    examples: [
      {name: "B is certain", values: {pB: 1, pIntersection: 0.3}},
      {name: "A and B never overlap", values: {pB: 0.5, pIntersection: 0}},
      {name: "B inside A", values: {pB: 0.4, pIntersection: 0.4}},
      {name: "impossible pair", values: {pB: 0.3, pIntersection: 0.5}},
      {name: "every input at its minimum", values: {pB: 0, pIntersection: 0}},
      {name: "every input at its maximum", values: {pB: 1, pIntersection: 1}}
    ],
    size: [400, 270],
    draw: function (api, v) {
      // viz.css paints every svg text ink, which beats the fill attribute; an inline style restores the label colors
      var lab0 = api.label; api.label = function (at, t, o) { var e = lab0(at, t, o); if (o && o.color) e.style.fill = o.color; return e; };
      var c = api.color, k = calc(v), S = 156, top = 48, L = 16, R = 228;
      function square(x0, title) {
        for (var g = 1; g < 10; g++) {
          api.line([x0 + S * g / 10, top], [x0 + S * g / 10, top + S], {color: c.grid, width: 1});
          api.line([x0, top + S * g / 10], [x0 + S, top + S * g / 10], {color: c.grid, width: 1});
        }
        api.label([x0 + S / 2, top - 26], title, {color: c.muted, size: 12, anchor: "middle"});
      }
      // amber region inside a strip of width w (px) whose height share is h (0..1), with its label
      function overlap(x0, w, h, text) {
        if (h <= 0 || w <= 0) return;
        var hh = S * Math.min(1, h);
        api.rect(x0, top, w, hh, {fill: c.c3, fillOpacity: 0.6, stroke: c.c3, width: 1.4, rx: 0});
        var inside = hh >= 20 && w >= 64;
        api.label([x0 + (inside ? w / 2 : 4), inside ? top + hh / 2 : top - 9], text, {color: inside ? c.card : c.c3, size: 12.5, weight: 700, anchor: inside ? "middle" : "start"});
      }
      // left: everything
      square(L, "everything (area 1)");
      if (!k.zeroB) {
        var w = S * v.pB;
        api.rect(L, top, w, S, {fill: c.c2, fillOpacity: 0.22, stroke: c.c2, width: 1.6, rx: 0});
        overlap(L, w, v.pIntersection / v.pB, "A ∩ B " + api.fmt(v.pIntersection));
        if (v.pIntersection === 0) api.label([L + 4, top - 9], "A ∩ B = 0", {color: c.c3, size: 12.5, weight: 700});
        if (k.over) api.rect(L, top, w, S, {fill: "none", stroke: c.c5, width: 2.5, dash: "5 4", rx: 0});
        api.label([L + Math.max(w / 2, 4), top + S + 13], "B " + api.fmt(v.pB), {color: c.c2, size: 12.5, weight: 650, anchor: w / 2 > 26 ? "middle" : "start"});
      }
      api.rect(L, top, S, S, {fill: "none", stroke: c.muted, width: 1.3, rx: 0});
      // the zoom: B becomes the whole square
      api.arrow([L + S + 10, top + S / 2], [R - 10, top + S / 2], {color: c.ink, width: 2, halo: false});
      api.label([(L + S + R) / 2, top + S / 2 - 16], "given B", {color: c.ink, size: 12, anchor: "middle", weight: 600});
      api.label([(L + S + R) / 2, top + S / 2 + 16], "÷ P(B)", {color: c.muted, size: 12, anchor: "middle"});
      // right: inside B
      square(R, "inside B (rescaled to 1)");
      if (k.zeroB) {
        api.rect(R, top, S, S, {fill: "none", stroke: c.c5, width: 2, dash: "5 4", rx: 0});
        api.label([R + S / 2, top + S / 2], "undefined: P(B) = 0", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      } else {
        api.rect(R, top, S, S, {fill: c.c2, fillOpacity: 0.22, stroke: c.c2, width: 1.6, rx: 0});
        overlap(R, S, k.cond, "P(A | B) " + api.fmt(Math.min(k.cond, 99), 3));
        // no overlap leaves no amber to label, so the zero is written along the top edge instead
        if (v.pIntersection === 0) api.label([R + 4, top - 9], "P(A | B) = 0", {color: c.c3, size: 12.5, weight: 700});
        if (k.over) {
          api.rect(R, top, S, S, {fill: "none", stroke: c.c5, width: 2.5, dash: "5 4", rx: 0});
          api.label([R + S / 2, top + S + 13], "share > 1: impossible", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
        } else api.label([R + S / 2, top + S + 13], "B is the whole world now", {color: c.c2, size: 12, anchor: "middle"});
      }
      if (k.over) api.label([L + S / 2, top + S + 32], "A ∩ B can't be bigger than B", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      else if (k.zeroB) api.label([L + S / 2, top + S / 2], "B has probability 0", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      else api.label([200, top + S + 34], "same A ∩ B, measured against B instead of everything", {color: c.muted, size: 12, anchor: "middle"});
    }
  });
})();
