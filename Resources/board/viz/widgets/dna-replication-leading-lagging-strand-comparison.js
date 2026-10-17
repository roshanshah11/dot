// Leading against lagging at one fork, over time. The leading strand is copied toward the fork as it opens: one primer,
// one piece, its 3' end right behind the helicase. The lagging strand must wait: primase lays a primer only once about one
// fragment's worth of template (l) is exposed, and each fragment is then made back toward the previous one. Model: fork
// speed v (E. coli about 1,000 nt/s, human about 50 nt/s; Alberts, MBoC), a primer every l nt (1,500 nt in E. coli,
// 150 nt in human cells), each fragment extended at fork speed. Then leading = v t and lagging = max(0, v t - l): the
// lagging strand trails by one fragment, which is where its name comes from, and it is in pieces until ligase joins them.
// Colors: amber = leading, teal = lagging, blue = template, red = RNA primer, purple = helicase, ink = the gap.
(function () {
  var CELL = {"E. coli": {v: 1000, frag: 1500}, "human": {v: 50, frag: 150}}, TMAX = 10;
  function txtInt(x) { return Math.round(x).toLocaleString("en-US"); }
  function texInt(x) { return txtInt(x).replace(/,/g, "{,}"); }
  function calc(v) {
    var o = CELL[v.cell], d = o.v * v.t, k = Math.floor(d / o.frag + 1e-9), sNew = d - k * o.frag;
    return {o: o, d: d, k: k, s: sNew, lag: Math.max(0, d - o.frag), pieces: k ? (k - 1) + (sNew > 1e-9 ? 1 : 0) : 0};
  }

  Viz.register("dna-replication-leading-lagging-strand-comparison", {
    title: "Leading and lagging strands compared",
    subject: "biology",
    shows: "Slide time at one fork: the leading strand grows in one piece right behind the helicase, while the lagging strand starts later, trails by one Okazaki fragment and stays in pieces",
    params: {
      t: {kind: "integer", default: 6, min: 0, max: TMAX, label: "t\\ (\\text{s})"},
      cell: {kind: "enum", values: ["E. coli", "human"], default: "E. coli", label: "\\text{cell}"}
    },
    formula: function (v) {
      var r = calc(v);
      return "\\begin{array}{l}\\text{lead}=vt=" + texInt(r.o.v) + "\\times" + v.t + "=" + texInt(r.d) + "\\ \\text{nt}\\\\ \\text{lag}=" +
        (r.d >= r.o.frag ? texInt(r.d) + "-" + texInt(r.o.frag) + "=" + texInt(r.lag) + "\\ \\text{nt}" : "0\\ \\text{nt}\\quad(vt<\\ell=" + texInt(r.o.frag) + ")") + "\\end{array}";
    },
    status: function (v) {
      var r = calc(v);
      if (!v.t) return "At t = 0 the fork has not opened, so neither strand has begun.";
      if (!r.lag) return "The leading strand already has <b>" + txtInt(r.d) + " nt</b>, but the lagging strand has none yet: " + (r.k ? "primase has only just laid its first primer, now that " + txtInt(r.o.frag) + " nt of its template is exposed."
        : "primase waits until about " + txtInt(r.o.frag) + " nt of its template is exposed.");
      return "The leading strand has <b>" + txtInt(r.d) + " nt</b> in one piece; the lagging strand has <b>" + txtInt(r.lag) + " nt</b> in <b>" + r.pieces + "</b> piece" + (r.pieces > 1 ? "s" : "") +
        ", one fragment (" + txtInt(r.o.frag) + " nt) behind.";
    },
    examples: [
      {name: "fork not open", values: {t: 0}},
      {name: "E. coli, 10 s", values: {t: 10, cell: "E. coli"}},
      {name: "E. coli, lagging not started", values: {t: 1, cell: "E. coli"}},
      {name: "human, 10 s", values: {t: 10, cell: "human"}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, r = calc(v), o = r.o, dmax = o.v * TMAX, LEAD = c.c3, LAG = c.c1;
      // ---- the fork, to scale ----
      var x0 = 52, x1 = 330, X = function (nt) { return x0 + (x1 - x0) * nt / dmax; }, xf = X(r.d);
      var yTa = 36, yLd = 52, yLg = 100, yTb = 116, yP = 70, yQ = 82, xe = 380;
      var bend = Math.min(12, xf - x0);
      var open = xf - x0 > 1, flat = xf - bend > x0, yTop = open && flat ? yTa : yP, yBot = open && flat ? yTb : yQ;
      api.polyline((open ? [[x0, yTop]] : []).concat(flat ? [[xf - bend, yTa]] : []).concat([[xf, yP], [xe, yP]]), {stroke: c.c2, width: 3});
      api.polyline((open ? [[x0, yBot]] : []).concat(flat ? [[xf - bend, yTb]] : []).concat([[xf, yQ], [xe, yQ]]), {stroke: c.c2, width: 3});
      for (var x = xf + 5; x < xe; x += 8) api.line([x, yP + 2], [x, yQ - 2], {color: c.faint, width: 1});
      // template polarity: the top strand runs 3' to 5' left to right, the bottom 5' to 3'
      api.label([x0 - 14, yTop], "3′", {color: c.c2, size: 12, anchor: "middle"});
      api.label([x0 - 14, yBot], "5′", {color: c.c2, size: 12, anchor: "middle"});
      api.label([xe + 9, yP], "5′", {color: c.c2, size: 12, anchor: "middle"});
      api.label([xe + 9, yQ], "3′", {color: c.c2, size: 12, anchor: "middle"});
      if (r.d > 0) {
        var le = Math.max(x0 + 2, xf - bend - 1);
        api.line([x0, yLd], [le, yLd], {color: LEAD, width: 4});
        if (le - x0 > 12) api.polygon([[le + 3, yLd], [le - 6, yLd - 5], [le - 6, yLd + 5]], {fill: LEAD, fillOpacity: 1});
        api.rect(x0, yLd - 3.5, 3, 7, {fill: c.c5, rx: 1});
        api.label([x0 - 7, yLd], "primer", {color: c.c5, size: 12, anchor: "end"});
      }
      for (var j = 1; j <= r.k; j++) {
        var hi = j * o.frag, lo = j < r.k ? (j - 1) * o.frag : hi - r.s;
        var b = Math.min(X(hi) - 0.8, xf - bend - 1), a = Math.min(X(lo) + 0.8, b - 3);
        if (j < r.k || r.s > 1e-9) api.line([a, yLg], [b, yLg], {color: LAG, width: 4});   // a primer laid this instant has no DNA yet
        if (b - a > 14) api.polygon([[a - 2, yLg], [a + 7, yLg - 5], [a + 7, yLg + 5]], {fill: LAG, fillOpacity: 1});
        api.rect(b - 3, yLg - 3.5, 3, 7, {fill: c.c5, rx: 1});
      }
      api.rect(xf - 6, yP - 12, 12, yQ - yP + 24, {fill: c.c6, fillOpacity: 0.3, stroke: c.c6, width: 1.5, rx: 6});
      api.label([xf + 10, yP - 20], "helicase", {color: c.c6, size: 12, weight: 650});
      api.label([x0, 16], "leading", {color: LEAD, size: 12, weight: 650});
      api.label([x0, yTb + 18], "lagging", {color: LAG, size: 12, weight: 650});
      // ---- new DNA against time ----
      var gx0 = 62, gx1 = 336, gy0 = 290, gy1 = 172;
      var GX = function (t) { return gx0 + (gx1 - gx0) * t / TMAX; }, GY = function (nt) { return gy0 - (gy0 - gy1) * nt / dmax; };
      api.line([gx0, gy0], [gx1 + 6, gy0], {color: c.axis, width: 1.2});
      api.line([gx0, gy0], [gx0, gy1 - 8], {color: c.axis, width: 1.2});
      for (var q = 0; q <= TMAX; q += 2) api.label([GX(q), gy0 + 13], String(q), {color: c.muted, size: 12, anchor: "middle"});
      api.label([gx1 + 12, gy0 + 1], "t (s)", {color: c.muted, size: 12});
      [0, dmax / 2, dmax].forEach(function (nt) { api.label([gx0 - 6, GY(nt)], nt >= 1000 ? api.fmt(nt / 1000) + "k" : api.fmt(nt), {color: c.muted, size: 12, anchor: "end"}); });
      api.label([gx0 + 6, gy1 - 12], "new DNA (nt)", {color: c.muted, size: 12});
      api.line([GX(0), GY(0)], [GX(TMAX), GY(dmax)], {color: LEAD, width: 2.5});
      var t0 = o.frag / o.v;
      api.line([GX(0), GY(0) - 1], [GX(t0), GY(0) - 1], {color: LAG, width: 2.5});
      api.line([GX(t0), GY(0)], [GX(TMAX), GY(dmax - o.frag)], {color: LAG, width: 2.5});
      // line names past the right ends, where the time marker never reaches
      api.label([gx1 + 12, GY(dmax)], "leading", {color: LEAD, size: 12});
      api.label([gx1 + 12, GY(dmax - o.frag)], "lagging", {color: LAG, size: 12});
      if (v.t > 0) {
        var gt = GX(v.t), yd = GY(r.d), gap = "gap " + txtInt(r.d - r.lag) + " nt", w = gap.length * 12 * 0.56;
        var slope = (gy0 - gy1) / (gx1 - gx0);   // both lines rise this many px per px
        api.line([gt, gy0], [gt, yd - 4], {color: c.faint, width: 1, dash: "3 3"});
        var bx = v.t < TMAX ? gt + 7 : gt - 7;
        api.line([bx, yd], [bx, GY(r.lag)], {color: c.ink, width: 1.5});
        if (gy0 - GY(r.lag) < 20) {
          // lagging still at the axis: name the gap above the leading dot, kept right of the y axis and clear of the line
          var right = Math.max(gt + 4, gx0 + 8 + w), ly = Math.min(yd - 12, yd - (right - gt) * slope - 10);
          api.label([right, ly], gap, {color: c.ink, size: 12, anchor: "end"});
          if (yd - ly > 16) api.line([bx, ly + 8], [bx, yd - 1], {color: c.faint, width: 1});   // leader down to the gap bar
        } else api.label([gt - 8, yd - 12], gap, {color: c.ink, size: 12, anchor: "end"});
      }
      api.point([GX(v.t), GY(r.d)], {color: LEAD, r: 4.5});
      api.point([GX(v.t), GY(r.lag)], {color: LAG, r: 4.5});
      api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
