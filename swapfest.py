# ==============================
# IMPORTS
# ==============================
import requests
import random
import asyncio
import json

from json import JSONDecodeError
from flow_py_sdk import flow_client
from flow_py_sdk.cadence import Address, UInt64
from utils.helpers import get_last_processed_block, save_last_processed_block, save_gift, reset_last_processed_block

# ==============================
# CONFIG
# ==============================
BASE_URL = "https://practical-polished-panorama.flow-mainnet.quiknode.pro/26196055c630f96e591331247b47a58adf993293/addon/906/simple/v1"
FLOW_ACCOUNT = "0xf853bd09d46e7db6"
STARTING_HEIGHT = 118542742
OFFSET = 100

# ==============================
# CADENCE SCRIPT
# ==============================
CADENCE_SCRIPT = """
import TopShot from 0x0b2a3299cc857e29

access(all) fun main(address: Address, momentId: UInt64): UInt32 {
    let acct = getAccount(address)

    let collectionRef = acct.capabilities
        .borrow<&TopShot.Collection>(/public/MomentCollection)
        ?? panic("Player does not have Top Shot collection")

    let momentRef = collectionRef.borrowMoment(id: momentId)
        ?? panic("Could not borrow the Moment")

    let playID = momentRef.data.playID

    let playMetadata = TopShot.getPlayMetaData(playID: playID)
        ?? panic("No play metadata for this playID")

    let firstName = playMetadata["FirstName"] ?? panic("FirstName not found")
    let lastName = playMetadata["LastName"] ?? panic("LastName not found")
`
    if firstName != "Nikola" {
        panic("FirstName does not match Nikola")
    }

    if lastName.length < 4 || lastName.slice(from: 0, upTo: 4) != "Joki" {
        panic("LastName does not start with Joki")
    }

    return momentRef.data.setID
}
"""

# ==============================
# RETRYING GET REQUEST
# ==============================
async def get_with_retries(url, max_retries=5, backoff_factor=1.5, **kwargs):
    attempt = 0
    wait_time = 1

    while attempt < max_retries:
        try:
            response = requests.get(url, **kwargs)
            if response.status_code == 200:
                return response

            if response.status_code == 429:
                retry_after = response.headers.get('Retry-After')
                if retry_after:
                    wait_time = float(retry_after)
                else:
                    wait_time *= backoff_factor
            elif response.status_code >= 500:
                print(f"Server error {response.status_code}. Retrying...")
                wait_time *= backoff_factor
            else:
                await response.raise_for_status()

        except requests.exceptions.RequestException as e:
            print(f"Request error: {e}. Retrying...")
            wait_time *= backoff_factor

        await asyncio.sleep(wait_time + random.uniform(0, 0.5))
        attempt += 1

    raise Exception(f"Failed to get {url} after {max_retries} retries")

# ==============================
# FLOW SCRIPT CALL
# ==============================
async def query_set_id(account_address: str, moment_id: int) -> int:
    async with flow_client(host="access.mainnet.nodes.onflow.org", port=9000) as client:
        result = await client.execute_script_at_latest_block(
            script=CADENCE_SCRIPT.encode("utf-8"),
            arguments=[
                json.dumps(Address.from_hex(account_address).encode()).encode("utf-8"),
                json.dumps(UInt64(moment_id).encode()).encode("utf-8")
            ]
        )
        return json.loads(result.decode("utf-8"))['value']

def get_points_for_set_id(set_id: int) -> int:
    if set_id in (63, 142, 97, 149, 54, 99, 115, 36, 166):
        return 50
    elif set_id == 153:
        return 1000
    elif set_id == 2:
        return 250
    else:
        return 1

async def get_moment_points(account_address: str, moment_id: int) -> int:
    try:
        set_id = await query_set_id(account_address, moment_id)
        points = get_points_for_set_id(int(set_id))
        return points
    except Exception as e:
        print(f"Failed to get points for moment ID {moment_id}: {e}")
        return 0

# ==============================
# FETCH FLOW EVENTS
# ==============================
async def get_block_gifts(block_height, offset):
    gifts = []
    gift_txns = []

    delay = 480 # add few min delay for block info to get populated
    response = await get_with_retries(f"{BASE_URL}/blocks?height={block_height + offset + delay}")
    blocks = response.json()
    
    if blocks['blocks'][0]['height'] != block_height + offset + delay:
        print('Waiting for more blocks')
        await asyncio.sleep(10)
        return False

    response = await get_with_retries(
        f"{BASE_URL}/events?from_height={block_height}&to_height={block_height + offset}&name=A.0b2a3299cc857e29.TopShot.Deposit"
    )
    eventsjson = response.json()

    for event in eventsjson['events']:
        if event['fields']['to'] == FLOW_ACCOUNT:
            gift_txns.append(event['transaction_hash'])

    #print(f"Block {block_height}: Found gift transactions {gift_txns}")

    for txn in gift_txns:
        response = await get_with_retries(f"{BASE_URL}/transaction?id={txn}")
        try:
            txn_content = response.json()
            if txn_content['transactions'][0]['status'] != 'SEALED':
                continue
            events = txn_content['transactions'][0]['events']
            if len(events) < 4:
                continue
            if events[0]['name'] == 'A.0b2a3299cc857e29.TopShot.Withdraw' and \
               events[3]['name'] == 'A.0b2a3299cc857e29.TopShot.Deposit' and \
               events[3]['fields']['to'] == FLOW_ACCOUNT:
                gift = events[0]['fields']
                gift['moment_id'] = gift['id']
                del gift['id']
                gift['txn_id'] = txn_content['transactions'][0]['id']
                gift['timestamp'] = txn_content['transactions'][0]['timestamp']
                gifts.append(gift)
        except (KeyError, JSONDecodeError):
            pass

    return gifts

# ==============================
# MAIN LOOP
# ==============================
async def main():
    all_gifts = []
    #reset_last_processed_block("118853777")
    block_height = get_last_processed_block()

    while True:
        new_gifts = await get_block_gifts(block_height, OFFSET)

        if new_gifts is False:
            continue  # Do NOT advance block_height
        for gift in new_gifts:
            moment_id = int(gift['moment_id'])
            #print(f"Checking moment ID {moment_id} for points...")
            points = await get_moment_points(FLOW_ACCOUNT, moment_id)
            if points == 0:
                points = await get_moment_points(gift['from'], moment_id)
            #print(f"Transaction {gift['txn_id']} - Awarded {points} points")
            # Here you can save to DB, file, etc.
            all_gifts.append((gift, points))
            save_gift(
                txn_id=gift['txn_id'],
                moment_id=int(gift['moment_id']),
                from_address=gift.get('from', 'unknown'),
                points=points,
                timestamp=gift.get('timestamp', '')
            )
        save_last_processed_block(block_height + OFFSET)
        block_height += OFFSET + 1
        await asyncio.sleep(0.01)
        #print(f"Next block_height: {block_height}")

        # Optional stop condition
        # if block_height > STARTING_HEIGHT + 1000:
        #     break