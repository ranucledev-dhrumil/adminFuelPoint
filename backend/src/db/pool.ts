import pg from "pg";
import { databaseConfig } from "../config/database.js";

const { Pool } = pg;

export const pool = new Pool(databaseConfig);
