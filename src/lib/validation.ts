import { z } from "zod";

const email = z.string().trim().pipe(z.email("Enter a valid email address."));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/[0-9]/, "Include at least one number."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords do not match.", path: ["confirm"] });

export const setRoleSchema = z.object({
  userId: z.uuid("Invalid user."),
  role: z.enum(["owner", "staff", "seller"], { error: "Choose a role." }),
});

export const setActiveSchema = z.object({
  userId: z.uuid("Invalid user."),
  active: z.boolean(),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type ResetRequestValues = z.infer<typeof resetRequestSchema>;
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
