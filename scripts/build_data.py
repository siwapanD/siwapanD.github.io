#!/usr/bin/env python3
"""Regenerate data/profile.json from GitHub. Private repos contribute aggregates only."""
import json
import subprocess
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOTES = json.loads((ROOT / "scripts/public_notes.json").read_text())
OVERVIEW = json.loads((ROOT / "data/private-overview.json").read_text())

CALENDAR_FIELDS = """
  restrictedContributionsCount
  totalCommitContributions
  totalPullRequestContributions
  contributionCalendar {
    totalContributions
    weeks { contributionDays { date contributionCount contributionLevel } }
  }
"""


def gh(*args):
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def calendar(start=None, end=None):
    window = f'(from: "{start}", to: "{end}")' if start else ""
    query = f"{{ viewer {{ contributionsCollection{window} {{ {CALENDAR_FIELDS} }} }} }}"
    c = json.loads(gh("api", "graphql", "-f", f"query={query}"))["data"]["viewer"]["contributionsCollection"]
    days = [
        {"d": d["date"], "n": d["contributionCount"], "l": d["contributionLevel"]}
        for w in c["contributionCalendar"]["weeks"]
        for d in w["contributionDays"]
    ]
    return {
        "total": c["contributionCalendar"]["totalContributions"],
        "private": c["restrictedContributionsCount"],
        "days": days,
    }


def streaks(days):
    longest = run = 0
    for d in days:
        run = run + 1 if d["n"] else 0
        longest = max(longest, run)
    return longest


def has_own_commits(login, name):
    out = gh("api", f"repos/{login}/{name}/commits?author={login}&per_page=1", "--jq", "length")
    return out.strip() != "0"


def main():
    user = json.loads(gh("api", "user"))
    login = user["login"]
    repos = json.loads(gh(
        "repo", "list", login, "--limit", "500", "--json",
        "name,visibility,isFork,description,primaryLanguage,pushedAt,url,homepageUrl,stargazerCount",
    ))
    lang = lambda r: (r["primaryLanguage"] or {}).get("name")

    private = [r for r in repos if r["visibility"] == "PRIVATE"]
    public = [r for r in repos if r["visibility"] == "PUBLIC"]
    own = [r for r in public if not r["isFork"]]
    forks = [r for r in public if r["isFork"]]

    today = date.today()
    recent = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()

    cards = []
    for r in sorted(own, key=lambda r: r["pushedAt"], reverse=True):
        if r["name"] in NOTES["hidden"]:
            continue
        note = NOTES["projects"].get(r["name"], {})
        cards.append({
            "name": r["name"], "url": r["url"], "homepage": r["homepageUrl"] or None,
            "language": lang(r), "stars": r["stargazerCount"], "pushedAt": r["pushedAt"][:10],
            "note": note.get("note") or r["description"] or "",
            "group": note.get("group", "featured"),
        })

    fork_rows = [{
        "name": r["name"], "url": r["url"], "language": lang(r),
        "pushedAt": r["pushedAt"][:10], "description": r["description"] or "",
        "ownCommits": has_own_commits(login, r["name"]),
    } for r in sorted(forks, key=lambda r: r["pushedAt"], reverse=True)]

    categorized = sum(c["count"] for c in OVERVIEW["categories"])
    if categorized != len(private):
        print(f"warning: private-overview.json lists {categorized} repos, GitHub has {len(private)}")

    years = range(int(user["created_at"][:4]), today.year + 1)
    latest = calendar()
    by_year = {str(y): calendar(f"{y}-01-01T00:00:00Z", f"{y}-12-31T23:59:59Z") for y in years}
    all_days = {d["d"]: d for y in by_year.values() for d in y["days"]}
    ordered = [all_days[k] for k in sorted(all_days)]

    # Own repos only: a fork's language says nothing about what the owner writes.
    languages = Counter(lang(r) for r in own + private if lang(r) and r["name"] not in NOTES["hidden"])

    out = {
        "generatedAt": today.isoformat(),
        "login": login,
        "avatar": user["avatar_url"],
        "counts": {
            "private": len(private),
            "privateActive90d": sum(r["pushedAt"] >= recent for r in private),
            "publicShown": len(cards),
            "publicOwn": len(own),
            "forks": len(forks),
            "forksWithOwnCommits": sum(f["ownCommits"] for f in fork_rows),
        },
        "contributions": {
            "latest": latest,
            "years": by_year,
            "allTime": sum(y["total"] for y in by_year.values()),
            "activeDays": sum(d["n"] > 0 for d in ordered),
            "longestStreak": streaks(ordered),
        },
        "languages": languages.most_common(),
        "private": {"categories": OVERVIEW["categories"], "categorized": categorized},
        "public": cards,
        "forks": fork_rows,
    }
    (ROOT / "data/profile.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")


if __name__ == "__main__":
    main()
