#!/bin/sh
mode=-d
for arg in "$*"
do
  case "$arg" in
  '--test')
    mode='-it --env NODE_ENV=development --rm'
    prefix=test-
    ;;
  '--interactive'|'-i')
    mode=-it
    ;;
  '')
    ;;
  *)
    echo "Unknown argument: $arg" 1>&2
    exit 1
  esac
done
volume="--volume $(pwd)/src/config:/home/node/app/dist/config"
sudo docker run $mode --name ${prefix}discord-bots $volume discord/bots
