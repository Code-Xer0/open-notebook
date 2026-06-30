import os
import glob
import requests

api_url = "http://127.0.0.1:5055/api"
password = "open-notebook-change-me"

headers = {"Authorization": f"Bearer {password}"}

directory = r"C:\Users\Inf3r\Downloads\Nexus Assets\NEXUS_PROJECT_SPACE\00_DOCTRINE\Latest"
files = glob.glob(os.path.join(directory, "*.md"))

for filepath in files:
    filename = os.path.basename(filepath)
    print(f"Uploading {filename}...")
    with open(filepath, "rb") as f:
        response = requests.post(
            f"{api_url}/sources",
            headers=headers,
            data={"type": "upload", "parse": "true", "embed": "true"},
            files={"file": (filename, f, "text/markdown")}
        )
    if response.status_code == 200:
        print(f"Success: {filename}")
    else:
        print(f"Failed: {filename} - {response.status_code} - {response.text}")
