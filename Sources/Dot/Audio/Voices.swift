import DotKit
import FluidAudio
import Foundation

/// Who spoke when in a whole recording, for the after-class transcript (his ask 2026-10-27, at a three-person fireside:
/// "him. he? there are multiple people"). Sortformer first: on that talk's room recording (a host and two founders through
/// one PA) it told the host from the founder, where FluidAudio's pyannote pipeline heard one voice at every setting. The
/// models download once into FluidAudio's own folder. Empty when both fail: the transcript is then one voice, as before.
enum Voices {
    static func turns(in url: URL, talk: Bool) async -> [TranscriptParagraphs.Turn] {
        let sortformer = await sortformerTurns(in: url)
        // at a talk one voice means the voices were merged: the clustering with its two-voice floor gets a try
        if !sortformer.isEmpty, !talk || voices(sortformer) > 1 { return sortformer }
        let clustered = await turns(in: url, minSpeakers: talk ? 2 : nil)
        return voices(clustered) > voices(sortformer) ? clustered : sortformer
    }

    private static func voices(_ turns: [TranscriptParagraphs.Turn]) -> Int { Set(turns.map(\.speaker)).count }

    /// `minSpeakers`: at a talk at least a host and a guest (10-27: with no floor the clustering heard a host and two
    /// founders through one PA as a single voice).
    static func turns(in url: URL, minSpeakers: Int? = nil, maxSpeakers: Int? = 8, threshold: Double? = nil) async -> [TranscriptParagraphs.Turn] {
        let started = Date()
        do {
            var config = OfflineDiarizerConfig()
            config.clustering.minSpeakers = minSpeakers
            config.clustering.maxSpeakers = maxSpeakers
            if let threshold { config.clustering.threshold = threshold }
            let manager = OfflineDiarizerManager(config: config)
            try await manager.prepareModels()
            let result = try await manager.process(url)
            let turns = TranscriptParagraphs.turns(result.segments.map {
                (speaker: $0.speakerId, start: TimeInterval($0.startTimeSeconds), end: TimeInterval($0.endTimeSeconds))
            })
            let voices = Set(turns.map(\.speaker)).count
            Log.info(String(format: "lecture: after class: %d voice(s) in %d turns, told apart in %.0f s", voices, turns.count, Date().timeIntervalSince(started)))
            return turns
        } catch {
            Log.warn("lecture: after class: telling the voices apart failed: \(error)")
            return []
        }
    }

    /// NVIDIA's Sortformer (end to end, up to 4 voices, overlap-aware), the other offline diarizer FluidAudio ships.
    static func sortformerTurns(in url: URL) async -> [TranscriptParagraphs.Turn] {
        let started = Date()
        do {
            let diarizer = OfflineSortformerDiarizer(config: .offlineV2_1)
            try await diarizer.initializeFromHuggingFace()
            let timeline = try diarizer.processComplete(audioFileURL: url)
            let raw = timeline.speakers.values.flatMap { speaker in
                speaker.finalizedSegments.map { (speaker: String($0.speakerIndex), start: TimeInterval($0.startTime), end: TimeInterval($0.endTime)) }
            }
            let turns = TranscriptParagraphs.turns(raw)
            Log.info(String(format: "lecture: after class: sortformer %d voice(s) in %d turns, %.0f s", Set(turns.map(\.speaker)).count, turns.count, Date().timeIntervalSince(started)))
            return turns
        } catch {
            Log.warn("lecture: after class: sortformer failed: \(error)")
            return []
        }
    }
}
