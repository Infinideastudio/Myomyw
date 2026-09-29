#!/usr/bin/env bash
# Trains the Impossible AI's network by AlphaZero-style self-play (see docs/ai.md).
#
#   packages/engine/scripts/train.sh FIRST LAST [DIR]
#
# Iteration g plays GAMES (default 15 000) self-play games of the PUCT search
# with ITERS (default 3200) iterations per decision using DIR/az<g−1>.bin
# (the built-in network if that file is missing), recording each decision's
# visit distribution; trains DIR/az<g>.bin from az<g−1> on the value and
# policy targets of all iterations so far plus VALUE (comma-separated
# value-only data files, optional); then plays it against az<g−1>.
# Copy the best network to src/ai/value/weights.bin.
set -euo pipefail
cd "$(dirname "$0")/../../.."
cargo build --release -q --bin selfplay --bin train --bin arena
first=$1 last=$2 dir=${3:-target/nn}
games=${GAMES:-15000}
iters=${ITERS:-3200}
bin=target/release
search="mcts:puct=0.5,prior=0"
mkdir -p "$dir"
if [ ! -f "$dir/az$((first - 1)).bin" ]; then cp packages/engine/src/ai/value/weights.bin "$dir/az$((first - 1)).bin"; fi
for g in $(seq "$first" "$last"); do
  p=$((g - 1))
  "$bin/selfplay" --a "$search,iters=$iters,net=$dir/az$p.bin" --games "$games" --out "$dir/azpol$g.bin" --seed $((1000 + g))
  data=""
  for k in $(seq 1 "$g"); do
    if [ -f "$dir/azpol$k.bin" ]; then data="$dir/azpol$k.bin,$data"; fi
  done
  data="$data${VALUE:-}"
  "$bin/train" --data "${data%,}" --init "$dir/az$p.bin" --policy 1 --out "$dir/az$g.bin" --epochs 4 --batch 2048
  "$bin/arena" --a "$search,iters=$iters,net=$dir/az$g.bin" --b "$search,iters=$iters,net=$dir/az$p.bin" --games 1000
done
