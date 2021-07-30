import { Controller } from '@nestjs/common/interfaces';
import { ApplicationConfig } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { DenormalizedDoc } from './interfaces/denormalized-doc.interface';
import { SchemaObject } from './interfaces/open-api-spec.interface';
import { SchemaObjectFactory } from './services/schema-object-factory';
export declare class SwaggerExplorer {
    private readonly schemaObjectFactory;
    private readonly mimetypeContentWrapper;
    private readonly metadataScanner;
    private readonly schemas;
    private operationIdFactory;
    private routePathFactory?;
    constructor(schemaObjectFactory: SchemaObjectFactory);
    exploreController(wrapper: InstanceWrapper<Controller>, applicationConfig: ApplicationConfig, modulePath?: string | undefined, globalPrefix?: string | undefined, operationIdFactory?: (controllerKey: string, methodKey: string) => string): DenormalizedDoc[];
    getSchemas(): Record<string, SchemaObject>;
    private generateDenormalizedDocument;
    private exploreGlobalMetadata;
    private exploreRoutePathAndMethod;
    private getOperationId;
    private reflectControllerPath;
    private validateRoutePath;
    private mergeMetadata;
    private deepMergeMetadata;
    private mergeValues;
    private migrateOperationSchema;
    private registerExtraModels;
    private getVersionMetadata;
}
