using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using MetaDetective.Api.Data;
using Microsoft.Extensions.Configuration;

public static class AuthEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/auth/register", async ([FromBody] AuthRequest req, AppDbContext db) =>
        {
            if (await db.Users.AnyAsync(u => u.Email == req.Email))
                return Results.BadRequest(new { error = "Email already registered" });

            var user = new User
            {
                Email = req.Email,
                HashedPassword = BCrypt.Net.BCrypt.HashPassword(req.Password)
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();

            return Results.Ok(new { message = "User registered successfully" });
        });

        app.MapPost("/api/auth/login", async ([FromBody] AuthRequest req, AppDbContext db, IConfiguration config) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email);
            if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.HashedPassword))
                return Results.Unauthorized();

            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.UTF8.GetBytes(config["Jwt:Secret"] ?? "super_secret_key_that_is_long_enough_1234567890");
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Email, user.Email)
                }),
                Expires = DateTime.UtcNow.AddDays(1),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };
            var token = tokenHandler.CreateToken(tokenDescriptor);

            return Results.Ok(new { access_token = tokenHandler.WriteToken(token) });
        });
    }
}

public class AuthRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
