import { getClientId, readJsonBody } from "@/lib/http";

describe("getClientId", () => {
  const request = (headers: Record<string, string>) =>
    new Request("http://localhost/api", { headers });

  it("uses the first address in x-forwarded-for", () => {
    expect(getClientId(request({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip, then to a shared name", () => {
    expect(getClientId(request({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(getClientId(request({}))).toBe("anonymous");
  });
});

describe("readJsonBody", () => {
  const request = (body: string) => new Request("http://localhost/api", { method: "POST", body });

  it("parses JSON", async () => {
    expect(await readJsonBody(request('{"a":1}'))).toEqual({ ok: true, data: { a: 1 } });
  });

  it("refuses bad JSON with a 400", async () => {
    const result = await readJsonBody(request("{"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it("refuses early when the declared length is over 32 KB", async () => {
    const req = new Request("http://localhost/api", {
      method: "POST",
      body: "{}",
      headers: { "content-length": "40000" },
    });
    const result = await readJsonBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it("refuses a body that cannot be read", async () => {
    const req = new Request("http://localhost/api", { method: "POST", body: "{}" });
    vi.spyOn(req, "text").mockRejectedValue(new Error("stream closed"));
    const result = await readJsonBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it("refuses a body over 32 KB with a 413", async () => {
    const result = await readJsonBody(request(JSON.stringify({ pad: "x".repeat(33_000) })));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });
});
