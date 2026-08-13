import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";

/**
 * Emails received at an @contact.studyfilter.online address.
 *
 * contact.studyfilter.online is a Resend-managed inbox: there is no IMAP or
 * POP account behind it, no login anywhere that shows its mail. Every
 * message that arrives triggers a webhook instead — resend-inbound.ts
 * verifies it, stores the row here, and relays a copy to a real mailbox.
 *
 * `rawPayload` is the actual source of truth. The extracted columns
 * (fromAddress, subject, textBody, …) are read from Resend's documented
 * event shape, but Resend has not published the full inbound schema, so
 * that extraction is best-effort — every value has a fallback if a field
 * is named or nested differently than expected. Nothing is lost even if a
 * column comes back empty, because the full payload is always kept.
 */
export const inboundEmailTable = pgTable("inbound_email", {
  id: serial("id").primaryKey(),
  /** Resend's own id for the message, when the payload includes one. */
  resendEmailId: text("resend_email_id"),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  subject: text("subject"),
  textBody: text("text_body"),
  htmlBody: text("html_body"),
  /** The verified webhook body, byte-for-byte as JSON. */
  rawPayload: jsonb("raw_payload").notNull(),
  /** Set once notifySupport() has relayed this to a real inbox. */
  relayedAt: timestamp("relayed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InboundEmail = typeof inboundEmailTable.$inferSelect;
export type NewInboundEmail = typeof inboundEmailTable.$inferInsert;
