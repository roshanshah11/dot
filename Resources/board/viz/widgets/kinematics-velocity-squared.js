// v_f^2 = v_i^2 + 2 a dx, read literally as areas: a square of side v_i (blue) gains an L-shaped strip of area 2 a dx
// (amber) and becomes the square of side v_f (teal). Braking (a < 0) cuts a red strip off instead; if the strip is
// bigger than the whole blue square, v_f^2 would be negative: the object stops after v_i^2 / (2|a|) metres and turns
// back before covering dx. The track above shows the same run: start speed, distance, end speed (arrows to scale).
// The queue's only parameter for this id is a chemistry enum (gas-forming / precipitate-forming), a schema mix-up,
// so its fixture is left out; the three inputs here are the formula's own, named like kinematics-velocity's.
(function () {
  var SVG = "http://www.w3.org/2000/svg";
  function calc(v) {
    var vi = v.initialVelocityMetersPerSecond, a = v.accelerationMetersPerSecondSquared, dx = v.displacementMeters;
    var w = 2 * a * dx, vf2 = vi * vi + w;
    return {vi: vi, a: a, dx: dx, w: w, vf2: vf2, vf: vf2 >= 0 ? Math.sqrt(vf2) : null, stop: vf2 < 0 ? vi * vi / (2 * -a) : null};
  }
  // a label with a real subscript (tspan), for v_f, which Unicode has no subscript letter for
  function rich(api, at, parts, o) {
    var t = api.label(at, parts.map(function (p) { return p[0]; }).join(""), Object.assign({raw: true}, o)), dy = 0;
    t.textContent = "";
    parts.forEach(function (p) {
      var ts = document.createElementNS(SVG, "tspan"), want = p[1] ? 3.5 : 0;
      ts.setAttribute("dy", want - dy); dy = want;
      if (p[1]) ts.setAttribute("font-size", 12);
      ts.textContent = p[0]; t.appendChild(ts);
    });
    return t;
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };

  Viz.register("kinematics-velocity-squared", {
    title: "Speed squared over a distance",
    subject: "physics",
    shows: "Slide v_i, a and Δx: speed squared behaves like area, so 2aΔx adds (or cuts) a strip and the new square's side is v_f",
    params: {
      initialVelocityMetersPerSecond: {kind: "number", default: 4, min: 0, max: 20, step: 0.5, label: "v_i\\ (\\text{m/s})"},
      accelerationMetersPerSecondSquared: {kind: "number", default: 2, min: -5, max: 5, step: 0.5, label: "a\\ (\\text{m/s}^2)"},
      displacementMeters: {kind: "number", default: 20, min: 0, max: 50, step: 1, label: "\\Delta x\\ (\\text{m})"}
    },
    formula: function (v) {
      var k = calc(v), head = "\\begin{array}{l}v_f^2=v_i^2+2a\\Delta x\\\\\\quad=" + Viz.n(k.vi) + "^2+2\\cdot" + Viz.p(k.a) + "\\cdot" + Viz.n(k.dx) + "=" + Viz.n(k.vf2) + "\\ \\text{m}^2/\\text{s}^2\\\\";
      return head + (k.vf == null ? "v_f^2<0:\\ \\text{no real } v_f" : "v_f=\\sqrt{" + Viz.n(k.vf2) + "}=" + Viz.n(k.vf) + "\\ \\text{m/s}") + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (k.vf == null) return k.vi === 0 ? "Starting at rest and accelerating backwards, it <b>never moves forward</b>, so it can't cover " + f(k.dx) + " m." :
        "Braking at " + f(-k.a) + " m/s², it stops after <b>" + f(k.stop) + " m</b> and turns back: it never covers the " + f(k.dx) + " m (the final v² would be " + f(k.vf2) + ").";
      if (k.vi === 0 && k.a === 0 && k.dx > 0) return "At rest with no acceleration it <b>never moves</b>, so it never covers the " + f(k.dx) + " m.";
      if (k.dx === 0) return "No distance covered, so v² is unchanged: the speed stays <b>" + f(k.vi) + " m/s</b>.";
      if (k.a === 0) return "No acceleration: v² gains nothing, so the speed stays <b>" + f(k.vi) + " m/s</b> over the " + f(k.dx) + " m.";
      if (k.vf2 === 0) return "Braking at " + f(-k.a) + " m/s² takes all of vᵢ² = " + f(k.vi * k.vi) + " away: it stops <b>exactly at " + f(k.dx) + " m</b>.";
      if (k.a < 0) return "Braking takes 2|a|Δx = <b>" + f(-k.w) + "</b> off v², leaving <b>" + f(k.vf2) + "</b>, so it is still moving at <b>" + f(k.vf) + " m/s</b>.";
      return "Squares add, speeds don't: " + f(k.vi * k.vi) + " + " + f(k.w) + " = " + f(k.vf2) + ", so the speed goes from " + f(k.vi) + " to <b>" + f(k.vf) + " m/s</b>.";
    },
    examples: [
      {name: "every input at its minimum", values: {initialVelocityMetersPerSecond: 0, accelerationMetersPerSecondSquared: -5, displacementMeters: 0}},
      {name: "every input at its maximum", values: {initialVelocityMetersPerSecond: 20, accelerationMetersPerSecondSquared: 5, displacementMeters: 50}},
      {name: "brakes to a stop exactly at the line", values: {initialVelocityMetersPerSecond: 20, accelerationMetersPerSecondSquared: -5, displacementMeters: 40}},
      {name: "stops short and turns back", values: {initialVelocityMetersPerSecond: 8, accelerationMetersPerSecondSquared: -2, displacementMeters: 20}},
      {name: "from rest", values: {initialVelocityMetersPerSecond: 0, accelerationMetersPerSecondSquared: 3, displacementMeters: 24}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), T0 = 34, T1 = 250, yT = 62, AR = 4;
      var X = function (m) { return T0 + (T1 - T0) * m / 50; };
      // track, 0 to 50 m
      api.line([T0 - 10, yT], [T1 + 130, yT], {color: c.axis, width: 1.5});
      for (var m = 0; m <= 50; m += 10) api.line([X(m), yT], [X(m), yT + 4], {color: c.axis, width: 1});
      function car(x, o) {
        api.rect(x - 11, yT - 15, 22, 10, {fill: o.fill, fillOpacity: o.op, stroke: o.fill, rx: 3, width: 1.2});
        api.circle([x - 6, yT - 3], 2.6, {fill: o.fill, fillOpacity: o.op});
        api.circle([x + 6, yT - 3], 2.6, {fill: o.fill, fillOpacity: o.op});
      }
      var xEnd = k.vf == null ? k.stop : k.dx, moved = !(k.vi === 0 && k.a <= 0);
      // displacement bracket under the track
      var bc = k.vf == null ? c.c5 : c.muted;
      api.line([X(0), yT + 12], [X(k.dx), yT + 12], {color: bc, width: 1.5});
      api.line([X(0), yT + 8], [X(0), yT + 16], {color: bc, width: 1.5});
      api.line([X(k.dx), yT + 8], [X(k.dx), yT + 16], {color: bc, width: 1.5});
      api.label([X(k.dx / 2), yT + 25], "Δx = " + f(k.dx) + " m" + (k.vf == null ? ", never reached" : ""), {color: bc, size: 12, anchor: k.dx < 18 ? "start" : "middle"});
      car(X(0), {fill: c.c2, op: 0.25});
      if (k.vi > 0) api.arrow([X(0), yT - 40], [X(0) + AR * k.vi, yT - 40], {color: c.c2, width: 2.5, halo: false});
      rich(api, [X(0) + AR * k.vi + 8, yT - 40], [["v"], ["i", 1], [" = " + f(k.vi) + " m/s"]], {color: c.c2, size: 13, weight: 650});
      if (moved && (xEnd > 0.3 || k.vf != null)) car(X(xEnd), {fill: c.c1, op: 0.85});
      if (k.vf == null) {
        if (moved) {
          api.arrow([X(xEnd) - 4, yT - 24], [X(xEnd) - 30, yT - 24], {color: c.c5, width: 2, halo: false, dash: "4 3"});
          api.label([X(xEnd) + 6, yT - 24], "stops at " + f(k.stop) + " m, turns back", {color: c.c5, size: 12, weight: 600});
        }
      } else if (moved || k.dx === 0) {
        if (k.vf > 0) api.arrow([X(k.dx), yT - 24], [X(k.dx) + AR * k.vf, yT - 24], {color: c.c1, width: 2.5, halo: false});
        var vfp = [["v"], ["f", 1], [" = " + f(k.vf) + " m/s"]], fits = X(k.dx) + AR * k.vf + 8 + (8 + f(k.vf).length) * 7.3 < 396;
        rich(api, fits ? [X(k.dx) + AR * k.vf + 8, yT - 24] : [X(k.dx) - 16, yT - 24], vfp, {color: c.c1, size: 13, weight: 650, anchor: fits ? "start" : "end"});
      }
      // speed squared as area: squares share the bottom-left corner
      var x0 = 34, yb = 288, big = Math.max(k.vi, k.vf || 0), sc = big > 0 ? 176 / big : 0, si = k.vi * sc, sf = (k.vf || 0) * sc;
      var L = function (outer, inner) { return [[x0, yb - outer], [x0 + outer, yb - outer], [x0 + outer, yb], [x0 + inner, yb], [x0 + inner, yb - inner], [x0, yb - inner]]; };
      if (big === 0) api.point([x0, yb], {color: c.muted, r: 4, label: "both speeds 0: no area", labelColor: c.muted, size: 12, dy: -12});
      else if (k.vf != null && k.vf >= k.vi) {
        api.rect(x0, yb - sf, sf, sf, {stroke: c.c1, width: 2, rx: 0});
        if (sf - si > 0.5) api.polygon(L(sf, si), {fill: c.c3, fillOpacity: 0.4});
        if (si > 0) api.rect(x0, yb - si, si, si, {fill: c.c2, fillOpacity: 0.45, stroke: c.c2, rx: 0, width: 1.2});
      } else {
        api.rect(x0, yb - si, si, si, {stroke: c.c2, width: 2, rx: 0});
        api.polygon(L(si, sf), {fill: c.c5, fillOpacity: 0.35});
        if (sf > 0) api.rect(x0, yb - sf, sf, sf, {fill: c.c1, fillOpacity: 0.45, stroke: c.c1, rx: 0, width: 2});
      }
      // the strip's own label, in the corner square of the L where it is widest
      var lo = Math.min(si, sf), hi = Math.max(si, sf);
      if (big > 0 && hi - lo > 34) api.label([x0 + (lo + hi) / 2, yb - (lo + hi) / 2], k.w >= 0 ? "+2aΔx" : "−2|a|Δx", {color: k.w >= 0 ? c.c3 : c.c5, size: 12.5, weight: 650, anchor: "middle"});
      // side lengths on the squares
      if (si > 30) api.label([x0 + si / 2, yb - si + 11], f(k.vi), {color: c.c2, size: 12, weight: 650, anchor: "middle"});
      if (k.vf != null && sf > 30 && Math.abs(sf - si) > 16) api.label([x0 + sf - 6, yb - sf / 2], f(k.vf), {color: c.c1, size: 12, weight: 650, anchor: "end"});
      // the ledger: the same equation in the squares' colors (areas in m²/s²)
      var lx = 236, rx = 392, ry = [148, 176, 204, 240];
      api.label([lx, 120], "speed² as area (m²/s²)", {color: c.muted, size: 12});
      rich(api, [lx, ry[0]], [["v"], ["i", 1], ["²"]], {color: c.c2, size: 14, weight: 650});
      api.label([rx, ry[0]], f(k.vi * k.vi), {color: c.c2, size: 14, weight: 650, anchor: "end"});
      api.label([lx, ry[1]], k.w >= 0 ? "+ 2aΔx" : "− 2|a|Δx", {color: k.w >= 0 ? c.c3 : c.c5, size: 14, weight: 650});
      api.label([rx, ry[1]], (k.w >= 0 ? "+" : "−") + f(Math.abs(k.w)), {color: k.w >= 0 ? c.c3 : c.c5, size: 14, weight: 650, anchor: "end"});
      api.line([lx, ry[1] + 13], [rx, ry[1] + 13], {color: c.faint, width: 1});
      rich(api, [lx, ry[2]], [["= v"], ["f", 1], ["²"]], {color: k.vf == null ? c.c5 : c.c1, size: 14, weight: 650});
      api.label([rx, ry[2]], f(k.vf2), {color: k.vf == null ? c.c5 : c.c1, size: 14, weight: 650, anchor: "end"});
      if (k.vf == null) rich(api, [lx, ry[3]], [["negative: no real v"], ["f", 1]], {color: c.c5, size: 13, weight: 600});
      else rich(api, [lx, ry[3]], [["v"], ["f", 1], [" = √" + f(k.vf2) + " = " + f(k.vf)]], {color: c.c1, size: 13, weight: 650});
    }
  });
})();
