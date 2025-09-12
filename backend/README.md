# BPro Backend Server

This is a lightweight Node.js/Express server that acts as a proxy between the BPro frontend and the Google Gemini API. Its primary purpose is to handle API requests securely, keeping the API key hidden from the client-side, and to resolve CORS issues.

## Getting Started

Follow these instructions to run the backend server locally for development or to deploy it to a production environment.

### Prerequisites

- [Node.js](https://nodejs.org/) (v14.x or later recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)

### Local Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create an environment file:**
    Copy the example environment file `.env.example` to a new file named `.env`.
    ```bash
    cp .env.example .env
    ```

4.  **Configure environment variables:**
    Open the `.env` file and add your specific configuration:
    - `FRONTEND_URL`: The URL of the frontend application that will be making requests to this server (e.g., `http://127.0.0.1:5500`).
    - `GOOGLE_API_KEY`: Your secret API key for the Google Gemini service.
    - `PORT`: (Optional) The port on which the server will run. Defaults to `3000`.

5.  **Start the server:**
    ```bash
    npm start
    ```
    The server will start, and you should see the message: `Server is running on port 3000` (or your configured port).

### Production Deployment

1.  **Deploy the `backend` folder** to any hosting provider that supports Node.js (e.g., Heroku, Vercel, DigitalOcean, AWS).

2.  **Set Environment Variables:**
    Instead of using a `.env` file, configure the following environment variables in your hosting provider's dashboard:
    - `GOOGLE_API_KEY`: Your secret Google API key.
    - `FRONTEND_URL`: The public URL of your live frontend application.
    - `PORT`: The port assigned by the hosting provider (many platforms set this automatically).

3.  **Start Command:**
    Ensure your hosting provider uses the `npm start` command to run the application. This is the default for most Node.js environments.

**Important:** Never commit your `.env` file or your `GOOGLE_API_KEY` to a Git repository. Add `.env` to your `.gitignore` file.
