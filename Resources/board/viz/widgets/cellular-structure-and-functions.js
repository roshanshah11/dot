// Same jobs, different structures: pick a job a cell must do and see which structure does it in a bacterium, an
// animal cell and a plant cell. Bacteria have no membrane-bound organelles: the nucleoid holds the circular
// chromosome, 70S ribosomes sit free, the plasma membrane carries the electron transport chain and ATP synthase and
// the Sec translocon for export, and a peptidoglycan wall holds the shape. Eukaryotes use a double-membraned nucleus,
// 80S ribosomes (free and on rough ER), ER -> Golgi -> vesicles for export, mitochondria for ATP; plants add a
// cellulose wall, a central vacuole whose turgor presses on it, and chloroplasts. "To scale" uses typical sizes:
// bacterium 2 um long (about 1 um^3), animal cell 20 um across (4/3 pi 10^3, about 4,200 um^3), plant cell 50 um.
(function () {
  var JOBS = ["store DNA", "make proteins", "ship proteins", "make ATP", "control entry", "support shape", "capture light"];
  var HL = {   // which drawn parts do the job, per cell
    bact: {"store DNA": ["nucleoid", "plasmid"], "make proteins": ["ribo"], "ship proteins": ["membrane"], "make ATP": ["membrane"], "control entry": ["membrane"], "support shape": ["wall"], "capture light": []},
    anim: {"store DNA": ["nucleus"], "make proteins": ["ribo", "er"], "ship proteins": ["er", "golgi", "ves"], "make ATP": ["mito"], "control entry": ["membrane"], "support shape": ["cyto"], "capture light": []},
    plant: {"store DNA": ["nucleus"], "make proteins": ["ribo", "er"], "ship proteins": ["er", "golgi", "ves"], "make ATP": ["mito", "chloro"], "control entry": ["membrane"], "support shape": ["wall", "vac"], "capture light": ["chloro"]}
  };
  var NAMES = {
    bact: {"store DNA": ["nucleoid", "+ plasmid"], "make proteins": ["70S ribosomes"], "ship proteins": ["plasma membrane"], "make ATP": ["plasma membrane"], "control entry": ["plasma membrane"], "support shape": ["peptidoglycan wall"], "capture light": ["none (most)"]},
    anim: {"store DNA": ["nucleus"], "make proteins": ["80S ribosomes,", "free and on rough ER"], "ship proteins": ["rough ER → Golgi", "→ vesicles"], "make ATP": ["mitochondria"], "control entry": ["plasma membrane"], "support shape": ["cytoskeleton", "(no wall)"], "capture light": ["none"]},
    plant: {"store DNA": ["nucleus"], "make proteins": ["80S ribosomes,", "free and on rough ER"], "ship proteins": ["rough ER → Golgi", "→ vesicles"], "make ATP": ["mitochondria", "+ chloroplasts"], "control entry": ["plasma membrane"], "support shape": ["cellulose wall", "+ vacuole pressure"], "capture light": ["chloroplasts"]}
  };
  var FORMULA = {
    "store DNA": "\\text{bacterium}\\to\\text{nucleoid}\\newline\\text{animal, plant}\\to\\text{nucleus}",
    "make proteins": "\\text{bacterium}\\to 70\\text{S ribosomes}\\newline\\text{animal, plant}\\to 80\\text{S ribosomes}",
    "ship proteins": "\\text{bacterium}\\to\\text{plasma membrane}\\newline\\text{eukaryotes}\\to\\text{ER}\\to\\text{Golgi}",
    "make ATP": "\\text{bacterium}\\to\\text{plasma membrane}\\newline\\text{animal, plant}\\to\\text{mitochondria}",
    "control entry": "\\text{all three}\\to\\text{plasma membrane}",
    "support shape": "\\text{bacterium, plant}\\to\\text{cell wall}\\newline\\text{animal}\\to\\text{cytoskeleton}",
    "capture light": "\\text{plant}\\to\\text{chloroplasts}\\newline\\text{animal, most bacteria}\\to\\text{none}"
  };
  var STATUS = {
    "store DNA": "The bacterium's circular chromosome lies in a <b>nucleoid</b> with no membrane around it, beside small plasmids; animal and plant cells wrap their linear chromosomes in a double-membraned <b>nucleus</b>.",
    "make proteins": "Every cell builds proteins on <b>ribosomes</b>: smaller 70S ones loose in the bacterium, 80S ones in animal and plant cells, free in the cytosol or studding the <b>rough ER</b>.",
    "ship proteins": "A bacterium threads proteins for export straight through its <b>plasma membrane</b>; animal and plant cells make them on the rough ER, finish them in the <b>Golgi</b> and ship them out in <b>vesicles</b>.",
    "make ATP": "A bacterium has no mitochondria, so its electron transport chain and ATP synthase sit in the <b>plasma membrane</b>; animal and plant cells use <b>mitochondria</b>, and chloroplasts also make ATP in the light to build sugar.",
    "control entry": "In all three the <b>plasma membrane</b> decides what gets in; the walls of bacteria and plants hold the shape but let small molecules straight through.",
    "support shape": "The bacterium has a <b>peptidoglycan wall</b>, the plant a <b>cellulose wall</b> pressed out by its water-filled vacuole, and the wall-less animal cell holds its shape with the <b>cytoskeleton</b>.",
    "capture light": "Only the plant cell has <b>chloroplasts</b> to capture light for photosynthesis; animal cells have none, and of bacteria only photosynthetic ones such as cyanobacteria do it, on internal membranes."
  };
  Viz.register("cellular-structure-and-functions", {
    title: "Cell structures and their jobs",
    subject: "biology",
    shows: "Pick a job (store DNA, make proteins, make ATP, hold the shape...) and see which structure does it in a bacterium, an animal cell and a plant cell; switch on true scale to see how much bigger eukaryotic cells are",
    params: {
      job: {kind: "enum", values: JOBS, default: "make ATP", label: "\\text{job}"},
      scale: {kind: "boolean", default: false, label: "\\text{size}", on: "true scale", off: "enlarged to compare"}
    },
    formula: function (v) {
      return v.scale ? "\\frac{V_{\\text{animal}}}{V_{\\text{bacterium}}}\\approx\\frac{\\tfrac43\\pi\\,(10\\ \\mu\\text{m})^3}{1\\ \\mu\\text{m}^3}\\approx 4200" : FORMULA[v.job];
    },
    status: function (v) {
      if (v.scale) return "Drawn to scale, a 2 µm bacterium is a speck beside a 20 µm animal cell, which holds about <b>4,200 times</b> its volume, and a 50 µm plant cell; the organelles are how a cell that big stays organized.";
      return STATUS[v.job];
    },
    examples: JOBS.map(function (j) { return {name: j, values: {job: j, scale: false}}; }).concat([{name: "true scale", values: {job: "make ATP", scale: true}}]),
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, job = v.job, HC = c.c1, big = !v.scale;
      var L = function (at, t, col, o) { return api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      var on = function (cell, part) { return HL[cell][job].indexOf(part) >= 0; };
      var col = function (cell, part, base) { return on(cell, part) ? HC : base || c.faint; };
      var ell = function (x, y, rx, ry, o) { return api.path("M " + (x - rx) + " " + y + " A " + rx + " " + ry + " 0 1 0 " + (x + rx) + " " + y + " A " + rx + " " + ry + " 0 1 0 " + (x - rx) + " " + y, o); };
      var mito = function (p, rx, ry, hot) {   // outer membrane plus a cristae zigzag, so it never reads as a chloroplast
        ell(p[0], p[1], rx, ry, {stroke: hot ? HC : c.muted, width: hot ? 2 : 1.2, fill: hot ? HC : "none", fillOpacity: 0.18});
        var d = "M " + (p[0] - rx * 0.72) + " " + p[1];
        for (var i = 0; i < 5; i++) d += " L " + (p[0] - rx * 0.72 + (i + 0.5) * rx * 0.288) + " " + (p[1] + (i % 2 ? 1 : -1) * ry * 0.6);
        api.path(d + " L " + (p[0] + rx * 0.72) + " " + p[1], {stroke: hot ? HC : c.muted, width: 1});
      };
      var chloro = function (p, rx, ry, hot) {   // green-free when it is not the answer; stacked grana lines inside
        ell(p[0], p[1], rx, ry, {stroke: hot ? HC : c.faint, width: hot ? 2 : 1.2, fill: hot ? HC : c.muted, fillOpacity: hot ? 0.3 : 0.08});
        [-0.45, 0, 0.45].forEach(function (f) {
          if (ry > rx) api.line([p[0] - rx * 0.45, p[1] + f * ry], [p[0] + rx * 0.45, p[1] + f * ry], {color: hot ? HC : c.faint, width: 1.2});
          else api.line([p[0] + f * rx, p[1] - ry * 0.45], [p[0] + f * rx, p[1] + ry * 0.45], {color: hot ? HC : c.faint, width: 1.2});
        });
      };
      var arc = function (ctr, r, a0, a1, o) {
        var p0 = [ctr[0] + r * Math.cos(a0), ctr[1] + r * Math.sin(a0)], p1 = [ctr[0] + r * Math.cos(a1), ctr[1] + r * Math.sin(a1)];
        api.path("M " + p0[0] + " " + p0[1] + " A " + r + " " + r + " 0 0 1 " + p1[0] + " " + p1[1], o);
      };
      var calls = [];   // callouts for the parts doing the job: [cell, part, target, label point, text]
      var call = function (cell, part, at, lab, text) { if (big && on(cell, part)) calls.push([at, lab, text]); };
      var k = 128 / 50, cy = 120, TOP = 30, BOT = 210;   // px per um at true scale (the plant cell is 50 um wide)
      var sB = big ? 38 : 1 * k, sA = big ? 64 : 10 * k, sP = 25 * k;   // half-widths; enlarged eukaryotes are 128 px wide
      var BX = 44, AX = 166, PX = 320;
      // ---- bacterium: wall, membrane, nucleoid, plasmid, free ribosomes, membrane proteins ----
      var B = function (x, y) { return [BX + x, cy + y]; }, mi = 3.5 * sB / 38;
      api.rect(BX - sB, cy - sB / 2, 2 * sB, sB, {rx: sB / 2, stroke: col("bact", "wall", c.muted), width: on("bact", "wall") ? 3.5 : 2});
      api.rect(BX - sB + mi, cy - sB / 2 + mi, 2 * sB - 2 * mi, sB - 2 * mi, {rx: sB / 2 - mi, stroke: col("bact", "membrane"), width: on("bact", "membrane") ? 2.5 : 1.2});
      if (big) {
        api.path("M " + B(-16, 0).join(" ") + " C " + B(-10, -12).join(" ") + " " + B(-2, 10).join(" ") + " " + B(6, -4).join(" ") + " S " + B(18, 6).join(" ") + " " + B(12, 8).join(" ") +
          " S " + B(-20, 11).join(" ") + " " + B(-16, 0).join(" "), {stroke: col("bact", "nucleoid", c.muted), width: on("bact", "nucleoid") ? 2.4 : 1.4});
        api.circle(B(24, -6), 4, {stroke: col("bact", "plasmid", c.muted), width: 1.5});
        [[-28, -6], [-23, 8], [-6, -11], [14, -11], [24, 7], [-31, 2], [2, 12], [31, 1]].forEach(function (q) { api.circle(B(q[0], q[1]), on("bact", "ribo") ? 2.4 : 1.8, {fill: col("bact", "ribo", c.muted)}); });
        if (job === "make ATP" || job === "ship proteins") [-16, 0, 16].forEach(function (x) { api.rect(BX + x - 3, cy - sB / 2 + 1, 6, 6, {fill: HC, rx: 1}); });
        call("bact", "nucleoid", B(-16, 0), [BX - 16, cy + 32], "nucleoid");
        call("bact", "plasmid", B(24, -10), [BX + 22, cy - 32], "plasmid");
        call("bact", "ribo", B(-23, 8), [BX - 16, cy + 32], "ribosome");
        if (job === "control entry") call("bact", "membrane", B(10, -sB / 2 + mi), [BX, cy - 32], "membrane");
        else call("bact", "membrane", B(0, -sB / 2 + 1), [BX, cy - 32], job === "make ATP" ? "ATP synthase" : "Sec translocon");
        call("bact", "wall", B(-12, -sB / 2), [BX - 12, cy - 32], "wall");
      }
      // ---- animal cell: membrane, nucleus, rough ER, Golgi, vesicles, mitochondria, ribosomes, cytoskeleton ----
      var u = sA / 64, ky = big ? 1 : 64 / 76, ry = 76 * u * ky, A = function (x, y) { return [AX + x * u, cy + y * u * ky]; };
      if (on("anim", "cyto")) {   // microtubules radiate from the centrosome beside the nucleus to the membrane
        [-150, -105, -60, -20, 25, 70, 115, 165].forEach(function (deg) {
          var a = deg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), t = 0;
          while (Math.pow((-4 + dx * t) / 64, 2) + Math.pow((24 + dy * t) / 76, 2) < 0.86) t += 1;
          api.line(A(-4, 24), A(-4 + dx * t, 24 + dy * t), {color: HC, width: 1.3, opacity: 0.8});
        });
        api.rect(A(-4, 24)[0] - 4, A(-4, 24)[1] - 1.5, 8, 3, {fill: HC, rx: 1}); api.rect(A(-4, 24)[0] - 1.5, A(-4, 24)[1] - 4, 3, 8, {fill: HC, rx: 1});
      }
      ell(AX, cy, sA, ry, {stroke: col("anim", "membrane", c.muted), width: on("anim", "membrane") ? 3 : 1.8});
      var NA = A(-14, -8);
      api.circle(NA, 21 * u, {stroke: col("anim", "nucleus", c.muted), width: on("anim", "nucleus") ? 2.6 : 1.4, fill: on("anim", "nucleus") ? HC : c.card, fillOpacity: on("anim", "nucleus") ? 0.15 : 1});
      api.circle(A(-17, -11), 6 * u, {fill: col("anim", "nucleus", c.muted), fillOpacity: 0.5});
      [29, 36].forEach(function (r) { arc(NA, r * u, -1.15, 0.95, {stroke: col("anim", "er"), width: on("anim", "er") ? 2.6 : 1.6}); });
      [-0.9, -0.4, 0.1, 0.6].forEach(function (a) { api.circle([NA[0] + 39.5 * u * Math.cos(a), NA[1] + 39.5 * u * Math.sin(a)], (on("anim", "ribo") ? 2.2 : 1.6) * u, {fill: col("anim", "ribo", c.muted)}); });
      [0, 6, 12].forEach(function (d) { var g = A(14, 32 + d); api.path("M " + g[0] + " " + g[1] + " q " + 13 * u + " " + 8 * u + " " + 26 * u + " 0", {stroke: col("anim", "golgi"), width: on("anim", "golgi") ? 2.4 : 1.5}); });
      [[52, 16], [28, 60]].forEach(function (q) { api.circle(A(q[0], q[1]), 3.5 * u, {stroke: col("anim", "ves"), width: 1.4}); });
      [[-36, 40], [4, 56], [-30, -50]].forEach(function (q) { mito(A(q[0], q[1]), 12 * u, 6 * u, on("anim", "mito")); });
      [[-48, 8], [30, -50], [-8, 36], [-52, -16]].forEach(function (q) { api.circle(A(q[0], q[1]), (on("anim", "ribo") ? 2.2 : 1.6) * u, {fill: col("anim", "ribo", c.muted)}); });
      call("anim", "nucleus", A(-14, -29), [AX - 14, TOP], "nucleus");
      call("anim", "er", A(-14 + 36 * Math.cos(-0.95), -8 + 36 * Math.sin(-0.95)), [AX - 28, TOP], "rough ER");
      call("anim", "ribo", A(30, -50), [AX + 36, TOP], "ribosome");
      call("anim", "membrane", A(36.7, -62.3), [AX + 40, TOP], "membrane");
      call("anim", "golgi", A(27, 42), [AX + 12, BOT], "Golgi");
      call("anim", "ves", A(52, 19.5), [AX + 52, BOT], "vesicle");
      call("anim", "mito", A(-36, 46), [AX - 30, BOT], "mitochondrion");
      call("anim", "cyto", A(-4 + 28 * Math.cos(2.007), 24 + 28 * Math.sin(2.007)), [AX - 20, BOT], "cytoskeleton");
      // ---- plant cell: wall, membrane, central vacuole, nucleus, rough ER, Golgi, chloroplasts, mitochondria ----
      var q = sP / 64, w = sP, h = 76 * q, P = function (x, y) { return [PX + x * q, cy + y * q]; };
      api.rect(PX - w, cy - h, 2 * w, 2 * h, {rx: 4, stroke: col("plant", "wall", c.muted), width: on("plant", "wall") ? 4.5 : 3});
      api.rect(PX - w + 4 * q, cy - h + 4 * q, 2 * w - 8 * q, 2 * h - 8 * q, {rx: 6 * q, stroke: col("plant", "membrane"), width: on("plant", "membrane") ? 2.5 : 1.1});
      api.rect(PX - 2 * q, cy - 46 * q, 48 * q, 92 * q, {rx: 14 * q, stroke: col("plant", "vac"), width: 1.5, fill: on("plant", "vac") ? HC : c.c2, fillOpacity: on("plant", "vac") ? 0.25 : 0.06});
      L(P(22, 0), "vacuole", on("plant", "vac") ? HC : c.faint, {anchor: "middle", weight: on("plant", "vac") ? 650 : 500});
      var NP = P(-34, -14);
      api.circle(NP, 13 * q, {stroke: col("plant", "nucleus", c.muted), width: on("plant", "nucleus") ? 2.6 : 1.4, fill: on("plant", "nucleus") ? HC : "none", fillOpacity: 0.15});
      api.circle(P(-36, -16), 4 * q, {fill: col("plant", "nucleus", c.muted), fillOpacity: 0.5});
      [18, 24].forEach(function (r) { arc(NP, r * q, -1.4, 1.2, {stroke: col("plant", "er"), width: on("plant", "er") ? 2.6 : 1.6}); });
      [-1.1, -0.5, 0.1, 0.7].forEach(function (a) { api.circle([NP[0] + 27.5 * q * Math.cos(a), NP[1] + 27.5 * q * Math.sin(a)], (on("plant", "ribo") ? 2.2 : 1.6) * q, {fill: col("plant", "ribo", c.muted)}); });
      [0, 6, 12].forEach(function (d) { var g = P(-40, 30 + d); api.path("M " + g[0] + " " + g[1] + " q " + 13 * q + " " + 8 * q + " " + 26 * q + " 0", {stroke: col("plant", "golgi"), width: on("plant", "golgi") ? 2.4 : 1.5}); });
      [[-10, 56], [-54, 46]].forEach(function (p) { api.circle(P(p[0], p[1]), 3 * q, {stroke: col("plant", "ves"), width: 1.4}); });
      [[-10, -60, 9, 5], [40, -60, 9, 5], [53, -40, 4, 9], [53, -6, 4, 9], [53, 28, 4, 9], [8, 60, 9, 5], [32, 60, 9, 5], [-50, 24, 4, 9]].forEach(function (p) {
        chloro(P(p[0], p[1]), p[2] * q, p[3] * q, on("plant", "chloro"));
      });
      [[-46, -48], [-36, 64]].forEach(function (p) { mito(P(p[0], p[1]), 10 * q, 5 * q, on("plant", "mito")); });
      call("plant", "nucleus", P(-34, -27), [PX - 34, TOP], "nucleus");
      call("plant", "er", P(-34 + 24 * Math.cos(-0.7), -14 + 24 * Math.sin(-0.7)), [PX - 30, TOP], "rough ER");
      call("plant", "ribo", P(-34 + 27.5 * Math.cos(-0.5), -14 + 27.5 * Math.sin(-0.5)), [PX + 30, TOP], "ribosome");
      call("plant", "chloro", P(-10, -65), [PX - 6, TOP], "chloroplast");
      call("plant", "membrane", P(20, -72), [PX + 20, TOP], "membrane");
      call("plant", "wall", P(-20, -76), [PX - 20, TOP], "wall");
      call("plant", "golgi", P(-27, 40), [PX - 2, BOT], "Golgi");
      call("plant", "ves", P(-54, 49), [PX - 50, BOT], "vesicle");
      call("plant", "mito", P(-36, 69), [PX - 36, BOT], "mitochondrion");
      // callouts: a leader from the label to one example of each part doing the job
      calls.forEach(function (k2) {
        var t = k2[0], lab = k2[1], y0 = lab[1] + (t[1] > lab[1] ? 7 : -7);
        api.line([lab[0], y0], t, {color: c.card, width: 3.5});
        api.line([lab[0], y0], t, {color: HC, width: 1.1});
        api.circle(t, 2, {fill: HC});
        L(lab, k2[2], HC, {anchor: "middle", weight: 500});
      });
      // headers, sizes and what does the job in each cell
      [["bacterium", BX, "2 µm"], ["animal cell", AX, "20 µm"], ["plant cell", PX, "50 µm"]].forEach(function (hd) {
        L([hd[1], 12], hd[0] + (v.scale ? "  " + hd[2] : ""), c.muted, {anchor: "middle"});
      });
      [["bact", BX], ["anim", AX], ["plant", PX]].forEach(function (cl) {
        var nm = NAMES[cl[0]][job], none = /^none/.test(nm[0]);
        nm.forEach(function (t, i) { L([cl[1], 233 + i * 15], t, none ? c.muted : HC, {anchor: "middle", weight: i ? 500 : 650}); });
      });
      if (v.scale) { api.line([PX - 64, 272], [PX - 64 + 10 * k, 272], {color: c.ink, width: 2.5}); L([PX - 64 + 10 * k + 6, 272], "10 µm", c.ink, {weight: 500}); }
      else L([200, 276], "not to scale: switch on true scale", c.muted, {anchor: "middle", weight: 500});
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
