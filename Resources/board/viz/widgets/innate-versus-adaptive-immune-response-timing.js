// When each arm of immunity acts during an infection, first exposure versus re-exposure. Schematic model (shapes and
// timing are the textbook ones; magnitudes are relative, not measured):
//   pathogen  dP/dt = r P (1 - P) - (kI I + kA A) P,   r = 2.5 /day, kI = 1.6, kA = 6, P(0) = 0.001 (P = share of max load)
//   innate    dI/dt = (P / (P + 0.02) - I) / 0.3 day: it switches on within hours of sensing the microbe and fades
//             once the microbe is gone; the rule is identical on re-exposure (no memory).
//   adaptive  A(t) prescribed: first exposure lag 4 d, peak 1 at day 11 (rise x^2 e^(2(1-x)), decay e^(-(t-11)/6));
//             re-exposure (memory cells) lag 1 d, peak 2.5 at day 5, slower decay e^(-(t-5)/12).
// Innate killing alone (kI < r) slows the microbe but cannot clear it; the adaptive response clears it. Euler, dt = 0.01 d;
// P below 1e-6 counts as eliminated (set to 0), so it cannot regrow once the adaptive response wanes.
(function () {
  var DT = 0.01, TMAX = 21;
  function adapt(t, sec) {
    var L = sec ? 1 : 4, Pk = sec ? 5 : 11, h = sec ? 2.5 : 1, td = sec ? 12 : 6;
    if (t <= L) return 0;
    if (t <= Pk) { var x = (t - L) / (Pk - L); return h * x * x * Math.exp(2 * (1 - x)); }
    return h * Math.exp(-(t - Pk) / td);
  }
  var cache = {};
  function run(sec) {
    if (cache[sec]) return cache[sec];
    var P = 0.001, I = 0, out = [];
    for (var i = 0; i <= TMAX / DT; i++) {
      var t = i * DT, A = adapt(t, sec);
      out.push({t: t, P: P, I: I, A: A});
      var dP = 2.5 * P * (1 - P) - (1.6 * I + 6 * A) * P, dI = (P / (P + 0.02) - I) / 0.3;
      P = P + dP * DT; if (P < 1e-6) P = 0; I += dI * DT;   // below one organism in a million of the max load: eliminated
    }
    var pk = out.reduce(function (m, d) { return d.P > m.P ? d : m; }, out[0]);
    var clear = out.filter(function (d) { return d.t > pk.t && d.P === 0; })[0];
    return (cache[sec] = {pts: out, peak: pk, clear: clear ? clear.t : TMAX});
  }
  function at(v) { return run(v.exposure === "second").pts[Math.round(v.day / DT)]; }
  var pc = function (x) { return Math.round(x * 100); };
  Viz.register("innate-versus-adaptive-immune-response-timing", {
    title: "Innate versus adaptive: who acts when",
    subject: "biology",
    shows: "Scrub through an infection day by day: the innate response starts within hours and holds the microbe back, the adaptive response needs days to expand but clears it, and on a second exposure memory cells cut that lag to a day or two",
    params: {
      day: {kind: "number", default: 3, min: 0, max: 21, step: 0.5, label: "t\\ (\\text{days})"},
      exposure: {kind: "enum", values: ["first", "second"], default: "first", label: "\\text{exposure}"}
    },
    formula: function (v) {
      var s = at(v);
      return "\\tfrac{dP}{dt}=rP(1-P)-(k_I I+k_A A)\\,P\\newline I=" + s.I.toFixed(2) + ",\\ A=" + s.A.toFixed(2) + ",\\ P=" + s.P.toFixed(3);
    },
    status: function (v) {
      var sec = v.exposure === "second", R = run(sec), F = run(false), s = at(v), d = Viz.fmt(v.day);
      if (v.day < 0.5) return "Hours in: complement, macrophages and neutrophils already act on the microbe" + (sec ? ", exactly as fast as the first time, since innate immunity has no memory." : "; no T or B cell specific to it is active yet.");
      if (s.A < 0.05) return (sec ? "Second exposure, day " : "Day ") + d + ": the innate response (<b>" + pc(s.I) + "%</b> of full) is " + (s.I < 0.5 ? "switching on" : "holding the microbe back") + " while " + (sec ? "memory T and B cells reactivate." : "the rare matching T and B cells are still being activated and multiplied.");
      if (sec && v.day > R.clear + 2) return "Second exposure: the microbe peaked at only <b>" + pc(R.peak.P / F.peak.P) + "%</b> of the first infection's load and was gone by day " + Viz.fmt(R.clear, 0) + "; the memory response, still <b>" + Viz.fmt(s.A, 1) + "×</b> the first peak on day " + d + ", fades slowly.";
      if (sec) return "Second exposure, day " + d + ": memory cells push the adaptive response to <b>" + Viz.fmt(s.A, 1) + "×</b> the first peak, so the microbe peaks at only <b>" + pc(R.peak.P / F.peak.P) + "%</b> of the first infection's load and is gone by day " + Viz.fmt(R.clear, 0) + ".";
      if (v.day < R.clear) { var y = s.P / R.peak.P; return "Day " + d + ": the adaptive response (T cells, antibodies) is at <b>" + pc(s.A) + "%</b> of its peak; the microbe is at <b>" + (y < 0.005 ? "under 1%" : pc(y) + "%") + "</b> of its peak load and " + (v.day < R.peak.t ? "still rising." : "falling."); }
      return "Day " + d + ": the microbe was cleared by day " + Viz.fmt(R.clear, 0) + "; innate activity has died away (" + pc(s.I) + "%) while the adaptive response (<b>" + pc(s.A) + "%</b>) contracts, leaving memory cells behind.";
    },
    examples: [
      {name: "first hours", values: {day: 0}},
      {name: "end of the window", values: {day: 21, exposure: "second"}},
      {name: "innate holds the line", values: {day: 3}},
      {name: "adaptive clears it", values: {day: 8}},
      {name: "memory: cleared fast", values: {day: 3, exposure: "second"}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, sec = v.exposure === "second", R = run(sec), F = run(false), s = at(v), pts = R.pts;
      var X0 = 46, X1 = 386, X = function (t) { return X0 + t / TMAX * (X1 - X0); };
      var thin = function (arr) { return arr.filter(function (d, i) { return i % 10 === 0; }); };
      // top strip: pathogen load on the scale of the first infection's peak
      var pT = 30, pB = 82, pS = (pB - pT) / F.peak.P, pY = function (P) { return pB - P * pS; };
      api.label([X0, 16], "microbe load", {color: c.c5, size: 12, weight: 600});
      api.line([X0, pB], [X1, pB], {color: c.axis, width: 1.2});
      var area = thin(pts).map(function (d) { return [X(d.t), pY(d.P)]; });
      api.polygon([[X(0), pB]].concat(area, [[X(TMAX), pB]]), {fill: c.c5, fillOpacity: 0.3, stroke: c.c5, width: 1.6});
      if (sec) api.polyline(thin(F.pts).map(function (d) { return [X(d.t), pY(d.P)]; }), {stroke: c.c5, width: 1.4, dash: "4 4", opacity: 0.7});
      api.label([X(F.peak.t) + 10, pT + 4], sec ? "dashed: first infection" : "peak day " + Viz.fmt(R.peak.t, 0), {color: c.c5, size: 12});
      // main plot: responses
      var top = 112, bot = 262, yMax = sec ? 2.7 : 1.15, Y = function (q) { return bot - q / yMax * (bot - top); };
      var lag = sec ? 1 : 4;
      api.rect(X(0), top, X(lag) - X(0), bot - top, {fill: c.c2, fillOpacity: 0.08, rx: 0});
      api.label([X1, 98], "shaded: adaptive lag, " + lag + (lag > 1 ? " days" : " day"), {color: c.c2, size: 12, anchor: "end"});
      api.label([X0, 98], "immune response", {color: c.muted, size: 12});
      api.line([X0, bot], [X1, bot], {color: c.axis, width: 1.2}); api.line([X0, bot], [X0, top - 4], {color: c.axis, width: 1.2});
      (sec ? [0, 1, 2] : [0, 1]).forEach(function (q) { api.label([X0 - 6, Y(q)], q ? q + "×" : "0", {color: c.muted, size: 12, anchor: "end"}); });
      if (sec) api.polyline(thin(F.pts).map(function (d) { return [X(d.t), Y(d.A)]; }), {stroke: c.c2, width: 1.6, dash: "5 4", opacity: 0.6});
      api.polyline(thin(pts).map(function (d) { return [X(d.t), Y(d.I)]; }), {stroke: c.c1, width: 2.6});
      api.polyline(thin(pts).map(function (d) { return [X(d.t), Y(d.A)]; }), {stroke: c.c2, width: 2.6});
      var iPk = pts.reduce(function (m, d) { return d.I > m.I ? d : m; }, pts[0]);
      api.label([X(iPk.t) + 6, Y(iPk.I) - 10], "innate", {color: c.c1, size: 12.5, weight: 700});
      var aPk = sec ? 5 : 11;
      api.label([X(aPk) + 8, Y(adapt(aPk, sec)) - 8], sec ? "adaptive (memory)" : "adaptive", {color: c.c2, size: 12.5, weight: 700});
      if (sec) api.label([X(11) + 8, Y(1) - 8], "first time", {color: c.c2, size: 12});
      [0, 7, 14, 21].forEach(function (q) { api.label([X(q), bot + 14], q === 21 ? "21 days" : String(q), {color: c.muted, size: 12, anchor: q === 21 ? "end" : "middle"}); });
      // cursor
      api.line([X(v.day), pT - 4], [X(v.day), bot], {color: c.ink, width: 1.2, dash: "3 3"});
      api.point([X(v.day), pY(s.P)], {color: c.c5, r: 4});
      api.point([X(v.day), Y(s.I)], {color: c.c1, r: 4});
      api.point([X(v.day), Y(s.A)], {color: c.c2, r: 4});
      api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints svg text ink
    }
  });
})();
