import XCTest
@testable import DotKit

/// Dot logs in like Atlas (10-22): a saved login goes only to the exact hosts listed for it. Placeholder names only.
final class LoginsTests: XCTestCase {
    let entries = ["jobs/northwind/sam@example.com", "jobs/contoso/sam@example.com", "websites/campus/password",
                   "atlas/apple/AuthKey_TEST", "atlas/bot-token", "laptop/store-passphrase", "jobs/oddshape"]
    let map = ["jobs/northwind/sam@example.com": ["northwind.tal.net"],
               "websites/campus/password": ["login.campus.edu", "sso.campus.edu"],
               "atlas/apple/AuthKey_TEST": ["appleid.apple.com"],
               "laptop/store-passphrase": ["example.com"]]

    func testOnlyLoginFoldersAreLogins() {
        XCTAssertEqual(Logins.entry("jobs/northwind/sam@example.com")?.account, "sam@example.com")
        XCTAssertEqual(Logins.entry("websites/campus/password")?.site, "campus")
        XCTAssertNil(Logins.entry("websites/campus/password")?.account)
        for name in ["atlas/apple/AuthKey_TEST", "atlas/bot-token", "laptop/store-passphrase", "jobs/oddshape", "jobs//x", "cloud/aws/key"] {
            XCTAssertNil(Logins.entry(name), name)
        }
    }

    func testExactHostFills() {
        XCTAssertEqual(Logins.match(host: "northwind.tal.net", entries: entries, map: map), .one(Logins.entry("jobs/northwind/sam@example.com")!))
        XCTAssertEqual(Logins.match(host: "NorthWind.tal.net.", entries: entries, map: map), .one(Logins.entry("jobs/northwind/sam@example.com")!))
        XCTAssertEqual(Logins.match(host: "sso.campus.edu", entries: entries, map: map), .one(Logins.entry("websites/campus/password")!))
    }

    func testLookAlikesGetNothing() {
        for host in ["northwind.careers", "northwind.tal.net.evil.com", "evil-northwind.tal.net", "x.northwind.tal.net",
                     "clubs.campus.edu", "campus.edu", "tal.net"] {
            if case .one = Logins.match(host: host, entries: entries, map: map) { XCTFail(host) }
        }
        // A secret listed in the map by mistake still never fills.
        if case .one = Logins.match(host: "appleid.apple.com", entries: entries, map: map) { XCTFail("atlas key") }
        if case .one = Logins.match(host: "example.com", entries: entries, map: map) { XCTFail("passphrase") }
    }

    func testHttpsOnly() {
        XCTAssertEqual(Logins.host(ofOrigin: "https://northwind.tal.net", bench: false), "northwind.tal.net")
        XCTAssertEqual(Logins.host(ofOrigin: "https://northwind.tal.net:443", bench: false), "northwind.tal.net")
        XCTAssertNil(Logins.host(ofOrigin: "http://northwind.tal.net", bench: false))
        XCTAssertNil(Logins.host(ofOrigin: "https://northwind.tal.net:8443", bench: false))
        XCTAssertNil(Logins.host(ofOrigin: "http://127.0.0.1:8766", bench: false))
        XCTAssertEqual(Logins.host(ofOrigin: "http://127.0.0.1:8766", bench: true), "127.0.0.1")
    }

    func testTwoAccountsOnOneHostAreAmbiguous() {
        let m = ["jobs/northwind/sam@example.com": ["northwind.tal.net"], "jobs/northwind/alex@example.com": ["northwind.tal.net"]]
        if case .several(let both) = Logins.match(host: "northwind.tal.net", entries: ["jobs/northwind/sam@example.com", "jobs/northwind/alex@example.com"], map: m) {
            XCTAssertEqual(both.count, 2)
        } else { XCTFail("ambiguous") }
    }

    func testUnlistedHiringHostOnlySuggests() {
        guard case .none(let hint) = Logins.match(host: "contoso.wd3.myworkdayjobs.com", entries: entries, map: map) else { return XCTFail("filled") }
        XCTAssertTrue(hint?.contains("jobs/contoso/sam@example.com") == true)
        guard case .none(let none) = Logins.match(host: "contoso.example.com", entries: entries, map: map) else { return XCTFail("filled") }
        XCTAssertNil(none)
    }

    func testLoginButtonNames() {
        for n in ["LOGIN", "Log in", "Sign In", "sign in", "Continue", "Next", "Submit"] { XCTAssertTrue(Logins.isLoginButton(n), n) }
        for n in ["Sign up", "Register", "Create account", "Forgot your password?", "Sign in with Google", "Join now"] {
            XCTAssertFalse(Logins.isLoginButton(n), n)
        }
    }

    func testSameOriginAndScrub() {
        XCTAssertTrue(Logins.sameOrigin("https://northwind.tal.net/vx/login", "https://northwind.tal.net:443/x"))
        XCTAssertFalse(Logins.sameOrigin("https://northwind.tal.net/vx/login", "https://evil.example/collect"))
        XCTAssertFalse(Logins.sameOrigin("https://northwind.tal.net/", "http://northwind.tal.net/"))
        XCTAssertEqual(Logins.scrub("the site says: wrong password hunter22", secret: "hunter22"), "the site says: wrong password (hidden)")
    }

    /// No password, its length, or a login-filled field shown as plain text ever reaches a job's look.
    func testSnapshotHidesPasswords() {
        let items = [PageSnapshot.Item(backendId: 1, role: "textbox", name: "Email", value: "sam@example.com"),
                     PageSnapshot.Item(backendId: 2, role: "textbox", name: "Password", value: "••••••••"),
                     PageSnapshot.Item(backendId: 3, role: "textbox", name: "Password", value: "hunter22")]
        let plain = PageSnapshot.format(url: "https://northwind.tal.net/login", title: "Login", items: items, viewportHeight: nil).text
        XCTAssertTrue(plain.contains("\"sam@example.com\""))
        XCTAssertFalse(plain.contains("••"))
        XCTAssertTrue(plain.contains("= (hidden)"))
        let hidden = PageSnapshot.format(url: "https://northwind.tal.net/login", title: "Login", items: items, viewportHeight: nil, hidden: [3]).text
        XCTAssertFalse(hidden.contains("hunter22"))
    }

    func testSingleSessionSites() {
        XCTAssertTrue(SingleSessionSites.covers("northwind.tal.net"))
        XCTAssertFalse(SingleSessionSites.covers("evil-tal.net"))
        XCTAssertFalse(SingleSessionSites.covers("northwind.myworkdayjobs.com"))
    }
}
