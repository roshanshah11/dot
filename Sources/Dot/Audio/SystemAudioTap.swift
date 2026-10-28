import AVFoundation
import AudioToolbox
import CoreAudio
import DotKit
import Foundation

/// The other side of a call (call mode, 2026-10-28): what this Mac plays (the Phone app's call in his AirPods, Teams,
/// Zoom, a Meet tab), minus Dot's own sounds, through a Core Audio process tap (macOS 14.2+). The tap joins a private
/// aggregate device clocked by the output device; its IO block turns each buffer into 16 kHz mono, writes it to the
/// call's file and hands it to the recognizer. When the output device changes mid-call (AirPods connecting) the tap is
/// built again on the new one, and the file is padded with silence for the gap so its clock stays the call's clock.
/// The first start asks for System Audio Recording (NSAudioCaptureUsageDescription); without it the tap hears silence.
@available(macOS 14.2, *)
final class SystemAudioTap {
    enum Failure: Error, CustomStringConvertible {
        case status(String, OSStatus), noFormat, noOutput
        var description: String {
            switch self {
            case .status(let what, let code): return "couldn't \(what) (\(code))"
            case .noFormat: return "the tap has no format"
            case .noOutput: return "no output device"
            }
        }
    }

    static let rate = 16_000.0
    private let outFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: rate, channels: 1, interleaved: false)!
    private let queue = DispatchQueue(label: "com.roshan.dot.call-tap", qos: .userInitiated)
    private let lock = NSLock()
    private var tapID = AudioObjectID(kAudioObjectUnknown)
    private var aggregateID = AudioObjectID(kAudioObjectUnknown)
    private var procID: AudioDeviceIOProcID?
    // touched on the tap's queue, swapped under the lock on a rebuild
    private var converter: AVAudioConverter?
    private var inFormat: AVAudioFormat?
    private var file: AVAudioFile?
    private var framesWritten: AVAudioFramePosition = 0
    private var peakLevel: Float = 0
    private var outputListener: AudioObjectPropertyListenerBlock?
    private var outputAddress = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultOutputDevice,
                                                           mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    private(set) var startedAt: Date?
    private(set) var isRunning = false
    /// Each 16 kHz mono buffer, on the tap's queue, in order.
    var onBuffer: ((AVAudioPCMBuffer) -> Void)?

    func start(writingTo url: URL) throws {
        guard !isRunning else { return }
        file = try AVAudioFile(forWriting: url, settings: outFormat.settings, commonFormat: .pcmFormatFloat32, interleaved: false)
        framesWritten = 0
        startedAt = Date()
        do { try build() } catch { teardown(); file = nil; throw error }
        isRunning = true
        let listener: AudioObjectPropertyListenerBlock = { [weak self] _, _ in
            DispatchQueue.main.async { self?.rebuild() }
        }
        AudioObjectAddPropertyListenerBlock(AudioObjectID(kAudioObjectSystemObject), &outputAddress, .main, listener)
        outputListener = listener
        Log.info("call: system audio tap on (\(Int(inFormat?.sampleRate ?? 0)) Hz in, 16 kHz mono to \(url.lastPathComponent))")
    }

    /// Stop; the file is closed and its seconds returned.
    @discardableResult
    func stop() -> TimeInterval {
        guard isRunning else { return 0 }
        isRunning = false
        if let outputListener { AudioObjectRemovePropertyListenerBlock(AudioObjectID(kAudioObjectSystemObject), &outputAddress, .main, outputListener) }
        outputListener = nil
        teardown()
        let seconds = Double(framesWritten) / Self.rate
        queue.sync { file = nil }
        Log.info(String(format: "call: system audio tap off after %.0f s", seconds))
        return seconds
    }

    /// The loudest sample since the last read (0...1): is anything coming through.
    func peak() -> Float {
        lock.lock(); defer { lock.unlock() }
        let p = peakLevel
        peakLevel = 0
        return p
    }

    // MARK: The tap and its device

    private func build() throws {
        let description = CATapDescription(stereoGlobalTapButExcludeProcesses: Self.ownProcessObject().map { [$0] } ?? [])
        description.uuid = UUID()
        description.name = "Dot call ear"
        description.isPrivate = true
        description.muteBehavior = .unmuted
        var tap = AudioObjectID(kAudioObjectUnknown)
        try check(AudioHardwareCreateProcessTap(description, &tap), "make the system audio tap")
        tapID = tap
        var address = AudioObjectPropertyAddress(mSelector: kAudioTapPropertyFormat, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var asbd = AudioStreamBasicDescription()
        var size = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
        try check(AudioObjectGetPropertyData(tap, &address, 0, nil, &size, &asbd), "read the tap's format")
        guard let format = AVAudioFormat(streamDescription: &asbd), let converter = AVAudioConverter(from: format, to: outFormat) else { throw Failure.noFormat }
        converter.downmix = true
        guard let output = AudioDevices.defaultOutput else { throw Failure.noOutput }
        let outputUID = AudioDevices.uid(of: output)
        let aggregate: [String: Any] = [
            kAudioAggregateDeviceNameKey: "Dot call ear",
            kAudioAggregateDeviceUIDKey: "com.roshan.dot.call-ear." + UUID().uuidString,
            kAudioAggregateDeviceMainSubDeviceKey: outputUID,
            kAudioAggregateDeviceIsPrivateKey: true,
            kAudioAggregateDeviceIsStackedKey: false,
            kAudioAggregateDeviceTapAutoStartKey: true,
            kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: outputUID]],
            kAudioAggregateDeviceTapListKey: [[kAudioSubTapDriftCompensationKey: true, kAudioSubTapUIDKey: description.uuid.uuidString]],
        ]
        var device = AudioObjectID(kAudioObjectUnknown)
        try check(AudioHardwareCreateAggregateDevice(aggregate as CFDictionary, &device), "make the tap's device")
        aggregateID = device
        lock.lock(); inFormat = format; self.converter = converter; lock.unlock()
        var proc: AudioDeviceIOProcID?
        try check(AudioDeviceCreateIOProcIDWithBlock(&proc, device, queue) { [weak self] _, input, _, _, _ in
            self?.received(input)
        }, "listen to the tap")
        procID = proc
        try check(AudioDeviceStart(device, proc), "start the tap")
    }

    private func rebuild() {
        guard isRunning else { return }
        teardown()
        do {
            try build()
            Log.info("call: output device changed; the tap follows it (\(Int(inFormat?.sampleRate ?? 0)) Hz)")
        } catch {
            Log.warn("call: the tap didn't follow the new output device: \(error)")
        }
    }

    private func teardown() {
        if aggregateID != kAudioObjectUnknown {
            if let procID {
                AudioDeviceStop(aggregateID, procID)
                AudioDeviceDestroyIOProcID(aggregateID, procID)
            }
            AudioHardwareDestroyAggregateDevice(aggregateID)
        }
        procID = nil
        aggregateID = AudioObjectID(kAudioObjectUnknown)
        if tapID != kAudioObjectUnknown { AudioHardwareDestroyProcessTap(tapID) }
        tapID = AudioObjectID(kAudioObjectUnknown)
        queue.sync {}   // the last IO block has run
        lock.lock(); converter = nil; inFormat = nil; lock.unlock()
    }

    // MARK: Buffers (the tap's queue)

    private func received(_ input: UnsafePointer<AudioBufferList>) {
        lock.lock(); let format = inFormat, converter = converter; lock.unlock()
        guard let format, let converter, let buffer = AVAudioPCMBuffer(pcmFormat: format, bufferListNoCopy: input, deallocator: nil),
              buffer.frameLength > 0 else { return }
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * Self.rate / format.sampleRate) + 64
        guard let out = AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: capacity) else { return }
        var fed = false
        var error: NSError?
        converter.convert(to: out, error: &error) { _, status in
            if fed { status.pointee = .noDataNow; return nil }
            fed = true
            status.pointee = .haveData
            return buffer
        }
        guard error == nil, out.frameLength > 0 else { return }
        padToClock()
        try? file?.write(from: out)
        framesWritten += AVAudioFramePosition(out.frameLength)
        if let samples = out.floatChannelData?[0] {
            var loudest: Float = 0
            for i in 0..<Int(out.frameLength) { loudest = max(loudest, abs(samples[i])) }
            lock.lock(); peakLevel = max(peakLevel, loudest); lock.unlock()
        }
        onBuffer?(out)
    }

    /// After a gap (a rebuild), silence up to the wall clock, so a minute into the file is a minute into the call.
    private func padToClock() {
        guard let startedAt, let file else { return }
        let due = AVAudioFramePosition(Date().timeIntervalSince(startedAt) * Self.rate)
        var missing = due - framesWritten - AVAudioFramePosition(Self.rate)   // a second of slack: normal latency isn't a gap
        guard missing > 0 else { return }
        missing += AVAudioFramePosition(Self.rate)
        while missing > 0 {
            let n = AVAudioFrameCount(min(missing, AVAudioFramePosition(Self.rate)))
            guard let silence = AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: n) else { return }
            silence.frameLength = n   // a new buffer is zeroed
            try? file.write(from: silence)
            framesWritten += AVAudioFramePosition(n)
            missing -= AVAudioFramePosition(n)
        }
    }

    // MARK: Core Audio

    /// Dot's own process as Core Audio knows it: left out of the tap, so its chimes and voice aren't heard as them.
    private static func ownProcessObject() -> AudioObjectID? {
        var pid = ProcessInfo.processInfo.processIdentifier
        var address = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyTranslatePIDToProcessObject,
                                                 mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var object = AudioObjectID(kAudioObjectUnknown)
        var size = UInt32(MemoryLayout<AudioObjectID>.size)
        let status = AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, UInt32(MemoryLayout<pid_t>.size), &pid, &size, &object)
        return status == noErr && object != kAudioObjectUnknown ? object : nil
    }

    private func check(_ status: OSStatus, _ what: String) throws {
        guard status == noErr else { throw Failure.status(what, status) }
    }
}
