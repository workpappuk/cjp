import { withAuthFetchInit } from "@/app/_utils/auth";

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, withAuthFetchInit(init));
}
