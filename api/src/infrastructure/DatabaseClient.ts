import { Client, QueryResult } from "pg";

import {
  Config,
  DatabaseGetPaginationParams,
  DatabaseGetParams,
  DatabaseInsertParams,
  DatabaseUpdateParams,
} from "../types";

export default class DatabaseClient {
  private _dbClient: Client;

  constructor(config: Config) {
    this._dbClient = new Client({
      user: config.postgres.username,
      host: config.postgres.host,
      database: config.postgres.database,
      password: config.postgres.password,
      port: 5432,
    });
  }

  async init(): Promise<void> {
    try {
      this._dbClient.connect();
    } catch (err) {
      throw err;
    }
  }

  async get(params: DatabaseGetParams): Promise<QueryResult<any>> {
    try {
      const res = await this._dbClient.query(
        `SELECT ${params.select} FROM ${params.table} WHERE ${params.where} LIMIT 1;`
      );
      return res;
    } catch (err) {
      throw err;
    }
  }

  async getAll(params: DatabaseGetParams): Promise<QueryResult<any>> {
    try {
      const res = await this._dbClient.query(`SELECT ${params.select} FROM ${params.table} WHERE ${params.where};`);
      return res;
    } catch (err) {
      throw err;
    }
  }

  async getAllNoQuery(params: DatabaseGetParams): Promise<QueryResult<any>> {
    try {
      const res = await this._dbClient.query(`SELECT ${params.select} FROM ${params.table};`);
      return res;
    } catch (err) {
      throw err;
    }
  }

  async getPagination(params: DatabaseGetPaginationParams): Promise<QueryResult<any>> {
    try {
      const res = await this._dbClient.query(
        `SELECT ${params.select} FROM ${params.table} LIMIT ${params.limit} OFFSET ${params.offset};`
      );
      return res;
    } catch (err) {
      throw err;
    }
  }

  async insert(params: DatabaseInsertParams): Promise<QueryResult<any>> {
    try {
      const res = await this._dbClient.query(`INSERT INTO ${params.table} ${params.columns} VALUES ${params.values};`);
      return res;
    } catch (err) {
      throw err;
    }
  }

  async update(params: DatabaseUpdateParams): Promise<QueryResult<any>> {
    try {
      const res = await this._dbClient.query(`UPDATE ${params.table} SET ${params.set} WHERE ${params.where};`);
      return res;
    } catch (err) {
      throw err;
    }
  }
}
