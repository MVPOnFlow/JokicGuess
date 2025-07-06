import requests
from json import JSONDecodeError

starting_height = 118542742
current_height = 118725625
block_height = 118542742
offset = 100
import time
import random


def get_with_retries(url, max_retries=5, backoff_factor=1.5, **kwargs):
    attempt = 0
    wait_time = 1

    while attempt < max_retries:
        try:
            response = requests.get(url, **kwargs)
            if response.status_code == 200:
                return response

            if response.status_code == 429:
                # print(f"{url} - 429 Too Many Requests. Attempt {attempt+1}/{max_retries}")
                retry_after = response.headers.get('Retry-After')
                if retry_after:
                    wait_time = float(retry_after)
                else:
                    wait_time *= backoff_factor
            elif response.status_code >= 500:
                print(f"Server error {response.status_code}. Retrying...")
                wait_time *= backoff_factor
            else:
                # Other errors: no retry
                response.raise_for_status()

        except requests.exceptions.RequestException as e:
            print(f"Request error: {e}. Retrying...")
            wait_time *= backoff_factor

        time.sleep(wait_time + random.uniform(0, 0.5))  # Add jitter
        attempt += 1

    raise Exception(f"Failed to get {url} after {max_retries} retries")


base_url = "https://practical-polished-panorama.flow-mainnet.quiknode.pro/26196055c630f96e591331247b47a58adf993293/addon/906/simple/v1"

all_gifts = set()


def get_block_gifts(block_height, offset):
    gifts = []
    gift_txns = []

    response = get_with_retries(f"{base_url}/blocks?height={block_height}")
    blocks = response.json()
    if blocks['blocks'][0]['height'] != block_height:
        print('Waiting for more blocks')
        time.sleep(10)
        return []

    response = get_with_retries(
        f"{base_url}/events?from_height={block_height}&to_height={block_height + offset}&name=A.0b2a3299cc857e29.TopShot.Deposit"
    )
    eventsjson = response.json()

    for event in eventsjson['events']:
        if event['fields']['to'] == '0xf853bd09d46e7db6':
            gift_txns.append(event['transaction_hash'])

    print(block_height, gift_txns)
    for txn in gift_txns:
        response = get_with_retries(f"{base_url}/transaction?id={txn}")
        tt = False
        try:
            txn_content = response.json()
            if txn_content['transactions'][0]['events'][0]['name'] == 'A.0b2a3299cc857e29.TopShot.Withdraw' and \
                    txn_content['transactions'][0]['events'][3]['name'] == 'A.0b2a3299cc857e29.TopShot.Deposit' and \
                    txn_content['transactions'][0]['events'][3]['fields']['to'] == '0xf853bd09d46e7db6' and \
                    txn_content['transactions'][0]['status'] == 'SEALED':
                tt = True
        except (KeyError, JSONDecodeError):
            pass
        if tt:
            sender = txn_content['transactions'][0]['events'][0]['fields']['from']
            gift = txn_content['transactions'][0]['events'][0]['fields']
            gift['moment_id'] = gift['id']
            del gift['id']
            gift['txn_id'] = txn_content['transactions'][0]['id']
            gifts.append(gift)

    return gifts


all_gifts = []
block_height = starting_height
while True:
    all_gifts.extend(get_block_gifts(block_height, offset))
    block_height += offset
    if block_height > starting_height + 1000:
        break
    time.sleep(0.01)
    print(block_height)