#!/bin/bash
set -ex

apt-get update -y
apt-get install -y curl autoconf automake libtool pkg-config git make

# Build libpostal from source (required by the `postal` Python package)
# Note: this downloads ~2GB of training data and takes 10-15 minutes on first build
git clone https://github.com/openvenues/libpostal /tmp/libpostal
cd /tmp/libpostal
./bootstrap.sh
./configure --datadir=/usr/local/share/libpostal --disable-dependency-tracking
make -j4
make install
ldconfig
