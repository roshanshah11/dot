import AppKit
import DotKit
import SceneKit

/// 3D you can click (parity D5): a `[FIGURE]` recipe built as SceneKit parts in its own small panel. The full-screen
/// overlay stays click-through; only this panel's bounds take the mouse. Drag turns the figure, scroll zooms, a click on
/// a part lights it, names it on the panel and tells Dot. It never takes focus, follows Spaces like cards and the
/// "Show Dot in screen recordings" setting, and closes with the drawing.
enum FigureScene {
    /// Vertices a part may use, and the whole figure; a part over its share loses detail, never its shape.
    static let partCap = 12_000
    static let figureCap = 120_000
    static let fitRadius = 2.2

    struct Built {
        let scene: SCNScene
        let root: SCNNode
        let nodes: [String: SCNNode]
        let vertices: Int
        let skipped: [String]
    }

    static let palette = ["#7cc7ff", "#ffd166", "#9ef0b6", "#c3a6ff", "#ff8fa3", "#8be9fd", "#f4a261"]

    static func build(_ recipe: FigureRecipe, accentHex: String) -> Built {
        let scene = SCNScene()
        scene.lightingEnvironment.contents = environment()
        scene.lightingEnvironment.intensity = 1.2
        let root = SCNNode()
        root.name = "figure"
        scene.rootNode.addChildNode(root)
        let cap = min(partCap, figureCap / max(recipe.parts.count, 1))
        var nodes: [String: SCNNode] = [:]
        var skipped = recipe.skipped
        var vertices = 0
        for (i, part) in recipe.parts.enumerated() {
            let segments = part.shape.segments(cap: cap)
            guard let geometry = geometry(part.shape, segments: segments) else {
                skipped.append("\(part.name): SceneKit could not make it")
                continue
            }
            let hex = part.colorHex.isEmpty ? (i == 0 ? accentHex : palette[(i - 1) % palette.count]) : part.colorHex
            geometry.materials = [material(part.material, color: NSColor(hex: hex) ?? .systemOrange)]
            let node = SCNNode(geometry: geometry)
            node.name = part.name
            node.position = SCNVector3(part.position.x, part.position.y, part.position.z)
            node.eulerAngles = SCNVector3(radians(part.rotation.x), radians(part.rotation.y), radians(part.rotation.z))
            if part.material == .glass { node.renderingOrder = 10 }
            root.addChildNode(node)
            nodes[part.name] = node
            vertices += geometry.sources(for: .vertex).first?.vectorCount ?? part.shape.vertices(segments: segments)
        }
        // fitted to the panel, centred on what was built
        let (lo, hi) = root.boundingBox
        let center = SCNVector3((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2)
        let half = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z) / 2
        let scale = half > 0 ? CGFloat(fitRadius) / half : 1
        root.scale = SCNVector3(scale, scale, scale)
        root.position = SCNVector3(-center.x * scale, -center.y * scale, -center.z * scale)

        let camera = SCNNode()
        camera.name = "camera"
        camera.camera = SCNCamera()
        camera.camera?.fieldOfView = 38
        camera.position = SCNVector3(0, 0.6, 7.4)
        camera.look(at: SCNVector3(0, 0, 0))
        scene.rootNode.addChildNode(camera)
        let key = SCNNode()
        key.light = SCNLight()
        key.light?.type = .directional
        key.light?.intensity = 900
        key.eulerAngles = SCNVector3(-0.7, 0.6, 0)
        scene.rootNode.addChildNode(key)
        let fill = SCNNode()
        fill.light = SCNLight()
        fill.light?.type = .ambient
        fill.light?.intensity = 260
        scene.rootNode.addChildNode(fill)
        return Built(scene: scene, root: root, nodes: nodes, vertices: vertices, skipped: skipped)
    }

    private static func radians(_ degrees: Double) -> CGFloat { CGFloat(degrees * .pi / 180) }

    static func geometry(_ shape: FigureShape, segments s: Int) -> SCNGeometry? {
        let c = { (v: Double) in CGFloat(v) }
        switch shape {
        case .box(let w, let h, let d):
            return SCNBox(width: c(w), height: c(h), length: c(d), chamferRadius: c(min(w, h, d) * 0.06))
        case .sphere(let r):
            let g = SCNSphere(radius: c(r)); g.segmentCount = s; return g
        case .cylinder(let r, let h):
            let g = SCNCylinder(radius: c(r), height: c(h)); g.radialSegmentCount = s; return g
        case .capsule(let r, let h):
            let g = SCNCapsule(capRadius: c(r), height: c(h)); g.radialSegmentCount = s; g.capSegmentCount = max(s / 2, 4); return g
        case .cone(let top, let bottom, let h):
            let g = SCNCone(topRadius: c(top), bottomRadius: c(bottom), height: c(h)); g.radialSegmentCount = s; return g
        case .torus(let ring, let pipe):
            let g = SCNTorus(ringRadius: c(ring), pipeRadius: c(pipe)); g.ringSegmentCount = s; g.pipeSegmentCount = max(s / 2, 6); return g
        case .tube(let outer, let inner, let h):
            let g = SCNTube(innerRadius: c(inner), outerRadius: c(outer), height: c(h)); g.radialSegmentCount = s; return g
        case .extrude(let points, let depth):
            let path = NSBezierPath()
            path.move(to: points[0])
            for p in points.dropFirst() { path.line(to: p) }
            path.close()
            path.flatness = 0.05
            let g = SCNShape(path: path, extrusionDepth: c(depth))
            g.chamferRadius = 0
            return g
        }
    }

    static func material(_ kind: FigureMaterial, color: NSColor) -> SCNMaterial {
        let m = SCNMaterial()
        m.lightingModel = .physicallyBased
        m.diffuse.contents = color
        switch kind {
        case .matte:
            m.roughness.contents = 0.82; m.metalness.contents = 0.0
        case .glossy:
            m.roughness.contents = 0.22; m.metalness.contents = 0.0
        case .metal:
            m.roughness.contents = 0.3; m.metalness.contents = 0.92
        case .glass:
            // a shell: clear in the middle, bright at the rim (fresnel), so what is inside shows through
            m.lightingModel = .blinn
            m.diffuse.contents = color.withAlphaComponent(0.10)
            m.specular.contents = NSColor.white
            m.shininess = 0.9
            m.reflective.contents = color.blended(withFraction: 0.35, of: .white)
            m.fresnelExponent = 2.4
            m.transparencyMode = .singleLayer
            m.blendMode = .alpha
            m.writesToDepthBuffer = false
        }
        return m
    }

    /// A soft studio gradient for the lighting environment (metal reflects it; nothing loads from disk).
    static func environment() -> NSImage {
        let size = NSSize(width: 64, height: 32)
        let image = NSImage(size: size)
        image.lockFocus()
        NSGradient(colors: [NSColor(white: 0.95, alpha: 1), NSColor(white: 0.55, alpha: 1), NSColor(white: 0.18, alpha: 1)])?
            .draw(in: NSRect(origin: .zero, size: size), angle: -90)
        image.unlockFocus()
        return image
    }
}

/// The view inside a figure panel: SceneKit's camera control for drag and scroll, and a click on a part that did not
/// move tells the panel which part it was.
final class FigureView: SCNView {
    var onClick: ((CGPoint) -> Void)?
    private var downAt: CGPoint?

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func mouseDown(with event: NSEvent) {
        downAt = convert(event.locationInWindow, from: nil)
        super.mouseDown(with: event)
    }

    override func mouseUp(with event: NSEvent) {
        super.mouseUp(with: event)
        let up = convert(event.locationInWindow, from: nil)
        if let downAt, hypot(up.x - downAt.x, up.y - downAt.y) < 4 { onClick?(up) }
        downAt = nil
    }

    /// The part under a point of this view: the nearest part that is not glass (a cell's membrane does not hide its
    /// nucleus), else the nearest glass one. A segment through the scene with both faces counted, not SCNView.hitTest,
    /// which missed about one point in four on a plain sphere; a ray that runs exactly along a seam between triangles
    /// can still slip through, so a miss tries again a fraction of a point away (figure self-test, 2026-10-26).
    func part(at point: CGPoint) -> String? {
        guard let scene else { return nil }
        let options: [String: Any] = [SCNHitTestOption.searchMode.rawValue: SCNHitTestSearchMode.all.rawValue,
                                      SCNHitTestOption.backFaceCulling.rawValue: false,
                                      SCNHitTestOption.ignoreHiddenNodes.rawValue: true]
        for nudge in [CGPoint.zero, CGPoint(x: 0.37, y: 0.23), CGPoint(x: -0.31, y: 0.41), CGPoint(x: 0.29, y: -0.35)] {
            let p = CGPoint(x: point.x + nudge.x, y: point.y + nudge.y)
            let near = unprojectPoint(SCNVector3(p.x, p.y, 0)), far = unprojectPoint(SCNVector3(p.x, p.y, 1))
            func distance(_ hit: SCNHitTestResult) -> CGFloat {
                let w = hit.worldCoordinates
                return (w.x - near.x) * (w.x - near.x) + (w.y - near.y) * (w.y - near.y) + (w.z - near.z) * (w.z - near.z)
            }
            let named = scene.rootNode.hitTestWithSegment(from: near, to: far, options: options).sorted { distance($0) < distance($1) }
                .compactMap { hit -> (String, Bool)? in
                    guard let name = hit.node.name, name != "figure", name != "camera" else { return nil }
                    return (name, hit.node.geometry?.firstMaterial?.writesToDepthBuffer == false)
                }
            if let pick = named.first(where: { !$0.1 }) ?? named.first { return pick.0 }
        }
        return nil
    }
}

final class FigurePanel: NSPanel {
    let recipe: FigureRecipe
    let built: FigureScene.Built
    let view: FigureView
    var onPart: ((String) -> Void)?
    var onClose: (() -> Void)?
    private let strip = NSView()
    private let titleLabel = NSTextField(labelWithString: "")
    private let partLabel = NSTextField(labelWithString: "")
    private let stripHeight: CGFloat = 30
    static let side: CGFloat = 360

    init(recipe: FigureRecipe, accentHex: String) {
        self.recipe = recipe
        built = FigureScene.build(recipe, accentHex: accentHex)
        view = FigureView(frame: .zero, options: [SCNView.Option.preferredRenderingAPI.rawValue: SCNRenderingAPI.metal.rawValue])
        super.init(contentRect: CGRect(x: 0, y: 0, width: Self.side, height: Self.side + stripHeight),
                   styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        isFloatingPanel = true
        level = .screenSaver
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        isMovableByWindowBackground = true
        hidesOnDeactivate = false
        isReleasedWhenClosed = false
        alphaValue = 0
        sharingType = CardPanel.visibleInRecordings ? .readOnly : .none

        let container = NSView()
        container.wantsLayer = true
        container.layer?.backgroundColor = NSColor(calibratedRed: 0.09, green: 0.09, blue: 0.1, alpha: 0.9).cgColor
        container.layer?.cornerRadius = 14
        container.layer?.masksToBounds = true
        container.layer?.borderWidth = 1
        container.layer?.borderColor = NSColor.white.withAlphaComponent(0.12).cgColor
        contentView = container
        let bounds = CGRect(x: 0, y: 0, width: Self.side, height: Self.side + stripHeight)
        container.frame = bounds

        view.frame = CGRect(x: 0, y: 0, width: Self.side, height: Self.side)
        view.scene = built.scene
        view.pointOfView = built.scene.rootNode.childNode(withName: "camera", recursively: false)
        view.backgroundColor = .clear
        view.allowsCameraControl = true
        view.defaultCameraController.interactionMode = .orbitTurntable
        view.defaultCameraController.inertiaEnabled = true
        view.antialiasingMode = .multisampling4X
        view.isPlaying = true
        view.onClick = { [weak self] point in self?.clicked(point) }
        container.addSubview(view)

        strip.frame = CGRect(x: 0, y: Self.side, width: Self.side, height: stripHeight)
        strip.wantsLayer = true
        strip.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.04).cgColor
        container.addSubview(strip)
        titleLabel.stringValue = recipe.title
        titleLabel.font = .systemFont(ofSize: 12, weight: .semibold)
        titleLabel.textColor = NSColor(hex: accentHex) ?? .orange
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.frame = CGRect(x: 14, y: 7, width: Self.side - 52, height: 16)
        strip.addSubview(titleLabel)
        let close = NSButton(title: "", target: self, action: #selector(closeTapped))
        close.bezelStyle = .inline
        close.isBordered = false
        close.image = NSImage(systemSymbolName: "xmark", accessibilityDescription: "close")?.withSymbolConfiguration(.init(pointSize: 10, weight: .bold))
        close.contentTintColor = NSColor.white.withAlphaComponent(0.55)
        close.frame = CGRect(x: Self.side - 30, y: 3, width: 24, height: 24)
        strip.addSubview(close)

        partLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        partLabel.textColor = .white
        partLabel.alignment = .center
        partLabel.wantsLayer = true
        partLabel.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.55).cgColor
        partLabel.layer?.cornerRadius = 10
        partLabel.isHidden = true
        container.addSubview(partLabel)

        // a slow turn until he touches it, so it reads as 3D at a glance
        built.root.runAction(.repeatForever(.rotateBy(x: 0, y: .pi * 2, z: 0, duration: 24)), forKey: "idle")
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }

    @objc private func closeTapped() { onClose?() }

    /// A click at a point in the view: the part there lights, gets its name on the panel, and Dot hears about it.
    @discardableResult
    func clicked(_ point: CGPoint) -> String? {
        built.root.removeAction(forKey: "idle")
        guard let name = view.part(at: point), let node = built.nodes[name] else { return nil }
        light(node)
        partLabel.stringValue = "  \(name)  "
        partLabel.sizeToFit()
        partLabel.frame = CGRect(x: (Self.side - partLabel.frame.width) / 2, y: 12, width: partLabel.frame.width, height: 22)
        partLabel.isHidden = false
        Log.info("figure: he clicked \"\(name)\" on \"\(recipe.title)\"")
        onPart?(name)
        return name
    }

    private func light(_ node: SCNNode) {
        for other in built.nodes.values { other.geometry?.firstMaterial?.emission.contents = NSColor.black }
        guard let material = node.geometry?.firstMaterial else { return }
        let glow = (material.diffuse.contents as? NSColor ?? .white).withAlphaComponent(1)
        material.emission.contents = glow.blended(withFraction: 0.5, of: .black)
        node.runAction(.sequence([.scale(by: 1.08, duration: 0.12), .scale(by: 1 / 1.08, duration: 0.18)]))
    }

    /// The point in this view where a part's centre shows now (for the self-test and the live check).
    func viewPoint(of name: String, offset: Double = 0) -> CGPoint? {
        guard let node = built.nodes[name] else { return nil }
        let p = view.projectPoint(node.convertPosition(SCNVector3(offset, 0, 0), to: nil))
        return CGPoint(x: CGFloat(p.x), y: CGFloat(p.y))
    }

    func show(at frame: CGRect) {
        setFrame(frame, display: true)
        orderFrontRegardless()
        NSAnimationContext.runAnimationGroup { $0.duration = 0.18; animator().alphaValue = 1 }
    }

    func dismiss() {
        NSAnimationContext.runAnimationGroup({ $0.duration = 0.18; animator().alphaValue = 0 }, completionHandler: { [weak self] in
            self?.view.isPlaying = false
            self?.orderOut(nil)
        })
    }
}

extension OverlayManager {
    /// Where a figure panel goes: beside the anchor (AppKit) when there is one, else on the side of the screen away
    /// from the pointer; always inside the screen's visible frame.
    nonisolated static func figureFrame(anchor: CGRect?, pointer: CGPoint, visible: CGRect, size: CGSize) -> CGRect {
        let margin: CGFloat = 16
        var origin: CGPoint
        if let anchor, !anchor.isNull {
            let right = anchor.maxX + margin + size.width <= visible.maxX
            origin = CGPoint(x: right ? anchor.maxX + margin : anchor.minX - margin - size.width, y: anchor.midY - size.height / 2)
        } else {
            let left = pointer.x > visible.midX
            origin = CGPoint(x: left ? visible.minX + margin * 3 : visible.maxX - margin * 3 - size.width, y: visible.midY - size.height / 2)
        }
        origin.x = min(max(origin.x, visible.minX + margin), visible.maxX - margin - size.width)
        origin.y = min(max(origin.y, visible.minY + margin), visible.maxY - margin - size.height)
        return CGRect(origin: origin, size: size)
    }

    /// Put a figure up; at most two at once (the oldest goes). Returns the panel, or nil when nothing could be built.
    @discardableResult
    func showFigure(_ recipe: FigureRecipe, anchor: CGRect?, accentHex: String, onPart: @escaping (String) -> Void) -> FigurePanel? {
        let panel = FigurePanel(recipe: recipe, accentHex: accentHex)
        for skip in panel.built.skipped { Log.info("figure: \(recipe.title): skipped \(skip)") }
        guard !panel.built.nodes.isEmpty else {
            Log.info("figure: \(recipe.title): no part could be built; nothing shown")
            return nil
        }
        let pointer = NSEvent.mouseLocation
        let screen = (anchor.flatMap { a in NSScreen.screens.first { $0.frame.contains(CGPoint(x: a.midX, y: a.midY)) } })
            ?? NSScreen.screens.first { $0.frame.contains(pointer) } ?? NSScreen.main
        let visible = screen?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1440, height: 900)
        panel.onPart = onPart
        panel.onClose = { [weak self, weak panel] in if let panel { self?.closeFigure(panel) } }
        while figurePanels.count >= 2 { closeFigure(figurePanels[0]) }
        figurePanels.append(panel)
        panel.show(at: Self.figureFrame(anchor: anchor, pointer: pointer, visible: visible, size: panel.frame.size))
        Log.info("figure: \(recipe.title): \(panel.built.nodes.count) parts, \(panel.built.vertices) vertices")
        return panel
    }

    func closeFigure(_ panel: FigurePanel) {
        figurePanels.removeAll { $0 === panel }
        panel.dismiss()
    }

    func closeFigures() {
        for panel in figurePanels { panel.dismiss() }
        figurePanels = []
    }

    /// For the `[on screen]` line: each figure up, with the names of its parts.
    var figureLines: [String] {
        figurePanels.map { "figure \"\($0.recipe.title)\" with parts " + $0.recipe.parts.map(\.name).joined(separator: ", ") }
    }
}
