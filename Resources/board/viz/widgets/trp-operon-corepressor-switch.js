// The trp operon as a repressible switch. Tryptophan is the corepressor: two Trp bind each TrpR dimer, the loaded
// repressor grips the operator (which overlaps the promoter) and RNA polymerase can no longer start the trpEDCBA mRNA.
// Model, kept simple and stated: each dimer has two independent Trp sites with K_d = 16 µM (equilibrium dialysis,
// Joachimiak et al. 1983, PNAS 80:668; later reports run up to ~60 µM); only a dimer with both sites filled binds the
// operator, so the active fraction is f = θ²; the operator follows a one-site equilibrium sized so a fully loaded
// repressor pool cuts initiation 70-fold (the textbook repression factor). Initiation = 1 / (1 + 69 f).
// Half off is where 69 f = 1, at about 2.2 µM: well below K_d, because the repressor pool is in excess.
// Attenuation (about 10-fold more, acting after initiation) is a separate control and is not modelled here.
// Trp levels are a 1-2-5 ladder (an enum) because the switch lives on a log scale and the framework's sliders are linear.
(function () {
  var KD = 16, RHO = 69, LEVELS = ["0", "0.5", "1", "2", "5", "10", "20", "50", "100"];
  var TH_HALF = 1 / Math.sqrt(RHO), C_HALF = KD * TH_HALF / (1 - TH_HALF);   // 69 f = 1  ->  c ≈ 2.19 µM
  function model(v) {
    var c = Number(v.trp), th = c / (c + KD), loaded = th * th;
    var f = v.strain === "trpR-" ? 0 : loaded;
    var occ = v.strain === "wild type" ? RHO * f / (1 + RHO * f) : 0;   // chance the operator is occupied
    return {c: c, loaded: loaded, f: f, occ: occ, rate: 1 - occ};
  }
  function sig(x) { return x === 0 ? "0" : String(Number(x.toPrecision(2))); }
  function pc(x) { return x > 0.9995 ? "100" : Viz.fmt(x * 100, 1); }
  function wiggle(a, len, ang) { // a transcript: a wavy strand hanging from the polymerase
    var pts = [], ux = Math.cos(ang), uy = Math.sin(ang);
    for (var s = 0; s <= len; s += 2) { var w = 1.8 * Math.sin(s / 2.2); pts.push([a[0] + ux * s - uy * w, a[1] + uy * s + ux * w]); }
    return pts;
  }
  // an SVG label with ^{..} raised and _{..} lowered as tspans (U+1D9C floats loose, and Unicode has no subscript d)
  function scripted(api, at, s, o) {
    var t = api.label(at, s.replace(/[_^]\{([^}]*)\}/g, "$1"), Object.assign({raw: true}, o)), lift = 0;
    t.textContent = "";
    s.split(/([_^]\{[^}]*\})/).forEach(function (part) {
      if (!part) return;
      var ts = document.createElementNS("http://www.w3.org/2000/svg", "tspan"), k = /^[_^]\{/.test(part) ? (part.charAt(0) === "^" ? -5 : 3) : 0;
      ts.textContent = k ? part.slice(2, -1) : part;
      if (k !== lift) ts.setAttribute("dy", k - lift);
      if (k) ts.setAttribute("font-size", 11.8);
      lift = k; t.appendChild(ts);
    });
    return t;
  }

  Viz.register("trp-operon-corepressor-switch", {
    title: "trp operon: tryptophan as corepressor",
    subject: "biology",
    shows: "Raise the tryptophan: Trp loads the repressor, the loaded repressor sits on the operator and RNA polymerase is shut out; trpR⁻ and Oc mutants stay on",
    params: {
      trp: {kind: "enum", values: LEVELS, default: "20", label: "[\\text{Trp}]\\ \\mu\\text{M}"},
      strain: {kind: "enum", values: ["wild type", "trpR-", "Oc"], names: {"wild type": "wild type", "trpR-": "trpR⁻", "Oc": "Oc"}, default: "wild type", label: "strain"}
    },
    formula: function (v) {
      var m = model(v), frac = "\\left(\\frac{" + m.c + "}{" + m.c + "+16}\\right)^{2}=" + sig(m.loaded);
      if (v.strain === "trpR-") return "\\begin{array}{l}\\text{no repressor: } f=0\\\\ \\text{initiation}=\\frac{1}{1+69\\cdot 0}=100\\%\\end{array}";
      if (v.strain === "Oc") return "\\begin{array}{l}f=" + frac + "\\\\ \\text{O}^{c}\\text{ ignores } f\\text{: initiation}=100\\%\\end{array}";
      return "\\begin{array}{l}f=\\left(\\frac{[\\text{Trp}]}{[\\text{Trp}]+K_d}\\right)^{2}=" + frac +
        "\\\\ \\text{initiation}=\\frac{1}{1+69f}=" + pc(m.rate) + "\\%\\end{array}";
    },
    status: function (v) {
      var m = model(v);
      // the status sanitizer keeps only <b>, so K_d and Oᶜ are written Kd and Oc here
      if (v.strain === "trpR-") return "<b>trpR⁻</b>: no repressor is made, so RNA polymerase starts the operon at <b>100%</b> whatever the tryptophan.";
      if (v.strain === "Oc") return "<b>Oc</b> (operator-constitutive): " + (m.c ? sig(m.loaded * 100) + "% of repressors are loaded with Trp but none can grip the mutant operator" : "the repressor is empty anyway, and could not grip the mutant operator") + ", so initiation stays at <b>100%</b>.";
      if (!m.c) return "No tryptophan: every repressor is an empty aporepressor that cannot bind the operator, so the trp genes run at <b>100%</b>.";
      if (m.occ < 0.5) return "Little tryptophan: only <b>" + sig(m.f * 100) + "%</b> of repressors are loaded, so the operator is mostly free and initiation runs at <b>" + pc(m.rate) + "%</b>.";
      return "Tryptophan is up: <b>" + sig(m.f * 100) + "%</b> of repressors are loaded, holding the operator " + Math.round(m.occ * 100) + "% of the time and cutting initiation to <b>" + pc(m.rate) + "%</b> (" + Viz.fmt(1 / m.rate, 0) + "-fold off); the switch sits at " +
        Viz.fmt(C_HALF, 1) + " µM, about " + Math.round(KD / C_HALF) + "× below Kd, because repressor is plentiful and loading 1 in " + RHO + " already holds the operator half the time.";
    },
    examples: [
      {name: "no tryptophan", values: {trp: "0", strain: "wild type"}},
      {name: "near the switch point", values: {trp: "2", strain: "wild type"}},
      {name: "excess tryptophan", values: {trp: "100", strain: "wild type"}},
      {name: "trpR⁻ in excess Trp", values: {trp: "100", strain: "trpR-"}},
      {name: "Oc in excess Trp", values: {trp: "100", strain: "Oc"}}
    ],
    size: [400, 310],
    draw: function (api, v) {
      var c = api.color, m = model(v), dnaY = 98, idx = LEVELS.indexOf(v.trp), wild = v.strain === "wild type";
      // ---- the operon on the chromosome ----
      api.line([10, dnaY], [392, dnaY], {color: c.muted, width: 3});
      api.rect(20, dnaY - 8, 52, 16, {fill: c.c4, fillOpacity: 0.14, stroke: c.c4, width: 1.3, rx: 3});
      var oBad = v.strain === "Oc";
      api.rect(52, dnaY - 8, 30, 16, {fill: oBad ? c.c5 : c.c6, fillOpacity: 0.2, stroke: oBad ? c.c5 : c.c6, width: 1.6, rx: 3});
      api.label([34, dnaY + 18], "P", {color: c.c4, size: 12.5, weight: 650, anchor: "middle"});
      scripted(api, [67, dnaY + 18], oBad ? "O^{c}" : "O", {color: oBad ? c.c5 : c.c6, size: 12.5, weight: 650, anchor: "middle"});
      ["E", "D", "C", "B", "A"].forEach(function (g, i) {
        var x = 90 + i * 60;
        api.rect(x, dnaY - 9, 56, 18, {fill: c.c2, fillOpacity: 0.2, stroke: c.c2, width: 1.2, rx: 3});
        api.label([x + 28, dnaY - 20], "trp" + g, {color: c.c2, size: 12, anchor: "middle", italic: true});
      });
      // ---- trpR, a separate gene that makes the repressor (the chromosome stops at the box, so the name is not struck) ----
      api.line([17, 16], [24, 16], {color: c.muted, width: 2}); api.line([78, 16], [100, 16], {color: c.muted, width: 2});
      api.label([10, 16], "//", {color: c.muted, size: 12, anchor: "middle"});
      api.rect(24, 8, 54, 16, {fill: c.c6, fillOpacity: 0.16, stroke: v.strain === "trpR-" ? c.c5 : c.c6, width: 1.3, rx: 3});
      api.label([51, 16], v.strain === "trpR-" ? "trpR⁻" : "trpR", {color: v.strain === "trpR-" ? c.c5 : c.c6, size: 12, anchor: "middle", italic: true, raw: true});
      api.label([106, 16], v.strain === "trpR-" ? "broken: no repressor" : "separate repressor gene", {color: v.strain === "trpR-" ? c.c5 : c.muted, size: 12});
      if (v.strain === "trpR-") { api.line([28, 6], [74, 26], {color: c.c5, width: 2}); api.line([28, 26], [74, 6], {color: c.c5, width: 2}); }
      // ---- the tryptophan pool (the dots are a picture of the level, one more ladder step = more dots), right of every caption ----
      var nDots = [0, 1, 2, 3, 5, 7, 9, 12, 15][idx];
      var spots = [[316, 46], [362, 36], [282, 58], [344, 62], [384, 48], [298, 32], [256, 44], [372, 64], [334, 30], [262, 62], [304, 64], [354, 48], [278, 36], [334, 48], [388, 30]];
      for (var d = 0; d < nDots; d++) api.circle(spots[d], 3.5, {fill: c.c3});
      api.label([390, 16], m.c ? "Trp " + m.c + " µM" : "no Trp", {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
      // ---- the repressor dimer: on the operator, or free ----
      var bound = m.occ >= 0.5, hasRep = v.strain !== "trpR-";
      var dimer = function (cx, cy, loaded) {
        [-8, 8].forEach(function (dx) {
          api.circle([cx + dx, cy], 9, loaded ? {fill: c.c6, fillOpacity: 0.85} : {fill: c.c6, fillOpacity: 0.08, stroke: c.c6, width: 1.6, dash: "3 2"});
          if (loaded) api.circle([cx + dx, cy - 4], 3.5, {fill: c.c3});
        });
      };
      if (hasRep) {
        var rep = bound ? [67, dnaY - 18] : [62, 50], loadedPic = bound || (m.c > 0 && m.loaded >= 0.5);
        api.line([51, 25], [rep[0] - 4, rep[1] - 12], {color: c.c6, width: 1.4, dash: "3 3", arrow: true, opacity: 0.8});
        dimer(rep[0], rep[1], loadedPic);
        if (bound) api.label([14, 134], "repressor + 2 Trp holds O", {color: c.c6, size: 12, raw: true});
        else {
          var two = !m.c ? ["aporepressor (no Trp)", "can't bind O"] : oBad ? [sig(m.loaded * 100) + "% loaded with Trp", "but can't grip O^{c}"] :
            [sig(m.f * 100) + "% loaded with Trp", "on O " + Math.round(m.occ * 100) + "% of the time"];
          api.label([84, 42], two[0], {color: c.c6, size: 12, raw: true});
          scripted(api, [84, 59], two[1], {color: c.c6, size: 12});
        }
      }
      // ---- RNA polymerase: shut out, or starting and transcribing ----
      var pol = function (x, y) { api.path("M " + (x - 13) + " " + y + " a 13 10 0 1 0 26 0 a 13 10 0 1 0 -26 0", {fill: c.c4, fillOpacity: 0.85, stroke: c.c4, width: 1}); };
      if (bound) {
        pol(30, 64);
        api.line([24, 78], [36, 88], {color: c.c5, width: 2}); api.line([36, 78], [24, 88], {color: c.c5, width: 2});
        api.label([14, 150], "RNA polymerase shut out", {color: c.c4, size: 12});   // under the repressor caption, clear of the gene names
      } else {
        pol(42, dnaY);
        api.label([14, 134], "RNA polymerase on P", {color: c.c4, size: 12});
      }
      var n = Math.round(4 * m.rate);
      for (var k = 0; k < n; k++) {
        var x = 90 + (k + 0.5) * 300 / n, len = Math.min(8 + (x - 90) * 0.085, 30);   // tails stop above y ≈ 136, clear of their label
        api.polyline(wiggle([x - 4, dnaY + 9], len, 2.0), {stroke: c.c1, width: 1.7});
        pol(x, dnaY);
      }
      if (n) api.label([388, 148], n === 1 ? "an occasional mRNA" : "trpEDCBA mRNA", {color: c.c1, size: 12, anchor: "end"});
      // ---- the dose response: initiation against tryptophan, log scale ----
      var X0 = 62, xa = 84, xb = 384, lo = Math.log10(0.25), hi = 2, yT = 190, yB = 266, yTop = 178;
      var xp = function (q) { return q <= 0 ? X0 : xa + (Math.log10(q) - lo) / (hi - lo) * (xb - xa); };
      var yp = function (r) { return yB - r * (yB - yT); };
      var wt = function (q) { var th = q / (q + KD); return 1 / (1 + RHO * th * th); };
      var boxes = [], vlines = [], pts = [];   // what the point's label must stay clear of
      api.label([X0 - 6, yTop], "initiation", {color: c.muted, size: 12}); boxes.push([X0 - 6, yTop - 7, X0 + 58, yTop + 7]);
      api.line([X0 - 6, yB], [xb + 4, yB], {color: c.axis, width: 1.2});
      api.line([X0 - 6, yT - 4], [X0 - 6, yB], {color: c.axis, width: 1.2});
      api.line([71, yB + 4], [75, yB - 4], {color: c.axis, width: 1.2}); api.line([76, yB + 4], [80, yB - 4], {color: c.axis, width: 1.2});
      [[1, "100%"], [0.5, "50%"], [0, "0"]].forEach(function (t) {
        api.label([X0 - 10, yp(t[0])], t[1], {color: c.muted, size: 12, anchor: "end"});
        if (t[0]) { api.line([X0 - 6, yp(t[0])], [xb, yp(t[0])], {color: c.grid, width: 1}); for (var gx = X0; gx <= xb; gx += 5) pts.push([gx, yp(t[0])]); }
      });
      [[0, "0"], [1, "1"], [10, "10"], [100, "100"]].forEach(function (t) { api.label([xp(t[0]), yB + 13], t[1], {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([(xa + xb) / 2, yB + 30], "tryptophan, µM (log scale)", {color: c.muted, size: 12, anchor: "middle"});
      // K_d marks where half the Trp sites are filled; it is not the switch point, which is marked separately below
      var xK = xp(KD);
      api.line([xK, yTop + 7], [xK, yB], {color: c.c3, width: 1, dash: "3 3", opacity: 0.7}); vlines.push(xK);
      scripted(api, [xK, yTop], "K_{d} = 16 µM", {color: c.c3, size: 12.5, anchor: "middle"}); boxes.push([xK - 36, yTop - 7, xK + 36, yTop + 7]);
      var curve = [];
      for (var s = 0; s <= 90; s++) { var q = Math.pow(10, lo + (hi - lo) * s / 90); curve.push([xp(q), yp(wt(q))]); }
      pts = pts.concat(curve);
      if (wild) {
        api.line([X0, yp(1)], curve[0], {color: c.c1, width: 2.2, dash: "2 3"});
        api.polyline(curve, {stroke: c.c1, width: 2.4});
        // the real switch: half off where 69 f = 1, about 7x below K_d (ring on the curve, leader up to its label)
        var xh = xp(C_HALF), hText = "half off ≈ " + Viz.fmt(C_HALF, 1) + " µM";
        api.line([xh, yTop + 7], [xh, yp(0.5) - 5], {color: c.c1, width: 1, dash: "1 3", opacity: 0.9}); vlines.push(xh);
        api.circle([xh, yp(0.5)], 4.5, {fill: c.card, stroke: c.c1, width: 1.8});
        api.label([xh, yTop], hText, {color: c.c1, size: 12, anchor: "middle"}); boxes.push([xh - 50, yTop - 7, xh + 50, yTop + 7]);
      } else {
        api.polyline(curve, {stroke: c.muted, width: 1.4, dash: "4 3", opacity: 0.8});
        api.label([xp(2.6) - 8, yp(0.4)], "wild type", {color: c.muted, size: 12, anchor: "end"}); boxes.push([xp(2.6) - 64, yp(0.4) - 7, xp(2.6) - 6, yp(0.4) + 7]);
        api.line([X0, yp(1)], [xb, yp(1)], {color: c.c1, width: 2.4});
      }
      var P = [xp(m.c), yp(m.rate)], lab = pc(m.rate) + "%", lw = lab.length * 7 + 2;
      if (m.rate < 1) api.line([P[0], P[1] + 5], [P[0], yB], {color: c.c3, width: 1.2, dash: "2 3"});   // at 100% the flat line already says it
      // the point's label goes on the first side clear of the curves, gridlines, markers and the chart edges
      var cands = m.rate === 1 ? [[8, 13, "start"], [-8, 13, "end"], [8, -12, "start"], [-8, -12, "end"]] :   // on the 100% line: below first, the title row stays clear
        [[8, -12, "start"], [-8, 13, "end"], [8, 13, "start"], [-8, -12, "end"], [0, -15, "middle"]], pick = cands[0];
      for (var ci = 0; ci < cands.length; ci++) {
        var cd = cands[ci], lx = P[0] + cd[0], ly = P[1] + cd[1];
        var bx = cd[2] === "start" ? [lx, lx + lw] : cd[2] === "end" ? [lx - lw, lx] : [lx - lw / 2, lx + lw / 2], b = [bx[0], ly - 7, bx[1], ly + 7];
        if (b[0] < X0 - 4 || b[2] > api.w - 2 || b[1] < yTop - 8 || b[3] > yB - 2) continue;
        var hit = boxes.some(function (o) { return b[0] < o[2] + 2 && o[0] - 2 < b[2] && b[1] < o[3] + 2 && o[1] - 2 < b[3]; }) ||
          vlines.some(function (vx) { return b[0] - 2 < vx && vx < b[2] + 2; }) ||
          pts.some(function (p) { return p[0] > b[0] - 2 && p[0] < b[2] + 2 && p[1] > b[1] - 1 && p[1] < b[3] + 1; });
        if (!hit) { pick = cd; break; }
      }
      api.point(P, {color: c.c1, r: 5, label: lab, dx: pick[0], dy: pick[1], anchor: pick[2], size: 12.5});
    }
  });
})();
