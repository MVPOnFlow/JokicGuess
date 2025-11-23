import os
import sqlite3
import psycopg2
from flask import g

DATABASE_URL = os.getenv('DATABASE_URL')
db_type = 'postgresql' if DATABASE_URL else 'sqlite'

def get_db():
    if 'db' not in g:
        if db_type == 'postgresql':
            g.db = psycopg2.connect(DATABASE_URL, sslmode='require')
        else:
            g.db = sqlite3.connect('local.db', detect_types=sqlite3.PARSE_DECLTYPES)
            g.db.row_factory = sqlite3.Row
    return g.db

def close_db(error=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()
