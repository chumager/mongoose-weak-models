"use strict";Object.defineProperty(exports,"__esModule",{value:!0}),exports.weakModels=weakModels,exports.plugin=void 0;const plugin=async(e,t)=>{if(!t.name)throw new Error("option.name is needed to create new weak Model");if(!t.db)throw new Error("option.db is needed to create new weak Model");const{name:o,db:i}=t,a=[];e.childSchemas.forEach(({schema:e,model:t})=>{t.$isArraySubdocument&&e.set("weakModel")&&a.push({subSchema:e,model:t})}),await Promise.all(a.map(async({subSchema:t,model:a})=>{const{path:s}=a,n=`${o}_${s}`,l=t.set("weakModel");let r;switch(typeof l){case"function":r=await l(t,e,i);break;case"object":r=await l;break;case"boolean":r={}}const{projection:c={},statics:d,methods:p,post:h,extraFields:m,collation:u,position:w,preAggregate:$,postAggregate:b,total:_,set:y,applyPlugins:f=!0}=r,g=o.toLowerCase();if(t=t.clone(),f&&(t.$globalPluginsApplied=!1),t.add({[g]:{type:e.path("_id").instance,...e.path("_id").options,immutable:!0,name:o,ref:o,filter:!0,pos:0,tablePos:0,parent:!0,hidden:!1}}),y)for(const e in y)t.set(e,y[e]);t.static({parentPath:g,parentModel(){return this.model(o)}}),w&&t.add({_position:{type:Number,name:"Nº",tablePos:1,pos:1}}),_&&t.add({_total:{type:Number,name:"Tº",tablePos:2,pos:2}}),Object.keys(c).forEach(o=>{e.path(o)&&1===c[o]&&(t.add(e.pick([o])),t.path(o).options.fromParent=!0)}),t.method("save",(async function(){const e=await this.constructor.model(o).findById(this[g]);let t;if(this._id)t=e[s].id(this._id);else{if(!this._position)throw new Error(`weak model ${n} ain't have _id nor _position\n${JSON.stringify(this,null,2)}`);{const o="Human"===w?this._position-1:this._position;t=e[s][o]}}if(!t)throw new Error(`weak model ${n} doesn't exist, id: ${this._id}, position: ${this._position}`);return t.set(this),t.$locals=this.$locals,e.$locals=this.$locals,e.save()}),{suppressWarning:!0}),m&&t.add(m),d&&t.static(d),p&&t.method(p),h&&h(t,e,i);const k=e.set("collection")||i.pluralize()(o),P=i.pluralize()(n);let M=[{$project:{[o.toLowerCase()]:"$_id",_id:0,[s]:1,...c,..._?{_total:{$size:"$"+s}}:{}}},{$unwind:{path:"$"+s,includeArrayIndex:"_position",preserveNullAndEmptyArrays:!1}},{$replaceRoot:{newRoot:{$mergeObjects:["$$ROOT","$"+s]}}},{$project:{[s]:0}}];"Human"===w&&M.push({$addFields:{_position:{$add:["$_position",1]}}}),$&&(M=[].concat($,M)),b&&(M=[].concat(M,b));try{await i.connection.dropCollection(P)}finally{await i.connection.createCollection(P,{viewOn:k,pipeline:M,...u?{collation:u}:{}})}i.model(n,t)}))};async function weakModels(e){const{models:t}=e;await Promise.all(Object.keys(t).map(async o=>{await plugin(t[o].schema,{name:o,db:e})}))}exports.plugin=plugin;