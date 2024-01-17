import { PipelineStage } from "mongoose";
import { dateToString } from "./dateToString.pipeline";
import { addedByPipeline } from "./global.pipeline";

export function userPipeline(query: any): PipelineStage[] {
  return [
    {
      $lookup: {
        from: "schools",
        foreignField: "_id",
        localField: "school",
        as: "school",
        pipeline: [
          ...dateToString,
          {
            $lookup: {
              from: "images",
              localField: "images",
              foreignField: "_id",
              as: "images",
            },
          },
          {
            $project: {
              admins: 0,
              addedBy: 0,
              deletedBy: 0,
              lastUpdatedBy: 0,
              deletedAt: 0,
            },
          },
        ],
      },
    },
    ...addedByPipeline,
    {
      $lookup: {
        from: "images",
        localField: "image",
        foreignField: "_id",
        as: "image",
      },
    },
    ...dateToString,
    {
      $set: {
        school: { $ifNull: [{ $arrayElemAt: ["$school", 0] }, null] },
        image: { $ifNull: [{ $arrayElemAt: ["$image", 0] }, null] },
      },
    },
    {
      $match: query,
    },
    {
      $project: {
        addedBy: 0,
        deletedBy: 0,
        lastUpdatedBy: 0,
        deletedAt: 0,
        refreshToken: 0,
      },
    },
    {
      $sort: { createdAt: -1 },
    },
  ];
}