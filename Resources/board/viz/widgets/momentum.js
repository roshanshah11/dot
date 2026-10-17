// Momentum p = mv, and why it matters: it is conserved in a collision. Cart 1 (mass m1) rolls at v into cart 2
// (mass m2) at rest on a frictionless track. Sticky: they couple and share v' = m1·v / (m1 + m2), losing the
// fraction m2 / (m1 + m2) of the kinetic energy. Elastic: v1' = (m1 − m2)/(m1 + m2)·v and v2' = 2m1/(m1 + m2)·v,
// which conserves kinetic energy too. Arrows are drawn to one velocity scale, cart sizes grow with the cube root
// of mass, and the bars add the momenta tip to tail: the totals before and after match.
// Ranges: Dot's 0.1–20 kg and 0–20 m/s instead of the queue's 0.01–10 000. A linear slider over 0.01–10 000 pins the
// everyday values (the 4, 4, 6 defaults) at its far left with ~60 units per pixel, and the framework has no log slider.
// A value passed from outside a range still widens that slider up to 3× its span (about 60), so the queue's minimum
// fixture (0.01 kg) loads as written; numbers switch to powers of ten past a million if a panel ever sends one.
// Dot's addition: the collision type (sticky or elastic), so the same p = mv can show both kinds of collision.
(function () {
  var SUP = {"0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻"};
  function num(x, tex) {
    var a = Math.abs(x);
    if (a === 0) return "0";
    if (a >= 1e6 || a < 1e-3) {
      var e = Math.floor(Math.log10(a)), m = Math.round(x / Math.pow(10, e) * 100) / 100;
      if (Math.abs(m) >= 10) { m /= 10; e++; }
      return tex ? Viz.n(m, 2) + "\\times10^{" + e + "}" : Viz.fmt(m, 2) + " × 10" + String(e).split("").map(function (ch) { return SUP[ch]; }).join("");
    }
    var s = (tex ? Viz.n : Viz.fmt)(x, a >= 1000 ? 0 : a >= 10 ? 2 : a >= 1 ? 3 : 4);
    return a >= 1000 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, tex ? "{,}" : ",") : s;
  }
  function calc(v) {
    var M = v.m1 + v.m2, p = v.m1 * v.v, sticky = v.collision === "sticky";
    var v1 = sticky ? v.m1 * v.v / M : (v.m1 - v.m2) / M * v.v, v2 = sticky ? v1 : 2 * v.m1 / M * v.v;
    return {M: M, p: p, sticky: sticky, v1: v1, v2: v2, p1: v.m1 * v1, p2: v.m2 * v2, keLost: sticky ? v.m2 / M : 0};
  }
  var U = "\\,\\text{kg}\\cdot\\text{m/s}";

  Viz.register("momentum", {
    title: "Momentum in a collision",
    subject: "physics",
    shows: "Set the masses and speed: cart 1 brings momentum m1·v, and after the collision the carts share exactly that much",
    params: {
      m1: {kind: "number", default: 4, min: 0.1, max: 20, step: 0.1, label: "m_1\\,(\\text{kg})"},
      m2: {kind: "number", default: 4, min: 0.1, max: 20, step: 0.1, label: "m_2\\,(\\text{kg})"},
      v: {kind: "number", default: 6, min: 0, max: 20, step: 0.1, label: "v\\,(\\text{m/s})"},
      collision: {kind: "enum", values: ["sticky", "elastic"], default: "sticky", label: "\\text{type}"}
    },
    formula: function (v) {
      var k = calc(v), first = "p=m_1v=" + num(v.m1, true) + "\\times" + num(v.v, true) + "\\\\\\quad=" + num(k.p, true) + U;
      // the worked fraction only when it fits the formula column: its wider part plus the result, about 9 characters
      var frac = Math.max(num(k.p).length, num(k.M).length) + num(k.v1).length > 9 ? "" : "\\dfrac{" + num(k.p, true) + "}{" + num(k.M, true) + "}=";
      if (k.sticky) return "\\begin{array}{l}" + first + "\\\\[6pt]v'=\\dfrac{p}{m_1+m_2}=" + frac + num(k.v1, true) + "\\,\\text{m/s}\\end{array}";
      return "\\begin{array}{l}" + first + "\\\\[4pt]m_1v_1'+m_2v_2'\\\\\\quad=" + num(k.p1, true) + "+" + (k.p2 < 0 ? "(" + num(k.p2, true) + ")" : num(k.p2, true)) + "=" + num(k.p1 + k.p2, true) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), P = "<b>" + num(k.p) + " kg·m/s</b>";
      if (v.v === 0) return "Nothing moves: with v = 0 the total momentum is <b>0</b> before and after.";
      if (k.sticky) return "The carts couple and keep the momentum " + P + ", so they roll on at <b>" + num(k.v1) + " m/s</b>; " +
        (k.keLost > 0.999 ? "over 99.9%" : k.keLost < 0.001 ? "under 0.1%" : Viz.fmt(100 * k.keLost, 1) + "%") + " of the kinetic energy turns to heat and sound.";
      var c1 = Math.abs(k.v1) < 1e-9 * v.v ? "cart 1 stops dead" : k.v1 < 0 ? "cart 1 bounces back at " + num(-k.v1) + " m/s" : "cart 1 follows at " + num(k.v1) + " m/s";
      return "Elastic: momentum " + P + " and kinetic energy are both kept; " + c1 + " and cart 2 leaves at <b>" + num(k.v2) + " m/s</b>.";
    },
    examples: [
      {name: "Minimum supported values", values: {m1: 0.01, m2: 0.01, v: 0}},
      {name: "Maximum supported values", values: {m1: 20, m2: 20, v: 20}},
      {name: "equal carts, elastic: velocities swap", values: {collision: "elastic"}},
      {name: "light cart bounces off a heavy one", values: {m1: 1, m2: 9, v: 5, collision: "elastic"}},
      {name: "heavy cart hits a light one", values: {m1: 20, m2: 0.5, v: 10}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), mmax = Math.max(v.m1, v.m2);
      var side = function (m) { return 16 + 28 * Math.cbrt(m / mmax); }, s1 = side(v.m1), s2 = side(v.m2);
      var vmax = Math.max(v.v, Math.abs(k.v1), Math.abs(k.v2)), L = function (x) { return vmax > 0 ? 82 * x / vmax : 0; };
      var cart = function (cx, ground, s, col, lab) {
        api.rect(cx - s / 2, ground - s, s, s, {fill: col, fillOpacity: 0.85, rx: 3});
        api.label([cx, ground + 13], lab, {color: col, size: 12, weight: 600, anchor: "middle"});
      };
      var vel = function (x0, y, dx, col, lab) {
        if (Math.abs(dx) < 3) { api.label([x0 + 8, y], lab, {color: c.muted, size: 12}); return; }
        api.arrow([x0, y], [x0 + dx, y], {color: col, width: 3, halo: false});
        api.label([x0 + (dx > 0 ? 2 : -2), y - 13], lab, {color: col, size: 12, weight: 650, anchor: dx > 0 ? "start" : "end"});
      };
      // before
      var g1 = 76;
      api.label([8, 14], "before", {color: c.muted, size: 12.5, weight: 650});
      api.line([14, g1], [386, g1], {color: c.axis, width: 1.4});
      cart(62, g1, s1, c.c1, "m₁ = " + num(v.m1) + " kg");
      cart(304, g1, s2, c.c2, "m₂ = " + num(v.m2) + " kg");
      vel(62 + s1 / 2 + 2, g1 - s1 / 2, L(v.v), c.c1, "v = " + num(v.v) + " m/s");
      api.label([304, g1 - s2 - 10], "at rest", {color: c.muted, size: 12, anchor: "middle"});
      // after
      var g2 = 174;
      api.label([8, 114], "after", {color: c.muted, size: 12.5, weight: 650});
      api.line([14, g2], [386, g2], {color: c.axis, width: 1.4});
      if (k.sticky) {
        var cx = 190;
        cart(cx - s1 / 2, g2, s1, c.c1, ""); cart(cx + s2 / 2, g2, s2, c.c2, "");
        api.label([cx, g2 + 13], "coupled, " + num(k.M) + " kg", {color: c.c6, size: 12, weight: 600, anchor: "middle"});
        vel(cx + s2 + 2, g2 - Math.min(s1, s2) / 2, L(k.v1), c.c6, "v′ = " + num(k.v1) + " m/s");
      } else {
        var a1 = 150, a2 = 262;
        cart(a1, g2, s1, c.c1, "cart 1"); cart(a2, g2, s2, c.c2, "cart 2");
        vel(k.v1 < 0 ? a1 - s1 / 2 - 2 : a1 + s1 / 2 + 2, g2 - s1 / 2, L(k.v1), c.c1, Math.abs(k.v1) < 1e-9 * Math.max(v.v, 1e-9) ? "stopped" : "v₁′ = " + num(k.v1) + " m/s");
        vel(a2 + s2 / 2 + 2, g2 - s2 / 2, L(k.v2), c.c2, "v₂′ = " + num(k.v2) + " m/s");
      }
      // momentum, tip to tail
      var lo = k.sticky ? 0 : -1, x0 = k.sticky ? 70 : 60, x1 = 380, P = function (q) { return x0 + (x1 - x0) * (k.p > 0 ? (q / k.p - lo) / (1 - lo) : 0); };
      var yb = 224, ya = 262;
      api.label([8, 202], "momentum (kg·m/s)", {color: c.muted, size: 12});
      api.line([x0, ya + 4], [x1, ya + 4], {color: c.axis, width: 1.2});
      if (k.p > 0) {
        api.label([8, yb], "before", {color: c.muted, size: 12});
        api.rect(P(0), yb - 7, P(k.p) - P(0), 14, {fill: c.c1, fillOpacity: 0.85, rx: 2});
        api.label([8, yb + 24], "after", {color: c.muted, size: 12});
        if (k.sticky) api.rect(P(0), yb + 17, P(k.p) - P(0), 14, {fill: c.c6, fillOpacity: 0.85, rx: 2});
        else {
          api.rect(Math.min(P(0), P(k.p1)), yb + 15, Math.abs(P(k.p1) - P(0)), 8, {fill: c.c1, fillOpacity: 0.85, rx: 2});
          api.rect(Math.min(P(k.p1), P(k.p)), yb + 25, Math.abs(P(k.p) - P(k.p1)), 8, {fill: c.c2, fillOpacity: 0.85, rx: 2});
        }
        api.line([P(0), yb - 14], [P(0), ya + 4], {color: c.faint, width: 1});
        api.line([P(k.p), yb - 14], [P(k.p), ya + 8], {color: c.ink, width: 1.5, dash: "4 3"});
        api.label([P(0), ya + 17], "0", {color: c.muted, size: 12, anchor: "middle"});
        api.label([P(k.p), ya + 17], "total " + num(k.p), {color: c.ink, size: 12, weight: 650, anchor: "middle"});
        if (!k.sticky) api.label([P(-k.p), ya + 17], "−" + num(k.p), {color: c.muted, size: 12, anchor: "middle"});
      } else api.label([200, yb + 14], "p = 0: nothing is moving", {color: c.muted, size: 12.5, anchor: "middle"});
    }
  });
})();
