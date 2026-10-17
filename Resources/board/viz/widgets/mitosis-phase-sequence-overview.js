// The order of mitosis at a glance: a strip of six thumbnails (prophase, prometaphase, metaphase, anaphase,
// telophase, cytokinesis) to step through, the current phase drawn large with its nuclear envelope, chromosomes and
// spindle labelled in their own colors, and where M phase sits in the whole cell cycle. Phase lengths for a typical
// rapidly dividing human cell with a 24 h cycle: G1 about 11 h, S about 8 h, G2 about 4 h, M about 1 h (Cooper, The
// Cell; BioNumbers 112260). Each chromosome is two sister chromatids until anaphase, when the sisters part and each
// becomes a chromosome of one chromatid. Cytokinesis usually begins in late anaphase and overlaps telophase.
(function () {
  var NAMES = ["prophase", "prometaphase", "metaphase", "anaphase", "telophase", "cytokinesis"];
  var FACTS = [   // [envelope, chromosomes, spindle], each one or two short lines
    [["still intact;", "the nucleolus fades"], ["condense: each is two", "sister chromatids"], ["centrosomes move apart,", "asters grow"]],
    [["breaks up into vesicles"], ["kinetochores form at", "each centromere"], ["microtubules capture", "the kinetochores"]],
    [["gone"], ["lined up on the", "metaphase plate"], ["sisters held by fibers", "from opposite poles"]],
    [["gone"], ["sisters part as", "separase cuts cohesin"], ["kinetochore fibers shorten;", "poles move apart"]],
    [["re-forms around each set"], ["unwind at the two poles"], ["breaks down; the midzone", "bundle stays"]],
    [["one interphase nucleus", "in each daughter"], ["2n in each daughter,", "the same set as the mother"], ["midzone bundle pinched", "into the midbody"]]];
  var CPC = [2, 2, 2, 1, 1, 1], NUC = [1, 0, 0, 0, 2, 2], CELLS = [1, 1, 1, 1, 1, 2];
  Viz.register("mitosis-phase-sequence-overview", {
    title: "Mitosis: the phases in order",
    subject: "biology",
    shows: "Step through prophase, prometaphase, metaphase, anaphase, telophase and cytokinesis: what the envelope, the chromosomes and the spindle do in each, and how M phase is only about an hour of a 24-hour cycle",
    params: {},
    steps: NAMES,
    stepMs: 1700,
    formula: function (v) {
      var i = (v.step || 1) - 1;
      return "\\text{phase } " + (i + 1) + "/6:\\ \\text{" + NAMES[i] + "}\\newline \\text{chromatids per chromosome}=" + CPC[i] +
        "\\newline \\text{nuclei}=" + NUC[i] + ",\\ \\ \\text{cells}=" + CELLS[i] +
        "\\newline \\dfrac{t_M}{t_{\\text{cycle}}}\\approx\\dfrac{1\\ \\text{h}}{24\\ \\text{h}}\\approx 4\\%";
    },
    status: function (v) {
      return ["Prophase: chromatin condenses into visible chromosomes and the two centrosomes move apart, but the <b>envelope is still intact</b>.",
        "Prometaphase: the <b>envelope breaks up</b>, so spindle microtubules can reach and capture the kinetochores.",
        "Metaphase: every chromosome sits <b>on the plate</b>, its sisters attached to opposite poles, and the checkpoint lets the cell go on.",
        "Anaphase: cohesin is cut and the <b>sister chromatids separate</b>, pulled to opposite poles; it is the shortest phase.",
        "Telophase: at each pole a <b>new envelope forms</b> and the chromosomes unwind, so there are now two nuclei in one cell.",
        "Cytokinesis, starting in late anaphase: a contractile ring <b>splits the cytoplasm</b>, leaving two daughters back in interphase (G1)."][(v.step || 1) - 1];
    },
    examples: [
      {name: "first: prophase", values: {step: 1}},
      {name: "metaphase", values: {step: 3}},
      {name: "anaphase: sisters part", values: {step: 4}},
      {name: "last: cytokinesis", values: {step: 6}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, y0 = 22;
      var X = function (i) { return 32 + i * 64; };
      var ell = function (x, y, rx, ry, o) { return api.path("M " + (x - rx) + " " + y + " A " + rx + " " + ry + " 0 1 0 " + (x + rx) + " " + y + " A " + rx + " " + ry + " 0 1 0 " + (x - rx) + " " + y, o); };
      // ---- the navigator: six thumbnails (envelope c1, chromosomes c2, spindle c3, as in the big drawing)
      var mini = function (i, x, y, op) {
        var g = api.group({opacity: op, transform: "translate(" + x + " " + y + ") scale(0.62) translate(" + (-x) + " " + (-y) + ")"});
        var o = function (extra) { return Object.assign({parent: g}, extra); };
        var chrom = function (cx2, cy2, ang) { var dx = Math.cos(ang) * 4, dy = Math.sin(ang) * 4; api.line([cx2 - dx, cy2 - dy], [cx2 + dx, cy2 + dy], o({color: c.c2, width: 3})); api.line([cx2 + dy * 0.6 - dx, cy2 - dx * 0.6 - dy], [cx2 + dy * 0.6 + dx, cy2 - dx * 0.6 + dy], o({color: c.c2, width: 3})); };
        var pole = function (px, py) { api.circle([px, py], 3, o({fill: c.c3})); };
        var fib = function (a, b) { api.line(a, b, o({color: c.c3, width: 1.2, opacity: 0.8})); };
        if (i === 0) {
          api.circle([x, y], 23, o({stroke: c.ink, width: 1.6}));
          api.circle([x, y + 3], 13, o({stroke: c.c1, width: 1.8}));
          chrom(x - 5, y + 1, 0.6); chrom(x + 5, y + 6, -0.9);
          pole(x - 9, y - 16); pole(x + 9, y - 16);
        } else if (i === 1) {
          api.circle([x, y], 23, o({stroke: c.ink, width: 1.6}));
          api.circle([x, y], 13, o({stroke: c.c1, width: 1.8, dash: "4 4"}));
          pole(x - 15, y); pole(x + 15, y); fib([x - 15, y], [x - 3, y - 5]); fib([x + 15, y], [x + 5, y + 5]);
          chrom(x - 3, y - 5, 1.2); chrom(x + 5, y + 5, 0.3);
        } else if (i === 2) {
          api.circle([x, y], 23, o({stroke: c.ink, width: 1.6}));
          [-1, 1].forEach(function (sg) { pole(x + sg * 16, y); [-8, 0, 8].forEach(function (d) { fib([x + sg * 16, y], [x + sg * 2, y + d]); }); });
          [-8, 0, 8].forEach(function (d) { chrom(x, y + d, Math.PI / 2); });
        } else if (i === 3) {
          ell(x, y, 27, 19, o({stroke: c.ink, width: 1.6}));
          [-1, 1].forEach(function (sg) { pole(x + sg * 21, y); [-7, 0, 7].forEach(function (d) { fib([x + sg * 21, y], [x + sg * 10, y + d]); api.path("M " + (x + sg * 6) + " " + (y + d - 3) + " L " + (x + sg * 10) + " " + (y + d) + " L " + (x + sg * 6) + " " + (y + d + 3), o({stroke: c.c2, width: 2.4})); }); });
        } else if (i === 4) {
          api.path("M " + (x - 27) + " " + y + " Q " + (x - 27) + " " + (y - 19) + " " + (x - 12) + " " + (y - 18) + " Q " + x + " " + (y - 13) + " " + (x + 12) + " " + (y - 18) + " Q " + (x + 27) + " " + (y - 19) + " " + (x + 27) + " " + y +
            " Q " + (x + 27) + " " + (y + 19) + " " + (x + 12) + " " + (y + 18) + " Q " + x + " " + (y + 13) + " " + (x - 12) + " " + (y + 18) + " Q " + (x - 27) + " " + (y + 19) + " " + (x - 27) + " " + y, o({stroke: c.ink, width: 1.6}));
          [-1, 1].forEach(function (sg) { api.circle([x + sg * 14, y], 8, o({stroke: c.c1, width: 1.6, dash: "3 2"})); api.path("M " + (x + sg * 14 - 4) + " " + (y - 2) + " q 2 -3 4 0 t 4 0", o({stroke: c.c2, width: 1.6})); });
          fib([x - 5, y], [x + 5, y]);
        } else {
          [-1, 1].forEach(function (sg) { api.circle([x + sg * 13, y], 13, o({stroke: c.ink, width: 1.6})); api.circle([x + sg * 13, y], 6, o({stroke: c.c1, width: 1.6})); });
          fib([x - 3, y], [x + 3, y]);
        }
      };
      for (var i = 0; i < 6; i++) {
        var cur = i === s - 1, x = X(i);
        if (cur) api.circle([x, y0], 20, {fill: c.accent, fillOpacity: 0.12, stroke: c.accent, width: 2});
        mini(i, x, y0, cur ? 1 : 0.45);
        if (i < 5) api.line([x + 21, y0], [X(i + 1) - 22, y0], {color: c.faint, width: 1.4, arrow: true});
        api.label([x, i % 2 ? 66 : 50], NAMES[i], {color: cur ? c.accent : c.muted, size: 12, weight: cur ? 700 : 500, anchor: "middle"});
      }
      // ---- the current phase, large
      var X0 = 106, Y0 = 156, tg = [null, null, null];
      var cell = function (rx, ry) { ell(X0, Y0, rx, ry, {stroke: c.ink, width: 2, fill: c.ink, fillOpacity: 0.03}); };
      var centro = function (x, y, op) {
        for (var a = 0; a < 10; a++) { var t = a * Math.PI / 5; api.line([x + 5 * Math.cos(t), y + 5 * Math.sin(t)], [x + 11 * Math.cos(t), y + 11 * Math.sin(t)], {color: c.c3, width: 1, opacity: 0.5 * (op || 1)}); }
        api.circle([x, y], 3.6, {fill: c.c3, fillOpacity: op || 1});
      };
      var fiber = function (a, b, op) { api.line(a, b, {color: c.c3, width: 1.3, opacity: op || 0.75}); };
      var dup = function (x, y, ang, L) {   // two sister chromatids joined at the centromere
        var ux = Math.cos(ang), uy = Math.sin(ang), px = -uy * 3.2, py = ux * 3.2;
        [-1, 1].forEach(function (sg) {
          api.path("M " + (x - ux * L / 2 + sg * px) + " " + (y - uy * L / 2 + sg * py) + " Q " + (x + sg * px * 0.25) + " " + (y + sg * py * 0.25) + " " + (x + ux * L / 2 + sg * px) + " " + (y + uy * L / 2 + sg * py), {stroke: c.c2, width: 4.5});
        });
        api.circle([x, y], 2.3, {fill: c.ink});
      };
      var single = function (x, y, L, dir) {   // one chromatid moving centromere first (dir -1 = left)
        api.path("M " + (x - dir * L * 0.42) + " " + (y - L * 0.42) + " Q " + x + " " + y + " " + (x - dir * L * 0.42) + " " + (y + L * 0.42), {stroke: c.c2, width: 4.5});
        api.circle([x, y], 2.2, {fill: c.ink});
      };
      var squig = function (x, y, L, seed) {
        var pts = [];
        for (var k = 0; k <= 10; k++) { var t = k / 10; pts.push([x + (t - 0.5) * L + 2 * Math.sin(seed + t * 7), y + 3 * Math.sin(seed * 2 + t * 11)]); }
        api.polyline(pts, {stroke: c.c2, width: 1.8});
      };
      if (s <= 3) cell(64, 64);
      if (s === 1) {
        api.circle([X0, Y0 + 8], 36, {stroke: c.c1, width: 2.5, fill: c.c1, fillOpacity: 0.05});
        api.circle([X0 + 18, Y0 + 28], 6, {fill: c.muted, fillOpacity: 0.3});
        [[-14, -2, 30], [14, -8, -50], [-12, 24, -80], [8, 18, 15]].forEach(function (q) { dup(X0 + q[0], Y0 + q[1], q[2] * Math.PI / 180, 20); });
        for (var m = 0; m < 3; m++) api.path("M " + (X0 - 34) + " " + (Y0 - 42) + " Q " + X0 + " " + (Y0 - 62 + m * 6) + " " + (X0 + 34) + " " + (Y0 - 42), {stroke: c.c3, width: 1.3, opacity: 0.75});
        centro(X0 - 34, Y0 - 42); centro(X0 + 34, Y0 - 42);
        tg = [[X0 + 33, Y0 - 6], [X0 + 10, Y0 + 20], [X0 + 34, Y0 - 42]];
      } else if (s === 2) {
        for (var f = 0; f < 8; f++) { var a0 = f * Math.PI / 4 + 0.2; api.path("M " + (X0 + 38 * Math.cos(a0)) + " " + (Y0 + 38 * Math.sin(a0)) + " A 38 38 0 0 1 " + (X0 + 38 * Math.cos(a0 + 0.38)) + " " + (Y0 + 38 * Math.sin(a0 + 0.38)), {stroke: c.c1, width: 2.5, opacity: 0.8}); }
        var P = [[X0 - 52, Y0], [X0 + 52, Y0]], CH = [[-16, -20, 60, 0], [14, -14, 110, 1], [-6, 12, 80, 0], [20, 24, 100, 1]];
        CH.forEach(function (q) { fiber(P[q[3]], [X0 + q[0], Y0 + q[1]]); });
        fiber(P[0], [X0 - 14, Y0 + 34], 0.45); fiber(P[1], [X0 + 26, Y0 - 34], 0.45);
        CH.forEach(function (q) { dup(X0 + q[0], Y0 + q[1], q[2] * Math.PI / 180, 20); });
        centro(P[0][0], P[0][1]); centro(P[1][0], P[1][1]);
        tg = [[X0 + 38 * Math.cos(5.89), Y0 + 38 * Math.sin(5.89)], [X0 + 22, Y0 + 26], [X0 + 52, Y0]];
      } else if (s === 3) {
        api.line([X0, Y0 - 56], [X0, Y0 + 56], {color: c.faint, width: 1, dash: "3 4"});
        [-36, -12, 12, 36].forEach(function (d) { fiber([X0 - 52, Y0], [X0 - 4, Y0 + d]); fiber([X0 + 52, Y0], [X0 + 4, Y0 + d]); });
        [-36, -12, 12, 36].forEach(function (d) { dup(X0, Y0 + d, Math.PI / 2, 18); });
        centro(X0 - 52, Y0); centro(X0 + 52, Y0);
        tg = [null, [X0 + 5, Y0 - 36], [X0 + 52, Y0]];
      } else if (s === 4) {
        cell(82, 54);
        [-6, 6].forEach(function (d) { fiber([X0 - 66, Y0], [X0 + 12, Y0 + d], 0.4); fiber([X0 + 66, Y0], [X0 - 12, Y0 + d], 0.4); });
        [-30, -10, 10, 30].forEach(function (d) {
          [-1, 1].forEach(function (dir) { fiber([X0 + dir * 66, Y0], [X0 + dir * 32, Y0 + d]); single(X0 + dir * 32, Y0 + d, 17, dir); });
        });
        api.arrow([X0 - 12, Y0 - 44], [X0 - 40, Y0 - 44], {color: c.muted, width: 1.6, halo: false});
        api.arrow([X0 + 12, Y0 - 44], [X0 + 40, Y0 - 44], {color: c.muted, width: 1.6, halo: false});
        centro(X0 - 66, Y0); centro(X0 + 66, Y0);
        tg = [null, [X0 + 34, Y0 - 30], [X0 + 66, Y0]];
      } else if (s === 5) {
        // two lobes (radius 52, centers 40 either side) meeting at a furrow 33 high
        var lo = 40, Rl = 52, top = [], bot = [];
        for (var xx = -lo - Rl; xx <= lo + Rl + 0.01; xx += 1.5) {
          var hh = Math.sqrt(Math.max(0, Rl * Rl - (xx - lo) * (xx - lo), Rl * Rl - (xx + lo) * (xx + lo)));
          top.push([X0 + xx, Y0 - hh]); bot.unshift([X0 + xx, Y0 + hh]);
        }
        api.polygon(top.concat(bot), {stroke: c.ink, width: 2, fill: c.ink, fillOpacity: 0.03});
        [-9, -3, 3, 9].forEach(function (d) { fiber([X0 - 16, Y0 + d], [X0 + 16, Y0 + d], 0.9); });
        [-1, 1].forEach(function (dir) {
          api.circle([X0 + dir * 44, Y0], 22, {stroke: c.c1, width: 2.5, dash: "7 3", fill: c.c1, fillOpacity: 0.05});
          [-9, -2, 5, 12].forEach(function (d, k) { squig(X0 + dir * 44, Y0 + d - 1, 19, k * 1.9 + dir); });
          centro(X0 + dir * 60, Y0 - 32, 0.6);
        });
        api.rect(X0 - 3, Y0 - 37, 6, 6, {fill: c.c4, rx: 2}); api.rect(X0 - 3, Y0 + 31, 6, 6, {fill: c.c4, rx: 2});
        tg = [[X0 + 44 + 22 * Math.cos(-0.7), Y0 + 22 * Math.sin(-0.7)], [X0 + 48, Y0 + 4], [X0 + 10, Y0 + 9]];
      } else {
        [-1, 1].forEach(function (dir) {
          var cxd = X0 + dir * 49;
          ell(cxd, Y0, 45, 45, {stroke: c.ink, width: 2, fill: c.ink, fillOpacity: 0.03});
          api.circle([cxd, Y0], 19, {stroke: c.c1, width: 2.5, fill: c.c1, fillOpacity: 0.05});
          [-8, -1, 6, 12].forEach(function (d, k) { squig(cxd, Y0 + d - 2, 18, k * 1.7 + dir); });
          centro(cxd + dir * 10, Y0 - 31, 0.8);
        });
        [-2, 2].forEach(function (d) { fiber([X0 - 10, Y0 + d], [X0 + 10, Y0 + d], 0.95); });
        api.rect(X0 - 3, Y0 - 10, 6, 5, {fill: c.c4, rx: 2}); api.rect(X0 - 3, Y0 + 5, 6, 5, {fill: c.c4, rx: 2});
        api.label([X0, Y0 + 58], "actin-myosin ring", {color: c.c4, size: 12, weight: 600, anchor: "middle"});
        tg = [[X0 + 49 + 19 * Math.cos(-1.1), Y0 + 19 * Math.sin(-1.1)], [X0 + 56, Y0 + 6], [X0 + 10, Y0 + 2]];
      }
      // ---- the three players, labelled where they are (sorted top to bottom so the leaders do not cross)
      var rows = [["envelope", c.c1], ["chromosomes", c.c2], ["spindle", c.c3]], F = FACTS[s - 1];
      [0, 1, 2].sort(function (a, b) { return (tg[a] ? tg[a][1] : -1) - (tg[b] ? tg[b][1] : -1); }).forEach(function (k, slot) {
        var y = 86 + slot * 50;
        if (tg[k]) { api.line([208, y], tg[k], {color: rows[k][1], width: 1.1, opacity: 0.75}); api.circle(tg[k], 2.4, {fill: rows[k][1]}); }
        api.label([214, y], rows[k][0], {color: rows[k][1], size: 12.5, weight: 700});
        F[k].forEach(function (t, j) { api.label([214, y + 14 * (j + 1)], t, {color: F[k][0] === "gone" ? c.muted : c.ink, size: 12}); });
      });
      // ---- M phase inside the whole cycle (24 h)
      var bx = 14, bw = 372, by = 250, hrs = [["G1", 11], ["S", 8], ["G2", 4], ["M", 1]], acc = 0, mx = 0;
      hrs.forEach(function (h) {
        var x0 = bx + bw * acc / 24, wd = bw * h[1] / 24, isM = h[0] === "M";
        api.rect(x0 + 0.5, by, wd - 1, 16, {fill: isM ? c.accent : c.muted, fillOpacity: isM ? 0.95 : 0.25 + 0.1 * (acc > 0), rx: 2});
        if (!isM) api.label([x0 + wd / 2, by + 8], h[0] + " ≈ " + h[1] + " h", {color: c.ink, size: 12, anchor: "middle", raw: true});
        else mx = x0 + wd / 2;
        acc += h[1];
      });
      api.line([mx, by + 17], [mx, by + 26], {color: c.accent, width: 1.2});
      api.label([mx + 4, by + 34], "M (all six phases) ≈ 1 h of a 24 h cycle", {color: c.accent, size: 12, weight: 650, anchor: "end", raw: true});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
