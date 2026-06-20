#!/usr/bin/env bash

# Default proxy URL if not set
PROXY_URL="${PROXY_URL:-http://127.0.0.1:8080}"

docker run -it \
    --privileged \
    --rm \
    --name docker-tuxlervpn-server \
    --hostname="$(hostname)" \
    --shm-size="2g" \
    -e PROXY_URL="$PROXY_URL" \
    --publish="127.0.0.1:1701:1701/tcp" \
    --publish="127.0.0.1:10702:10702/tcp" \
    --publish="127.0.0.1:19703:19703/tcp" \
    --publish="127.0.0.1:28704:28704/tcp" \
    --publish="127.0.0.1:37705:37705/tcp" \
    --publish="127.0.0.1:46706:46706/tcp" \
    --publish="127.0.0.1:55707:55707/tcp" \
    --publish="127.0.0.1:64708:64708/tcp" \
    --publish="127.0.0.1:23321:23321/tcp" \
    --publish="127.0.0.1:23322:23322/tcp" \
    --publish="127.0.0.1:23323:23323/tcp" \
    --publish="127.0.0.1:23324:23324/tcp" \
    --publish="127.0.0.1:23325:23325/tcp" \
    --publish="127.0.0.1:23326:23326/tcp" \
    --publish="127.0.0.1:23327:23327/tcp" \
    --publish="127.0.0.1:23328:23328/tcp" \
    docker-tuxlervpn-server:latest
