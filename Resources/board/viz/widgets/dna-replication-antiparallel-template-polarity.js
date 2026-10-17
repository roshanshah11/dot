// Why there is a leading and a lagging strand: polymerase only adds a nucleotide to a free 3'-OH, so the new strand always
// grows 5' -> 3', antiparallel to its template (read 3' -> 5'). Flip the template and the direction of growth flips with it;
// with the fork moving right, one orientation copies toward the fork (leading) and the other away from it (lagging).
(function () {
  var TPL = "TACGGATCCTAGCATG", PAIR = {A: "T", T: "A", G: "C", C: "G"}, N = TPL.length, PRIMER = 3;
  function dir(v) { return v.template === "3′→5′" ? 1 : -1; }                 // +1: new strand grows left to right
  function pos(v, k) { return dir(v) > 0 ? k : N - 1 - k; }                       // k-th base of the new strand from its 5' end
  function newSeq(v) {                                                             // written 5' -> 3', primer in RNA
    var s = "";
    for (var k = 0; k < PRIMER + v.added; k++) { var b = PAIR[TPL.charAt(pos(v, k))]; s += k < PRIMER ? b.replace("T", "U") : b; }
    return s;
  }
  Viz.register("dna-replication-antiparallel-template-polarity", {
    title: "Antiparallel strands: which way a new strand grows",
    subject: "biology",
    shows: "Flip the template's orientation and add nucleotides: the new strand always grows 5′→3′ off a 3′-OH, so it runs toward the fork on one template (leading) and away on the other (lagging)",
    params: {
      template: {kind: "enum", values: ["3′→5′", "5′→3′"], default: "3′→5′", label: "\\text{template}"},
      added: {kind: "integer", default: 6, min: 0, max: 12, label: "\\text{added}"}
    },
    formula: function (v) {
      var s = newSeq(v);
      return "5'\\text{-}\\textcolor{#f87171}{\\text{" + s.slice(0, PRIMER) + "}}\\text{" + s.slice(PRIMER) + "-}3'\\text{-OH}";
    },
    status: function (v) {
      var lead = dir(v) > 0;
      return "Read left to right the template runs " + v.template + ", so the new strand grows 5′→3′ <b>" + (lead ? "left to right, toward" : "right to left, away from") +
        " the fork</b>: " + (lead ? "the <b>leading strand</b>, made in one continuous piece." : "the <b>lagging strand</b>, made in short Okazaki fragments.");
    },
    examples: [
      {name: "leading template", values: {template: "3′→5′", added: 8}},
      {name: "lagging template", values: {template: "5′→3′", added: 8}},
      {name: "primer only", values: {added: 0}},
      {name: "twelve added", values: {added: 12, template: "5′→3′"}}
    ],
    size: [400, 236],
    draw: function (api, v) {
      var c = api.color, d = dir(v), X = function (i) { return 42 + i * 21; };
      var yN = 126, yT = 160, made = PRIMER + v.added, last = pos(v, made - 1), next = pos(v, made);
      var lead = d > 0;
      // template strand with its backbone arrow pointing 5' -> 3'
      var t5 = lead ? X(N - 1) + 14 : X(0) - 14, t3 = lead ? X(0) - 14 : X(N - 1) + 14;
      api.line([t5, yT + 16], [t3, yT + 16], {color: c.c2, width: 3, arrow: true});
      api.label([lead ? 384 : 16, yT + 16], "5′", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      api.label([lead ? 16 : 384, yT + 16], "3′", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      for (var i = 0; i < N; i++) api.label([X(i), yT], TPL.charAt(i), {color: c.c2, size: 13, weight: 650, anchor: "middle", clamp: false});
      api.label([200, yT + 34], "template, read 3′→5′ by the polymerase", {color: c.c2, size: 12, anchor: "middle"});
      // new strand: primer (RNA) then DNA, backbone arrow to the 3' end
      var x5 = X(pos(v, 0)) - d * 10, x3 = X(last) + d * 10;
      api.line([x5, yN - 16], [x3, yN - 16], {color: c.c3, width: 3, arrow: true});
      api.label([x5 - d * 12, yN - 16], "5′", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      for (var k = 0; k < made; k++) {
        var p = pos(v, k), b = PAIR[TPL.charAt(p)], rna = k < PRIMER;
        api.line([X(p), yN + 8], [X(p), yT - 8], {color: rna ? c.c5 : c.c3, width: 1.4, opacity: 0.75});
        api.label([X(p), yN], rna ? b.replace("T", "U") : b, {color: rna ? c.c5 : c.c3, size: 13, weight: 700, anchor: "middle", clamp: false});
      }
      api.label([X(pos(v, 1)), v.added < 2 ? yN - 62 : yN - 30], "RNA primer", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      // polymerase sits on the 3' end; the next dNTP pairs with the next template base
      var px = Math.min(X(last), X(next)) - 16;
      api.rect(px, yN - 44, 53, 88, {fill: c.c6, fillOpacity: 0.12, stroke: c.c6, width: 1.5, rx: 14});
      api.label([X(next) + d * 2, yN - 54], "polymerase", {color: c.c6, size: 12.5, weight: 700, anchor: lead ? "start" : "end"});
      api.label([X(next), yN], PAIR[TPL.charAt(next)], {color: c.c3, size: 13, weight: 700, anchor: "middle", clamp: false, opacity: 0.45});
      api.label([X(last), yN - 30], "3′-OH", {color: c.c3, size: 12, weight: 700, anchor: "middle"});
      // the fork, and what that makes this strand
      api.arrow([300, 22], [366, 22], {color: c.muted, width: 2, halo: false});
      api.label([294, 22], "fork moves", {color: c.muted, size: 12, anchor: "end"});
      api.label([16, 22], lead ? "toward the fork: leading" : "away from the fork: lagging", {color: lead ? c.c4 : c.c1, size: 12.5, weight: 700});
    }
  });
})();
