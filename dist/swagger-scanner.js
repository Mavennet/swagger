"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwaggerScanner = void 0;
const constants_1 = require("@nestjs/common/constants");
const lodash_1 = require("lodash");
const model_properties_accessor_1 = require("./services/model-properties-accessor");
const schema_object_factory_1 = require("./services/schema-object-factory");
const swagger_types_mapper_1 = require("./services/swagger-types-mapper");
const swagger_explorer_1 = require("./swagger-explorer");
const swagger_transformer_1 = require("./swagger-transformer");
const strip_last_slash_util_1 = require("./utils/strip-last-slash.util");
class SwaggerScanner {
    constructor() {
        this.transfomer = new swagger_transformer_1.SwaggerTransformer();
        this.schemaObjectFactory = new schema_object_factory_1.SchemaObjectFactory(new model_properties_accessor_1.ModelPropertiesAccessor(), new swagger_types_mapper_1.SwaggerTypesMapper());
        this.explorer = new swagger_explorer_1.SwaggerExplorer(this.schemaObjectFactory);
    }
    scanApplication(app, options) {
        const { deepScanRoutes, include: includedModules = [], extraModels = [], ignoreGlobalPrefix = false, operationIdFactory } = options;
        const container = app.container;
        const internalConfigRef = app.config;
        const modules = this.getModules(container.getModules(), includedModules);
        const globalPrefix = !ignoreGlobalPrefix
            ? strip_last_slash_util_1.stripLastSlash(this.getGlobalPrefix(app))
            : '';
        const denormalizedPaths = modules.map(({ routes, metatype, relatedModules }) => {
            let result = [];
            if (deepScanRoutes) {
                const isGlobal = (module) => !container.isGlobalModule(module);
                Array.from(relatedModules.values())
                    .filter(isGlobal)
                    .forEach(({ metatype, routes }) => {
                    const modulePath = this.getModulePathMetadata(container, metatype);
                    result = result.concat(this.scanModuleRoutes(routes, modulePath, globalPrefix, internalConfigRef, operationIdFactory));
                });
            }
            const modulePath = this.getModulePathMetadata(container, metatype);
            return result.concat(this.scanModuleRoutes(routes, modulePath, globalPrefix, internalConfigRef, operationIdFactory));
        });
        const schemas = this.explorer.getSchemas();
        this.addExtraModels(schemas, extraModels);
        return Object.assign(Object.assign({}, this.transfomer.normalizePaths(lodash_1.flatten(denormalizedPaths))), { components: {
                schemas: schemas
            } });
    }
    scanModuleRoutes(routes, modulePath, globalPrefix, applicationConfig, operationIdFactory) {
        const denormalizedArray = [...routes.values()].map((ctrl) => this.explorer.exploreController(ctrl, applicationConfig, modulePath, globalPrefix, operationIdFactory));
        return lodash_1.flatten(denormalizedArray);
    }
    getModules(modulesContainer, include) {
        if (!include || lodash_1.isEmpty(include)) {
            return [...modulesContainer.values()];
        }
        return [...modulesContainer.values()].filter(({ metatype }) => include.some((item) => item === metatype));
    }
    addExtraModels(schemas, extraModels) {
        extraModels.forEach((item) => {
            this.schemaObjectFactory.exploreModelSchema(item, schemas);
        });
    }
    getGlobalPrefix(app) {
        const internalConfigRef = app.config;
        return (internalConfigRef && internalConfigRef.getGlobalPrefix()) || '';
    }
    getModulePathMetadata(container, metatype) {
        const modulesContainer = container.getModules();
        const modulePath = Reflect.getMetadata(constants_1.MODULE_PATH + modulesContainer.applicationId, metatype);
        return modulePath !== null && modulePath !== void 0 ? modulePath : Reflect.getMetadata(constants_1.MODULE_PATH, metatype);
    }
}
exports.SwaggerScanner = SwaggerScanner;
