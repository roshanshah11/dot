// Mitosis in an animal cell with 2n chromosomes (homologous pairs: maternal blue, paternal red). S phase has already
// copied every chromosome, so a G2 cell holds 2n chromosomes as 4n chromatids (4C of DNA). Prophase: chromosomes
// condense, the duplicated centrosomes move apart and grow the spindle. Prometaphase: the nuclear envelope breaks up and
// kinetochore microtubules capture the chromosomes. Metaphase: all centromeres line up on the plate, sisters attached to
// opposite poles. Anaphase: cohesin is cut and the sisters, now chromosomes of their own, are pulled centromere first to
// the poles, so for a moment the cell holds 2 x 2n chromosomes. Telophase and cytokinesis: nuclei re-form, an
// actin-myosin ring pinches the cell, and each daughter gets 2n chromosomes of one chromatid each (2C), like its mother.
(function () {
  var LEN = [34, 28, 22, 16];
  var SLOT = [[-34, -26, 35], [18, -36, -40], [38, 0, 75], [-6, -2, -15], [-36, 24, 70], [12, 32, 20], [36, 32, -55], [-12, 46, 0]];
  function counts(v) {
    var s = v.step || 1, n = v.n2;
    if (s === 5) return {chr: 2 * n, cht: 2 * n, C: 4, cells: 1};
    if (s === 6) return {chr: n, cht: n, C: 2, cells: 2};
    return {chr: n, cht: 2 * n, C: 4, cells: 1};
  }
  Viz.register("mitosis", {
    title: "Mitosis: one cell becomes two",
    subject: "biology",
    shows: "Step a cell with 2n chromosomes through prophase, prometaphase, metaphase, anaphase and telophase: duplicated chromosomes line up, sister chromatids split to opposite poles, and each daughter ends with the same 2n chromosomes as the mother",
    params: {
      n2: {kind: "integer", default: 4, min: 2, max: 8, step: 2, label: "2n"}
    },
    steps: ["interphase (G2)", "prophase", "prometaphase", "metaphase", "anaphase", "telophase and cytokinesis"],
    stepMs: 1700,
    formula: function (v) {
      var k = counts(v), s = v.step || 1;
      return "2n=" + v.n2 + (s === 6 ? "\\quad\\text{(each daughter)}" : s === 5 ? "\\quad\\text{(one cell)}" : "") +
        "\\newline \\text{chromosomes}=" + k.chr + "\\newline \\text{chromatids}=" + k.cht + ",\\ \\text{DNA}=" + k.C + "C";
    },
    status: function (v) {
      var s = v.step || 1, n = v.n2, k = counts(v);
      return ["Interphase (G2): DNA was copied in S phase, so the nucleus holds <b>" + n + " chromosomes</b> as <b>" + 2 * n + " chromatids</b>, still unwound, and the centrosome has duplicated.",
        "Prophase: the chromatin condenses into <b>" + n + "</b> visible chromosomes, each two sister chromatids joined at the centromere, while the centrosomes move apart and start the spindle.",
        "Prometaphase: the nuclear envelope breaks up and microtubules from both poles <b>capture kinetochores</b>, dragging the chromosomes toward the middle.",
        "Metaphase: all <b>" + n + "</b> chromosomes line up on the metaphase plate, each sister chromatid attached to the <b>opposite pole</b>.",
        "Anaphase: cohesin is cut and the sisters separate, so for a moment the cell holds <b>" + k.chr + " chromosomes</b>, half moving centromere first to each pole.",
        "Telophase and cytokinesis: nuclei re-form and the furrow pinches the cell into <b>2 daughters</b>, each with <b>" + n + "</b> single-chromatid chromosomes, the same set as the mother."][s - 1];
    },
    examples: [
      {name: "2n = 2 in metaphase (minimum)", values: {n2: 2, step: 4}},
      {name: "2n = 8 in anaphase (maximum)", values: {n2: 8, step: 5}},
      {name: "2n = 4, interphase", values: {n2: 4, step: 1}},
      {name: "2n = 6, two daughter cells", values: {n2: 6, step: 6}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, n = v.n2, cx = 200, cy = 152;
      var col = function (i) { return i % 2 ? c.c5 : c.c2; }, len = function (i) { return LEN[Math.floor(i / 2)]; };
      var ell = function (x, y, rx, ry, o) { api.path("M " + (x - rx) + " " + y + " A " + rx + " " + ry + " 0 1 0 " + (x + rx) + " " + y + " A " + rx + " " + ry + " 0 1 0 " + (x - rx) + " " + y, o); };
      var centrosome = function (x, y) {
        for (var a = 0; a < 12; a++) { var t = a * Math.PI / 6; api.line([x + 7 * Math.cos(t), y + 7 * Math.sin(t)], [x + 15 * Math.cos(t), y + 15 * Math.sin(t)], {color: c.muted, width: 1, opacity: 0.6}); }
        api.rect(x - 5, y - 2, 10, 4, {fill: c.c3, rx: 1.5}); api.rect(x - 2, y - 5, 4, 10, {fill: c.c3, rx: 1.5});
      };
      // a duplicated chromosome: two sister chromatids side by side, joined at the centromere
      var dup = function (x, y, ang, L, color) {
        var ux = Math.cos(ang), uy = Math.sin(ang), px = -uy * 3.6, py = ux * 3.6;
        [-1, 1].forEach(function (sg) {
          api.path("M " + (x - ux * L / 2 + sg * px) + " " + (y - uy * L / 2 + sg * py) + " Q " + (x + sg * px * 0.25) + " " + (y + sg * py * 0.25) + " " + (x + ux * L / 2 + sg * px) + " " + (y + uy * L / 2 + sg * py), {stroke: color, width: 5.5});
        });
        api.circle([x, y], 2.6, {fill: c.ink});
      };
      // a single chromatid moving centromere first (dir -1 = left, +1 = right)
      var single = function (x, y, L, color, dir) {
        api.path("M " + (x - dir * L * 0.42) + " " + (y - L * 0.42) + " Q " + x + " " + y + " " + (x - dir * L * 0.42) + " " + (y + L * 0.42), {stroke: color, width: 4.5});
        api.circle([x, y], 2.4, {fill: c.ink});
      };
      // unwound chromatin; pair = true draws the two copies S phase made, side by side
      var squiggle = function (x, y, L, color, seed, op, pair) {
        (pair ? [-1.6, 1.6] : [0]).forEach(function (off) {
          var pts = [];
          for (var k = 0; k <= 14; k++) { var t = k / 14; pts.push([x + (t - 0.5) * L * 1.6 + 3 * Math.sin(seed + t * 9), y + off + 5 * Math.sin(seed * 2 + t * 12)]); }
          var e = api.polyline(pts, {stroke: color, width: pair ? 1.3 : 1.8}); e.setAttribute("opacity", op || 0.8);
        });
      };
      // centromere heights on the metaphase plate, centered; long sets are shrunk to fit the cell
      var tot = 0; for (var k = 0; k < n; k++) tot += len(k) + 5;
      var fit = Math.min(1, 172 / tot);
      var plateY = function (i) {
        var y = cy - tot * fit / 2; for (var j = 0; j < i; j++) y += (len(j) + 5) * fit;
        return y + (len(i) + 5) * fit / 2;
      };
      var tag = function (txt, color, at, to, anchor) {   // a label in the margin with a leader from its end to the feature
        var t = api.label(at, txt, {color: color, size: 12, weight: 600, anchor: anchor || "start"}), x = Number(t.getAttribute("x"));
        var w = (t.getComputedTextLength && t.getComputedTextLength()) || txt.length * 6.1;
        var from = anchor === "end" ? [x - w - 4, at[1]] : anchor === "middle" ? [x, at[1] + 8] : [x + w + 4, at[1]];
        if (to) api.line(from, to, {color: color, width: 1, opacity: 0.6});
      };
      if (s <= 4) ell(cx, cy, 124, 100, {stroke: c.ink, width: 2, fill: c.ink, fillOpacity: 0.03});
      if (s === 5) ell(cx, cy, 150, 92, {stroke: c.ink, width: 2, fill: c.ink, fillOpacity: 0.03});
      var poleX = s === 5 ? 132 : 110;
      if (s <= 2) {
        // intact nucleus
        api.circle([cx, cy], 64, {stroke: c.c1, width: 2.5, fill: c.c1, fillOpacity: 0.05});
        if (s === 1) {
          api.circle([cx + 34, cy + 36], 8, {fill: c.muted, fillOpacity: 0.5});
          for (var i = 0; i < n; i++) squiggle(cx + SLOT[i][0] * 0.6, cy + SLOT[i][1] * 0.6, len(i) * 0.8, col(i), i * 1.7, 0.85, true);
          centrosome(cx - 34, cy - 76); centrosome(cx - 12, cy - 80);
          tag("2 centrosomes", c.c3, [14, 22], [cx - 42, cy - 80]);
          tag("chromatin: copied, unwound", c.ink, [392, 22], [cx + 18, cy - 28], "end");
          tag("nucleus", c.c1, [392, 280], [cx + 50, cy + 40], "end");
          tag("nucleolus", c.muted, [14, 280], [cx + 28, cy + 42]);
        } else {
          for (var j = 0; j < n; j++) dup(cx + SLOT[j][0], cy + SLOT[j][1], SLOT[j][2] * Math.PI / 180, len(j), col(j));
          var pa = [cx - 70, cy - 66], pb = [cx + 70, cy - 66];
          for (var m = -2; m <= 2; m++) api.path("M " + pa[0] + " " + pa[1] + " Q " + cx + " " + (cy - 96 + m * 6) + " " + pb[0] + " " + pb[1], {stroke: c.muted, width: 1, opacity: 0.6});
          centrosome(pa[0], pa[1]); centrosome(pb[0], pb[1]);
          tag("spindle forming", c.muted, [392, 22], [cx + 40, cy - 90], "end");
          tag("envelope still intact", c.c1, [392, 280], [cx + 50, cy + 40], "end");
          tag("2 sister chromatids each", c.ink, [14, 22], [cx + SLOT[0][0] - 12, cy + SLOT[0][1] - 8]);
        }
      } else if (s <= 5) {
        var L = [cx - poleX, cy], R = [cx + poleX, cy];
        // polar microtubules overlapping in the middle, astral ones toward the cortex
        [-24, -10, 10, 24].forEach(function (dy) {
          api.line(L, [cx + 12, cy + dy], {color: c.muted, width: 1, opacity: 0.25}); api.line(R, [cx - 12, cy + dy], {color: c.muted, width: 1, opacity: 0.25});
        });
        if (s === 3) {
          // envelope fragments
          for (var f = 0; f < 10; f++) { var a0 = f * 0.628 + 0.15; api.path("M " + (cx + 66 * Math.cos(a0)) + " " + (cy + 66 * Math.sin(a0)) + " A 66 66 0 0 1 " + (cx + 66 * Math.cos(a0 + 0.3)) + " " + (cy + 66 * Math.sin(a0 + 0.3)), {stroke: c.c1, width: 2.5, opacity: 0.7}); }
          for (var q = 0; q < n; q++) {
            var tx = cx + SLOT[q][0] * 0.95, ty = (cy + SLOT[q][1] * 0.9 + plateY(q)) / 2, attachL = q % 3 !== 2;
            api.line(attachL ? L : R, [tx + (attachL ? -3 : 3), ty], {color: c.muted, width: 1.3});
            dup(tx, ty, (SLOT[q][2] * 0.5 + 90) * Math.PI / 180, len(q), col(q));
          }
          tag("nuclear envelope breaks up", c.c1, [392, 22], [cx + 58, cy - 32], "end");
          tag("kinetochore microtubules capture chromosomes", c.muted, [cx, 280], null, "middle");
        } else if (s === 4) {
          api.line([cx, cy - 100], [cx, cy + 100], {color: c.faint, width: 1, dash: "3 4"});
          for (var p = 0; p < n; p++) {
            var y = plateY(p);
            api.line(L, [cx - 4, y], {color: c.muted, width: 1.3}); api.line(R, [cx + 4, y], {color: c.muted, width: 1.3});
            dup(cx, y, Math.PI / 2, len(p) * fit, col(p));
          }
          tag("metaphase plate", c.ink, [cx, 24], null, "middle");
          tag("each sister faces its own pole", c.muted, [cx, 280], null, "middle");
        } else {
          var k5 = 0.8;   // rows packed a little tighter than on the plate so the set fits the elongated cell
          for (var r = 0; r < n; r++) {
            var y5 = cy + (plateY(r) - cy) * k5, st = n >= 4 ? (r % 2 ? 7 : -7) : 0;
            [-1, 1].forEach(function (dir) {
              var xc = cx + dir * (64 + st);
              api.line(dir < 0 ? L : R, [xc, y5], {color: c.muted, width: 1.3});
              single(xc, y5, len(r) * fit * k5, col(r), dir);
            });
          }
          api.arrow([cx - 22, cy - 80], [cx - 66, cy - 80], {color: c.ink, width: 2, halo: false});
          api.arrow([cx + 22, cy - 80], [cx + 66, cy - 80], {color: c.ink, width: 2, halo: false});
          tag("sister chromatids pulled to opposite poles", c.muted, [cx, 280], null, "middle");
        }
        centrosome(L[0], L[1]); centrosome(R[0], R[1]);
        api.label([L[0] + 6, cy + 24], "pole", {color: c.c3, size: 12, anchor: "middle"});
        api.label([R[0] - 6, cy + 24], "pole", {color: c.c3, size: 12, anchor: "middle"});
      } else {
        // two daughters joined by a narrowing furrow
        var a = 80, Rr = 90, top = [], bot = [];
        for (var x = -a - Rr; x <= a + Rr + 0.01; x += 4) {
          var h = Math.max(Rr * Rr - (x - a) * (x - a), Rr * Rr - (x + a) * (x + a));
          h = Math.sqrt(Math.max(0, h));
          top.push([cx + x, cy - h]); bot.unshift([cx + x, cy + h]);
        }
        api.polygon(top.concat(bot), {stroke: c.ink, width: 2, fill: c.ink, fillOpacity: 0.03});
        var neck = Math.sqrt(Rr * Rr - a * a);
        api.rect(cx - 4, cy - neck - 4, 8, 8, {fill: c.c4, rx: 2}); api.rect(cx - 4, cy + neck - 4, 8, 8, {fill: c.c4, rx: 2});
        tag("cleavage furrow: actin-myosin ring", c.c4, [cx, 22], [cx, cy - neck - 6], "middle");
        [-1, 1].forEach(function (dir) {
          var nx = cx + dir * (a + 6);
          api.circle([nx, cy], 40, {stroke: c.c1, width: 2.5, dash: "10 4", fill: c.c1, fillOpacity: 0.05});
          for (var i6 = 0; i6 < n; i6++) squiggle(nx + SLOT[i6][0] * 0.45, cy + SLOT[i6][1] * 0.5, len(i6) * 0.85, col(i6), i6 * 1.3 + dir, 0.9);
          centrosome(nx + dir * 50, cy - 56);
        });
        api.label([cx - a - 6, cy + 54], "2n = " + n, {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
        api.label([cx + a + 6, cy + 54], "2n = " + n, {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
        tag("nuclei re-form; chromosomes unwind", c.c1, [cx, 280], null, "middle");
      }
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
