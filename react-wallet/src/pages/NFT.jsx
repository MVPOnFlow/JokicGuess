import React, { useState, useEffect, useCallback } from 'react';
import * as fcl from '@onflow/fcl';
import './NFT.css';

/* ================================================================
   Constants
   ================================================================ */
const CONTRACT_ADDR  = '0xaad9f8fa31ecbaf9';
const CONTRACT_NAME  = 'Swapboost30MVP';
const PATH_ID        = `${CONTRACT_NAME}_aad9f8fa31ecbaf9`;
const IPFS_GATEWAY   = 'https://ipfs.io/ipfs/';
const FLOWTY_COLLECTION_URL =
  `https://www.flowty.io/collection/${CONTRACT_ADDR}/${CONTRACT_NAME}`;

/** Convert ipfs:// URI to an HTTP gateway URL */
function ipfsToHttp(uri) {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) return IPFS_GATEWAY + uri.slice(7);
  return uri;
}

/* ================================================================
   Cadence: check if collection is enabled
   ================================================================ */
const CADENCE_HAS_COLLECTION = `
import NonFungibleToken from 0x1d7e57aa55817448

access(all) fun main(addr: Address): Bool {
  let acct = getAccount(addr)
  return acct.capabilities
    .borrow<&{NonFungibleToken.Collection}>(/public/${PATH_ID}) != nil
}
`;

/* ================================================================
   Cadence: enable (setup) collection
   ================================================================ */
const CADENCE_SETUP_COLLECTION = `
import NonFungibleToken from 0x1d7e57aa55817448
import Swapboost30MVP from ${CONTRACT_ADDR}

transaction {
  prepare(signer: auth(Storage, Capabilities) &Account) {
    if signer.storage.borrow<&{NonFungibleToken.Collection}>(
         from: /storage/${PATH_ID}) != nil {
      return
    }

    let collection <- Swapboost30MVP.createEmptyCollection(
      nftType: Type<@Swapboost30MVP.NFT>()
    )
    signer.storage.save(<-collection, to: /storage/${PATH_ID})

    signer.capabilities.publish(
      signer.capabilities.storage
        .issue<&{NonFungibleToken.Collection}>(/storage/${PATH_ID}),
      at: /public/${PATH_ID}
    )
  }
}
`;

/* ================================================================
   Cadence: list NFTs with display metadata
   ================================================================ */
const CADENCE_LIST_NFTS = `
import NonFungibleToken from 0x1d7e57aa55817448
import MetadataViews   from 0x1d7e57aa55817448
import Swapboost30MVP  from ${CONTRACT_ADDR}

access(all) fun main(addr: Address): [[String]] {
  let acct = getAccount(addr)
  let col = acct.capabilities
    .borrow<&{NonFungibleToken.Collection}>(/public/${PATH_ID})
  if col == nil { return [] }

  // NOTE: getIDs() returns empty due to a Cadence migration quirk
  // in UniversalCollection, but borrowNFT(id) works for individual IDs.
  // Iterate 1..totalSupply and probe each ID instead.
  let totalSupply = Swapboost30MVP.totalSupply
  var result: [[String]] = []

  var id: UInt64 = 1
  while id <= totalSupply {
    let nft = col!.borrowNFT(id)
    if nft != nil {
      var name  = "Swapboost30MVP #".concat(id.toString())
      var desc  = ""
      var thumb = ""

      if let display = nft!.resolveView(Type<MetadataViews.Display>()) {
        let d = display as! MetadataViews.Display
        name  = d.name
        desc  = d.description
        thumb = d.thumbnail.uri()
      }

      result.append([
        id.toString(),
        name,
        desc,
        thumb
      ])
    }
    id = id + 1
  }
  return result
}
`;

/* ================================================================
   Component
   ================================================================ */
export default function NFT() {
  const [user, setUser]                     = useState({ loggedIn: null });
  const [hasCollection, setHasCollection]   = useState(null);   // null = loading
  const [nfts, setNfts]                     = useState([]);
  const [loading, setLoading]               = useState(false);
  const [setupBusy, setSetupBusy]           = useState(false);
  const [error, setError]                   = useState(null);

  /* ── subscribe to wallet ── */
  useEffect(() => {
    fcl.currentUser().subscribe(setUser);
  }, []);

  /* ── check collection & load NFTs when wallet changes ── */
  const refresh = useCallback(async (addr) => {
    if (!addr) {
      setHasCollection(null);
      setNfts([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const enabled = await fcl.query({
        cadence: CADENCE_HAS_COLLECTION,
        args: (arg, t) => [arg(addr, t.Address)],
      });
      setHasCollection(enabled);

      if (enabled) {
        const raw = await fcl.query({
          cadence: CADENCE_LIST_NFTS,
          args: (arg, t) => [arg(addr, t.Address)],
        });
        setNfts(
          raw.map(([id, name, desc, thumb]) => ({
            id,
            name,
            description: desc,
            thumbnail: ipfsToHttp(thumb),
          }))
        );
      } else {
        setNfts([]);
      }
    } catch (err) {
      console.error('NFT refresh error:', err);
      setError('Failed to load collection data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(user.addr);
  }, [user.addr, refresh]);

  /* ── enable collection ── */
  const handleSetup = async () => {
    setSetupBusy(true);
    setError(null);
    try {
      const txId = await fcl.mutate({
        cadence: CADENCE_SETUP_COLLECTION,
        limit: 300,
      });
      await fcl.tx(txId).onceSealed();
      await refresh(user.addr);
    } catch (err) {
      console.error('Setup error:', err);
      if (err?.message?.includes('Declined')) {
        setError('Transaction declined.');
      } else {
        setError('Failed to enable collection. Please try again.');
      }
    } finally {
      setSetupBusy(false);
    }
  };

  /* ── not logged in ── */
  if (!user.loggedIn) {
    return (
      <div className="nft-container">
        <div className="nft-hero">
          <h1>🎫 Swapboost NFTs</h1>
          <p>View and manage your Swapboost30MVP collection on Flow</p>
        </div>
        <div className="nft-connect-prompt">
          <h3>Connect Your Wallet</h3>
          <p>Connect your Flow wallet to view your NFTs and enable the collection.</p>
          <button className="nft-btn nft-btn-primary" onClick={() => fcl.authenticate()}>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="nft-container">
      {/* Hero */}
      <div className="nft-hero">
        <h1>🎫 Swapboost NFTs</h1>
        <p>View and manage your Swapboost30MVP collection on Flow</p>
      </div>

      {/* Status card */}
      <div className="nft-status-card">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <span style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>Collection status</span>
            <div className="mt-1">
              {hasCollection === null ? (
                <span style={{ color: '#6B7280' }}>Checking…</span>
              ) : hasCollection ? (
                <span className="nft-collection-badge enabled">✓ Enabled</span>
              ) : (
                <span className="nft-collection-badge disabled">✗ Not enabled</span>
              )}
            </div>
          </div>
          <div className="d-flex gap-2 align-items-center">
            {hasCollection === false && (
              <button
                className="nft-btn nft-btn-primary"
                onClick={handleSetup}
                disabled={setupBusy}
              >
                {setupBusy ? 'Enabling…' : 'Enable Collection'}
              </button>
            )}
            <button
              className="nft-btn nft-btn-outline"
              onClick={() => refresh(user.addr)}
              disabled={loading}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-2" style={{ color: '#f87171', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
      </div>

      {/* NFT grid */}
      {loading ? (
        <div className="nft-spinner" />
      ) : hasCollection && nfts.length === 0 ? (
        <div className="nft-empty">
          <div className="nft-empty-icon">📦</div>
          <p>No Swapboost NFTs found in your wallet.</p>
          <a
            href={FLOWTY_COLLECTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="nft-flowty-link"
          >
            Browse collection on Flowty ↗
          </a>
        </div>
      ) : (
        <>
          <div className="nft-grid">
            {nfts.map((nft) => (
              <a
                key={nft.id}
                href={`https://www.flowty.io/asset/${CONTRACT_ADDR}/${CONTRACT_NAME}/NFT/${nft.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <div className="nft-card">
                  {nft.thumbnail ? (
                    <img
                      className="nft-card-img"
                      src={nft.thumbnail}
                      alt={nft.name}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="nft-card-img"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2.5rem',
                        background: '#141e2e',
                      }}
                    >
                      🎫
                    </div>
                  )}
                  <div className="nft-card-body">
                    <div className="nft-card-title">{nft.name}</div>
                    {nft.description && (
                      <div className="nft-card-desc">{nft.description}</div>
                    )}
                    <div className="nft-card-id">ID #{nft.id}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div className="text-center mt-3">
            <a
              href={FLOWTY_COLLECTION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="nft-flowty-link"
            >
              View full collection on Flowty ↗
            </a>
          </div>
        </>
      )}
    </div>
  );
}
