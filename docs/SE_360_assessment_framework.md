# Future-Ready SE 360° Assessment Framework (v1)

Built from: **Mastering Technical Sales – The Future Sales Engineer Research Report (Oct 2025)**

## 1) Purpose
A multi-rater 360 to evaluate how well an SE demonstrates the behaviors linked to high performance and future readiness.

Use for:
- Individual development plans (IDPs)
- Team capability heatmaps
- Enablement prioritization
- Benchmarking pre/post training

---

## 2) Rater Model
Recommended raters per SE:
- **Self** (1)
- **Manager** (1)
- **Peer SEs** (2)
- **Sales partner / AE** (1)
- **Customer-facing partner** (CSM/SA/PM) (1)
- **Optional customer voice** (1, if feasible)

Weighting (recommended):
- Manager: 30%
- Sales partner: 20%
- Peers: 20%
- Customer-facing partner: 15%
- Self: 10%
- Customer: 5%

---

## 3) Dimensions (mapped to research)

### D1. Curiosity, Creativity & Agility
Looks for discovery depth, problem reframing, adaptive thinking.

### D2. Business Value Discovery & Co-Creation
Links technical capability to measurable outcomes and helps design value with the customer.

### D3. Influence & Collaboration (Customer + Internal)
Orchestrates stakeholders across sales, product, success, and customer buying groups.

### D4. Executive Presence, Storytelling & Improvisation
Communicates clearly under pressure, adjusts to audience, and drives confidence.

### D5. Strategic Planning & Opportunity Thinking
Plans beyond current demo/deal; maps long-term account outcomes and stakeholders.

### D6. Ownership & Accountability
Owns outcomes, follows through, and holds teams to agreed actions.

### D7. Commercial Acumen
Understands pricing/value/risk/renewal context; contributes to business decisions.

### D8. AI Fluency + Human Trust Advantage
Uses AI to amplify preparation and insight while strengthening trust, judgment, and empathy.

---

## 4) Rating Scale (Behavior Anchors)
Use 1–5 scale + N/O (Not Observed)

- **1 – Emerging:** Inconsistent; mostly activity-oriented; needs close guidance.
- **2 – Developing:** Shows behavior occasionally; misses consistency/impact.
- **3 – Proficient:** Reliable in most situations; clear positive impact.
- **4 – Advanced:** Strong and repeatable across complex situations; influences others.
- **5 – Role Model:** Sets team standard; coaches others; drives measurable business outcomes.

---

## 5) Item Bank (24 prompts, 3 per dimension)
Raters score 1–5 + short evidence note.

### D1 Curiosity, Creativity & Agility
1. Asks probing questions that uncover root causes, not just stated requirements.
2. Reframes customer problems to reveal broader opportunities.
3. Adapts approach quickly when new information changes the context.

### D2 Business Value Discovery & Co-Creation
4. Connects technical capabilities to quantified business outcomes.
5. Co-designs success criteria with customers (not just solution fit).
6. Demonstrates value in ways that support adoption/renewal decisions.

### D3 Influence & Collaboration
7. Aligns sales, product, and success teams around a shared outcome.
8. Navigates multiple buyer personas (technical, business, finance, security).
9. Positively influences decisions without relying on formal authority.

### D4 Executive Presence & Storytelling
10. Communicates clearly and concisely for executive audiences.
11. Uses stories/examples that make complex ideas easy to understand.
12. Maintains confidence and composure when challenged; adjusts in real time.

### D5 Strategic Planning & Opportunity Thinking
13. Anticipates risks and blockers early in the sales cycle.
14. Contributes to account/opportunity planning beyond immediate technical tasks.
15. Links near-term actions to long-term customer value/expansion outcomes.

### D6 Ownership & Accountability
16. Takes ownership of commitments and follows through reliably.
17. Escalates and resolves issues proactively rather than reactively.
18. Holds self and cross-functional partners accountable for outcomes.

### D7 Commercial Acumen
19. Demonstrates understanding of commercial drivers (ROI, risk, cost, renewal).
20. Supports deal strategy with clear business and financial logic.
21. Engages comfortably in value/cost trade-off discussions.

### D8 AI Fluency + Human Trust Advantage
22. Uses AI tools effectively to improve preparation, quality, and speed.
23. Critically validates AI output before using it with customers.
24. Builds trust through empathy, judgment, and credibility in high-stakes moments.

---

## 6) Output Metrics
Per person and per team:
- Dimension means (1–5)
- Variance by rater group (e.g., self vs manager delta)
- Top 3 strengths / Top 3 growth priorities
- Trust-readiness index = avg(D2, D3, D4, D8)
- Commercial impact index = avg(D2, D5, D6, D7)

Gap flags:
- **Blind spot:** self score >= 1.0 above external average
- **Hidden strength:** self score >= 1.0 below external average
- **Critical risk:** any dimension < 2.5 external average

---

## 7) Development Linkage (example)
- Low D1/D2 → discovery & value coaching, customer problem framing drills
- Low D3/D5 → account planning routines, stakeholder mapping workshops
- Low D4 → storytelling and executive communication practice
- Low D6/D7 → commercial ownership mentoring and forecast/renewal shadowing
- Low D8 → AI workflow + trust-in-conversation coaching

---

## 8) Implementation Notes for ai-assessment-app
Suggested schema additions:
- `assessment_360_cycles` (id, org_id, subject_user_id, start_at, end_at, status)
- `assessment_360_raters` (cycle_id, rater_user_id, rater_type)
- `assessment_360_items` (id, dimension, text, order_index)
- `assessment_360_responses` (cycle_id, item_id, rater_user_id, score, evidence_note)
- `assessment_360_reports` (cycle_id, json_summary)

First release scope:
1. Static 24-item bank
2. Invite raters by role
3. Complete assessment links
4. Auto-generate summary dashboard and PDF export

---

## 9) Research anchors used
- 5 high-performing SE traits (curiosity, business impact, presence, influence, ownership)
- Future-ready skills ranking (curiosity/agility, value co-creation, influence, presentation, planning, ownership, commercial acumen)
- AI section: AI as amplifier; trust, empathy, and judgment as non-automatable differentiators

(Reference source file used: `C:\Users\berul\OneDrive\Work\Up 2 Speed\Marketing\Research Project\Report\Mastering Technical Sales - The Future Sales Engineer Research Report .docx`)
