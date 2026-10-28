// Dot's call window. Swift calls call.load / check / help / nudge / line / status / clock / ended; the page sends
// ready, end, dial, open and log through the "call" message handler.
(() => {
  const post = (m) => { try { window.webkit.messageHandlers.call.postMessage(m); } catch (e) {} };
  window.onerror = (msg, src, line) => post({ type: 'log', text: `${msg} @${line}` });
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  let lastSide = null;

  window.call = {
    load(d) {
      $('who').textContent = d.who || 'Call';
      $('kind').textContent = d.kind === 'interview' ? 'Interview, listen-only' : 'Coffee chat';
      document.body.classList.toggle('listen', !!d.listenOnly);
      $('prepBody').innerHTML = d.prep ? marked.parse(d.prep) : '<p class="empty">No prep file for this call.</p>';
      $('dial').hidden = !d.dial;
      call.checklist(d.checklist || []);
      if (d.status) call.status(d.status);
    },
    checklist(items) {
      const list = $('checklist');
      list.textContent = '';
      items.forEach((it) => { const li = el('li', it.done ? 'done' : '', it.text); list.appendChild(li); });
      $('checkBox').hidden = items.length === 0;
    },
    check(done) {
      const items = $('checklist').children;
      done.forEach((i) => { if (items[i]) items[i].classList.add('done'); });
    },
    help(h) {
      $('helpEmpty')?.remove();
      const box = $('help');
      for (const c of box.querySelectorAll('.card.fresh')) c.classList.remove('fresh');
      const card = el('div', 'card fresh');
      if (h.fact) card.appendChild(el('div', 'fact', h.fact));
      if (h.ask) card.appendChild(el('div', 'ask', h.ask));
      if (h.nudge) card.appendChild(el('div', 'nudgeLine', h.nudge));
      card.appendChild(el('div', 'at', h.at || ''));
      box.prepend(card);
      while (box.children.length > 8) box.lastChild.remove();
    },
    nudge(text) {
      const n = $('nudge');
      n.textContent = text || '';
      n.hidden = !text;
    },
    line(l) {
      const box = $('lines');
      const who = l.side === 'me' ? 'you' : (l.them || 'them');
      if (lastSide === l.side && box.lastChild) {
        box.lastChild.querySelector('span').textContent += ' ' + l.text;
      } else {
        const p = el('div', 'said ' + l.side);
        p.appendChild(el('b', '', who + ': '));
        p.appendChild(el('span', '', l.text));
        box.appendChild(p);
      }
      lastSide = l.side;
      while (box.children.length > 6) box.firstChild.remove();
      const last = box.lastChild.querySelector('span');
      if (last.textContent.length > 420) last.textContent = '…' + last.textContent.slice(-400);
    },
    status(text) { $('status').textContent = text || ''; },
    clock(text) { $('clock').textContent = text || ''; },
    ended(text) {
      $('end').disabled = true;
      $('end').textContent = 'Ended';
      $('dial').hidden = true;
      call.nudge('');
      call.status(text);
    },
  };

  const end = $('end');
  let confirmTimer = null;
  end.onclick = () => {
    if (end.classList.contains('confirm')) { clearTimeout(confirmTimer); post({ type: 'end' }); return; }
    end.classList.add('confirm');
    end.textContent = 'End it?';
    confirmTimer = setTimeout(() => { end.classList.remove('confirm'); end.textContent = 'End call'; }, 3000);
  };
  $('dial').onclick = () => { post({ type: 'dial' }); $('dial').hidden = true; };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    e.preventDefault();
    post({ type: 'open', href: a.getAttribute('href') });
  });
  post({ type: 'ready' });
})();
