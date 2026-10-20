#!/usr/bin/env swift
// Samples Dot's window frames from CGWindowList every 250 ms and prints JSON (04: G7, G8 and G9 of the review).
// Swift, because no python3 on this Mac can import Quartz and pyobjc would be a new dependency. Read-only: it never
// touches a window, and works while Dot's windows are kept out of screenshots (sharingType none).
//
//   swift scripts/winframes.swift <seconds> [owner name, default Dot] [interval ms, default 250] > frames.json
//
// Each sample: {"t": seconds since start, "windows": [{"id", "layer", "x", "y", "w", "h", "alpha", "onscreen", "name"}]}.
// Coordinates are CoreGraphics global points (origin at the top left of the main display).
import CoreGraphics
import Foundation

let args = CommandLine.arguments.dropFirst()
guard let seconds = args.first.flatMap(Double.init), seconds > 0 else {
    FileHandle.standardError.write("usage: swift scripts/winframes.swift <seconds> [owner] [interval ms]\n".data(using: .utf8)!)
    exit(2)
}
let owner = args.dropFirst().first ?? "Dot"
let interval = (args.dropFirst(2).first.flatMap(Double.init) ?? 250) / 1000

func sample() -> [[String: Any]] {
    guard let info = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] else { return [] }
    return info.compactMap { window in
        guard (window[kCGWindowOwnerName as String] as? String) == owner,
              let bounds = window[kCGWindowBounds as String] as? [String: Any],
              let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary) else { return nil }
        return [
            "id": window[kCGWindowNumber as String] as? Int ?? 0,
            "layer": window[kCGWindowLayer as String] as? Int ?? 0,
            "x": Double(rect.minX), "y": Double(rect.minY), "w": Double(rect.width), "h": Double(rect.height),
            "alpha": window[kCGWindowAlpha as String] as? Double ?? 1,
            "onscreen": window[kCGWindowIsOnscreen as String] as? Bool ?? false,
            "name": window[kCGWindowName as String] as? String ?? "",
        ]
    }
}

let start = Date()
var samples: [[String: Any]] = []
while Date().timeIntervalSince(start) < seconds {
    let t = (Date().timeIntervalSince(start) * 1000).rounded() / 1000
    samples.append(["t": t, "windows": sample()])
    Thread.sleep(forTimeInterval: interval)
}
let out: [String: Any] = ["owner": owner, "interval": interval, "seconds": seconds, "samples": samples]
let data = try JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
