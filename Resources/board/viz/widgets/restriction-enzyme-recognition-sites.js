// A restriction enzyme scans double-stranded DNA for one short sequence, its recognition site. Most sites are
// palindromes: the top strand read 5'->3' spells the same thing as the bottom strand read 5'->3' (right to left), so
// the enzyme, a two-part dimer, finds the site from either side. Shorter sites turn up more often: in random DNA with
// equal base frequencies a given n-bp site has probability (1/4)^n at each position, so it appears about once per 4^n bp
// and about L / 4^n times in L bp. The sequence below holds one EcoRI, one HindIII and one NotI site, and two AluI sites
// (one inside the HindIII site, since AAGCTT contains AGCT).
(function () {
  var SEQ = "TGAATTCAGCTGTAAGCTTCGCGGCCGCAT", COMP = {A: "T", T: "A", G: "C", C: "G"};
  var ENZ = {EcoRI: "GAATTC", HindIII: "AAGCTT", AluI: "AGCT", NotI: "GCGGCCGC"};
  function hits(site) { var out = []; for (var i = 0; i + site.length <= SEQ.length; i++) if (SEQ.substr(i, site.length) === site) out.push(i); return out; }
  function expected(n, kb) { return kb * 1000 / Math.pow(4, n); }
  function num(x) { return x >= 100 ? Math.round(x).toLocaleString("en-US") : x >= 10 ? x.toFixed(1) : x >= 1 ? x.toFixed(2).replace(/0$/, "") : x.toFixed(2); }
  Viz.register("restriction-enzyme-recognition-sites", {
    title: "Restriction enzyme recognition sites",
    subject: "biology",
    shows: "Pick an enzyme: it finds its own short palindrome on both strands, and the shorter the site, the more often it turns up (about once every 4^n bp)",
    params: {
      enzyme: {kind: "enum", values: ["EcoRI", "HindIII", "AluI", "NotI"], default: "EcoRI", label: "\\text{enzyme}"},
      kb: {kind: "integer", default: 48, min: 1, max: 100, label: "L\\ (\\text{kb})"}
    },
    formula: function (v) {
      var n = ENZ[v.enzyme].length, per = Math.pow(4, n);
      return "\\small\\begin{array}{l}p = (1/4)^{" + n + "}:\\ 1 \\text{ site per } 4^{" + n + "} = " + per.toLocaleString("en-US").replace(/,/g, "{,}") + "\\text{ bp}\\\\" +
        "\\text{in } " + v.kb + "\\text{ kb: } " + (v.kb * 1000).toLocaleString("en-US").replace(/,/g, "{,}") + "/" + per.toLocaleString("en-US").replace(/,/g, "{,}") + " \\approx " + num(expected(n, v.kb)).replace(/,/g, "{,}") + "\\text{ sites}\\end{array}";
    },
    status: function (v) {
      var site = ENZ[v.enzyme], n = site.length, h = hits(site), e = num(expected(n, v.kb));
      var lead = v.enzyme + " reads <b>" + site + "</b> on both strands";
      if (v.enzyme === "AluI") return lead + ", and its 4-bp site turns up twice here, once inside the HindIII site; in " + v.kb + " kb of random DNA expect about <b>" + e + "</b>.";
      if (v.enzyme === "NotI") return lead + ", a rare 8-bp site: " + v.kb + " kb of random DNA holds about <b>" + e + "</b> of them, so it often cuts a genome into only a few big pieces.";
      return lead + " (" + h.length + " site in this stretch); in " + v.kb + " kb of random DNA expect about <b>" + e + "</b> sites.";
    },
    examples: [
      {name: "4-bp cutter, shortest DNA", values: {enzyme: "AluI", kb: 1}},
      {name: "8-bp cutter, longest DNA", values: {enzyme: "NotI", kb: 100}},
      {name: "HindIII contains AluI", values: {enzyme: "HindIII", kb: 48}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, site = ENZ[v.enzyme], n = site.length, h = hits(site);
      var col = {EcoRI: c.c1, HindIII: c.c6, AluI: c.c4, NotI: c.c3}[v.enzyme];
      var X = function (i) { return 34 + i * 11.3; }, yT = 52, yB = 78;
      // the recognition sites, boxed across both strands
      h.forEach(function (i) { api.rect(X(i) - 6.5, yT - 13, (n - 1) * 11.3 + 13, yB - yT + 26, {fill: col, fillOpacity: 0.16, stroke: col, width: 1.6, rx: 5}); });
      for (var i = 0; i < SEQ.length; i++) {
        var inSite = h.some(function (s) { return i >= s && i < s + n; });
        api.label([X(i), yT], SEQ[i], {color: inSite ? col : c.muted, size: 13, weight: inSite ? 750 : 500, anchor: "middle"});
        api.label([X(i), yB], COMP[SEQ[i]], {color: inSite ? col : c.muted, size: 13, weight: inSite ? 750 : 500, anchor: "middle"});
      }
      api.label([X(0) - 10, yT], "5′", {color: c.muted, size: 12, anchor: "end"});
      api.label([X(29) + 10, yT], "3′", {color: c.muted, size: 12});
      api.label([X(0) - 10, yB], "3′", {color: c.muted, size: 12, anchor: "end"});
      api.label([X(29) + 10, yB], "5′", {color: c.muted, size: 12});
      // the palindrome: both strands, each read 5'->3', spell the site
      var s0 = h[0], a = X(s0) - 4, b = X(s0 + n - 1) + 4, mid = (a + b) / 2;
      api.arrow([a, yT - 22], [b, yT - 22], {color: col, width: 2, halo: false, head: 7});
      api.arrow([b, yB + 22], [a, yB + 22], {color: col, width: 2, halo: false, head: 7});
      api.label([mid, yB + 38], "both strands read 5′→3′: " + site, {color: col, size: 12.5, weight: 650, anchor: "middle"});
      if (v.enzyme === "AluI") {   // the second AluI site sits inside the HindIII site
        api.rect(X(13) - 8, yT - 15, 5 * 11.3 + 16, yB - yT + 30, {stroke: c.c6, width: 1.3, dash: "4 3", rx: 6});
        api.label([(X(13) + X(18)) / 2, yT - 26], "HindIII site", {color: c.c6, size: 12, anchor: "middle"});
      }
      // how often each site length turns up in L kb of random DNA, on a log axis
      var ax0 = 92, ax1 = 380, lo = -2, hi = 3, LX = function (x) { return ax0 + (ax1 - ax0) * (Math.log10(x) - lo) / (hi - lo); };
      var top = 170, rowH = 28;
      api.label([20, top - 18], "expected sites in " + v.kb + " kb of random DNA", {color: c.muted, size: 12});
      [0.01, 0.1, 1, 10, 100, 1000].forEach(function (t) {
        api.line([LX(t), top - 4], [LX(t), top + 3 * rowH - 6], {color: c.grid, width: 1});
        api.label([LX(t), top + 3 * rowH + 6], t >= 1 ? String(t) : String(t), {color: c.muted, size: 12, anchor: "middle"});
      });
      api.line([ax0, top + 3 * rowH - 6], [ax1, top + 3 * rowH - 6], {color: c.axis, width: 1.2});
      api.label([ax1, top + 3 * rowH + 24], "sites (log scale)", {color: c.muted, size: 12, anchor: "end"});
      [4, 6, 8].forEach(function (len, k) {
        var y = top + k * rowH + 8, e = expected(len, v.kb), on = len === n, x = LX(e);
        api.label([20, y], len + " bp", {color: on ? col : c.muted, size: 12.5, weight: on ? 700 : 500});
        api.line([ax0, y], [ax1, y], {color: c.grid, width: 1, dash: "2 4"});
        api.point([x, y], {color: on ? col : c.muted, r: on ? 6 : 4.5});
        var txt = num(e) + (len === 4 ? " (1 per 256 bp)" : len === 6 ? " (1 per 4,096 bp)" : " (1 per 65,536 bp)"), right = x + 11 + txt.length * 6.8 < 397;
        api.label([x + (right ? 11 : -11), y], txt, {color: on ? col : c.muted, size: 12, weight: on ? 650 : 500, anchor: right ? "start" : "end"});
      });
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
