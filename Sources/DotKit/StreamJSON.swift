import Foundation

/// What a `claude -p --output-format stream-json` line means to Dot.
public enum StreamEvent: Equatable {
    case systemInit(sessionId: String, model: String?)
    case systemStatus
    case textDelta(String)
    case toolInputDelta
    case contentBlockStart(kind: String, toolName: String?)
    case assistantText(String)
    case toolUse(id: String, name: String, input: [String: AnyCodableValue])
    case toolResult(content: String, isError: Bool)
    case permissionRequest(PermissionRequest)
    case controlResponse(requestId: String?, subtype: String)
    case result(ResultInfo)
    case rateLimit(status: String, resetsAt: Double?, kind: String?)
    case other(type: String)
}

public struct PermissionRequest: Equatable {
    public let requestId: String
    public let toolName: String
    public let input: [String: AnyCodableValue]
    public let description: String?
    public let toolUseId: String?

    public init(requestId: String, toolName: String, input: [String: AnyCodableValue], description: String?, toolUseId: String?) {
        self.requestId = requestId
        self.toolName = toolName
        self.input = input
        self.description = description
        self.toolUseId = toolUseId
    }

    public var toolRequest: ToolRequest {
        ToolRequest(toolName: toolName, input: input, description: description)
    }
}

public struct ResultInfo: Equatable {
    public let sessionId: String?
    public let subtype: String
    public let isError: Bool
    public let costUSD: Double
    public let durationMs: Int
    public let durationApiMs: Int
    public let numTurns: Int
    public let inputTokens: Int
    public let outputTokens: Int
    public let cacheReadTokens: Int
    public let cacheCreationTokens: Int
    public let resultText: String?

    public init(sessionId: String?, subtype: String, isError: Bool, costUSD: Double, durationMs: Int, durationApiMs: Int,
                numTurns: Int, inputTokens: Int, outputTokens: Int, cacheReadTokens: Int, cacheCreationTokens: Int, resultText: String?) {
        self.sessionId = sessionId
        self.subtype = subtype
        self.isError = isError
        self.costUSD = costUSD
        self.durationMs = durationMs
        self.durationApiMs = durationApiMs
        self.numTurns = numTurns
        self.inputTokens = inputTokens
        self.outputTokens = outputTokens
        self.cacheReadTokens = cacheReadTokens
        self.cacheCreationTokens = cacheCreationTokens
        self.resultText = resultText
    }
}

public enum StreamJSON {
    public static func parse(line: String) -> StreamEvent? {
        guard let data = line.data(using: .utf8),
              let any = try? JSONSerialization.jsonObject(with: data),
              let object = any as? [String: Any],
              let type = object["type"] as? String else { return nil }

        switch type {
        case "system":
            let subtype = object["subtype"] as? String ?? ""
            if subtype == "init" {
                return .systemInit(sessionId: object["session_id"] as? String ?? "", model: object["model"] as? String)
            }
            return .systemStatus
        case "stream_event":
            guard let event = object["event"] as? [String: Any], let eventType = event["type"] as? String else {
                return .other(type: "stream_event")
            }
            if eventType == "content_block_delta", let delta = event["delta"] as? [String: Any] {
                if delta["type"] as? String == "text_delta", let text = delta["text"] as? String { return .textDelta(text) }
                return .toolInputDelta
            }
            if eventType == "content_block_start", let block = event["content_block"] as? [String: Any] {
                return .contentBlockStart(kind: block["type"] as? String ?? "", toolName: block["name"] as? String)
            }
            return .other(type: "stream_event." + eventType)
        case "assistant":
            guard let message = object["message"] as? [String: Any], let content = message["content"] as? [[String: Any]] else {
                return .other(type: "assistant")
            }
            var text = ""
            for block in content {
                if block["type"] as? String == "text", let t = block["text"] as? String { text += t }
                if block["type"] as? String == "tool_use" {
                    return .toolUse(id: block["id"] as? String ?? "", name: block["name"] as? String ?? "",
                                    input: AnyCodableValue.object(from: block["input"] as? [String: Any] ?? [:]))
                }
            }
            return .assistantText(text)
        case "user":
            guard let message = object["message"] as? [String: Any], let content = message["content"] as? [[String: Any]] else {
                return .other(type: "user")
            }
            for block in content where block["type"] as? String == "tool_result" {
                let body: String
                if let s = block["content"] as? String { body = s }
                else if let parts = block["content"] as? [[String: Any]] {
                    body = parts.compactMap { $0["text"] as? String }.joined(separator: "\n")
                } else { body = "" }
                return .toolResult(content: body, isError: block["is_error"] as? Bool ?? false)
            }
            return .other(type: "user")
        case "control_request":
            guard let request = object["request"] as? [String: Any], request["subtype"] as? String == "can_use_tool" else {
                return .other(type: "control_request")
            }
            return .permissionRequest(PermissionRequest(
                requestId: object["request_id"] as? String ?? "",
                toolName: request["tool_name"] as? String ?? "",
                input: AnyCodableValue.object(from: request["input"] as? [String: Any] ?? [:]),
                description: request["description"] as? String,
                toolUseId: request["tool_use_id"] as? String
            ))
        case "control_response":
            let response = object["response"] as? [String: Any]
            return .controlResponse(requestId: response?["request_id"] as? String, subtype: response?["subtype"] as? String ?? "")
        case "result":
            let usage = object["usage"] as? [String: Any] ?? [:]
            return .result(ResultInfo(
                sessionId: object["session_id"] as? String,
                subtype: object["subtype"] as? String ?? "",
                isError: object["is_error"] as? Bool ?? false,
                costUSD: object["total_cost_usd"] as? Double ?? 0,
                durationMs: object["duration_ms"] as? Int ?? 0,
                durationApiMs: object["duration_api_ms"] as? Int ?? 0,
                numTurns: object["num_turns"] as? Int ?? 0,
                inputTokens: usage["input_tokens"] as? Int ?? 0,
                outputTokens: usage["output_tokens"] as? Int ?? 0,
                cacheReadTokens: usage["cache_read_input_tokens"] as? Int ?? 0,
                cacheCreationTokens: usage["cache_creation_input_tokens"] as? Int ?? 0,
                resultText: object["result"] as? String
            ))
        case "rate_limit_event":
            let info = object["rate_limit_info"] as? [String: Any] ?? [:]
            return .rateLimit(status: info["status"] as? String ?? "", resetsAt: info["resetsAt"] as? Double,
                              kind: info["rateLimitType"] as? String)
        default:
            return .other(type: type)
        }
    }

    /// The user message Dot writes to the session's stdin: text plus optional images.
    public static func userMessage(text: String, images: [(data: Data, mediaType: String)]) -> String {
        var content: [[String: Any]] = []
        for image in images {
            content.append(["type": "image", "source": ["type": "base64", "media_type": image.mediaType,
                                                          "data": image.data.base64EncodedString()]])
        }
        content.append(["type": "text", "text": text])
        let message: [String: Any] = ["type": "user", "message": ["role": "user", "content": content],
                                      "parent_tool_use_id": NSNull(), "session_id": ""]
        return encode(message)
    }

    public static func controlRequest(id: String, subtype: String) -> String {
        encode(["type": "control_request", "request_id": id, "request": ["subtype": subtype]])
    }

    public static func permissionResponse(requestId: String, allow: Bool, updatedInput: [String: AnyCodableValue], message: String?) -> String {
        let inner: [String: Any] = allow
            ? ["behavior": "allow", "updatedInput": updatedInput.mapValues { $0.json }]
            : ["behavior": "deny", "message": message ?? "Not now."]
        return encode(["type": "control_response", "response": ["subtype": "success", "request_id": requestId, "response": inner]])
    }

    static func encode(_ object: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: []),
              let text = String(data: data, encoding: .utf8) else { return "{}" }
        return text
    }
}
