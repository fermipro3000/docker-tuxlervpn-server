FROM ubuntu:18.04

LABEL maintainer="Florin <florin@carcabot.ro>"
LABEL name="docker-tuxlervpn-server"
LABEL version="latest"

# set ENV
ENV DISPLAY=:0 \
    WINEDEBUG=fixme-all \
    WINEPREFIX=/root/.demo \
    WINEARCH=win64

# Install dependencies and Wine
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        wget \
        software-properties-common \
        gnupg2 \
        ca-certificates && \
    dpkg --add-architecture i386 && \
    wget -nc https://dl.winehq.org/wine-builds/winehq.key && \
    apt-key add winehq.key && \
    apt-add-repository 'deb https://dl.winehq.org/wine-builds/ubuntu/ bionic main' && \
    add-apt-repository 'ppa:cybermax-dexter/sdl2-backport' && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        winehq-stable \
        winbind \
        iptables \
        xvfb \
        net-tools \
        curl \
        npm \
        nano && \
    npm i ws && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* winehq.key

# Setup Wine prefix
RUN winecfg

COPY setup.tar .
COPY startup.sh /usr/local/bin/entrypoint.sh
COPY transocks /usr/local/bin/transocks
COPY client.js .

RUN chmod +x /usr/local/bin/entrypoint.sh && tar -xvf setup.tar

# Run application
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
