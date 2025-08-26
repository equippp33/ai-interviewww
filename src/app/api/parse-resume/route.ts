import { NextResponse } from "next/server";
import axios from "axios";
import pdfParse from "pdf-parse";

export const dynamic = "force-dynamic";

const handler = async (request: Request) => {
  try {
    console.log("We have entered backend of resume-parser");
    const body = (await request.json()) as { pdfUrl: unknown };

    if (!body.pdfUrl || typeof body.pdfUrl !== "string") {
      return new NextResponse(
        JSON.stringify({ error: "Valid PDF URL is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { pdfUrl } = body;
    console.log("Fetching PDF from URL:", pdfUrl);

    const response = await axios.get<ArrayBuffer>(pdfUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
      validateStatus: (status) => status === 200,
    });

    // Verify we have data
    if (!response.data) {
      throw new Error("No data received from PDF URL");
    }

    // Create a Buffer from the array buffer
    const pdfBuffer = Buffer.from(response.data);

    // Verify we have a valid PDF buffer
    if (pdfBuffer.length === 0) {
      throw new Error("Empty PDF buffer received");
    }

    const data = await pdfParse(pdfBuffer);

    return new NextResponse(
      JSON.stringify({
        success: true,
        text: data.text,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Resume processing error:", error);
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: "Failed to process resume",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

export { handler as POST, handler as GET };
