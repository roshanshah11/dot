#!/usr/bin/env python3
"""The proof JobGate's queuedSends rests on: in an `ask-` Atlas session, imessage_send, send_email and reply only queue a
proposal and nothing executes; and dot-atlas-approve.py lists, approves and denies exactly those proposals.

    PYTHONPATH=~/Projects/atlas-fast python3 scripts/test_dot_atlas_approve.py

A temp Atlas root only; Actions.execute is faked, so no AppleScript, mail or text ever runs. Placeholder people only.
"""
import importlib.util, io, json, os, sys, tempfile, unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('dot_atlas_approve', HERE / 'dot-atlas-approve.py')
approve = importlib.util.module_from_spec(spec)
spec.loader.exec_module(approve)

from atlas.store import Store   # noqa: E402  (PYTHONPATH points at the Atlas harness)
from atlas import mcp           # noqa: E402

SESSION = 'ask-dot-job-test1-202610201500'


class QueuedSends(unittest.TestCase):
    def setUp(self):
        self.env = mock.patch.dict(os.environ, {'ATLAS_CHAT_SESSION': 'none'}); self.env.start()
        self.tmp = tempfile.TemporaryDirectory(); self.root = Path(self.tmp.name).resolve() / 'vault'
        self.s = Store(self.root)
        me = self.s.entity('person'); self.s.name_entity(me, 'Alex Example')
        from atlas.identity import Identity
        Identity(self.s).set_owner(me)
        self.s.set_runtime('gmail_account', 'alex.example@example.com')
        self.srv = mcp.Server(self.s, SESSION)
        # A fake provider behind Atlas's own guard: begin_action records the action (and refuses a second one), then the
        # "send" is only counted. Nothing reaches AppleScript, mail or Messages.
        self.sent = []
        def fake_execute(actions, proposal_id, authority_event=None, grant_id=None):
            actions.jobs.begin_action(proposal_id, authority_event=authority_event, grant_id=grant_id)
            self.sent.append(proposal_id)
            return {'status': 'succeeded', 'provider_id': 'fake:1'}
        self.ex = mock.patch('atlas.actions.Actions.execute', autospec=True, side_effect=fake_execute); self.fake = self.ex.start()

    def tearDown(self):
        self.ex.stop(); self.env.stop(); self.s.db.close(); self.tmp.cleanup()

    def run_script(self, *argv):
        out = io.StringIO()
        with redirect_stdout(out):
            code = approve.main([*argv, '--root', str(self.root), '--harness', os.environ.get('PYTHONPATH', '').split(':')[0] or '.'])
        return code, json.loads(out.getvalue().strip().splitlines()[-1])

    def test_imessage_send_only_queues(self):
        r = self.srv.imessage_send('+15555550100', 'running late')
        self.assertIn('queued for his approval', r)
        self.fake.assert_not_called()

    def test_send_email_only_queues(self):
        r = self.srv.send_email('sam.rivera@example.com', 'Thursday', 'See you at 3.')
        self.assertIn('queued for his approval', r)
        self.fake.assert_not_called()

    def test_reply_only_queues(self):
        row = {'id': 'abcd1234ef', 'source': 'gmail://alex.example@example.com/thread9/msg9',
               'text': 'From: Sam Rivera <sam.rivera@example.com>\nTo: alex.example@example.com\nSubject: Thursday\n\nDoes 3 work?'}
        with mock.patch.object(mcp.Server, '_message', return_value=row):
            r = self.srv.reply('abcd1234', 'Yes, 3 works.')
        self.assertIn('queued for his approval', r)
        self.fake.assert_not_called()

    def test_list_approve_deny(self):
        self.srv.imessage_send('+15555550100', 'running late')
        code, cards = self.run_script('list', '--session', SESSION)
        self.assertEqual(code, 0)
        self.assertEqual(len(cards), 1)
        card = cards[0]
        self.assertEqual(card['operation'], 'imessage.send')
        self.assertEqual(card['to'], ['+15555550100'])
        self.assertEqual(card['text'], 'running late')
        self.assertIn('names', card)
        # a wrong digest is refused; another ask's proposal is refused
        code, r = self.run_script('approve', '--session', SESSION, '--proposal', card['proposal'], '--digest', 'wrong')
        self.assertEqual(code, 2); self.assertIn('error', r)
        code, r = self.run_script('approve', '--session', 'ask-dot-job-other-202610201500', '--proposal', card['proposal'], '--digest', card['digest'])
        self.assertEqual(code, 2)
        self.fake.assert_not_called()
        code, r = self.run_script('approve', '--session', SESSION, '--proposal', card['proposal'], '--digest', card['digest'])
        self.assertEqual(code, 0); self.assertEqual(r['status'], 'succeeded')
        self.assertEqual(len(self.sent), 1)
        # approved: no longer listed, and a second approve doesn't send twice
        code, cards = self.run_script('list', '--session', SESSION)
        self.assertEqual(cards, [])
        code, r = self.run_script('approve', '--session', SESSION, '--proposal', card['proposal'], '--digest', card['digest'])
        self.assertEqual(len(self.sent), 1, 'a second approve never sends again')
        self.assertNotEqual(r.get('status'), 'succeeded')

    def test_denied_cannot_be_approved(self):
        self.srv.send_email('sam.rivera@example.com', 'Thursday', 'See you at 3.')
        _, cards = self.run_script('list', '--session', SESSION)
        card = cards[0]
        code, r = self.run_script('deny', '--session', SESSION, '--proposal', card['proposal'], '--digest', card['digest'])
        self.assertEqual(code, 0); self.assertEqual(r.get('status'), 'denied')
        code, r = self.run_script('approve', '--session', SESSION, '--proposal', card['proposal'], '--digest', card['digest'])
        self.assertEqual(code, 2)
        self.fake.assert_not_called()

    def test_only_ask_sessions(self):
        code, r = self.run_script('list', '--session', 'dot-job-x')
        self.assertEqual(code, 2)


if __name__ == '__main__':
    unittest.main()
