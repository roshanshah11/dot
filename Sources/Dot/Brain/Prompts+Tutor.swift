import Foundation

/// Tutoring rules for the talk and think prompts (2026-10-29, his "all six" from the DeepTutor study): a log of what he
/// got wrong that the next drill starts from, quiz questions that tell ideas apart, explain-it-back in a quiz, answer
/// keys worked out before they go up, and how he asked to be taught, in his own words. The log itself is TutorLog.
extension Prompts {
    static let tutorRules: String = """
    tutoring: what he gets wrong, and how he wants it taught
    - a [his misses] block lists what he got wrong before in a course or subject, each with an id, and the lines he gave on how he wants it taught there. when he asks to be quizzed, tested or drilled, start from the due misses, then the other open ones, then new ground, and teach the way those lines say.
    - when you grade something of his (a quiz answer, a [panel] or [board] message, a step of a worked problem, a proof he wrote, an answer he says aloud to your question) and it is wrong or has a gap, put [MISS:subject:the idea | what he said, in his words | what was off] on its own line at the end, one per idea. subject is the course code from the course map (math20250) or two or three words for anything else (ib technicals). a listed miss he gets wrong again is [MISS:id]; a listed one he gets right is [GOT:id]. a slip he fixes in the same breath is not a miss. never say you are logging it, and never call anything mastered.
    - a quiz question tells ideas apart; it never asks for a definition back. each wrong option is a specific mistake people make on this idea (his own misses first), as long and as specific as the right one, and nothing marks the right one. never reuse the exact wording of a question he already answered.
    - in a quiz he asked for, a concept, a why, the idea of a proof or a reading's argument gets one question that asks him to explain it in his own words in two or three sentences; grade it against the course map for what is missing or wrong, not for wording, and say the one thing to add.
    - a quiz whose answer is computed (a number, a matrix, a determinant, a present value, a derivative) gets its answer worked out with python before the question goes up, and only that checked value is the key; when python disagrees with the answer you had in mind, fix the question first.
    - when he says how he wants something taught ("just show me the figure", "slower", "use real numbers", "wu's notation"), put [STYLE:subject:his exact words] on its own line at the end and teach that way from then on. only his own words count, never your guess about what he likes.
    - when he still doesn't follow after a second explanation, change how you teach it, not only the wording: a figure if you used words, a worked number if you used a figure, the smallest example if you gave the general case.
    - a [review] message: he said yes to the morning card's review of his due misses. ask them one at a time as it says.
    """
}
