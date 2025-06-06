// MVP Token Contract for Flow Blockchain
// This contract manages the MVP token used for rewards

import FungibleToken from 0xf233dcee88fe0abe
import MetadataViews from 0x1d7e57aa55817448

pub contract MVPToken: FungibleToken {

    // Total supply of MVP tokens in existence
    pub var totalSupply: UFix64

    // Event that is emitted when the contract is created
    pub event TokensInitialized(initialSupply: UFix64)

    // Event that is emitted when tokens are withdrawn from a Vault
    pub event TokensWithdrawn(amount: UFix64, from: Address?)

    // Event that is emitted when tokens are deposited to a Vault
    pub event TokensDeposited(amount: UFix64, to: Address?)

    // Event that is emitted when new tokens are minted
    pub event TokensMinted(amount: UFix64)

    // Event that is emitted when tokens are destroyed
    pub event TokensBurned(amount: UFix64)

    // Vault
    //
    // Each user stores an instance of only the Vault in their storage
    // The functions in the Vault and governed by the pre and post conditions
    // in FungibleToken when they are called.
    // The checks happen at runtime whenever a function is called.
    //
    // Resources can only be created in the context of the contract that they
    // are defined in, so there is no way for a malicious user to create Vaults
    // out of thin air. A special Minter resource needs to be defined to mint
    // new tokens.
    //
    pub resource Vault: FungibleToken.Provider, FungibleToken.Receiver, FungibleToken.Balance, MetadataViews.Resolver {

        // holds the balance of a users tokens
        pub var balance: UFix64

        // initialize the balance at resource creation time
        init(balance: UFix64) {
            self.balance = balance
        }

        // withdraw
        //
        // Function that takes an integer amount as an argument
        // and withdraws that amount from the Vault.
        // It creates a new temporary Vault that is used to hold
        // the money that is being transferred. It returns the newly
        // created Vault to the context that called so it can be deposited
        // elsewhere.
        //
        pub fun withdraw(amount: UFix64): @FungibleToken.Vault {
            self.balance = self.balance - amount
            emit TokensWithdrawn(amount: amount, from: self.owner?.address)
            return <-create Vault(balance: amount)
        }

        // deposit
        //
        // Function that takes a Vault object as an argument and adds
        // its balance to the balance of the owners Vault.
        // It is allowed to destroy the sent Vault because the Vault
        // was a temporary holder of the tokens. The Vault's balance has
        // been consumed and therefore can be destroyed.
        pub fun deposit(from: @FungibleToken.Vault) {
            let vault <- from as! @MVPToken.Vault
            self.balance = self.balance + vault.balance
            emit TokensDeposited(amount: vault.balance, to: self.owner?.address)
            vault.balance = 0.0
            destroy vault
        }

        destroy() {
            if self.balance > 0.0 {
                MVPToken.totalSupply = MVPToken.totalSupply - self.balance
            }
        }

        pub fun getViews(): [Type] {
            return [Type<MetadataViews.FTView>(),
                    Type<MetadataViews.FTDisplay>()]
        }

        pub fun resolveView(_ view: Type): AnyStruct? {
            switch view {
                case Type<MetadataViews.FTView>():
                    return MetadataViews.FTView(
                        ftDisplay: self.resolveView(Type<MetadataViews.FTDisplay>()) as! MetadataViews.FTDisplay?,
                        ftVaultData: self.resolveView(Type<MetadataViews.FTVaultData>()) as! MetadataViews.FTVaultData?
                    )
                case Type<MetadataViews.FTDisplay>():
                    let media = MetadataViews.Media(
                        file: MetadataViews.HTTPFile(
                            url: "https://assets.website-files.com/5f6294c0c7a8cdd643b1c820/5f6294c0c7a8cda55cb1c936_Flow_Wordmark.svg"
                        ),
                        mediaType: "image/svg+xml"
                    )
                    let medias = MetadataViews.Medias([media])
                    return MetadataViews.FTDisplay(
                        name: "MVP Token",
                        symbol: "MVP",
                        description: "The MVP token for horse petting rewards and TopShot trading",
                        externalURL: MetadataViews.ExternalURL("https://your-dapp-url.com"),
                        logos: medias,
                        socials: {}
                    )
                case Type<MetadataViews.FTVaultData>():
                    return MetadataViews.FTVaultData(
                        storagePath: MVPToken.VaultStoragePath,
                        receiverPath: MVPToken.ReceiverPublicPath,
                        metadataPath: MVPToken.VaultPublicPath,
                        providerPath: /private/mvpVault,
                        receiverLinkedType: Type<&MVPToken.Vault{FungibleToken.Receiver}>(),
                        metadataLinkedType: Type<&MVPToken.Vault{FungibleToken.Balance, MetadataViews.Resolver}>(),
                        providerLinkedType: Type<&MVPToken.Vault{FungibleToken.Provider}>(),
                        createEmptyVaultFunction: (fun (): @FungibleToken.Vault {
                            return <-MVPToken.createEmptyVault()
                        })
                    )
            }
            return nil
        }
    }

    // createEmptyVault
    //
    // Function that creates a new Vault with a balance of zero
    // and returns it to the calling context. A user must call this function
    // and store the returned Vault in their storage in order to allow their
    // account to be able to receive deposits of this token type.
    //
    pub fun createEmptyVault(): @FungibleToken.Vault {
        return <-create Vault(balance: 0.0)
    }

    // Minter
    //
    // Resource object that token admin accounts can hold to mint new tokens.
    //
    pub resource Minter {

        // mintTokens
        //
        // Function that mints new tokens, adds them to the total supply,
        // and returns them to the calling context.
        //
        pub fun mintTokens(amount: UFix64): @MVPToken.Vault {
            pre {
                amount > 0.0: "Amount minted must be greater than zero"
            }
            MVPToken.totalSupply = MVPToken.totalSupply + amount
            emit TokensMinted(amount: amount)
            return <-create Vault(balance: amount)
        }
    }

    // Burner
    //
    // Resource object that token admin accounts can hold to burn tokens.
    //
    pub resource Burner {

        // burnTokens
        //
        // Function that destroys a Vault instance, effectively burning the tokens.
        //
        // Note: the burned tokens are automatically subtracted from the 
        // total supply in the Vault destructor.
        //
        pub fun burnTokens(from: @FungibleToken.Vault) {
            let vault <- from as! @MVPToken.Vault
            let amount = vault.balance
            destroy vault
            emit TokensBurned(amount: amount)
        }
    }

    pub let VaultStoragePath: StoragePath
    pub let VaultPublicPath: PublicPath
    pub let ReceiverPublicPath: PublicPath
    pub let MinterStoragePath: StoragePath
    pub let BurnerStoragePath: StoragePath

    init() {
        // Initialize the total supply
        self.totalSupply = 1000000.0

        // Set the named paths
        self.VaultStoragePath = /storage/mvpVault
        self.VaultPublicPath = /public/mvpVault
        self.ReceiverPublicPath = /public/mvpReceiver
        self.MinterStoragePath = /storage/mvpMinter
        self.BurnerStoragePath = /storage/mvpBurner

        // Create the Vault with the total supply of tokens and save it in storage
        //
        let vault <- create Vault(balance: self.totalSupply)
        self.account.save(<-vault, to: self.VaultStoragePath)

        // Create a public capability to the stored Vault that only exposes
        // the `deposit` method through the `Receiver` interface
        //
        self.account.link<&MVPToken.Vault{FungibleToken.Receiver}>(
            self.ReceiverPublicPath,
            target: self.VaultStoragePath
        )

        // Create a public capability to the stored Vault that only exposes
        // the `balance` field through the `Balance` interface
        //
        self.account.link<&MVPToken.Vault{FungibleToken.Balance}>(
            self.VaultPublicPath,
            target: self.VaultStoragePath
        )

        let minter <- create Minter()
        self.account.save(<-minter, to: self.MinterStoragePath)

        let burner <- create Burner()
        self.account.save(<-burner, to: self.BurnerStoragePath)

        // Emit an event that shows that the contract was initialized
        emit TokensInitialized(initialSupply: self.totalSupply)
    }
}