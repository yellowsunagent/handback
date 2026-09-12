# HandBack

An iOS-first, local tool-loan tracker. Record what you lent or borrowed without an account or another person's participation. Each phone maintains its own records; QR codes transfer an initial copy, and later changes never synchronize.

## Development

```bash
cd app
npm ci
npm run typecheck
npm test
npm run check:config
npm start
```

Use Node 22.18+ (or Node 24+) for the built-in TypeScript test runner. The app uses Expo SDK 54 and React Native 0.81. The native minimum is iOS 15.1. Check on physical iPhones before relying on real data.

Use an iOS native development build with the declared modules. `npm run ios` requires full Xcode, its simulator tools, and the usual local signing configuration for a physical device. A current Expo Go installation is not a verified distribution method for this SDK and dependency set. No hosted build, paid developer account, external upload, TestFlight distribution, or App Store publication has been performed or authorized by this implementation.

## Manual-first walkthrough

1. Enter your display name on first launch.
2. Add a tool you own. Give it a name; notes and a photo are optional.
3. Record “I lent this,” select or add a borrower, and save. It is outstanding immediately, even if the borrower has no app.
4. Add someone else's tool and its owner, then record “I borrowed this.” It appears separately from your own tools.
5. Inspect outstanding loans. Correct a mistake, mark a loan returned, inspect history, and undo a return. A conflicting active loan prevents undo.
6. Optionally show a saved owner-side loan's QR code. On another iPhone, scan, review, and save a copy. Scanning again opens the existing local record without overwriting changes.
7. In Settings, export a backup through the share sheet. Choose a destination such as Files. Restore validates and previews a chosen backup, offers export of current data, then requires explicit replacement confirmation.

People with the same name remain distinct. Use their distinguishing notes to tell them apart. Changing your name does not change identity. Archiving hides records from future selection while retaining readable history. The app never imports contacts.

## Data and recovery

State format 2 stores a local profile ID, people, tools, and loans. Active tool status is derived from loans. Writes are serialized and replace one validated JSON snapshot, so a loan and its tool do not require separate writes. Failed reads show an error rather than resetting data.

Legacy timestamp dates become calendar days in the device’s local time zone at migration. Legacy name-based data is migrated conservatively: the original version 1 storage is retained, and ambiguous ownership, repeated nonlocal names across independent records, or inconsistent records block migration instead of guessing. Preserve the installation when migration fails; do not delete app storage to work around an error.

Backups are versioned, self-contained JSON containing state and embedded base64 photo assets. Photos support JPEG, PNG, and WebP, up to 10 MiB each and 50 MiB total; the picker enforces the total so new records remain exportable. No remote service or ZIP dependency is required. Import validates the format, identities, relationships, dates, active-loan constraints, and asset references before staging photos. Replacement is a single state write after confirmation. Photos copied during staging do not overwrite current photos. Backup merging and automatic recovery are outside scope. Export may contain private notes and photos; choose its destination yourself. Canceling the system share sheet does not mean a backup was saved.

## Dates and reminders

Loan dates are calendar days (`YYYY-MM-DD`), displayed without converting them to UTC timestamps. Due day is still “due”; overdue begins the next local calendar day. Undated loans have neither overdue status nor a due reminder.

Optional local reminders are scheduled at 9 a.m. on the due day. If that time has passed, no catch-up notification is sent. iOS uses a calendar trigger without a fixed time-zone override; schedules are also reconciled when the app returns to the foreground, after changes, and after restore. Returning or deleting cancels reminders, and undo rebuilds the applicable schedule. Permission denial leaves tracking available. Notification failures are reported separately from committed records and can be retried. Device delivery and time-zone changes still require physical-iPhone verification.

## Verification and pilot gates

See [PRD.md](PRD.md) for the acceptance criteria and [IMPLEMENTATION.md](IMPLEMENTATION.md) for the implementation record and actual check results. Automated tests exercise public state, persistence, transfer, date, reminder, and backup boundaries. They do not establish successful native device behavior.

Before the real-data pilot, complete every physical-iPhone scenario in PRD section 10, including two-device QR, denied permissions, restart/update preservation, share cancellation, and photo backup restoration. The 30-day friends pilot and public release preparation remain separate milestones. Collect pilot counts and feedback manually; there is no analytics service.
