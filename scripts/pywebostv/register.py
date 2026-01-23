#!/usr/bin/env python3
import argparse

from pywebostv.connection import WebOSClient


def connect_secure(ip_address):
    store = {}

    client = WebOSClient(ip_address, secure=True)
    client.connect()

    for status in client.register(store):
        if status == WebOSClient.PROMPTED:
            print("Please accept the connect on the TV!")
        elif status == WebOSClient.REGISTERED:
            print("Registration successful!")

    print(store)  # {'client_key': 'ACCESS_TOKEN_FROM_TV'}


def main():
    parser = argparse.ArgumentParser(description="PyWebOSTV control entrypoint.")
    parser.add_argument("command", choices=["CONNECT"])
    parser.add_argument("--ip", required=True, help="IP address of the LG TV")
    args = parser.parse_args()

    if args.command == "CONNECT":
        connect_secure(args.ip)


if __name__ == "__main__":
    main()

