MovieRating Platform 🎬
A modern web application built with ASP.NET Core Web API and Vanilla JavaScript that displays trending movies and TV shows using the TMDB API. It features a secure environment variable management system and an automated database migration setup.

🚀 Key Features
Real-time Trending Data: Fetches the latest movies and series from the TMDB API.

Secure Configuration: Uses a .env file to hide sensitive API keys and Database credentials from GitHub.

Modern UI: A clean, responsive "Dark" themed interface.

Search Functionality: Instant client-side filtering to find specific titles.

Auto-Migration: Automatically sets up and updates the SQL Server database on startup.

🛠️ Tech Stack
Backend: .NET 8.0 / C#

Frontend: HTML5, CSS3, JavaScript (ES6+)

Database: Microsoft SQL Server

API: TMDB (The Movie Database)

⚙️ Setup & Installation
1. Prerequisites
.NET 8.0 SDK

SQL Server (Preferably Docker Container)

A TMDB API Key

2. Environment Configuration
Create a file named .env in the root directory of the project (next to the .csproj file). Add your credentials as follows:
TMDB_KEY=your_api_key_here
DB_CONNECTION=Server=localhost;Database=MovieDb;User Id=sa;Password=YourPassword;TrustServerCertificate=True

Note: Do not commit this file to GitHub. It is already included in .gitignore.

3. Database Update
The application is configured to apply migrations automatically. Simply run the project, and it will create the MovieDb database and Ratings table for you.

4. Running the Application
Open the solution in Visual Studio 2026.

Press F5 or click Start to launch the Web API.

The API will run at https://localhost:7025.

Open index.html in your browser (preferably via a local server or by placing it inside the wwwroot folder).

🛡️ Security Note
This project uses a manual .env loader in Program.cs to ensure that sensitive data like API Keys and Database Passwords are never hardcoded in the source code.
This makes the project safe for public repositories.
