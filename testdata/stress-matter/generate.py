#!/usr/bin/env python3
"""
Builds the stress-test matter: 48 hand-written documents with planted facts
(core_docs.py) plus routine project records, at a chosen size.

    python3 generate.py                # core set, 120 files
    python3 generate.py --size 500     # 500 files
    python3 generate.py --size 2000    # 2,000 files

Output goes to out/<size>/ with a manifest.json that the answer key and the
runner read. The same seed always produces the same files, so a result can be
reproduced exactly.

Everything is fictional. See core_docs.py for the matter.
"""

import argparse
import datetime as dt
import json
import os
import random
import shutil
import subprocess
import zipfile
from xml.sax.saxutils import escape

from core_docs import DOCS as HAND_DOCS, CRITERIA, MATTER_NAME, BATES_PREFIX

HERE = os.path.dirname(os.path.abspath(__file__))
START = dt.date(2024, 4, 1)      # Notice to Proceed
END = dt.date(2025, 9, 30)       # just after Substantial Completion

HOLIDAYS = {dt.date(2024, 5, 27), dt.date(2024, 7, 4), dt.date(2024, 9, 2), dt.date(2024, 11, 28),
            dt.date(2024, 11, 29), dt.date(2024, 12, 24), dt.date(2024, 12, 25), dt.date(2025, 1, 1),
            dt.date(2025, 5, 26), dt.date(2025, 7, 4), dt.date(2025, 9, 1)}

WORKDAYS = [START + dt.timedelta(days=i) for i in range((END - START).days + 1)]
WORKDAYS = [d for d in WORKDAYS if d.weekday() < 5 and d not in HOLIDAYS]

PEOPLE = {
    'marcus': ('Marcus Oyelaran', 'moyelaran@brightwaterbuilders.com', 'Brightwater Builders'),
    'rick': ('Rick Haldane', 'rhaldane@brightwaterbuilders.com', 'Brightwater Builders'),
    'nora': ('Nora Feld', 'nfeld@brightwaterbuilders.com', 'Brightwater Builders'),
    'dana': ('Dana Whitcomb', 'dwhitcomb@tallisdev.com', 'Tallis Development Group'),
    'evelyn': ('Evelyn Rowe', 'erowe@lindqvistrowe.com', 'Lindqvist Rowe Architects'),
    'tomasz': ('Tomasz Wierzbicki', 'twierzbicki@keystonemech.com', 'Keystone Mechanical'),
    'jess': ('Jess Holloway', 'jholloway@cumberlandelectric.com', 'Cumberland Electric'),
    'ray': ('Ray Tanaka', 'rtanaka@volunteerdrywall.com', 'Volunteer Drywall'),
    'omar': ('Omar Haddad', 'ohaddad@musiccityconcrete.com', 'Music City Concrete'),
    'beth': ('Beth Linwood', 'blinwood@tristarplumbing.com', 'Tri-Star Plumbing'),
}

# Work sequence by period. Each entry: (first day, activities, subs on site)
PHASES = [
    (dt.date(2024, 4, 1), ['Mass excavation and haul-off, building pad', 'Underground storm drainage, north side',
                           'Temporary power and site fencing', 'Erosion control inspection and repairs'],
     {'Music City Concrete': (4, 9), 'Tri-Star Plumbing': (2, 5)}),
    (dt.date(2024, 5, 6), ['Spread footings grid lines A through D', 'Foundation walls at elevator pit',
                           'Underslab plumbing rough-in', 'Vapor barrier and slab-on-grade prep'],
     {'Music City Concrete': (8, 16), 'Tri-Star Plumbing': (3, 6)}),
    (dt.date(2024, 6, 24), ['Structural steel erection, columns and beams', 'Metal deck installation',
                            'Shear stud welding', 'Crane picks for roof steel'],
     {'Music City Concrete': (2, 6), 'Cumberland Electric': (2, 4)}),
    (dt.date(2024, 9, 9), ['Slab on deck pours', 'Exterior wall framing and sheathing', 'Roofing membrane',
                           'Mechanical rough-in Level 1', 'Electrical rough-in Level 1'],
     {'Keystone Mechanical': (4, 8), 'Cumberland Electric': (5, 9), 'Tri-Star Plumbing': (3, 6)}),
    (dt.date(2024, 11, 11), ['Imaging suite RF shielding (Change Order work)', 'Slab reinforcement at imaging suite',
                             'Main supply ductwork Level 2', 'Interior framing Level 2', 'Window installation'],
     {'Keystone Mechanical': (6, 11), 'Cumberland Electric': (6, 10), 'Volunteer Drywall': (6, 12)}),
    (dt.date(2025, 1, 20), ['Supply ductwork Level 3', 'Drywall hanging Level 2', 'Electrical rough-in Level 3',
                            'Fire sprinkler mains Level 3'],
     {'Keystone Mechanical': (8, 12), 'Cumberland Electric': (6, 10), 'Volunteer Drywall': (8, 14)}),
    (dt.date(2025, 3, 10), ['Level 3 supply trunk removal and replacement', 'Drywall finishing Level 2',
                            'Ceiling grid Level 1', 'Imaging suite finishes'],
     {'Keystone Mechanical': (9, 14), 'Volunteer Drywall': (10, 16), 'Cumberland Electric': (5, 9)}),
    (dt.date(2025, 4, 14), ['Ceiling grid Level 3', 'Flooring Level 1 and 2', 'Casework installation',
                            'Painting Level 3 and 4', 'Rooftop unit start-up'],
     {'Keystone Mechanical': (5, 9), 'Volunteer Drywall': (6, 10), 'Cumberland Electric': (5, 8)}),
    (dt.date(2025, 7, 7), ['Test and balance', 'Commissioning functional testing', 'Punch list Level 1 and 2',
                           'Final cleaning', 'Site paving and striping'],
     {'Keystone Mechanical': (3, 6), 'Cumberland Electric': (2, 5)}),
]

WEATHER = {1: (26, 48), 2: (30, 54), 3: (38, 63), 4: (46, 72), 5: (55, 80), 6: (63, 87),
           7: (67, 90), 8: (66, 89), 9: (59, 84), 10: (47, 74), 11: (37, 62), 12: (30, 51)}
SKIES = ['clear', 'partly cloudy', 'overcast', 'light rain', 'clear', 'partly cloudy', 'windy']

RFI_TOPICS = [
    ('Structural', 'Embed plate size at the canopy connection conflicts between S-501 and A-401. Please confirm which governs.'),
    ('Architectural', 'Door 214 hardware set shows a closer on a pair with a coordinator not scheduled. Please advise.'),
    ('Electrical', 'Panel LP-2B location conflicts with the fire damper access on Level 2. Can the panel shift 24 inches east?'),
    ('Plumbing', 'Medical gas zone valve box elevation not dimensioned in Corridor 1C. Please provide mounting height.'),
    ('Civil', 'Storm structure SS-4 invert shown two different elevations on C-201 and C-301. Please confirm.'),
    ('Fire Protection', 'Sprinkler main routing conflicts with the Level 2 supply duct at grid D-4. Request coordination direction.'),
    ('Architectural', 'Exterior sealant color not selected for the metal panel system. Please provide selection.'),
    ('Structural', 'Roof opening for RTU-3 is 6 inches smaller than the unit curb submitted. Please confirm framing revision.'),
    ('Mechanical', 'VAV box VAV-2-14 sits above a hard ceiling with no access panel shown. Request access panel location.'),
    ('Architectural', 'Imaging suite control room window size differs between A-601 and the shielding vendor drawings.'),
    ('Electrical', 'Emergency lighting circuit in Stair 2 not shown on E-301. Please confirm circuiting.'),
    ('Mechanical', 'Condensate routing from Level 4 fan coils has no receptor shown. Please advise termination point.'),
]

EMAIL_TOPICS = [
    ('Concrete pour {d}', 'omar', 'rick', 'Confirming the {area} pour for {d} at 6:30 AM. Pump truck booked, testing lab notified. Weather looks fine, we will call it by 5 AM if not.'),
    ('Inspection request - {area}', 'rick', 'jess', 'County inspector is booked for the {area} rough-in on {d}. Please have your foreman walk it with me at 7:30 so we are not scrambling.'),
    ('Delivery window {d}', 'ray', 'rick', 'Drywall board for {area} arrives {d} between 7 and 9 AM. We need the hoist from 7:15. Please confirm the laydown area stays open.'),
    ('RFI follow-up', 'marcus', 'evelyn', 'Evelyn, following up on the open RFIs for {area}. Two are holding work in the field. Can we get responses by {d}?'),
    ('Look-ahead schedule', 'rick', 'tomasz', 'Tomasz, updated three-week look-ahead attached. Your crew is shown in {area} starting {d}. Let me know today if manpower is a problem.'),
    ('Plumbing rough-in {area}', 'beth', 'rick', 'Rough-in in {area} will be ready for inspection {d}. We had one sleeve miss at grid C-2 which we will core and firestop.'),
    ('Safety walk {d}', 'nora', 'rick', 'Safety walk findings for {area} on {d}: two open floor penetrations uncovered, one ladder not tied off. Please correct before noon.'),
    ('Owner walkthrough', 'dana', 'marcus', 'Marcus, the Tallis leasing team would like to walk {area} on {d}. Hard hats and vests for four people, please.'),
    ('Submittal status', 'marcus', 'evelyn', 'Evelyn, we are still waiting on the {area} submittal returned {d}. Lead times on that material are running long.'),
]

DELIVERY_ITEMS = ['#5 rebar, 18 tons', 'Wide-flange steel, 42 pieces', 'Metal deck, 36 bundles', 'Gypsum board 5/8 in. type X, 620 sheets',
                  'Galvanized spiral duct 12 in., 480 LF', 'Copper type L, 900 LF', 'EMT conduit 3/4 in., 2,400 LF',
                  'Ceiling tile 2x2, 180 cartons', 'Roofing membrane, 62 rolls', 'Storefront framing, 1 lot',
                  'Luxury vinyl tile, 210 cartons', 'Rooftop unit RTU-2, 1 each', 'VAV boxes, 24 each', 'Fire sprinkler pipe, 1 lot']

DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def long_date(d):
    return d.strftime('%B ') + str(d.day) + d.strftime(', %Y')


def slash(d):
    return d.strftime('%m/%d/%Y')


def rfc(d, rng):
    h, m, s = rng.randint(6, 18), rng.randint(0, 59), rng.randint(0, 59)
    offset = '-0500' if dt.date(d.year, 3, 9) <= d <= dt.date(d.year, 11, 2) else '-0600'
    return f'{DAYS_OF_WEEK[d.weekday()]}, {d.day} {MONTHS[d.month - 1]} {d.year} {h:02d}:{m:02d}:{s:02d} {offset}'


def phase_for(d):
    current = PHASES[0]
    for p in PHASES:
        if d >= p[0]:
            current = p
    return current


def area_for(d, rng):
    acts = phase_for(d)[1]
    return rng.choice(['Level 1', 'Level 2', 'Level 3', 'Level 4', 'the imaging suite', 'the north stair', 'the roof']) \
        if d >= dt.date(2024, 9, 9) else rng.choice(['the building pad', 'grid lines A-B', 'grid lines C-D', 'the elevator pit'])


# ---------------------------------------------------------------------------
# ROUTINE RECORD BUILDERS. Each returns (file, fmt, body, truth).
# ---------------------------------------------------------------------------

def daily_report(d, rng):
    number = WORKDAYS.index(d) + 1
    lo, hi = WEATHER[d.month]
    temp = rng.randint(lo, hi)
    sky = rng.choice(SKIES)
    _, acts, subs = phase_for(d)
    crew = [('Brightwater Builders', rng.randint(4, 8))] + [(s, rng.randint(*r)) for s, r in subs.items()]
    work = rng.sample(acts, k=min(3, len(acts)))
    if d == dt.date(2025, 2, 3):
        work = ['Keystone Mechanical hanging Level 3 supply ductwork, east wing. Keystone foreman advises material on hand is 22 gauge; 20 gauge coil still on backorder.',
                'Drywall hanging Level 2 corridors', 'Electrical rough-in Level 3']
    issues = '- None reported.'
    if 'rain' in sky:
        issues = '- Rain; exterior work stopped at 1:30 PM. Interior work continued.'
    elif rng.random() < 0.12:
        issues = rng.choice(['- Waiting on RFI response for embed plate size.', '- Hoist down 2 hours for maintenance.',
                             '- Late material delivery; crew reassigned.', '- Inspector rescheduled to next day.'])
    lines = [
        'BRIGHTWATER BUILDERS, INC.', 'DAILY FIELD REPORT', '',
        'Project: Harpeth Ridge Medical Office Building - Job No. 24-117',
        f'Report No. {number}                     Date: {slash(d)}',
        'Superintendent: Rick Haldane',
        f'Weather: {temp} F, {sky}. Work day: Yes', '', 'MANPOWER',
    ] + [f'{name} {"." * (28 - len(name))} {n}' for name, n in crew] + ['', 'WORK PERFORMED'] + \
        [f'- {w}.' if not w.endswith('.') else f'- {w}' for w in work] + ['', 'DELAYS / ISSUES', issues, '',
                                                                          'Rick Haldane, Superintendent']
    body = '\n'.join(lines) + '\n'
    return (f'Daily Field Report {d.isoformat()} No. {number}.txt', 'txt', body,
            dict(type='REPORT', relevance='strong', designation='produce', kind='daily report',
                 dates=[(slash(d), d.isoformat(), 'Report date')],
                 facts='Routine daily field report.' + (' Records 22 gauge on hand the day Level 3 ductwork went up.' if d == dt.date(2025, 2, 3) else ''),
                 hot=d == dt.date(2025, 2, 3)))


def rfi(n, d, rng):
    disc, q = RFI_TOPICS[n % len(RFI_TOPICS)]
    answered = d + dt.timedelta(days=rng.randint(3, 8))
    body = f"""REQUEST FOR INFORMATION
RFI No. {n:03d}

Project: Harpeth Ridge Medical Office Building
Date Submitted: {slash(d)}
From: Marcus Oyelaran, Brightwater Builders, Inc.
To: Lindqvist Rowe Architects, PLLC
Discipline: {disc}

Question:
{q}

Response (Lindqvist Rowe Architects, {slash(answered)}):
{rng.choice(['Confirmed as drawn on the architectural sheets; structural governs where noted.', 'Accepted. Proceed as proposed; no change in Contract Sum or Time.', 'See attached sketch SK-{0:03d}. Coordinate in the field with affected trades.'.format(n), 'Provide as specified. Contractor to coordinate.'])}

Evelyn Rowe, AIA
"""
    return (f'RFI-{n:03d} {disc} - {d.isoformat()}.pdf', 'pdf', body,
            dict(type='REPORT', relevance='strong', designation='produce', kind='RFI',
                 dates=[(slash(d), d.isoformat(), 'RFI submitted'), (slash(answered), answered.isoformat(), 'RFI answered')],
                 facts='Routine request for information.'))


def oac_minutes(n, d, rng):
    nxt = d + dt.timedelta(days=7)
    open_rfis, open_subs = rng.randint(3, 19), rng.randint(2, 14)
    body = f"""HARPETH RIDGE MEDICAL OFFICE BUILDING
OWNER-ARCHITECT-CONTRACTOR MEETING MINUTES - MEETING No. {n}
Date: {long_date(d)}    Location: Site office

Attendees: Dana Whitcomb (Tallis), Evelyn Rowe (Lindqvist Rowe), Marcus Oyelaran and Rick Haldane (Brightwater)

{n}.1 Safety - No recordable incidents this week. Toolbox talk topic: {rng.choice(['fall protection', 'silica exposure', 'hot work permits', 'heat illness', 'ladder safety'])}.
{n}.2 Schedule - Brightwater reviewed the three-week look-ahead. Current focus: {rng.choice(phase_for(d)[1]).lower()}.
{n}.3 RFIs - {open_rfis} open. Architect to respond to the oldest three by next meeting.
{n}.4 Submittals - {open_subs} in review. No long-lead items at risk this week.
{n}.5 Owner items - {rng.choice(['Tallis to confirm tenant signage package.', 'Tallis leasing to schedule a walkthrough.', 'No owner items.', 'Tallis to confirm low-voltage vendor.'])}

Next meeting: {long_date(nxt)}.
"""
    return (f'OAC Meeting Minutes No. {n} - {d.isoformat()}.pdf', 'pdf', body,
            dict(type='REPORT', relevance='strong', designation='produce', kind='OAC minutes',
                 dates=[(long_date(d), d.isoformat(), f'OAC meeting {n}'), (long_date(nxt), nxt.isoformat(), 'Next meeting')],
                 facts='Routine weekly meeting minutes.',
                 tool_note='Names parties and "Harpeth Ridge" only in the header. "Harpeth Ridge" is a key term, so screening should show LIKELY.'))


def pay_app(n, period_end, rng):
    pct = min(0.99, 0.045 * n + rng.uniform(-0.01, 0.01))
    total = 14_850_000 + (412_905 if n >= 7 else 0) + (286_400 if n >= 8 else 0)
    done = round(total * pct, 2)
    ret = round(done * 0.05, 2)
    prev = round(total * max(0, pct - 0.055) * 0.95, 2)
    due = round(done - ret - prev, 2)
    cert = period_end + dt.timedelta(days=rng.randint(8, 14))
    body = f"""APPLICATION AND CERTIFICATE FOR PAYMENT
Application No. {n}          Period To: {slash(period_end)}
Project: Harpeth Ridge Medical Office Building
To Owner: Tallis Development Group, LLC
From Contractor: Brightwater Builders, Inc.

1. Contract Sum to date                     ${total:,.2f}
2. Total completed and stored to date       ${done:,.2f}
3. Retainage (5%)                           ${ret:,.2f}
4. Total earned less retainage              ${done - ret:,.2f}
5. Less previous certificates for payment   ${prev:,.2f}
6. CURRENT PAYMENT DUE                      ${due:,.2f}

Certified by Architect: Evelyn Rowe, AIA, Lindqvist Rowe Architects, {slash(cert)}
"""
    return (f'Pay Application No. {n:02d} - period to {period_end.isoformat()}.pdf', 'pdf', body,
            dict(type='INVOICE', relevance='strong', designation='produce', kind='pay application',
                 dates=[(slash(period_end), period_end.isoformat(), 'Period end'), (slash(cert), cert.isoformat(), 'Certified')],
                 facts=f'Routine pay application. Retainage to date ${ret:,.2f}.'))


SUBMITTALS = [('03 30 00', 'Cast-in-place concrete mix designs'), ('05 12 00', 'Structural steel shop drawings'),
              ('07 54 00', 'TPO roofing system'), ('08 44 13', 'Glazed aluminum curtain wall'),
              ('09 29 00', 'Gypsum board assemblies'), ('23 31 13', 'Metal ducts'), ('23 36 00', 'Air terminal units'),
              ('26 24 16', 'Panelboards'), ('21 13 13', 'Wet-pipe sprinkler systems'), ('09 65 19', 'Resilient tile flooring'),
              ('13 49 00', 'RF shielding for imaging suite'), ('22 11 16', 'Domestic water piping')]


def submittal(n, d, rng):
    spec, title = SUBMITTALS[n % len(SUBMITTALS)]
    if spec == '23 31 13':
        status = 'APPROVED AS NOTED. Supply trunks serving Levels 2 through 4 shall be 20 gauge minimum as specified; 22 gauge shown for branch ducts only is acceptable.'
    else:
        status = rng.choice(['APPROVED.', 'APPROVED AS NOTED. See reviewer comments on sheets 3 and 7.', 'REVISE AND RESUBMIT. Provide fire rating documentation.'])
    returned = d + dt.timedelta(days=rng.randint(7, 14))
    body = f"""SUBMITTAL TRANSMITTAL No. {n:03d}

Project: Harpeth Ridge Medical Office Building, Job 24-117
From: Brightwater Builders, Inc. (Marcus Oyelaran)
To: Lindqvist Rowe Architects, PLLC
Specification Section: {spec} - {title}
Date Sent: {long_date(d)}

Architect's Action ({long_date(returned)}):
{status}

Reviewed by Evelyn Rowe, AIA. Review is for general conformance with the design concept only; the Contractor remains responsible for dimensions, quantities and coordination.
"""
    is_duct = spec == '23 31 13'
    return (f'Submittal {n:03d} - {spec} {title}.docx', 'docx', body,
            dict(type='DOCUMENT', relevance='strong', designation='produce', kind='submittal',
                 dates=[(long_date(d), d.isoformat(), 'Submittal sent'), (long_date(returned), returned.isoformat(), 'Returned')],
                 passages=['Supply trunks serving Levels 2 through 4 shall be 20 gauge minimum as specified'] if is_duct else [],
                 facts=('The approved duct submittal requires 20 gauge supply trunks on Levels 2-4. Keystone\'s later claim that it "installed per approved submittals" is false.'
                        if is_duct else 'Routine submittal transmittal.'),
                 hot=is_duct,
                 tool_note=None if is_duct else 'Mentions "Harpeth Ridge" (a term) and Lindqvist Rowe (a party), so screening should show LIKELY.'))


def routine_email(i, d, rng):
    subj, frm, to, text = EMAIL_TOPICS[i % len(EMAIL_TOPICS)]
    area = area_for(d, rng)
    when = d + dt.timedelta(days=rng.randint(1, 6))
    fname, faddr, fco = PEOPLE[frm]
    tname, taddr, _ = PEOPLE[to]
    s = subj.format(d=slash(when), area=area)
    body_text = text.format(d=long_date(when), area=area)
    body = f"""From: {fname} <{faddr}>
To: {tname} <{taddr}>
Date: {rfc(d, rng)}
Subject: Harpeth Ridge - {s}

{tname.split()[0]},

{body_text}

Thanks,
{fname}
{fco}
"""
    safe = s.replace('/', '-')
    return (f'{d.isoformat()} {fname.split()[1]} to {tname.split()[1]} - {safe} ({i:04d}).eml', 'eml', body,
            dict(type='EMAIL', relevance='strong', designation='produce', kind='routine email',
                 dates=[(long_date(when), when.isoformat(), 'Date mentioned in body')] + ([(slash(when), when.isoformat(), 'Date in subject')] if '{d}' in subj else []),
                 facts='Routine project coordination email.'))


def delivery_ticket(i, d, rng):
    item = DELIVERY_ITEMS[i % len(DELIVERY_ITEMS)]
    vendor = rng.choice(['Nashville Steel Supply', 'Cumberland Building Materials', 'Mid-South Mechanical Supply',
                         'Volunteer Lumber and Board', 'Rogers Electric Supply', 'Middle Tennessee Ready Mix'])
    body = f"""DELIVERY TICKET  No. {rng.randint(100000, 999999)}
Vendor: {vendor}
Ship To: Brightwater Builders - Harpeth Ridge MOB, 1200 Harpeth Ridge Parkway, Franklin TN
Delivery Date: {slash(d)}
Material: {item}
Received in good condition, counted and checked against packing list. Shortages or damage noted below.
Exceptions: {rng.choice(['None.', 'None.', 'None.', '2 pieces damaged, credit requested.', 'Short 1 bundle, balance to follow.'])}
Received by: {rng.choice(['R. Haldane', 'N. Feld', 'site laborer (initials illegible)'])}
"""
    return (f'Delivery Ticket {d.isoformat()} {vendor.split()[0]} ({i:04d}).txt', 'txt', body,
            dict(type='DOCUMENT', relevance='strong', designation='produce', kind='delivery ticket',
                 dates=[(slash(d), d.isoformat(), 'Delivery date')], facts='Routine delivery ticket.',
                 tool_note='Mentions Brightwater and "Harpeth Ridge", so screening should show LIKELY.'))


# ---------------------------------------------------------------------------
# COMPOSITION
# ---------------------------------------------------------------------------

def routine_records(target, rng):
    """Routine records to add to the 48 hand-written documents (+1 duplicate)
    until the collection reaches `target` files."""
    need = target - len(HAND_DOCS) - 1
    out = []

    # Proportions roughly follow a real construction collection.
    wanted = {
        'daily': round(need * 0.30), 'email': round(need * 0.30), 'rfi': round(need * 0.10),
        'delivery': round(need * 0.12), 'minutes': round(need * 0.07), 'submittal': round(need * 0.07),
    }
    wanted['payapp'] = max(0, need - sum(wanted.values()))

    # Daily reports: always include February 3, 2025, then spread across the job.
    feb3 = dt.date(2025, 2, 3)
    pool = [d for d in WORKDAYS if d != feb3 and d != dt.date(2025, 1, 15)]
    n_daily = min(wanted['daily'], len(pool) + 1)
    days = sorted([feb3] + rng.sample(pool, n_daily - 1)) if n_daily else []
    out += [daily_report(d, rng) for d in days]

    wed = [d for d in WORKDAYS if d.weekday() == 2]
    minutes_pool = [(i + 1, d) for i, d in enumerate(wed) if i + 1 not in (35, 46)]
    for n, d in sorted(rng.sample(minutes_pool, min(wanted['minutes'], len(minutes_pool)))):
        out.append(oac_minutes(n, d, rng))

    rfi_days = sorted(rng.sample(WORKDAYS, min(wanted['rfi'], 400)))
    for k, d in enumerate(rfi_days):
        n = k + 1 if k + 1 < 87 else k + 2      # RFI-087 is hand-written
        out.append(rfi(n, d, rng))

    months = [dt.date(2024, m, 1) for m in range(4, 13)] + [dt.date(2025, m, 1) for m in range(1, 10)]
    ends = [(m.replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1) for m in months]
    for n, end in list(enumerate(ends, start=1))[:min(wanted['payapp'], 17)]:
        out.append(pay_app(n, end, rng))

    sub_days = sorted(rng.sample(WORKDAYS[:250], min(wanted['submittal'], 250)))
    # The duct submittal (23 31 13) is always present.
    sub_ns = list(range(1, len(sub_days) + 1))
    if 5 not in [n % len(SUBMITTALS) for n in sub_ns]:
        sub_ns[0] = 5
    for n, d in zip(sub_ns, sub_days):
        out.append(submittal(n, d, rng))

    for i, d in enumerate(sorted(rng.choices(WORKDAYS, k=wanted['email']))):
        out.append(routine_email(i, d, rng))
    for i, d in enumerate(sorted(rng.choices(WORKDAYS, k=wanted['delivery']))):
        out.append(delivery_ticket(i, d, rng))

    # Top up if the pay-app cap left a shortfall.
    i = len(out)
    while len(out) < need:
        d = rng.choice(WORKDAYS)
        out.append(routine_email(10000 + i, d, rng))
        i += 1
    return out[:need]


# ---------------------------------------------------------------------------
# FILE WRITERS
# ---------------------------------------------------------------------------

def write_docx(path, text):
    paras = ''.join(
        f'<w:p><w:r><w:t xml:space="preserve">{escape(line)}</w:t></w:r></w:p>' for line in text.split('\n'))
    document = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                f'<w:body>{paras}<w:sectPr/></w:body></w:document>')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml',
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="xml" ContentType="application/xml"/>'
                   '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
                   '</Types>')
        z.writestr('_rels/.rels',
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
                   '</Relationships>')
        z.writestr('word/document.xml', document)


def build(size, seed=20260924):
    rng = random.Random(seed)
    out_dir = os.path.join(HERE, 'out', str(size))
    shutil.rmtree(out_dir, ignore_errors=True)
    os.makedirs(out_dir)

    entries = [dict(file=d['file'], fmt=d['fmt'], body=d['body'], truth=dict(d['truth'], planted=True)) for d in HAND_DOCS]
    for file, fmt, body, truth in routine_records(size, rng):
        entries.append(dict(file=file, fmt=fmt, body=body, truth=dict(truth, planted=bool(truth.get('hot')))))

    # The exact duplicate: the February 3 daily report saved twice from two laptops.
    feb3 = next(e for e in entries if e['file'].startswith('Daily Field Report 2025-02-03'))
    entries.append(dict(file='Daily report 02-03-2025 (copy from superintendent laptop).txt', fmt='txt', body=feb3['body'],
                        truth=dict(feb3['truth'], planted=True, hot=False, integrity='duplicate',
                                   facts='Byte-for-byte copy of the February 3, 2025 daily report under a different file name.',
                                   tool_note=f'Expect it to be skipped at upload as "already ingested". Only one copy may enter the matter. Duplicate of: {feb3["file"]}')))

    pdf_jobs = []
    for e in entries:
        path = os.path.join(out_dir, e['file'])
        fmt = e['fmt']
        if fmt in ('txt', 'eml', 'csv', 'json', 'md'):
            with open(path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(e['body'])
        elif fmt == 'empty':
            open(path, 'wb').close()
        elif fmt == 'cp1252':
            with open(path, 'wb') as f:
                f.write(e['body'].encode('cp1252'))
        elif fmt == 'docx':
            write_docx(path, e['body'])
        elif fmt in ('pdf', 'pdf_scan'):
            pdf_jobs.append({'out': path, 'text': e['body'], 'scan': fmt == 'pdf_scan'})
        else:
            raise ValueError(fmt)

    jobs_path = os.path.join(out_dir, '.pdf_jobs.json')
    with open(jobs_path, 'w') as f:
        json.dump(pdf_jobs, f)
    subprocess.run(['node', os.path.join(HERE, 'build_pdfs.mjs'), jobs_path], check=True)
    os.remove(jobs_path)

    manifest = {
        'matter': MATTER_NAME, 'batesPrefix': BATES_PREFIX, 'criteria': CRITERIA, 'size': size, 'seed': seed,
        'documents': [{'file': e['file'], 'fmt': e['fmt'], **e['truth'],
                       'text': '' if e['fmt'] in ('pdf_scan', 'empty') else e['body']} for e in entries],
    }
    with open(os.path.join(out_dir, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    return out_dir, manifest


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--size', type=int, default=120, help='total number of files (minimum 120)')
    args = ap.parse_args()
    if args.size < 120:
        raise SystemExit('The planted facts need at least 120 files.')
    out_dir, manifest = build(args.size)
    print(f'{len(manifest["documents"])} files written to {out_dir}')
