#!/usr/bin/env python3
"""Regenerate data/profile.json from GitHub. Private repos contribute aggregates only."""
import json
import os
import subprocess
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOTES = json.loads((ROOT / "scripts/public_notes.json").read_text())
OVERVIEW = json.loads((ROOT / "data/private-overview.json").read_text())
ACCOUNTS = ["siwapanD", "KhunchayNe"]
# A token only sees its own account's private repos. Without one, the default token is used.
ACCOUNT_TOKEN_ENV = {"KhunchayNe": "PROFILE_TOKEN_KHUNCHAYNE"}

CALENDAR_FIELDS = """
  restrictedContributionsCount
  contributionCalendar {
    weeks { contributionDays { date contributionCount } }
  }
"""


def account_token(login):
    token = os.environ.get(ACCOUNT_TOKEN_ENV.get(login, ""))
    if token or os.environ.get("GITHUB_ACTIONS"):
        return token
    local = subprocess.run(["gh", "auth", "token", "--user", login], capture_output=True, text=True)
    return local.stdout.strip() if local.returncode == 0 else None


def gh(*args, login=None):
    token = account_token(login) if login else None
    env = {**os.environ, "GH_TOKEN": token} if token else None
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True, env=env).stdout


def calendar(login, start=None, end=None):
    window = f'(from: "{start}", to: "{end}")' if start else ""
    query = f'{{ user(login: "{login}") {{ contributionsCollection{window} {{ {CALENDAR_FIELDS} }} }} }}'
    c = json.loads(gh("api", "graphql", "-f", f"query={query}", login=login))["data"]["user"]["contributionsCollection"]
    days = {
        d["date"]: d["contributionCount"]
        for w in c["contributionCalendar"]["weeks"]
        for d in w["contributionDays"]
    }
    return {"private": c["restrictedContributionsCount"], "days": days}


def quartile_level(n, active):
    """Same four buckets GitHub uses; recomputed because levels differ per account."""
    if not n:
        return "NONE"
    rank = sum(x <= n for x in active) / len(active)
    if rank <= 0.25:
        return "FIRST_QUARTILE"
    if rank <= 0.5:
        return "SECOND_QUARTILE"
    if rank <= 0.75:
        return "THIRD_QUARTILE"
    return "FOURTH_QUARTILE"


def merge(calendars):
    totals = Counter()
    for cal in calendars:
        for day, n in cal["days"].items():
            totals[day] += n
    days = sorted(set().union(*(cal["days"] for cal in calendars)))
    active = sorted(n for n in totals.values() if n)
    return {
        "total": sum(totals.values()),
        "private": sum(cal["private"] for cal in calendars),
        "days": [{"d": d, "n": totals[d], "l": quartile_level(totals[d], active)} for d in days],
    }


def longest_streak(days):
    longest = run = 0
    for d in days:
        run = run + 1 if d["n"] else 0
        longest = max(longest, run)
    return longest


def has_own_commits(login, name):
    try:
        return gh("api", f"repos/{login}/{name}/commits?author={login}&per_page=1", "--jq", "length", login=login).strip() != "0"
    except subprocess.CalledProcessError:  # empty repository
        return False


def main():
    repos = []
    created = {}
    complete = True
    for login in ACCOUNTS:
        # Workflow logs on this public repo are public: never print private repo names here.
        token_owner = gh("api", "user", "--jq", ".login", login=login).strip()
        complete = complete and token_owner == login
        print(f"{login}: token belongs to the account: {token_owner == login}")
        created[login] = int(json.loads(gh("api", f"users/{login}"))["created_at"][:4])
        rows = json.loads(gh(
            "repo", "list", login, "--limit", "500", "--json",
            "name,visibility,isFork,parent,description,primaryLanguage,pushedAt,url,homepageUrl,stargazerCount",
            login=login,
        ))
        repos += [{**r, "owner": login, "key": f"{login}/{r['name']}"} for r in rows]

    def language(r):
        return NOTES["projects"].get(r["key"], {}).get("language") or (r["primaryLanguage"] or {}).get("name")

    private = [r for r in repos if r["visibility"] == "PRIVATE"]
    public = [r for r in repos if r["visibility"] == "PUBLIC"]
    own = [r for r in public if not r["isFork"] and r["key"] not in NOTES["hidden"]]

    # A fork of one account's repo by the other, or the same upstream forked twice, is one entry.
    seen = set()
    forks = []
    for r in sorted((r for r in public if r["isFork"]), key=lambda r: r["pushedAt"], reverse=True):
        parent_owner = ((r.get("parent") or {}).get("owner") or {}).get("login")
        if parent_owner in ACCOUNTS or r["name"] in seen:
            continue
        seen.add(r["name"])
        forks.append(r)
    shown_forks = [r for r in forks if r["name"] not in NOTES["hiddenForks"]]

    today = date.today()
    recent = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()

    # Pinned infrastructure work comes first; the rest stays newest-first.
    newest_first = sorted(own, key=lambda r: r["pushedAt"], reverse=True)
    cards = []
    for r in sorted(newest_first, key=lambda r: not NOTES["projects"].get(r["key"], {}).get("pin")):
        note = NOTES["projects"].get(r["key"], {})
        cards.append({
            "name": r["name"], "owner": r["owner"], "url": r["url"], "homepage": r["homepageUrl"] or None,
            "language": language(r), "stars": r["stargazerCount"], "pushedAt": r["pushedAt"][:10],
            "note": note.get("note") or r["description"] or "",
            "group": note.get("group", "learning"),
        })

    fork_rows = [{
        "name": r["name"], "owner": r["owner"], "url": r["url"], "language": language(r),
        "pushedAt": r["pushedAt"][:10], "description": r["description"] or "",
        "ownCommits": has_own_commits(r["owner"], r["name"]),
    } for r in shown_forks]

    categories = list(OVERVIEW["categories"])
    categorized = sum(c["count"] for c in categories)
    if categorized < len(private):
        categories.append({
            "title": "ยังไม่ได้จัดหมวด",
            "count": len(private) - categorized,
            "summary": "โปรเจกต์ที่นับเข้ามาแล้ว แต่ยังไม่ได้สรุปเป็นหมวดงาน",
            "stack": [],
        })
    elif categorized > len(private):
        print(f"warning: private-overview.json lists {categorized} repos, GitHub has {len(private)}")

    latest = merge([calendar(login) for login in ACCOUNTS])
    by_year = {}
    for year in range(min(created.values()), today.year + 1):
        window = (f"{year}-01-01T00:00:00Z", f"{year}-12-31T23:59:59Z")
        by_year[str(year)] = merge([calendar(login, *window) for login in ACCOUNTS if created[login] <= year])
    all_days = sorted((d for y in by_year.values() for d in y["days"]), key=lambda d: d["d"])

    # Own repos only: a fork's language says nothing about what the owner writes.
    languages = Counter(language(r) for r in own + private if language(r))

    out = {
        "generatedAt": today.isoformat(),
        "accounts": ACCOUNTS,
        "counts": {
            "private": len(private),
            "privateByAccount": dict(Counter(r["owner"] for r in private)),
            "privateComplete": complete,
            "privateActive90d": sum(r["pushedAt"] >= recent for r in private),
            "publicShown": len(cards),
            "publicFeatured": sum(c["group"] == "featured" for c in cards),
            "forks": len(forks),
            "forksShown": len(fork_rows),
            "forksWithOwnCommits": sum(f["ownCommits"] for f in fork_rows),
        },
        "contributions": {
            "latest": latest,
            "years": by_year,
            "allTime": sum(y["total"] for y in by_year.values()),
            "activeDays": sum(d["n"] > 0 for d in all_days),
            "longestStreak": longest_streak(all_days),
        },
        "languages": languages.most_common(),
        "private": {"categories": categories, "categorized": categorized},
        "public": cards,
        "forks": fork_rows,
    }
    (ROOT / "data/profile.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")


if __name__ == "__main__":
    main()
