#!/usr/bin/env python3
"""
Parse SAPS quarterly crime statistics Excel file and output JSON
for Paarl, Wellington, and Malmesbury precincts.
"""

import json
import os
import openpyxl

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
EXCEL_PATH = os.path.join(DATA_DIR, 'saps_crime.xlsx')
OUTPUT_PATH = os.path.join(DATA_DIR, 'crime-stats.json')

TARGET_PRECINCTS = {'Paarl', 'Wellington', 'Malmesbury'}

# The most recent quarterly total column index (0-based)
# Column 28 = "April 2023 to June 2023"
LATEST_QUARTER_COL = 28
PERIOD_LABEL = "Q1 2023/2024 (April-June 2023)"

# Map SAPS crime categories to our JSON keys
CONTACT_CRIME_MAP = {
    'Murder': 'murder',
    'Attempted murder': 'attempted_murder',
    'Sexual offences': 'sexual_offences',
    'Assault with the intent to inflict grievous bodily harm': 'assault_gbh',
    'Common assault': 'common_assault',
    'Robbery with aggravating circumstances': 'robbery_aggravated',
    'Common robbery': 'robbery_common',
    'Robbery at residential premises': 'robbery_residential',
    'Robbery at non-residential premises': 'robbery_non_residential',
    'Carjacking': 'carjacking',
    'Truck hijacking': 'truck_hijacking',
}

PROPERTY_CRIME_MAP = {
    'Burglary at residential premises': 'burglary_residential',
    'Burglary at non-residential premises': 'burglary_non_residential',
    'Theft of motor vehicle and motorcycle': 'theft_motor_vehicle',
    'Theft out of or from motor vehicle': 'theft_from_motor_vehicle',
    'Stock-theft': 'stock_theft',
    'Commercial crime': 'commercial_crime',
    'Shoplifting': 'shoplifting',
    'Arson': 'arson',
    'Malicious damage to property': 'malicious_damage_to_property',
}

OTHER_CRIME_MAP = {
    'Drug-related crime': 'drug_related',
    'Driving under the influence of alcohol or drugs': 'driving_under_influence',
    'Illegal possession of firearms and ammunition': 'illegal_firearms',
    'Culpable homicide': 'culpable_homicide',
}

ALL_MAPS = {**CONTACT_CRIME_MAP, **PROPERTY_CRIME_MAP, **OTHER_CRIME_MAP}


def parse_excel():
    """Parse the SAPS Excel file and return crime data by precinct."""
    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)
    ws = wb['RAW Data']

    precinct_data = {p: {} for p in TARGET_PRECINCTS}

    for i, row in enumerate(ws.iter_rows(values_only=True), 1):
        if i <= 3:
            continue
        station = row[4]
        if station not in TARGET_PRECINCTS:
            continue

        crime_cat = row[7]
        value = row[LATEST_QUARTER_COL]
        if value is None:
            value = 0
        try:
            value = int(value)
        except (ValueError, TypeError):
            value = 0

        if crime_cat in ALL_MAPS:
            precinct_data[station][crime_cat] = value

    wb.close()
    return precinct_data


def calculate_safety_score(contact_total, property_total):
    """
    Calculate safety score 0-10 (10 = safest).
    Based on total crimes per quarter. Rough benchmarking:
    - 0 crimes -> score 10
    - 1500+ crimes -> score 0
    """
    total = contact_total + property_total
    score = max(0, 10 - (total / 150))
    return round(score, 1)


def build_output(precinct_data):
    """Build the output JSON structure."""
    precincts = {}

    for name, crimes in precinct_data.items():
        contact = {}
        property_crimes = {}
        other = {}

        for saps_cat, json_key in CONTACT_CRIME_MAP.items():
            contact[json_key] = crimes.get(saps_cat, 0)

        for saps_cat, json_key in PROPERTY_CRIME_MAP.items():
            property_crimes[json_key] = crimes.get(saps_cat, 0)

        for saps_cat, json_key in OTHER_CRIME_MAP.items():
            other[json_key] = crimes.get(saps_cat, 0)

        total_contact = sum(contact.values())
        total_property = sum(property_crimes.values())
        total_other = sum(other.values())

        precincts[name] = {
            'province': 'Western Cape',
            'contact_crimes': contact,
            'property_crimes': property_crimes,
            'other_crimes': other,
            'total_contact_crimes': total_contact,
            'total_property_crimes': total_property,
            'total_other_crimes': total_other,
            'total_crimes': total_contact + total_property + total_other,
            'safety_score': calculate_safety_score(total_contact, total_property),
        }

    return {
        '_metadata': {
            'source': 'SAPS quarterly crime statistics',
            'file': '2023-2024-1st_Quarter_WEB.xlsx',
            'period': PERIOD_LABEL,
            'downloaded': '2026-03-25',
            'url': 'https://www.saps.gov.za/services/downloads/2023-2024-1st_Quarter_WEB.xlsx',
            'notes': 'Parsed from official SAPS Excel download. Q1 = April-June 2023.',
        },
        'precincts': precincts,
    }


def main():
    print(f'Parsing {EXCEL_PATH}...')
    precinct_data = parse_excel()

    for name in TARGET_PRECINCTS:
        n = len(precinct_data.get(name, {}))
        print(f'  {name}: {n} crime categories found')

    output = build_output(precinct_data)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(output, f, indent=2)

    print(f'\nOutput written to {OUTPUT_PATH}')

    # Print summary
    for name, data in output['precincts'].items():
        print(f"\n{name}:")
        print(f"  Contact crimes: {data['total_contact_crimes']}")
        print(f"  Property crimes: {data['total_property_crimes']}")
        print(f"  Other crimes: {data['total_other_crimes']}")
        print(f"  Total: {data['total_crimes']}")
        print(f"  Safety score: {data['safety_score']}/10")


if __name__ == '__main__':
    main()
