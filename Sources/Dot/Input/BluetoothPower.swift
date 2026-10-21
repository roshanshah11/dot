import Darwin
import Foundation

/// Bluetooth power through IOBluetooth's preference calls (the ones blueutil uses), loaded at run time. It runs as
/// `Dot --bluetooth on|off|state` in a process of its own, so a privacy refusal or a missing symbol can never take Dot
/// down; Hands reads the one word it prints. The first switch asks him once to let Dot use Bluetooth (Info.plist).
enum BluetoothPower {
    private typealias Get = @convention(c) () -> Int32
    private typealias Set = @convention(c) (Int32) -> Void

    /// Prints "on" or "off" (the state after the change) and exits 0; prints "error: ..." and exits 1.
    static func run(_ verb: String) -> Int32 {
        guard let lib = dlopen("/System/Library/Frameworks/IOBluetooth.framework/IOBluetooth", RTLD_LAZY),
              let getSym = dlsym(lib, "IOBluetoothPreferenceGetControllerPowerState"),
              let setSym = dlsym(lib, "IOBluetoothPreferenceSetControllerPowerState") else {
            print("error: IOBluetooth's power calls are missing")
            return 1
        }
        let get = unsafeBitCast(getSym, to: Get.self), set = unsafeBitCast(setSym, to: Set.self)
        switch verb {
        case "on", "off":
            let want: Int32 = verb == "on" ? 1 : 0
            if get() != want {
                set(want)
                // The controller takes a moment to come up or go down.
                let deadline = Date().addingTimeInterval(4)
                while get() != want, Date() < deadline { usleep(100_000) }
            }
        case "state": break
        default:
            print("usage: Dot --bluetooth on|off|state")
            return 2
        }
        print(get() == 1 ? "on" : "off")
        return 0
    }
}
