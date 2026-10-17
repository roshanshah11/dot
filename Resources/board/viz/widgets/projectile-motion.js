// Projectile motion over level ground, launched from the ground, g = 9.81 m/s^2, no air resistance. The launch
// velocity splits into v0 cos(theta), which never changes, and v0 sin(theta), which gravity removes at g per second
// (inset, top right; the arrow is always drawn the same length, the numbers carry the speed). The path is drawn on equal-scale axes with a dot every 0.25 s: the dots are evenly spaced across
// because the horizontal speed is constant. Marked: the apex H, where only v0 cos(theta) is left, the range R and the
// flight time T. Dashed: the complementary launch at 90 - theta, which lands at the same R because
// sin 2 theta = sin(180 - 2 theta). The axes run to the first of 20, 30, 40, 50 or 66 m that holds the 45-degree range
// v0^2/g, so angles compare on fixed axes, a faster launch visibly flies farther, and the slowest one is not a speck.
(function () {
  var G = 9.81, OX = 40, OY = 232, PW = 348;
  function calc(v) {
    var th = v.launchAngleDegrees * Math.PI / 180, u = v.initialSpeedMetersPerSecond, vx = u * Math.cos(th), vy = u * Math.sin(th);
    return {th: th, u: u, vx: vx, vy: vy, T: 2 * vy / G, H: vy * vy / (2 * G), R: u * u * Math.sin(2 * th) / G, Rmax: u * u / G};
  }

  Viz.register("projectile-motion", {
    title: "Projectile motion",
    subject: "physics",
    shows: "Set the launch speed and angle: the horizontal speed stays fixed while gravity takes 9.81 m/s off the vertical speed every second, so the path is a parabola",
    params: {
      initialSpeedMetersPerSecond: {kind: "number", default: 18, min: 12, max: 25, step: 0.5, label: "v_0\\ (\\text{m/s})"},
      launchAngleDegrees: {kind: "number", default: 45, min: 25, max: 65, step: 1, label: "\\theta\\ (^\\circ)"}
    },
    formula: function (v) {
      var k = calc(v), u = Viz.n(k.u), d = Viz.n(v.launchAngleDegrees) + "^\\circ";
      return "\\begin{array}{l}v_x=v_0\\cos\\theta=" + u + "\\cos" + d + "=" + Viz.n(k.vx) + "\\\\[3pt]" +
        "v_y=v_0\\sin\\theta=" + u + "\\sin" + d + "=" + Viz.n(k.vy) + "\\\\[3pt]" +
        "T=\\tfrac{2v_y}{g}=" + Viz.n(k.T) + "\\ \\text{s}\\\\[3pt]H=\\tfrac{v_y^2}{2g}=" + Viz.n(k.H) + "\\ \\text{m}\\\\[3pt]" +
        "R=v_x\\,T=\\tfrac{v_0^2\\sin2\\theta}{g}=" + Viz.n(k.R, 1) + "\\ \\text{m}\\end{array}";
    },
    status: function (v) {
      var k = calc(v), a = v.launchAngleDegrees, head = "In the air <b>" + Viz.fmt(k.T) + " s</b>, peaking at " + Viz.fmt(k.H) + " m and landing <b>" + Viz.fmt(k.R, 1) + " m</b> away";
      if (a === 45) return head + ": 45° is the farthest any angle reaches at " + Viz.fmt(k.u) + " m/s.";
      return head + "; " + (90 - a) + "° would land at the same spot, and 45° would reach " + Viz.fmt(k.Rmax, 1) + " m.";
    },
    examples: [
      {name: "Minimum supported values", values: {initialSpeedMetersPerSecond: 12, launchAngleDegrees: 25}},
      {name: "Maximum supported values", values: {initialSpeedMetersPerSecond: 25, launchAngleDegrees: 65}},
      {name: "45 degrees: the longest range", values: {initialSpeedMetersPerSecond: 20, launchAngleDegrees: 45}},
      {name: "30 and 60 degrees land together", values: {initialSpeedMetersPerSecond: 20, launchAngleDegrees: 30}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, k = calc(v), a = v.launchAngleDegrees;
      var halo = function (e) { e.setAttribute("stroke", c.card); e.setAttribute("stroke-width", 3.5); e.setAttribute("paint-order", "stroke"); e.setAttribute("stroke-linejoin", "round"); return e; };
      var E = [20, 30, 40, 50, 66].filter(function (e) { return e >= 1.04 * k.Rmax; })[0] || 66, SC = PW / E, step = E <= 30 ? 5 : 10;
      var X = function (m) { return OX + SC * m; }, Y = function (m) { return OY - SC * m; };
      function path(th) {
        var vx = k.u * Math.cos(th), vy = k.u * Math.sin(th), T = 2 * vy / G, pts = [];
        for (var i = 0; i <= 80; i++) { var t = T * i / 80; pts.push([X(vx * t), Y(vy * t - G * t * t / 2)]); }
        return pts;
      }
      // axes: ground and height, equal scale
      var Ey = 0.42 * E;
      api.line([OX - 6, OY], [X(E) + 4, OY], {color: c.axis, width: 1.3});
      api.line([OX, OY + 4], [OX, Y(Ey) - 4], {color: c.axis, width: 1.2});
      for (var m = step; m <= E + 1e-9; m += step) {
        api.line([X(m), OY], [X(m), OY + 4], {color: c.axis, width: 1});
        if (E - m > step * 0.45) api.label([X(m), OY + 14], String(m), {color: c.muted, size: 12, anchor: "middle"});
      }
      for (var h = step; h <= Ey; h += step) {
        api.line([OX - 4, Y(h)], [OX, Y(h)], {color: c.axis, width: 1});
        api.line([OX, Y(h)], [X(E), Y(h)], {color: c.grid, width: 1});
        api.label([OX - 7, Y(h)], String(h), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([OX - 8, Y(Ey) - 14], "height (m)", {color: c.muted, size: 12});   // above the axis top, clear of every gridline
      api.label([X(E) + 4, OY + 14], "m", {color: c.muted, size: 12, anchor: "end"});
      // the complementary launch, same range; its name sits over its apex when it is the higher arc (lifted clear of the
      // v0 cos theta label near 45 degrees) and under its apex when it is the lower one
      var ax = X(k.R / 2), ay = Y(k.H), aw = 1.8 * k.vx, cy = null;
      if (a !== 45) {
        var cp = path((90 - a) * Math.PI / 180), top = cp[40], higher = 90 - a > a;
        cy = higher ? Math.min(top[1] - 12, ay - 28) : top[1] + 14;
        api.polyline(cp, {stroke: c.faint, width: 1.5, dash: "5 5"});
        halo(api.label([top[0], cy], (90 - a) + "°: same R", {color: c.muted, size: 12, anchor: "middle"}));
      }
      // the path, with a dot every 0.25 s
      api.polyline(path(k.th), {stroke: c.c2, width: 2.5});
      for (var t = 0.25; t < k.T - 0.05; t += 0.25) api.circle([X(k.vx * t), Y(k.vy * t - G * t * t / 2)], 2.6, {fill: c.c2, fillOpacity: 0.95});
      // apex: height H, only the horizontal velocity left
      api.line([ax, ay + 4], [ax, OY], {color: c.c6, width: 1.4, dash: "4 4"});
      var low = OY - ay < 40, yH = (ay + OY) / 2 + (a < 45 ? 0 : 10);   // a low arch has no room beside the line: name H above the apex instead
      if (a > 45 && Math.abs(yH - cy) < 16) yH = cy + 17 <= OY - 9 ? cy + 17 : cy - 17;   // step past the lower arc's name
      halo(api.label(low ? [ax - 8, ay - 14] : [ax + 6, yH], "H = " + api.fmt(k.H) + " m",
        {color: c.c6, size: 12.5, weight: 650, anchor: low ? "end" : "start"}));
      api.arrow([ax, ay], [ax + aw, ay], {color: c.c3, width: 2.5, halo: false});
      halo(api.label([ax + 2, ay - 12], "v₀ cos θ", {color: c.c3, size: 12, weight: 650}));   // above the arrow, over the falling path
      // launch angle, range and time of flight
      var ra = 22, arc = [];
      for (var i = 0; i <= 20; i++) { var q = k.th * i / 20; arc.push([OX + ra * Math.cos(q), OY - ra * Math.sin(q)]); }
      api.polyline(arc, {stroke: c.c1, width: 2});
      halo(api.label([OX + 30 * Math.cos(k.th / 2) + 2, OY - 30 * Math.sin(k.th / 2)], a + "°", {color: c.c1, size: 12.5, weight: 650}));
      var yr = OY + 30;
      api.line([X(0), yr], [X(k.R), yr], {color: c.c4, width: 2.5});
      [0, k.R].forEach(function (m) { api.line([X(m), yr - 5], [X(m), yr + 5], {color: c.c4, width: 2}); });
      api.label([X(k.R / 2), yr + 13], "R = " + api.fmt(k.R, 1) + " m", {color: c.c4, size: 12.5, weight: 650, anchor: "middle"});
      api.point([X(k.R), OY], {color: c.c2, r: 4.5});
      // flight time beside the landing point; when a long range leaves no room to the right, under the end of the R bar
      var tt = "T = " + api.fmt(k.T) + " s", room = X(k.R) + 6 + tt.length * 6.2 <= api.w - 2;
      api.label(room ? [X(k.R) + 6, OY - 12] : [X(k.R) - 8, yr + 13], tt, {color: c.c2, size: 12.5, weight: 650, anchor: room ? "start" : "end", clamp: !room});
      // inset: the launch velocity and its two parts
      var ix = 240, iy = 62, s = 50 / k.u, tip = [ix + s * k.vx, iy - s * k.vy], my = iy - s * k.vy / 2;
      api.line([ix, iy], [tip[0], iy], {color: c.c3, width: 2, dash: "4 3"});
      api.line([tip[0], iy], tip, {color: c.c5, width: 2, dash: "4 3"});
      api.arrow([ix, iy], tip, {color: c.c1, width: 2.5, halo: false});
      api.label([ix - 4, iy - 26], "v₀ = " + api.fmt(k.u) + " m/s", {color: c.c1, size: 12, weight: 650, anchor: "end"});
      api.label([ix + s * k.vx / 2, iy + 12], api.fmt(k.vx, 1) + " m/s", {color: c.c3, size: 12, anchor: "middle"});
      api.label([tip[0] + 6, my - 14], "v₀ sin θ", {color: c.c5, size: 12, weight: 650});
      api.label([tip[0] + 6, my], "= " + api.fmt(k.vy, 1) + " m/s", {color: c.c5, size: 12});
      api.label([tip[0] + 6, my + 14], "−9.81 m/s each s", {color: c.muted, size: 12});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
