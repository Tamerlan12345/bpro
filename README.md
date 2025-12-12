# Backend Project

This repository contains the backend code for the application, built with Node.js and Express, using PostgreSQL as the database.

## Project Structure

- `backend/`: Contains the source code for the backend application.
- `Dockerfile`: The root Dockerfile for building the backend application. It copies the source code from the `backend/` directory.
- `docker-compose.yml`: Configuration for running the backend and database locally using Docker Compose.
- `backend/Dockerfile`: A Dockerfile intended for building from within the `backend/` directory context.

## Local Development

To run the application locally with Docker Compose:

```bash
docker-compose up --build
```

This will start the backend service on port 3000 and a PostgreSQL database on port 5432.

## Deployment

When deploying this application to a PaaS (Platform as a Service) like Render, Railway, DigitalOcean App Platform, etc., please ensure the following:

1. **Build Context**: Set the build context to the root of the repository (`.`).
2. **Dockerfile Path**: Set the path to `Dockerfile` (or `./Dockerfile`).
   - **Important**: Do not enter a command like `docker-compose up --build` in the "Dockerfile Path" field. The build system expects a file path, not a shell command.
3. **Environment Variables**: Ensure all required environment variables are set in your deployment platform settings (e.g., `DATABASE_URL`, `SESSION_SECRET`, `FRONTEND_URL`).

### Troubleshooting "couldn't locate the dockerfile"

If you see an error like:
`couldn't locate the dockerfile at path docker-compose up --build`

It means you have mistakenly entered `docker-compose up --build` into the "Dockerfile Path" configuration field. To fix this:
1. Go to your deployment settings.
2. Find the "Dockerfile Path" or "Build Command" section.
3. Change the "Dockerfile Path" to simply `Dockerfile`.
