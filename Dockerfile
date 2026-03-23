FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["MovieRating.csproj", "."]
RUN dotnet restore "./MovieRating.csproj"
COPY . .
WORKDIR "/src/."
RUN dotnet build "MovieRating.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "MovieRating.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MovieRating.dll"]