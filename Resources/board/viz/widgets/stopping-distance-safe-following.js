// Stopping distance = reaction distance (the car keeps its speed for the driver's reaction time) + braking distance
// (constant deceleration mu g until it stops): d = v t_r + v^2 / (2 mu g), with g = 9.81 m/s^2. Tyre-road friction
// coefficients are typical textbook values for a car on asphalt: dry 0.7, wet 0.4, snow or ice 0.15 (packed snow is
// near 0.2, glare ice near 0.1). Top: the stopping distance on all three surfaces at the chosen speed and reaction
// time, the chosen one bright. Bottom: how it grows with speed on the chosen surface (braking grows with v^2), against
// the distance a 2-second following gap gives (2 s x v). Where the curve rises above that line, a 2-second gap is too
// short to stop for a car that stops dead ahead.
(function () {
  var G = 9.81, MU = {dry: 0.7, wet: 0.4, snow_ice: 0.15}, NAME = {dry: "dry", wet: "wet", snow_ice: "snow/ice"};
  function dist(kmh, tr, mu) { var v = kmh / 3.6, r = v * tr, b = v * v / (2 * mu * G); return {v: v, r: r, b: b, d: r + b}; }
  function nice(x) { var e = Math.pow(10, Math.floor(Math.log10(x))), m = x / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e; }
  function niceMax(x) { var e = Math.pow(10, Math.floor(Math.log10(x))), m = x / e, k = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
    for (var i = 0; i < k.length; i++) if (m <= k[i] + 1e-9) return k[i] * e; return 10 * e; }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 1 : d); };

  Viz.register("stopping-distance-safe-following", {
    title: "Stopping distance and safe following",
    subject: "physics",
    shows: "Slide speed and reaction time and pick the road: reaction distance grows with v, braking distance with v², and slick roads multiply the braking part",
    params: {
      speedKmh: {kind: "number", default: 60, min: 30, max: 100, step: 5, label: "v\\ (\\text{km/h})"},
      reactionTimeSeconds: {kind: "number", default: 1, min: 0.5, max: 2, step: 0.1, label: "t_r\\ (\\text{s})"},
      roadCondition: {kind: "enum", values: ["dry", "wet", "snow_ice"], names: NAME, default: "dry", label: "\\text{road}"}
    },
    formula: function (v) {
      var mu = MU[v.roadCondition], k = dist(v.speedKmh, v.reactionTimeSeconds, mu);
      return "\\begin{array}{l}d_{\\mathrm{stop}}=d_{\\mathrm{reaction}}+d_{\\mathrm{braking}}=v\\,t_r+\\dfrac{v^2}{2\\mu g}\\\\" +
        "=" + Viz.n(k.v, 2) + "(" + Viz.n(v.reactionTimeSeconds) + ")+\\dfrac{" + Viz.n(k.v, 2) + "^2}{2(" + Viz.n(mu) + ")(9.81)}\\\\" +
        "=" + Viz.n(k.r, 1) + "+" + Viz.n(k.b, 1) + "=" + Viz.n(k.d, 1) + "\\ \\text{m}\\end{array}";
    },
    status: function (v) {
      var k = dist(v.speedKmh, v.reactionTimeSeconds, MU[v.roadCondition]), gap = k.d / k.v;
      return "At " + v.speedKmh + " km/h on a " + NAME[v.roadCondition] + " road you need <b>" + f(k.d) + " m</b> to stop (" + Math.round(100 * k.r / k.d) +
        "% of it before the brakes bite), as far as you travel in <b>" + f(gap) + " s</b>, so a 2-second gap " +
        (gap > 2 ? "is <b>too short</b> if the car ahead stops dead." : "would still cover a car ahead that stops dead.");
    },
    examples: [
      {name: "Minimum supported values", values: {speedKmh: 30, reactionTimeSeconds: 0.5}},
      {name: "Maximum supported values", values: {speedKmh: 100, reactionTimeSeconds: 2}},
      {name: "roadCondition: wet", values: {roadCondition: "wet"}},
      {name: "roadCondition: snow_ice", values: {roadCondition: "snow_ice"}}
    ],
    size: [400, 310],
    draw: function (api, v) {
      var c = api.color, sel = v.roadCondition, tr = v.reactionTimeSeconds;
      // top: the three surfaces at this speed
      var bx0 = 82, bx1 = 384, rows = ["dry", "wet", "snow_ice"], all = rows.map(function (r) { return dist(v.speedKmh, tr, MU[r]); });
      var max = niceMax(all[2].d * 1.22), BX = function (d) { return bx0 + (bx1 - bx0) * d / max; };
      api.rect(bx0, 6, 10, 10, {fill: c.c3, fillOpacity: 0.95, rx: 2});
      api.label([bx0 + 15, 11], "reaction", {color: c.c3, size: 12, weight: 600});
      api.rect(bx0 + 82, 6, 10, 10, {fill: c.c5, fillOpacity: 0.95, rx: 2});
      api.label([bx0 + 97, 11], "braking", {color: c.c5, size: 12, weight: 600});
      api.label([bx1, 11], v.speedKmh + " km/h, t_r " + f(tr) + " s", {color: c.muted, size: 12, anchor: "end"});
      rows.forEach(function (r, i) {
        var k = all[i], y = 26 + i * 30, on = r === sel, op = on ? 0.95 : 0.3;
        api.label([bx0 - 8, y + 6], NAME[r], {color: on ? c.ink : c.muted, size: 12.5, weight: on ? 700 : 500, anchor: "end"});
        api.label([bx0 - 8, y + 19], "μ " + MU[r], {color: c.muted, size: 12, anchor: "end"});
        api.rect(bx0, y, BX(k.r) - bx0, 22, {fill: c.c3, fillOpacity: op, rx: 2});
        api.rect(BX(k.r), y, BX(k.d) - BX(k.r), 22, {fill: c.c5, fillOpacity: op, rx: 2});
        if (on) api.rect(bx0 - 2, y - 2, BX(k.d) - bx0 + 4, 26, {stroke: c.ink, width: 1.4, rx: 3});
        api.label([BX(k.d) + 6, y + 11], f(k.d) + " m", {color: on ? c.ink : c.muted, size: 12, weight: on ? 700 : 500});
      });
      var ay = 118, step = nice(max / 5);
      api.line([bx0, ay], [bx1, ay], {color: c.axis, width: 1});
      for (var t = 0; t <= max + 1e-9; t += step) {
        api.line([BX(t), ay], [BX(t), ay + 4], {color: c.axis, width: 1});
        api.label([BX(t), ay + 14], String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([bx0 - 8, ay + 14], "metres", {color: c.muted, size: 12, anchor: "end"});
      // bottom: stopping distance against speed on the chosen surface, with the 2-second gap line
      var gx0 = 48, gx1 = 384, gy0 = 268, gy1 = 156, mu = MU[sel];
      var top = dist(100, tr, mu).d, ymax = niceMax(top * 1.05);
      var GX = function (s) { return gx0 + (gx1 - gx0) * (s - 30) / 70; }, GY = function (d) { return gy0 - (gy0 - gy1) * d / ymax; };
      var reac = [], stop = [];
      for (var s = 30; s <= 100.001; s += 1) { var q = dist(s, tr, mu); reac.push([GX(s), GY(q.r)]); stop.push([GX(s), GY(q.d)]); }
      api.polygon([[GX(30), gy0]].concat(reac, [[GX(100), gy0]]), {fill: c.c3, fillOpacity: 0.3, stroke: "none"});
      api.polygon(reac.concat(stop.slice().reverse()), {fill: c.c5, fillOpacity: 0.28, stroke: "none"});
      api.polyline(stop, {stroke: c.c5, width: 2.2});
      api.polyline(reac, {stroke: c.c3, width: 1.6});
      // 2-second gap: d = 2 s x v, clipped to the chart
      var gEnd = Math.min(100, ymax / 2 * 3.6);
      api.line([GX(30), GY(2 * 30 / 3.6)], [GX(gEnd), GY(2 * gEnd / 3.6)], {color: c.c2, width: 2, dash: "6 4"});
      var gy = GY(2 * gEnd / 3.6);
      api.label([GX(gEnd) - 4, gy > gy0 - 24 ? gy - 11 : gy + 11], "2 s gap", {color: c.c2, size: 12, weight: 650, anchor: "end"});
      api.line([gx0, gy0], [gx1, gy0], {color: c.axis, width: 1.2});
      api.line([gx0, gy0], [gx0, gy1 - 4], {color: c.axis, width: 1.2});
      for (var sp = 30; sp <= 100; sp += 10) api.label([GX(sp), gy0 + 14], String(sp), {color: c.muted, size: 12, anchor: "middle"});
      api.label([gx1, gy0 + 28], "speed (km/h)", {color: c.muted, size: 12, anchor: "end"});
      api.label([gx0 - 6, gy1], String(ymax), {color: c.muted, size: 12, anchor: "end"});
      api.label([gx0 - 6, gy0], "0", {color: c.muted, size: 12, anchor: "end"});
      api.label([gx0 - 6, (gy0 + gy1) / 2], "m", {color: c.muted, size: 12, anchor: "end"});
      // now
      var now = dist(v.speedKmh, tr, mu);
      api.line([GX(v.speedKmh), gy0], [GX(v.speedKmh), GY(now.d)], {color: c.ink, width: 1.2, dash: "3 3"});
      api.circle([GX(v.speedKmh), GY(now.d)], 5, {fill: c.c5, fillOpacity: 1, stroke: c.card, width: 1.5});
      api.label([gx0 + 8, gy1 + 4], NAME[sel] + ": braking grows with v²", {color: c.c5, size: 12, weight: 600});
    }
  });
})();
