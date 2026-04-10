using Microsoft.AspNetCore.Mvc;
using MovieRating.DTOs;
using System.Globalization;
using System.Net.Http.Json;
using System.Text;

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
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            var client = GetClient();
            var response = await client.GetAsync($"trending/all/day?language=en-US&page={Math.Max(page, 1)}");
            if (!response.IsSuccessStatusCode)
                return BadRequest("TMDB API Error");

            var content = await response.Content.ReadAsStringAsync();
            return Content(content, "application/json");
        }

        // GET: api/Movies/popular?type=movie&page=1
        [HttpGet("popular")]
        public async Task<IActionResult> GetPopular([FromQuery] string type = "movie", [FromQuery] int page = 1)
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            type = NormalizeType(type);

            var client = GetClient();
            var response = await client.GetAsync($"{type}/popular?language=en-US&page={Math.Max(page, 1)}");
            if (!response.IsSuccessStatusCode)
                return BadRequest("TMDB API Error");

            var data = await response.Content.ReadFromJsonAsync<TmdbRawResponse>();
            SetMediaType(data, type);
            return Ok(data);
        }

        // GET: api/Movies/toprated?type=movie&page=1
        [HttpGet("toprated")]
        public async Task<IActionResult> GetTopRated([FromQuery] string type = "movie", [FromQuery] int page = 1)
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            type = NormalizeType(type);

            var client = GetClient();
            var response = await client.GetAsync($"{type}/top_rated?language=en-US&page={Math.Max(page, 1)}");
            if (!response.IsSuccessStatusCode)
                return BadRequest("TMDB API Error");

            var data = await response.Content.ReadFromJsonAsync<TmdbRawResponse>();
            SetMediaType(data, type);
            return Ok(data);
        }

        // GET: api/Movies/search?query=batman&page=1
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string query, [FromQuery] int page = 1)
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            if (string.IsNullOrWhiteSpace(query))
                return BadRequest("Query is required.");

            var client = GetClient();
            var encoded = Uri.EscapeDataString(query);
            var response = await client.GetAsync(
                $"search/multi?query={encoded}&language=en-US&page={Math.Max(page, 1)}&include_adult=false");

            if (!response.IsSuccessStatusCode)
                return BadRequest("TMDB API Error");

            var content = await response.Content.ReadAsStringAsync();
            return Content(content, "application/json");
        }

        // GET: api/Movies/genres?type=movie
        [HttpGet("genres")]
        public async Task<IActionResult> GetGenres([FromQuery] string type = "movie")
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            type = NormalizeType(type);

            var client = GetClient();
            var response = await client.GetFromJsonAsync<GenreResponse>($"genre/{type}/list?language=en-US");

            if (response == null)
                return NotFound("Genres not found.");

            return Ok(response.Genres);
        }

        // GET: api/Movies/discover?type=movie&genreId=28&page=1
        // GET: api/Movies/discover?type=movie&genreIds=28&genreIds=12&genreMode=all&minRating=7&sortBy=vote_average.desc&page=1
        [HttpGet("discover")]
        public async Task<IActionResult> Discover(
            [FromQuery] string type = "movie",
            [FromQuery] int? genreId = null,
            [FromQuery] List<int>? genreIds = null,
            [FromQuery] string genreMode = "any",
            [FromQuery] double? minRating = null,
            [FromQuery] double? maxRating = null,
            [FromQuery] string sortBy = "popularity.desc",
            [FromQuery] int page = 1)
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            type = NormalizeType(type);
            genreMode = string.Equals(genreMode, "all", StringComparison.OrdinalIgnoreCase) ? "all" : "any";
            sortBy = IsValidSort(sortBy, type) ? sortBy : GetDefaultSort(type);

            var mergedGenreIds = new HashSet<int>();
            if (genreId.HasValue && genreId.Value > 0)
                mergedGenreIds.Add(genreId.Value);

            if (genreIds != null)
            {
                foreach (var id in genreIds.Where(id => id > 0))
                    mergedGenreIds.Add(id);
            }

            var usePopularFallback =
                mergedGenreIds.Count == 0 &&
                !minRating.HasValue &&
                !maxRating.HasValue &&
                string.Equals(sortBy, GetDefaultSort(type), StringComparison.Ordinal);

            var url = usePopularFallback
                ? $"{type}/popular?language=en-US&page={Math.Max(page, 1)}"
                : BuildDiscoverUrl(type, mergedGenreIds, genreMode, minRating, maxRating, sortBy, page);

            var client = GetClient();
            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode)
                return BadRequest("TMDB API Error");

            var data = await response.Content.ReadFromJsonAsync<TmdbRawResponse>();
            SetMediaType(data, type);
            return Ok(data);
        }

        private HttpClient GetClient()
        {
            var client = _httpClientFactory.CreateClient("TmdbClient");
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _tmdbToken);
            return client;
        }

        private static string NormalizeType(string? type)
        {
            return string.Equals(type, "tv", StringComparison.OrdinalIgnoreCase) ? "tv" : "movie";
        }

        private static void SetMediaType(TmdbRawResponse? data, string type)
        {
            if (data?.Results == null)
                return;

            foreach (var item in data.Results)
                item.MediaType = type;
        }

        private static bool IsValidSort(string? sortBy, string type)
        {
            return type == "tv"
                ? sortBy is "popularity.desc" or "vote_average.desc" or "first_air_date.desc"
                : sortBy is "popularity.desc" or "vote_average.desc" or "primary_release_date.desc";
        }

        private static string GetDefaultSort(string type)
        {
            return "popularity.desc";
        }

        private static string BuildDiscoverUrl(
            string type,
            IEnumerable<int> genreIds,
            string genreMode,
            double? minRating,
            double? maxRating,
            string sortBy,
            int page)
        {
            var query = new List<string>
            {
                "language=en-US",
                $"page={Math.Max(page, 1)}",
                "include_adult=false",
                $"sort_by={sortBy}"
            };

            var selectedGenres = genreIds.ToList();
            if (selectedGenres.Count > 0)
            {
                var separator = genreMode == "all" ? "," : "|";
                query.Add($"with_genres={string.Join(separator, selectedGenres)}");
            }

            if (minRating.HasValue)
                query.Add($"vote_average.gte={minRating.Value.ToString("0.0", CultureInfo.InvariantCulture)}");

            if (maxRating.HasValue)
                query.Add($"vote_average.lte={maxRating.Value.ToString("0.0", CultureInfo.InvariantCulture)}");

            if (string.Equals(sortBy, "vote_average.desc", StringComparison.Ordinal))
                query.Add("vote_count.gte=200");

            var builder = new StringBuilder($"discover/{type}?");
            builder.Append(string.Join("&", query));
            return builder.ToString();
        }
    }
}
