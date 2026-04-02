import { NextResponse } from "next/server";
import { loadModuleTemplate } from "@/app/lib/modules/module_template_loader";

export async function GET(_: Request, { params }: { params: Promise<{ moduleCode: string }> }) {
  try {
    const { moduleCode } = await params;
    const tpl = loadModuleTemplate(moduleCode);
    return NextResponse.json({ ok: true, template: tpl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to load template";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 404 }
    );
  }
}
