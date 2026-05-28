import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, athletesTable, teamsTable } from "@workspace/db";
import { eq, and, sql, sum } from "drizzle-orm";

const router = Router();

async function enrichInvoice(invoice: typeof invoicesTable.$inferSelect) {
  const athlete = await db.select().from(athletesTable).where(eq(athletesTable.id, invoice.athleteId)).limit(1);
  return {
    ...invoice,
    athleteName: athlete[0] ? `${athlete[0].firstName} ${athlete[0].lastName}` : null,
    createdAt: invoice.createdAt.toISOString(),
  };
}

router.get("/billing/invoices", async (req, res): Promise<void> => {
  const { athleteId, status } = req.query as Record<string, string>;
  const conditions = [];
  if (athleteId) conditions.push(eq(invoicesTable.athleteId, parseInt(athleteId)));
  if (status) conditions.push(eq(invoicesTable.status, status));

  const rows = conditions.length > 0
    ? await db.select().from(invoicesTable).where(and(...conditions))
    : await db.select().from(invoicesTable);

  const enriched = await Promise.all(rows.map(enrichInvoice));
  res.json(enriched);
});

router.post("/billing/invoices", async (req, res): Promise<void> => {
  const [row] = await db.insert(invoicesTable).values(req.body).returning();
  const enriched = await enrichInvoice(row);
  res.status(201).json(enriched);
});

router.get("/billing/invoices/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
  if (rows.length === 0) { res.status(404).json({ error: "Invoice not found" }); return; }
  const enriched = await enrichInvoice(rows[0]);
  res.json(enriched);
});

router.patch("/billing/invoices/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.update(invoicesTable).set(req.body).where(eq(invoicesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Invoice not found" }); return; }
  const enriched = await enrichInvoice(row);
  res.json(enriched);
});

router.get("/billing/summary", async (req, res): Promise<void> => {
  const all = await db.select().from(invoicesTable);
  const pending = all.filter(i => i.status === "pending");
  const paid = all.filter(i => i.status === "paid");
  const overdue = all.filter(i => i.status === "overdue");

  res.json({
    totalOutstanding: pending.reduce((s, i) => s + i.amount, 0),
    totalPaid: paid.reduce((s, i) => s + i.amount, 0),
    totalOverdue: overdue.reduce((s, i) => s + i.amount, 0),
    invoiceCount: all.length,
    overdueCount: overdue.length,
  });
});

export default router;
