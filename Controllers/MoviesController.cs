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
        private readonly string _apiKey;
        public MoviesController(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        [HttpGet("list/{type}")]
        public async Task<IActionResult> GetMoviesOrSeries(string type, [FromQuery] int? genreId)
        {
            var client = _httpClientFactory.CreateClient("TmdbClient");

            string requestUrl = genreId.HasValue
                ? $"discover/{type}?api_key={_apiKey}&with_genres={genreId}&language=tr-TR"
                : $"{type}/popular?api_key={_apiKey}&language=tr-TR";

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
            var client = _httpClientFactory.CreateClient("TmdbClient");

            var response = await client.GetFromJsonAsync<GenreResponse>(
                $"genre/{type}/list?api_key={_apiKey}&language=tr-TR");

            if (response == null) return NotFound("Kategoriler alınamadı.");

            return Ok(response.Genres);
        }
    }
}
