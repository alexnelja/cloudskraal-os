# Blockchain for Document Trust in Commodity Trading

**Research Date:** March 2026
**Focus:** How blockchain increases trust in trade documents — Certificates of Analysis, lab certifications, bills of lading, weight certificates, origin certificates

---

## 1. The Problem: Trade Document Fraud in Commodities

### Scale
- ICC estimates **at least 1% of global trade financing (~$50B/year)** is fraudulent
- **$9B+ lost** through falsified documents in commodities over the past decade
- Physical commodity trade still relies on **~4 billion pieces of paper**

### Major Fraud Cases

**Hin Leong (Singapore, 2020) — $3.85B exposure**
- Fabricated documents on massive scale — forged bills of lading, duplicate documents presented to multiple banks as collateral for separate loans
- Forged BLs for circular trades where "no gasoil parcels were actually shipped"
- Combined with Agritrade: >$5B in bank exposure

**Agritrade International (Singapore) — $470M bank losses**
- Issued duplicate bills of lading to multiple banks against the same cargo
- CFO sentenced to 20 years imprisonment
- Exploited paper-based nature of BLs directly

**Trafigura Nickel Fraud (2023) — $577M loss**
- Nickel shipments from Indian businessman Prateek Gupta were fraudulent
- Fake warehouse receipts, duplicate shipping documents
- Containers filled with **painted rocks instead of nickel**

**JPMorgan / LME Nickel (2023) — Warehouse Receipt Fraud**
- 54 metric tons of "nickel" in Rotterdam warehouse turned out to be **bags of stones**
- Triggered emergency physical checks across LME warehouses globally
- Warehouse staff literally kicked two-ton bags to test contents
- Exposed that warehouse receipts could be issued for non-existent goods

### Documents Vulnerable to Fraud

| Document | Fraud Method | Impact |
|----------|-------------|--------|
| **Bills of Lading** | Duplication, forgery, phantom shipments | Multiple banks finance same cargo |
| **Warehouse Receipts** | Issued for non-existent goods, duplicated | Collateral fraud against lenders |
| **Certificates of Analysis** | Falsified grade/composition | Buyer receives wrong spec |
| **Weight Certificates** | Overstated weights | Buyer pays for material not received |
| **Certificates of Origin** | Falsified to evade sanctions/tariffs | Regulatory evasion |
| **Inspection Certificates** | Forged signatures, altered results | False quality assurance |

---

## 2. How Blockchain Document Verification Works

### The Basic Mechanism

1. **Document creation** — Lab/inspector/issuer creates certificate (e.g., CoA for chrome ore)
2. **Cryptographic hashing** — Document run through SHA-256 hash function → fixed-length digital fingerprint
3. **On-chain registration** — Hash recorded on blockchain with timestamp + issuer's digital signature
4. **Verification** — Any party hashes the document they received, compares against on-chain record. Single character change = hash mismatch = tamper detected

### Architecture: On-Chain Hash, Off-Chain Storage

- **On-chain:** document hash, timestamp, issuer identity/DID, document metadata, revocation status
- **Off-chain:** full document content in encrypted databases, IPFS, or holder wallets
- **Why:** putting full documents on-chain is expensive and creates privacy issues

### W3C Verifiable Credentials (VC 2.0)

Published as W3C Recommendation **May 15, 2025**. Defines three roles:

- **Issuer** — entity that creates and signs the credential (e.g., SGS issuing a CoA)
- **Holder** — entity that stores and presents it (e.g., the commodity trader)
- **Verifier** — entity that checks it (e.g., the buyer or bank)

Issuers publish public keys on a blockchain/registry. Data stays with holders. Holder controls what is shared and with whom — critical for traders who don't want competitors seeing certificate details.

### Zero-Knowledge Proofs for Selective Disclosure

Particularly relevant for commodity trading:

- Prove cargo meets minimum Cr2O3 grade threshold **without revealing exact assay results**
- Prove CoA was issued by accredited lab **without revealing full certificate contents**
- Bank can verify inspection was completed **without seeing commercially sensitive quality data**

### Legal Framework: UNCITRAL MLETR

Establishes principles of non-discrimination, technological neutrality, and functional equivalence for electronic trade documents. **11 jurisdictions** enacted MLETR-aligned laws including Singapore, UK (Electronic Trade Documents Act 2023), Bahrain, France, Abu Dhabi.

---

## 3. Lab Certification on Blockchain — Who's Doing It

### SGS — Most Advanced

**SGS Secured Document** — blockchain-powered solution for instant verification:
- Blockchain-recorded, encrypted, independently verifiable certificates via partnership with **Komgo** (Quorum blockchain)
- Verification via PDF upload or QR code scan — no special software
- e-Certificates compliant with eUCP rules
- Global acceptance by trade partners, banks, financial institutions
- **This is the closest to production deployment of blockchain-verified CoAs in commodity trading**

### Alfred H Knight (AHK)

- Joined **MaDiTraCe project** (EU Horizon-funded, €11M, 14 consortium members)
- Contributing to artificial fingerprinting technologies for material passports
- Certificates already have QR codes linking to secure verification page
- Partner **Spherity** provides decentralized identity layer
- Focus: cobalt, lithium, natural graphite, rare earth elements

### Bureau Veritas, Intertek, ALS

- Investing in digital transformation but **no production-grade blockchain certificate issuance** found for commodity assay results
- Focus is on AI-driven audits, IoT monitoring, remote auditing rather than on-chain verification

### The Honest Assessment

**No major TIC company has fully deployed a system where all assay results are routinely hashed on-chain as standard practice.** SGS is closest. AHK is in research. The industry is still largely paper-and-PDF.

---

## 4. Bills of Lading on Blockchain

### eBL Platforms Still Operating

| Platform | Status | Notable |
|----------|--------|---------|
| **CargoX** | Production | May 2025: first live interoperable eBL transaction (with EdoxOnline, HMM carrier, Suzano shipper) |
| **WAVE BL** | Production | Actively onboarding carriers |
| **essDOCS, Bolero, E-Title, edoxOnline** | Various stages | Mix of blockchain and other digital trust mechanisms |

### Adoption
- DCSA (70% of containerized trade) committed to **100% eBL by 2030**
- Late 2024 survey: nearly half of respondents already using eBLs
- Potential savings: **$6.5B direct costs** + **$30-40B in trade growth enablement**

### What Failed
- **TradeLens** (Maersk/IBM) — competitors refused to join Maersk-controlled platform
- **Contour** — couldn't convert pilots to volume (acquired by XDC Network Oct 2025 for revival)
- **Marco Polo, we.trade** — insolvency

---

## 5. Platforms Solving Document Trust Today

### MonetaGo / SWIFT — The Practical Success Story

**The most successful fraud prevention deployment in trade document verification:**

- Banks register financing applications and supporting documents as hashed digital fingerprints
- System checks for duplicates against global hash registry
- Detects both exact matches and partial matches (when fraudsters alter some fields)
- Distributed via SWIFT network to **all 11,000+ member institutions globally**
- Since production in 2018: **prevented tens of billions in losses**
- Singapore deployed it as Trade Finance Registry post-Hin Leong/Agritrade

**Important note:** MonetaGo **moved away from blockchain** to confidential computing at scale, while retaining the core cryptographic hashing principle. The lesson: the hash verification concept works; the specific distributed ledger technology is secondary.

### Komgo — Operational

- Built on Quorum (JP Morgan's Enterprise Ethereum)
- Partners with SGS for document verification
- **Kite**: proprietary document transfer without revealing contents to the platform
- End-to-end encryption + cryptographic fingerprints on blockchain
- Consortium: Shell, BP, Koch Supply & Trading, Gunvor, ING, SocGen, ABN AMRO, and others

### Minespider — Mineral Supply Chain Focus

- Open blockchain protocol for digital certificates tracking minerals along supply chains
- **Public, permissioned hybrid**: public blockchain for transparency, permissioned data layers controlling who sees what
- Production deployments with **Volkswagen** (battery supply chain cobalt) and **Volvo**
- Certificates with QR codes for verification
- Focus: battery minerals, critical raw materials, EU Battery Regulation compliance

### Circulor — Mineral Traceability

- Supply chain transparency for metals and minerals (batteries, renewable energy, construction)
- Deployed with **Volvo EX90** for battery passport
- Clients: **BHP, Trafigura**

---

## 6. Application to South African Bulk Minerals

### The Specific SA Problem: Illegal Chrome

- SA produces more chrome ore than any other country
- **~600,000 tonnes/year (10% of production) is illegally mined**
- Syndicates exploit weak artisanal mining permits (under 5 hectares, no environmental plans)
- Ore flows through spiral plants → trucked to Mozambique or warehoused in JHB → containerized from Durban/Richards Bay
- Once containerized, **illegitimate provenance becomes untraceable** within legitimate supply chains bound for China
- "There are no restrictions in SA on the transport, sale or processing of chrome ore"

### How a Blockchain Solution Works for SA Bulk Minerals

#### Stage 1 — Mine/Source Verification
- Mining operation registers with DID linked to verified mining rights and DMRE permits
- Each production batch gets digital certificate linked to source mine, GPS coordinates, permit number
- Certificate of Origin as Verifiable Credential, signed by mine operator

#### Stage 2 — Laboratory Testing
- Accredited lab (SGS, AHK, ALS, Intertek) performs assay
- CoA issued as Verifiable Credential: hash on-chain, full data off-chain
- Lab's DID and digital signature prove authenticity
- Buyer can verify: (a) hash matches document received, (b) issuing lab is legitimate, (c) certificate not revoked
- Selective disclosure: prove grade meets buyer's minimum spec without revealing exact composition

#### Stage 3 — Loading and Weighing
- Weighbridge certificates and draft survey results as Verifiable Credentials
- Weight and moisture data hashed on-chain at point of measurement
- TML and FMP certificates similarly recorded
- Multiple independent measurements cross-referenced on-chain

#### Stage 4 — Export Documentation
- eBL via CargoX or WaveBL
- Export permit linked to specific batch certificates
- Customs documentation digitally signed and verifiable

#### Stage 5 — Trade Finance
- Bank receives digital documents with on-chain verification
- MonetaGo/SWIFT registry checked for duplicate financing
- LC can reference verifiable on-chain document hashes
- Document checking: **days → minutes**

#### Stage 6 — Discharge and Verification
- Buyer receives cargo with full digital provenance trail
- Independent re-assay compared against origin certificates
- Any discrepancy immediately visible and attributable
- Dispute resolution has immutable evidence trail

### What This Solves

| Current Problem | Blockchain Solution |
|----------------|-------------------|
| Illegally mined chrome enters legal supply chain | Origin certificates linked to verified mining permits; mine-to-port provenance |
| Same cargo pledged to multiple banks | Hash registry flags duplicate document submission |
| Falsified assay results | Lab-signed Verifiable Credential with on-chain hash; any alteration detectable |
| Weight/moisture disputes at discharge | Immutable record of loading measurements; independent verification at both ends |
| Forged bills of lading | eBL with blockchain singularity — one token, one holder at a time |
| Slow document checking for trade finance | Instant cryptographic verification vs days of manual review |

---

## 7. Implementation Approach

### Permissioned vs Public Chain

**Permissioned is the consensus choice for commodity trading:**
- Data sensitivity — traders don't want transaction data visible to competitors
- Performance — faster, lower latency
- Compliance — KYC/AML easier with known participants
- Cost — lower fees, predictable
- Governance — consortium governance (but this is also where TradeLens failed)

Public chain used as **trust anchor only** — publishing hash verification roots to Ethereum for maximum immutability, while keeping data layer private.

### What Actually Works vs What Failed

**Works:**
- MonetaGo/SWIFT duplicate detection (hash registry)
- SGS Secured Document via Komgo (blockchain-verified certificates)
- CargoX eBL (live interoperable transactions)
- Singapore Trade Finance Registry (regulatory mandate driving adoption)
- Minespider for battery minerals provenance (EU regulatory demand driving adoption)
- Solutions that integrate into existing workflows (SWIFT, ERP, QR code on PDF)

**Failed:**
- TradeLens (single-company governance)
- Contour (pilots didn't convert to volume)
- Marco Polo, we.trade (insolvency)
- Any platform requiring everyone to join a new ecosystem simultaneously

**The pattern:** narrow scope + existing infrastructure integration = success. New platform requiring universal adoption = failure.

### Who Needs to Participate

| Participant | Role | Incentive |
|-------------|------|-----------|
| **Labs** (SGS, AHK, Intertek, ALS) | Issue Verifiable Credentials for assay results | Competitive differentiation; defend against forgery |
| **Shipping Lines** | Issue eBLs, confirm loading | DCSA mandate for 100% eBL by 2030; cost reduction |
| **Banks** | Verify documents, check duplicates | Fraud prevention (post-Hin Leong); cost reduction |
| **Sellers/Miners** | Register production, attach provenance | Access to trade finance; premium pricing for verified origin |
| **Buyers** | Verify received documents | Quality assurance; compliance (EU due diligence) |
| **Regulators** (DMRE, ITAC, SARS) | Set standards, enforce compliance | Combat illegal mining; tax revenue |

### Practical Starting Point for a SA Bulk Minerals Trader

1. **Don't build a new platform.** Integrate with existing solutions.
2. **Start with document hashing** — hash every CoA, weight certificate, BL your company handles. Simple internal tamper-detection layer.
3. **Adopt SGS Secured Document / Komgo** for SGS certificates. Push other labs to offer similar.
4. **Use CargoX or WaveBL** for eBLs on routes where carriers support it.
5. **Integrate with MonetaGo/SWIFT** via your bank for duplicate financing detection.
6. **Build provenance layer incrementally** — start with mine-to-port certificates of origin for chrome and manganese using Verifiable Credentials.
7. **Target EU market first** — EU Critical Raw Materials Act and Battery Regulation create buyer-side demand for verified provenance, making it commercially viable.

### The Commercial Opportunity

Buyers who can prove their chrome is legally sourced from verified SA mines — with unbroken digital chain of custody from mine to port — can command a **credibility premium** over unverified material. This is where blockchain provenance moves from theoretical to commercially valuable.

The illegal chrome problem (600,000t/year, 10% of production) specifically creates this opportunity: as international scrutiny increases (EU due diligence, US Minerals Security Partnership), verified provenance becomes a market differentiator, not just a compliance cost.

---

## Key Takeaways

1. **The technology exists today.** SGS Secured Document, CargoX eBL, MonetaGo/SWIFT, W3C Verifiable Credentials 2.0 — all in production.

2. **The barrier is adoption sequencing, not technology.** Start narrow (document hashing), integrate with existing infrastructure, expand incrementally.

3. **MonetaGo's lesson is crucial:** the most successful system moved away from blockchain to confidential computing. The cryptographic hashing principle matters more than the specific DLT.

4. **Zero-knowledge proofs enable commercial viability** — prove grade/quality meets spec without revealing exact results to third parties.

5. **EU regulation is the adoption forcing function** — Critical Raw Materials Act, Battery Regulation, and due diligence requirements create buyer demand for verified provenance.

6. **For SA bulk minerals specifically:** the illegal chrome problem creates both the need and the commercial opportunity for blockchain-verified provenance.
