using Microsoft.EntityFrameworkCore;
using RDrive.Backend.Models;

namespace RDrive.Backend.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Space> Spaces { get; set; }
    public DbSet<UserSpacePermission> UserSpacePermissions { get; set; }
    public DbSet<RTask> Tasks { get; set; }
    public DbSet<Share> Shares { get; set; }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        modelBuilder.Entity<Space>().HasIndex(s => s.Name).IsUnique();
        
        modelBuilder.Entity<UserSpacePermission>()
            .HasOne(p => p.Space)
            .WithMany()
            .HasForeignKey(p => p.SpaceId)
            .OnDelete(DeleteBehavior.Cascade);
            
        modelBuilder.Entity<Share>()
            .HasOne(s => s.Space)
            .WithMany()
            .HasForeignKey(s => s.SpaceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
