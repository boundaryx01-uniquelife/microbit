#!/bin/bash
# Usage: video-frames.sh <video> <outdir> [n=8]
# Writes <outdir>/sheet.png (contact sheet of n evenly spaced frames) and <outdir>/last.png.
set -e
[ $# -lt 2 ] && { sed -n 2,3p "$0"; exit 1; }
V=$1; O=$2; N=${3:-8}; mkdir -p "$O"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")
COLS=$(( N < 4 ? N : 4 )); ROWS=$(( (N + COLS - 1) / COLS ))
for i in $(seq 0 $((N-1))); do
  T=$(awk -v d="$DUR" -v i="$i" -v n="$N" 'BEGIN{printf "%.3f", d*(i+0.5)/n}')
  ffmpeg -y -loglevel error -ss "$T" -i "$V" -frames:v 1 -vf scale=480:-2 "$O/s$(printf %02d $i).png"
done
ffmpeg -y -loglevel error -framerate 1 -i "$O/s%02d.png" -vf "tile=${COLS}x${ROWS}" -frames:v 1 "$O/sheet.png"
rm -f "$O"/s[0-9][0-9].png
# last frame: seek near end, keep the final decoded frame
ffmpeg -y -loglevel error -sseof -0.5 -i "$V" -update 1 -q:v 1 "$O/last.png"
echo "duration=${DUR}s -> $O/sheet.png $O/last.png"
