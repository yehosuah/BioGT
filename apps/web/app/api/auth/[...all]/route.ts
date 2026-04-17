import { authHandler } from "@/lib/auth";

export const GET = (request: Request) => authHandler.GET(request);
export const POST = (request: Request) => authHandler.POST(request);
export const PATCH = (request: Request) => authHandler.PATCH(request);
export const PUT = (request: Request) => authHandler.PUT(request);
export const DELETE = (request: Request) => authHandler.DELETE(request);
