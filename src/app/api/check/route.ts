import { createCheckResponse } from "@/lib/http";

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return createCheckResponse(request);
}