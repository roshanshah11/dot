// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Dot",
    platforms: [
        // FluidAudio (Parakeet on the Neural Engine) needs macOS 14; ScreenCaptureKit's
        // screenshot API needs 14.2. Both are also what HeyClicky requires.
        .macOS(.v14)
    ],
    products: [
        .executable(name: "Dot", targets: ["Dot"]),
        .library(name: "DotKit", targets: ["DotKit"]),
    ],
    dependencies: [
        .package(url: "https://github.com/FluidInference/FluidAudio.git", exact: "0.15.5"),
    ],
    targets: [
        // Pure logic with no AppKit: tag parsing, consent policy, stream-json decoding,
        // notch geometry, coordinate mapping. Everything here is unit-tested.
        .target(
            name: "DotKit",
            path: "Sources/DotKit",
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
        .executableTarget(
            name: "Dot",
            dependencies: [
                "DotKit",
                .product(name: "FluidAudio", package: "FluidAudio"),
            ],
            path: "Sources/Dot",
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
        .testTarget(
            name: "DotKitTests",
            dependencies: ["DotKit"],
            path: "Tests/DotKitTests",
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
    ]
)
