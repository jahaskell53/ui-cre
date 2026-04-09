#!/bin/bash

# This script runs the CSV processing pipeline in order:
# 1. Cleans the CSV by removing redundant columns.
# 2. Splits property details into square footage and building category.
# 3. Refines the data and extracts cap rates.

# Exit immediately if any command fails
set -e

# Check if a file path was provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <path_to_csv>"
    exit 1
fi

CSV_FILE=$1

# Get the absolute path of the directory where this script resides
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "----------------------------------------"
echo "Starting processing for: $CSV_FILE"
echo "----------------------------------------"

# Run Script 1: Clean CSV
echo "[1/3] Running 1-clean_csv.py..."
python3 "$SCRIPT_DIR/1-clean_csv.py" "$CSV_FILE"

# Run Script 2: Split Details
echo "[2/3] Running 2-split_details.py..."
python3 "$SCRIPT_DIR/2-split_details.py" "$CSV_FILE"

# Run Script 3: Refine Details
echo "[3/4] Running 3-refine_details.py..."
python3 "$SCRIPT_DIR/3-refine_details.py" "$CSV_FILE"

# Run Script 4: Geocode Listings
echo "[4/4] Running 4-geocode_csv.py..."
python3 "$SCRIPT_DIR/4-geocode_csv.py" "$CSV_FILE"

echo "----------------------------------------"
echo "Pipeline completed successfully!"
echo "----------------------------------------"
