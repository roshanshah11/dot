// The first line of innate defense: surfaces that keep microbes out before any immune cell is involved. Each site has
// a physical barrier (skin's sealed layer of dead keratin-filled cells that is shed constantly; airway mucus that traps
// microbes and cilia that sweep it up and out; the stomach's mucus over tightly joined cells; tears that flush the eye)
// and a chemical one (skin's acid surface, pH about 5, with fatty acids and antimicrobial peptides; lysozyme, lactoferrin
// and defensins in airway mucus; hydrochloric acid, pH about 2, and pepsin in the stomach; lysozyme in tears, which cuts
// the peptidoglycan of bacterial walls). Breach one layer and the other still catches most microbes; lose both and they
// reach living tissue, where the second line (inflammation, phagocytes) has to act. pH = -log10[H+], water is 10^-7 M.
// The eight microbes are schematic: their fates illustrate the rule, they are not measured fractions.
(function () {
  var SITE = {
    skin: {phys: "keratin", physLong: "the sealed layer of dead, keratin-filled cells", breach: "cut", breachLong: "a cut", chem: "acid film", chemLong: "the acid, fatty acids and antimicrobial peptides", pH: 5},
    airway: {phys: "mucus", physLong: "sticky mucus swept out by cilia", breach: "cilia stopped", breachLong: "cilia stopped by smoke", chem: "lysozyme", chemLong: "lysozyme and defensins in the mucus", pH: null},
    stomach: {phys: "mucus", physLong: "the mucus layer over tightly joined cells", breach: "ulcer", breachLong: "an ulcer", chem: "acid, pH 2", chemLong: "hydrochloric acid and pepsin", pH: 2},
    eye: {phys: "tears", physLong: "tears that flush and blinks that sweep", breach: "dry eye", breachLong: "dry eye (too little tear flow)", chem: "lysozyme", chemLong: "lysozyme in the tears", pH: null}
  };
  var MX = [28, 66, 104, 152, 190, 228, 276, 314], GAP = [136, 244], R = 322;
  function fate(v, i) {
    if (!v.physical && i >= 3 && i <= 5) return !v.chemical || i === 4 ? "in" : "killedIn";
    return v.chemical && i % 2 === 0 ? "killed" : "held";
  }

  Viz.register("skin-mucus-physical-chemical-barriers", {
    title: "Skin and mucus: physical and chemical barriers",
    subject: "biology",
    shows: "Pick a body surface and breach its physical or chemical barrier: with both intact no microbe reaches living tissue, with one down the other still catches most, and with both down microbes get in",
    params: {
      site: {kind: "enum", values: ["skin", "airway", "stomach", "eye"], default: "skin", label: "\\text{site}"},
      physical: {kind: "boolean", default: true, label: "\\text{physical}", on: "intact", off: "breached"},
      chemical: {kind: "boolean", default: true, label: "\\text{chemical}", on: "working", off: "lost"}
    },
    formula: function (v) {
      var s = SITE[v.site], mark = function (ok) { return ok ? "\\ \\checkmark" : "\\ \\times"; };
      var l2 = !v.chemical ? (v.site === "stomach" ? "\\text{acid suppressed: pH}>4" : s.pH ? "\\text{acid film lost: pH rises}" : "\\text{no lysozyme}")
        : s.pH ? "[\\text{H}^+]=10^{-" + s.pH + "}\\,\\text{M}=10^{" + (7 - s.pH) + "}\\times\\text{water}"
        : "\\text{lysozyme cuts peptidoglycan}";
      var ph = v.chemical && s.pH ? "\\quad\\text{pH}\\approx " + s.pH : "";
      return "\\text{physical}" + mark(v.physical) + "\\quad\\text{chemical}" + mark(v.chemical) + ph + "\\newline " + l2;
    },
    status: function (v) {
      var s = SITE[v.site];
      if (v.physical && v.chemical) return "Intact: " + s.physLong + " holds microbes off and " + s.chemLong + " kill them, so <b>none</b> reach living tissue.";
      if (!v.physical && v.chemical) return "With " + s.breachLong + ", microbes get past the physical barrier; " + s.chemLong + " still kill most, but <b>a few</b> reach living tissue, where inflammation takes over.";
      if (v.physical && v.site === "stomach") return "With acid suppressed (antacids, proton-pump drugs), swallowed microbes <b>survive</b> the stomach and travel on to the intestine alive.";
      if (v.physical) return "The physical barrier still keeps microbes out of the tissue, but without " + s.chemLong + " they <b>survive and multiply</b> on the surface.";
      return "Both layers down: microbes <b>reach living tissue</b>, and only the second line of defense (inflammation and phagocytes) is left.";
    },
    examples: [
      {name: "intact skin", values: {site: "skin", physical: true, chemical: true}},
      {name: "a cut in the skin", values: {site: "skin", physical: false, chemical: true}},
      {name: "smoker's airway", values: {site: "airway", physical: false, chemical: true}},
      {name: "stomach acid suppressed", values: {site: "stomach", physical: true, chemical: false}},
      {name: "ulcer with acid working", values: {site: "stomach", physical: false, chemical: true}},
      {name: "dry eye, no lysozyme", values: {site: "eye", physical: false, chemical: false}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = SITE[v.site], site = v.site;
      var T = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var gap = !v.physical && (site === "skin" || site === "stomach");
      var span = function (x0, x1, fn) { if (!gap) fn(x0, x1); else { fn(x0, GAP[0]); fn(GAP[1], x1); } };
      // geometry per site: top of the barrier, where held and killed microbes sit, top of the cell layer
      var G = {skin: {top: 104, held: 94, kill: 98, cells: 164}, airway: {top: 104, held: 112, kill: 112, cells: 140},
               stomach: {top: 118, held: 108, kill: 66, cells: 142}, eye: {top: 106, held: 112, kill: 112, cells: 126}}[site];
      var bot = 180, chemY, physY;
      // ---- the barrier ----
      if (site === "skin") {
        for (var row = 0; row < 4; row++) for (var x = 8 - (row % 2) * 22; x < R; x += 44) {
          var x0 = Math.max(8, x), x1 = Math.min(R, x + 42);
          if (gap && x1 > GAP[0] && x0 < GAP[1]) { if (x0 < GAP[0]) x1 = GAP[0]; else if (x1 > GAP[1]) x0 = GAP[1]; else continue; }
          if (x1 - x0 > 4) api.rect(x0, 110 + row * 13, x1 - x0, 10, {fill: c.c3, fillOpacity: 0.55 - row * 0.08, rx: 4});
        }
        if (v.chemical) span(8, R, function (a, b) { api.rect(a, 102, b - a, 5, {fill: c.c4, fillOpacity: 0.6, rx: 2}); });
        chemY = 100; physY = 132;
      } else if (site === "airway" || site === "stomach") {
        var mt = G.top, mb = mt + 22;
        span(8, R, function (a, b) { api.rect(a, mt, b - a, mb - mt, {fill: c.c3, fillOpacity: 0.3, rx: 6}); });
        physY = mt + 11;
        if (site === "airway") {
          for (var cx = 13; cx < R; cx += 8) api.line([cx, G.cells], v.physical ? [cx + 4, mb + 2] : [cx + 9, G.cells - 3], {color: c.c3, width: 1.4, opacity: 0.85});
          if (v.chemical) for (var k = 0; k < 9; k++) api.circle([22 + k * 34, mt + 6 + (k % 2) * 10], 3, {fill: c.c4});
          chemY = mt + 11; physY = mt - 2;
        } else {
          if (v.chemical) for (var h = 0; h < 7; h++) T([(MX[h] + MX[h + 1]) / 2, 46 + (h % 3) * 14], "H⁺", c.c4, {anchor: "middle"});
          else if (v.physical) T([R, 36], "alive: on to the intestine", c.c6, {anchor: "end", weight: 500});
          chemY = 62;
        }
      } else {
        var ft = v.physical ? 104 : 114;
        api.rect(8, ft, R - 8, G.cells - 2 - ft, {fill: c.c3, fillOpacity: v.physical ? 0.3 : 0.12, rx: 5, dash: v.physical ? null : "4 3", stroke: v.physical ? null : c.c3});
        if (v.chemical) for (var e = 0; e < 9; e++) api.circle([22 + e * 34, v.physical ? 112 : 118], 3, {fill: c.c4});
        chemY = 116; physY = 108;
      }
      if (v.physical && (site === "airway" || site === "eye")) {
        api.arrow([40, 84], [210, 84], {color: c.c3, width: 2, halo: false, head: 8});
        T([216, 84], site === "airway" ? "swept out" : "flushed away", c.c3, {weight: 500});
      }
      // the epithelium (skin: living keratinocytes), with the breach as a gap
      var cw = site === "airway" || site === "stomach" ? 22 : 34;
      for (var px = 8; px + cw <= R; px += cw + 2) {
        if (gap && px + cw > GAP[0] && px < GAP[1]) continue;
        api.rect(px, G.cells, cw, bot - G.cells, {fill: c.c1, fillOpacity: 0.16, stroke: c.c1, width: 0.8, rx: 3});
        api.circle([px + cw / 2, (G.cells + bot) / 2], 3, {fill: c.c1, fillOpacity: 0.6});
      }
      // living tissue below
      api.rect(8, 188, R - 8, 70, {fill: c.c1, fillOpacity: 0.05, rx: 6});
      for (var q = 0; q < 7; q++) api.circle([34 + q * 44, 222 + (q % 2 ? 14 : -10)], 9, {stroke: c.c1, width: 1, opacity: 0.5});
      T([14, 272], "living tissue", c.c1, {weight: 500});
      T([14, 12], "microbes arriving", c.c6, {weight: 500});
      if (!v.physical) {
        if (gap) api.rect(GAP[0], G.top - 4, GAP[1] - GAP[0], bot - G.top + 4, {stroke: c.c5, width: 1.4, dash: "4 3", rx: 4});
        T([(GAP[0] + GAP[1]) / 2, gap ? G.top - 14 : 84], s.breach, c.c5, {anchor: "middle"});
      }
      // ---- the microbes: a faint track from outside to where each one ended up ----
      var nIn = 0;
      MX.forEach(function (x, i) {
        var f = fate(v, i), y;
        if (f === "in") { y = 214 + (i % 2) * 20; nIn++; }
        else if (f === "killedIn") y = gap ? 150 : G.cells - 6;
        else if (f === "killed") y = chemY;
        else if (site === "stomach" && !v.chemical) y = 56 + (i % 3) * 14;
        else y = v.physical ? G.held - (i % 2) * 8 : G.held - 2;
        var dead = f !== "in" && f !== "held";
        api.line([x, 24], [x, y - 6], {color: c.c6, width: 1, dash: "2 4", opacity: 0.45});
        if (f === "in") api.circle([x, y], 12, {fill: c.c5, fillOpacity: 0.2});
        api.rect(x - 8, y - 4, 16, 8, {fill: c.c6, fillOpacity: dead ? 0.35 : 0.95, rx: 4});
        if (dead) { api.line([x - 5, y - 5], [x + 5, y + 5], {color: c.c5, width: 2}); api.line([x - 5, y + 5], [x + 5, y - 5], {color: c.c5, width: 2}); }
      });
      T([R, 272], nIn ? "got in" : "none got in", nIn ? c.c5 : c.muted, {anchor: "end"});
      // layer names in the right margin; a lost chemical barrier is struck through in red
      T([R + 8, physY], s.phys, c.c3, {weight: 500});
      var cl = T([R + 8, site === "airway" ? physY + 17 : chemY + (Math.abs(chemY - physY) < 13 ? 14 : 0)], s.chem, v.chemical ? c.c4 : c.c5, {weight: 500});
      if (!v.chemical) {
        var lx = Number(cl.getAttribute("x")), ly = Number(cl.getAttribute("y")), lw = s.chem.length * 6.4;
        try { var bb = cl.getBBox(); if (bb.width) lw = bb.width; } catch (err) {}
        api.line([lx - 1, ly], [lx + lw + 1, ly], {color: c.c5, width: 1.6});
      }
      if (site === "airway") T([R + 8, G.cells - 2], "cilia", c.c3, {weight: 500});
      T([R + 8, (G.cells + bot) / 2 + (site === "eye" ? 8 : 0)], "cells", c.c1, {weight: 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (el) { if (el.getAttribute("fill")) el.style.fill = el.getAttribute("fill"); });
    }
  });
})();
