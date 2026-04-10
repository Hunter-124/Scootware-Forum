#!/bin/bash
# setup-swap.sh - Create a persistent 5GB swap file on Ubuntu/Debian VPS
# This script must be run with sudo

SWAPFILE="/swapfile"
SWAPSIZE="5G"

if [ -f "$SWAPFILE" ]; then
    echo "Swap file $SWAPFILE already exists. Checking size..."
    CURRENT_SIZE=$(ls -lh "$SWAPFILE" | awk '{print $5}')
    echo "Current size: $CURRENT_SIZE"
    exit 0
fi

echo "Creating ${SWAPSIZE} swap file at ${SWAPFILE}..."
sudo fallocate -l $SWAPSIZE $SWAPFILE || sudo dd if=/dev/zero of=$SWAPFILE bs=1M count=5120

echo "Setting permissions..."
sudo chmod 600 $SWAPFILE

echo "Setting up swap space..."
sudo mkswap $SWAPFILE

echo "Enabling swap..."
sudo swapon $SWAPFILE

echo "Making swap persistent..."
if ! grep -q "$SWAPFILE" /etc/fstab; then
    echo "$SWAPFILE swap swap defaults 0 0" | sudo tee -a /etc/fstab
    echo "Added to /etc/fstab"
else
    echo "Already in /etc/fstab"
fi

echo "Current swap status:"
swapon --show
free -h

echo "SUCCESS: 5GB persistent swap file created and enabled."