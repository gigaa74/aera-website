"""Private website support threads, separate from the read-only VPN database."""
from contextlib import contextmanager
import hashlib
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


class SupportStore:
    def __init__(self, path):
        self.path = Path(path)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        db.executescript('''
          CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, contact TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OPEN', created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL, owner_id TEXT);
          CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id),
            sender TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS message_ticket ON messages(ticket_id,id);
        ''')
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def now():
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def hash(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def create(self, message, contact='', owner_id=None):
        identity, token, stamp = secrets.token_hex(12), secrets.token_urlsafe(32), self.now()
        with self.connect() as db:
            db.execute('INSERT INTO tickets(id,token_hash,contact,created_at,updated_at,owner_id) VALUES(?,?,?,?,?,?)',
                       (identity, self.hash(token), contact, stamp, stamp, owner_id))
            db.execute('INSERT INTO messages(ticket_id,sender,body,created_at) VALUES(?,?,?,?)',
                       (identity, 'CLIENT', message, stamp))
        return {'id': identity, 'token': token}

    def thread(self, identity, token=None, admin=False):
        with self.connect() as db:
            row = db.execute('SELECT * FROM tickets WHERE id=?', (identity,)).fetchone()
            if not row or (not admin and not secrets.compare_digest(row['token_hash'], self.hash(token or ''))):
                return None
            result = {key: row[key] for key in ('id','contact','status','created_at','updated_at')}
            result['messages'] = [dict(m) for m in db.execute(
                'SELECT sender,body,created_at FROM messages WHERE ticket_id=? ORDER BY id', (identity,))]
            return result

    def reply(self, identity, message, token=None, admin=False):
        with self.connect() as db:
            row = db.execute('SELECT token_hash FROM tickets WHERE id=?', (identity,)).fetchone()
            if not row or (not admin and not secrets.compare_digest(row['token_hash'], self.hash(token or ''))):
                return False
            stamp = self.now()
            db.execute('INSERT INTO messages(ticket_id,sender,body,created_at) VALUES(?,?,?,?)',
                       (identity, 'SUPPORT' if admin else 'CLIENT', message, stamp))
            db.execute('UPDATE tickets SET status=?,updated_at=? WHERE id=?',
                       ('ANSWERED' if admin else 'OPEN',stamp,identity))
        return True

    def close(self, identity):
        with self.connect() as db:
            return db.execute('UPDATE tickets SET status=?,updated_at=? WHERE id=?',
                              ('CLOSED',self.now(),identity)).rowcount == 1

    def listing(self):
        with self.connect() as db:
            return [dict(row) for row in db.execute('''
                SELECT t.id,t.contact,t.status,t.created_at,t.updated_at,
                (SELECT body FROM messages m WHERE m.ticket_id=t.id ORDER BY id LIMIT 1) AS preview
                FROM tickets t ORDER BY t.updated_at DESC LIMIT 100''')]
