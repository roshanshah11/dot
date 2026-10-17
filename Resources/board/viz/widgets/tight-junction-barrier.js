// Tight junctions seal the top of the gap between two epithelial cells. Left: two cells, lumen above, blood side below;
// eight tracer molecules start in the lumen and only those the junction lets through end up between and below the cells.
// Right: one patch of the junction up close, three claudin strands in series. The rules follow the pore / leak picture:
//  - sealing claudins (tight epithelia such as bladder or distal colon): almost no pores, so small solutes barely pass;
//  - claudin-2 (leaky epithelia such as the kidney's proximal tubule): pores about 0.7 nm wide lined with negative charge,
//    so cations and water pass freely, anions slowly, mannitol (about as wide as the pore) slowly, proteins not at all;
//  - Ca2+ removed (EGTA): cadherins let go and the strands come apart, so everything passes (albumin slowly) and the
//    fence fails: apical and basolateral membrane proteins start to mix.
// How many tracer dots cross (6, 2, 1 or 0 of 8) pictures the verdict; it is not a measured fraction.
(function () {
  var SOL = {
    "Na+": {tex: "\\text{Na}^+", txt: "Na⁺", mass: "23\\ \\text{Da}", q: 1, r: 3.5, zr: 4.5},
    "Cl-": {tex: "\\text{Cl}^-", txt: "Cl⁻", mass: "35\\ \\text{Da}", q: -1, r: 3.5, zr: 4.5},
    water: {tex: "\\text{H}_2\\text{O}", txt: "water", mass: "18\\ \\text{Da}", q: 0, r: 3.5, zr: 4.5},
    mannitol: {tex: "\\text{mannitol}", txt: "mannitol", mass: "182\\ \\text{Da}", q: 0, r: 4.5, zr: 6, sugar: true},
    albumin: {tex: "\\text{albumin}", txt: "albumin", mass: "66\\ \\text{kDa}", q: 0, r: 7, zr: 12, protein: true}
  };
  var TIER = {free: {n: 6, word: "passes freely"}, slow: {n: 2, word: "passes slowly"}, trace: {n: 1, word: "barely passes"}, none: {n: 0, word: "blocked"}};
  var JTEX = {tight: "\\text{sealing claudins: almost no pores}", leaky: "\\text{claudin-2 pore}\\approx0.7\\ \\text{nm, lined with }-",
    opened: "\\text{no Ca}^{2+}\\text{: strands pulled apart}"};
  function tier(v) {
    var s = SOL[v.solute];
    if (v.junction === "opened") return s.protein ? "slow" : "free";
    if (s.protein) return "none";
    if (v.junction === "tight") return "trace";
    return s.sugar || s.q < 0 ? "slow" : "free";
  }

  Viz.register("tight-junction-barrier", {
    title: "Tight junctions: the seal between cells",
    subject: "biology",
    shows: "Pick a junction and a molecule: sealing claudins stop almost everything between cells, claudin-2 pores let small cations and water through, and removing Ca²⁺ opens the seal and lets membrane proteins mix",
    params: {
      junction: {kind: "enum", values: ["tight", "leaky", "opened"], names: {tight: "tight", leaky: "leaky (claudin-2)", opened: "Ca²⁺ removed"}, default: "tight", label: "\\text{junction}"},
      solute: {kind: "enum", values: ["Na+", "Cl-", "water", "mannitol", "albumin"], names: {"Na+": "Na⁺", "Cl-": "Cl⁻"}, default: "Na+", label: "\\text{molecule}"}
    },
    formula: function (v) {
      var s = SOL[v.solute];
      return s.tex + "\\ (" + s.mass + (s.q ? ",\\ " + (s.q > 0 ? "+1" : "-1") : "") + ")\\Rightarrow\\text{" + TIER[tier(v)].word + "}\\newline " + JTEX[v.junction];
    },
    status: function (v) {
      var s = SOL[v.solute], t = tier(v), b = "<b>" + s.txt + "</b>";
      if (v.junction === "opened") return "With Ca²⁺ removed the strands come apart: " + (s.protein ? "even " + b + " slips between the cells, slowly," : b + " passes freely between the cells,") + " and apical and basolateral membrane proteins start to mix.";
      if (s.protein) return b + " (66 kDa) is far too big for any claudin pore, so the junction holds it in the lumen: essentially none crosses.";
      if (v.junction === "tight") return "Sealing strands leave almost no pores, so even " + b + " barely leaks between the cells; to cross, it has to go through a cell.";
      if (s.sugar) return b + " is about as wide as a claudin-2 pore, so it squeezes through slowly; cells do not take it up, which is why labs use it to measure the route between cells.";
      if (s.q < 0) return "The pore's negative lining repels " + b + ", so it crosses slowly even though hydrated Cl⁻ is no bigger than Na⁺.";
      return "Claudin-2 pores lined with negative charge pass " + b + " freely: this is how a leaky epithelium like the proximal tubule moves salt and water between its cells.";
    },
    examples: [
      {name: "tight junction stops Na⁺", values: {junction: "tight", solute: "Na+"}},
      {name: "claudin-2 passes Na⁺", values: {junction: "leaky", solute: "Na+"}},
      {name: "claudin-2 repels Cl⁻", values: {junction: "leaky", solute: "Cl-"}},
      {name: "albumin held back", values: {junction: "leaky", solute: "albumin"}},
      {name: "Ca²⁺ removed", values: {junction: "opened", solute: "albumin"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = SOL[v.solute], t = tier(v), n = TIER[t].n, open = v.junction === "opened", leaky = v.junction === "leaky";
      var L = function (at, txt, col, o) { return api.label(at, txt, Object.assign({color: col, size: 12}, o || {})); };
      // ---- the two cells -------------------------------------------------------------------------------------------
      var mid = 124, gap = open ? 18 : 8, xl = mid - gap / 2, xr = mid + gap / 2, top = 64, bot = 240;
      L([12, 14], "lumen (apical)", c.muted);
      L([12, 287], "blood side (basal)", c.muted);
      [[14, xl], [xr, 234]].forEach(function (q) {
        api.rect(q[0], top, q[1] - q[0], bot - top, {fill: c.ink, fillOpacity: 0.05, stroke: c.muted, width: 1.4, rx: 8});
        api.circle([(q[0] + q[1]) / 2, 162], 17, {fill: c.muted, fillOpacity: 0.16, stroke: c.muted, width: 1});
      });
      api.line([10, bot + 7], [238, bot + 7], {color: c.muted, width: 2, dash: "2 4"});
      // the paracellular route, drawn under the tracers
      if (n) api.line([mid, top - 4], [mid, bot + 22], {color: c.c3, width: 1.5, dash: "3 4", opacity: 0.7, arrow: true});
      // tight junction strands at the top of the gap
      [top + 4, top + 10, top + 16].forEach(function (y) {
        if (open) { api.line([xl, y], [xl + 3, y], {color: c.c1, width: 3}); api.line([xr - 3, y], [xr, y], {color: c.c1, width: 3}); }
        else if (leaky) { api.line([xl, y], [mid - 1.6, y], {color: c.c1, width: 3}); api.line([mid + 1.6, y], [xr, y], {color: c.c1, width: 3}); }
        else api.line([xl, y], [xr, y], {color: c.c1, width: 3});
      });
      L([xr + 6, top + 11], "tight junction", c.c1, {weight: 600});
      // membrane proteins: apical (blue) above the junction, basolateral (green) below it; with the fence gone they mix
      var apical = [[32, 1], [62, open ? 0 : 1], [92, 1], [156, 1], [186, open ? 0 : 1], [216, 1]];
      apical.forEach(function (q) { api.rect(q[0] - 5, top - 3, 10, 6, {fill: q[1] ? c.c2 : c.c4, rx: 2}); });
      var lateral = [[xl, 112, 0], [xl, 132, open ? 1 : 0], [xl, 206, 0], [xr, 120, 0], [xr, 184, open ? 1 : 0], [xr, 214, 0]];
      lateral.forEach(function (q) { api.rect(q[0] - 3, q[1] - 5, 6, 10, {fill: q[2] ? c.c2 : c.c4, rx: 2}); });
      [40, 84, 164, 208].forEach(function (x) { api.rect(x - 5, bot - 3, 10, 6, {fill: c.c4, rx: 2}); });
      L([20, top + 14], "apical", c.c2, {weight: 600});
      L([20, bot - 14], "basolateral", c.c4, {weight: 600});
      // tracers: 8 start in the lumen; n of them have crossed
      var lumen = [[64, 40], [88, 30], [104, 48], [146, 48], [164, 32], [188, 44], [210, 30], [136, 30]];
      var crossed = [[mid, 100], [mid, 140], [mid, 186], [mid, 226], [150, 262], [182, 270], [118, 266]];
      if (!n) lumen = [[mid - 8, top - 10], [mid + 8, top - 12]].concat(lumen.slice(2));
      lumen.slice(0, 8 - n).forEach(function (q) { api.circle(q, s.r, {fill: c.c3}); });
      crossed.slice(0, n).forEach(function (q) { api.circle(q, s.r, {fill: c.c3}); });
      L([234, 14], s.txt + " in the lumen", c.c3, {anchor: "end", weight: 650});
      // ---- the junction up close: three strands in series ---------------------------------------------------------
      var zx = 323, hg = open ? 30 : 14, rows = [86, 130, 174];
      L([zx, 14], "up close: 3 strands", c.c1, {anchor: "middle", weight: 600});
      L([zx, 34], "lumen", c.muted, {anchor: "middle"});
      L([zx, 226], "basal", c.muted, {anchor: "middle"});
      [-1, 1].forEach(function (side) {
        var inner = zx + side * hg, outer = inner + side * 10;
        api.rect(Math.min(inner, outer), 44, 10, 170, {fill: c.muted, fillOpacity: 0.28, stroke: c.muted, width: 1, rx: 3});
        rows.forEach(function (y) {
          var end = open ? inner + -side * 8 : leaky ? zx - side * 5 : zx;
          api.rect(Math.min(inner, end), y - 6, Math.abs(end - inner), 12, {fill: c.c1, rx: 3});
          if (leaky) L([zx - side * 9, y + 1], "−", c.card, {anchor: "middle", weight: 700, clamp: false});
        });
      });
      // solute particles: above the first strand, or on their way through
      var through = {free: [104, 150, 196], slow: [196], trace: [108], none: []}[t];
      var above = s.protein ? [0] : t === "free" ? [0] : [-13, 13];
      above.forEach(function (dx) { api.circle([zx + dx, 66 - s.zr + 4], s.zr, {fill: c.c3}); });
      through.forEach(function (y) { api.circle([zx, y], s.zr, {fill: c.c3}); });
      L([zx, 252], s.txt, c.c3, {anchor: "middle", size: 13, weight: 650});
      L([zx, 270], TIER[t].word, c.ink, {anchor: "middle", size: 13, weight: 650});
      L([zx, 288], open ? "strands apart, fence lost" : leaky ? "pores lined with −" : "almost no pores", c.muted, {anchor: "middle"});
      // viz.css sets every svg text fill to ink, which overrides the fill attribute: restate each label's color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
