import csv
import sys
import os
import re

def split_property_details(file_path):
    """
    Splits the 'Property Detail 2' column into 'Square Footage' and 'Building Type'.
    """
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return

    temp_path = file_path + ".tmp"
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f_in:
            reader = csv.DictReader(f_in)
            fieldnames = reader.fieldnames
            
            if 'Property Detail 2' not in fieldnames:
                print("Error: 'Property Detail 2' column not found.")
                return

            # Prepare new fieldnames
            new_fieldnames = list(fieldnames)
            # Find index of Property Detail 2 to insert after it
            idx = new_fieldnames.index('Property Detail 2')
            new_fieldnames.insert(idx + 1, 'Square Footage')
            new_fieldnames.insert(idx + 2, 'Building Category')
            
            rows_to_write = []
            
            # Common patterns
            # SF pattern: e.g. "8,225 SF", "25,000 SF", "492 SF Unit"
            sf_pattern = re.compile(r'([\d,]+\s*SF)', re.IGNORECASE)
            # Building Type keywords
            type_keywords = ["Apartment", "Building", "Mobile Home Park", "Marina", "Residential Income", "Unit", "Condo", "Retail", "Office"]
            
            for row in reader:
                detail2 = row.get('Property Detail 2', '')
                
                sq_ft = ""
                building_cat = detail2
                
                # Extract SF if present
                match = sf_pattern.search(detail2)
                if match:
                    sq_ft = match.group(1).strip()
                    # Remove the SF part from the building category if it was extracted
                    building_cat = sf_pattern.sub('', building_cat).strip()
                
                # Clean up building category (remove trailing/leading punctuation/spaces)
                building_cat = building_cat.strip(", ").strip()
                
                # If building_cat is just "Unit" or "Units" after removing SF, we might want to keep it or refine it
                # For now, we'll store whatever is left.
                
                row['Square Footage'] = sq_ft
                row['Building Category'] = building_cat
                rows_to_write.append(row)

        with open(temp_path, 'w', encoding='utf-8', newline='') as f_out:
            writer = csv.DictWriter(f_out, fieldnames=new_fieldnames)
            writer.writeheader()
            writer.writerows(rows_to_write)
        
        os.replace(temp_path, file_path)
        print(f"Successfully split details in: {file_path}")

    except Exception as e:
        print(f"An error occurred: {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 2-split_details.py <path_to_csv>")
    else:
        split_property_details(sys.argv[1])
