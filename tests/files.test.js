const fs = require("fs");
const path = require("path");
const walk = require("walk");
const ScheduleParser = require("../parser");

const files = [];
const walker = walk.walk(path.resolve(__dirname, "schedules"), {});

walker.on("file", async (_, fileStats, next) => {
  const filename = fileStats.name
    .replace(/\.docx/, "")
    .replace(/\s+/g, "_")
    .replace(/[\(\)]/g, "");

  const outputFile = path.resolve(__dirname, "schedules", `${filename}.json`);
  if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

  files.push(fileStats.name);

  next();
});

walker.on("end", async () => {
  const tempFolder = path.resolve(__dirname, "schedules");

  const parser = ScheduleParser.getInstance({ tempFolder });
  await parser.parseAll(files);
  const schedules = parser.getScheduleByTeacherName("Беднов");

  fs.writeFile(
    path.resolve(__dirname, "result.json"),
    JSON.stringify(schedules),
    () => {
      console.log("Done!");
    }
  );
});
