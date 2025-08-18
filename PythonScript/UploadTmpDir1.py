import configparser
import logging
import os
from ftplib import FTP
from azure.storage.blob import BlobServiceClient, ContentSettings

logging.basicConfig(level=logging.ERROR)
logging.info(
    'Starting MoveFTPFiles.py'
)
logging.debug(
    'Reading config file'
)

# Read config file
config = configparser.ConfigParser()
config.read('config.ini')

logging.info(
    'Server Address: ' + config['DEFAULT']['ServerAddress']
)
logging.info(
    'Destination Path: ' + config['DEFAULT']['TempPath']
)
logging.debug(
    'Successfully read config file'
)


def upload_blob(local_filename, item):
    logger = logging.getLogger("azure.storage")
    logger.setLevel(logging.ERROR)
    service = BlobServiceClient.from_connection_string(config['AZURESTORAGEACCOUNT']['ConnectionString'])
    container_client = service.get_container_client(config['AZURESTORAGEACCOUNT']['ContainerName'])
    blob_client = container_client.get_blob_client(item)
    cnt_settings = ContentSettings(content_type="video/mp4")

    logging.info(f"Uploading file to blob storage: {local_filename}")
    with open(file=local_filename, mode="rb") as data:
        blob_client.upload_blob(data, content_settings=cnt_settings)

def main():
    upload_blob('/Users/shawnreynolds/tmp/20240107_0855-.mp4', '20240107_0855-.mp4')


if __name__ == '__main__':
    main()