# Stage 1: Build the React frontend
FROM node:20-alpine AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the ASP.NET Core backend
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build-backend
WORKDIR /app/backend
COPY backend/*.csproj ./
RUN dotnet restore
COPY backend/ ./
# Copy built React files into wwwroot so ASP.NET Core can serve them
COPY --from=build-frontend /app/frontend/dist ./wwwroot
RUN dotnet publish -c Release -o out

# Stage 3: Final runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Install ExifTool (system dependency) for Debian-based dotnet image
RUN apt-get update && apt-get install -y \
    libimage-exiftool-perl \
    tesseract-ocr \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build-backend /app/backend/out ./

# Expose port (Render sets PORT env variable dynamically, ASP.NET Core listens on it)
# We can tell ASP.NET to listen on port 8080 by default
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# Run the backend
ENTRYPOINT ["dotnet", "MetaDetective.Api.dll"]
