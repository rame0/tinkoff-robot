#!/bin/bash

rm -rf ./logs/*

set -o monitor
# means: run background processes in a separate processes...
trap add_next_job CHLD
# execute add_next_job when we receive a child complete signal

index=0
max_jobs=15

# build jobs
JOBS=()
# strategy type
for ((B = 0; B <= 1; ++B)); do
  # period
  for ((C = 1; C <= 3; ++C)); do
    # params
    for ((A = 0; A <= 30; ++A)); do
      #    for A in "${paramstouse[@]}"; do
      JOBS+=("$A $B $C")
      #      pnpm run backtest "$A" "$B" "$C"
    done
  done
done

# run jobs
function add_next_job {
  # if still jobs to do then add one
  if [[ $index -lt ${#JOBS[*]} ]]; then # apparently stackoverflow doesn't like bash syntax
    # the hash in the if is not a comment - rather it's bash awkward way of getting its length
    IFS=\  read -r -a params <<< "${JOBS[$index]}"

    echo adding job "${JOBS[$index]}"
    pnpm run backtest $(printf -- '%s ' "${params[@]}") >>"./logs/test${JOBS[$index]}".log &

    index=$(($index + 1))
  fi
}

# add initial set of jobs
while [[ $index -lt $max_jobs ]]; do
  add_next_job
done

# wait for all jobs to complete
wait
echo "done"
