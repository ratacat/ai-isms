import fs from "node:fs/promises";

export async function readTextFromPath(inputPath: string): Promise<string> {
  return fs.readFile(inputPath, "utf8");
}

export async function readTextFromFiles(paths: string[]): Promise<string> {
  const chunks = await Promise.all(paths.map((path) => readTextFromPath(path)));
  return chunks.join("\n");
}

export function readTextFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let result = "";
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (chunk) => {
      result += chunk;
    });

    process.stdin.on("end", () => {
      resolve(result);
    });

    process.stdin.on("error", (error) => {
      reject(error);
    });
  });
}
