// A restriction enzyme cuts the sugar-phosphate backbone of each strand inside its palindromic site. When the two cuts
// are staggered, the few base pairs between them cannot hold the ends together, so each end keeps a short single-stranded
// overhang: G^AATTC (EcoRI) and G^GATCC (BamHI) leave 5' overhangs, CTGCA^G (PstI) leaves 3' overhangs, and CCC^GGG
// (SmaI) cuts straight across, leaving blunt ends. Any two ends cut by the same enzyme have complementary overhangs, so
// a vector end and an insert end base-pair, and DNA ligase seals the two nicks. Cut positions in the top strand's
// coordinates: top after k bases of the site, bottom after n - k (the site reads the same on both strands).
(function () {
  var ENZ = {EcoRI: {site: "GAATTC", k: 1}, BamHI: {site: "GGATCC", k: 1}, PstI: {site: "CTGCAG", k: 5}, SmaI: {site: "CCCGGG", k: 3}};
  var LEFT = "TTACG", RIGHT = "TACAT", INS = "ATGTG", COMP = {A: "T", T: "A", G: "C", C: "G"};
  function model(v) {
    var e = ENZ[v.enzyme], n = e.site.length, S = LEFT.length, topCut = S + e.k, botCut = S + n - e.k;
    var lo = Math.min(topCut, botCut), hi = Math.max(topCut, botCut), over = e.site.slice(lo - S, hi - S);
    var kind = topCut < botCut ? "5′" : topCut > botCut ? "3′" : "blunt";
    return {e: e, n: n, S: S, top: LEFT + e.site + RIGHT, ins: LEFT + e.site + INS, topCut: topCut, botCut: botCut, over: over, kind: kind,
            cutTop: e.site.slice(0, e.k) + "|" + e.site.slice(e.k), cutBot: e.site.split("").map(function (b) { return COMP[b]; }).join("").slice(0, n - e.k) + "|" +
            e.site.split("").map(function (b) { return COMP[b]; }).join("").slice(n - e.k)};
  }
  Viz.register("restriction-enzyme-sticky-end-cleavage", {
    title: "Sticky ends: how a restriction enzyme cuts",
    subject: "biology",
    shows: "Step through binding, cutting, separating and ligating: staggered cuts leave matching single-stranded overhangs (sticky ends); a straight cut leaves blunt ends",
    params: {
      enzyme: {kind: "enum", values: ["EcoRI", "BamHI", "PstI", "SmaI"], default: "EcoRI", label: "\\text{enzyme}"}
    },
    steps: ["the enzyme binds its site", "both backbones are cut", "the ends come apart", "a matching end pairs; ligase seals"],
    stepMs: 1700,
    formula: function (v) {
      var m = model(v), t = m.cutTop.split("|"), b = m.cutBot.split("|");
      var res = m.kind === "blunt" ? "\\text{blunt ends}" : "\\text{" + m.kind.replace("′", "'") + " overhang } \\texttt{" + m.over + "}";
      return "\\begin{array}{l}5'\\text{-}\\texttt{" + t[0] + "}{\\downarrow}\\texttt{" + t[1] + "}\\text{-}3'\\\\3'\\text{-}\\texttt{" + b[0] + "}{\\uparrow}\\texttt{" + b[1] + "}\\text{-}5'\\end{array}\\Rightarrow " + res;
    },
    status: function (v) {
      var m = model(v), s = v.step || 1, gap = Math.abs(m.topCut - m.botCut);
      if (s === 1) return v.enzyme + " is a dimer: it grips the palindrome <b>" + m.e.site + "</b>, one half on each strand, since both strands read the same 5′→3′.";
      if (s === 2) return m.kind === "blunt" ? "It cuts both backbones straight across, between <b>CCC and GGG</b>, so no bases are left unpaired." :
        "It cuts each backbone after base " + m.e.k + " of the site, so the two cuts sit <b>" + gap + " bases apart</b> on opposite strands.";
      if (s === 3) return m.kind === "blunt" ? "The ends come apart fully paired: <b>blunt ends</b>, with nothing single-stranded to grab a partner." :
        "Only " + gap + " base pairs held the ends together, so they part, each carrying a single-stranded <b>" + m.kind + " " + m.over + "</b> overhang.";
      return m.kind === "blunt" ? "Blunt ends have nothing to pair, so <b>ligase</b> joins an insert only when the ends happen to meet, which is less efficient." :
        "An insert cut by " + v.enzyme + " has the complementary " + m.over + " overhang, so the ends base-pair and <b>DNA ligase</b> seals the two nicks.";
    },
    examples: [
      {name: "EcoRI ends apart", values: {enzyme: "EcoRI", step: 3}},
      {name: "PstI: 3' overhang", values: {enzyme: "PstI", step: 3}},
      {name: "SmaI: blunt", values: {enzyme: "SmaI", step: 2}},
      {name: "BamHI ligated", values: {enzyme: "BamHI", step: 4}}
    ],
    size: [400, 260],
    draw: function (api, v) {
      var c = api.color, m = model(v), s = v.step || 1, N = m.top.length, yT = 104, yB = 144;
      var X = function (i) { return 70 + i * 18; };
      var split = s === 3 ? 22 : 0;                 // the two halves drift apart once the bonds between the cuts let go
      var dx = function (i, cut) { return i < cut ? -split : split; };
      var inSite = function (i) { return i >= m.S && i < m.S + m.n; };
      var rightSeq = s === 4 ? m.ins : m.top;       // in step 4 the right half is an insert cut with the same enzyme
      var colOf = function (i) { if (s === 4 && i >= m.S + m.n) return c.c2; if (s >= 3 && i >= Math.min(m.topCut, m.botCut) && i < Math.max(m.topCut, m.botCut)) return c.c3; return inSite(i) ? c.c1 : c.muted; };
      if (s <= 2) {   // the enzyme, one lobe per strand
        api.rect(X(m.S) - 15, yT - 38, (m.n - 1) * 18 + 30, 27, {fill: c.c6, fillOpacity: 0.2, stroke: c.c6, width: 1.4, rx: 13});
        api.rect(X(m.S) - 15, yB + 11, (m.n - 1) * 18 + 30, 27, {fill: c.c6, fillOpacity: 0.2, stroke: c.c6, width: 1.4, rx: 13});
        api.label([X(m.S) + (m.n - 1) * 9, yT - 50], v.enzyme + " (two halves)", {color: c.c6, size: 12.5, weight: 650, anchor: "middle"});
      }
      // backbones: one line per strand piece; broken at the cut from step 2 on
      var piece = function (i0, i1, y, cut) {   // in step 4 the right-hand pieces belong to the insert
        var d = dx(i0, cut);
        api.line([X(i0) - 7 + d, y], [X(i1 - 1) + 7 + d, y], {color: s === 4 && i0 > 0 ? c.c2 : c.faint, width: 2.5, opacity: s === 4 && i0 > 0 ? 0.6 : 1});
      };
      var by = [yT - 14, yB + 14];
      if (s === 1) { piece(0, N, by[0], 99); piece(0, N, by[1], 99); }
      else { piece(0, m.topCut, by[0], m.topCut); piece(m.topCut, N, by[0], m.topCut); piece(0, m.botCut, by[1], m.botCut); piece(m.botCut, N, by[1], m.botCut); }
      for (var i = 0; i < N; i++) {
        var seqI = i < m.topCut ? m.top : rightSeq, bseq = i < m.botCut ? m.top : rightSeq;
        var xt = X(i) + dx(i, m.topCut), xb = X(i) + dx(i, m.botCut);
        api.label([xt, yT], seqI[i], {color: colOf(i), size: 15, weight: 700, anchor: "middle"});
        api.label([xb, yB], COMP[bseq[i]], {color: colOf(i), size: 15, weight: 700, anchor: "middle"});
        if (xt === xb) api.line([xt, yT + 10], [xt, yB - 10], {color: c.ink, width: 1.2, opacity: 0.45});   // a base pair holds
      }
      // the cut marks and, at the end, the sealed nicks
      if (s === 2) {
        api.line([X(m.topCut) - 9, yT - 20], [X(m.topCut) - 9, yT - 4], {color: c.c5, width: 2.5});
        api.line([X(m.botCut) - 9, yB + 4], [X(m.botCut) - 9, yB + 20], {color: c.c5, width: 2.5});
      }
      if (s === 4) {
        [[X(m.topCut) - 9, by[0]], [X(m.botCut) - 9, by[1]]].forEach(function (q) { api.point(q, {color: c.c4, r: 5}); });
        api.label([X(m.topCut) - 9, yT - 34], "ligase seals the nick", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
        api.label([X(m.botCut) - 9, yB + 34], "and this nick", {color: c.c4, size: 12, anchor: "middle"});
        api.label([X(N - 1) + 4, yB + 56], "insert DNA →", {color: c.c2, size: 12.5, weight: 650, anchor: "end"});
        api.label([X(0) - 4, yB + 56], "← vector DNA", {color: c.muted, size: 12.5, weight: 650});
      }
      // strand ends
      var e5 = [X(0) - 22 + dx(0, 1), X(N - 1) + 22 + dx(N - 1, 0)];
      api.label([e5[0], yT], "5′", {color: c.muted, size: 12, anchor: "middle"}); api.label([e5[1], yT], "3′", {color: c.muted, size: 12, anchor: "middle"});
      api.label([e5[0], yB], "3′", {color: c.muted, size: 12, anchor: "middle"}); api.label([e5[1], yB], "5′", {color: c.muted, size: 12, anchor: "middle"});
      if (s === 3) {
        var mid = (X(m.topCut) + X(m.botCut)) / 2 - 9;
        api.label([mid, yB + 44], m.kind === "blunt" ? "blunt ends: every base still paired" : "single-stranded " + m.kind + " overhangs: " + m.over + " on each end",
          {color: m.kind === "blunt" ? c.ink : c.c3, size: 12.5, weight: 650, anchor: "middle"});
      }
      var note = {1: "recognition site in teal", 2: "red: where each backbone breaks", 3: "", 4: m.kind === "blunt" ? "blunt ends joined: the site is rebuilt" : "overhangs paired: the site " + m.e.site + " is rebuilt"}[s];
      if (note) api.label([200, 236], note, {color: s === 4 ? c.c4 : c.muted, size: 12, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
