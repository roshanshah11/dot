import AppKit
import Carbon
import DotKit

/// Logging in with his saved login (10-22): the page side. The password goes into the field through the DevTools call's
/// own argument, never through page text, a tool's words or the log, and the field never takes focus (a focused password
/// field turns on Secure Input, which silences every key tap on the Mac, Dot's push-to-talk among them).
extension PageDriver {
    struct LoginForm {
        let password: String          // objectIds
        let username: String?
        let submit: String?
        let submitName: String
        let passwordBackend: Int?
        let usernameValue: String
        let formObject: String?
    }

    enum Tick { case ticked, timeout, stopped, gone }

    /// Text a job reads, with the password taken out wherever a page echoed it.
    func scrub(_ text: String) -> String {
        guard let secret else { return text }
        return Logins.scrub(text, secret: secret)
    }

    /// The main frame's origin, from the browser rather than the page's own script.
    func mainOrigin() async -> String? {
        guard let s = sessionId, let tree = await cdp.send("Page.getFrameTree", session: s),
              let frame = (tree["frameTree"] as? [String: Any])?["frame"] as? [String: Any] else { return nil }
        if let origin = frame["securityOrigin"] as? String, origin.hasPrefix("http") { return origin }
        guard let url = frame["url"] as? String, let u = URL(string: url), let scheme = u.scheme, let host = u.host else { return nil }
        return "\(scheme)://\(host)\(u.port.map { ":\($0)" } ?? "")"
    }

    /// His other tabs on this host (not the job's own).
    func otherTabs(onHost host: String) async -> Int {
        await pageTabs().filter { $0.id != targetId && URL(string: $0.url)?.host.map(Logins.normalize) == host }.count
    }

    private func call(_ objectId: String, _ function: String, args: [Any] = []) async -> [String: Any]? {
        guard let s = sessionId else { return nil }
        let r = await cdp.send("Runtime.callFunctionOn", ["objectId": objectId, "functionDeclaration": function,
                                                          "arguments": args.map { ["value": $0] }, "returnByValue": true, "awaitPromise": true], session: s)
        return (r?["result"] as? [String: Any])?["value"] as? [String: Any]
    }

    static let findLoginJS = """
    (function(){
      function vis(e){ const r=e.getBoundingClientRect(); if(r.width<2||r.height<2) return false; const s=getComputedStyle(e); return s.visibility!=='hidden'&&s.display!=='none'&&s.opacity!=='0'; }
      const pws=[...document.querySelectorAll('input[type=password]')].filter(vis);
      if(pws.length!==1) return [null, null, null, pws.length];
      const pw=pws[0];
      const scope=pw.form||pw.closest('form')||document;
      const texts=[...scope.querySelectorAll('input')].filter(e=>vis(e)&&/^(text|email|tel|)$/.test((e.getAttribute('type')||'').toLowerCase()));
      let user=texts.find(e=>/username|email/.test((e.getAttribute('autocomplete')||'').toLowerCase()))||texts.find(e=>(e.getAttribute('type')||'').toLowerCase()==='email');
      if(!user){ const before=texts.filter(e=>e.compareDocumentPosition(pw)&Node.DOCUMENT_POSITION_FOLLOWING); user=before[before.length-1]||null; }
      const btns=[...scope.querySelectorAll('button,input[type=submit],input[type=button],input[type=image],[role=button]')].filter(vis);
      return [pw, user, pw.form||null, 1, ...btns];
    })()
    """

    static let describeLoginJS = """
    function(){
      const a=this, pw=a[0], user=a[1], form=a[2];
      function nm(x){ let n=x.getAttribute('aria-label')||''; if(!n) n=(x.innerText||'').trim(); if(!n&&x.tagName==='INPUT'&&x.type!=='password') n=x.value||''; if(!n) n=x.getAttribute('title')||''; return n.replace(/\\s+/g,' ').trim().slice(0,60); }
      if(!pw) return {count: a[3]};
      return {count: 1, newPassword: /new-password/i.test(pw.getAttribute('autocomplete')||''), userValue: user ? String(user.value||'') : '',
              formAction: form ? form.action : '', buttons: a.slice(4).map(b=>({name: nm(b), formAction: b.formAction || ''}))};
    }
    """

    /// The page's one login form: a single visible password field (not a new one), its username field, and the control
    /// that logs in. Its form and button send to this page's own origin.
    func findLoginForm(origin: String) async -> (form: LoginForm?, problem: String?) {
        guard let s = sessionId else { return (nil, "no page yet: open the login page first") }
        guard let r = await cdp.send("Runtime.evaluate", ["expression": Self.findLoginJS, "returnByValue": false], session: s),
              let arrayId = (r["result"] as? [String: Any])?["objectId"] as? String,
              let info = await callOn(arrayId, Self.describeLoginJS) else { return (nil, "couldn't read the page") }
        let count = (info["count"] as? NSNumber)?.intValue ?? 0
        if count == 0 { return (nil, "no login form on this page (no password field)") }
        if count > 1 { return (nil, "more than one password field here, so it isn't a plain login") }
        if info["newPassword"] as? Bool == true { return (nil, "this form makes a new password (a sign-up or a change), not a login") }
        if let action = info["formAction"] as? String, !action.isEmpty, !action.hasPrefix("javascript:"), !Logins.sameOrigin(action, origin) {
            return (nil, "this form sends to another site (\(URL(string: action)?.host ?? "?")), so dot won't fill it")
        }
        let buttons = (info["buttons"] as? [[String: Any]]) ?? []
        let picks = buttons.enumerated().filter { Logins.isLoginButton($0.element["name"] as? String ?? "") }
        guard let pick = picks.first else { return (nil, "no log in button on this form") }
        if let fa = pick.element["formAction"] as? String, !fa.isEmpty, !fa.hasPrefix("javascript:"), !Logins.sameOrigin(fa, origin) {
            return (nil, "the log in button sends to another site, so dot won't fill it")
        }
        guard let props = await cdp.send("Runtime.getProperties", ["objectId": arrayId, "ownProperties": true], session: s),
              let list = props["result"] as? [[String: Any]] else { return (nil, "couldn't read the page") }
        func object(_ index: Int) -> String? {
            let p = list.first { $0["name"] as? String == String(index) }
            let v = p?["value"] as? [String: Any]
            return v?["subtype"] as? String == "null" ? nil : v?["objectId"] as? String
        }
        guard let pw = object(0) else { return (nil, "couldn't read the password field") }
        var backend: Int?
        if let d = await cdp.send("DOM.describeNode", ["objectId": pw], session: s), let node = d["node"] as? [String: Any] {
            backend = (node["backendNodeId"] as? NSNumber)?.intValue
        }
        return (LoginForm(password: pw, username: object(1), submit: object(4 + pick.offset), submitName: pick.element["name"] as? String ?? "log in",
                          passwordBackend: backend, usernameValue: info["userValue"] as? String ?? "", formObject: object(2)), nil)
    }

    static let setValueJS = """
    function(v){
      const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
      d.set.call(this, v);
      this.dispatchEvent(new Event('input',{bubbles:true}));
      this.dispatchEvent(new Event('change',{bubbles:true}));
      return {n: String(this.value).length};
    }
    """

    /// Fills the username (when known and not already there) and the password, with no focus. Returns a problem or nil.
    func fillLogin(_ form: LoginForm, account: String?, password: String) async -> String? {
        secret = password
        if let b = form.passwordBackend { secretNodes.insert(b) }
        if let user = form.username, let account, form.usernameValue.lowercased() != account.lowercased() {
            guard (await call(user, Self.setValueJS, args: [account]))?["n"] as? Int == account.count else { return "the username field didn't take it" }
        }
        let n = (await call(form.password, Self.setValueJS, args: [password]))?["n"] as? Int
        if n != password.count { return "the password field didn't take it" }
        // A form that enables its button only on real typing: type it once, then let go of the field at once.
        if let submit = form.submit, (await callOn(submit, "function(){ return {off: !!this.disabled || this.getAttribute('aria-disabled') === 'true'}; }"))?["off"] as? Bool == true,
           let s = sessionId {
            _ = await callOn(form.password, "function(){ this.value=''; this.focus(); return {}; }")
            _ = await cdp.send("Input.insertText", ["text": password], session: s)
            _ = await callOn(form.password, Self.blurJS)
        }
        if IsSecureEventInputEnabled() { log("page: secure input is on after the login fill (comet holds it); keys taps may be quiet until it lets go") }
        return nil
    }

    /// Let go of a focused password field, through shadow roots and same-origin frames (~/bin/comet-blur-password.js).
    static let blurJS = """
    function(){
      function deep(d){ let a=d.activeElement; while(a){ if(a.shadowRoot&&a.shadowRoot.activeElement){a=a.shadowRoot.activeElement;continue;} if(a.tagName==='IFRAME'){ try{ const inner=a.contentDocument; if(inner&&inner.activeElement){a=inner.activeElement;continue;} }catch(e){} } break; } return a; }
      const a=deep(document); if(a&&a.tagName==='INPUT'&&a.type==='password') a.blur(); this.blur&&this.blur(); return {};
    }
    """

    /// The visible robot box (reCAPTCHA's checkbox, hCaptcha's, Turnstile), as a point on screen; nil when there is none.
    /// The invisible reCAPTCHA badge doesn't count.
    func robotBox() async -> CGPoint? {
        let js = """
        (function(){
          function vis(e){ const r=e.getBoundingClientRect(); if(r.width<20||r.height<20) return false; const s=getComputedStyle(e); return s.visibility!=='hidden'&&s.display!=='none'&&s.opacity!=='0'; }
          const f=[...document.querySelectorAll('iframe')].find(f=>{ const src=f.src||''; return vis(f) && !f.closest('.grecaptcha-badge') && !/size=invisible/.test(src) &&
            (/recaptcha\\/(api2|enterprise)\\/anchor/.test(src) || (/hcaptcha\\.com/.test(src) && /frame=checkbox/.test(src)) || /challenges\\.cloudflare\\.com/.test(src) || /dot-bench-robot/.test(src+' '+(f.title||''))); });
          if(!f) return null;
          f.scrollIntoView({block:'center', inline:'nearest', behavior:'instant'});
          const r=f.getBoundingClientRect();
          return {x: r.left + Math.min(27, r.width/2), y: r.top + r.height/2, chromeTop: outerHeight - innerHeight};
        })()
        """
        guard let box = await evaluate(js) as? [String: Any], let x = box["x"] as? Double, let y = box["y"] as? Double else { return nil }
        return await screenPoint(x: x, y: y, chromeTop: (box["chromeTop"] as? Double) ?? 80)
    }

    /// Waits for his tick: the box's response field gets a value. Every half second, up to `seconds`; leaves at once when
    /// the job stops or the tab is gone.
    func waitForTick(seconds: Double, keepGoing: () -> Bool) async -> Tick {
        let js = """
        (function(){
          return [...document.querySelectorAll('[name="g-recaptcha-response"],[name="h-captcha-response"],[name="cf-turnstile-response"]')]
            .some(e=>String(e.value||'').length>0);
        })()
        """
        let deadline = Date().addingTimeInterval(seconds)
        var misses = 0
        while Date() < deadline {
            guard keepGoing() else { return .stopped }
            if let done = await evaluate(js, timeout: 1) as? Bool {
                misses = 0
                if done { return .ticked }
            } else {
                misses += 1
                if misses >= 3 { return .gone }
            }
            try? await Task.sleep(nanoseconds: 500_000_000)
        }
        return .timeout
    }

    /// Right before the press: the same origin, the password still in its field, the button there and on top.
    func stillReady(_ form: LoginForm, origin: String, length: Int) async -> Bool {
        guard let now = await mainOrigin(), Logins.sameOrigin(now, origin) else { return false }
        guard (await callOn(form.password, "function(){ return {n: this.isConnected ? String(this.value).length : -1}; }"))?["n"] as? Int == length else { return false }
        return form.submit != nil
    }

    /// Presses the log in control once: a real click when it's on top, else the form's own submit with that button.
    func pressLogin(_ form: LoginForm) async -> Bool {
        guard let submit = form.submit else { return false }
        if let info = await callOn(submit, Self.elementInfo), info["onTop"] as? Bool == true,
           let x = info["x"] as? Double, let y = info["y"] as? Double, await mouseClick(x: x, y: y) {
            await settle(limit: 8)
            return true
        }
        let r = await callOn(submit, "function(){ const f=this.form||this.closest('form'); if(f&&f.requestSubmit){ try{ f.requestSubmit(this.type==='submit'?this:undefined); return {ok:true}; }catch(e){} } this.click(); return {ok:true}; }")
        await settle(limit: 8)
        return r?["ok"] as? Bool == true
    }

    /// After the press: still on a login form with a password field means it didn't take; the page's own error line.
    func loginOutcome() async -> (loggedIn: Bool, says: String) {
        let js = """
        (function(){
          function vis(e){ const r=e.getBoundingClientRect(); if(r.width<2||r.height<2) return false; const s=getComputedStyle(e); return s.visibility!=='hidden'&&s.display!=='none'; }
          const pw=[...document.querySelectorAll('input[type=password]')].filter(vis);
          const err=[...document.querySelectorAll('[role=alert],.error,.errors,.alert,.alert-danger,.validation-summary-errors,[aria-live=assertive],.message.error')]
            .filter(vis).map(e=>e.innerText.replace(/\\s+/g,' ').trim()).filter(Boolean).join(' / ').slice(0,200);
          return {pw: pw.length, err: err, title: document.title};
        })()
        """
        let r = await evaluate(js) as? [String: Any] ?? [:]
        let pw = (r["pw"] as? NSNumber)?.intValue ?? 0
        return (pw == 0, scrub(r["err"] as? String ?? ""))
    }

    /// Empties the password field (after a failure or a timeout), so nothing is left filled for a later read.
    func clearPassword(_ form: LoginForm) async {
        _ = await call(form.password, Self.setValueJS, args: [""])
    }
}
