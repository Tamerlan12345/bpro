# Deployment Instructions for Render.com

Hello! The error you are seeing on your Render deployment (`Error: ... must be set as environment variables`) is expected and is a sign that the application is now secure. It means the server is correctly waiting for you to provide the secret keys.

Please follow these two steps to fix the deployment. This is a one-time setup.

---

### Step 1: Double-Check Environment Variable Names

In your service's dashboard on **Render.com**, go to the **"Environment"** section.

Please verify that you have added variables with these **exact** names. A small typo (like a missing underscore) will cause the error.

*   `SUPABASE_URL`
*   `SUPABASE_SERVICE_KEY`
*   `SESSION_SECRET`
*   `GOOGLE_API_KEY`

---

### Step 2: Manually Restart the Deployment

Sometimes, a server needs a manual trigger to load new environment variables.

In your Render dashboard, please find and click the **"Manual Deploy"** or **"Restart Service"** button. This will force your application to restart and use the new keys you have added.

---

One of these two steps will very likely solve the problem. If you have done both and the error persists, please let me know.
