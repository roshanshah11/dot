// How a primer directs synthesis in PCR: after denaturation each primer anneals antiparallel to the 3' end of its
// template strand, and polymerase adds dNTPs only to the primer's free 3'-OH, each new base pairing with the template
// (A-T, G-C), so every new strand grows 5' to 3' and starts exactly at its primer. Two primer designs show why the 3'
// end is what matters: a 3'-terminal mismatch leaves no paired end to extend (Taq has no proofreading to remove it),
// while a 5' tail that pairs with nothing is carried into the copy (how primers add a restriction site).
// Primers are drawn 6 nt long to fit; real primers are about 18 to 25 nt.
(function () {
  var TOP = "ATGGCTAGCAAGTTCGACTGCA", L = TOP.length, PL = 6, TAIL = "GAATTC";
  var COMP = {A: "T", T: "A", G: "C", C: "G"}, MIS = {A: "C", T: "G", G: "A", C: "T"};   // MIS: a base that does not pair
  var BOT = TOP.split("").map(function (b) { return COMP[b]; }).join("");               // bottom strand, read 3' -> 5'
  function model(v) {
    var stall = v.fwd === "mismatch3", fAdd = stall ? 0 : v.added, rAdd = v.added;
    var fwdPrimer = TOP.slice(0, PL - 1) + (stall ? MIS[TOP[PL - 1]] : TOP[PL - 1]);
    return {stall: stall, tail: v.fwd === "tail5", fAdd: fAdd, rAdd: rAdd, fwdPrimer: fwdPrimer,
            fwdNew: TOP.slice(PL, PL + fAdd), len: (v.fwd === "tail5" ? TAIL.length : 0) + PL + fAdd};
  }

  Viz.register("pcr-primer-directed-extension", {
    title: "PCR: primers direct the extension",
    subject: "biology",
    shows: "Slide the extension: polymerase adds bases only to each primer's 3′ end, pairing with the template; give the forward primer a 3′ mismatch or a 5′ tail to see why only the 3′ end must pair",
    params: {
      added: {kind: "integer", default: 7, min: 0, max: L - PL, label: "\\text{added}"},
      fwd: {kind: "enum", values: ["matched", "mismatch3", "tail5"], default: "matched", label: "\\text{primer}",
            names: {matched: "matched", mismatch3: "3′ mismatch", tail5: "5′ tail"}}
    },
    formula: function (v) {
      var m = model(v), tail = m.tail ? "\\texttt{" + TAIL.toLowerCase() + "}" : "";
      return "\\begin{array}{l}5'\\text{-}" + tail + "\\underline{\\texttt{" + m.fwdPrimer + "}}\\texttt{" + (m.fwdNew.length > 10 ? m.fwdNew.slice(0, 4) + "}\\ldots\\texttt{" + m.fwdNew.slice(-4) : m.fwdNew || "\\,") + "}\\text{-}3'\\\\ \\text{length}=" +
        (m.tail ? TAIL.length + "+" : "") + PL + "+" + m.fAdd + "=" + m.len + "\\text{ nt}\\end{array}";
    },
    status: function (v) {
      var m = model(v), k = v.added, n = L - PL;
      if (m.stall) return "The forward primer's 3′ base (" + m.fwdPrimer[PL - 1] + ") does not pair with " + BOT[PL - 1] + ", so Taq, which cannot remove it, <b>barely extends</b> that primer, while the reverse primer has gained " + k + " nt.";
      if (m.tail) return "The 5′ tail " + TAIL + " (an EcoRI site) pairs with nothing, but extension only needs a paired 3′ end, so the copy grows to <b>" + m.len + " nt</b> and carries the site.";
      if (k === 0) return "Both primers have annealed antiparallel to the 3′ end of their template; polymerase can add bases only to each primer's free <b>3′-OH</b>.";
      if (k === n) return "Done: each new strand runs from its primer's 5′ end to the end of the template (<b>" + L + " nt</b>), so every copy starts exactly at a primer.";
      return "Polymerase has added <b>" + k + " of " + n + "</b> bases to each primer, each pairing with the template base opposite, so both new strands grow 5′ → 3′, in opposite directions.";
    },
    examples: [
      {name: "just annealed", values: {added: 0}},
      {name: "fully extended", values: {added: L - PL}},
      {name: "3′ mismatch stalls", values: {added: L - PL, fwd: "mismatch3"}},
      {name: "5′ tail carried along", values: {added: L - PL, fwd: "tail5"}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, m = model(v), X = function (i) { return 64 + i * 14.5; };
      var yT = 40, yR = 64, yF = 200, yB = 224;   // top template, reverse copy, forward copy, bottom template (letter rows)
      function bases(seq, start, y, color, opts) {
        opts = opts || {};
        seq.split("").forEach(function (b, j) {
          api.label([X(start + j), y], b, {color: opts.colorAt ? opts.colorAt(j) : color, size: 12.5, weight: 700, anchor: "middle", opacity: opts.fade ? 0.45 : 1});
        });
      }
      function ticks(from, to, y1, y2, skip) {
        for (var i = from; i < to; i++) if (i !== skip) api.line([X(i), y1], [X(i), y2], {color: c.ink, width: 1.1, opacity: 0.5});
      }
      // templates: top 5'->3' (teal), bottom 3'->5' (blue), backbones on the outside
      api.line([X(0) - 6, yT - 13], [X(L - 1) + 6, yT - 13], {color: c.c1, width: 3});
      api.line([X(0) - 6, yB + 13], [X(L - 1) + 6, yB + 13], {color: c.c2, width: 3});
      bases(TOP, 0, yT, c.c1); bases(BOT, 0, yB, c.c2);
      api.label([X(0) - 14, yT - 13], "5′", {color: c.c1, size: 12, anchor: "end"}); api.label([X(L - 1) + 14, yT - 13], "3′", {color: c.c1, size: 12});
      api.label([X(0) - 14, yB + 13], "3′", {color: c.c2, size: 12, anchor: "end"}); api.label([X(L - 1) + 14, yB + 13], "5′", {color: c.c2, size: 12});
      api.label([X(0) - 14, yT + 12], "template", {color: c.c1, size: 12, anchor: "end"});
      api.label([X(0) - 14, yB - 12], "template", {color: c.c2, size: 12, anchor: "end"});
      // reverse primer: pairs with the top strand's 3' end, grows leftward
      var r0 = L - PL - m.rAdd;
      bases(BOT.slice(L - PL), L - PL, yR, c.c4);
      bases(BOT.slice(r0, L - PL), r0, yR, c.c3);
      ticks(r0, L, yT + 8, yR - 8);
      api.line([X(r0) - 6, yR + 13], [X(L - 1) + 6, yR + 13], {color: c.c3, width: 3});
      api.line([X(L - PL) - 6, yR + 13], [X(L - 1) + 6, yR + 13], {color: c.c4, width: 3});
      api.label([X(L - 1) + 14, yR + 13], "5′", {color: c.c4, size: 12});
      api.label([X(L - 1) + 4, yR + 28], "reverse primer", {color: c.c4, size: 12, anchor: "end"});
      // forward primer: pairs with the bottom strand's 3' end, grows rightward
      var f1 = PL + m.fAdd;
      bases(m.fwdPrimer, 0, yF, c.c4, {colorAt: function (j) { return m.stall && j === PL - 1 ? c.c5 : c.c4; }});
      bases(m.fwdNew, PL, yF, c.c3);
      ticks(0, f1, yF + 8, yB - 8, m.stall ? PL - 1 : -1);
      api.line([X(0) - 6, yF - 13], [X(f1 - 1) + 6, yF - 13], {color: c.c3, width: 3});
      api.line([X(0) - 6, yF - 13], [X(PL - 1) + 6, yF - 13], {color: c.c4, width: 3});
      api.label([X(0) + 2, yF - 28], "forward primer", {color: c.c4, size: 12});
      if (m.tail) {   // the 5' tail is single-stranded: a flap angled away from the template
        TAIL.split("").reverse().forEach(function (b, j) {
          api.label([X(0) - 8 - 7 * j, yF - 18 - 13 * j], b, {color: c.c6, size: 12.5, weight: 700, anchor: "middle"});
        });
        api.label([X(0) - 2, yF - 98], "5′ tail: EcoRI site", {color: c.c6, size: 12, weight: 650, anchor: "middle"});
      } else api.label([X(0) - 14, yF - 13], "5′", {color: c.c4, size: 12, anchor: "end"});
      if (m.stall) api.label([X(PL - 1), yF + 12], "✕", {color: c.c5, size: 12, weight: 700, anchor: "middle"});
      // polymerase at each growing 3' end, with the next dNTP waiting
      function pol(i, y, dir, next) {
        api.rect(X(i) - 16 + dir * 12, y - 30, 34, 60, {rx: 16, fill: c.c6, fillOpacity: 0.16, stroke: c.c6, width: 1.3});
        if (next) api.label([X(i + dir), y], next, {color: c.c3, size: 12.5, weight: 700, anchor: "middle", opacity: 0.5});
      }
      if (r0 > 0) pol(r0, (yT + yR) / 2 + 12, -1, BOT[r0 - 1]);
      api.label([X(r0) - 14, yR + 13], "3′", {color: c.c3, size: 12, weight: 650, anchor: "end"});
      if (!m.stall && f1 < L) pol(f1 - 1, (yF + yB) / 2 - 12, 1, TOP[f1]);
      if (m.stall) api.label([X(PL - 1) + 14, yF - 13], "3′ stalled", {color: c.c5, size: 12, weight: 650});
      else api.label([X(f1 - 1) + 14, yF - 13], "3′", {color: c.c3, size: 12, weight: 650});
      // direction of synthesis
      api.arrow([X(14), 114], [X(6), 114], {color: c.c3, width: 2.5, halo: false});
      api.arrow([X(6), 154], [X(14), 154], {color: c.c3, width: 2.5, halo: false});
      api.label([X(14) + 10, 114], "grows 5′→3′", {color: c.c3, size: 12});
      api.label([X(14) + 10, 154], "grows 5′→3′", {color: c.c3, size: 12});
      api.label([X(10), 134], "polymerase adds only at a 3′ end", {color: c.c6, size: 12, anchor: "middle"});
      api.label([200, 280], "primers shortened to 6 nt; real ones are about 20", {color: c.muted, size: 12, anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
