#!/usr/bin/env swift
// The covered check's bench helper (G5): put something over a point, then ask the running Dot with `Dot --occlusion x,y`.
//
//   swift scripts/cover-window.swift cover x y [seconds]    a floating 300x300 window centred on the point (a real cover)
//   swift scripts/cover-window.swift overlay [seconds]      a full-screen, click-through, nearly clear window, like Cua
//                                                            Driver's invisible overlay (it must NOT count as covering)
//
// x, y are screen points with a top-left origin. It exits by itself after `seconds` (default 60).
import AppKit

let args = Array(CommandLine.arguments.dropFirst())
guard let mode = args.first, mode == "cover" || mode == "overlay" else {
    print("usage: cover-window.swift cover <x> <y> [seconds] | overlay [seconds]")
    exit(2)
}
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let screen = NSScreen.screens.first!
let primaryHeight = screen.frame.height
var window: NSWindow
var seconds: Double = 60
if mode == "cover" {
    guard args.count >= 3, let x = Double(args[1]), let y = Double(args[2]) else { print("cover needs x y"); exit(2) }
    if args.count >= 4, let s = Double(args[3]) { seconds = s }
    let rect = NSRect(x: x - 150, y: primaryHeight - y - 150, width: 300, height: 300)
    window = NSWindow(contentRect: rect, styleMask: [.titled], backing: .buffered, defer: false)
    window.title = "cover-window"
    window.level = .floating
    window.backgroundColor = .systemOrange
} else {
    if args.count >= 2, let s = Double(args[1]) { seconds = s }
    window = NSWindow(contentRect: screen.frame, styleMask: [.borderless], backing: .buffered, defer: false)
    window.level = .screenSaver
    window.backgroundColor = NSColor.black.withAlphaComponent(0.01)
    window.isOpaque = false
    window.ignoresMouseEvents = true
    window.hasShadow = false
}
window.orderFrontRegardless()
print("cover-window: \(mode) up for \(Int(seconds)) s (pid \(ProcessInfo.processInfo.processIdentifier))")
DispatchQueue.main.asyncAfter(deadline: .now() + seconds) { exit(0) }
app.run()
