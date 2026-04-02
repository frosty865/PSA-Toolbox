import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";
    const response = await fetch(`${backendUrl}/api/v2/assessments`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch assessments" },
        { status: response.status }
      );
    }

    const assessments = await response.json();
    const assessmentsArray = Array.isArray(assessments) ? assessments : assessments.assessments || [];

    // Count by status
    const statusCounts = {
      DRAFT: 0,
      IN_PROGRESS: 0,
      SUBMITTED: 0,
      LOCKED: 0,
    };

    let lockedCount = 0;
    let unlockedCount = 0;
    const doctrineVersions = new Set<string>();

    assessmentsArray.forEach((assessment: any) => {
      const status = assessment.status || "DRAFT";
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status as keyof typeof statusCounts]++;
      }

      if (status === "LOCKED") {
        lockedCount++;
      } else {
        unlockedCount++;
      }

      // Track doctrine versions
      if (assessment.baseline_version) {
        doctrineVersions.add(`baseline:${assessment.baseline_version}`);
      }
      if (assessment.sector_version) {
        doctrineVersions.add(`sector:${assessment.sector_version}`);
      }
      if (assessment.subsector_version) {
        doctrineVersions.add(`subsector:${assessment.subsector_version}`);
      }
      if (assessment.ofc_version) {
        doctrineVersions.add(`ofc:${assessment.ofc_version}`);
      }
    });

    return NextResponse.json({
      total: assessmentsArray.length,
      by_status: statusCounts,
      locked: lockedCount,
      unlocked: unlockedCount,
      doctrine_versions: Array.from(doctrineVersions),
    });
  } catch (error: any) {
    console.error("Error fetching assessment status:", error);
    
    // Check if it's a connection error
    if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      return NextResponse.json(
        { 
          error: "Backend service unavailable",
          message: "The Flask backend service is not running. Please start the backend service.",
          details: error.message
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error.message || "Failed to fetch assessment status"
      },
      { status: 500 }
    );
  }
}

