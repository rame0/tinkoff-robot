#!/bin/bash

pnpm run build
#rm -rf ./logs/*
echo '' >"./logs/test.txt"
PARAMS=(0)
# strategy type
for ((B = 0; B <= 0; ++B)); do
  # interval
  for ((C = 1; C <= 2; ++C)); do
    # params
    if [ $B -eq 0 ]; then
      for ((A = 0; A <= 7; ++A)); do
        echo "Running job $A $B $C"
        #        pnpm run backtest "$A" "$B" "$C" >"./logs/test${A}-${B}-${C}.txt"
        pnpm run backtest "$A" "$B" "$C" >>"./logs/test.txt"
      done
    else
      for A in "${PARAMS[@]}"; do
        echo "Running job $A $B $C"
        #        pnpm run backtest "$A" "$B" "$C" >"./logs/test${A}-${B}-${C}.txt"
        pnpm run backtest "$A" "$B" "$C" >>"./logs/test.txt"
      done
    fi
  done
done
