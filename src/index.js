/* TODO
 * se debe validar la estructura recursiva para evitar choques.
 * se debe validar si se necesitará usar un parámetro tipo "keep" para evitar sobrecarga en la configuración recursiva.
 */
import mutex from "@chumager/mongoose-mutex";
const plugin = async (schema, options) => {
  if (!options.name) throw new Error("option.name is needed to create new weak Model");
  if (!options.db) throw new Error("option.db is needed to create new weak Model");
  let {name} = options;
  const {db} = options;
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
        applyPlugins = true,
        parentName
      } = weakModelOptions;
      const nameLC = name.toLowerCase();
      subSchema = subSchema.clone();
      if (applyPlugins) subSchema.$globalPluginsApplied = false;
      subSchema.add({
        [nameLC]: {
          type: schema.path("_id").instance,
          ...schema.path("_id").options,
          immutable: true,
          name: parentName || name,
          ref: name,
          filter: true,
          pos: 0,
          tablePos: 0,
          parent: true,
          hidden: false
        }
      });
      if (set) {
        for (const key in set) {
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
            tablePos: 1,
            pos: 1
          }
        });
      if (total)
        subSchema.add({
          _total: {
            type: Number,
            name: "Tº",
            tablePos: 2,
            pos: 2
          }
        });
      Object.keys(projection).forEach(path => {
        if (schema.path(path) && projection[path] === 1) {
          subSchema.add(schema.pick([path]));
          subSchema.path(path).options.fromParent = true;
          subSchema.path(path).options.immutable = true;
        }
      });
      subSchema.method(
        "save",
        async function () {
          //first get the modelName to search, the id of the model and my id
          const parent = await this.constructor.model(name).findById(this[nameLC]);
          let doc;
          if (this._id) doc = parent[path].id(this._id);
          else if (this._position) {
            const localPosition = position === "Human" ? this._position - 1 : this._position;
            doc = parent[path][localPosition];
          } else
            throw new Error(
              `weak model ${weakModelName} ain't have _id nor _position\n${JSON.stringify(this, null, 2)}`
            );
          if (!doc)
            throw new Error(`weak model ${weakModelName} doesn't exist, id: ${this._id}, position: ${this._position}`);
          doc.set(this);
          doc.$locals = this.$locals;
          parent.$locals = this.$locals;
          return parent.save();
        },
        {suppressWarning: true}
      );
      if (extraFields) subSchema.add(extraFields);
      if (statics) subSchema.static(statics);
      if (methods) subSchema.method(methods);

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
      if (post) post(subSchema, schema, db);
      db.model(weakModelName, subSchema);
      await plugin(subSchema, {name: weakModelName, db});
    })
  );
  return;
};

async function weakModels(db) {
  const {lock} = mutex({db, TTL: 30});
  const {models} = db;
  await Promise.all(
    Object.keys(models).map(async modelName => {
      await lock({
        lockName: modelName,
        fn: async () => {
          await plugin(models[modelName].schema, {name: modelName, db}).atLeast(20000);
        }
      });
    })
  );
}
export {weakModels, plugin};
