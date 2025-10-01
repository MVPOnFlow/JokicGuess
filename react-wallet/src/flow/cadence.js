// src/flow/cadence.js
// Uses explicit address imports (no quotes) to avoid the mixed-import invariant error.

// =========================
//   SCRIPT: Get My Horses
// =========================
export const GET_MY_HORSES = `
import NonFungibleToken from 0x631e88ae7f1d7c20
import HorseNFTDevV0    from 0xc3ba56ba02913297

access(all) fun main(addr: Address): [{String: AnyStruct}] {
    let col = getAccount(addr).capabilities.borrow<&{NonFungibleToken.Collection}>(
        HorseNFTDevV0.CollectionPublicPath
    ) ?? panic("Account has no HorseNFTDevV0 collection capability")

    let ids = col.getIDs()
    let out: [{String: AnyStruct}] = []
    let now = getCurrentBlock().timestamp

    for id in ids {
        let h = col.borrowNFT(id) as! &HorseNFTDevV0.NFT
        let next = h.lastPetTime + 86400.0
        let remaining: UFix64 = now >= next ? 0.0 : next - now
        out.append({
            "id": h.id,
            "name": h.name,
            "speed": h.speed,
            "stamina": h.stamina,
            "strength": h.strength,
            "lastPetTime": h.lastPetTime,
            "cooldownRemaining": remaining
        })
    }
    return out
}
`

// =========================
//   TX: Mint With Flow
//   - Auto-setup collection if minting to self
// =========================
export const TX_MINT_WITH_FLOW = `
import HorseNFTDevV0    from 0xc3ba56ba02913297
import NonFungibleToken from 0x631e88ae7f1d7c20
import FungibleToken    from 0x9a0766d93b6608b7
import FlowToken        from 0x7e60df042a9c0868

transaction(name: String, recipient: Address) {

    let payerVault: auth(FungibleToken.Withdraw) &FlowToken.Vault

    prepare(signer: auth(BorrowValue, SaveValue, IssueStorageCapabilityController, PublishCapability) &Account) {
        self.payerVault = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
            from: /storage/flowTokenVault
        ) ?? panic("FlowToken vault not found in signer's storage")

        // If minting to self, ensure collection exists and is published
        if recipient == signer.address {
            if signer.storage.borrow<&HorseNFTDevV0.Collection>(from: HorseNFTDevV0.CollectionStoragePath) == nil {
                let col <- HorseNFTDevV0.createEmptyCollection(nftType: Type<@HorseNFTDevV0.NFT>())
                signer.storage.save(<- col, to: HorseNFTDevV0.CollectionStoragePath)

                let cap = signer.capabilities.storage.issue<&HorseNFTDevV0.Collection>(HorseNFTDevV0.CollectionStoragePath)
                signer.capabilities.publish(cap, at: HorseNFTDevV0.CollectionPublicPath)
            }
        }
    }

    execute {
        let newID = HorseNFTDevV0.mintWithFlow(
            name: name,
            payerVault: self.payerVault,
            recipient: recipient
        )
        log(newID)
    }
}
`

// =========================
//   TX: Pet Horse
//   - Charges 1.0 FLOW, enforces 24h cooldown
// =========================
export const TX_PET = `
import HorseNFTDevV0    from 0xc3ba56ba02913297
import NonFungibleToken from 0x631e88ae7f1d7c20
import FungibleToken    from 0x9a0766d93b6608b7
import FlowToken        from 0x7e60df042a9c0868

transaction(horseID: UInt64) {

    let col: auth(NonFungibleToken.Update) &HorseNFTDevV0.Collection
    let payerVault: auth(FungibleToken.Withdraw) &FlowToken.Vault

    prepare(signer: auth(BorrowValue) &Account) {
        self.col = signer.storage.borrow<auth(NonFungibleToken.Update) &HorseNFTDevV0.Collection>(
            from: HorseNFTDevV0.CollectionStoragePath
        ) ?? panic("Owner collection not found")

        self.payerVault = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(
            from: /storage/flowTokenVault
        ) ?? panic("FlowToken vault not found in signer's storage")
    }

    execute {
        let horseRef = self.col.borrowHorseForUpdate(horseID)
            ?? panic("Horse not found or wrong type")
        let outcome = HorseNFTDevV0.pet(horse: horseRef, payerVault: self.payerVault)
        log(outcome)
    }
}
`
