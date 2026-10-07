export type MySqlConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

const DEFAULT_DATABASE = "smarthome";

export function loadMySqlConfig(): MySqlConfig {
  const host = requiredEnv("MYSQL_HOST");
  const port = Number(process.env.MYSQL_PORT ?? 3306);
  const user = requiredEnv("MYSQL_USER");
  const password = process.env.MYSQL_PASSWORD ?? "";
  const database = process.env.MYSQL_DATABASE?.trim() || DEFAULT_DATABASE;

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("MYSQL_PORT muss eine positive Zahl sein");
  }

  return { host, port, user, password, database };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Umgebungsvariable ${name} ist nicht gesetzt`);
  }
  return value;
}
