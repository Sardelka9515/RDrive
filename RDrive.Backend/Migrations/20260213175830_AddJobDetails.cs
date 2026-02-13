using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RDrive.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddJobDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DestPath",
                table: "Tasks",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DestRemote",
                table: "Tasks",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Error",
                table: "Tasks",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FinishedAt",
                table: "Tasks",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourcePath",
                table: "Tasks",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SourceRemote",
                table: "Tasks",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DestPath",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "DestRemote",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "Error",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "FinishedAt",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "SourcePath",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "SourceRemote",
                table: "Tasks");
        }
    }
}
