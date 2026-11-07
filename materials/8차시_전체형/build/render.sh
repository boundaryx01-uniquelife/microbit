#!/bin/bash
# usage: render.sh file.docx outdir
SK=$(ls -d /root/.claude/skills/synced/*/docx)
mkdir -p "$2"; rm -f "$2"/*
python3 $SK/scripts/office/soffice.py --headless --convert-to pdf --outdir "$2" "$1" >/dev/null 2>&1
pdfinfo "$2"/*.pdf | grep Pages
pdftoppm -jpeg -r 70 "$2"/*.pdf "$2/p"
