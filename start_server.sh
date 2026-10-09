#!/bin/bash
# Start the Voxel MMO Server

# Activate virtual environment
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    source venv/bin/activate
fi

# Start the server
python3 server.py
