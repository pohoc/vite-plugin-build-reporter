// ANSI color helpers — zero dependencies, 23 bytes minified.
// Respects NO_COLOR (https://no-color.org) and CI.

const noColor = !!(process.env.NO_COLOR || process.env.CI);

const codes = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

const plain = (text: string) => text;
const ansi = (code: string) => (text: string) => `${code}${text}${codes.reset}`;
const paint = (code: string) => (noColor ? plain : ansi(code));

export const colors = {
  bold: paint(codes.bold),
  cyan: paint(codes.cyan),
  magenta: paint(codes.magenta),
  yellow: paint(codes.yellow),
  green: paint(codes.green),
  red: paint(codes.red),
  gray: paint(codes.gray),
};
