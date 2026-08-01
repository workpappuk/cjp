import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.json()
  ),
  transports: [
    // Console output
    new transports.Console(),

    // Daily rotated log file
    new DailyRotateFile({
      filename: "logs/app-%DATE%.log",   // e.g. logs/app-2026-08-01.log
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,               // compress old logs
      maxSize: "20m",                    // rotate if file > 20MB
      maxFiles: "14d",                   // keep logs for 14 days
    }),

    // Separate error log file with rotation
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      zippedArchive: true,
      maxSize: "10m",
      maxFiles: "30d",
    }),
  ],
});

export default logger;
