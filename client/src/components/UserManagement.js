"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = UserManagement;
var react_1 = require("react");
var react_query_1 = require("@tanstack/react-query");
var button_1 = require("@/components/ui/button");
var input_1 = require("@/components/ui/input");
var card_1 = require("@/components/ui/card");
var dialog_1 = require("@/components/ui/dialog");
var badge_1 = require("@/components/ui/badge");
var use_toast_1 = require("@/hooks/use-toast");
var queryClient_1 = require("@/lib/queryClient");
var lucide_react_1 = require("lucide-react");
function UserManagement() {
    var _this = this;
    var _a = (0, react_1.useState)(false), showCreateDialog = _a[0], setShowCreateDialog = _a[1];
    var _b = (0, react_1.useState)(null), editingUser = _b[0], setEditingUser = _b[1];
    var _c = (0, react_1.useState)({
        username: "",
        password: "",
        email: "",
        firstName: "",
        lastName: ""
    }), newUser = _c[0], setNewUser = _c[1];
    var toast = (0, use_toast_1.useToast)().toast;
    var queryClient = (0, react_query_1.useQueryClient)();
    // Fetch all users
    var _d = (0, react_query_1.useQuery)({
        queryKey: ["/api/admin/users"],
        retry: false,
    }), _e = _d.data, users = _e === void 0 ? [] : _e, isLoading = _d.isLoading;
    // Create user mutation
    var createUserMutation = (0, react_query_1.useMutation)({
        mutationFn: function (userData) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, queryClient_1.apiRequest)("/api/admin/users", "POST", userData)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            setShowCreateDialog(false);
            setNewUser({ username: "", password: "", email: "", firstName: "", lastName: "" });
            toast({
                title: "User Created",
                description: "New user has been created successfully.",
            });
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to create user",
                variant: "destructive",
            });
        },
    });
    // Update user mutation
    var updateUserMutation = (0, react_query_1.useMutation)({
        mutationFn: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
            var id = _b.id, userData = _b.userData;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, (0, queryClient_1.apiRequest)("/api/admin/users/".concat(id), "PUT", userData)];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            setEditingUser(null);
            toast({
                title: "User Updated",
                description: "User information has been updated successfully.",
            });
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to update user",
                variant: "destructive",
            });
        },
    });
    // Delete user mutation
    var deleteUserMutation = (0, react_query_1.useMutation)({
        mutationFn: function (userId) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, queryClient_1.apiRequest)("/api/admin/users/".concat(userId), "DELETE")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
            toast({
                title: "User Deleted",
                description: "User has been deleted successfully.",
            });
        },
        onError: function (error) {
            toast({
                title: "Error",
                description: error.message || "Failed to delete user",
                variant: "destructive",
            });
        },
    });
    var handleCreateUser = function () {
        if (!newUser.username || !newUser.password) {
            toast({
                title: "Validation Error",
                description: "Username and password are required",
                variant: "destructive",
            });
            return;
        }
        createUserMutation.mutate(newUser);
    };
    var handleUpdateUser = function (user) {
        updateUserMutation.mutate({ id: user.id, userData: user });
    };
    var handleDeleteUser = function (userId) {
        if (confirm("Are you sure you want to delete this user?")) {
            deleteUserMutation.mutate(userId);
        }
    };
    if (isLoading) {
        return (<div className="flex items-center justify-center p-8">
        <div className="text-purple-400">Loading users...</div>
      </div>);
    }
    return (<div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <lucide_react_1.Users className="h-6 w-6 text-purple-400"/>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            User Management
          </h2>
        </div>
        
        <dialog_1.Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <dialog_1.DialogTrigger asChild>
            <button_1.Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700">
              <lucide_react_1.UserPlus className="h-4 w-4 mr-2"/>
              Add User
            </button_1.Button>
          </dialog_1.DialogTrigger>
          <dialog_1.DialogContent className="bg-black/90 border-purple-500/30">
            <dialog_1.DialogHeader>
              <dialog_1.DialogTitle className="text-purple-400">Create New User</dialog_1.DialogTitle>
              <dialog_1.DialogDescription className="text-gray-400">
                Add a new user to the ZED system with secure access.
              </dialog_1.DialogDescription>
            </dialog_1.DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input_1.Input placeholder="Username" value={newUser.username} onChange={function (e) { return setNewUser(__assign(__assign({}, newUser), { username: e.target.value })); }} className="bg-black/50 border-purple-500/50 text-white"/>
                <input_1.Input type="password" placeholder="Password" value={newUser.password} onChange={function (e) { return setNewUser(__assign(__assign({}, newUser), { password: e.target.value })); }} className="bg-black/50 border-purple-500/50 text-white"/>
              </div>
              
              <input_1.Input type="email" placeholder="Email" value={newUser.email} onChange={function (e) { return setNewUser(__assign(__assign({}, newUser), { email: e.target.value })); }} className="bg-black/50 border-purple-500/50 text-white"/>
              
              <div className="grid grid-cols-2 gap-4">
                <input_1.Input placeholder="First Name" value={newUser.firstName} onChange={function (e) { return setNewUser(__assign(__assign({}, newUser), { firstName: e.target.value })); }} className="bg-black/50 border-purple-500/50 text-white"/>
                <input_1.Input placeholder="Last Name" value={newUser.lastName} onChange={function (e) { return setNewUser(__assign(__assign({}, newUser), { lastName: e.target.value })); }} className="bg-black/50 border-purple-500/50 text-white"/>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button_1.Button variant="outline" onClick={function () { return setShowCreateDialog(false); }} className="border-gray-600 text-gray-300 hover:bg-gray-800">
                  Cancel
                </button_1.Button>
                <button_1.Button onClick={handleCreateUser} disabled={createUserMutation.isPending} className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700">
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </button_1.Button>
              </div>
            </div>
          </dialog_1.DialogContent>
        </dialog_1.Dialog>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <card_1.Card className="bg-black/60 border-purple-500/30">
          <card_1.CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <lucide_react_1.Users className="h-8 w-8 text-purple-400"/>
              <div>
                <p className="text-2xl font-bold text-white">{users.length}</p>
                <p className="text-sm text-gray-400">Total Users</p>
              </div>
            </div>
          </card_1.CardContent>
        </card_1.Card>
        
        <card_1.Card className="bg-black/60 border-cyan-500/30">
          <card_1.CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <lucide_react_1.UserCheck className="h-8 w-8 text-cyan-400"/>
              <div>
                <p className="text-2xl font-bold text-white">
                  {users.filter(function (u) { return u.isActive !== false; }).length}
                </p>
                <p className="text-sm text-gray-400">Active Users</p>
              </div>
            </div>
          </card_1.CardContent>
        </card_1.Card>
        
        <card_1.Card className="bg-black/60 border-yellow-500/30">
          <card_1.CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <lucide_react_1.Shield className="h-8 w-8 text-yellow-400"/>
              <div>
                <p className="text-2xl font-bold text-white">
                  {users.filter(function (u) { return u.username === 'Admin'; }).length}
                </p>
                <p className="text-sm text-gray-400">Admin Users</p>
              </div>
            </div>
          </card_1.CardContent>
        </card_1.Card>
      </div>

      {/* Users List */}
      <div className="grid gap-4">
        {users.map(function (user) {
            var _a;
            return (<card_1.Card key={user.id} className="bg-black/60 border-purple-500/20 hover:border-purple-500/40 transition-colors">
            <card_1.CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                    {((_a = user.firstName) === null || _a === void 0 ? void 0 : _a[0]) || user.username[0].toUpperCase()}
                  </div>
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-white">{user.firstName} {user.lastName}</h3>
                      {user.username === 'Admin' && (<badge_1.Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                          <lucide_react_1.Shield className="h-3 w-3 mr-1"/>
                          Admin
                        </badge_1.Badge>)}
                      {user.isActive !== false && (<badge_1.Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Active
                        </badge_1.Badge>)}
                    </div>
                    <p className="text-sm text-gray-400">@{user.username}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button_1.Button size="sm" variant="outline" onClick={function () { return setEditingUser(user); }} className="border-gray-600 text-gray-300 hover:bg-gray-800">
                    <lucide_react_1.Edit className="h-4 w-4"/>
                  </button_1.Button>
                  
                  {user.username !== 'Admin' && (<button_1.Button size="sm" variant="outline" onClick={function () { return handleDeleteUser(user.id); }} className="border-red-600 text-red-400 hover:bg-red-900/20" disabled={deleteUserMutation.isPending}>
                      <lucide_react_1.Trash2 className="h-4 w-4"/>
                    </button_1.Button>)}
                </div>
              </div>
            </card_1.CardContent>
          </card_1.Card>);
        })}
      </div>

      {/* Edit User Dialog */}
      {editingUser && (<dialog_1.Dialog open={!!editingUser} onOpenChange={function () { return setEditingUser(null); }}>
          <dialog_1.DialogContent className="bg-black/90 border-purple-500/30">
            <dialog_1.DialogHeader>
              <dialog_1.DialogTitle className="text-purple-400">Edit User</dialog_1.DialogTitle>
              <dialog_1.DialogDescription className="text-gray-400">
                Update user information and permissions.
              </dialog_1.DialogDescription>
            </dialog_1.DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input_1.Input placeholder="Username" value={editingUser.username} onChange={function (e) { return setEditingUser(__assign(__assign({}, editingUser), { username: e.target.value })); }} className="bg-black/50 border-purple-500/50 text-white"/>
                <input_1.Input type="email" placeholder="Email" value={editingUser.email} onChange={function (e) { return setEditingUser(__assign(__assign({}, editingUser), { email: e.target.value })); }} className="bg-black/50 border-purple-500/50 text-white"/>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <input_1.Input placeholder="First Name" value={editingUser.firstName} onChange={function (e) { return setEditingUser(__assign(__assign({}, editingUser), { firstName: e.target.value })); }} className="bg-black/50 border-purple-500/50 text-white"/>
                <input_1.Input placeholder="Last Name" value={editingUser.lastName} onChange={function (e) { return setEditingUser(__assign(__assign({}, editingUser), { lastName: e.target.value })); }} className="bg-black/50 border-purple-500/50 text-white"/>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button_1.Button variant="outline" onClick={function () { return setEditingUser(null); }} className="border-gray-600 text-gray-300 hover:bg-gray-800">
                  Cancel
                </button_1.Button>
                <button_1.Button onClick={function () { return handleUpdateUser(editingUser); }} disabled={updateUserMutation.isPending} className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700">
                  {updateUserMutation.isPending ? "Updating..." : "Update User"}
                </button_1.Button>
              </div>
            </div>
          </dialog_1.DialogContent>
        </dialog_1.Dialog>)}

      {users.length === 0 && (<card_1.Card className="bg-black/60 border-purple-500/20">
          <card_1.CardContent className="p-8 text-center">
            <lucide_react_1.Users className="h-12 w-12 text-gray-600 mx-auto mb-4"/>
            <h3 className="text-lg font-semibold text-gray-400 mb-2">No Users Found</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first user account.</p>
            <button_1.Button onClick={function () { return setShowCreateDialog(true); }} className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700">
              <lucide_react_1.UserPlus className="h-4 w-4 mr-2"/>
              Create First User
            </button_1.Button>
          </card_1.CardContent>
        </card_1.Card>)}
    </div>);
}
