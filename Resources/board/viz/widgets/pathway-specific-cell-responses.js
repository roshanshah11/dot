// One signal, four cells, four answers. Epinephrine reaches every cell the blood touches, but each cell answers with
// the receptor and relay proteins it happens to make. Liver: beta2 -> Gs -> cAMP -> PKA -> glycogen phosphorylase, so
// glycogen is split and glucose leaves (human liver also uses alpha1; rodents mostly alpha1). Heart muscle: beta1 -> the
// same cAMP relay, but PKA phosphorylates L-type Ca2+ channels, so beats come faster and harder. Arteriole of the gut:
// alpha1 -> Gq -> PLC -> IP3 -> Ca2+ -> calmodulin -> myosin light-chain kinase (MLCK) on, so the smooth muscle
// contracts and the vessel narrows. Arteriole of skeletal muscle: beta2 -> cAMP -> PKA, and PKA phosphorylates MLCK so
// it binds Ca2+-calmodulin less well (and Ca2+ falls), so the muscle relaxes and the vessel widens. Blockers occupy one
// receptor family: propranolol beta1 and beta2, metoprolol beta1 (cardioselective), prazosin alpha1.
(function () {
  var CELLS = {
    liver: {name: "liver", rec: "β₂", tex: "\\beta_2", route: "s", relay: ["Gs", "cAMP", "PKA"], eff: "phosphorylase", effTex: "\\text{phosphorylase}",
      resp: ["glucose", "released"], respTex: "\\text{glucose out}"},
    heart: {name: "heart", rec: "β₁", tex: "\\beta_1", route: "s", relay: ["Gs", "cAMP", "PKA"], eff: "Ca²⁺ channels", effTex: "\\text{Ca}^{2+}\\text{ channels}",
      resp: ["beats faster", "and harder"], respTex: "\\text{faster beats}"},
    gut: {name: "gut vessel", rec: "α₁", tex: "\\alpha_1", route: "q", relay: ["Gq", "IP₃", "Ca²⁺"], eff: "MLCK on", effTex: "\\text{MLCK on}",
      resp: ["vessel", "constricts"], respTex: "\\text{constricts}"},
    muscle: {name: "muscle vessel", rec: "β₂", tex: "\\beta_2", route: "s", relay: ["Gs", "cAMP", "PKA"], eff: "MLCK off", effTex: "\\text{MLCK off}",
      resp: ["vessel", "dilates"], respTex: "\\text{dilates}"}
  };
  var KEYS = ["liver", "heart", "gut", "muscle"];
  var BLOCKS = {none: [], propranolol: ["β₁", "β₂"], metoprolol: ["β₁"], prazosin: ["α₁"]};
  var SAY = {
    liver: "Liver cells read epinephrine through <b>β₂</b> receptors, Gs and cAMP, and their PKA switches on glycogen phosphorylase, so the liver <b>releases glucose</b>",
    heart: "Heart muscle uses <b>β₁</b> receptors and the same cAMP relay, but its PKA opens Ca²⁺ channels, so the heart <b>beats faster and harder</b>",
    gut: "Gut arterioles carry <b>α₁</b> receptors instead: Gq makes IP₃, Ca²⁺ rises and turns MLCK on, so the smooth muscle <b>contracts</b> and the vessel narrows",
    muscle: "Arterioles in skeletal muscle run the liver's own β₂ → cAMP → PKA relay, yet here PKA turns MLCK off, so the vessel <b>dilates</b>, the opposite of the gut"
  };
  function blocked(cell, drug) { return BLOCKS[drug].indexOf(CELLS[cell].rec) >= 0; }

  Viz.register("pathway-specific-cell-responses", {
    title: "One signal, different cell responses",
    subject: "biology",
    shows: "Pick a cell and a blocker: epinephrine reaches all four, but each answers with its own receptor and relay proteins, so the liver releases glucose, the heart speeds up, one vessel narrows and another widens",
    params: {
      cell: {kind: "enum", values: KEYS, default: "liver", label: "\\text{cell}", names: {liver: "liver", heart: "heart", gut: "gut vessel", muscle: "muscle vessel"}},
      drug: {kind: "enum", values: ["none", "propranolol", "metoprolol", "prazosin"], default: "none", label: "\\text{blocker}"}
    },
    formula: function (v) {
      var k = CELLS[v.cell];
      if (blocked(v.cell, v.drug)) return k.tex + "\\ \\text{blocked by " + v.drug + "}\\newline\\Rightarrow\\ \\text{no response in the " + k.name + "}";
      var relay = k.route === "s" ? "G_s\\to\\text{cAMP}\\to\\text{PKA}" : "G_q\\to\\text{IP}_3\\to\\text{Ca}^{2+}";
      return k.tex + "\\to " + relay + "\\newline\\to " + k.effTex + "\\to " + k.respTex;
    },
    status: function (v) {
      var k = CELLS[v.cell], answering = KEYS.filter(function (x) { return !blocked(x, v.drug); }).length;
      if (blocked(v.cell, v.drug)) return v.drug.charAt(0).toUpperCase() + v.drug.slice(1) + " sits on the " + k.name + "'s <b>" + k.rec.replace("1", "₁").replace("2", "₂") +
        "</b> receptors, so epinephrine cannot start its relay: <b>no response</b> here, while " + (answering === 1 ? "only 1 of the 4 cells still answers." : answering + " of the 4 cells still answer.");
      var off = KEYS.filter(function (x) { return blocked(x, v.drug); }).map(function (x) { return CELLS[x].name; });
      var list = off.length > 1 ? off.slice(0, -1).join(", ") + " and " + off[off.length - 1] : off[0];
      return SAY[v.cell] + (v.drug === "none" ? "." : "; " + v.drug + " silences " + (off.length === 1 ? "only the " : "the ") + list + ".");
    },
    examples: [
      {name: "liver releases glucose", values: {cell: "liver", drug: "none"}},
      {name: "gut vessel narrows", values: {cell: "gut", drug: "none"}},
      {name: "same relay, opposite answer", values: {cell: "muscle", drug: "none"}},
      {name: "metoprolol spares the liver", values: {cell: "liver", drug: "metoprolol"}},
      {name: "propranolol blocks the heart", values: {cell: "heart", drug: "propranolol"}},
      {name: "prazosin blocks the gut vessel", values: {cell: "gut", drug: "prazosin"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, W = 94, GAP = 4, X0 = 6, MEM = 62;
      var routeCol = {s: c.c1, q: c.c6};
      api.label([X0, 12], "epinephrine in the blood: the same signal reaches every cell", {color: c.c3, size: 12, weight: 600});
      KEYS.forEach(function (key, i) {
        var k = CELLS[key], x = X0 + i * (W + GAP), cx = x + W / 2, sel = key === v.cell, blk = blocked(key, v.drug);
        var g = api.group({opacity: sel ? 1 : 0.5}), col = routeCol[k.route], lit = blk ? c.muted : col;
        var L = function (at, t, o) { return api.label(at, t, Object.assign({anchor: "middle", size: 12, parent: g}, o)); };
        // the cell, its membrane and the hormone arriving
        api.rect(x, MEM - 4, W, 216, {fill: sel ? col : "none", fillOpacity: sel ? 0.07 : 0, stroke: sel ? c.ink : c.muted, width: sel ? 1.8 : 1, rx: 10, parent: g});
        api.line([x + 4, MEM], [x + W - 4, MEM], {color: c.muted, width: 4, opacity: 0.8, parent: g});
        api.polygon([[cx - 22, 26], [cx - 17, 31], [cx - 22, 36], [cx - 27, 31]], {fill: c.c3, fillOpacity: 0.95, parent: g});
        api.polygon([[cx + 22, 22], [cx + 27, 27], [cx + 22, 32], [cx + 17, 27]], {fill: c.c3, fillOpacity: 0.95, parent: g});
        api.line([cx, 30], [cx, MEM - 18], {color: c.c3, width: 1.8, arrow: true, parent: g});
        // receptor, or the drug sitting on it
        api.rect(cx - 9, MEM - 12, 18, 22, {fill: lit, fillOpacity: blk ? 0.3 : 0.8, rx: 5, parent: g});
        L([cx, MEM + 22], k.rec + " receptor", {color: lit, weight: 650});
        if (blk) {
          api.rect(cx - 13, MEM - 20, 26, 9, {fill: c.c5, fillOpacity: 0.95, rx: 3, parent: g});
          api.line([cx - 9, MEM - 8], [cx + 9, MEM + 8], {color: c.c5, width: 2.5, parent: g});
          api.line([cx + 9, MEM - 8], [cx - 9, MEM + 8], {color: c.c5, width: 2.5, parent: g});
        }
        // the relay: three pills and the arrows between them
        k.relay.forEach(function (t, j) {
          var y = 118 + j * 30;
          api.rect(cx - 30, y - 10, 60, 20, {fill: lit, fillOpacity: blk ? 0.08 : 0.2, stroke: lit, width: 1.2, rx: 10, parent: g});
          L([cx, y], t, {color: blk ? c.muted : c.ink, weight: 600});
          api.line([cx, y - (j ? 20 : 24)], [cx, y - 12], {color: lit, width: 1.6, arrow: true, opacity: blk ? 0.4 : 1, parent: g});
        });
        api.line([cx, 190], [cx, 201], {color: lit, width: 1.6, arrow: true, opacity: blk ? 0.4 : 1, parent: g});
        L([cx, 211], k.eff, {color: blk ? c.muted : col, weight: 650});
        // the response
        if (blk) {
          L([cx, 244], "no response", {color: c.c5, weight: 650});
        } else {
          L([cx, 237], k.resp[0], {color: c.c4, weight: 700, size: 12.5});
          L([cx, 253], k.resp[1], {color: c.c4, weight: 700, size: 12.5});
        }
        L([cx, 287], k.name, {color: sel ? c.ink : c.muted, weight: sel ? 700 : 500, size: 12.5});
      });
      api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; });   // viz.css paints svg text ink
    }
  });
})();
