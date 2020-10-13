"use strict";
const cluster = require("cluster");

if (cluster.isMaster) {
  //creamos CPU hijos
  for (let i = 0; i < 1; /*require("os").cpus().length*/ i++) {
    cluster.fork();
  }
} else {
  main();
}
async function main() {
  process.on("unhandledRejection", reason => {
    console.error("unhandled", cluster.worker.id, reason);
  });
  const mongoose = require("mongoose");
  const {weakModels} = require("../");
  const {promiseHelpers} = require("@chumager/promise-helpers");
  promiseHelpers();
  const db = new mongoose.Mongoose();
  await db.connect("mongodb://localhost/test", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
  });

  const subSubSchema = new db.Schema(
    {
      test: {
        type: Number,
        filter: true
      }
    },
    {
      weakModel: true
    }
  );
  const subSchema = new db.Schema(
    {
      subSubSchema: {
        type: [subSubSchema]
      },
      test: {
        type: Number,
        filter: true
      }
    },
    {
      weakModel: {
        projection: {
          test: 1
        }
      }
    }
  );
  const schema = new db.Schema({
    subSchema: {
      type: [subSchema]
    },
    test: {
      type: Number,
      filter: true
    }
  });
  const model = db.model("testModel", schema);

  await weakModels(db);
  await model.create([
    {subSchema: [{test: 1}, {test: 2}]},
    {subSchema: [{test: 11}, {test: 12}]},
    {subSchema: [{test: 21}, {test: 22}]},
    {subSchema: [{test: 31}, {test: 32}]},
    {subSchema: [{test: 41}, {test: 42}]}
  ]);

  const child = await db.model("testModel_subSchema").findById("5f8639c14f81ec5fb662cb67");

  console.log("PARENT Document", cluster.worker.id, child);
  console.log("PARENT Document", cluster.worker.id, await child.parentDocument());
  //console.log("PARENT Document", cluster.worker.id, await db.model("testModel_subSchema").findOne().exec().get("parentModel"));
  console.log("PARENT", cluster.worker.id, await model.countDocuments());
  console.log("WEAK", cluster.worker.id, await db.model("testModel_subSchema").countDocuments());
  process.exit(0);
}
