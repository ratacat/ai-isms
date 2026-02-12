import type { Command, ErrorCode, ExitCode, RobotError, RobotResponse } from "./types.js";

export function buildRobotError(code: ErrorCode, message: string, suggestions: string[]): RobotError {
  return { code, message, suggestions };
}

export function successResponse(
  command: Command,
  json: boolean,
  exitCode: ExitCode,
  payload: Omit<RobotResponse, "ok" | "command" | "json" | "exit_code"> = {}
): RobotResponse {
  return {
    ok: true,
    command,
    json,
    exit_code: exitCode,
    ...payload
  };
}

export function failureResponse(
  command: Command,
  json: boolean,
  exitCode: ExitCode,
  error: RobotError,
  payload: Omit<RobotResponse, "ok" | "command" | "json" | "exit_code" | "error"> = {}
): RobotResponse {
  return {
    ok: false,
    command,
    json,
    exit_code: exitCode,
    ...payload,
    error
  };
}
