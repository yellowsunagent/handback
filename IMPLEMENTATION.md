# HandBack implementation plan

Spec: PRD.md. Review baseline: 87aa583859f0184282a3710f06552bf77606ef4d.

1. Implement version 2 data with stable person identities, validated domain commands, serialized whole-dataset persistence, and conservative legacy migration. Derive active tool status from loans rather than duplicating a pointer.
2. Build initial setup, people and inventory editing/archives, independent manual loan creation, corrections, return/undo/delete, outstanding and history views.
3. Add validated optional QR copies, calendar dates, local reminders, optional photos and user-initiated outreach.
4. Add versioned self-contained JSON backup with embedded photo assets, validation before replacement, export-first restore confirmation, and notification reconciliation.
5. Run focused checks throughout; finish full suite, TypeScript, bundle validation and separate standards/spec reviews. Commit locally on current branch. No push or publication.

Test boundaries are those specified by PRD section 10: identity and loan transitions through public domain/store operations; QR parsing/import; calendar-day and reminder scheduling; backup validation/export/restore. Use Node's built-in test runner and the existing TypeScript compiler, without adding a test framework.

Native dependencies await owner approval. Physical iPhone checks, distribution and the real-data pilot are not implied by successful automated checks. Preserve unrelated untracked AGENTS.md and .DS_Store.

## Native implementation decisions

- Approved in this task: add SDK 54-compatible expo-camera, expo-image-picker, expo-file-system, expo-document-picker, expo-sharing and expo-notifications; remove expo-barcode-scanner.
- Keep AsyncStorage and one validated dataset per write. No account, backend, remote push registration or analytics.
- Photo references use `handback-photo:<filename>` under the app documents directory, resolved at runtime so a changed iOS container path does not invalidate new photos. Supported imports are JPEG, PNG and WebP; decoding is checked before accepting a restored asset.
- Native validation target: iOS 15.1+ (React Native 0.81 native minimum). Local native development builds are the initial verification/distribution route; signing/device provisioning and actual friends distribution remain unexecuted. No cloud build or new spending is authorized.
- Reminder past-time policy: omit a reminder if 9 a.m. has passed, retaining in-app due/overdue status. iOS calendar triggers use local calendar components; foreground reconciliation refreshes scheduling after device changes.
- Native API references: [Expo notifications](https://docs.expo.dev/versions/v54.0.0/sdk/notifications/), [file storage](https://docs.expo.dev/versions/v54.0.0/sdk/filesystem-legacy/), and [photo picker](https://docs.expo.dev/versions/v54.0.0/sdk/imagepicker/).

## Environment checks

- Locked dependency restore initially failed inside the restricted network sandbox; retry with approved network access succeeded.
- Expo public configuration resolves after replacing the scanner plugin.
- This Mac currently points to Command Line Tools, and `xcrun simctl` is unavailable. Native simulator and physical-iPhone execution cannot be claimed here.
- Installation audit: 34 advisories (2 critical, 16 high, 15 moderate, 1 low), including transitive shell-quote and tar. No broad upgrade or `npm audit fix` was performed. Dependency remediation is a separate approval/release gate.
- Native introspection verified camera usage copy and the absence of microphone usage and APNs entitlements. Expo's notification plugin adds APNs by default; the local-only plugin removes it. Its first position is intentional because Expo executes this entitlement mod after the later registered mod.

- Native app identifier: `com.jasoncjordan.handback`, configured locally only; no Apple identifier registration or signing changes have been made.
- Portable backup schema: `{version: 1, kind: "handback-backup", state: <v2 state>, assets: {<tool ID>: {base64, mimeType}}}`. In the backup, tool photos use `asset:<tool ID>`; staged local photos use generated app-relative filenames. Limits: 10 MiB per photo, 50 MiB total photos, 100 MiB JSON. New photo selections enforce the total export budget.
