import FluidAudio
import Foundation

/// NVIDIA Parakeet TDT 0.6B v3 on the Apple Neural Engine through FluidAudio: local,
/// about 0.2 s for a ten-second clip. Models live in FluidAudio's shared cache
/// (`~/Library/Application Support/FluidAudio/Models`), so a Mac that already runs
/// Murmur downloads nothing. After Murmur's ParakeetEngine (MIT, Roshan Shah).
actor Transcriber {
    private var manager: AsrManager?
    private var models: AsrModels?
    private var loading: Task<AsrManager, Error>?
    nonisolated let onDownloadProgress: ((Double) -> Void)?

    init(onDownloadProgress: ((Double) -> Void)? = nil) {
        self.onDownloadProgress = onDownloadProgress
    }

    func warmUp() async throws {
        _ = try await ensureLoaded()
    }

    /// A fresh sliding-window recognizer over the same models: feed it buffers while the key is
    /// held and words arrive as he says them; `finish()` returns the whole utterance.
    func makeStream() async throws -> SlidingWindowAsrManager {
        _ = try await ensureLoaded()
        guard let models else { throw NSError(domain: "Dot", code: 1, userInfo: [NSLocalizedDescriptionKey: "speech models not loaded"]) }
        let config = SlidingWindowAsrConfig(chunkSeconds: 4.0, hypothesisChunkSeconds: 0.8, leftContextSeconds: 1.5, rightContextSeconds: 1.0,
                                            minContextForConfirmation: 4.0, confirmationThreshold: 0.85)
        let stream = SlidingWindowAsrManager(config: config)
        try await stream.loadModels(models)
        return stream
    }

    func transcribe(wavURL: URL) async throws -> String {
        let asr = try await ensureLoaded()
        var state = try TdtDecoderState()
        let result = try await asr.transcribe(wavURL, decoderState: &state, language: nil)
        return result.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func keep(_ models: AsrModels) { self.models = models }

    private func ensureLoaded() async throws -> AsrManager {
        if let manager { return manager }
        if let loading { return try await loading.value }
        let progress = onDownloadProgress
        let task = Task { () throws -> AsrManager in
            let models = try await AsrModels.downloadAndLoad(version: .v3) { p in
                progress?(p.fractionCompleted)
            }
            let asr = AsrManager(config: .default)
            try await asr.loadModels(models)
            await self.keep(models)
            return asr
        }
        loading = task
        do {
            let asr = try await task.value
            manager = asr
            loading = nil
            return asr
        } catch {
            loading = nil
            throw error
        }
    }
}
