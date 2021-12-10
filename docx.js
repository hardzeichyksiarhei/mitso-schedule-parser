const StreamZip = require("node-stream-zip");

class DocxHelper {
  #open(filePath) {
    return new Promise((resolve, reject) => {
      const zip = new StreamZip({
        file: filePath,
        storeEntries: true,
      });

      zip.on("ready", () => {
        const chunks = [];
        let content = "";
        zip.stream("word/document.xml", (err, stream) => {
          if (err) {
            reject(err);
          }
          stream.on("data", function (chunk) {
            chunks.push(chunk);
          });
          stream.on("end", function () {
            content = Buffer.concat(chunks);
            zip.close();
            resolve(content.toString());
          });
        });
      });
    });
  }

  extract(filePath) {
    return new Promise((resolve, reject) => {
      this.#open(filePath).then(function (res, err) {
        if (err) {
          reject(err);
        }

        resolve(res.toString());
      });
    });
  }
}

module.exports = new DocxHelper();
