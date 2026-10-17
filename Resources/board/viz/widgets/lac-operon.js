// The lac operon reads two sugars. Lactose (as allolactose) pulls the LacI repressor off the operator; glucose keeps
// cAMP low, so CAP cannot bind next to the weak lac promoter and help RNA polymerase. Only "lactose and no glucose"
// gives full transcription. Sizes used, stated as round textbook figures: the repressor cuts transcription about
// 1,000-fold, and CAP-cAMP raises it about 50-fold, so lactose with glucose runs near 1/50 = 2% of full, and no
// lactose leaves only a leak of about 0.1% (0.002% with glucose as well). Gene widths are not to scale.
(function () {
  function model(v) {
    var repOff = v.lactose_present, cap = !v.glucose_present;
    var rate = (repOff ? 1 : 1 / 1000) * (cap ? 1 : 1 / 50);
    return {repOff: repOff, cap: cap, rate: rate, word: repOff && cap ? "full" : repOff ? "low" : "off"};
  }
  function pc(x) { return x >= 0.01 ? Viz.fmt(x * 100, 0) + "%" : Viz.fmt(x * 100, 3) + "%"; }

  Viz.register("lac-operon", {
    title: "The lac operon: lactose and glucose",
    subject: "biology",
    shows: "Toggle glucose and lactose: lactose takes the repressor off the operator, low glucose lets CAP-cAMP help RNA polymerase, and only lactose without glucose turns the genes fully on",
    params: {
      glucose_present: {kind: "boolean", default: true, label: "\\text{glucose}", on: "present", off: "absent"},
      lactose_present: {kind: "boolean", default: true, label: "\\text{lactose}", on: "present", off: "absent"}
    },
    formula: function (v) {
      var m = model(v);
      return "\\begin{array}{l}\\text{rate}=\\underbrace{" + (m.repOff ? "1" : "\\tfrac{1}{1000}") + "}_{\\text{repressor}}\\times\\underbrace{" +
        (m.cap ? "1" : "\\tfrac{1}{50}") + "}_{\\text{CAP}}\\\\ \\phantom{\\text{rate}}=" + pc(m.rate).replace("%", "\\%") + "\\text{ of full}\\end{array}";
    },
    status: function (v) {
      var m = model(v);
      if (m.repOff && m.cap) return "Lactose has pulled the repressor off and no glucose means high cAMP, so CAP–cAMP helps RNA polymerase onto the promoter: the operon runs at <b>full rate</b>.";
      if (m.repOff) return "Lactose frees the operator, but glucose keeps cAMP low, so CAP stays off and RNA polymerase rarely starts: about <b>2%</b> of full, so the cell eats glucose first.";
      if (m.cap) return "CAP–cAMP is bound and ready, but with no lactose the repressor sits on the operator and blocks RNA polymerase: the operon is <b>off</b>.";
      return "No lactose: the repressor blocks the operator, and glucose leaves CAP off too, so the operon is <b>off</b> twice over.";
    },
    examples: [
      {name: "glucose and lactose", values: {glucose_present: true, lactose_present: true}},
      {name: "lactose only: fully on", values: {glucose_present: false, lactose_present: true}},
      {name: "glucose only", values: {glucose_present: true, lactose_present: false}},
      {name: "neither sugar", values: {glucose_present: false, lactose_present: false}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = model(v), y = 176;
      // ---- the DNA: lacI (its own gene), then CAP site, promoter, operator and the three structural genes ----
      api.line([8, y], [392, y], {color: c.muted, width: 3});
      api.rect(12, y - 9, 46, 18, {fill: c.c6, fillOpacity: 0.15, stroke: c.c6, width: 1.2, rx: 3});
      api.label([35, y], "lacI", {color: c.c6, size: 12, anchor: "middle", italic: true});
      api.rect(76, y - 8, 28, 16, {fill: c.c4, fillOpacity: 0.15, stroke: c.c4, width: 1.2, rx: 3});
      api.rect(104, y - 8, 38, 16, {fill: c.c2, fillOpacity: 0.15, stroke: c.c2, width: 1.2, rx: 3});
      api.rect(142, y - 8, 26, 16, {fill: c.c6, fillOpacity: 0.15, stroke: c.c6, width: 1.2, rx: 3});
      api.label([90, y + 19], "CAP", {color: c.c4, size: 12, anchor: "middle"});
      api.label([123, y + 19], "P", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      api.label([155, y + 19], "O", {color: c.c6, size: 12.5, weight: 650, anchor: "middle"});
      [["lacZ", 170, 90], ["lacY", 262, 62], ["lacA", 326, 62]].forEach(function (g) {
        api.rect(g[1], y - 9, g[2] - 2, 18, {fill: c.ink, fillOpacity: 0.08, stroke: c.faint, width: 1.2, rx: 3});
        api.label([g[1] + g[2] / 2 - 1, y], g[0], {color: c.ink, size: 12, anchor: "middle", italic: true});
      });
      // ---- the repressor: made from lacI all the time; on the operator, or lifted off by allolactose ----
      var rep = m.repOff ? [150, 90] : [155, y - 20];
      // lacI makes the repressor: an elbow arrow routed above the CAP region so it crosses nothing
      api.path(m.repOff ? "M 35 " + (y - 11) + " L 35 98 Q 35 92 41 92 L " + (rep[0] - 20) + " 92"
                        : "M 35 " + (y - 11) + " L 35 84 Q 35 78 41 78 L " + (rep[0] - 6) + " 78 Q " + rep[0] + " 78 " + rep[0] + " 84 L " + rep[0] + " " + (rep[1] - 14),
               {stroke: c.c6, width: 1.3, dash: "3 3", arrow: true, opacity: 0.75});
      api.rect(rep[0] - 17, rep[1] - 11, 34, 22, {fill: c.c6, fillOpacity: 0.85, rx: 8});
      if (m.repOff) {
        api.polygon([[rep[0], rep[1] - 18], [rep[0] + 6, rep[1] - 12], [rep[0], rep[1] - 6], [rep[0] - 6, rep[1] - 12]], {fill: c.c3, fillOpacity: 1});
        api.label([rep[0] + 24, rep[1] - 4], "repressor + allolactose", {color: c.c6, size: 12});
        api.label([rep[0] + 24, rep[1] + 12], "off the operator", {color: c.muted, size: 12});
        [[236, 40], [262, 30], [250, 56]].forEach(function (p) {
          api.polygon([[p[0], p[1] - 6], [p[0] + 6, p[1]], [p[0], p[1] + 6], [p[0] - 6, p[1]]], {fill: c.c3, fillOpacity: 0.9});
        });
        api.label([274, 46], "lactose", {color: c.c3, size: 12.5, weight: 650});
      } else {
        api.label([rep[0] + 22, rep[1] - 10], "repressor on O", {color: c.c6, size: 12});
      }
      // ---- glucose sets cAMP; CAP-cAMP on its site, or CAP left free ----
      if (v.glucose_present) {
        [[24, 30], [44, 44], [22, 58]].forEach(function (p) {
          var h = []; for (var i = 0; i < 6; i++) h.push([p[0] + 7 * Math.cos(i * Math.PI / 3), p[1] + 7 * Math.sin(i * Math.PI / 3)]);
          api.polygon(h, {fill: c.c5, fillOpacity: 0.85});
        });
        api.label([56, 30], "glucose: cAMP low", {color: c.c5, size: 12.5, weight: 650});
        api.circle([82, 104], 9, {fill: c.c4, fillOpacity: 0.12, stroke: c.c4, width: 1.5, dash: "3 2"});
        api.circle([98, 104], 9, {fill: c.c4, fillOpacity: 0.12, stroke: c.c4, width: 1.5, dash: "3 2"});
        api.label([90, 126], "CAP, empty", {color: c.c4, size: 12, anchor: "middle"});
      } else {
        api.label([12, 30], "no glucose: cAMP high", {color: c.c4, size: 12.5, weight: 650});
        [[30, 50], [52, 46], [72, 56], [40, 66], [96, 48]].forEach(function (p) { api.circle(p, 3.5, {fill: c.c4}); });
        api.circle([83, y - 19], 9, {fill: c.c4, fillOpacity: 0.85});
        api.circle([97, y - 19], 9, {fill: c.c4, fillOpacity: 0.85});
        api.circle([83, y - 30], 3.5, {fill: c.ink}); api.circle([97, y - 30], 3.5, {fill: c.ink});
        api.label([62, y - 46], "CAP–cAMP", {color: c.c4, size: 12, anchor: "middle"});
      }
      // ---- RNA polymerase: blocked, starting rarely, or loading often ----
      var pol = function (x, py, op) { api.path("M " + (x - 15) + " " + py + " a 15 11 0 1 0 30 0 a 15 11 0 1 0 -30 0", {fill: c.c2, fillOpacity: op, stroke: c.c2, width: 1.2}); };
      if (!m.repOff) {
        pol(122, 214, 0.35);
        api.line([116, 228], [128, 238], {color: c.c5, width: 2}); api.line([128, 228], [116, 238], {color: c.c5, width: 2});
        api.label([142, 214], "RNA polymerase blocked", {color: c.c2, size: 12});
      } else {
        pol(123, y, m.cap ? 0.9 : 0.4);
        api.label([123, y + 36], m.cap ? "RNA polymerase, helped by CAP" : "RNA polymerase binds weakly", {color: c.c2, size: 12, anchor: "start"});
      }
      // ---- the polycistronic mRNA, one wavy line per transcript ----
      var n = m.word === "full" ? 3 : m.word === "low" ? 1 : 0;
      for (var k = 0; k < n; k++) {
        var pts = [], yy = y + 54 + k * 14;
        for (var x = 174; x <= 382; x += 3) pts.push([x, yy + 2.2 * Math.sin((x - 174) / 4)]);
        api.polyline(pts, {stroke: c.c1, width: 2, opacity: m.word === "full" ? 1 : 0.6});
      }
      if (n) api.label([382, y + 54 + n * 14 + 4], n > 1 ? "lac mRNA (Z Y A in one)" : "a rare lac mRNA", {color: c.c1, size: 12, anchor: "end"});
      // ---- transcription meter (log scale: 0.001% to 100%) ----
      var mx0 = 16, mx1 = 166, my = 268, lx = function (r) { return mx0 + (Math.log10(r) + 5) / 5 * (mx1 - mx0); };
      api.label([mx0, my - 16], "transcription:", {color: c.muted, size: 12});
      api.rect(mx0, my - 5, mx1 - mx0, 10, {fill: c.ink, fillOpacity: 0.06, rx: 5});
      api.rect(mx0, my - 5, Math.max(6, lx(m.rate) - mx0), 10, {fill: m.word === "full" ? c.c1 : m.word === "low" ? c.c3 : c.c5, fillOpacity: 0.9, rx: 5});
      [[1e-4, "0.01%"], [1e-2, "1%"], [1, "100%"]].forEach(function (t) { api.label([lx(t[0]), my + 17], t[1], {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([mx0 + 80, my - 16], pc(m.rate) + " of full", {color: m.word === "full" ? c.c1 : m.word === "low" ? c.c3 : c.c5, size: 12.5, weight: 700});
      // viz.css paints svg text ink over the fill attribute; restate each label's color inline
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
