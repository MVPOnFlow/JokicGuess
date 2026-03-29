import asyncio, sys
from flow_py_sdk import flow_client

TX_ID = sys.argv[1] if len(sys.argv) > 1 else "497e0da59eec3daeb989bd8a18629987c0f030d01d58dac38b20ddb608b0d8f0"

async def check():
    async with flow_client(host="access.mainnet.nodes.onflow.org", port=9000) as c:
        r = await c.get_transaction_result(id=bytes.fromhex(TX_ID))
        print("Status:", r.status)
        print("Status code:", r.status_code)
        print("Error:", r.error_message)
        print("Events count:", len(r.events))
        for e in r.events:
            print(f"  {e.type}")

asyncio.run(check())
