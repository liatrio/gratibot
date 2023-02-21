import os, uuid, subprocess
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient, BlobClient, ContainerClient
from datetime import datetime, timedelta, timezone

def is_expired(blob):
    now = datetime.now()
    time_since_modified = datetime.now(timezone.utc) - blob.last_modified
    return time_since_modified.days >= 1

def destroy_stack(blob, container_client):
    print(f'Beginning destroy of expired stack {blob.name}')
    os.environ['STATE_KEY'] = blob.name
    subprocess.run(['terragrunt', 'init', '-reconfigure'], check=True)
    subprocess.run(['terragrunt', 'plan'], check=True)
#    container_client.delete_blob(blob)

def get_client():
    credential = DefaultAzureCredential()
    account_url = "https://gratibotazuredatatfnp.blob.core.windows.net/"

    return BlobServiceClient(account_url, credential).get_container_client("tfstate")

def main():
    try:
        container_client = get_client()
        blobs = container_client.list_blobs()
        for blob in blobs:
            if is_expired(blob):
                destroy_stack(blob, container_client)

    except Exception as ex:
        print(ex)

if __name__ == "__main__":
    main()

