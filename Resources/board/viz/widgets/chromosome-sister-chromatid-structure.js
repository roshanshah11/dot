// One chromosome through a cell cycle. In G1 it is one chromatid (one DNA molecule); S phase copies it into two
// identical sister chromatids, still one chromosome because they share one centromere, held together by cohesin rings.
// By metaphase the sisters are condensed (identical bands), arm cohesin has gone (vertebrate cells keep it only at the
// centromere) and each sister's kinetochore holds microtubules from the opposite pole. In anaphase separase cuts the
// last cohesin and each chromatid becomes a chromosome of its own. The centromere's place sets the arm ratio r = q/p
// (Levan 1964: up to 1.7 metacentric, 1.7-3 submetacentric, 3-7 subtelocentric, over 7 acrocentric).
(function () {
  function kind(p) { var r = (1 - p) / p; return r <= 1.7 + 1e-9 ? "metacentric" : r <= 3 + 1e-9 ? "submetacentric" : r <= 7 + 1e-9 ? "subtelocentric" : "acrocentric"; }
  var BANDS = [0.05, 0.13, 0.21, 0.3, 0.42, 0.52, 0.6, 0.69, 0.78, 0.87, 0.95];
  Viz.register("chromosome-sister-chromatid-structure", {
    title: "Chromosome and sister chromatids",
    subject: "biology",
    shows: "Step one chromosome from G1 to anaphase and move its centromere: one chromatid becomes two identical sisters joined at the centromere, then they split into two chromosomes",
    params: {
      p: {kind: "number", default: 0.35, min: 0.1, max: 0.5, step: 0.05, label: "p\\ \\text{share}"}
    },
    steps: ["G1: one chromatid", "G2: copied, held by cohesin", "metaphase: condensed, attached", "anaphase: sisters separate"],
    stepMs: 1800,
    formula: function (v) {
      var s = v.step || 1, r = (1 - v.p) / v.p;
      var count = s === 1 ? "1\\ \\text{chromosome}=1\\ \\text{chromatid}=1\\ \\text{DNA molecule}"
        : s === 4 ? "2\\ \\text{chromosomes}\\times 1\\ \\text{chromatid}=2\\ \\text{DNA molecules}"
        : "1\\ \\text{chromosome}=2\\ \\text{sister chromatids}=2\\ \\text{DNA molecules}";
      return count + "\\newline r=\\tfrac{q}{p}=\\tfrac{" + Viz.n(1 - v.p) + "}{" + Viz.n(v.p) + "}=" + Viz.n(r) + "\\ (\\text{" + kind(v.p) + "})";
    },
    status: function (v) {
      var s = v.step || 1;
      return ["Before replication the chromosome is <b>one chromatid</b>: a single DNA molecule with one centromere and a telomere at each end.",
        "S phase has copied it: still <b>1 chromosome</b> (one centromere) but now <b>2 identical sister chromatids</b>, held together along their length by cohesin rings.",
        "Condensed, with identical bands on both sisters: each sister's <b>kinetochore</b> holds microtubules from the <b>opposite pole</b>, and cohesin now remains mainly at the centromere.",
        "Separase cuts the last cohesin, so the sisters split and move to opposite poles centromere first: each is now a <b>chromosome</b> of its own, <b>2</b> in all."][s - 1];
    },
    examples: [
      {name: "G1, acrocentric (p at minimum)", values: {p: 0.1, step: 1}},
      {name: "G2, metacentric (p at maximum)", values: {p: 0.5, step: 2}},
      {name: "metaphase, submetacentric", values: {p: 0.3, step: 3}},
      {name: "anaphase", values: {p: 0.35, step: 4}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, p = v.p, xc = 150, r = (1 - p) / p;
      var cond = s >= 3, len = cond ? 184 : 216, w = cond ? 17 : 8, yTop = cond ? 48 : 24, yc = yTop + p * len;
      var norm = function (d) { var m = Math.hypot(d[0], d[1]); return [d[0] / m, d[1] / m]; };
      // sister geometry: centromere point and unit directions of the two arms (G2 sisters 6 px off centre so a gap shows)
      var sisters = s === 1 ? [{cen: [xc, yc], up: [0, -1], dn: [0, 1], sg: 1}]
        : s === 2 ? [-1, 1].map(function (sg) { return {cen: [xc + sg * 6, yc], up: [0, -1], dn: [0, 1], sg: sg}; })
        : s === 3 ? [-1, 1].map(function (sg) { return {cen: [xc + sg * (w / 2 + 0.6), yc], up: norm([sg * 0.05, -1]), dn: norm([sg * 0.05, 1]), sg: sg}; })
        : [-1, 1].map(function (sg) { return {cen: [xc + sg * 92, yc], up: norm([-sg * 0.5, -1]), dn: norm([-sg * 0.5, 1]), sg: sg}; });
      var at = function (sis, f) {   // point at fraction f of the length, measured from the p-arm tip
        var d = f < p ? sis.up : sis.dn, k = f < p ? (p - f) * len : (f - p) * len;
        return [sis.cen[0] + d[0] * k, sis.cen[1] + d[1] * k];
      };
      // spindle (metaphase and anaphase)
      var poles = [20, 280];
      if (cond) {
        poles.forEach(function (px) { api.circle([px, yc], 5, {fill: c.ink, fillOpacity: 0.7}); });
        sisters.forEach(function (sis) {
          var kx = sis.cen[0] + sis.sg * (w / 2 + 5), pole = sis.sg < 0 ? poles[0] : poles[1];
          [-5, 0, 5].forEach(function (dy) { api.line([kx, yc + dy], [pole, yc], {color: c.muted, width: 1.1, opacity: 0.8}); });
        });
      } else {
        // p/q ruler beside the straight chromosome: the centromere splits the length into p and q shares
        var RX = 110;
        [[yTop, yc - 4, "p " + api.fmt(p)], [yc + 4, yTop + len, "q " + api.fmt(1 - p)]].forEach(function (b) {
          api.path("M " + (RX + 6) + " " + b[0] + " H " + RX + " V " + b[1] + " H " + (RX + 6), {stroke: c.muted, width: 1.4});
          api.label([RX - 7, (b[0] + b[1]) / 2], b[2], {color: c.c2, size: 12.5, weight: 650, anchor: "end"});
        });
      }
      // chromatids: two arms meeting at the centromere constriction; wavy and thin while decondensed
      sisters.forEach(function (sis) {
        [[sis.up, p * len], [sis.dn, (1 - p) * len]].forEach(function (arm) {
          var d = arm[0], L = arm[1], nx = -d[1], ny = d[0], pts = [];
          for (var k = 0; k <= 24; k++) {
            var t = 2.5 + (L - 2.5) * k / 24, wig = cond ? 0 : 2.6 * Math.sin(t * 0.22);
            pts.push([sis.cen[0] + d[0] * t + nx * wig, sis.cen[1] + d[1] * t + ny * wig]);
          }
          var e = api.polyline(pts, {stroke: c.c2, width: w}); e.setAttribute("opacity", 0.9);
          api.circle(pts[pts.length - 1], w / 2 + 0.4, {fill: c.c6});
        });
        if (cond) BANDS.forEach(function (f) {
          if (Math.abs(f - p) < 0.04) return;
          var q = at(sis, f), d = f < p ? sis.up : sis.dn, nx = -d[1] * w * 0.42, ny = d[0] * w * 0.42;
          api.line([q[0] - nx, q[1] - ny], [q[0] + nx, q[1] + ny], {color: c.card, width: 3, opacity: 0.55});
        });
        if (cond) api.rect(sis.cen[0] + (sis.sg > 0 ? w / 2 + 0.5 : -w / 2 - 5.5), yc - 8, 5, 16, {fill: c.c3, rx: 2});
        else api.circle(sis.cen, w / 2 + 0.5, {fill: c.ink, fillOpacity: 0.85});
      });
      // cohesin: rings round both sisters, along the arms in G2, at the centromere in metaphase, cut in anaphase
      var rx = s === 2 ? 14 : w + 4;
      var ring = function (y) { var ry = 3.2; api.path("M " + (xc - rx) + " " + y + " A " + rx + " " + ry + " 0 1 0 " + (xc + rx) + " " + y + " A " + rx + " " + ry + " 0 1 0 " + (xc - rx) + " " + y, {stroke: c.c4, width: 1.8}); };
      var cohY = null;
      // the cohesin leader points at the f = 0.9 ring, well clear of the q-arm anchor
      if (s === 2) [0.1, 0.24, 0.48, 0.62, 0.76, 0.9].forEach(function (f) { if (Math.abs(f - p) > 0.05) { var y = yTop + f * len; ring(y); if (f === 0.9) cohY = y; } });
      if (s === 3) { ring(yc - 10); ring(yc + 10); cohY = yc + 10; }
      if (s === 4) {
        [-1, 1].forEach(function (sg) { api.path("M " + (xc + sg * 4) + " " + (yc - 6) + " Q " + (xc + sg * 12) + " " + yc + " " + (xc + sg * 4) + " " + (yc + 6), {stroke: c.c4, width: 1.8}); });
        api.label([xc, yc + 22], "cohesin cut", {color: c.c4, size: 12.5, weight: 650, anchor: "middle"});
      }
      // labels in a column on the right, each with a leader to its feature on the right-hand sister
      var R = sisters[sisters.length - 1], tipTop = at(R, 0);
      var items = [["telomere", [tipTop[0], tipTop[1]], c.c6, tipTop[1] - 6], ["p arm", at(R, p / 2), c.c2, yTop + p * len / 2],
        ["centromere", R.cen, c.ink, yc - 14]];
      if (cond) items.push(["kinetochore", [R.cen[0] + w / 2 + 3, yc + 6], c.c3, yc + 12]);
      if (cohY != null) items.push(["cohesin", [xc + rx, cohY], c.c4, cohY + 4]);
      // q arm: mid-arm, except in G2 where 0.69 sits between the 0.62 and 0.76 rings (both drawn for every p <= 0.5)
      var qf = s === 2 ? 0.69 : (1 + p) / 2;
      items.push(["q arm", at(R, qf), c.c2, yTop + qf * len + 10]);
      // top to bottom along the chromosome: telomere, p arm, centromere, kinetochore, then the rest by height
      var rank = {"telomere": 0, "p arm": 1, "centromere": 2, "kinetochore": 3};
      var rk = function (it) { return it[0] in rank ? rank[it[0]] : 4; };
      items.sort(function (a, b) { return rk(a) - rk(b) || a[3] - b[3]; });
      var last = -1e9;
      items.forEach(function (it) { it[3] = Math.max(it[3], last + 17, 12); last = it[3]; });
      var over = last - 250; if (over > 0) items.forEach(function (it) { it[3] -= over; });
      items.forEach(function (it) {
        api.line([304, it[3]], [it[1][0] + 4, it[1][1]], {color: it[2], width: 1, dash: "2 3", opacity: 0.7});
        api.label([308, it[3]], it[0], {color: it[2], size: 12.5, weight: 650});
      });
      // Levan strip: arm ratio r = q/p on a log scale from 1 to 10, the four classes, a marker at this r
      var SX0 = 10, SX1 = 390, SY = 286, LN = Math.log(10), K = kind(p);
      var sx = function (q) { return SX0 + Math.log(q) / LN * (SX1 - SX0); };
      var segs = [[1, 1.7, "metacentric"], [1.7, 3, "submetacentric"], [3, 7, "subtelocentric"], [7, 10, "acrocentric"]];
      segs.forEach(function (g) {
        var a = sx(g[0]) + (g[0] > 1 ? 1 : 0), b = sx(g[1]) - (g[1] < 10 ? 1 : 0), on = g[2] === K;
        api.rect(a, SY - 4, b - a, 8, {fill: c.ink, fillOpacity: on ? 0.34 : 0.1, rx: 2});
        api.label([(a + b) / 2, SY - 16], g[2], {color: on ? c.ink : c.muted, size: 12, weight: on ? 650 : 500, anchor: "middle"});
      });
      var mx = sx(r), mtxt = "q/p " + api.fmt(r), mhalf = mtxt.length * 12.5 * 0.28;
      [1.7, 3, 7].forEach(function (q) {
        var t = String(q), bx = sx(q);
        if (Math.abs(bx - mx) > mhalf + t.length * 3.4 + 14) api.label([bx, SY + 18], t, {color: c.muted, size: 12, anchor: "middle"});
      });
      api.circle([mx, SY], 5, {fill: c.ink, stroke: c.card, width: 2});
      api.label([mx, SY + 18], mtxt, {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
