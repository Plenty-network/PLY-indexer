import { Request, Response, Router } from "express";
import { Dependecies, Lock } from "../../types";

import BigNumber from "bignumber.js";

function build({ dbClient }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const address = req.query.address as string;

      if (!address) {
        return res.status(400).json({ message: "MISSING_ADDRESS" });
      }
      const locks = await dbClient.getAll({
        select: "*",
        table: "locks",
        where: `owner='${address}'`,
      });

      if (locks.rowCount !== 0) {
        //console.log(locksAll);
        const response = locks.rows.map(async (lock) => {
          const tokenVotes = await dbClient.getAll({
            select: "*",
            table: "token_amm_votes",
            where: `(token_id='${lock.id}') AND (fee_claimed=${false} OR bribes_unclaimed != '{}')`,
          });
          const finalTokenVotes = tokenVotes.rows.map(async (tokenVote) => {
            //console.log(tokenVote.bribes_unclaimed);
            const ammEpochVotes = await dbClient.get({
              select: "*",
              table: "total_amm_votes",
              where: `amm='${tokenVote.amm}' AND epoch='${tokenVote.epoch}'`,
            });
            const tokenTotalVotes = await dbClient.get({
              select: "*",
              table: "total_token_votes",
              where: `token_id='${lock.id}' AND epoch='${tokenVote.epoch}'`,
            });
            const ammEpochVotesValue = new BigNumber(ammEpochVotes.rows[0].value);
            const tokenEpochVotesValue = new BigNumber(tokenTotalVotes.rows[0].value);
            const voteShare = new BigNumber(tokenVote.value).dividedBy(tokenEpochVotesValue);
            const voteShareAmm = new BigNumber(tokenVote.value).dividedBy(ammEpochVotesValue);
            const feesEpoch = await dbClient.get({
              select: "*",
              table: "fees",
              where: `amm='${tokenVote.amm}' AND epoch='${tokenVote.epoch}'`,
            });
            let fee;
            if (feesEpoch.rowCount === 0) {
              fee = { token1Fee: "0", token2Fee: "0", token1Symbol: "", token2Symbol: "" };
            } else {
              const token1_fee = new BigNumber(feesEpoch.rows[0].token1_fee).multipliedBy(voteShareAmm);
              const token2_fee = new BigNumber(feesEpoch.rows[0].token2_fee).multipliedBy(voteShareAmm);
              fee = {
                token1Fee: token1_fee.toFixed(0),
                token2Fee: token2_fee.toFixed(0),
                token1Symbol: feesEpoch.rows[0].token1_symbol,
                token2Symbol: feesEpoch.rows[0].token2_symbol,
              };
            }

            const bribesRes = tokenVote.bribes_unclaimed.map(async (bribe: number) => {
              const bribeData = (
                await dbClient.get({
                  select: "*",
                  table: "bribes",
                  where: `bribe_id='${bribe.toString()}' AND amm='${tokenVote.amm}'`,
                })
              ).rows[0];
              return {
                amm: bribeData.amm,
                epoch: bribeData.epoch,
                bribeId: bribeData.bribe_id,
                provider: bribeData.provider,
                value: new BigNumber(bribeData.value).multipliedBy(voteShareAmm).toFixed(0),
                name: bribeData.name,
              };
            });
            const finalBribes = await Promise.all(bribesRes);

            return {
              epoch: tokenVote.epoch,
              amm: tokenVote.amm,
              votes: tokenVote.value,
              fee: fee,
              bribes: finalBribes,
              unclaimedBribes: tokenVote.bribes_unclaimed,
              feeClaimed: tokenVote.fee_claimed,
              voteShare: voteShare.multipliedBy(100).toString(),
            };
          });
          const finalTokenVotesRes = await Promise.all(finalTokenVotes);
          return {
            votesUnclaimed: finalTokenVotesRes,
            lockId: lock.id,
          };
        });
        const finalResponse = await Promise.all(response);
        return res.json(finalResponse.filter((x) => x.votesUnclaimed.length !== 0));
      } else {
        return res.json([]);
      }
    } catch (e) {
      console.log(e);

      return res.status(400).json({ message: e });
    }
  });
  return router;
}

export default build;
