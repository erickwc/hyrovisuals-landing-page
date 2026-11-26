#!/usr/bin/env bash
# Junta los cuadros de frames/<nombre>/ (salen de frames() en capture.ts, a 2×) en los videos de las gráficas de miles
# de puntos: webm (VP9) y mp4 (H.264, para navegadores sin VP9), a tamaño normal y 30 cuadros por segundo.
# Uso: bash tools/visual-capture/encode.sh [prefijo]   (ej. c3 para solo la combinación 3)
set -euo pipefail
cd "$(dirname "$0")"
out=../../public/landing/traces
fps=59.375 # 150 pasos por compás a 95 BPM, como las grabaciones
vf="fps=$fps/2,scale=trunc(iw/4)*2:trunc(ih/4)*2:flags=lanczos"
for dir in frames/*/; do
  name=$(basename "$dir")
  if [ -n "${1:-}" ] && [[ "$name" != "$1"* ]]; then continue; fi
  ffmpeg -v error -y -framerate $fps -i "$dir/%04d.png" -vf "$vf" -c:v libvpx-vp9 -crf 42 -b:v 0 -row-mt 1 -cpu-used 2 -pix_fmt yuv420p -an "$out/$name.webm"
  ffmpeg -v error -y -framerate $fps -i "$dir/%04d.png" -vf "$vf" -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -movflags +faststart -an "$out/$name.mp4"
  echo "$name: $(du -k "$out/$name.webm" | cut -f1) KB webm, $(du -k "$out/$name.mp4" | cut -f1) KB mp4"
done
