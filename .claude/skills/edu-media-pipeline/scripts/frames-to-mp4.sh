#!/bin/bash
# Usage: frames-to-mp4.sh <dir> <out.mp4> [fps=30] [crf=24] [width]
# Encodes <dir>/f%04d.png to H.264 yuv420p +faststart; optional scale to width (even height).
set -e
[ $# -lt 2 ] && { sed -n 2,3p "$0"; exit 1; }
DIR=$1; OUT=$2; FPS=${3:-30}; CRF=${4:-24}; VF="scale=trunc(iw/2)*2:trunc(ih/2)*2"
[ -n "$5" ] && VF="scale=$5:-2"
ffmpeg -y -loglevel error -framerate "$FPS" -i "$DIR/f%04d.png" -vf "$VF" \
  -c:v libx264 -preset slow -crf "$CRF" -pix_fmt yuv420p -movflags +faststart "$OUT"
ls -l "$OUT"
