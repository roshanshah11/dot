import AppKit
import DotKit
import Foundation
import MapKit

/// A place card ([PLACE:coffee near campus]): the nearest few matches from Apple Maps, on a map
/// with numbered pins, each with its address, distance and a link. HeyClicky's PlaceWidget goes
/// through its own backend; Dot asks MapKit on the Mac, which needs no key and no account.
/// "Near me" is the home point in config (Hyde Park) unless the query names somewhere else.
/// Parity WI-02/03: the walk there from home when it is walkable, and a Look Around picture of each
/// place where Apple has one. MapKit gives no ratings or photos (none in its headers), so there are none.
enum Places {
    struct Place: Equatable {
        let name: String
        let category: String
        let address: String
        let phone: String?
        let url: URL?
        let latitude: Double
        let longitude: Double
        let distanceMeters: Double
        /// Apple Maps' walk from home (WI-02), when it is close enough to walk.
        var walkSeconds: Double? = nil
        var walkMeters: Double? = nil
        /// A Look Around picture of it (WI-03), JPEG.
        var lookAround: Data? = nil
        /// The search result itself: routes and Look Around aim at the place, not just its pin.
        var mapItem: MKMapItem? = nil
        var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
    }

    /// The nearest matches for a natural-language query, closest first.
    static func search(_ query: String, near center: CLLocationCoordinate2D, radiusMeters: Double = 6000, limit: Int = 3) async -> [Place] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.region = MKCoordinateRegion(center: center, latitudinalMeters: radiusMeters * 2, longitudinalMeters: radiusMeters * 2)
        request.resultTypes = .pointOfInterest
        let search = MKLocalSearch(request: request)
        guard let response = try? await search.start() else {
            Log.warn("places: no results for \"\(query)\"")
            return []
        }
        let origin = CLLocation(latitude: center.latitude, longitude: center.longitude)
        let places = response.mapItems.compactMap { item -> Place? in
            guard let name = item.name, !name.isEmpty else { return nil }
            let placemark = item.placemark
            let distance = CLLocation(latitude: placemark.coordinate.latitude, longitude: placemark.coordinate.longitude).distance(from: origin)
            let street = [placemark.subThoroughfare, placemark.thoroughfare].compactMap { $0 }.joined(separator: " ")
            let town = [placemark.locality, placemark.administrativeArea].compactMap { $0 }.joined(separator: ", ")
            let address = [street, town].filter { !$0.isEmpty }.joined(separator: ", ")
            return Place(name: name, category: categoryWord(item.pointOfInterestCategory), address: address, phone: item.phoneNumber, url: item.url,
                         latitude: placemark.coordinate.latitude, longitude: placemark.coordinate.longitude, distanceMeters: distance, mapItem: item)
        }
        .sorted { $0.distanceMeters < $1.distanceMeters }
        return Array(places.prefix(limit))
    }

    /// Each place's walk from `origin` (only the walkable ones) and its Look Around picture, all at once. A lookup that
    /// takes longer than its few seconds, or has no answer, is left off the card.
    @MainActor
    static func enrich(_ places: [Place], from origin: CLLocationCoordinate2D) async -> [Place] {
        var out = places
        await withTaskGroup(of: (Int, (seconds: Double, meters: Double)?, Data?).self) { group in
            for (index, place) in places.enumerated() {
                group.addTask { @MainActor in
                    async let walk = walking(from: origin, to: place)
                    async let picture = lookAround(place)
                    return (index, await walk, await picture)
                }
            }
            for await (index, walk, picture) in group {
                out[index].walkSeconds = walk?.seconds
                out[index].walkMeters = walk?.meters
                out[index].lookAround = picture
            }
        }
        return out
    }

    /// Apple Maps' walking ETA from `origin`, or nil when it is too far to walk or doesn't answer in time.
    @MainActor
    static func walking(from origin: CLLocationCoordinate2D, to place: Place, timeout: Double = 4) async -> (seconds: Double, meters: Double)? {
        guard WalkTime.worthAsking(straightMeters: place.distanceMeters) else { return nil }
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: origin))
        request.destination = place.mapItem ?? MKMapItem(placemark: MKPlacemark(coordinate: place.coordinate))
        request.transportType = .walking
        let directions = MKDirections(request: request)
        let response: MKDirections.ETAResponse? = await race(timeout, cancel: { directions.cancel() }) { done in
            directions.calculateETA { response, error in
                if let error { Log.info("places: no walk to \(place.name): \(error.localizedDescription)") }
                done(response)
            }
        }
        return response.map { ($0.expectedTravelTime, $0.distance) }
    }

    /// A small street-level picture of the place from Look Around, JPEG, or nil where Apple has no coverage. Twice the
    /// size it shows at (136 by 84 on the card), so it stays sharp on a Retina screen.
    @MainActor
    static func lookAround(_ place: Place, size: CGSize = CGSize(width: 272, height: 168), timeout: Double = 5) async -> Data? {
        let request = place.mapItem.map { MKLookAroundSceneRequest(mapItem: $0) } ?? MKLookAroundSceneRequest(coordinate: place.coordinate)
        let scene: MKLookAroundScene? = await race(timeout, cancel: { request.cancel() }) { done in
            request.getSceneWithCompletionHandler { scene, _ in done(scene) }
        }
        guard let scene else { return nil }
        let options = MKLookAroundSnapshotter.Options()
        options.size = size
        options.pointOfInterestFilter = .excludingAll
        let snapshotter = MKLookAroundSnapshotter(scene: scene, options: options)
        let shot: MKLookAroundSnapshotter.Snapshot? = await race(timeout, cancel: { snapshotter.cancel() }) { done in
            snapshotter.getSnapshotWithCompletionHandler { shot, _ in done(shot) }
        }
        guard let image = shot?.image, let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else { return nil }
        return rep.representation(using: .jpeg, properties: [.compressionFactor: 0.72])
    }

    /// A completion-handler call's answer, or nil after `seconds` (and `cancel` runs). Exactly one answer either way;
    /// both paths run on the main queue, so `finished` needs no lock.
    @MainActor
    private static func race<T>(_ seconds: Double, cancel: @escaping () -> Void, _ start: (@escaping (T?) -> Void) -> Void) async -> T? {
        await withCheckedContinuation { (continuation: CheckedContinuation<T?, Never>) in
            var finished = false
            DispatchQueue.main.asyncAfter(deadline: .now() + seconds) {
                guard !finished else { return }
                finished = true
                cancel()
                continuation.resume(returning: nil)
            }
            start { value in
                DispatchQueue.main.async {
                    guard !finished else { return }
                    finished = true
                    continuation.resume(returning: value)
                }
            }
        }
    }

    /// "MKPOICategoryCafe" as a word.
    static func categoryWord(_ category: MKPointOfInterestCategory?) -> String {
        guard let raw = category?.rawValue else { return "" }
        let word = raw.replacingOccurrences(of: "MKPOICategory", with: "")
        var out = ""
        for ch in word {
            if ch.isUppercase, !out.isEmpty { out.append(" ") }
            out.append(ch.lowercased())
        }
        return out
    }

    /// A map with numbered pins, as PNG, for the card.
    static func snapshot(of places: [Place], center: CLLocationCoordinate2D, size: CGSize = CGSize(width: 440, height: 200), accentHex: String) async -> Data? {
        guard !places.isEmpty else { return nil }
        var minLat = center.latitude, maxLat = center.latitude, minLon = center.longitude, maxLon = center.longitude
        for place in places {
            minLat = min(minLat, place.latitude); maxLat = max(maxLat, place.latitude)
            minLon = min(minLon, place.longitude); maxLon = max(maxLon, place.longitude)
        }
        let options = MKMapSnapshotter.Options()
        let span = MKCoordinateSpan(latitudeDelta: max((maxLat - minLat) * 1.9, 0.012), longitudeDelta: max((maxLon - minLon) * 1.9, 0.016))
        options.region = MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2), span: span)
        options.size = size
        options.pointOfInterestFilter = .excludingAll
        options.showsBuildings = false
        guard let shot = try? await MKMapSnapshotter(options: options).start() else { return nil }
        let accent = NSColor(hex: accentHex) ?? .orange
        let image = NSImage(size: size, flipped: false) { rect in
            shot.image.draw(in: rect)
            for (index, place) in places.enumerated() {
                let point = shot.point(for: place.coordinate)
                let r: CGFloat = 11
                let circle = NSBezierPath(ovalIn: CGRect(x: point.x - r, y: point.y - r, width: r * 2, height: r * 2))
                NSColor.black.withAlphaComponent(0.25).setFill()
                NSBezierPath(ovalIn: CGRect(x: point.x - r + 1, y: point.y - r - 1.5, width: r * 2, height: r * 2)).fill()
                accent.setFill()
                circle.fill()
                NSColor.white.setStroke()
                circle.lineWidth = 2
                circle.stroke()
                let label = "\(index + 1)" as NSString
                let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 12, weight: .bold), .foregroundColor: NSColor.white]
                let textSize = label.size(withAttributes: attributes)
                label.draw(at: CGPoint(x: point.x - textSize.width / 2, y: point.y - textSize.height / 2), withAttributes: attributes)
            }
            return true
        }
        guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else { return nil }
        return rep.representation(using: .png, properties: [:])
    }

    static func miles(_ meters: Double) -> String {
        let miles = meters / 1609.34
        if miles < 0.1 { return "\(Int(meters * 3.281)) ft" }
        return String(format: miles < 10 ? "%.1f mi" : "%.0f mi", miles)
    }

    /// The card: the map, then one row per place with its number, category, distance, address and links.
    static func cardHTML(query: String, places: [Place], mapPNG: Data?, nearName: String, homeName: String = "hyde park") -> String {
        func esc(_ s: String) -> String { s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: "\"", with: "&quot;") }
        var html = "<div class=\"places\">"
        if let mapPNG {
            html += "<img class=\"map\" alt=\"map\" src=\"data:image/png;base64,\(mapPNG.base64EncodedString())\">"
        }
        // Look Around pictures, numbered like the pins (WI-03)
        let pictures = places.enumerated().compactMap { index, place in place.lookAround.map { (index, $0) } }
        if !pictures.isEmpty {
            html += "<div class=\"looks\">" + pictures.map { index, jpeg in
                "<figure><img alt=\"\(esc(places[index].name))\" src=\"data:image/jpeg;base64,\(jpeg.base64EncodedString())\"><span class=\"n\">\(index + 1)</span></figure>"
            }.joined() + "</div>"
        }
        html += "<ol>"
        for (index, place) in places.enumerated() {
            let mapsQuery = (place.name + " " + place.address).addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? place.name
            var meta: [String] = []
            if !place.category.isEmpty { meta.append(esc(place.category)) }
            if let walk = place.walkSeconds {
                meta.append(WalkTime.phrase(seconds: walk) + (place.walkMeters.map { ", \(miles($0))" } ?? ""))
            } else {
                meta.append(miles(place.distanceMeters))
            }
            var links = ["<a href=\"https://maps.apple.com/?q=\(mapsQuery)&ll=\(place.latitude),\(place.longitude)\">open in maps</a>"]
            if let phone = place.phone, !phone.isEmpty { links.append("<a href=\"tel:\(phone.filter { !$0.isWhitespace })\">\(esc(phone))</a>") }
            if let url = place.url { links.append("<a href=\"\(esc(url.absoluteString))\">website</a>") }
            html += """
            <li><span class="n">\(index + 1)</span><div class="body"><div class="name">\(esc(place.name)) <span class="meta">\(meta.joined(separator: " · "))</span></div>
            <div class="addr">\(esc(place.address))</div><div class="links">\(links.joined(separator: " · "))</div></div></li>
            """
        }
        html += "</ol>"
        let looked = pictures.isEmpty ? "" : " and look around"
        let walked = places.contains { $0.walkSeconds != nil } ? "; walks from \(esc(homeName))" : ""
        html += "<div class=\"source\">apple maps\(looked), near \(esc(nearName)): \"\(esc(query))\"\(walked)</div></div>"
        return html
    }

    /// What Dot says with the card: the first match and how far.
    static func spokenLine(query: String, places: [Place]) -> String {
        guard let first = places.first else { return "i couldn't find \(query) nearby." }
        let more = places.count > 1 ? ", and \(places.count - 1) more on the card" : ""
        let far = first.walkSeconds.map { WalkTime.spoken(seconds: $0) } ?? "\(miles(first.distanceMeters)) away"
        return "closest is \(first.name), \(far)\(more)."
    }

    /// Nil unless the words ask for a place; else the thing and the where (nil where = near home).
    static func parseAsk(_ text: String) -> (what: String, where: String?)? {
        guard let ask = CardAsks.place(text) else { return nil }
        return (ask.what, ask.whereWord)
    }
}
