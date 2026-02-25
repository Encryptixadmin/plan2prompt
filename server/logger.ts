import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const pinoOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || "info",
};

export const logger = isDev
  ? pino({ ...pinoOptions, base: null, timestamp: pino.stdTimeFunctions.isoTime })
  : pino(pinoOptions);

export default logger;
