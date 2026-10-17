// Genomic imprinting: for an imprinted gene only one parent's copy is expressed, set by a mark laid down in that
// parent's germline. In every germline the old marks are erased and new ones set by the parent's sex, so whether a
// child is affected by a deletion depends on which parent passed it on, not on where that parent got it. Classic
// human pair: paternal-only genes in 15q11-q13 (SNRPN and neighbours; lost from the father's copy in Prader-Willi
// syndrome) and maternal-only UBE3A in neurons (lost from the mother's copy in Angelman syndrome).
// The child shown is one who inherits the carrier's deleted copy (a 1 in 2 chance).
(function () {
  function people(v) {
    // each parent: [homolog from their mother, homolog from their father]; marks are set by where it came from
    var del = function (who, side) { return v.carrier === who && v.origin === side; };
    var reads = function (mark) { return mark === v.active; };
    var par = {father: [{mark: "maternal", del: del("father", "maternal")}, {mark: "paternal", del: del("father", "paternal")}],
               mother: [{mark: "maternal", del: del("mother", "maternal")}, {mark: "paternal", del: del("mother", "paternal")}]};
    var hit = function (pair) { return pair.some(function (h) { return reads(h.mark) && h.del; }); };
    var pass = function (who) { var pair = par[who]; return pair[0].del || pair[1].del; };   // the child gets the deleted copy if there is one
    var child = [{mark: "paternal", del: pass("father")}, {mark: "maternal", del: pass("mother")}];
    return {par: par, fAff: hit(par.father), mAff: hit(par.mother), child: child, cAff: hit(child)};
  }
  var SYN = {paternal: "as in Prader-Willi syndrome", maternal: "as in Angelman syndrome"};

  Viz.register("genomic-imprinting-parent-of-origin", {
    title: "Genomic imprinting: parent of origin",
    subject: "biology",
    shows: "Choose which parent's copy of an imprinted gene is read and who carries a deletion: marks are erased and reset in each parent's germline, so the child's fate depends on which parent passed the deletion on",
    params: {
      active: {kind: "enum", values: ["paternal", "maternal"], names: {paternal: "father's (SNRPN)", maternal: "mother's (UBE3A)"}, default: "paternal", label: "\\text{copy read}"},
      carrier: {kind: "enum", values: ["father", "mother", "neither"], default: "father", label: "\\text{carrier}"},
      origin: {kind: "enum", values: ["maternal", "paternal"], names: {maternal: "their mother", paternal: "their father"}, default: "maternal", label: "\\text{from}"}
    },
    steps: ["the parents", "germline: marks erased and reset", "the child"],
    stepMs: 1800,
    formula: function (v) {
      var P = people(v), via = v.carrier === "neither" ? "\\text{no deletion}" : "\\text{via the " + v.carrier + "}";
      return "\\text{only the " + v.active + " copy is read}\\newline " + via + "\\Rightarrow\\text{child " + (P.cAff ? "affected" : "unaffected") + "}";
    },
    status: function (v) {
      var P = people(v), s = v.step || 1, who = v.carrier, rd = v.active;
      if (who === "neither") return ["Neither parent carries a deletion; in each of them only the " + rd + " copy is read.",
        "Each germline erases the old marks and resets them: his sperm carry <b>paternal</b> marks, her eggs <b>maternal</b> ones.",
        "The child gets one marked copy from each parent and reads the " + rd + " one: <b>unaffected</b>."][s - 1];
      var he = who === "father" ? "he" : "she", pAff = who === "father" ? P.fAff : P.mAff;
      if (s === 1) return "The " + who + " got the deletion from " + (who === "father" ? "his " : "her ") + (v.origin === "maternal" ? "mother" : "father") + ", so it carries a " + v.origin + " mark: " +
        (pAff ? "that is the copy that is read, so " + he + " is <b>affected</b>." : "that copy is silent anyway, so " + he + " is <b>unaffected</b>, a hidden carrier.");
      if (s === 2) return "In the " + who + "'s germline the old marks are erased and reset by sex: every copy, the deleted one too, now carries a <b>" + (who === "father" ? "paternal" : "maternal") + "</b> mark.";
      return "The child receives the deleted copy with a " + (who === "father" ? "paternal" : "maternal") + " mark; " +
        (P.cAff ? "that is the only copy read, so the child is <b>affected</b> (" + SYN[rd] + ")." : "that copy is silenced anyway, so the child is <b>unaffected</b> but a carrier.");
    },
    examples: [
      {name: "silent carrier father, affected child", values: {active: "paternal", carrier: "father", origin: "maternal", step: 3}},
      {name: "same deletion through the mother: unaffected", values: {active: "paternal", carrier: "mother", origin: "paternal", step: 3}},
      {name: "maternal gene, deletion from the mother", values: {active: "maternal", carrier: "mother", origin: "paternal", step: 3}},
      {name: "germline reset", values: {active: "paternal", carrier: "father", origin: "maternal", step: 2}},
      {name: "affected father", values: {active: "paternal", carrier: "father", origin: "paternal", step: 1}},
      {name: "no deletion", values: {carrier: "neither", step: 3}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, P = people(v), red = c.c5, on = c.c4;
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var MK = {paternal: c.c2, maternal: c.c6};
      // one homolog: a bar with its parental mark at the left and the gene in the middle (ON, silent or deleted). Pending
      // (a step not reached yet) is a faint dashed outline, so the whole chain is laid out from step 1 and lights up later.
      // The "read" mark is a small bent arrow over the gene, kept short (4 px) so it stays clear of the homolog above.
      var homolog = function (x, y, h, label, word, pend) {
        var w = 70, gx = x + 44, read = h.mark === v.active;
        if (label) T([x - 6, y], label, pend ? c.faint : c.muted, {anchor: "end", weight: 500});
        if (pend) {
          api.rect(x, y - 6, w, 12, {stroke: c.faint, width: 1.2, rx: 6, dash: "3 3"});
          api.rect(gx - 9, y - 7, 18, 14, {stroke: c.faint, width: 1, rx: 2});
          return;
        }
        api.rect(x, y - 6, w, 12, {fill: MK[h.mark], fillOpacity: 0.25, stroke: MK[h.mark], width: 1.2, rx: 6});
        T([x + 13, y], h.mark === "paternal" ? "pat" : "mat", MK[h.mark], {anchor: "middle", size: 12, weight: 700});
        if (h.del) { api.rect(gx - 9, y - 9, 18, 18, {fill: c.card, stroke: red, width: 1.6, dash: "3 2", rx: 2}); T([gx, y], "Δ", red, {anchor: "middle", weight: 700}); }
        else api.rect(gx - 9, y - 7, 18, 14, {fill: word && read ? on : c.muted, fillOpacity: word && read ? 0.9 : 0.35, rx: 2});
        if (word && read && !h.del) api.path("M " + (gx - 4) + " " + (y - 8) + " v -4 h 12", {stroke: on, width: 2, arrow: true});
        if (word) T([x + w + 5, y], read ? "read" : "silent", read ? (h.del ? red : on) : c.muted, {anchor: "start", weight: 500});
      };
      // ---- the parents: each has a copy from their own mother and one from their own father (rows 32 apart) ----
      [["father", 4, P.fAff], ["mother", 204, P.mAff]].forEach(function (q) {
        var who = q[0], x = q[1], pr = P.par[who];
        api.rect(x, 4, 192, 92, {fill: c.ink, fillOpacity: 0.03, stroke: c.faint, width: 1, rx: 8});
        T([x + 10, 16], who, c.ink, {weight: 700});
        homolog(x + 76, 34, pr[0], "from mom", true);                 // about 10 px from the box edge on both sides
        homolog(x + 76, 66, pr[1], "from dad", true);
        var note = v.carrier !== who ? "no deletion" : q[2] ? "affected" : "carrier, unaffected";
        T([x + 10, 85], note, v.carrier !== who ? c.muted : q[2] ? red : c.ink, {weight: 600});
      });
      // ---- the germline: marks erased, then reset by the parent's sex; the gamete carries the deleted copy ----
      var g = [["father", 100, "paternal", "sperm"], ["mother", 300, "maternal", "egg"]];
      g.forEach(function (q) {
        var who = q[0], gx = q[1], show = s >= 2, ink = show ? c.ink : c.faint, sent = P.par[who][0].del ? P.par[who][0] : P.par[who][1];
        api.line([gx, 98], [gx, 116], {color: show ? c.muted : c.faint, width: 1.4, arrow: true, dash: show ? null : "3 3"});
        if (show) T([who === "father" ? gx + 8 : gx - 8, 108], "reset: " + (q[2] === "paternal" ? "pat" : "mat"), MK[q[2]], {anchor: who === "father" ? "start" : "end", weight: 600});
        if (q[3] === "sperm") { api.circle([gx - 72, 132], 6, {fill: ink, fillOpacity: show ? 0.5 : 0.25}); api.path("M " + (gx - 78) + " 132 q -6 -5 -12 0 t -12 0", {stroke: ink, width: 1.4, opacity: show ? 0.6 : 0.5}); }
        else api.circle([gx - 76, 132], 10, {fill: ink, fillOpacity: show ? 0.12 : 0.04, stroke: ink, width: 1.2, opacity: show ? 0.7 : 0.6});
        T([gx - 76, 150], q[3], show ? c.muted : c.faint, {anchor: "middle", weight: 500});
        homolog(gx - 54, 132, {mark: q[2], del: sent.del}, null, false, !show);
      });
      // ---- the child: a paternal-marked copy from the sperm, a maternal-marked one from the egg (pending until step 3) ----
      var born = s >= 3, cc = !born ? c.faint : P.cAff ? red : on;
      api.line([100, 144], [170, 176], {color: born ? c.muted : c.faint, width: 1.4, arrow: true, dash: born ? null : "3 3"});
      api.line([300, 144], [236, 176], {color: born ? c.muted : c.faint, width: 1.4, arrow: true, dash: born ? null : "3 3"});
      api.rect(84, 180, 232, 76, {fill: cc, fillOpacity: born ? 0.07 : 0.02, stroke: cc, width: born ? 1.4 : 1, rx: 8, dash: born ? null : "4 3"});
      T([92, 190], "child", born ? c.ink : c.faint, {weight: 700});
      homolog(158, 208, P.child[0], "from dad", true, !born);
      homolog(158, 240, P.child[1], "from mom", true, !born);
      if (born) T([200, 270], P.cAff ? "affected: the only copy read is deleted" : "unaffected: the copy read is intact", P.cAff ? red : on, {anchor: "middle", weight: 700});
      else T([200, 270], "outcome at step 3", c.faint, {anchor: "middle", weight: 500});
      T([200, 292], "pat / mat = paternal or maternal imprint", c.muted, {anchor: "middle", weight: 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
