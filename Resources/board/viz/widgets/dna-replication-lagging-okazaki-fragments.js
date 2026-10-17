// The lagging strand is made backward, in pieces. Its template runs 5'->3' toward the fork, so the new strand (always
// 5'->3') has to grow away from the fork: each Okazaki fragment starts at a fresh RNA primer laid near the fork and is
// extended back until it runs into the previous fragment's primer, leaving a nick. Fragments are 1,000-2,000 nt in
// bacteria and 100-200 nt in eukaryotes; primers about 10 nt (drawn to scale in the strip, at least 1.2 px wide).
// Copying L nt in fragments of l nt takes N = ceil(L / l) fragments: N primers and N - 1 nicks to seal.
(function () {
  function count(v) { return Math.ceil(v.L * 1000 / v.frag - 1e-9); }
  function txtInt(x) { return Math.round(x).toLocaleString("en-US"); }
  function texInt(x) { return txtInt(x).replace(/,/g, "{,}"); }

  Viz.register("dna-replication-lagging-okazaki-fragments", {
    title: "Okazaki fragments on the lagging strand",
    subject: "biology",
    shows: "Slide the stretch copied and the fragment length: the lagging strand is built backward from the fork in Okazaki fragments, one primer each, and every join leaves a nick to seal",
    params: {
      L: {kind: "number", default: 4, min: 1, max: 10, step: 0.5, label: "L\\ (\\text{kb})"},
      frag: {kind: "integer", default: 1000, min: 100, max: 2000, step: 50, label: "\\ell\\ (\\text{nt})"}
    },
    formula: function (v) {
      var n = count(v);
      return "\\begin{array}{l}N=\\left\\lceil\\dfrac{L}{\\ell}\\right\\rceil=\\left\\lceil\\dfrac{" + texInt(v.L * 1000) + "}{" + texInt(v.frag) + "}\\right\\rceil=" + n +
        "\\\\ \\text{primers}=" + n + ",\\ \\ \\text{nicks}=N-1=" + (n - 1) + "\\end{array}";
    },
    status: function (v) {
      var n = count(v);
      return "Copying " + api_fmt(v.L) + " kb in " + txtInt(v.frag) + "-nt pieces takes <b>" + n + "</b> Okazaki fragment" + (n > 1 ? "s" : "") + ": " + n + " primer" + (n > 1 ? "s" : "") +
        " to lay and <b>" + (n - 1) + "</b> nick" + (n === 2 ? "" : "s") + " to seal, against 1 primer and no nicks on the leading strand.";
    },
    examples: [
      {name: "short stretch, short fragments", values: {L: 1, frag: 100}},
      {name: "long stretch, long fragments", values: {L: 10, frag: 2000}},
      {name: "bacterial-size fragments", values: {L: 6, frag: 1500}},
      {name: "eukaryote-size fragments", values: {L: 2, frag: 150}},
      {name: "one fragment", values: {L: 1, frag: 1000}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, n = count(v);
      // ---- close-up at the fork (not to scale) ----
      var yT = 112, yN = 94;
      api.arrow([326, 24], [384, 24], {color: c.muted, width: 2, halo: false});
      api.label([320, 24], "fork moves", {color: c.muted, size: 12, anchor: "end"});
      api.line([16, yT], [338, yT], {color: c.c2, width: 3.5});
      api.line([338, yT], [392, yT], {color: c.c2, width: 3.5});
      api.line([338, yT - 22], [392, yT - 22], {color: c.c2, width: 3.5, opacity: 0.5});
      for (var x = 344; x < 392; x += 8) api.line([x, yT - 19], [x, yT - 3], {color: c.faint, width: 1});
      api.rect(332, yT - 30, 12, 38, {fill: c.c6, fillOpacity: 0.3, stroke: c.c6, width: 1.5, rx: 6});
      api.label([12, yT + 16], "5′", {color: c.c2, size: 12});
      api.label([200, yT + 34], "lagging-strand template", {color: c.c2, size: 12, anchor: "middle"});
      var frag = function (x3, x5, label, sub) {   // a fragment: 3' end (arrowhead) at x3, primer at its 5' end x5
        for (var q = x3 + 6; q < x5 - 2; q += 8) api.line([q, yN + 3], [q, yT - 3], {color: c.faint, width: 1});
        api.line([x3 + 6, yN], [x5, yN], {color: c.c3, width: 4});
        api.polygon([[x3, yN], [x3 + 9, yN - 5], [x3 + 9, yN + 5]], {fill: c.c3, fillOpacity: 1});
        api.line([x5 - 10, yN], [x5, yN], {color: c.c5, width: 5});
        api.label([(x3 + x5) / 2, yN - 18], label, {color: c.c3, size: 12, weight: 650, anchor: "middle"});
        if (sub) api.label([(x3 + x5) / 2, yN - 34], sub, {color: c.muted, size: 12, anchor: "middle"});
      };
      if (n > 1) frag(22, 140, "fragment " + (n - 1), "made earlier");
      else api.label([30, yN - 18], "origin", {color: c.muted, size: 12});
      frag(196, 268, "fragment " + n, "newest, growing ←");
      api.line([n > 1 ? 146 : 16, yN], [180, yN], {color: c.muted, width: 1.5, dash: "3 4"});
      api.label([n > 1 ? 163 : 98, yT + 18], "gap to copy", {color: c.muted, size: 12, anchor: "middle"});
      api.line([286, yN], [318, yN], {color: c.c5, width: 2, dash: "3 4"});
      api.label([302, yT + 18], "next primer here", {color: c.c5, size: 12, anchor: "middle"});
      api.label([192, yN + 1], "3′", {color: c.c3, size: 12, anchor: "end"});
      api.label([272, yN + 1], "5′", {color: c.c3, size: 12});
      // ---- the whole stretch, to scale ----
      var x0 = 30, x1 = 370, Lnt = v.L * 1000, X = function (nt) { return x0 + (x1 - x0) * nt / Lnt; };
      var pw = Math.max(1.2, X(10) - x0), yL = 186, yG = 236;
      api.line([x0, yL], [x1 - 6, yL], {color: c.c3, width: 4});
      api.polygon([[x1 + 2, yL], [x1 - 8, yL - 5], [x1 - 8, yL + 5]], {fill: c.c3, fillOpacity: 1});
      api.rect(x0, yL - 3.5, pw, 7, {fill: c.c5, rx: 1});
      api.label([x0, yL - 16], "leading strand: 1 primer, 1 piece", {color: c.c3, size: 12});
      for (var j = 0; j < n; j++) {
        var lo = j * v.frag, hi = Math.min(Lnt, (j + 1) * v.frag), a = X(lo) + (j ? 0.7 : 0), b = X(hi) - (j < n - 1 ? 0.7 : 0);
        api.line([a, yG], [b, yG], {color: c.c3, width: 4, opacity: 0.95});
        api.rect(Math.max(a, b - pw), yG - 3.5, Math.min(pw, b - a), 7, {fill: c.c5, rx: 1});
        if (n <= 12) api.label([(a + b) / 2, yG - 14], String(j + 1), {color: c.c3, size: 12, anchor: "middle"});
      }
      api.label([x0, yG + 18], "lagging strand: " + n + " fragment" + (n > 1 ? "s" : "") + (n > 12 ? " (too many to number)" : ", numbered oldest first"), {color: c.c3, size: 12});
      api.line([x0, 274], [x1, 274], {color: c.axis, width: 1.2});
      api.line([x0, 270], [x0, 278], {color: c.axis, width: 1.2}); api.line([x1, 270], [x1, 278], {color: c.axis, width: 1.2});
      api.label([x0, 288], "origin side", {color: c.muted, size: 12, anchor: "start"});
      api.label([x1, 288], api.fmt(v.L) + " kb, fork side", {color: c.muted, size: 12, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; });   // viz.css paints text ink
    }
  });
  function api_fmt(x) { return Viz.fmt(x, 1); }
})();
