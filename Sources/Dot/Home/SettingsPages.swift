import AppKit
import AVFoundation
import CoreAudio
import DotKit
import SwiftUI

// The settings pages after HeyClicky's: Voice, Microphone, Shortcuts and Cursor, plus the
// pieces every settings page shares. General stays in HomeWindow.swift.

enum HomeStyle {
    static let accent = Color(red: 1.0, green: 0.42, blue: 0.17)
}

/// A settings page: a title, an optional line under it, and its cards at a readable width.
struct SettingsPage<Content: View>: View {
    let title: String
    let subtitle: String?
    let content: Content

    init(_ title: String, subtitle: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.content = content()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.title2.weight(.semibold))
                    if let subtitle { Text(subtitle).font(.callout).foregroundStyle(.secondary) }
                }
                .padding(.top, 30)
                content
            }
            .padding(.horizontal, 24).padding(.bottom, 24)
            .frame(maxWidth: 640, alignment: .leading)
        }
    }
}

/// One card on a settings page.
struct HomeSection<Content: View>: View {
    let title: String
    let content: Content

    init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            content
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 12))
    }
}

/// A toggle with a plain name and a line saying what it changes.
struct SettingToggle: View {
    let title: String
    let detail: String?
    @Binding var isOn: Bool

    init(_ title: String, detail: String? = nil, isOn: Binding<Bool>) {
        self.title = title
        self.detail = detail
        self._isOn = isOn
    }

    var body: some View {
        Toggle(isOn: $isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                if let detail { Text(detail).font(.caption).foregroundStyle(.secondary) }
            }
        }
    }
}

struct HomeBadge: View {
    let text: String
    var color: Color = .secondary

    var body: some View {
        Text(text).font(.system(size: 10, weight: .medium)).foregroundStyle(color)
            .padding(.horizontal, 6).padding(.vertical, 1.5)
            .background(color.opacity(0.12), in: Capsule())
    }
}

/// One choice in a list where exactly one is picked.
struct RadioRow<Trailing: View>: View {
    let title: String
    let detail: String?
    let badges: [String]
    let selected: Bool
    let monospaced: Bool
    let action: () -> Void
    let trailing: Trailing

    init(_ title: String, detail: String? = nil, badges: [String] = [], selected: Bool, monospaced: Bool = false,
         action: @escaping () -> Void, @ViewBuilder trailing: () -> Trailing) {
        self.title = title
        self.detail = detail
        self.badges = badges
        self.selected = selected
        self.monospaced = monospaced
        self.action = action
        self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Button(action: action) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: selected ? "largecircle.fill.circle" : "circle")
                        .font(.system(size: 14)).foregroundStyle(selected ? HomeStyle.accent : Color.secondary)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(title).font(.system(size: 13, design: monospaced ? .monospaced : .default))
                            ForEach(badges, id: \.self) { HomeBadge(text: $0) }
                        }
                        if let detail { Text(detail).font(.caption).foregroundStyle(.secondary) }
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            trailing
        }
        .padding(.vertical, 2)
    }
}

extension RadioRow where Trailing == EmptyView {
    init(_ title: String, detail: String? = nil, badges: [String] = [], selected: Bool, monospaced: Bool = false, action: @escaping () -> Void) {
        self.init(title, detail: detail, badges: badges, selected: selected, monospaced: monospaced, action: action) { EmptyView() }
    }
}

/// How much Dot says before he asks (`chattiness`, DotKit's Chattiness): one row per level, as
/// docs/persona.md describes them.
struct ChattinessPicker: View {
    @Binding var level: Int

    static let levels: [(level: Int, name: String, detail: String)] = [
        (0, "Nothing", "no deadline notices, offers or quips"),
        (1, "Rarely", "deadline notices only, three times as far apart; a quip every 2 hours at most"),
        (2, "Normal", "deadline notices and offers; a quip every 40 minutes at most"),
        (3, "Chatty", "notices and offers twice as often; a quip every 20 minutes at most"),
    ]

    var body: some View {
        ForEach(Self.levels, id: \.level) { row in
            RadioRow(row.name, detail: row.detail, badges: row.level == Chattiness.defaultLevel ? ["default"] : [],
                     selected: level == row.level) { level = row.level }
        }
    }
}

/// The orb's diameter (`orbSize`): three sizes, and the configured one when config.json says otherwise.
struct OrbSizePicker: View {
    @Binding var size: Double

    static let sizes: [(points: Double, name: String, detail: String)] = [
        (20, "Small", "20 pt, its size before the alive pass"),
        (24, "Medium", "24 pt"),
        (28, "Large", "28 pt"),
    ]

    var body: some View {
        ForEach(Self.sizes, id: \.points) { row in
            RadioRow(row.name, detail: row.detail, badges: row.points == 24 ? ["default"] : [], selected: size == row.points) { size = row.points }
        }
        if !Self.sizes.contains(where: { $0.points == size }) {
            RadioRow("\(Int(size)) pt", detail: "set in config.json", selected: true) {}
        }
    }
}

/// Every settings page saves the one config, so Save on any page writes all of it.
struct SettingsSaveBar: View {
    @ObservedObject var model: HomeModel
    /// Edits outside the config that this Save also writes (the dictionary).
    var pending = false
    var onSave: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 10) {
            Button("Save") {
                onSave?()
                model.saveSettings()
            }
            .keyboardShortcut("s", modifiers: .command)
            if let note = model.settingsNote {
                Text(note).font(.caption).foregroundStyle(.secondary)
            } else if pending || model.hasUnsavedSettings {
                Text("unsaved changes").font(.caption).foregroundStyle(.orange)
            }
        }
    }
}

// MARK: - Voice

struct VoicePage: View {
    @ObservedObject var model: HomeModel
    @State private var appleVoices: [AppleVoice] = []
    @State private var bestApple = ""
    @State private var confirmingRelaunch = false

    struct AppleVoice: Identifiable {
        let id: String
        let name: String
        let quality: String
    }

    struct KokoroVoice: Identifiable {
        let id: String
        let about: String
    }

    /// The voices scripts/dot-tts-kokoro.py lists. af_ and am_ are American, bf_ and bm_ British.
    static let kokoroVoices = [
        KokoroVoice(id: "af_heart", about: "American, warm and even; the default"),
        KokoroVoice(id: "af_bella", about: "American, bright and lively"),
        KokoroVoice(id: "af_nicole", about: "American, soft and close, near a whisper"),
        KokoroVoice(id: "am_michael", about: "American, calm and steady"),
        KokoroVoice(id: "am_adam", about: "American, deeper and plainer"),
        KokoroVoice(id: "bf_emma", about: "British, clear and composed"),
        KokoroVoice(id: "bm_george", about: "British, low and measured"),
    ]

    static let sample = "hi, i'm dot. this is how i sound."

    /// The same test DotConfig.resolvedTTSCommand makes before it picks Kokoro.
    private var kokoroInstalled: Bool {
        FileManager.default.isExecutableFile(atPath: DotConfig.expand("~/Dot/tts/venv/bin/python"))
            && DotConfig.bundledScript("dot-tts-kokoro.py", fallback: "~/Dot/tts/dot-tts-kokoro.py") != nil
    }

    private var commandDetail: String {
        let command = model.settings.ttsCommand
        return command.isEmpty ? "ttsCommand in config.json is empty, so this falls back to Apple" : "runs " + command.joined(separator: " ")
    }

    var body: some View {
        SettingsPage("Voice", subtitle: "How Dot sounds when it answers.") {
            HomeSection("Engine") {
                RadioRow("Auto", detail: "Kokoro when it is installed, else Apple", selected: model.settings.ttsProvider == "auto") { model.settings.ttsProvider = "auto" }
                RadioRow("Apple", detail: "Apple's on-device voices only", selected: model.settings.ttsProvider == "apple") { model.settings.ttsProvider = "apple" }
                RadioRow("Command", detail: commandDetail, selected: model.settings.ttsProvider == "command") { model.settings.ttsProvider = "command" }
                HStack(spacing: 6) {
                    Image(systemName: kokoroInstalled ? "checkmark.circle.fill" : "exclamationmark.circle").foregroundStyle(kokoroInstalled ? .green : .orange)
                    Text(kokoroInstalled ? "Kokoro is installed in ~/Dot/tts" : "Kokoro is not installed; scripts/install-tts.sh puts it in ~/Dot/tts")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .padding(.top, 2)
            }
            HomeSection("Kokoro voice") {
                ForEach(Self.kokoroVoices) { voice in
                    RadioRow(voice.id, detail: voice.about, selected: model.settings.ttsVoice == voice.id, monospaced: true) {
                        model.settings.ttsVoice = voice.id
                    } trailing: {
                        Button { model.speakSample?(Self.sample) } label: { Label("preview", systemImage: "play.fill") }
                            .controlSize(.small)
                            .disabled(model.speakSample == nil)
                    }
                }
                HStack {
                    Text("Speed")
                    Slider(value: $model.settings.ttsSpeed, in: 0.7...1.4, step: 0.05).frame(width: 220)
                    Text(String(format: "%.2fx", model.settings.ttsSpeed)).font(.caption.monospaced())
                }
                .padding(.top, 4)
                // A preview speaks with the voice Dot loaded at launch, not the one ticked here.
                Text("kokoro voice and speed apply after dot relaunches").font(.caption).foregroundStyle(.secondary)
            }
            HomeSection("Apple voice") {
                Picker("Voice", selection: $model.settings.voiceIdentifier) {
                    Text(bestApple.isEmpty ? "Best installed" : "Best installed (\(bestApple))").tag(String?.none)
                    if let id = model.settings.voiceIdentifier, !appleVoices.contains(where: { $0.id == id }) {
                        Text("\(id) (not installed)").tag(String?.some(id))
                    }
                    Divider()
                    ForEach(appleVoices) { voice in
                        Text("\(voice.name) · \(voice.quality)").tag(String?.some(voice.id))
                    }
                }
                .frame(maxWidth: 440)
                HStack {
                    Text("Rate")
                    Slider(value: $model.settings.speechRate, in: 0.3...0.7, step: 0.05).frame(width: 220)
                    Text(String(format: "%.2f", model.settings.speechRate)).font(.caption.monospaced())
                }
                Text("Used when the engine is Apple, or Auto without Kokoro.").font(.caption).foregroundStyle(.secondary)
            }
            HomeSection("Relaunch") {
                Text("Dot loads its voice when it starts, so a new voice or speed needs a relaunch.").font(.callout).foregroundStyle(.secondary)
                Button("Relaunch Dot…") { confirmingRelaunch = true }
            }
            SettingsSaveBar(model: model)
        }
        .onAppear(perform: loadVoices)
        .sheet(isPresented: $confirmingRelaunch) { relaunchSheet }
    }

    /// Premium voices first, then enhanced, then the rest, by name within each.
    private func loadVoices() {
        let order = ["premium": 0, "enhanced": 1]
        appleVoices = AppleSpeaker.availableVoices()
            .map { AppleVoice(id: $0.id, name: $0.name, quality: $0.quality) }
            .sorted { (order[$0.quality] ?? 2, $0.name) < (order[$1.quality] ?? 2, $1.name) }
        bestApple = AppleSpeaker.pickVoice(preferred: nil)?.name ?? ""
    }

    private var relaunchSheet: some View {
        let working = model.agents.filter { model.running.contains($0.slug) }.map(\.name)
        return VStack(alignment: .leading, spacing: 12) {
            Text("Relaunch Dot?").font(.title3.weight(.semibold))
            Text("Dot quits and launchd starts it again, so the voice and speed load. Unsaved settings are saved first.")
                .font(.callout).foregroundStyle(.secondary)
            if working.isEmpty {
                Text("No agent is working right now.").font(.callout)
            } else {
                Text(working.count == 1 ? "This agent is working and will be stopped:" : "These agents are working and will be stopped:")
                    .font(.callout.weight(.medium)).foregroundStyle(.orange)
                ForEach(working, id: \.self) { name in
                    Label(name, systemImage: "stop.circle").font(.callout)
                }
            }
            HStack {
                Spacer()
                Button("Cancel") { confirmingRelaunch = false }.keyboardShortcut(.cancelAction)
                Button(working.isEmpty ? "Relaunch" : "Stop and relaunch") {
                    confirmingRelaunch = false
                    model.relaunch()
                }
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(20)
        .frame(width: 420)
    }
}

// MARK: - Microphone

struct MicrophonePage: View {
    @ObservedObject var model: HomeModel
    @State private var devices: [Device] = []
    @State private var systemDefault: AudioDeviceID?

    struct Device: Identifiable {
        let id: AudioDeviceID
        let name: String
        let builtIn: Bool
    }

    var body: some View {
        SettingsPage("Microphone", subtitle: "Which microphone Dot listens with.") {
            HomeSection("Input") {
                RadioRow("Follow the system default", detail: systemDefault.map { "now \(AudioDevices.name(of: $0))" } ?? "no input device right now",
                         selected: model.settings.microphoneName == nil) { model.settings.microphoneName = nil }
                ForEach(devices) { device in
                    RadioRow(device.name, badges: badges(device), selected: model.settings.microphoneName == device.name) {
                        model.settings.microphoneName = device.name
                    }
                }
                if let chosen = model.settings.microphoneName, !devices.contains(where: { $0.name == chosen }) {
                    RadioRow(chosen, detail: "not connected right now", selected: true) {}
                }
            }
            HomeSection("Calls") {
                SettingToggle("Quiet on calls", detail: "stay quiet while another app has the microphone: notices, offers and spoken heads-ups wait",
                              isOn: $model.settings.quietOnCalls)
            }
            SettingsSaveBar(model: model)
        }
        // Devices come and go (a headset, a dock), so the list reads CoreAudio again while it is open.
        .task {
            while !Task.isCancelled {
                refresh()
                try? await Task.sleep(nanoseconds: 3_000_000_000)
            }
        }
    }

    private func badges(_ device: Device) -> [String] {
        var out: [String] = []
        if device.builtIn { out.append("built-in") }
        if device.id == systemDefault { out.append("system default") }
        return out
    }

    private func refresh() {
        devices = AudioDevices.inputDevices().map { Device(id: $0.id, name: $0.name, builtIn: $0.builtIn) }
        systemDefault = AudioDevices.defaultInput
    }
}

// MARK: - Shortcuts

struct ShortcutsPage: View {
    struct Shortcut: Identifiable {
        let action: String
        let how: String
        let keys: [String]
        let detail: String
        var id: String { action }
    }

    /// Fixed chords, read by HotkeyMonitor; double-tap fn belongs to Murmur.
    static let shortcuts = [
        Shortcut(action: "Talk to Dot", how: "hold", keys: ["⌃ control", "⌥ option"], detail: "let go when you are done; Dot answers out loud"),
        Shortcut(action: "Type a question", how: "tap", keys: ["⌃ control", "⌥ option"], detail: "a quick tap with nothing said asks in text"),
        Shortcut(action: "Hand it to an agent", how: "hold", keys: ["⌃ control", "⌥ option", "⇧ shift"], detail: "the request goes to a background agent"),
        Shortcut(action: "Ask about part of the screen", how: "hold and drag", keys: ["⌃ control", "⌥ option"], detail: "draw a box while the keys are down"),
        Shortcut(action: "Dictate a sentence", how: "hold", keys: ["⌃ control", "fn"], detail: "the words go into the field you are in"),
        Shortcut(action: "Record with Murmur", how: "double-tap", keys: ["fn"], detail: "the long recorder; Dot reads its history"),
        Shortcut(action: "Stop Dot", how: "press", keys: ["esc"], detail: "stops speaking and interrupts the turn"),
    ]

    var body: some View {
        SettingsPage("Shortcuts", subtitle: "The keys Dot listens for, anywhere on the Mac.") {
            HomeSection("Keys") {
                ForEach(Self.shortcuts) { shortcut in
                    HStack(alignment: .center, spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(shortcut.action).font(.system(size: 13, weight: .medium))
                            Text(shortcut.detail).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(shortcut.how).font(.caption).foregroundStyle(.secondary)
                        HStack(spacing: 4) {
                            ForEach(Array(shortcut.keys.enumerated()), id: \.offset) { index, key in
                                if index > 0 { Text("+").font(.caption).foregroundStyle(.tertiary) }
                                KeyCap(label: key)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                    if shortcut.id != Self.shortcuts.last?.id { Divider() }
                }
            }
            Text("Run `Dot --help` in a terminal for the command-line flags.").font(.callout).foregroundStyle(.secondary)
        }
    }
}

struct KeyCap: View {
    let label: String

    var body: some View {
        Text(label).font(.system(size: 11.5, weight: .medium, design: .rounded))
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 5))
            .overlay(RoundedRectangle(cornerRadius: 5).stroke(Color.primary.opacity(0.18), lineWidth: 1))
            .shadow(color: .black.opacity(0.12), radius: 0, x: 0, y: 1)
    }
}

// MARK: - Cursor

struct CursorPage: View {
    @ObservedObject var model: HomeModel

    /// The default orange first, then accents that read on light and dark screens.
    static let swatches = ["#ff6b2c", "#ff4d6d", "#ffc53d", "#3ddc97", "#22d3ee", "#4f8cff", "#9b7bff", "#ff6fd8"]

    private var color: Color? { Color(hex: model.settings.pointerColorHex) }

    private var normalized: String {
        let text = model.settings.pointerColorHex.trimmingCharacters(in: .whitespaces).lowercased()
        return text.hasPrefix("#") ? text : "#" + text
    }

    var body: some View {
        SettingsPage("Cursor", subtitle: "The dot beside the pointer: its color and where it shows.") {
            HomeSection("Color") {
                HStack(alignment: .center, spacing: 18) {
                    preview
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 10) {
                            ForEach(Self.swatches, id: \.self) { swatch($0) }
                        }
                        HStack(spacing: 8) {
                            Text("Hex")
                            TextField("#ff6b2c", text: $model.settings.pointerColorHex)
                                .textFieldStyle(.roundedBorder).font(.system(size: 12, design: .monospaced)).frame(width: 96)
                            if color == nil {
                                Text("six hex digits, like #ff6b2c").font(.caption).foregroundStyle(.orange)
                            } else if normalized == Self.swatches[0] {
                                Text("the default").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            HomeSection("Size") {
                OrbSizePicker(size: $model.settings.orbSize)
                Text("the eyes, the bubble and how far it sits from the pointer scale with it").font(.caption).foregroundStyle(.secondary)
            }
            HomeSection("Presence") {
                SettingToggle("Floating companion", detail: "dot beside the cursor", isOn: $model.settings.showCompanion)
                SettingToggle("Show in screen recordings", detail: "Dot's windows appear in recordings and screen shares", isOn: $model.settings.showInRecordings)
                SettingToggle("Notch presence", detail: "a small black tab under the notch when idle, so Dot visibly lives there", isOn: $model.settings.notchPresence)
                SettingToggle("Caption bubble", detail: "a caption bubble beside the orb while it speaks; off keeps the words in the notch", isOn: $model.settings.cursorBubble)
            }
            SettingsSaveBar(model: model)
        }
    }

    private var preview: some View {
        Circle()
            .fill(color ?? Color.secondary.opacity(0.25))
            .frame(width: 48, height: 48)
            .shadow(color: (color ?? .clear).opacity(0.7), radius: 10)
            .frame(width: 64, height: 64)
    }

    private func swatch(_ hex: String) -> some View {
        Button { model.settings.pointerColorHex = hex } label: {
            Circle().fill(Color(hex: hex) ?? .gray).frame(width: 22, height: 22)
                .overlay(Circle().stroke(Color.primary.opacity(normalized == hex ? 0.85 : 0), lineWidth: 2).padding(-4))
                .padding(4)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .help(hex)
    }
}
