# Security Specification — Aile Katılımlı Matematik Atölyesi Başvuru Sorgulama

## 1. Data Invariants & Master Source of Truth

1. **Split-Collection PII Isolation**:
   - `/applications/{applicationId}` is the Master Source of Truth containing sensitive PII (`phoneNormalized`, `phoneDisplay`, `parentFullName`, `studentFullName`). It is strictly restricted to verified administrators (`isAdmin()` / `isBootstrapAdmin()`). Unauthenticated users and non-admin signed-in users can NEVER `get`, `list`, `create`, `update`, or `delete` any document in `/applications`.
   - `/statusLookups/{phoneHash}` is the PII-isolated public projection keyed by the 64-character lowercase SHA-256 hex digest of the normalized phone number (`5XXXXXXXXX`). It contains zero raw phone numbers, zero email addresses, and masked display names (`parentDisplayName`, `studentFirstName`). Public visitors may ONLY perform single-document `get` requests when they supply a valid 64-char hex hash. Collection `list` is unconditionally denied (`allow list: if false;`) to prevent enumeration.
2. **Atomic Synchronization Invariant**:
   - Every `create` or `update` to `/applications/{phoneHash}` MUST atomically create or update `/statusLookups/{phoneHash}` in the same Firestore `writeBatch`, with identical `status` and `phoneHash`.
   - Every `delete` of `/applications/{phoneHash}` MUST atomically delete `/statusLookups/{phoneHash}` in the same batch.
3. **Immutable & Server-Enforced Timestamps**:
   - `createdAt` on `/applications/{phoneHash}` must equal `request.time` on `create` and must remain identical (`incoming().createdAt == existing().createdAt`) on `update`.
   - `updatedAt` on `/applications`, `/statusLookups`, and `/settings/workshop` must equal `request.time` on every write.
4. **Verified Admin Identity**:
   - Administrative privileges require `request.auth != null && request.auth.token.email_verified == true`. Unverified emails are always rejected.
   - `allow list` on `/applications` uses `isBootstrapAdmin()` without `get()`/`exists()` calls, preventing O(n) read cost amplification.
5. **Workshop Announcement Settings**:
   - `/settings/workshop` is publicly readable via single-document `get` (not `list`) so visitors see the live announcement details. Writes require verified admin status and strict schema validation.

---

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Adversarial Action / Payload | Expected Result |
|---|---------------|-------------|------------------------------|-----------------|
| 1 | **PII Enumeration (List Scraping)** | `/applications` | Unauthenticated or non-admin `list` query on `/applications` | `PERMISSION_DENIED` |
| 2 | **Public Lookup Enumeration** | `/statusLookups` | Any client (even admin) attempting `list` on `/statusLookups` | `PERMISSION_DENIED` |
| 3 | **Email Spoofing (Unverified)** | `/applications/{hash}` | Write with `email: "atillaerben@gmail.com"` and `email_verified: false` | `PERMISSION_DENIED` |
| 4 | **Shadow / Ghost Field Injection** | `/applications/{hash}` | Admin create/update adding extra key `isAdminOverride: true` | `PERMISSION_DENIED` |
| 5 | **Path ID Poisoning** | `/statusLookups/../../../evil` or 1.5KB ID | Single-doc `get` or `write` with non-64-hex document ID | `PERMISSION_DENIED` |
| 6 | **Phone Hash Mismatch** | `/applications/{hashA}` | Document body sets `phoneHash: hashB` (`hashB != applicationId`) | `PERMISSION_DENIED` |
| 7 | **Orphaned Sync Violation (Create)** | `/applications/{hash}` | Admin writes `/applications/{hash}` without atomic batch write to `/statusLookups/{hash}` | `PERMISSION_DENIED` |
| 8 | **Status Desync Attack** | `/applications/{hash}` + `/statusLookups/{hash}` | Batch writes `status: "approved"` to `/applications` but `status: "rejected"` to `/statusLookups` | `PERMISSION_DENIED` |
| 9 | **Value Poisoning (Invalid Enum / Oversized String)** | `/applications/{hash}` | Admin sets `status: "vip_hack"` or `notes: "A".repeat(2000)` | `PERMISSION_DENIED` |
| 10 | **Immutable Field Tampering** | `/applications/{hash}` | Admin update attempts to mutate `createdAt` or `phoneHash` | `PERMISSION_DENIED` |
| 11 | **Client Timestamp Forgery** | `/settings/workshop` | Admin sets `updatedAt` to a backdated client timestamp (`!= request.time`) | `PERMISSION_DENIED` |
| 12 | **Self-Assigned Admin Escalation** | `/admins/{attackerUid}` | Signed-in non-admin attempts to create `/admins/{attackerUid}` with `role: "admin"` | `PERMISSION_DENIED` |
