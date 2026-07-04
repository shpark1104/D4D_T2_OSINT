const { requestHandler } = require("../server/index");

module.exports = function handler(req, res) {
  return requestHandler(req, res);
};
