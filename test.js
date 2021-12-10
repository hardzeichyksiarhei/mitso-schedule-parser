const fs = require("fs");
const path = require("path");
const walk = require("walk");
const ScheduleParser = require("./parser");

const files = [];
const walker = walk.walk("./schedules", {});

walker.on("file", async (_, fileStats, next) => {
  const filename = fileStats.name
    .replace(/\.docx/, "")
    .replace(/\s+/g, "_")
    .replace(/[\(\)]/g, "");

  const outputFile = `./schedules/${filename}.json`;
  if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

  files.push(fileStats.name);

  next();
});

walker.on("end", async () => {
  const tempFolder = path.resolve(__dirname, "schedules");
  const parser = ScheduleParser.getInstance({
    teacherName: "Беднов",
    tempFolder,
  })
  const payload = await parser.parseAll(files);
  fs.writeFile(path.resolve(__dirname, 'result.json'), JSON.stringify(payload), () => {
    console.log('Done!');
  })
});
