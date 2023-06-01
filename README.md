# MOW-FTP-Script

## Description

This script is used to automate the process of downloading files from the BlackMagic Hyperdeck. It is written in Python 3.11.3 and uses the ftplib library to connect to the FTP server. The script is designed to be run on a Windows machine, but it can be run on any machine that has Python 3.11.3 installed.

## Installation

The following modules are required but are included with the standard python library and should not need to be installed separately:

- configparser
- logging
- os
- ftplib

You should customize the config.ini file before running with the correct settings that you want to use. The settings are as follows:
ServerAddress (This is the IP address of the FTP server that you want to download from)
ServerPath (This is the path to the folder on the FTP server that you want to download from, should probably be / unless you have a specific folder you want to download from)
DestinationPath (This is the path to the folder on your local machine that you want to download to)

## Usage

To run the script simply open a command prompt in the directory where you have the script downloaded and run the following command:

```bash
python MoveFTPFiles.py
```
