# Use official Node 20 image (Cloud Run supports it)
FROM node:20-slim

# Create app directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the files
COPY . .

# Run the script
CMD ["node", "index.js"]
