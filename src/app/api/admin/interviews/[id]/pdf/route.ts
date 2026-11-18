import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateReportPdfBuffer } from "@/lib/pdf";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
    }

    const { id } = await params;
    const buffer = await generateReportPdfBuffer(id);

    // Detect if buffer is real PDF binary (%PDF- magic bytes) or HTML fallback
    const isPdf =
      buffer.length > 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": isPdf ? "application/pdf" : "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="assessment-report-${id}.${isPdf ? "pdf" : "html"}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate report export" }, { status: 500 });
  }
}
