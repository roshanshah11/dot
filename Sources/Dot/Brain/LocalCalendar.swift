import DotKit
import EventKit
import Foundation

/// This Mac's own calendar through EventKit (the basics pass, 2026-10-18). Atlas's copy comes from the other
/// MacBook and froze for four days while it was offline (Oct 14 to 18), so "no dinner tonight" and "no practice
/// today" were wrong. Every account added to macOS Calendar is in here, live. Until he grants access, Dot uses
/// Atlas's copy and says how old it is.
@MainActor
final class LocalCalendar {
    private let store = EKEventStore()
    private(set) var granted = false

    var status: EKAuthorizationStatus { EKEventStore.authorizationStatus(for: .event) }

    /// Ask once (macOS shows the prompt the first time only); afterwards just read the status.
    func requestAccess() {
        switch status {
        case .fullAccess:
            granted = true
            Log.info("calendar: this mac's calendar is readable")
        case .notDetermined:
            Log.info("calendar: asking for calendar access (his click; atlas's copy until then)")
            store.requestFullAccessToEvents { [weak self] ok, error in
                DispatchQueue.main.async {
                    guard let self else { return }
                    self.granted = ok
                    if ok { self.store.reset() }
                    Log.info("calendar: access \(ok ? "granted" : "not granted")\(error.map { " (\($0.localizedDescription))" } ?? "")")
                }
            }
        default:
            granted = false
            Log.info("calendar: no access (status \(status.rawValue)); atlas's copy is used")
        }
    }

    /// Events from now's day start through `days` days, every calendar.
    func items(days: Int, now: Date = Date()) -> [CalendarItem]? {
        guard granted || status == .fullAccess else { return nil }
        let start = Calendar.current.startOfDay(for: now)
        guard let end = Calendar.current.date(byAdding: .day, value: days, to: start) else { return nil }
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: nil)
        return store.events(matching: predicate).map { event in
            CalendarItem(title: event.title ?? "(no title)", start: event.startDate, end: event.endDate, allDay: event.isAllDay,
                         location: event.location ?? "", notes: String((event.notes ?? "").prefix(200)), calendar: event.calendar?.title ?? "")
        }
    }
}
