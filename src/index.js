const plugin = async (schema, options) => {
  if (!options.name) throw new Error("option.name is needed to create new weak Model");
  if (!options.db) throw new Error("option.db is needed to create new weak Model");
  const {name, db} = options;
  const weakModels = [];
  schema.childSchemas.forEach(({schema: subSchema, model}) => {
    //detectamos si es un arreglo de subdocumentos
    if (model.$isArraySubdocument && subSchema.set("weakModel")) {
      weakModels.push({subSchema, model});
    }
  });
  await Promise.all(
    weakModels.map(async ({subSchema, model}) => {
      const {path} = model;
      const weakModelName = `${name}_${path}`;
      const weakModel = subSchema.set("weakModel");
      console.log("new weak model", name, path);
      let weakModelOptions;
      switch (typeof weakModel) {
        case "function":
          weakModelOptions = await weakModel(subSchema, schema, db);
          break;
        case "object":
          weakModelOptions = await weakModel;
          break;
        case "boolean":
          weakModelOptions = {};
      }

      const {
        projection = {},
        statics,
        methods,
        post,
        extraFields,
        collation,
        position,
        preAggregate,
        postAggregate,
        total,
        set,
        applyPlugins = true
      } = weakModelOptions || {};
      const nameLC = name.toLowerCase();
      //const {options} = subSchema;
      //subSchema = new db.Schema(subSchema.clone());
      subSchema = subSchema.clone();
      if (applyPlugins) subSchema.$globalPluginsApplied = false;
      console.log(subSchema);
      subSchema.add({
        [nameLC]: {...schema.tree._id, immutable: true, name, ref: name, filter: true, pos: 0, parent: true}
      });
      //reincorporate the options
      /*
       *for (const key in options) {
       *  console.log("RESET", key, options[key]);
       *  subSchema.set(key, options[key]);
       *}
       */
      if (set) {
        for (const key in set) {
          console.log("SET", key, set[key]);
          subSchema.set(key, set[key]);
        }
      }
      subSchema.static({
        parentPath: nameLC,
        parentModel() {
          return this.model(name);
        }
      });
      if (position)
        subSchema.add({
          _position: {
            type: Number,
            name: "Nº",
            pos: 1
          }
        });
      if (total)
        subSchema.add({
          _total: {
            type: Number,
            name: "Tº",
            pos: 2
          }
        });
      Object.keys(projection).forEach(path => {
        if (schema.path(path) && projection[path] === 1) {
          subSchema.add({
            [path]: {...schema.tree[path], fromParent: true}
          });
        }
      });
      subSchema.method(
        "save",
        async function () {
          //first get the modelName to search, the id of the model and my id
          const parent = await this.constructor.model(name).findById(this[name.toLowerCase()]);
          const doc = parent[path].id(this._id);
          doc.set(this);
          doc.$locals = this.$locals;
          parent.$locals = this.$locals;
          console.log("parent locals", parent.$locals);
          return parent.save();
        },
        {suppressWarning: true}
      );
      if (extraFields) subSchema.add(extraFields);
      if (statics) subSchema.static(statics);
      if (methods) subSchema.method(methods);
      if (post) post(subSchema, schema, db);

      const viewOn = schema.set("collection") || db.pluralize()(name);
      const localCollection = db.pluralize()(weakModelName);
      //view drop&create
      let aggregate = [
        {
          $project: {
            [name.toLowerCase()]: "$_id",
            _id: 0,
            [path]: 1,
            ...projection,
            ...(total ? {_total: {$size: `$${path}`}} : {})
          }
        },
        {
          $unwind: {
            path: `$${path}`,
            includeArrayIndex: "_position",
            preserveNullAndEmptyArrays: false
          }
        },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: ["$$ROOT", `$${path}`]
            }
          }
        },
        {
          $project: {
            [path]: 0
          }
        }
      ];
      if (position === "Human") {
        aggregate.push({
          $addFields: {
            _position: {$add: ["$_position", 1]}
          }
        });
      }
      if (preAggregate) aggregate = [].concat(preAggregate, aggregate);
      if (postAggregate) aggregate = [].concat(aggregate, postAggregate);
      try {
        await db.connection.dropCollection(localCollection);
      } finally {
        await db.connection.createCollection(localCollection, {
          viewOn,
          pipeline: aggregate,
          ...(collation ? {collation} : {})
        });
      }
      db.model(weakModelName, subSchema);
      //TODO recursion...
    })
  );
};

async function weakModels(db) {
  const {models} = db;
  await Promise.all(
    Object.keys(models).map(async modelName => {
      await plugin(models[modelName].schema, {name: modelName, db});
    })
  );
}
export {weakModels, plugin};
