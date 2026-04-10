#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Installation der lokalen Paketquelle ``pysonofflanr3/`` neben dieser Datei.

Dieses Skript kopiert oder überschreibt **keine** Python-Dateien im Ordner
``pysonofflanr3``. Es verweist nur auf dieses Verzeichnis, damit setuptools /
pip es einbinden können.

Empfehlung (nur Verweis auf den Quellbaum, keine Kopie nach site-packages)::

    cd scripts/sonofflan
    pip install -e .

Normale Installation (kopiert beim Installieren nach site-packages; die Quellen
unter ``pysonofflanr3/`` bleiben dabei unverändert)::

    pip install .
"""

import os
import sys

from setuptools import find_packages, setup

# Verzeichnis mit setup.py – hier liegt auch ``pysonofflanr3/`` (wird nur Referenziert).
HERE = os.path.dirname(os.path.abspath(__file__))
PACKAGE_ROOT = os.path.join(HERE, "pysonofflanr3")

if not os.path.isdir(PACKAGE_ROOT):
    sys.stderr.write(
        f"Erwarte Paketverzeichnis {PACKAGE_ROOT!r} — bitte setup.py aus {HERE!r} ausführen.\n"
    )
    sys.exit(1)

_readme_path = os.path.join(HERE, "README.rst")
_history_path = os.path.join(HERE, "HISTORY.rst")

try:
    with open(_readme_path, encoding="utf-8") as readme_file:
        readme = readme_file.read()
except OSError:
    readme = ""

try:
    with open(_history_path, encoding="utf-8") as history_file:
        history = history_file.read()
except OSError:
    history = ""

long_description = (readme + "\n\n" + history).strip()
if not long_description:
    long_description = (
        "Interface for Sonoff devices running v3+ Itead firmware "
        "(LAN mode). See https://github.com/mattsaxon/pysonofflan"
    )

requirements = [
    "Click>=7.0",
    "click_log",
    "pycryptodome",
    "requests",
    "zeroconf>=0.24.5",
]
setup_requirements = []
test_requirements = ["pytest", "tox", "python-coveralls", "flask", "flake8"]

PROJECT_URLS = {
    "Home Assistant component": "https://github.com/mattsaxon/sonoff-lan-mode-homeassistant/",
    "Bug Reports": "https://github.com/mattsaxon/pysonofflan/issues/",
    "Component Docs": "https://pysonofflanr3.readthedocs.io/",
    "Itead Dev Docs": "https://github.com/itead/Sonoff_Devices_DIY_Tools/tree/master/other/",
}

# Nur das lokale ``pysonofflanr3`` im aktuellen Setup-Verzeichnis.
# WICHTIG: setuptools erwartet hier relative Pfade.
packages = find_packages(where=".", include=["pysonofflanr3"])
if not packages:
    sys.stderr.write(f"Kein Paket 'pysonofflanr3' unter {HERE!r} gefunden.\n")
    sys.exit(1)

setup(
    author="Matt Saxon",
    author_email="saxonmatt@hotmail.com",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Natural Language :: English",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Topic :: Home Automation",
    ],
    description="Interface for Sonoff devices running v3+ Itead firmware.",
    entry_points={
        "console_scripts": [
            "pysonofflanr3=pysonofflanr3.cli:cli",
        ],
    },
    install_requires=requirements,
    license="MIT license",
    long_description=long_description,
    include_package_data=True,
    keywords="pysonofflanr3, homeassistant",
    name="pysonofflanr3",
    package_dir={"": "."},
    packages=packages,
    setup_requires=setup_requirements,
    test_suite="tests",
    tests_require=test_requirements,
    url="https://github.com/mattsaxon/pysonofflan",
    project_urls=PROJECT_URLS,
    version="1.1.4",
    zip_safe=False,
)
