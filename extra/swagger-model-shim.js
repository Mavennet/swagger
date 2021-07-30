// this "shim" can be used on the frontend to prevent from errors on undefined
// decorators in the models, when you are sharing same models across backend and frontend.
// to use this shim simply configure your systemjs/webpack configuration to use this file instead of typeorm module.

// for system.js this resolved this way:
// System.config({
//     ...
//     packages: {
//         "swagger": {
//             main: "swagger-model-shim.js",
//             defaultExtension: "js"
//         }
//     }
// }

// for webpack this is resolved this way:
// resolve: { // see: https://webpack.js.org/configuration/resolve/
//     alias: {
//         typeorm: path.resolve(__dirname, "../node_modules/swagger/swagger-model-shim")
//     }
// }

function Directive() {
    return () => {}
}
exports.Directive = Directive

function ApiProperty() {
    return () => {}
}
exports.ApiProperty = ApiProperty

function ApiPropertyOptional() {
    return () => {}
}
exports.ApiPropertyOptional = ApiPropertyOptional
