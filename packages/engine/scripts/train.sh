#!/usr/bin/env bash
# Trains the Impossible AI's value network by self-play (see docs/ai.md).
#
#   packages/engine/scripts/train.sh FIRST LAST [DIR]
#
# Generation g plays GAMES self-play games with network g−1 (DIR/net<g−1>.bin;
# for g = 1 the built-in network, or the static evaluation with BOOTSTRAP=1),
# trains DIR/net<g>.bin on the positions of generations g−2…g, then plays it
# against network g−1. Copy the best network to src/ai/value/weights.bin.
set -euo pipefail
cd "$(dirname "$0")/../../.."
cargo build --release -q --bin selfplay --bin train --bin arena
first=$1 last=$2 dir=${3:-target/nn}
games=${GAMES:-20000}
bin=target/release
search="mcts:c=0.3,prior=10"
mkdir -p "$dir"
net_of() {
  if [ -f "$dir/net$1.bin" ]; then echo ",net=$dir/net$1.bin"
  elif [ "${BOOTSTRAP:-0}" = 1 ]; then echo ",eval=static,prior=0,c=1"
  else echo ""; fi
}
for g in $(seq "$first" "$last"); do
  p=$((g - 1))
  "$bin/selfplay" --a "$search,iters=800$(net_of $p)" --games "$games" --out "$dir/gen$g.bin" --seed $((g * 100))
  data="$dir/gen$g.bin"
  for k in 1 2; do
    if [ -f "$dir/gen$((g - k)).bin" ]; then data="$data,$dir/gen$((g - k)).bin"; fi
  done
  "$bin/train" --data "$data" --out "$dir/net$g.bin" --epochs 5 --batch 2048
  "$bin/arena" --a "$search,iters=2000,net=$dir/net$g.bin" --b "$search,iters=2000$(net_of $p)" --games 1000
done
