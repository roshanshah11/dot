// Four ways cells signal, sorted by distance, and why distance decides the method. A signal molecule spreads by
// diffusion in a time t = x^2 / (2D); with one round D = 100 um^2/s (a small signal molecule in tissue) that is 2 us
// across a 20 nm synaptic cleft, 50 s across 100 um of tissue, and 5e9 s (about 160 years) across 1 m of body.
// So: contact signaling uses membrane-bound ligands (Delta-Notch) and needs touching cells; synaptic signaling sends
// the message electrically down an axon (up to about 100 m/s) and diffuses only across the cleft; paracrine ligands
// reach cells within roughly 100 um before uptake and breakdown clear them; endocrine hormones ride the blood, which
// goes round the body in about a minute. In every case only a cell with the matching receptor responds.
(function () {
  var D = 100;   // um^2/s
  var MODES = {
    contact: {x: 0, reach: [1e-8, 2e-8], what: "touching cells"},
    synaptic: {x: 0.02, reach: [1e-8, 3e-8], what: "across the cleft"},
    paracrine: {x: 100, reach: [1e-5, 3e-4], what: "nearby cells"},
    endocrine: {x: 1e6, reach: [1e-2, 1], what: "the whole body"}
  };
  function tdiff(x) { return x * x / (2 * D); }   // s, x in um
  function tstr(t) {
    if (t < 1e-3) return Viz.fmt(t * 1e6, 1) + " µs";
    if (t < 1) return Viz.fmt(t * 1e3, 1) + " ms";
    if (t < 600) return Viz.fmt(t, 0) + " s";
    if (t < 86400 * 2) return Viz.fmt(t / 3600, 1) + " h";
    if (t < 3.15e7) return Viz.fmt(t / 86400, 0) + " days";
    return Viz.fmt(Math.round(t / 3.156e7 / 10) * 10, 0) + " years";
  }
  var TEX = {contact: "", synaptic: "(20\\ \\text{nm})^2", paracrine: "(100\\ \\mu\\text{m})^2", endocrine: "(1\\ \\text{m})^2"};
  var STATUS = {
    contact: "Contact signaling: the ligand stays in the signaling cell's own membrane, so only a cell <b>touching</b> it can respond, as in Delta–Notch signaling.",
    synaptic: "The neuron sends the message down its axon electrically, then releases neurotransmitter that crosses the <b>20 nm</b> cleft in about <b>2 µs</b>, reaching only the one cell it synapses on.",
    paracrine: "Paracrine signaling: the ligand diffuses to cells within about <b>100 µm</b>, a trip of about <b>50 s</b>, and is taken up or broken down before it reaches cells much farther away.",
    endocrine: "Diffusing 1 m would take about <b>160 years</b>, so the hormone rides the <b>blood</b>, which reaches every tissue in about a minute, and any cell with its receptor responds."
  };
  Viz.register("cell-communication", {
    title: "How cells signal: by distance",
    subject: "biology",
    shows: "Pick contact, synaptic, paracrine or endocrine signaling: diffusion time grows with distance squared, which is why far signals need blood or an axon, and only cells with the matching receptor respond",
    params: {
      mode: {kind: "enum", values: ["contact", "synaptic", "paracrine", "endocrine"], default: "paracrine", label: "\\text{signal}"},
      receptor: {kind: "boolean", default: true, label: "\\text{target}", on: "has the receptor", off: "no receptor"}
    },
    formula: function (v) {
      if (v.mode === "contact") return "x\\approx 0:\\ \\text{ligand and receptor touch,}\\newline\\text{no diffusion needed}";
      var t = tdiff(MODES[v.mode].x), s = tstr(t).replace(" µs", "\\ \\mu\\text{s}").replace(/ (s|ms|h|days|years)$/, "\\ \\text{$1}");
      return "t\\approx\\frac{x^2}{2D}=\\frac{" + TEX[v.mode] + "}{2\\cdot 100\\ \\mu\\text{m}^2/\\text{s}}\\approx " + s +
        (v.mode === "endocrine" ? "\\newline\\text{so blood carries it: about 1 min}" : v.mode === "synaptic" ? "\\newline\\text{after the axon: up to 100 m/s}" : "");
    },
    status: function (v) {
      if (!v.receptor) return "The " + v.mode + " signal reaches the target, but the target has <b>no matching receptor</b>, so it ignores it: a cell answers only signals it has receptors for.";
      return STATUS[v.mode];
    },
    examples: [
      {name: "contact", values: {mode: "contact"}},
      {name: "synaptic", values: {mode: "synaptic"}},
      {name: "paracrine", values: {mode: "paracrine"}},
      {name: "endocrine", values: {mode: "endocrine"}},
      {name: "endocrine, target lacks the receptor", values: {mode: "endocrine", receptor: false}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = v.mode, rec = v.receptor;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var cell = function (at, r, col, o) { o = o || {}; api.circle(at, r, {stroke: col, width: 2, fill: o.fill || col, fillOpacity: o.fo == null ? 0.08 : o.fo}); };
      var Y = function (at, ang) {   // a receptor: a little Y pointing out of the membrane at angle ang (radians)
        var ux = Math.cos(ang), uy = Math.sin(ang), b = [at[0] + ux * 6, at[1] + uy * 6];
        api.line(at, b, {color: c.c2, width: 2});
        api.line(b, [b[0] + ux * 4 - uy * 3.5, b[1] + uy * 4 + ux * 3.5], {color: c.c2, width: 2});
        api.line(b, [b[0] + ux * 4 + uy * 3.5, b[1] + uy * 4 - ux * 3.5], {color: c.c2, width: 2});
      };
      var target = function (at, r, reached, angs, lab, above) {   // a target cell: responds only if reached and it has receptors
        var yes = reached && rec;
        cell(at, r, c.c2, {fill: yes ? c.c4 : c.c2, fo: yes ? 0.35 : 0.06});
        if (rec) angs.forEach(function (a) { Y([at[0] + r * Math.cos(a), at[1] + r * Math.sin(a)], a); });
        L([at[0], above ? at[1] - r - 10 : at[1] + r + 13], lab || (yes ? "responds" : !reached ? "not reached" : "no receptor"), yes ? c.c4 : c.muted, {anchor: "middle", weight: yes ? 650 : 500});
      };
      var dot = function (at, o) { api.circle(at, 2.6, Object.assign({fill: c.c5}, o || {})); };
      L([200, 12], {contact: "contact (juxtacrine)", synaptic: "synaptic", paracrine: "paracrine (local)", endocrine: "endocrine (hormones)"}[m], c.ink, {anchor: "middle", size: 12.5});
      if (m === "contact") {
        cell([120, 94], 34, c.c3); L([120, 94], "signals", c.c3, {anchor: "middle"});
        [-0.5, 0, 0.5].forEach(function (a) { var p = [120 + 34 * Math.cos(a), 94 + 34 * Math.sin(a)]; api.rect(p[0] - 1, p[1] - 3, 5, 6, {fill: c.c5, rx: 1}); });
        target([188, 94], 34, true, [Math.PI - 0.5, Math.PI, Math.PI + 0.5]);
        target([318, 94], 30, false, [Math.PI - 0.4, Math.PI + 0.4, 0]);
        L([318, 52], "not touching", c.muted, {anchor: "middle", weight: 500});
      } else if (m === "synaptic") {
        cell([44, 62], 20, c.c3); L([44, 94], "neuron", c.c3, {anchor: "middle"});
        api.line([64, 62], [150, 62], {color: c.c3, width: 3}); api.line([170, 62], [262, 62], {color: c.c3, width: 3});
        api.line([152, 70], [160, 54], {color: c.muted, width: 1.6}); api.line([160, 70], [168, 54], {color: c.muted, width: 1.6});
        L([160, 44], "axon, up to 1 m", c.muted, {anchor: "middle", weight: 500});
        api.circle([274, 66], 13, {stroke: c.c3, width: 2, fill: c.c3, fillOpacity: 0.15});
        [[270, 62], [278, 64]].forEach(function (p) { api.circle(p, 3, {stroke: c.c5, width: 1.2}); });
        [[268, 84], [277, 87], [284, 83], [272, 90]].forEach(function (p) { dot(p, {}); });
        target([276, 124], 28, true, [-Math.PI / 2 - 0.3, -Math.PI / 2, -Math.PI / 2 + 0.3]);
        L([318, 84], "20 nm cleft", c.c5, {weight: 500});
        target([130, 126], 24, false, [-1.2, -1.9]);
      } else if (m === "paracrine") {
        cell([86, 100], 26, c.c3); L([86, 100], "signals", c.c3, {anchor: "middle"});
        for (var i = 0; i < 46; i++) {
          var r = 30 - 34 * Math.log(1 - (i + 0.5) / 47), a = i * 2.39996;
          var p = [86 + r * Math.cos(a), 100 + r * Math.sin(a) * 0.8];
          if (p[0] > 10 && p[0] < 390 && p[1] > 26 && p[1] < 158) dot(p, {opacity: Math.max(0.25, 1 - (r - 30) / 140)});
        }
        target([172, 64], 20, true, [Math.PI, Math.PI + 0.6, Math.PI - 0.6], null, true);
        target([184, 130], 20, true, [Math.PI, Math.PI + 0.6, Math.PI - 0.6]);
        target([340, 100], 22, false, [Math.PI, Math.PI + 0.6, Math.PI - 0.6], "too far");
      } else {
        cell([46, 56], 22, c.c3); L([46, 56], "gland", c.c3, {anchor: "middle"});
        api.rect(14, 104, 372, 28, {fill: c.c5, fillOpacity: 0.08, stroke: c.c5, width: 1.2, rx: 14});
        L([24, 146], "blood: round the body in ~1 min", c.c5, {weight: 500});
        api.arrow([46, 80], [52, 100], {color: c.c5, width: 1.8, halo: false, head: 7});
        [60, 92, 130, 170, 236, 268, 304, 344].forEach(function (x, k) { dot([x, 112 + (k % 2) * 12], {}); });
        api.rect(190, 98, 22, 40, {fill: c.card, rx: 0});
        api.line([190, 98], [196, 138], {color: c.muted, width: 1.6}); api.line([206, 98], [212, 138], {color: c.muted, width: 1.6});
        L([201, 88], "≈ 1 m", c.muted, {anchor: "middle", weight: 500});
        target([336, 56], 24, true, [Math.PI / 2, Math.PI / 2 + 0.6, Math.PI / 2 - 0.6]);
      }
      // reach on a log distance axis, with the time diffusion alone would take
      var x0 = 40, x1 = 380, ay = 234, lx = function (meters) { return x0 + (x1 - x0) * (Math.log10(meters) + 8) / 8; };
      L([x0 - 4, 184], "reach (log scale) and time to diffuse that far", c.muted, {weight: 500});
      api.line([x0, ay], [x1, ay], {color: c.axis, width: 1.2});
      [[1e-8, "10 nm"], [1e-6, "1 µm"], [1e-4, "100 µm"], [1e-2, "1 cm"], [1, "1 m"]].forEach(function (t) {
        var X = lx(t[0]);
        api.line([X, ay - 4], [X, ay + 4], {color: c.axis, width: 1.2});
        L([X, ay + 15], t[1], c.muted, {anchor: "middle", weight: 500});
        L([X, ay + 31], tstr(tdiff(t[0] * 1e6)), c.muted, {anchor: "middle", weight: 500, size: 12});
      });
      var R = MODES[m].reach, a0 = lx(R[0]), a1 = Math.max(lx(R[1]), a0 + 8);
      api.rect(a0, ay - 13, a1 - a0, 9, {fill: c.c3, rx: 4});
      if (m === "synaptic") { api.line([a1 + 4, ay - 8.5], [x1, ay - 8.5], {color: c.c3, width: 2, dash: "4 4"}); L([x1, ay - 22], "axon carries it farther", c.c3, {anchor: "end", weight: 500}); }
      L([m === "contact" || m === "synaptic" ? a0 : (a0 + a1) / 2, ay - 22], MODES[m].what, c.c3, {anchor: m === "contact" || m === "synaptic" ? "start" : "middle"});
      L([200, 284], "diffusion time grows as distance²", c.ink, {anchor: "middle", weight: 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
