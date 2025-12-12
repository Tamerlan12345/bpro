FROM node:20-alpine

WORKDIR /app

# Copy package.json and yarn.lock from backend directory
COPY backend/package.json backend/yarn.lock ./

RUN yarn install --frozen-lockfile

# Copy the rest of the backend code
COPY backend/ .

EXPOSE 3000

CMD ["yarn", "start"]
