import nest_asyncio
nest_asyncio.apply()

import asyncio
import json

from flow_py_sdk import flow_client
from flow_py_sdk.cadence import Address, UInt64

#  Your Cadence script (unchanged)
cadence_script = """
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

    if firstName != "Nikola" {
        panic("FirstName does not match Nikola")
    }

    if lastName.length < 4 || lastName.slice(from: 0, upTo: 4) != "Joki" {
        panic("LastName does not start with Joki")
    }

    return momentRef.data.setID
}
"""

#  Your async query function (unchanged)
async def query_set_id(
    account_address: str,
    moment_id: int,
    host="access.mainnet.nodes.onflow.org",
    port=9000
):
    async with flow_client(host=host, port=port) as client:
        result = await client.execute_script_at_latest_block(
            script=cadence_script.encode("utf-8"),
            arguments=[
                json.dumps(Address.from_hex(account_address).encode()).encode("utf-8"),
                json.dumps(UInt64(moment_id).encode()).encode("utf-8")
            ]
        )
        return json.loads(result.decode("utf-8"))['value']

#  NEW: Helper to map set_id -> points
def get_points_for_set_id(set_id: int) -> int:
    if set_id in (63, 142, 97, 149, 54, 99, 115, 36, 166):
        return 50
    elif set_id == 153:
        return 1000
    elif set_id == 2:
        return 250
    else:
        return 1

#  NEW: Full wrapper
async def get_moment_points(account_address: str, moment_id: int) -> int:
    try:
        set_id = await query_set_id(account_address, moment_id)
        points = get_points_for_set_id(int(set_id))
        return points
    except:
        print(f"No points for moment ID {moment_id}") 
        return 0
    
async def main():
    result = await get_moment_points(
        account_address="0xf853bd09d46e7db6",
        moment_id=6069198
    )
    print(f"Points: {result}")

if __name__ == "__main__":
    asyncio.run(main())
