// Vertical motion under gravity, g = 9.8 m/s^2, up positive, air resistance ignored. Left: the ball's column with a
// multiflash of where it was every 0.2 s up to now (each frame stepped a little right so the early frames don't pile up;
// the vertical gaps widen as it speeds up) and its velocity arrow. Right: the
// height-time graph h(t) = h0 + v0 t - g t^2 / 2 on fixed axes (0 to 3 s, 0 to 22 m), so a higher start or a harder
// throw visibly moves the landing time T = (v0 + sqrt(v0^2 + 2 g h0)) / g. The time t (Dot's addition) scrubs the ball.
(function () {
  var G = 9.8;
  function calc(v) {
    var h0 = v.initialHeightMeters, v0 = v.initialVelocityMetersPerSecond, t = v.time;
    var T = (v0 + Math.sqrt(v0 * v0 + 2 * G * h0)) / G, te = Math.min(t, T);
    return {h0: h0, v0: v0, t: t, T: T, landed: t >= T, raw: h0 + v0 * t - G * t * t / 2, h: Math.max(0, h0 + v0 * te - G * te * te / 2),
            v: v0 - G * te, vLand: -Math.sqrt(v0 * v0 + 2 * G * h0), tTop: v0 > 0 ? v0 / G : null, hTop: h0 + (v0 > 0 ? v0 * v0 / (2 * G) : 0)};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };

  Viz.register("free-fall", {
    title: "Free fall: height against time",
    subject: "physics",
    shows: "Set the starting height and speed, then scrub time: gravity takes 9.8 m/s off the velocity every second, so the height traces a downward parabola",
    params: {
      initialHeightMeters: {kind: "number", default: 14, min: 4, max: 18, step: 0.5, label: "h_0\\ (\\text{m})"},
      initialVelocityMetersPerSecond: {kind: "number", default: 0, min: -8, max: 8, step: 0.5, label: "v_0\\ (\\text{m/s})"},
      time: {kind: "number", default: 1, min: 0, max: 3, step: 0.05, label: "t\\ (\\text{s})"}
    },
    formula: function (v) {
      var k = calc(v), t = Viz.n(k.t, 2);
      var s = "\\begin{array}{l}h(t)=h_0+v_0t-\\tfrac12gt^2\\\\\\quad=" + Viz.n(k.h0) + "+" + Viz.p(k.v0) + "\\cdot" + t + "-4.9\\cdot" + t + "^2\\\\\\quad=" + Viz.n(k.raw, 2);
      if (k.landed && k.raw < 0) return s + "<0\\\\\\text{so it landed at }T=" + Viz.n(k.T, 2) + "\\ \\text{s}\\end{array}";
      return s + "\\ \\text{m}\\\\v=v_0-gt=" + Viz.n(k.v, 2) + "\\ \\text{m/s}\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (k.landed) return "It has landed: it hit the ground at <b>T = " + f(k.T) + " s</b> moving <b>" + f(-k.vLand, 1) + " m/s</b>.";
      if (Math.abs(k.v) < 1e-9 && k.v0 > 0) return "At the top: for an instant v = 0, at <b>" + f(k.hTop) + " m</b>; from here it falls, landing at " + f(k.T) + " s.";
      if (k.v > 0) return "Still rising at <b>" + f(k.v) + " m/s</b>, " + f(k.h) + " m up; gravity takes 9.8 m/s off each second, so it tops out at <b>" + f(k.hTop) + " m</b> at " + f(k.tTop) + " s.";
      if (k.t === 0) return "At release it is <b>" + f(k.h0) + " m</b> up moving " + (k.v0 ? f(-k.v0) + " m/s downward" : "0 m/s (dropped)") + "; it will land at <b>" + f(k.T) + " s</b>.";
      return "Falling at <b>" + f(-k.v) + " m/s</b> and <b>" + f(k.h) + " m</b> up; it hits the ground at <b>" + f(k.T) + " s</b>, moving " + f(-k.vLand, 1) + " m/s.";
    },
    examples: [
      {name: "Minimum supported values", values: {initialHeightMeters: 4, initialVelocityMetersPerSecond: -8}},
      {name: "Maximum supported values", values: {initialHeightMeters: 18, initialVelocityMetersPerSecond: 8}},
      {name: "thrown up, at the top", values: {initialHeightMeters: 10, initialVelocityMetersPerSecond: 4.9, time: 0.5}},
      {name: "at release", values: {initialHeightMeters: 14, initialVelocityMetersPerSecond: 0, time: 0}},
      {name: "landed", values: {initialHeightMeters: 6, initialVelocityMetersPerSecond: 2, time: 2.5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), yG = 262, sc = 10.5, x0 = 150, x1 = 386;
      var Y = function (h) { return yG - h * sc; }, X = function (t) { return x0 + (x1 - x0) * t / 3; };
      var hAt = function (t) { return k.h0 + k.v0 * t - G * t * t / 2; };
      var lab = function (at, text, o) { o.size = o.size || 12.5; o.weight = o.weight || 650; return api.label(at, text, o); };
      var halo = function (el) { el.setAttribute("stroke", c.card); el.setAttribute("stroke-width", 4); el.setAttribute("paint-order", "stroke"); return el; };   // dashed guides pass behind
      var skip = [];   // label boxes [x0, x1, y0, y1] the dotted guide from the ball to the graph steps around
      // graph frame
      for (var m = 5; m <= 20; m += 5) {
        skip.push([x0 - 8 - String(m).length * 7, x0 - 3, Y(m) - 8, Y(m) + 8]);
        api.line([x0, Y(m)], [x1, Y(m)], {color: c.grid, width: 1});
        api.label([x0 - 6, Y(m)], String(m), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([x0 - 6, Y(22) - 2], "h (m)", {color: c.muted, size: 12, anchor: "end"});
      api.line([x0, yG], [x0, Y(22)], {color: c.axis, width: 1.4});
      api.line([6, yG], [x1 + 6, yG], {color: c.muted, width: 2});
      var tLab = "t = " + f(k.t) + " s", tw = tLab.length * 3.5 + 3, tx = Math.max(tw, Math.min(api.w - tw, X(k.t)));   // the t label's spot after clamping
      for (var s = 0; s <= 3 + 1e-9; s += 0.5) {
        api.line([X(s), yG], [X(s), yG + 4], {color: c.axis, width: 1});
        var sl = s === 3 ? "3 s" : f(s);
        if (Math.abs(X(s) - tx) > tw + sl.length * 3.4 - 1) api.label([X(s), yG + 16], sl, {color: c.muted, size: 12, anchor: "middle"});
      }
      // the parabola up to landing
      var pts = []; for (var i = 0; i <= 80; i++) { var tt = k.T * i / 80; pts.push([X(tt), Y(Math.max(0, hAt(tt)))]); }
      api.polyline(pts, {stroke: c.c2, width: 2.5});
      // h0 sits above or below the start, on whichever side the parabola leaves clear
      var hLab = "h₀ = " + f(k.h0, 1) + " m", hw = hLab.length * 7, pxs = (x1 - x0) / 3;
      var clear = function (off) {
        var y = Y(k.h0) + off, lo = k.h0 - (off + 8) / sc, hi = k.h0 - (off - 8) / sc;
        if (y < 18 || y > yG - 10) return false;
        for (var x = 8; x <= hw + 10; x += 3) { var tt = x / pxs, hh = tt < k.T ? hAt(tt) : 0; if (hh > lo && hh < hi) return false; }
        return true;
      };
      var yh = Y(k.h0) + ([-13, 15, -27, 29].filter(clear)[0] || -13);
      halo(lab([X(0) + 8, yh], hLab, {color: c.c2}));
      skip.push([X(0) + 4, X(0) + 10 + hw, yh - 8, yh + 8]);
      if (k.tTop != null) {   // the top label is centered on the top point, kept right of the axis, and stacked above h0's label when a short throw puts them together
        var topLab = "top " + f(k.hTop) + " m", tl = topLab.length * 7, tl0 = Math.max(x0 + 4, X(k.tTop) - tl / 2), yt = Y(k.hTop) - 12;
        if (tl0 < x0 + 8 + hw && Math.abs(yt - yh) < 15) yt = yh - 15;
        api.point([X(k.tTop), Y(k.hTop)], {color: c.c3, r: 4});
        lab([tl0, yt], topLab, {color: c.c3});
      }
      // landing: a short label beside the point (the speed is in the status); a late landing has no room there, so it goes under the axis
      var L = [X(k.T), yG], land = "lands " + f(k.T) + " s";
      api.point(L, {color: c.c5, r: 4.5});
      if (L[0] + 8 + land.length * 7 < 396) lab([L[0] + 8, yG - 13], land, {color: c.c5});
      else { api.line([L[0], yG], [L[0], yG + 7], {color: c.c5, width: 2}); lab([L[0], yG + 31], land, {color: c.c5, anchor: "middle"}); }
      // the column: a multiflash, one ring every 0.2 s, each frame stepped right so early frames don't pile up and the widening gaps show
      var te = Math.min(k.t, k.T), xa = 18, DX = 24, xb = xa + DX * te;
      api.label([6, 14], "flashes 0.2 s apart", {color: c.muted, size: 12});
      api.line([xa - 14, Y(k.h0) + 8], [xa, Y(k.h0) + 8], {color: c.muted, width: 3});   // the ledge, under the release point only
      for (var q = 0; q < te - 1e-9; q += 0.2) api.circle([xa + DX * q, Y(Math.max(0, hAt(q)))], 3, {stroke: c.ink, width: 1.3, opacity: 0.55});
      var B = [xb, Y(k.h) - (k.landed ? 6 : 0)];
      var segs = k.landed ? [] : [[xb + 8, X(te) - 6]];   // level with the ball; none once it has landed
      skip.forEach(function (b) {
        if (B[1] < b[2] || B[1] > b[3]) return;
        segs = [].concat.apply([], segs.map(function (g) { return g[1] <= b[0] || g[0] >= b[1] ? [g] : [[g[0], b[0]], [b[1], g[1]]].filter(function (q) { return q[1] - q[0] > 3; }); }));
      });
      segs.forEach(function (g) { api.line([g[0], B[1]], [g[1], B[1]], {color: c.faint, width: 1, dash: "2 4"}); });
      api.circle(B, 6.5, {fill: c.c1, stroke: c.card, width: 1.5});
      var hb = skip[skip.length - 1], now = X(k.t) > hb[0] && X(k.t) < hb[1] ? [[Y(k.h), Math.min(yG, hb[2])], [Math.max(Y(k.h), hb[3]), yG]] : [[Y(k.h), yG]];   // the "now" line, stepping around h0's label
      now.forEach(function (g) { if (g[1] - g[0] > 2) api.line([X(k.t), g[1]], [X(k.t), g[0]], {color: c.c1, width: 1, dash: "3 4", opacity: 0.7}); });
      if (!k.landed && Math.abs(k.v) > 0.05) {   // velocity, 3.4 px per m/s beside the ball; near the ground it slides up so the tip stays in view
        var dir = k.v > 0 ? -1 : 1, len = Math.abs(k.v) * 3.4, ax = xb + 11, a0 = dir > 0 ? Math.min(B[1], yG + 28 - len) : B[1], a1 = a0 + dir * len;
        api.arrow([ax, a0], [ax, a1], {color: c.c3, width: 2.5, halo: false, head: Math.min(9, len)});
        var ly = (a0 + a1) / 2; if (Math.abs(ly - B[1]) < 12) ly = B[1] + dir * 12;   // a short arrow's label moves off the guide line, to the arrow's side
        if (Math.abs(ly - yG) < 11) ly = yG + 13;   // and off the ground line
        var vl = f(Math.abs(k.v), 1) + " m/s", right = ax + 6 + vl.length * 6 <= x0 - 22;   // right of the arrow, or late in the fall (ball far right) left of the ball, where no earlier frame is
        lab([right ? ax + 6 : xb - 10, ly], vl, {color: c.c3, size: 12, anchor: right ? "start" : "end"});
      }
      lab([X(k.t), yG + 16], tLab, {color: c.c1, anchor: "middle"});
      api.handle([X(te), Y(k.h)], {color: c.c1, r: 6, onDrag: function (p) {   // drag the ball along its path
        api.set({time: Math.max(0, Math.min(3, Math.round((p[0] - x0) / (x1 - x0) * 60) / 20))});
      }});
      // viz.css sets every svg text's fill to ink, which beats the fill attribute api.label writes: restate it inline
      api.svg.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
