using Microsoft.EntityFrameworkCore;
using RDrive.Backend.Models;

namespace RDrive.Backend.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
    public DbSet<RTask> Tasks { get; set; }
    public DbSet<Share> Shares { get; set; }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
    }
}
