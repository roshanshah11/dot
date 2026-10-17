// The replisome at one fork, as a parts diagram. The fork moves right. Leading template on top (copied toward the fork);
// lagging template below, folded into a loop ("trombone") so the lagging polymerase can travel with the fork: from the
// helicase the template runs single-stranded (SSB), then as the duplex of the fragment being made, into the lagging
// polymerase; ahead of that polymerase the not-yet-copied template leads back to the previous fragment. When the fragment
// is done the loop is let go and a new one starts at the next primer. E. coli: DnaB helicase rings the lagging template
// and walks 5'->3'; DnaG primase rides on it; gyrase removes the positive supercoils ahead; the clamp loader (gamma/tau
// complex) loads beta clamps and its tau subunits tie two pol III cores together. Human: CMG helicase rings the leading
// template and walks 3'->5'; pol alpha-primase lays ~10 nt RNA + ~20 nt DNA; RFC loads PCNA; pol epsilon copies the
// leading strand, pol delta the lagging strand; topoisomerases I and II relieve the twist (Alberts, MBoC ch. 5).
(function () {
  var CELL = {
    "E. coli": {hel: "DnaB helicase", ssb: "SSB", topo: "gyrase", prim: "DnaG primase", clamp: "β clamp", loader: "clamp loader", lead: "pol III", lag: "pol III"},
    "human": {hel: "CMG helicase", ssb: "RPA", topo: "topo I + II", prim: "pol α-primase", clamp: "PCNA", loader: "RFC", lead: "pol ε", lag: "pol δ"}
  };
  var cx = 252, cy = 226, rx = 46, ry = 38;
  function E(th, dr) { return [cx + (rx - dr) * Math.cos(th), cy + (ry - dr) * Math.sin(th)]; }
  function arc(a, b, dr) { var p = [], n = 28; for (var i = 0; i <= n; i++) p.push(E((a + (b - a) * i / n) * Math.PI / 180, dr)); return p; }

  Viz.register("dna-replication-fork-architecture", {
    title: "The replisome: who does what at the fork",
    subject: "biology",
    shows: "Step through the machines at a replication fork (helicase, SSB, topoisomerase, primase, clamp and loader, two polymerases) and switch between E. coli and human names",
    params: {
      cell: {kind: "enum", values: ["E. coli", "human"], default: "E. coli", label: "\\text{cell}"}
    },
    steps: ["helicase unwinds", "single strands coated", "twist relieved ahead", "primase lays a primer", "clamps loaded", "two polymerases copy"],
    stepMs: 1800,
    formula: function (v) {
      var e = v.cell === "E. coli", s = v.step || 1, o = CELL[v.cell];
      var T = function (x) { return "\\text{" + x + "}"; };
      var two = function (a, b) { return "\\begin{array}{l}" + a + "\\\\ " + b + "\\end{array}"; };
      return [e ? two(T("DnaB: walks ") + "5'\\to3'", T("along the lagging template")) : two(T("CMG: walks ") + "3'\\to5'", T("along the leading template")),
        two(T(o.ssb + " on single strands"), T("keeps them apart")),
        two(T(o.topo + ": cut and reseal"), T("to let ") + "(+)" + T(" supercoils out")),
        e ? two(T("DnaG: RNA primer"), T("about 11 nt")) : two(T("pol ") + "\\alpha" + T("-primase: about 10 nt RNA"), T("plus about 20 nt DNA")),
        two(T(o.loader + " + ATP"), e ? "\\beta" + T(" clamp ring around the DNA") : T("PCNA ring around the DNA")),
        e ? two(T("2 pol III cores"), T("tied together by ") + "\\tau") : two(T("pol ") + "\\varepsilon" + T(" on the leading strand"), T("pol ") + "\\delta" + T(" on the lagging strand"))][s - 1];
    },
    status: function (v) {
      var e = v.cell === "E. coli", o = CELL[v.cell], s = v.step || 1;
      return [e ? "<b>DnaB</b>, a six-part ring around the lagging-strand template, walks 5′→3′ and pries the strands apart, burning ATP." : "<b>CMG</b> (Cdc45, MCM2-7, GINS) rings the leading-strand template, walks 3′→5′ and pries the strands apart, burning ATP.",
        "<b>" + o.ssb + "</b> proteins coat the exposed single strands so they cannot pair back or fold up before they are copied.",
        "Unwinding over-twists the DNA ahead, so <b>" + o.topo + "</b> cut" + (e ? "s" : "") + " and reseal" + (e ? "s" : "") + " it to let the positive supercoils out.",
        e ? "<b>DnaG primase</b>, riding on the helicase, lays a short RNA primer on the lagging template whenever enough of it is exposed." : "<b>Pol α-primase</b> lays about 10 nt of RNA, then extends it with about 20 nt of DNA, on the lagging template.",
        "The <b>" + o.loader + "</b> spends ATP to snap a <b>" + o.clamp + "</b> ring around each primed strand, so the polymerase cannot fall off.",
        e ? "Two <b>pol III</b> cores, tied together, copy both strands at once; the lagging template loops back so its polymerase moves with the fork." : "<b>Pol ε</b> copies the leading strand and <b>pol δ</b> the lagging strand, whose template loops back so its polymerase keeps up with the fork."][s - 1];
    },
    examples: [
      {name: "E. coli helicase", values: {cell: "E. coli", step: 1}},
      {name: "human helicase", values: {cell: "human", step: 1}},
      {name: "human primase", values: {cell: "human", step: 4}},
      {name: "E. coli polymerases", values: {cell: "E. coli", step: 6}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, o = CELL[v.cell], e = v.cell === "E. coli";
      var on = function (k) { return s === k; };
      var part = function (k) { return {fill: on(k) ? c.c6 : c.muted, fillOpacity: on(k) ? 0.35 : 0.12, stroke: on(k) ? c.c6 : c.muted, width: on(k) ? 2 : 1.2}; };
      var name = function (at, txt, k, anchor) { api.label(at, txt, {color: on(k) ? c.c6 : c.muted, size: 12, weight: on(k) ? 700 : 500, anchor: anchor || "middle"}); };
      var yT = 70, yN = 88, yP = 126, yQ = 146, xf = 290;
      // parent duplex ahead of the fork, with the topoisomerase
      for (var x = xf + 8; x < 388; x += 8) api.line([x, yP + 3], [x, yQ - 3], {color: c.faint, width: 1});
      api.polyline([[8, yT], [262, yT], [xf, yP], [388, yP]], {stroke: c.c2, width: 3.5});
      api.polyline([[388, yQ], [xf, yQ], [xf + 2, 180], E(-30 * Math.PI / 180, 0)], {stroke: c.c2, width: 3.5});
      api.label([396, yP], "5′", {color: c.c2, size: 12, anchor: "end"});
      api.label([396, yQ], "3′", {color: c.c2, size: 12, anchor: "end"});
      api.label([8, yT - 12], "3′", {color: c.c2, size: 12});
      // the loop: single strand, then the duplex of the fragment being made, into the lagging polymerase
      api.polyline(arc(-30, 240, 0), {stroke: c.c2, width: 3.5});
      api.polyline(arc(70, 240, 10), {stroke: c.c3, width: 3.5});
      api.polyline(arc(70, 86, 10), {stroke: c.c5, width: 4.5});
      for (var th = 96; th < 236; th += 9) { var p0 = E(th * Math.PI / 180, 2), p1 = E(th * Math.PI / 180, 8); api.line(p0, p1, {color: c.faint, width: 1}); }
      api.line(E(240 * Math.PI / 180, 0), [222, 176], {color: c.c2, width: 3.5});
      api.line(E(240 * Math.PI / 180, 10), [232, 178], {color: c.c3, width: 3.5});
      // ahead of the lagging polymerase: template leading back to the previous fragment
      api.polyline([[206, 170], [150, 180], [8, 180]], {stroke: c.c2, width: 3.5});
      api.line([146, 162], [80, 162], {color: c.c3, width: 3.5}); api.line([146, 162], [138, 162], {color: c.c5, width: 4.5});
      api.line([74, 162], [12, 162], {color: c.c3, width: 3.5}); api.line([74, 162], [66, 162], {color: c.c5, width: 4.5});
      [80, 12].forEach(function (x3) { api.polygon([[x3 - 4, 162], [x3 + 3, 157.5], [x3 + 3, 166.5]], {fill: c.c3, fillOpacity: 1}); });
      for (x = 70; x < 146; x += 8) if (Math.abs(x - 77) > 4) api.line([x, 165], [x, 177], {color: c.faint, width: 1});
      for (x = 14; x < 64; x += 8) api.line([x, 165], [x, 177], {color: c.faint, width: 1});
      api.label([8, 196], "lagging strand: Okazaki fragments", {color: c.c3, size: 12});
      // leading strand, continuous to its polymerase
      for (x = 14; x < 210; x += 8) api.line([x, yT + 3], [x, yN - 3], {color: c.faint, width: 1});
      api.line([8, yN], [222, yN], {color: c.c3, width: 3.5});
      api.polygon([[226, yN], [218, yN - 4.5], [218, yN + 4.5]], {fill: c.c3, fillOpacity: 1});
      api.label([8, yN + 16], "leading strand: one piece", {color: c.c3, size: 12});
      // 1 helicase: a ring on the lagging template (E. coli) or on the leading template (human)
      var hy = e ? yQ + 6 : yP - 6;
      api.rect(xf - 8, hy - 15, 16, 30, Object.assign(part(1), {rx: 8}));
      name([xf + 12, 104], o.hel, 1, "start");
      // 2 single-strand binding protein
      [[10, 0], [38, 0], [66, 0]].forEach(function (q) { var p = E(q[0] * Math.PI / 180, -6); api.circle(p, 5.5, part(2)); });
      [[190, 173.5], [168, 177.5]].forEach(function (p) { api.circle([p[0], p[1] - 7], 5.5, part(2)); });
      name([179, 152], o.ssb, 2);
      // 3 topoisomerase ahead of the fork
      api.rect(338, yP - 14, 26, yQ - yP + 28, Object.assign(part(3), {rx: 12}));
      name([351, yQ + 26], o.topo, 3);
      // 4 primase on the freshly exposed lagging template
      api.rect(xf + 10, 180, 24, 18, Object.assign(part(4), {rx: 9}));
      name([396, 214], o.prim, 4, "end");
      if (s >= 4) api.line([xf - 5, 172], [xf - 4, 190], {color: c.c5, width: 4.5});
      // 5 clamps and their loader
      api.rect(204, 61, 10, 36, Object.assign(part(5), {rx: 5}));
      api.rect(221, 183, 20, 9, Object.assign(part(5), {rx: 4.5}));
      api.rect(218, 116, 30, 18, Object.assign(part(5), {rx: 6}));
      name([212, 125], o.loader, 5, "end");
      name([211, 52], o.clamp, 5, "end");
      // 6 the polymerases (tied together by tau in E. coli)
      if (e) { api.line([233, 95], [233, 116], {color: on(6) ? c.c6 : c.muted, width: 2}); api.line([233, 134], [229, 153], {color: on(6) ? c.c6 : c.muted, width: 2}); }
      api.rect(214, 70, 46, 26, Object.assign(part(6), {rx: 10}));
      api.rect(206, 153, 46, 26, Object.assign(part(6), {rx: 10}));
      name([237, 83.5], o.lead, 6); name([229, 166.5], o.lag, 6);
      if (on(6)) api.label([cx, 284], "loop grows, then is let go", {color: c.c6, size: 12, weight: 650, anchor: "middle"});
      api.arrow([326, 28], [384, 28], {color: c.muted, width: 2, halo: false});
      api.label([320, 28], "fork moves", {color: c.muted, size: 12, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
