import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export const registerSchema = z.object({
  studentId: z.string().min(5, "Student ID is required"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  department: z.string().min(2, "Department is required"),
  session: z.string().min(4, "Session is required"),
  gender: z.enum(["MALE", "FEMALE"], { required_error: "Gender is required" }),
  whatsapp: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

export const mealToggleSchema = z.object({
  date: z.string(),
  mealType: z.enum(["breakfast", "lunch", "dinner"]),
  value: z.boolean(),
})

export const updateMealScheduleSchema = z.object({
  date: z.string(),
  breakfast: z.boolean().optional(),
  lunch: z.boolean().optional(),
  dinner: z.boolean().optional(),
})

export const depositSchema = z.object({
  diningId: z.string().min(1, "Dining ID is required"),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().optional(),
})

export const mealRateSchema = z.object({
  breakfastPrice: z.number().positive("Breakfast price must be positive"),
  lunchPrice: z.number().positive("Lunch price must be positive"),
  dinnerPrice: z.number().positive("Dinner price must be positive"),
})

export const studentUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  department: z.string().optional(),
  session: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const adminCreateStudentSchema = z.object({
  studentId: z.string().min(5, "Student ID is required"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  department: z.string().min(2, "Department is required"),
  session: z.string().min(4, "Session is required"),
  whatsapp: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
})
