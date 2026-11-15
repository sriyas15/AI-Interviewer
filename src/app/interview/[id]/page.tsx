import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { InterviewRoom } from "@/components/interview/interview-room";

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InterviewRoomPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

  const interview = await db.interview.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      jobRole: true,
      difficulty: true,
      topics: true,
      status: true,
      userId: true,
    },
  });

  if (!interview) {
    notFound();
  }

  // Security check: Only the candidate who owns this interview (or an admin) can access it
  if (interview.userId !== session.user.id && session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // If already completed, go directly to report
  if (interview.status === "COMPLETED") {
    redirect(`/interview/${id}/report`);
  }

  return <InterviewRoom interview={interview} />;
}
