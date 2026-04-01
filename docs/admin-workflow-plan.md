# Admin Workflow Upgrade Plan

## Goal
Turn `/assessment360` from a lightweight cycle creator into an operational admin console for managing 180° assessments.

## Phase 1 (current implementation target)
- Replace stacked cycle buttons with a structured admin table
- Add search/filter for participant, manager, title, and status
- Show richer operational status:
  - self invite status
  - manager invite status
  - self submission status
  - manager submission status
  - overall progress status
- Add quick actions:
  - open cycle
  - open report
  - copy self link
  - copy manager link
- Preserve the existing quick-create form for one-off creation

## Phase 2
- Resend self invite
- Resend manager invite
- Show invite failure details inline
- Add due date support
- Add cycle detail drawer/page with participant + invite history

## Phase 3
- Bulk CSV import
- Edit participant/manager details
- Reopen/archive cycle
- Export results

## UX Notes
- Keep report work separate; the report is already one of the strongest parts of the product
- Reduce internal/prototype wording on the admin page
- Make the admin page useful for day-to-day operations, not just testing

## Data/API notes
Current API already exposes enough to build a better table:
- `GET /api/assessment360/cycles` returns cycle rows + participant invite statuses for admins
- `GET /api/assessment360/cycles/[cycleId]` returns submissions for a cycle

Immediate backend follow-up after Phase 1:
- enrich admin list API with submission states + invite errors directly
- add resend endpoints
- add due dates and status rollups
