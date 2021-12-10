const fs = require("fs");
const path = require("path");
const util = require("util");
const multer = require("multer");
const uuid = require("uuid");
const express = require("express");

const ScheduleParser = require("../parser");

const PORT = 3000;

const unlink = util.promisify(fs.unlink);
const writeFile = util.promisify(fs.writeFile);

const app = express();

app.use(express.json());

app.use("/", (req, res, next) => {
  if (req.originalUrl === "/") {
    res.send("Service is running!");
    return;
  }
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, path.resolve(__dirname, "schedules"));
  },
  filename: (req, file, callback) => {
    callback(null, uuid.v4() + path.extname(file.originalname));
  },
});

const upload = multer({ storage }).array("files", 10);

app.post("/upload", upload, async (req, res) => {
  try {
    const files = req.files.map((file) => file.path);

    const tempFolder = path.resolve(__dirname, "schedules");
    const parser = ScheduleParser.getInstance({ tempFolder });
    await parser.parseAll(files);
    const schedules = parser.getScheduleByTeacherName("Беднов");

    const result = path.resolve(__dirname, "result.json");
    await writeFile(result, JSON.stringify(schedules));

    const promisify = files.map((file) => unlink(file));
    await Promise.all(promisify);

    return res.json(schedules).status(200);
  } catch (error) {
    return res.json({ message: error.message }).status(500);
  }
});

app.listen(PORT, () =>
  console.log(`Test app is running on http://localhost:${PORT}`)
);
