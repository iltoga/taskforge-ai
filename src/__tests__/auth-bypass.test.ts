import { getServerSession } from "next-auth/next";
import { authOptions } from "../lib/auth";

describe("Auth Bypass (BYPASS_GOOGLE_AUTH)", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("should allow sign-in and return mock session when BYPASS_GOOGLE_AUTH is true", async () => {
    process.env.BYPASS_GOOGLE_AUTH = "true";
    // Re-import authOptions to get the bypass config
    const { authOptions: bypassOptions } = require("../lib/auth");
    const provider = bypassOptions.providers[0];
    // Simulate authorize
    const user = await provider.authorize({
      email: "test@bypass.com",
      name: "Test User",
    });
    expect(user).toMatchObject({ email: "test@bypass.com", name: "Test User" });
    // Simulate jwt callback
    const token = await bypassOptions.callbacks.jwt({ token: {}, user });
    expect(token.accessToken).toBe("bypass-access-token");
    // Simulate session callback
    const session = await bypassOptions.callbacks.session({
      session: {},
      token,
    });
    expect(session.accessToken).toBe("bypass-access-token");
  });

  it("should use GoogleProvider when BYPASS_GOOGLE_AUTH is not true", () => {
    process.env.BYPASS_GOOGLE_AUTH = "false";
    const { authOptions: googleOptions } = require("../lib/auth");
    expect(googleOptions.providers[0].id).toBe("google");
  });
});
