from __future__ import annotations

import argparse
import os
from pathlib import Path
import re
import sys

from research_engine.acquisition import AcquisitionPending
from research_engine.mission import default_mission, load_mission
from research_engine.orchestrator import run_mission


def _extract_local_stop_term_suggestion(acquisition_notes: list[str]) -> str | None:
    for note in acquisition_notes:
        match = re.search(r"suggested_stop_terms=([^.]+)", note)
        if not match:
            continue
        value = match.group(1).strip()
        if not value or value.lower() == "none":
            return None
        return value
    return None


def _load_local_dotenv(dotenv_path: Path | None = None) -> None:
    candidate = dotenv_path or Path(".env")
    if not candidate.exists():
        return
    try:
        lines = candidate.read_text(encoding="utf-8").splitlines()
    except OSError:
        return
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue
        os.environ[key] = value.strip().strip("\"").strip("'")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="research-engine",
        description="Run a bounded Research Engine research pass and emit inspectable artifacts.",
    )
    parser.add_argument(
        "--mission-file",
        type=Path,
        help="Optional JSON file describing a research mission.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("artifacts"),
        help="Directory where Research Engine should write artifacts.",
    )
    parser.add_argument(
        "--acquisition-mode",
        default="catalog",
        choices=["catalog", "codex-session", "local-first", "live-hybrid", "api-provider"],
        help="Acquisition backend to use for discovery and fetch.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    _load_local_dotenv()
    parser = build_parser()
    args = parser.parse_args(argv)
    mission = load_mission(args.mission_file) if args.mission_file else default_mission()
    try:
        record = run_mission(
            mission,
            output_dir=args.output_dir,
            acquisition_mode=args.acquisition_mode,
        )
    except AcquisitionPending as error:
        print(str(error), file=sys.stderr)
        print(f"Session directory: {error.session_dir}", file=sys.stderr)
        return 2
    print(f"Mission: {record.mission.mission_id}")
    print(f"Acquisition mode: {record.plan.selected_acquisition_mode}")
    print(f"Candidates: {len(record.candidates)}")
    print(f"Rejections: {len(record.rejections)}")
    if record.plan.selected_acquisition_mode == "local-first":
        suggestion = _extract_local_stop_term_suggestion(record.acquisition_notes)
        if suggestion:
            print(f"Suggested RESEARCH_ENGINE_LOCAL_STOP_TERMS: {suggestion}")
    print(f"Artifacts: {args.output_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
