"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwaggerExplorer = void 0;
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const shared_utils_1 = require("@nestjs/common/utils/shared.utils");
const metadata_scanner_1 = require("@nestjs/core/metadata-scanner");
const route_path_factory_1 = require("@nestjs/core/router/route-path-factory");
const lodash_1 = require("lodash");
const pathToRegexp = require("path-to-regexp");
const constants_2 = require("./constants");
const api_exclude_controller_explorer_1 = require("./explorers/api-exclude-controller.explorer");
const api_exclude_endpoint_explorer_1 = require("./explorers/api-exclude-endpoint.explorer");
const api_extra_models_explorer_1 = require("./explorers/api-extra-models.explorer");
const api_headers_explorer_1 = require("./explorers/api-headers.explorer");
const api_operation_explorer_1 = require("./explorers/api-operation.explorer");
const api_parameters_explorer_1 = require("./explorers/api-parameters.explorer");
const api_response_explorer_1 = require("./explorers/api-response.explorer");
const api_security_explorer_1 = require("./explorers/api-security.explorer");
const api_use_tags_explorer_1 = require("./explorers/api-use-tags.explorer");
const mimetype_content_wrapper_1 = require("./services/mimetype-content-wrapper");
const is_body_parameter_util_1 = require("./utils/is-body-parameter.util");
const merge_and_uniq_util_1 = require("./utils/merge-and-uniq.util");
class SwaggerExplorer {
    constructor(schemaObjectFactory) {
        this.schemaObjectFactory = schemaObjectFactory;
        this.mimetypeContentWrapper = new mimetype_content_wrapper_1.MimetypeContentWrapper();
        this.metadataScanner = new metadata_scanner_1.MetadataScanner();
        this.schemas = {};
        this.operationIdFactory = (controllerKey, methodKey) => controllerKey ? `${controllerKey}_${methodKey}` : methodKey;
    }
    exploreController(wrapper, applicationConfig, modulePath, globalPrefix, operationIdFactory) {
        this.routePathFactory = new route_path_factory_1.RoutePathFactory(applicationConfig);
        if (operationIdFactory) {
            this.operationIdFactory = operationIdFactory;
        }
        const { instance, metatype } = wrapper;
        const prototype = Object.getPrototypeOf(instance);
        const documentResolvers = {
            root: [
                this.exploreRoutePathAndMethod,
                api_operation_explorer_1.exploreApiOperationMetadata,
                api_parameters_explorer_1.exploreApiParametersMetadata.bind(null, this.schemas)
            ],
            security: [api_security_explorer_1.exploreApiSecurityMetadata],
            tags: [api_use_tags_explorer_1.exploreApiTagsMetadata],
            responses: [api_response_explorer_1.exploreApiResponseMetadata.bind(null, this.schemas)]
        };
        return this.generateDenormalizedDocument(metatype, prototype, instance, documentResolvers, applicationConfig, modulePath, globalPrefix);
    }
    getSchemas() {
        return this.schemas;
    }
    generateDenormalizedDocument(metatype, prototype, instance, documentResolvers, applicationConfig, modulePath, globalPrefix) {
        const self = this;
        const excludeController = api_exclude_controller_explorer_1.exploreApiExcludeControllerMetadata(metatype);
        if (excludeController) {
            return [];
        }
        const globalMetadata = this.exploreGlobalMetadata(metatype);
        const ctrlExtraModels = api_extra_models_explorer_1.exploreGlobalApiExtraModelsMetadata(metatype);
        this.registerExtraModels(ctrlExtraModels);
        const denormalizedPaths = this.metadataScanner
            .scanFromPrototype(instance, prototype, (name) => {
            const targetCallback = prototype[name];
            const excludeEndpoint = api_exclude_endpoint_explorer_1.exploreApiExcludeEndpointMetadata(instance, prototype, targetCallback);
            if (excludeEndpoint && excludeEndpoint.disable) {
                return;
            }
            const ctrlExtraModels = api_extra_models_explorer_1.exploreApiExtraModelsMetadata(instance, prototype, targetCallback);
            this.registerExtraModels(ctrlExtraModels);
            const methodMetadata = lodash_1.mapValues(documentResolvers, (explorers) => explorers.reduce((metadata, fn) => {
                const exploredMetadata = fn.call(self, instance, prototype, targetCallback, metatype, globalPrefix, modulePath, applicationConfig);
                if (!exploredMetadata) {
                    return metadata;
                }
                if (!lodash_1.isArray(exploredMetadata)) {
                    return Object.assign(Object.assign({}, metadata), exploredMetadata);
                }
                return lodash_1.isArray(metadata)
                    ? [...metadata, ...exploredMetadata]
                    : exploredMetadata;
            }, {}));
            const mergedMethodMetadata = this.mergeMetadata(globalMetadata, lodash_1.omitBy(methodMetadata, lodash_1.isEmpty));
            return this.migrateOperationSchema(Object.assign(Object.assign({ responses: {} }, lodash_1.omit(globalMetadata, 'chunks')), mergedMethodMetadata), prototype, targetCallback);
        })
            .filter((path) => { var _a; return (_a = path.root) === null || _a === void 0 ? void 0 : _a.path; });
        return denormalizedPaths;
    }
    exploreGlobalMetadata(metatype) {
        const globalExplorers = [
            api_use_tags_explorer_1.exploreGlobalApiTagsMetadata,
            api_security_explorer_1.exploreGlobalApiSecurityMetadata,
            api_response_explorer_1.exploreGlobalApiResponseMetadata.bind(null, this.schemas),
            api_headers_explorer_1.exploreGlobalApiHeaderMetadata
        ];
        const globalMetadata = globalExplorers
            .map((explorer) => explorer.call(explorer, metatype))
            .filter((val) => !shared_utils_1.isUndefined(val))
            .reduce((curr, next) => {
            if (next.depth) {
                return Object.assign(Object.assign({}, curr), { chunks: (curr.chunks || []).concat(next) });
            }
            return Object.assign(Object.assign({}, curr), next);
        }, {});
        return globalMetadata;
    }
    exploreRoutePathAndMethod(instance, prototype, method, metatype, globalPrefix, modulePath, applicationConfig) {
        const methodPath = Reflect.getMetadata(constants_1.PATH_METADATA, method);
        if (shared_utils_1.isUndefined(methodPath)) {
            return undefined;
        }
        const requestMethod = Reflect.getMetadata(constants_1.METHOD_METADATA, method);
        const methodVersion = Reflect.getMetadata(constants_1.VERSION_METADATA, method);
        const controllerVersion = this.getVersionMetadata(metatype, applicationConfig.getVersioning());
        const allRoutePaths = this.routePathFactory.create({
            methodPath,
            methodVersion,
            modulePath,
            globalPrefix,
            controllerVersion,
            ctrlPath: this.reflectControllerPath(metatype),
            versioningOptions: applicationConfig.getVersioning()
        }, requestMethod);
        const fullPath = this.validateRoutePath(lodash_1.head(allRoutePaths));
        const apiExtension = Reflect.getMetadata(constants_2.DECORATORS.API_EXTENSION, method);
        return Object.assign({ method: common_1.RequestMethod[requestMethod].toLowerCase(), path: fullPath === '' ? '/' : fullPath, operationId: this.getOperationId(instance, method) }, apiExtension);
    }
    getOperationId(instance, method) {
        var _a;
        return this.operationIdFactory(((_a = instance.constructor) === null || _a === void 0 ? void 0 : _a.name) || '', method.name);
    }
    reflectControllerPath(metatype) {
        return Reflect.getMetadata(constants_1.PATH_METADATA, metatype);
    }
    validateRoutePath(path) {
        if (shared_utils_1.isUndefined(path)) {
            return '';
        }
        if (Array.isArray(path)) {
            path = lodash_1.head(path);
        }
        let pathWithParams = '';
        for (const item of pathToRegexp.parse(path)) {
            pathWithParams += shared_utils_1.isString(item) ? item : `${item.prefix}{${item.name}}`;
        }
        return pathWithParams === '/' ? '' : shared_utils_1.addLeadingSlash(pathWithParams);
    }
    mergeMetadata(globalMetadata, methodMetadata) {
        if (methodMetadata.root && !methodMetadata.root.parameters) {
            methodMetadata.root.parameters = [];
        }
        const deepMerge = (metadata) => (value, key) => {
            if (!metadata[key]) {
                return value;
            }
            const globalValue = metadata[key];
            if (metadata.depth) {
                return this.deepMergeMetadata(globalValue, value, metadata.depth);
            }
            return this.mergeValues(globalValue, value);
        };
        if (globalMetadata.chunks) {
            const { chunks } = globalMetadata;
            chunks.forEach((chunk) => {
                methodMetadata = lodash_1.mapValues(methodMetadata, deepMerge(chunk));
            });
        }
        return lodash_1.mapValues(methodMetadata, deepMerge(globalMetadata));
    }
    deepMergeMetadata(globalValue, methodValue, maxDepth, currentDepthLevel = 0) {
        if (currentDepthLevel === maxDepth) {
            return this.mergeValues(globalValue, methodValue);
        }
        return lodash_1.mapValues(methodValue, (value, key) => {
            if (key in globalValue) {
                return this.deepMergeMetadata(globalValue[key], methodValue[key], maxDepth, currentDepthLevel + 1);
            }
            return value;
        });
    }
    mergeValues(globalValue, methodValue) {
        if (!lodash_1.isArray(globalValue)) {
            return Object.assign(Object.assign({}, globalValue), methodValue);
        }
        return [...globalValue, ...methodValue];
    }
    migrateOperationSchema(document, prototype, method) {
        const parametersObject = lodash_1.get(document, 'root.parameters');
        const requestBodyIndex = (parametersObject || []).findIndex(is_body_parameter_util_1.isBodyParameter);
        if (requestBodyIndex < 0) {
            return document;
        }
        const requestBody = parametersObject[requestBodyIndex];
        parametersObject.splice(requestBodyIndex, 1);
        const classConsumes = Reflect.getMetadata(constants_2.DECORATORS.API_CONSUMES, prototype);
        const methodConsumes = Reflect.getMetadata(constants_2.DECORATORS.API_CONSUMES, method);
        let consumes = merge_and_uniq_util_1.mergeAndUniq(classConsumes, methodConsumes);
        consumes = lodash_1.isEmpty(consumes) ? ['application/json'] : consumes;
        const keysToRemove = ['schema', 'in', 'name', 'examples'];
        document.root.requestBody = Object.assign(Object.assign({}, lodash_1.omit(requestBody, keysToRemove)), this.mimetypeContentWrapper.wrap(consumes, lodash_1.pick(requestBody, ['schema', 'examples'])));
        return document;
    }
    registerExtraModels(extraModels) {
        extraModels.forEach((item) => this.schemaObjectFactory.exploreModelSchema(item, this.schemas));
    }
    getVersionMetadata(metatype, versioningOptions) {
        return (versioningOptions === null || versioningOptions === void 0 ? void 0 : versioningOptions.type) === common_1.VersioningType.URI
            ? Reflect.getMetadata(constants_1.VERSION_METADATA, metatype)
            : undefined;
    }
}
exports.SwaggerExplorer = SwaggerExplorer;
