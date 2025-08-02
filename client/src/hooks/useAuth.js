"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAuth = useAuth;
var react_query_1 = require("@tanstack/react-query");
var queryClient_1 = require("@/lib/queryClient");
function useAuth() {
    var _a = (0, react_query_1.useQuery)({
        queryKey: ["/api/auth/user"],
        queryFn: (0, queryClient_1.getQueryFn)({ on401: "returnNull" }),
        retry: false,
        staleTime: 0, // Always check freshness
        refetchOnWindowFocus: true,
        refetchOnMount: true,
    }), data = _a.data, isLoading = _a.isLoading, error = _a.error, refetch = _a.refetch;
    // Extract user from the response
    var user = (data === null || data === void 0 ? void 0 : data.user) || null;
    // Debug logging for authentication state
    if (process.env.NODE_ENV === 'development') {
        console.log('Auth State:', { user: user, isLoading: isLoading, error: error === null || error === void 0 ? void 0 : error.message, isAuthenticated: !!user && !error });
    }
    return {
        user: user,
        isLoading: isLoading,
        isAuthenticated: !!user && !error,
        refetch: refetch,
    };
}
