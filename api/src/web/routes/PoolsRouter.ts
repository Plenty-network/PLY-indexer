import { Request, Response, Router } from "express";
import { Dependecies, TokenType } from "../../types";
import { calculateAPR, getRealEmission, getToken } from "../../infrastructure/utils";

function build({ dbClient, contracts, tzktProvider, getAPR }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const APRs = await getAPR();
      const amm = req.query.amm as string;
      const page = req.query.page as string;
      const limit = 10; // number of rows to return per page

      if (amm) {
        const pools = await dbClient.get({
          select: "*",
          table: "pools",
          where: `amm='${amm}'`,
        });
        if (pools.rowCount !== 0) {
          const pool = pools.rows[0];
          const currentEpoch = await tzktProvider.getCurrentEpoch(contracts.voter.address);
          const bribes = await dbClient.getAll({
            select: "value, price, name",
            table: "bribes",
            where: `amm='${pool.amm}' AND epoch='${currentEpoch}'`,
          });
          return res.json({
            pool: pool.amm,
            bribes: bribes.rows,
            apr: APRs[pool.amm] ? APRs[pool.amm].current : "0",
            futureApr: APRs[pool.amm] ? APRs[pool.amm].future : "0",
          });
        } else {
          return res.status(400).json({ message: "AMM_NOT_EXIST" });
        }
      } else {
        let pools = [];
        let pool;
        if (!page) {
          pool = await dbClient.getAllNoQuery({
            select: "*",
            table: "pools",
          });
        } else {
          pool = await dbClient.getPagination({
            select: "*",
            table: "pools",
            limit: limit,
            offset: (parseInt(page) - 1) * limit,
          });
        }

        if (pool.rowCount !== 0) {
          const currentEpoch = await tzktProvider.getCurrentEpoch(contracts.voter.address);
          const finalPoolsPromise = pool.rows.map(async (pool) => {
            const bribes = await dbClient.getAll({
              select: "value, price, name",
              table: "bribes",
              where: `amm='${pool.amm}' AND epoch='${currentEpoch}'`,
            });

            return {
              pool: pool.amm,
              bribes: bribes.rows,
              apr: APRs[pool.amm] ? APRs[pool.amm].current : "0",
              futureApr: APRs[pool.amm] ? APRs[pool.amm].future : "0",
            };
          });

          pools = await Promise.all(finalPoolsPromise);

          return res.json(pools);
        } else {
          return res.json([]);
        }
      }
    } catch (e) {
      console.log(e);
      return res.status(400).json({ message: e });
    }
  });
  return router;
}

export default build;
