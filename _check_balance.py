import asyncio
from flow_py_sdk import flow_client

async def check():
    async with flow_client(host="access.mainnet.nodes.onflow.org", port=9000) as c:
        acct = await c.get_account(address=bytes.fromhex("6fd2465f3a22e34c"))
        balance_flow = acct.balance / 1e8
        print(f"Balance: {balance_flow:.8f} FLOW")
        print(f"Raw balance (UFix64): {acct.balance}")

asyncio.run(check())
