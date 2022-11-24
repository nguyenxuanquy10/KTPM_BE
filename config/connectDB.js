const mongoose = require("mongoose");
const logger = require("./logger");

const connectDB = async () => {
  try {
    mongoose.connect(process.env.HOST);
    logger.info("connect database successfully");
  } catch (err) {
    logger.error(err);
  }
};

module.exports = connectDB;
