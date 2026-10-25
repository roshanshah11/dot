// Simple diffusion: a solute crosses the bare lipid bilayer on its own, with no protein and no ATP, always from the
// side where it is more concentrated to the side where it is less. Net flux follows Fick's law, J = P (C_out - C_in)
// (inward positive), so it grows in a straight line with the gradient and is zero when the two sides are equal
// (molecules still cross both ways, in equal numbers). The permeability P is set by the molecule: the hydrocarbon core
// lets small nonpolar molecules (O2, CO2) through fast, small uncharged polar ones (urea, water) slowly, large polar
// ones (glucose) hardly at all, and ions (Na+, carrying a shell of water) essentially never; real P values span more
// than ten orders of magnitude, so the ladder below is a ranking, not a scale.
// Picture: one dot per 5 mM on each side; the flow arrow's width scales with |C_out - C_in|.
(function () {
  var S = {
    O2: {cls: 0, name: "O₂", tex: "\\text{O}_2", why: "small, nonpolar", r: 2.6, w: 1, word: "fast"},
    urea: {cls: 1, name: "urea", tex: "\\text{urea}", why: "small but polar", r: 3.2, w: 0.45, word: "slow"},
    glucose: {cls: 2, name: "glucose", tex: "\\text{glucose}", why: "large, polar", r: 4.4, w: 0, word: ""},
    Na: {cls: 3, name: "Na⁺", tex: "\\text{Na}^+", why: "charged", r: 2.8, w: 0, word: ""}
  };
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

  Viz.register("simple-diffusion-across-membrane", {
    title: "Simple diffusion across a membrane",
    subject: "biology",
    shows: "Set the concentration on each side and pick a molecule: small nonpolar molecules slip straight through the lipid bilayer from high to low concentration, with no protein and no ATP, while large polar molecules and ions are kept out",
    params: {
      cOut: {kind: "number", default: 80, min: 0, max: 100, step: 5, label: "C_\\text{out}"},
      cIn: {kind: "number", default: 20, min: 0, max: 100, step: 5, label: "C_\\text{in}"},
      solute: {kind: "enum", values: ["O2", "urea", "glucose", "Na"], default: "O2", label: "\\text{molecule}",
        names: {O2: "O₂", urea: "urea", glucose: "glucose", Na: "Na⁺"}}
    },
    formula: function (v) {
      var s = S[v.solute], d = v.cOut - v.cIn, blocked = !s.w;
      return "J=P\\,(C_\\text{out}-C_\\text{in})=P\\,(" + Viz.n(v.cOut) + "-" + Viz.n(v.cIn) + ")\\newline\\ \\ =" + (d === 0 ? "0" : Viz.n(d) + "\\,P" + (blocked ? "\\approx 0" : "")) +
        ",\\quad P_{" + s.tex + "}" + ["\\ \\text{high}", "\\ \\text{low}", "\\approx 0", "\\approx 0"][s.cls];
    },
    status: function (v) {
      var s = S[v.solute], d = v.cOut - v.cIn, side = d > 0 ? "inward" : "outward";
      if (d === 0 && !v.cOut) return "There is no " + s.name + " on either side, so nothing diffuses.";
      if (d === 0) return "Equal concentrations: " + (s.w ? s.name + " keeps crossing both ways in equal numbers, so there is <b>no net flow</b>." : "no gradient, and " + s.name + " can hardly cross anyway: <b>no net flow</b>.");
      if (s.cls === 0) return "O₂ is small and nonpolar, so it dissolves straight through the lipid tails: net flow <b>" + side + "</b>, down its " + Viz.fmt(Math.abs(d)) + " mM gradient, with no protein and no ATP.";
      if (s.cls === 1) return "Urea is small but polar, so it crosses the bare bilayer only <b>slowly</b>: a weak net flow " + side + ", down its " + Viz.fmt(Math.abs(d)) + " mM gradient.";
      if (s.cls === 2) return "Glucose is large and polar: despite the " + Viz.fmt(Math.abs(d)) + " mM gradient almost none crosses the bare bilayer, so cells move it with <b>carrier proteins</b> (GLUTs).";
      return "Na⁺ is charged and wrapped in water, so the oily core keeps it out despite the " + Viz.fmt(Math.abs(d)) + " mM gradient: ions need <b>channels or pumps</b>.";
    },
    examples: [
      {name: "O₂ diffuses in", values: {cOut: 80, cIn: 20, solute: "O2"}},
      {name: "equal sides: no net flow", values: {cOut: 50, cIn: 50, solute: "O2"}},
      {name: "more inside: flows out", values: {cOut: 10, cIn: 90, solute: "O2"}},
      {name: "urea: slow", values: {cOut: 80, cIn: 20, solute: "urea"}},
      {name: "glucose: kept out", values: {cOut: 80, cIn: 20, solute: "glucose"}},
      {name: "Na⁺: kept out", values: {cOut: 100, cIn: 10, solute: "Na"}},
      {name: "every value at its minimum", values: {cOut: 0, cIn: 0, solute: "O2"}},
      {name: "every value at its maximum", values: {cOut: 100, cIn: 100, solute: "Na"}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, s = S[v.solute], d = v.cOut - v.cIn, X0 = 14, X1 = 278, mT = 70, mB = 122, mid = (mT + mB) / 2;
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // the bilayer: heads on both faces, two rows of tails meeting in the hydrophobic core
      api.rect(X0, mT, X1 - X0, mB - mT, {fill: c.c3, fillOpacity: 0.05, rx: 2});
      for (var x = X0 + 6; x <= X1 - 4; x += 11) {
        [[mT + 5, 1], [mB - 5, -1]].forEach(function (h) {
          api.line([x - 1.6, h[0]], [x - 1.6, mid - h[1] * 2], {color: c.c3, width: 1, opacity: 0.45});
          api.line([x + 1.6, h[0]], [x + 1.6, mid - h[1] * 2], {color: c.c3, width: 1, opacity: 0.45});
          api.circle([x, h[0]], 4.4, {fill: c.c3, fillOpacity: 0.75});
        });
      }
      T([X1 + 4, mT - 2], "polar heads", c.c3, {weight: 500, size: 12});
      T([X1 + 4, mid], "oily core", c.c3, {weight: 500, size: 12});
      // molecules on each side, one per 5 mM
      var mol = function (at) {
        api.circle(at, s.r, {fill: c.c1, fillOpacity: 0.9});
        if (s.cls === 3) api.circle(at, s.r + 3, {stroke: c.c2, width: 1, opacity: 0.6});      // hydration shell
      };
      var side = function (conc, y0, y1, seed) {
        var r = rng(seed), k = Math.round(conc / 5);
        for (var i = 0; i < k; i++) mol([X0 + 8 + r() * (X1 - X0 - 16), y0 + r() * (y1 - y0)]);
      };
      side(v.cOut, 30, mT - 10, 11); side(v.cIn, mB + 10, 160, 29);
      T([X0, 14], "outside: " + api.fmt(v.cOut) + " mM " + s.name, c.muted, {weight: 500});
      T([X0, 176], "cytosol: " + api.fmt(v.cIn) + " mM " + s.name, c.muted, {weight: 500});
      // what happens at the membrane
      var down = d > 0, ax = 384;
      if (s.w && d !== 0) {
        var k = s.cls === 0 ? 3 : 1;
        for (var j = 0; j < k; j++) {
          var cx = [140, 64, 216][j];
          mol([cx, mid]);
          api.line([cx + 9, mid + (down ? -9 : 9)], [cx + 9, mid + (down ? 9 : -9)], {color: c.c4, width: 1.6, arrow: true});
        }
        var w = 1.5 + 6 * s.w * Math.abs(d) / 100;
        api.arrow([ax, down ? 36 : 158], [ax, down ? 158 : 36], {color: c.c4, width: w, halo: false, head: 8 + w, dash: s.cls === 1 ? "5 4" : null});
        T([ax - 7 - w / 2, down ? 136 : 44], down ? "net in" : "net out", c.c4, {anchor: "end"});
        T([ax - 7 - w / 2, down ? 150 : 58], s.word, c.c4, {anchor: "end", weight: 500});
      } else if (!s.w && (v.cOut || v.cIn)) {
        // turned back at the surface on the high side
        var hi = v.cOut >= v.cIn, y0 = hi ? mT - 16 : mB + 16, sg = hi ? 1 : -1, bx = 140;
        mol([bx, y0]);
        api.path("M " + (bx + 8) + " " + y0 + " q 14 " + (sg * 16) + " 28 0", {stroke: c.c5, width: 1.6, arrow: true});
        var xy = [bx + 36, hi ? mT - 5 : mB + 5];
        api.line([xy[0] - 4, xy[1] - 4], [xy[0] + 4, xy[1] + 4], {color: c.c5, width: 2.2});
        api.line([xy[0] - 4, xy[1] + 4], [xy[0] + 4, xy[1] - 4], {color: c.c5, width: 2.2});
        T([396, 150], d === 0 ? "no net flow" : "net flow ≈ 0", c.c5, {anchor: "end"});
      } else if (d === 0 && v.cOut) {
        api.line([ax - 6, 40], [ax - 6, 134], {color: c.c4, width: 1.6, arrow: true});
        api.line([ax + 6, 134], [ax + 6, 40], {color: c.c4, width: 1.6, arrow: true});
        T([ax - 14, 150], "no net flow", c.c4, {anchor: "end"});
      }
      // the ladder: what crosses a bare bilayer, fastest to essentially never (a ranking; real P spans > 10 orders)
      var L = [["small nonpolar", "O₂, CO₂, N₂"], ["small polar", "urea, H₂O"], ["large polar", "glucose"], ["ions", "Na⁺, K⁺, Cl⁻"]];
      var lx0 = 12, lw = 95, ly = 218;
      T([lx0, 196], "what crosses a bare lipid bilayer, fastest first", c.muted, {weight: 500});
      L.forEach(function (e, i) {
        var x = lx0 + i * lw, on = i === s.cls, col = i < 2 ? c.c4 : c.c5;
        api.rect(x, ly, lw - 6, 46, {fill: col, fillOpacity: on ? 0.28 : 0.07, stroke: on ? col : null, width: 1.6, rx: 5});
        T([x + (lw - 6) / 2, ly + 15], e[0], on ? c.ink : c.muted, {anchor: "middle", weight: on ? 650 : 500});
        T([x + (lw - 6) / 2, ly + 32], e[1], on ? col : c.muted, {anchor: "middle", weight: 500});
      });
      api.arrow([lx0, ly + 62], [lx0 + 4 * lw - 6, ly + 62], {color: c.muted, width: 1.6, halo: false, head: 8});
      T([lx0, ly + 78], "fast", c.c4, {weight: 500});
      T([lx0 + 4 * lw - 6, ly + 78], "essentially never", c.c5, {anchor: "end", weight: 500});
      T([lx0 + 2 * lw - 3, ly + 78], "permeability P falls", c.muted, {anchor: "middle", weight: 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
