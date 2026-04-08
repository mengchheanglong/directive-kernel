# Research Engine

Research Engine is the Discovery-owned Python source-intelligence package inside Directive Kernel.

It is responsible for bounded source intelligence:
- finding candidate external systems and sources
- gathering inspectable evidence
- normalizing and scoring that evidence
- exporting Discovery-facing packets for the canonical Discovery front door

Research Engine stops at Discovery handoff. It does not decide Runtime or Architecture adoption.

## Quick Start

Run package-local tests:

```powershell
$env:PYTHONPATH = "src"
python -m unittest discover -s tests
```

Run a bounded pass:

```powershell
$env:PYTHONPATH = "src"
python -m research_engine --output-dir artifacts --acquisition-mode catalog
```

## Environment

Optional live-provider variables:
- `RESEARCH_ENGINE_GITHUB_TOKEN` or `GITHUB_TOKEN`
- `RESEARCH_ENGINE_GITLAB_TOKEN` or `GITLAB_TOKEN`
- `RESEARCH_ENGINE_TAVILY_API_KEY` or `TAVILY_API_KEY`
- `RESEARCH_ENGINE_EXA_API_KEY` or `EXA_API_KEY`
- `RESEARCH_ENGINE_FIRECRAWL_API_KEY` or `FIRECRAWL_API_KEY`

Without these keys, Research Engine still works in bounded/local modes, but live-provider coverage drops.
