// Opsonization by complement. A C3 convertase on the microbe's surface cuts C3 into C3a, a small fragment that drifts
// off and promotes inflammation, and C3b, which bonds covalently (through its thioester) to the surface. Bound C3b joins
// factor B (cut by factor D) to make more convertase, C3bBb, so the coat amplifies. Phagocytes carry complement receptor
// CR1 (CR3 binds the iC3b fragment), so they grip a coated microbe and pull it in: pseudopods zip around it, the
// phagosome fuses with lysosomes. IgG bound to the microbe adds a second opsonin (its Fc tail binds Fc-gamma receptors)
// and starts the classical pathway; Fc-receptor uptake also triggers the oxidative burst. A microbe with no opsonin
// (here: a capsule that keeps C3b off, for example by recruiting factor H) gets only the phagocyte's weak
// pattern-receptor grip and often escapes, which is why encapsulated bacteria such as pneumococcus are dangerous.
(function () {
  var TEXT = {
    none: ["A capsule keeps complement off (for example by recruiting factor H, which inactivates C3b), so <b>C3 stays intact</b> and the microbe stays bare.",
           "With no C3b on the surface there is nothing to amplify, so the microbe <b>stays uncoated</b>.",
           "The phagocyte can touch the bare microbe only through its own pattern receptors, a <b>weak grip</b>.",
           "The slippery, uncoated microbe usually <b>gets away</b>; that is why capsules make bacteria such as pneumococcus dangerous."],
    C3b: ["On the microbe's surface a C3 convertase cuts C3: the small <b>C3a</b> drifts off and promotes inflammation, while <b>C3b</b> bonds covalently to the surface.",
          "Each bound C3b joins factor B to make more convertase, so within minutes the surface is <b>coated in C3b</b>: the microbe is opsonized.",
          "Complement receptor <b>CR1</b> on the phagocyte binds the C3b, so the phagocyte grips the microbe wherever it is coated.",
          "Pseudopods zip around the coated microbe and pull it into a <b>phagosome</b>, which fuses with lysosomes that kill and digest it."],
    IgG: ["IgG already bound to the microbe starts the classical pathway, so C3 is cut on the surface: C3a drifts off and <b>C3b</b> sticks.",
          "The microbe now carries <b>two opsonins</b>: C3b and IgG, whose Fc tails point outward.",
          "The phagocyte grips through two receptors at once, <b>CR1 on C3b and Fcγ receptors on IgG</b>, a much firmer hold.",
          "With both opsonins uptake is fastest, and the Fc receptors also switch on the <b>oxidative burst</b> that kills what was eaten."]
  };
  var FORM = [
    "\\text{C3}\\xrightarrow{\\text{C3 convertase}}\\text{C3a}+\\text{C3b}",
    "\\text{C3b}+\\text{B}\\xrightarrow{\\text{factor D}}\\text{C3bBb (more convertase)}",
    "\\text{C3b}_{\\text{microbe}}+\\text{CR1}_{\\text{phagocyte}}\\to\\text{grip}",
    "\\text{phagosome}+\\text{lysosome}\\to\\text{phagolysosome}"
  ];

  Viz.register("complement-opsonization-phagocyte-recognition", {
    title: "Complement opsonization",
    subject: "biology",
    shows: "Step through opsonization: C3 is cut into C3a and C3b, C3b coats the microbe, the phagocyte's complement receptors grip it and it is eaten; with no opsonin the microbe slips away, with IgG as well the grip is strongest",
    params: {
      ops: {kind: "enum", values: ["none", "C3b", "IgG"], names: {none: "none (capsule)", C3b: "C3b", IgG: "C3b + IgG"}, default: "C3b", label: "\\text{opsonin}"}
    },
    steps: ["C3 meets the surface", "coating", "contact", "outcome"],   // names that fit all three opsonin choices
    stepMs: 1700,
    formula: function (v) {
      var s = v.step || 1;
      if (v.ops === "none") return "\\text{no C3b}\\Rightarrow\\text{CR1 has nothing to bind}";
      if (v.ops === "IgG" && s === 3) return "\\text{C3b}+\\text{CR1},\\quad \\text{IgG Fc}+\\text{Fc}\\gamma\\text{R}\\to\\text{grip}";
      return FORM[s - 1];
    },
    status: function (v) { return TEXT[v.ops][(v.step || 1) - 1]; },
    examples: [
      {name: "C3 is cut", values: {ops: "C3b", step: 1}},
      {name: "coated in C3b", values: {ops: "C3b", step: 2}},
      {name: "two opsonins, two receptors", values: {ops: "IgG", step: 3}},
      {name: "engulfed into a phagosome", values: {ops: "C3b", step: 4}},
      {name: "no opsonin: it gets away", values: {ops: "none", step: 4}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, ops = v.ops, MIC = c.c4, C3 = c.c3, AB = c.c2, PH = c.c1, LYS = c.c5;
      var eaten = s === 4 && ops !== "none";
      var mc = eaten ? [160, 146] : s === 4 ? [92, 150] : [140, 150], A = eaten ? 26 : 36, R = eaten ? 21 : 30;
      var P = 4 * A + 2 * Math.PI * R;
      var perim = function (t) {   // a point on the rod-shaped microbe's outline and its outward normal, t in [0, 1)
        var d = (t % 1) * P, th;
        if (d < 2 * A) return {p: [mc[0] - A + d, mc[1] - R], n: [0, -1]};
        d -= 2 * A;
        if (d < Math.PI * R) { th = -Math.PI / 2 + d / R; return {p: [mc[0] + A + R * Math.cos(th), mc[1] + R * Math.sin(th)], n: [Math.cos(th), Math.sin(th)]}; }
        d -= Math.PI * R;
        if (d < 2 * A) return {p: [mc[0] + A - d, mc[1] + R], n: [0, 1]};
        d -= 2 * A; th = Math.PI / 2 + d / R;
        return {p: [mc[0] - A + R * Math.cos(th), mc[1] + R * Math.sin(th)], n: [Math.cos(th), Math.sin(th)]};
      };
      var out = function (q, k) { return [q.p[0] + q.n[0] * k, q.p[1] + q.n[1] * k]; };
      var phago = {fill: PH, fillOpacity: 0.08, stroke: PH, width: 2};
      // the phagocyte: off to the side, then cupped around the microbe's end, then wrapped all the way round it
      if (eaten) {
        api.path("M 50 150 a 170 120 0 1 0 340 0 a 170 120 0 1 0 -340 0", phago);
        api.path("M 282 196 a 26 17 0 1 0 52 0 a 26 17 0 1 0 -52 0", {fill: PH, fillOpacity: 0.22, stroke: PH, width: 1.2});
        api.label([308, 236], "phagocyte", {color: PH, size: 12.5, weight: 650, anchor: "middle"});
      } else if (s <= 2) {
        api.path("M 276 158 a 46 62 0 1 0 92 0 a 46 62 0 1 0 -92 0", phago);
        api.path("M 312 146 a 18 13 0 1 0 36 0 a 18 13 0 1 0 -36 0", {fill: PH, fillOpacity: 0.22, stroke: PH, width: 1.2});
        api.label([322, 192], "phagocyte", {color: PH, size: 12.5, weight: 650, anchor: "middle"});
      } else {   // the cup: membrane 54 px from the centre of the microbe's right end, between -80 and +80 degrees
        api.path("M 185.4 96.8 A 54 54 0 0 1 185.4 203.2 Q 182 222 204 228 C 262 254 362 262 384 208 C 400 160 398 104 382 80 C 356 40 262 44 204 72 Q 182 78 185.4 96.8 Z", phago);
        api.path("M 308 176 a 24 16 0 1 0 48 0 a 24 16 0 1 0 -48 0", {fill: PH, fillOpacity: 0.22, stroke: PH, width: 1.2});
        api.label([330, 218], "phagocyte", {color: PH, size: 12.5, weight: 650, anchor: "middle"});
      }
      if (eaten) {
        var g = R + 14;
        api.path("M " + (mc[0] - A) + " " + (mc[1] - g) + " h " + 2 * A + " a " + g + " " + g + " 0 0 1 0 " + 2 * g + " h " + (-2 * A) + " a " + g + " " + g + " 0 0 1 0 " + (-2 * g) + " Z", {stroke: PH, width: 1.6, dash: "4 3"});
        api.label([mc[0], mc[1] + g + 14], "phagosome", {color: PH, size: 12, anchor: "middle"});
        api.circle([234, 112], 10, {fill: LYS, fillOpacity: 0.55, stroke: LYS, width: 1.4});
        api.circle([230, 184], 8, {fill: LYS, fillOpacity: 0.55, stroke: LYS, width: 1.4});
        api.label([250, 104], "lysosomes fuse", {color: LYS, size: 12});
      }
      // the microbe (with a capsule when nothing can stick to it)
      if (ops === "none") {
        api.rect(mc[0] - A - R - 8, mc[1] - R - 8, 2 * (A + R + 8), 2 * (R + 8), {fill: MIC, fillOpacity: 0.06, stroke: c.muted, dash: "4 3", width: 1.4, rx: R + 8});
        api.label([mc[0] - A - R - 6, mc[1] - R - 20], "capsule", {color: c.muted, size: 12});
      }
      api.rect(mc[0] - A - R, mc[1] - R, 2 * (A + R), 2 * R, {fill: MIC, fillOpacity: 0.3, stroke: MIC, width: 2, rx: R});
      api.label([mc[0], mc[1]], "microbe", {color: MIC, size: 12.5, weight: 650, anchor: "middle"});
      // opsonins on the surface
      var c3bAt = [], igAt = [];
      if (ops !== "none") {
        if (s === 1) c3bAt = [0.17];
        else for (var k = 0; k < 14; k++) c3bAt.push((k + 0.5) / 14);
        if (ops === "IgG") [2, 5, 8, 11, 13].forEach(function (k) { igAt.push(k / 14); });
      }
      var c3b = function (t) { var q = perim(t); api.line(q.p, out(q, 8), {color: C3, width: 2.4}); api.circle(out(q, 12), 4.2, {fill: C3}); return q; };
      var igg = function (t) {
        var q = perim(t), tg = [-q.n[1], q.n[0]], j = out(q, 9);
        api.line([q.p[0] + tg[0] * 6, q.p[1] + tg[1] * 6], j, {color: AB, width: 2.4});
        api.line([q.p[0] - tg[0] * 6, q.p[1] - tg[1] * 6], j, {color: AB, width: 2.4});
        api.line(j, out(q, 19), {color: AB, width: 2.4});
        return q;
      };
      var heads = c3bAt.map(c3b), tails = igAt.map(igg);
      if (s === 1 && ops !== "none") {   // one C3 being cut by the convertase at the top of the microbe
        api.rect(115, 110, 18, 10, {fill: c.c6, fillOpacity: 0.85, rx: 3});
        api.label([96, 104], "C3 convertase", {color: c.c6, size: 12, anchor: "end"});
        api.circle([70, 64], 10, {stroke: C3, width: 2, fill: C3, fillOpacity: 0.2});
        api.label([70, 64], "C3", {color: C3, size: 12, anchor: "middle", weight: 650});
        api.arrow([80, 72], [114, 104], {color: C3, width: 1.8, halo: false, head: 8});
        api.arrow([132, 104], [196, 62], {color: C3, width: 1.6, halo: false, head: 8, dash: "3 3"});
        api.circle([204, 56], 4, {fill: C3, fillOpacity: 0.7});
        api.label([214, 56], "C3a: inflammation", {color: C3, size: 12});
        api.label([170, 104], "C3b sticks", {color: C3, size: 12, weight: 650});
        if (ops === "IgG") api.label([mc[0], mc[1] + R + 34], "IgG bound first", {color: AB, size: 12, anchor: "middle"});
      } else if (s === 1) {
        [[56, 62], [116, 50], [204, 80]].forEach(function (q) { api.circle(q, 10, {stroke: C3, width: 2, fill: C3, fillOpacity: 0.2}); api.label(q, "C3", {color: C3, size: 12, anchor: "middle", weight: 650}); });
        api.label([140, 214], "C3 stays intact, nothing sticks", {color: C3, size: 12, anchor: "middle"});
      }
      if (s === 2) {
        if (ops === "none") api.label([140, 214], "still bare", {color: c.muted, size: 12, anchor: "middle"});
        else api.label([mc[0], mc[1] - R - 34], ops === "IgG" ? "coated: C3b and IgG" : "coated in C3b", {color: C3, size: 12.5, weight: 650, anchor: "middle"});
        if (ops === "IgG") api.label([mc[0], mc[1] + R + 36], "IgG, Fc tails out", {color: AB, size: 12, anchor: "middle"});
      }
      // receptors on the cupped membrane reach the opsonins facing it
      if (s === 3) {
        var ctr = [mc[0] + A, mc[1]];
        var grab = function (q, k, col) {
          if (q.n[0] < 0.2) return;
          var e = out(q, k), m = [ctr[0] + 54 * q.n[0], ctr[1] + 54 * q.n[1]];
          api.line(m, [e[0] + q.n[0] * 4, e[1] + q.n[1] * 4], {color: col, width: 2.4});
          api.circle(m, 2.8, {fill: PH});
        };
        heads.forEach(function (q) { grab(q, 12, PH); });
        tails.forEach(function (q) { grab(q, 19, AB); });
        if (ops === "none") {
          [-20, 0, 20].forEach(function (a) { var r = a * Math.PI / 180; api.line([ctr[0] + 40 * Math.cos(r), ctr[1] + 40 * Math.sin(r)], [ctr[0] + 53 * Math.cos(r), ctr[1] + 53 * Math.sin(r)], {color: PH, width: 1.4, dash: "2 3"}); });
          api.label([110, 56], "weak grip, no opsonin", {color: PH, size: 12.5, weight: 650, anchor: "middle"});
        } else api.label([110, 56], ops === "IgG" ? "CR1 and Fcγ receptors bind" : "CR1 binds C3b", {color: PH, size: 12.5, weight: 650, anchor: "middle"});
      }
      if (s === 4 && ops === "none") {
        api.arrow([mc[0] - 10, mc[1] + 62], [22, mc[1] + 62], {color: MIC, width: 2, halo: false});
        api.label([22, mc[1] + 80], "slips away", {color: MIC, size: 12.5, weight: 650});
      }
      // steps 1-2 draw a smaller scene (the phagocyte still apart): lower it to sit just above the meter instead of
      // leaving an empty band under it
      if (s <= 2) {
        var lift = document.createElementNS("http://www.w3.org/2000/svg", "g");
        lift.setAttribute("transform", "translate(0 24)");
        while (api.root.firstChild) lift.appendChild(api.root.firstChild);
        api.root.appendChild(lift);
      }
      // uptake meter: how well a phagocyte takes up a microbe with each coat (relative, qualitative), current pick bold
      var my = 296, mx = 122, mw = 196;
      api.label([16, my - 17], "uptake by the phagocyte", {color: c.muted, size: 12});
      [["none", "none (capsule)", 0.12, "weak"], ["C3b", "C3b", 0.6, "strong"], ["IgG", "C3b + IgG", 1, "strongest"]].forEach(function (r, i) {
        var y = my + 16 * i, on = r[0] === ops;
        api.label([mx - 8, y], r[1], {color: on ? c.ink : c.muted, size: 12, weight: on ? 700 : 500, anchor: "end"});
        api.rect(mx, y - 5, mw, 10, {fill: c.grid, rx: 3});
        api.rect(mx, y - 5, mw * r[2], 10, {fill: PH, fillOpacity: on ? 1 : 0.3, rx: 3});
        api.label([mx + mw * r[2] + 7, y], r[3], {color: on ? PH : c.muted, size: 12, weight: on ? 700 : 500});
      });
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
