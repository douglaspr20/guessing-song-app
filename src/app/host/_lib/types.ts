// Tipos del panel del anfitrión. Solo tipos del servidor (se borran al compilar).
import type { guestOverview, listMembers } from "@/lib/access/admin";
import type { createInvite, listInvites } from "@/lib/access/invites";

export type Invite = Awaited<ReturnType<typeof listInvites>>[number];
export type NewInvite = Awaited<ReturnType<typeof createInvite>>;
export type Member = Awaited<ReturnType<typeof listMembers>>[number];
export type GuestOverview = Awaited<ReturnType<typeof guestOverview>>;
