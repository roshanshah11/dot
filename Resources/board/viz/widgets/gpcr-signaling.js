// A G-protein-coupled receptor cycle for the three classic G alpha families. The ligand-bound receptor is a GEF: G alpha
// swaps GDP for GTP, separates from G beta-gamma and acts until its own GTPase (sped up by RGS proteins) turns GTP back
// into GDP and the trimer re-forms. Gs (beta1-adrenergic, heart): adenylyl cyclase makes cAMP, cAMP frees PKA's
// catalytic subunits, PDE clears cAMP. Gi (M2 muscarinic, heart): G alpha i inhibits adenylyl cyclase so cAMP falls,
// and G beta-gamma opens GIRK K+ channels, so the heart slows. Gq (alpha1-adrenergic, vascular smooth muscle):
// phospholipase C-beta cuts PIP2 into IP3 and DAG; IP3 opens ER IP3 receptors so cytosolic Ca2+ rises from about
// 0.1 uM to about 1 uM; DAG and Ca2+ activate PKC; SERCA pumps refill the ER. The gauge is qualitative except the Ca2+
// values, which are typical textbook concentrations.
(function () {
  var P = {
    Gs: {rec: "β₁-adrenergic receptor", tex: "\\beta_1\\text{-adrenergic}", lig: "adrenaline", eff: "adenylyl cyclase", msg: "cAMP", hi: 0.88, out: "→ heart beats faster and harder"},
    Gi: {rec: "M2 muscarinic receptor", tex: "\\text{M}_2\\text{ muscarinic}", lig: "acetylcholine", eff: "adenylyl cyclase", msg: "cAMP", hi: 0.06, out: "→ heart rate slows"},
    Gq: {rec: "α₁-adrenergic receptor", tex: "\\alpha_1\\text{-adrenergic}", lig: "adrenaline", eff: "phospholipase Cβ", msg: "Ca²⁺", hi: 0.88, out: "→ smooth muscle contracts, vessel narrows"}
  };
  var SAY = {
    Gs: ["Adrenaline binds a <b>β₁-adrenergic</b> receptor on a heart cell, which changes shape on the inside of the membrane.",
      "The active receptor makes Gαs drop <b>GDP</b> and pick up <b>GTP</b>.",
      "<b>Gαs·GTP</b> lets go of βγ and slides along the membrane to adenylyl cyclase.",
      "Adenylyl cyclase turns ATP into <b>cAMP</b>, which frees PKA's catalytic subunits, and the heart beats faster and harder.",
      "Gαs hydrolyses its GTP to <b>GDP</b> and rejoins βγ while phosphodiesterase breaks cAMP down, so the signal stops."],
    Gi: ["Acetylcholine from the vagus nerve binds an <b>M2 muscarinic</b> receptor on a heart cell.",
      "The active receptor makes Gαi drop <b>GDP</b> and pick up <b>GTP</b>.",
      "<b>Gαi·GTP</b> and <b>Gβγ</b> separate, and each has a job.",
      "Gαi <b>inhibits</b> adenylyl cyclase so cAMP falls, while Gβγ opens <b>GIRK</b> channels that let K⁺ out, and the heart slows.",
      "Gαi hydrolyses its GTP to <b>GDP</b> and rejoins βγ: the cyclase recovers, cAMP returns to rest and GIRK closes."],
    Gq: ["Adrenaline binds an <b>α₁-adrenergic</b> receptor on the smooth muscle of a blood vessel.",
      "The active receptor makes Gαq drop <b>GDP</b> and pick up <b>GTP</b>.",
      "<b>Gαq·GTP</b> leaves βγ and switches on phospholipase Cβ.",
      "PLCβ cuts PIP₂ into <b>IP₃</b>, which opens ER channels so Ca²⁺ rises about tenfold, and <b>DAG</b>, which with Ca²⁺ turns on PKC: the muscle contracts.",
      "Gαq hydrolyses its GTP to <b>GDP</b> and rejoins βγ while SERCA pumps Ca²⁺ back into the ER, so the signal ends."]
  };

  Viz.register("gpcr-signaling", {
    title: "GPCR signaling: Gs, Gi and Gq",
    subject: "biology",
    shows: "Pick Gs, Gi or Gq and step through: the ligand-bound receptor swaps GDP for GTP on Gα, the subunits split and change cAMP or Ca²⁺, and GTP hydrolysis switches the G protein off",
    params: {
      pathway: {kind: "enum", values: ["Gs", "Gi", "Gq"], default: "Gs", label: "\\text{pathway}"}
    },
    steps: ["ligand binds", "GDP out, GTP in", "subunits split", "second messenger", "GTP hydrolysis: off"],
    stepMs: 1800,
    formula: function (v) {
      var s = v.step || 1, a = "G\\alpha_{" + v.pathway.charAt(1) + "}";
      if (s === 1) return "\\text{L}+\\text{R}\\rightleftharpoons\\text{LR}^{*}\\quad(" + P[v.pathway].tex + ")";
      if (s === 2) return a + "\\!\\cdot\\!\\text{GDP}+\\text{GTP}\\xrightarrow{\\text{LR}^{*}}" + a + "\\!\\cdot\\!\\text{GTP}+\\text{GDP}";
      if (s === 3) return a + "\\beta\\gamma\\!\\cdot\\!\\text{GTP}\\to " + a + "\\!\\cdot\\!\\text{GTP}+G\\beta\\gamma";
      if (s === 5) return a + "\\!\\cdot\\!\\text{GTP}+\\text{H}_2\\text{O}\\to " + a + "\\!\\cdot\\!\\text{GDP}+\\text{P}_i";
      if (v.pathway === "Gs") return "\\text{ATP}\\xrightarrow{\\text{AC}}\\text{cAMP}+\\text{PP}_i\\newline\\text{cAMP}\\uparrow\\ \\Rightarrow\\ \\text{PKA on}";
      if (v.pathway === "Gi") return a + "\\dashv\\text{AC}:\\ \\text{cAMP}\\downarrow\\newline G\\beta\\gamma\\to\\text{GIRK}:\\ \\text{K}^{+}\\text{ out}";
      return "\\text{PIP}_2\\xrightarrow{\\text{PLC}\\beta}\\text{IP}_3+\\text{DAG}\\newline[\\text{Ca}^{2+}]:\\ 0.1\\to 1\\ \\mu\\text{M}\\ \\Rightarrow\\ \\text{PKC on}";
    },
    status: function (v) { return SAY[v.pathway][(v.step || 1) - 1]; },
    examples: [
      {name: "pathway: Gi", values: {pathway: "Gi"}},
      {name: "pathway: Gq", values: {pathway: "Gq"}},
      {name: "Gs raises cAMP", values: {pathway: "Gs", step: 4}},
      {name: "Gi lowers cAMP and opens GIRK", values: {pathway: "Gi", step: 4}},
      {name: "Gq releases Ca2+", values: {pathway: "Gq", step: 4}},
      {name: "switched off", values: {pathway: "Gq", step: 5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, pw = v.pathway, info = P[pw], M0 = 72, M1 = 96, EX = 222;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600, raw: true}, o || {})); };
      api.rect(0, M0, 400, M1 - M0, {fill: c.muted, fillOpacity: 0.18, rx: 0});
      L([392, 12], "outside", c.muted, {anchor: "end", weight: 500});
      L([392, 108], "cytosol", c.muted, {anchor: "end", weight: 500});
      // receptor: seven helices; helix 6 swings out while the ligand is bound
      var bound = s <= 4;
      for (var i = 0; i < 7; i++) api.line([30 + i * 8, M0 - 8], [30 + i * 8 + (bound && i === 5 ? 7 : 0), M1 + 10], {color: c.c2, width: 5.5});
      L([8, 18], info.rec, c.c2);
      var lig = bound ? [54, M0 - 12] : [118, 36];
      api.polygon([[lig[0], lig[1] - 8], [lig[0] + 8, lig[1]], [lig[0], lig[1] + 8], [lig[0] - 8, lig[1]]], {fill: c.c5, fillOpacity: 1});
      L([lig[0] + 13, lig[1] - 8], bound ? info.lig : "ligand leaves", c.c5);
      // effector in the membrane
      var plc = pw === "Gq", girk = pw === "Gi", gOpen = girk && s === 4, GX = 322;
      if (plc) api.path("M " + (EX - 24) + " " + (M1 + 2) + " q 24 -12 48 0 q 4 24 -24 26 q -28 -2 -24 -26 Z", {fill: c.c3, fillOpacity: 0.3, stroke: c.c3, width: 1.5});
      else {
        for (var h = 0; h < 4; h++) api.line([EX - 15 + h * 10, M0 - 6], [EX - 15 + h * 10, M1 + 6], {color: c.c3, width: 5});
        api.circle([EX, M1 + 22], 14, {fill: c.c3, fillOpacity: s === 4 && pw === "Gs" ? 0.6 : 0.3, stroke: c.c3, width: 1.5});
      }
      L([EX, 50], info.eff, c.c3, {anchor: "middle"});
      if (girk) {
        api.rect(GX - 16, M0 - 6, 10, M1 - M0 + 12, {fill: c.muted, fillOpacity: 0.7, rx: 3});
        api.rect(GX + (gOpen ? 8 : 2), M0 - 6, 10, M1 - M0 + 12, {fill: c.muted, fillOpacity: 0.7, rx: 3});
        L([GX - 6, 42], gOpen ? "GIRK open" : "GIRK", c.muted, {anchor: "middle"});
      }
      // G protein: alpha with its nucleotide, beta-gamma beside it
      var alpha = function (p, nuc) {
        api.line([p[0], p[1] - 13], [p[0], M1], {color: c.c1, width: 1.5});
        api.circle(p, 15, {fill: c.c1, fillOpacity: 0.3, stroke: c.c1, width: 1.6});
        L(p, nuc, c.c1, {anchor: "middle", weight: 700});
        L([p[0], p[1] + 25], "Gα" + pw.charAt(1), c.c1, {anchor: "middle"});
      };
      var betagamma = function (p) {
        api.circle(p, 13, {fill: c.c6, fillOpacity: 0.3, stroke: c.c6, width: 1.6});
        api.circle([p[0] + 13, p[1] - 11], 6, {fill: c.c6, fillOpacity: 0.5});
        api.line([p[0] + 13, p[1] - 17], [p[0] + 13, M1], {color: c.c6, width: 1.5});
        L(p, "βγ", c.c6, {anchor: "middle", weight: 700});
      };
      var GA = [100, 122], GB = [134, 124], AT = [girk ? 176 : EX - 32, girk ? 136 : 128];
      if (s <= 2 || s === 5) { alpha(GA, s === 1 || s === 5 ? "GDP" : "GTP"); betagamma(GB); }
      else { alpha(AT, "GTP"); betagamma(gOpen ? [GX - 6, 122] : GB); }
      if (s === 2) {
        api.arrow([GA[0] - 16, GA[1] + 10], [GA[0] - 44, GA[1] + 30], {color: c.c1, width: 1.6, halo: false, head: 7});
        L([GA[0] - 50, GA[1] + 40], "GDP", c.c1, {anchor: "middle"});
        api.arrow([GA[0] + 34, GA[1] + 42], [GA[0] + 12, GA[1] + 14], {color: c.c1, width: 1.6, halo: false, head: 7});
        L([GA[0] + 42, GA[1] + 50], "GTP", c.c1, {anchor: "middle"});
      }
      if (s === 5) L([GA[0] - 22, GA[1] + 44], "GTP → GDP + Pᵢ", c.c1);
      // the second messenger and what it does; a gauge on the right
      var lvl = s === 4 ? info.hi : 0.3, gx = 378, g0 = 240, g1 = 140, gy = function (f) { return g0 - f * (g0 - g1); };
      var dots = function (n, x0, y0, w, hgt, kind) {
        for (var k = 0; k < n; k++) {
          var rnd = function (q) { var t = Math.sin(q * 12.9898 + x0 * 0.37) * 43758.5453; return t - Math.floor(t); }, p = [x0 + rnd(k + 1) * w, y0 + rnd(k + 101) * hgt];
          if (kind === "tri") api.polygon([[p[0], p[1] - 4], [p[0] + 4, p[1] + 3], [p[0] - 4, p[1] + 3]], {fill: c.c4, fillOpacity: 1});
          else api.circle(p, 3, {fill: c.c4});
        }
      };
      if (!plc) {
        dots(s === 4 ? (pw === "Gs" ? 16 : 1) : 4, 190, 190, 150, 34);
        L([186, 176], s === 5 && pw === "Gs" ? "PDE: cAMP → AMP" : "cAMP", c.c4);
        if (s === 4 && pw === "Gs") {
          L([EX + 20, M1 + 34], "ATP → cAMP", c.c4);
          [0, 1].forEach(function (k) { api.rect(150 + k * 18, 236, 14, 18, {stroke: c.muted, width: 1.4, rx: 4}); api.circle([214 + k * 22, 245], 7, {fill: c.ink, fillOpacity: 0.85}); });
          L([150, 268], "PKA: catalytic subunits freed", c.ink, {weight: 500});
        }
        if (s === 4 && pw === "Gi") {
          api.line([AT[0] + 15, AT[1] - 6], [EX - 16, M1 + 26], {color: c.c1, width: 2});
          api.line([EX - 21, M1 + 21], [EX - 11, M1 + 31], {color: c.c1, width: 2.5});
          L([EX + 18, M1 + 40], "inhibited", c.c1, {weight: 500});
          api.arrow([GX - 4, M1 + 2], [GX - 4, M0 - 12], {color: c.ink, width: 2, halo: false, head: 8});
          L([GX + 6, M0 - 8], "K⁺", c.ink);
        }
      } else {
        api.rect(150, 242, 190, 36, {stroke: c.muted, width: 1.4, rx: 14});
        L([332, 260], "ER", c.muted, {anchor: "end", weight: 500});
        api.rect(232, 234, 14, 16, {fill: c.muted, fillOpacity: 0.7, rx: 3});
        dots(s === 4 ? 4 : 12, 164, 254, 140, 16);
        if (s === 4) {
          L([EX + 28, M0 + 12], "DAG", c.c4);
          api.rect(EX + 28, M1 - 7, 22, 7, {fill: c.c4, rx: 3});
          dots(5, 184, 156, 50, 52, "tri");
          L([178, 214], "IP₃", c.c4, {anchor: "end"});
          api.line([214, 212], [234, 230], {color: c.c4, width: 1.5, dash: "3 3", arrow: true});
          api.arrow([246, 234], [266, 206], {color: c.c4, width: 1.8, halo: false, head: 7});
          dots(12, 262, 150, 86, 44);
          L([276, 222], "Ca²⁺ out of ER", c.c4);
          api.circle([272, M1 + 16], 13, {stroke: c.ink, width: 1.5});
          L([272, M1 + 16], "PKC", c.ink, {anchor: "middle", weight: 700, size: 12});
        } else {
          dots(4, 200, 196, 120, 30);
          L([200, 182], s === 5 ? "SERCA pumps Ca²⁺ back" : "Ca²⁺ at rest", c.c4, {weight: 500});
          if (s === 5) api.arrow([290, 206], [290, 238], {color: c.c4, width: 1.6, halo: false, head: 7});
        }
      }
      if (s === 4) L([8, 290], info.out, c.ink);
      api.rect(gx - 7, g1, 14, g0 - g1, {stroke: c.faint, width: 1.2, rx: 7});
      api.rect(gx - 5, gy(lvl), 10, g0 - gy(lvl) - 2, {fill: c.c4, rx: 5});
      api.line([gx - 12, gy(0.3)], [gx + 12, gy(0.3)], {color: c.muted, width: 1.2, dash: "3 3"});
      L([gx - 14, gy(0.3)], "rest", c.muted, {anchor: "end", weight: 500});
      L([gx, g1 - 12], info.msg, c.c4, {anchor: "middle"});
      if (plc) L([gx, g0 + 13], s === 4 ? "~1 µM" : "0.1 µM", c.c4, {anchor: "middle", weight: 500});
      else if (s === 4) L([gx, g0 + 13], pw === "Gs" ? "up" : "down", c.c4, {anchor: "middle"});
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
