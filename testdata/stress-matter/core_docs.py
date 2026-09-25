"""
Hand-written documents for the stress-test matter.

Everything here is fictional: the people, companies, project, case number and
events are invented for testing Case Intelligence. Any resemblance to real
entities is coincidental.

THE MATTER
  Tallis Development Group, LLC v. Brightwater Builders, Inc.
  (Brightwater third-party complaint against Keystone Mechanical Services, LLC)
  Circuit Court for Williamson County, Tennessee, No. 25-CV-1847

  We act for Brightwater Builders (the general contractor). This is
  Brightwater's own collection, being prepared for production to Tallis.

  The owner, Tallis, says the Harpeth Ridge Medical Office Building reached
  substantial completion 74 days late and that third-floor ductwork was
  installed at the wrong gauge. It has withheld $185,000.00 in liquidated
  damages from retainage. Brightwater says the owner's Change Order 14 (an MRI
  suite redesign) caused the delay, but it asked for the extra time late. It
  blames the duct problem on its HVAC subcontractor, Keystone.

Each entry carries:
  file     the file name as it would come out of a document management export
  fmt      how the file is built (see generate.py)
  body     the text
  truth    ground truth for the answer key: what a correct review concludes,
           stage by stage, independent of what the tool does
"""

# Screening criteria the tester enters in Stage 01.
CRITERIA = {
    'parties': 'Tallis, Brightwater, Keystone, Lindqvist Rowe, Whitcomb, Oyelaran, Haldane, Wierzbicki, Carranza',
    'terms': 'Harpeth Ridge, Change Order 14, ductwork, liquidated damages, substantial completion, retainage',
    'from': '2024-03-01',
    'to': '2025-12-31',
}
MATTER_NAME = 'Tallis Development Group v. Brightwater Builders'
BATES_PREFIX = 'BWB'

DOCS = []


def doc(file, fmt, body, **truth):
    DOCS.append({'file': file, 'fmt': fmt, 'body': body.strip('\n') + '\n', 'truth': truth})


# ---------------------------------------------------------------------------
# CONTRACTS AND FORMAL INSTRUMENTS
# ---------------------------------------------------------------------------

doc('2024-03-15 Prime Contract - Tallis-Brightwater (executed).pdf', 'pdf', """
STANDARD FORM OF AGREEMENT BETWEEN OWNER AND CONTRACTOR
(Stipulated Sum)

This Agreement is entered into as of March 15, 2024, by and between TALLIS DEVELOPMENT GROUP, LLC, a Tennessee limited liability company ("Owner"), and BRIGHTWATER BUILDERS, INC., a Tennessee corporation ("Contractor"), for the following Project:

Harpeth Ridge Medical Office Building, 1200 Harpeth Ridge Parkway, Franklin, Tennessee. Four-story medical office building of approximately 62,000 gross square feet, including an imaging suite on Level 1.

The Architect is Lindqvist Rowe Architects, PLLC, Nashville, Tennessee.

ARTICLE 1  THE CONTRACT DOCUMENTS
1.1 The Contract Documents consist of this Agreement, the General Conditions (AIA A201-2017 as modified), the Drawings and Specifications listed in Exhibit A, Addenda 1 through 3, and Modifications issued after execution of this Agreement.

ARTICLE 2  THE WORK
2.1 The Contractor shall fully execute the Work described in the Contract Documents, except as specifically indicated in the Contract Documents to be the responsibility of others.

ARTICLE 3  DATE OF COMMENCEMENT AND SUBSTANTIAL COMPLETION
3.1 The date of commencement of the Work shall be the date stated in a notice to proceed issued by the Owner.
3.2 The Contract Time shall be measured from the date of commencement.
3.3 The Contractor shall achieve Substantial Completion of the entire Work not later than June 30, 2025, subject to adjustments of the Contract Time as provided in the Contract Documents.
3.4 Liquidated Damages. The Owner and Contractor agree that the Owner will suffer damages if Substantial Completion is not achieved by the date in Section 3.3. The Contractor shall pay the Owner, as liquidated damages and not as a penalty, Two Thousand Five Hundred Dollars ($2,500.00) for each calendar day after that date until Substantial Completion is achieved. The Owner may deduct liquidated damages from any sums otherwise due the Contractor, including retainage.

ARTICLE 4  CONTRACT SUM
4.1 The Owner shall pay the Contractor the Contract Sum of Fourteen Million Eight Hundred Fifty Thousand Dollars ($14,850,000.00), subject to additions and deductions as provided in the Contract Documents.

ARTICLE 5  PAYMENTS
5.1 Progress payments shall be made monthly on the Contractor's Application for Payment, certified by the Architect.
5.2 Retainage. The Owner shall withhold retainage of five percent (5%) of each progress payment. Retainage shall be released upon Substantial Completion, less any amount the Owner is entitled to withhold under the Contract Documents, including liquidated damages.

ARTICLE 15  CLAIMS AND DISPUTES (modifying A201-2017 Article 15)
15.1.2 Time Limits on Claims. Claims by the Contractor for an increase in the Contract Time must be initiated by written notice to the Owner and the Architect within twenty-one (21) days after the occurrence of the event giving rise to the Claim. Claims not initiated within that period are waived.
15.1.6 Claims for Additional Time. The Contractor shall support any Claim for additional time with a time impact analysis showing the effect of the event on the critical path.
15.4 Disputes not resolved by mediation shall be decided by litigation in the Circuit Court for Williamson County, Tennessee.

ARTICLE 16  MISCELLANEOUS
16.1 This Agreement is governed by the law of the State of Tennessee.

EXECUTED as of the date first written above.

OWNER: TALLIS DEVELOPMENT GROUP, LLC
By: Dana Whitcomb, Vice President, Development

CONTRACTOR: BRIGHTWATER BUILDERS, INC.
By: Gregory Tate, President
""",
    type='AGREEMENT', relevance='strong', designation='produce',
    dates=[('March 15, 2024', '2024-03-15', 'Contract executed'),
           ('June 30, 2025', '2025-06-30', 'Contractual Substantial Completion date')],
    passages=['not later than June 30, 2025',
              'Two Thousand Five Hundred Dollars ($2,500.00) for each calendar day',
              'within twenty-one (21) days after the occurrence of the event'],
    facts='Contract sum $14,850,000.00. Substantial Completion due June 30, 2025 (s.3.3). Liquidated damages $2,500/day (s.3.4). Retainage 5% (s.5.2). Time claims must be noticed within 21 days or are waived (s.15.1.2).',
    hot=True)

doc('2024-04-01 Notice to Proceed - Harpeth Ridge.pdf', 'pdf', """
TALLIS DEVELOPMENT GROUP, LLC
410 Cool Springs Boulevard, Suite 300
Franklin, Tennessee 37067

April 1, 2024

Mr. Marcus Oyelaran
Project Manager
Brightwater Builders, Inc.
2250 Nolensville Pike
Nashville, Tennessee 37211

Re: Notice to Proceed - Harpeth Ridge Medical Office Building

Dear Mr. Oyelaran:

Tallis Development Group hereby issues this Notice to Proceed under the Agreement dated March 15, 2024. The date of commencement of the Work is April 1, 2024. Please mobilize and begin work in accordance with the approved baseline schedule.

Substantial Completion remains required by June 30, 2025.

Sincerely,

Dana Whitcomb
Vice President, Development
Tallis Development Group, LLC

cc: Evelyn Rowe, AIA, Lindqvist Rowe Architects
""",
    type='LETTER', relevance='strong', designation='produce',
    dates=[('April 1, 2024', '2024-04-01', 'Notice to Proceed; date of commencement')],
    facts='Date of commencement is April 1, 2024.',
    tool_note='Letter mentions "the Agreement" and "hereby", so a keyword classifier may label it AGREEMENT. The true type is a letter.')

doc('2024-04-22 Subcontract - Brightwater-Keystone HVAC.docx', 'docx', """
SUBCONTRACT AGREEMENT

This Subcontract is entered into on April 22, 2024 between Brightwater Builders, Inc. ("Contractor") and Keystone Mechanical Services, LLC ("Subcontractor").

Project: Harpeth Ridge Medical Office Building, Franklin, Tennessee (Contractor Job No. 24-117).

1. Scope. Subcontractor shall furnish and install the complete HVAC system, including all supply, return and exhaust ductwork, in accordance with Drawings M-201 through M-404 and Specification Section 23 31 13 (Metal Ducts).

2. Subcontract Price. The Subcontract Price is Two Million One Hundred Ninety-Six Thousand Dollars ($2,196,000.00).

3. Materials. Supply trunk ductwork serving Levels 2 through 4 shall be galvanized steel, 20 gauge minimum, as specified. No substitution of materials or gauge shall be made without a written substitution request approved by the Architect.

4. Schedule. Subcontractor shall perform its work in accordance with the Contractor's project schedule and shall be liable to the Contractor for delay it causes, including any liquidated damages assessed by the Owner that are attributable to Subcontractor.

5. Indemnification. To the fullest extent permitted by law, Subcontractor shall indemnify and hold harmless the Contractor from all claims, damages, losses and expenses arising out of the performance of Subcontractor's work, including the cost of removing and replacing nonconforming work.

6. Retainage. Contractor shall retain ten percent (10%) of each progress payment until final completion of Subcontractor's work.

Executed:

BRIGHTWATER BUILDERS, INC.          KEYSTONE MECHANICAL SERVICES, LLC
By: Marcus Oyelaran                 By: Tomasz Wierzbicki, Project Manager
""",
    type='AGREEMENT', relevance='strong', designation='produce',
    dates=[('April 22, 2024', '2024-04-22', 'Subcontract executed')],
    passages=['galvanized steel, 20 gauge minimum, as specified',
              'including any liquidated damages assessed by the Owner that are attributable to Subcontractor'],
    facts='Subcontract $2,196,000.00. Supply trunks must be 20 gauge minimum; no substitution without Architect approval (s.3). Keystone indemnifies Brightwater and bears liquidated damages it causes (ss.4-5).',
    hot=True)

doc('2024-11-08 Change Order 14 - MRI Suite Redesign (signed scan).pdf', 'pdf_scan', """
CHANGE ORDER No. 14
Project: Harpeth Ridge Medical Office Building
Date: November 8, 2024
Owner: Tallis Development Group, LLC
Contractor: Brightwater Builders, Inc.
Description: Redesign of Level 1 imaging suite to accommodate 3T MRI.
Contract Sum increased by $286,400.00
Contract Time: time impact to be determined
Signed: Dana Whitcomb (Owner)   Marcus Oyelaran (Contractor)   Evelyn Rowe (Architect)
""",
    type='AGREEMENT', relevance='strong', designation='produce', integrity='needs_ocr',
    facts='Scanned image of the signed Change Order 14 with no text layer. The same terms are in the unsigned Word draft of Change Order 14.',
    tool_note='No text layer. The tool should hold it back as "Scanned image with no text layer" and cannot screen, date or cite it.')

doc('2024-11-08 Change Order 14 - MRI Suite Redesign (draft).docx', 'docx', """
CHANGE ORDER No. 14

Project: Harpeth Ridge Medical Office Building, Franklin, Tennessee
Date: November 8, 2024
Owner: Tallis Development Group, LLC
Contractor: Brightwater Builders, Inc.
Architect: Lindqvist Rowe Architects, PLLC

The Contract is changed as follows:

Redesign of the Level 1 imaging suite to accommodate a 3T MRI in place of the 1.5T unit shown on the original drawings, per Architect's Supplemental Instructions ASI-022 and ASI-023, including revised RF shielding, a quench pipe route to the roof, structural reinforcement of the slab at grid lines B-3 through C-5, and a dedicated chilled water loop.

Change in Contract Sum: The Contract Sum is increased by Two Hundred Eighty-Six Thousand Four Hundred Dollars ($286,400.00).
Original Contract Sum: $14,850,000.00
Net change by previous Change Orders: $412,905.00
Contract Sum including this Change Order: $15,549,305.00

Change in Contract Time: Time impact to be determined. Contractor shall submit any request for adjustment of the Contract Time in accordance with Section 15.1.2 of the Agreement.

NOT VALID UNTIL SIGNED BY THE OWNER, CONTRACTOR AND ARCHITECT.
""",
    type='AGREEMENT', relevance='strong', designation='produce',
    dates=[('November 8, 2024', '2024-11-08', 'Change Order 14 issued')],
    passages=['increased by Two Hundred Eighty-Six Thousand Four Hundred Dollars ($286,400.00)',
              'Time impact to be determined'],
    facts='Change Order 14 adds $286,400.00 and grants no time. Brightwater had to request time within 21 days, so by November 29, 2024.',
    hot=True)

# ---------------------------------------------------------------------------
# THE LATE TIME-EXTENSION REQUEST
# ---------------------------------------------------------------------------

doc('2024-12-19 Oyelaran to Haldane - CO 14 notice window.eml', 'eml', """
From: Marcus Oyelaran <moyelaran@brightwaterbuilders.com>
To: Rick Haldane <rhaldane@brightwaterbuilders.com>
Date: Thu, 19 Dec 2024 17:48:02 -0600
Subject: CO 14 time

Rick,

We blew the 21-day window on Change Order 14. It went out November 8, so the notice was due November 29 and nobody sent it. I need the time impact analysis from you by tomorrow and we will send the extension request anyway.

The MRI shielding and the slab reinforcement pushed the Level 1 interiors at least 41 days. Tallis knows it. Let's just get it on paper.

Marcus
""",
    type='EMAIL', relevance='strong', designation='produce',
    dates=[('November 29', None, 'Notice deadline, written without a year, so the tool cannot place it on the chronology')],
    passages=['We blew the 21-day window on Change Order 14.'],
    facts="Brightwater's own PM admits the notice under s.15.1.2 was late. This hurts our client but is not privileged: no lawyer is involved. It must be produced.",
    judgment='Harmful to the client but not privileged. Produce it. Withholding it would be improper.',
    tool_note="The email's sent date is in RFC format (19 Dec 2024), which the date pattern does not read. November 29 has no year, so neither date reaches the chronology.",
    hot=True)

doc('2024-12-20 Brightwater Request for Time Extension - CO 14.pdf', 'pdf', """
BRIGHTWATER BUILDERS, INC.
2250 Nolensville Pike, Nashville, Tennessee 37211

December 20, 2024

Ms. Dana Whitcomb
Vice President, Development
Tallis Development Group, LLC

Ms. Evelyn Rowe, AIA
Lindqvist Rowe Architects, PLLC

Re: Harpeth Ridge Medical Office Building - Request for Extension of Contract Time, Change Order 14

Dear Ms. Whitcomb and Ms. Rowe:

Brightwater Builders requests an extension of the Contract Time of forty-one (41) calendar days arising from Change Order 14 (Level 1 imaging suite redesign), issued November 8, 2024.

The redesign required RF shielding revisions, slab reinforcement between grid lines B-3 and C-5, and a new quench pipe route. The enclosed time impact analysis shows the Level 1 interiors path became critical on 11/25/2024 and that the redesigned work added 41 calendar days to that path. We request that the date of Substantial Completion be adjusted from June 30, 2025 to August 10, 2025.

Sincerely,

Marcus Oyelaran
Project Manager
Brightwater Builders, Inc.

Enclosure: Time Impact Analysis TIA-03
""",
    type='LETTER', relevance='strong', designation='produce',
    dates=[('December 20, 2024', '2024-12-20', 'Extension request sent, 42 days after Change Order 14'),
           ('November 8, 2024', '2024-11-08', 'Change Order 14 issued'),
           ('11/25/2024', '2024-11-25', 'Level 1 interiors became critical'),
           ('June 30, 2025', '2025-06-30', 'Original Substantial Completion date'),
           ('August 10, 2025', '2025-08-10', 'Requested adjusted Substantial Completion date')],
    passages=['extension of the Contract Time of forty-one (41) calendar days'],
    facts='The request for 41 days was sent December 20, 2024, which is 42 days after Change Order 14 and 21 days past the deadline.',
    hot=True)

doc('2025-01-10 Lindqvist Rowe - extension request untimely.eml', 'eml', """
From: Evelyn Rowe <erowe@lindqvistrowe.com>
To: Marcus Oyelaran <moyelaran@brightwaterbuilders.com>
Cc: Dana Whitcomb <dwhitcomb@tallisdev.com>
Date: Fri, 10 Jan 2025 10:15:37 -0600
Subject: RE: Harpeth Ridge - Request for Extension, CO 14

Marcus,

We have reviewed Brightwater's request dated December 20, 2024 for a 41-day extension of the Contract Time.

The request was received 42 days after issuance of Change Order 14 on November 8, 2024, beyond the 21-day period in Section 15.1.2 of the Agreement. On the Owner's instruction we are unable to recommend any adjustment to the Contract Time. The date of Substantial Completion remains June 30, 2025.

This is without prejudice to the merits of the time impact analysis, which we have not evaluated.

Evelyn Rowe, AIA
Principal, Lindqvist Rowe Architects, PLLC
""",
    type='EMAIL', relevance='strong', designation='produce',
    dates=[('December 20, 2024', '2024-12-20', 'Extension request'),
           ('November 8, 2024', '2024-11-08', 'Change Order 14 issued'),
           ('June 30, 2025', '2025-06-30', 'Substantial Completion date unchanged')],
    passages=['beyond the 21-day period in Section 15.1.2 of the Agreement'],
    facts='The Architect rejected the extension as untimely, not on its merits.',
    hot=True)

# ---------------------------------------------------------------------------
# THE DUCTWORK
# ---------------------------------------------------------------------------

doc('2025-01-28 RFI-087 - Substitution request 22 ga supply trunks.pdf', 'pdf', """
REQUEST FOR INFORMATION
RFI No. 087

Project: Harpeth Ridge Medical Office Building
Date Submitted: 01/28/2025
From: Tomasz Wierzbicki, Keystone Mechanical Services, LLC (via Brightwater Builders)
To: Lindqvist Rowe Architects, PLLC
Specification Section: 23 31 13 - Metal Ducts
Drawing Reference: M-301, M-302 (Level 3)

Question:
20 gauge galvanized coil for the Level 3 supply trunks is backordered approximately six weeks from our supplier. Keystone requests approval to substitute 22 gauge galvanized with additional transverse reinforcement at 48 inches on center. Please advise.

Response (Lindqvist Rowe Architects, 01/31/2025):
REJECTED. The substitution is not accepted. Supply trunks serving Levels 2 through 4 carry static pressures up to 4 inches w.c. and must be 20 gauge minimum per Specification 23 31 13, Table 2. Provide specified material. Coordinate schedule impact through the Contractor.

Evelyn Rowe, AIA
""",
    type='REPORT', relevance='strong', designation='produce',
    dates=[('01/28/2025', '2025-01-28', 'RFI-087 submitted'),
           ('01/31/2025', '2025-01-31', 'Architect rejects the 22 ga substitution')],
    passages=['REJECTED. The substitution is not accepted.'],
    facts="Keystone asked to use 22 gauge. The Architect rejected it on January 31, 2025, three days before Keystone installed it anyway.",
    tool_note='Contains neither email headers nor letter conventions, so the tool may label it REPORT or DOCUMENT. Both are acceptable.',
    hot=True)

doc('2025-02-03 Carranza to Haldane - L3 supply trunks.eml', 'eml', """
From: Luis Carranza <lcarranza@keystonemech.com>
To: Rick Haldane <rhaldane@brightwaterbuilders.com>
Date: Mon, 3 Feb 2025 16:42:10 -0600
Subject: L3 supply trunks

Rick - heads up. We ran 22 gauge on the Level 3 supply trunks today because the 20 gauge is still backordered six weeks. Tomasz said keep moving and we would swap it after inspection if anybody made an issue of it. East wing is hung, west wing tomorrow.

Luis Carranza
Foreman, Keystone Mechanical
""",
    type='EMAIL', relevance='possible', designation='produce',
    passages=['We ran 22 gauge on the Level 3 supply trunks today because the 20 gauge is still backordered six weeks.'],
    facts="Keystone's foreman tells Brightwater's superintendent in writing that 22 gauge was installed, after the Architect's rejection on January 31, 2025. This supports Brightwater's claim against Keystone. It also shows Brightwater knew on the day.",
    tool_note='FINDING: one of the two most important documents in the case screens only POSSIBLE. It names parties but uses none of the key terms ("supply trunks" and "22 gauge", not "ductwork"). Keyword screening under-ranks it; the attorney has to catch it. Also, the sent date is only in the RFC header and the body says "today", so the chronology gets no date from this email. A real reviewer would date it February 3, 2025.',
    hot=True)

doc('2025-02-03 Haldane to Carranza - RE L3 supply trunks.eml', 'eml', """
From: Rick Haldane <rhaldane@brightwaterbuilders.com>
To: Luis Carranza <lcarranza@keystonemech.com>
Date: Mon, 3 Feb 2025 18:05:51 -0600
Subject: RE: L3 supply trunks

Understood. Don't hold up the ceiling grid on 3. Get me a substitution submittal on the gauge so we have paper on it.

Rick
""",
    type='EMAIL', relevance='possible', designation='produce',
    passages=["Don't hold up the ceiling grid on 3."],
    facts="Brightwater's superintendent did not stop the nonconforming installation. This is harmful to the client and must be produced.",
    judgment='Harmful to the client but not privileged. Produce it.',
    tool_note='Screens only POSSIBLE: parties, no key term. The body is short, so it may appear under "Very short documents". It is a complete email, not a failed export.',
    hot=True)

doc('2025-02-18 Text messages - Carranza to Haldane.txt', 'txt', """
2/18/25 3:12 PM  Luis: duct on 3 closed up. cx pressure test tmrw 8am
""",
    type='DOCUMENT', relevance='none', designation='produce',
    dates=[('2/18/25', '2025-02-18', 'Level 3 ductwork closed up')],
    facts='A short text-message export. It names Carranza only as "Luis", so it hits no listed party.',
    tool_note='Under 200 characters: expect the "Very short documents" advisory. It hits no party and no key term exactly ("duct" is not "ductwork"), so screening may show NO MATCH. That is a known limit of exact keyword screening, and the reason every result is a queue for a human.')

doc('2025-02-19 Meridian Cx - Duct pressure test report Level 3.pdf', 'pdf', """
MERIDIAN COMMISSIONING GROUP
Independent Commissioning Authority

DUCT LEAKAGE AND PRESSURE TEST REPORT
Project: Harpeth Ridge Medical Office Building
Test Date: February 19, 2025
Area: Level 3, supply trunks SA-3E and SA-3W
Witnessed by: Rick Haldane (Brightwater Builders), Luis Carranza (Keystone Mechanical)

Result: FAIL

1. Test pressure 4.0 in. w.c. Leakage measured at 11.8 CFM per 100 sq ft against an allowable 6.0 CFM per 100 sq ft (SMACNA Seal Class A).
2. Visible deflection (oil-canning) of the trunk walls on both runs at test pressure.
3. Gauge verified by micrometer at six locations: 0.0336 in. average thickness. This corresponds to 22 gauge galvanized. Specification 23 31 13 requires 20 gauge minimum (0.0396 in.).

Conclusion: The Level 3 supply ductwork does not conform to the Contract Documents. Removal and replacement with specified material is recommended before ceilings are closed.

Hannah Brook, PE
Commissioning Authority
""",
    type='REPORT', relevance='strong', designation='produce',
    dates=[('February 19, 2025', '2025-02-19', 'Level 3 ductwork fails the pressure test')],
    passages=['This corresponds to 22 gauge galvanized.',
              'The Level 3 supply ductwork does not conform to the Contract Documents.'],
    facts='An independent test confirms 22 gauge (0.0336 in.) against the required 20 gauge (0.0396 in.), with leakage of 11.8 against 6.0 CFM allowed.',
    hot=True)

doc('2025-02-19 Site sign-in sheet (scan).pdf', 'pdf_scan', """
HARPETH RIDGE MOB - DAILY SITE SIGN-IN
Date: 2/19/2025
Name / Company / Time In / Time Out
Hannah Brook / Meridian Cx / 7:48 / 12:10
Luis Carranza / Keystone / 6:55 / 3:30
""",
    type='DOCUMENT', relevance='strong', designation='produce', integrity='needs_ocr',
    facts='Scanned sign-in sheet with no text layer.',
    tool_note='Expect the "Scanned image with no text layer" hold.')

doc('2025-02-20 Voicemail transcript - Whitcomb.txt', 'empty', '',
    type='DOCUMENT', relevance='none', designation='produce', integrity='empty',
    facts='A voicemail transcription that exported as an empty file.',
    tool_note='Expect the "No readable text" hold. Re-export from the phone system.')

doc('2025-02-21 Whitcomb - Notice of Defective Work.eml', 'eml', """
From: Dana Whitcomb <dwhitcomb@tallisdev.com>
To: Marcus Oyelaran <moyelaran@brightwaterbuilders.com>
Cc: Evelyn Rowe <erowe@lindqvistrowe.com>
Date: Fri, 21 Feb 2025 09:02:44 -0600
Subject: Harpeth Ridge - Notice of Defective Work, Level 3 ductwork

Marcus,

Tallis gives notice under Section 12.2 of the General Conditions that the Level 3 supply ductwork is defective and nonconforming, as documented in the Meridian Commissioning report dated February 19, 2025. Brightwater is directed to remove and replace the nonconforming ductwork at no cost to the Owner.

Tallis reserves all rights, including the right to assess liquidated damages if Substantial Completion is delayed as a result.

Dana Whitcomb
Vice President, Development
Tallis Development Group, LLC
""",
    type='EMAIL', relevance='strong', designation='produce',
    dates=[('February 19, 2025', '2025-02-19', 'Commissioning report referenced')],
    passages=['Brightwater is directed to remove and replace the nonconforming ductwork at no cost to the Owner.'],
    facts='The Owner formally rejects the Level 3 ductwork and reserves liquidated damages.')

doc('2025-02-21 Whitcomb - RE Notice of Defective Work (reply chain).eml', 'eml', """
From: Marcus Oyelaran <moyelaran@brightwaterbuilders.com>
To: Dana Whitcomb <dwhitcomb@tallisdev.com>
Cc: Evelyn Rowe <erowe@lindqvistrowe.com>
Date: Fri, 21 Feb 2025 15:31:09 -0600
Subject: RE: Harpeth Ridge - Notice of Defective Work, Level 3 ductwork

Dana,

Acknowledged. Keystone will remove and replace the Level 3 supply trunks with 20 gauge material. Replacement coil is on order and we expect delivery the first week of March. We will provide a recovery schedule by 02/28/2025.

Marcus

-----Original Message-----
From: Dana Whitcomb
Sent: Friday, February 21, 2025 9:02 AM
Subject: Harpeth Ridge - Notice of Defective Work, Level 3 ductwork

Tallis gives notice under Section 12.2 of the General Conditions that the Level 3 supply ductwork is defective and nonconforming, as documented in the Meridian Commissioning report dated February 19, 2025. Brightwater is directed to remove and replace the nonconforming ductwork at no cost to the Owner.
""",
    type='EMAIL', relevance='strong', designation='produce',
    dates=[('02/28/2025', '2025-02-28', 'Recovery schedule promised'),
           ('February 21, 2025', '2025-02-21', 'Quoted original notice'),
           ('February 19, 2025', '2025-02-19', 'Commissioning report referenced')],
    facts='A near-duplicate of the Notice of Defective Work: the same notice with a reply on top.',
    tool_note='A near-duplicate, not an exact one. The content hash differs, so it must be ingested as its own document and must not be skipped.')

doc('2025-02-24 Recorded interview - Luis Carranza (QA).txt', 'txt', """
BRIGHTWATER BUILDERS, INC. - QUALITY ASSURANCE
Transcript of recorded interview of Luis Carranza, Foreman, Keystone Mechanical Services, LLC
Date: February 24, 2025
Interviewer: Nora Feld, Quality Assurance Manager, Brightwater Builders
Location: Harpeth Ridge site office

Q. Mr. Carranza, what gauge was installed on the Level 3 supply trunks?
A. Twenty-two. Everything on three was twenty-two.

Q. Did you know the RFI asking to use twenty-two had been rejected?
A. Tomasz told me on the Friday before that the architect said no. He said the coil was six weeks out and we could not sit that long.

Q. Did anyone at Brightwater know?
A. I emailed Rick the day we hung it. He said not to hold up the grid.

Q. Was any substitution submittal ever sent?
A. Not that I know of.

Q. When did you start hanging the Level 3 trunks?
A. Monday, February 3, 2025. East wing first.

[End of interview. Duration 14 minutes.]
""",
    type='TRANSCRIPT', relevance='strong', designation='produce',
    dates=[('February 24, 2025', '2025-02-24', 'QA interview'),
           ('February 3, 2025', '2025-02-03', 'Level 3 trunks installed')],
    passages=['Tomasz told me on the Friday before that the architect said no.'],
    facts="Keystone's foreman confirms the installation was deliberate and that Keystone's PM knew of the rejection. Brightwater's QA interview was not directed by counsel, so it is not work product.",
    judgment='An internal QA interview not conducted at the direction of counsel is not work product. Produce it.',
    hot=True)

doc('2025-03-03 Keystone position letter - installed per submittals.docx', 'docx', """
KEYSTONE MECHANICAL SERVICES, LLC
880 Space Park North, Goodlettsville, Tennessee 37072

March 3, 2025

Mr. Marcus Oyelaran
Brightwater Builders, Inc.

Re: Harpeth Ridge Medical Office Building - Level 3 Supply Ductwork

Dear Marcus:

Keystone disputes any suggestion that it is responsible for the cost of replacing the Level 3 supply ductwork. All ductwork on the Project was installed in accordance with approved submittals and with the knowledge and acceptance of Brightwater's field staff. Keystone's supply of 20 gauge coil was delayed by a nationwide shortage beyond its control.

Keystone will perform the replacement work under protest and reserves its right to payment for that work.

Sincerely,

Tomasz Wierzbicki
Project Manager
Keystone Mechanical Services, LLC
""",
    type='LETTER', relevance='strong', designation='produce',
    dates=[('March 3, 2025', '2025-03-03', 'Keystone position letter')],
    passages=['All ductwork on the Project was installed in accordance with approved submittals'],
    facts='Keystone claims it followed approved submittals. The RFI-087 rejection, the Carranza email of February 3 and the QA interview all contradict this.',
    hot=True)

doc('2025-03-04 Ashdown Air Components - dispatch confirmation.eml', 'eml', """
From: Oliver Pennington <o.pennington@ashdownair.co.uk>
To: Tomasz Wierzbicki <twierzbicki@keystonemech.com>
Date: Tue, 25 Feb 2025 11:20:03 +0000
Subject: Order AAC-55821 - 20 gauge spiral fittings for Harpeth Ridge

Dear Tomasz,

Further to your call, your order AAC-55821 (20 gauge galvanised spiral fittings and couplings, 312 pieces) will be dispatched from Sheffield on 04/03/2025 by air freight, arriving Nashville within five working days.

Kind regards,

Oliver Pennington
Export Sales, Ashdown Air Components Ltd
""",
    type='EMAIL', relevance='strong', designation='produce',
    dates=[('04/03/2025', '2025-03-04', 'A UK sender means 4 March 2025, written day-first')],
    facts='A UK supplier writes dates day first: 04/03/2025 is 4 March 2025. The Keystone and Harpeth Ridge references make it LIKELY.',
    tool_note='KNOWN LIMITATION TO CHECK: the tool reads numeric dates month first (US), so it will place this on April 3, 2025, a month late. A correct chronology would show March 4, 2025.')

doc('2025-03-11 Keystone remediation proposal - Level 3 ductwork.pdf', 'pdf', """
KEYSTONE MECHANICAL SERVICES, LLC
PROPOSAL / CHANGE REQUEST KMS-CR-019

Date: March 11, 2025
To: Brightwater Builders, Inc.
Project: Harpeth Ridge Medical Office Building - Job 24-117

Scope: Remove and dispose of Level 3 supply trunks SA-3E and SA-3W (22 gauge). Furnish and install 20 gauge galvanized supply trunks with sealing to SMACNA Class A. Remove and reinstall affected ceiling grid, sprinkler drops and light fixtures. Re-test with Commissioning Authority.

Labor                               $268,940.00
Material (20 ga coil and fittings)   $97,210.00
Equipment and lifts                  $18,600.00
Ceiling and trade coordination       $27,630.00
TOTAL                               $412,380.00

Duration: 21 working days from receipt of material.
Keystone submits this proposal under protest and reserves all rights.
""",
    type='DOCUMENT', relevance='strong', designation='produce',
    dates=[('March 11, 2025', '2025-03-11', 'Keystone remediation proposal')],
    passages=['TOTAL                               $412,380.00'],
    facts='Replacing the Level 3 ductwork costs $412,380.00 over 21 working days.',
    tool_note='A proposal, not an invoice: it has no "amount due", "bill to" or "remit to". The tool may call it DOCUMENT or REPORT. Check the $412,380.00 figure is not split at the decimal.',
    hot=True)

doc('2025-03-12 Oyelaran to Wierzbicki - tender of defense (cc counsel).eml', 'eml', """
From: Marcus Oyelaran <moyelaran@brightwaterbuilders.com>
To: Tomasz Wierzbicki <twierzbicki@keystonemech.com>
Cc: Stephen Mabry <smabry@mabrycolquitt.com>
Date: Wed, 12 Mar 2025 14:10:22 -0500
Subject: Harpeth Ridge - Demand for indemnity and tender, Level 3 ductwork

Tomasz,

Under Sections 4 and 5 of the Subcontract dated April 22, 2024, Brightwater tenders to Keystone the defense of Tallis's claim concerning the Level 3 supply ductwork and demands indemnity for all resulting costs, including any liquidated damages assessed by Tallis that are attributable to the replacement work.

Keystone is to proceed with the replacement immediately. Brightwater rejects the position in your letter of March 3, 2025.

Marcus Oyelaran
Brightwater Builders, Inc.
""",
    type='EMAIL', relevance='strong', designation='produce',
    dates=[('April 22, 2024', '2024-04-22', 'Subcontract date referenced'),
           ('March 3, 2025', '2025-03-03', 'Keystone letter referenced')],
    facts='Our lawyer is copied, but this is a business communication with an adverse third party and asks for no legal advice.',
    judgment="TRAP: copying counsel does not make a communication privileged. It was sent to Keystone, a third party with adverse interests. Produce it.")

doc('2025-03-14 Oyelaran to Mabry - notice deadline question.eml', 'eml', """
From: Marcus Oyelaran <moyelaran@brightwaterbuilders.com>
To: Stephen Mabry <smabry@mabrycolquitt.com>
Date: Fri, 14 Mar 2025 08:37:15 -0500
Subject: Privileged & Confidential - Harpeth Ridge time claim

Stephen,

Privileged and confidential. Requesting legal advice.

Our extension request on Change Order 14 went out December 20, 2024, which I understand is past the 21-day notice window in Section 15.1.2. Is there any argument that the notice requirement was waived, given that Tallis's own redesign caused the delay and Dana Whitcomb acknowledged the MRI impact in the OAC meeting on December 4, 2024? What exposure do we have to liquidated damages if the time claim is barred?

Marcus
""",
    type='EMAIL', relevance='strong', designation='withhold', basis='Attorney-Client',
    description='Email from client project manager to outside counsel requesting legal advice on contractual notice requirements and liquidated damages exposure.',
    dates=[('December 20, 2024', '2024-12-20', 'Extension request'),
           ('December 4, 2024', '2024-12-04', 'OAC meeting referenced')],
    facts='A request for legal advice from the client to its outside counsel.',
    tool_note='After it is withheld, it must not reach Stage 04, Stage 05 or the brief, and it must appear on the privilege log with its basis and description.')

doc('2025-03-17 Mabry to Oyelaran - advice re Section 15.1.2.eml', 'eml', """
From: Stephen Mabry <smabry@mabrycolquitt.com>
To: Marcus Oyelaran <moyelaran@brightwaterbuilders.com>
Date: Mon, 17 Mar 2025 16:55:48 -0500
Subject: RE: Privileged & Confidential - Harpeth Ridge time claim

ATTORNEY-CLIENT PRIVILEGED COMMUNICATION

Marcus,

Tennessee courts generally enforce contractual notice provisions, but an owner's actual knowledge of the delay and its conduct can support a waiver or estoppel argument. The December 4, 2024 OAC minutes are helpful if they show Tallis acknowledging the MRI impact. We should not concede the 41 days are barred. Please preserve all OAC minutes, daily reports and the TIA native files.

On exposure: if the time claim fails, liquidated damages run from June 30, 2025 at $2,500 per day.

Stephen Mabry
Mabry & Colquitt LLP
""",
    type='EMAIL', relevance='strong', designation='withhold', basis='Attorney-Client',
    description='Email from outside counsel to client providing legal advice on waiver of contractual notice and liquidated damages exposure.',
    dates=[('December 4, 2024', '2024-12-04', 'OAC meeting referenced'),
           ('June 30, 2025', '2025-06-30', 'Substantial Completion date')],
    facts="Outside counsel's legal advice.")

doc('2025-03-18 Oyelaran FW Mabry advice to Wierzbicki.eml', 'eml', """
From: Marcus Oyelaran <moyelaran@brightwaterbuilders.com>
To: Tomasz Wierzbicki <twierzbicki@keystonemech.com>
Date: Tue, 18 Mar 2025 07:12:30 -0500
Subject: FW: RE: Privileged & Confidential - Harpeth Ridge time claim

Tomasz - see below from our lawyer. We think we can beat the notice issue with Tallis, so keep the Level 3 replacement moving and do not put anything in writing about the gauge.

-----Forwarded message-----
From: Stephen Mabry
Sent: Monday, March 17, 2025 4:55 PM
Subject: RE: Privileged & Confidential - Harpeth Ridge time claim

Tennessee courts generally enforce contractual notice provisions, but an owner's actual knowledge of the delay and its conduct can support a waiver or estoppel argument. We should not concede the 41 days are barred.
""",
    type='EMAIL', relevance='strong', designation='produce',
    dates=[('March 17, 2025', '2025-03-17', "Counsel's advice forwarded")],
    facts="Our PM forwarded counsel's advice to Keystone, a third party whose interests are adverse. Voluntary disclosure to a third party generally waives privilege over what was disclosed.",
    judgment='TRAP: the "Privileged & Confidential" subject line does not control. Privilege was probably waived by forwarding to Keystone. Expected call: produce it, and escalate to the supervising attorney because of the subject-matter waiver risk.')

doc('2025-04-02 Mabry memo - delay exposure analysis.docx', 'docx', """
MABRY & COLQUITT LLP
PRIVILEGED AND CONFIDENTIAL - ATTORNEY WORK PRODUCT
PREPARED IN ANTICIPATION OF LITIGATION

MEMORANDUM

To: File - Brightwater Builders / Harpeth Ridge
From: Stephen Mabry
Date: April 2, 2025
Re: Delay exposure and allocation to Keystone

1. Brightwater's 41-day time claim for Change Order 14 was noticed 21 days late. Our best argument is waiver by conduct: Tallis's development VP acknowledged the MRI impact at the December 4, 2024 OAC meeting.

2. If the notice defense fails, projected liquidated damages depend on the actual Substantial Completion date. At the current recovery forecast of mid-September 2025, exposure is roughly 70 to 80 days at $2,500 per day.

3. The Level 3 ductwork replacement ($412,380.00 per Keystone's proposal) should be allocated to Keystone under Subcontract Sections 4 and 5. Weakness: the February 3 email shows our superintendent knew of the substitution and told Keystone not to hold up the ceiling grid.

4. Recommend early mediation with Tallis and a tender to Keystone's insurer.
""",
    type='REPORT', relevance='strong', designation='withhold', basis='Work Product',
    description="Outside counsel's memorandum prepared in anticipation of litigation analyzing delay exposure and allocation of remediation costs.",
    dates=[('April 2, 2025', '2025-04-02', 'Counsel memo'),
           ('December 4, 2024', '2024-12-04', 'OAC meeting referenced')],
    facts="Counsel's mental impressions, prepared in anticipation of litigation.")

doc('2025-06-30 Oyelaran - schedule status internal.eml', 'eml', """
From: Marcus Oyelaran <moyelaran@brightwaterbuilders.com>
To: Gregory Tate <gtate@brightwaterbuilders.com>
Cc: Rick Haldane <rhaldane@brightwaterbuilders.com>
Date: Mon, 30 Jun 2025 19:20:14 -0500
Subject: Harpeth Ridge - where we are

Greg,

Today was the contract substantial completion date and we are not close. Realistic forecast is the second week of September. Roughly 41 days of the slip is the MRI redesign and roughly 30 is the Level 3 duct replacement. Tallis will assess liquidated damages at $2,500 a day and take it out of retainage.

Marcus
""",
    type='EMAIL', relevance='strong', designation='produce',
    passages=['Roughly 41 days of the slip is the MRI redesign and roughly 30 is the Level 3 duct replacement.'],
    facts="Brightwater's internal split of the delay: about 41 days from Change Order 14 and about 30 from the duct replacement.",
    tool_note='No date in the body in a readable format ("Today"), so the chronology gets nothing from it.',
    hot=True)

doc('2025-09-12 Certificate of Substantial Completion.pdf', 'pdf', """
CERTIFICATE OF SUBSTANTIAL COMPLETION

Project: Harpeth Ridge Medical Office Building, Franklin, Tennessee
Owner: Tallis Development Group, LLC
Contractor: Brightwater Builders, Inc.
Architect: Lindqvist Rowe Architects, PLLC
Contract date: March 15, 2024

The Work has been reviewed and found, to the Architect's best knowledge, information and belief, to be substantially complete. Substantial Completion is the stage in the progress of the Work when the Work is sufficiently complete in accordance with the Contract Documents so that the Owner can occupy or utilize the Work for its intended use.

DATE OF SUBSTANTIAL COMPLETION: September 12, 2025

A list of items to be completed or corrected (punch list) is attached. The Contractor shall complete the punch list within 45 days.

ARCHITECT: Evelyn Rowe, AIA          Date: 09/12/2025
CONTRACTOR: Marcus Oyelaran          Date: 09/12/2025
OWNER: Dana Whitcomb                 Date: 09/15/2025
""",
    type='DOCUMENT', relevance='strong', designation='produce',
    dates=[('March 15, 2024', '2024-03-15', 'Contract date'),
           ('September 12, 2025', '2025-09-12', 'Actual Substantial Completion: 74 days after June 30, 2025'),
           ('09/12/2025', '2025-09-12', 'Architect and contractor signatures'),
           ('09/15/2025', '2025-09-15', 'Owner signature')],
    passages=['DATE OF SUBSTANTIAL COMPLETION: September 12, 2025'],
    facts='Actual Substantial Completion was September 12, 2025, which is 74 calendar days after June 30, 2025.',
    hot=True)

doc('2025-09-26 Tallis - Notice of Liquidated Damages.pdf', 'pdf', """
TALLIS DEVELOPMENT GROUP, LLC
410 Cool Springs Boulevard, Suite 300, Franklin, Tennessee 37067

September 26, 2025

Mr. Gregory Tate, President
Brightwater Builders, Inc.

Re: Harpeth Ridge Medical Office Building - Assessment of Liquidated Damages

Dear Mr. Tate:

Substantial Completion was required by June 30, 2025 and was achieved on September 12, 2025, a delay of seventy-four (74) calendar days. No extension of the Contract Time was granted.

Under Section 3.4 of the Agreement, Tallis assesses liquidated damages of $2,500.00 per day for 74 days, a total of $185,000.00, which Tallis will withhold from retainage presently held in the amount of $742,500.00.

Tallis further reserves its claim for the cost of its consultants' time associated with the Level 3 ductwork.

Sincerely,

Dana Whitcomb
Vice President, Development
""",
    type='LETTER', relevance='strong', designation='produce',
    dates=[('September 26, 2025', '2025-09-26', 'Liquidated damages assessed'),
           ('June 30, 2025', '2025-06-30', 'Required Substantial Completion'),
           ('September 12, 2025', '2025-09-12', 'Actual Substantial Completion')],
    passages=['a total of $185,000.00, which Tallis will withhold from retainage'],
    facts='74 days x $2,500 = $185,000.00, withheld from $742,500.00 retainage (5% of $14,850,000).',
    hot=True)

doc('2025-10-06 Ekwueme to Mabry - settlement authority.eml', 'eml', """
From: Janet Ekwueme <jekwueme@brightwaterbuilders.com>
To: Stephen Mabry <smabry@mabrycolquitt.com>
Cc: Gregory Tate <gtate@brightwaterbuilders.com>
Date: Mon, 6 Oct 2025 12:03:40 -0500
Subject: Privileged - Harpeth Ridge mediation authority

Stephen,

Privileged and confidential, for the purpose of obtaining your advice before the mediation on October 21, 2025.

Greg and I have discussed authority. We would accept a release of retainage less $92,500.00, half of the liquidated damages assessed, and we want your view on whether to condition any deal on Tallis dropping the consultant-cost claim. Please also advise whether to bring Keystone into the mediation.

Janet Ekwueme
Chief Financial Officer, Brightwater Builders, Inc.
""",
    type='EMAIL', relevance='strong', designation='withhold', basis='Attorney-Client',
    description="Email from client CFO to outside counsel requesting legal advice on mediation strategy and settlement authority.",
    dates=[('October 21, 2025', '2025-10-21', 'Mediation date')],
    facts='A request for legal advice on settlement authority. Privileged.')

# ---------------------------------------------------------------------------
# REDACTION CANDIDATES (produce with redactions)
# ---------------------------------------------------------------------------

doc('2025-02-07 Keystone certified payroll WE 02-07-2025.csv', 'csv', """
Employee,SSN,Classification,Hours Mon,Hours Tue,Hours Wed,Hours Thu,Hours Fri,Rate,Gross,Project,Week Ending
Luis Carranza,412-55-8830,Sheet Metal Foreman,10,10,10,10,8,$41.50,$1992.00,Harpeth Ridge,02/07/2025
Andre Whitfield,408-71-2294,Sheet Metal Journeyman,10,10,10,10,8,$36.25,$1740.00,Harpeth Ridge,02/07/2025
Maria Delacroix,229-60-1175,Sheet Metal Journeyman,10,10,10,10,8,$36.25,$1740.00,Harpeth Ridge,02/07/2025
Devon Pruitt,413-02-6658,Apprentice 3rd Yr,10,10,10,10,8,$24.80,$1190.40,Harpeth Ridge,02/07/2025
Samuel Otieno,587-44-0912,Apprentice 2nd Yr,10,10,10,10,8,$21.60,$1036.80,Harpeth Ridge,02/07/2025
Kyle Brandt,409-38-7741,Laborer,10,10,10,10,8,$19.75,$948.00,Harpeth Ridge,02/07/2025
""",
    type='LEDGER', relevance='strong', designation='redact', basis='Other',
    description='Certified payroll produced with employee Social Security numbers redacted (personal identifying information).',
    dates=[('02/07/2025', '2025-02-07', 'Week ending, repeated on each of 6 rows')],
    facts="Proves Keystone's sheet-metal crew was on the Harpeth Ridge job the week the 22 gauge went up. Contains six workers' SSNs.",
    judgment='Produce with the SSN column redacted. Basis "Other", with a description.',
    tool_note="The chronology will count 6 dated events (one per row), all 2/7/2025. That is correct behaviour but noisy.")

doc('2025-10-15 Pay Application No. 18 with wire instructions.pdf', 'pdf', """
APPLICATION AND CERTIFICATE FOR PAYMENT
Application No. 18          Period To: 09/30/2025
Project: Harpeth Ridge Medical Office Building
To Owner: Tallis Development Group, LLC
From Contractor: Brightwater Builders, Inc.

1. Original Contract Sum                          $14,850,000.00
2. Net change by Change Orders                       $699,305.00
3. Contract Sum to date                           $15,549,305.00
4. Total completed and stored to date             $15,549,305.00
5. Retainage (5%)                                    $777,465.25
6. Total earned less retainage                    $14,771,839.75
7. Less previous certificates for payment         $14,628,112.50
8. CURRENT PAYMENT DUE                               $143,727.25

REMITTANCE - WIRE INSTRUCTIONS
Bank: First Cumberland Bank, Nashville, TN
ABA Routing No.: 064000017
Account Name: Brightwater Builders, Inc. - Operating
Account No.: 7730041189256

Certified by Architect: Evelyn Rowe, AIA, Lindqvist Rowe Architects, 10/15/2025
""",
    type='INVOICE', relevance='strong', designation='redact', basis='Other',
    description='Pay application produced with bank routing and account numbers redacted (confidential financial account information).',
    dates=[('09/30/2025', '2025-09-30', 'Period end'), ('10/15/2025', '2025-10-15', 'Architect certification')],
    passages=['5. Retainage (5%)                                    $777,465.25'],
    facts='Retainage held at $777,465.25 on the adjusted contract sum. It contains bank account and routing numbers.',
    judgment='Produce with the wire block redacted. Basis "Other", with a description.',
    tool_note='A pay application has no "invoice" or "amount due" wording. It reads "CURRENT PAYMENT DUE", so the tool may not label it INVOICE. Note what it shows.')

# ---------------------------------------------------------------------------
# DATA FORMATS
# ---------------------------------------------------------------------------

doc('Schedule - Harpeth Ridge baseline vs actual (P6 export).csv', 'csv', """
Activity ID,Activity Name,Baseline Start,Baseline Finish,Actual Start,Actual Finish,Responsible
A1000,Notice to Proceed,2024-04-01,2024-04-01,2024-04-01,2024-04-01,Tallis
A1200,Foundations,2024-04-15,2024-06-14,2024-04-16,2024-06-21,Brightwater
A2000,Structural steel erection,2024-06-17,2024-08-30,2024-06-24,2024-09-06,Brightwater
A3100,Level 1 imaging suite rough-in,2024-10-14,2024-12-20,2024-11-25,2025-02-28,Brightwater
A3400,Level 3 supply ductwork,2025-01-20,2025-02-21,2025-02-03,2025-02-14,Keystone
A3410,Level 3 ductwork remove and replace,,,2025-03-10,2025-04-08,Keystone
A5000,Ceilings Level 3,2025-02-24,2025-03-21,2025-04-10,2025-05-09,Brightwater
A8000,Commissioning and TAB,2025-05-19,2025-06-20,2025-07-28,2025-08-29,Keystone
A9000,Substantial Completion,2025-06-30,2025-06-30,2025-09-12,2025-09-12,Brightwater
""",
    type='LEDGER', relevance='strong', designation='produce',
    dates=[('2025-06-30', '2025-06-30', 'Baseline Substantial Completion'),
           ('2025-09-12', '2025-09-12', 'Actual Substantial Completion'),
           ('2025-03-10', '2025-03-10', 'Duct remove and replace starts'),
           ('2025-04-08', '2025-04-08', 'Duct remove and replace finishes')],
    facts='The schedule shows Level 1 imaging rough-in slipped from a 12/20/2024 finish to 2/28/2025, the Level 3 duct replacement ran 3/10/2025 to 4/8/2025, and Substantial Completion moved from 2025-06-30 to 2025-09-12.',
    tool_note='ISO dates. The chronology should gain 34 dated events from this file (4 date columns x 9 rows, less the 2 blank baseline cells for the replacement activity).')

doc('Project directory - Harpeth Ridge.json', 'json', """
{
  "project": "Harpeth Ridge Medical Office Building",
  "job_number": "24-117",
  "contacts": [
    {"name": "Dana Whitcomb", "company": "Tallis Development Group, LLC", "role": "Owner's Representative", "email": "dwhitcomb@tallisdev.com"},
    {"name": "Evelyn Rowe", "company": "Lindqvist Rowe Architects, PLLC", "role": "Architect of Record", "email": "erowe@lindqvistrowe.com"},
    {"name": "Marcus Oyelaran", "company": "Brightwater Builders, Inc.", "role": "Project Manager", "email": "moyelaran@brightwaterbuilders.com"},
    {"name": "Rick Haldane", "company": "Brightwater Builders, Inc.", "role": "Superintendent", "email": "rhaldane@brightwaterbuilders.com"},
    {"name": "Tomasz Wierzbicki", "company": "Keystone Mechanical Services, LLC", "role": "HVAC Project Manager", "email": "twierzbicki@keystonemech.com"},
    {"name": "Luis Carranza", "company": "Keystone Mechanical Services, LLC", "role": "Sheet Metal Foreman", "email": "lcarranza@keystonemech.com"},
    {"name": "Hannah Brook", "company": "Meridian Commissioning Group", "role": "Commissioning Authority", "email": "hbrook@meridiancx.com"}
  ]
}
""",
    type='DATA', relevance='strong', designation='produce',
    facts='A contact directory with no dates.',
    tool_note='No date: expect the "No date found" advisory. It is still production-ready.')

doc('Punch list - Level 3 (walk with Architect).md', 'md', """
# Harpeth Ridge MOB - Level 3 Punch List

Walked with Evelyn Rowe (Lindqvist Rowe) and Rick Haldane (Brightwater).

| Item | Location | Description | Responsible |
|---|---|---|---|
| 3-001 | Rm 312 | Ceiling tile stained at supply diffuser | Brightwater |
| 3-002 | Corridor 3E | Access panel missing at fire damper | Keystone |
| 3-003 | Rm 318 | Diffuser not balanced, low airflow | Keystone |
| 3-004 | Rm 322 | Paint touch-up at door frame | Brightwater |
| 3-005 | Mech 3W | Duct insulation torn at elbow | Keystone |
| 3-006 | Rm 330 | Thermostat not labeled | Keystone |
""",
    type='DOCUMENT', relevance='strong', designation='produce',
    facts='An undated punch list for Level 3.',
    tool_note='No date: expect the "No date found" advisory. The title names Harpeth Ridge and the table names Brightwater and Keystone, so screening shows LIKELY. With no dates, the relevant-period test does not apply.')

# ---------------------------------------------------------------------------
# INGEST AND INTEGRITY TRAPS
# ---------------------------------------------------------------------------

doc('Keystone delay notice (legacy export, Windows-1252).txt', 'cp1252', """
KEYSTONE MECHANICAL SERVICES, LLC – NOTICE OF DELAY

Date: January 24, 2025
To: Brightwater Builders, Inc. – Harpeth Ridge (Job 24-117)

Keystone gives notice that delivery of 20 gauge galvanized coil for the Level 3 supply ductwork has been delayed by the mill. Our supplier’s revised date is “early March.” Keystone requests that Brightwater advise whether the Architect will accept an alternate gauge.

Tomasz Wierzbicki – Project Manager
""",
    type='LETTER', relevance='strong', designation='produce', integrity='corrupt',
    facts="An export in Windows-1252 whose curly quotes and dashes don't survive a UTF-8 read. Keystone gave written notice of the coil delay on January 24, 2025.",
    tool_note='Expect the "Corrupted character encoding" hold. Re-export as UTF-8.')

doc('2025-01-15 Daily Field Report No. 196 (date typo).txt', 'txt', """
BRIGHTWATER BUILDERS, INC.
DAILY FIELD REPORT

Project: Harpeth Ridge Medical Office Building - Job No. 24-117
Report No. 196                     Date: 01/15/2025
Superintendent: Rick Haldane
Weather: 29 F, clear, wind N 8 mph. Work day: Yes

MANPOWER
Brightwater Builders ........ 7
Keystone Mechanical ......... 9
Cumberland Electric ......... 8
Volunteer Drywall ........... 12

WORK PERFORMED
- Keystone Mechanical hanging main supply ductwork, Level 2 west wing.
- Drywall hanging Level 2 corridors.
- Electrical rough-in Level 3.

INSPECTIONS
- Level 2 above-ceiling inspection requested. Next inspection scheduled 02/30/2025 per county portal.

DELAYS / ISSUES
- Keystone reports 20 ga coil for Level 3 still on backorder.

Rick Haldane, Superintendent
""",
    type='REPORT', relevance='strong', designation='produce',
    dates=[('01/15/2025', '2025-01-15', 'Report date'),
           ('02/30/2025', None, 'IMPOSSIBLE DATE: February has no 30th. It must NOT appear on the chronology.')],
    facts='A routine daily report containing a typo date that cannot exist.',
    tool_note='Check that 02/30/2025 is rejected and not rolled over to March 2, 2025. Exactly 1 dated event is expected from this file.')

doc('2022-08-09 Prequalification questionnaire - Tallis Belle Meade.pdf', 'pdf', """
CONTRACTOR PREQUALIFICATION QUESTIONNAIRE
Owner: Tallis Development Group, LLC
Project: Belle Meade Surgical Pavilion
Submitted by: Brightwater Builders, Inc.
Date: August 9, 2022

1. Years in business under current name: 23
2. Bonding capacity: single project $40,000,000; aggregate $120,000,000
3. Largest healthcare project completed in last five years: Rivergate Outpatient Center, $22.4 million, completed 06/30/2021
4. Has the firm been assessed liquidated damages in the last five years? No.
5. Typical retainage terms accepted: 5% reducing to 2.5% at 50% completion.
6. Safety: EMR 0.71 (2021), 0.74 (2020)

Certified true and correct: Gregory Tate, President, on 08/09/2022.
""",
    responsive='Attorney call',
    type='DOCUMENT', relevance='out_of_period', designation='produce',
    dates=[('August 9, 2022', '2022-08-09', 'Prequalification date (outside the period)'),
           ('06/30/2021', '2021-06-30', 'Prior project completion (outside the period)'),
           ('08/09/2022', '2022-08-09', 'Certification (outside the period)')],
    facts="A 2022 prequalification for a different Tallis project. It names the parties and uses \"liquidated damages\" and \"retainage\", but every date is before the period.",
    judgment='Arguably relevant background: Brightwater represented it had never been assessed liquidated damages. The attorney decides. The tool should only flag it as OUT OF PERIOD, not exclude it.')

doc('2024-12-11 Brightwater holiday party invitation.eml', 'eml', """
From: Brightwater Builders HR <hr@brightwaterbuilders.com>
To: All Staff <allstaff@brightwaterbuilders.com>
Date: Wed, 11 Dec 2024 09:00:00 -0600
Subject: You're invited - Brightwater Holiday Party

Join us Friday, December 20, 2024 at 6:30 PM at the Hermitage Hotel ballroom to celebrate another great year at Brightwater. Spouses and partners welcome. RSVP to HR by December 13, 2024.
""",
    responsive='No',
    type='EMAIL', relevance='possible', designation='produce',
    dates=[('December 20, 2024', '2024-12-20', 'Party date'), ('December 13, 2024', '2024-12-13', 'RSVP date')],
    facts='Not responsive in substance. It names the client only.',
    judgment='Screening shows POSSIBLE (names a party, no key term). An attorney would likely deselect it as non-responsive. It shows why a party match alone is not relevance.',
    tool_note='The party date (December 20, 2024) lands on the chronology next to the real December 20 extension request. That is correct extraction, but it adds noise to the chronology.')

doc('Manufacturer data sheet - galvanized duct gauges.pdf', 'pdf', """
GALVANIZED STEEL DUCTWORK - GAUGE SELECTION GUIDE
Publication DS-114, Rev. C

Rectangular ductwork, galvanized G60 coating. Minimum gauge by duct width and static pressure class:

Duct width 31-54 in., 2 in. w.c. class: 24 gauge (0.0276 in.)
Duct width 31-54 in., 3 in. w.c. class: 22 gauge (0.0336 in.)
Duct width 31-54 in., 4 in. w.c. class: 20 gauge (0.0396 in.)
Duct width 55-84 in., 4 in. w.c. class: 18 gauge (0.0516 in.)

Reinforcement spacing per SMACNA HVAC Duct Construction Standards. Consult the project specification, which governs where more stringent.
""",
    type='DOCUMENT', relevance='possible', designation='produce',
    facts='A generic industry data sheet. It confirms that 4 in. w.c. ductwork needs 20 gauge (0.0396 in.) and that 0.0336 in. is 22 gauge.',
    tool_note='It hits the key term "ductwork" but names no party, so screening shows POSSIBLE. No date: expect the "No date found" advisory.')

doc('2025-05-05 Nashville construction market newsletter.eml', 'eml', """
From: Middle Tennessee Builders Exchange <news@mtbuildersexchange.org>
To: members@mtbuildersexchange.org
Date: Mon, 5 May 2025 06:00:00 -0500
Subject: Market Watch - May 2025

Spring bid activity across the region rose eleven percent over last year, led by multifamily and data center work in Rutherford and Wilson counties. Steel mill lead times have eased to roughly eight weeks. Our annual golf scramble is June 12, 2025 at Hermitage Golf Course; foursomes are filling quickly.
""",
    responsive='No',
    type='EMAIL', relevance='none', designation='produce',
    dates=[('June 12, 2025', '2025-06-12', 'Golf scramble (irrelevant)')],
    facts='A trade newsletter. No party, no key term, not responsive.',
    judgment='Screening shows NO MATCH. An attorney would deselect it. It is general construction vocabulary, so the cohesion check may or may not treat it as foreign. Record what happens.')

# ---------------------------------------------------------------------------
# DOCUMENTS FROM ANOTHER CLIENT (misfiled by the firm's records department)
# ---------------------------------------------------------------------------

doc('Hollis v. Crane Property - demand letter re security deposit.docx', 'docx', """
MABRY & COLQUITT LLP

February 11, 2025

Crane Property Management
1717 West End Avenue
Nashville, Tennessee 37203

Re: Tenant Beverly Hollis, Unit 4B, Sylvan Heights Apartments

Dear Property Manager:

This firm represents Beverly Hollis, your former tenant. Ms. Hollis vacated Unit 4B on December 31, 2024 and provided a forwarding address. More than thirty days have passed and you have neither returned her security deposit of $1,850.00 nor provided an itemized statement of deductions.

Please return the full deposit within ten days. Our client is prepared to pursue statutory remedies, including her attorney's fees, if the deposit is not returned.

Very truly yours,

Caroline Voss
Mabry & Colquitt LLP
""",
    responsive='No - other client',
    type='LETTER', relevance='none', designation='produce', integrity='unrelated',
    dates=[('February 11, 2025', '2025-02-11', 'Other client'), ('December 31, 2024', '2024-12-31', 'Other client')],
    facts="A letter from another client's matter, misfiled into this collection.",
    judgment='INTRUDER: this must not be produced. Producing another client\'s file is a confidentiality breach. Deselect it and remove it from the collection.',
    tool_note='Expect NO MATCH at screening and "Does not appear to belong to this matter" at the readiness check.')

doc('Estate of Margaret Pruett - inventory of assets.pdf', 'pdf', """
IN THE PROBATE COURT FOR DAVIDSON COUNTY, TENNESSEE
IN RE: ESTATE OF MARGARET ANN PRUETT, Deceased
No. 24P-0932

INVENTORY OF ASSETS

The undersigned Personal Representative submits the following inventory of the assets of the decedent as of the date of death, October 17, 2024:

1. Residence at 3310 Woodmont Boulevard, Nashville (appraised)      $612,000.00
2. Checking account, Pinnacle Savings                                $18,442.19
3. Certificate of deposit, maturing 03/01/2026                       $50,000.00
4. 2019 Buick Enclave                                                $17,900.00
5. Household furnishings and jewelry                                 $9,250.00

Total                                                                 $707,592.19

Respectfully submitted, Thomas Pruett, Personal Representative
""",
    responsive='No - other client',
    type='DOCUMENT', relevance='none', designation='produce', integrity='unrelated',
    dates=[('October 17, 2024', '2024-10-17', 'Other client'), ('03/01/2026', '2026-03-01', 'Other client')],
    facts="A probate inventory from another client's matter, misfiled.",
    judgment='INTRUDER: this must not be produced.',
    tool_note='Expect NO MATCH at screening and "Does not appear to belong to this matter" at the readiness check.')

# ---------------------------------------------------------------------------
# OTHER SUBSTANTIVE DOCUMENTS
# ---------------------------------------------------------------------------

doc('2024-12-04 OAC Meeting Minutes No. 35.pdf', 'pdf', """
HARPETH RIDGE MEDICAL OFFICE BUILDING
OWNER-ARCHITECT-CONTRACTOR MEETING MINUTES - MEETING No. 35
Date: December 4, 2024    Location: Site office

Attendees: Dana Whitcomb (Tallis), Evelyn Rowe (Lindqvist Rowe), Marcus Oyelaran and Rick Haldane (Brightwater), Tomasz Wierzbicki (Keystone)

35.1 Change Order 14 - MRI suite. Shielding vendor mobilized 11/25/2024. Slab reinforcement at B-3 to C-5 complete. D. Whitcomb acknowledged that the MRI redesign "will push the Level 1 interiors" and asked Brightwater to quantify the time impact. M. Oyelaran to provide a time impact analysis.
35.2 Level 3 ductwork - Keystone reports 20 gauge coil lead time is extending. T. Wierzbicki to confirm the delivery date.
35.3 Schedule - Brightwater reports Substantial Completion forecast of June 30, 2025 is at risk pending Change Order 14 analysis.

Next meeting: December 11, 2024.
""",
    type='REPORT', relevance='strong', designation='produce',
    dates=[('December 4, 2024', '2024-12-04', 'OAC meeting 35'),
           ('11/25/2024', '2024-11-25', 'Shielding vendor mobilized'),
           ('June 30, 2025', '2025-06-30', 'Substantial Completion forecast at risk'),
           ('December 11, 2024', '2024-12-11', 'Next meeting')],
    passages=['D. Whitcomb acknowledged that the MRI redesign "will push the Level 1 interiors"'],
    facts="The Owner's representative acknowledged the Change Order 14 time impact on December 4, 2024. This is Brightwater's best evidence of waiver or actual knowledge.",
    tool_note='The key sentence starts "D. Whitcomb". Check the splitter keeps the initial and does not cut the sentence at "D."',
    hot=True)

doc('2025-02-26 OAC Meeting Minutes No. 46.pdf', 'pdf', """
HARPETH RIDGE MEDICAL OFFICE BUILDING
OWNER-ARCHITECT-CONTRACTOR MEETING MINUTES - MEETING No. 46
Date: February 26, 2025

Attendees: Dana Whitcomb (Tallis), Evelyn Rowe (Lindqvist Rowe), Marcus Oyelaran (Brightwater), Tomasz Wierzbicki (Keystone), Hannah Brook (Meridian Cx)

46.1 Level 3 ductwork - Keystone to remove and replace supply trunks SA-3E and SA-3W with 20 gauge. Material expected first week of March. Duration approximately 21 working days. Ceilings on Level 3 on hold.
46.2 Liquidated damages - D. Whitcomb stated Tallis will hold Brightwater to the June 30, 2025 date and will assess liquidated damages for any delay.
46.3 Change Order 14 - Brightwater's time request remains rejected as untimely per the Architect's letter of January 10, 2025. Brightwater reserves its position.
""",
    type='REPORT', relevance='strong', designation='produce',
    dates=[('February 26, 2025', '2025-02-26', 'OAC meeting 46'),
           ('June 30, 2025', '2025-06-30', 'Substantial Completion date'),
           ('January 10, 2025', '2025-01-10', 'Architect rejection referenced')],
    facts='The replacement plan is agreed; Tallis states it will assess liquidated damages.')

doc('2025-04-09 Meridian Cx - retest Level 3 PASS.pdf', 'pdf', """
MERIDIAN COMMISSIONING GROUP
DUCT LEAKAGE AND PRESSURE TEST REPORT - RETEST

Project: Harpeth Ridge Medical Office Building
Test Date: April 9, 2025
Area: Level 3, supply trunks SA-3E and SA-3W (replaced)

Result: PASS
Leakage 4.1 CFM per 100 sq ft at 4.0 in. w.c. (allowable 6.0). Gauge verified 0.0398 in. average (20 gauge). No visible deflection.

Hannah Brook, PE
""",
    type='REPORT', relevance='possible', designation='produce',
    dates=[('April 9, 2025', '2025-04-09', 'Replacement ductwork passes the retest')],
    facts='The replacement passed on April 9, 2025, so the duct remediation took from February 19 to April 9, 2025.',
    tool_note='Names no listed party, only "Harpeth Ridge", so screening shows POSSIBLE. "Hannah Brook" and "Meridian" are not in the party list.')

doc('2025-10-01 Keystone invoice K-2025-114 - Level 3 replacement (under protest).pdf', 'pdf', """
KEYSTONE MECHANICAL SERVICES, LLC
INVOICE No. K-2025-114

Bill To: Brightwater Builders, Inc., 2250 Nolensville Pike, Nashville, TN 37211
Project: Harpeth Ridge Medical Office Building - Job 24-117
Invoice Date: October 1, 2025      Terms: Net 30

Description: Level 3 supply ductwork removal and replacement per KMS-CR-019, performed under protest March 10, 2025 through April 8, 2025.

Amount Due: $412,380.00

Remit To: Keystone Mechanical Services, LLC, 880 Space Park North, Goodlettsville, TN 37072
""",
    type='INVOICE', relevance='strong', designation='produce',
    dates=[('October 1, 2025', '2025-10-01', 'Keystone bills the replacement'),
           ('March 10, 2025', '2025-03-10', 'Replacement starts'),
           ('April 8, 2025', '2025-04-08', 'Replacement ends')],
    passages=['Amount Due: $412,380.00'],
    facts='Keystone bills Brightwater $412,380.00 for its own rework, under protest.')

doc('2025-09-29 Oyelaran to Whitcomb - dispute of LD assessment.eml', 'eml', """
From: Marcus Oyelaran <moyelaran@brightwaterbuilders.com>
To: Dana Whitcomb <dwhitcomb@tallisdev.com>
Date: Mon, 29 Sep 2025 10:44:19 -0500
Subject: RE: Harpeth Ridge - Assessment of Liquidated Damages

Dana,

Brightwater disputes the assessment of $185,000.00 in liquidated damages. At least 41 of the 74 days resulted from Change Order 14, which Tallis directed and which you acknowledged at OAC Meeting No. 35 on December 4, 2024 would push the Level 1 interiors. Tallis had actual knowledge of the delay and was not prejudiced by the timing of our written request.

We request release of retainage in full.

Marcus Oyelaran
""",
    type='EMAIL', relevance='strong', designation='produce',
    dates=[('December 4, 2024', '2024-12-04', 'OAC meeting 35 referenced')],
    passages=['At least 41 of the 74 days resulted from Change Order 14'],
    facts="Brightwater's position: actual knowledge and no prejudice.")
