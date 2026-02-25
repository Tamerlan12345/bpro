# Testini Journal 🛡️

## 2024-05-22 — [API Crash/Logic Error]

**Problem:** The endpoint `POST /api/chats/:id/transcription` crashed with a 500 Internal Server Error when performing a partial update (sending only a subset of fields). This occurred because the PostgreSQL client (`pg`) throws an error when query parameters are `undefined`. The code destructured `req.body` but passed `undefined` variables directly to the parameterized query, expecting `COALESCE` to handle them.

**Solution:** Changed the query parameters to default to `null` if they are `undefined` (using `?? null`). This allows `COALESCE` in the SQL query to function as intended: preserving the existing value in the database when a field is missing from the request.

**Reference:**
- Test: `backend/tests/transcription_data_save.test.js`
- Fix: `backend/server.js`
