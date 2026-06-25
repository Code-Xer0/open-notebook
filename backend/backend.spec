# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Open Notebook backend.

The app loads routers, AI providers (esperanto), content extractors
(content_core), the SurrealDB driver, langgraph workflows and SQL migration
files dynamically, so a bare Analysis under-bundles it (uvicorn then fails with
`ModuleNotFoundError: No module named 'api'`). We `collect_all` the dynamic
packages and ship `open_notebook` package data (the .surrealql migrations)."""

from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_data_files

datas = []
binaries = []
hiddenimports = []
spec_dir = Path(SPECPATH) if "SPECPATH" in globals() else Path.cwd()

hiddenimports += [
    "commands.source_commands",
    "commands.embedding_commands",
    "commands.podcast_commands",
    "commands.voice_commands",
]

# Heavy / dynamically-imported packages — collect submodules + data + binaries.
_packages = [
    "api",
    "commands",
    "open_notebook",
    "esperanto",
    "content_core",
    "surrealdb",
    "surreal_commands",
    "ai_prompter",
    "podcast_creator",
    "PIL",
    "langgraph",
    "langchain",
    "langchain_core",
    "langchain_community",
    "tiktoken",
    "tiktoken_ext",
    # Native / mypyc-compiled deps PyInstaller's static analysis tends to miss:
    "tomli",
    "charset_normalizer",
    "markupsafe",
    "yaml",
    "regex",
]
for _pkg in _packages:
    try:
        d, b, h = collect_all(_pkg)
        datas += d
        binaries += b
        hiddenimports += h
    except Exception as _e:  # package not installed / differently named — skip
        print(f"[backend.spec] skip {_pkg}: {_e}")

# Some mypyc-compiled dependencies install top-level .pyd helpers with hashed
# module names, so package collection does not discover them. Bundle them at the
# archive root so imports like `3c22...__mypyc` resolve in the frozen backend.
for _mypyc in (spec_dir / ".venv" / "Lib" / "site-packages").glob("*__mypyc*.pyd"):
    binaries.append((str(_mypyc), "."))
    hiddenimports.append(_mypyc.name.split(".cp", 1)[0])

# Migration SQL + any package data files (belt-and-braces with collect_all above).
try:
    datas += collect_data_files("open_notebook")
except Exception as _e:
    print(f"[backend.spec] data skip: {_e}")

for _migration in (spec_dir / "open_notebook" / "database" / "migrations").glob("*.surrealql"):
    datas.append((str(_migration), "open_notebook/database/migrations"))

for _prompt in (spec_dir / "prompts").glob("**/*.jinja"):
    _relative = _prompt.relative_to(spec_dir / "prompts").parent
    datas.append((str(_prompt), str(Path("ai_prompter") / "prompts" / _relative)))


a = Analysis(
    ['run_api.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
