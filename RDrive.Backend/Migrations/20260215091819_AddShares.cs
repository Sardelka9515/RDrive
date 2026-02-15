using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RDrive.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddShares : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SpaceId",
                table: "Shares",
                newName: "Views");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Shares",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Creator",
                table: "Shares",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Shares",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "MaxDownloads",
                table: "Shares",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "Shares",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Password",
                table: "Shares",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Remote",
                table: "Shares",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "ShareRecipients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ShareId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Email = table.Column<string>(type: "TEXT", nullable: false),
                    Permission = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShareRecipients", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShareRecipients_Shares_ShareId",
                        column: x => x.ShareId,
                        principalTable: "Shares",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShareRecipients_ShareId",
                table: "ShareRecipients",
                column: "ShareId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShareRecipients");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Shares");

            migrationBuilder.DropColumn(
                name: "Creator",
                table: "Shares");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Shares");

            migrationBuilder.DropColumn(
                name: "MaxDownloads",
                table: "Shares");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "Shares");

            migrationBuilder.DropColumn(
                name: "Password",
                table: "Shares");

            migrationBuilder.DropColumn(
                name: "Remote",
                table: "Shares");

            migrationBuilder.RenameColumn(
                name: "Views",
                table: "Shares",
                newName: "SpaceId");
        }
    }
}
