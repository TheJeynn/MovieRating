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

        [HttpGet("list/{type}")]
        public async Task<IActionResult> GetMoviesOrSeries(string type, [FromQuery] int? genreId)
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            var client = _httpClientFactory.CreateClient("TmdbClient");
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _tmdbToken);

            string requestUrl = genreId.HasValue
                ? $"discover/{type}?with_genres={genreId}&language=tr-TR"
                : $"{type}/popular?language=tr-TR";

            try
            {
                var response = await client.GetFromJsonAsync<TmdbResponse>(requestUrl);

                if (response == null || response.Results == null)
                    return NotFound("İçerik bulunamadı.");

                return Ok(response.Results);
            }
            catch (Exception ex)
            {
                return BadRequest($"Hata oluştu: {ex.Message}");
            }
        }

        [HttpGet("genres/{type}")]
        public async Task<IActionResult> GetGenres(string type)
        {
            if (string.IsNullOrEmpty(_tmdbToken))
                return BadRequest("TMDB_KEY not found in environment.");

            var client = _httpClientFactory.CreateClient("TmdbClient");
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _tmdbToken);

            var response = await client.GetFromJsonAsync<GenreResponse>(
                $"genre/{type}/list?language=tr-TR");

            if (response == null) return NotFound("Kategoriler alınamadı.");

            return Ok(response.Genres);
        }
    }
}