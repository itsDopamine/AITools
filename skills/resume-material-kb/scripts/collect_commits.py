#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Collect git commits for resume-material-kb (author-filtered, optional since-commit)."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from typing import List, Optional, Set


COMMIT_START = "===RESUME_KB_COMMIT==="
FILES_START = "===RESUME_KB_FILES==="


def run_git(repo: str, args: List[str]) -> str:
    cmd = ["git", "-C", repo] + args
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError as e:
        sys.stderr.write(e.output.decode("utf-8", errors="replace"))
        raise SystemExit(e.returncode)
    return out.decode("utf-8", errors="replace")


def normalize(s: str) -> str:
    return (s or "").strip().lower()


def author_match(name: str, email: str, names: Set[str], emails: Set[str]) -> bool:
    if not names and not emails:
        return True
    n = normalize(name)
    e = normalize(email)
    if names and n in names:
        return True
    if emails and e in emails:
        return True
    if names and any(n == x or x in n or n in x for x in names if x):
        return True
    return False


def collect(
    repo: str,
    names: List[str],
    emails: List[str],
    since_commit: Optional[str],
    since_date: Optional[str],
    until_date: Optional[str],
    max_count: int,
    all_refs: bool = False,
) -> dict:
    # Unique markers — do not use substrings like >>> that collide with each other.
    # Filter authors in Python: avoid `--author=a|b` which breaks on some Git-for-Windows builds.
    pretty = (
        f"{COMMIT_START}%n"
        "%H%n"
        "%an%n"
        "%ae%n"
        "%aI%n"
        "%s%n"
        "%b%n"
        f"{FILES_START}"
    )
    args = ["log", f"--pretty=format:{pretty}", "--name-only", f"-n{max_count}"]
    if all_refs:
        args.append("--all")
        if since_commit:
            args.append(f"{since_commit}..")
    else:
        rev_range = f"{since_commit}..HEAD" if since_commit else "HEAD"
        args.insert(1, rev_range)
    if since_date:
        args.append(f"--since={since_date}")
    if until_date:
        args.append(f"--until={until_date}")
    # Prefer git-side author filter so --max-count is applied AFTER author match.
    # (Otherwise recent other-author commits can exhaust -n before our commits appear.)
    for n in names:
        if n and n.strip():
            args.append(f"--author={n.strip()}")
    for e in emails:
        if e and e.strip():
            args.append(f"--author={e.strip()}")

    raw = run_git(repo, args)
    name_set = {normalize(x) for x in names if x and x.strip()}
    email_set = {normalize(x) for x in emails if x and x.strip()}

    commits = []
    chunks = raw.split(COMMIT_START)
    for chunk in chunks:
        chunk = chunk.strip("\n")
        if not chunk.strip() or FILES_START not in chunk:
            continue
        head, files_part = chunk.split(FILES_START, 1)
        lines = head.split("\n")
        while lines and lines[0] == "":
            lines.pop(0)
        if len(lines) < 5:
            continue
        c_hash, an, ae, when, subject = lines[0], lines[1], lines[2], lines[3], lines[4]
        body = "\n".join(lines[5:]).strip()
        files = [ln.strip() for ln in files_part.split("\n") if ln.strip()]
        if not author_match(an, ae, name_set, email_set):
            continue
        commits.append(
            {
                "hash": c_hash.strip(),
                "author_name": an.strip(),
                "author_email": ae.strip(),
                "committed_at": when.strip(),
                "subject": subject.strip(),
                "body": body,
                "files": files,
            }
        )

    return _payload(repo, since_commit, commits)


def _payload(repo: str, since_commit: Optional[str], commits: list) -> dict:
    remote = ""
    try:
        remote = run_git(repo, ["config", "--get", "remote.origin.url"]).strip()
    except SystemExit:
        remote = ""
    head = ""
    try:
        head = run_git(repo, ["rev-parse", "HEAD"]).strip()
    except SystemExit:
        head = ""
    return {
        "repo_path": os.path.abspath(repo),
        "remote": remote,
        "head": head,
        "since_commit": since_commit,
        "collected_at": datetime.now().astimezone().isoformat(),
        "commit_count": len(commits),
        "commits": commits,
    }


def main() -> None:
    p = argparse.ArgumentParser(description="Collect author-filtered commits for resume KB")
    p.add_argument("--repo", required=True, help="Git repository path")
    p.add_argument("--author", action="append", default=[], help="Author name (repeatable)")
    p.add_argument("--author-email", action="append", default=[], help="Author email (repeatable)")
    p.add_argument("--since-commit", default=None, help="Exclusive lower bound commit hash")
    p.add_argument("--since", dest="since_date", default=None, help="--since date for git log")
    p.add_argument("--until", dest="until_date", default=None, help="--until date for git log")
    p.add_argument("--max-count", type=int, default=500, help="Max commits to scan before author filter")
    p.add_argument("--all-refs", action="store_true", help="Include all branches/tags (git log --all)")
    p.add_argument("--out", required=True, help="Output JSON path")
    args = p.parse_args()

    if not os.path.isdir(args.repo):
        print(f"Not a repo path: {args.repo}", file=sys.stderr)
        raise SystemExit(2)

    data = collect(
        args.repo,
        args.author,
        args.author_email,
        args.since_commit,
        args.since_date,
        args.until_date,
        args.max_count,
        all_refs=args.all_refs,
    )
    out_dir = os.path.dirname(os.path.abspath(args.out))
    if out_dir and not os.path.isdir(out_dir):
        os.makedirs(out_dir, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Wrote {data['commit_count']} commits -> {args.out}")


if __name__ == "__main__":
    main()
