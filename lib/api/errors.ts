import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        details: error.details ?? null
      },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  console.error(error);

  return NextResponse.json(
    {
      error: "Unexpected server error."
    },
    { status: 500 }
  );
}
