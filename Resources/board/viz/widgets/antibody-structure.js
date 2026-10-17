// The five antibody classes built from the same unit: two heavy chains and two light chains in a Y.
// IgG, IgD and IgE are single Ys (IgD with a long hinge; IgE with an extra constant domain and no hinge),
// secretory IgA is two Ys joined by a J chain and wrapped in secretory component (in blood IgA is mostly a single Y),
// IgM is five Ys on a J chain. Binding sites = 2 per unit. Masses are the usual textbook values.
(function () {
  // wf: stroke width per unit of scale (single Ys are drawn bold so each domain reads as a block)
  var INFO = {
    "IgG": {units: 1, kda: "150", greek: "γ", hinge: 6, stem: 44, scale: 2.45, wf: 4.4, at: [200, 128]},
    "secretory IgA": {units: 2, kda: "385", greek: "α", hinge: 6, stem: 44, scale: 1.45, wf: 3.2, short: "sIgA", name: "Secretory IgA"},
    "IgM": {units: 5, kda: "900", greek: "μ", hinge: 0, stem: 60, scale: 0.95, wf: 3.2},
    "IgE": {units: 1, kda: "190", greek: "ε", hinge: 0, stem: 60, scale: 2.1, wf: 4.4, at: [200, 112]},
    "IgD": {units: 1, kda: "180", greek: "δ", hinge: 16, stem: 44, scale: 2.2, wf: 4.4, at: [200, 138]}
  };
  var STATUS = {
    "IgG": "a single Y and about 75% of the antibody in blood; the only class that crosses the placenta, it coats microbes for phagocytes and activates complement.",
    "secretory IgA": "two Ys joined tail to tail by a J chain and wrapped in secretory component, which carries it across epithelia into mucus, tears and milk; in blood, IgA is mostly a single Y (about 160 kDa, 2 sites).",
    "IgM": "five Ys on a J chain, the first class made in a primary response; ten weak sites add up to strong binding and powerful complement activation.",
    "IgE": "a single Y with an extra constant domain and no hinge; its Fc sits on mast cells and basophils, and antigen cross-linking it sets off allergy.",
    "IgD": "a single Y with a long, flexible hinge, found mostly on naive B cells beside IgM as an antigen receptor, with little in the blood."
  };

  Viz.register("antibody-structure", {
    title: "Antibody structure and classes",
    subject: "biology",
    shows: "Switch the class: every antibody is built from Y units of two heavy and two light chains, and the classes differ in how many units, which heavy chain, and the hinge",
    params: {
      cls: {kind: "enum", values: ["IgG", "secretory IgA", "IgM", "IgE", "IgD"], default: "IgG", label: "class"},
      antigen: {kind: "boolean", default: false, label: "antigen", on: "bound", off: "none"}
    },
    formula: function (v) {
      var I = INFO[v.cls];
      return "\\text{" + (I.short || v.cls) + ": binding sites}=2\\times" + I.units + "=\\nobreak " + 2 * I.units + "\\newline M\\approx\\nobreak " + I.kda + "\\ \\text{kDa}";
    },
    status: function (v) {
      var I = INFO[v.cls];
      return (I.name || v.cls) + " (heavy chain " + I.greek + ", <b>" + 2 * I.units + "</b> binding sites) is " + STATUS[v.cls];
    },
    examples: [
      {name: "IgM pentamer with antigen", values: {cls: "IgM", antigen: true}},
      {name: "secretory IgA", values: {cls: "secretory IgA"}},
      {name: "IgE", values: {cls: "IgE", antigen: true}},
      {name: "IgD", values: {cls: "IgD"}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, I = INFO[v.cls], h = I.hinge, st = I.stem;
      // one Y unit: local coordinates with arms up and the hinge at the origin, rotated by ang (degrees, 0 = arms up)
      function unit(C, ang, s, wf) {
        var a = ang * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), w = wf * s;
        var bold = wf > 4, HX = bold ? 4.2 : 3.5, OFF = 2 * HX;   // heavy-chain half gap, light-chain offset
        var ins = bold ? wf / 2 + 0.8 : wf / 2, gap = ins - wf / 2;   // domain inset; bold domains get a visible gap
        var P = function (x, y) { return [C[0] + s * (x * co - y * si), C[1] + s * (x * si + y * co)]; };
        var seg = function (p, q, col, wd) { api.line(P(p[0], p[1]), P(q[0], q[1]), {color: col, width: wd || w}); };
        var pill = function (p, q, col) {   // one domain: inset at both ends so the round caps of neighbors stay apart
          var L = Math.hypot(q[0] - p[0], q[1] - p[1]), ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L;
          seg([p[0] + ux * ins, p[1] + uy * ins], [q[0] - ux * ins, q[1] - uy * ins], col);
        };
        var nDom = st > 50 ? 3 : 2, dl = st / nDom, tips = {};
        [-1, 1].forEach(function (sd) {
          var hx = sd * HX, u = [sd * 26, -32], ua = [sd * 0.631, -0.776], n = [sd * 0.776, 0.631];
          var A = function (t, off) { return [hx + u[0] * t + n[0] * off, -h + u[1] * t + n[1] * off]; };
          for (var k = 0; k < nDom; k++) pill([hx, k * dl], [hx, (k + 1) * dl], c.c2);   // CH2, CH3 (and CH4)
          if (h) seg([hx, 0], [hx, -h], c.c2, w * 0.55);                                  // hinge
          pill(A(0, 0), A(0.5, 0), c.c2); pill(A(0.5, 0), A(1, 0), c.c2);                 // CH1, VH
          pill(A(0.06, OFF), A(0.5, OFF), c.c3); pill(A(0.5, OFF), A(1, OFF), c.c3);      // CL, VL
          seg(A(0.1, OFF), A(0.07, 0), c.ink, 1.3);                                       // light-heavy disulfide
          var m = A(1, OFF / 2), d = 5.6 - gap;              // the site between the VH and VL tips; their caps end gap short of m
          tips[sd] = P(m[0] - ua[0] * gap, m[1] - ua[1] * gap);
          if (v.antigen) api.circle(P(m[0] + ua[0] * d, m[1] + ua[1] * d), 5.2 * s, {fill: c.c5, fillOpacity: 0.9});
        });
        (h ? [-h * 0.35, -h * 0.7] : [4]).forEach(function (y) { seg([-HX, y], [HX, y], c.ink, 1.3); }); // heavy-heavy disulfides
        return {P: P, tips: tips, OFF: OFF};
      }
      if (I.units === 1) {
        var U = unit(I.at, 0, I.scale, I.wf), P = U.P, L = function (x, y, txt, col) { api.label(P(x, y), txt, {color: col || c.muted, size: 12.5}); };
        L(30, -h - 13, "Fab", c.ink);                                   // beside the right arm, outside its light chain
        L(12, v.cls === "IgE" ? 44 : 30, "Fc", c.ink);                  // beside the stem
        if (v.cls === "IgD") L(12, -5, "long hinge");
        if (v.cls === "IgE") L(12, 16, "no hinge, 4 C domains");
        if (!v.antigen) {   // a short leader from the label to the left arm's tip, where VH and VL meet
          var t = U.tips[-1], lab = [t[0] - 20, t[1] - 9];
          api.line([lab[0] + 2, lab[1] + 1], [t[0] - 4, t[1] - 3], {color: c.muted, width: 1.2});
          api.label(lab, "binding site", {color: c.muted, size: 12, anchor: "end"});
        }
      } else if (I.units === 2) {
        unit([131, 140], -90, I.scale, I.wf); unit([269, 140], 90, I.scale, I.wf);
        api.path("M 147 128 Q 200 100 253 128", {stroke: c.c6, width: 4});
        api.path("M 194 133 L 200 147 L 206 133", {stroke: c.c4, width: 4});
        api.label([200, 98], "secretory component", {color: c.c6, size: 12, anchor: "middle"});
        api.label([200, 168], "J chain", {color: c.c4, size: 12, anchor: "middle"});
      } else {
        var C0 = [200, 148], r = st * I.scale + 7;
        for (var k = 0; k < 5; k++) {
          var ang = k * 72, rad = ang * Math.PI / 180;
          unit([C0[0] + r * Math.sin(rad), C0[1] - r * Math.cos(rad)], ang, I.scale, I.wf);
        }
        api.circle(C0, 6, {fill: c.c4});
        api.line([200, 160], [200, 258], {color: c.c4, width: 1, dash: "2 3"});
        api.label([200, 270], "J chain", {color: c.c4, size: 12, anchor: "middle"});
      }
      // which chain is which (and the antigen, when bound)
      api.label([12, 254], "heavy chain (" + I.greek + ")", {color: c.c2, size: 12.5, weight: 650});
      api.label([12, 272], "light chain (κ or λ)", {color: c.c3, size: 12.5, weight: 650});
      if (v.antigen) api.label([388, 272], "antigen × " + 2 * I.units, {color: c.c5, size: 12.5, weight: 650, anchor: "end"});
      // viz.css paints every svg label ink (it overrides the fill attribute); keep each label's own color
      api.svg.querySelectorAll("text").forEach(function (t) { t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
