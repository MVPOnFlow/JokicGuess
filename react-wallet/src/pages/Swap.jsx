import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as fcl from '@onflow/fcl';
import { Link } from 'react-router-dom';
import SwapLeaderboard from './SwapLeaderboard';
import './Swap.css';

/* ================================================================
   Constants
   ================================================================ */
// Dapper treasury wallet – receives TopShot moments from users
const TREASURY_DAPPER = '0xf853bd09d46e7db6';

const TIERS = [
  { key: 'COMMON',    label: 'Common',    emoji: '🟢', color: '#4ade80', mvpRate: 1.5  },
  { key: 'FANDOM',    label: 'Fandom',    emoji: '🔹', color: '#40e0d0', mvpRate: 1.5  },
  { key: 'RARE',      label: 'Rare',      emoji: '🔵', color: '#60a5fa', mvpRate: 75   },
  { key: 'LEGENDARY', label: 'Legendary', emoji: '🟡', color: '#fbbf24', mvpRate: 1500 },
];

const TIER_MVP = {};
TIERS.forEach(t => { TIER_MVP[t.key] = t.mvpRate; });

// Buy prices (getting moments from treasury costs more)
const TIER_MVP_BUY = { COMMON: 2, FANDOM: 2, RARE: 100, LEGENDARY: 2000 };

/* ================================================================
   Cadence: discover child Dapper account
   ================================================================ */
const CADENCE_GET_CHILD = `
import HybridCustody from 0xd8a7e05a7ac670c0
import TopShot from 0x0b2a3299cc857e29

access(all) fun main(parent: Address): [Address] {
  let acct = getAuthAccount<auth(Storage) &Account>(parent)
  let manager = acct.storage
    .borrow<auth(HybridCustody.Manage) &HybridCustody.Manager>(
      from: HybridCustody.ManagerStoragePath
    )
  if manager == nil { return [] }

  let children = manager!.getChildAddresses()
  for child in children {
    let account = getAccount(child)
    let ref = account.capabilities
      .borrow<&TopShot.Collection>(/public/MomentCollection)
    if ref != nil { return [child] }
  }
  return []
}
`;

/* ================================================================
   Cadence: get total moment count (cheap — no per-moment reads)
   ================================================================ */
const CADENCE_MOMENT_COUNT = `
import TopShot from 0x0b2a3299cc857e29

access(all) fun main(account: Address): Int {
  let acct = getAccount(account)
  let ref = acct.capabilities
    .borrow<&TopShot.Collection>(/public/MomentCollection)!
  return ref.getIDs().length
}
`;

/* ================================================================
   Cadence: list TopShot moments with on-chain metadata — PAGINATED.
   Takes offset + limit so large collections don't hit Flow's 20 MB
   storage-interaction cap (getMomentsSubedition loads a huge slab).
   Returns [[id, playID, setName, serialNumber, isLocked, subedition]].
   ================================================================ */
const CADENCE_LIST_MOMENTS_PAGE = `
import TopShot from 0x0b2a3299cc857e29
import TopShotLocking from 0x0b2a3299cc857e29

access(all) fun main(account: Address, offset: Int, limit: Int): [[String]] {
  let acct = getAccount(account)
  let ref = acct.capabilities
    .borrow<&TopShot.Collection>(/public/MomentCollection)!
  let ids = ref.getIDs()
  let end = offset + limit > ids.length ? ids.length : offset + limit
  var setNames: {UInt32: String} = {}
  var result: [[String]] = []
  var i = offset
  while i < end {
    let id = ids[i]
    let nft = ref.borrowMoment(id: id)!
    let sid = nft.data.setID
    if setNames[sid] == nil {
      setNames[sid] = TopShot.getSetName(setID: sid) ?? ""
    }
    let locked = TopShotLocking.isLocked(nftRef: nft)
    let subedition = TopShot.getMomentsSubedition(nftID: id) ?? 0
    result.append([
      id.toString(),
      nft.data.playID.toString(),
      setNames[sid]!,
      nft.data.serialNumber.toString(),
      locked ? "1" : "0",
      subedition.toString()
    ])
    i = i + 1
  }
  return result
}
`;

/** Page size for moment listing — 500 stays well within Flow's 20 MB limit. */
const MOMENTS_PAGE_SIZE = 500;

/* ================================================================
   Horse NFT (boost) constants
   ================================================================ */
const HORSE_NFT_CONTRACT_ADDR = '0xaad9f8fa31ecbaf9';
const HORSE_NFT_PATH_ID = 'Swapboost30MVP_aad9f8fa31ecbaf9';
const HORSE_NAMES = {
  1:'Dreamcatcher',2:'Sombor Star',3:'Big Honey',4:'Midnight Run',5:'Silver Thunder',
  6:'Balkan Spirit',7:'Golden Mane',8:'Storm Chaser',9:'Noble Heart',10:'Shadow Dancer',
  11:'Prairie Wind',12:'Thunderbolt',13:'Velvet Rush',14:'Starlight Express',15:'Dark Horse',
  16:'Painted Sky',17:'Diamond Dust',18:'Copper Coin',19:'Rolling Thunder',20:'Iron Will',
  21:'Lucky Strike',22:'Crimson Tide',23:'Blazing Trail',24:'High Noon',25:"Champion's Pride",
  26:'Steel Magnolia',27:'Silver Bullet',28:'Northern Lights',29:'Gentle Giant',30:'Gold Rush',
  31:'Whispering Wind',32:'Iron Horse',33:'Night Rider',34:'Royal Flush',35:'Spirit Runner',
  36:'Sunset Ridge',37:'Brave Heart',38:'Maverick',39:'Lightning Bolt',40:'Victory Lap',
  41:"Joker's Wild",42:'Mile High',43:'Triple Double',44:'Nugget',45:'Wild Card',
  46:'Rapid Fire',47:'Mustang Sally',48:'Blue Ribbon',49:'Desert Storm',50:'Trotter King',
};
function horseName(id) {
  const n = Number(id);
  return HORSE_NAMES[n] ? `${HORSE_NAMES[n]} #${n}` : `Horse #${n}`;
}

/* ================================================================
   Cadence: list user's horse NFTs (Swapboost30MVP on parent wallet)
   ================================================================ */
const CADENCE_LIST_HORSES = `
import NonFungibleToken from 0x1d7e57aa55817448
import Swapboost30MVP  from ${HORSE_NFT_CONTRACT_ADDR}

access(all) fun main(addr: Address): [UInt64] {
  let acct = getAccount(addr)
  let col = acct.capabilities
    .borrow<&{NonFungibleToken.Collection}>(/public/${HORSE_NFT_PATH_ID})
  if col == nil { return [] }
  let totalSupply = Swapboost30MVP.totalSupply
  var ids: [UInt64] = []
  var id: UInt64 = 1
  while id <= totalSupply {
    let nft = col!.borrowNFT(id)
    if nft != nil { ids.append(id) }
    id = id + 1
  }
  return ids
}
`;

/* ================================================================
   Cadence: transfer TopShot moments from child (Dapper) → recipient
   The signer is the Flow parent wallet; it accesses the child via
   HybridCustody's borrowable capability.
   ================================================================ */
function buildTransferMomentsCadence(childAddr) {
  return `
import HybridCustody from 0xd8a7e05a7ac670c0
import NonFungibleToken from 0x1d7e57aa55817448
import TopShot from 0x0b2a3299cc857e29

transaction(momentIds: [UInt64], recipient: Address) {

  let provider: auth(NonFungibleToken.Withdraw)
               &{NonFungibleToken.Provider, NonFungibleToken.CollectionPublic}

  prepare(signer: auth(Storage, Capabilities) &Account) {
    // 1. Borrow HybridCustody manager
    let mgr = signer.storage.borrow<auth(HybridCustody.Manage) &HybridCustody.Manager>(
      from: HybridCustody.ManagerStoragePath
    ) ?? panic("No HybridCustody manager")

    // 2. Borrow the child account
    let childAcct = mgr.borrowAccount(addr: ${childAddr})
      ?? panic("Child account not found")

    // 3. Get provider capability from child (interface-based type)
    let capType = Type<
      auth(NonFungibleToken.Withdraw)
      &{NonFungibleToken.Provider, NonFungibleToken.CollectionPublic}>()

    let controllerID = childAcct.getControllerIDForType(
      type: capType,
      forPath: /storage/MomentCollection
    ) ?? panic("Controller ID not found for TopShot collection on child")

    let cap = childAcct.getCapability(
      controllerID: controllerID,
      type: capType
    ) as! Capability<
      auth(NonFungibleToken.Withdraw)
      &{NonFungibleToken.Provider, NonFungibleToken.CollectionPublic}>

    assert(cap.check(), message: "Invalid provider capability")
    self.provider = cap.borrow()!
  }

  execute {
    // 4. Get the recipient's TopShot collection
    let recipientAcct = getAccount(recipient)
    let receiver = recipientAcct.capabilities
      .borrow<&{NonFungibleToken.Receiver}>(/public/MomentCollection)
      ?? panic("Recipient has no TopShot collection")

    // 5. Transfer each moment
    for id in momentIds {
      let nft <- self.provider.withdraw(withdrawID: id)
      receiver.deposit(token: <-nft)
    }
  }
}
`;
}

/* ================================================================
   Cadence: transfer moments + horse boost NFT in ONE transaction
   Moments go to Dapper treasury, horse NFT goes to Flow treasury.
   ================================================================ */
function buildTransferWithBoostCadence(childAddr) {
  return `
import HybridCustody from 0xd8a7e05a7ac670c0
import NonFungibleToken from 0x1d7e57aa55817448
import TopShot from 0x0b2a3299cc857e29
import Swapboost30MVP from ${HORSE_NFT_CONTRACT_ADDR}

transaction(momentIds: [UInt64], momentRecipient: Address, boostNftId: UInt64, boostRecipient: Address) {

  let provider: auth(NonFungibleToken.Withdraw)
               &{NonFungibleToken.Provider, NonFungibleToken.CollectionPublic}
  let horseCol: auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Collection}

  prepare(signer: auth(Storage, Capabilities) &Account) {
    // 1. Borrow HybridCustody manager for TopShot moments
    let mgr = signer.storage.borrow<auth(HybridCustody.Manage) &HybridCustody.Manager>(
      from: HybridCustody.ManagerStoragePath
    ) ?? panic("No HybridCustody manager")

    let childAcct = mgr.borrowAccount(addr: ${childAddr})
      ?? panic("Child account not found")

    let capType = Type<
      auth(NonFungibleToken.Withdraw)
      &{NonFungibleToken.Provider, NonFungibleToken.CollectionPublic}>()

    let controllerID = childAcct.getControllerIDForType(
      type: capType,
      forPath: /storage/MomentCollection
    ) ?? panic("Controller ID not found for TopShot collection on child")

    let cap = childAcct.getCapability(
      controllerID: controllerID,
      type: capType
    ) as! Capability<
      auth(NonFungibleToken.Withdraw)
      &{NonFungibleToken.Provider, NonFungibleToken.CollectionPublic}>

    assert(cap.check(), message: "Invalid provider capability")
    self.provider = cap.borrow()!

    // 2. Borrow horse NFT collection from signer's own storage
    self.horseCol = signer.storage.borrow<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Collection}>(
      from: /storage/${HORSE_NFT_PATH_ID}
    ) ?? panic("No horse NFT collection found")
  }

  execute {
    // 3. Transfer TopShot moments to Dapper treasury
    let recipientAcct = getAccount(momentRecipient)
    let receiver = recipientAcct.capabilities
      .borrow<&{NonFungibleToken.Receiver}>(/public/MomentCollection)
      ?? panic("Recipient has no TopShot collection")

    for id in momentIds {
      let nft <- self.provider.withdraw(withdrawID: id)
      receiver.deposit(token: <-nft)
    }

    // 4. Transfer horse NFT to Flow treasury
    let boostAcct = getAccount(boostRecipient)
    let boostReceiver = boostAcct.capabilities
      .borrow<&{NonFungibleToken.Collection}>(/public/${HORSE_NFT_PATH_ID})
      ?? panic("Boost recipient has no horse NFT collection")

    let horseNft <- self.horseCol.withdraw(withdrawID: boostNftId)
    boostReceiver.deposit(token: <-horseNft)
  }
}
`;
}

/* ================================================================
   Cadence: check if user has $MVP vault set up
   ================================================================ */
const CADENCE_CHECK_MVP_VAULT = `
import FungibleToken from 0xf233dcee88fe0abe
import PetJokicsHorses from 0x6fd2465f3a22e34c

access(all) fun main(address: Address): Bool {
  let account = getAccount(address)
  let receiver = account.capabilities
    .borrow<&{FungibleToken.Receiver}>(PetJokicsHorses.ReceiverPublicPath)
  return receiver != nil
}
`;

/* ================================================================
   Cadence: set up $MVP vault for the user
   ================================================================ */
const CADENCE_SETUP_MVP_VAULT = `
import PetJokicsHorses from 0x6fd2465f3a22e34c
import FungibleToken from 0xf233dcee88fe0abe
import MetadataViews from 0x1d7e57aa55817448
import Toucans from 0x577a3c409c5dcb5e

transaction() {
  prepare(user: auth(Storage, Capabilities) &Account) {
    // ── Toucans Collection (dependency) ──
    if user.storage.borrow<&Toucans.Collection>(from: Toucans.CollectionStoragePath) == nil {
      user.storage.save(<- Toucans.createCollection(), to: Toucans.CollectionStoragePath)
      let cap = user.capabilities.storage.issue<&Toucans.Collection>(Toucans.CollectionStoragePath)
      user.capabilities.publish(cap, at: Toucans.CollectionPublicPath)
    }

    // ── $MVP Vault: save if missing ──
    if user.storage.borrow<&PetJokicsHorses.Vault>(from: PetJokicsHorses.VaultStoragePath) == nil {
      user.storage.save(
        <- PetJokicsHorses.createEmptyVault(vaultType: Type<@PetJokicsHorses.Vault>()),
        to: PetJokicsHorses.VaultStoragePath
      )
    }

    // ── Always fix capabilities (handles wallets left in a bad state) ──
    // Unpublish any stale / mistyped caps first, then re-issue fresh ones
    user.capabilities.unpublish(PetJokicsHorses.VaultPublicPath)
    user.capabilities.unpublish(PetJokicsHorses.ReceiverPublicPath)

    let publicCap = user.capabilities.storage.issue<&PetJokicsHorses.Vault>(PetJokicsHorses.VaultStoragePath)
    user.capabilities.publish(publicCap, at: PetJokicsHorses.VaultPublicPath)

    let receiverCap = user.capabilities.storage.issue<&PetJokicsHorses.Vault>(PetJokicsHorses.VaultStoragePath)
    user.capabilities.publish(receiverCap, at: PetJokicsHorses.ReceiverPublicPath)
  }
}
`;

/* ================================================================
   Cadence: send $MVP from user to treasury (buy direction)
   User signs this tx to pay for moments.
   ================================================================ */
function buildSendMvpCadence() {
  return `
import FungibleToken from 0xf233dcee88fe0abe
import PetJokicsHorses from 0x6fd2465f3a22e34c

transaction(amount: UFix64, recipient: Address) {
  let sentVault: @{FungibleToken.Vault}

  prepare(signer: auth(Storage, BorrowValue) &Account) {
    let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &PetJokicsHorses.Vault>(
      from: PetJokicsHorses.VaultStoragePath
    ) ?? panic("Could not borrow reference to the owner's Vault!")
    self.sentVault <- vaultRef.withdraw(amount: amount)
  }

  execute {
    let recipientAccount = getAccount(recipient)
    let receiverRef = recipientAccount.capabilities.borrow<&{FungibleToken.Vault}>(
      /public/PetJokicsHorsesReceiver
    ) ?? panic("Recipient is missing receiver capability")
    receiverRef.deposit(from: <-self.sentVault)
  }
}
`;
}

// Treasury Flow wallet that receives $MVP
const TREASURY_FLOW = '0xcc4b6fa5550a4610';

/* ================================================================
   Enrich moments via our backend (DB lookup, no TopShot API calls)
   ================================================================ */
async function enrichMoments(rawMoments) {
  // rawMoments = [{id, playID, setID, serial}, ...] from Cadence
  try {
    const resp = await fetch('/api/moment-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moments: rawMoments }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.moments || []).map(m => ({
      id: m.id,
      serial: m.serial,
      player: m.player || 'Nikola Jokić',
      headline: m.headline || '',
      team: m.team || '',
      set: m.setName || '',
      seriesNumber: m.seriesNumber || null,
      tier: m.tier,
      imageUrl: m.imageUrl || null,
    }));
  } catch {
    return [];
  }
}

/* ================================================================
   MomentCard – memoised so only cards whose selection changes re-render
   ================================================================ */
const TIER_MAP = {};
TIERS.forEach(t => { TIER_MAP[t.key] = t; });

const MomentCard = React.memo(function MomentCard({ m, isSelected, isBuyMode, onToggle }) {
  const tierInfo = TIER_MAP[m.tier];
  const accentColor = isBuyMode ? '#4ade80' : '#FDB927';
  const price = isBuyMode ? (TIER_MVP_BUY[m.tier] || 0) : (TIER_MVP[m.tier] || 0);
  const handleClick = useCallback(() => onToggle(m.id), [onToggle, m.id]);
  return (
    <div
      className={`swap-moment-card ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      style={{ borderColor: isSelected ? (tierInfo?.color || accentColor) : undefined }}
    >
      {m.imageUrl && (
        <img src={m.imageUrl} alt={m.headline} className="swap-moment-img" loading="lazy" />
      )}
      <div className="swap-moment-info">
        <div className="swap-moment-player">{m.set}</div>
        <div className="swap-moment-headline">
          {m.seriesNumber ? `Series ${m.seriesNumber}` : ''}
        </div>
        <div className="swap-moment-meta">
          <span style={{ color: tierInfo?.color || '#adb5bd' }}>
            {tierInfo?.emoji} {tierInfo?.label || m.tier}
          </span>
          <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>#{m.serial}</span>
          <span style={{ color: accentColor, fontWeight: 600 }}>{price} $MVP</span>
        </div>
      </div>
      {isSelected && <div className="swap-moment-check" style={isBuyMode ? { background: '#4ade80' } : undefined}>✓</div>}
    </div>
  );
});

/* ================================================================
   SwapProgressStep – single step row in the progress modal
   ================================================================ */
function SwapProgressStep({ num, label, status, extra }) {
  const icons = {
    pending: <span className="sps-icon pending">{num}</span>,
    active:  <span className="sps-icon active"><span className="sps-spinner" /></span>,
    done:    <span className="sps-icon done">✓</span>,
    error:   <span className="sps-icon error">✗</span>,
  };
  return (
    <div className={`swap-progress-step ${status}`}>
      {icons[status] || icons.pending}
      <div className="sps-content">
        <div className="sps-label">{label}</div>
        {extra && <div className="sps-extra">{extra}</div>}
      </div>
    </div>
  );
}

/* ================================================================
   Component
   ================================================================ */
export default function Swap() {
  /* ── Auth ── */
  const [user, setUser] = useState({ loggedIn: null });
  useEffect(() => { fcl.currentUser().subscribe(setUser); }, []);

  /* ── Mode toggle: 'send' = moments→$MVP, 'get' = $MVP→moments ── */
  const [mode, setMode] = useState('send');

  /* ── Child (Dapper) account ── */
  const [childAddr, setChildAddr] = useState(null);
  const [childLoading, setChildLoading] = useState(false);
  const [childError, setChildError] = useState(null);

  /* ── MVP vault status ── */
  const [vaultReady, setVaultReady] = useState(null); // null=checking, true/false
  const [vaultSetting, setVaultSetting] = useState(false);

  /* ── Moments ── */
  const [moments, setMoments] = useState([]);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());

  /* ── Transaction ── */
  // (modal-based progress – see swapModal state below)

  /* ── Filters ── */
  const [tierFilter, setTierFilter] = useState('ALL');
  const [seriesFilter, setSeriesFilter] = useState('ALL');
  const [parallelFilter, setParallelFilter] = useState('ALL');
  const [setFilter, setSetFilter] = useState('ALL');

  /* ── Horse NFT boost ── */
  const [userHorses, setUserHorses] = useState([]);     // array of NFT ids owned
  const [boostNftId, setBoostNftId] = useState(null);   // selected horse id for boost
  const [boostPickerOpen, setBoostPickerOpen] = useState(false);

  /* ── Check MVP vault when wallet connects ── */
  useEffect(() => {
    if (!user?.addr) { setVaultReady(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const ok = await fcl.query({
          cadence: CADENCE_CHECK_MVP_VAULT,
          args: (arg, t) => [arg(user.addr, t.Address)],
        });
        if (!cancelled) setVaultReady(ok);
      } catch { if (!cancelled) setVaultReady(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.addr]);

  /* ── Set up MVP vault ── */
  const setupMvpVault = useCallback(async () => {
    setVaultSetting(true);
    try {
      const txId = await fcl.mutate({
        cadence: CADENCE_SETUP_MVP_VAULT,
        proposer: fcl.currentUser().authorization,
        payer: fcl.currentUser().authorization,
        authorizations: [fcl.currentUser().authorization],
        limit: 999,
      });
      await fcl.tx(txId).onceSealed();
      setVaultReady(true);
    } catch {
      // User declined or tx failed — stay on false
    } finally {
      setVaultSetting(false);
    }
  }, []);

  /* ── Discover child account when wallet connects ── */
  useEffect(() => {
    if (!user?.addr) {
      setChildAddr(null);
      setMoments([]);
      setSelected(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      setChildLoading(true);
      setChildError(null);
      try {
        const result = await fcl.query({
          cadence: CADENCE_GET_CHILD,
          args: (arg, t) => [arg(user.addr, t.Address)],
        });
        if (!cancelled) {
          if (result && result.length > 0) {
            setChildAddr(result[0]);
          } else {
            setChildError('No linked Dapper account found. Make sure your Dapper wallet is linked to this Flow wallet.');
          }
        }
      } catch (e) {
        if (!cancelled) setChildError('Could not discover Dapper child account.');
      } finally {
        if (!cancelled) setChildLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.addr]);

  /* ── Load user's horse NFTs (on parent wallet) ── */
  useEffect(() => {
    if (!user?.addr) { setUserHorses([]); setBoostNftId(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const ids = await fcl.query({
          cadence: CADENCE_LIST_HORSES,
          args: (arg, t) => [arg(user.addr, t.Address)],
        });
        if (!cancelled) setUserHorses((ids || []).map(Number));
      } catch { if (!cancelled) setUserHorses([]); }
    })();
    return () => { cancelled = true; };
  }, [user?.addr]);

  /* ── Load moments from child account (paginated) ── */
  useEffect(() => {
    if (!childAddr) { setMoments([]); return; }
    let cancelled = false;
    (async () => {
      setMomentsLoading(true);
      try {
        // 1. Get total moment count (cheap query)
        const total = await fcl.query({
          cadence: CADENCE_MOMENT_COUNT,
          args: (arg, t) => [arg(childAddr, t.Address)],
        });
        if (cancelled) return;
        const count = parseInt(total, 10) || 0;
        if (count === 0) {
          setMoments([]);
          setMomentsLoading(false);
          return;
        }

        // 2. Fetch moments in pages to stay within Flow's storage-interaction limit
        const allParsed = [];
        for (let offset = 0; offset < count; offset += MOMENTS_PAGE_SIZE) {
          if (cancelled) return;
          const raw = await fcl.query({
            cadence: CADENCE_LIST_MOMENTS_PAGE,
            args: (arg, t) => [
              arg(childAddr, t.Address),
              arg(String(offset), t.Int),
              arg(String(MOMENTS_PAGE_SIZE), t.Int),
            ],
          });
          if (cancelled) return;
          const page = (raw || []).map(r => ({
            id: parseInt(r[0], 10),
            playID: parseInt(r[1], 10),
            setName: r[2],
            serial: parseInt(r[3], 10),
            isLocked: r[4] === '1',
            subedition: parseInt(r[5] || '0', 10),
          }));
          allParsed.push(...page);
        }

        // 3. Filter out locked moments before enriching
        const unlocked = allParsed.filter(m => !m.isLocked);
        const enriched = await enrichMoments(unlocked);
        if (!cancelled) {
          // Merge subedition from Cadence data back into enriched moments
          const subMap = new Map(unlocked.map(u => [u.id, u.subedition || 0]));
          for (const em of enriched) {
            em.subedition = subMap.get(em.id) ?? 0;
          }
          // Sort by serial number descending (highest first)
          enriched.sort((a, b) => b.serial - a.serial);
          setMoments(enriched);
        }
      } catch {
        if (!cancelled) setMoments([]);
      } finally {
        if (!cancelled) setMomentsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [childAddr]);

  /* ── Treasury moments (for "get" mode) ── */
  const [treasuryMoments, setTreasuryMoments] = useState([]);
  const [treasuryLoading, setTreasuryLoading] = useState(false);
  const [treasurySelected, setTreasurySelected] = useState(new Set());

  useEffect(() => {
    if (mode !== 'get') return;
    let cancelled = false;
    (async () => {
      setTreasuryLoading(true);
      try {
        const resp = await fetch('/api/treasury/moments');
        if (!resp.ok) throw new Error('Failed to fetch');
        const data = await resp.json();
        if (!cancelled) {
          const moms = (data.moments || []).map(m => ({
            id: m.id,
            serial: m.serial,
            player: m.player || 'Nikola Jokić',
            headline: m.headline || '',
            team: m.team || '',
            set: m.setName || '',
            seriesNumber: m.seriesNumber || null,
            tier: m.tier,
            imageUrl: m.imageUrl || null,
            mvpCost: m.mvpCost || 0,
            subedition: m.subedition ?? 0,
          }));
          moms.sort((a, b) => a.serial - b.serial);
          setTreasuryMoments(moms);
        }
      } catch {
        if (!cancelled) setTreasuryMoments([]);
      } finally {
        if (!cancelled) setTreasuryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode]);

  /* ── Clear selection on mode switch ── */
  useEffect(() => {
    setSelected(new Set());
    setTreasurySelected(new Set());
    setBoostNftId(null);
    setBoostPickerOpen(false);
    setTierFilter('ALL');
    setSeriesFilter('ALL');
    setParallelFilter('ALL');
    setSetFilter('ALL');
  }, [mode]);

  /* ── Derived: available series & parallel values for dropdowns ── */
  const seriesOptions = useMemo(() => {
    const src = mode === 'send' ? moments : treasuryMoments;
    const vals = [...new Set(src.map(m => m.seriesNumber).filter(Boolean))].sort((a, b) => a - b);
    return vals;
  }, [mode, moments, treasuryMoments]);

  const parallelOptions = useMemo(() => {
    const src = mode === 'send' ? moments : treasuryMoments;
    const vals = [...new Set(src.map(m => m.subedition ?? 0))].sort((a, b) => a - b);
    return vals;
  }, [mode, moments, treasuryMoments]);

  const PARALLEL_NAMES = {
    0: 'Standard',
    1: 'Explosion',
    2: 'Torn',
    3: 'Vortex',
    4: 'Rippled',
    5: 'Coded',
    6: 'Halftone',
    7: 'Bubbled',
    8: 'Diced',
    9: 'Bit',
    10: 'Vibe',
    11: 'Astra',
    13: 'Voltage',
    14: 'Livewire',
    15: 'Championship',
    16: 'Club Collection',
    17: 'Blockchain',
    18: 'Hardcourt',
    19: 'Hexwave',
    20: 'Jukebox',
    21: 'Galactic',
    22: 'Omega',
  };
  const parallelLabel = (v) => PARALLEL_NAMES[v] || `Parallel #${v}`;

  const setOptions = useMemo(() => {
    const src = mode === 'send' ? moments : treasuryMoments;
    return [...new Set(src.map(m => m.set).filter(Boolean))].sort();
  }, [mode, moments, treasuryMoments]);

  /* ── Filtered moments (send mode) ── */
  const filtered = useMemo(() => {
    let list = moments;
    if (tierFilter !== 'ALL') list = list.filter(m => m.tier === tierFilter);
    if (seriesFilter !== 'ALL') list = list.filter(m => String(m.seriesNumber) === seriesFilter);
    if (parallelFilter !== 'ALL') list = list.filter(m => String(m.subedition ?? 0) === parallelFilter);
    if (setFilter !== 'ALL') list = list.filter(m => m.set === setFilter);
    return list;
  }, [moments, tierFilter, seriesFilter, parallelFilter, setFilter]);

  /* ── Filtered treasury moments (get mode) ── */
  const filteredTreasury = useMemo(() => {
    let list = treasuryMoments;
    if (tierFilter !== 'ALL') list = list.filter(m => m.tier === tierFilter);
    if (seriesFilter !== 'ALL') list = list.filter(m => String(m.seriesNumber) === seriesFilter);
    if (parallelFilter !== 'ALL') list = list.filter(m => String(m.subedition ?? 0) === parallelFilter);
    if (setFilter !== 'ALL') list = list.filter(m => m.set === setFilter);
    return list;
  }, [treasuryMoments, tierFilter, seriesFilter, parallelFilter, setFilter]);

  /* ── Calculate $MVP total for selected moments (send mode) ── */
  const selectedMvpBase = useMemo(() => {
    let total = 0;
    for (const id of selected) {
      const m = moments.find(x => x.id === id);
      if (m) total += TIER_MVP[m.tier] || 0;
    }
    return total;
  }, [selected, moments]);

  const boostActive = boostNftId != null;
  const selectedMvp = boostActive ? Math.round(selectedMvpBase * 1.2 * 10) / 10 : selectedMvpBase;

  /* ── Calculate $MVP cost for selected treasury moments (get mode) ── */
  const selectedBuyCost = useMemo(() => {
    let total = 0;
    for (const id of treasurySelected) {
      const m = treasuryMoments.find(x => x.id === id);
      if (m) total += TIER_MVP_BUY[m.tier] || 0;
    }
    return total;
  }, [treasurySelected, treasuryMoments]);

  const MAX_SELECT = 20;

  /* ── Toggle selection (send mode) ── */
  const toggleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SELECT) next.add(id);
      return next;
    });
  }, []);

  const selectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  /* ── Toggle selection (get mode) ── */
  const toggleTreasurySelect = useCallback((id) => {
    setTreasurySelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SELECT) next.add(id);
      return next;
    });
  }, []);

  const selectNoneTreasury = useCallback(() => {
    setTreasurySelected(new Set());
  }, []);

  /* ── Swap progress modal state ── */
  const [swapModal, setSwapModal] = useState(null); // null = hidden
  // swapModal shape: { step, momentCount, mvpExpected, txId, mvpTxId, mvpAmount, error }
  // step: 'signing' | 'submitted' | 'sealing' | 'sending-mvp' | 'done' | 'error'

  const closeSwapModal = useCallback(() => setSwapModal(null), []);

  /* ── Execute swap: transfer moments → treasury, then claim $MVP ── */
  const handleSwap = useCallback(async () => {
    if (!user?.addr || !childAddr || selected.size === 0) return;

    const momentIds = [...selected];
    const mvpExpected = selectedMvp;
    const usingBoost = boostNftId != null;

    // Open modal at step 1
    setSwapModal({ step: 'signing', momentCount: momentIds.length, mvpExpected, txId: null, mvpTxId: null, mvpAmount: null, error: null });

    try {
      /* Step 1: Sign & send moment transfer (with or without boost NFT) */
      const authz = fcl.currentUser().authorization;
      let transactionId;

      if (usingBoost) {
        const cadence = buildTransferWithBoostCadence(childAddr);
        transactionId = await fcl.mutate({
          cadence,
          args: (arg, t) => [
            arg(momentIds.map(id => String(id)), t.Array(t.UInt64)),
            arg(TREASURY_DAPPER, t.Address),
            arg(String(boostNftId), t.UInt64),
            arg(TREASURY_FLOW, t.Address),
          ],
          proposer: authz,
          payer: authz,
          authorizations: [authz],
          limit: 9999,
        });
      } else {
        const cadence = buildTransferMomentsCadence(childAddr);
        transactionId = await fcl.mutate({
          cadence,
          args: (arg, t) => [
            arg(momentIds.map(id => String(id)), t.Array(t.UInt64)),
            arg(TREASURY_DAPPER, t.Address),
          ],
          proposer: authz,
          payer: authz,
          authorizations: [authz],
          limit: 9999,
        });
      }

      setSwapModal(prev => ({ ...prev, step: 'submitted', txId: transactionId }));

      /* Step 2: Wait for seal */
      setSwapModal(prev => ({ ...prev, step: 'sealing' }));
      await fcl.tx(transactionId).onceSealed();

      /* Step 3: Send $MVP */
      setSwapModal(prev => ({ ...prev, step: 'sending-mvp' }));

      const resp = await fetch('/api/swap/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txId: transactionId,
          userAddr: user.addr,
          momentIds,
          boostNftId: usingBoost ? boostNftId : undefined,
        }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Swap completion failed');
      }

      /* Step 4: Done */
      setSwapModal(prev => ({
        ...prev,
        step: 'done',
        mvpTxId: data.mvpTxId || null,
        mvpAmount: data.mvpAmount || mvpExpected,
      }));

      /* Remove swapped moments from the list */
      setMoments(prev => prev.filter(m => !selected.has(m.id)));
      setSelected(new Set());

      /* Remove used horse from list */
      if (usingBoost) {
        setUserHorses(prev => prev.filter(id => id !== boostNftId));
        setBoostNftId(null);
      }

    } catch (e) {
      const msg = String(e?.message || e);
      let errorMsg;
      if (msg.toLowerCase().includes('declined') || msg.toLowerCase().includes('rejected') || msg.toLowerCase().includes('user rejected')) {
        errorMsg = 'Transaction was declined.';
      } else {
        errorMsg = msg.length > 150 ? msg.slice(0, 150) + '…' : msg;
      }
      setSwapModal(prev => ({ ...(prev || {}), step: 'error', error: errorMsg }));
    }
  }, [user, childAddr, selected, selectedMvp, boostNftId]);

  /* ── Execute buy: send $MVP → treasury, then receive moments ── */
  const handleBuy = useCallback(async () => {
    if (!user?.addr || !childAddr || treasurySelected.size === 0) return;

    const momentIds = [...treasurySelected];
    const mvpCost = selectedBuyCost;

    setSwapModal({
      step: 'signing',
      momentCount: momentIds.length,
      mvpExpected: mvpCost,
      txId: null,
      mvpTxId: null,
      mvpAmount: null,
      error: null,
      buyMode: true,
    });

    try {
      /* Step 1: Send $MVP to treasury */
      const cadence = buildSendMvpCadence();
      const authz = fcl.currentUser().authorization;
      const amountStr = mvpCost.toFixed(8);

      const transactionId = await fcl.mutate({
        cadence,
        args: (arg, t) => [
          arg(amountStr, t.UFix64),
          arg(TREASURY_FLOW, t.Address),
        ],
        proposer: authz,
        payer: authz,
        authorizations: [authz],
        limit: 9999,
      });

      setSwapModal(prev => ({ ...prev, step: 'submitted', txId: transactionId }));

      /* Step 2: Wait for seal */
      setSwapModal(prev => ({ ...prev, step: 'sealing' }));
      await fcl.tx(transactionId).onceSealed();

      /* Step 3: Server sends moments */
      setSwapModal(prev => ({ ...prev, step: 'sending-moments' }));

      const resp = await fetch('/api/swap/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txId: transactionId,
          userAddr: user.addr,
          userDapperAddr: childAddr,
          momentIds,
        }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Purchase failed');
      }

      /* Step 4: Done */
      setSwapModal(prev => ({
        ...prev,
        step: 'done',
        mvpTxId: data.momentsTxId || null,
        mvpAmount: data.mvpAmount || mvpCost,
      }));

      /* Remove purchased moments from treasury list */
      setTreasuryMoments(prev => prev.filter(m => !treasurySelected.has(m.id)));
      setTreasurySelected(new Set());

    } catch (e) {
      const msg = String(e?.message || e);
      let errorMsg;
      if (msg.toLowerCase().includes('declined') || msg.toLowerCase().includes('rejected') || msg.toLowerCase().includes('user rejected')) {
        errorMsg = 'Transaction was declined.';
      } else {
        errorMsg = msg.length > 150 ? msg.slice(0, 150) + '…' : msg;
      }
      setSwapModal(prev => ({ ...(prev || {}), step: 'error', error: errorMsg }));
    }
  }, [user, childAddr, treasurySelected, selectedBuyCost]);

  /* ── Render ── */
  const walletConnected = !!user?.addr;

  return (
    <div className="swap-container" style={{ maxWidth: 720 }}>
      {/* Hero */}
      <div className="swap-hero">
        <h1>⇅ Swap Jokic Moments &amp; $MVP</h1>
        <p>Trade TopShot Jokic moments for $MVP tokens and back</p>
        <Link to="/rewards" className="swap-cta-link">
          🎁 View Reward Pool &amp; Raffle Entries →
        </Link>
      </div>

      {/* ── Mode toggle ── */}
      <div className="swap-mode-toggle">
        <button
          className={`swap-mode-btn ${mode === 'send' ? 'active' : ''}`}
          onClick={() => setMode('send')}
        >
          📤 Send Moments → Get $MVP
        </button>
        <button
          className={`swap-mode-btn ${mode === 'get' ? 'active-get' : ''}`}
          onClick={() => setMode('get')}
        >
          🛒 Spend $MVP → Get Moments
        </button>
      </div>

      {/* ── Status / connect ── */}
      {!walletConnected && (
        <div className="swap-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#9CA3AF', marginBottom: '1rem' }}>Connect your Flow wallet to get started</p>
          <button className="swap-action-btn" style={{ maxWidth: 280 }} onClick={() => fcl.authenticate()}>
            Connect Wallet
          </button>
        </div>
      )}

      {walletConnected && vaultReady === false && (
        <div className="swap-card swap-vault-banner">
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚠️ $MVP Vault Not Set Up</div>
          <p style={{ color: '#CBD5E1', marginBottom: '1rem' }}>
            Your wallet doesn't have a $MVP token vault yet. You need to set it up before you can receive $MVP from swaps.
          </p>
          <button
            className="swap-action-btn"
            style={{ maxWidth: 280 }}
            onClick={setupMvpVault}
            disabled={vaultSetting}
          >
            {vaultSetting ? 'Setting up…' : 'Set Up $MVP Vault'}
          </button>
        </div>
      )}

      {walletConnected && childLoading && (
        <div className="swap-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#9CA3AF' }}>Discovering your Dapper account…</p>
        </div>
      )}

      {walletConnected && childError && (
        <div className="swap-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#ef4444' }}>{childError}</p>
        </div>
      )}

      {/* ── SEND MODE: Moment picker (user moments) ── */}
      {walletConnected && childAddr && mode === 'send' && (
        <>
          <div className="swap-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div className="swap-panel-label" style={{ margin: 0 }}>
                Your TopShot Jokic Moments
                <span style={{ color: '#6B7280', fontWeight: 400, marginLeft: 6 }}>
                  ({moments.length} total)
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                Dapper: {childAddr.slice(0, 6)}…{childAddr.slice(-4)}
              </div>
            </div>

            {/* Filters */}
            <div className="swap-filter-row">
              <select className="swap-filter-select" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
                <option value="ALL">All Tiers</option>
                {TIERS.map(t => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
              </select>
              <select className="swap-filter-select" value={seriesFilter} onChange={e => setSeriesFilter(e.target.value)}>
                <option value="ALL">All Series</option>
                {seriesOptions.map(s => <option key={s} value={String(s)}>Series {s}</option>)}
              </select>
              <select className="swap-filter-select" value={parallelFilter} onChange={e => setParallelFilter(e.target.value)}>
                <option value="ALL">All Parallels</option>
                {parallelOptions.map(p => <option key={p} value={String(p)}>{parallelLabel(p)}</option>)}
              </select>
              <select className="swap-filter-select" value={setFilter} onChange={e => setSetFilter(e.target.value)}>
                <option value="ALL">All Sets</option>
                {setOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Selection controls */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', fontSize: '0.8rem', alignItems: 'center' }}>
              <button className="max-btn" onClick={selectNone} style={{ color: '#9CA3AF' }}>Clear</button>
              {selected.size >= MAX_SELECT && <span style={{ color: '#FDB927', fontSize: '0.75rem' }}>Max {MAX_SELECT} per transaction</span>}
            </div>

            {/* Moment grid */}
            {momentsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>
                Loading your moments…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
                {moments.length === 0 ? 'No TopShot moments found in your Dapper account.' : 'No moments match your filter.'}
              </div>
            ) : (
              <div className="swap-moment-grid">
                {filtered.map(m => (
                  <MomentCard
                    key={m.id}
                    m={m}
                    isSelected={selected.has(m.id)}
                    isBuyMode={false}
                    onToggle={toggleSelect}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Swap summary & action (send mode) ── */}
          {selected.size > 0 && (
            <div className="swap-card" style={{ marginTop: '1rem' }}>
              <div className="swap-panel">
                <div className="swap-panel-label">Swap Summary</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#E5E7EB' }}>
                      {selected.size} moment{selected.size !== 1 ? 's' : ''}
                    </span>
                    <span style={{ color: '#6B7280', marginLeft: 8, fontSize: '0.85rem' }}>→ treasury</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FDB927' }}>
                      {selectedMvp.toLocaleString()} $MVP
                    </span>
                    {boostActive && (
                      <div style={{ fontSize: '0.75rem', color: '#4ade80' }}>
                        +20% boost ({selectedMvpBase.toLocaleString()} base)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="swap-rate-info">
                Common/Fandom = <strong>1.5 $MVP</strong> · Rare = <strong>75 $MVP</strong> · Legendary = <strong>1,500 $MVP</strong>
              </div>

              {/* ── Horse boost picker ── */}
              <div className="swap-boost-section">
                {userHorses.length > 0 ? (
                  boostNftId != null ? (
                    <div className="swap-boost-active">
                      <span style={{ color: '#4ade80', fontWeight: 600 }}>🐎 {horseName(boostNftId)} applied — +20% boost!</span>
                      <button className="swap-boost-remove" onClick={() => setBoostNftId(null)}>✕ Remove</button>
                    </div>
                  ) : (
                    <>
                      <button
                        className="swap-boost-btn"
                        onClick={() => setBoostPickerOpen(p => !p)}
                      >
                        🐎 Apply Horse Boost (+20%)
                      </button>
                      {boostPickerOpen && (
                        <div className="swap-boost-picker">
                          <div className="swap-boost-picker-title">Select a horse to send back for +20% $MVP</div>
                          <div className="swap-boost-horse-list">
                            {userHorses.map(id => (
                              <button
                                key={id}
                                className="swap-boost-horse-btn"
                                onClick={() => { setBoostNftId(id); setBoostPickerOpen(false); }}
                              >
                                {horseName(id)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#6B7280', textAlign: 'center', padding: '0.25rem 0' }}>
                    No MVP Horse NFTs found — <a href="/nft" style={{ color: '#FDB927' }}>get one</a> to send back for a one-time 20% swap boost
                  </div>
                )}
              </div>

              <button
                className="swap-action-btn"
                disabled={!!swapModal || !vaultReady}
                onClick={handleSwap}
                title={!vaultReady ? 'Set up your $MVP vault first' : ''}
              >
                {!vaultReady
                  ? '⚠ Set up $MVP vault first'
                  : `Swap ${selected.size} moment${selected.size > 1 ? 's' : ''} → ${selectedMvp.toLocaleString()} $MVP`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── GET MODE: Treasury moment picker ── */}
      {walletConnected && childAddr && mode === 'get' && (
        <>
          <div className="swap-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div className="swap-panel-label" style={{ margin: 0 }}>
                Treasury Jokic Moments
                <span style={{ color: '#6B7280', fontWeight: 400, marginLeft: 6 }}>
                  ({treasuryMoments.length} available)
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                PetJokicsHorses Treasury
              </div>
            </div>

            {/* Filters */}
            <div className="swap-filter-row">
              <select className="swap-filter-select" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
                <option value="ALL">All Tiers</option>
                {TIERS.map(t => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
              </select>
              <select className="swap-filter-select" value={seriesFilter} onChange={e => setSeriesFilter(e.target.value)}>
                <option value="ALL">All Series</option>
                {seriesOptions.map(s => <option key={s} value={String(s)}>Series {s}</option>)}
              </select>
              <select className="swap-filter-select" value={parallelFilter} onChange={e => setParallelFilter(e.target.value)}>
                <option value="ALL">All Parallels</option>
                {parallelOptions.map(p => <option key={p} value={String(p)}>{parallelLabel(p)}</option>)}
              </select>
              <select className="swap-filter-select" value={setFilter} onChange={e => setSetFilter(e.target.value)}>
                <option value="ALL">All Sets</option>
                {setOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Selection controls */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', fontSize: '0.8rem', alignItems: 'center' }}>
              <button className="max-btn" onClick={selectNoneTreasury} style={{ color: '#9CA3AF' }}>Clear</button>
              {treasurySelected.size >= MAX_SELECT && <span style={{ color: '#4ade80', fontSize: '0.75rem' }}>Max {MAX_SELECT} per transaction</span>}
            </div>

            {/* Treasury moment grid */}
            {treasuryLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>
                Loading treasury moments…
              </div>
            ) : filteredTreasury.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
                {treasuryMoments.length === 0 ? 'No moments available in the treasury right now.' : 'No moments match your filter.'}
              </div>
            ) : (
              <div className="swap-moment-grid">
                {filteredTreasury.map(m => (
                  <MomentCard
                    key={m.id}
                    m={m}
                    isSelected={treasurySelected.has(m.id)}
                    isBuyMode={true}
                    onToggle={toggleTreasurySelect}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Buy summary & action (get mode) ── */}
          {treasurySelected.size > 0 && (
            <div className="swap-card" style={{ marginTop: '1rem' }}>
              <div className="swap-panel">
                <div className="swap-panel-label">Purchase Summary</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FDB927' }}>
                      {selectedBuyCost.toLocaleString()} $MVP
                    </span>
                    <span style={{ color: '#6B7280', marginLeft: 8, fontSize: '0.85rem' }}>→ treasury</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4ade80' }}>
                      {treasurySelected.size} moment{treasurySelected.size !== 1 ? 's' : ''}
                    </span>
                    <span style={{ color: '#6B7280', marginLeft: 8, fontSize: '0.85rem' }}>→ you</span>
                  </div>
                </div>
              </div>

              <div className="swap-rate-info">
                Common/Fandom = <strong>2 $MVP</strong> · Rare = <strong>100 $MVP</strong> · Legendary = <strong>2,000 $MVP</strong>
              </div>

              <button
                className="swap-action-btn swap-buy-btn"
                disabled={!!swapModal || !vaultReady}
                onClick={handleBuy}
                title={!vaultReady ? 'Set up your $MVP vault first' : ''}
              >
                {!vaultReady
                  ? '⚠ Set up $MVP vault first'
                  : `Buy ${treasurySelected.size} moment${treasurySelected.size > 1 ? 's' : ''} for ${selectedBuyCost.toLocaleString()} $MVP`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Swap progress modal ── */}
      {swapModal && (
        <div className="swap-modal-overlay">
          <div className="swap-modal">
            <h2 className="swap-modal-title">
              {swapModal.buyMode ? '🛒 Purchase in Progress' : '⇅ Swap in Progress'}
            </h2>
            <div className="swap-modal-summary">
              {swapModal.buyMode ? (
                <>
                  <span style={{ color: '#FDB927', fontWeight: 700 }}>{swapModal.mvpExpected?.toLocaleString()} $MVP</span>
                  {' → '}
                  {swapModal.momentCount} moment{swapModal.momentCount !== 1 ? 's' : ''}
                </>
              ) : (
                <>
                  {swapModal.momentCount} moment{swapModal.momentCount !== 1 ? 's' : ''}
                  {' → '}
                  <span style={{ color: '#FDB927', fontWeight: 700 }}>{swapModal.mvpExpected?.toLocaleString()} $MVP</span>
                </>
              )}
            </div>

            <div className="swap-modal-steps">
              {/* Step 1: Transaction submitted */}
              <SwapProgressStep
                num={1}
                label={swapModal.buyMode ? '$MVP transfer submitted' : 'Transaction submitted'}
                status={
                  swapModal.step === 'signing' ? 'active'
                    : ['submitted','sealing','sending-mvp','sending-moments','done'].includes(swapModal.step) ? 'done'
                    : swapModal.step === 'error' && !swapModal.txId ? 'error' : 'done'
                }
              />

              {/* Step 2: Sealed on-chain */}
              <SwapProgressStep
                num={2}
                label={swapModal.buyMode ? '$MVP transfer sealed' : 'Moments sealed on-chain'}
                status={
                  ['signing'].includes(swapModal.step) ? 'pending'
                    : ['submitted','sealing'].includes(swapModal.step) ? 'active'
                    : ['sending-mvp','sending-moments','done'].includes(swapModal.step) ? 'done'
                    : swapModal.step === 'error' && swapModal.txId ? 'error' : 'pending'
                }
                extra={swapModal.txId && (
                  <a href={`https://www.flowdiver.io/tx/${swapModal.txId}`} target="_blank" rel="noopener noreferrer" className="swap-tx-link">
                    {swapModal.txId.slice(0, 12)}… ↗
                  </a>
                )}
              />

              {/* Step 3: Server action */}
              <SwapProgressStep
                num={3}
                label={swapModal.buyMode ? 'Sending moments to you' : 'Sending $MVP'}
                status={
                  ['signing','submitted','sealing'].includes(swapModal.step) ? 'pending'
                    : (swapModal.step === 'sending-mvp' || swapModal.step === 'sending-moments') ? 'active'
                    : swapModal.step === 'done' ? 'done'
                    : 'pending'
                }
              />

              {/* Step 4: Complete */}
              <SwapProgressStep
                num={4}
                label={swapModal.step === 'done'
                  ? (swapModal.buyMode
                      ? `${swapModal.momentCount} moment${swapModal.momentCount !== 1 ? 's' : ''} sent!`
                      : `${swapModal.mvpAmount?.toLocaleString()} $MVP sent!`)
                  : (swapModal.buyMode ? 'Moments received' : '$MVP received')}
                status={swapModal.step === 'done' ? 'done' : 'pending'}
                extra={swapModal.mvpTxId && (
                  <a href={`https://www.flowdiver.io/tx/${swapModal.mvpTxId}`} target="_blank" rel="noopener noreferrer" className="swap-tx-link">
                    {swapModal.mvpTxId.slice(0, 12)}… ↗
                  </a>
                )}
              />
            </div>

            {/* Error message */}
            {swapModal.step === 'error' && (
              <div className="swap-modal-error">
                {swapModal.error}
              </div>
            )}

            {/* Button */}
            {swapModal.step === 'done' || swapModal.step === 'error' ? (
              <button className="swap-action-btn" style={{ marginTop: '1.25rem' }} onClick={closeSwapModal}>
                {swapModal.step === 'done' ? '✓ Close' : 'Close'}
              </button>
            ) : (
              <div className="swap-modal-wait-btn">
                ⚠ Do not leave this page
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── How it works ── */}
      <div className="swap-how-card">
        <h3>How It Works</h3>
        {mode === 'send' ? (
          <>
            <div className="swap-step">
              <div className="swap-step-num">1</div>
              <div className="swap-step-text">
                <h4>Connect &amp; pick moments</h4>
                <p>Connect your Flow wallet. We'll find your linked Dapper account and list your TopShot moments.</p>
              </div>
            </div>
            <div className="swap-step">
              <div className="swap-step-num">2</div>
              <div className="swap-step-text">
                <h4>Sign one transaction</h4>
                <p>Select moments to swap and click Swap. You sign a single Flow transaction that sends the moments to the treasury.</p>
              </div>
            </div>
            <div className="swap-step">
              <div className="swap-step-num">3</div>
              <div className="swap-step-text">
                <h4>Receive $MVP instantly</h4>
                <p>Once the transaction seals, the treasury wallet automatically sends $MVP to your Flow wallet.</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="swap-step">
              <div className="swap-step-num">1</div>
              <div className="swap-step-text">
                <h4>Browse treasury moments</h4>
                <p>Browse the Jokic moments available in the treasury. Select the ones you want to purchase.</p>
              </div>
            </div>
            <div className="swap-step">
              <div className="swap-step-num">2</div>
              <div className="swap-step-text">
                <h4>Send $MVP</h4>
                <p>Click Buy and sign one transaction to send $MVP from your Flow wallet to the treasury.</p>
              </div>
            </div>
            <div className="swap-step">
              <div className="swap-step-num">3</div>
              <div className="swap-step-text">
                <h4>Receive moments instantly</h4>
                <p>Once the $MVP transfer seals, the treasury automatically sends the selected moments to your Dapper wallet.</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Monthly Swap Leaderboard ── */}
      <SwapLeaderboard />
    </div>
  );
}
