// How cell surfaces move, and which cytoskeleton does it. Cilia (many, short, a power stroke and a bent recovery
// stroke, neighbours slightly out of step) and the eukaryotic flagellum (long, a wave from base to tip) are built on
// the same 9 + 2 microtubule axoneme bent by dynein. Microvilli do not move: a cross-linked actin bundle props up
// extra membrane for absorption. A crawling cell protrudes a lamellipodium by Arp2/3-branched actin growth, grips
// with integrin adhesions and pulls its rear with myosin II. Side view left, its core in cross-section (or zoom) right,
// and the three filament types below with the one this structure uses lit. Ghost outlines show earlier moments.
(function () {
  var S = {
    cilia: {fil: 2, tex: "\\text{axoneme}=9\\times 2+2\\ \\text{microtubules}\\newline\\text{dynein}+\\text{ATP}\\to\\text{doublets slide}\\to\\text{bend}",
      say: "<b>Cilia</b> are short and many: each beats with a stiff power stroke and a bent, low recovery stroke, so together they sweep mucus along the airway; dynein sliding the 9 + 2 doublets makes each bend."},
    flagellum: {fil: 2, tex: "\\text{same 9 + 2 axoneme and dynein}\\newline\\text{wave: base}\\to\\text{tip, cell swims head first}",
      say: "A <b>flagellum</b> is long and usually single: bending waves run from base to tip and push the sperm forward head first, on the same 9 + 2 axoneme as a cilium (bacterial flagella are unrelated rotary motors)."},
    microvilli: {fil: 0, tex: "\\text{core}\\approx 20\\text{–}30\\ \\text{actin filaments}\\newline\\text{cross-linked by villin and fimbrin}",
      say: "<b>Microvilli</b> do not move: each is a finger of membrane around a cross-linked actin bundle rooted in the terminal web, packed into a brush border that multiplies the surface for absorbing nutrients."},
    lamellipodium: {fil: 0, tex: "\\text{protrude (Arp2/3 actin)}\\to\\text{adhere (integrins)}\\newline\\to\\text{contract (myosin II)}",
      say: "A <b>crawling</b> cell pushes its front out as actin grows in a branched sheet (the lamellipodium), grips the surface with integrin adhesions, then myosin II contracts to pull the rear along."}
  };
  var FIL = [["actin filament", "7 nm · actin", "motor: myosin", 3], ["intermediate filament", "10 nm · keratin, vimentin", "no motor", 4.5], ["microtubule", "25 nm · tubulin", "dynein, kinesin", 10]];
  Viz.register("cell-surface-movement-and-cytoskeleton", {
    title: "Cilia, flagella, microvilli and crawling",
    subject: "biology",
    shows: "Pick a surface structure: see how it moves (or doesn't), the cytoskeleton inside it in cross-section, and which of the three filament types it is built from",
    params: {
      structure: {kind: "enum", values: ["cilia", "flagellum", "microvilli", "lamellipodium"], default: "cilia", label: "\\text{structure}",
        names: {cilia: "cilia", flagellum: "flagellum", microvilli: "microvilli", lamellipodium: "crawling"}}
    },
    formula: function (v) { return S[v.structure].tex; },
    status: function (v) { return S[v.structure].say; },
    examples: [{name: "cilia", values: {structure: "cilia"}}, {name: "flagellum", values: {structure: "flagellum"}},
      {name: "microvilli", values: {structure: "microvilli"}}, {name: "crawling cell", values: {structure: "lamellipodium"}}],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = v.structure, sY = 170;
      var cilium = function (bx, ph, col, w, op) {   // one cilium at beat phase ph: straight power stroke, curled recovery
        var pts = [[bx, sY]], x = bx, y = sY, L = 84, n = 16;
        for (var i = 1; i <= n; i++) {
          var s = i / n, th;
          if (ph < 0.35) th = -45 + 90 * ph / 0.35;
          else { var u = (ph - 0.35) / 0.65; th = 48 - 93 * u + 90 * Math.sin(Math.PI * u) * s; }
          x += L / n * Math.sin(th * Math.PI / 180); y -= L / n * Math.cos(th * Math.PI / 180); pts.push([x, y]);
        }
        api.polyline(pts, {stroke: col, width: w, opacity: op});
        return pts[n];
      };
      if (k === "cilia") {
        api.rect(10, sY, 250, 40, {fill: c.ink, fillOpacity: 0.04, rx: 0});
        api.line([10, sY], [260, sY], {color: c.ink, width: 1.6});
        api.rect(10, 34, 250, 22, {fill: c.c3, fillOpacity: 0.16, rx: 6});
        api.label([16, 22], "mucus moves with the power stroke", {color: c.c3, size: 12, weight: 650});
        api.arrow([120, 45], [220, 45], {color: c.c3, width: 2.2, halo: false, head: 9});
        [[0.02, 0.3], [0.12, 0.5], [0.22, 0.75], [0.33, 1]].forEach(function (f) { cilium(76, f[0], c.c2, 2.6, f[1]); });
        [[0.42, 0.3], [0.58, 0.5], [0.74, 0.75], [0.92, 1]].forEach(function (f) { cilium(196, f[0], c.c2, 2.6, f[1]); });
        api.circle([76, sY + 3], 3.5, {fill: c.c2}); api.circle([196, sY + 3], 3.5, {fill: c.c2});
        api.path("M 30 88 Q 76 66 122 88", {stroke: c.ink, width: 1.4, arrow: true});
        api.path("M 246 150 Q 196 140 150 156", {stroke: c.muted, width: 1.4, arrow: true});
        api.label([16, 194], "power stroke: stiff", {color: c.c2, size: 12});
        api.label([258, 194], "recovery: bent, low", {color: c.muted, size: 12, anchor: "end"});
      } else if (k === "flagellum") {
        var hx = 226, hy = 112;
        [[-0.25, 0.3], [0, 1]].forEach(function (g) {   // faint = a moment earlier, crests a quarter wave nearer the base
          var pts = [];
          for (var x = hx - 16; x >= 18; x -= 3) { var s = (hx - 16 - x) / 190; pts.push([x, hy + (4 + 24 * s) * Math.sin(2 * Math.PI * (s * 1.5 - g[0]))]); }
          api.polyline(pts, {stroke: c.c2, width: 2.6, opacity: g[1]});
        });
        api.path("M " + (hx - 18) + " " + hy + " A 20 12 0 1 0 " + (hx + 22) + " " + hy + " A 20 12 0 1 0 " + (hx - 18) + " " + hy + " Z", {fill: c.ink, fillOpacity: 0.12, stroke: c.ink, width: 1.4});
        api.arrow([hx - 6, 66], [hx + 30, 66], {color: c.c3, width: 2.2, halo: false, head: 9});
        api.label([hx - 10, 66], "swims", {color: c.c3, size: 12, weight: 650, anchor: "end"});
        api.arrow([146, 162], [40, 162], {color: c.muted, width: 1.4, halo: false, head: 8});
        api.label([152, 162], "wave runs base → tip", {color: c.muted, size: 12});
        api.label([hx, 138], "sperm head", {color: c.muted, size: 12, anchor: "middle"});
        api.label([18, 62], "faint: a moment earlier", {color: c.muted, size: 12});
      } else if (k === "microvilli") {
        api.rect(10, sY, 250, 40, {fill: c.ink, fillOpacity: 0.04, rx: 0});
        for (var m = 0; m < 12; m++) {
          var x0 = 22 + m * 20;
          api.path("M " + x0 + " " + sY + " L " + x0 + " 104 A 6 6 0 0 1 " + (x0 + 12) + " 104 L " + (x0 + 12) + " " + sY, {stroke: c.ink, width: 1.5});
          [4, 8].forEach(function (d) { api.line([x0 + d, 104], [x0 + d, sY + 14], {color: c.c5, width: 1.4}); });
        }
        api.line([10, sY], [260, sY], {color: c.ink, width: 1.6, opacity: 0.4});
        api.line([12, sY + 14], [258, sY + 14], {color: c.c5, width: 2, opacity: 0.6});
        api.label([16, sY + 30], "terminal web (actin)", {color: c.c5, size: 12});
        [60, 140, 220].forEach(function (x) { api.arrow([x, 52], [x, 92], {color: c.c4, width: 1.6, halo: false, head: 8}); });
        api.label([18, 40], "nutrients in", {color: c.c4, size: 12, weight: 650});
        api.label([258, 40], "brush border ≈ 1 µm tall", {color: c.muted, size: 12, anchor: "end"});
      } else {
        var cell = function (dx, ghost) {   // top view: cell body, fan-shaped front to the right
          api.path("M " + (40 + dx) + " 120 C " + (40 + dx) + " 88 " + (100 + dx) + " 78 " + (150 + dx) + " 70 C " + (205 + dx) + " 60 " + (238 + dx) + " 84 " + (240 + dx) + " 120 C " +
            (238 + dx) + " 156 " + (205 + dx) + " 180 " + (150 + dx) + " 170 C " + (100 + dx) + " 162 " + (40 + dx) + " 152 " + (40 + dx) + " 120 Z",
            ghost ? {stroke: c.faint, width: 1.2, dash: "4 4"} : {stroke: c.ink, width: 1.6, fill: c.ink, fillOpacity: 0.05});
        };
        cell(-22, true); cell(0, false);
        api.path("M 70 120 A 26 18 0 1 0 122 120 A 26 18 0 1 0 70 120 Z", {fill: c.c6, fillOpacity: 0.15, stroke: c.c6, width: 1.2});   // wide enough to hold its label
        for (var b = 0; b < 9; b++) {   // branched actin at the leading edge
          var yb = 80 + b * 9, xb = 208 + 22 * Math.sin(Math.PI * (yb - 76) / 88);
          api.line([xb - 22, yb], [xb + 4, yb], {color: c.c5, width: 1.4}); api.line([xb - 10, yb], [xb - 2, yb - 6], {color: c.c5, width: 1.2});
        }
        [[180, 96], [196, 148], [150, 82], [154, 160]].forEach(function (q) { api.circle(q, 4, {fill: c.c4}); });
        [[62, 98, 124, 88], [62, 142, 124, 152]].forEach(function (q) { api.line([q[0], q[1]], [q[2], q[3]], {color: c.c5, width: 2, opacity: 0.7}); });
        api.arrow([22, 120], [48, 120], {color: c.c5, width: 2.2, halo: false, head: 9});
        api.arrow([250, 120], [276, 120], {color: c.c3, width: 2.2, halo: false, head: 9});
        api.label([214, 58], "1 actin pushes", {color: c.c5, size: 12, anchor: "middle"});
        api.label([150, 194], "2 integrins grip", {color: c.c4, size: 12});
        api.label([22, 194], "3 myosin II pulls", {color: c.c5, size: 12});
        api.label([96, 120], "nucleus", {color: c.c6, size: 12, anchor: "middle"});
      }
      // ---- the core: cross-section (or a zoom of the branched actin) ----
      var cx = 332, cy = 86;
      api.label([cx, 14], k === "lamellipodium" ? "zoom: branched actin" : "cross-section", {color: c.muted, size: 12, anchor: "middle"});
      if (k === "cilia" || k === "flagellum") {
        api.circle([cx, cy], 52, {stroke: c.ink, width: 1.3, fill: c.ink, fillOpacity: 0.03});
        for (var d = 0; d < 9; d++) {
          var a = d * 2 * Math.PI / 9 - Math.PI / 2, px = cx + 36 * Math.cos(a), py = cy + 36 * Math.sin(a), tx = -Math.sin(a), ty = Math.cos(a);
          api.circle([px - tx * 4, py - ty * 4], 5, {stroke: c.c2, width: 1.6, fill: c.c2, fillOpacity: 0.3});
          api.circle([px + tx * 5, py + ty * 5], 4.6, {stroke: c.c2, width: 1.4});
          api.line([px - tx * 8, py - ty * 8], [px - tx * 14 - Math.cos(a) * 4, py - ty * 14 - Math.sin(a) * 4], {color: c.c6, width: 2});
          api.line([px - Math.cos(a) * 6, py - Math.sin(a) * 6], [cx + 12 * Math.cos(a), cy + 12 * Math.sin(a)], {color: c.muted, width: 0.8, opacity: 0.6});
        }
        api.circle([cx - 5, cy], 4.4, {stroke: c.c2, width: 1.4, fill: c.c2, fillOpacity: 0.3}); api.circle([cx + 5, cy], 4.4, {stroke: c.c2, width: 1.4, fill: c.c2, fillOpacity: 0.3});
        api.label([cx, 152], "9 doublets + 2", {color: c.c2, size: 12, weight: 650, anchor: "middle"});
        api.label([cx, 168], "dynein arms", {color: c.c6, size: 12, anchor: "middle"});
      } else if (k === "microvilli") {
        api.circle([cx, cy], 44, {stroke: c.ink, width: 1.3, fill: c.ink, fillOpacity: 0.03});
        var nf = 0;
        for (var j = -3; j <= 3; j++) for (var i2 = -3; i2 <= 3; i2++) {   // hexagonal bundle, about two dozen filaments
          var fx = (i2 + (j % 2 ? 0.5 : 0)) * 9, fy = (j + 0.5) * 7.8;
          if (fx * fx + fy * fy <= 24 * 24) { api.circle([cx + fx, cy + fy], 3, {fill: c.c5}); nf++; }
        }
        api.label([cx, 146], nf + " actin filaments", {color: c.c5, size: 12, weight: 650, anchor: "middle"});
        api.label([cx, 162], "(real: about 20–30)", {color: c.muted, size: 12, anchor: "middle"});
      } else {
        api.line([cx - 50, cy + 36], [cx + 46, cy - 30], {color: c.c5, width: 2.4});
        [[0.2, 1], [0.45, -1], [0.7, 1]].forEach(function (t) {   // Arp2/3 daughters branch off at about 70 degrees
          var px = cx - 50 + 96 * t[0], py = cy + 36 - 66 * t[0], base = Math.atan2(-66, 96), ang = base + t[1] * 70 * Math.PI / 180;
          api.line([px, py], [px + 34 * Math.cos(ang), py + 34 * Math.sin(ang)], {color: c.c5, width: 2});
          api.circle([px, py], 3.5, {fill: c.c6});
        });
        api.label([cx, 146], "Arp2/3: 70° branches", {color: c.c6, size: 12, anchor: "middle"});
        api.label([cx, 162], "+ ends push the membrane", {color: c.muted, size: 12, anchor: "middle"});
      }
      // ---- the three filament types ----
      var CW = [102, 162, 106];   // card widths sized to their text at 1x (wider than at 2x): the middle card holds "10 nm · keratin, vimentin"
      FIL.forEach(function (f, i) {
        var x = 9 + (i > 0 ? CW[0] + 6 : 0) + (i > 1 ? CW[1] + 6 : 0), w = CW[i], used = i === S[k].fil, col = i === 2 ? c.c2 : i === 0 ? c.c5 : c.muted;
        api.rect(x, 214, w, 80, {fill: c.ink, fillOpacity: used ? 0.06 : 0.015, stroke: used ? col : c.faint, width: used ? 1.6 : 1, rx: 8});
        api.line([x + 12, 230], [x + w - 12, 230], {color: col, width: f[3], opacity: used ? 1 : 0.35});
        api.label([x + 9, 248], f[0], {color: used ? c.ink : c.muted, size: 12, weight: 650});
        api.label([x + 9, 264], f[1], {color: c.muted, size: 12});
        api.label([x + 9, 280], f[2], {color: c.muted, size: 12});
      });
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
