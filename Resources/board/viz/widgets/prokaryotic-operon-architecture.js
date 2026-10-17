// An operon: one promoter and one operator control several genes that are transcribed together into one mRNA
// (polycistronic), each gene then translated on its own. lac is inducible: LacI (made all the time from lacI, which has
// its own promoter) sits on the operator until allolactose, made from lactose, pulls it off. trp is repressible: TrpR
// (from trpR, far away on the chromosome) binds the operator only with tryptophan bound, so plenty of Trp shuts it off.
// Gene widths are not to scale (lacZ is about 3 kb, lacA about 0.6 kb). Full lac expression also needs low glucose (CAP).
(function () {
  var OP = {
    lac: {genes: [["lacZ", 100], ["lacY", 50], ["lacA", 38]], prot: ["β-galactosidase", "permease", "transacetylase"], reg: "lacI", rep: "LacI",
          mol: "lactose", kind: "inducible"},
    trp: {genes: [["trpE", 39], ["trpD", 39], ["trpC", 39], ["trpB", 39], ["trpA", 39]], prot: ["five enzymes that build tryptophan"], reg: "trpR", rep: "TrpR",
          mol: "tryptophan", kind: "repressible"}
  };
  function on(v) { return v.operon === "lac" ? v.signal : !v.signal; }

  Viz.register("prokaryotic-operon-architecture", {
    title: "Operon architecture: lac and trp",
    subject: "biology",
    shows: "Switch between the lac and trp operons and add or remove the small molecule: one promoter and operator switch several genes on together as one mRNA",
    params: {
      operon: {kind: "enum", values: ["lac", "trp"], default: "lac", label: "\\text{operon}"},
      signal: {kind: "boolean", default: false, label: "\\text{signal}", on: "present", off: "absent"}
    },
    formula: function (v) {
      var o = OP[v.operon], k = o.genes.length;
      return "\\begin{array}{l}P\\,O\\,[" + o.genes.map(function (g) { return "\\textit{" + g[0] + "}"; }).join("\\,") + "]\\\\ " +
        (on(v) ? "\\xrightarrow{\\text{ON}}\\ 1\\text{ mRNA}\\to " + k + "\\text{ proteins}" : "\\xrightarrow{\\text{OFF}}\\ 0\\text{ mRNA}") + "\\end{array}";
    },
    status: function (v) {
      if (v.operon === "lac") return v.signal ?
        "Lactose present: allolactose pulls LacI off the operator, so RNA polymerase makes <b>one mRNA</b> for lacZ, lacY and lacA (fastest when glucose is low too)." :
        "No lactose: the LacI repressor sits on the operator and blocks RNA polymerase, so all three genes are <b>off</b> together.";
      return v.signal ?
        "Tryptophan present: it binds TrpR, the complex grips the operator, and all five trp genes are <b>off</b>; the cell stops making what it already has." :
        "No tryptophan: TrpR cannot bind the operator, so the five trp genes are transcribed as <b>one mRNA</b> and the cell makes its own.";
    },
    examples: [
      {name: "lac, no lactose", values: {operon: "lac", signal: false}},
      {name: "lac, lactose", values: {operon: "lac", signal: true}},
      {name: "trp, no tryptophan", values: {operon: "trp", signal: false}},
      {name: "trp, tryptophan", values: {operon: "trp", signal: true}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, o = OP[v.operon], lac = v.operon === "lac", isOn = on(v), yD = 128;
      // DNA
      api.line([10, yD - 4], [390, yD - 4], {color: c.faint, width: 2}); api.line([10, yD + 4], [390, yD + 4], {color: c.faint, width: 2});
      function box(x, w, fill, text, opts) {
        opts = opts || {};
        api.rect(x, yD - 11, w, 22, {rx: 4, fill: fill, fillOpacity: opts.op || 0.85, stroke: opts.stroke || null});
        if (text) api.label([x + w / 2, opts.above ? yD - 20 : yD], text, {color: opts.above ? fill : c.card, size: 12, weight: 700, anchor: "middle", italic: opts.italic});
      }
      // regulatory gene
      var x;
      if (lac) {
        box(14, 50, c.c6, "lacI", {italic: true});
        api.label([14, yD + 24], "own promoter, always on", {color: c.c6, size: 12});
        box(78, 12, c.muted, "", {op: 0.6}); api.label([84, yD - 20], "CAP", {color: c.muted, size: 12, anchor: "middle"});
        box(92, 32, c.c4, "P", {}); box(118, 22, c.c5, "O", {});
        x = 144;
      } else {
        box(14, 44, c.c6, "trpR", {italic: true});
        api.label([14, yD + 24], "far away", {color: c.c6, size: 12});
        api.label([70, yD], "//", {color: c.muted, size: 14, weight: 700, anchor: "middle"});
        box(82, 40, c.c4, "", {}); box(98, 20, c.c5, "O", {}); api.label([88, yD], "P", {color: c.card, size: 12, weight: 700, anchor: "middle"});
        box(124, 16, c.muted, "", {op: 0.6}); api.label([132, yD + 24], "leader", {color: c.muted, size: 12, anchor: "middle"});
        x = 142;
      }
      var g0 = x;
      o.genes.forEach(function (g) { box(x, g[1] - 2, c.c3, g[0], {italic: true}); x += g[1]; });
      var g1 = x;
      // terminator hairpin
      api.path("M " + (g1 + 8) + " " + (yD - 6) + " l 0 -16 a 5 5 0 0 1 10 0 l 0 16", {stroke: c.muted, width: 2});
      api.label([g1 + 13, yD + 24], "stop", {color: c.muted, size: 12, anchor: "middle"});
      api.label([(g0 + g1) / 2 + 20, yD - 66], "structural genes, one promoter", {color: c.c3, size: 12, anchor: "middle"});
      // the repressor (purple) and the small molecule (dots)
      var opX = lac ? 129 : 108, bound = !isOn;
      function repressor(at, withMol) {
        api.rect(at[0] - 18, at[1] - 12, 36, 24, {rx: 9, fill: c.c6, fillOpacity: 0.35, stroke: c.c6, width: 1.6});
        api.label(at, o.rep, {color: c.ink, size: 12, weight: 650, anchor: "middle"});
        if (withMol) [[-22, -12], [22, -12]].forEach(function (d) { api.circle([at[0] + d[0], at[1] + d[1]], 5, {fill: c.ink}); });
      }
      if (bound) repressor([opX, yD - 22], !lac);
      else { repressor([54, 62], lac); api.label([54, 86], lac ? "let go of O" : "inactive alone", {color: c.c6, size: 12, anchor: "middle"}); }
      if (v.signal) {
        api.circle([lac ? 22 : opX + 40, lac ? 40 : 34], 5, {fill: c.ink});
        api.label([lac ? 32 : opX + 50, lac ? 40 : 34], lac ? "allolactose (made from lactose)" : "tryptophan (from the cell)", {color: c.ink, size: 12});
      }
      // RNA polymerase: transcribing, or blocked at the promoter
      var polX = isOn ? g0 + 26 : lac ? 82 : 90, polY = isOn ? yD - 32 : lac ? 76 : 68;   // blocked: on or just upstream of P, clear of the repressor
      api.rect(polX - 22, polY - 18, 44, 36, {rx: 16, fill: c.c2, fillOpacity: 0.3, stroke: c.c2, width: 1.6});
      api.label([polX, polY], "RNAP", {color: c.ink, size: 12, weight: 650, anchor: "middle"});
      if (!isOn) api.label([polX, polY - 28], "blocked", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      else api.arrow([polX + 26, polY], [polX + 60, polY], {color: c.c2, width: 2, halo: false});
      // one mRNA from +1 (just past the operator; the trp leader is transcribed too) across every gene, then one protein per
      // gene. When the operon is off the same row is drawn ghosted and crossed out, so toggling compares like with like.
      var gh = isOn ? null : api.group({opacity: 0.28}), y = 172, x1 = lac ? 140 : 124, pts = [];
      for (var px = x1; px <= g1; px += 6) pts.push([px, y + 3 * Math.sin((px - x1) / 5)]);
      api.polyline(pts, {stroke: c.c1, width: 2.5, dash: isOn ? null : "5 4", parent: gh});
      api.label([x1 - 6, y], "5′", {color: c.c1, size: 12, anchor: "end", parent: gh});
      var xs = 0, cxs = [];
      o.genes.forEach(function (g, i) {
        var cx = g0 + xs + g[1] / 2; xs += g[1]; cxs.push(cx);
        api.line([cx, y + 8], [cx, 202], {color: c.c3, width: 1.2, dash: "3 3", arrow: true, parent: gh});
        api.circle([cx, 216], lac ? [14, 10, 8][i] : 9, {fill: c.c3, fillOpacity: 0.4, stroke: c.c3, width: 1.5, dash: isOn ? null : "3 2", parent: gh});
      });
      if (lac) {   // each name under its own circle with a short leader; permease drops a row so the names never stack
        [[cxs[0], 244, "middle"], [cxs[1], 262, "middle"], [cxs[2] - 9, 244, "start"]].forEach(function (q, i) {
          api.line([cxs[i], 216 + [14, 10, 8][i] + 2], [cxs[i], q[1] - 8], {color: c.c3, width: 1, opacity: 0.7, parent: gh});
          api.label([q[0], q[1]], o.prot[i], {color: c.c3, size: 12, anchor: q[2], parent: gh});
        });
      } else api.label([(g0 + g1) / 2, 246], o.prot[0], {color: c.c3, size: 12, anchor: "middle", parent: gh});
      if (isOn) api.label([g1 + 8, y], "one mRNA", {color: c.c1, size: 12, weight: 650});
      else {
        var mx = (x1 + g1) / 2;
        api.line([mx - 9, y - 9], [mx + 9, y + 9], {color: c.c5, width: 2.2}); api.line([mx - 9, y + 9], [mx + 9, y - 9], {color: c.c5, width: 2.2});
        api.label([g1 + 8, y], "no mRNA", {color: c.muted, size: 12.5, weight: 650});
        api.label([g0 - 22, 216], "no enzymes", {color: c.muted, size: 12.5, weight: 650, anchor: "end"});
      }
      api.label([10, 280], o.kind + ": " + (lac ? "lactose switches it on" : "tryptophan switches it off"), {color: c.muted, size: 12});
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
