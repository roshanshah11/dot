import Foundation

/// Jev, TypeSafe's System One: typed questions in, calibrated answers out, in about 150 ms for
/// two hundredths of a cent. Dot uses it for the quick decisions a voice companion makes
/// constantly: where does this request go, which element did he mean, is this command safe,
/// does what he is looking at touch a deadline. Claude still does the thinking and talking.
final class Jev {
    enum Question {
        case choice(instructions: String, criteria: [String: String])
        case yesNo(instructions: String, yes: String?, no: String?)
    }

    struct Choice {
        let choice: String
        let probabilities: [String: Double]
        let confidence: Double
        var probability: Double { probabilities[choice] ?? 0 }
    }

    enum Answer {
        case choice(Choice)
        case yes(Double)

        var choice: Choice? { if case .choice(let c) = self { return c } else { return nil } }
        var probability: Double? { if case .yes(let p) = self { return p } else { return nil } }
    }

    static let model = "jev-1.13.0"
    private let apiKey: String
    private let endpoint = URL(string: "https://api.typesafe.ai/v1/systemone")!
    private let session: URLSession
    private(set) var calls = 0
    private(set) var failures = 0

    init?(config: DotConfig) {
        guard config.jevEnabled, let key = Self.findKey(file: config.jevKeyFile) else { return nil }
        apiKey = key
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 2.5
        configuration.waitsForConnectivity = false
        session = URLSession(configuration: configuration)
    }

    /// `TYPESAFE_API_KEY` from the environment, else from a dotenv-style file.
    static func findKey(file: String) -> String? {
        if let key = ProcessInfo.processInfo.environment["TYPESAFE_API_KEY"], !key.isEmpty { return key }
        let path = DotConfig.expand(file)
        guard let text = try? String(contentsOfFile: path, encoding: .utf8) else { return nil }
        for line in text.split(separator: "\n") {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard trimmed.hasPrefix("TYPESAFE_API_KEY=") else { continue }
            let value = trimmed.dropFirst("TYPESAFE_API_KEY=".count).trimmingCharacters(in: CharacterSet(charactersIn: "\"' "))
            return value.isEmpty ? nil : value
        }
        return nil
    }

    /// Answers every question against one state; nil on any failure so callers fall back.
    /// The completion runs on the main thread.
    func evaluate(_ label: String, state: [String: Any], questions: [String: Question], timeout: TimeInterval = 1.6,
                  completion: @escaping ([String: Answer]?) -> Void) {
        var wire: [String: Any] = [:]
        for (key, question) in questions {
            switch question {
            case .choice(let instructions, let criteria):
                wire[key] = ["type": "choice", "instructions": instructions, "criteria": criteria]
            case .yesNo(let instructions, let yes, let no):
                var body: [String: Any] = ["type": "noul", "instructions": instructions]
                var criteria: [String: String] = [:]
                if let yes { criteria["true"] = yes }
                if let no { criteria["false"] = no }
                if !criteria.isEmpty { body["criteria"] = criteria }
                wire[key] = body
            }
        }
        let body: [String: Any] = ["model": Self.model, "state": state, "questions": wire]
        guard let data = try? JSONSerialization.data(withJSONObject: body) else { completion(nil); return }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = data
        let started = Date()
        calls += 1
        session.dataTask(with: request) { [weak self] data, response, error in
            let ms = Int(Date().timeIntervalSince(started) * 1000)
            var answers: [String: Answer]?
            if let data, let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode),
               let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let raw = object["answers"] as? [String: Any] {
                var parsed: [String: Answer] = [:]
                for (key, question) in questions {
                    guard let answer = raw[key] as? [String: Any] else { continue }
                    switch question {
                    case .choice:
                        guard let choice = answer["choice"] as? String,
                              let probabilities = answer["probabilities"] as? [String: Double] else { continue }
                        parsed[key] = .choice(Choice(choice: choice, probabilities: probabilities,
                                                     confidence: answer["confidence"] as? Double ?? 0))
                    case .yesNo:
                        guard let p = (answer["noul"] ?? answer["probability"]) as? Double else { continue }
                        parsed[key] = .yes(p)
                    }
                }
                answers = parsed.count == questions.count ? parsed : nil
                let tokens = (object["usage"] as? [String: Any])?["input_tokens"] as? Int ?? 0
                Log.info("jev[\(label)] \(ms) ms, \(tokens) tokens: " + parsed.map { key, value in
                    switch value {
                    case .choice(let c): return "\(key)=\(c.choice) \(String(format: "%.2f", c.probability))/\(String(format: "%.2f", c.confidence))"
                    case .yes(let p): return "\(key)=\(String(format: "%.2f", p))"
                    }
                }.sorted().joined(separator: " "))
            } else {
                self?.failures += 1
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                Log.warn("jev[\(label)] failed in \(ms) ms: \(error?.localizedDescription ?? "http \(status)") \(Log.short(String(data: data ?? Data(), encoding: .utf8) ?? "", 120))")
            }
            DispatchQueue.main.async { completion(answers) }
        }.resume()
    }
}
