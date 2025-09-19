# Deployment Instructions for Render.com

Hello! The error you are seeing on your Render deployment (`Error: ... must be set as environment variables`) is expected and is a sign that the application is now secure. It means the server is correctly waiting for you to provide the secret keys.

Please follow these two steps to fix the deployment. This is a one-time setup.

---

### Step 1: Double-Check Environment Variable Names

In your service's dashboard on **Render.com**, go to the **"Environment"** section.

Please verify that you have added variables with these **exact** names. A small typo (like a missing underscore) will cause the error.

*   `FRONTEND_URL`: The public URL of your deployed application (e.g., `https://your-app-name.onrender.com`). This is crucial for security (CORS).
*   `SUPABASE_URL`: The URL of your Supabase project.
*   `SUPABASE_SERVICE_KEY`: Your secret Supabase service role key.
*   `GOOGLE_API_KEY`: Your API key for Google Gemini.
*   `SESSION_SECRET`: A long, random string for securing sessions. You can generate one by running the following command in your terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
*   `DATABASE_URL`: The connection string for your Supabase database. Find this in your Supabase dashboard under `Settings` > `Database` > `Connection string`. This is required for persistent session storage.

---

### Step 2: Manually Restart the Deployment

Sometimes, a server needs a manual trigger to load new environment variables.

In your Render dashboard, please find and click the **"Manual Deploy"** or **"Restart Service"** button. This will force your application to restart and use the new keys you have added.

---

One of these two steps will very likely solve the problem. If you have done both and the error persists, please let me know.
