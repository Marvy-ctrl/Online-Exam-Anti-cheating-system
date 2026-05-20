import sys
import os
import uuid

# Add backend directory to sys.path so we can import src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from src.core.storage import storage_service
from src.config import Config

print("Config MINIO_ENDPOINT:", Config.MINIO_ENDPOINT)
print("Config MINIO_BUCKET:", Config.MINIO_BUCKET)
print("Is MinIO configured as available in service?:", storage_service.minio_available)

# Create a mock base64 PNG image (1x1 transparent pixel base64)
mock_base64_image = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlE"
    "QVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)

session_uid = str(uuid.uuid4())
snapshot_uid = uuid.uuid4()

print("\n--- Testing upload_snapshot ---")
try:
    res = storage_service.upload_snapshot(
        session_uid=session_uid,
        snapshot_uid=snapshot_uid,
        base64_image=mock_base64_image
    )
    print("Upload result:", res)
    print("Image path:", res["image_path"])
    print("Object key:", res.get("object_key"))

    if res.get("object_key"):
        print("\n--- Testing generate_presigned_url (MinIO) ---")
        url = storage_service.generate_presigned_url(res["object_key"])
        print("Presigned URL:", url)
    else:
        print("\n--- Testing Local File Generation ---")
        expected_path = os.path.join("uploads", "snapshots", session_uid, f"{snapshot_uid}.jpg")
        print("Expected local file path:", expected_path)
        if os.path.exists(expected_path):
            print("File exists on disk! Verification SUCCESS!")
        else:
            print("ERROR: File does NOT exist on disk!")
            sys.exit(1)

    print("\nAll storage engine tests completed successfully!")
except Exception as e:
    print("TEST FAILED with exception:", e)
    import traceback
    traceback.print_exc()
    sys.exit(1)
