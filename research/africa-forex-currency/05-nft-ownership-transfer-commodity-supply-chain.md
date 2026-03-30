# NFT/Token-Based Ownership Transfer in Commodity Supply Chains

**Research Date:** March 2026
**Focus:** Has anyone built smart contracts that transfer ownership of metals/minerals via NFTs as material moves through the supply chain?

---

## The Short Answer

**The gap is real and largely unfilled.** Two things exist separately but nobody has combined them:

1. **Provenance tracking** (Minespider, Circulor, Tracr) — digital certificates ABOUT material, but don't automate ownership transfer
2. **Financial tokenization** (Paxos Gold, Canton Network) — handle ownership transfer beautifully but disconnected from physical supply chain tracking

**What does NOT exist yet:** A system where an NFT represents a batch of chrome concentrate at a mine, automatically transfers ownership to a trader when payment clears, splits into sub-lots, tracks through a smelter where it's blended (consuming input tokens, minting output tokens), and provides complete provenance AND ownership record throughout.

---

## 1. Existing Platforms — What They Actually Do

### Minespider (Germany, 2018) — Closest to NFT Approach

**What it is:** Open blockchain protocol on Ethereum for digital product passports tracking minerals along supply chains.

**Token approach:**
- Supports both fungible and non-fungible tokens
- Physical ingots get QR code stickers linked to non-fungible tokens showing previous owners
- NFTs created at smelter level linked to due diligence data
- SILQ utility token for governance
- Custom Ethereum smart contracts (not standard ERC-721/ERC-1155)

**Are these NFTs?** Functionally yes — non-fungible digital certificates on Ethereum representing specific batches. But custom protocol, not standard ERCs.

**Production clients:** Minsur (all tin output since 2023), LuNa Smelter (conflict-free African tin), Volkswagen, Ford Otosan, Renault, Tata Elxsi, TEMSA. Partnered with Rare Earth Ventures (Australia, 2025).

**Critical distinction:** Tracks provenance and creates digital passports. Does NOT automate ownership transfer. The token represents a certificate about the material, not a title deed that changes hands atomically with payment.

### Circulor (UK) — Enterprise Production Leader

**What it is:** Enterprise software on Oracle Blockchain (Hyperledger Fabric). Assigns digital identities to commodities at source, tracks through supply chain. Smart contracts validate chain of custody, ownership, and provenance before committing to ledger.

**Production deployments:**
- Volvo Cars: 100% cobalt traceability (with CATL, LG Chem)
- Polestar: cobalt, nickel, mica, manganese, graphite, lithium in EV batteries
- Vulcan Energy Resources: lithium production + embedded carbon
- Tantalum tracking for conflict mineral compliance

**Critical distinction:** Like Minespider — tracks provenance and custody, not automated ownership-transfer-on-payment. Smart contracts validate records, they don't execute title transfer.

### Tracr / De Beers — Closest to True Ownership Transfer

**What it is:** Blockchain platform for diamond provenance. Each diamond gets unique digital identity (carat, colour, clarity, cut). When manufacturer obtains a diamond, ownership transfers within the platform.

**Scale:** 2.8 million rough diamonds registered, $3.4B combined value, >2/3 of De Beers global production. Can register 1 million diamonds per week.

**Why it works for diamonds but not bulk commodities:** Each diamond is physically unique and identifiable. Bulk commodities (chrome, manganese, iron ore) are fungible — one tonne of 42% Cr2O3 is interchangeable with another.

### Canton Network / Eleox — Best Technical Foundation

**What it is:** Layer-1 blockchain using Digital Asset's Daml smart contract language (Haskell-based). Uses extended UTXO model — contracts are immutable, you archive old and create new upon transfer.

**How ownership transfer actually works in Daml:**
- Asset contract has owner and issuer fields
- Owner transfers by exercising a "Transfer" choice
- Smart contracts specify permissions for each party
- Transaction views encrypted per-recipient (privacy)

**Production:** $6T in tokenized assets, Castleton Commodities trading natural gas on Eleox. But this is energy commodities and financial instruments, NOT metals/minerals supply chain.

### Other Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| **Everledger** | Operational but reduced momentum | Last significant funding 2023 ($308K grant). Diamond/gemstone focus |
| **Open Mineral** | Pivoted away from blockchain | Started blockchain-based exchange for zinc/lead/copper (2018), now conventional cloud SaaS |
| **Datavault AI / ASMI** | Announced, not production | $78.2M initiative to tokenize US-mined antimony (up to $2B). Financial tokenization, not supply chain |
| **LMEpassport** | NOT blockchain | Centralized digital register for CoAs and ESG credentials. Document management, not ownership transfer |

### Major Miners
**No major mining company (BHP, Rio Tinto, Anglo American, Glencore) has built a blockchain/NFT ownership transfer system.** They participate as data providers to Minespider and Circulor, but are not building their own.

---

## 2. Smart Contract Triggers — What Triggers Ownership Transfer?

**Honest answer: there is no fully automated mine-to-manufacturer ownership transfer system in production today.**

### What Currently Exists

| Platform | Trigger Mechanism |
|----------|------------------|
| **Circulor** | Manual data entry through apps → smart contract validates → commits to ledger |
| **Minespider** | New holder scans QR code → system updates. Human-triggered. |
| **Tracr** | Both parties upload 3D scans of diamond → system compares → ownership transfers on scan match |
| **Canton/Daml** | Party exercises "Transfer" choice in smart contract. Can link to payment confirmation for atomic DvP |

### Oracle Systems for Physical-Digital Bridging

| Oracle | Function |
|--------|----------|
| **Chainlink Proof of Reserve** | Automated on-chain verification that off-chain reserves back on-chain tokens |
| **Hardware oracles** | IoT sensors, GPS, RFID, barcode scanners feeding physical state to blockchain |
| **Chainlink Data Feeds** | High-frequency commodity market data for smart contract pricing |

### The Fundamental Gap

> "Oracles are not capable of providing trustless verification that ownership of an asset is actually transferred to the new owner, even if the new owner holds a token representing ownership on the blockchain. Possession in a smart contract does not always transfer to possession in the real-world."

This remains the core unsolved problem. You need a trusted party (inspector, weighbridge operator, port authority) to confirm physical delivery happened before the smart contract can fire.

---

## 3. Token Standards for Commodities

### What's Being Used

| Platform | Standard | Chain |
|----------|----------|-------|
| Minespider | Custom Ethereum smart contracts | Ethereum |
| Circulor | Hyperledger Fabric chaincode | HLF (not ERC) |
| Tracr | Custom distributed ledger | Proprietary |
| Canton | Daml (Haskell-based) | Canton Network |

### What SHOULD Be Used (Academic/Industry Consensus)

| Standard | Best For | Limitation |
|----------|---------|-----------|
| **ERC-721** (unique NFTs) | Unique items (diamonds) | Cannot define minting conditions or comparability. Not suitable for bulk commodities |
| **ERC-1155** (semi-fungible) | **Best candidate for commodities.** Supports both fungible and non-fungible in one contract. Can split batches. Batch transfers. | Requires custom logic for blending/processing |
| **ERC-3643** (regulated securities) | Regulated commodity markets. Embeds KYC/AML, transfer restrictions, compliance at token level | Focused on financial compliance, not supply chain |
| **ERC-20** (fungible) | Commodity-backed stablecoins (gold tokens) | Loses batch-level traceability |

**Research finding:** No existing ERC standard fully solves the commodity problem. Requires custom smart contracts combining fungible and non-fungible approaches.

---

## 4. The Fungibility Problem — The Hardest Challenge

### The Core Issue
A tonne of 42% Cr2O3 chrome concentrate IS interchangeable with another tonne of same spec — but it also has a specific origin, carbon footprint, and chain of custody that may matter for compliance. When you blend two shipments in a stockpile, individual identities are destroyed physically but need to persist digitally.

### Three Approaches

| Approach | How It Works | Suitable For |
|----------|-------------|-------------|
| **Chain of Custody** (strictest) | Material physically segregated. Each batch has its own NFT. | Diamonds, tin ingots (individually identifiable). NOT bulk commodities that are blended |
| **Mass Balance** | Total certified input = total certified output. Material may mix physically, accounting ensures right volumes attributed | **Most bulk commodity supply chains use this.** Circulor and Minespider both support it |
| **Book and Claim** | Physical material and sustainability attributes completely decoupled. Credits traded separately | Most flexible but weakest link to physical material |

### The Token Recipe Solution (Academic)

Most technically detailed approach from research paper "Blockchain-based Supply Chain Traceability: Token Recipes model Manufacturing Processes":

- Each batch gets a non-fungible token (custom, not ERC-721)
- Manufacturers define **"recipes"** — input tokens and quantities needed to mint output tokens
- When manufacturing/processing occurs: **input tokens consumed (burned), output tokens minted**
- Tokens can be split, merged, transferred, consumed
- Certificate contracts define multiple token contracts as "equivalent" (handling fungibility)
- Batch IDs use SHA-3 hashing of resources, sender address, time

**How blending works:** When two chrome batches are blended, input tokens from both are consumed, new token minted representing blended output, with provenance data from both inputs recorded. Mass balance enforced by smart contract — cannot mint more output than sum of inputs.

**Implementation:** Solidity, deployable on any EVM-compatible chain. Open-source research implementation (not production-grade).

---

## 5. Digital Product Passports

### EU Battery Regulation Requirements
- By **February 2027**: every industrial and EV battery >2 kWh sold in EU must have a Battery Passport
- Carbon footprint declaration already mandatory since 18 Feb 2025
- Due diligence on raw material sourcing: postponed to 18 Aug 2027
- Passport must be accessible via QR code
- Data in open, machine-readable formats (XML/JSON)

### Blockchain is NOT Mandated
EU regulations require standardized data formats, NOT blockchain. A centralized database with proper access controls also satisfies the regulation. Blockchain is optional — vendors propose it for tamper-proof verification.

### Who's Building DPP Systems

| Platform | Approach | Focus |
|----------|----------|-------|
| **Catena-X** | Open, vendor-agnostic data ecosystem | Dominant automotive industry standard |
| **Minespider** | Ethereum + battery passport | Leading provider alongside Siemens, AVL, Circulor, Optel Group |
| **Circulor** | Hyperledger Fabric → digital battery passports | Expanding existing mineral tracking |
| **VeChain** | DPP system with UK's AMRC | Manufacturing |
| **Crossmint/Arianee** | NFT-based DPPs | Luxury goods only (not metals/minerals) |

### NFT vs QR Code
EU explicitly requires QR codes as the identifier, not wallet-based NFT lookups. The market is converging on Catena-X-style data spaces rather than token-based ownership.

---

## 6. LME and Commodity Exchanges

**LMEpassport:** Digital register for CoAs and ESG credentials. **NOT blockchain. NOT tokenized. NOT ownership transfer.** It's a document management system. Useful but conventional.

**No metals exchange has implemented token-based ownership.** LME, CME, SHFE all use conventional clearing and settlement.

**Tokenized precious metals** (PAXG $2.4B, XAUT $2.5B) exist on crypto exchanges but are financial instruments (allocated gold in vaults), not supply chain tracking systems.

**Canton Network/Eleox** is the closest to exchange-level tokenized commodity trading (Castleton Commodities, natural gas), but it's OTC bilateral, not exchange-traded metals.

---

## 7. Smart Contract Architectures

### Token Recipe System (Solidity, EVM)
```
Factory contract → deploys new token contracts per product type
Each token contract → manages batches (non-fungible within contract)
Recipes → define input tokens + quantities for manufacturing
consume() → burns input tokens, verifies sufficient balance
split() / merge() / transfer() → batch operations
Certificate contracts → equivalence declarations across token contracts
```
Gas-optimized: events for provenance data (not storage), inline assembly for variable packing. Open-source research implementation.

### Daml/Canton Network (Production-Grade)
```
Asset contract → owner/issuer fields
Transfer choice → exercised by owner to move to new owner
Extended UTXO → old contract archived, new one created
Per-recipient encrypted transaction views
```
Production: $6T in tokenized assets.

### Hyperledger Fabric (Circulor's Stack)
```
Oracle Blockchain Platform (HLF)
MSP ID of submitting org → stored as owner
Endorsement policies → only owning org can update
Smart contracts → validate chain of custody before commit
Private data collections → confidential supply chain data
```
Official "Secured Asset Transfer" sample available.

### No Open-Source Production Implementation
No production-ready open-source code exists specifically for metals/minerals commodity ownership transfer via tokens. Closest resources:
- Hyperledger Fabric samples (asset-transfer-basic)
- Token Recipe academic implementation
- OpenZeppelin ERC-1155 and ERC-3643 reference implementations

---

## 8. Who's Furthest Along in Production

### Tier 1 — Production at Scale

| Platform | Scale | But... |
|---------|-------|--------|
| **Tracr (De Beers)** | 2.8M diamonds, $3.4B value | Diamonds only, not bulk commodities |
| **Circulor** | Volvo 100% cobalt, Polestar, Vulcan Energy | Tracks provenance, not automated ownership transfer |
| **Minespider** | Minsur (all tin), VW, Ford, Renault | Digital passports, not automated ownership transfer |
| **Canton/Eleox** | $6T tokenized assets, Castleton natural gas | Only one actually transferring ownership via smart contract — but energy, not metals supply chain |

### Tier 2 — Announced/Early

| Platform | Status |
|---------|--------|
| Datavault AI / ASMI | $78.2M antimony tokenization announced, not production |
| Everledger | Operational but reduced momentum |

### Tier 3 — Pivoted Away

| Platform | Status |
|---------|--------|
| Open Mineral | Abandoned blockchain for conventional cloud SaaS |

---

## The Opportunity

### What Would a Complete System Look Like?

**Mine:**
- Batch created → NFT minted with origin data, mining permit, GPS coordinates
- CoA attached as verified credential (SGS Secured Document)

**Trader buys from mine:**
- Payment confirmed (or LC opened) → smart contract triggers ownership transfer of NFT
- NFT now held by trader's wallet
- All provenance data travels with the token

**Trader sells portion to Buyer A:**
- Token split function → original NFT consumed, two new NFTs minted (proportional)
- One transferred to Buyer A on payment, one remains with trader

**Material arrives at smelter, blended with other batches:**
- Input NFTs from multiple sources consumed (burned)
- New NFT minted for output product (ferrochrome)
- "Recipe" smart contract enforces mass balance — output ≤ sum of inputs
- Carbon footprint calculated from all inputs (for CBAM)
- Provenance from all source batches recorded in new token

**EU buyer receives ferrochrome:**
- Scans QR → sees full provenance chain, carbon footprint, verified CoAs
- CBAM declaration auto-populated from on-chain data
- Digital Product Passport requirements satisfied

### Why This Doesn't Exist Yet

1. **The physical-digital bridge** — no trustless way to verify physical delivery happened. Needs trusted parties (inspectors, port authorities) to confirm.
2. **Fungibility** — bulk commodities blend. The token recipe approach solves this technically but nobody has productionized it for metals.
3. **Adoption sequencing** — needs labs, miners, traders, smelters, shipping lines, and banks all participating. TradeLens failed trying this.
4. **Commercial incentive** — until EU regulations (CBAM, Battery Regulation, CRMA) create buyer-side demand, sellers have no reason to invest.

### Why It Might Happen Now

1. **EU regulatory forcing function** — CBAM live Jan 2026, Battery Passport Feb 2027, CRMA active. Buyers NEED this data.
2. **Canton Network provides the technical foundation** — production-grade ownership transfer, privacy controls, institutional trust ($6T assets).
3. **Token Recipe model solves fungibility** — academic solution ready for productionization.
4. **Building blocks exist** — SGS Secured Document for CoAs, CargoX for eBLs, Circulor/Minespider for provenance. Need integration, not invention.
5. **SA illegal chrome problem** creates commercial incentive — verified provenance = credibility premium.

### The Build-vs-Integrate Decision

**Don't build from scratch.** The successful approach:
1. Use **Canton/Daml** for ownership transfer smart contracts (production-proven, privacy-preserving)
2. Integrate **Circulor or Minespider** for provenance tracking
3. Use **SGS Secured Document** for verified CoAs
4. Use **CargoX** for eBLs
5. Implement **Token Recipe logic** for blending/processing steps
6. Feed data to **CarbonChain** or equivalent for CBAM emissions calculations
7. Output **Digital Product Passports** in Catena-X compatible format

The value is in the integration layer — connecting existing production systems into a coherent ownership + provenance + compliance chain.
