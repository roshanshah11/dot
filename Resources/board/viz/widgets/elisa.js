// Sandwich ELISA: capture antibody on the plastic, antigen from the sample, an HRP-linked detection antibody, then
// TMB substrate. HRP oxidizes TMB to a blue product; an acid stop turns it yellow, and that yellow is read as optical
// density at 450 nm against a standard curve to get the concentration.
// The curve is a typical four-parameter logistic: blank 0.05, top 3.0, half-signal at 40 ng/mL, slope 1.2.
(function () {
  var BLANK = 0.05, TOP = 3.0, C50 = 40, HILL = 1.2, YEL = "#ffee58";   // YEL: the stopped (yellow) TMB product
  function frac(c) { return c <= 0 ? 0 : 1 / (1 + Math.pow(C50 / c, HILL)); }
  function OD(c) { return BLANK + (TOP - BLANK) * frac(c); }

  Viz.register("elisa", {
    title: "Sandwich ELISA",
    subject: "biology",
    shows: "Step through the four layers of a sandwich ELISA; slide the antigen concentration: more antigen captured means more enzyme, more color, and a higher reading on the standard curve",
    params: {
      conc: {kind: "number", default: 25, min: 0, max: 400, step: 1, label: "[\\text{Ag}]"}
    },
    steps: ["coat with capture antibody", "add sample: antigen is captured", "add enzyme-linked detection antibody", "add TMB, then stop with acid: color develops"],
    stepMs: 1700,
    formula: function (v) {
      if (v.conc <= 0) return "OD_{450}=0.05\\ \\text{(blank)}";
      return "OD_{450}=0.05+\\frac{2.95}{1+(40/" + Viz.n(v.conc, 0) + ")^{1.2}}=" + Viz.n(OD(v.conc), 2);
    },
    status: function (v) {
      var s = v.step || 1, n = Math.round(frac(v.conc) * 5), c = Viz.fmt(v.conc, 0) + " ng/mL";
      if (s === 1) return "Capture antibodies stick to the plastic and a blocking protein covers the gaps, so the well can only hold the target antigen from a <b>" + c + "</b> sample.";
      if (s === 2) return n ? "At <b>" + c + "</b> the antigen fills about <b>" + n + " of 5</b> capture antibodies; a wash removes everything unbound."
                            : "At <b>" + c + "</b> almost nothing is captured, so the wash leaves the capture antibodies empty.";
      if (s === 3) return "A second antibody carrying the enzyme HRP binds a different epitope on each captured antigen: <b>" + n + "</b> sandwich" + (n === 1 ? "" : "es") + ", so " + n + " enzyme" + (n === 1 ? "" : "s") + " in this cartoon well.";
      if (v.conc <= 0) return "No antigen means no sandwich and no HRP, so TMB stays colorless through the acid stop and the well reads the blank, OD₄₅₀ <b>0.05</b>.";
      return "HRP oxidizes colorless TMB to a blue product and the acid stop turns it yellow: OD₄₅₀ <b>" + Viz.fmt(OD(v.conc), 2) + "</b>, which the standard curve reads back as <b>" + c + "</b>.";
    },
    examples: [
      {name: "blank well", values: {conc: 0, step: 4}},
      {name: "mid-range sample", values: {conc: 40, step: 4}},
      {name: "saturated", values: {conc: 400, step: 4}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, f = frac(v.conc), od = OD(v.conc), n = Math.round(f * 5);
      var xs = [28, 49, 70, 91, 112], yb = 246, top = 108, order = [2, 0, 4, 1, 3], filled = {};
      for (var i = 0; i < n; i++) filled[order[i]] = true;
      // the well, side view; at step 4 the liquid takes the yellow of the stopped product
      api.label([70, 86], "one well, side view", {color: c.muted, size: 12, anchor: "middle"});
      var fod = (od - BLANK) / (TOP - BLANK);   // a translucent yellow only reads clean (not olive or brown) when strong
      if (s === 4 && fod > 0) api.rect(14, top, 112, yb - top, {fill: YEL, fillOpacity: Math.min(0.92, 0.12 + 0.8 * Math.pow(fod, 0.4)), rx: 2});
      if (s >= 2) api.line([14, top], [126, top], {color: c.faint, width: 1.2, dash: "4 4"});
      api.path("M 12 98 L 12 248 L 128 248 L 128 98", {stroke: c.muted, width: 2});
      [17.5, 38.5, 59.5, 80.5, 101.5, 122.5].forEach(function (x) { api.circle([x, yb - 3], 3, {fill: c.muted, fillOpacity: 0.55}); });
      xs.forEach(function (x, k) {
        // capture antibody, arms up
        api.line([x, yb], [x, yb - 14], {color: c.c2, width: 3});
        api.line([x, yb - 14], [x - 8, yb - 26], {color: c.c2, width: 3});
        api.line([x, yb - 14], [x + 8, yb - 26], {color: c.c2, width: 3});
        if (!filled[k] || s < 2) return;
        api.circle([x, yb - 33], 6.5, {fill: c.c5});
        if (s < 3) return;
        // detection antibody, arms down onto the antigen, enzyme on its tail
        api.line([x - 8, yb - 41], [x, yb - 52], {color: c.c6, width: 3});
        api.line([x + 8, yb - 41], [x, yb - 52], {color: c.c6, width: 3});
        api.line([x, yb - 52], [x, yb - 66], {color: c.c6, width: 3});
        api.circle([x, yb - 74], 7.5, {fill: c.c4, stroke: c.card, width: 1.5});
        if (s < 4) return;
        [[-7, -96], [5, -103], [-3, -114], [7, -90], [1, -124]].forEach(function (d) { api.circle([x + d[0], yb + d[1]], 3.2, {fill: YEL, stroke: c.card, width: 1.2}); });
      });
      // what each layer is, beside the well
      var lx = 136;
      api.label([lx, yb - 18], "capture Ab", {color: c.c2, size: 12.5});
      if (s >= 2) api.label([lx, yb - 36], n ? "antigen" : v.conc > 0 ? "trace antigen" : "no antigen", {color: n ? c.c5 : c.muted, size: 12.5});
      if (s >= 3 && n) {
        api.label([lx, yb - 55], "detection Ab", {color: c.c6, size: 12.5});
        api.label([lx, yb - 75], "HRP enzyme", {color: c.c4, size: 12.5});
      }
      if (s === 4) api.label([lx, yb - 106], n ? "oxidized TMB" : od > 0.1 ? "faint yellow" : "no color", {color: n || od > 0.1 ? YEL : c.muted, size: 12.5});
      // standard curve: OD against concentration on a log axis (how standard curves are read). The blank (0 ng/mL)
      // has no place on a log axis, so it gets its own slot left of an axis break.
      var x0 = 236, x1 = 392, bx = x0 + 10, brk = x0 + 21, xL = x0 + 31, yT = 46, yB = 240;
      var X = function (cc) { return cc <= 0 ? bx : xL + Math.log10(Math.max(cc, 1)) / Math.log10(400) * (x1 - xL); };
      var Y = function (o) { return yB - o / 3.2 * (yB - yT); };
      api.label([(x0 + x1) / 2, 18], "standard curve", {color: c.muted, size: 12, anchor: "middle"});
      api.line([x0, yB], [brk - 3, yB], {color: c.axis, width: 1.2});
      api.line([brk + 3, yB], [x1 + 4, yB], {color: c.axis, width: 1.2});
      api.line([brk - 5, yB + 3], [brk - 2, yB - 3], {color: c.axis, width: 1.2});
      api.line([brk + 2, yB + 3], [brk + 5, yB - 3], {color: c.axis, width: 1.2});
      api.line([x0, yB], [x0, yT - 8], {color: c.axis, width: 1.2});
      api.line([bx, yB], [bx, yB + 3], {color: c.axis, width: 1.2});
      api.label([bx, yB + 13], "blank", {color: c.muted, size: 12, anchor: "middle"});
      [10, 100].forEach(function (t) { api.line([X(t), yB], [X(t), yB + 3], {color: c.axis, width: 1.2}); api.label([X(t), yB + 13], String(t), {color: c.muted, size: 12, anchor: "middle"}); });
      [1, 2, 3].forEach(function (t) { api.line([x0 - 3, Y(t)], [x0, Y(t)], {color: c.axis, width: 1.2}); api.label([x0 - 6, Y(t)], String(t), {color: c.muted, size: 12, anchor: "end"}); });
      api.label([x0 + 4, yT - 12], "OD₄₅₀", {color: c.muted, size: 12});
      api.label([(xL + x1) / 2, yB + 29], "[Ag], ng/mL (log)", {color: c.muted, size: 12, anchor: "middle"});
      var pts = []; for (var e = 0; e <= 1.0001; e += 0.02) { var cc = Math.pow(400, e); pts.push([X(cc), Y(OD(cc))]); }
      api.polyline(pts, {stroke: c.ink, width: 1.8, opacity: 0.7});
      [0, 1.5625, 3.125, 6.25, 12.5, 25, 50, 100, 200, 400].forEach(function (t) { api.circle([X(t), Y(OD(t))], 2.6, {fill: c.muted}); });
      // this sample: measured (filled, with read-off lines) only once the color is there; before that, where it will land
      var P = [X(v.conc), Y(od)], read = s === 4;
      if (read) {
        api.line([x0, P[1]], P, {color: YEL, width: 1.2, dash: "3 3"});
        api.line(P, [P[0], yB], {color: YEL, width: 1.2, dash: "3 3"});
        api.point(P, {color: YEL, r: 5.5});
      } else api.circle(P, 5, {fill: c.card, stroke: YEL, width: 2});
      // its label sits up and to the left (the curve rises to the right); near the axis it moves up over the point
      var txt = read ? "OD " + api.fmt(od, 2) : "expected", w = txt.length * 12.5 * 0.56 + 6, lx0 = P[0] - 8 - w, ly = P[1] - 13;
      if (lx0 < x0 + 4) { lx0 = x0 + 4; ly = P[1] - 26; }
      api.rect(lx0, ly - 8, w, 16, {fill: c.card, fillOpacity: 0.9, rx: 4});
      api.label([lx0 + w / 2, ly], txt, {color: read ? YEL : c.muted, size: 12.5, weight: read ? 650 : 500, anchor: "middle"});
      // viz.css paints every svg label ink (it overrides the fill attribute); keep each label's own color
      api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
