# seed_data.py — populate the database with sample engineering books
# and sample study history, so the UI has something to show during demos.
#
# Usage (from the server/ folder):
#     python seed_data.py                  # books only
#     python seed_data.py --user student   # books + 30 days of study data for that username

import sys
import random
from datetime import datetime, timedelta

import db as database


# ── Engineering books ──────────────────────────────────────────────────────
# (title, author, total copies, copies currently on the shelf)

BOOKS = [
    ("Engineering Mathematics", "B. S. Grewal", 12, 5),
    ("Higher Engineering Mathematics", "H. K. Dass", 10, 2),
    ("Engineering Physics", "Gaur and Gupta", 8, 8),
    ("Elements of Electromagnetics", "Matthew N. O. Sadiku", 6, 1),
    ("Basic Electrical Engineering", "D. P. Kothari", 9, 4),
    ("Engineering Mechanics: Statics and Dynamics", "R. C. Hibbeler", 7, 0),
    ("Strength of Materials", "R. K. Bansal", 8, 3),
    ("Fluid Mechanics and Hydraulic Machines", "R. K. Bansal", 6, 2),
    ("Thermodynamics: An Engineering Approach", "Yunus A. Cengel", 5, 1),
    ("Theory of Machines", "R. S. Khurmi", 6, 4),
    ("Machine Design", "R. S. Khurmi", 5, 2),
    ("Manufacturing Technology", "P. N. Rao", 4, 0),

    ("Let Us C", "Yashavant Kanetkar", 15, 7),
    ("The C Programming Language", "Kernighan and Ritchie", 10, 3),
    ("Programming in ANSI C", "E. Balagurusamy", 12, 6),
    ("Object Oriented Programming with C++", "E. Balagurusamy", 10, 4),
    ("Core Java Volume I: Fundamentals", "Cay S. Horstmann", 8, 2),
    ("Head First Java", "Kathy Sierra", 6, 1),
    ("Python Crash Course", "Eric Matthes", 7, 3),
    ("Automate the Boring Stuff with Python", "Al Sweigart", 5, 5),

    ("Data Structures and Algorithms Made Easy", "Narasimha Karumanchi", 14, 2),
    ("Introduction to Algorithms", "Cormen, Leiserson, Rivest, Stein", 9, 0),
    ("Algorithm Design", "Kleinberg and Tardos", 4, 2),
    ("Fundamentals of Data Structures in C", "Horowitz and Sahni", 8, 3),

    ("Database System Concepts", "Silberschatz, Korth, Sudarshan", 10, 4),
    ("Fundamentals of Database Systems", "Elmasri and Navathe", 8, 1),
    ("Operating System Concepts", "Silberschatz and Galvin", 11, 5),
    ("Modern Operating Systems", "Andrew S. Tanenbaum", 6, 2),
    ("Computer Networks", "Andrew S. Tanenbaum", 9, 3),
    ("Data Communications and Networking", "Behrouz A. Forouzan", 10, 6),
    ("Computer Organization and Architecture", "William Stallings", 7, 2),
    ("Computer System Architecture", "M. Morris Mano", 9, 4),
    ("Digital Design", "M. Morris Mano", 8, 3),
    ("Microprocessor Architecture and Programming", "Ramesh Gaonkar", 5, 1),
    ("Compiler Design", "Aho, Lam, Sethi, Ullman", 5, 0),
    ("Theory of Computation", "Michael Sipser", 4, 2),
    ("Software Engineering", "Ian Sommerville", 8, 3),
    ("Software Engineering: A Practitioner's Approach", "Roger S. Pressman", 7, 2),

    ("Artificial Intelligence: A Modern Approach", "Russell and Norvig", 6, 1),
    ("Machine Learning", "Tom M. Mitchell", 5, 2),
    ("Pattern Recognition and Machine Learning", "Christopher Bishop", 4, 0),
    ("Deep Learning", "Goodfellow, Bengio, Courville", 4, 1),
    ("Hands-On Machine Learning with Scikit-Learn and TensorFlow", "Aurelien Geron", 5, 2),

    ("Signals and Systems", "Alan V. Oppenheim", 6, 3),
    ("Digital Signal Processing", "Proakis and Manolakis", 5, 1),
    ("Control Systems Engineering", "Norman S. Nise", 6, 2),
    ("Electronic Devices and Circuit Theory", "Boylestad and Nashelsky", 9, 4),
    ("Microelectronic Circuits", "Sedra and Smith", 7, 2),
    ("Embedded Systems: Architecture and Programming", "Raj Kamal", 5, 3),
    ("Internet of Things: A Hands-On Approach", "Bahga and Madisetti", 4, 2),

    ("Cryptography and Network Security", "William Stallings", 6, 2),
    ("Cloud Computing: Concepts and Technology", "Thomas Erl", 4, 1),
    ("Clean Code", "Robert C. Martin", 5, 0),
    ("Design Patterns: Elements of Reusable Software", "Gamma, Helm, Johnson, Vlissides", 4, 1),
    ("The Pragmatic Programmer", "Hunt and Thomas", 5, 2),
]


def _set_copies_available(title, available):
    """db.add_book() starts every book fully stocked. This nudges the
    'copies left' number so the availability screen looks realistic."""
    handle = database.get_db()
    if handle is not None:
        handle.books.update_one({"title": title}, {"$set": {"copies_available": available}})
    else:
        data = database._load_fallback()
        for b in data["books"]:
            if b["title"] == title:
                b["copies_available"] = available
        database._save_fallback(data)


def seed_books():
    existing = {b["title"].lower() for b in database.search_books("")}
    added = 0
    for title, author, total, available in BOOKS:
        if title.lower() in existing:
            continue
        database.add_book(title, author, total)
        _set_copies_available(title, available)
        added += 1
    print(f"[seed] books: {added} added, {len(existing)} already present")


# ── Study history ──────────────────────────────────────────────────────────
# Seconds per day, so it matches what the Pi posts to /sessions/append.

def seed_sessions(username, days=30):
    user = database.find_user_by_username(username)
    if not user:
        print(f"[seed] no user named '{username}' — sign up first, then rerun")
        return

    user_id = user["id"]
    today = datetime.now().date()
    made = 0

    for i in range(days):
        day = today - timedelta(days=i)
        weekday = day.weekday()  # 0 = Monday, 6 = Sunday

        # A few days off, and lighter weekends, so the graph isn't a flat wall.
        if random.random() < 0.12:
            continue
        if weekday >= 5:
            study_hours = random.uniform(0.5, 2.5)
        else:
            study_hours = random.uniform(1.5, 5.5)

        study = int(study_hours * 3600)
        sleep = int(study * random.uniform(0.02, 0.10))
        inactive = int(study * random.uniform(0.15, 0.35))

        database.save_session(user_id, day.strftime("%Y-%m-%d"), study, sleep, inactive)
        made += 1

    print(f"[seed] sessions: {made} days written for '{username}'")


if __name__ == "__main__":
    database.init_db()
    seed_books()

    if "--user" in sys.argv:
        idx = sys.argv.index("--user")
        if idx + 1 < len(sys.argv):
            seed_sessions(sys.argv[idx + 1])
        else:
            print("[seed] --user needs a username, e.g. --user student")

    print("[seed] done")
