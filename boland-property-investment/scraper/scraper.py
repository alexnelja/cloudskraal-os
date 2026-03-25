#!/usr/bin/env python3
"""
Property24 Scraper for BRRRR Investment Opportunities
=====================================================

Scrapes Property24.com for sale and rental listings in Paarl, Wellington,
and Malmesbury (Western Cape). Calculates estimated rental yield, detects
distressed sale indicators, and flags high-yield opportunities.

Usage:
    python3 scraper.py              # scrape sales only
    python3 scraper.py --rentals    # scrape rentals only
    python3 scraper.py --all        # scrape both sales and rentals

Output:
    - property24_listings_YYYY-MM-DD.csv   (sale listings)
    - property24_rentals_YYYY-MM-DD.csv    (rental listings)
    - Console summary of top opportunities

Author: Alex / Cloudskraal Capital
"""

import argparse
import csv
import logging
import re
import sys
import time
from datetime import datetime
from typing import Optional
from dataclasses import dataclass, fields, asdict

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Rate limiting: seconds to wait between HTTP requests
REQUEST_DELAY_MIN = 2.0
REQUEST_DELAY_MAX = 3.0

# ---------------------------------------------------------------------------
# Search configs — SALES
# ---------------------------------------------------------------------------
#
# Property24 URL structure (as of 2026-03):
#   /for-sale/{city}/western-cape/{area_code}
#   /apartments-for-sale/{city}/western-cape/{area_code}
#   /to-rent/{city}/western-cape/{area_code}
#
# Filters: ?PriceFrom=X&PriceTo=Y&Bedrooms=1&BedroomsTo=2
# Pagination: /p{N} appended to path before query string
#
# Area codes:  Paarl = 344,  Wellington = 345,  Malmesbury = 414
#
SALE_SEARCH_CONFIG = {
    # --- Paarl (344) ---
    "paarl": {
        "label": "Paarl",
        "base_url": "https://www.property24.com/for-sale/paarl/western-cape/344",
        "rent_estimates": {1: 7000, 2: 9500, 3: 12000, 4: 15000},
    },
    "paarl_apartments": {
        "label": "Paarl",
        "base_url": "https://www.property24.com/apartments-for-sale/paarl/western-cape/344",
        "rent_estimates": {1: 7000, 2: 9500, 3: 12000, 4: 15000},
    },
    "paarl_houses": {
        "label": "Paarl",
        "base_url": "https://www.property24.com/houses-for-sale/paarl/western-cape/344",
        "rent_estimates": {1: 7000, 2: 9500, 3: 12000, 4: 15000},
    },
    "paarl_townhouses": {
        "label": "Paarl",
        "base_url": "https://www.property24.com/townhouses-for-sale/paarl/western-cape/344",
        "rent_estimates": {1: 7000, 2: 9500, 3: 12000, 4: 15000},
    },
    # --- Wellington (345) ---
    "wellington": {
        "label": "Wellington",
        "base_url": "https://www.property24.com/for-sale/wellington/western-cape/345",
        "rent_estimates": {1: 5500, 2: 7000, 3: 9000, 4: 11000},
    },
    "wellington_apartments": {
        "label": "Wellington",
        "base_url": "https://www.property24.com/apartments-for-sale/wellington/western-cape/345",
        "rent_estimates": {1: 5500, 2: 7000, 3: 9000, 4: 11000},
    },
    "wellington_houses": {
        "label": "Wellington",
        "base_url": "https://www.property24.com/houses-for-sale/wellington/western-cape/345",
        "rent_estimates": {1: 5500, 2: 7000, 3: 9000, 4: 11000},
    },
    # --- Malmesbury (414) ---
    "malmesbury": {
        "label": "Malmesbury",
        "base_url": "https://www.property24.com/for-sale/malmesbury/western-cape/414",
        "rent_estimates": {1: 5500, 2: 7500, 3: 9500, 4: 12000},
    },
    "malmesbury_apartments": {
        "label": "Malmesbury",
        "base_url": "https://www.property24.com/apartments-for-sale/malmesbury/western-cape/414",
        "rent_estimates": {1: 5500, 2: 7500, 3: 9500, 4: 12000},
    },
    "malmesbury_houses": {
        "label": "Malmesbury",
        "base_url": "https://www.property24.com/houses-for-sale/malmesbury/western-cape/414",
        "rent_estimates": {1: 5500, 2: 7500, 3: 9500, 4: 12000},
    },
    # --- Stellenbosch (459) ---
    "stellenbosch": {
        "label": "Stellenbosch",
        "base_url": "https://www.property24.com/for-sale/stellenbosch/western-cape/459",
        "rent_estimates": {1: 8500, 2: 12000, 3: 16000, 4: 20000},
    },
    "stellenbosch_apartments": {
        "label": "Stellenbosch",
        "base_url": "https://www.property24.com/apartments-for-sale/stellenbosch/western-cape/459",
        "rent_estimates": {1: 8500, 2: 12000, 3: 16000, 4: 20000},
    },
    "stellenbosch_houses": {
        "label": "Stellenbosch",
        "base_url": "https://www.property24.com/houses-for-sale/stellenbosch/western-cape/459",
        "rent_estimates": {1: 8500, 2: 12000, 3: 16000, 4: 20000},
    },
    "stellenbosch_townhouses": {
        "label": "Stellenbosch",
        "base_url": "https://www.property24.com/townhouses-for-sale/stellenbosch/western-cape/459",
        "rent_estimates": {1: 8500, 2: 12000, 3: 16000, 4: 20000},
    },
    # --- Franschhoek (461) ---
    "franschhoek": {
        "label": "Franschhoek",
        "base_url": "https://www.property24.com/for-sale/franschhoek/western-cape/461",
        "rent_estimates": {1: 7000, 2: 10000, 3: 13000, 4: 16000},
    },
    # --- Tulbagh (346) ---
    "tulbagh": {
        "label": "Tulbagh",
        "base_url": "https://www.property24.com/for-sale/tulbagh/western-cape/346",
        "rent_estimates": {1: 4500, 2: 6000, 3: 8000, 4: 10000},
    },
    # --- Wolseley (347) ---
    "wolseley": {
        "label": "Wolseley",
        "base_url": "https://www.property24.com/for-sale/wolseley/western-cape/347",
        "rent_estimates": {1: 4000, 2: 5500, 3: 7000, 4: 9000},
    },
    # --- Ceres (348) ---
    "ceres": {
        "label": "Ceres",
        "base_url": "https://www.property24.com/for-sale/ceres/western-cape/348",
        "rent_estimates": {1: 4500, 2: 6000, 3: 8000, 4: 10000},
    },
    # --- Worcester (350) ---
    "worcester": {
        "label": "Worcester",
        "base_url": "https://www.property24.com/for-sale/worcester/western-cape/350",
        "rent_estimates": {1: 5000, 2: 7000, 3: 9000, 4: 11000},
    },
    "worcester_apartments": {
        "label": "Worcester",
        "base_url": "https://www.property24.com/apartments-for-sale/worcester/western-cape/350",
        "rent_estimates": {1: 5000, 2: 7000, 3: 9000, 4: 11000},
    },
    "worcester_houses": {
        "label": "Worcester",
        "base_url": "https://www.property24.com/houses-for-sale/worcester/western-cape/350",
        "rent_estimates": {1: 5000, 2: 7000, 3: 9000, 4: 11000},
    },
    # --- Robertson (336) ---
    "robertson": {
        "label": "Robertson",
        "base_url": "https://www.property24.com/for-sale/robertson/western-cape/336",
        "rent_estimates": {1: 4500, 2: 6000, 3: 8000, 4: 10000},
    },
    # --- Montagu (339) ---
    "montagu": {
        "label": "Montagu",
        "base_url": "https://www.property24.com/for-sale/montagu/western-cape/339",
        "rent_estimates": {1: 4500, 2: 6000, 3: 8000, 4: 10000},
    },
    # --- Riebeek Valley (1726) — covers Riebeek Kasteel + Riebeek West ---
    "riebeek_valley": {
        "label": "Riebeek Valley",
        "base_url": "https://www.property24.com/for-sale/riebeek-valley/western-cape/1726",
        "rent_estimates": {1: 5000, 2: 7000, 3: 9000, 4: 11000},
    },
    # --- Darling (2504) ---
    "darling": {
        "label": "Darling",
        "base_url": "https://www.property24.com/for-sale/darling/western-cape/2504",
        "rent_estimates": {1: 4500, 2: 6000, 3: 8000, 4: 10000},
    },
}

# ---------------------------------------------------------------------------
# Search configs — RENTALS
# ---------------------------------------------------------------------------
#
# Rental URLs use /to-rent/ prefix. Price filters use the same query params.
# We set a wide rental range to capture the full market picture.
#
RENTAL_SEARCH_CONFIG = {
    "paarl_rent": {
        "label": "Paarl",
        "base_url": "https://www.property24.com/to-rent/paarl/western-cape/344",
    },
    "wellington_rent": {
        "label": "Wellington",
        "base_url": "https://www.property24.com/to-rent/wellington/western-cape/345",
    },
    "malmesbury_rent": {
        "label": "Malmesbury",
        "base_url": "https://www.property24.com/to-rent/malmesbury/western-cape/414",
    },
    "stellenbosch_rent": {
        "label": "Stellenbosch",
        "base_url": "https://www.property24.com/to-rent/stellenbosch/western-cape/459",
    },
    "franschhoek_rent": {
        "label": "Franschhoek",
        "base_url": "https://www.property24.com/to-rent/franschhoek/western-cape/461",
    },
    "worcester_rent": {
        "label": "Worcester",
        "base_url": "https://www.property24.com/to-rent/worcester/western-cape/350",
    },
    "robertson_rent": {
        "label": "Robertson",
        "base_url": "https://www.property24.com/to-rent/robertson/western-cape/336",
    },
    "riebeek_valley_rent": {
        "label": "Riebeek Valley",
        "base_url": "https://www.property24.com/to-rent/riebeek-valley/western-cape/1726",
    },
}

# Price filter parameters — SALES
SALE_MIN_PRICE = 500_000
SALE_MAX_PRICE = 10_000_000

# Rent filter parameters — RENTALS
RENT_MIN_PRICE = 2_500
RENT_MAX_PRICE = 20_000

# Bedrooms filter (shared)
MIN_BEDS = 1
MAX_BEDS = 4

# Yield threshold for flagging
YIELD_THRESHOLD = 8.0

# ---------------------------------------------------------------------------
# Suburb quality filter — TENANT QUALITY FOCUS
# ---------------------------------------------------------------------------

# Paarl preferred suburbs (middle-class+, good tenant pool):
PAARL_PREFERRED = {
    "courtrai", "paarl central", "paarl south", "northern paarl",
    "southern paarl", "klein drakenstein", "groenheuwel", "denneburg",
    "lemoenkloof", "paarl east", "la concorde", "boschenmeer",
    "val de vie", "pearl valley", "wyndal", "bridge town",
    "new orleans", "esterville", "amstelhof", "paarl north",
    "la vie estate", "dalsig",
}

# Paarl excluded suburbs (township/low-income/high-risk):
PAARL_EXCLUDED = {
    "dal josafat", "paarl rural", "chicago", "fairyland",
    "huguenot", "klein parys", "mbekweni",
    "new orleans", "amstelhof",  # lower-income
    # Groenheuwel re-included — Mountain Ridge Estate is middle-class new-build
}

# Wellington preferred suburbs:
WELLINGTON_PREFERRED = {
    "wellington central", "wellington", "blouvlei", "versailles",
    "bergrivier", "bovlei",
}

# Wellington excluded suburbs:
WELLINGTON_EXCLUDED = {
    "nkqubela", "newtown",
    "porterville",  # different town, rural
}

# Malmesbury preferred suburbs:
MALMESBURY_PREFERRED = {
    "malmesbury central", "malmesbury", "saamstaan", "dalsig",
    "tafelzicht", "mount royal golf estate",
}

# Malmesbury excluded suburbs:
MALMESBURY_EXCLUDED = {
    "chatsworth", "wesfleur", "abbotsdale", "wesbank",
    "kalbaskraal",  # rural/low-income, poor tenant quality
}

# Stellenbosch excluded suburbs (township/low-income):
STELLENBOSCH_EXCLUDED = {
    "cloetesville", "kayamandi", "idas valley ext",
    "enkanini", "langrug", "kylemore",
    "jamestown", "idasvallei",
    "klapmuts",  # rural/industrial fringe
}

# Worcester excluded suburbs:
WORCESTER_EXCLUDED = {
    "avian park", "riverview", "zwelethemba", "parkersdam",
    "rouxpark", "esselen park",
}

# Robertson excluded suburbs:
ROBERTSON_EXCLUDED = {
    "dorpsig", "nkqubela", "robertson east",
}

# Ceres excluded suburbs:
CERES_EXCLUDED = {
    "nduli", "bella vista",
}

# Montagu excluded suburbs:
MONTAGU_EXCLUDED = {
    "ashton",  # separate town, mixed quality
}


def is_suburb_acceptable(suburb: str, area_label: str) -> bool:
    """Check if a suburb passes the tenant quality filter.

    Strategy: exclude known bad suburbs. If a suburb is not in either list,
    include it (conservative — review manually in CSV).
    """
    s = suburb.strip().lower()
    if area_label == "Paarl":
        if s in PAARL_EXCLUDED:
            return False
    elif area_label == "Wellington":
        if s in WELLINGTON_EXCLUDED:
            return False
    elif area_label == "Malmesbury":
        if s in MALMESBURY_EXCLUDED:
            return False
    elif area_label == "Stellenbosch":
        if s in STELLENBOSCH_EXCLUDED:
            return False
    elif area_label == "Worcester":
        if s in WORCESTER_EXCLUDED:
            return False
    elif area_label == "Robertson":
        if s in ROBERTSON_EXCLUDED:
            return False
    elif area_label == "Ceres":
        if s in CERES_EXCLUDED:
            return False
    elif area_label == "Montagu":
        if s in MONTAGU_EXCLUDED:
            return False
    return True


# ---------------------------------------------------------------------------
# Distressed sale keywords
# ---------------------------------------------------------------------------
# Scanned against listing title + description to flag potential below-market
# opportunities. Each keyword maps to a category for easy filtering.

DISTRESSED_KEYWORDS = {
    # Bank repossessions
    "bank repo": "repo",
    "repossess": "repo",
    "repossession": "repo",
    "bank sale": "repo",
    "bank sell": "repo",
    "fnb repo": "repo",
    "standard bank repo": "repo",
    "absa repo": "repo",
    "nedbank repo": "repo",
    # Deceased / estate sales
    "deceased estate": "estate",
    "estate late": "estate",
    "estate sale": "estate",
    "late estate": "estate",
    "executor": "estate",
    "winding up": "estate",
    # Motivated / urgent sellers
    "must sell": "motivated",
    "urgent sale": "motivated",
    "urgent sell": "motivated",
    "motivated seller": "motivated",
    "desperate": "motivated",
    "relocating": "motivated",
    "emigrating": "motivated",
    "divorce": "motivated",
    "downscaling": "motivated",
    # Price reductions
    "price reduced": "reduced",
    "reduced to": "reduced",
    "price drop": "reduced",
    "new price": "reduced",
    "reduced from": "reduced",
    "slashed": "reduced",
    "markdown": "reduced",
    "below market": "reduced",
    "below valuation": "reduced",
    # Auction
    "auction": "auction",
    "liquidation": "auction",
    "insolvency": "auction",
    "insolvent": "auction",
    # Condition-based (needs work = potential refurb upside)
    "as is": "as-is",
    "voetstoots": "as-is",
    "handyman": "as-is",
    "fixer": "as-is",
    "needs work": "as-is",
    "needs renovation": "as-is",
    "needs refurbish": "as-is",
    "needs tlc": "as-is",
    "renovation project": "as-is",
    "investor special": "as-is",
    # Dual mandate / sole mandate (signals seller commitment)
    "dual mandate": "mandate",
    "sole mandate": "mandate",
}


def detect_distressed_flags(text: str) -> str:
    """Scan text for distressed sale keywords. Returns comma-separated flags."""
    if not text:
        return ""
    lower = text.lower()
    found = set()
    for keyword, category in DISTRESSED_KEYWORDS.items():
        if keyword in lower:
            found.add(category)
    return ",".join(sorted(found))


# HTTP headers to reduce chance of being blocked
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-ZA,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Referer": "https://www.property24.com/",
}

MAX_PAGES = 20  # Safety limit per search

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


@dataclass
class Listing:
    listing_type: str = "sale"  # "sale" or "rental"
    title: str = ""
    price: int = 0
    bedrooms: int = 0
    bathrooms: int = 0
    floor_size_m2: str = ""
    address: str = ""
    suburb: str = ""
    area: str = ""
    listing_url: str = ""
    agent_name: str = ""
    agent_contact: str = ""
    description: str = ""
    listed_date: str = ""
    image_url: str = ""
    # Sale-specific fields
    estimated_monthly_rent: int = 0
    estimated_annual_rent: int = 0
    estimated_gross_yield: float = 0.0
    yield_above_threshold: bool = False
    distressed_flags: str = ""
    # Rental-specific fields
    monthly_rent: int = 0


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def parse_price(text: str) -> int:
    """Extract numeric price from a string like 'R 750 000' or 'R750000'."""
    if not text:
        return 0
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else 0


def parse_int(text: str) -> int:
    """Extract first integer from a string."""
    if not text:
        return 0
    match = re.search(r"\d+", text.strip())
    return int(match.group()) if match else 0


def rate_limit():
    """Sleep for a random interval between REQUEST_DELAY_MIN and REQUEST_DELAY_MAX."""
    import random
    delay = random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX)
    time.sleep(delay)


def fetch_page(url: str, session: requests.Session) -> Optional[BeautifulSoup]:
    """Fetch a URL and return parsed BeautifulSoup, or None on failure."""
    try:
        log.info("Fetching: %s", url)
        response = session.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        return BeautifulSoup(response.text, "html.parser")
    except requests.RequestException as exc:
        log.error("Failed to fetch %s: %s", url, exc)
        return None


def build_search_url(base_url: str, page: int, min_price: int, max_price: int) -> str:
    """Build a Property24 search URL with price and bedroom filters."""
    params = (
        f"PriceFrom={min_price}"
        f"&PriceTo={max_price}"
        f"&Bedrooms={MIN_BEDS}"
        f"&BedroomsTo={MAX_BEDS}"
    )

    if page > 1:
        url = f"{base_url}/p{page}?{params}"
    else:
        url = f"{base_url}?{params}"
    return url


# ---------------------------------------------------------------------------
# Parsing functions
# ---------------------------------------------------------------------------


def parse_listing_card(
    card,
    area_label: str,
    listing_type: str = "sale",
    rent_estimates: Optional[dict] = None,
) -> Optional[Listing]:
    """Parse a single listing card from a Property24 search results page."""
    listing = Listing()
    listing.listing_type = listing_type
    listing.area = area_label

    # --- Skip new-development tiles ---
    card_classes = " ".join(card.get("class", []))
    if "p24_development" in card_classes:
        return None

    # --- Title / description ---
    title_tag = card.select_one(".p24_title")
    desc_tag = card.select_one(".p24_description") or card.select_one(".p24_excerpt")
    if title_tag:
        listing.title = title_tag.get_text(strip=True)
    elif desc_tag:
        listing.title = desc_tag.get_text(strip=True)

    if desc_tag:
        listing.description = desc_tag.get_text(strip=True)[:500]
    elif title_tag:
        listing.description = listing.title[:500]

    # --- Price ---
    price_tag = card.select_one(".p24_price")
    if price_tag:
        price_text = price_tag.get_text(strip=True)
        m = re.match(r"R[\s\d]+", price_text.replace("\xa0", " "))
        if m:
            listing.price = parse_price(m.group())
        else:
            listing.price = parse_price(price_text)

    if listing.price == 0:
        return None

    # Price range filter depends on listing type
    if listing_type == "sale":
        if listing.price < SALE_MIN_PRICE or listing.price > SALE_MAX_PRICE:
            return None
    elif listing_type == "rental":
        if listing.price < RENT_MIN_PRICE or listing.price > RENT_MAX_PRICE:
            return None
        listing.monthly_rent = listing.price

    # --- Listing URL ---
    link_tag = (
        card.select_one("a.p24_tileAnchorWrapper")
        or card.select_one("a.p24_content")
        or card.select_one("a[href*='/for-sale/']")
        or card.select_one("a[href*='/to-rent/']")
        or card.select_one("a[href]")
    )
    if link_tag and link_tag.get("href"):
        href = link_tag["href"]
        if href.startswith("/"):
            href = "https://www.property24.com" + href
        listing.listing_url = href

    # --- Location / suburb / address ---
    location_tag = card.select_one(".p24_location")
    if location_tag:
        listing.suburb = location_tag.get_text(strip=True)

    address_tag = card.select_one(".p24_address")
    if address_tag:
        listing.address = address_tag.get_text(strip=True)
    elif listing.suburb:
        listing.address = listing.suburb

    # --- Suburb quality filter ---
    if not is_suburb_acceptable(listing.suburb, area_label):
        return None

    # --- Bedrooms / Bathrooms / Floor size ---
    for feat in card.select(".p24_featureDetails"):
        title_attr = (feat.get("title") or "").lower()
        value_text = feat.get_text(strip=True)
        if "bedroom" in title_attr:
            listing.bedrooms = parse_int(value_text)
        elif "bathroom" in title_attr:
            listing.bathrooms = parse_int(value_text)
        elif "floor" in title_attr or "erf" in title_attr or "size" in title_attr:
            listing.floor_size_m2 = value_text

    # Default to 1 bedroom if we couldn't parse
    if listing.bedrooms == 0:
        listing.bedrooms = 1

    # Skip if bedrooms outside our range
    if listing.bedrooms < MIN_BEDS or listing.bedrooms > MAX_BEDS:
        return None

    # --- Agent ---
    agent_tag = card.select_one(".p24_agencyBranding")
    if agent_tag:
        listing.agent_name = agent_tag.get_text(strip=True)

    contact_tag = card.select_one(".p24_contactText")
    if contact_tag:
        listing.agent_contact = contact_tag.get_text(strip=True)

    # --- Image ---
    img_tag = (
        card.select_one("img.p24_featImage")
        or card.select_one("img.p24_premImage")
        or card.select_one("img[src*='images.prop24.com']")
    )
    if img_tag:
        listing.image_url = img_tag.get("src") or img_tag.get("data-src") or ""

    # --- Sale-specific: yield calculation + distressed detection ---
    if listing_type == "sale" and rent_estimates:
        beds_key = min(listing.bedrooms, 2)
        monthly_rent = rent_estimates.get(beds_key, rent_estimates.get(1, 4500))
        listing.estimated_monthly_rent = monthly_rent
        listing.estimated_annual_rent = monthly_rent * 12

        if listing.price > 0:
            listing.estimated_gross_yield = round(
                (listing.estimated_annual_rent / listing.price) * 100, 2
            )
            listing.yield_above_threshold = listing.estimated_gross_yield >= YIELD_THRESHOLD

        # Scan for distressed indicators
        scan_text = f"{listing.title} {listing.description}"
        listing.distressed_flags = detect_distressed_flags(scan_text)

    return listing


def has_next_page(soup: BeautifulSoup) -> bool:
    """Check if there is a 'next page' link on the search results page."""
    pager = soup.select_one(".p24_pager")
    if not pager:
        return False

    for link in pager.select("a"):
        if link.get_text(strip=True) == "Next":
            href = link.get("href", "")
            classes = " ".join(link.get("class", []))
            if "text-muted" in classes or href.startswith("javascript"):
                return False
            return True

    return False


def scrape_area(
    area_key: str,
    config: dict,
    session: requests.Session,
    listing_type: str = "sale",
) -> list[Listing]:
    """Scrape all pages for a given area and property type."""
    listings = []
    label = config["label"]
    rent_estimates = config.get("rent_estimates")
    base_url = config["base_url"]

    min_price = SALE_MIN_PRICE if listing_type == "sale" else RENT_MIN_PRICE
    max_price = SALE_MAX_PRICE if listing_type == "sale" else RENT_MAX_PRICE

    for page in range(1, MAX_PAGES + 1):
        url = build_search_url(base_url, page, min_price, max_price)
        soup = fetch_page(url, session)

        if soup is None:
            log.warning("Stopping pagination for %s at page %d (fetch failed)", label, page)
            break

        cards = (
            soup.select(".js_resultTile")
            or soup.select(".p24_regularTile")
            or soup.select(".p24_proTile")
            or soup.select('[data-listing-id]')
        )

        if not cards:
            log.info("No listing cards found on page %d for %s. Stopping.", page, label)
            break

        log.info("Found %d cards on page %d for %s (%s)", len(cards), page, label, listing_type)

        for card in cards:
            listing = parse_listing_card(card, label, listing_type, rent_estimates)
            if listing:
                listings.append(listing)

        if not has_next_page(soup):
            log.info("No next page for %s after page %d", label, page)
            break

        rate_limit()

    return listings


# ---------------------------------------------------------------------------
# Output functions
# ---------------------------------------------------------------------------

SALE_FIELDS = [
    "listing_type", "title", "price", "bedrooms", "bathrooms", "floor_size_m2",
    "address", "suburb", "area", "listing_url", "agent_name", "agent_contact",
    "description", "listed_date", "image_url",
    "estimated_monthly_rent", "estimated_annual_rent",
    "estimated_gross_yield", "yield_above_threshold", "distressed_flags",
]

RENTAL_FIELDS = [
    "listing_type", "title", "monthly_rent", "bedrooms", "bathrooms",
    "floor_size_m2", "address", "suburb", "area", "listing_url",
    "agent_name", "agent_contact", "description", "listed_date", "image_url",
]


def write_csv(listings: list[Listing], filename: str, fieldnames: list[str]):
    """Write listings to a CSV file."""
    if not listings:
        log.warning("No listings to write.")
        return

    with open(filename, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for listing in listings:
            writer.writerow(asdict(listing))

    log.info("Wrote %d listings to %s", len(listings), filename)


def print_sale_summary(listings: list[Listing], top_n: int = 20):
    """Print a summary of the top sale opportunities sorted by yield."""
    if not listings:
        print("\nNo sale listings found matching criteria.")
        return

    sorted_listings = sorted(listings, key=lambda x: x.estimated_gross_yield, reverse=True)
    top = sorted_listings[:top_n]

    print("\n" + "=" * 110)
    print(f"  TOP {min(top_n, len(top))} SALE OPPORTUNITIES BY ESTIMATED GROSS YIELD")
    print("=" * 110)
    print(
        f"{'#':<4} {'Area':<12} {'Suburb':<20} {'Beds':<5} {'Price':>12} "
        f"{'Est Rent':>10} {'Yield':>8} {'Flags':>12}  {'URL'}"
    )
    print("-" * 110)

    for i, listing in enumerate(top, 1):
        flags = listing.distressed_flags[:12] if listing.distressed_flags else ""
        print(
            f"{i:<4} {listing.area:<12} {listing.suburb[:19]:<20} {listing.bedrooms:<5} "
            f"R{listing.price:>10,} R{listing.estimated_monthly_rent:>8,}/mo "
            f"{listing.estimated_gross_yield:>6.1f}% {flags:>12}  {listing.listing_url}"
        )

    print("-" * 110)

    # Summary stats
    total = len(listings)
    above_threshold = sum(1 for l in listings if l.yield_above_threshold)
    avg_yield = sum(l.estimated_gross_yield for l in listings) / total if total else 0
    avg_price = sum(l.price for l in listings) / total if total else 0
    distressed_count = sum(1 for l in listings if l.distressed_flags)

    print(f"\nSummary:")
    print(f"  Total listings found:        {total}")
    print(f"  Listings with yield >= {YIELD_THRESHOLD}%:  {above_threshold}")
    print(f"  Distressed/flagged:          {distressed_count}")
    print(f"  Average estimated yield:     {avg_yield:.1f}%")
    print(f"  Average price:               R{avg_price:,.0f}")

    for area_name in ["Paarl", "Wellington", "Malmesbury"]:
        area_listings = [l for l in listings if l.area == area_name]
        if area_listings:
            avg_y = sum(l.estimated_gross_yield for l in area_listings) / len(area_listings)
            avg_p = sum(l.price for l in area_listings) / len(area_listings)
            print(f"  {area_name:<14} listings:    {len(area_listings):>3} (avg yield {avg_y:.1f}%, avg price R{avg_p:,.0f})")

    # Distressed breakdown
    if distressed_count > 0:
        print(f"\n  Distressed listings breakdown:")
        flag_counts: dict[str, int] = {}
        for l in listings:
            if l.distressed_flags:
                for flag in l.distressed_flags.split(","):
                    flag_counts[flag] = flag_counts.get(flag, 0) + 1
        for flag, count in sorted(flag_counts.items(), key=lambda x: -x[1]):
            print(f"    {flag:<15} {count}")

    print(f"\n  Price range:                 R{SALE_MIN_PRICE:,} - R{SALE_MAX_PRICE:,}")
    print(f"  Bedrooms:                    {MIN_BEDS} - {MAX_BEDS}")
    print("=" * 110)


def print_rental_summary(listings: list[Listing]):
    """Print a summary of rental listings grouped by area and bedrooms."""
    if not listings:
        print("\nNo rental listings found matching criteria.")
        return

    print("\n" + "=" * 90)
    print("  RENTAL MARKET DATA")
    print("=" * 90)

    for area_name in ["Paarl", "Wellington", "Malmesbury"]:
        area_listings = [l for l in listings if l.area == area_name]
        if not area_listings:
            continue

        print(f"\n  {area_name}")
        print(f"  {'-' * 60}")

        for beds in [1, 2]:
            bed_listings = [l for l in area_listings if l.bedrooms == beds]
            if not bed_listings:
                continue

            rents = [l.monthly_rent for l in bed_listings]
            avg_rent = sum(rents) / len(rents)
            min_rent = min(rents)
            max_rent = max(rents)
            median_rent = sorted(rents)[len(rents) // 2]

            print(
                f"    {beds}-bed:  {len(bed_listings):>3} listings  |  "
                f"avg R{avg_rent:,.0f}  |  median R{median_rent:,.0f}  |  "
                f"range R{min_rent:,.0f} - R{max_rent:,.0f}"
            )

        # Top suburbs by listing count
        suburb_counts: dict[str, list[int]] = {}
        for l in area_listings:
            suburb_counts.setdefault(l.suburb, []).append(l.monthly_rent)

        if suburb_counts:
            print(f"    Suburb breakdown:")
            for suburb, rents in sorted(suburb_counts.items(), key=lambda x: -len(x[1])):
                avg = sum(rents) / len(rents)
                print(f"      {suburb:<25} {len(rents):>2} listings  avg R{avg:,.0f}/mo")

    total = len(listings)
    avg_all = sum(l.monthly_rent for l in listings) / total if total else 0
    print(f"\n  Total rental listings:       {total}")
    print(f"  Overall average rent:        R{avg_all:,.0f}/mo")
    print(f"  Rent range filter:           R{RENT_MIN_PRICE:,} - R{RENT_MAX_PRICE:,}")
    print("=" * 90)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def deduplicate(listings: list[Listing]) -> list[Listing]:
    """Deduplicate listings by URL."""
    seen_urls: set[str] = set()
    unique: list[Listing] = []
    for listing in listings:
        if listing.listing_url and listing.listing_url not in seen_urls:
            seen_urls.add(listing.listing_url)
            unique.append(listing)
        elif not listing.listing_url:
            unique.append(listing)
    return unique


def scrape_sales(session: requests.Session) -> list[Listing]:
    """Scrape all sale listings."""
    log.info("=" * 60)
    log.info("SCRAPING SALE LISTINGS")
    log.info("=" * 60)
    log.info("Target areas: Paarl, Wellington, and Malmesbury")
    log.info("Price range: R%s - R%s", f"{SALE_MIN_PRICE:,}", f"{SALE_MAX_PRICE:,}")
    log.info("Bedrooms: %d - %d", MIN_BEDS, MAX_BEDS)

    all_listings: list[Listing] = []

    for area_key, config in SALE_SEARCH_CONFIG.items():
        log.info("--- Scraping: %s (%s) ---", config["label"], area_key)
        try:
            area_listings = scrape_area(area_key, config, session, "sale")
            all_listings.extend(area_listings)
            log.info("Found %d listings for %s", len(area_listings), area_key)
        except Exception as exc:
            log.error("Error scraping %s: %s", area_key, exc, exc_info=True)
            continue
        rate_limit()

    unique = deduplicate(all_listings)
    log.info("Total unique sale listings: %d (from %d raw)", len(unique), len(all_listings))
    return unique


def scrape_rentals(session: requests.Session) -> list[Listing]:
    """Scrape all rental listings."""
    log.info("=" * 60)
    log.info("SCRAPING RENTAL LISTINGS")
    log.info("=" * 60)
    log.info("Target areas: Paarl, Wellington, and Malmesbury")
    log.info("Rent range: R%s - R%s", f"{RENT_MIN_PRICE:,}", f"{RENT_MAX_PRICE:,}")
    log.info("Bedrooms: %d - %d", MIN_BEDS, MAX_BEDS)

    all_listings: list[Listing] = []

    for area_key, config in RENTAL_SEARCH_CONFIG.items():
        log.info("--- Scraping: %s (%s) ---", config["label"], area_key)
        try:
            area_listings = scrape_area(area_key, config, session, "rental")
            all_listings.extend(area_listings)
            log.info("Found %d listings for %s", len(area_listings), area_key)
        except Exception as exc:
            log.error("Error scraping %s: %s", area_key, exc, exc_info=True)
            continue
        rate_limit()

    unique = deduplicate(all_listings)
    log.info("Total unique rental listings: %d (from %d raw)", len(unique), len(all_listings))
    return unique


def main():
    parser = argparse.ArgumentParser(description="Property24 BRRRR Scraper")
    parser.add_argument("--rentals", action="store_true", help="Scrape rental listings only")
    parser.add_argument("--all", action="store_true", help="Scrape both sales and rentals")
    args = parser.parse_args()

    do_sales = not args.rentals or args.all
    do_rentals = args.rentals or args.all

    session = requests.Session()
    today = datetime.now().strftime("%Y-%m-%d")

    if do_sales:
        sale_listings = scrape_sales(session)
        csv_filename = f"property24_listings_{today}.csv"
        write_csv(sale_listings, csv_filename, SALE_FIELDS)
        print_sale_summary(sale_listings, top_n=20)
        print(f"\nSale results saved to: {csv_filename}")

    if do_rentals:
        rental_listings = scrape_rentals(session)
        csv_filename = f"property24_rentals_{today}.csv"
        write_csv(rental_listings, csv_filename, RENTAL_FIELDS)
        print_rental_summary(rental_listings)
        print(f"\nRental results saved to: {csv_filename}")

    print("Done.")


if __name__ == "__main__":
    main()
