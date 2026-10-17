// Two carts on a frictionless track, cart 1 on the left. They meet only if cart 1 is moving right faster than cart 2
// (v1 > v2); otherwise nothing happens. Elastic: both momentum and kinetic energy are conserved, giving
// v1f = ((m1 − m2)v1 + 2m2v2)/(m1 + m2) and v2f = ((m2 − m1)v2 + 2m1v1)/(m1 + m2). Perfectly inelastic: the carts lock
// and share vf = (m1v1 + m2v2)/(m1 + m2); momentum is kept and the lost kinetic energy is ½·m1m2/(m1 + m2)·(v1 − v2)².
// Top: before and after, velocity arrows on one shared scale. Bottom: momentum bars (signed, per cart and total) and
// kinetic energy bars (stacked), before and after. Masses are Dot's addition: the queue gives only the two velocities
// and the collision type, and the masses are what make the outcome interesting (equal masses just swap velocities).
(function () {
  function calc(v) {
    var m1 = v.cartAMassKg, m2 = v.cartBMassKg, u1 = v.cartAInitialVelocityMps, u2 = v.cartBInitialVelocityMps, M = m1 + m2;
    var hit = u1 > u2 + 1e-9, el = v.collisionType === "elastic", w1 = u1, w2 = u2;
    if (hit && el) { w1 = ((m1 - m2) * u1 + 2 * m2 * u2) / M; w2 = ((m2 - m1) * u2 + 2 * m1 * u1) / M; }
    else if (hit) { w1 = w2 = (m1 * u1 + m2 * u2) / M; }
    var ke = function (m, s) { return 0.5 * m * s * s; };
    return {m1: m1, m2: m2, u1: u1, u2: u2, w1: w1, w2: w2, hit: hit, el: el, p: m1 * u1 + m2 * u2, pf: m1 * w1 + m2 * w2,
            k1: ke(m1, u1), k2: ke(m2, u2), k1f: ke(m1, w1), k2f: ke(m2, w2)};
  }
  var f = function (x, d) { return Viz.fmt(Math.abs(x) < 5e-4 ? 0 : x, d == null ? 2 : d); };

  Viz.register("collision-simulation", {
    title: "Cart collisions: momentum and energy",
    subject: "physics",
    shows: "Set the carts' velocities and masses: total momentum survives every collision, kinetic energy only an elastic one",
    params: {
      cartAInitialVelocityMps: {kind: "number", default: 2, min: -3, max: 3, step: 0.1, label: "v_{1,i}"},
      cartBInitialVelocityMps: {kind: "number", default: -0.5, min: -3, max: 3, step: 0.1, label: "v_{2,i}"},
      collisionType: {kind: "enum", values: ["elastic", "perfectlyInelastic"], default: "elastic", label: "\\text{type}",
                      names: {elastic: "elastic", perfectlyInelastic: "perfectly inelastic"}},
      cartAMassKg: {kind: "number", default: 1, min: 0.5, max: 4, step: 0.5, label: "m_1"},
      cartBMassKg: {kind: "number", default: 1.5, min: 0.5, max: 4, step: 0.5, label: "m_2"}
    },
    formula: function (v) {
      var k = calc(v), z = function (x) { return Math.abs(x) < 5e-4 ? 0 : x; };
      var side = function (a, b) { return Viz.n(k.m1) + "(" + Viz.n(z(a)) + ")+" + Viz.n(k.m2) + "(" + Viz.n(z(b)) + ")=" + Viz.n(z(k.m1 * a + k.m2 * b)); };
      return "\\begin{array}{l}m_1v_{1,i}+m_2v_{2,i}=m_1v_{1,f}+m_2v_{2,f}\\\\\\text{before: }" + side(k.u1, k.u2) +
        "\\\\\\text{after: }" + side(k.w1, k.w2) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (!k.hit) return "v₁ ≤ v₂, so cart 1 never catches cart 2: <b>no collision</b>, and both carts keep their velocities.";
      if (k.el) {
        var swap = k.m1 === k.m2 ? " (equal masses simply swap velocities)" : "";
        return "Elastic: momentum stays <b>" + f(k.p) + " kg·m/s</b> and kinetic energy stays <b>" + f(k.k1 + k.k2) + " J</b>; cart 1 leaves at <b>" +
          f(k.w1) + " m/s</b>, cart 2 at <b>" + f(k.w2) + " m/s</b>" + swap + ".";
      }
      var lost = k.k1 + k.k2 - k.k1f - k.k2f, share = lost / (k.k1 + k.k2);
      return "Perfectly inelastic: the carts lock together at <b>" + f(k.w1) + " m/s</b>; momentum is kept, but <b>" + f(lost) + " J</b> of " +
        f(k.k1 + k.k2) + " J of kinetic energy (" + Viz.pct(share, share > 0.995 && share < 1 - 1e-9 ? 1 : 0) + ") turns into heat, sound and dents.";
    },
    examples: [
      {name: "equal masses swap velocities", values: {cartAInitialVelocityMps: 2, cartBInitialVelocityMps: 0, collisionType: "elastic", cartAMassKg: 1, cartBMassKg: 1}},
      {name: "lock together, all energy lost", values: {cartAInitialVelocityMps: 2, cartBInitialVelocityMps: -2, collisionType: "perfectlyInelastic", cartAMassKg: 2, cartBMassKg: 2}},
      {name: "heavy cart hits a light one", values: {cartAInitialVelocityMps: 3, cartBInitialVelocityMps: -3, collisionType: "elastic", cartAMassKg: 4, cartBMassKg: 0.5}},
      {name: "no collision", values: {cartAInitialVelocityMps: -1, cartBInitialVelocityMps: 2}},
      {name: "every input at its minimum", values: {cartAInitialVelocityMps: -3, cartBInitialVelocityMps: -3, collisionType: "elastic", cartAMassKg: 0.5, cartBMassKg: 0.5}},
      {name: "every input at its maximum", values: {cartAInitialVelocityMps: 3, cartBInitialVelocityMps: 3, collisionType: "perfectlyInelastic", cartAMassKg: 4, cartBMassKg: 4}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      // viz.css paints every svg text ink, which beats the fill attribute; an inline style restores the label colors
      var lab0 = api.label; api.label = function (at, t, o) { var e = lab0(at, t, o); if (o && o.color) e.style.fill = o.color; return e; };
      var c = api.color, k = calc(v), col = [c.c1, c.c3];
      var vmax = Math.max(1, Math.abs(k.u1), Math.abs(k.u2), Math.abs(k.w1), Math.abs(k.w2)), vs = Math.min(22, 74 / vmax);
      var cw = function (m) { return 40 + 9 * m; };  // wide enough for a "0.5 kg" label at the lightest mass
      function cart(cx, ty, m, color, name) {
        var w = cw(m);
        api.rect(cx - w / 2, ty - 30, w, 24, {fill: color, fillOpacity: 0.3, stroke: color, width: 1.6, rx: 4});
        api.circle([cx - w / 2 + 9, ty - 3.5], 3.5, {fill: c.muted}); api.circle([cx + w / 2 - 9, ty - 3.5], 3.5, {fill: c.muted});
        api.label([cx, ty - 18], api.fmt(m) + " kg", {color: c.ink, size: 12, anchor: "middle", weight: 600, clamp: false});
        api.label([cx, ty + 12], "cart " + name, {color: color, size: 12, anchor: "middle"});
      }
      function vel(cx, ty, s, color, lift) {
        var y = ty - 40 - (lift || 0);
        if (Math.abs(s) < 0.05) { api.label([cx, y], "at rest", {color: color, size: 12, anchor: "middle"}); return; }
        api.arrow([cx, y], [cx + s * vs, y], {color: color, width: 2.6, halo: false});
        api.label([cx + s * vs / 2, y - 12], f(s) + " m/s", {color: color, size: 12, weight: 650, anchor: "middle"});
      }
      function track(ty, name) {
        api.line([12, ty], [388, ty], {color: c.axis, width: 1.4});
        api.label([12, ty - 66], name, {color: c.muted, size: 12});
      }
      // before: carts apart, cart 1 on the left
      var t1 = 86, t2 = 172;
      track(t1, "before");
      cart(108, t1, k.m1, col[0], "1"); cart(292, t1, k.m2, col[1], "2");
      vel(108, t1, k.u1, col[0]); vel(292, t1, k.u2, col[1]);
      // after
      track(t2, "after");
      if (!k.hit) {
        cart(108, t2, k.m1, col[0], "1"); cart(292, t2, k.m2, col[1], "2");
        vel(108, t2, k.w1, col[0]); vel(292, t2, k.w2, col[1]);
        api.label([200, t2 - 18], "never meet", {color: c.muted, size: 12, anchor: "middle"});
      } else if (k.el) {
        // just after the bounce: the carts still almost touch at the contact point, marked by a short tick
        var e1 = 200 - 6 - cw(k.m1) / 2, e2 = 200 + 6 + cw(k.m2) / 2;
        api.line([200, t2 - 34], [200, t2 - 2], {color: c.muted, width: 1.4});
        cart(e1, t2, k.m1, col[0], "1"); cart(e2, t2, k.m2, col[1], "2");
        vel(e1, t2, k.w1, col[0]); vel(e2, t2, k.w2, col[1]);
      } else {
        // locked pair centred on the track: cart 1's right face touches cart 2's left face
        var a = cw(k.m1), b = cw(k.m2);
        cart(200 - b / 2 - 1, t2, k.m1, col[0], "1"); cart(200 + a / 2 + 1, t2, k.m2, col[1], "2");
        api.rect(200 - (a + b) / 2 - 5, t2 - 34, a + b + 10, 34, {fill: "none", stroke: c.ink, width: 1.2, dash: "4 3", rx: 6});
        api.label([200 + (a + b) / 2 + 9, t2 - 18], "locked", {color: c.muted, size: 12});
        vel(200, t2, k.w1, c.ink, 2);
      }
      // momentum: per cart and the total Σ (purple, outlined), before and after, on one signed scale. A faint purple
      // level line behind the bars joins the two totals, so "conserved" reads as two equal bars.
      var top = 216, base0 = 263, half = 40, pmax = Math.max(0.5, Math.abs(k.m1 * k.u1), Math.abs(k.m2 * k.u2), Math.abs(k.m1 * k.w1), Math.abs(k.m2 * k.w2), Math.abs(k.p));
      var groups = [["before", 54, [k.m1 * k.u1, k.m2 * k.u2, k.p]], ["after", 148, [k.m1 * k.w1, k.m2 * k.w2, k.pf]]];
      api.label([14, top - 6], "momentum (kg·m/s)", {color: c.muted, size: 12});
      if (Math.abs(half * k.p / pmax) >= 1) api.line([groups[0][1] + 28, base0 - half * k.p / pmax], [groups[1][1] + 12, base0 - half * k.pf / pmax], {color: c.c6, width: 1.2, dash: "3 3", opacity: 0.7});
      api.line([14, base0], [200, base0], {color: c.axis, width: 1.2});
      groups.forEach(function (g) {
        g[2].forEach(function (val, i) {
          var hgt = half * val / pmax, x = g[1] - 30 + i * 21, tot = i === 2, color = tot ? c.c6 : col[i];
          if (tot && Math.abs(hgt) < 1) api.line([x, base0], [x + 16, base0], {color: c.c6, width: 2.6});
          else api.rect(x, Math.min(base0, base0 - hgt), 16, Math.abs(hgt), tot ? {fill: c.c6, fillOpacity: 0.3, stroke: c.c6, width: 1.8, rx: 2} : {fill: color, fillOpacity: 0.85, rx: 2});
          api.label([x + 8, base0 + half + 11], ["1", "2", "Σ"][i], {color: color, size: 12, anchor: "middle", weight: 650});
        });
        api.label([g[1] - 3, 330], g[0], {color: c.ink, size: 12, anchor: "end"});
        api.label([g[1] + 3, 330], "Σ " + f(g[2][2]), {color: c.c6, size: 12, anchor: "start", weight: 650});
      });
      // kinetic energy: stacked, before and after; the lost part is a dashed outline
      var kmax = Math.max(0.5, k.k1 + k.k2), kb = 312, kh = 76, X = [272, 348];
      api.label([226, top - 6], "kinetic energy (J)", {color: c.muted, size: 12});
      api.line([226, kb], [392, kb], {color: c.axis, width: 1.2});
      [[k.k1, k.k2], [k.k1f, k.k2f]].forEach(function (pair, j) {
        var h1 = kh * pair[0] / kmax, h2 = kh * pair[1] / kmax;
        api.rect(X[j] - 16, kb - h1, 32, h1, {fill: col[0], fillOpacity: 0.85, rx: 0});
        api.rect(X[j] - 16, kb - h1 - h2, 32, h2, {fill: col[1], fillOpacity: 0.85, rx: 0});
        api.label([X[j], kb - h1 - h2 - 9], f(pair[0] + pair[1]), {color: c.ink, size: 12, weight: 650, anchor: "middle"});
        api.label([X[j], kb + 13], j ? "after" : "before", {color: c.muted, size: 12, anchor: "middle"});
      });
      var lost = k.k1 + k.k2 - k.k1f - k.k2f;
      if (lost > 1e-6) {
        var hl = kh * lost / kmax, ya = kb - kh * (k.k1f + k.k2f) / kmax;
        api.rect(X[1] - 16, ya - hl, 32, hl, {fill: c.c5, fillOpacity: 0.12, stroke: c.c5, width: 1.3, dash: "4 3", rx: 0});
        api.label([X[1] + 21, ya - hl / 2], "lost", {color: c.c5, size: 12, weight: 650});
      }
    }
  });
})();
