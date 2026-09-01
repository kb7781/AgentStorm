import prisma from "../lib/prisma";

export async function logEvent(
  type: string,
  entityId: string,
  metadata: any = {}
) {
  try {
    await prisma.event.create({
      data: {
        type,
        entityId,
        metadata,
      },
    });
  } catch (error) {
    console.error(`Failed to log event ${type} for ${entityId}:`, error);
  }
}
