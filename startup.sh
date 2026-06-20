#!/usr/bin/env bash
set -e

WHITELIST_PORT=31112
TRANSOCKS_PORT=12345

# Dynamic interface detection
INTERFACE=$(ip route | grep default | awk '{print $5}' | head -n1)
if [ -z "$INTERFACE" ]; then
    INTERFACE="eth0"
    echo "Warning: Could not detect default interface, falling back to eth0"
else
    echo "Detected default interface: $INTERFACE"
fi

# Check for required binaries
for cmd in transocks iptables wine xvfb-run; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: Required command '$cmd' not found."
        exit 1
    fi
done

echo "Creating /etc/transocks.toml"
cat <<EOF >/etc/transocks.toml
listen = "0.0.0.0:$TRANSOCKS_PORT"
proxy_url = "$PROXY_URL"
[log]
level = "info"
EOF

echo "Restarting transocks and redirecting traffic via iptables"
transocks &
TRANSOCKS_PID=$!

# Wait a bit for transocks to start
sleep 2

if ! kill -0 $TRANSOCKS_PID 2>/dev/null; then
    echo "Error: transocks failed to start."
    exit 1
fi

sysctl -w "net.ipv4.conf.$INTERFACE.route_localnet=1" || echo "Warning: Could not set route_localnet (maybe not privileged?)"

echo "-----------------------------"
echo "# Adding iptables chain rules"
echo "-----------------------------"
# Create new chain
iptables -t nat -N REDSOCKS || true
iptables -t nat -F REDSOCKS

# Exclude local and reserved addresses
iptables -t nat -A REDSOCKS -d 0.0.0.0/8 -j RETURN
iptables -t nat -A REDSOCKS -d 10.0.0.0/8 -j RETURN
iptables -t nat -A REDSOCKS -d 127.0.0.0/8 -j RETURN
iptables -t nat -A REDSOCKS -d 169.254.0.0/16 -j RETURN
iptables -t nat -A REDSOCKS -d 172.16.0.0/12 -j RETURN
iptables -t nat -A REDSOCKS -d 192.168.0.0/16 -j RETURN
iptables -t nat -A REDSOCKS -d 224.0.0.0/4 -j RETURN
iptables -t nat -A REDSOCKS -d 240.0.0.0/4 -j RETURN
iptables -t nat -A REDSOCKS -p tcp --dport "$WHITELIST_PORT" -j RETURN

# Redirect all tcp traffic to port
iptables -t nat -A REDSOCKS -p tcp -j REDIRECT --to-ports "$TRANSOCKS_PORT"

# Use the chain for output traffic
if ! iptables -t nat -C OUTPUT -p tcp -j REDSOCKS 2>/dev/null; then
    iptables -t nat -A OUTPUT -p tcp -j REDSOCKS
fi

# Forward ports to local namespace
iptables -t nat -I PREROUTING -p tcp --match multiport --dports 1701,10702,19703,28704,37705,46706,55707,64708 -j DNAT --to-destination 127.0.0.1
iptables -t nat -I PREROUTING -p tcp --match multiport --dports 23321,23322,23323,23324,23325,23326,23327,23328 -j DNAT --to-destination 127.0.0.1

echo "Starting Wine applications..."
wineboot -u ExtensionHelperAppManager.exe
wineboot -u ExtensionHelperApp.exe

xvfb-run -a wine ExtensionHelperAppManager.exe &
xvfb-run -a wine ExtensionHelperApp.exe &

# Start the node client if it exists
if [ -f "client.js" ]; then
    echo "Starting node client..."
    node client.js &
fi

if [[ "$1" ]]; then
    exec "$@"
else
    # Keep the container running
    wait
fi
