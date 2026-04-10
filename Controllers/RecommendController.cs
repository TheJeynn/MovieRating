using Microsoft.AspNetCore.Mvc;
using MovieRating.DTOs;
using System.Net.Http.Json;

namespace MovieRating.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RecommendController : ControllerBase
    {
        private readonly IHttpClientFactory _clientFactory;
        private readonly string _tmdbToken;

        public RecommendController(IHttpClientFactory clientFactory)
        {
            _clientFactory = clientFactory;
            _tmdbToken = Environment.GetEnvironmentVariable("TMDB_KEY") ?? string.Empty;
        }

        // POST: api/Recommend
        // Body: { "type": "movie"|"tv", "genreIds": [28, 12], "excludeIds": [123, 456], "genreMode": "all"|"any" }
        [HttpPost]
        public async Task<IActionResult> GetRecommendation([FromBody] RecommendRequest request)
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found.");

            var selectedGenres = request.GenreIds
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            if (selectedGenres.Count == 0)
                return BadRequest("At least one genre is required.");

            var client = _clientFactory.CreateClient("TmdbClient");
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _tmdbToken);

            var type = string.Equals(request.Type, "tv", StringComparison.OrdinalIgnoreCase) ? "tv" : "movie";
            var genreMode = string.Equals(request.GenreMode, "any", StringComparison.OrdinalIgnoreCase) ? "any" : "all";
            var genreSeparator = genreMode == "all" ? "," : "|";
            var genreParam = string.Join(genreSeparator, selectedGenres);
            var excludeIds = request.ExcludeIds == null
                ? new HashSet<int>()
                : new HashSet<int>(request.ExcludeIds);

            var rng = new Random();

            for (int attempt = 0; attempt < 6; attempt++)
            {
                var page = rng.Next(1, 11);
                var url =
                    $"discover/{type}?with_genres={genreParam}&sort_by=popularity.desc&vote_average.gte=6.5&vote_count.gte=200&include_adult=false&language=en-US&page={page}";

                var response = await client.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                    continue;

                var data = await response.Content.ReadFromJsonAsync<TmdbRawResponse>();
                if (data?.Results == null || data.Results.Count == 0)
                    continue;

                var candidates = data.Results
                    .Where(item => !excludeIds.Contains(item.Id))
                    .Where(item => !string.IsNullOrWhiteSpace(item.PosterPath))
                    .Where(item => item.GenreIds.Count > 0)
                    .ToList();

                if (candidates.Count == 0)
                    continue;

                var candidatePool = candidates
                    .OrderByDescending(item => item.VoteAverage)
                    .Take(Math.Min(candidates.Count, 12))
                    .ToList();

                var pick = candidatePool[rng.Next(candidatePool.Count)];
                pick.MediaType = type;
                return Ok(pick);
            }

            return NotFound("No recommendation found. Try different genres.");
        }
    }

    public class RecommendRequest
    {
        public string Type { get; set; } = "movie";
        public List<int> GenreIds { get; set; } = new();
        public List<int>? ExcludeIds { get; set; }
        public string GenreMode { get; set; } = "all";
    }
}
