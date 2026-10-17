import DotKit
import SwiftUI

/// Colors the Swift views share with the board's cards (IF-01). File kinds take their color from
/// DotKit's FileKindColor, overridable by the token file's "fileColors" once it is loaded.
enum Theme {
    /// The token file's "fileColors" (kind name to hex); empty means FileKindColor's defaults.
    static var fileColors: [String: String] = [:]
    /// The study look, which the notch wears; set from his tokens at launch.
    static var look: StyleTokens.Look = StyleTokens.defaults.look("study")

    static func color(_ c: StyleTokens.RGBA) -> Color { Color(red: c.red, green: c.green, blue: c.blue, opacity: c.alpha) }

    /// The color for a file's kind (VI-05): Excel green, PowerPoint orange-red, Word blue, PDF red.
    static func fileColor(_ url: URL) -> Color? {
        Color(hex: FileKindColor.color(forPath: url.path, overrides: fileColors))
    }
}
