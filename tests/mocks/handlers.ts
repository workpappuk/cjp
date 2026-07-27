import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("https://external.example.com/notifications", () => {
    return HttpResponse.json({
      items: [
        { id: "n1", type: "info", message: "Welcome to ThreadForge" },
      ],
    });
  }),
  http.post("https://external.example.com/orders", async ({ request }) => {
    const payload = (await request.json()) as Record<string, unknown>;

    if (!payload?.productId) {
      return HttpResponse.json(
        { error: "productId is required" },
        { status: 400 },
      );
    }

    return HttpResponse.json(
      { id: "order-ext-1", status: "created" },
      { status: 201 },
    );
  }),
];
