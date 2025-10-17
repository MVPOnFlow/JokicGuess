// src/flow/cadence.js
// Flow Jukebox — Testnet bindings
// Contract deployed to 0x7a017e02df4c4819

export const TX_CREATE_AND_START = `
import FlowJukeBox from 0x7a017e02df4c4819
import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7

// Mints the Jukebox NFT and immediately starts autoplay by calling playNextOrPayout.
transaction(queueIdentifier: String, queueDuration: UFix64) {
    let payerVault: auth(FungibleToken.Withdraw) &FlowToken.Vault
    let recipient: Address

    prepare(signer: auth(BorrowValue) &Account) {
        self.payerVault = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
            from: /storage/flowTokenVault
        ) ?? panic("Missing FlowToken vault at /storage/flowTokenVault")
        self.recipient = signer.address
    }

    execute {
        let newId = FlowJukeBox.createJukeboxSession(
            sessionOwner: self.recipient,
            queueIdentifier: queueIdentifier,
            queueDuration: queueDuration,
            payerVault: self.payerVault
        )
        var _ = FlowJukeBox.playNextOrPayout(nftID: newId)
        log("✅ Created and started FlowJukeBox #".concat(newId.toString()))
    }
}
`;

export const TX_ADD_ENTRY = `
import FlowJukeBox from 0x7a017e02df4c4819
import FlowToken from 0x7e60df042a9c0868
import FungibleToken from 0x9a0766d93b6608b7

transaction(nftID: UInt64, value: String, displayName: String, duration: UFix64, amount: UFix64) {
    prepare(signer: auth(BorrowValue, FungibleToken.Withdraw) &Account) {
        let vaultRef = signer.storage.borrow<
            auth(FungibleToken.Withdraw) &FlowToken.Vault
        >(from: /storage/flowTokenVault)
            ?? panic("Missing FlowToken vault")

        let payment <- vaultRef.withdraw(amount: amount)
        FlowJukeBox.depositBacking(
            nftID: nftID,
            from: signer.address,
            value: value,
            displayName: displayName,
            duration: duration,
            payment: <- payment
        )
    }

    execute {
        log("✅ Added entry ".concat(displayName))
    }
}
`;

export const SCRIPT_GET_USERS_JUKEBOXES = `
import FlowJukeBox from 0x7a017e02df4c4819

access(all) fun main(user: Address): [{String: AnyStruct}] {
    let col = getAccount(FlowJukeBox.contractAddress)
        .capabilities.borrow<&FlowJukeBox.Collection>(FlowJukeBox.CollectionPublicPath)
        ?? panic("Public collection not found")

    let ids = col.getIDs()
    var out: [{String: AnyStruct}] = []
    for id in ids {
        let nft = col.borrowJukeboxNFT(id)!
        if nft.sessionOwner == user {
            out.append({
                "id": id,
                "queueIdentifier": nft.queueIdentifier,
                "queueDuration": nft.queueDuration,
                "queueStartTime": nft.createdAt,
                "totalBacking": nft.totalBacking,
                "totalDuration": nft.totalDuration,
                "nowPlaying": nft.nowPlaying
            })
        }
    }
    return out
}
`;

export const SCRIPT_GET_JUKEBOX_INFO = `
import FlowJukeBox from 0x7a017e02df4c4819

access(all) fun main(nftID: UInt64): {String: AnyStruct} {
    let col = getAccount(FlowJukeBox.contractAddress)
        .capabilities.borrow<&FlowJukeBox.Collection>(FlowJukeBox.CollectionPublicPath)
        ?? panic("Public collection not found")

    let nft = col.borrowJukeboxNFT(nftID)
        ?? panic("NFT not found")

    var entries: [{String: AnyStruct}] = []
    for e in nft.queueEntries {
        entries.append({
            "value": e.value,
            "displayName": e.displayName,
            "duration": e.duration,
            "totalBacking": e.totalBacking,
            "latestBacking": e.latestBacking
        })
    }

    return {
        "id": nft.id,
        "queueIdentifier": nft.queueIdentifier,
        "sessionOwner": nft.sessionOwner,
        "queueDuration": nft.queueDuration,
        "queueStartTime": nft.createdAt,
        "totalBacking": nft.totalBacking,
        "totalDuration": nft.totalDuration,
        "nowPlaying": nft.nowPlaying,
        "entries": entries
    }
}
`;
