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

/* Horse names – mirrors config.py HORSE_NAMES */
const HORSE_NAMES = {
  1:  'Dreamcatcher',
  2:  'Sombor Star',
  3:  'Big Honey',
  4:  'Midnight Run',
  5:  'Silver Thunder',
  6:  'Balkan Spirit',
  7:  'Golden Mane',
  8:  'Storm Chaser',
  9:  'Noble Heart',
  10: 'Shadow Dancer',
  11: 'Prairie Wind',
  12: 'Thunderbolt',
  13: 'Velvet Rush',
  14: 'Starlight Express',
  15: 'Dark Horse',
  16: 'Painted Sky',
  17: 'Diamond Dust',
  18: 'Copper Coin',
  19: 'Rolling Thunder',
  20: 'Iron Will',
  21: 'Lucky Strike',
  22: 'Crimson Tide',
  23: 'Blazing Trail',
  24: 'High Noon',
  25: "Champion's Pride",
  26: 'Steel Magnolia',
  27: 'Silver Bullet',
  28: 'Northern Lights',
  29: 'Gentle Giant',
  30: 'Gold Rush',
  31: 'Whispering Wind',
  32: 'Iron Horse',
  33: 'Night Rider',
  34: 'Royal Flush',
  35: 'Spirit Runner',
  36: 'Sunset Ridge',
  37: 'Brave Heart',
  38: 'Maverick',
  39: 'Lightning Bolt',
  40: 'Victory Lap',
  41: "Joker's Wild",
  42: 'Mile High',
  43: 'Triple Double',
  44: 'Nugget',
  45: 'Wild Card',
  46: 'Rapid Fire',
  47: 'Mustang Sally',
  48: 'Blue Ribbon',
  49: 'Desert Storm',
  50: 'Trotter King',
};

/** Special serial numbers with labels */
const SPECIAL_SERIALS = {
  1:  { label: '#1 Serial',       emoji: '👑', cls: 'serial-one' },
  15: { label: 'Jersey #15',      emoji: '🏀', cls: 'serial-jersey' },
  50: { label: 'Perfect Serial',  emoji: '💎', cls: 'serial-perfect' },
};

/** Get display name for an NFT by id */
function horseName(id) {
  const num = Number(id);
  const name = HORSE_NAMES[num];
  return name ? `${name} #${num}` : `Horse #${num}`;
}

/** Convert ipfs:// URI to an HTTP gateway URL */
function ipfsToHttp(uri) {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) return IPFS_GATEWAY + uri.slice(7);
  return uri;
}

/** Shorten a 0x… address for display */
function shortAddr(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '\u2026' + addr.slice(-4);
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
      var name  = "Horse #".concat(id.toString())
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
  const [myNfts, setMyNfts]                 = useState([]);
  const [allNfts, setAllNfts]               = useState([]);
  const [loading, setLoading]               = useState(false);
  const [allLoading, setAllLoading]         = useState(false);
  const [setupBusy, setSetupBusy]           = useState(false);
  const [error, setError]                   = useState(null);
  const [viewMode, setViewMode]             = useState('mine');   // 'mine' | 'all'

  /* ── subscribe to wallet ── */
  useEffect(() => {
    fcl.currentUser().subscribe(setUser);
  }, []);

  /* ── check collection & load MY NFTs ── */
  const refreshMine = useCallback(async (addr) => {
    if (!addr) {
      setHasCollection(null);
      setMyNfts([]);
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
        setMyNfts(
          raw.map(([id, name, desc, thumb]) => ({
            id,
            name,
            description: desc,
            thumbnail: ipfsToHttp(thumb),
          }))
        );
      } else {
        setMyNfts([]);
      }
    } catch (err) {
      console.error('NFT refresh error:', err);
      setError('Failed to load horse collection data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMine(user.addr);
  }, [user.addr, refreshMine]);

  /* ── fetch ALL NFTs from backend API ── */
  const refreshAll = useCallback(async () => {
    setAllLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/nft/holders');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setAllNfts(
        (data.nfts || []).map((n) => ({
          id: String(n.id),
          name: n.name,
          thumbnail: ipfsToHttp(n.thumbnail),
          owner: n.owner,
          dapper: n.dapper,
          username: n.username || null,
        }))
      );
    } catch (err) {
      console.error('All NFTs fetch error:', err);
      setError('Failed to load all horses.');
    } finally {
      setAllLoading(false);
    }
  }, []);

  /* Auto-fetch when switching to "all" tab */
  useEffect(() => {
    if (viewMode === 'all' && allNfts.length === 0) {
      refreshAll();
    }
  }, [viewMode, allNfts.length, refreshAll]);

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
      await refreshMine(user.addr);
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
          <h1>🐎 Jokic's Horse Stable</h1>
          <p>Send a horse back to the treasury during a swap for a one-time <strong>20% $MVP boost</strong></p>
        </div>
        <div className="nft-connect-prompt">
          <h3>Connect Your Wallet</h3>
          <p>Connect your Flow wallet to view your MVP Horse NFTs and enable the collection.</p>
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
        <h1>🐎 Jokic's Horse Stable</h1>
        <p>Send a horse back to the treasury during a swap for a one-time <strong>20% $MVP boost</strong></p>
      </div>

      {/* Toggle + Status */}
      <div className="nft-status-card">
        <div className="nft-toggle-row">
          <div className="nft-toggle">
            <button
              className={`nft-toggle-btn ${viewMode === 'mine' ? 'active' : ''}`}
              onClick={() => setViewMode('mine')}
            >
              My Horses
            </button>
            <button
              className={`nft-toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => setViewMode('all')}
            >
              All Horses
            </button>
          </div>

          <div className="d-flex gap-2 align-items-center">
            {viewMode === 'mine' && hasCollection === false && (
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
              onClick={() => viewMode === 'mine' ? refreshMine(user.addr) : refreshAll()}
              disabled={viewMode === 'mine' ? loading : allLoading}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {viewMode === 'mine' && (
          <div className="mt-2">
            <span style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>Collection status </span>
            {hasCollection === null ? (
              <span style={{ color: '#6B7280' }}>Checking…</span>
            ) : hasCollection ? (
              <span className="nft-collection-badge enabled">✓ Enabled</span>
            ) : (
              <span className="nft-collection-badge disabled">✗ Not enabled</span>
            )}
          </div>
        )}

        {error && (
          <div className="mt-2" style={{ color: '#f87171', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
      </div>

      {/* NFT grid */}
      {(viewMode === 'mine' ? loading : allLoading) ? (
        <div className="nft-spinner" />
      ) : (viewMode === 'mine' ? myNfts : allNfts).length === 0 ? (
        <div className="nft-empty">
          <div className="nft-empty-icon">�</div>
          <p>
            {viewMode === 'mine'
              ? 'No horses found in your wallet.'
              : 'No holders found yet.'}
          </p>
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
          {viewMode === 'all' && (
            <div className="nft-summary">
              {allNfts.length} horses found across{' '}
              {new Set(allNfts.map((n) => n.owner)).size} stables
            </div>
          )}

          <div className="nft-grid">
            {(viewMode === 'mine' ? myNfts : allNfts).map((nft) => {
              const special = SPECIAL_SERIALS[Number(nft.id)];
              return (
              <a
                key={nft.id}
                href={`https://www.flowty.io/asset/${CONTRACT_ADDR}/${CONTRACT_NAME}/NFT/${nft.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <div className={[
                  'nft-card',
                  nft.owner === user.addr ? 'nft-card-mine' : '',
                  special ? `nft-card-special ${special.cls}` : '',
                ].filter(Boolean).join(' ')}>
                  {special && (
                    <div className="nft-special-ribbon">
                      <span>{special.emoji} {special.label}</span>
                    </div>
                  )}
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
                    <div className="nft-card-title">{horseName(nft.id)}</div>
                    <div className="nft-card-desc">One-time 20% swap boost</div>
                    <div className="nft-card-id">ID #{nft.id}</div>

                    {/* Owner info (All NFTs view) */}
                    {viewMode === 'all' && (
                      <div className="nft-card-owner">
                        {nft.owner?.toLowerCase() === 'cc4b6fa5550a4610' || nft.owner?.toLowerCase() === '0xcc4b6fa5550a4610' ? (
                          <span className="nft-owner-username" title={nft.owner}>
                            Treasury
                          </span>
                        ) : nft.username ? (
                          <span className="nft-owner-username" title={nft.owner}>
                            {nft.username}
                          </span>
                        ) : (
                          <span className="nft-owner-addr" title={nft.owner}>
                            {shortAddr(nft.owner)}
                          </span>
                        )}
                        {nft.owner === user.addr && (
                          <span className="nft-mine-badge">You</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </a>
              );
            })}
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
