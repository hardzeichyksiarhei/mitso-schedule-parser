const path = require("path");
const _ = require("lodash");
const chunk = require("lodash/chunk");
const parser = require("xml2json");

const DocxHelper = require("./docx");
const { DAYS_EN, TEACHERS, LESSON_TYPES } = require("./constants");

class ScheduleParser {
  static #instance = null;
  #schedules = null;

  constructor(options) {
    this.options = options;
    this.#schedules = [];
  }

  static getInstance(options = {}) {
    if (!ScheduleParser.#instance) {
      ScheduleParser.#instance = new ScheduleParser(options);
    }

    return ScheduleParser.#instance;
  }

  #getRowTables(xmlTables) {
    return xmlTables.reduce((tableResult, xmlTable, idx) => {
      const xmlRows = xmlTable["w:tr"];

      let rows = xmlRows.reduce((rowResult, xmlRow) => {
        const xmlCells = xmlRow["w:tc"];
        const cells = xmlCells.reduce((cellResult, xmlCell) => {
          let matchAll = JSON.stringify(xmlCell["w:p"]).matchAll(
            /(?:"w:t":"|"\$t":")([0-9а-яёА-ЯЁ\s\-\.\(\)\,\:\/]+)\"/gi
          );
          let cellValue = Array.from(matchAll)
            .reduce((result, item) => result + item[1], "")
            .trim();

          if (!cellValue || cellValue === "-") cellValue = null;
          return [...cellResult, cellValue];
        }, []);
        return [...rowResult, cells];
      }, []);

      let [headerRow, ...bodyRows] = rows;
      headerRow = headerRow.reduce((acc, curr, i) => {
        if (i === 0 || i === 1) return [...acc, curr];
        return [...acc, curr, null];
      }, []);
      rows = [headerRow, ...bodyRows];

      const reverseRows = _.zip(...rows);
      return [...tableResult, reverseRows];
    }, []);
  }

  #getSchedule(rowTable) {
    const [_, times, ...rowSchedules] = rowTable;

    return chunk(rowSchedules, 2).reduce(
      (resultSchedule, rowSchedule, idxSchedule) => {
        const [dayWeekObj, classRoomObj] = rowSchedule;

        const [_, rowDate] = dayWeekObj.shift().split(", ");
        const [__, ...rowLessons] = dayWeekObj;

        const lessons = rowLessons.reduce(
          (resultLessons, rowSubject, idxRowSubject) => {
            if (!rowSubject) return resultLessons;

            rowSubject = rowSubject
              .replace(/^(\d+\.)(.*)/, (_, __, p) => p)
              .trim();

            const lesson_types_pattern = Object.keys(LESSON_TYPES)
              .join("|")
              .replace(/\//g, "\\/");
            const matched = new RegExp(
              `^(?:([\\d[а-яё,\\s]+)+(?:\\-)?(.*?)(?:\\()(${lesson_types_pattern})(?:\\)))`,
              "i"
            ).exec(rowSubject);

            if (!matched || !matched.length) return resultLessons;

            const [_, groupsInfo, name, type] = matched;
            const groups = groupsInfo
              .split(", ")
              .reduce((resultGroupsInfo, groupInfo) => {
                const [group, speciality] = groupInfo
                  .split(/\s/)
                  .map((value) => value.trim());
                return [...resultGroupsInfo, { group, speciality }];
              }, []);

            const [startTime, endTime] = times[idxRowSubject + 2]
              .split("-")
              .map((time) => time.trim().replace(".", ":"));

            const lesson = {
              rowName: rowSubject,
              name: name.trim(),
              classroom: classRoomObj[idxRowSubject + 2],
              time: {
                start: startTime,
                end: endTime,
              },
              groups,
              type: LESSON_TYPES[type.trim()],
            };
            return [...resultLessons, lesson];
          },
          []
        );

        resultSchedule[DAYS_EN[idxSchedule]] = { date: rowDate, lessons };

        return resultSchedule;
      },
      {}
    );
  }

  #getSchedules(rowTables) {
    return rowTables.reduce((resultSchedules, rowTable, idxTable) => {
      const schedule = this.#getSchedule(rowTable);
      const payload = {
        teacherName: TEACHERS[idxTable],
        date: {
          start: schedule["monday"]["date"],
          end: schedule["saturday"]["date"],
        },
        schedule,
      };
      return [...resultSchedules, payload];
    }, []);
  }

  async #parse(file) {
    const tempFolder = this.options?.tempFolder || path.resolve(__dirname, "temp");
    const tempPath = path.resolve(tempFolder, file);

    const extractData = await DocxHelper.extract(tempPath);

    const json = parser.toJson(extractData, { object: true });

    const document = json["w:document"];
    const body = document["w:body"];
    const xmlTables = body["w:tbl"];

    let rowTables = this.#getRowTables(xmlTables);

    return this.#getSchedules(rowTables);
  }

  #groupByTeacherName(schedules) {
    const scheduleFlatten = schedules.flat();
    const scheduleGroupByTeacherName = _.groupBy(
      scheduleFlatten,
      "teacherName"
    );

    return Object.keys(scheduleGroupByTeacherName).reduce(
      (resultSchedules, teacherName) => {
        const schedules = scheduleGroupByTeacherName[teacherName].map(
          ({ teacherName, ...other }) => other
        );
        const schedule = { teacherName, schedules };
        return [...resultSchedules, schedule];
      },
      []
    );
  }

  parseAll(files) {
    return new Promise((resolve, reject) => {
      const promises = files.map((file) => this.#parse(file));
      Promise.all(promises)
        .then((rowSchedules) => {
          const schedules = this.#groupByTeacherName(rowSchedules);
          this.#schedules = schedules;

          resolve(schedules);
        })
        .catch(reject);
    });
  }
}

module.exports = ScheduleParser;
