import Foundation

/// A live quote for a stock card ([STOCK:NVDA]): price, change and a month of closes for a
/// sparkline, from Yahoo's chart endpoint. HeyClicky has a StockWidget behind a StockQuoteAPI;
/// Dot draws the same card on the board from this.
enum Quotes {
    struct Quote {
        let symbol: String
        let name: String
        let price: Double
        let previousClose: Double
        let currency: String
        let closes: [Double]
        let asOf: Date
        var change: Double { price - previousClose }
        var changePercent: Double { previousClose > 0 ? change / previousClose * 100 : 0 }
    }

    static func quote(_ symbol: String) async -> Quote? {
        let encoded = symbol.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? symbol
        guard let url = URL(string: "https://query1.finance.yahoo.com/v8/finance/chart/\(encoded)?range=1mo&interval=1d") else { return nil }
        var request = URLRequest(url: url)
        request.timeoutInterval = 6
        request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", forHTTPHeaderField: "User-Agent")
        guard let (data, _) = try? await URLSession.shared.data(for: request),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let chart = object["chart"] as? [String: Any],
              let result = (chart["result"] as? [[String: Any]])?.first,
              let meta = result["meta"] as? [String: Any],
              let price = meta["regularMarketPrice"] as? Double else {
            Log.warn("quote: no data for \(symbol)")
            return nil
        }
        let previous = (meta["chartPreviousClose"] as? Double) ?? (meta["previousClose"] as? Double) ?? price
        let name = (meta["shortName"] as? String) ?? (meta["longName"] as? String) ?? symbol
        let currency = (meta["currency"] as? String) ?? "USD"
        var closes: [Double] = []
        if let indicators = result["indicators"] as? [String: Any], let quotes = (indicators["quote"] as? [[String: Any]])?.first,
           let raw = quotes["close"] as? [Any] {
            closes = raw.compactMap { $0 as? Double }
        }
        let stamp = (meta["regularMarketTime"] as? Double).map { Date(timeIntervalSince1970: $0) } ?? Date()
        return Quote(symbol: symbol, name: name, price: price, previousClose: previous, currency: currency, closes: closes, asOf: stamp)
    }

    /// The card's html: name and symbol, the price, the day's change, a month sparkline, the source.
    static func cardHTML(_ q: Quote) -> String {
        let up = q.change >= 0
        let color = up ? "#4cc38a" : "#f06a5e"
        let money = NumberFormatter(); money.numberStyle = .decimal; money.minimumFractionDigits = 2; money.maximumFractionDigits = 2
        let price = money.string(from: NSNumber(value: q.price)) ?? String(format: "%.2f", q.price)
        let change = String(format: "%@%.2f (%@%.2f%%)", up ? "+" : "", q.change, up ? "+" : "", q.changePercent)
        let clock = DateFormatter(); clock.dateFormat = "MMM d, h:mm a"; clock.locale = Locale(identifier: "en_US")
        var spark = ""
        let closes = q.closes.filter { $0 > 0 }
        if closes.count >= 2, let low = closes.min(), let high = closes.max() {
            let w = 360.0, h = 72.0
            let span = max(high - low, 0.01)
            let points = closes.enumerated().map { index, value -> String in
                let x = Double(index) / Double(closes.count - 1) * w
                let y = h - (value - low) / span * (h - 6) - 3
                return String(format: "%.1f,%.1f", x, y)
            }.joined(separator: " ")
            let first = points.split(separator: " ").first ?? ""
            let last = points.split(separator: " ").last ?? ""
            spark = """
            <svg viewBox="0 0 \(Int(w)) \(Int(h))" width="100%" height="72" preserveAspectRatio="none" style="display:block;margin-top:8px">
              <polyline points="\(points)" fill="none" stroke="\(color)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
              <circle cx="\(last.split(separator: ",")[0])" cy="\(last.split(separator: ",")[1])" r="3" fill="\(color)"/>
              <line x1="\(first.split(separator: ",")[0])" y1="\(h - 3)" x2="\(w)" y2="\(h - 3)" stroke="rgba(255,255,255,0.08)"/>
            </svg>
            <div style="display:flex;justify-content:space-between;font-size:11px;opacity:.55;margin-top:2px"><span>one month</span><span>low \(money.string(from: NSNumber(value: low)) ?? "") · high \(money.string(from: NSNumber(value: high)) ?? "")</span></div>
            """
        }
        let name = q.name.replacingOccurrences(of: "<", with: "&lt;")
        return """
        <div class="stock" style="padding:4px 2px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div><div style="font-size:15px;font-weight:600">\(name)</div><div style="font-size:11.5px;opacity:.55">\(q.symbol) · \(q.currency)</div></div>
            <div style="text-align:right"><div style="font-size:26px;font-weight:600;letter-spacing:-0.5px">\(price)</div><div style="font-size:13px;color:\(color);font-weight:600">\(change)</div></div>
          </div>
          \(spark)
          <div class="source" style="margin-top:6px">yahoo finance, \(clock.string(from: q.asOf))</div>
        </div>
        """
    }
}
