import csv
import sys
import os
import re

def convert_pa_to_standard(input_path, output_path):
    if not os.path.exists(input_path):
        print(f"Error: File {input_path} not found.")
        return

    try:
        with open(input_path, 'r', encoding='utf-8') as f_in:
            reader = csv.reader(f_in)
            header = next(reader)
            
            # placard-pseudo href,company-logo src,image-hide src,header-col,subtitle-alpha,subtitle-alpha href,subtitle-beta,data-points-2c,data-points-2c 2,data-points-2c 3
            
            rows_to_write = []
            standard_header = [
                "Listing URL", "Thumbnail URL", "Broker Logo URL", "Address", 
                "Headline", "Location", "Price", "Cap Rate", "Building Category", "Square Footage"
            ]
            rows_to_write.append(standard_header)

            for row in reader:
                if not row:
                    continue
                # Mapping basic fields
                # placard-pseudo href -> Listing URL
                # image-hide src -> Thumbnail URL
                # company-logo src -> Broker Logo URL
                listing_url = row[0] if len(row) > 0 else ""
                broker_logo = row[1] if len(row) > 1 else ""
                thumbnail = row[2] if len(row) > 2 else ""
                address = row[3] if len(row) > 3 else ""
                headline = row[4] if len(row) > 4 else ""
                location = row[6] if len(row) > 6 else ""
                
                # Dynamic fields
                price = ""
                cap_rate = ""
                category = ""
                sq_ft = ""
                
                dynamic_fields = row[7:]
                for field in dynamic_fields:
                    field = field.strip()
                    if not field:
                        continue
                    
                    if '$' in field:
                        price = field
                    elif '% Cap Rate' in field:
                        cap_rate = field
                    elif any(word in field for word in ['Unit', 'Apartment', 'Properties', 'Residential Income', 'Portfolio', 'Mobile Home Park']):
                        category = field
                    elif 'SF' in field:
                        sq_ft = field
                    elif 'Built in' in field:
                        # Append to category or headline if category is empty
                        if not category:
                            category = field
                        else:
                            category += f" | {field}"
                
                new_row = [
                    listing_url, thumbnail, broker_logo, address, 
                    headline, location, price, cap_rate, category, sq_ft
                ]
                rows_to_write.append(new_row)

        with open(output_path, 'w', encoding='utf-8', newline='') as f_out:
            writer = csv.writer(f_out)
            writer.writerows(rows_to_write)
        
        print(f"Successfully converted {input_path} to {output_path}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 convert_pa_to_standard.py <input_csv> <output_csv>")
    else:
        convert_pa_to_standard(sys.argv[1], sys.argv[2])
