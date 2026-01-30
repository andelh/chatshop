import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";

// Aggregate total messages per thread
export const messagesByThread = new TableAggregate<{
  Namespace: Id<"threads">;
  Key: number;
  DataModel: DataModel;
  TableName: "messages";
}>(components.messagesByThread, {
  namespace: (doc) => doc.threadId,
  sortKey: (doc) => doc.timestamp,
});

// Aggregate total tokens per thread
export const tokensByThread = new TableAggregate<{
  Namespace: Id<"threads">;
  Key: number;
  DataModel: DataModel;
  TableName: "messages";
}>(components.tokensByThread, {
  namespace: (doc) => doc.threadId,
  sortKey: (doc) => doc.timestamp,
  sumValue: (doc) => doc.aiMetadata?.totalTokens ?? 0,
});

// Aggregate total cost per thread
export const costByThread = new TableAggregate<{
  Namespace: Id<"threads">;
  Key: number;
  DataModel: DataModel;
  TableName: "messages";
}>(components.costByThread, {
  namespace: (doc) => doc.threadId,
  sortKey: (doc) => doc.timestamp,
  sumValue: (doc) => doc.aiMetadata?.costUsd ?? 0,
});
