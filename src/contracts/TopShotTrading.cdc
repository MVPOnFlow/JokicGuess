// TopShot Trading Contract
// Handles the exchange of NBA TopShot moments for MVP tokens

import TopShot from 0x0b2a3299cc857e29
import NonFungibleToken from 0x1d7e57aa55817448
import MVPToken from "./MVPToken.cdc"
import FungibleToken from 0xf233dcee88fe0abe

pub contract TopShotTrading {

    // Events
    pub event MomentsTraded(
        trader: Address,
        momentIDs: [UInt64],
        mvpAmount: UFix64,
        timestamp: UFix64
    )

    pub event ContractInitialized()

    // Storage paths
    pub let AdminStoragePath: StoragePath
    pub let TradingCollectionStoragePath: StoragePath
    pub let TradingCollectionPublicPath: PublicPath

    // Trading rates and limits
    pub var tradingEnabled: Bool
    pub var maxMomentsPerTrade: UInt64
    pub var mvpMultiplier: UFix64 // 1.15 for 15% bonus

    // Admin resource for contract management
    pub resource Admin {
        pub fun setTradingEnabled(_ enabled: Bool) {
            TopShotTrading.tradingEnabled = enabled
        }

        pub fun setMaxMomentsPerTrade(_ max: UInt64) {
            TopShotTrading.maxMomentsPerTrade = max
        }

        pub fun setMVPMultiplier(_ multiplier: UFix64) {
            TopShotTrading.mvpMultiplier = multiplier
        }

        pub fun withdrawMVP(amount: UFix64): @MVPToken.Vault {
            let vaultRef = TopShotTrading.account.borrow<&MVPToken.Vault>(from: MVPToken.VaultStoragePath)
                ?? panic("Could not borrow reference to MVP vault")
            
            return <- vaultRef.withdraw(amount: amount)
        }
    }

    // Collection to hold traded moments
    pub resource TradingCollection: NonFungibleToken.Provider, NonFungibleToken.CollectionPublic {
        pub var ownedNFTs: @{UInt64: NonFungibleToken.NFT}

        init() {
            self.ownedNFTs <- {}
        }

        pub fun withdraw(withdrawID: UInt64): @NonFungibleToken.NFT {
            let token <- self.ownedNFTs.remove(key: withdrawID) 
                ?? panic("missing NFT")
            return <-token
        }

        pub fun deposit(token: @NonFungibleToken.NFT) {
            let token <- token as! @TopShot.NFT
            let id: UInt64 = token.id
            let oldToken <- self.ownedNFTs[id] <- token
            destroy oldToken
        }

        pub fun getIDs(): [UInt64] {
            return self.ownedNFTs.keys
        }

        pub fun borrowNFT(id: UInt64): &NonFungibleToken.NFT {
            return (&self.ownedNFTs[id] as &NonFungibleToken.NFT?)!
        }

        destroy() {
            destroy self.ownedNFTs
        }
    }

    // Main trading function
    pub fun tradeMomentsForMVP(
        traderCollection: &TopShot.Collection,
        momentIDs: [UInt64],
        mvpReceiver: &{FungibleToken.Receiver}
    ) {
        pre {
            TopShotTrading.tradingEnabled: "Trading is currently disabled"
            momentIDs.length > 0: "Must trade at least one moment"
            momentIDs.length <= Int(TopShotTrading.maxMomentsPerTrade): "Too many moments in single trade"
        }

        var totalValue: UFix64 = 0.0
        let contractCollection = TopShotTrading.account.borrow<&TradingCollection>(
            from: TopShotTrading.TradingCollectionStoragePath
        ) ?? panic("Could not borrow trading collection")

        // Validate and calculate total value of moments
        for momentID in momentIDs {
            let momentRef = traderCollection.borrowMoment(id: momentID)
            
            // Verify it's a Jokic moment
            let metadata = momentRef.data.metadata
            assert(
                metadata["PlayerFirstName"] == "Nikola" && metadata["PlayerLastName"] == "Jokic",
                message: "Only Jokic moments can be traded"
            )

            // Calculate moment value based on rarity and other factors
            let momentValue = self.calculateMomentValue(metadata)
            totalValue = totalValue + momentValue

            // Transfer moment to contract
            let moment <- traderCollection.withdraw(withdrawID: momentID)
            contractCollection.deposit(token: <-moment)
        }

        // Calculate MVP reward with multiplier
        let mvpReward = totalValue * TopShotTrading.mvpMultiplier

        // Mint MVP tokens to trader
        let minterRef = TopShotTrading.account.borrow<&MVPToken.Minter>(
            from: MVPToken.MinterStoragePath
        ) ?? panic("Could not borrow MVP minter")

        let mvpVault <- minterRef.mintTokens(amount: mvpReward)
        mvpReceiver.deposit(from: <-mvpVault)

        // Emit trading event
        emit MomentsTraded(
            trader: mvpReceiver.owner!.address,
            momentIDs: momentIDs,
            mvpAmount: mvpReward,
            timestamp: getCurrentBlock().timestamp
        )
    }

    // Calculate the MVP value of a moment based on its metadata
    access(self) fun calculateMomentValue(_ metadata: {String: String}): UFix64 {
        let serialNumber = UInt64.fromString(metadata["SerialNumber"] ?? "1") ?? 1
        let totalCirculation = UInt64.fromString(metadata["TotalCirculation"] ?? "1000") ?? 1000
        
        var baseValue: UFix64 = 10.0 // Base MVP value
        
        // Rarity multiplier based on circulation
        if totalCirculation <= 100 {
            baseValue = baseValue * 5.0
        } else if totalCirculation <= 500 {
            baseValue = baseValue * 3.0
        } else if totalCirculation <= 1000 {
            baseValue = baseValue * 2.0
        }
        
        // Serial number bonus
        if serialNumber <= 10 {
            baseValue = baseValue * 2.0
        } else if serialNumber <= 100 {
            baseValue = baseValue * 1.5
        }
        
        // Play category bonus
        let playCategory = metadata["PlayCategory"] ?? ""
        if playCategory == "Legendary" {
            baseValue = baseValue * 3.0
        } else if playCategory == "Rare" {
            baseValue = baseValue * 2.0
        }
        
        return baseValue
    }

    // Get estimated value for a moment (public function)
    pub fun getEstimatedMomentValue(metadata: {String: String}): UFix64 {
        return self.calculateMomentValue(metadata)
    }

    // Create empty trading collection
    pub fun createEmptyTradingCollection(): @TradingCollection {
        return <- create TradingCollection()
    }

    init() {
        // Initialize contract state
        self.tradingEnabled = true
        self.maxMomentsPerTrade = 50
        self.mvpMultiplier = 1.15

        // Set storage paths
        self.AdminStoragePath = /storage/topShotTradingAdmin
        self.TradingCollectionStoragePath = /storage/topShotTradingCollection
        self.TradingCollectionPublicPath = /public/topShotTradingCollection

        // Create and store admin resource
        let admin <- create Admin()
        self.account.save(<-admin, to: self.AdminStoragePath)

        // Create and store trading collection
        let tradingCollection <- create TradingCollection()
        self.account.save(<-tradingCollection, to: self.TradingCollectionStoragePath)

        // Create public capability for trading collection
        self.account.link<&TradingCollection{NonFungibleToken.CollectionPublic}>(
            self.TradingCollectionPublicPath,
            target: self.TradingCollectionStoragePath
        )

        emit ContractInitialized()
    }
}