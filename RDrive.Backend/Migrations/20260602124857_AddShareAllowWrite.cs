using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RDrive.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddShareAllowWrite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AllowWrite",
                table: "Shares",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllowWrite",
                table: "Shares");
        }
    }
}
