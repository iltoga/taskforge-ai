import { config } from "dotenv";
import fs from "fs";
import { uploadedFileToImageDataUrl } from "../lib/image-helpers";
import { categorizeDocument } from "../lib/openai";

config(); // Load .env

describe("categorizeDocument (LLM categorization)", () => {
  it("should categorize a passport image correctly", async () => {
    const FILE_UPLOAD_DIR = process.env.FILE_UPLOAD_DIR || "/app/tmp_data";
    const imagePath = "Passport_new_ext_05_apr_2032.png";
    // copy the file to the tmp_data directory if needed
    fs.copyFileSync(`tmp/${imagePath}`, `${FILE_UPLOAD_DIR}/${imagePath}`);
    // Use the helper to convert to data URL
    const dataUrl = await uploadedFileToImageDataUrl(imagePath, "image/png");
    const category = await categorizeDocument({ images: [dataUrl] });
    expect(typeof category).toBe("string");
    expect(category).toBe("passport");
    // delete the file after test if needed
    fs.unlinkSync(`${FILE_UPLOAD_DIR}/${imagePath}`);
    // Optionally, check for a specific category if you expect it
    // expect(category).toBe("passport");
    console.log("Predicted category:", category);
  });
});
