# Compliance Documentation

## GDPR Compliance

### Overview

MatchPlay implements technical measures to comply with the General Data Protection Regulation (GDPR) for EU/EEA users and the California Consumer Privacy Act (CCPA) for California residents.

### Implemented Features

#### 1. Cookie Consent
- **Component**: `src/components/CookieConsent.tsx`
- Displays consent banner on first visit
- Records consent choice to `consent_records` table for audit trail
- Respects user's choice (accept/decline)
- Links to full Privacy Policy

#### 2. Privacy Policy
- **Page**: `/privacy` (`src/pages/Privacy.tsx`)
- Documents all data collection practices
- Lists legal bases for processing (GDPR Article 6)
- Explains user rights under GDPR and CCPA
- Details data retention policies
- Provides contact information for privacy inquiries

#### 3. Data Export (Right to Portability)
- **Edge Function**: `supabase/functions/export-user-data/index.ts`
- **UI**: Profile → Privacy tab
- Exports all user data in JSON format:
  - Profile information
  - Private profile data
  - Account balance
  - Transaction history
  - Match participations
  - Scores
  - Ratings
  - Favorite courses
  - Consent records
  - Matches created

#### 4. Account Deletion (Right to Erasure)
- **UI**: Profile → Privacy tab
- **Database Table**: `account_deletion_requests`
- Users can request account deletion
- 30-day processing window
- Admin review before permanent deletion
- Option to provide feedback

#### 5. Consent Records
- **Database Table**: `consent_records`
- Tracks all consent decisions:
  - Cookie consent
  - Data export requests
  - Deletion requests
  - Marketing preferences
- Includes metadata (user agent, timestamp, policy version)

### Data Flow

```
User Action → Consent Recorded → Database Audit Trail
     ↓
Cookie Accept → localStorage + consent_records
Data Export → export-user-data function → JSON download
Deletion Request → account_deletion_requests → Admin review
```

### Database Tables

```sql
-- Consent records for audit trail
consent_records (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  consent_type TEXT NOT NULL, -- 'cookie', 'marketing', 'data_export', etc.
  consented BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  version TEXT,
  created_at TIMESTAMPTZ
)

-- Account deletion requests
account_deletion_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'cancelled'
  requested_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  processed_by UUID
)
```

### Admin Responsibilities

1. **Process deletion requests within 30 days**
2. **Maintain consent records** for legal compliance
3. **Review and update Privacy Policy** when processing changes
4. **Respond to data access requests** via privacy@match-play.co

---

## US Skill-Based Competition Legal Framework

### ⚠️ LEGAL DISCLAIMER

**This documentation is for informational purposes only and does not constitute legal advice. Consult with qualified legal counsel before operating in any jurisdiction.**

### Platform Classification

MatchPlay is designed as a **skill-based competition platform** where:
- Outcomes are determined by player skill, not chance
- Entry fees fund prize pools
- Golf is a recognized game of skill

### Terminology Strategy

**Always Use:**
- Skill-based competition
- Competitive gaming
- Entry fees and prizes
- Prize pools
- Competitive matches

**Never Use:**
- Gambling / wagering
- Money matches
- Bets
- Deposits (use "funds" or "balance")
- Winnings (use "prizes" or "earnings")

### Legal Considerations by State

Golf competition with entry fees may be regulated differently across US states. Key considerations:

1. **Skill vs. Chance**: Golf is predominantly skill-based
2. **House Edge**: Platform fee structure must be transparent
3. **Age Verification**: 18+ requirement enforced
4. **Licensing**: Some states may require gaming licenses
5. **Registration**: Some states require operator registration

### Geo-Blocking Implementation

The platform implements IP-based geo-blocking to restrict access from states with unclear regulations:

**Component**: `src/hooks/useGeoBlocking.tsx`
**UI**: `src/components/GeoBlockingOverlay.tsx`

#### Currently Blocked States

Based on legal review requirements, the following states are restricted:

| State | Code | Reason |
|-------|------|--------|
| Arizona | AZ | Strict gambling laws |
| Arkansas | AR | Restrictive regulations |
| Connecticut | CT | Unclear skill-gaming regulations |
| Delaware | DE | State-controlled gaming |
| Hawaii | HI | No legal gambling |
| Idaho | ID | Restrictive regulations |
| Iowa | IA | Strict regulations |
| Louisiana | LA | Complex gaming laws |
| Montana | MT | Restrictive regulations |
| Nevada | NV | Requires licensing |
| South Dakota | SD | Limited gaming |
| Tennessee | TN | Restrictive regulations |
| Utah | UT | No gambling allowed |
| Washington | WA | Strict regulations |

#### How It Works

1. User visits the platform
2. IP geolocation API determines user's state
3. If in blocked state, overlay blocks access
4. Session cached to avoid repeated lookups
5. Error fallback allows access (fail-open for usability)

#### Admin Configuration

The blocked states list is maintained in `src/hooks/useGeoBlocking.tsx`. Legal counsel should review and update this list as regulations change.

### Compliance Features

1. **Age Verification**: Date of birth collected at registration
2. **Geo-Blocking**: IP-based restriction for unclear jurisdictions
3. **Transparent Fees**: Platform fee clearly disclosed
4. **Skill Emphasis**: Marketing emphasizes skill-based nature
5. **Handicap System**: Creates fair competition, reinforcing skill element

### Legal Resources

- [Fantasy Sports Trade Association](https://thefsga.org/)
- State Gaming Commission contacts
- Sports law attorneys specializing in skill gaming

---

## Implementation Checklist

### GDPR Technical Compliance

- [x] Cookie consent banner with accept/decline
- [x] Privacy Policy page
- [x] Terms of Service page
- [x] Data export functionality
- [x] Account deletion request system
- [x] Consent records database
- [x] Profile data access (users can view their data)
- [x] Profile data rectification (users can edit their profile)
- [x] Admin deletion request review panel
- [ ] Data breach notification process (operational procedure needed)
- [ ] DPO appointment (if processing significant EU data)

### Operational Requirements

- [ ] Respond to data requests within 30 days
- [ ] Staff training on GDPR procedures
- [ ] Regular privacy impact assessments
- [ ] Vendor data processing agreements
- [ ] Privacy policy version control

### US Compliance

- [x] Geo-blocking for restricted states
- [x] Blocked state list with clear messaging
- [ ] State-by-state legal review
- [ ] Age verification process enhancement
- [ ] Consumer protection disclosures
- [ ] Anti-money laundering considerations
