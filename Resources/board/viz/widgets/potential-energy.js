// Gravitational potential energy near a planet's surface: PE = mgh, measured from a chosen reference level (h = 0).
// Left: a block of mass m lifted from the reference level onto a ledge at height h, its weight mg pulling down.
// Right: the same height on the same scale, times the weight along the ground: the rectangle's area, force times
// distance, is the work done lifting it at steady speed, which is the energy it now stores. The height axis runs to the
// next 1-2-5 value above h; the weight axis runs to the next 1-2-5 value above the block's weight on EARTH, whatever the
// planet, so Mars or the Moon visibly narrows the rectangle (and the Earth rectangle stays as a dashed outline).
// The queue allows 0 to 10,000 m and 0.01 to 10,000 kg; a linear slider over that range cannot set 9 m or 3.4 kg,
// so the sliders run 0 to 100 m and 0.1 to 100 kg (Dot can still pass larger values, up to three times those ends).
// Dot's addition: g for Earth, Mars or the Moon, the third factor in mgh.
(function () {
  var G = {Earth: 9.81, Mars: 3.71, Moon: 1.62};
  function nice(x) { // the smallest 1-2-5 value at or above x
    var e = Math.floor(Math.log10(Math.max(x, 1e-9))), best = Infinity;
    [e, e + 1].forEach(function (k) { [1, 2, 5].forEach(function (m) { var w = m * Math.pow(10, k); if (w >= x * (1 - 1e-9) && w < best) best = w; }); });
    return best;
  }
  function joules(x) { return (x >= 1000 ? Math.round(x).toLocaleString("en-US") : Viz.fmt(x, x >= 100 ? 1 : 2)) + "\u00a0J"; }
  function calc(v) { var g = G[v.planet], W = v.mass * g; return {g: g, W: W, E: W * v.height}; }

  Viz.register("potential-energy", {
    title: "Gravitational potential energy",
    subject: "physics",
    shows: "Set the mass, the height and the planet: lifting weight mg through height h stores PE = mgh, the area of a force-times-distance rectangle",
    params: {
      height: {kind: "number", default: 9, min: 0, max: 100, step: 0.5, label: "h\\ (\\text{m})"},
      mass: {kind: "number", default: 3.4, min: 0.1, max: 100, step: 0.1, label: "m\\ (\\text{kg})"},
      planet: {kind: "enum", values: ["Earth", "Mars", "Moon"], default: "Earth", label: "g"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}PE=mgh\\\\[6pt]\\quad=(" + Viz.n(v.mass) + "\\,\\text{kg})(" + Viz.n(k.g) + "\\,\\text{m/s}^2)(" + Viz.n(v.height) + "\\,\\text{m})\\\\[6pt]\\quad=" +
        joules(k.E).replace("\u00a0J", "").replace(/,/g, "{,}") + "\\ \\text{J}\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (v.height === 0) return "At the reference level h = 0 the block stores <b>no</b> potential energy, whatever its mass.";
      return "Lifting " + Viz.fmt(v.mass) + " kg up " + Viz.fmt(v.height) + " m on " + (v.planet === "Moon" ? "the Moon" : v.planet) + " takes <b>" + joules(k.E) +
        "</b> of work (weight " + Viz.fmt(k.W, 2) + " N × " + Viz.fmt(v.height) + " m), which the block now stores.";
    },
    examples: [
      {name: "Minimum supported values", values: {height: 0, mass: 0.1}},
      {name: "Maximum supported values", values: {height: 100, mass: 100}},
      {name: "same lift on the Moon", values: {height: 9, mass: 3.4, planet: "Moon"}},
      {name: "a 60 kg climber up a 25 m wall", values: {height: 25, mass: 60}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), WE = v.mass * G.Earth, base = 258, top = 50, H = nice(Math.max(v.height, 1)), Fm = nice(Math.max(WE, 0.5));
      var Y = function (h) { return base - (base - top) * h / H; }, yh = Y(v.height);
      // height axis, shared by the scene and the rectangle
      var ax = 44;
      api.line([ax, base], [ax, top - 8], {color: c.axis, width: 1.2});
      [0, 0.5, 1].forEach(function (q) {
        api.line([ax - 4, Y(q * H)], [ax, Y(q * H)], {color: c.axis, width: 1});
        if (q) api.label([ax - 7, Y(q * H)], api.fmt(q * H) + " m", {color: c.muted, size: 12, anchor: "end"});   // the ground itself is h = 0
      });
      api.line([ax, base], [api.w - 12, base], {color: c.ink, width: 1.6});
      api.label([30, base + 30], "h = 0: reference level", {color: c.muted, size: 12});
      // the scene: a shelf on a post, the block on it, where it started (dashed), its weight
      var s = 12 + 22 * (Math.log10(v.mass) + 1) / 3, bx = 64;
      if (v.height > 0) {
        api.line([56, yh], [130, yh], {color: c.muted, width: 2.5});
        api.line([124, yh], [124, base], {color: c.muted, width: 2});
        api.rect(bx, base - s, s, s, {fill: "none", stroke: c.faint, width: 1.2, dash: "3 3", rx: 2});
        api.label([bx + s / 2, base + 13], "start", {color: c.muted, size: 12, anchor: "middle"});   // under the ground line, clear of the post
      }
      api.rect(bx, yh - s, s, s, {fill: c.c3, fillOpacity: 0.85, stroke: c.c3, width: 1.2, rx: 2});
      if (v.height > 0) api.label([bx + s + 6, yh - s - 4], api.fmt(v.mass) + " kg", {color: c.c3, size: 12.5, weight: 650});
      else api.label([bx, base - Math.max(s, 30) - 12], api.fmt(v.mass) + " kg", {color: c.c3, size: 12.5, weight: 650});
      // the weight: from the block's bottom edge down, under the shelf and above where it started; on the ground (h = 0)
      // it hangs beside the block instead. Its length follows mg on the same Earth-based scale as the weight axis.
      var aw = 16 + 40 * k.W / Fm, wx = bx + s / 2;
      if (v.height > 0) {
        aw = Math.min(aw, base - s - 6 - (yh + 3));
        api.arrow([wx, yh + 3], [wx, yh + 3 + aw], {color: c.c5, width: 2.5, halo: false});
        api.label([wx + 7, yh + 3 + aw / 2 + 2], "mg", {color: c.c5, size: 12.5, weight: 650});
      } else {
        var wy0 = base - Math.max(s, 30), ax2 = bx + s + 12;
        api.arrow([ax2, wy0], [ax2, wy0 + Math.min(aw, base - 2 - wy0)], {color: c.c5, width: 2.5, halo: false});
        api.label([ax2 + 7, wy0 + 10], "mg", {color: c.c5, size: 12.5, weight: 650});
      }
      if (v.height > 0) {
        api.line([142, base], [142, yh], {color: c.c2, width: 2, arrow: true, arrowStart: true});
        api.label([148, (base + yh) / 2], "h", {color: c.c2, size: 13, weight: 700});
      }
      // force times distance: weight along the ground, height up
      var rx0 = 178, rw = 196, X = function (f) { return rx0 + rw * f / Fm; };
      [0, 0.5, 1].forEach(function (q) {
        api.line([X(q * Fm), base], [X(q * Fm), base + 4], {color: c.axis, width: 1});
        api.label([X(q * Fm), base + 14], api.fmt(q * Fm) + (q === 1 ? " N" : ""), {color: c.muted, size: 12, anchor: "middle"});
      });
      api.label([api.w - 12, base + 30], "weight mg", {color: c.muted, size: 12, anchor: "end"});
      var wpx = X(k.W) - rx0;
      if (v.height > 0) {
        api.line([132, yh], [rx0, yh], {color: c.faint, width: 1, dash: "3 4"});
        if (v.planet !== "Earth") {   // the same lift on Earth, for comparison
          var ewx = X(WE) - rx0, ej = joules(WE * v.height), ew = Math.max(8, ej.length) * 12 * 0.58, fit = ewx - wpx > ew + 12;
          api.rect(rx0, yh, ewx, base - yh, {fill: "none", stroke: c.muted, width: 1.2, dash: "5 4", rx: 0});
          api.label([fit ? X(WE) - 6 : X(WE) + 6, base - 27], "on Earth", {color: c.muted, size: 12, anchor: fit ? "end" : "start"});
          api.label([fit ? X(WE) - 6 : X(WE) + 6, base - 12], ej, {color: c.muted, size: 12, anchor: fit ? "end" : "start"});
        }
        api.rect(rx0, yh, wpx, base - yh, {fill: c.c1, fillOpacity: 0.25, stroke: c.c1, width: 1.5, rx: 0});
      } else {   // no height: the rectangle collapses to a strip of zero area
        api.rect(rx0, base - 4, wpx, 4, {fill: c.c1, fillOpacity: 0.25, stroke: c.c1, width: 1.2, dash: "3 3", rx: 0});
      }
      api.line([rx0, base + 1], [X(k.W), base + 1], {color: c.c5, width: 3});
      api.line([rx0, base], [rx0, yh], {color: c.c2, width: 3});
      var inside = wpx > 120 && base - yh > 44, lab = "PE = " + joules(k.E);
      if (v.height === 0) {
        api.label([rx0 + 2, base - 20], "no height, no area: PE = 0", {color: c.c1, size: 13.5, weight: 750});
      } else if (inside) {
        api.label([rx0 + wpx / 2, (base + yh) / 2 - 8], lab, {color: c.c1, size: 14, weight: 750, anchor: "middle"});
        api.label([rx0 + wpx / 2, (base + yh) / 2 + 10], api.fmt(k.W, 2) + " N × " + api.fmt(v.height) + " m", {color: c.c1, size: 12, anchor: "middle"});
      } else {
        if (v.planet === "Earth") api.label([X(k.W) + 8, yh + 14], lab, {color: c.c1, size: 13.5, weight: 750});
        else api.label([rx0, yh - 10], lab, {color: c.c1, size: 13.5, weight: 750});   // above the narrow rectangle, clear of the Earth outline
      }
      api.label([api.w - 12, 22], "g = " + api.fmt(k.g) + " m/s² (" + v.planet + ")", {color: c.muted, size: 12, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
