// The order of mitosis at a glance: six thumbnails (prophase, prometaphase, metaphase, anaphase, telophase,
// cytokinesis), what the nuclear envelope, the chromosomes and the spindle are doing in the current one, and where
// M phase sits in the whole cell cycle. Phase lengths for a typical rapidly dividing human cell with a 24 h cycle:
// G1 about 11 h, S about 8 h, G2 about 4 h, M about 1 h (Cooper, The Cell; BioNumbers 112260). The sub-phases of M are
// drawn equal, not to scale. Cytokinesis usually begins in late anaphase and overlaps telophase.
(function () {
  var NAMES = ["prophase", "prometaphase", "metaphase", "anaphase", "telophase", "cytokinesis"];
  var FACTS = [
    ["intact; the nucleolus fades", "condense: two sister chromatids each", "centrosomes move apart, asters grow"],
    ["breaks up into vesicles", "kinetochores form at the centromeres", "microtubules capture the kinetochores"],
    ["gone", "lined up on the metaphase plate", "sisters held by opposite poles"],
    ["gone", "sisters part as separase cuts cohesin", "fibers shorten; poles move apart"],
    ["re-forms around each set", "unwind at the two poles", "breaks down; midzone bundle stays"],
    ["two interphase nuclei", "2n in each daughter, as in the mother", "actin-myosin ring cuts at the midbody"]];
  Viz.register("mitosis-phase-sequence-overview", {
    title: "Mitosis: the phases in order",
    subject: "biology",
    shows: "Step through prophase, prometaphase, metaphase, anaphase, telophase and cytokinesis: what the envelope, the chromosomes and the spindle do in each, and how M phase is only about an hour of a 24-hour cycle",
    params: {},
    steps: NAMES,
    stepMs: 1700,
    formula: function (v) {
      var s = v.step || 1;
      return "\\text{phase } " + s + "/6:\\ \\text{" + NAMES[s - 1] + "}\\newline \\dfrac{t_M}{t_{\\text{cycle}}}\\approx\\dfrac{1\\ \\text{h}}{24\\ \\text{h}}\\approx 4\\%";
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
      {name: "last: cytokinesis", values: {step: 6}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, y0 = 46, r = 23;
      var X = function (i) { return 36 + i * 65.6; };
      var mini = function (i, x, y, op) {
        var g = api.group({opacity: op, transform: "translate(" + x + " " + y + ") scale(0.84) translate(" + (-x) + " " + (-y) + ")"});
        var o = function (extra) { return Object.assign({parent: g}, extra); };
        var chrom = function (cx2, cy2, ang) { var dx = Math.cos(ang) * 4, dy = Math.sin(ang) * 4; api.line([cx2 - dx, cy2 - dy], [cx2 + dx, cy2 + dy], o({color: c.c2, width: 3})); api.line([cx2 + dy * 0.6 - dx, cy2 - dx * 0.6 - dy], [cx2 + dy * 0.6 + dx, cy2 - dx * 0.6 + dy], o({color: c.c2, width: 3})); };
        var pole = function (px, py) { api.circle([px, py], 2.6, o({fill: c.c3})); };
        if (i === 0) {
          api.circle([x, y], r, o({stroke: c.ink, width: 1.6}));
          api.circle([x, y + 3], 13, o({stroke: c.c1, width: 1.8}));
          chrom(x - 5, y + 1, 0.6); chrom(x + 5, y + 6, -0.9);
          pole(x - 9, y - 16); pole(x + 9, y - 16);
        } else if (i === 1) {
          api.circle([x, y], r, o({stroke: c.ink, width: 1.6}));
          api.circle([x, y], 13, o({stroke: c.c1, width: 1.8, dash: "4 4"}));
          [[-15, 0], [15, 0]].forEach(function (p) { pole(x + p[0], y); });
          api.line([x - 15, y], [x - 3, y - 5], o({color: c.muted, width: 1})); api.line([x + 15, y], [x + 5, y + 5], o({color: c.muted, width: 1}));
          chrom(x - 3, y - 5, 1.2); chrom(x + 5, y + 5, 0.3);
        } else if (i === 2) {
          api.circle([x, y], r, o({stroke: c.ink, width: 1.6}));
          [-1, 1].forEach(function (sg) { pole(x + sg * 16, y); [-8, 0, 8].forEach(function (d) { api.line([x + sg * 16, y], [x + sg * 2, y + d], o({color: c.muted, width: 1})); }); });
          [-8, 0, 8].forEach(function (d) { chrom(x, y + d, Math.PI / 2); });
        } else if (i === 3) {
          api.path("M " + (x - 27) + " " + y + " A 27 19 0 1 0 " + (x + 27) + " " + y + " A 27 19 0 1 0 " + (x - 27) + " " + y, o({stroke: c.ink, width: 1.6}));
          [-1, 1].forEach(function (sg) { pole(x + sg * 21, y); [-7, 0, 7].forEach(function (d) { api.line([x + sg * 21, y], [x + sg * 10, y + d], o({color: c.muted, width: 1})); api.path("M " + (x + sg * 6) + " " + (y + d - 3) + " L " + (x + sg * 10) + " " + (y + d) + " L " + (x + sg * 6) + " " + (y + d + 3), o({stroke: c.c2, width: 2.4})); }); });
        } else if (i === 4) {
          api.path("M " + (x - 27) + " " + y + " Q " + (x - 27) + " " + (y - 19) + " " + (x - 12) + " " + (y - 18) + " Q " + x + " " + (y - 13) + " " + (x + 12) + " " + (y - 18) + " Q " + (x + 27) + " " + (y - 19) + " " + (x + 27) + " " + y +
            " Q " + (x + 27) + " " + (y + 19) + " " + (x + 12) + " " + (y + 18) + " Q " + x + " " + (y + 13) + " " + (x - 12) + " " + (y + 18) + " Q " + (x - 27) + " " + (y + 19) + " " + (x - 27) + " " + y, o({stroke: c.ink, width: 1.6}));
          [-1, 1].forEach(function (sg) { api.circle([x + sg * 14, y], 8, o({stroke: c.c1, width: 1.6, dash: "3 2"})); api.path("M " + (x + sg * 14 - 4) + " " + (y - 2) + " q 2 -3 4 0 t 4 0", o({stroke: c.c2, width: 1.6})); });
        } else {
          [-1, 1].forEach(function (sg) { api.circle([x + sg * 13, y], 13, o({stroke: c.ink, width: 1.6})); api.circle([x + sg * 13, y], 6, o({stroke: c.c1, width: 1.6})); });
          api.rect(x - 2.5, y - 3, 5, 6, o({fill: c.c4, rx: 1.5}));
        }
      };
      for (var i = 0; i < 6; i++) {
        var cur = i === s - 1, x = X(i);
        if (cur) api.circle([x, y0], 27, {fill: c.accent, fillOpacity: 0.12, stroke: c.accent, width: 2});
        mini(i, x, y0, cur ? 1 : 0.42);
        if (i < 5) api.line([x + 26, y0], [X(i + 1) - 28, y0], {color: c.faint, width: 1.4, arrow: true});
        api.label([x, i % 2 ? 100 : 88], NAMES[i], {color: cur ? c.accent : c.muted, size: 12, weight: cur ? 700 : 500, anchor: "middle"});
      }
      // what the three players are doing now
      var f = FACTS[s - 1], rows = [["envelope", c.c1], ["chromosomes", c.c2], ["spindle", c.c3]];
      api.rect(10, 114, 380, 82, {fill: c.ink, fillOpacity: 0.035, rx: 8});
      rows.forEach(function (rw, k) {
        var y = 132 + k * 24;
        api.label([22, y], rw[0], {color: rw[1], size: 12, weight: 650});
        api.label([118, y], f[k], {color: c.ink, size: 12});
      });
      // M phase inside the whole cycle (24 h), then M blown up into its six sub-phases (not to scale)
      var bx = 14, bw = 372, by = 216, hrs = [["G1", 11], ["S", 8], ["G2", 4], ["M", 1]], acc = 0, mx0 = 0, mx1 = 0;
      hrs.forEach(function (h) {
        var x0 = bx + bw * acc / 24, w = bw * h[1] / 24, isM = h[0] === "M";
        api.rect(x0 + 0.5, by, w - 1, 14, {fill: isM ? c.accent : c.muted, fillOpacity: isM ? 0.95 : 0.25 + 0.1 * (acc > 0), rx: 2});
        if (!isM) api.label([x0 + w / 2, by + 7], h[0] + " ≈ " + h[1] + " h", {color: c.ink, size: 12, anchor: "middle", raw: true});
        else { mx0 = x0; mx1 = x0 + w; }
        acc += h[1];
      });
      api.label([mx0 - 4, by - 10], "M ≈ 1 h of 24", {color: c.accent, size: 12, weight: 650, anchor: "end", raw: true});
      var sx0 = 150, sw = (bx + bw - sx0) / 6, sy = 256;
      api.path("M " + mx0 + " " + (by + 14) + " L " + sx0 + " " + sy + " M " + mx1 + " " + (by + 14) + " L " + (bx + bw) + " " + sy, {stroke: c.faint, width: 1, dash: "3 3"});
      for (var j = 0; j < 6; j++) {
        var on = j === s - 1;
        api.rect(sx0 + j * sw + 1, sy, sw - 2, 16, {fill: c.accent, fillOpacity: on ? 0.95 : 0.2, rx: 3});
        api.label([sx0 + j * sw + sw / 2, sy + 8.5], String(j + 1), {color: on ? c.card : c.muted, size: 12, weight: 700, anchor: "middle"});
      }
      api.label([sx0 - 8, sy + 8], "M phase", {color: c.accent, size: 12, weight: 650, anchor: "end"});
      api.label([bx + bw, 288], "sub-phases drawn equal, not to scale", {color: c.faint, size: 12, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
