import * as express from "express";
import { Express } from "express";
import * as cors from "cors";
import BaseRouter from "./routes/Router";
import { Dependecies } from "../types";

export function httpServer(dependencies: Dependecies): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/v1", BaseRouter(dependencies));
  return app;
}
