# HandBack Product Requirements

Status: Agreed product scope; source implementation completed. Device verification and the friends pilot remain pending; see IMPLEMENTATION.md for actual checks and release gates.

This document records the decisions approved in the HandBack PRD interview. It governs the iOS friends pilot and the path toward a later public release. It is not a claim that the current demo meets these requirements.

## 1. Problem and audience

Friends lend each other hand tools, power tools, and garden tools, then lose track of who has them and what needs returning. Tracking should help without making a trusted relationship feel like a formal transaction.

The initial audience is suburban dads and their existing friends and neighbors who share tools. The pilot uses the project owner's real friends. Participants are assumed to act honestly; dispute resolution and fraud handling are outside scope.

The two primary outcomes are:

- I know who has my tools.
- I know which borrowed tools I need to return.

The tool is the primary object. Each record represents an individual physical tool with a clear owner. A drill with its battery and charger may be one record with accessories described in notes.

## 2. Product and release constraints

- Build a native mobile experience, starting with iOS for the pilot. Android remains a later direction, not a pilot requirement.
- Support standalone local records with no account, login, required backend, or recurring API costs.
- Core tracking works without an internet connection. External sharing depends on the user's chosen destination.
- Participation by the other person is optional. Either the lender or borrower can record a loan independently.
- Prioritize completing a useful app with low friction and low ongoing maintenance.
- Use readiness milestones rather than a fixed deadline. New spending requires separate approval.
- Run a free friends pilot, make several rounds of improvements, then prepare for App Store submission. A one-time paid app is the intended eventual model; price is undecided.

## 3. Success criteria

During the first 30 days of the real-data pilot:

| Measure | Target |
| --- | --- |
| Participation | At least five people record real loans |
| Usage | At least ten real loans recorded collectively |
| Repeat use | At least three people record a second loan |
| Comprehension | Testers correctly identify outstanding tools without the project owner's help |

Count a real-world loan once when evaluating the ten-loan target, even if both participants save a copy. Demo or seeded records do not count. Collect pilot feedback and counts manually; these targets do not require an analytics service.

These are validation targets, not evidence of demand. Investigate missed targets and reasons for skipped logging before expanding scope.

## 4. Core journeys

### Record something I lent

1. Select or add an owned tool.
2. Select or enter the borrower.
3. Optionally set a due date and reminder.
4. Save the loan; it becomes active immediately on this phone.
5. Optionally show a QR code so the borrower can save a copy.

The borrower does not need to install HandBack, scan, or approve before the owner can track the loan.

### Record something I borrowed

1. Select or add the borrowed tool and its owner.
2. Record myself as the borrower.
3. Optionally set a due date and reminder, then save.

The owner does not need HandBack. The borrowed tool must remain clearly identified as someone else's property.

### Save a QR copy

1. The owner opens QR sharing for an already saved loan.
2. The borrower scans and reviews the loan details.
3. The borrower chooses to save the copy locally.

Saving a copy does not notify the owner. Neither phone displays a claim that the other phone has confirmed or synchronized the loan.

### Return a tool

1. Open the active loan and mark it returned.
2. Retain the completed loan in history and remove it from outstanding loans.
3. Cancel its local reminder.

Either person can do this on their own phone without approval. An accidental return can be undone, subject to the one-active-loan rule.

## 5. Functional requirements and acceptance criteria

### FR-01 — Setup and people

Ask for a display name during initial setup. Maintain a reusable local people list with a required name and optional distinguishing note. Do not request address-book access.

Acceptance criteria:

- Users can select an existing person or create one while logging a loan.
- Two people with the same name remain distinct records.
- Changing a display name does not change ownership, hide loans, or merge people.
- Archived people are hidden from future selection while historical references remain readable.

### FR-02 — Tool inventory

Require a tool name and owner. Support an optional photo and free-text notes for identifying details, brand, model, and accessories.

Acceptance criteria:

- A named tool can be saved without a photo, notes, or structured specifications.
- Ownership is clear in tool details and loan views.
- Individual tools remain distinct even when names match.
- Users can correct tool details and archive tools while retaining their history.
- A tool with an active loan cannot be archived until that loan is resolved.
- Photo permission is optional; declining it does not prevent tracking.

### FR-03 — Independent loan creation

Support both “I lent this” and “I borrowed this.” Saving creates an active local loan with its tool, owner, borrower, start information, and optional due date.

Acceptance criteria:

- Both journeys work with a person who has never installed the app.
- Saving does not depend on QR scanning or another device's response.
- Each individual tool has at most one active loan on this phone.
- A borrower cannot use the workflow to lend someone else's tool onward.
- Repeated save taps do not create duplicate loans.
- A failed save is reported without presenting a partially saved loan as successful.

### FR-04 — Outstanding loans, corrections, and history

Clearly distinguish tools I lent from tools I borrowed. Show the tool, the other person, due date when present, and overdue status.

Acceptance criteria:

- Users can inspect outstanding loans and completed history.
- Users can correct mistakes in an active loan and mark it returned locally.
- Undoing a return cannot produce two active loans for one tool; if another loan is active, explain the conflict and preserve existing records.
- Users can delete mistaken loan records after confirmation without leaving the tool incorrectly marked as loaned.
- Editing or returning a loan clearly affects only this phone.
- Archived tools and people remain identifiable in history.

### FR-05 — Optional QR transfer

QR sharing transfers initial loan details, including stable loan and tool identifiers, participant names, tool name, and loan dates. Exclude photos and private notes. QR is not a synchronization or proof-of-confirmation mechanism.

Acceptance criteria:

- Show understandable details for review before saving an imported loan.
- Import only a valid supported HandBack loan payload; invalid input leaves local data unchanged.
- Saving a valid new copy creates the necessary local references without requiring prior inventory setup.
- Re-scanning an existing loan opens that record without duplication or overwriting local changes, including an already recorded return.
- Import must preserve the one-active-loan rule and avoid merging people solely because their names match.
- Camera permission denial leaves manual recording available.
- Product copy uses language such as “Save a copy,” rather than implying mutual confirmation.
- Later changes on either phone do not propagate, including through a repeat scan.

### FR-06 — Calendar dates and local reminders

Due dates are optional calendar days, not precise return times. For a dated loan, offer a local notification at 9 a.m. on the due date. Mark the loan overdue beginning the following calendar day.

Acceptance criteria:

- An undated loan has no overdue status or scheduled due-date notification.
- A dated loan remains due, rather than overdue, throughout its due day.
- Date display preserves the chosen calendar date instead of shifting it through timestamp conversion.
- Notification permission is optional; tracking and in-app overdue status work when permission is declined.
- Returning or deleting a loan cancels its reminder. Changing its due date cancels or reschedules the reminder as appropriate.
- Undoing a return reconciles reminder state without creating duplicates.
- Local notifications concern records on this phone; they do not remotely notify a friend.

### FR-07 — User-initiated outreach

Offer a prepared reminder message through the phone's share sheet. The user chooses the destination and whether to send it.

Acceptance criteria:

- The message identifies the tool and relevant return information in plain language.
- Opening or canceling the share sheet sends nothing automatically and does not change loan status.
- No SMS API, contact import, in-app chat, or remote push service is required.

### FR-08 — Manual backup and restore

Provide a complete portable backup, including photos, before inviting friends to rely on real loan data. The user chooses where to save it; no account or cloud service is required.

Acceptance criteria:

- Export includes the local profile, people, tools, loans, history, archive state, photos, and reminder preferences needed to restore the experience.
- A restore round trip preserves identities, relationships, dates, and accessible photos.
- Validate backup format, required data, and referenced assets before replacing local records.
- Invalid or unsupported backups leave existing data intact and produce an understandable error.
- Explain that restore replaces local data; offer an export of current data before explicit replacement confirmation.
- Canceling restore preserves current records. A failed restore must not leave a partially replaced dataset.
- Reconcile local notification schedules after restore; do not assume old device notification identifiers remain usable.
- Backup merging, automatic backup, and automatic recovery are outside pilot scope.

## 6. Consistency and usability requirements

- Ownership and participant identity must not depend on display-name equality.
- Loan changes and their tool state must remain consistent through save failures and app restarts.
- Keep stored data versioned so updates and restores can validate compatibility and preserve pilot records.
- Do not silently reset real data when reading fails.
- The interface must distinguish “borrowed by me” from “available for me to lend.”
- Use plain language and readable status text; color alone must not communicate overdue state.
- Explain independent records where users share or change a loan. Do not promise agreement between phones.
- Keep raw QR payloads and developer instructions out of normal user flows.

## 7. Scope exclusions

The pilot excludes accounts, login, backend synchronization, mutual confirmation, remote push notifications, fraud or dispute handling, shared catalogs, availability browsing, borrowing requests, onward lending, multi-tool checkout, payments, chat, AI features, address-book integration, product barcode lookup, structured serial-number specifications, backup merging, and automated purchase recommendations.

Android support, public-store launch, pricing, and deeper borrowing analytics are later considerations rather than pilot acceptance requirements. Later work requires its own scope decisions.

## 8. Current implementation baseline

Baseline: repository commit `27e1033`. The following is based on source inspection, not a successful device test. The project currently uses Expo, React Native, TypeScript, React Navigation, and AsyncStorage. This PRD does not mandate a storage-library migration or authorize new dependencies.

| Area | Observed implementation | Work needed for the agreed pilot |
| --- | --- | --- |
| Profile and people | Editable name in Settings; participant matching uses names | Initial setup, stable local identity, reusable people, distinguishing notes, archive behavior |
| Tools | Add named tool owned by current display name; optional photo URI exists in the type | Other owners, photo workflow, notes, corrections, archives |
| Loan creation | StartLoan generates a QR but does not persist an owner-side loan; scanning saves a loan on the scanning phone | Immediate manual lending and borrowing workflows; optional QR after saving |
| QR | Renders and scans basic loan payloads; UI says “Confirm” | Complete validation, repeat-scan behavior, stable identity handling, independent-copy language |
| Lists and returns | Active borrowing/lending lists and mark-returned action | Correct role handling, history UI, corrections, undo, deletion, consistent writes |
| Dates | ISO timestamp presets and elapsed-time due badges | Calendar-day due dates and next-day overdue behavior |
| Reminders and outreach | No notification or share-message workflow in inspected screens | Local notification lifecycle and user-initiated share sheet |
| Persistence | Local versioned JSON; some malformed data falls back to defaults | Data-preserving failure handling, export/restore, photo portability, update compatibility |
| Verification | No test or lint scripts in package.json | Focused automated checks for state/data rules and physical-iPhone workflow verification |

The current README demo sequence assumes an owner-side result that the inspected QR creation flow does not persist. Update the demo instructions when implementing the new manual-first flow.

## 9. Delivery milestones

### M1 — Reliable manual tracking demo

Deliver setup, stable people identity, tool ownership, manual lending and borrowing, outstanding lists, corrections, returns, undo, and history. Demonstrate both journeys without the other person installing the app. Verify that records survive app restart and the one-active-loan rule holds.

### M2 — Complete pilot functionality

Deliver optional QR copies, photos and notes, archives, calendar-day due dates, local reminders, and prepared outreach. Verify QR behavior between two iPhones and notification-denied/manual-only paths.

### M3 — Real-data pilot readiness

Deliver and verify complete export/restore, including photos and notification reconciliation. Exercise invalid-backup rejection and cancellation. Verify app updates preserve records. Resolve known blockers to trustworthy tracking before friends rely on real data.

M1 and M2 may use demo data. M3 is required before the real-data pilot starts.

### M4 — Friends pilot and iteration

Run the 30-day evaluation, observe independent use, collect feedback on skipped logging and confusing states, and compare results with Section 3. Make several rounds of updates, checking data preservation on each round. Prioritize reliability and demonstrated friction over adding features.

### M5 — Public release preparation

After pilot feedback and updates, separately scope App Store readiness, distribution details, pricing, support, privacy disclosures, and current platform requirements. This document does not itself authorize publication or spending.

## 10. Verification plan

Use focused automated checks for identity, loan transitions, one-active-loan enforcement, QR validation and duplicate handling, calendar boundaries, reminder reconciliation, and backup validation/round trips. Avoid tests that merely mirror presentation code.

Before the real-data pilot, manually verify on physical iPhones:

1. Lend and borrow without another app user; restart and inspect the saved records.
2. Distinguish same-name people and rename the local user without losing loan visibility.
3. Save a QR copy on a second phone; re-scan after local edits and after returning it.
4. Return, undo, and attempt conflicting loans without corrupting state.
5. Check due-day versus next-day status and permitted/denied notifications.
6. Share and cancel a reminder message.
7. Export and restore a dataset with photos, archives, and history; reject an invalid backup without data loss.
8. Confirm testers can identify what they lent and borrowed without coaching.

Run checks appropriate to each implementation change. Document actual results and remaining limitations rather than equating source inspection with runtime validation.

## 11. Risks and remaining implementation decisions

| Risk or decision | Treatment |
| --- | --- |
| Friends skip logging because it feels awkward or takes too long | Manual recording requires only one participant; observe real use and revise friction during the pilot |
| Two phones disagree about a loan | Accepted pilot limitation; explain local-only edits and avoid synchronized-confirmation claims |
| App deletion or device loss removes records | Provide manual portable backup; recovery still depends on the user having exported one |
| Duplicate names or display-name changes misclassify loans | Use stable identity and verify rename/same-name cases |
| Reminder delivery is unavailable or disabled | Retain clear in-app dates and overdue status; test permission paths |
| QR imports and restores damage data | Validate before mutation and preserve existing state on failure |
| Expanded scope delays a usable pilot | Follow milestone gates; keep excluded features deferred |
| Market demand and willingness to pay are unknown | Treat the earlier discussion as a hypothesis, not completed market research |

Implementation must resolve and document the exact backup format, migration approach, supported iOS/device baseline, distribution method, and date/reminder behavior when scheduling time has already passed or the device changes time zone. These choices must preserve the agreed behavior; consequential scope changes return to the product owner.

## 12. Decision provenance

Source context: [OpenClaw Prebuild Research](chatgpt-conversation://69be1ff6-db68-8329-9633-6fc9baa6989b), followed by the approved 18-question PRD interview and final scope confirmation in this task.

The interview supersedes the earlier research brief where they differ: owner-only and borrower-only logging are supported; QR is optional copy transfer rather than required confirmation; records remain independent; the first pilot is iOS-only; complete manual backup/restore is required before real-data use.

The earlier conversation proposed competitor and market research but did not provide completed findings. No competitor, demand, or monetization claims are established by this PRD.
