#!/bin/sh
mode=-d
while (( "$#" )); do
  case "$1" in
  --image-tag)
    tag=":$2"
    shift
    ;;
  --interactive)
    mode=-it
    ;;
  --test)
    mode='-it --env NODE_ENV=development --rm'
    prefix=test-
    ;;
  *)
    echo "Unknown argument: $1" 1>&2
    exit 1
  esac
  shift
done
volume="--volume $(pwd)/src/config:/home/node/app/dist/config"
sudo docker stop ${prefix}discord-bots 2> /dev/null
sudo docker rm ${prefix}discord-bots 2> /dev/null
sudo docker run $mode --name ${prefix}discord-bots $volume discord/bots$tag
