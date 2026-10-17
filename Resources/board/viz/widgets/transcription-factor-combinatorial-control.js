// Combinatorial control: a few transcription factors, many outcomes. Three genes read the same pool of three activators
// (A, B, C) and one repressor (R) through different enhancers. Model, the textbook one and stated as such: a gene is
// transcribed only when an activator sits on every activator site of its enhancer (the factors assemble cooperatively),
// and a repressor bound to a silencer site vetoes it. So gene 1 = A and B, gene 2 = B and C, gene 3 = A and C and not R.
// The strip at the bottom runs all 2^4 = 16 combinations: four factors give six different on/off patterns over three genes.
(function () {
  var F = ["A", "B", "C", "R"];
  var GENES = [{name: "gene 1", sites: ["A", "B"]}, {name: "gene 2", sites: ["B", "C"]}, {name: "gene 3", sites: ["A", "C", "R"]}];
  function on(g, has) { return g.sites.every(function (s) { return s === "R" ? !has.R : has[s]; }); }
  function pattern(has) { return GENES.map(function (g) { return on(g, has) ? 1 : 0; }); }
  function combos() {   // every combination, A as the high bit
    var out = [];
    for (var k = 0; k < 16; k++) out.push({A: !!(k & 8), B: !!(k & 4), C: !!(k & 2), R: !!(k & 1)});
    return out;
  }
  function distinct() { var seen = {}; combos().forEach(function (h) { seen[pattern(h).join("")] = 1; }); return Object.keys(seen).length; }
  function b(x) { return x ? "1" : "0"; }

  Viz.register("transcription-factor-combinatorial-control", {
    title: "Combinatorial control by transcription factors",
    subject: "biology",
    shows: "Toggle three activators and a repressor: each gene's enhancer needs its own combination, so a handful of factors can switch many genes in different patterns",
    params: {
      A: {kind: "boolean", default: true, label: "A", on: "present", off: "absent"},
      B: {kind: "boolean", default: true, label: "B", on: "present", off: "absent"},
      C: {kind: "boolean", default: false, label: "C", on: "present", off: "absent"},
      R: {kind: "boolean", default: false, label: "R", on: "present", off: "absent"}
    },
    formula: function (v) {
      return "\\begin{array}{l}g_1=A\\land B=" + b(v.A) + "\\land " + b(v.B) + "=" + b(v.A && v.B) +
        "\\\\ g_2=B\\land C=" + b(v.B) + "\\land " + b(v.C) + "=" + b(v.B && v.C) +
        "\\\\ g_3=A\\land C\\land\\lnot R=" + b(v.A) + "\\land " + b(v.C) + "\\land\\lnot " + b(v.R) + "=" + b(v.A && v.C && !v.R) + "\\end{array}";
    },
    status: function (v) {
      var has = F.filter(function (f) { return v[f]; }), onG = GENES.filter(function (g) { return on(g, v); }).map(function (g) { return g.name; });
      var what = onG.length ? "<b>" + onG.join(" and ") + "</b> " + (onG.length > 1 ? "are" : "is") + " on" : "<b>no gene</b> is on";
      var blocked = v.R && v.A && v.C ? " (R silences gene 3)" : "";
      return "With " + (has.length ? has.join(", ") : "no factors") + " present, " + what + blocked + "; across all 16 combinations these 4 factors give <b>" + distinct() + "</b> different patterns.";
    },
    examples: [
      {name: "all absent", values: {A: false, B: false, C: false, R: false}},
      {name: "all present", values: {A: true, B: true, C: true, R: true}},
      {name: "every gene on", values: {A: true, B: true, C: true, R: false}},
      {name: "A and C only", values: {A: true, B: false, C: true, R: false}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, col = {A: c.c1, B: c.c2, C: c.c3, R: c.c5};
      function factor(at, f, present) {   // activators are circles, the repressor a square
        if (f === "R") api.rect(at[0] - 10, at[1] - 10, 20, 20, present ? {rx: 3, fill: col.R} : {rx: 3, stroke: c.faint, width: 1.4, dash: "3 3"});
        else api.circle(at, 10.5, present ? {fill: col[f]} : {stroke: c.faint, width: 1.4, dash: "3 3"});
        api.label([at[0], at[1] + 0.5], f, {color: present ? c.card : c.faint, size: 12.5, weight: 700, anchor: "middle"});
      }
      // ---- the pool this cell makes ----
      api.label([12, 24], "factors in this cell", {color: c.muted, size: 12});
      F.forEach(function (f, i) { factor([160 + i * 40, 24], f, v[f]); });
      api.label([330, 24], "R = repressor", {color: c.c5, size: 12});
      // ---- three genes, same pool, different enhancers ----
      GENES.forEach(function (g, gi) {
        var y = 82 + gi * 58, isOn = on(g, v), x0 = 30;
        api.line([12, y], [388, y], {color: c.faint, width: 3});
        g.sites.forEach(function (s, i) {
          var sx = x0 + i * 30, bound = v[s];
          api.rect(sx - 11, y - 6, 22, 12, {rx: 3, stroke: col[s], width: 2, fill: c.card, dash: s === "R" ? "3 2" : null});
          if (bound) factor([sx, y - 19], s, true);
          else api.label([sx, y - 19], "·", {color: c.faint, size: 14, weight: 700, anchor: "middle"});
        });
        api.label([x0 + 30, y + 17], g.sites.indexOf("R") >= 0 ? "enhancer + silencer" : "enhancer", {color: c.muted, size: 12, anchor: "middle"});
        api.rect(150, y - 7, 40, 14, {rx: 3, stroke: c.muted, width: 1.5, fill: c.card});
        api.label([170, y + 17], "promoter", {color: c.muted, size: 12, anchor: "middle"});
        api.rect(204, y - 10, 120, 20, {rx: 4, fill: c.card});
        api.rect(204, y - 10, 120, 20, {rx: 4, fill: isOn ? c.c4 : c.ink, fillOpacity: isOn ? 0.28 : 0.06, stroke: isOn ? c.c4 : c.faint, width: 1.5});
        api.label([264, y], g.name, {color: isOn ? c.ink : c.muted, size: 12.5, weight: 650, anchor: "middle"});
        if (isOn) {
          api.rect(146, y - 25, 48, 16, {rx: 8, fill: c.ink, fillOpacity: 0.16, stroke: c.ink, width: 1.1});
          api.label([170, y - 17], "Pol II", {color: c.ink, size: 12, weight: 600, anchor: "middle"});
          var d = "M 330 " + y; for (var k = 1; k <= 5; k++) d += " Q " + (330 + k * 11 - 5.5) + " " + (y + (k % 2 ? -5 : 5)) + " " + (330 + k * 11) + " " + y;
          api.path(d, {stroke: c.c4, width: 2.5});
          api.label([360, y + 15], "mRNA", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
        } else {
          var why = g.sites.filter(function (s) { return s !== "R" && !v[s]; });
          api.label([264, y + 20], why.length ? "off: needs " + why.join(" and ") : "off: R bound", {color: why.length ? c.muted : c.c5, size: 12, anchor: "middle"});
        }
      });
      // ---- every combination at once: one column per cell type, one row per gene ----
      var sx0 = 52, cw = 20.8, sy0 = 254;
      api.label([12, 240], "all 16 combinations of A, B, C, R (one column each)", {color: c.muted, size: 12});
      combos().forEach(function (h, k) {
        var p = pattern(h), cx = sx0 + k * cw, cur = F.every(function (f) { return h[f] === !!v[f]; });
        p.forEach(function (bit, r) { api.rect(cx + 2, sy0 + r * 13, cw - 4, 11, {rx: 2, fill: bit ? c.c4 : c.ink, fillOpacity: bit ? 0.85 : 0.07}); });
        if (cur) {
          api.rect(cx, sy0 - 3, cw, 43, {rx: 4, stroke: c.ink, width: 1.6});
          api.label([cx + cw / 2, sy0 + 52], "this cell", {color: c.ink, size: 12, weight: 650, anchor: "middle"});
        }
      });
      ["1", "2", "3"].forEach(function (t, r) { api.label([44, sy0 + 5.5 + r * 13], "g" + t, {color: c.muted, size: 12, anchor: "end"}); });
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
