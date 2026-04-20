from database import get_conn


def create_tables():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS decks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            source      TEXT    DEFAULT '',
            created_at  TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS cards (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            deck_id      INTEGER NOT NULL,
            front        TEXT    NOT NULL,
            back         TEXT    NOT NULL,
            interval     INTEGER DEFAULT 1,
            repetitions  INTEGER DEFAULT 0,
            easiness     REAL    DEFAULT 2.5,
            next_review  TEXT    DEFAULT (datetime('now')),
            FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    conn.close()