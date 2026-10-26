import Compression
import Foundation

/// A read-only zip reader for .xlsx (parity H3): the central directory, then each entry stored or DEFLATE-compressed,
/// inflated with Apple's Compression (raw DEFLATE). No zip64, no encryption: an .xlsx never needs them.
public struct ZipReader {
    public struct Entry { public let name: String; let method: UInt16; let compressedSize: Int; let size: Int; let localOffset: Int }

    public enum Failure: Error, Equatable { case notZip, truncated, unsupported(String), inflate(String) }

    public let entries: [String: Entry]
    private let data: Data

    public init(data: Data) throws {
        self.data = data
        let bytes = [UInt8](data)
        func u16(_ o: Int) -> Int { Int(bytes[o]) | Int(bytes[o + 1]) << 8 }
        func u32(_ o: Int) -> Int { u16(o) | u16(o + 2) << 16 }
        // the end of central directory record: within the last 64 KB + 22 bytes
        guard bytes.count >= 22 else { throw Failure.notZip }
        var eocd = -1
        var i = bytes.count - 22
        let floor = max(0, bytes.count - 22 - 65_535)
        while i >= floor {
            if bytes[i] == 0x50, bytes[i + 1] == 0x4b, bytes[i + 2] == 0x05, bytes[i + 3] == 0x06 { eocd = i; break }
            i -= 1
        }
        guard eocd >= 0 else { throw Failure.notZip }
        let count = u16(eocd + 10)
        var p = u32(eocd + 16)
        var found: [String: Entry] = [:]
        for _ in 0..<count {
            guard p + 46 <= bytes.count, u32(p) == 0x0201_4b50 else { throw Failure.truncated }
            let method = UInt16(u16(p + 10))
            let csize = u32(p + 20), size = u32(p + 24)
            let nameLen = u16(p + 28), extraLen = u16(p + 30), commentLen = u16(p + 32)
            let local = u32(p + 42)
            guard p + 46 + nameLen <= bytes.count else { throw Failure.truncated }
            let name = String(decoding: bytes[(p + 46)..<(p + 46 + nameLen)], as: UTF8.self)
            found[name] = Entry(name: name, method: method, compressedSize: csize, size: size, localOffset: local)
            p += 46 + nameLen + extraLen + commentLen
        }
        entries = found
    }

    public init(url: URL) throws { try self.init(data: Data(contentsOf: url)) }

    /// An entry's bytes, inflated.
    public func read(_ name: String) throws -> Data {
        guard let e = entries[name] else { throw Failure.unsupported("no entry \(name)") }
        let start: Int = try data.withUnsafeBytes { raw in
            let b = raw.bindMemory(to: UInt8.self)
            guard e.localOffset + 30 <= b.count, b[e.localOffset] == 0x50, b[e.localOffset + 1] == 0x4b else { throw Failure.truncated }
            let nameLen = Int(b[e.localOffset + 26]) | Int(b[e.localOffset + 27]) << 8
            let extraLen = Int(b[e.localOffset + 28]) | Int(b[e.localOffset + 29]) << 8
            return e.localOffset + 30 + nameLen + extraLen
        }
        guard start + e.compressedSize <= data.count else { throw Failure.truncated }
        let packed = data.subdata(in: (data.startIndex + start)..<(data.startIndex + start + e.compressedSize))
        switch e.method {
        case 0: return packed
        case 8: return try Self.inflate(packed, size: e.size)
        default: throw Failure.unsupported("compression method \(e.method)")
        }
    }

    public func text(_ name: String) throws -> String { String(decoding: try read(name), as: UTF8.self) }

    static func inflate(_ packed: Data, size: Int) throws -> Data {
        if size == 0 { return Data() }
        var out = Data(count: size)
        let written = out.withUnsafeMutableBytes { dst in
            packed.withUnsafeBytes { src in
                compression_decode_buffer(dst.bindMemory(to: UInt8.self).baseAddress!, size,
                                          src.bindMemory(to: UInt8.self).baseAddress!, packed.count, nil, COMPRESSION_ZLIB)
            }
        }
        guard written == size else { throw Failure.inflate("got \(written) of \(size) bytes") }
        return out
    }
}
