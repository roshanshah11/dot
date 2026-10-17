// Why DNA replication needs an RNA primer: DNA polymerase can only add a nucleotide to an existing 3'-OH, so it cannot
// start a chain. Primase (an RNA polymerase) can, and lays a short RNA primer (E. coli DnaG: ~11 nt; human pol α-primase:
// ~10 nt of RNA that pol α extends with ~20 nt of DNA). The close-up is a lagging strand: the fork is to the left, the new
// fragment grows 5'->3' rightward until it meets the earlier fragment's primer, which is then swapped for DNA (E. coli
// pol I; human RNase H / FEN1 with pol δ) and the nick sealed by ligase. Below: one fork copying L kb needs one leading
// primer (laid at the origin) and one primer per Okazaki fragment, about 1,500 nt in E. coli (1-2 kb) and about 150 nt
// in human cells (100-200 nt), so N = 1 + ceil(L / l). Close-up primers are drawn 3 nt long, not to scale.
(function () {
  var TPL = "TACGGTCAAGTACATG", PAIR = {A: "T", T: "A", G: "C", C: "G"};
  var ORG = {
    "E. coli": {frag: 1500, rna: 11, primase: "DnaG primase", pol: "pol III", swap: "pol I swaps RNA for DNA", ligase: "DNA ligase"},
    "human": {frag: 150, rna: 10, primase: "pol α-primase", pol: "pol δ", swap: "FEN1 + pol δ swap RNA for DNA", ligase: "DNA ligase I"}
  };
  function count(v) { var o = ORG[v.org]; return Math.ceil(v.L * 1000 / o.frag); }
  function fmtInt(n) { return n.toLocaleString("en-US"); }

  Viz.register("dna-replication-rna-primer-initiation", {
    title: "RNA primers: how DNA replication gets started",
    subject: "biology",
    shows: "Step through why polymerase needs a primer: primase lays RNA with a free 3′-OH, polymerase extends it, and the RNA is later swapped for DNA; slide the length copied to count primers",
    params: {
      org: {kind: "enum", values: ["E. coli", "human"], default: "E. coli", label: "\\text{cell}"},
      L: {kind: "integer", default: 6, min: 1, max: 20, label: "L\\ \\text{(kb)}"}
    },
    steps: ["polymerase cannot start", "primase lays an RNA primer", "polymerase extends the 3′-OH", "RNA swapped for DNA, nick sealed"],
    stepMs: 1800,
    formula: function (v) {
      var o = ORG[v.org], n = count(v);
      return "\\begin{array}{l}N=1+\\left\\lceil\\dfrac{L}{\\ell}\\right\\rceil=1+\\left\\lceil\\dfrac{" + fmtInt(v.L * 1000).replace(/,/g, "{,}") + "}{" + fmtInt(o.frag).replace(/,/g, "{,}") + "}\\right\\rceil=" + (1 + n) +
        "\\\\ \\text{RNA share}=\\dfrac{" + o.rna + "}{" + fmtInt(o.frag).replace(/,/g, "{,}") + "}=" + Viz.n(100 * o.rna / o.frag, 1) + "\\%\\end{array}";
    },
    status: function (v) {
      var o = ORG[v.org], s = v.step || 1, n = count(v);
      var what = ["DNA polymerase can only add to an existing 3′-OH, so on bare template it has nowhere to start",
        (v.org === "human" ? "Pol α-primase needs no 3′ end: it lays about 10 nt of RNA (then about 20 nt of DNA)" : "Primase needs no 3′ end: it lays an RNA primer of about 11 nt") + " whose 3′-OH polymerase can use",
        "DNA polymerase adds dNTPs to the primer's 3′-OH, 5′→3′, until it runs into the earlier fragment",
        "The earlier fragment's RNA primer is replaced with DNA and ligase seals the nick, leaving one continuous strand"][s - 1];
    return what + "; copying " + v.L + " kb at one fork takes <b>" + fmtInt(1 + n) + "</b> primers, one leading and " + fmtInt(n) + " lagging.";
    },
    examples: [
      {name: "E. coli, 1 kb", values: {org: "E. coli", L: 1, step: 2}},
      {name: "E. coli, 20 kb", values: {org: "E. coli", L: 20, step: 3}},
      {name: "human, 1 kb", values: {org: "human", L: 1, step: 4}},
      {name: "human, 20 kb", values: {org: "human", L: 20, step: 1}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, o = ORG[v.org], X = function (i) { return 36 + i * 21.6; };
      var yT = 48, yN = 82, yA = 120;                                  // template, new strand, annotations
      api.arrow([92, 14], [34, 14], {color: c.muted, width: 2, halo: false});
      api.label([98, 14], "fork moves", {color: c.muted, size: 12});
      // template strand on top, read 3' -> 5' left to right
      api.line([X(0) - 12, yT - 13], [X(15) + 12, yT - 13], {color: c.c2, width: 3});
      api.label([X(0) - 24, yT - 13], "3′", {color: c.c2, size: 12, anchor: "middle"});
      api.label([X(15) + 22, yT - 13], "5′", {color: c.c2, size: 12, anchor: "middle"});
      api.label([X(15) + 10, 14], "lagging-strand template", {color: c.c2, size: 12, anchor: "end"});
      for (var i = 0; i < 16; i++) api.label([X(i), yT], TPL[i], {color: c.c2, size: 13, weight: 650, anchor: "middle"});
      // new strand bases: what each position holds at this step
      var kind = function (i) {
        if (i >= 13) return "dna";
        if (i >= 11) return s === 4 ? "dna" : "rna";                 // the earlier fragment's primer
        if (i <= 2) return s >= 2 ? "rna" : null;                      // the new primer
        return s >= 3 ? "dna" : null;
      };
      for (i = 0; i < 16; i++) {
        var k = kind(i); if (!k) continue;
        var b = PAIR[TPL[i]], rna = k === "rna";
        api.line([X(i), yT + 8], [X(i), yN - 8], {color: c.faint, width: 1.2});
        api.label([X(i), yN], rna ? b.replace("T", "U") : b, {color: rna ? c.c5 : c.c3, size: 13, weight: 700, anchor: "middle"});
      }
      // backbones: one piece per fragment until ligase joins them
      var run = function (a, b) { api.line([X(a) - 8, yN + 12], [X(b) + 7, yN + 12], {color: c.c3, width: 2.5}); };
      if (s >= 2) run(0, s >= 3 ? 10 : 2);
      if (s === 4) run(0, 15); else run(11, 15);
      api.label([X(15) + 20, yN + 12], "3′", {color: c.c3, size: 12, anchor: "middle"});
      if (s >= 2) api.label([X(0) - 22, yN + 12], "5′", {color: c.c3, size: 12, anchor: "middle"});
      if (s < 4) api.label([X(11) + 10.8, yA + 18], "earlier fragment", {color: c.c3, size: 12});
      if (s < 3) api.label([X(11) + 10.8, yA], "RNA", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      var body = function (a, b, col, active) {
        api.rect(X(a) - 13, yN - 22, X(b) - X(a) + 26, 44, {rx: 16, fill: col, fillOpacity: active ? 0.2 : 0.1, stroke: col, width: active ? 1.8 : 1.2});
      };
      if (s === 1) {
        body(0, 1, c.c6, true);
        api.label([X(0.5), yA], "DNA polymerase", {color: c.c6, size: 12, weight: 700, anchor: "middle"});
        api.label([X(1) + 20, yN], "✕ no 3′-OH to extend", {color: c.c5, size: 12, weight: 650, raw: true});
      } else if (s === 2) {
        body(0, 2, c.c1, true);
        api.label([X(2) + 20, yN - 8], o.primase, {color: c.c1, size: 12, weight: 700});
        api.label([X(2) + 20, yN + 12], "← 3′-OH", {color: c.c5, size: 12, weight: 650, raw: true});
        api.label([X(1), yA], "RNA primer", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      } else if (s === 3) {
        body(9, 10, c.c6, true);
        api.label([X(9.5), yA], o.pol, {color: c.c6, size: 12, weight: 700, anchor: "middle"});
        api.arrow([X(3) - 4, yA], [X(7.6), yA], {color: c.c3, width: 2, halo: false, head: 8});
        api.label([X(1), yA], "primer", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
        api.label([X(10) + 8, yA + 18], "nick ↑", {color: c.muted, size: 12, anchor: "end", raw: true});
      } else {
        body(11, 12, c.c6, false);
        api.label([X(11) + 10.8, yA], o.swap, {color: c.c6, size: 12, weight: 650, anchor: "middle"});
        api.circle([X(12) + 10.8, yN + 12], 6.5, {fill: c.c4, fillOpacity: 0.55, stroke: c.c4, width: 1.6});
        api.label([X(12) + 10.8, yA + 18], o.ligase + " seals the nick", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
        api.label([X(1), yA], "next primer", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      }
      // ---- one fork copying L kb: primers to scale ----
      var n = count(v), x0 = 30, x1 = 370, per = (x1 - x0) / (v.L * 1000), yL = 202, yG = 238;
      api.label([x0, 166], "one fork copying " + v.L + " kb (" + v.org + ", fragments ≈ " + fmtInt(o.frag) + " nt)", {color: c.muted, size: 12});
      api.line([x0, yL], [x1, yL], {color: c.c3, width: 4});
      api.rect(x1 - Math.max(2.5, o.rna * per), yL - 4, Math.max(2.5, o.rna * per), 8, {rx: 1, fill: c.c5});
      api.label([x0, yL - 14], "leading strand: 1 primer, at the origin end", {color: c.c3, size: 12});
      for (var f = 0; f < n; f++) {
        var a = x0 + f * o.frag * per, e = Math.min(x1, a + o.frag * per);
        api.line([a + 0.6, yG], [Math.max(a + 0.6, e - 0.6), yG], {color: c.c3, width: 4, opacity: 0.9});
        api.rect(a, yG - 4, Math.max(1.6, o.rna * per), 8, {rx: 1, fill: c.c5});
      }
      api.label([x0, yG + 17], "lagging strand: " + fmtInt(n) + " Okazaki fragment" + (n > 1 ? "s" : "") + ", each from its own primer", {color: c.c3, size: 12});
      api.label([x1, 290], "red: RNA primer", {color: c.c5, size: 12, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
