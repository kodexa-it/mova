"use client";

import { createAuthClient } from "better-auth/react";

// Cliente del navegador: misma origin que la app, sin secretos.
export const authClient = createAuthClient();
