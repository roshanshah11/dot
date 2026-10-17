// Western blot in four steps: SDS-PAGE separates the lysate by size, a current moves the proteins onto a membrane,
// a primary antibody finds the target, and an HRP-linked secondary antibody makes light where it sits.
// Migration on a 4-20% gradient gel is close to linear in log(mass): R_f = (log 250 - log M) / (log 250 - log 10).
(function () {
  var MARK = [250, 150, 100, 75, 50, 37, 25, 20, 15, 10];
  var BG = [[220, 0.3], [160, 0.45], [120, 0.25], [88, 0.5], [66, 0.6], [54, 0.35], [43, 0.55], [33, 0.3], [28, 0.45], [22, 0.3], [17, 0.45], [13, 0.3], [11, 0.35]];
  var LT = Math.log10(250), SPAN = Math.log10(25);
  function rf(m) { return (LT - Math.log10(m)) / SPAN; }
  function film(a) { return a <= 0 ? 0 : Math.min(1, 0.32 * a + 0.05); }   // film response, saturating

  Viz.register("western-blot", {
    title: "Western blot",
    subject: "biology",
    shows: "Step through gel, transfer, primary and secondary antibody; slide the target's size to move its band and the treated level to change its brightness",
    params: {
      mw: {kind: "integer", default: 50, min: 10, max: 250, label: "M\\,(\\text{kDa})"},
      ratio: {kind: "number", default: 2, min: 0, max: 4, step: 0.1, label: "\\text{trt}/\\text{ctl}"}
    },
    steps: ["separate by size (SDS-PAGE)", "transfer onto a membrane", "block, then primary antibody", "secondary antibody + HRP: light"],
    stepMs: 1800,
    formula: function (v) {
      return "\\log_{10}M=2.40-1.40\\,R_f\\ \\Rightarrow\\ R_f=\\frac{2.40-\\log_{10}" + v.mw + "}{1.40}=" + Viz.n(rf(v.mw), 2);
    },
    status: function (v) {
      var s = v.step || 1, hi = null, lo = null;
      MARK.forEach(function (m) { if (m >= v.mw && (hi === null || m < hi)) hi = m; if (m <= v.mw && (lo === null || m > lo)) lo = m; });
      var where = hi === lo ? "right at the " + hi + " kDa marker" : "between the " + lo + " and " + hi + " kDa markers";
      var amt = v.ratio <= 0 ? "with nothing in the treated lane" : "with " + Viz.fmt(v.ratio, 1) + "× as much in the treated lane";
      if (s === 1) return "SDS coats every protein with negative charge in proportion to its length, so they separate by size: the <b>" + v.mw + " kDa</b> target runs to Rf " + Viz.fmt(rf(v.mw), 2) + ", " + where + ".";
      if (s === 2) return "A current pulls every protein out of the gel onto the membrane in the same pattern; nothing marks the " + v.mw + " kDa target yet.";
      if (s === 3) return "Milk proteins block the bare membrane, then the primary antibody binds only the <b>" + v.mw + " kDa</b> target, " + amt + ".";
      if (v.ratio <= 0) return "HRP lights the control band only: the treated lane has <b>no</b> detectable target.";
      return "HRP on the secondary antibody makes light where the target is: the treated band is <b>" + Viz.fmt(v.ratio, 1) + "×</b> the control" +
        (film(v.ratio) >= 1 ? ", but the film saturates near 3×, so the band understates it." : ".");
    },
    examples: [
      {name: "small protein", values: {mw: 12, ratio: 1, step: 4}},
      {name: "large protein, saturated band", values: {mw: 240, ratio: 4, step: 4}},
      {name: "knocked out in treated", values: {mw: 75, ratio: 0, step: 3}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, top = 46, H = 200, lanes = [72, 122, 172], bw = 34;
      var Y = function (m) { return top + rf(m) * H; }, ty = Y(v.mw), amt = [1, v.ratio];
      // the gel or membrane
      var bg = s === 1 ? {fill: c.c2, fillOpacity: 0.07, stroke: c.c2} : s === 4 ? {fill: "#000", fillOpacity: 0.55, stroke: c.muted} : {fill: c.ink, fillOpacity: 0.1, stroke: c.muted};
      api.rect(48, 30, 150, 230, Object.assign({width: 1.2, rx: 4}, bg));
      api.label([24, 18], "kDa", {color: c.muted, size: 12, anchor: "middle"});
      ["ladder", "control", "treated"].forEach(function (t, i) { api.label([lanes[i], 18], t, {color: c.muted, size: 12, anchor: "middle"}); });
      if (s === 1) lanes.forEach(function (x) { api.rect(x - bw / 2, 32, bw, 6, {fill: c.c2, fillOpacity: 0.25, rx: 1}); });
      MARK.forEach(function (m) {
        api.rect(lanes[0] - bw / 2, Y(m) - 2, bw, 4, {fill: c.ink, rx: 1, opacity: s === 4 ? 0.3 : 0.65});
        api.label([42, Y(m)], String(m), {color: c.muted, size: 12, anchor: "end"});
      });
      [1, 2].forEach(function (li) {
        var x = lanes[li] - bw / 2, a = amt[li - 1];
        if (s <= 2) {
          var col = s === 1 ? c.c2 : c.c5, k = s === 1 ? 1 : 0.55;
          BG.forEach(function (b) { api.rect(x, Y(b[0]) - 2, bw, 4, {fill: col, rx: 1, opacity: b[1] * k}); });
          if (a > 0) api.rect(x, ty - 2.5, bw, 5, {fill: col, rx: 1, opacity: Math.min(0.95, 0.2 + 0.25 * a) * k});
        } else if (s === 3) {
          var nY = Math.min(6, Math.round(2 * a));
          for (var j = 0; j < nY; j++) {
            var yx = x + 4 + (j + 0.5) * (bw - 8) / nY;
            api.line([yx, ty - 1], [yx, ty - 9], {color: c.c1, width: 2});
            api.line([yx, ty - 1], [yx - 3, ty + 3], {color: c.c1, width: 2});
            api.line([yx, ty - 1], [yx + 3, ty + 3], {color: c.c1, width: 2});
          }
        } else if (a > 0) {
          api.rect(x - 2, ty - 6, bw + 4, 12, {fill: c.ink, rx: 4, opacity: film(a) * 0.25});
          api.rect(x, ty - 3, bw, 6, {fill: c.ink, rx: 2, opacity: film(a)});
        }
      });
      api.path("M 214 " + (ty - 6) + " L 204 " + ty + " L 214 " + (ty + 6) + " Z", {fill: c.c3});
      api.label([218, ty], "target", {color: c.c3, size: 12});
      // the molecular close-up for this step
      var zx = 262;
      if (s === 1) {
        // SDS-coated, unfolded chains: the same charge per length, so only size sets the speed through the gel
        api.label([zx + 4, 40], "− cathode", {color: c.ink, size: 12.5});
        api.label([zx + 4, 266], "+ anode", {color: c.ink, size: 12.5});
        [[zx + 4, 74, 22, 26, "large: slow"], [zx + 4, 150, 8, 70, "small: fast"]].forEach(function (p) {
          var pts = []; for (var i = 0; i <= p[2]; i++) pts.push([p[0] + i * 4, p[1] + 4 * Math.sin(i * 1.4)]);
          api.polyline(pts, {stroke: c.c2, width: 2.4});
          for (var k2 = 1; k2 < p[2]; k2 += 3) api.label([p[0] + k2 * 4, p[1] - 11], "−", {color: c.c2, size: 12, anchor: "middle"});
          var ax = p[0] + p[2] * 2;
          api.arrow([ax, p[1] + 10], [ax, p[1] + 10 + p[3]], {color: c.muted, width: 1.6, halo: false, head: 7});
          api.label([ax + 10, p[1] + 12 + p[3] / 2], p[4], {color: c.c2, size: 12});
        });
      } else if (s === 2) {
        var layers = [[zx + 4, 16, c.muted, 0.35], [zx + 22, 8, c.ink, 0.25], [zx + 32, 22, c.c2, 0.35], [zx + 56, 7, c.ink, 0.85], [zx + 65, 8, c.ink, 0.25], [zx + 75, 16, c.muted, 0.35]];
        layers.forEach(function (l) { api.rect(l[0], 66, l[1], 150, {fill: l[2], fillOpacity: l[3], rx: 2}); });
        api.label([zx + 2, 50], "−", {color: c.ink, size: 18, anchor: "middle", weight: 650});
        api.label([zx + 92, 50], "+", {color: c.ink, size: 18, anchor: "middle", weight: 650});
        [100, 140, 180].forEach(function (y) { api.arrow([zx + 36, y], [zx + 60, y], {color: c.c3, width: 2, halo: false, head: 7}); });
        api.label([zx + 43, 236], "gel", {color: c.c2, size: 12, anchor: "middle"});
        api.label([zx + 60, 254], "membrane", {color: c.ink, size: 12, anchor: "middle"});
        api.label([392, 120], "proteins", {color: c.c3, size: 12, anchor: "end"});
        api.label([392, 136], "move →", {color: c.c3, size: 12, anchor: "end"});
      } else {
        api.rect(zx, 236, 130, 10, {fill: c.ink, fillOpacity: 0.2, rx: 2});
        [zx + 6, zx + 48, zx + 62, zx + 78, zx + 94, zx + 112].forEach(function (x) { api.circle([x, 230], 5, {fill: c.muted, fillOpacity: 0.6}); });
        api.circle([zx + 26, 224], 12, {fill: c.c3, fillOpacity: 0.85});
        var bx = zx + 26;
        api.line([bx - 8, 210], [bx, 198], {color: c.c1, width: 3}); api.line([bx + 8, 210], [bx, 198], {color: c.c1, width: 3});
        api.line([bx, 198], [bx, 180], {color: c.c1, width: 3});
        api.label([zx + 56, 192], "primary Ab", {color: c.c1, size: 12});
        api.label([zx + 56, 262], "blocking protein", {color: c.muted, size: 12, anchor: "start"});
        api.label([zx + 56, 214], "target", {color: c.c3, size: 12});
        if (s === 4) {
          api.line([bx - 7, 178], [bx, 168], {color: c.c6, width: 3}); api.line([bx + 7, 178], [bx, 168], {color: c.c6, width: 3});
          api.line([bx, 168], [bx, 150], {color: c.c6, width: 3});
          api.circle([bx, 140], 9, {fill: c.c4});
          [[-1, -1], [0, -1.3], [1, -1], [-1.3, 0], [1.3, 0]].forEach(function (d) { api.line([bx + d[0] * 13, 140 + d[1] * 13], [bx + d[0] * 20, 140 + d[1] * 20], {color: c.ink, width: 1.6}); });
          api.label([zx + 56, 164], "secondary Ab", {color: c.c6, size: 12});
          api.label([zx + 56, 140], "HRP → light", {color: c.c4, size: 12});
        }
      }
      // viz.css paints every svg label ink (it overrides the fill attribute); keep each label's own color
      api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
