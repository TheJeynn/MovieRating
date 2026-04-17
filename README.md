# MovieRating Platform

MovieRating is a modern movie and TV discovery application built with ASP.NET Core Web API and Vanilla JavaScript. It uses the TMDB API to surface trending content, search titles, collect user ratings, and provide watch suggestions through a clean dark-themed interface.

## Features

- Browse trending movies and TV shows in real time from TMDB
- Explore popular movies, series, genres, and top-rated content
- Search titles instantly from the interface
- Rate movies and TV shows and update ratings later
- Get personalized recommendations based on selected genres
- View watch provider information when available
- Load database migrations automatically on startup
- Keep secrets out of source control with a local `.env` file

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | .NET 8, ASP.NET Core Web API, C# |
| Frontend | HTML5, CSS3, JavaScript (ES6+) |
| Database | Microsoft SQL Server |
| External API | TMDB (The Movie Database) |

## Project Structure

```text
MovieRating/
|- Controllers/
|- Data/
|- DTOs/
|- Migrations/
|- Models/
|- Services/
|- wwwroot/
|  |- index.html
|  |- script.js
|  |- style.css
|- Program.cs
|- MovieRating.csproj
```

## Prerequisites

Before running the project, make sure you have:

- .NET 8 SDK
- SQL Server
- A TMDB API key

Docker-based SQL Server also works well if you prefer running the database in a container.

## Environment Setup

Create a `.env` file in the project root, next to `MovieRating.csproj`.

Example:

```env
TMDB_KEY=your_api_key_here
DB_CONNECTION=Server=localhost;Database=MovieDb;User Id=sa;Password=YourPassword;TrustServerCertificate=True
```

Important:

- Do not commit `.env` to GitHub
- The file should stay local to your machine
- The project already loads it automatically at startup

## Running the Application

You can run the project with either Visual Studio or the .NET CLI.
Also you need to setup 'Docker Desktop' to access Database

### Option 1: Visual Studio

1. Open the solution in Visual Studio.
2. Set the `https` or `http` launch profile.
3. Press `F5` or click `Start`.

### Option 2: .NET CLI

Run the following from the project directory:

```bash
dotnet restore
dotnet run
```

## Local URLs

Based on the current launch settings, the application runs on:

- `https://localhost:7025`
- `http://localhost:5128`

The frontend is served directly from `wwwroot`, so you can open the app from the same project URL in your browser. You do not need to launch `index.html` separately when the API is running.

If Swagger is enabled in development, you can also access:

- `https://localhost:7025/swagger`
- `http://localhost:5128/swagger`

## Database Behavior

Entity Framework Core migrations are applied automatically on startup. When the application launches successfully, it creates or updates the database schema without requiring a separate migration command.

This means:

- the `MovieDb` database is created if it does not exist
- the `Ratings` table and later schema updates are applied automatically

## Security Notes

This project uses a manual `.env` loader in `Program.cs` so sensitive values such as API keys and database credentials are not hardcoded in source files.

Security best practices for this project:

- keep `.env` local only
- avoid committing secrets to GitHub
- prefer user secrets or environment variables in shared environments

## Notes

- The TMDB API key is required for content, metadata, ratings lookup, and recommendations
- SQL Server must be reachable through the connection string you provide
- If the app starts but content does not load, check both your TMDB key and database connection settings

## License

This project is for educational and personal development use unless you define a different license for your repository.
