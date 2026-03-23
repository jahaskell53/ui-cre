import csv
import sys
import os
import urllib.request
import urllib.parse
import json
import time

MAPBOX_TOKEN = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA'

def geocode_address(address):
    """
    Geocodes an address using Mapbox API.
    Returns (longitude, latitude) or None.
    """
    try:
        encoded_address = urllib.parse.quote(address)
        url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{encoded_address}.json?access_token={MAPBOX_TOKEN}"
        
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            if data.get('features') and len(data['features']) > 0:
                coords = data['features'][0]['center']  # [lng, lat]
                return coords
    except Exception as e:
        print(f"⚠️ Geocoding failed for: {address}. Error: {e}")
    return None

def main(file_path):
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return

    temp_path = file_path + ".tmp"
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f_in:
            reader = csv.DictReader(f_in)
            fieldnames = list(reader.fieldnames)
            
            # Add Latitude and Longitude if they don't exist
            if 'Latitude' not in fieldnames:
                fieldnames.append('Latitude')
            if 'Longitude' not in fieldnames:
                fieldnames.append('Longitude')
            
            rows = []
            for row in reader:
                # Only geocode if we haven't already
                if not row.get('Latitude') or not row.get('Longitude'):
                    full_address = f"{row.get('Address', '')}, {row.get('Location', '')}".strip(', ')
                    if full_address:
                        print(f"🔍 Geocoding: {full_address}")
                        coords = geocode_address(full_address)
                        if coords:
                            row['Longitude'] = coords[0]
                            row['Latitude'] = coords[1]
                            print(f"✅ Found: {coords[1]}, {coords[0]}")
                        else:
                            print(f"⚠️ Could not find coordinates for: {full_address}")
                        
                        # Respect rate limits
                        time.sleep(0.2)
                rows.append(row)

        with open(temp_path, 'w', encoding='utf-8', newline='') as f_out:
            writer = csv.DictWriter(f_out, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        os.replace(temp_path, file_path)
        print(f"Successfully geocoded listings in: {file_path}")

    except Exception as e:
        print(f"An error occurred: {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 4-geocode_csv.py <path_to_csv>")
    else:
        main(sys.argv[1])
