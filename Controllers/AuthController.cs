using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MovieRating.Data;
using MovieRating.DTOs;
using MovieRating.Models;
using MovieRating.Services;

namespace MovieRating.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly PasswordHasherService _passwordHasher;

        public AuthController(AppDbContext context, PasswordHasherService passwordHasher)
        {
            _context = context;
            _passwordHasher = passwordHasher;
        }

        [HttpPost("register")]
        [AllowAnonymous]
        public async Task<ActionResult<AuthUserDto>> Register([FromBody] RegisterRequestDto request)
        {
            var username = request.Username.Trim();
            var password = request.Password.Trim();

            if (username.Length < 3)
                return BadRequest("Username must be at least 3 characters.");

            if (username.Length > 32)
                return BadRequest("Username must be 32 characters or fewer.");

            if (password.Length < 6)
                return BadRequest("Password must be at least 6 characters.");

            var exists = await _context.Users.AnyAsync(user => user.Username == username);
            if (exists)
                return Conflict("That username is already taken.");

            var user = new AppUser
            {
                Username = username,
                PasswordHash = _passwordHasher.HashPassword(password),
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            await SignInAsync(user);

            return Ok(ToAuthUserDto(user));
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<ActionResult<AuthUserDto>> Login([FromBody] LoginRequestDto request)
        {
            var username = request.Username.Trim();
            var password = request.Password.Trim();

            var user = await _context.Users.FirstOrDefaultAsync(candidate => candidate.Username == username);
            if (user == null || !_passwordHasher.VerifyPassword(password, user.PasswordHash))
                return Unauthorized("Invalid username or password.");

            await SignInAsync(user);
            return Ok(ToAuthUserDto(user));
        }

        [HttpGet("me")]
        [Authorize]
        public async Task<ActionResult<AuthUserDto>> Me()
        {
            var userId = GetCurrentUserId();
            if (userId == null)
                return Unauthorized();

            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(candidate => candidate.Id == userId.Value);

            return user == null ? Unauthorized() : Ok(ToAuthUserDto(user));
        }

        [HttpPost("logout")]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return NoContent();
        }

        private async Task SignInAsync(AppUser user)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.Username)
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);

            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                principal,
                new AuthenticationProperties
                {
                    IsPersistent = true,
                    ExpiresUtc = DateTimeOffset.UtcNow.AddDays(14)
                });
        }

        private int? GetCurrentUserId()
        {
            var rawId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(rawId, out var userId) ? userId : null;
        }

        private static AuthUserDto ToAuthUserDto(AppUser user)
        {
            return new AuthUserDto
            {
                Id = user.Id,
                Username = user.Username
            };
        }
    }
}
