using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MovieRating.Migrations
{
    /// <inheritdoc />
    public partial class AddMovieTitleToRating : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Comment",
                table: "Ratings");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Ratings");

            migrationBuilder.DropColumn(
                name: "UserScore",
                table: "Ratings");

            migrationBuilder.RenameColumn(
                name: "ContentType",
                table: "Ratings",
                newName: "MovieTitle");

            migrationBuilder.AddColumn<string>(
                name: "PosterPath",
                table: "Ratings",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Score",
                table: "Ratings",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PosterPath",
                table: "Ratings");

            migrationBuilder.DropColumn(
                name: "Score",
                table: "Ratings");

            migrationBuilder.RenameColumn(
                name: "MovieTitle",
                table: "Ratings",
                newName: "ContentType");

            migrationBuilder.AddColumn<string>(
                name: "Comment",
                table: "Ratings",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Ratings",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<double>(
                name: "UserScore",
                table: "Ratings",
                type: "float",
                nullable: false,
                defaultValue: 0.0);
        }
    }
}
