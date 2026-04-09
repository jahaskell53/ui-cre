import csv
import sys
import os
import re

def refine_loopnet_data(file_path):
    """
    Refines Loopnet data by:
    1. Extracting 'Cap Rate' from 'Property Detail 1'.
    2. Consolidating 'Building Category' from 'Property Detail 1' and 'Property Detail 2'.
    3. Cleaning up the final column structure.
    """
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return

    temp_path = file_path + ".tmp"
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f_in:
            reader = csv.DictReader(f_in)
            fieldnames = reader.fieldnames
            
            # Ensure required base columns exist
            required = ['Property Detail 1', 'Property Detail 2', 'Building Category', 'Square Footage']
            for col in required:
                if col not in fieldnames:
                    print(f"Error: Required column '{col}' missing. Run previous scripts first.")
                    return

            # Define new field names. We will replace Property Detail 1/2 with Cap Rate and consolidated Building Category.
            # Order: Listing URL, Thumbnail URL, Broker Logo URL, Address, Headline, Location, Price, Cap Rate, Building Category, Square Footage
            new_fieldnames = [
                'Listing URL', 'Thumbnail URL', 'Broker Logo URL', 'Address', 
                'Headline', 'Location', 'Price', 'Cap Rate', 'Building Category', 'Square Footage'
            ]
            
            # Patterns
            cap_rate_pattern = re.compile(r'(\d+\.?\d*%\s*Cap\s*Rate)', re.IGNORECASE)
            sf_pattern = re.compile(r'([\d,]+\s*SF)', re.IGNORECASE)
            
            rows_to_write = []
            
            for row in reader:
                p_detail1 = row.get('Property Detail 1', '').strip()
                p_detail2 = row.get('Property Detail 2', '').strip()
                existing_cat = row.get('Building Category', '').strip()
                existing_sf = row.get('Square Footage', '').strip()
                
                cap_rate = ""
                consolidated_cat = existing_cat
                
                # 1. Extract Cap Rate from Property Detail 1
                cap_match = cap_rate_pattern.search(p_detail1)
                if cap_match:
                    cap_rate = cap_match.group(1)
                elif "Cap Rate" not in p_detail1 and p_detail1:
                    # If it's not a cap rate, it might be building category info (e.g. "15 Unit Apartment Building")
                    # If consolidated_cat is empty, or if p_detail1 is more descriptive, we use it.
                    if not consolidated_cat or len(p_detail1) > len(consolidated_cat):
                         # Just make sure we don't put Square Footage info back in if we already have it
                         # Remove SF from p_detail1 if it exists
                         clean_p1 = sf_pattern.sub('', p_detail1).strip(", ")
                         if clean_p1:
                            consolidated_cat = clean_p1

                # 2. Check Property Detail 1 for Square Footage if consolidated SF is still empty
                if not existing_sf:
                    sf_match = sf_pattern.search(p_detail1)
                    if sf_match:
                        existing_sf = sf_match.group(1)

                # 3. Final consolidation of Building Category:
                # If Property Detail 2 was used to get SF, it might still have building type info (e.g. "Apartment Building")
                # Our previous script already tried to put that in 'Building Category'.
                
                # Cleanup: if any column contains "Price Upon Request" or "1 Unit Available" 
                # but we missed it in price, we leave it, but we want Cap Rate and Category clean.
                
                new_row = {
                    'Listing URL': row.get('Listing URL', ''),
                    'Thumbnail URL': row.get('Thumbnail URL', ''),
                    'Broker Logo URL': row.get('Broker Logo URL', ''),
                    'Address': row.get('Address', ''),
                    'Headline': row.get('Headline', ''),
                    'Location': row.get('Location', ''),
                    'Price': row.get('Price', ''),
                    'Cap Rate': cap_rate,
                    'Building Category': consolidated_cat,
                    'Square Footage': existing_sf
                }
                rows_to_write.append(new_row)

        with open(temp_path, 'w', encoding='utf-8', newline='') as f_out:
            writer = csv.DictWriter(f_out, fieldnames=new_fieldnames)
            writer.writeheader()
            writer.writerows(rows_to_write)
        
        os.replace(temp_path, file_path)
        print(f"Successfully refined data and consolidated columns in: {file_path}")

    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 3-refine_details.py <path_to_csv>")
    else:
        refine_loopnet_data(sys.argv[1])
