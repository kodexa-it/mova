import { z } from "zod";

import { ROLES } from "@/modules/access/permissions";

export const roleSchema = z.enum(ROLES);

export const workspaceNameSchema = z.string().trim().min(2).max(80);

export const createWorkspaceSchema = z.object({ name: workspaceNameSchema });
export const renameWorkspaceSchema = z.object({ name: workspaceNameSchema });
export const changeRoleSchema = z.object({ role: roleSchema });
export const createInvitationSchema = z.object({ email: z.email().max(254), role: roleSchema });
export const acceptInvitationSchema = z.object({ token: z.string().min(10).max(100) });
