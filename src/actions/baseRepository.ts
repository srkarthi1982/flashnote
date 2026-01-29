import { count, db, eq } from "astro:db";

type WhereClause<TTable> = () => any;
type OrderByClause = () => unknown[];

type PaginatedQueryOptions<TTable> = {
  page: number;
  pageSize: number;
  where?: WhereClause<TTable>;
  orderBy?: OrderByClause;
};

type QueryOptions<TTable> = {
  where?: WhereClause<TTable>;
  orderBy?: OrderByClause;
  limit?: number;
  offset?: number;
};

export class BaseRepository<TTable, TSelect = unknown> {
  constructor(protected table: TTable) {}

  protected createSelectQuery(): any {
    return db.select().from(this.table as any);
  }

  async getById(columnSelector: (table: TTable) => any, id: number | string) {
    const query = this.createSelectQuery() as any;
    const record = await query.where(eq(columnSelector(this.table), id)).get();
    return record ?? null;
  }

  async insert(values: any): Promise<any[]> {
    const result = await db.insert(this.table as any).values(values).returning();
    return result as any[];
  }

  async update(values: any, where: (table: TTable) => any): Promise<any[]> {
    const result = await db
      .update(this.table as any)
      .set(values)
      .where(where(this.table))
      .returning();
    return result as any[];
  }

  async delete(where: (table: TTable) => any): Promise<any[]> {
    const result = await db.delete(this.table as any).where(where(this.table)).returning();
    return result as any[];
  }

  async getPaginatedData({ page, pageSize, where, orderBy }: PaginatedQueryOptions<TTable>) {
    const data = await this.getData({
      where,
      orderBy,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    const total = await this.countRows(where);

    return { data, total, page, pageSize };
  }

  async getData({ where, orderBy, limit, offset }: QueryOptions<TTable>) {
    let query = this.createSelectQuery() as any;

    const whereClause = where?.();
    if (whereClause) {
      query = query.where(whereClause);
    }

    const orderExpressions = orderBy?.() ?? [];
    if (orderExpressions.length > 0) {
      query = query.orderBy(...orderExpressions);
    }

    if (typeof limit === "number") {
      query = query.limit(limit);
    }

    if (typeof offset === "number") {
      query = query.offset(offset);
    }

    const result = await query;
    return result as TSelect[];
  }

  private async countRows(where?: WhereClause<TTable>) {
    const whereClause = where?.();
    const query = db.select({ value: count() }).from(this.table as any);
    const result = whereClause ? await query.where(whereClause) : await query;
    const rawTotal = result[0]?.value ?? 0;
    return typeof rawTotal === "number" ? rawTotal : Number(rawTotal);
  }
}
