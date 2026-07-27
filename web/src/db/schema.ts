import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// ---------- Product catalog ----------

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  series: text('series').notNull().default(''),
  topology: text('topology').notNull().default(''),
  tagline: text('tagline').notNull().default(''),
  description: text('description').notNull().default(''),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  specifications: jsonb('specifications')
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  finishes: jsonb('finishes').$type<string[]>().notNull().default([]),
  images: jsonb('images').$type<string[]>().notNull().default([]),
  videoUrl: text('video_url'),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------- Project portfolio ----------

export const projectCategories = pgTable('project_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => projectCategories.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  location: text('location').notNull().default(''),
  architect: text('architect').notNull().default(''),
  year: integer('year').notNull(),
  type: text('type').notNull().default(''),
  description: text('description').notNull().default(''),
  productsUsed: jsonb('products_used').$type<string[]>().notNull().default([]),
  thumbnail: text('thumbnail').notNull().default(''),
  images: jsonb('images').$type<string[]>().notNull().default([]),
  videoUrl: text('video_url'),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------- Admin users ----------

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default(''),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ---------- Payroll ----------
//
// All money is stored in **paise** (integer) so arithmetic never drifts.
// Divide by 100 for display.

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),   // E.164 without +, e.g. 919876543210
  grossSalary: integer('gross_salary').notNull().default(0),
  pfContribution: integer('pf_contribution').notNull().default(0),
  busPass: integer('bus_pass').notNull().default(0),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const payrollRuns = pgTable('payroll_runs', {
  id: serial('id').primaryKey(),
  // First day of the pay month, e.g. 2026-06-01
  period: text('period').notNull().unique(),
  daysInPeriod: integer('days_in_period').notNull().default(30),
  status: text('status').notNull().default('draft'), // draft | generated | sent
  note: text('note').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  generatedAt: timestamp('generated_at'),
  sentAt: timestamp('sent_at'),
});

export const payrollLines = pgTable('payroll_lines', {
  id: serial('id').primaryKey(),
  runId: integer('run_id')
    .notNull()
    .references(() => payrollRuns.id, { onDelete: 'cascade' }),
  employeeId: integer('employee_id').references(() => employees.id, {
    onDelete: 'set null',
  }),

  // Snapshot: a generated payslip must never change if the employee record does.
  employeeName: text('employee_name').notNull(),
  phone: text('phone').notNull().default(''),

  // ---- Inputs ----
  daysWorked: integer('days_worked').notNull().default(0),
  grossSalary: integer('gross_salary').notNull().default(0),
  otHours: integer('ot_hours').notNull().default(0),
  outsidePay: integer('outside_pay').notNull().default(0),
  advancePending: integer('advance_pending').notNull().default(0),
  advanceDeducted: integer('advance_deducted').notNull().default(0),
  attendanceBonus: integer('attendance_bonus').notNull().default(0),
  phoneDeduction: integer('phone_deduction').notNull().default(0),
  pfContribution: integer('pf_contribution').notNull().default(0),
  busPass: integer('bus_pass').notNull().default(0),
  annualBonus: integer('annual_bonus').notNull().default(0),

  // ---- Derived, stored so the payslip is reproducible ----
  salaryPerDay: integer('salary_per_day').notNull().default(0),
  earnedSalary: integer('earned_salary').notNull().default(0),
  otAmount: integer('ot_amount').notNull().default(0),
  totalEarnings: integer('total_earnings').notNull().default(0),
  balanceAdvance: integer('balance_advance').notNull().default(0),
  netPaid: integer('net_paid').notNull().default(0),

  // ---- Delivery ----
  pdfUrl: text('pdf_url'),
  deliveryStatus: text('delivery_status').notNull().default('pending'), // pending | sent | failed | skipped
  deliveryError: text('delivery_error'),
  deliveredAt: timestamp('delivered_at'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type PayrollRun = typeof payrollRuns.$inferSelect;
export type PayrollLine = typeof payrollLines.$inferSelect;
export type NewPayrollLine = typeof payrollLines.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProjectCategory = typeof projectCategories.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Admin = typeof admins.$inferSelect;
