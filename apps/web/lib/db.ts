import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __biogtPool: Pool | undefined;
}

export const isDatabaseConfigured = () => Boolean(process.env.DATABASE_URL);

const getConnectionString = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for BioGT database access.");
  }
  return connectionString;
};

export const getPool = () => {
  if (!globalThis.__biogtPool) {
    globalThis.__biogtPool = new Pool({
      connectionString: getConnectionString()
    });
  }

  return globalThis.__biogtPool;
};

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = []
): Promise<QueryResult<T>> => getPool().query<T>(text, [...values]);

export const maybeOne = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = []
): Promise<T | null> => {
  const result = await query<T>(text, values);
  return result.rows[0] ?? null;
};

export const one = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = []
): Promise<T> => {
  const row = await maybeOne<T>(text, values);
  if (!row) {
    throw new Error(`Expected one row for query: ${text}`);
  }
  return row;
};

export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};
