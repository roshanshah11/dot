// IgG at the level of domains: two heavy chains (VH, CH1, hinge, CH2, CH3) and two light chains (VL, CL), colored
// three ways (by chain, variable vs constant, Fab vs Fc), and the two classic digests: papain cuts above the hinge
// disulfides (2 Fab + Fc), pepsin cuts below them (F(ab')2, with the Fc broken down to pFc' and peptides).
(function () {
  var R2 = Math.SQRT1_2, S = [191, 158], U = [-R2, -R2], N = [-R2, R2];
  function add(p, d, k) { return [p[0] + d[0] * k, p[1] + d[1] * k]; }
  var CH1 = add(S, U, 21), VH = add(S, U, 57), CL = add(CH1, N, 17), VL = add(VH, N, 17);
  var LEFT = [
    {name: "VH", c: VH, ang: 45, chain: "H", region: "V", frag: "Fab"}, {name: "CH1", c: CH1, ang: 45, chain: "H", region: "C", frag: "Fab"},
    {name: "VL", c: VL, ang: 45, chain: "L", region: "V", frag: "Fab"}, {name: "CL", c: CL, ang: 45, chain: "L", region: "C", frag: "Fab"},
    {name: "CH2", c: [191, 202], ang: 90, chain: "H", region: "C", frag: "Fc"}, {name: "CH3", c: [191, 236], ang: 90, chain: "H", region: "C", frag: "Fc"}
  ];
  var STATUS = {
    chains: "IgG is two identical heavy chains (about 50 kDa each) and two identical light chains (about 25 kDa each), held in a Y by disulfide bonds.",
    domains: "Each chain is a string of similar domains; only the tips, VH and VL, differ between antibodies, and their CDR loops form the antigen-binding site.",
    fragments: "Each Fab arm (VH, CH1, VL, CL) binds one antigen, and the Fc stem (CH2, CH3) is what phagocytes, NK cells and complement recognise.",
    papain: "Papain cuts above the hinge disulfides, giving two separate Fab arms that each still bind one antigen but cannot cross-link, and one Fc (the crystallizable fragment).",
    pepsin: "Pepsin cuts below the hinge disulfides, so the two arms stay joined as F(ab′)₂ and still bind two antigens, while the Fc is broken down to pFc′ and small peptides."
  };

  Viz.register("antibody-heavy-light-chain-fab-fc-structure", {
    title: "Antibody chains, Fab and Fc",
    subject: "biology",
    shows: "Color the IgG by chain, by variable and constant domain, or by Fab and Fc, then digest it with papain or pepsin to see which pieces come apart",
    params: {
      view: {kind: "enum", values: ["chains", "domains", "fragments"], default: "chains", label: "color"},
      digest: {kind: "enum", values: ["intact", "papain", "pepsin"], default: "intact", label: "enzyme"}
    },
    formula: function (v) {
      if (v.digest === "papain") return "\\text{IgG}\\xrightarrow{\\text{papain}}2\\,\\text{Fab}\\,(2\\times50)+\\text{Fc}\\,(50)\\ \\text{kDa}";
      if (v.digest === "pepsin") return "\\text{IgG}\\xrightarrow{\\text{pepsin}}F(ab')_2\\,(\\approx100\\ \\text{kDa})+\\text{pFc}'+\\text{peptides}";
      return "\\text{IgG}=2H+2L\\approx2(50)+2(25)=150\\ \\text{kDa}";
    },
    status: function (v) { return v.digest === "intact" ? STATUS[v.view] : STATUS[v.digest]; },
    examples: [
      {name: "variable and constant domains", values: {view: "domains"}},
      {name: "papain digest", values: {view: "fragments", digest: "papain"}},
      {name: "pepsin digest", values: {view: "chains", digest: "pepsin"}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, pap = v.digest === "papain", pep = v.digest === "pepsin", K = 1.35;
      // layout coordinates are drawn 1.35x larger about (200, 170), moved up to centre the molecule
      var T = function (p) { return [200 + (p[0] - 200) * K, 150 + (p[1] - 170) * K]; };
      var fill = function (d) {
        if (v.view === "chains") return d.chain === "H" ? c.c2 : c.c3;
        if (v.view === "domains") return d.region === "V" ? c.c6 : c.muted;
        return d.frag === "Fab" ? c.c1 : c.c4;
      };
      var armCol = fill(LEFT[1]);   // heavy chain between CH1 and the hinge belongs to the Fab
      var hingeCol = v.view === "chains" ? c.c2 : v.view === "domains" ? c.muted : pap ? c.c4 : pep ? c.c1 : c.ink;
      var off = function (d, sd) {    // where each piece sits after the digest
        if (d.frag === "Fab") return pap ? [sd * R2 * 12, -R2 * 12] : pep ? [0, -12] : [0, 0];
        return pap || pep ? [0, 8] : [0, 0];
      };
      var hingeOff = pap ? 8 : pep ? -12 : 0;
      var ln = function (a, b, col, w) { api.line(T(a), T(b), {color: col, width: w}); };
      [-1, 1].forEach(function (sd) {
        var mx = function (p) { return sd < 0 ? p : [400 - p[0], p[1]]; };
        var mv = function (p, o) { return [p[0] + o[0], p[1] + o[1]]; };
        LEFT.forEach(function (d) {
          var at = mv(mx(d.c), off(d, sd)), col = fill(d), ang = sd < 0 ? d.ang : -d.ang, P = T(at);
          if (pep && d.name === "CH2") {   // pepsin chops CH2 into small peptides
            [[-6, -9], [5, 2], [-4, 11]].forEach(function (q) { var Q = T([at[0] + q[0] * sd, at[1] + q[1]]); api.rect(Q[0] - 5, Q[1] - 4, 10, 8, {fill: col, fillOpacity: 0.3, stroke: col, width: 1, dash: "2 2", rx: 4}); });
            return;
          }
          var r = api.rect(P[0] - 16 * K, P[1] - 7.5 * K, 32 * K, 15 * K, {fill: col, fillOpacity: 0.5, stroke: col, width: 1.5, rx: 7.5 * K});
          r.setAttribute("transform", "rotate(" + ang + " " + P[0] + " " + P[1] + ")");
          if (v.view === "domains" && d.region === "V") {   // the three CDR loops at the tip
            var uu = sd < 0 ? U : [-U[0], U[1]], nn = sd < 0 ? N : [-N[0], N[1]], tip = add(at, uu, 16);
            [-1, 0, 1].forEach(function (k) { api.circle(T(add(tip, nn, k * 4.2)), 2.6, {fill: c.c5}); });
          }
        });
        var fo = off(LEFT[0], sd), hx = sd < 0 ? 191 : 209;
        ln([hx, 158 + hingeOff], [hx, 186 + hingeOff], hingeCol, 3.5);
        var a0 = mx(S), a1 = mv(mx(add(S, U, 5)), fo);
        ln(pap ? mv(a0, fo) : pep ? [a0[0], a0[1] - 12] : a0, a1, armCol, 3.5);
        ln(mv(mx(add(CL, U, -16)), fo), mv(mx(add(S, U, 3)), fo), c.ink, 1.4);   // light-heavy disulfide
      });
      [166, 176].forEach(function (y) { ln([191, y + hingeOff], [209, y + hingeOff], c.ink, 1.8); });
      // labels for the coloring, on the left half
      var lab = function (p, t, col, anchor) { api.label(T(p), t, {color: col, size: 12.5, weight: 600, anchor: anchor || "end"}); };
      var fl = off(LEFT[0], -1), sh = function (p, k, d) { var q = add(p, d || N, k); return [q[0] + fl[0], q[1] + fl[1]]; };
      var dy = pap || pep ? 8 : 0;
      if (v.view === "chains") {
        lab([180, 222 + dy], "heavy chain", c.c2);
        lab(sh(CL, 17), "light chain", c.c3);
      } else if (v.view === "domains") {
        lab(sh(VL, 13), "VL", c.c6); lab(sh(CL, 13), "CL", c.muted);
        lab(sh(VH, -12), "VH", c.c6, "start"); lab(sh(CH1, -10), "CH1", c.muted, "start");
        if (!pep) lab([180, 202 + dy], "CH2", c.muted);
        lab([180, 236 + dy], "CH3", c.muted);
        lab(sh(add(VH, U, 19), 9), "CDRs", c.c5);
        api.label([12, 280], "V = variable, C = constant", {color: c.muted, size: 12});
      } else {
        lab(sh(VL, 16), "Fab", c.c1);
        lab([180, 219 + dy], "Fc", c.c4);
      }
      api.label(T([214, 181 + hingeOff]), "hinge (S–S)", {color: c.muted, size: 12});
      // what the digest produced, on the right
      if (pap) {
        api.label([200, 14], "two Fab, ≈ 50 kDa each", {color: c.ink, size: 12.5, anchor: "middle"});
        api.label(T([222, 248]), "Fc ≈ 50 kDa", {color: c.ink, size: 12.5});
      } else if (pep) {
        api.label([200, 14], "F(ab′)₂ ≈ 100 kDa", {color: c.ink, size: 12.5, anchor: "middle"});
        api.label(T([222, 204]), "CH2 → peptides", {color: c.muted, size: 12});
        api.label(T([222, 246]), "pFc′ (CH3 pair)", {color: c.ink, size: 12.5});
      }
      // viz.css paints every svg label ink (it overrides the fill attribute); keep each label's own color
      api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
