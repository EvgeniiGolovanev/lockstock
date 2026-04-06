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

type DatabaseLikeError = {
  message: string;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

function isDatabaseLikeError(error: unknown): error is DatabaseLikeError {
  return typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string";
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

  if (isDatabaseLikeError(error)) {
    console.error(error);

    return NextResponse.json(
      {
        error: error.message,
        details: error.details ?? null,
        hint: error.hint ?? null,
        code: error.code ?? null
      },
      { status: 500 }
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
