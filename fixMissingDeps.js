// ESM-compatible: wrap all logic in an async IIFE
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
// ESM-compatible: wrap all logic in an async IIFE
// ESM-compatible: wrap all logic in an async IIFE
(function () { return __awaiter(_this, void 0, void 0, function () {
    // Recursively find all .ts files
    function findTSFiles(dir) {
        for (var _i = 0, _a = fs.readdirSync(dir); _i < _a.length; _i++) {
            var file = _a[_i];
            var fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                findTSFiles(fullPath);
            }
            else if (file.endsWith('.ts')) {
                tsFiles.push(fullPath);
            }
        }
    }
    var fs, path, execSync, projectRoot, tsFiles, importedModules, installedModules, installedTypes, alreadyPresent, importRegex, pkgPath, pkg, allDeps, _i, importedModules_1, mod, tsconfigPath, tsconfig;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('fs'); })];
            case 1:
                fs = _a.sent();
                return [4 /*yield*/, Promise.resolve().then(function () { return require('path'); })];
            case 2:
                path = _a.sent();
                return [4 /*yield*/, Promise.resolve().then(function () { return require('child_process'); })];
            case 3:
                execSync = (_a.sent()).execSync;
                projectRoot = process.cwd();
                tsFiles = [];
                importedModules = new Set();
                installedModules = [];
                installedTypes = [];
                alreadyPresent = [];
                findTSFiles(projectRoot);
                importRegex = /import\s+(?:.+?\s+from\s+)?["']([^"']+)["']/g;
                tsFiles.forEach(function (file) {
                    var content = fs.readFileSync(file, 'utf8');
                    var match;
                    while ((match = importRegex.exec(content)) !== null) {
                        var mod = match[1];
                        // Ignore relative imports
                        if (!mod.startsWith('.') && !mod.startsWith('/')) {
                            importedModules.add(mod.split('/')[0] === '@' ? mod.split('/').slice(0, 2).join('/') : mod.split('/')[0]);
                        }
                    }
                });
                pkgPath = path.join(projectRoot, 'package.json');
                pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                allDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
                // Check and install missing modules
                for (_i = 0, importedModules_1 = importedModules; _i < importedModules_1.length; _i++) {
                    mod = importedModules_1[_i];
                    if (allDeps[mod]) {
                        alreadyPresent.push(mod);
                        continue;
                    }
                    try {
                        execSync("npm install ".concat(mod), { stdio: 'inherit' });
                        installedModules.push(mod);
                    }
                    catch (e) {
                        console.error("Failed to install ".concat(mod));
                    }
                    // Try to install type declarations
                    if (!mod.startsWith('@types/')) {
                        try {
                            execSync("npm install --save-dev @types/".concat(mod.replace('@', '').replace('/', '__')), { stdio: 'inherit' });
                            installedTypes.push("@types/".concat(mod.replace('@', '').replace('/', '__')));
                        }
                        catch (e) {
                            // Some modules may not have types
                        }
                    }
                }
                tsconfigPath = path.join(projectRoot, 'tsconfig.json');
                if (fs.existsSync(tsconfigPath)) {
                    tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
                }
                else {
                    tsconfig = {};
                }
                return [2 /*return*/];
        }
    });
}); })();
