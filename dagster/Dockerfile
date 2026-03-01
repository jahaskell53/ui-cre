FROM python:3.11-slim

# Install libpostal (required by the `postal` Python package)
RUN apt-get update -y && \
    apt-get install -y curl autoconf automake libtool pkg-config git make && \
    git clone https://github.com/openvenues/libpostal /tmp/libpostal && \
    cd /tmp/libpostal && \
    ./bootstrap.sh && \
    ./configure --datadir=/usr/local/share/libpostal --disable-dependency-tracking && \
    make -j4 && \
    make install && \
    ldconfig && \
    rm -rf /tmp/libpostal

ENV LD_LIBRARY_PATH=/usr/local/lib

WORKDIR /app

COPY pyproject.toml .
COPY zillow_pipeline/ zillow_pipeline/

RUN pip install uv && uv pip install --system .
