// Same genome, different cells: every cell carries the albumin and crystallin genes, but a gene's enhancer turns it on
// only when the cell holds the activator for every one of its control elements. A model with five activators, A-E,
// where liver, lens and skin cells hold different combinations; adding one activator can switch a gene on.
Viz.register("cell-type-specific-transcription-factors", {
  title: "Cell-type-specific transcription factors",
  subject: "biology",
  shows: "Switch the cell type or add one activator: a gene is transcribed only when the cell has an activator for every control element in its enhancer",
  params: {
    cell: {kind: "enum", values: ["liver", "lens", "skin"], default: "liver", label: "\\text{cell}"},
    extra: {kind: "enum", values: ["none", "B", "C", "D", "E"], default: "none", label: "\\text{add}"}
  },
  formula: function (v) {
    var set = {liver: "ABC", lens: "ADE", skin: "ABD"}[v.cell].split(""); if (v.extra !== "none" && set.indexOf(v.extra) < 0) set.push(v.extra);
    set.sort();
    var has = function (need) { return need.split("").every(function (x) { return set.indexOf(x) >= 0; }); };
    var row = function (need, name) { return "\\{" + need.split("").join(",") + "\\}" + (has(need) ? "\\subseteq" : "\\not\\subseteq") + " S\\Rightarrow\\text{" + name + (has(need) ? " on" : " off") + "}"; };
    return "\\begin{array}{l}S=\\{" + set.join(",") + "\\}\\\\" + row("ABC", "albumin") + "\\\\" + row("ADE", "crystallin") + "\\end{array}";
  },
  status: function (v) {
    var base = {liver: "ABC", lens: "ADE", skin: "ABD"}[v.cell].split(""), set = base.slice();
    if (v.extra !== "none" && set.indexOf(v.extra) < 0) set.push(v.extra);
    var has = function (s, need) { return need.split("").every(function (x) { return s.indexOf(x) >= 0; }); };
    var on = [has(set, "ABC") ? "albumin" : null, has(set, "ADE") ? "crystallin" : null].filter(Boolean);
    var before = [has(base, "ABC") ? "albumin" : null, has(base, "ADE") ? "crystallin" : null].filter(Boolean);
    if (on.length > before.length) return "Adding " + v.extra + " completes an enhancer, so this " + v.cell + " cell now makes <b>" + on.filter(function (g) { return before.indexOf(g) < 0; })[0] + "</b>: the idea behind reprogramming cells with transcription factors.";
    if (v.extra !== "none" && on.length === before.length && base.indexOf(v.extra) < 0) return "Adding " + v.extra + " completes neither enhancer, so the " + v.cell + " cell still makes " + (on.length ? "only <b>" + on[0] + "</b>." : "<b>neither</b> protein.");
    if (!on.length) return "This " + v.cell + " cell has " + set.sort().join(", ") + ", which completes <b>neither</b> enhancer, so both genes sit silent in its DNA.";
    return "This " + v.cell + " cell has " + set.sort().join(", ") + ", which fills every element of the " + on[0] + " enhancer, so only <b>" + on[0] + "</b> is transcribed.";
  },
  examples: [
    {name: "liver", values: {cell: "liver"}},
    {name: "lens", values: {cell: "lens"}},
    {name: "skin plus C", values: {cell: "skin", extra: "C"}}
  ],
  size: [400, 320],
  draw: function (api, v) {
    var c = api.color, col = {A: c.c1, B: c.c2, C: c.c3, D: c.c6, E: c.c5};
    var base = {liver: "ABC", lens: "ADE", skin: "ABD"}[v.cell].split(""), set = base.slice();
    if (v.extra !== "none" && set.indexOf(v.extra) < 0) set.push(v.extra);
    var activator = function (at, x, faint) {
      api.circle(at, 11, faint ? {stroke: c.faint, width: 1.4, dash: "3 3"} : {fill: col[x]});
      api.label([at[0], at[1] + 0.5], x, {color: faint ? c.faint : c.card, size: 12.5, weight: 700, anchor: "middle"});
    };
    // ---- the nucleus: which activators this cell makes ----
    api.label([14, 18], v.cell + " cell: activators in the nucleus", {color: c.ink, size: 12.5, weight: 650});
    "ABCDE".split("").forEach(function (x, i) {
      var at = [160 + i * 44, 46], here = set.indexOf(x) >= 0;
      activator(at, x, !here);
      if (x === v.extra) { var fresh = base.indexOf(x) < 0; api.circle(at, 15, {stroke: fresh ? c.c4 : c.muted, width: 2, dash: fresh ? null : "3 3"});
        api.label([at[0], 70], fresh ? "added" : "already here", {color: fresh ? c.c4 : c.muted, size: 12, anchor: "middle"}); }
    });
    api.label([14, 46], "activators made", {color: c.muted, size: 12});
    // ---- the two genes: the DNA is the same in every cell; only the activators above differ ----
    api.label([14, 88], "both genes are in every cell's DNA", {color: c.muted, size: 12});
    [{name: "albumin", need: "ABC", y: 166}, {name: "crystallin", need: "ADE", y: 260}].forEach(function (g) {
      var y = g.y, on = g.need.split("").every(function (x) { return set.indexOf(x) >= 0; });
      api.line([14, y], [386, y], {color: c.faint, width: 3});
      g.need.split("").forEach(function (x, i) {
        var sx = 36 + i * 30;
        api.rect(sx - 11, y - 6, 22, 12, {rx: 3, stroke: col[x], width: 2, fill: c.card});
        if (set.indexOf(x) >= 0) activator([sx, y - 19], x, false);
        else api.label([sx, y - 19], "?", {color: c.faint, size: 13, weight: 700, anchor: "middle"});
      });
      api.label([66, y + 20], "enhancer", {color: c.muted, size: 12, anchor: "middle"});
      api.rect(196, y - 7, 40, 14, {rx: 3, stroke: c.muted, width: 1.5, fill: c.card});
      api.label([216, y + 20], "promoter", {color: c.muted, size: 12, anchor: "middle"});
      api.rect(248, y - 10, 136, 20, {rx: 4, fill: c.card});   // opaque under the tint, so the DNA line stops at the gene box
      api.rect(248, y - 10, 136, 20, {rx: 4, fill: on ? c.c4 : c.ink, fillOpacity: on ? 0.28 : 0.06, stroke: on ? c.c4 : c.faint, width: 1.5});
      api.label([316, y], g.name + " gene", {color: on ? c.ink : c.muted, size: 12.5, weight: 650, anchor: "middle"});
      if (on) {
        api.path("M 66 " + (y - 32) + " Q 140 " + (y - 74) + " 204 " + (y - 26), {stroke: c.c4, width: 2, dash: "5 4", arrow: true});
        api.label([140, y - 62], "DNA loops", {color: c.c4, size: 12, anchor: "middle"});
        api.rect(190, y - 26, 52, 18, {rx: 9, fill: c.ink, fillOpacity: 0.16, stroke: c.ink, width: 1.2});
        api.label([216, y - 17], "Pol II", {color: c.ink, size: 12, weight: 600, anchor: "middle"});
        var d = "M 252 " + (y + 24); for (var k = 1; k <= 12; k++) d += " Q " + (252 + k * 11 - 5.5) + " " + (y + 24 + (k % 2 ? -5 : 5)) + " " + (252 + k * 11) + " " + (y + 24);
        api.path(d, {stroke: c.c4, width: 2.5});
        api.label([316, y + 42], g.name + " mRNA", {color: c.c4, size: 12.5, weight: 650, anchor: "middle"});
      } else {
        var miss = g.need.split("").filter(function (x) { return set.indexOf(x) < 0; });
        api.label([316, y + 24], "silent: no " + miss.join(", "), {color: c.muted, size: 12, anchor: "middle"});
      }
    });
    // viz.css paints every svg text ink, over the fill attribute; restate each label's color inline
    api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
  }
});
