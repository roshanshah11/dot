import AppKit
import Metal
import DotKit
import SceneKit
import WebKit

/// `Dot --figure-selftest`: the offscreen half of the 3D check (parity D5). A native figure (an animal cell) builds
/// every part under the vertex cap; a click at each part's centre names that part, a click through the glass membrane
/// names the nucleus inside it, a click on the membrane alone names the membrane, a click on empty space names
/// nothing; the panel places itself inside the screen; a bad recipe shows nothing. Then a card's three.js scene in
/// Dot's own WebKit answers a click with a "part" event that reaches Swift and reads as a turn line, and a drag does
/// not. The picture goes to ~/Dot/selftests/figure-<stamp>/.
@MainActor
enum FigureSelfTest {
    static let cell = "animal cell|membrane: sphere 3 glass #9ecbff; nucleus: sphere 1.1 #7b5cff; "
        + "mitochondrion: capsule 0.35x1.4 @-1.9,1.0,0.8 rot 0,0,40 #ff6b2c; golgi body: torus 0.55x0.13 @1.7,-1.0,0.9 rot 70,0,0 #ffd166; "
        + "ribosome: sphere 0.2 @1.3,1.5,1.4 #9ef0b6; vacuole: sphere 0.5 @-1.3,-1.6,1.0 glossy #8be9fd; "
        + "centriole: tube 0.2x0.13x0.6 @0.3,-2.2,1.2 metal #c3a6ff; endoplasmic reticulum: extrude 0,0/0.8,0.2/1.2,0.9/0.4,1.1 depth 0.15 @-2.4,-0.4,0.9 #ff8fa3"

    static func run() -> Bool {
        var failures: [String] = []
        func check(_ ok: Bool, _ what: String) { print("\(ok ? "ok  " : "FAIL") \(what)"); if !ok { failures.append(what) } }

        guard let recipe = FigureRecipe.parse(cell) else { print("FAIL the fixture recipe parses"); return false }
        check(recipe.parts.count == 8 && recipe.skipped.isEmpty, "the cell recipe has 8 parts (\(recipe.parts.count), skipped \(recipe.skipped))")
        let panel = FigurePanel(recipe: recipe, accentHex: "#ff6b2c")
        check(panel.built.nodes.count == 8, "every part builds in SceneKit (\(panel.built.nodes.count) of 8)")
        check(panel.built.vertices <= FigureScene.figureCap, "the figure stays under the vertex cap (\(panel.built.vertices) of \(FigureScene.figureCap))")

        // offscreen and untouchable, but on a display so SceneKit lays out the view
        let screen = NSScreen.main?.frame ?? CGRect(x: 0, y: 0, width: 1440, height: 900)
        panel.ignoresMouseEvents = true
        panel.sharingType = .none
        panel.setFrame(CGRect(x: screen.maxX - panel.frame.width - 10, y: screen.minY + 10, width: panel.frame.width, height: panel.frame.height), display: true)
        panel.orderFrontRegardless()
        panel.alphaValue = 0.02
        panel.built.root.removeAction(forKey: "idle")
        spin(0.4)

        var told: [String] = []
        panel.onPart = { told.append($0) }
        var own = 0
        for part in recipe.parts where part.material != .glass {
            // a torus's centre is its hole: aim at the ring
            let ring: Double = { if case .torus(let r, _) = part.shape { return r }; return 0 }()
            guard let point = panel.viewPoint(of: part.name, offset: ring) else { continue }
            let got = panel.view.part(at: point)
            if got == part.name { own += 1 } else { print("     \(part.name) at its centre answers \(got ?? "nothing")") }
        }
        check(own == 7, "a click on each part names that part (\(own) of 7)")
        let center = panel.viewPoint(of: "nucleus") ?? .zero
        check(panel.clicked(center) == "nucleus" && told == ["nucleus"], "a click through the glass membrane names the nucleus and tells Dot")
        // just inside the membrane's rim, above the nucleus
        let rim = CGPoint(x: center.x, y: center.y + FigurePanel.side * 0.27)
        var misses = 0, inside = 0
        for gx in stride(from: 40.0, through: 320, by: 7) {
            for gy in stride(from: 40.0, through: 320, by: 7) where hypot(gx - 180, gy - 180) < 120 {
                inside += 1
                if panel.view.part(at: CGPoint(x: gx, y: gy)) == nil { misses += 1 }
            }
        }
        check(misses == 0, "every point inside the membrane names a part (\(inside - misses) of \(inside))")
        check(panel.view.part(at: rim) == "membrane", "a click on the membrane alone names the membrane (\(panel.view.part(at: rim) ?? "nothing"))")
        check(panel.view.part(at: CGPoint(x: 6, y: 6)) == nil, "a click on empty space names nothing")

        let stamp: String = { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd-HHmm"; return f.string(from: Date()) }()
        let folder = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/selftests/figure-\(stamp)", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        // on the panel's own dark ground, as he sees it
        panel.built.scene.background.contents = NSColor(calibratedRed: 0.09, green: 0.09, blue: 0.1, alpha: 1)
        let renderer = SCNRenderer(device: MTLCreateSystemDefaultDevice(), options: nil)
        renderer.scene = panel.built.scene
        renderer.pointOfView = panel.view.pointOfView
        let picture = renderer.snapshot(atTime: 0, with: CGSize(width: FigurePanel.side * 2, height: FigurePanel.side * 2), antialiasingMode: .multisampling4X)
        panel.built.scene.background.contents = nil
        let wrote = Snapshots.png(picture).map { (try? $0.write(to: folder.appendingPathComponent("cell.png"))) != nil } ?? false
        check(wrote, "the figure rendered to \(folder.path)/cell.png")
        panel.dismiss()
        spin(0.4)
        check(!panel.isVisible, "a dismissed figure is ordered out without waiting on its fade")

        let visible = CGRect(x: 0, y: 0, width: 1440, height: 875)
        let size = CGSize(width: 360, height: 390)
        let beside = OverlayManager.figureFrame(anchor: CGRect(x: 200, y: 400, width: 120, height: 30), pointer: .zero, visible: visible, size: size)
        let edge = OverlayManager.figureFrame(anchor: CGRect(x: 1300, y: 850, width: 120, height: 30), pointer: .zero, visible: visible, size: size)
        let free = OverlayManager.figureFrame(anchor: nil, pointer: CGPoint(x: 1200, y: 400), visible: visible, size: size)
        check(beside.minX >= 320 && visible.contains(beside), "a figure sits beside its anchor")
        check(edge.maxX <= 1300 && visible.contains(edge), "an anchor at the edge puts it on the other side, inside the screen")
        check(free.maxX < 720 && visible.contains(free), "with no anchor it goes on the side away from the pointer")
        check(FigureRecipe.parse("blob|x: blob 2") == nil, "a recipe with no buildable part shows nothing")
        check(FigureRecipe.parse("B-DNA|molecule 1bna")?.molecule == "1bna", "a molecule goes to a card")

        failures += cardParts(check)
        print(failures.isEmpty ? "figure-selftest: passed" : "figure-selftest: \(failures.count) failed")
        return failures.isEmpty
    }

    /// A three.js scene on a card, in Dot's WebKit: the patched renderer wires the canvas, a click posts a "part"
    /// event through the real `dot` handler, and a drag does not.
    private static func cardParts(_ check: (Bool, String) -> Void) -> [String] {
        let board = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../../Resources/board").standardizedFileURL
        let page = board.appendingPathComponent("test/parts.html")
        guard FileManager.default.fileExists(atPath: page.path) else { check(false, "the parts fixture page exists"); return [] }
        let catcher = Catcher()
        let configuration = WKWebViewConfiguration()
        configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        configuration.userContentController.add(catcher, name: "dot")
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 520, height: 600), configuration: configuration)
        let window = NSWindow(contentRect: CGRect(x: 0, y: 0, width: 520, height: 600), styleMask: .borderless, backing: .buffered, defer: false)
        window.alphaValue = 0.02
        window.ignoresMouseEvents = true
        window.sharingType = .none
        window.contentView = web
        window.orderFrontRegardless()
        web.loadFileURL(page, allowingReadAccessTo: board)
        spin(until: 8) { !web.isLoading }

        let script = """
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const s = document.createElement("script"); s.src = "../vendor/three.min.js"; document.head.appendChild(s);
        for (let i = 0; i < 40 && !(window.THREE && THREE.WebGLRenderer && THREE.WebGLRenderer.prototype.__dotParts); i++) await sleep(150);
        const T = window.THREE;
        if (!T || !T.WebGLRenderer.prototype.__dotParts) return JSON.stringify({patched: false});
        const canvas = document.createElement("canvas"); canvas.style.cssText = "width:300px;height:300px;display:block";
        document.getElementById("figure").appendChild(canvas);
        const scene = new T.Scene(), camera = new T.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
        const shell = new T.Mesh(new T.SphereGeometry(3, 24, 16), new T.MeshStandardMaterial({transparent: true, opacity: 0.3})); shell.name = "membrane";
        const core = new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.MeshStandardMaterial()); core.name = "nucleus";
        const group = new T.Group(); group.name = "mitochondrion"; group.position.set(2, -1, 1);
        group.add(new T.Mesh(new T.SphereGeometry(0.4, 12, 8), new T.MeshStandardMaterial()));
        scene.add(shell, core, group); scene.updateMatrixWorld(true);
        try { T.WebGLRenderer.prototype.render.call({domElement: canvas}, scene, camera); } catch (e) {}
        const r = canvas.getBoundingClientRect();
        const at = (x, y) => [r.left + (x + 1) / 2 * r.width, r.top + (1 - y) / 2 * r.height];
        const name = (x, y) => { const p = at(x, y), hit = window.DotParts.at(canvas, p[0], p[1]); return hit ? hit.part : null; };
        const m = new T.Vector3(2, -1, 1).project(camera);
        const out = {patched: true, center: name(0, 0), rim: name(0, 0.6), mito: name(m.x, m.y), empty: name(0.95, 0.95)};
        const press = (a, b) => {
          canvas.dispatchEvent(new PointerEvent("pointerdown", {clientX: a[0], clientY: a[1], bubbles: true}));
          canvas.dispatchEvent(new PointerEvent("pointerup", {clientX: b[0], clientY: b[1], bubbles: true}));
        };
        press(at(0, 0), at(0, 0));
        await sleep(1700);
        const drag = at(0, 0); press(drag, [drag[0] + 40, drag[1]]);
        await sleep(300);
        return JSON.stringify(out);
        """
        var answer: String?
        web.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
            if case .success(let value) = result { answer = value as? String } else if case .failure(let error) = result { answer = "error: \(error)" }
        }
        spin(until: 15) { answer != nil }
        window.orderOut(nil)
        let fields = answer.flatMap { try? JSONSerialization.jsonObject(with: Data($0.utf8)) as? [String: Any] } ?? [:]
        var failed: [String] = []
        func note(_ ok: Bool, _ what: String) { check(ok, what); if !ok { failed.append(what) } }
        note(fields["patched"] as? Bool == true, "board.js wires three.js scenes a card script loads itself (\(answer ?? "no answer"))")
        note(fields["center"] as? String == "nucleus", "a card's click through a see-through shell names what is inside")
        note(fields["rim"] as? String == "membrane" && fields["empty"] is NSNull, "the shell alone names the shell; empty space names nothing")
        note(fields["mito"] as? String == "mitochondrion", "an unnamed mesh answers with its named group")
        let parts = catcher.bodies.compactMap { CardEvent.parse($0, card: "parts-fixture") }.filter { $0.kind == "part" }
        note(parts.count == 1, "one click posts one part event, the drag none (\(parts.count))")
        note(parts.first?.summary == "he clicked \"nucleus\" on the figure \"test cell\"", "it reads as a turn line (\(parts.first?.summary ?? "none"))")
        return failed
    }

    private final class Catcher: NSObject, WKScriptMessageHandler {
        var bodies: [Any] = []
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) { bodies.append(message.body) }
    }

    private static func spin(_ seconds: Double) { _ = spin(until: seconds) { false } }

    @discardableResult
    private static func spin(until seconds: Double, _ done: () -> Bool) -> Bool {
        let until = Date().addingTimeInterval(seconds)
        while Date() < until {
            if done() { return true }
            while let event = NSApp.nextEvent(matching: .any, until: Date(timeIntervalSinceNow: 0.02), inMode: .default, dequeue: true) { NSApp.sendEvent(event) }
            RunLoop.main.run(mode: .default, before: Date(timeIntervalSinceNow: 0.03))
        }
        return done()
    }
}
