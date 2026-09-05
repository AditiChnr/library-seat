# books.py — Book availability search (title -> copies left)

import db


def search(query):
    results = db.search_books(query)
    return [
        {
            "title": b["title"],
            "author": b.get("author", ""),
            "copies_left": b.get("copies_available", 0)
        }
        for b in results
    ]
