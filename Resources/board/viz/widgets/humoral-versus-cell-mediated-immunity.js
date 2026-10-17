// The two arms of adaptive immunity, matched to where the threat is. Humoral immunity: B cells become plasma cells that
// secrete antibodies into blood and lymph, where they neutralize toxins and free virus and coat (opsonize) bacteria for
// phagocytes and complement; antibodies cannot enter cells. Cell-mediated immunity: CD8 cytotoxic T cells kill cells that
// display foreign peptide on MHC I (perforin and granzymes trigger apoptosis), and Th1 (CD4) cells use IFN-gamma to
// activate macrophages against microbes living inside them, such as Mycobacterium tuberculosis. Helper T cells feed
// both arms. A virus is attacked by both: antibodies on the free virus, CTLs on the infected cells.
(function () {
  var T = {
    toxin: {hum: true, cell: false, tex: "\\text{toxin in body fluids}\\Rightarrow\\text{humoral: antibodies neutralize it}",
      say: "Tetanus toxin floats in body fluids, so <b>humoral</b> immunity handles it: antibodies bind the toxin and <b>neutralize</b> it, while T cells find no infected cell to attack."},
    bacteria: {hum: true, cell: false, tex: "\\text{bacteria in blood}\\Rightarrow\\text{humoral:}\\newline\\text{IgG opsonizes for phagocytes}\\newline\\text{and activates complement}",
      say: "Bacteria multiplying in blood are outside cells, so the <b>humoral</b> arm does the work: antibodies <b>coat</b> them for phagocytes and set off complement."},
    virus: {hum: true, cell: true, tex: "\\text{virus}\\Rightarrow\\text{antibodies (free virus)}\\newline+\\ \\text{CD8 killer T cells (infected cells)}",
      say: "A virus calls for <b>both</b> arms: antibodies neutralize free virus before it enters cells, and CD8 killer T cells destroy cells that already show viral peptide on <b>MHC I</b>."},
    TB: {hum: false, cell: true, tex: "\\textit{M. tuberculosis}\\text{ in macrophages}\\newline\\Rightarrow\\text{Th1 IFN-}\\gamma\\text{ arms the macrophage}",
      say: "Tuberculosis bacteria hide <b>inside macrophages</b> where antibodies cannot reach, so <b>cell-mediated</b> immunity takes over: IFN-γ from Th1 cells lets the macrophage kill them."}
  };

  Viz.register("humoral-versus-cell-mediated-immunity", {
    title: "Humoral versus cell-mediated immunity",
    subject: "biology",
    shows: "Pick a threat: antibodies from B cells (humoral) work in blood and lymph on toxins, bacteria and free virus, while T cells (cell-mediated) kill infected cells or arm macrophages against microbes hiding inside cells",
    params: {
      threat: {kind: "enum", values: ["toxin", "bacteria", "virus", "TB"], names: {bacteria: "bacteria in blood", TB: "TB in macrophages"}, default: "virus", label: "\\text{threat}"}
    },
    formula: function (v) { return T[v.threat].tex; },
    status: function (v) { return T[v.threat].say; },
    examples: [
      {name: "toxin: antibodies only", values: {threat: "toxin"}},
      {name: "bacteria in blood", values: {threat: "bacteria"}},
      {name: "virus: both arms", values: {threat: "virus"}},
      {name: "TB: T cells only", values: {threat: "TB"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, th = v.threat, q = T[th], tb = th === "TB";
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600, raw: true}, o || {})); };
      var hc = q.hum ? c.c2 : c.faint, cc = q.cell ? c.c4 : c.faint;
      var ab = function (p, ang, col) {      // a Y-shaped antibody pointing its arms along ang
        var ux = Math.cos(ang), uy = Math.sin(ang), px = -uy, py = ux, m = [p[0] - ux * 4, p[1] - uy * 4];
        api.line([p[0] - ux * 12, p[1] - uy * 12], m, {color: col, width: 1.8});
        api.line(m, [p[0] + ux * 2 + px * 5, p[1] + uy * 2 + py * 5], {color: col, width: 1.8});
        api.line(m, [p[0] + ux * 2 - px * 5, p[1] + uy * 2 - py * 5], {color: col, width: 1.8});
      };
      var bug = function (p, kind) {
        if (kind === "toxin") api.polygon([[p[0], p[1] - 6], [p[0] + 6, p[1] + 4], [p[0] - 6, p[1] + 4]], {fill: c.c5, fillOpacity: 1});
        else if (kind === "virus") { var h = []; for (var k = 0; k < 6; k++) h.push([p[0] + 6 * Math.cos(k * Math.PI / 3), p[1] + 6 * Math.sin(k * Math.PI / 3)]); api.polygon(h, {fill: c.c5, fillOpacity: 1}); }
        else api.rect(p[0] - 8, p[1] - 4, 16, 8, {fill: c.c5, rx: 4});
      };
      // helper T cell feeds both arms
      api.circle([200, 24], 13, {fill: c.c1, fillOpacity: 0.3, stroke: c.c1, width: 1.6});
      L([200, 24], "Th", c.c1, {anchor: "middle", weight: 700});
      L([218, 16], "helper T cell feeds both", c.c1, {weight: 500});
      api.line([188, 32], [60, 84], {color: c.c1, width: 1.4, arrow: true, dash: "4 3"});
      api.line([212, 32], [340, 84], {color: c.c1, width: 1.4, arrow: true, dash: "4 3"});
      api.line([200, 46], [200, 296], {color: c.faint, width: 1, dash: "2 4"});
      L([8, 54], "humoral", q.hum ? c.c2 : c.muted, {size: 13, weight: 700});
      L([392, 54], "cell-mediated", q.cell ? c.c4 : c.muted, {anchor: "end", size: 13, weight: 700});
      // humoral chain: B cell -> plasma cell -> antibodies
      api.circle([34, 102], 12, {fill: hc, fillOpacity: 0.25, stroke: hc, width: 1.6});
      api.line([48, 102], [72, 102], {color: hc, width: 1.6, arrow: true});
      api.circle([94, 102], 17, {fill: hc, fillOpacity: 0.25, stroke: hc, width: 1.6});
      [-6, 0, 6].forEach(function (d) { api.path("M " + (86) + " " + (102 + d) + " q 8 -3 16 0", {stroke: hc, width: 1.2}); });
      api.line([114, 102], [142, 102], {color: hc, width: 1.6, arrow: true});
      [[160, 94], [176, 108], [188, 92]].forEach(function (p, k) { ab(p, -Math.PI / 2 + k * 0.5 - 0.5, hc); });
      L([34, 130], "B cell", hc, {anchor: "middle", weight: 500});
      L([94, 130], "plasma cell", hc, {anchor: "middle", weight: 500});
      L([166, 130], "antibodies", hc, {anchor: "middle", weight: 500});
      // cell-mediated chain: CD8 -> killer T cell, or Th1 -> IFN-gamma for a microbe inside a macrophage
      api.circle([236, 102], 12, {fill: cc, fillOpacity: 0.25, stroke: cc, width: 1.6});
      api.line([250, 102], [290, 102], {color: cc, width: 1.6, arrow: true});
      L([236, 130], tb ? "Th1 (CD4)" : "CD8 T cell", cc, {anchor: "middle", weight: 500});
      if (tb) { L([298, 102], "IFN-γ", cc, {weight: 700}); L([330, 130], "arms macrophages", cc, {anchor: "middle", weight: 500}); }
      else {
        api.circle([310, 102], 16, {fill: cc, fillOpacity: 0.25, stroke: cc, width: 1.6});
        [[-6, -4], [4, -6], [6, 5], [-4, 6]].forEach(function (o) { api.circle([310 + o[0], 102 + o[1]], 2.2, {fill: cc}); });
        L([320, 130], "killer T cell", cc, {anchor: "middle", weight: 500});
      }
      // where the threat is: body fluid on the left, inside cells on the right
      api.rect(8, 148, 184, 116, {fill: c.c2, fillOpacity: 0.05, rx: 10});
      L([16, 160], "blood and lymph", c.muted, {weight: 500});
      L([384, 160], "inside cells", c.muted, {anchor: "end", weight: 500});
      var free = th === "toxin" ? [[50, 200], [96, 226], [140, 192], [70, 244]] : th === "bacteria" ? [[56, 198], [118, 232], [84, 222]] : th === "virus" ? [[48, 204], [110, 190], [150, 236]] : [];
      free.forEach(function (p, k) {
        bug(p, th);
        if (q.hum) [0, 1, 2].forEach(function (j) { var a = j * 2.1 + k; ab([p[0] + 14 * Math.cos(a), p[1] + 14 * Math.sin(a)], a + Math.PI, c.c2); });
      });
      if (th === "bacteria") {
        api.path("M 150 200 q 22 -16 34 4 q 6 22 -16 30 q -24 4 -28 -14 q -2 -12 10 -20 Z", {stroke: c.muted, width: 1.6});
        bug([164, 214]); L([168, 256], "phagocyte", c.muted, {anchor: "middle", weight: 500});
      }
      if (tb) [[40, 196], [150, 230]].forEach(function (p, k) { ab(p, k ? 2.4 : -0.6, c.faint); });
      // inside cells: an infected cell, a macrophage with TB, or healthy cells
      if (th === "virus") {
        api.circle([300, 214], 34, {stroke: c.muted, width: 1.8, dash: "6 3"});
        [[288, 206], [306, 224], [312, 202]].forEach(function (p) { bug(p, "virus"); });
        api.rect(264, 186, 9, 7, {fill: c.c4, rx: 2}); api.circle([268, 182], 3, {fill: c.c5});
        L([300, 262], "MHC I shows viral peptide", c.muted, {anchor: "middle", weight: 500});
        api.circle([238, 196], 12, {fill: c.c4, fillOpacity: 0.3, stroke: c.c4, width: 1.6});
        [[252, 200], [258, 206], [254, 212]].forEach(function (p) { api.circle(p, 2.2, {fill: c.c4}); });
        L([238, 226], "perforin", c.c4, {anchor: "middle", weight: 500});
      } else if (tb) {
        api.path("M 262 214 q 6 -36 40 -32 q 36 4 30 34 q -2 30 -36 30 q -36 -2 -34 -32 Z", {fill: c.c4, fillOpacity: 0.08, stroke: c.c4, width: 1.8});
        [[290, 206], [308, 222], [298, 230]].forEach(function (p) { bug(p); });
        L([300, 262], "TB inside a macrophage", c.muted, {anchor: "middle", weight: 500});
      } else {
        [[256, 212], [318, 200], [356, 232]].forEach(function (p) { api.circle(p, 20, {stroke: c.muted, width: 1.4}); });
        L([300, 262], "no infected cells here", c.muted, {anchor: "middle", weight: 500});
      }
      // verdict for each arm
      L([100, 284], q.hum ? "✓ antibodies clear it" : "✗ antibodies can't get in", q.hum ? c.c2 : c.muted, {anchor: "middle", weight: 650});
      L([300, 284], q.cell ? (tb ? "✓ activated macrophage kills it" : "✓ CTL kills the infected cell") : "✗ no infected cell to attack", q.cell ? c.c4 : c.muted, {anchor: "middle", weight: 650});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
