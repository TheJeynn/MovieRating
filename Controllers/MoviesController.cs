using Microsoft.AspNetCore.Mvc;
using MovieRating.DTOs;
using MovieRating.Services;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace MovieRating.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MoviesController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly TmdbContentRatingService _contentRatingService;
        private readonly string _tmdbToken;

        public MoviesController(IHttpClientFactory httpClientFactory, TmdbContentRatingService contentRatingService)
        {
            _httpClientFactory = httpClientFactory;
            _contentRatingService = contentRatingService;
            _tmdbToken = Environment.GetEnvironmentVariable("TMDB_KEY") ?? string.Empty;
        }

        // GET: api/Movies/trending?page=1
        [HttpGet("trending")]
        public async Task<IActionResult> GetTrending([FromQuery] int page = 1, [FromQuery] bool includeContentRatings = false)
        {
            var client = GetClient();
            var data = await FetchListAsync(
                client,
                $"trending/all/day?language=en-US&page={page}",
                defaultType: null,
                includeContentRatings,
                HttpContext.RequestAborted);

            return data == null ? BadRequest("TMDB API Error") : Ok(data);
        }

        // GET: api/Movies/popular?type=movie&page=1
        [HttpGet("popular")]
        public async Task<IActionResult> GetPopular([FromQuery] string type = "movie", [FromQuery] int page = 1, [FromQuery] bool includeContentRatings = false)
        {
            var client = GetClient();
            var url = type == "tv" ? $"tv/popular?language=en-US&page={page}" : $"movie/popular?language=en-US&page={page}";
            var data = await FetchListAsync(client, url, type, includeContentRatings, HttpContext.RequestAborted);
            return data == null ? BadRequest("TMDB API Error") : Ok(data);
        }

        // GET: api/Movies/toprated?type=movie&page=1
        [HttpGet("toprated")]
        public async Task<IActionResult> GetTopRated([FromQuery] string type = "movie", [FromQuery] int page = 1, [FromQuery] bool includeContentRatings = false)
        {
            var client = GetClient();
            var url = type == "tv" ? $"tv/top_rated?language=en-US&page={page}" : $"movie/top_rated?language=en-US&page={page}";
            var data = await FetchListAsync(client, url, type, includeContentRatings, HttpContext.RequestAborted);
            return data == null ? BadRequest("TMDB API Error") : Ok(data);
        }

        // GET: api/Movies/search?query=batman&page=1
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string query, [FromQuery] int page = 1)
        {
            if (string.IsNullOrWhiteSpace(query)) return BadRequest("Query is required.");
            var client = GetClient();
            var encoded = Uri.EscapeDataString(query);
            var response = await client.GetAsync($"search/multi?query={encoded}&language=en-US&page={page}&include_adult=false");
            if (!response.IsSuccessStatusCode) return BadRequest("TMDB API Error");
            return Content(await response.Content.ReadAsStringAsync(), "application/json");
        }

        // GET: api/Movies/genres?type=movie
        [HttpGet("genres")]
        public async Task<IActionResult> GetGenres([FromQuery] string type = "movie")
        {
            var client = GetClient();
            var response = await client.GetFromJsonAsync<GenreResponse>($"genre/{type}/list?language=en-US");
            if (response == null) return NotFound("Genres not found.");
            return Ok(response.Genres);
        }

        // GET: api/Movies/discover?type=movie&genreId=28&page=1
        [HttpGet("discover")]
        public async Task<IActionResult> Discover([FromQuery] string type = "movie", [FromQuery] int? genreId = null, [FromQuery] int page = 1, [FromQuery] bool includeContentRatings = false)
        {
            var client = GetClient();
            var url = genreId.HasValue
                ? $"discover/{type}?with_genres={genreId}&language=en-US&page={page}&sort_by=popularity.desc"
                : $"{type}/popular?language=en-US&page={page}";
            var data = await FetchListAsync(client, url, type, includeContentRatings, HttpContext.RequestAborted);
            return data == null ? BadRequest("TMDB API Error") : Ok(data);
        }

        // GET: api/Movies/providers/{id}?type=movie
        [HttpGet("providers/{id}")]
        public async Task<IActionResult> GetWatchProviders(int id, [FromQuery] string type = "movie")
        {
            var client = GetClient();
            // type is "movie" or "tv"
            var t = type == "tv" ? "tv" : "movie";
            var response = await client.GetAsync($"{t}/{id}/watch/providers");

            if (!response.IsSuccessStatusCode)
                return Ok(new { providers = new List<object>(), message = "No streaming info available." });

            var data = await response.Content.ReadFromJsonAsync<WatchProvidersRoot>();

            // Try to get TR (Turkey) first, then US as fallback
            WatchProviderRegion? region = null;
            if (data?.Results != null)
            {
                data.Results.TryGetValue("TR", out region);
                if (region == null) data.Results.TryGetValue("US", out region);
                if (region == null) region = data.Results.Values.FirstOrDefault();
            }

            if (region == null)
                return Ok(new { providers = new List<object>(), message = "Not available on any known streaming platform." });

            var flatrate = region.Flatrate ?? new List<WatchProvider>();
            var free = region.Free ?? new List<WatchProvider>();
            var ads = region.Ads ?? new List<WatchProvider>();
            var rent = region.Rent ?? new List<WatchProvider>();
            var buy = region.Buy ?? new List<WatchProvider>();

            return Ok(new
            {
                flatrate = flatrate.Take(5).Select(p => new { p.ProviderName, p.LogoPath }),
                free = free.Take(5).Select(p => new { p.ProviderName, p.LogoPath }),
                ads = ads.Take(5).Select(p => new { p.ProviderName, p.LogoPath }),
                rent = rent.Take(5).Select(p => new { p.ProviderName, p.LogoPath }),
                buy = buy.Take(5).Select(p => new { p.ProviderName, p.LogoPath }),
                link = region.Link
            });
        }

        // GET: api/Movies/details/{id}?type=movie
        [HttpGet("details/{id}")]
        public async Task<IActionResult> GetDetails(int id, [FromQuery] string type = "movie")
        {
            var client = GetClient();
            var normalizedType = type == "tv" ? "tv" : "movie";
            var response = await client.GetAsync($"{normalizedType}/{id}?language=en-US&append_to_response=credits");

            if (!response.IsSuccessStatusCode)
                return BadRequest("TMDB API Error");

            var data = await response.Content.ReadFromJsonAsync<TmdbDetailResponse>();
            if (data == null)
                return NotFound("Details not found.");

            return Ok(new MovieDetailsDto
            {
                Id = data.Id,
                Title = data.Title,
                Name = data.Name,
                Overview = data.Overview,
                PosterPath = data.PosterPath,
                BackdropPath = data.BackdropPath,
                VoteAverage = data.VoteAverage,
                ReleaseDate = data.ReleaseDate,
                FirstAirDate = data.FirstAirDate,
                MediaType = normalizedType,
                Cast = BuildCastCredits(data.Credits?.Cast),
                Music = BuildCrewCredits(data.Credits?.Crew, IsMusicCredit, GetMusicPriority),
                Creators = BuildCrewCredits(data.Credits?.Crew, IsCreatorCredit, GetCreatorPriority)
            });
        }

        private HttpClient GetClient()
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                throw new InvalidOperationException("TMDB_KEY not found in environment.");
            var client = _httpClientFactory.CreateClient("TmdbClient");
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _tmdbToken);
            return client;
        }

        private async Task<TmdbRawResponse?> FetchListAsync(
            HttpClient client,
            string url,
            string? defaultType,
            bool includeContentRatings,
            CancellationToken cancellationToken)
        {
            var response = await client.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return null;

            var data = await response.Content.ReadFromJsonAsync<TmdbRawResponse>(cancellationToken: cancellationToken);
            if (data?.Results == null)
                return data;

            foreach (var item in data.Results)
            {
                if (string.IsNullOrWhiteSpace(item.MediaType) && !string.IsNullOrWhiteSpace(defaultType))
                    item.MediaType = NormalizeMediaType(defaultType);
            }

            if (includeContentRatings)
                await EnrichContentRatingsAsync(client, data.Results, defaultType, cancellationToken);

            return data;
        }

        private async Task EnrichContentRatingsAsync(
            HttpClient client,
            IEnumerable<MovieDto> items,
            string? fallbackType,
            CancellationToken cancellationToken)
        {
            var groupedItems = items
                .Where(item => item.Id > 0)
                .GroupBy(item => NormalizeMediaType(item.MediaType ?? fallbackType))
                .Where(group => group.Key != null);

            foreach (var group in groupedItems)
            {
                await _contentRatingService.EnrichContentRatingsAsync(
                    client,
                    group.Key!,
                    group,
                    cancellationToken);
            }
        }

        private static string? NormalizeMediaType(string? type)
        {
            if (string.Equals(type, "tv", StringComparison.OrdinalIgnoreCase))
                return "tv";

            if (string.Equals(type, "movie", StringComparison.OrdinalIgnoreCase))
                return "movie";

            return null;
        }

        private static List<PersonCreditDto> BuildCastCredits(IEnumerable<TmdbCreditPerson>? cast)
        {
            return (cast ?? Enumerable.Empty<TmdbCreditPerson>())
                .Where(person => !string.IsNullOrWhiteSpace(person.Name))
                .OrderBy(person => person.Order ?? int.MaxValue)
                .ThenBy(person => person.Name)
                .Take(12)
                .Select(person => new PersonCreditDto
                {
                    Id = person.Id,
                    Name = person.Name!,
                    Role = string.IsNullOrWhiteSpace(person.Character) ? "Cast" : person.Character,
                    ProfilePath = person.ProfilePath
                })
                .ToList();
        }

        private static List<PersonCreditDto> BuildCrewCredits(
            IEnumerable<TmdbCreditPerson>? crew,
            Func<TmdbCreditPerson, bool> predicate,
            Func<string?, int> rolePriority)
        {
            return (crew ?? Enumerable.Empty<TmdbCreditPerson>())
                .Where(predicate)
                .Where(person => !string.IsNullOrWhiteSpace(person.Name))
                .GroupBy(person => person.Id > 0 ? person.Id.ToString() : person.Name!.Trim().ToLowerInvariant())
                .Select(group =>
                {
                    var primary = group
                        .OrderBy(person => rolePriority(person.Job))
                        .ThenBy(person => person.Name)
                        .First();

                    var roles = group
                        .Select(person => NormalizeRole(person.Job, person.Department))
                        .Where(role => !string.IsNullOrWhiteSpace(role))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .OrderBy(role => rolePriority(role))
                        .Take(3)
                        .ToList();

                    return new
                    {
                        Priority = roles.Select(rolePriority).DefaultIfEmpty(99).Min(),
                        Credit = new PersonCreditDto
                        {
                            Id = primary.Id,
                            Name = primary.Name!,
                            Role = roles.Count > 0 ? string.Join(" | ", roles) : primary.Department,
                            ProfilePath = primary.ProfilePath
                        }
                    };
                })
                .OrderBy(entry => entry.Priority)
                .ThenBy(entry => entry.Credit.Name)
                .Take(12)
                .Select(entry => entry.Credit)
                .ToList();
        }

        private static bool IsMusicCredit(TmdbCreditPerson person)
        {
            var job = person.Job ?? string.Empty;

            return string.Equals(person.Department, "Sound", StringComparison.OrdinalIgnoreCase)
                || job.Contains("Music", StringComparison.OrdinalIgnoreCase)
                || job.Contains("Composer", StringComparison.OrdinalIgnoreCase)
                || job.Contains("Song", StringComparison.OrdinalIgnoreCase)
                || job.Contains("Theme", StringComparison.OrdinalIgnoreCase)
                || job.Contains("Soundtrack", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsCreatorCredit(TmdbCreditPerson person)
        {
            var job = person.Job ?? string.Empty;

            return job.Contains("Director", StringComparison.OrdinalIgnoreCase)
                || string.Equals(person.Department, "Writing", StringComparison.OrdinalIgnoreCase)
                || job.Equals("Writer", StringComparison.OrdinalIgnoreCase)
                || job.Equals("Screenplay", StringComparison.OrdinalIgnoreCase)
                || job.Equals("Story", StringComparison.OrdinalIgnoreCase)
                || job.Equals("Novel", StringComparison.OrdinalIgnoreCase)
                || job.Equals("Teleplay", StringComparison.OrdinalIgnoreCase)
                || job.Equals("Creator", StringComparison.OrdinalIgnoreCase)
                || job.Equals("Series Composition", StringComparison.OrdinalIgnoreCase);
        }

        private static int GetMusicPriority(string? role)
        {
            return role?.Trim() switch
            {
                "Original Music Composer" => 0,
                "Composer" => 1,
                "Songs" => 2,
                "Music Supervisor" => 3,
                _ when role?.Contains("Theme", StringComparison.OrdinalIgnoreCase) == true => 4,
                _ when role?.Contains("Song", StringComparison.OrdinalIgnoreCase) == true => 5,
                _ => 10
            };
        }

        private static int GetCreatorPriority(string? role)
        {
            return role?.Trim() switch
            {
                "Director" => 0,
                "Writer" => 1,
                "Screenplay" => 2,
                "Creator" => 3,
                "Series Composition" => 4,
                "Story" => 5,
                "Teleplay" => 6,
                "Novel" => 7,
                _ when role?.Contains("Director", StringComparison.OrdinalIgnoreCase) == true => 8,
                _ => 12
            };
        }

        private static string? NormalizeRole(string? job, string? department)
        {
            if (!string.IsNullOrWhiteSpace(job))
                return job.Trim();

            return string.IsNullOrWhiteSpace(department) ? null : department.Trim();
        }
    }

    // ── Watch Provider DTOs ───────────────────────────────────────
    public class WatchProvidersRoot
    {
        [JsonPropertyName("results")]
        public Dictionary<string, WatchProviderRegion>? Results { get; set; }
    }

    public class WatchProviderRegion
    {
        [JsonPropertyName("link")]
        public string? Link { get; set; }

        [JsonPropertyName("flatrate")]
        public List<WatchProvider>? Flatrate { get; set; }

        [JsonPropertyName("free")]
        public List<WatchProvider>? Free { get; set; }

        [JsonPropertyName("ads")]
        public List<WatchProvider>? Ads { get; set; }

        [JsonPropertyName("rent")]
        public List<WatchProvider>? Rent { get; set; }

        [JsonPropertyName("buy")]
        public List<WatchProvider>? Buy { get; set; }
    }

    public class WatchProvider
    {
        [JsonPropertyName("provider_name")]
        public string ProviderName { get; set; } = string.Empty;

        [JsonPropertyName("logo_path")]
        public string? LogoPath { get; set; }
    }

    public class TmdbDetailResponse
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("overview")]
        public string? Overview { get; set; }

        [JsonPropertyName("poster_path")]
        public string? PosterPath { get; set; }

        [JsonPropertyName("backdrop_path")]
        public string? BackdropPath { get; set; }

        [JsonPropertyName("vote_average")]
        public double VoteAverage { get; set; }

        [JsonPropertyName("release_date")]
        public string? ReleaseDate { get; set; }

        [JsonPropertyName("first_air_date")]
        public string? FirstAirDate { get; set; }

        [JsonPropertyName("credits")]
        public TmdbCreditsResponse? Credits { get; set; }
    }

    public class TmdbCreditsResponse
    {
        [JsonPropertyName("cast")]
        public List<TmdbCreditPerson>? Cast { get; set; }

        [JsonPropertyName("crew")]
        public List<TmdbCreditPerson>? Crew { get; set; }
    }

    public class TmdbCreditPerson
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("profile_path")]
        public string? ProfilePath { get; set; }

        [JsonPropertyName("character")]
        public string? Character { get; set; }

        [JsonPropertyName("job")]
        public string? Job { get; set; }

        [JsonPropertyName("department")]
        public string? Department { get; set; }

        [JsonPropertyName("order")]
        public int? Order { get; set; }
    }
}
