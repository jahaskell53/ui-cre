import csv
import sys
import os

def clean_loopnet_csv(file_path):
    """
    Cleans a Loopnet CSV by removing redundant link columns.
    Keeps: Listing URL, Thumbnail URL, Broker Logo URL, Address, 
           Headline, Location, Price, Detail 1, Detail 2.
    """
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return

    temp_path = file_path + ".tmp"
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f_in:
            # Check if file has content
            sample = f_in.read(1024)
            f_in.seek(0)
            if not sample:
                print("Error: File is empty.")
                return
            
            # Detect dialect or use default
            reader = csv.reader(f_in)
            
            rows_to_write = []
            for row in reader:
                # Original file has 12 columns. If it's 12, we filter.
                # If it's already 9, we leave it alone (or just write it back).
                if len(row) == 12:
                    # Keep: 0, 1, 2, 3, 5, 7, 9, 10, 11
                    new_row = [row[i] for i in [0, 1, 2, 3, 5, 7, 9, 10, 11]]
                    rows_to_write.append(new_row)
                else:
                    rows_to_write.append(row)

        with open(temp_path, 'w', encoding='utf-8', newline='') as f_out:
            writer = csv.writer(f_out)
            writer.writerows(rows_to_write)
        
        os.replace(temp_path, file_path)
        print(f"Successfully cleaned: {file_path}")

    except Exception as e:
        print(f"An error occurred: {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 clean_csv.py <path_to_csv>")
    else:
        clean_loopnet_csv(sys.argv[1])
