// The cell-cycle engine: CDK levels stay constant while their cyclin partners rise and fall in turn. Growth factors
// induce cyclin D (CDK4/6 starts phosphorylating Rb); past the restriction point R cyclin E-CDK2 finishes the job, E2F
// is freed and S-phase genes switch on; cyclin A-CDK2 fires origins in S; cyclin B builds up with CDK1 through G2,
// held off by Wee1 until Cdc25 activates it at G2/M; APC/C-Cdc20 destroys cyclin A in prometaphase and securin and
// cyclin B at anaphase, ending mitosis. Levels are schematic (relative), on a 24 h cycle (G1 11, S 8, G2 4, M 1 h;
// R at 8.5 h); M is drawn three times wider than its hour so its events can be seen. No growth factor: no cyclin D,
// the cell stops before R (G0). APC/C blocked: cyclins A and B are never destroyed and the cell sits in metaphase.
(function () {
  var R = 8.5, G1E = 11, SE = 19, G2E = 23;
  var ss = function (a, b, t) { var x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
  function levels(t, gf, apc) {
    if (!gf) return {D: 0.08, E: 0, A: 0, B: 0};
    return {D: 0.2 + 0.5 * ss(0, 4, t), E: Math.exp(-Math.pow((t - 11) / (t < 11 ? 1.9 : 1.3), 2)),
            A: ss(11, 15, t) * 0.85 * (apc ? 1 - ss(23.15, 23.35, t) : 1), B: ss(16, 22.8, t) * (apc ? 1 - ss(23.7, 23.85, t) : 1)};
  }
  function where(v) {   // the moment the cell has reached, and what is driving it
    if (!v.gf) return {t: Math.min(v.t, R), k: "nogf"};
    if (!v.apc && v.t >= 23.7) return {t: 23.7, k: "noapc"};
    var t = v.t, m = t - G2E;
    return {t: t, k: t < R ? "g1" : t < G1E ? "r" : t < SE ? "s" : t < G2E ? "g2" : m < 0.7 ? "m" : "ana"};
  }
  var INFO = {
    g1: ["cyclin D–CDK4/6", "starts phosphorylating Rb", "\\text{cyclin D–CDK4/6}\\to\\text{Rb–P (partial)}",
         "Early G₁: growth factors keep <b>cyclin D–CDK4/6</b> working, which starts phosphorylating Rb, but the cell has not yet passed the <b>restriction point</b>."],
    r: ["cyclin E–CDK2", "Rb fully phosphorylated: E2F free", "\\text{cyclin E–CDK2}\\to\\text{Rb–PPP}\\newline\\Rightarrow\\text{E2F free}\\to\\text{S-phase genes}",
        "Past the restriction point: <b>cyclin E–CDK2</b> finishes phosphorylating Rb, so <b>E2F</b> is freed and switches on S-phase genes, more cyclin E among them."],
    s: ["cyclin A–CDK2", "fires origins, each only once", "\\text{cyclin A–CDK2}\\newline\\to\\text{origins fire, each once}",
        "S phase: <b>cyclin A–CDK2</b> fires replication origins, each only once, while cyclin E is destroyed."],
    g2: ["cyclin B–CDK1, held off", "Wee1 keeps it off until Cdc25 acts", "\\text{Wee1}\\dashv\\text{cyclin B–CDK1}\\newline\\text{until Cdc25 turns it on at G}_2/\\text{M}",
         "G₂: <b>cyclin B</b> piles up with CDK1, but Wee1 keeps the pair switched off until <b>Cdc25</b> turns it on at the G₂/M transition."],
    m: ["cyclin B–CDK1 (MPF)", "condenses, breaks the envelope, builds spindle", "\\text{active cyclin B–CDK1}\\to\\text{mitosis}",
        "Mitosis: active <b>cyclin B–CDK1</b> condenses the chromosomes, breaks down the nuclear envelope and builds the spindle."],
    ana: ["APC/C–Cdc20", "destroys securin and cyclin B", "\\text{APC/C–Cdc20}\\newline\\to\\text{securin, cyclin B destroyed}",
          "<b>APC/C–Cdc20</b> marks securin and cyclin B for destruction: sisters separate, CDK1 activity collapses and the cell leaves mitosis."],
    nogf: ["no cyclin D", "Rb keeps E2F locked: stops before R", "\\text{no growth factor}\\Rightarrow\\text{no cyclin D}\\newline\\Rightarrow\\text{Rb holds E2F}",
           "With no growth factors there is no <b>cyclin D</b>, so Rb keeps E2F locked up: the cell never passes the restriction point and rests in <b>G₀</b>."],
    noapc: ["APC/C blocked", "cyclin B stays: stuck in metaphase", "\\text{APC/C blocked}\\Rightarrow\\text{cyclin B stays}\\newline\\Rightarrow\\text{no anaphase}",
            "With <b>APC/C blocked</b>, securin and cyclin B are never destroyed, so the cell sits in <b>metaphase</b> with CDK1 still on."]
  };
  Viz.register("cell-cycle-and-regulation", {
    title: "Cyclins and CDKs drive the cycle",
    subject: "biology",
    shows: "Slide through the cycle: CDK levels stay flat while cyclins D, E, A and B rise and fall in turn, each switching on the next step; remove growth factors or block APC/C to see where the cycle stops",
    params: {
      t: {kind: "number", default: 10, min: 0, max: 24, step: 0.1, label: "t\\ (\\text{h})"},
      gf: {kind: "boolean", default: true, label: "\\text{signals}", on: "growth factors", off: "none"},
      apc: {kind: "boolean", default: true, label: "\\text{APC/C}", on: "working", off: "blocked"}
    },
    formula: function (v) { return INFO[where(v).k][2]; },
    status: function (v) { return INFO[where(v).k][3]; },
    examples: [
      {name: "start of G1", values: {t: 0}},
      {name: "end of mitosis", values: {t: 24}},
      {name: "restriction point passed", values: {t: 10}},
      {name: "S phase", values: {t: 15}},
      {name: "G2", values: {t: 21}},
      {name: "metaphase", values: {t: 23.5}},
      {name: "anaphase", values: {t: 23.8}},
      {name: "no growth factors", values: {t: 15, gf: false}},
      {name: "APC/C blocked", values: {t: 24, apc: false}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, w = where(v);
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var x0 = 34, x1 = 390, u = function (t) { return t <= G2E ? t : G2E + (t - G2E) * 3; };
      var X = function (t) { return x0 + (x1 - x0) * u(t) / 26; };
      // phase bar with the restriction point
      var PH = [["G₁", 0, G1E], ["S", G1E, SE], ["G₂", SE, G2E], ["M", G2E, 24]];
      PH.forEach(function (p, i) {
        var here = w.t >= p[1] && (w.t < p[2] || (i === 3 && w.t <= 24));
        api.rect(X(p[1]) + 1, 24, X(p[2]) - X(p[1]) - 2, 18, {fill: c.ink, fillOpacity: here ? 0.18 : 0.06, rx: 4});
        L([(X(p[1]) + X(p[2])) / 2, 33], p[0], here ? c.ink : c.muted, {anchor: "middle", weight: here ? 700 : 500});
      });
      api.line([X(R), 20], [X(R), 46], {color: c.c4, width: 2});
      L([X(R), 12], "R", c.c4, {anchor: "middle", weight: 700});
      // cyclin levels against time; CDK level is flat
      var gy0 = 196, Y = function (l) { return gy0 - 108 * l; };
      api.line([x0, gy0], [x1, gy0], {color: c.axis, width: 1.2});
      api.line([x0, 68], [x1, 68], {color: c.muted, width: 1.4, dash: "5 4"});
      L([x0 + 2, 58], "CDK level: constant", c.muted, {weight: 500});
      var CY = [["D", c.c4, 3.2, 0.7, "middle"], ["E", c.c3, 9.6, 0.95, "end"], ["A", c.c2, 15.8, 0.85, "middle"], ["B", c.c5, 21.6, 0.93, "middle"]];
      var curve = function (key, gf, apc) { var pts = []; for (var t = 0; t <= 24.0001; t += (t < 23 ? 0.1 : 0.02)) pts.push([X(t), Y(levels(t, gf, apc)[key])]); return pts; };
      CY.forEach(function (cy) {
        if (!v.gf || !v.apc) api.polyline(curve(cy[0], true, true), {stroke: cy[1], width: 1.4, dash: "3 4", opacity: 0.45});
        api.polyline(curve(cy[0], v.gf, v.apc), {stroke: cy[1], width: 2.4});
        L([X(cy[2]) - (cy[4] === "end" ? 4 : 0), Y(cy[3]) - (cy[4] === "end" ? 0 : 10)], "cyclin " + cy[0], cy[1], {anchor: cy[4], weight: 650});
      });
      // where the cell is now
      api.line([X(w.t), 46], [X(w.t), gy0], {color: c.accent, width: 1.4, dash: "3 3"});
      var now = levels(w.t, v.gf, v.apc);
      CY.forEach(function (cy) { if (now[cy[0]] > 0.02) api.circle([X(w.t), Y(now[cy[0]])], 3.6, {fill: cy[1]}); });
      api.circle([X(w.t), 46], 4.5, {fill: c.accent, stroke: c.card, width: 1.5});
      [0, 6, 12, 18, 23, 24].forEach(function (h) { L([X(h), gy0 + 13], String(h), c.muted, {anchor: "middle", weight: 500}); });
      L([x1, gy0 + 27], "hours (M drawn 3× wider)", c.muted, {anchor: "end", weight: 500});
      // the driver right now
      var info = INFO[w.k], stop = w.k === "nogf" || w.k === "noapc";
      api.rect(x0, 240, x1 - x0, 50, {fill: stop ? c.c5 : c.ink, fillOpacity: stop ? 0.1 : 0.04, stroke: stop ? c.c5 : c.faint, width: 1.2, rx: 8});
      L([x0 + 12, 256], info[0], stop ? c.c5 : ({g1: c.c4, r: c.c3, s: c.c2, g2: c.c5, m: c.c5, ana: c.c6})[w.k], {size: 13, weight: 700});
      L([x0 + 12, 275], info[1], c.ink, {weight: 500});
      if (stop) L([x1 - 10, 256], w.k === "nogf" ? "stopped in G₁ → G₀" : "stopped in metaphase", c.c5, {anchor: "end", weight: 650});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
