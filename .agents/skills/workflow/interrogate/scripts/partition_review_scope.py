#!/usr/bin/env python3
"""Map changed paths to AGENTS.md scopes and list rule files per scope.

Each scope is a directory that contains AGENTS.md. If that directory also has
`.agents/rules/*.md`, those files are the reviewer's assigned rules. Changed
files are assigned to the nearest enclosing AGENTS.md directory (longest prefix
wins). Files outside any nested AGENTS.md tree stay on the repository root
scope when root AGENTS.md exists.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

def git_lines(repo: Path, *args: str) -> list[str]:
    result = subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or "git failed")
    return [line for line in result.stdout.splitlines() if line.strip()]


def discover_agents_md(repo: Path) -> list[Path]:
    found: list[Path] = []
    for path in repo.rglob("AGENTS.md"):
        if not path.is_file():
            continue
        parts = path.relative_to(repo).parts
        if any(part.startswith(".") for part in parts[:-1]):
            continue
        if "node_modules" in parts:
            continue
        found.append(path)
    return sorted(found, key=lambda p: len(p.relative_to(repo).parts), reverse=True)


def scope_id(scope_root: Path, repo: Path) -> str:
    rel = scope_root.relative_to(repo)
    return str(rel) if str(rel) != "." else "repo-root"


def path_prefix(scope_root: Path, repo: Path) -> str | None:
    rel = scope_root.relative_to(repo)
    if str(rel) == ".":
        return None
    return rel.as_posix()


def under_prefix(path: str, prefix: str | None) -> bool:
    if prefix is None:
        return True
    return path == prefix or path.startswith(prefix + "/")


def assign_path(path: str, nested: list[tuple[str | None, str]]) -> str:
    for prefix, sid in nested:
        if prefix is not None and under_prefix(path, prefix):
            return sid
    return "repo-root"


def list_rules(rules_dir: Path) -> list[str]:
    if not rules_dir.is_dir():
        return []
    return sorted(
        p.name
        for p in rules_dir.glob("*.md")
        if p.is_file() and not p.is_symlink()
    )


def changed_paths(repo: Path, base: str) -> list[str]:
    lines = git_lines(repo, "diff", "--name-only", f"{base}...HEAD")
    if not lines:
        lines = git_lines(repo, "diff", "--name-only", "HEAD")
    return sorted(set(lines))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base",
        default="main",
        help="Merge base for diff (default: main)",
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path.cwd(),
        help="Repository root (default: cwd)",
    )
    args = parser.parse_args()
    repo = args.repo.resolve()

    agents_files = discover_agents_md(repo)
    if not agents_files:
        raise SystemExit("No AGENTS.md files found")

    scopes: dict[str, dict] = {}
    nested_order: list[tuple[str | None, str]] = []

    for agents_path in agents_files:
        scope_root = agents_path.parent
        sid = scope_id(scope_root, repo)
        prefix = path_prefix(scope_root, repo)
        rules_dir = scope_root / ".agents" / "rules"
        rule_files = list_rules(rules_dir)
        scopes[sid] = {
            "id": sid,
            "agents_md": agents_path.relative_to(repo).as_posix(),
            "scope_root": scope_root.relative_to(repo).as_posix(),
            "path_prefix": prefix,
            "rules_dir": rules_dir.relative_to(repo).as_posix()
            if rules_dir.is_dir()
            else None,
            "rule_files": rule_files,
        }
        if prefix is not None:
            nested_order.append((prefix, sid))

    nested_order.sort(key=lambda x: len(x[0] or ""), reverse=True)

    if "repo-root" not in scopes:
        root_agents = repo / "AGENTS.md"
        if root_agents.is_file():
            rules_dir = repo / ".agents" / "rules"
            scopes["repo-root"] = {
                "id": "repo-root",
                "agents_md": "AGENTS.md",
                "scope_root": ".",
                "path_prefix": None,
                "rules_dir": ".agents/rules" if rules_dir.is_dir() else None,
                "rule_files": list_rules(rules_dir),
            }

    paths = changed_paths(repo, args.base)
    by_scope: dict[str, list[str]] = {sid: [] for sid in scopes}
    for path in paths:
        sid = assign_path(path, nested_order)
        if sid not in by_scope:
            by_scope[sid] = []
        by_scope[sid].append(path)

    # Root scope only receives paths not claimed by a nested prefix.
    if "repo-root" in scopes:
        root_paths: list[str] = []
        for path in paths:
            claimed = False
            for prefix, sid in nested_order:
                if prefix and under_prefix(path, prefix):
                    claimed = True
                    break
            if not claimed:
                root_paths.append(path)
        by_scope["repo-root"] = sorted(root_paths)

    active = [sid for sid, ps in by_scope.items() if ps and sid in scopes]
    payload = {
        "base": args.base,
        "repo_root": str(repo),
        "scopes": scopes,
        "paths_by_scope": by_scope,
        "active_scope_ids": active,
    }
    json.dump(payload, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
