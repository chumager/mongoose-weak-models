"use strict";
const cluster = require("cluster");

if (cluster.isMaster) {
  //creamos CPU hijos
  for (let i = 0; i < 1 /*require("os").cpus().length*/; i++) {
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
  const {default: promiseHelpers} = require("@chumager/promise-helpers");
  class localPromise extends Promise {}
  promiseHelpers(localPromise);
  const db = new mongoose.Mongoose();
  await db.connect("mongodb+srv://dobleimpacto:AlzkmwpTgSWao@dev.trcwd.mongodb.net/Dev?retryWrites=true&w=majority", {
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
  subSchema.index({test: 1});
  db.plugin(schema => {
    schema.eachPath((pathname, schemaType) => {
      if (schemaType.options.filter) {
        let index = schema.indexes().find(index => index[0][pathname]);
        console.log(schema.set("weakModel"));
        if (!index && pathname !== "_id" && !schema.set("weakModel")) {
          schema.index({[pathname]: 1}, {partialFilterExpression: {active: true}});
        }
      }
    });
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
  console.log("PARENT", cluster.worker.id, await model.countDocuments());
  console.log("WEAK", cluster.worker.id, await db.model("testModel_subSchema").countDocuments());
  await localPromise.delay(3000);
  process.exit(0);
}
