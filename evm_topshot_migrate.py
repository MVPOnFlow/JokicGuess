"""
EVM TopShot NFT Migration Script (Bridge Approach)
====================================================
Bridges NBA Top Shot moments from the EVM side of a Flow wallet back to
Cadence via the Flow EVM NFT Bridge, then deposits them into a child
(Dapper) wallet's TopShot collection via HybridCustody.

Reference Cadence transaction (the pattern we replicate):
  https://www.flowscan.io/tx/f43e9437be3750eab36a5a68cbf0c797ac74283abb2a1ebdae7f5c53a97ece22

The process for each batch:
  1. unwrapNFTsIfApplicable — if NFTs live on the wrapper contract (0x84c6a2),
     call withdrawTo() to unwrap them back to the NBAT bridge contract (0x50AB3a).
  2. coa.withdrawNFT() — bridge each NFT from EVM back to Cadence, creating
     TopShot.NFT resources and emitting TopShot.Deposit events.
  3. Deposit into the child account's TopShot collection via HybridCustody.

Usage:
  # List only (dry run)
  python evm_topshot_migrate.py --list

  # Send all moments to the Dapper wallet (batch size 2)
  python evm_topshot_migrate.py --send --batch-size 2

Requirements:
  pip install requests flow_py_sdk python-dotenv
"""

import argparse
import asyncio
import json
import math
import os
import sys
import time

import requests
from dotenv import load_dotenv

load_dotenv()

# ── Defaults ─────────────────────────────────────────────────────
# Source COA: the EVM address of the Flow wallet that currently holds the moments
DEFAULT_SOURCE_COA = "0x00000000000000000000000201272B1f40561c59"

# Child (Dapper) Flow address — receives the bridged TopShot.NFT resources
DEFAULT_CHILD_ADDRESS = "0x334a20bbaa7f2801"

# BridgedTopShotMoments (TOPSHOT) — the WRAPPER contract (ERC1967Proxy)
# NFTs are listed from here; withdrawTo() unwraps back to NBAT.
WRAPPER_CONTRACT = "0x84c6a2e6765E88427c41bB38C82a78b570e24709"
TOPSHOT_EVM_CONTRACT = WRAPPER_CONTRACT

# The Cadence NFT type identifier for TopShot moments
NFT_IDENTIFIER = "A.0b2a3299cc857e29.TopShot.NFT"

# Flow wallet that OWNS the source COA (signs Cadence transactions)
FLOW_SIGNER_ADDRESS = os.getenv("FLOW_SWAP_ACCOUNT", "0xcc4b6fa5550a4610")
FLOW_SIGNER_PRIVATE_KEY = os.getenv("FLOW_SWAP_PRIVATE_KEY", "")
FLOW_SIGNER_KEY_INDEX = int(os.getenv("FLOW_SWAP_KEY_INDEX", "1"))

# Blockscout API for Flow EVM
BLOCKSCOUT_API = "https://evm.flowscan.io/api/v2"

# Flow Access Node (gRPC)
FLOW_ACCESS_HOST = "access.mainnet.nodes.onflow.org"
FLOW_ACCESS_PORT = 9000


# ═══════════════════════════════════════════════════════════════════
#  STEP 1: List all TopShot NFTs held by a COA on Flow EVM
# ═══════════════════════════════════════════════════════════════════

def list_topshot_nfts(source_coa: str, contract: str = TOPSHOT_EVM_CONTRACT) -> list[dict]:
    """
    Query Blockscout API for all ERC-721 TopShot tokens held by `source_coa`.
    Returns a list of dicts with keys: token_id, name, image_url.
    Handles pagination automatically.
    """
    all_nfts = []
    url = f"{BLOCKSCOUT_API}/addresses/{source_coa}/nft"
    params = {"type": "ERC-721"}
    page = 1

    print(f"\n\U0001f4cb  Listing TopShot NFTs on EVM for {source_coa}")
    print(f"    Contract: {contract}\n")

    while True:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])

        for item in items:
            token_addr = item.get("token", {}).get("address_hash", "").lower()
            if token_addr != contract.lower():
                continue
            token_id = item.get("id")
            name = item.get("metadata", {}).get("name", "") if item.get("metadata") else ""
            image = item.get("image_url", "")
            all_nfts.append({
                "token_id": int(token_id),
                "name": name,
                "image_url": image,
            })

        next_page = data.get("next_page_params")
        if not next_page:
            break

        params = {**next_page}
        page += 1
        print(f"    ... fetched page {page - 1}, {len(all_nfts)} TopShot moments so far")
        time.sleep(0.3)

    all_nfts.sort(key=lambda n: n["token_id"])
    print(f"\n\u2705  Found {len(all_nfts)} TopShot moment(s) on EVM side.\n")
    return all_nfts


def print_nft_table(nfts: list[dict]):
    """Pretty-print the NFT list."""
    if not nfts:
        print("    (none)")
        return
    print(f"    {'#':<6} {'Token ID':<12} {'Name'}")
    print(f"    {chr(9472)*6} {chr(9472)*12} {chr(9472)*50}")
    for i, nft in enumerate(nfts, 1):
        name = nft['name'][:50] if nft['name'] else "(no metadata)"
        print(f"    {i:<6} {nft['token_id']:<12} {name}")


# ═══════════════════════════════════════════════════════════════════
#  STEP 2: Bridge NFTs from EVM to Cadence via FlowEVMBridge
# ═══════════════════════════════════════════════════════════════════

CADENCE_BRIDGE_TX = """
import MetadataViews from 0x1d7e57aa55817448
import ViewResolver from 0x1d7e57aa55817448
import NonFungibleToken from 0x1d7e57aa55817448
import FungibleToken from 0xf233dcee88fe0abe
import FlowToken from 0x1654653399040a61
import FungibleTokenMetadataViews from 0xf233dcee88fe0abe
import ScopedFTProviders from 0x1e4aa0b87d10b141
import EVM from 0xe467b9dd11fa00df
import FlowEVMBridgeUtils from 0x1e4aa0b87d10b141
import FlowEVMBridge from 0x1e4aa0b87d10b141
import FlowEVMBridgeConfig from 0x1e4aa0b87d10b141
import HybridCustody from 0xd8a7e05a7ac670c0
import CapabilityFilter from 0xd8a7e05a7ac670c0
import CrossVMMetadataViews from 0x1d7e57aa55817448

transaction(nftIdentifier: String, child: Address, ids: [UInt256]) {

    prepare(signer: auth(BorrowValue, CopyValue, IssueStorageCapabilityController, PublishCapability, SaveValue, UnpublishCapability) &Account) {
        /* --- Borrow the signer's CadenceOwnedAccount --- */
        let coa = signer.storage.borrow<auth(EVM.Call, EVM.Bridge) &EVM.CadenceOwnedAccount>(from: /storage/evm)
            ?? panic("Could not borrow COA from /storage/evm")

        /* --- Resolve NFT type info --- */
        let nftType = CompositeType(nftIdentifier)
            ?? panic("Could not construct NFT type from identifier: ".concat(nftIdentifier))
        let nftContractAddress = FlowEVMBridgeUtils.getContractAddress(fromType: nftType)
            ?? panic("Could not get contract address from identifier: ".concat(nftIdentifier))
        let nftContractName = FlowEVMBridgeUtils.getContractName(fromType: nftType)
            ?? panic("Could not get contract name from identifier: ".concat(nftIdentifier))

        /* --- Borrow child account via HybridCustody --- */
        let m = signer.storage.borrow<auth(HybridCustody.Manage) &HybridCustody.Manager>(from: HybridCustody.ManagerStoragePath)
            ?? panic("manager does not exist")
        let childAcct = m.borrowAccount(addr: child) ?? panic("child account not found")

        /* --- Get collection reference from child --- */
        let viewResolver = getAccount(nftContractAddress).contracts.borrow<&{ViewResolver}>(name: nftContractName)
            ?? panic("Could not borrow ViewResolver from NFT contract")
        let collectionData = viewResolver.resolveContractView(
                resourceType: nil,
                viewType: Type<MetadataViews.NFTCollectionData>()
            ) as! MetadataViews.NFTCollectionData? ?? panic("Could not resolve NFTCollectionData view")

        let capType = Type<&{NonFungibleToken.CollectionPublic}>()
        let controllerID = childAcct.getControllerIDForType(type: capType, forPath: collectionData.storagePath)
            ?? panic("no controller found for capType")
        let cap = childAcct.getCapability(controllerID: controllerID, type: capType) ?? panic("no cap found")
        let publicCap = cap as! Capability<&{NonFungibleToken.CollectionPublic}>
        assert(publicCap.check(), message: "invalid public capability")
        let collectionRef = publicCap.borrow()!

        /* --- Calculate bridge fee --- */
        let approxFee = FlowEVMBridgeUtils.calculateBridgeFee(bytes: 400_000) + (FlowEVMBridgeConfig.baseFee * UFix64(ids.length))

        /* --- Configure a ScopedFTProvider (signer pays fees) --- */
        if signer.storage.type(at: FlowEVMBridgeConfig.providerCapabilityStoragePath) == nil {
            let providerCap = signer.capabilities.storage.issue<auth(FungibleToken.Withdraw) &{FungibleToken.Provider}>(
                /storage/flowTokenVault
            )
            signer.storage.save(providerCap, to: FlowEVMBridgeConfig.providerCapabilityStoragePath)
        }
        let providerCapCopy = signer.storage.copy<Capability<auth(FungibleToken.Withdraw) &{FungibleToken.Provider}>>(
                from: FlowEVMBridgeConfig.providerCapabilityStoragePath
            ) ?? panic("Invalid Provider Capability found in storage.")
        let providerFilter = ScopedFTProviders.AllowanceFilter(approxFee)
        let scopedProvider <- ScopedFTProviders.createScopedFTProvider(
                provider: providerCapCopy,
                filters: [ providerFilter ],
                expiration: getCurrentBlock().timestamp + 1.0
            )

        /* --- Unwrap NFTs from wrapper to NBAT if applicable --- */
        unwrapNFTsIfApplicable(coa, nftIDs: ids, nftType: nftType, viewResolver: viewResolver)

        /* --- Bridge NFTs from EVM to Cadence and deposit into child --- */
        for id in ids {
            let nft: @{NonFungibleToken.NFT} <- coa.withdrawNFT(
                type: nftType,
                id: id,
                feeProvider: &scopedProvider as auth(FungibleToken.Withdraw) &{FungibleToken.Provider}
            )

            assert(
                nft.getType() == nftType,
                message: "Bridged nft type mismatch - requested: ".concat(nftType.identifier)
                    .concat(", received: ").concat(nft.getType().identifier)
            )

            collectionRef.deposit(token: <- nft)
        }

        // Destroy the ScopedFTProvider
        destroy scopedProvider
    }
}

/// Unwraps NFTs from a project's custom ERC721 wrapper contract to bridged NFTs on EVM, if applicable.
access(all) fun unwrapNFTsIfApplicable(
    _ coa: auth(EVM.Call) &EVM.CadenceOwnedAccount,
    nftIDs: [UInt256],
    nftType: Type,
    viewResolver: &{ViewResolver}
) {
    if let crossVMPointer = viewResolver.resolveContractView(
            resourceType: nftType,
            viewType: Type<CrossVMMetadataViews.EVMPointer>()
    ) as! CrossVMMetadataViews.EVMPointer? {
        if let underlyingAddress = getUnderlyingERC721Address(coa, crossVMPointer.evmContractAddress) {
            for id in nftIDs {
                if isNFTWrapped(coa,
                    nftID: id,
                    underlying: underlyingAddress,
                    wrapper: crossVMPointer.evmContractAddress
                ) {
                    let res = mustCall(coa, crossVMPointer.evmContractAddress,
                        functionSig: "withdrawTo(address,uint256[])",
                        args: [coa.address(), [id]]
                    )
                    let decodedRes = EVM.decodeABI(types: [Type<Bool>()], data: res.data)
                    assert(decodedRes.length == 1, message: "Invalid response length")
                    assert(decodedRes[0] as! Bool, message: "Failed to unwrap NFT")
                }
            }
        }
    }
}

/// Gets the underlying ERC721 address if it exists (i.e. if the ERC721 is a wrapper)
access(all) fun getUnderlyingERC721Address(
    _ coa: auth(EVM.Call) &EVM.CadenceOwnedAccount,
    _ wrapperAddress: EVM.EVMAddress
): EVM.EVMAddress? {
    let res = coa.call(
        to: wrapperAddress,
        data: EVM.encodeABIWithSignature("underlying()", []),
        gasLimit: 100_000,
        value: EVM.Balance(attoflow: 0)
    )
    if res.status != EVM.Status.successful || res.data.length == 0 {
        return nil
    }
    let decodedResult = EVM.decodeABI(
        types: [Type<EVM.EVMAddress>()],
        data: res.data
    )
    assert(decodedResult.length == 1, message: "Invalid response length")
    return decodedResult[0] as! EVM.EVMAddress
}

/// Checks if the provided NFT is wrapped in the underlying ERC721 contract
access(all) fun isNFTWrapped(
    _ coa: auth(EVM.Call) &EVM.CadenceOwnedAccount,
    nftID: UInt256,
    underlying: EVM.EVMAddress,
    wrapper: EVM.EVMAddress
): Bool {
    let res = coa.call(
        to: underlying,
        data: EVM.encodeABIWithSignature("ownerOf(uint256)", [nftID]),
        gasLimit: 100_000,
        value: EVM.Balance(attoflow: 0)
    )
    if res.status != EVM.Status.successful || res.data.length == 0{
        return false
    }
    let decodedResult = EVM.decodeABI(
        types: [Type<EVM.EVMAddress>()],
        data: res.data
    )
    assert(decodedResult.length == 1, message: "Invalid response length")
    let owner = decodedResult[0] as! EVM.EVMAddress
    return owner.toString() == wrapper.toString()
}

/// Calls a function on an EVM contract from provided coa
access(all) fun mustCall(
    _ coa: auth(EVM.Call) &EVM.CadenceOwnedAccount,
    _ contractAddr: EVM.EVMAddress,
    functionSig: String,
    args: [AnyStruct]
): EVM.Result {
    let res = coa.call(
        to: contractAddr,
        data: EVM.encodeABIWithSignature(functionSig, args),
        gasLimit: 4_000_000,
        value: EVM.Balance(attoflow: 0)
    )
    assert(res.status == EVM.Status.successful,
        message: "Failed to call '".concat(functionSig)
            .concat("\\n\\t error code: ").concat(res.errorCode.toString())
            .concat("\\n\\t error message: ").concat(res.errorMessage)
            .concat("\\n\\t gas used: ").concat(res.gasUsed.toString())
            .concat("\\n\\t caller address: 0x").concat(coa.address().toString())
            .concat("\\n\\t contract address: 0x").concat(contractAddr.toString())
    )
    return res
}
"""


async def send_batch(token_ids: list[int], child_address: str) -> str:
    """
    Sign and send a Cadence transaction that:
      1. Unwraps NFTs from wrapper (0x84c6a2) to NBAT (0x50AB3a) if needed
      2. Bridges each NFT from EVM to Cadence via coa.withdrawNFT()
      3. Deposits the TopShot.NFT resources into the child account's collection

    Returns the sealed Flow transaction ID.
    """
    from flow_py_sdk import (
        flow_client, Tx, ProposalKey, InMemorySigner, SignAlgo,
    )
    from flow_py_sdk.signer import HashAlgo
    from flow_py_sdk.cadence import Address, String, Array, UInt256

    if not FLOW_SIGNER_PRIVATE_KEY:
        raise RuntimeError(
            "FLOW_SWAP_PRIVATE_KEY env var is not set. "
            "Cannot sign transactions without the private key."
        )

    signer_addr = Address.from_hex(FLOW_SIGNER_ADDRESS.removeprefix("0x"))
    child_addr_value = Address.from_hex(child_address.removeprefix("0x"))

    signer = InMemorySigner(
        hash_algo=HashAlgo.SHA3_256,
        sign_algo=SignAlgo.ECDSA_P256,
        private_key_hex=FLOW_SIGNER_PRIVATE_KEY,
    )

    # Build arguments: nftIdentifier (String), child (Address), ids ([UInt256])
    arg_identifier = String(NFT_IDENTIFIER)
    arg_child = child_addr_value
    arg_ids = Array([UInt256(tid) for tid in token_ids])

    async with flow_client(
        host=FLOW_ACCESS_HOST,
        port=FLOW_ACCESS_PORT,
    ) as client:
        block = await client.get_latest_block()
        account = await client.get_account(address=signer_addr.bytes)
        seq_number = account.keys[FLOW_SIGNER_KEY_INDEX].sequence_number

        tx = (
            Tx(
                code=CADENCE_BRIDGE_TX,
                reference_block_id=block.id,
                payer=signer_addr,
                proposal_key=ProposalKey(
                    key_address=signer_addr,
                    key_id=FLOW_SIGNER_KEY_INDEX,
                    key_sequence_number=seq_number,
                ),
            )
            .add_arguments(arg_identifier, arg_child, arg_ids)
            .add_authorizers(signer_addr)
            .with_gas_limit(9999)
            .with_envelope_signature(
                signer_addr, FLOW_SIGNER_KEY_INDEX, signer
            )
        )

        response = await client.send_transaction(transaction=tx.to_signed_grpc())
        tx_id = response.id.hex()
        print(f"    \U0001f4e4 TX submitted: {tx_id}")

        # Wait for seal (up to ~120s — bridge TXs can be slower)
        for attempt in range(120):
            result = await client.get_transaction_result(id=response.id)
            status_val = (
                result.status.value
                if hasattr(result.status, "value")
                else int(result.status)
            )
            if status_val >= 4:  # SEALED
                if result.error_message:
                    raise RuntimeError(f"TX failed: {result.error_message}")
                print(f"    \u2705 TX sealed: {tx_id}")
                return tx_id
            await asyncio.sleep(1)

        print(f"    \u23f3 TX not yet sealed after 120s: {tx_id}")
        return tx_id


def run_send(nfts: list[dict], child_address: str, batch_size: int):
    """
    Bridge all listed NFTs from EVM to Cadence and deposit into the child
    (Dapper) account's TopShot collection.
    """
    total = len(nfts)
    if total == 0:
        print("No NFTs to transfer.")
        return

    num_batches = math.ceil(total / batch_size)
    print(f"\n  Bridging {total} NFT(s) in {num_batches} batch(es) "
          f"(batch size: {batch_size})")
    print(f"    Child (Dapper) address: {child_address}")
    print(f"    NFT type: {NFT_IDENTIFIER}")
    print(f"    Method: unwrap \u2192 coa.withdrawNFT() \u2192 TopShot.Deposit\n")

    for batch_idx in range(num_batches):
        start = batch_idx * batch_size
        end = min(start + batch_size, total)
        batch = nfts[start:end]
        token_ids = [n["token_id"] for n in batch]

        print(f"  \u2500\u2500 Batch {batch_idx + 1}/{num_batches}: "
              f"tokens {start + 1}\u2013{end} ({len(token_ids)} moments) \u2500\u2500")

        try:
            tx_id = asyncio.run(send_batch(token_ids, child_address))
            print(f"    \U0001f517 https://www.flowscan.io/tx/{tx_id}\n")
        except Exception as exc:
            print(f"    \u274c Batch {batch_idx + 1} failed: {exc}")
            print("    Stopping. Re-run to continue from where you left off.\n")
            sys.exit(1)

        # Brief pause between batches to avoid sequence number races
        if batch_idx < num_batches - 1:
            time.sleep(2)

    print("\U0001f389  All transfers complete!")


# ═══════════════════════════════════════════════════════════════════
#  STEP 0 (optional): Resolve COA address from a Flow wallet
# ═══════════════════════════════════════════════════════════════════

def resolve_coa_address(flow_address: str) -> str:
    """
    Query the Flow blockchain to find the COA (EVM) address stored in a
    Flow account's /storage/evm.
    """
    import base64

    cadence_script = """
import EVM from 0xe467b9dd11fa00df

access(all) fun main(addr: Address): String {
    let account = getAuthAccount<auth(Storage) &Account>(addr)
    let coa = account.storage.borrow<&EVM.CadenceOwnedAccount>(from: /storage/evm)
    if coa == nil { return "" }
    let evmAddr = coa!.address()
    let bytes = evmAddr.bytes
    let hexChars = "0123456789abcdef"
    var result = "0x"
    for byte in bytes {
        let hi = byte / 16
        let lo = byte % 16
        result = result.concat(hexChars.slice(from: Int(hi), upTo: Int(hi) + 1))
        result = result.concat(hexChars.slice(from: Int(lo), upTo: Int(lo) + 1))
    }
    return result
}
"""
    addr_no_prefix = flow_address.removeprefix("0x")
    arg_json = json.dumps({"type": "Address", "value": f"0x{addr_no_prefix}"})
    arg_b64 = base64.b64encode(arg_json.encode()).decode()
    script_b64 = base64.b64encode(cadence_script.encode()).decode()

    resp = requests.post(
        "https://rest-mainnet.onflow.org/v1/scripts",
        json={"script": script_b64, "arguments": [arg_b64]},
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Flow script failed (HTTP {resp.status_code}): {resp.text}")

    result_b64 = resp.text.strip().strip('"')
    result_json = json.loads(base64.b64decode(result_b64).decode())
    return result_json.get("value", "")


# ═══════════════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Bridge TopShot NFTs from Flow EVM back to Cadence (Dapper wallet)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python evm_topshot_migrate.py --list
  python evm_topshot_migrate.py --send --batch-size 2
  python evm_topshot_migrate.py --resolve-coa 0x6fd2465f3a22e34c
        """,
    )
    parser.add_argument("--list", action="store_true",
                        help="List all TopShot NFTs on the EVM side (read-only)")
    parser.add_argument("--send", action="store_true",
                        help="Bridge all TopShot NFTs to the child Dapper wallet")
    parser.add_argument("--resolve-coa", metavar="FLOW_ADDR",
                        help="Resolve the COA EVM address for a given Flow wallet")
    parser.add_argument("--source-coa", default=DEFAULT_SOURCE_COA,
                        help=f"Source COA EVM address (default: {DEFAULT_SOURCE_COA})")
    parser.add_argument("--child-address", default=DEFAULT_CHILD_ADDRESS,
                        help=f"Child (Dapper) Flow address (default: {DEFAULT_CHILD_ADDRESS})")
    parser.add_argument("--batch-size", type=int, default=2,
                        help="Number of moments per transaction (default: 2)")
    parser.add_argument("--save-json", metavar="FILE",
                        help="Save NFT list to a JSON file")
    parser.add_argument("--yes", "-y", action="store_true",
                        help="Skip confirmation prompt")

    args = parser.parse_args()

    if not any([args.list, args.send, args.resolve_coa]):
        parser.print_help()
        sys.exit(0)

    # -- Resolve COA --
    if args.resolve_coa:
        print(f"\n\U0001f50d  Resolving COA for Flow address {args.resolve_coa} ...")
        coa = resolve_coa_address(args.resolve_coa)
        if coa:
            print(f"    COA EVM address: {coa}\n")
        else:
            print("    \u274c No COA found for this address.\n")
        if not args.list and not args.send:
            return

    # -- List --
    nfts = []
    if args.list or args.send:
        nfts = list_topshot_nfts(args.source_coa)
        print_nft_table(nfts)

        if args.save_json:
            with open(args.save_json, "w") as f:
                json.dump(nfts, f, indent=2)
            print(f"\n  Saved to {args.save_json}")

        if args.list and not args.send:
            print("\n    Use --send to bridge them to your Dapper wallet.")
            return

    # -- Send --
    if args.send:
        if not nfts:
            print("Nothing to send.")
            return

        print(f"\n  About to bridge {len(nfts)} moment(s)")
        print(f"    From COA: {args.source_coa}")
        print(f"    To child: {args.child_address}")
        print(f"    Via: EVM Bridge (unwrap + withdrawNFT + TopShot.Deposit)")
        if not args.yes:
            confirm = input("\n    Type 'yes' to proceed: ").strip().lower()
            if confirm != "yes":
                print("    Aborted.")
                return

        run_send(nfts, args.child_address, args.batch_size)


if __name__ == "__main__":
    main()
