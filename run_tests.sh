#!/bin/bash
# Test runner script for Voxel MMO
# Activates virtual environment and runs all tests

cd "$(dirname "$0")"

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "Error: Virtual environment not found at ./venv"
    echo "Please create it with: python3 -m venv venv"
    echo "Then install dependencies: pip install -r requirements.txt"
    exit 1
fi

# Run tests
echo "========================================================================"
echo "Running Voxel MMO Test Suite"
echo "========================================================================"
python3 tests/run_tests.py "$@"

# Capture exit code
EXIT_CODE=$?

# Deactivate virtual environment
deactivate

exit $EXIT_CODE
