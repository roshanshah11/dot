// Antigenic drift: why a virus that mutates can slip past antibodies made against its older self. Left: one spike protein
// with five epitopes (A to E) and the antibodies a past infection or vaccine raised against them; right: how far
// neutralization falls as mutations pile up. Model (illustrative, not data for any one virus):
//  - mutations arrive in a fixed order, A, (elsewhere), C, E, B, (elsewhere), D, A, (elsewhere), C; a change outside every
//    epitope costs the antibodies nothing;
//  - each change inside an epitope weakens the antibodies against it 10-fold (the loss of one key contact);
//  - a polyclonal response has equal antibody against all five epitopes, so titer = (1/5) sum_e 10^{-m_e}; a monoclonal
//    antibody (one drug) targets only A, so titer = 10^{-m_A}. Fold drop = 1 / titer.
// The 8-fold line is the reduction flu surveillance uses to call a strain antigenically different.
(function () {
  var ORDER = ["A", "-", "C", "E", "B", "-", "D", "A", "-", "C"], SITES = ["A", "B", "C", "D", "E"];
  var ANG = {A: 165, B: 125, C: 90, D: 55, E: 15}, ELSE = [212, 328, 262];   // degrees around the spike head
  function counts(m) { var c = {A: 0, B: 0, C: 0, D: 0, E: 0}; ORDER.slice(0, m).forEach(function (s) { if (s !== "-") c[s]++; }); return c; }
  function titer(m, mono) { var c = counts(m); return mono ? Math.pow(10, -c.A) : SITES.reduce(function (t, s) { return t + Math.pow(10, -c[s]) / 5; }, 0); }
  var fx = function (x) { return Viz.fmt(x, x < 10 ? 2 : 1); };

  Viz.register("viral-mutation-and-antigenic-recognition", {
    title: "Viral mutation and antibody recognition",
    subject: "biology",
    shows: "Add mutations to a viral spike: each change inside an epitope knocks off the antibodies that fit it, a broad (polyclonal) response loses ground slowly, and a single monoclonal antibody can be escaped by one change",
    params: {
      mutations: {kind: "integer", default: 4, min: 0, max: 10, label: "\\text{changes}"},
      antibodies: {kind: "enum", values: ["polyclonal", "monoclonal"], names: {polyclonal: "5 kinds (polyclonal)", monoclonal: "1 kind (monoclonal)"}, default: "polyclonal", label: "\\text{Ab}"}
    },
    formula: function (v) {
      var c = counts(v.mutations), mono = v.antibodies === "monoclonal", t = titer(v.mutations, mono);
      var tail = "=" + Viz.n(t, t < 0.1 ? 3 : 2) + (t < 1 ? "=\\tfrac{1}{" + Viz.n(1 / t, 1 / t < 10 ? 2 : 1) + "}" : "");   // titer as a fraction of the original, same digits as the status
      if (mono) return "\\text{titer}=10^{-m_A},\\ m_A=" + c.A + "\\newline " + tail;
      var g = {}; SITES.forEach(function (s) { g[c[s]] = (g[c[s]] || 0) + 1; });   // group equal terms: 2 x 1 + 3 x 0.1
      var terms = Object.keys(g).sort().map(function (k) { return (g[k] > 1 ? g[k] + "\\cdot " : "") + Viz.n(Math.pow(10, -k), 2); });
      return "\\text{titer}=\\tfrac15\\textstyle\\sum_{e=A}^{E}10^{-m_e}\\newline =\\tfrac15(" + terms.join("+") + ")" + tail;
    },
    status: function (v) {
      var m = v.mutations, c = counts(m), mono = v.antibodies === "monoclonal", drop = 1 / titer(m, mono);
      var hit = SITES.filter(function (s) { return c[s] > 0; }), inEp = ORDER.slice(0, m).filter(function (s) { return s !== "-"; }).length;
      if (!m) return "No mutations yet: every antibody still fits its epitope, so the virus is neutralized at full strength.";
      if (mono) return c.A > 1 ? "Epitope A has now changed twice, so the one antibody is down <b>100×</b>: there is no other site it can fall back on."
        : c.A ? "One change in epitope A is enough: the only antibody loses its grip and neutralization drops <b>10×</b>, which is how variants escape antibody drugs aimed at one site." : "";
      if (drop >= 8) return "All five epitopes have changed (" + inEp + " of " + m + " mutations hit one): neutralization is down <b>" + fx(drop) + "×</b>, past the 8-fold drop flu surveillance uses to flag an antigenically different strain.";
      return m + " mutation" + (m > 1 ? "s" : "") + ", " + inEp + " in epitope" + (hit.length > 1 ? "s " : " ") + hit.join(", ") + ": those antibodies lose their grip, but the other " + (5 - hit.length) +
        " still bind, so neutralization drops only <b>" + fx(drop) + "×</b>.";
    },
    examples: [
      {name: "original virus", values: {mutations: 0}},
      {name: "a change outside the epitopes costs nothing", values: {mutations: 2}},
      {name: "every epitope changed: a drifted strain", values: {mutations: 7}},
      {name: "one change escapes a monoclonal", values: {mutations: 1, antibodies: "monoclonal"}},
      {name: "ten mutations", values: {mutations: 10, antibodies: "monoclonal"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, m = v.mutations, cnt = counts(m), mono = v.antibodies === "monoclonal";
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12}, o || {})); };
      // ---- the spike: head with five epitopes, stalk, viral envelope -----------------------------------------------
      var cx = 112, cy = 118, rx = 60, ry = 46;
      var rim = function (deg) { var a = deg * Math.PI / 180, n = [Math.cos(a) / rx, -Math.sin(a) / ry], l = Math.hypot(n[0], n[1]);
        return {p: [cx + rx * Math.cos(a), cy - ry * Math.sin(a)], n: [n[0] / l, n[1] / l]}; };
      api.rect(14, 236, 200, 12, {fill: c.muted, fillOpacity: 0.25, stroke: c.muted, width: 1, rx: 6});
      L([16, 260], "virus envelope", c.muted);
      api.rect(cx - 8, cy + ry - 4, 16, 236 - (cy + ry - 4), {fill: c.ink, fillOpacity: 0.06, stroke: c.muted, width: 1.2, rx: 3});
      L([cx + 14, 206], "spike protein", c.muted);
      api.path("M " + (cx - rx) + " " + cy + " A " + rx + " " + ry + " 0 1 1 " + (cx + rx) + " " + cy + " A " + rx + " " + ry + " 0 1 1 " + (cx - rx) + " " + cy,
        {fill: c.ink, fillOpacity: 0.06, stroke: c.muted, width: 1.4});
      // mutations elsewhere on the head (grey), then the epitopes with their antibodies
      var k = 0;
      ORDER.slice(0, m).forEach(function (s) { if (s === "-") { var r = rim(ELSE[k++]); api.circle([r.p[0] - r.n[0] * 8, r.p[1] - r.n[1] * 8], 4, {fill: c.muted}); } });
      SITES.forEach(function (s) {
        var r = rim(ANG[s]), p = r.p, n = r.n, t = [-n[1], n[0]];
        api.circle(p, 9.5, {fill: c.c1});
        L([p[0], p[1] + 0.5], s, c.card, {anchor: "middle", weight: 700, clamp: false});
        for (var j = 0; j < cnt[s]; j++) api.circle([p[0] + t[0] * (j ? -9 : 9) + n[0] * 4, p[1] + t[1] * (j ? -9 : 9) + n[1] * 4], 4, {fill: c.c5, stroke: c.card, width: 1.5});
        if (mono && s !== "A") return;
        var lost = cnt[s] > 0, gap = lost ? 22 : 11, tip = [p[0] + n[0] * gap, p[1] + n[1] * gap];
        var F = [tip[0] + n[0] * 12, tip[1] + n[1] * 12], S = [F[0] + n[0] * 19, F[1] + n[1] * 19], o = {color: c.c2, width: 3.2, opacity: lost ? 0.4 : 1, dash: lost ? "3 3" : null};
        api.line(F, S, o);
        api.line(F, [tip[0] + t[0] * 7, tip[1] + t[1] * 7], o);
        api.line(F, [tip[0] - t[0] * 7, tip[1] - t[1] * 7], o);
        if (s === "E") L([S[0] - 6, S[1] - 13], "antibody", c.c2, {anchor: "middle", weight: 600});
        if (s === "A" && mono) L([8, 62], "antibody drug", c.c2, {weight: 600});
      });
      L([16, 278], "●", c.c5, {size: 12}); L([28, 278], "change in an epitope", c.c5);
      L([16, 294], "●", c.muted, {size: 12}); L([28, 294], "change elsewhere", c.muted);
      // ---- neutralization lost as mutations pile up -----------------------------------------------------------------
      var X0 = 262, X1 = 386, YT = 46, YB = 206, ymax = 2;
      var gx = function (i) { return X0 + i / 10 * (X1 - X0); }, gy = function (d) { return YB - Math.log10(d) / ymax * (YB - YT); };
      L([(X0 + X1) / 2, 12], "titer drop (fold)", c.muted, {anchor: "middle"});
      api.line([X0 - 2, 30], [X0 + 14, 30], {color: c.c3, width: 1.5, dash: "5 3"});
      L([X0 + 19, 30], "8×: new variant", c.c3, {weight: 600});
      [1, 10, 100].forEach(function (d) {
        api.line([X0, gy(d)], [X1, gy(d)], {color: d === 1 ? c.axis : c.grid, width: 1});
        L([X0 - 6, gy(d)], d + "×", c.muted, {anchor: "end"});
      });
      api.line([X0, gy(8)], [X1, gy(8)], {color: c.c3, width: 1.5, dash: "6 4"});
      var curve = function (isMono) { var pts = []; for (var i = 0; i <= 10; i++) pts.push([gx(i), gy(1 / titer(i, isMono))]); return pts; };
      api.polyline(curve(!mono), {stroke: c.muted, width: 1.6, dash: "4 4"});
      api.polyline(curve(mono), {stroke: c.c2, width: 2.6});
      L([gx(1) + 4, gy(10) - 13], "1 kind", mono ? c.c2 : c.muted, {weight: mono ? 650 : 500});
      L([gx(5) + 3, gy(1 / titer(5, false)) + 13], "5 kinds", mono ? c.muted : c.c2, {weight: mono ? 500 : 650});
      var d = 1 / titer(m, mono);
      api.circle([gx(m), gy(d)], 5, {fill: c.c2, stroke: c.card, width: 2});
      // each mutation in order: red if it lands in an epitope, grey if elsewhere; hollow until it has happened
      ORDER.forEach(function (s, i) {
        var col = s === "-" ? c.muted : c.c5;
        api.circle([gx(i + 1), YB + 11], 3.6, i < m ? {fill: col} : {stroke: col, width: 1.2});
      });
      [0, 5, 10].forEach(function (i) { L([gx(i), YB + 27], String(i), c.muted, {anchor: "middle"}); });
      L([(X0 + X1) / 2, YB + 43], "mutations", c.muted, {anchor: "middle"});
      // viz.css sets every svg text fill to ink, which overrides the fill attribute: restate each label's color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
