using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MovieRating.Migrations
{
    /// <inheritdoc />
    public partial class AddMediaTypeAndRatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MediaType",
                table: "Ratings",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "RatedAt",
                table: "Ratings",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MediaType",
                table: "Ratings");

            migrationBuilder.DropColumn(
                name: "RatedAt",
                table: "Ratings");
        }
    }
}
