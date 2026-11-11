#!/bin/sh
# Launched only after the user quits. All paths are arguments, never shell code.
# The staged update is beside the target, so both renames stay on one filesystem.
set -eu
parent_pid=$1
staged=$2
target=$3
backup=$4
identity=$5
marker=$6
count=0
while kill -0 "$parent_pid" 2>/dev/null; do
  count=$((count + 1))
  [ "$count" -lt 300 ] || exit 1
  sleep 1
done
# Do not replace an application that was manually changed while we waited.
[ -e "$staged" ] && [ -e "$target" ] || exit 1
[ "$(ls -di "$target" | awk '{print $1}')" = "$identity" ] || exit 1
[ ! -e "$backup" ] || exit 1
mv "$target" "$backup"
if mv "$staged" "$target"; then
  printf '%s\n' installed > "$marker"
else
  mv "$backup" "$target"
  exit 1
fi
