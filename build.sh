#!/bin/sh
version=$(date +%Y.%m.%d.%H%M%S)
time sudo docker build -t discord/bots:$version -t discord/bots:latest .
