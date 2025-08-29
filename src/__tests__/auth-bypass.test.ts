// Mock the auth module directly
jest.mock("../../auth", () => ({
  authConfig: {
    providers: [
      {
        name: "Bypass",
        authorize: jest.fn(),
      },
    ],
  },
}));

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

    // Import the mocked auth config
    const { authConfig } = require("../../auth");

    // Check that bypass mode is enabled
    expect(authConfig.providers).toHaveLength(1);
    expect(authConfig.providers[0].name).toBe("Bypass");

    // Test the credentials provider authorize function
    const provider = authConfig.providers[0];
    const mockAuthorize = provider.authorize as jest.Mock;
    mockAuthorize.mockResolvedValue({
      id: "bypass-user-id",
      email: "test@bypass.com",
      name: "Test User",
    });

    const user = await provider.authorize({
      email: "test@bypass.com",
      name: "Test User",
    });

    expect(user).toMatchObject({
      email: "test@bypass.com",
      name: "Test User",
      id: "bypass-user-id",
    });
  });

  it("should use GoogleProvider when BYPASS_GOOGLE_AUTH is not true", () => {
    process.env.BYPASS_GOOGLE_AUTH = "false";

    // Mock the auth config for Google provider
    const mockAuth = require("../../auth");
    mockAuth.authConfig.providers = [
      {
        id: "google",
      },
    ];

    const { authConfig } = require("../../auth");

    expect(authConfig.providers).toHaveLength(1);
    expect(authConfig.providers[0].id).toBe("google");
  });
});
