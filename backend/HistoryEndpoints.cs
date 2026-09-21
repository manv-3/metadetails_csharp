using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using MetaDetective.Api.Data;
using System.Linq;

public static class HistoryEndpoints
{
    public static void Map(WebApplication app)
    {
        var group = app.MapGroup("/api/history").RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal user, AppDbContext db) =>
        {
            var userIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userIdStr, out var userId)) return Results.Unauthorized();

            var scans = await db.Scans
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();

            return Results.Ok(scans);
        });

        group.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal user, AppDbContext db) =>
        {
            var userIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(userIdStr, out var userId)) return Results.Unauthorized();

            var scan = await db.Scans.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);
            if (scan == null) return Results.NotFound();

            db.Scans.Remove(scan);
            await db.SaveChangesAsync();

            return Results.Ok(new { message = "Scan deleted" });
        });
    }
}
