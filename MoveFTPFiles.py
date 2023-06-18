import configparser
import logging
import os
from ftplib import FTP
from azure.storage.blob import BlobServiceClient

logging.basicConfig(level=logging.INFO)
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

def download_ftp_files(ftp, remote_dir, local_dir):
    # Change to the remote directory
    logging.debug(f"Changing to remote directory: {remote_dir}")
    ftp.cwd(remote_dir)

    # List all files and folders in the current directory
    items = ftp.nlst()

    # Iterate over each item
    for item in items:
        # Get the full path of the item
        full_path = os.path.join(remote_dir, item)

        try:
            # Check if the item is a directory
            logging.debug(f"Checking if {item} is a directory")
            ftp.cwd(full_path)
            logging.debug(f"{item} is a directory, calling download_ftp_files recursively")
            download_ftp_files(ftp, full_path, local_dir)
            logging.debug(f"Changing back to parent directory")
            ftp.cwd('..') # Return to the parent directory
        except:
            # Download the file
            logging.debug(f"{item} is a file, downloading")
            local_filename = os.path.join(local_dir, item)
            with open(local_filename, 'wb') as f:
                ftp.retrbinary('RETR ' + item, f.write)
            logging.info(f"Successfully downloaded file: {item}")
            logging.info(f"Uploading file: {item}")
            upload_blob(local_filename, local_dir, item)
            logging.info(f"Deleting file: {item}")
            ftp.delete(item)
            os.remove(local_filename)
            logging.info(f"Successfully deleted file: {item}")

def upload_blob(local_filename, local_dir, item):
    logger = logging.getLogger("azure.storage")
    logger.setLevel(logging.ERROR)
    service = BlobServiceClient.from_connection_string(config['AZURESTORAGEACCOUNT']['ConnectionString'])
    container_client = service.get_container_client(config['AZURESTORAGEACCOUNT']['ContainerName'])
    blob_client = container_client.get_blob_client(item)

    logging.info(f"Uploading file to blob storage: {local_filename}")
    with open(file=local_filename, mode="rb") as data:
        blob_client.upload_blob(data)

def main():
    # Connect to the FTP server
    logging.info(f"Connecting to FTP server: {config['DEFAULT']['ServerAddress']}")
    ftp = FTP(config['DEFAULT']['ServerAddress'])
    ftp.login()

    # Download all files from the FTP server
    logging.info(f"Downloading all files from FTP server: {config['DEFAULT']['ServerAddress']}")
    download_ftp_files(ftp, config['DEFAULT']['ServerPath'], config['DEFAULT']['TempPath'])

    # Disconnect from the FTP server
    ftp.quit()

if __name__ == '__main__':
    main()