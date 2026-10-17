// Distance traveled vs displacement on a map with 20 m grid squares. Distance adds up the length of every leg walked
// (a scalar, never decreasing); displacement is the single arrow from the start to where you are now (a vector, whose
// size can shrink, even to zero on a round trip). Scrub the trip, or drag the walker along the route, and compare the
// two bars on one scale. Routes: straight to B (80 m east, 60 m north), along the streets to B (80 m east then 60 m
// north) and once around the block back to the start. Queue param: route (kept); progress is Dot's own.
(function () {
  var ROUTES = {
    direct: [[0, 0], [80, 60]],
    detour: [[0, 0], [80, 0], [80, 60]],
    round_trip: [[0, 0], [80, 0], [80, 60], [0, 60], [0, 0]]
  };
  function legs(pts) { var out = []; for (var i = 1; i < pts.length; i++) out.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return out; }
  function calc(v) {
    var pts = ROUTES[v.route], L = legs(pts), total = L.reduce(function (a, b) { return a + b; }, 0), d = total * v.progress / 100;
    var walked = [pts[0]], parts = [], left = d;
    for (var i = 0; i < L.length && left > 1e-9; i++) {
      var t = Math.min(1, left / L[i]), a = pts[i], b = pts[i + 1];
      walked.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); parts.push(Math.min(left, L[i])); left -= L[i];
    }
    var P = walked[walked.length - 1], dx = P[0] - pts[0][0], dy = P[1] - pts[0][1], r = Math.hypot(dx, dy);
    return {pts: pts, total: total, d: d, walked: walked, parts: parts, P: P, dx: dx, dy: dy, r: r};
  }
  var m = function (x) { return Viz.fmt(x, 1) + " m"; };
  function heading(k) {
    if (k.r < 0.05) return "";
    if (Math.abs(k.dx) < 0.05) return "due north";
    if (Math.abs(k.dy) < 0.05) return "due east";
    return Viz.fmt(Math.atan2(k.dy, k.dx) * 180 / Math.PI, 0) + "° north of east";
  }

  Viz.register("distance-traveled-vs-displacement", {
    title: "Distance traveled vs displacement",
    subject: "physics",
    shows: "Pick a route and scrub the trip: distance adds up every leg you walk, displacement is only the straight arrow from start to where you are, so a round trip ends with distance 280 m and displacement 0",
    params: {
      route: {kind: "enum", values: ["direct", "detour", "round_trip"], default: "detour", label: "\\text{route}", names: {round_trip: "round trip"}},
      progress: {kind: "number", default: 100, min: 0, max: 100, step: 1, label: "\\%\\ \\text{done}"}
    },
    formula: function (v) {
      var k = calc(v), sum = k.parts.length ? k.parts.map(function (x) { return Viz.n(x, 1); }).join("+") : "0";
      var gap = "\\phantom{|\\Delta\\vec r|}";
      return "\\begin{array}{l}d=\\textstyle\\sum|\\Delta s_i|\\\\" + gap + "=" + (k.parts.length > 1 ? sum + "=" : "") + Viz.n(k.d, 1) + "\\ \\text{m}\\\\" +
        "|\\Delta\\vec r|=\\sqrt{\\Delta x^2+\\Delta y^2}\\\\" + gap + "=\\sqrt{" + Viz.n(k.dx, 1) + "^2+" + Viz.n(k.dy, 1) + "^2}=" + Viz.n(k.r, 1) + "\\ \\text{m}\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (k.d < 0.05) return "Not moving yet: distance and displacement are both <b>0</b>.";
      if (k.r < 0.05) return "Back at the start: you walked <b>" + m(k.d) + "</b>, but your displacement is <b>0</b>, because it only compares where you end with where you began.";
      if (k.d - k.r < 0.05) return "So far the path is one straight line, so distance and the size of the displacement agree: <b>" + m(k.d) + "</b> (" + heading(k) + ").";
      return "You have walked <b>" + m(k.d) + "</b> but are only <b>" + m(k.r) + "</b> from the start, " + heading(k) + ": distance counts every step, displacement just start to finish.";
    },
    examples: [
      {name: "route: direct", values: {route: "direct"}},
      {name: "route: round_trip", values: {route: "round_trip"}},
      {name: "round trip, halfway", values: {route: "round_trip", progress: 50}},
      {name: "progress at its minimum", values: {progress: 0}},
      {name: "detour, first leg only", values: {route: "detour", progress: 50}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v);
      var pl = api.plane({x: [-8, 92], y: [-10, 70], box: [8, 4, 264, 212], step: 20, axes: false});
      // the whole route, faint, then the part walked so far, leg by leg
      api.polyline(k.pts.map(pl.px), {stroke: c.muted, width: 2, dash: "5 5", opacity: 0.7});
      for (var i = 1; i < k.walked.length; i++) {
        var a = pl.px(k.walked[i - 1]), b = pl.px(k.walked[i]);
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 12) api.arrow(a, b, {color: c.c3, width: 5, halo: false, head: 12});
        else api.line(a, b, {color: c.c3, width: 5});
      }
      var A = pl.px([0, 0]), P = pl.px(k.P);
      api.point(A, {color: c.ink, r: 4.5});
      api.label([A[0] - 2, A[1] + 14], "start", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      if (v.route !== "round_trip") {
        var B = pl.px([80, 60]);
        api.label([B[0] + 13, B[1] + 1], "B", {color: c.ink, size: 13, weight: 650});
      }
      // displacement: one straight arrow from start to the walker
      if (k.r > 0.5) {
        api.arrow(A, P, {color: c.c1, width: 2.5, halo: false, head: 10});
        var len = Math.hypot(P[0] - A[0], P[1] - A[1]), nx = -(P[1] - A[1]) / len, ny = (P[0] - A[0]) / len;
        if (len > 50) api.label([(A[0] + P[0]) / 2 - nx * 16, (A[1] + P[1]) / 2 - ny * 16], "Δr", {color: c.c1, size: 14, weight: 650, anchor: "middle"});
      }
      var route = k.pts, totals = [0];
      for (var j = 1; j < route.length; j++) totals.push(totals[j - 1] + Math.hypot(route[j][0] - route[j - 1][0], route[j][1] - route[j - 1][1]));
      api.handle(P, {color: c.c3, r: 7, onDrag: function (q) { // snap the walker to the nearest point of the route
        var w = pl.invert(q), best = {dist: Infinity, s: 0};
        for (var s = 1; s < route.length; s++) {
          var a0 = route[s - 1], b0 = route[s], ex = b0[0] - a0[0], ey = b0[1] - a0[1], l2 = ex * ex + ey * ey;
          var t = Math.max(0, Math.min(1, ((w[0] - a0[0]) * ex + (w[1] - a0[1]) * ey) / l2)), px = a0[0] + t * ex, py = a0[1] + t * ey;
          var dd = Math.hypot(w[0] - px, w[1] - py);
          if (dd < best.dist - 1e-9) best = {dist: dd, s: totals[s - 1] + t * Math.sqrt(l2)};
        }
        api.set({progress: Math.round(100 * best.s / k.total)});
      }});
      // key, at the right of the map
      api.label([300, 22], "N", {color: c.muted, size: 12.5, weight: 650, anchor: "middle"});
      api.line([300, 62], [300, 34], {color: c.muted, width: 1.6, arrow: true});
      api.line([284, 92], [306, 92], {color: c.c3, width: 5}); api.label([312, 92], "path walked", {color: c.c3, size: 12});
      api.line([284, 114], [306, 114], {color: c.c1, width: 3, arrow: true}); api.label([312, 114], "displacement", {color: c.c1, size: 12});
      api.rect(285, 128, 14, 14, {stroke: c.axis, width: 1, rx: 0}); api.label([312, 135], "20 m square", {color: c.muted, size: 12});
      // the two quantities on one scale (0 to 300 m)
      var x0 = 100, sc = 290 / 300, rows = [[238, "distance", k.d, c.c3], [270, "displacement", k.r, c.c1]];
      rows.forEach(function (rw) {
        var wpx = rw[2] * sc;
        api.label([x0 - 8, rw[0]], rw[1], {color: rw[3], size: 12.5, weight: 650, anchor: "end"});
        api.rect(x0, rw[0] - 9, 290, 18, {fill: c.ink, fillOpacity: 0.05, rx: 3});
        if (wpx > 0.5) api.rect(x0, rw[0] - 9, wpx, 18, {fill: rw[3], fillOpacity: 0.75, rx: 3});
        if (wpx > 52) api.label([x0 + wpx - 6, rw[0]], m(rw[2]), {color: c.card, size: 12.5, weight: 700, anchor: "end"});
        else api.label([x0 + wpx + 6, rw[0]], m(rw[2]), {color: rw[3], size: 12.5, weight: 650});
      });
    }
  });
})();
