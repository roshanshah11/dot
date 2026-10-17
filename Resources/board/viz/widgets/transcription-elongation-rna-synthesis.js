// Transcription elongation, up close and at gene scale. Inside the bubble (about 13 bp open) RNA polymerase reads the
// template strand 3'->5' and adds each NTP to the RNA's 3'-OH, releasing pyrophosphate; the newest ~8 nt stay paired
// with the template as an RNA-DNA hybrid, older RNA peels off, and the DNA re-zips behind. The RNA matches the coding
// strand with U for T. Below: time to copy a gene, t = L / v, on a log axis (bacterial RNAP and Pol II both run at
// roughly 20-80 nt/s; at 40 nt/s the ~2,200 kb dystrophin gene takes ~15 h, close to the 16 h measured by Tennyson 1995).
(function () {
  var CODING = "GACTCGTAGGCATTCAGGATCCTAGCAC", N = CODING.length;   // +1 .. +28, written 5'->3'
  var PAIR = {A: "T", T: "A", G: "C", C: "G"}, RNA = {A: "A", T: "U", G: "G", C: "C"};
  var GENES = [{name: "1 kb gene", nt: 1000}, {name: "30 kb gene", nt: 30000}, {name: "dystrophin", nt: 2200000}];
  function tmpl(i) { return PAIR[CODING[i - 1]]; }          // template base at position i (1-based)
  function rna(i) { return RNA[CODING[i - 1]]; }            // RNA base made against it
  function dur(s) {
    if (s < 90) return Viz.fmt(s, 1) + " s";
    if (s < 5400) return Viz.fmt(s / 60, 1) + " min";
    if (s < 172800) return Viz.fmt(s / 3600, 1) + " h";
    return Viz.fmt(s / 86400, 1) + " days";
  }
  function ntp(b) { return {A: "ATP", U: "UTP", G: "GTP", C: "CTP"}[b]; }

  Viz.register("transcription-elongation-rna-synthesis", {
    title: "Transcription elongation: RNA grows 5′ to 3′",
    subject: "biology",
    shows: "Slide the RNA's length: polymerase reads the template 3′ to 5′, adds each matching NTP to the 3′ end and releases PPi; slide the speed to see how long a whole gene takes",
    params: {
      n: {kind: "integer", default: 16, min: 14, max: 23, label: "\\text{RNA (nt)}"},
      rate: {kind: "number", default: 40, min: 10, max: 80, step: 5, label: "v\\ \\text{nt/s}"}
    },
    formula: function (v) {
      var next = ntp(rna(v.n + 1));
      return "\\begin{array}{l}\\text{RNA}_{" + v.n + "}+\\text{" + next + "}\\to\\text{RNA}_{" + (v.n + 1) + "}+\\text{PP}_i\\\\" +
        "t=\\dfrac{L}{v}=\\dfrac{1000\\ \\text{nt}}{" + Viz.n(v.rate) + "\\ \\text{nt/s}}=" + Viz.n(1000 / v.rate, 1) + "\\ \\text{s}\\end{array}";
    },
    status: function (v) {
      var b = tmpl(v.n + 1), r = rna(v.n + 1);
      return "Template base " + b + " at +" + (v.n + 1) + " calls for <b>" + r + "</b>, so " + ntp(r) + " joins the 3′-OH and PPi leaves; at <b>" +
        Viz.fmt(v.rate) + " nt/s</b> a 1 kb gene takes " + dur(1000 / v.rate) + " and dystrophin about <b>" + dur(2200000 / v.rate) + "</b>.";
    },
    examples: [
      {name: "short RNA, slow", values: {n: 14, rate: 10}},
      {name: "long RNA, fast", values: {n: 23, rate: 80}},
      {name: "Pol II pace", values: {n: 19, rate: 40}}
    ],
    size: [400, 310],
    draw: function (api, v) {
      var c = api.color, n = v.n, sp = 13;
      var x = function (i) { return 22 + (i - 1) * sp; };
      var lo = n - 10, hi = n + 3, hyb = n - 7;                 // open bubble lo..hi, hybrid hyb..n
      var yCP = 100, yTP = 122, yCB = 48, yTB = 170, yR = 148;
      var inB = function (i) { return i >= lo && i <= hi; };
      // RNA polymerase: one translucent body over the bubble
      api.rect(x(lo) - 15, 30, x(hi) - x(lo) + 30, 156, {rx: 34, fill: c.muted, fillOpacity: 0.12, stroke: c.faint, width: 1.2});
      api.label([300, 14], "polymerase moves", {color: c.muted, size: 12, anchor: "end"});
      api.arrow([306, 14], [348, 14], {color: c.ink, width: 2, halo: false});
      // backbones: paired outside the bubble, split inside it
      var cod = [], tem = [];
      for (var i = 1; i <= N; i++) { cod.push([x(i), inB(i) ? yCB - 10 : yCP - 10]); tem.push([x(i), inB(i) ? yTB + 10 : yTP + 10]); }
      api.polyline(cod, {stroke: c.c2, width: 2, opacity: 0.6});
      api.polyline(tem, {stroke: c.c1, width: 2, opacity: 0.6});
      for (i = 1; i <= N; i++) {
        api.label([x(i), inB(i) ? yCB : yCP], CODING[i - 1], {color: c.c2, size: 12, weight: 600, anchor: "middle"});
        api.label([x(i), inB(i) ? yTB : yTP], tmpl(i), {color: c.c1, size: 12, weight: 700, anchor: "middle"});
        if (!inB(i)) api.line([x(i), yCP + 7], [x(i), yTP - 7], {color: c.faint, width: 1});
      }
      api.label([4, yCP], "5′", {color: c.c2, size: 12}); api.label([396, yCP], "3′", {color: c.c2, size: 12, anchor: "end"});
      api.label([4, yTP], "3′", {color: c.c1, size: 12}); api.label([396, yTP], "5′", {color: c.c1, size: 12, anchor: "end"});
      api.label([10, yCP - 22], "coding", {color: c.c2, size: 12, weight: 600});
      api.label([10, yTP + 22], "template", {color: c.c1, size: 12, weight: 600});
      api.label([(x(lo) + x(hi)) / 2, 198], "template read 3′ → 5′", {color: c.c1, size: 12, anchor: "middle"});
      // RNA-DNA hybrid: the newest 8 nt, paired with the template
      for (i = hyb; i <= n; i++) {
        api.label([x(i), yR], rna(i), {color: c.c3, size: 12.5, weight: 700, anchor: "middle"});
        api.line([x(i), yR + 7], [x(i), yTB - 7], {color: c.c3, width: 1, opacity: 0.6});
      }
      // older RNA peels away up through the bubble and out (its 5' end far behind)
      var old = [[x(hyb), yR]], k, shown = Math.min(hyb - 1, 7);
      for (k = 1; k <= shown; k++) old.push([x(hyb) - 4.5 * k, yR - 11 * k]);
      var tip = [x(lo) + 7, 22];
      api.polyline(old.concat([tip]), {stroke: c.c3, width: 1.6, opacity: 0.55});
      old.slice(1).forEach(function (q, j) { api.label([q[0] + 9, q[1]], rna(hyb - 1 - j), {color: c.c3, size: 12, weight: 600, anchor: "middle"}); });
      api.label([tip[0] - 4, 14], (hyb - 1 > shown ? "··· " : "") + "5′ RNA", {color: c.c3, size: 12, weight: 600, anchor: "end"});
      // the incoming NTP at n + 1 and the pyrophosphate it gives up
      var nx = x(n + 1), nb = rna(n + 1);
      api.circle([nx, yR], 8, {stroke: c.c3, width: 1.4, dash: "3 2"});
      api.label([nx, yR], nb, {color: c.c3, size: 12.5, weight: 700, anchor: "middle"});
      api.line([nx + 12, yR - 44], [nx + 3, yR - 12], {color: c.c3, width: 1.5, arrow: true});
      api.label([nx + 10, yR - 52], ntp(nb) + " in", {color: c.c3, size: 12, weight: 650, anchor: "end"});
      api.line([nx - 5, yR - 10], [x(n) - 6, yR - 34], {color: c.muted, width: 1.3, arrow: true});
      api.label([x(n) - 8, yR - 42], "PP_i out", {color: c.muted, size: 12, anchor: "end"});
      // ---- gene scale: t = L / v on a log axis ----
      var ax0 = 30, ax1 = 380, yA = 280, lmax = Math.log10(3 * 86400);
      var X = function (s) { return ax0 + (ax1 - ax0) * Math.log10(Math.max(1, s)) / lmax; };
      api.label([ax0, 218], "time to copy a whole gene at " + api.fmt(v.rate) + " nt/s (log scale)", {color: c.muted, size: 12});
      api.line([ax0, yA], [ax1, yA], {color: c.axis, width: 1.2});
      [[1, "1 s"], [60, "1 min"], [3600, "1 h"], [86400, "1 day"]].forEach(function (t) {
        api.line([X(t[0]), yA - 4], [X(t[0]), yA + 4], {color: c.axis, width: 1.2});
        api.label([X(t[0]), yA + 16], t[1], {color: c.muted, size: 12, anchor: "middle"});
      });
      GENES.forEach(function (g, j) {
        var s = g.nt / v.rate, px = X(s);
        api.line([px, yA], [px, yA - 22 - (j % 2) * 18], {color: c.c4, width: 1.2, opacity: 0.6});
        api.point([px, yA], {color: c.c4, r: 4.5});
        api.label([px, yA - 30 - (j % 2) * 18], g.name + ": " + dur(s), {color: c.c4, size: 12, weight: 650, anchor: j === 2 ? "end" : "middle"});
      });
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
