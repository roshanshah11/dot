// The junctions of an epithelial sheet, in their real order along the lateral membrane from apical to basal: tight
// junction, adherens junction, desmosome, gap junction, and hemidesmosomes on the basal lamina. Left: two neighbouring
// cells with every junction in place; right: the chosen one up close, with what crosses the gap, what it ties to inside
// (actin for tight and adherens junctions, keratin intermediate filaments for desmosomes and hemidesmosomes) and, with
// the test on, what it does (a dye stopped at the seal, apical constriction as the actin belt tightens, tension held,
// small molecules passing).
(function () {
  var INFO = {
    tight: ["Tight junction", "\\text{across: claudin, occludin}", "\\text{inside: ZO proteins}\\to\\text{actin}",
      "Tight junctions stitch neighbouring membranes together with claudin and occludin strands, sealing the space between cells so the lumen cannot leak past and membrane proteins cannot drift between the apical and basal faces",
      "dye added to the lumen stops at the seal"],
    adherens: ["Adherens junction", "\\text{across: E-cadherin (needs Ca}^{2+}\\text{)}", "\\text{inside: catenins}\\to\\text{actin belt}",
      "Adherens junctions join cadherins of neighbouring cells (they need Ca²⁺) and anchor them through catenins to a belt of actin, so the cells hold together",
      "myosin tightens the actin belt and narrows each cell's apex (apical constriction), which is how a sheet folds into a tube"],
    desmosome: ["Desmosome", "\\text{across: desmoglein, desmocollin}", "\\text{inside: plaque}\\to\\text{keratin filaments}",
      "Desmosomes are spot welds: cadherins clamp the cells together and dense plaques tie them to keratin intermediate filaments",
      "a pull is spread through the keratin network, so skin and heart muscle do not tear"],
    gap: ["Gap junction", "\\text{connexon = 6 connexins, 2 per channel}", "\\text{pore}\\approx 1.5\\ \\text{nm: under}\\approx 1\\ \\text{kDa passes}",
      "Gap junctions are channels of connexins that join two cytoplasms",
      "ions, sugars and cAMP pass from cell to cell (heart cells beat together this way), while proteins are too big"],
    hemi: ["Hemidesmosome", "\\text{across: integrin }\\alpha_6\\beta_4\\to\\text{laminin}", "\\text{inside: plaque}\\to\\text{keratin filaments}",
      "Hemidesmosomes anchor the base of the cell to the basal lamina: integrins grip laminin outside and keratin filaments inside",
      "a pull upward is resisted, so the sheet stays on its basal lamina"]
  };
  var Y = {tight: 61, adherens: 85, desmosome: 125, gap: 168, hemi: 244};

  Viz.register("animal-cell-junction-functions", {
    title: "Cell junctions and what they do",
    subject: "biology",
    shows: "Pick a junction: tight junctions seal, adherens junctions and desmosomes hold cells together through actin and keratin, gap junctions let small molecules pass, hemidesmosomes anchor cells to the basal lamina",
    params: {
      j: {kind: "enum", values: ["tight", "adherens", "desmosome", "gap", "hemi"], names: {tight: "tight", adherens: "adherens", desmosome: "desmosome", gap: "gap", hemi: "hemidesmosome"}, default: "tight", label: "\\text{junction}"},
      test: {kind: "boolean", default: true, label: "\\text{test}", on: "shown", off: "hidden"}
    },
    formula: function (v) { return INFO[v.j][1] + "\\newline " + INFO[v.j][2]; },
    status: function (v) { var I = INFO[v.j]; return I[3] + (v.test ? "; <b>test</b>: " + I[4] + "." : "."); },
    examples: [
      {name: "tight junction, dye test", values: {j: "tight", test: true}},
      {name: "adherens junction, apical constriction", values: {j: "adherens", test: true}},
      {name: "desmosome under tension", values: {j: "desmosome", test: true}},
      {name: "gap junction", values: {j: "gap", test: true}},
      {name: "hemidesmosome, no test", values: {j: "hemi", test: false}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, J = v.j, hi = function (k) { return k === J ? c.c1 : c.muted; };
      // ---- left: two epithelial cells with every junction, named in apical-to-basal order in the left margin ----
      var JX = 134, T = J === "adherens" && v.test ? 13 : 0;   // T: apical constriction narrows each apex (outer walls tilt in)
      var wl = function (y) { return 80 + T * (246 - y) / 198; }, wr = function (y) { return 188 - T * (246 - y) / 198; };
      api.label([JX, 16], "lumen (apical)", {color: c.muted, size: 12, anchor: "middle"});
      [[wl, function () { return 132; }], [function () { return 136; }, wr]].forEach(function (q) {
        var a = q[0], b = q[1];
        for (var x = a(48) + 6; x < b(48) - 3; x += 9) api.line([x, 47], [x, 37], {color: c.ink, width: 4, opacity: 0.25});
        api.polygon([[a(48), 48], [b(48), 48], [b(246), 246], [a(246), 246]], {fill: c.ink, fillOpacity: 0.04, stroke: c.ink, width: 1.5});
        api.circle([(a(200) + b(200)) / 2, 200], 15, {stroke: c.muted, width: 1.2, fill: c.ink, fillOpacity: 0.05});
      });
      api.rect(74, 249, 120, 7, {fill: c.c6, fillOpacity: 0.5, rx: 3});
      api.label([194, 270], "basal lamina", {color: c.c6, size: 12, anchor: "end"});
      [56, 61, 66].forEach(function (y) { api.line([JX - 4, y], [JX + 4, y], {color: hi("tight"), width: 2}); });
      [80, 85, 90].forEach(function (y) { api.line([JX - 3, y], [JX + 3, y], {color: hi("adherens"), width: 1.5}); });
      [JX - 7, JX + 7].forEach(function (x) { api.circle([x, 85], 2.6, {fill: c.c5}); });   // the actin belt, cut across
      api.rect(JX - 7, 115, 3, 20, {fill: hi("desmosome"), rx: 1}); api.rect(JX + 4, 115, 3, 20, {fill: hi("desmosome"), rx: 1});
      api.path("M " + (JX - 7) + " 117 Q " + (JX - 26) + " 125 " + (JX - 7) + " 133", {stroke: c.c3, width: 1.4});
      api.path("M " + (JX + 7) + " 117 Q " + (JX + 26) + " 125 " + (JX + 7) + " 133", {stroke: c.c3, width: 1.4});
      [162, 168, 174].forEach(function (y) { api.rect(JX - 5, y - 2, 10, 4, {fill: hi("gap"), rx: 1}); });
      [[98, 114], [154, 170]].forEach(function (q) {
        api.rect(q[0], 240, q[1] - q[0], 3, {fill: hi("hemi"), rx: 1});
        api.path("M " + (q[0] + 2) + " 240 Q " + ((q[0] + q[1]) / 2) + " 222 " + (q[1] - 2) + " 240", {stroke: c.c3, width: 1.4});
      });
      // margin names with dotted leaders to each junction; the chosen one in teal
      [["tight", "tight", JX - 6], ["adherens", "adherens", JX - 10], ["desmosome", "desmosome", JX - 17], ["gap", "gap", JX - 7]].forEach(function (q) {
        var on = q[0] === J, y = Y[q[0]], tx = q[1].length * 12 * 0.53, xe = q[0] === "adherens" && T ? wl(y) - 1 : q[2];
        api.label([74, y], q[1], {color: on ? c.c1 : c.muted, size: 12, weight: on ? 700 : 500, anchor: "end"});
        api.line([77, y], [xe, y], {color: on ? c.c1 : c.muted, width: 1, dash: "1.5 2.5", opacity: on ? 0.9 : 0.5});
      });
      api.label([4, 270], "hemidesmosome", {color: J === "hemi" ? c.c1 : c.muted, size: 12, weight: J === "hemi" ? 700 : 500});
      api.line([97, 264], [104, 245], {color: J === "hemi" ? c.c1 : c.muted, width: 1, dash: "1.5 2.5", opacity: J === "hemi" ? 0.9 : 0.5});
      if (T) [[wl(85) + 3, wl(85) + 21], [wr(85) - 3, wr(85) - 21]].forEach(function (q) { api.arrow([q[0], 85], [q[1], 85], {color: c.c5, width: 2.2, head: 8, halo: false}); });
      // the chosen junction, boxed, with a leader to the close-up
      var yb = Y[J], box = J === "hemi" ? [92, 228, 84, 22] : [JX - 16, yb - 12, 32, 24];
      api.rect(box[0], box[1], box[2], box[3], {stroke: c.c1, width: 1.6, dash: "3 3", rx: 5});
      api.line([box[0] + box[2], box[1] + box[3] / 2], [198, 150], {color: c.c1, width: 1, opacity: 0.5, dash: "2 3"});
      // a label on a patch of card colour, so membrane lines stop short of the text instead of running through it
      var tag = function (at, text, o) {
        var w = text.length * o.size * 0.54 + 8, a = o.anchor || "start", x0 = a === "middle" ? at[0] - w / 2 : a === "end" ? at[0] - w + 4 : at[0] - 4;
        api.rect(x0, at[1] - o.size * 0.62 - 2, w, o.size * 1.24 + 4, {fill: c.card, rx: 3});
        api.label(at, text, o);
      };
      // ---- right: the close-up ----
      var L = 200, R = 392, top = 34, bot = 262, m1 = 270, m2 = 322, mid = 296;
      api.rect(L, top, R - L, bot - top, {stroke: c.faint, width: 1, rx: 10});
      api.label([(L + R) / 2, 18], INFO[J][0], {color: c.c1, size: 14, weight: 700, anchor: "middle"});
      var membrane = function (x, dir, bumps) {   // a bilayer drawn as two lines; bumps pinch it toward the middle
        [0, 6].forEach(function (o) {
          var pts = [];
          for (var y = top + 6; y <= bot - 6; y += 3) {
            var b = 0; (bumps || []).forEach(function (yy) { b = Math.max(b, 20 * Math.exp(-Math.pow((y - yy) / 9, 2))); });
            pts.push([x + dir * (o - b), y]);
          }
          api.polyline(pts, {stroke: c.ink, width: 1.4, opacity: 0.8});
        });
      };
      // keratin loops from the cytoplasm (dir = -1: cytoplasm to the left) whose apex just touches the plaque at xp
      var keratin = function (xp, dir, ys) { ys.forEach(function (y) { var x0 = xp + dir * 40; api.path("M " + x0 + " " + (y - 34) + " Q " + (xp - dir * 36) + " " + y + " " + x0 + " " + (y + 34), {stroke: c.c3, width: 1.8}); }); };
      if (J !== "hemi") {
        api.label([m1 - 28, bot - 12], "cell 1", {color: c.muted, size: 12, anchor: "end"});
        api.label([m2 + 34, bot - 12], "cell 2", {color: c.muted, size: 12});
      }
      if (J === "tight") {
        var seals = [92, 138, 184];
        membrane(m1 - 6, -1, seals); membrane(m2, 1, seals);
        seals.forEach(function (y) { api.circle([mid - 5, y], 5, {fill: c.c1}); api.circle([mid + 5, y], 5, {fill: c.c1}); });
        api.label([mid, top + 12], "lumen", {color: c.muted, size: 12, anchor: "middle"});
        api.label([R - 8, 115], "sealing", {color: c.c1, size: 12, anchor: "end"}); api.label([R - 8, 130], "strands", {color: c.c1, size: 12, anchor: "end"});
        if (v.test) {
          [[277, 57], [289, 62], [275, 69], [291, 72], [283, 79], [281, 64]].forEach(function (q) { api.circle(q, 2.6, {fill: c.c2}); });
          api.label([298, 68], "dye", {color: c.c2, size: 12.5, weight: 650});
          api.label([mid, 214], "no dye", {color: c.c2, size: 12, anchor: "middle"});
        }
      } else if (J === "adherens" || J === "desmosome") {
        membrane(m1 - 6, -1); membrane(m2, 1);
        var ys = J === "adherens" ? [104, 118, 132, 146, 160, 174] : [110, 122, 134, 146, 158, 170];
        ys.forEach(function (y, i) {   // cadherins from each side reach past the middle and interlock like a zipper
          api.line([m1 - 6, y], [mid + 5, y], {color: c.c1, width: 2.2}); api.circle([mid + 5, y], 2.6, {fill: c.c1}); api.line([m2, y + 8], [mid - 5, y + 8], {color: c.c1, width: 2.2}); api.circle([mid - 5, y + 8], 2.6, {fill: c.c1});
        });
        if (J === "adherens") {
          // the belt runs around the cell's apical circumference, so this section cuts it across: a bundle of filament dots
          [[m1 - 14, 232], [m2 + 14, 360]].forEach(function (q) {
            ys.forEach(function (y) { api.circle([q[0], y + 2], 3.5, {fill: c.c1, fillOpacity: 0.6}); });
            for (var r = 0; r < 12; r++) for (var k = -2; k <= 2; k++) {
              var bx = q[1] + k * 7 + (r % 2 ? 3.5 : 0), by = 106 + r * 7.2;
              if (Math.pow((bx - q[1]) / 17, 2) + Math.pow((by - 146) / 42, 2) <= 1) api.circle([bx, by], 2.3, {fill: c.c5});
            }
          });
          api.rect(mid - 70, 60, 140, 34, {fill: c.card, rx: 3});
          api.label([mid, 70], "actin belt", {color: c.c5, size: 12.5, weight: 700, anchor: "middle"});
          api.label([mid, 85], "(runs around the cell)", {color: c.c5, size: 12, anchor: "middle"});
          api.line([mid - 46, 93], [244, 106], {color: c.c5, width: 1, opacity: 0.7}); api.line([mid + 46, 93], [348, 106], {color: c.c5, width: 1, opacity: 0.7});
          tag([mid, 206], "cadherins + Ca²⁺", {color: c.c1, size: 12, anchor: "middle"});
          if (v.test) tag([mid, 223], "belt tightens: apex narrows", {color: c.c5, size: 12, anchor: "middle"});
        } else {
          api.rect(245, 102, 10, 76, {fill: c.c1, fillOpacity: 0.85, rx: 3}); api.rect(331, 102, 10, 76, {fill: c.c1, fillOpacity: 0.85, rx: 3});
          keratin(245, -1, [124, 156]); keratin(341, 1, [124, 156]);
          api.label([L + 8, 64], "keratin", {color: c.c3, size: 12.5, weight: 650});
          api.label([mid, 200], "plaques", {color: c.c1, size: 12, anchor: "middle"});
          if (v.test) { api.arrow([236, 214], [208, 214], {color: c.ink, width: 3, halo: false}); api.arrow([356, 214], [384, 214], {color: c.ink, width: 3, halo: false}); tag([mid, 228], "pulled apart: holds", {color: c.ink, size: 12, anchor: "middle"}); }
        }
      } else if (J === "gap") {
        membrane(286, -1); membrane(306, 1);   // gap-junction membranes sit only 2-4 nm apart
        [96, 136, 176].forEach(function (y) {
          api.rect(272, y - 9, 23, 18, {fill: c.c1, fillOpacity: 0.8, rx: 4}); api.rect(297, y - 9, 23, 18, {fill: c.c1, fillOpacity: 0.8, rx: 4});
          api.line([272, y], [320, y], {color: c.card, width: 3});
        });
        api.label([R - 8, 156], "connexons", {color: c.c1, size: 12, anchor: "end"});
        if (v.test) {
          [96, 176].forEach(function (y) { api.arrow([226, y], [366, y], {color: c.c2, width: 1.6, halo: false}); });
          [[236, 92], [250, 108], [342, 172], [356, 188], [348, 96]].forEach(function (q) { api.circle(q, 2.6, {fill: c.c2}); });
          api.circle([232, 196], 13, {fill: c.c5, fillOpacity: 0.25, stroke: c.c5, width: 1.5});
          api.label([232, 218], "protein:", {color: c.c5, size: 12, anchor: "middle"}); api.label([232, 232], "too big", {color: c.c5, size: 12, anchor: "middle"});
          api.label([L + 6, 50], "small solutes", {color: c.c2, size: 12}); api.label([L + 6, 64], "pass through", {color: c.c2, size: 12});
        }
      } else {
        var mb = 170;
        [0, 6].forEach(function (o) { api.line([L + 8, mb + o], [R - 8, mb + o], {color: c.ink, width: 1.4, opacity: 0.8}); });
        api.rect(L + 8, 204, R - L - 16, 16, {fill: c.c6, fillOpacity: 0.45, rx: 3});
        api.rect(254, 154, 120, 10, {fill: c.c1, fillOpacity: 0.85, rx: 3});
        [266, 290, 314, 338, 362].forEach(function (x) { api.line([x, 164], [x, 202], {color: c.c1, width: 2.4}); api.circle([x, 202], 3.5, {fill: c.c1}); });
        [280, 320, 360].forEach(function (x) { api.path("M " + (x - 24) + " 70 Q " + x + " 236 " + (x + 24) + " 70", {stroke: c.c3, width: 1.8}); });
        api.label([R - 8, 50], "keratin", {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
        api.label([L + 8, 186], "integrins", {color: c.c1, size: 12});
        api.label([(L + R) / 2, 238], "basal lamina (laminin)", {color: c.c6, size: 12, anchor: "middle"});
        if (v.test) { api.arrow([226, 150], [226, 72], {color: c.ink, width: 3, halo: false}); api.label([L + 8, 54], "pulled up: stays", {color: c.ink, size: 12}); }
      }
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
