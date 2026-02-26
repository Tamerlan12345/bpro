# 🛡️ Aegis Security Journal

## 2026-02-26 — [Hardening] **Threat:** Brute Force & Unvalidated Input **Patch:** Rate Limiting + Zod Schemas **Status:** Protected

### Security Report
1.  **Title:** 🛡️ Aegis: [Security Audit/Fix] Authentication Hardening & Input Validation
2.  **Threat Rating:** High
3.  **Vulnerability:**
    *   **Brute Force:** The `/api/auth/login` and `/api/auth/chat` endpoints lacked specific rate limiting, allowing attackers to attempt unlimited password guesses (subject only to the global 100/15min limit).
    *   **Input Validation:** Critical endpoints (`/api/generate`, `/api/chats/:id/versions`, `/api/chats/:id/comments`, `/api/chats/:id/status`, `/api/auth/chat`) accepted raw `req.body` without strict schema validation, increasing the risk of unexpected payloads or DoS via large inputs.
4.  **The Fix:**
    *   **Rate Limiting:** Implemented `authLimiter` (10 requests / 15 minutes) for login and chat auth endpoints.
    *   **Input Validation:** Defined Zod schemas (`generateSchema`, `versionSchema`, `commentSchema`, `statusSchema`, `authChatSchema`) and applied `validateBody` middleware to all relevant routes.
5.  **Side Effects:**
    *   Legitimate users failing login >10 times in 15 mins will be blocked. This is a standard security trade-off.
    *   Frontend clients sending invalid data types (e.g. empty strings where prohibited) will now receive `400 Bad Request` instead of potentially `500` or undefined behavior. Verified that existing tests pass, so current frontend behavior is compatible.
