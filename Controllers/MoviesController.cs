using Microsoft.AspNetCore.Mvc;
using MovieRating.DTOs;
using System.Net.Http.Json;

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
            var response = await client.GetAsync($"trending/all/day?language=en-US&page={page}");
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

            var client = GetClient();
            var url = type == "tv"
                ? $"tv/popular?language=en-US&page={page}"
                : $"movie/popular?language=en-US&page={page}";

            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return BadRequest("TMDB API Error");

            var data = await response.Content.ReadFromJsonAsync<TmdbRawResponse>();
            // inject media_type
            if (data?.Results != null)
                foreach (var r in data.Results) r.MediaType = type;

            return Ok(data);
        }

        // GET: api/Movies/toprated?type=movie&page=1
        [HttpGet("toprated")]
        public async Task<IActionResult> GetTopRated([FromQuery] string type = "movie", [FromQuery] int page = 1)
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            var client = GetClient();
            var url = type == "tv"
                ? $"tv/top_rated?language=en-US&page={page}"
                : $"movie/top_rated?language=en-US&page={page}";

            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return BadRequest("TMDB API Error");

            var data = await response.Content.ReadFromJsonAsync<TmdbRawResponse>();
            if (data?.Results != null)
                foreach (var r in data.Results) r.MediaType = type;

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
                $"search/multi?query={encoded}&language=en-US&page={page}&include_adult=false");

            if (!response.IsSuccessStatusCode) return BadRequest("TMDB API Error");

            var content = await response.Content.ReadAsStringAsync();
            return Content(content, "application/json");
        }

        // GET: api/Movies/genres?type=movie
        [HttpGet("genres")]
        public async Task<IActionResult> GetGenres([FromQuery] string type = "movie")
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            var client = GetClient();
            var response = await client.GetFromJsonAsync<GenreResponse>(
                $"genre/{type}/list?language=en-US");

            if (response == null) return NotFound("Genres not found.");
            return Ok(response.Genres);
        }

        // GET: api/Movies/discover?type=movie&genreId=28&page=1
        [HttpGet("discover")]
        public async Task<IActionResult> Discover(
            [FromQuery] string type = "movie",
            [FromQuery] int? genreId = null,
            [FromQuery] int page = 1)
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            var client = GetClient();
            var url = genreId.HasValue
                ? $"discover/{type}?with_genres={genreId}&language=en-US&page={page}&sort_by=popularity.desc"
                : $"{type}/popular?language=en-US&page={page}";

            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return BadRequest("TMDB API Error");

            var data = await response.Content.ReadFromJsonAsync<TmdbRawResponse>();
            if (data?.Results != null)
                foreach (var r in data.Results) r.MediaType = type;

            return Ok(data);
        }

        private HttpClient GetClient()
        {
            var client = _httpClientFactory.CreateClient("TmdbClient");
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _tmdbToken);
            return client;
        }
    }
}