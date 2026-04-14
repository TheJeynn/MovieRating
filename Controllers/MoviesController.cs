using Microsoft.AspNetCore.Mvc;
using MovieRating.DTOs;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace MovieRating.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MoviesController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _tmdbToken;

        public MoviesController(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
            _tmdbToken = Environment.GetEnvironmentVariable("TMDB_KEY") ?? string.Empty;
        }

        // GET: api/Movies/trending?page=1
        [HttpGet("trending")]
        public async Task<IActionResult> GetTrending([FromQuery] int page = 1)
        {
            var client = GetClient();
            var response = await client.GetAsync($"trending/all/day?language=en-US&page={page}");
            if (!response.IsSuccessStatusCode) return BadRequest("TMDB API Error");
            return Content(await response.Content.ReadAsStringAsync(), "application/json");
        }

        // GET: api/Movies/popular?type=movie&page=1
        [HttpGet("popular")]
        public async Task<IActionResult> GetPopular([FromQuery] string type = "movie", [FromQuery] int page = 1)
        {
            var client = GetClient();
            var url = type == "tv" ? $"tv/popular?language=en-US&page={page}" : $"movie/popular?language=en-US&page={page}";
            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return BadRequest("TMDB API Error");
            var data = await response.Content.ReadFromJsonAsync<TmdbRawResponse>();
            if (data?.Results != null) foreach (var r in data.Results) r.MediaType = type;
            return Ok(data);
        }

        // GET: api/Movies/toprated?type=movie&page=1
        [HttpGet("toprated")]
        public async Task<IActionResult> GetTopRated([FromQuery] string type = "movie", [FromQuery] int page = 1)
        {
            var client = GetClient();
            var url = type == "tv" ? $"tv/top_rated?language=en-US&page={page}" : $"movie/top_rated?language=en-US&page={page}";
            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return BadRequest("TMDB API Error");
            var data = await response.Content.ReadFromJsonAsync<TmdbRawResponse>();
            if (data?.Results != null) foreach (var r in data.Results) r.MediaType = type;
            return Ok(data);
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
        public async Task<IActionResult> Discover([FromQuery] string type = "movie", [FromQuery] int? genreId = null, [FromQuery] int page = 1)
        {
            var client = GetClient();
            var url = genreId.HasValue
                ? $"discover/{type}?with_genres={genreId}&language=en-US&page={page}&sort_by=popularity.desc"
                : $"{type}/popular?language=en-US&page={page}";
            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return BadRequest("TMDB API Error");
            var data = await response.Content.ReadFromJsonAsync<TmdbRawResponse>();
            if (data?.Results != null) foreach (var r in data.Results) r.MediaType = type;
            return Ok(data);
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

        private HttpClient GetClient()
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                throw new InvalidOperationException("TMDB_KEY not found in environment.");
            var client = _httpClientFactory.CreateClient("TmdbClient");
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _tmdbToken);
            return client;
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
}
