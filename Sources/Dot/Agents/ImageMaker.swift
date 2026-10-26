import AppKit
import DotKit
import Foundation

/// Pictures for agents (parity AG-14): one OpenRouter image-output model, PNGs saved into the agent's output/. The key is
/// OPENROUTER_API_KEY from the environment or his secrets file (config `imageKeyFile`); the model is the first of
/// `imageModels` OpenRouter still lists with image output, else its newest image model, checked once a day.
@MainActor
final class ImageMaker {
    static let shared = ImageMaker()

    struct Made { let file: URL; let model: String; let bytes: Int; let costUSD: Double }

    private var model: String?
    private var modelCheckedAt = Date.distantPast
    private let session: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.timeoutIntervalForRequest = 180
        c.timeoutIntervalForResource = 190
        return URLSession(configuration: c)
    }()

    static func key(_ config: DotConfig) -> String? {
        if let key = ProcessInfo.processInfo.environment["OPENROUTER_API_KEY"], !key.isEmpty { return key }
        guard let text = try? String(contentsOfFile: DotConfig.expand(config.imageKeyFile), encoding: .utf8) else { return nil }
        return DotEnv.value("OPENROUTER_API_KEY", in: text)
    }

    func make(_ request: ImageRequest, into folder: URL, config: DotConfig, done: @escaping (Result<Made, ImageRequest.Problem>) -> Void) {
        guard let key = Self.key(config) else {
            done(.failure(.init("no OPENROUTER_API_KEY in the environment or \(config.imageKeyFile)")))
            return
        }
        Task { @MainActor in
            let model = await self.currentModel(config)
            let started = Date()
            var http = URLRequest(url: URL(string: "https://openrouter.ai/api/v1/chat/completions")!)
            http.httpMethod = "POST"
            http.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
            http.setValue("application/json", forHTTPHeaderField: "Content-Type")
            http.setValue("Dot", forHTTPHeaderField: "X-Title")
            var body = request.body(model: model)
            body["usage"] = ["include": true]
            http.httpBody = try? JSONSerialization.data(withJSONObject: body)
            let reply: [String: Any]
            do {
                let (data, _) = try await self.session.data(for: http)
                reply = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? ["error": ["message": "an unreadable reply"]]
            } catch {
                Log.warn("image: \(model) failed: \(error.localizedDescription)")
                done(.failure(.init("the image model didn't answer (\(error.localizedDescription))")))
                return
            }
            switch ImageRequest.images(in: reply) {
            case .failure(let problem):
                Log.warn("image: \(model): \(problem.why)")
                done(.failure(problem))
            case .success(let images):
                guard let png = Self.png(images[0]) else { done(.failure(.init("the image came back in a format Dot can't save"))); return }
                let file = Self.freeName(request.file, in: folder)
                do {
                    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                    try png.write(to: file, options: .atomic)
                } catch {
                    done(.failure(.init("couldn't save it: \(error.localizedDescription)")))
                    return
                }
                let cost = (reply["usage"] as? [String: Any])?["cost"] as? Double ?? 0
                Log.info("image: \(model) made \(file.lastPathComponent) (\(png.count / 1024) KB, $\(String(format: "%.3f", cost)), \(Int(Date().timeIntervalSince(started))) s)")
                done(.success(Made(file: file, model: model, bytes: png.count, costUSD: cost)))
            }
        }
    }

    /// The model, re-checked against OpenRouter's list once a day; the first preferred one when the list can't be read.
    private func currentModel(_ config: DotConfig) async -> String {
        if let model, Date().timeIntervalSince(modelCheckedAt) < 86400 { return model }
        var picked = config.imageModels.first ?? "google/gemini-nano-banana-2.1"
        if let (data, _) = try? await session.data(from: URL(string: "https://openrouter.ai/api/v1/models")!),
           let list = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["data"] as? [[String: Any]],
           let found = ImageRequest.pickModel(preferred: config.imageModels, models: list) {
            picked = found
        }
        if picked != model { Log.info("image: model \(picked)") }
        model = picked
        modelCheckedAt = Date()
        return picked
    }

    /// PNG bytes as they came, or the picture converted to PNG (some models send JPEG or WebP).
    static func png(_ data: Data) -> Data? {
        if data.starts(with: [0x89, 0x50, 0x4E, 0x47]) { return data }
        guard let rep = NSBitmapImageRep(data: data) else { return nil }
        return rep.representation(using: .png, properties: [:])
    }

    /// `name`, or `name-2.png`, `name-3.png` when taken: a picture never replaces an earlier one.
    static func freeName(_ name: String, in folder: URL) -> URL {
        var url = folder.appendingPathComponent(name)
        let stem = url.deletingPathExtension().lastPathComponent
        var n = 2
        while FileManager.default.fileExists(atPath: url.path) {
            url = folder.appendingPathComponent("\(stem)-\(n).png")
            n += 1
        }
        return url
    }
}
