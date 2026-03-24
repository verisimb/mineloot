#!/usr/bin/env bash

# Pindah ke direktori bot
cd "$(dirname "$0")" || exit 1

echo "Starting Mineloot Auto-Miner Bot..."
# Menjalankan bot secara langsung di terminal (foreground)
# dan juga menyalin output ke dalam file log.
node bot.js | tee -a mineloot-latest-report.txt
