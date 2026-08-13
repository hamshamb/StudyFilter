import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const examPapersTable = pgTable("exam_papers", {
  id: serial("id").primaryKey(),
  board: text("board").notNull().default("CBSE"),
  grade: integer("grade").notNull().default(10),
  subject: text("subject").notNull(),
  course: text("course"),
  year: integer("year").notNull(),
  examSession: text("exam_session"),
  paperType: text("paper_type").notNull(),
  setName: text("set_name"),
  series: text("series"),
  paperCode: text("paper_code"),
  title: text("title").notNull(),
  // Null for generated practice papers, which have no upstream source.
  officialSourceUrl: text("official_source_url"),
  /**
   * "official"  — imported from SelfStudys / NCERT, i.e. a real past paper.
   * "generated" — written by us to the current CBSE pattern for a gap in the
   *               catalogue. Must stay visibly distinguishable in the UI: a
   *               student revising for boards needs to know which papers are
   *               actual CBSE releases and which are practice material.
   */
  origin: text("origin").notNull().default("official"),
  storedFileKey: text("stored_file_key"),
  fileChecksum: text("file_checksum"),
  fileSizeBytes: integer("file_size_bytes"),
  markingSchemeId: integer("marking_scheme_id"),
  durationMinutes: integer("duration_minutes"),
  maximumMarks: integer("maximum_marks"),
  language: text("language").notNull().default("english"),
  status: text("status").notNull().default("available"),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertExamPaperSchema = createInsertSchema(examPapersTable).omit({ id: true, importedAt: true, updatedAt: true });
export const selectExamPaperSchema = createSelectSchema(examPapersTable);
export type InsertExamPaper = z.infer<typeof insertExamPaperSchema>;
export type ExamPaper = typeof examPapersTable.$inferSelect;

export const markingSchemesTable = pgTable("marking_schemes", {
  id: serial("id").primaryKey(),
  examPaperId: integer("exam_paper_id"),
  subject: text("subject").notNull(),
  course: text("course"),
  year: integer("year").notNull(),
  paperType: text("paper_type").notNull(),
  title: text("title").notNull(),
  // Null for generated schemes — see examPapersTable.origin.
  officialSourceUrl: text("official_source_url"),
  origin: text("origin").notNull().default("official"),
  storedFileKey: text("stored_file_key"),
  fileChecksum: text("file_checksum"),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMarkingSchemeSchema = createInsertSchema(markingSchemesTable).omit({ id: true, importedAt: true, updatedAt: true });
export type InsertMarkingScheme = z.infer<typeof insertMarkingSchemeSchema>;
export type MarkingScheme = typeof markingSchemesTable.$inferSelect;

export const ncertBooksTable = pgTable("ncert_books", {
  id: serial("id").primaryKey(),
  board: text("board").notNull().default("CBSE"),
  grade: integer("grade").notNull().default(10),
  subject: text("subject").notNull(),
  course: text("course"),
  language: text("language").notNull().default("english"),
  bookTitle: text("book_title").notNull(),
  bookCode: text("book_code"),
  edition: text("edition"),
  officialSourceUrl: text("official_source_url").notNull(),
  storedFileKey: text("stored_file_key"),
  fileChecksum: text("file_checksum"),
  fileSizeBytes: integer("file_size_bytes"),
  status: text("status").notNull().default("available"),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNcertBookSchema = createInsertSchema(ncertBooksTable).omit({ id: true, importedAt: true, updatedAt: true });
export type InsertNcertBook = z.infer<typeof insertNcertBookSchema>;
export type NcertBook = typeof ncertBooksTable.$inferSelect;
