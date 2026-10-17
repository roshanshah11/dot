// One nucleotide added by RNA polymerase. The template base in the active site decides which of the four NTPs fits
// (A-U, T-A... in RNA terms: template A takes UTP, T takes ATP, G takes CTP, C takes GTP). The 3'-OH at the RNA's growing
// end attacks the incoming NTP's alpha phosphate, making a 3'-5' phosphodiester bond; the beta and gamma phosphates
// leave as pyrophosphate (PPi), whose hydrolysis makes the step effectively irreversible. So the RNA only ever grows
// 5' -> 3', antiparallel to the template, which is read 3' -> 5'. Only about 8 nt of RNA stay paired with the template
// inside the polymerase; older RNA peels off through the exit channel.
(function () {
  var TEMPLATE = "TACCTGAAGCGTACTTGA", TO_RNA = {A: "U", T: "A", G: "C", C: "G"}, HYBRID = 8;
  var NAME = {A: "ATP", U: "UTP", G: "GTP", C: "CTP"};
  function rna(i) { return TO_RNA[TEMPLATE[i]]; }
  Viz.register("rna-polymerase-template-directed-synthesis", {
    title: "RNA polymerase adds one nucleotide",
    subject: "biology",
    shows: "Step one addition: the template base picks the matching NTP, the RNA's 3′-OH attacks its α phosphate, and pyrophosphate leaves; slide n to move along the gene",
    params: {
      n: {kind: "integer", default: 6, min: 1, max: 17, label: "\\text{RNA nt}"}
    },
    steps: ["the matching NTP pairs with the template", "the 3′-OH attacks the α phosphate", "pyrophosphate leaves; the polymerase moves on"],
    stepMs: 1800,
    formula: function (v) {
      var b = rna(v.n);
      return "(\\text{RNA})_{" + v.n + "} + \\text{" + NAME[b] + "} \\longrightarrow (\\text{RNA})_{" + (v.n + 1) + "} + \\text{PP}_i";
    },
    status: function (v) {
      var s = v.step || 1, t = TEMPLATE[v.n], b = rna(v.n), last = rna(v.n - 1);
      if (s === 1) return "Template base <b>" + t + "</b> pairs only with " + b + ", so <b>" + NAME[b] + "</b> is the one NTP that fits; the other three cannot base-pair and drift off.";
      if (s === 2) return "The 3′-OH on the RNA's last nucleotide (" + last + ") attacks the <b>α phosphate</b> of " + NAME[b] + ", forming a 3′→5′ phosphodiester bond.";
      return "The β and γ phosphates leave as <b>pyrophosphate</b>, so the RNA is now <b>" + (v.n + 1) + " nt</b>, grown at its 3′ end, and the polymerase steps one base along the template.";
    },
    examples: [
      {name: "second nucleotide", values: {n: 1, step: 1}},
      {name: "last nucleotide added", values: {n: 17, step: 3}},
      {name: "attack, mid-gene", values: {n: 10, step: 2}}
    ],
    size: [400, 260],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, n = v.n, X = function (i) { return 40 + i * 19; };
      var yT = 210, yB = 166, yBk = 146, len = s === 3 ? n + 1 : n, at = s === 3 ? n + 1 : n;   // at = template position in the active site
      // the polymerase around the hybrid and the active site
      var w0 = Math.max(0, at - HYBRID), w1 = Math.min(17, at + 1);
      api.rect(X(w0) - 11, 112, X(w1) - X(w0) + 24, 114, {rx: 24, fill: c.c6, fillOpacity: 0.08, stroke: c.c6, width: 1.2, dash: "5 4"});
      api.label([X(w0) - 8, 102], "RNA polymerase", {color: c.c6, size: 12});
      // the template, read 3' -> 5'
      api.line([X(0) - 8, yT + 10], [X(17) + 8, yT + 10], {color: c.c2, width: 2.5, opacity: 0.8});
      for (var i = 0; i < 18; i++) api.label([X(i), yT], TEMPLATE[i], {color: c.c2, size: 13.5, weight: 700, anchor: "middle", opacity: i === at && s < 3 ? 1 : 0.85});
      api.label([X(0) - 14, yT], "3′", {color: c.c2, size: 12, anchor: "end"});
      api.label([X(17) + 14, yT], "5′", {color: c.c2, size: 12});
      api.label([X(0) - 14, yT + 30], "template DNA, read 3′→5′", {color: c.c2, size: 12});
      // the RNA: the last HYBRID nucleotides pair with the template, older ones peel away up and to the left
      var bk = [], pos = [];   // backbone point and base position of each nucleotide
      for (i = 0; i < len; i++) {
        var k = len - HYBRID - i;   // > 0 once the nucleotide has left the hybrid
        bk.push(k > 0 ? [X(len - HYBRID) - k * 13, yBk - k * 13] : [X(i), yBk]);
        pos.push(k > 0 ? [bk[i][0] - 12, bk[i][1] + 12] : [X(i), yB]);
      }
      for (i = 1; i < len; i++) {
        var newBond = s === 3 && i === len - 1;
        api.line(bk[i - 1], bk[i], {color: newBond ? c.c4 : c.c3, width: newBond ? 3.5 : 2.5});
        api.circle([(bk[i - 1][0] + bk[i][0]) / 2, (bk[i - 1][1] + bk[i][1]) / 2], 3.2, {fill: newBond ? c.c4 : c.c3});
      }
      pos.forEach(function (q, i) {
        var hyb = len - 1 - i < HYBRID;
        api.line(bk[i], hyb ? [q[0], q[1] - 8] : [q[0] + 5, q[1] - 5], {color: c.c3, width: 1.5, opacity: 0.7});
        api.label(q, rna(i), {color: c.c3, size: 13.5, weight: 700, anchor: "middle"});
        if (hyb) api.line([q[0], q[1] + 10], [q[0], yT - 10], {color: c.ink, width: 1.2, opacity: 0.45});
      });
      api.label(len > HYBRID ? [bk[0][0] - 10, bk[0][1] - 6] : [bk[0][0] - 16, bk[0][1]], "5′", {color: c.c3, size: 12, anchor: "end"});
      var end = pos[len - 1];
      // the incoming NTP and its three phosphates
      if (s < 3) {
        var x = X(n), b = rna(n), pk = [[x, yBk - 18], [x, yBk - 36], [x, yBk - 54]];
        api.label([x, yB], b, {color: c.c4, size: 13.5, weight: 750, anchor: "middle"});
        api.line([x, yB + 10], [x, yT - 10], {color: c.c4, width: 1.4, opacity: 0.8});
        api.line([x, yBk], [x, yB - 8], {color: c.c4, width: 1.5});
        api.line([x, yBk], pk[2], {color: c.c4, width: 1.5});
        ["α", "β", "γ"].forEach(function (g, k) { api.circle(pk[k], 5, {fill: c.c4, fillOpacity: k ? 0.5 : 0.95}); api.label([pk[k][0] + 10, pk[k][1]], g, {color: c.c4, size: 12}); });
        api.label([end[0] - 6, yBk - 14], "3′-OH", {color: c.c3, size: 12, weight: 650, anchor: "end"});
        if (s === 2) api.path("M " + (end[0] + 2) + " " + (yBk - 6) + " Q " + (end[0] + 6) + " " + (yBk - 26) + " " + (x - 7) + " " + (yBk - 19), {stroke: c.c5, width: 2, arrow: true});
        // the four candidates; only the complementary one pairs
        ["A", "U", "G", "C"].forEach(function (q, k) {
          var px = 252 + k * 36, ok = q === b;
          api.rect(px - 16, 24, 32, 22, {rx: 6, fill: ok ? c.c4 : c.muted, fillOpacity: ok ? 0.25 : 0.1, stroke: ok ? c.c4 : c.faint, width: 1.2});
          api.label([px, 35], NAME[q], {color: ok ? c.c4 : c.muted, size: 12, weight: ok ? 700 : 500, anchor: "middle"});
        });
        api.label([392, 62], "only " + NAME[b] + " pairs with " + TEMPLATE[n], {color: c.c4, size: 12, anchor: "end"});
      } else {
        var far = end[0] > 300;   // near the right edge the label goes above-left of the bond
        api.label(far ? [end[0] - 6, yBk - 16] : [end[0] + 12, yBk - 4], "new bond", {color: c.c4, size: 12, weight: 650, anchor: far ? "end" : "start"});
        var px0 = Math.min(end[0] + 34, 372);
        api.circle([px0, 70], 5, {fill: c.c5, fillOpacity: 0.7}); api.circle([px0 + 12, 60], 5, {fill: c.c5, fillOpacity: 0.7});
        api.line([px0, 70], [px0 + 12, 60], {color: c.c5, width: 1.5});
        api.label([px0 + 6, 42], "PPᵢ leaves", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
        api.arrow([end[0] + 8, yBk - 52], [px0 - 6, 80], {color: c.c5, width: 1.5, halo: false, head: 7, dash: "3 3"});
        api.label([end[0] + 12, yB], "3′", {color: c.c3, size: 12});
      }
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
