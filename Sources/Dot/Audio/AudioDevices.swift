import AudioToolbox
import CoreAudio
import Foundation

/// The Mac's audio devices through CoreAudio: which microphone is the default, whether another
/// app is using it (he is on a call), whether the speakers are muted. HeyClicky reads the same
/// things (its SystemAudioOutputVolume and ClickyCallPresenceDetector types); Dot asks CoreAudio
/// directly, with no audio session of its own.
enum AudioDevices {
    private static func defaultDevice(_ selector: AudioObjectPropertySelector) -> AudioDeviceID? {
        var address = AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var device = AudioDeviceID(0)
        var size = UInt32(MemoryLayout<AudioDeviceID>.size)
        let status = AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &device)
        return status == noErr && device != 0 ? device : nil
    }

    static var defaultInput: AudioDeviceID? { defaultDevice(kAudioHardwarePropertyDefaultInputDevice) }
    static var defaultOutput: AudioDeviceID? { defaultDevice(kAudioHardwarePropertyDefaultOutputDevice) }

    static func name(of device: AudioDeviceID) -> String {
        var address = AudioObjectPropertyAddress(mSelector: kAudioObjectPropertyName, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var name: Unmanaged<CFString>?
        var size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
        let status = withUnsafeMutablePointer(to: &name) { pointer in
            AudioObjectGetPropertyData(device, &address, 0, nil, &size, pointer)
        }
        guard status == noErr, let value = name?.takeRetainedValue() else { return "device \(device)" }
        return value as String
    }

    /// True while any process (this one included) has the device's input stream running.
    static func isRunningSomewhere(_ device: AudioDeviceID) -> Bool {
        var address = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var running = UInt32(0)
        var size = UInt32(MemoryLayout<UInt32>.size)
        return AudioObjectGetPropertyData(device, &address, 0, nil, &size, &running) == noErr && running != 0
    }

    /// Another app has the microphone open: the signal HeyClicky uses for "on a call".
    static func microphoneInUseElsewhere() -> Bool {
        guard let input = defaultInput else { return false }
        return isRunningSomewhere(input)
    }

    /// The speakers are muted or turned all the way down, so a spoken answer would be lost.
    static func outputIsSilent() -> Bool {
        guard let output = defaultOutput else { return false }
        var muteAddress = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyMute, mScope: kAudioObjectPropertyScopeOutput, mElement: kAudioObjectPropertyElementMain)
        var muted = UInt32(0)
        var size = UInt32(MemoryLayout<UInt32>.size)
        if AudioObjectHasProperty(output, &muteAddress), AudioObjectGetPropertyData(output, &muteAddress, 0, nil, &size, &muted) == noErr, muted != 0 { return true }
        var volumeAddress = AudioObjectPropertyAddress(mSelector: kAudioHardwareServiceDeviceProperty_VirtualMainVolume, mScope: kAudioObjectPropertyScopeOutput, mElement: kAudioObjectPropertyElementMain)
        var volume = Float32(1)
        var volumeSize = UInt32(MemoryLayout<Float32>.size)
        if AudioObjectHasProperty(output, &volumeAddress), AudioObjectGetPropertyData(output, &volumeAddress, 0, nil, &volumeSize, &volume) == noErr {
            return volume <= 0.02
        }
        return false
    }

    /// Every input device, with the built-in microphone marked.
    static func inputDevices() -> [(id: AudioDeviceID, name: String, builtIn: Bool)] {
        var address = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDevices, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var size = UInt32(0)
        guard AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size) == noErr else { return [] }
        var devices = [AudioDeviceID](repeating: 0, count: Int(size) / MemoryLayout<AudioDeviceID>.size)
        guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &devices) == noErr else { return [] }
        return devices.compactMap { device in
            var streams = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyStreams, mScope: kAudioObjectPropertyScopeInput, mElement: kAudioObjectPropertyElementMain)
            var streamSize = UInt32(0)
            guard AudioObjectGetPropertyDataSize(device, &streams, 0, nil, &streamSize) == noErr, streamSize > 0 else { return nil }
            var transport = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyTransportType, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
            var kind = UInt32(0)
            var kindSize = UInt32(MemoryLayout<UInt32>.size)
            let builtIn = AudioObjectGetPropertyData(device, &transport, 0, nil, &kindSize, &kind) == noErr && kind == kAudioDeviceTransportTypeBuiltIn
            return (device, name(of: device), builtIn)
        }
    }

    /// Make a device the system's default input (the failover when the chosen mic hears nothing).
    @discardableResult
    static func setDefaultInput(_ device: AudioDeviceID) -> Bool {
        var address = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultInputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
        var value = device
        return AudioObjectSetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, UInt32(MemoryLayout<AudioDeviceID>.size), &value) == noErr
    }
}
