import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Score } from "@app/common/model/schema/scores.schema";
import { User } from "@app/common/model/schema/users.schema";
import { ResponseService } from "@app/common/response/response.service";
import { StringHelper } from "@app/common/helpers/string.helpers";
import { Record } from "@app/common/model/schema/records.schema";
import { ScoreCalculateHelper } from "@app/common/helpers/score.helper";
import { leaderboardPipeline } from "@app/common/pipeline/leaderboard.pipeline";
import { Game } from "@app/common/model/schema/game.schema";
import { LogService } from "src/admin/services/log.service";
import { TargetLogEnum } from "@app/common/enums/log.enum";

@Injectable()
export class ScoreService {
  constructor(
    @InjectModel(Score.name) private scoreModel: Model<Score>,
    @InjectModel(Record.name) private recordModel: Model<Record>,
    @InjectModel(Game.name) private gameModel: Model<Game>,
    @Inject(ResponseService) private readonly responseService: ResponseService,
    @Inject(ScoreCalculateHelper) private readonly scoreCalculateHelper: ScoreCalculateHelper,
    @Inject(LogService) private readonly logService: LogService,
  ) { }

  private readonly logger = new Logger(ScoreService.name);

  public async calculateScore(recordId: any, req: any): Promise<any> {
    const users: User = <User>req.user;
    try {
      let record = await this.recordModel.findOne({ _id: recordId });
      if (!record) return this.responseService.error(HttpStatus.NOT_FOUND, StringHelper.notFoundResponse("record"));

      let calcScore: number = await this.scoreCalculateHelper.calculateScore(record.game, {
        timeInSeconds: record.time.pop(),
        level: record.level,
        tryCount: record.count,
        lifeLeftBonus: record.liveLeft,
      });

      let curr = await this.scoreModel.count({
        level: record.level,
        user: record.user,
        game: record.game,
      })

      let score = await this.scoreModel.create({
        value: calcScore,
        level: record.level,
        user: record.user,
        game: record.game,
        record: record._id,
        gamePlayed: curr + 1,
      });

      await this.logService.logging({
        target: TargetLogEnum.SCORE,
        description: `${users?.name} success calculate score`,
        success: true,
        summary: recordId,
      })

      return this.responseService.success(true, StringHelper.successResponse("score", 'calculate'), score);
    } catch (error) {
      await this.logService.logging({
        target: TargetLogEnum.SCORE,
        description: `${users?.name} failed to calculate score`,
        success: false,
        summary: recordId,
      })
      this.logger.error(this.calculateScore.name);
      console.log(error?.message);
      return this.responseService.error(HttpStatus.INTERNAL_SERVER_ERROR, StringHelper.internalServerError, { value: error, constraint: "", property: "" });
    }
  }

  public async getLeaderBoard(body: any, req: any): Promise<any> {
    const users: User = <User>req.user;
    try {
      let game = await this.gameModel.findOne({ _id: new Types.ObjectId(body.game) });
      if (!game) return this.responseService.error(HttpStatus.NOT_FOUND, StringHelper.notFoundResponse("game"))

      let score = await this.scoreModel.aggregate(leaderboardPipeline(game._id));

      let leaderboard = [];
      if (score?.length) {
        score = score.filter(i => i?._id?._id?.toString() == users?.school?.toString());
        leaderboard = score[0].scores.map(i => i.user._id.toString() == users._id.toString() ? { ...i, isCurrentUser: true } : { ...i, isCurrentUser: false })
      }

      await this.logService.logging({
        target: TargetLogEnum.SCORE,
        description: `${users?.name} success get leaderboard data of game ${game?.name}`,
        success: true,
        summary: JSON.stringify(body),
      })

      return this.responseService.success(true, StringHelper.successResponse("score", 'get_leaderboard'), { game, leaderboard });
    } catch (error) {
      await this.logService.logging({
        target: TargetLogEnum.SCORE,
        description: `${users?.name} failed get leaderboard data of game `,
        success: false,
        summary: JSON.stringify(body),
      })
      this.logger.error(this.getLeaderBoard.name);
      console.log(error?.message);
      return this.responseService.error(HttpStatus.INTERNAL_SERVER_ERROR, StringHelper.internalServerError, { value: error, constraint: "", property: "" });
    }
  }
}
