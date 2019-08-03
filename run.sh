#!/bin/sh
mode='-d'
image='discord-bots'
while (( "$#" )); do
  case "$1" in
  --image-tag)
    tag=":$2"
    shift
    ;;
  --interactive)
    mode='-it'
    ;;
  --test)
    mode='-it --env NODE_ENV=development --rm'
    image="test-$image"
    ;;
  *)
    echo "Unknown argument: $1" 1>&2
    exit 1
  esac
  shift
done
volume="--volume $(pwd)/src/config:/home/node/app/dist/config"
imageId="$(docker ps --filter "name=$image" --format '{{.Image}}')"
if [[ -n "$imageId" ]];
  tag="$(docker images --filter 'reference=discord/bots' --format '{{.ID}}:{{.Tag}}' | grep "$imageId" | cut -d: -f2)"
  echo 'Upgrading existing container...'
  echo "Current image: $tag ($imageId)"
  sudo docker stop "$image"
  sudo docker rm "$image"
fi
sudo docker run $mode --name "$image" $volume "discord/bots$tag"
